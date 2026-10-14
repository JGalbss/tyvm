/**
 * Function Inlining Pass
 *
 * Inlines small function calls at their call sites. This pass targets
 * single-return-expression functions (e.g., `function add(a, b) { return a + b; }`)
 * and replaces Call nodes with the return expression, substituting parameters
 * with argument expressions.
 *
 * The pass runs up to 3 rounds to handle chains of small helper functions
 * (e.g., `compute` calls `add` which gets inlined first, then `compute`
 * becomes a single-return-expression function and can itself be inlined).
 *
 * Functions are NOT inlined if they:
 * - Are the `main` function
 * - Are recursive (call themselves directly or indirectly)
 * - Have control flow (if/else, while, for) in their body
 * - Have more than a single Return statement with an expression
 */

import type {
  Module as IRModule,
  FunctionDef,
  IRExpr,
} from "../nodes.js";

import { mapExpr, mapBlock, forEachBlock } from "../ir-walker.js";

// ---------------------------------------------------------------------------
// Analysis: determine which functions are eligible for inlining
// ---------------------------------------------------------------------------

/** Returns the set of function names directly called within a function body. */
function collectCallees(func: FunctionDef): Set<string> {
  const callees = new Set<string>();
  forEachBlock(func.body, (expr) => {
    if (expr.kind === "Call") {
      callees.add(expr.target);
    }
  });
  return callees;
}

/**
 * Checks whether `funcName` is recursive (directly or indirectly) given
 * a call graph represented as funcName -> Set<calleeName>.
 */
function isRecursive(
  funcName: string,
  callGraph: Map<string, Set<string>>,
): boolean {
  const visited = new Set<string>();

  function dfs(current: string): boolean {
    if (current === funcName) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    const callees = callGraph.get(current);
    if (!callees) return false;
    for (const callee of callees) {
      if (dfs(callee)) return true;
    }
    return false;
  }

  const directCallees = callGraph.get(funcName);
  if (!directCallees) return false;
  for (const callee of directCallees) {
    if (dfs(callee)) return true;
  }
  return false;
}

/**
 * A function is eligible for inlining if its body is a single Return
 * statement with an expression.
 */
function getSingleReturnExpr(func: FunctionDef): IRExpr | null {
  const stmts = func.body.stmts;
  if (stmts.length !== 1) return null;
  const stmt = stmts[0];
  if (stmt.kind !== "Return") return null;
  return stmt.expr ?? null;
}

// ---------------------------------------------------------------------------
// Substitution: replace parameter references with argument expressions
// ---------------------------------------------------------------------------

function substituteExpr(
  expr: IRExpr,
  paramMap: Map<string, IRExpr>,
): IRExpr {
  return mapExpr(expr, (node) => {
    if (node.kind === "LoadLocal") {
      return paramMap.get(node.name) ?? node;
    }
    return node;
  });
}

// ---------------------------------------------------------------------------
// Rewriting: walk the IR and replace Call nodes with inlined expressions
// ---------------------------------------------------------------------------

function inlineExpr(
  expr: IRExpr,
  inlineable: Map<string, { func: FunctionDef; returnExpr: IRExpr }>,
): IRExpr {
  return mapExpr(expr, (node) => {
    if (node.kind !== "Call") return node;

    const target = inlineable.get(node.target);
    if (!target) return node;

    const { func, returnExpr } = target;
    const paramMap = new Map<string, IRExpr>();
    for (let i = 0; i < func.params.length; i++) {
      paramMap.set(func.params[i].name, node.args[i]);
    }
    return substituteExpr(returnExpr, paramMap);
  });
}

// ---------------------------------------------------------------------------
// Main pass entry point
// ---------------------------------------------------------------------------

/** Run one round of inlining. Returns the updated module. */
function inlineRound(module: IRModule): IRModule {
  const callGraph = new Map<string, Set<string>>();
  for (const func of module.functions) {
    callGraph.set(func.name, collectCallees(func));
  }

  const inlineable = new Map<
    string,
    { func: FunctionDef; returnExpr: IRExpr }
  >();

  for (const func of module.functions) {
    if (func.name === "main") continue;
    if (isRecursive(func.name, callGraph)) continue;

    const returnExpr = getSingleReturnExpr(func);
    if (returnExpr === null) continue;

    inlineable.set(func.name, { func, returnExpr });
  }

  if (inlineable.size === 0) return module;

  const newFunctions = module.functions.map((func) => ({
    ...func,
    body: mapBlock(func.body, (expr) => inlineExpr(expr, inlineable)),
  }));

  return { ...module, functions: newFunctions };
}

/**
 * Inline small function calls throughout the module.
 *
 * Runs up to 3 rounds of inlining to handle chains where inlining leaf
 * functions turns intermediate functions into single-return-expression
 * functions that can themselves be inlined.
 */
export function inlineFunctions(module: IRModule): IRModule {
  const MAX_ROUNDS = 3;
  let current = module;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const next = inlineRound(current);
    if (next === current) break;
    current = next;
  }

  return current;
}
