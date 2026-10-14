/**
 * Multi-file Project Compiler for tyvm
 *
 * Handles compiling multiple TypeScript files with cross-file imports:
 *   1. Discovers all files to compile (from entry point imports or directory scan)
 *   2. Builds a dependency graph from import declarations
 *   3. Topologically sorts files so dependencies compile first
 *   4. Compiles each file, threading exported symbol info to dependents
 */

import ts from "typescript";
import { resolve, dirname } from "node:path";
import { existsSync, statSync } from "node:fs";
import { parseFile } from "./parse.js";
import { lower } from "./lower.js";
import { resolveModuleSpecifier, collectTsFiles, fileToClassName } from "./resolver.js";
import type { Module as IRModule, FunctionDef, JvmType, Param } from "../ir/nodes.js";

// ---------------------------------------------------------------------------
// Exported symbol metadata — shared between modules during compilation
// ---------------------------------------------------------------------------

/** Describes an exported function from a compiled module. */
export interface ExportedFunction {
  name: string;
  params: Param[];
  returnType: JvmType;
}

/** Describes the exports of a single compiled module. */
export interface ModuleExports {
  /** The JVM class name for this module (PascalCase of filename). */
  className: string;
  /** Absolute file path of the source file. */
  filePath: string;
  /** Exported functions. */
  functions: ExportedFunction[];
}

/** A compiled module with its IR and export metadata. */
export interface CompiledModule {
  /** The IR module, ready for optimization and emission. */
  irModule: IRModule;
  /** Export metadata for dependents to consume. */
  exports: ModuleExports;
  /** Absolute source file path. */
  filePath: string;
  /** Whether this is a declaration-only file (no code generation). */
  isDeclaration: boolean;
}

// ---------------------------------------------------------------------------
// Dependency graph
// ---------------------------------------------------------------------------

interface DepNode {
  filePath: string;
  /** Specifier -> resolved absolute path for each TS-to-TS import. */
  imports: Map<string, string>;
}

/**
 * Extract TS-to-TS import dependencies from a source file.
 * Skips "java:..." imports and non-relative specifiers.
 */
function extractImports(filePath: string): DepNode {
  const imports = new Map<string, string>();
  const sourceText = ts.sys.readFile(filePath);
  if (!sourceText) return { filePath, imports };

  const sf = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ES2022, true);

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;

    const specifier = stmt.moduleSpecifier.text;

    // Skip java: imports — handled by the existing Java interop path
    if (specifier.startsWith("java:")) continue;
    // Skip "tyvm" runtime imports
    if (specifier === "tyvm") continue;
    // Only handle relative imports for now
    if (!specifier.startsWith(".")) continue;

    const resolved = resolveModuleSpecifier(specifier, filePath);
    if (resolved) {
      imports.set(specifier, resolved.filePath);
    }
  }

  return { filePath, imports };
}

/**
 * Starting from an entry file, discover all transitively imported files.
 * Returns the full set of files that need compilation.
 */
export function discoverDependencies(entryFile: string): Map<string, DepNode> {
  const graph = new Map<string, DepNode>();
  const queue: string[] = [resolve(entryFile)];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (graph.has(file)) continue;

    const node = extractImports(file);
    graph.set(file, node);

    for (const depPath of node.imports.values()) {
      if (!graph.has(depPath)) {
        queue.push(depPath);
      }
    }
  }

  return graph;
}

/**
 * Topological sort of files by their dependency order.
 * Files with no dependencies come first.
 * Throws on circular dependencies.
 */
export function topologicalSort(graph: Map<string, DepNode>): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>(); // cycle detection

  function visit(file: string): void {
    if (visited.has(file)) return;
    if (visiting.has(file)) {
      throw new Error(`Circular dependency detected involving: ${file}`);
    }

    visiting.add(file);

    const node = graph.get(file);
    if (node) {
      for (const depPath of node.imports.values()) {
        visit(depPath);
      }
    }

    visiting.delete(file);
    visited.add(file);
    sorted.push(file);
  }

  for (const file of graph.keys()) {
    visit(file);
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Multi-file compilation
// ---------------------------------------------------------------------------

/**
 * Compile a set of files in dependency order.
 *
 * For each file:
 *   1. Parse with the TS compiler API
 *   2. Lower to IR, injecting export metadata from already-compiled deps
 *   3. Collect the module's own exports for downstream files
 *
 * Returns compiled modules in dependency order (dependencies first).
 */
export function compileProject(files: string[]): CompiledModule[] {
  // Build the dependency graph from the provided files
  const allDeps = new Map<string, DepNode>();
  for (const file of files) {
    const deps = discoverDependencies(file);
    for (const [k, v] of deps) {
      allDeps.set(k, v);
    }
  }

  const ordered = topologicalSort(allDeps);

  // Map from absolute path -> ModuleExports, built up as we compile
  const exportsMap = new Map<string, ModuleExports>();
  const results: CompiledModule[] = [];

  for (const filePath of ordered) {
    const isDeclaration = filePath.endsWith(".d.ts");
    const className = fileToClassName(filePath);

    if (isDeclaration) {
      // For .d.ts files, we extract type info but don't generate code.
      // Parse to get type information.
      const parseResult = parseFile(filePath);
      const exports = extractExportsFromParse(parseResult, className, filePath);
      exportsMap.set(filePath, exports);
      results.push({
        irModule: {
          kind: "Module",
          name: className,
          classes: [],
          functions: [],
          imports: [],
        },
        exports,
        filePath,
        isDeclaration: true,
      });
      continue;
    }

    // Build the import context: for each import in this file,
    // look up the already-compiled module's exports.
    const depNode = allDeps.get(filePath);
    const importedModules = new Map<string, ModuleExports>();
    if (depNode) {
      for (const [specifier, depPath] of depNode.imports) {
        const depExports = exportsMap.get(depPath);
        if (depExports) {
          importedModules.set(specifier, depExports);
        }
      }
    }

    // Parse
    const parseResult = parseFile(filePath);

    // Lower with cross-module info
    const irModule = lower(parseResult, importedModules);

    // Extract exports for downstream dependents
    const exports = extractExportsFromIR(irModule, className, filePath);
    exportsMap.set(filePath, exports);

    results.push({
      irModule,
      exports,
      filePath,
      isDeclaration: false,
    });
  }

  return results;
}

/**
 * Compile starting from a single entry file, following all imports.
 */
export function compileFromEntry(entryFile: string): CompiledModule[] {
  return compileProject([resolve(entryFile)]);
}

/**
 * Compile all .ts files in a directory.
 */
export function compileDirectory(dir: string): CompiledModule[] {
  const files = collectTsFiles(dir);
  if (files.length === 0) {
    throw new Error(`No .ts files found in: ${dir}`);
  }
  return compileProject(files);
}

// ---------------------------------------------------------------------------
// Export extraction helpers
// ---------------------------------------------------------------------------

function extractExportsFromIR(
  irModule: IRModule,
  className: string,
  filePath: string,
): ModuleExports {
  const functions: ExportedFunction[] = [];
  for (const fn of irModule.functions) {
    if (fn.isExported && fn.name !== "main") {
      functions.push({
        name: fn.name,
        params: fn.params,
        returnType: fn.returnType,
      });
    }
  }
  return { className, filePath, functions };
}

function extractExportsFromParse(
  parseResult: { sourceFile: ts.SourceFile; checker: ts.TypeChecker },
  className: string,
  filePath: string,
): ModuleExports {
  const functions: ExportedFunction[] = [];
  const { sourceFile, checker } = parseResult;

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      const isExported =
        ts.canHaveModifiers(stmt)
          ? (ts.getModifiers(stmt)?.some(
              (m) => m.kind === ts.SyntaxKind.ExportKeyword,
            ) ?? false)
          : false;

      // In .d.ts files, all declarations at the top level with 'export' or
      // 'declare' are considered exported.
      const isDeclare =
        ts.canHaveModifiers(stmt)
          ? (ts.getModifiers(stmt)?.some(
              (m) => m.kind === ts.SyntaxKind.DeclareKeyword,
            ) ?? false)
          : false;

      if (isExported || isDeclare) {
        const sig = checker.getSignatureFromDeclaration(stmt);
        if (sig) {
          const params = stmt.parameters.map((p) => ({
            name: p.name.getText(),
            type: tsTypeToJvmType(checker, checker.getTypeAtLocation(p)),
          }));
          const returnType = tsTypeToJvmType(
            checker,
            checker.getReturnTypeOfSignature(sig),
          );
          functions.push({
            name: stmt.name.text,
            params,
            returnType,
          });
        }
      }
    }
  }

  return { className, filePath, functions };
}

/**
 * Simplified TS type -> JVM type mapping (mirrors Lowerer.tsTypeToJvm).
 * Used for extracting export signatures from declaration files.
 */
function tsTypeToJvmType(checker: ts.TypeChecker, tsType: ts.Type): JvmType {
  const flags = tsType.getFlags();

  if (flags & ts.TypeFlags.Void) return { kind: "TyVoid" };
  if (flags & ts.TypeFlags.BooleanLike) return { kind: "TyBoolean" };
  if (flags & ts.TypeFlags.NumberLike) return { kind: "TyDouble" };
  if (flags & ts.TypeFlags.StringLike) return { kind: "TyString" };
  if (flags & ts.TypeFlags.Null || flags & ts.TypeFlags.Undefined)
    return { kind: "TyVoid" };

  if (checker.isArrayType(tsType)) {
    const typeArgs = (tsType as ts.TypeReference).typeArguments;
    const elementType =
      typeArgs && typeArgs.length > 0
        ? tsTypeToJvmType(checker, typeArgs[0])
        : { kind: "TyObject" as const, className: "java/lang/Object" };
    return { kind: "TyArray", elementType };
  }

  return { kind: "TyObject", className: "java/lang/Object" };
}
