import ts from "typescript";
import type { ParseResult } from "./parse.js";
import {
  resolveStaticMethodType,
  resolveInstanceMethodType,
  resolveInstanceMethodTypeForClass,
  resolveInstanceMethodDescriptor,
  resolveStaticFieldType as resolveStaticFieldTypeFromTable,
} from "./java-types.js";
import type {
  JvmType,
  IRExpr,
  IRStmt,
  Block,
  FunctionDef,
  ClassDef,
  Module as IRModule,
  Import,
  Param,
  Decorator,
  BinaryOperator,
  UnaryOperator,
} from "../ir/nodes.js";
import type { ModuleExports, ExportedFunction } from "./project.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function locationString(node: ts.Node): string {
  const sf = node.getSourceFile();
  if (!sf) return "<unknown>";
  const { line, character } = sf.getLineAndCharacterOfPosition(
    node.getStart(),
  );
  return `${sf.fileName}:${line + 1}:${character + 1}`;
}

function unsupported(node: ts.Node, what: string): never {
  throw new Error(
    `Unsupported ${what}: ${ts.SyntaxKind[node.kind]} at ${locationString(node)}`,
  );
}

const TY_VOID: JvmType = { kind: "TyVoid" };
const TY_BOOLEAN: JvmType = { kind: "TyBoolean" };
const TY_INT: JvmType = { kind: "TyInt" };
const TY_DOUBLE: JvmType = { kind: "TyDouble" };
const TY_STRING: JvmType = { kind: "TyString" };
const TY_OBJECT_DEFAULT: JvmType = {
  kind: "TyObject",
  className: "java/lang/Object",
};

// ---------------------------------------------------------------------------
// Binary / unary operator mapping
// ---------------------------------------------------------------------------

function mapBinaryOp(token: ts.SyntaxKind): BinaryOperator | undefined {
  switch (token) {
    case ts.SyntaxKind.PlusToken:
      return "+";
    case ts.SyntaxKind.MinusToken:
      return "-";
    case ts.SyntaxKind.AsteriskToken:
      return "*";
    case ts.SyntaxKind.SlashToken:
      return "/";
    case ts.SyntaxKind.PercentToken:
      return "%";
    case ts.SyntaxKind.EqualsEqualsToken:
    case ts.SyntaxKind.EqualsEqualsEqualsToken:
      return "==";
    case ts.SyntaxKind.ExclamationEqualsToken:
    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
      return "!=";
    case ts.SyntaxKind.LessThanToken:
      return "<";
    case ts.SyntaxKind.GreaterThanToken:
      return ">";
    case ts.SyntaxKind.LessThanEqualsToken:
      return "<=";
    case ts.SyntaxKind.GreaterThanEqualsToken:
      return ">=";
    case ts.SyntaxKind.AmpersandAmpersandToken:
      return "&&";
    case ts.SyntaxKind.BarBarToken:
      return "||";
    default:
      return undefined;
  }
}

function mapUnaryOp(token: ts.SyntaxKind): UnaryOperator | undefined {
  switch (token) {
    case ts.SyntaxKind.MinusToken:
      return "-";
    case ts.SyntaxKind.ExclamationToken:
      return "!";
    case ts.SyntaxKind.TildeToken:
      return "~";
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Lowerer
// ---------------------------------------------------------------------------

export class Lowerer {
  private checker: ts.TypeChecker;
  private moduleName: string;

  /** Java interop: alias -> JVM internal class name (slash-separated) */
  private javaImports: Map<string, string> = new Map();
  /** Reverse lookup set of all imported Java class names for fast membership checks. */
  private javaImportedClassNames: Set<string> = new Set();
  /** Track variable name -> JVM class name for instance method dispatch. */
  private variableTypes: Map<string, string> = new Map();
  /** Track variable name -> IR JvmType overrides (e.g., for spawn results). */
  private irVariableTypes: Map<string, JvmType> = new Map();
  /** Collected IR Import records. */
  private imports: Import[] = [];

  /**
   * Cross-module imports: maps local import name -> { className, function info }
   * Populated when the lowerer sees `import { foo } from "./other"` and the
   * caller has provided the ModuleExports for that dependency.
   */
  private tsModuleImports: Map<string, { className: string; fn: ExportedFunction }> = new Map();

  /** Module exports provided by the project compiler for cross-module resolution. */
  private importedModules: Map<string, ModuleExports>;

  constructor(
    checker: ts.TypeChecker,
    moduleName: string,
    importedModules?: Map<string, ModuleExports>,
  ) {
    this.checker = checker;
    this.moduleName = moduleName;
    this.importedModules = importedModules ?? new Map();
  }

  // -----------------------------------------------------------------------
  // Public entry point
  // -----------------------------------------------------------------------

  lowerSourceFile(sf: ts.SourceFile): IRModule {
    const functions: FunctionDef[] = [];
    const classes: ClassDef[] = [];
    const topLevelStmts: IRStmt[] = [];

    for (const stmt of sf.statements) {
      if (ts.isImportDeclaration(stmt)) {
        this.lowerImportDeclaration(stmt);
      } else if (ts.isFunctionDeclaration(stmt)) {
        // Skip ambient/declare function declarations (no body)
        if (hasModifier(stmt, ts.SyntaxKind.DeclareKeyword) || !stmt.body) {
          continue;
        }
        functions.push(this.lowerFunctionDeclaration(stmt));
      } else if (ts.isClassDeclaration(stmt)) {
        classes.push(this.lowerClassDeclaration(stmt));
      } else {
        topLevelStmts.push(this.lowerStatement(stmt));
      }
    }

    // Wrap top-level non-declaration statements into a synthetic main().
    if (topLevelStmts.length > 0) {
      const mainFn: FunctionDef = {
        kind: "FunctionDef",
        name: "main",
        params: [{ name: "args", type: { kind: "TyArray", elementType: TY_STRING } }],
        returnType: TY_VOID,
        body: { kind: "Block", stmts: topLevelStmts },
        isExported: true,
        isTask: false,
      };
      functions.push(mainFn);
    }

    return {
      kind: "Module",
      name: this.moduleName,
      classes,
      functions,
      imports: this.imports,
    };
  }

  // -----------------------------------------------------------------------
  // Import declarations (Java interop)
  // -----------------------------------------------------------------------

  /**
   * Handle import declarations with special module specifiers:
   *   import { Foo } from "java:com.example.Foo";
   *   import { Foo, Bar } from "java:com.example";
   *
   * The "java:" prefix signals a Java class import. The module specifier
   * after the prefix is the fully qualified Java class name (dot-separated).
   * We convert it to JVM internal form (slash-separated) and track the
   * alias -> className mapping for later use in call/new lowering.
   */
  private lowerImportDeclaration(node: ts.ImportDeclaration): void {
    const moduleSpecifier = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) return;

    const specText = moduleSpecifier.text;

    // Handle cross-module TS imports (relative specifiers like "./math-utils")
    if (specText.startsWith(".")) {
      this.lowerTsModuleImport(node, specText);
      return;
    }

    // Handle "tyvm" runtime imports — register all tyvm built-in types
    // Request/Response/HttpServer are always available when tyvm is imported
    if (specText === "tyvm") {
      // Register HTTP server types
      this.javaImports.set("Request", "tyvm/runtime/HttpServer$Request");
      this.javaImportedClassNames.add("tyvm/runtime/HttpServer$Request");
      this.javaImports.set("Response", "tyvm/runtime/HttpServer$Response");
      this.javaImportedClassNames.add("tyvm/runtime/HttpServer$Response");
      // Register durable task types
      this.javaImports.set("DurableTask", "tyvm/runtime/DurableTask");
      this.javaImportedClassNames.add("tyvm/runtime/DurableTask");
      this.javaImports.set("TaskResult", "tyvm/runtime/DurableTask$TaskResult");
      this.javaImportedClassNames.add("tyvm/runtime/DurableTask$TaskResult");
      this.javaImports.set("Workflow", "tyvm/runtime/DurableTask$Workflow");
      this.javaImportedClassNames.add("tyvm/runtime/DurableTask$Workflow");
      return;
    }

    // Only handle "java:..." imports below
    if (!specText.startsWith("java:")) return;

    const javaPackage = specText.slice("java:".length);
    // Convert dots to slashes for JVM internal name
    const jvmName = javaPackage.replace(/\./g, "/");

    const importClause = node.importClause;
    if (!importClause) return;

    // Named imports: import { Foo, Bar } from "java:..."
    if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
      for (const el of importClause.namedBindings.elements) {
        const alias = el.name.text;
        // If the specifier looks like a full class name (e.g., java:java.util.ArrayList),
        // each imported name uses the same class. If it's a package, append the name.
        // Heuristic: if the last segment is uppercase, it's a class name.
        const parts = javaPackage.split(".");
        const lastPart = parts[parts.length - 1];
        let fullClassName: string;
        if (lastPart && lastPart[0] === lastPart[0].toUpperCase() && lastPart[0] !== lastPart[0].toLowerCase()) {
          // Specifier ends with a class name (e.g., java:java.util.ArrayList)
          fullClassName = jvmName;
        } else {
          // Specifier is a package, append the imported name
          fullClassName = jvmName + "/" + alias;
        }

        this.javaImports.set(alias, fullClassName);
        this.javaImportedClassNames.add(fullClassName);
        this.imports.push({ className: fullClassName, alias });
      }
    }

    // Default import: import Foo from "java:..."
    if (importClause.name) {
      const alias = importClause.name.text;
      this.javaImports.set(alias, jvmName);
      this.javaImportedClassNames.add(jvmName);
      this.imports.push({ className: jvmName, alias });
    }
  }

  /**
   * Handle a cross-module TypeScript import:
   *   import { add, multiply } from "./math-utils";
   *
   * Looks up the module's exports (provided by the project compiler) and
   * registers each imported name so that calls to `add(...)` emit
   * INVOKESTATIC MathUtils.add(...) in the bytecode.
   */
  private lowerTsModuleImport(
    node: ts.ImportDeclaration,
    specifier: string,
  ): void {
    const moduleExports = this.importedModules.get(specifier);
    if (!moduleExports) {
      // No cross-module info available — this import will be resolved
      // purely through the TS type checker (e.g., when compiling a single file).
      return;
    }

    const importClause = node.importClause;
    if (!importClause) return;

    const exportsByName = new Map<string, ExportedFunction>();
    for (const fn of moduleExports.functions) {
      exportsByName.set(fn.name, fn);
    }

    // Named imports: import { foo, bar } from "./module"
    if (
      importClause.namedBindings &&
      ts.isNamedImports(importClause.namedBindings)
    ) {
      for (const el of importClause.namedBindings.elements) {
        const localName = el.name.text;
        const originalName = el.propertyName?.text ?? localName;
        const exportedFn = exportsByName.get(originalName);
        if (exportedFn) {
          this.tsModuleImports.set(localName, {
            className: moduleExports.className,
            fn: exportedFn,
          });
          this.imports.push({
            className: moduleExports.className,
            alias: localName,
          });
        }
      }
    }

    // TODO: namespace imports (import * as utils from "./module") — future work
  }

  // -----------------------------------------------------------------------
  // Statements
  // -----------------------------------------------------------------------

  private lowerStatement(node: ts.Statement): IRStmt {
    if (ts.isExpressionStatement(node)) {
      return { kind: "ExprStmt", expr: this.lowerExpression(node.expression) };
    }

    if (ts.isVariableStatement(node)) {
      return this.lowerVariableStatement(node);
    }

    if (ts.isReturnStatement(node)) {
      return {
        kind: "Return",
        expr: node.expression
          ? this.lowerExpression(node.expression)
          : undefined,
      };
    }

    if (ts.isIfStatement(node)) {
      const thenBlock = this.stmtToBlock(node.thenStatement);
      const elseBlock = node.elseStatement
        ? this.stmtToBlock(node.elseStatement)
        : undefined;
      return {
        kind: "If",
        condition: this.lowerExpression(node.expression),
        thenBlock,
        elseBlock,
      };
    }

    if (ts.isWhileStatement(node)) {
      return {
        kind: "While",
        condition: this.lowerExpression(node.expression),
        body: this.stmtToBlock(node.statement),
      };
    }

    if (ts.isForStatement(node)) {
      return {
        kind: "For",
        init: node.initializer ? this.lowerForInitializer(node.initializer) : undefined,
        condition: node.condition
          ? this.lowerExpression(node.condition)
          : undefined,
        update: node.incrementor
          ? this.lowerExpression(node.incrementor)
          : undefined,
        body: this.stmtToBlock(node.statement),
      };
    }

    if (ts.isBlock(node)) {
      return this.lowerBlock(node);
    }

    unsupported(node, "statement");
  }

  private lowerVariableStatement(node: ts.VariableStatement): IRStmt {
    // If only one declaration, return a VarDecl directly; otherwise wrap in Block.
    const decls = node.declarationList.declarations;
    if (decls.length === 1) {
      return this.lowerVariableDeclaration(decls[0]);
    }
    return {
      kind: "Block",
      stmts: decls.map((d) => this.lowerVariableDeclaration(d)),
    };
  }

  private lowerVariableDeclaration(node: ts.VariableDeclaration): IRStmt {
    const name = node.name.getText();
    const init = node.initializer
      ? this.lowerExpression(node.initializer)
      : undefined;
    let type = this.resolveType(node);

    // Track variable types for Java interop instance method dispatch.
    // If the initializer creates a NewObject of a Java-imported class,
    // record the mapping so instance method calls resolve correctly.
    if (init) {
      if (init.kind === "NewObject") {
        this.variableTypes.set(name, init.className);
        type = { kind: "TyObject", className: init.className };
      } else if (init.kind === "Call" && init.isStatic) {
        // Static factory method — check if class is a known Java import
        const javaClass = this.javaImports.get(init.className) ?? init.className;
        if (this.isJavaImportedClass(javaClass)) {
          this.variableTypes.set(name, javaClass);
        }
      }
    }

    // Also check if the type annotation references a Java-imported class or Channel
    if (node.type && ts.isTypeReferenceNode(node.type)) {
      const typeName = node.type.typeName.getText();
      if (typeName === "Channel") {
        // Channel<T> type annotation
        let elementType: JvmType = TY_DOUBLE;
        if (node.type.typeArguments && node.type.typeArguments.length > 0) {
          elementType = this.resolveTypeNode(node.type.typeArguments[0]);
        }
        type = { kind: "TyChannel", elementType };
        this.irVariableTypes.set(name, type);
        this.variableTypes.set(name, "tyvm/runtime/Channel");
      } else {
        const javaClass = this.javaImports.get(typeName);
        if (javaClass) {
          this.variableTypes.set(name, javaClass);
          type = { kind: "TyObject", className: javaClass };
        }
      }
    }

    // If initializer is a Spawn, override the variable type to TyTask
    if (init && init.kind === "Spawn") {
      type = { kind: "TyTask", resultType: init.call.returnType };
      this.irVariableTypes.set(name, type);
    }

    // If initializer produces a Channel (e.g., channel() call), track as TyChannel
    if (init) {
      const initType = this.exprType(init);
      if (initType.kind === "TyChannel") {
        type = initType;
        this.irVariableTypes.set(name, type);
        this.variableTypes.set(name, "tyvm/runtime/Channel");
      }
    }

    // If type is still the default Object and we have an init, use the init's type
    if (init && type.kind === "TyObject" && type.className === "java/lang/Object") {
      const initType = this.exprType(init);
      if (initType.kind !== "TyVoid") {
        type = initType;
      }
    }

    // Track the resolved type so LoadLocal picks it up
    this.irVariableTypes.set(name, type);

    return { kind: "VarDecl", name, type, init };
  }

  /** Check if a class name is from a Java import. */
  private isJavaImportedClass(className: string): boolean {
    return this.javaImportedClassNames.has(className);
  }

  private lowerForInitializer(
    init: ts.ForInitializer,
  ): IRStmt {
    if (ts.isVariableDeclarationList(init)) {
      const decls = init.declarations;
      if (decls.length === 1) {
        return this.lowerVariableDeclaration(decls[0]);
      }
      return {
        kind: "Block",
        stmts: decls.map((d) => this.lowerVariableDeclaration(d)),
      };
    }
    // Expression initializer
    return { kind: "ExprStmt", expr: this.lowerExpression(init) };
  }

  private lowerBlock(node: ts.Block): Block {
    return {
      kind: "Block",
      stmts: node.statements.map((s) => this.lowerStatement(s)),
    };
  }

  /** Ensure a statement is a Block (wrap single statements). */
  private stmtToBlock(node: ts.Statement): Block {
    if (ts.isBlock(node)) {
      return this.lowerBlock(node);
    }
    return { kind: "Block", stmts: [this.lowerStatement(node)] };
  }

  // -----------------------------------------------------------------------
  // Expressions
  // -----------------------------------------------------------------------

  private lowerExpression(node: ts.Expression): IRExpr {
    // ---- Await expression ----
    if (ts.isAwaitExpression(node)) {
      const inner = this.lowerExpression(node.expression);
      // Determine the result type from the Task's resultType
      let resultType: JvmType = TY_OBJECT_DEFAULT;
      const innerType = this.exprType(inner);
      if (innerType.kind === "TyTask") {
        resultType = innerType.resultType;
      }
      return { kind: "Await", expr: inner, type: resultType };
    }

    // ---- Literals ----
    if (ts.isNumericLiteral(node)) {
      const value = Number(node.text);
      return { kind: "Const", value, type: TY_DOUBLE };
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return { kind: "Const", value: node.text, type: TY_STRING };
    }

    if (node.kind === ts.SyntaxKind.TrueKeyword) {
      return { kind: "Const", value: true, type: TY_BOOLEAN };
    }
    if (node.kind === ts.SyntaxKind.FalseKeyword) {
      return { kind: "Const", value: false, type: TY_BOOLEAN };
    }
    if (node.kind === ts.SyntaxKind.NullKeyword) {
      return { kind: "Const", value: null, type: TY_OBJECT_DEFAULT };
    }

    // ---- Template literal with substitutions ----
    if (ts.isTemplateExpression(node)) {
      return this.lowerTemplateLiteral(node);
    }

    // ---- Identifier ----
    if (ts.isIdentifier(node)) {
      // Check for IR-level type override (e.g., spawn results)
      const irType = this.irVariableTypes.get(node.text);
      const type = irType ?? this.resolveType(node);
      return { kind: "LoadLocal", name: node.text, type };
    }

    // ---- Parenthesised expression ----
    if (ts.isParenthesizedExpression(node)) {
      return this.lowerExpression(node.expression);
    }

    // ---- Binary expression ----
    if (ts.isBinaryExpression(node)) {
      // Handle assignment as StoreLocal
      if (
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        if (ts.isIdentifier(node.left)) {
          const value = this.lowerExpression(node.right);
          const type = this.resolveType(node.left);
          return { kind: "StoreLocal", name: node.left.text, value, type };
        }
        unsupported(node, "assignment target");
      }

      const op = mapBinaryOp(node.operatorToken.kind);
      if (op === undefined) {
        unsupported(node, "binary operator");
      }
      const left = this.lowerExpression(node.left);
      const right = this.lowerExpression(node.right);
      const type = this.inferBinaryType(op, left, right);
      return { kind: "BinaryOp", op, left, right, type };
    }

    // ---- Prefix unary expression ----
    if (ts.isPrefixUnaryExpression(node)) {
      const op = mapUnaryOp(node.operator);
      if (op === undefined) {
        unsupported(node, "unary operator");
      }
      const operand = this.lowerExpression(node.operand);
      const type =
        op === "!" ? TY_BOOLEAN : this.exprType(operand);
      return { kind: "UnaryOp", op, operand, type };
    }

    // ---- Postfix unary (i++, i--) -> lower as binary + store ----
    if (ts.isPostfixUnaryExpression(node)) {
      // For now treat i++ as i = i + 1 (returns old value, but close enough for PoC)
      if (ts.isIdentifier(node.operand)) {
        const name = node.operand.text;
        const type = this.resolveType(node.operand);
        const load: IRExpr = { kind: "LoadLocal", name, type };
        const one: IRExpr = { kind: "Const", value: 1, type: TY_DOUBLE };
        const op: BinaryOperator =
          node.operator === ts.SyntaxKind.PlusPlusToken ? "+" : "-";
        const add: IRExpr = { kind: "BinaryOp", op, left: load, right: one, type };
        return { kind: "StoreLocal", name, value: add, type };
      }
      unsupported(node, "postfix unary operand");
    }

    // ---- Call expression ----
    if (ts.isCallExpression(node)) {
      return this.lowerCallExpression(node);
    }

    // ---- Property access ----
    if (ts.isPropertyAccessExpression(node)) {
      // Check if this is a static field access on a Java-imported class
      // e.g., System.out, Math.PI, Integer.MAX_VALUE
      if (ts.isIdentifier(node.expression)) {
        const objName = node.expression.text;
        const javaClass = this.javaImports.get(objName);
        if (javaClass) {
          const property = node.name.text;
          const type = this.resolveStaticFieldType(javaClass, property, node);
          return { kind: "StaticFieldGet", className: javaClass, fieldName: property, type };
        }
      }

      const object = this.lowerExpression(node.expression);
      const property = node.name.text;
      const type = this.resolveType(node);
      return { kind: "PropertyAccess", object, property, type };
    }

    // ---- Element access (array indexing) ----
    if (ts.isElementAccessExpression(node)) {
      const array = this.lowerExpression(node.expression);
      const index = this.lowerExpression(node.argumentExpression);
      const type = this.resolveType(node);
      return { kind: "ArrayGet", array, index, type };
    }

    // ---- New expression ----
    if (ts.isNewExpression(node)) {
      const tsClassName = node.expression.getText();
      // Check if this is a Java-imported class
      const javaClass = this.javaImports.get(tsClassName);
      const className = javaClass ?? tsClassName;
      const args = (node.arguments ?? []).map((a) => this.lowerExpression(a));
      return { kind: "NewObject", className, args };
    }

    // ---- Array literal ----
    if (ts.isArrayLiteralExpression(node)) {
      return this.lowerArrayLiteral(node);
    }

    unsupported(node, "expression");
  }

  // -----------------------------------------------------------------------
  // Call expression (with console.log special-casing)
  // -----------------------------------------------------------------------

  private lowerCallExpression(node: ts.CallExpression): IRExpr {
    // Special-case: spawn(fn(args)) or spawn(fn, arg1, arg2)
    if (ts.isIdentifier(node.expression) && node.expression.text === "spawn") {
      return this.lowerSpawnCall(node);
    }

    // Special-case: channel() -> Channel.make() static factory
    if (ts.isIdentifier(node.expression) && node.expression.text === "channel") {
      return this.lowerChannelCall(node);
    }

    // Special-case: serve(port, handler) -> Serve node
    if (ts.isIdentifier(node.expression) && node.expression.text === "serve") {
      return this.lowerServeCall(node);
    }

    // Special-case: checkpoint(key, value) -> DurableTask.checkpoint(key, value)
    if (ts.isIdentifier(node.expression) && node.expression.text === "checkpoint") {
      const args = node.arguments.map((a) => this.lowerExpression(a));
      return {
        kind: "Call",
        target: "checkpoint",
        className: "tyvm/runtime/DurableTask",
        args,
        returnType: { kind: "TyVoid" },
        isStatic: true,
      };
    }

    // Special-case: recover(key) -> DurableTask.recover(key)
    if (ts.isIdentifier(node.expression) && node.expression.text === "recover") {
      const args = node.arguments.map((a) => this.lowerExpression(a));
      return {
        kind: "Call",
        target: "recover",
        className: "tyvm/runtime/DurableTask",
        args,
        returnType: { kind: "TyString" },
        isStatic: true,
      };
    }

    // Special-case: usePostgres(url, user, pass) -> DurableTask.usePostgres(...)
    if (ts.isIdentifier(node.expression) && node.expression.text === "usePostgres") {
      const args = node.arguments.map((a) => this.lowerExpression(a));
      return {
        kind: "Call",
        target: "usePostgres",
        className: "tyvm/runtime/DurableTask",
        args,
        returnType: { kind: "TyVoid" },
        isStatic: true,
      };
    }

    // Special-case: useRedis(host, port) -> DurableTask.useRedis(String, int)
    if (ts.isIdentifier(node.expression) && node.expression.text === "useRedis") {
      const args = node.arguments.map((a) => this.lowerExpression(a));
      // Port arg (index 1) must be int, not double
      if (args.length >= 2 && this.exprType(args[1]).kind === "TyDouble") {
        args[1] = { kind: "Cast", expr: args[1], fromType: { kind: "TyDouble" }, toType: { kind: "TyInt" } };
      }
      return {
        kind: "Call",
        target: "useRedis",
        className: "tyvm/runtime/DurableTask",
        args,
        returnType: { kind: "TyVoid" },
        isStatic: true,
      };
    }

    // Special-case: task.await() -> Await node
    // Special-case: ch.send(val) -> ChannelSend node
    // Special-case: ch.recv() -> ChannelRecv node
    if (ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (method === "await") {
        const taskExpr = this.lowerExpression(node.expression.expression);
        let resultType: JvmType = TY_OBJECT_DEFAULT;
        const taskType = this.exprType(taskExpr);
        if (taskType.kind === "TyTask") {
          resultType = taskType.resultType;
        }
        return { kind: "Await", expr: taskExpr, type: resultType };
      }

      // Channel operations: ch.send(val), ch.recv(), ch.close(), ch.recvOrDefault(val)
      if (ts.isIdentifier(node.expression.expression)) {
        const objName = node.expression.expression.text;
        const irType = this.irVariableTypes.get(objName);
        if (irType && irType.kind === "TyChannel") {
          if (method === "send") {
            const channelExpr = this.lowerExpression(node.expression.expression);
            const valueExpr = this.lowerExpression(node.arguments[0]);
            return { kind: "ChannelSend", channel: channelExpr, value: valueExpr };
          }
          if (method === "recv") {
            const channelExpr = this.lowerExpression(node.expression.expression);
            return { kind: "ChannelRecv", channel: channelExpr, type: irType.elementType };
          }
          if (method === "recvOrDefault") {
            // recvOrDefault(defaultVal) -> instance method call on Channel
            const channelExpr = this.lowerExpression(node.expression.expression);
            const args = node.arguments.map((a) => this.lowerExpression(a));
            return {
              kind: "Call",
              target: "recvOrDefault",
              className: "tyvm/runtime/Channel",
              args: [channelExpr, ...args],
              returnType: irType.elementType,
              isStatic: false,
              explicitDescriptor: "(Ljava/lang/Object;)Ljava/lang/Object;",
            };
          }
          if (method === "close" || method === "isClosed") {
            const channelExpr = this.lowerExpression(node.expression.expression);
            const returnType: JvmType = method === "close" ? TY_VOID : { kind: "TyBoolean" };
            const desc = method === "close" ? "()V" : "()Z";
            return {
              kind: "Call",
              target: method,
              className: "tyvm/runtime/Channel",
              args: [channelExpr],
              returnType,
              isStatic: false,
              explicitDescriptor: desc,
            };
          }
        }
      }
    }

    const args = node.arguments.map((a) => this.lowerExpression(a));

    // Special-case: console.log(...)
    if (ts.isPropertyAccessExpression(node.expression)) {
      const obj = node.expression.expression;
      const method = node.expression.name.text;
      if (ts.isIdentifier(obj) && obj.text === "console" && method === "log") {
        return {
          kind: "Call",
          target: "println",
          className: "tyvm/runtime/Rt",
          args,
          returnType: TY_VOID,
          isStatic: true,
        };
      }

      // Java interop: static method call on imported class
      // e.g., Math.sqrt(2), System.currentTimeMillis()
      if (ts.isIdentifier(obj)) {
        const javaClass = this.javaImports.get(obj.text);
        if (javaClass) {
          const returnType = this.resolveCallReturnType(node, javaClass, method);
          return {
            kind: "Call",
            target: method,
            className: javaClass,
            args,
            returnType,
            isStatic: true,
          };
        }
      }

      // Java interop: instance method call on a variable whose type is a Java class
      // e.g., list.add(item), list.size()
      const object = this.lowerExpression(obj);

      // Determine class name: check if the object's type is a known Java class
      let callClassName = this.classNameFromExpr(object);
      if (ts.isIdentifier(obj)) {
        const varClass = this.variableTypes.get(obj.text);
        if (varClass) {
          callClassName = varClass;
        }
      }

      // Resolve return type: use well-known method table for Java classes, fallback to TS checker
      const isJavaClass = this.isJavaImportedClass(callClassName);
      const returnType = isJavaClass
        ? this.resolveInstanceMethodReturnType(callClassName, method, node)
        : this.resolveType(node);

      // For Java interop, compute explicit descriptor for methods with Object parameters
      const explicitDescriptor = isJavaClass
        ? this.resolveJavaMethodDescriptor(callClassName, method, args)
        : undefined;

      return {
        kind: "Call",
        target: method,
        className: callClassName,
        args: [object, ...args],
        returnType,
        explicitDescriptor,
        isStatic: false,
      };
    }

    // Simple function call
    if (ts.isIdentifier(node.expression)) {
      const target = node.expression.text;

      // Check if this function was imported from another TS module
      const crossModuleFn = this.tsModuleImports.get(target);
      if (crossModuleFn) {
        return {
          kind: "Call",
          target: crossModuleFn.fn.name,
          className: crossModuleFn.className,
          args,
          returnType: crossModuleFn.fn.returnType,
          isStatic: true,
        };
      }

      const returnType = this.resolveType(node);
      return {
        kind: "Call",
        target,
        className: this.moduleName,
        args,
        returnType,
        isStatic: true,
      };
    }

    unsupported(node, "call expression");
  }

  /**
   * Lower a spawn(...) call. The argument is expected to be a function call
   * expression, e.g. spawn(computeResult(10000000)).
   * This wraps the call in a Spawn IR node.
   */
  private lowerSpawnCall(node: ts.CallExpression): IRExpr {
    if (node.arguments.length < 1) {
      unsupported(node, "spawn() requires at least one argument");
    }

    const firstArg = node.arguments[0];

    // spawn(fn(a, b, c)) - first arg is a call expression
    if (ts.isCallExpression(firstArg)) {
      const call = this.lowerCallExpression(firstArg);
      if (call.kind !== "Call") {
        unsupported(node, "spawn argument must be a direct function call");
      }
      return { kind: "Spawn", call: call as import("../ir/nodes.js").Call };
    }

    unsupported(node, "spawn argument must be a function call");
  }

  /**
   * Lower a channel() call. Creates a Channel via the static factory
   * method Channel.make().
   */
  private lowerChannelCall(node: ts.CallExpression): IRExpr {
    // Determine element type from the type argument Channel<T>
    let elementType: JvmType = TY_DOUBLE; // default to number/double
    if (node.typeArguments && node.typeArguments.length > 0) {
      elementType = this.resolveTypeNode(node.typeArguments[0]);
    }

    if (node.arguments.length > 0) {
      // Buffered channel: channel(capacity) -> Channel.make(int)
      const capacityArg = this.lowerExpression(node.arguments[0]);
      return {
        kind: "Call",
        target: "make",
        className: "tyvm/runtime/Channel",
        args: [capacityArg],
        returnType: { kind: "TyChannel", elementType },
        isStatic: true,
      };
    }

    // Unbuffered channel: channel() -> Channel.make()
    return {
      kind: "Call",
      target: "make",
      className: "tyvm/runtime/Channel",
      args: [],
      returnType: { kind: "TyChannel", elementType },
      isStatic: true,
    };
  }

  /**
   * Lower a serve(port, handler) call.
   * The handler must be a named function reference.
   * serve(8080, handleRequest) -> HttpServer.serve(port, handler)
   */
  private lowerServeCall(node: ts.CallExpression): IRExpr {
    if (node.arguments.length < 1) {
      unsupported(node, "serve() requires at least a port argument");
    }

    const portExpr = this.lowerExpression(node.arguments[0]);

    // serve(port, handler) or serve(port) — if no handler, use __handler__ (from decorator pass)
    let handlerName: string;
    if (node.arguments.length >= 2) {
      const handlerArg = node.arguments[1];
      if (ts.isIdentifier(handlerArg)) {
        handlerName = handlerArg.text;
      } else {
        unsupported(handlerArg, "serve() handler must be a named function reference");
      }
    } else {
      handlerName = "__handler__";
    }

    return {
      kind: "Serve",
      port: portExpr,
      handlerName,
    };
  }

  private classNameFromExpr(expr: IRExpr): string {
    if (expr.kind === "LoadLocal") {
      // Check if this variable is tracked as a Java class instance
      const javaClass = this.variableTypes.get(expr.name);
      if (javaClass) return javaClass;
      return expr.name;
    }
    if (expr.kind === "NewObject") {
      return expr.className;
    }
    if (expr.kind === "PropertyAccess") {
      return expr.property;
    }
    return "java/lang/Object";
  }

  /**
   * Resolve the return type for a Java static method call.
   * Uses a well-known method table, falling back to the TypeScript type checker.
   */
  private resolveCallReturnType(node: ts.CallExpression, javaClass: string, method: string): JvmType {
    return resolveStaticMethodType(javaClass, method) ?? this.resolveType(node);
  }

  /**
   * Resolve the return type for a Java instance method call.
   * Uses the well-known method table first, then the classfile reader for the
   * specific class, falling back to the TypeScript type checker.
   */
  private resolveInstanceMethodReturnType(javaClass: string, method: string, node: ts.Node): JvmType {
    return resolveInstanceMethodTypeForClass(javaClass, method) ?? this.resolveType(node);
  }

  /**
   * Resolve the JVM method descriptor for Java interop instance method calls.
   * Handles type erasure for generic collection classes.
   */
  private resolveJavaMethodDescriptor(javaClass: string, method: string, args: IRExpr[]): string | undefined {
    const firstArgIsInt = args.length > 0 && this.exprType(args[0]).kind === "TyInt";
    return resolveInstanceMethodDescriptor(javaClass, method, args.length, firstArgIsInt);
  }

  /**
   * Resolve the type of a static field on a Java class.
   * Uses a well-known field table, falling back to the TypeScript type checker.
   */
  private resolveStaticFieldType(javaClass: string, fieldName: string, node: ts.Node): JvmType {
    return resolveStaticFieldTypeFromTable(javaClass, fieldName) ?? this.resolveType(node);
  }

  // -----------------------------------------------------------------------
  // Template literals
  // -----------------------------------------------------------------------

  private lowerTemplateLiteral(node: ts.TemplateExpression): IRExpr {
    const parts: IRExpr[] = [];
    // Head text
    if (node.head.text.length > 0) {
      parts.push({ kind: "Const", value: node.head.text, type: TY_STRING });
    }
    for (const span of node.templateSpans) {
      parts.push(this.lowerExpression(span.expression));
      if (span.literal.text.length > 0) {
        parts.push({
          kind: "Const",
          value: span.literal.text,
          type: TY_STRING,
        });
      }
    }
    return { kind: "StringConcat", parts };
  }

  // -----------------------------------------------------------------------
  // Array literals
  // -----------------------------------------------------------------------

  private lowerArrayLiteral(node: ts.ArrayLiteralExpression): IRExpr {
    // Determine element type from first element or default to Object
    const elements = node.elements.map((e) => this.lowerExpression(e));
    const elementType: JvmType =
      elements.length > 0 ? this.exprType(elements[0]) : TY_OBJECT_DEFAULT;
    const size: IRExpr = {
      kind: "Const",
      value: elements.length,
      type: TY_INT,
    };
    // For simplicity, emit Call to a runtime helper that builds the array.
    // In a full compiler we would emit ArrayNew + ArraySet sequence.
    return {
      kind: "Call",
      target: "arrayOf",
      className: "tyvm/runtime/Rt",
      args: elements,
      returnType: { kind: "TyArray", elementType },
      isStatic: true,
    };
  }

  // -----------------------------------------------------------------------
  // Decorator extraction
  // -----------------------------------------------------------------------

  private extractDecorators(node: ts.Node): Decorator[] {
    // TS 5.x API: ts.getDecorators; fall back to legacy node.decorators
    const decoratorNodes: readonly ts.Decorator[] =
      (ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined) ??
      (node as any).decorators ??
      [];

    const result: Decorator[] = [];
    for (const dec of decoratorNodes) {
      if (ts.isCallExpression(dec.expression)) {
        // @Name(args) form
        const name = dec.expression.expression.getText();
        const args = dec.expression.arguments.map((a) => this.lowerExpression(a));
        result.push({ name, arguments: args });
      } else {
        // @Name form (no arguments)
        const name = dec.expression.getText();
        result.push({ name, arguments: [] });
      }
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Function declarations
  // -----------------------------------------------------------------------

  private lowerFunctionDeclaration(node: ts.FunctionDeclaration): FunctionDef {
    const name = node.name?.text ?? "<anonymous>";
    const params: Param[] = (node.parameters ?? []).map((p) => {
      const paramName = p.name.getText();
      let type = this.resolveType(p);

      // Check if the type annotation references known tyvm/Java types
      if (p.type && ts.isTypeReferenceNode(p.type)) {
        const typeName = p.type.typeName.getText();
        if (typeName === "Channel") {
          let elementType: JvmType = TY_DOUBLE;
          if (p.type.typeArguments && p.type.typeArguments.length > 0) {
            elementType = this.resolveTypeNode(p.type.typeArguments[0]);
          }
          type = { kind: "TyChannel", elementType };
        }
        // Map tyvm HTTP types to their JVM classes
        const javaClass = this.javaImports.get(typeName);
        if (javaClass) {
          type = { kind: "TyObject", className: javaClass };
        }
      }

      return { name: paramName, type };
    });

    // Track ALL parameter types so LoadLocal picks up correct types
    // (irVariableTypes is not scoped per function, so we must overwrite stale entries)
    for (const param of params) {
      this.irVariableTypes.set(param.name, param.type);
      if (param.type.kind === "TyChannel") {
        this.variableTypes.set(param.name, "tyvm/runtime/Channel");
      } else if (param.type.kind === "TyObject" && param.type.className.includes("/")) {
        this.variableTypes.set(param.name, param.type.className);
      }
    }

    const returnType = this.resolveFunctionReturnType(node);
    const body: Block = node.body
      ? this.lowerBlock(node.body)
      : { kind: "Block", stmts: [] };

    const isExported = hasModifier(node, ts.SyntaxKind.ExportKeyword);
    const isTask = this.detectTask(node, name);
    const decorators = this.extractDecorators(node);

    return {
      kind: "FunctionDef",
      name,
      params,
      returnType,
      body,
      isExported,
      isTask,
      ...(decorators.length > 0 ? { decorators } : {}),
    };
  }

  /**
   * Detect whether a function should be treated as a task:
   * - Name starts with "task" (case-insensitive)
   * - Has a leading `// @task` comment
   */
  private detectTask(node: ts.FunctionDeclaration, name: string): boolean {
    if (name.toLowerCase().startsWith("task")) {
      return true;
    }
    const sf = node.getSourceFile();
    const fullText = sf.getFullText();
    const commentRanges = ts.getLeadingCommentRanges(
      fullText,
      node.getFullStart(),
    );
    if (commentRanges) {
      for (const range of commentRanges) {
        const comment = fullText.slice(range.pos, range.end);
        if (comment.includes("@task")) {
          return true;
        }
      }
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Class declarations
  // -----------------------------------------------------------------------

  private lowerClassDeclaration(node: ts.ClassDeclaration): ClassDef {
    const name = node.name?.text ?? "<anonymous>";
    const fields: { name: string; type: JvmType; decorators?: Decorator[] }[] = [];
    const methods: FunctionDef[] = [];

    for (const member of node.members) {
      if (ts.isPropertyDeclaration(member)) {
        const fieldName = member.name.getText();
        const type = this.resolveType(member);
        const fieldDecorators = this.extractDecorators(member);
        fields.push({
          name: fieldName,
          type,
          ...(fieldDecorators.length > 0 ? { decorators: fieldDecorators } : {}),
        });
      } else if (ts.isMethodDeclaration(member)) {
        const methodName = member.name.getText();
        const params: Param[] = member.parameters.map((p) => {
          const paramName = p.name.getText();
          let type = this.resolveType(p);
          // Resolve Java type imports for parameters (e.g., Request -> HttpServer$Request)
          if (p.type && ts.isTypeReferenceNode(p.type)) {
            const typeName = p.type.typeName.getText();
            const javaClass = this.javaImports.get(typeName);
            if (javaClass) {
              type = { kind: "TyObject", className: javaClass };
            }
          }
          return { name: paramName, type };
        });
        // Track ALL parameter types so LoadLocal picks up correct types
        for (const param of params) {
          this.irVariableTypes.set(param.name, param.type);
          if (param.type.kind === "TyObject" && param.type.className.includes("/")) {
            this.variableTypes.set(param.name, param.type.className);
          }
        }

        const returnType = member.type
          ? this.resolveTypeNode(member.type)
          : TY_VOID;
        const body: Block = member.body
          ? this.lowerBlock(member.body)
          : { kind: "Block", stmts: [] };
        const methodDecorators = this.extractDecorators(member);
        methods.push({
          kind: "FunctionDef",
          name: methodName,
          params,
          returnType,
          body,
          isExported: false,
          isTask: false,
          ...(methodDecorators.length > 0 ? { decorators: methodDecorators } : {}),
        });
      } else if (ts.isConstructorDeclaration(member)) {
        const params: Param[] = member.parameters.map((p) => ({
          name: p.name.getText(),
          type: this.resolveType(p),
        }));
        const body: Block = member.body
          ? this.lowerBlock(member.body)
          : { kind: "Block", stmts: [] };
        methods.push({
          kind: "FunctionDef",
          name: "<init>",
          params,
          returnType: TY_VOID,
          body,
          isExported: false,
          isTask: false,
        });
      }
    }

    const isExported = hasModifier(node, ts.SyntaxKind.ExportKeyword);
    const classDecorators = this.extractDecorators(node);
    return {
      kind: "ClassDef",
      name,
      fields,
      methods,
      isExported,
      ...(classDecorators.length > 0 ? { decorators: classDecorators } : {}),
    };
  }

  // -----------------------------------------------------------------------
  // Type resolution
  // -----------------------------------------------------------------------

  /** Resolve the JvmType of an arbitrary node using the type checker. */
  private resolveType(node: ts.Node): JvmType {
    try {
      const tsType = this.checker.getTypeAtLocation(node);
      return this.tsTypeToJvm(tsType);
    } catch {
      return TY_OBJECT_DEFAULT;
    }
  }

  /** Resolve the return type of a function declaration. */
  private resolveFunctionReturnType(node: ts.FunctionDeclaration): JvmType {
    if (node.type) {
      // Check for known tyvm/Java type references first
      if (ts.isTypeReferenceNode(node.type)) {
        const typeName = node.type.typeName.getText();
        const javaClass = this.javaImports.get(typeName);
        if (javaClass) {
          return { kind: "TyObject", className: javaClass };
        }
      }
      return this.resolveTypeNode(node.type);
    }
    try {
      const sig = this.checker.getSignatureFromDeclaration(node);
      if (sig) {
        const retType = this.checker.getReturnTypeOfSignature(sig);
        return this.tsTypeToJvm(retType);
      }
    } catch {
      // fall through
    }
    return TY_VOID;
  }

  /** Map an explicit TypeScript type-annotation node to JvmType. */
  private resolveTypeNode(typeNode: ts.TypeNode): JvmType {
    try {
      const tsType = this.checker.getTypeFromTypeNode(typeNode);
      return this.tsTypeToJvm(tsType);
    } catch {
      return TY_OBJECT_DEFAULT;
    }
  }

  /** Core mapping from TS type flags to JVM types. */
  tsTypeToJvm(tsType: ts.Type): JvmType {
    const flags = tsType.getFlags();

    if (flags & ts.TypeFlags.Void) return TY_VOID;
    if (flags & ts.TypeFlags.BooleanLike) return TY_BOOLEAN;
    if (flags & ts.TypeFlags.NumberLike) return TY_DOUBLE;
    if (flags & ts.TypeFlags.StringLike) return TY_STRING;
    if (flags & ts.TypeFlags.Null || flags & ts.TypeFlags.Undefined)
      return TY_VOID;

    // Check for Array type
    if (this.checker.isArrayType(tsType)) {
      const typeArgs = (tsType as ts.TypeReference).typeArguments;
      const elementType =
        typeArgs && typeArgs.length > 0
          ? this.tsTypeToJvm(typeArgs[0])
          : TY_OBJECT_DEFAULT;
      return { kind: "TyArray", elementType };
    }

    // Object / class type - try to extract a name
    const symbol = tsType.getSymbol();
    if (symbol) {
      const name = symbol.getName();
      if (name === "Promise") {
        const typeArgs = (tsType as ts.TypeReference).typeArguments;
        const resultType =
          typeArgs && typeArgs.length > 0
            ? this.tsTypeToJvm(typeArgs[0])
            : TY_VOID;
        return { kind: "TyTask", resultType };
      }
      if (name === "Channel") {
        const typeArgs = (tsType as ts.TypeReference).typeArguments;
        const elementType =
          typeArgs && typeArgs.length > 0
            ? this.tsTypeToJvm(typeArgs[0])
            : TY_DOUBLE;
        return { kind: "TyChannel", elementType };
      }
      if (name && name !== "__type" && name !== "default") {
        return { kind: "TyObject", className: name };
      }
    }

    return TY_OBJECT_DEFAULT;
  }

  // -----------------------------------------------------------------------
  // Inference helpers
  // -----------------------------------------------------------------------

  private inferBinaryType(
    op: BinaryOperator,
    left: IRExpr,
    right: IRExpr,
  ): JvmType {
    // Comparison / logical operators always produce boolean
    if (
      op === "==" ||
      op === "!=" ||
      op === "<" ||
      op === ">" ||
      op === "<=" ||
      op === ">=" ||
      op === "&&" ||
      op === "||"
    ) {
      return TY_BOOLEAN;
    }
    // String concatenation
    if (op === "+" && (this.isStringType(left) || this.isStringType(right))) {
      return TY_STRING;
    }
    // Arithmetic
    return TY_DOUBLE;
  }

  private isStringType(expr: IRExpr): boolean {
    const t = this.exprType(expr);
    return t.kind === "TyString";
  }

  private exprType(expr: IRExpr): JvmType {
    switch (expr.kind) {
      case "Const":
      case "LoadLocal":
      case "BinaryOp":
      case "UnaryOp":
      case "ArrayGet":
      case "ChannelRecv":
      case "Await":
      case "PropertyAccess":
      case "FieldGet":
      case "StoreLocal":
      case "StaticFieldGet":
        return expr.type;
      case "Cast":
        return expr.toType;
      case "Call":
        return expr.returnType;
      case "StringConcat":
        return TY_STRING;
      case "NewObject":
        return { kind: "TyObject", className: expr.className };
      case "ArrayNew":
        return { kind: "TyArray", elementType: expr.elementType };
      case "Spawn":
        return { kind: "TyTask", resultType: expr.call.returnType };
      case "Serve":
        return { kind: "TyObject", className: "tyvm/runtime/HttpServer" };
      case "FieldSet":
      case "ArraySet":
      case "ChannelSend":
        return TY_VOID;
    }
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined;
  return modifiers?.some((m) => m.kind === kind) ?? false;
}

// ---------------------------------------------------------------------------
// Convenience entry point
// ---------------------------------------------------------------------------

/**
 * Lower a ParseResult into the compiler's IR Module.
 *
 * When compiling in multi-file mode, pass `importedModules` to provide
 * cross-module export metadata. The map is keyed by the import specifier
 * (e.g., "./math-utils") and valued with the dependency's ModuleExports.
 */
export function lower(
  parseResult: ParseResult,
  importedModules?: Map<string, ModuleExports>,
): IRModule {
  const fileName = parseResult.sourceFile.fileName;
  const moduleName = fileName
    .replace(/\\/g, "/")
    .replace(/.*\//, "")
    .replace(/\.tsx?$/, "");
  const lowerer = new Lowerer(parseResult.checker, moduleName, importedModules);
  return lowerer.lowerSourceFile(parseResult.sourceFile);
}
