/**
 * StringBuilder Optimization Pass
 *
 * Detects string accumulation patterns in loops and rewrites them to use
 * java/lang/StringBuilder, avoiding O(n^2) string copying.
 *
 * Detected pattern:
 *   let s = "";            // VarDecl, TyString, init = Const("")
 *   while (...) {          // While or For loop
 *     s = s + expr;        // StoreLocal with BinaryOp(+, LoadLocal(s), ...)
 *     ...                  //   or StringConcat with first part LoadLocal(s)
 *   }
 *   // s is used after the loop as a string
 *
 * Rewritten to:
 *   let __sb_s = new StringBuilder();   // VarDecl, TyObject, init = NewObject
 *   while (...) {
 *     __sb_s.append(expr);              // ExprStmt(Call append)
 *     ...
 *   }
 *   let s = __sb_s.toString();          // VarDecl, TyString, init = Call toString
 *
 * The rewrite introduces a new variable __sb_<name> for the StringBuilder and
 * keeps the original variable name for the final String result so that all
 * subsequent references continue to work unchanged.
 */

import type {
  Module as IRModule,
  FunctionDef,
  Block,
  IRStmt,
  IRExpr,
  JvmType,
  VarDecl,
  ExprStmt,
  LoadLocal,
  Call,
} from "../nodes.js";

import { forEachExpr } from "../ir-walker.js";

const TY_STRING: JvmType = { kind: "TyString" };
const TY_SB: JvmType = { kind: "TyObject", className: "java/lang/StringBuilder" };

// ---------------------------------------------------------------------------
// Pattern detection
// ---------------------------------------------------------------------------

interface StringAccumInfo {
  varDeclIndex: number;
  varName: string;
  loopIndex: number;
  accumStmtIndices: number[];
}

function isEmptyStringDecl(stmt: IRStmt): stmt is VarDecl {
  return (
    stmt.kind === "VarDecl" &&
    stmt.type.kind === "TyString" &&
    stmt.init !== undefined &&
    stmt.init.kind === "Const" &&
    stmt.init.value === ""
  );
}

/**
 * Check if a statement is a string accumulation of the form:
 *   name = name + expr
 *   name = StringConcat([LoadLocal(name), ...])
 *
 * Returns the expression(s) being appended, or null if no match.
 */
function getAccumulatedExprs(
  stmt: IRStmt,
  varName: string,
): IRExpr[] | null {
  if (stmt.kind !== "ExprStmt") return null;
  const expr = stmt.expr;
  if (expr.kind !== "StoreLocal" || expr.name !== varName) return null;

  const value = expr.value;

  if (
    value.kind === "BinaryOp" &&
    value.op === "+" &&
    value.left.kind === "LoadLocal" &&
    value.left.name === varName
  ) {
    return [value.right];
  }

  if (
    value.kind === "StringConcat" &&
    value.parts.length >= 2 &&
    value.parts[0].kind === "LoadLocal" &&
    value.parts[0].name === varName
  ) {
    return value.parts.slice(1);
  }

  return null;
}

function exprReadsVar(expr: IRExpr, varName: string): boolean {
  let found = false;
  forEachExpr(expr, (node) => {
    if (node.kind === "LoadLocal" && node.name === varName) {
      found = true;
    }
  });
  return found;
}

function stmtReadsVar(stmt: IRStmt, varName: string): boolean {
  switch (stmt.kind) {
    case "ExprStmt":
      return exprReadsVar(stmt.expr, varName);
    case "VarDecl":
      return stmt.init ? exprReadsVar(stmt.init, varName) : false;
    case "Return":
      return stmt.expr ? exprReadsVar(stmt.expr, varName) : false;
    case "If":
      return (
        exprReadsVar(stmt.condition, varName) ||
        blockReadsVar(stmt.thenBlock, varName) ||
        (stmt.elseBlock ? blockReadsVar(stmt.elseBlock, varName) : false)
      );
    case "While":
      return exprReadsVar(stmt.condition, varName) || blockReadsVar(stmt.body, varName);
    case "For":
      return (
        (stmt.init ? stmtReadsVar(stmt.init, varName) : false) ||
        (stmt.condition ? exprReadsVar(stmt.condition, varName) : false) ||
        (stmt.update ? exprReadsVar(stmt.update, varName) : false) ||
        blockReadsVar(stmt.body, varName)
      );
    case "Block":
      return blockReadsVar(stmt, varName);
  }
}

function blockReadsVar(block: Block, varName: string): boolean {
  return block.stmts.some((s) => stmtReadsVar(s, varName));
}

/**
 * Check if a variable is read inside a loop body in contexts OTHER than
 * the accumulation pattern. If so, we cannot safely replace it with a
 * StringBuilder because those reads expect a String.
 */
function hasNonAccumReads(body: Block, varName: string, accumIndices: Set<number>): boolean {
  for (let i = 0; i < body.stmts.length; i++) {
    if (accumIndices.has(i)) continue;
    if (stmtReadsVar(body.stmts[i], varName)) return true;
  }
  return false;
}

function getLoopBody(stmt: IRStmt): Block | null {
  if (stmt.kind === "While" || stmt.kind === "For") return stmt.body;
  return null;
}

function findStringAccumPatterns(block: Block): StringAccumInfo[] {
  const results: StringAccumInfo[] = [];
  const optimizedVars = new Set<string>();

  for (let i = 0; i < block.stmts.length; i++) {
    const stmt = block.stmts[i];
    if (!isEmptyStringDecl(stmt)) continue;

    const varName = stmt.name;

    for (let j = i + 1; j < block.stmts.length; j++) {
      const loopStmt = block.stmts[j];
      const loopBody = getLoopBody(loopStmt);
      if (!loopBody) continue;

      const accumIndices: number[] = [];
      for (let k = 0; k < loopBody.stmts.length; k++) {
        if (getAccumulatedExprs(loopBody.stmts[k], varName) !== null) {
          accumIndices.push(k);
        }
      }

      if (accumIndices.length === 0) continue;

      const accumSet = new Set(accumIndices);
      if (hasNonAccumReads(loopBody, varName, accumSet)) continue;

      if (loopStmt.kind === "While" && exprReadsVar(loopStmt.condition, varName)) continue;
      if (
        loopStmt.kind === "For" &&
        ((loopStmt.condition && exprReadsVar(loopStmt.condition, varName)) ||
          (loopStmt.update && exprReadsVar(loopStmt.update, varName)))
      ) {
        continue;
      }

      let readBetween = false;
      for (let k = i + 1; k < j; k++) {
        if (stmtReadsVar(block.stmts[k], varName)) {
          readBetween = true;
          break;
        }
      }
      if (readBetween) continue;

      if (!optimizedVars.has(varName)) {
        results.push({
          varDeclIndex: i,
          varName,
          loopIndex: j,
          accumStmtIndices: accumIndices,
        });
        optimizedVars.add(varName);
      }
      break;
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// IR rewriting
// ---------------------------------------------------------------------------

function makeAppendCall(sbVarName: string, argExpr: IRExpr): Call {
  return {
    kind: "Call",
    target: "append",
    className: "java/lang/StringBuilder",
    args: [
      { kind: "LoadLocal", name: sbVarName, type: TY_SB } as LoadLocal,
      argExpr,
    ],
    returnType: TY_SB,
    isStatic: false,
  };
}

function makeToStringCall(sbVarName: string): Call {
  return {
    kind: "Call",
    target: "toString",
    className: "java/lang/StringBuilder",
    args: [
      { kind: "LoadLocal", name: sbVarName, type: TY_SB } as LoadLocal,
    ],
    returnType: TY_STRING,
    isStatic: false,
  };
}

function rewriteBlock(block: Block, patterns: StringAccumInfo[]): Block {
  if (patterns.length === 0) return block;

  const varDeclReplacements = new Map<number, IRStmt[]>();
  const loopReplacements = new Map<number, IRStmt[]>();

  for (const pattern of patterns) {
    const sbVarName = `__sb_${pattern.varName}`;

    const sbDecl: VarDecl = {
      kind: "VarDecl",
      name: sbVarName,
      type: TY_SB,
      init: {
        kind: "NewObject",
        className: "java/lang/StringBuilder",
        args: [],
      },
    };
    varDeclReplacements.set(pattern.varDeclIndex, [sbDecl]);

    const toStringDecl: VarDecl = {
      kind: "VarDecl",
      name: pattern.varName,
      type: TY_STRING,
      init: makeToStringCall(sbVarName),
    };
    loopReplacements.set(pattern.loopIndex, [toStringDecl]);
  }

  const newStmts: IRStmt[] = [];

  for (let i = 0; i < block.stmts.length; i++) {
    if (varDeclReplacements.has(i)) {
      newStmts.push(...varDeclReplacements.get(i)!);
      continue;
    }

    const loopBody = getLoopBody(block.stmts[i]);
    if (loopBody) {
      const applicablePatterns = patterns.filter((p) => p.loopIndex === i);
      if (applicablePatterns.length > 0) {
        const rewrittenLoop = rewriteLoopStmt(block.stmts[i], applicablePatterns);
        newStmts.push(rewrittenLoop);

        const afterLoop = loopReplacements.get(i);
        if (afterLoop) {
          newStmts.push(...afterLoop);
        }
        continue;
      }
    }

    newStmts.push(block.stmts[i]);
  }

  return { kind: "Block", stmts: newStmts };
}

function rewriteLoopStmt(stmt: IRStmt, patterns: StringAccumInfo[]): IRStmt {
  if (stmt.kind === "While" || stmt.kind === "For") {
    return { ...stmt, body: rewriteLoopBody(stmt.body, patterns) };
  }
  return stmt;
}

function rewriteLoopBody(body: Block, patterns: StringAccumInfo[]): Block {
  const indexToPattern = new Map<number, StringAccumInfo>();
  for (const pattern of patterns) {
    for (const idx of pattern.accumStmtIndices) {
      indexToPattern.set(idx, pattern);
    }
  }

  const newStmts: IRStmt[] = [];
  for (let i = 0; i < body.stmts.length; i++) {
    const pattern = indexToPattern.get(i);
    if (pattern) {
      const varName = pattern.varName;
      const sbVarName = `__sb_${varName}`;
      const accumExprs = getAccumulatedExprs(body.stmts[i], varName);
      if (accumExprs) {
        for (const argExpr of accumExprs) {
          const appendCall = makeAppendCall(sbVarName, argExpr);
          newStmts.push({ kind: "ExprStmt", expr: appendCall } as ExprStmt);
        }
        continue;
      }
    }
    newStmts.push(body.stmts[i]);
  }

  return { kind: "Block", stmts: newStmts };
}

// ---------------------------------------------------------------------------
// Main pass: process each function
// ---------------------------------------------------------------------------

function optimizeFunction(func: FunctionDef): FunctionDef {
  const patterns = findStringAccumPatterns(func.body);
  if (patterns.length === 0) return func;

  const newBody = rewriteBlock(func.body, patterns);
  return { ...func, body: newBody };
}

/**
 * Optimize string concatenation in loops by rewriting to StringBuilder.
 */
export function optimizeStrings(module: IRModule): IRModule {
  const newFunctions = module.functions.map(optimizeFunction);
  const newClasses = module.classes.map((cls) => ({
    ...cls,
    methods: cls.methods.map(optimizeFunction),
  }));

  return {
    ...module,
    functions: newFunctions,
    classes: newClasses,
  };
}
