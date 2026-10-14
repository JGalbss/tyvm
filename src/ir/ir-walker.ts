/**
 * Generic IR tree-walking utilities shared across optimization passes.
 *
 * Provides two core operations:
 * - `mapExpr` / `mapStmt` / `mapBlock`: rebuild the IR tree by applying
 *   a transform function to every expression node (bottom-up).
 * - `forEachExpr` / `forEachStmt` / `forEachBlock`: visit every expression
 *   node for side-effect-based analysis (e.g., collecting callees, checking
 *   variable reads).
 */

import type { IRExpr, IRStmt, Block, Call } from "./nodes.js";

// ---------------------------------------------------------------------------
// Mapping (rebuild tree with transformed expressions)
// ---------------------------------------------------------------------------

/**
 * Return a shallow copy of `expr` with every child expression replaced by the
 * result of calling `fn` on that child. Leaf nodes (Const, LoadLocal) are
 * returned as-is.
 */
function mapExprChildren(expr: IRExpr, fn: (e: IRExpr) => IRExpr): IRExpr {
  switch (expr.kind) {
    case "Const":
    case "LoadLocal":
      return expr;

    case "StoreLocal":
      return { ...expr, value: fn(expr.value) };

    case "BinaryOp":
      return { ...expr, left: fn(expr.left), right: fn(expr.right) };

    case "UnaryOp":
      return { ...expr, operand: fn(expr.operand) };

    case "Call":
      return { ...expr, args: expr.args.map(fn) };

    case "NewObject":
      return { ...expr, args: expr.args.map(fn) };

    case "FieldGet":
      return { ...expr, object: fn(expr.object) };

    case "FieldSet":
      return { ...expr, object: fn(expr.object), value: fn(expr.value) };

    case "ArrayNew":
      return { ...expr, size: fn(expr.size) };

    case "ArrayGet":
      return { ...expr, array: fn(expr.array), index: fn(expr.index) };

    case "ArraySet":
      return {
        ...expr,
        array: fn(expr.array),
        index: fn(expr.index),
        value: fn(expr.value),
      };

    case "Cast":
      return { ...expr, expr: fn(expr.expr) };

    case "Spawn":
      return { ...expr, call: fn(expr.call) as Call };

    case "Await":
      return { ...expr, expr: fn(expr.expr) };

    case "ChannelSend":
      return { ...expr, channel: fn(expr.channel), value: fn(expr.value) };

    case "ChannelRecv":
      return { ...expr, channel: fn(expr.channel) };

    case "StringConcat":
      return { ...expr, parts: expr.parts.map(fn) };

    case "PropertyAccess":
      return { ...expr, object: fn(expr.object) };

    default:
      return expr;
  }
}

/**
 * Recursively transform every expression in the tree bottom-up.
 * `fn` is called on each expression after its children have already been
 * transformed, so `fn` always receives a node with up-to-date children.
 */
export function mapExpr(
  expr: IRExpr,
  fn: (e: IRExpr) => IRExpr,
): IRExpr {
  const mapped = mapExprChildren(expr, (child) => mapExpr(child, fn));
  return fn(mapped);
}

/**
 * Recursively transform every expression inside a statement.
 */
export function mapStmt(
  stmt: IRStmt,
  fn: (e: IRExpr) => IRExpr,
): IRStmt {
  switch (stmt.kind) {
    case "ExprStmt":
      return { ...stmt, expr: mapExpr(stmt.expr, fn) };

    case "VarDecl":
      return {
        ...stmt,
        init: stmt.init ? mapExpr(stmt.init, fn) : undefined,
      };

    case "Return":
      return {
        ...stmt,
        expr: stmt.expr ? mapExpr(stmt.expr, fn) : undefined,
      };

    case "If":
      return {
        ...stmt,
        condition: mapExpr(stmt.condition, fn),
        thenBlock: mapBlock(stmt.thenBlock, fn),
        elseBlock: stmt.elseBlock
          ? mapBlock(stmt.elseBlock, fn)
          : undefined,
      };

    case "While":
      return {
        ...stmt,
        condition: mapExpr(stmt.condition, fn),
        body: mapBlock(stmt.body, fn),
      };

    case "For":
      return {
        ...stmt,
        init: stmt.init ? mapStmt(stmt.init, fn) : undefined,
        condition: stmt.condition
          ? mapExpr(stmt.condition, fn)
          : undefined,
        update: stmt.update
          ? mapExpr(stmt.update, fn)
          : undefined,
        body: mapBlock(stmt.body, fn),
      };

    case "Block":
      return mapBlock(stmt, fn);
  }
}

/**
 * Recursively transform every expression inside a block.
 */
export function mapBlock(
  block: Block,
  fn: (e: IRExpr) => IRExpr,
): Block {
  return { ...block, stmts: block.stmts.map((s) => mapStmt(s, fn)) };
}

// ---------------------------------------------------------------------------
// Visiting (side-effect traversal for analysis)
// ---------------------------------------------------------------------------

/**
 * Call `fn` on every expression node in the tree (pre-order).
 * Children are visited after the parent.
 */
export function forEachExpr(
  expr: IRExpr,
  fn: (e: IRExpr) => void,
): void {
  fn(expr);
  switch (expr.kind) {
    case "Const":
    case "LoadLocal":
      break;
    case "StoreLocal":
      forEachExpr(expr.value, fn);
      break;
    case "BinaryOp":
      forEachExpr(expr.left, fn);
      forEachExpr(expr.right, fn);
      break;
    case "UnaryOp":
      forEachExpr(expr.operand, fn);
      break;
    case "Call":
      for (const arg of expr.args) forEachExpr(arg, fn);
      break;
    case "NewObject":
      for (const arg of expr.args) forEachExpr(arg, fn);
      break;
    case "FieldGet":
      forEachExpr(expr.object, fn);
      break;
    case "FieldSet":
      forEachExpr(expr.object, fn);
      forEachExpr(expr.value, fn);
      break;
    case "ArrayNew":
      forEachExpr(expr.size, fn);
      break;
    case "ArrayGet":
      forEachExpr(expr.array, fn);
      forEachExpr(expr.index, fn);
      break;
    case "ArraySet":
      forEachExpr(expr.array, fn);
      forEachExpr(expr.index, fn);
      forEachExpr(expr.value, fn);
      break;
    case "Cast":
      forEachExpr(expr.expr, fn);
      break;
    case "Spawn":
      forEachExpr(expr.call, fn);
      break;
    case "Await":
      forEachExpr(expr.expr, fn);
      break;
    case "ChannelSend":
      forEachExpr(expr.channel, fn);
      forEachExpr(expr.value, fn);
      break;
    case "ChannelRecv":
      forEachExpr(expr.channel, fn);
      break;
    case "StringConcat":
      for (const part of expr.parts) forEachExpr(part, fn);
      break;
    case "PropertyAccess":
      forEachExpr(expr.object, fn);
      break;
  }
}

/**
 * Call `fn` on every expression node found within a statement.
 */
export function forEachStmt(
  stmt: IRStmt,
  fn: (e: IRExpr) => void,
): void {
  switch (stmt.kind) {
    case "ExprStmt":
      forEachExpr(stmt.expr, fn);
      break;
    case "VarDecl":
      if (stmt.init) forEachExpr(stmt.init, fn);
      break;
    case "Return":
      if (stmt.expr) forEachExpr(stmt.expr, fn);
      break;
    case "If":
      forEachExpr(stmt.condition, fn);
      forEachBlock(stmt.thenBlock, fn);
      if (stmt.elseBlock) forEachBlock(stmt.elseBlock, fn);
      break;
    case "While":
      forEachExpr(stmt.condition, fn);
      forEachBlock(stmt.body, fn);
      break;
    case "For":
      if (stmt.init) forEachStmt(stmt.init, fn);
      if (stmt.condition) forEachExpr(stmt.condition, fn);
      if (stmt.update) forEachExpr(stmt.update, fn);
      forEachBlock(stmt.body, fn);
      break;
    case "Block":
      forEachBlock(stmt, fn);
      break;
  }
}

/**
 * Call `fn` on every expression node found within a block.
 */
export function forEachBlock(
  block: Block,
  fn: (e: IRExpr) => void,
): void {
  for (const s of block.stmts) forEachStmt(s, fn);
}
