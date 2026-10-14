/**
 * Integer Promotion Pass
 *
 * Analyzes IR to detect variables and expressions that can safely be lowered
 * to JVM int/long instead of double. This is the single biggest performance
 * optimization for loop-heavy code since JVM int ops are ~3-5x faster than
 * double ops and enable better JIT optimization.
 *
 * Rules:
 * - A variable initialized with an integer literal (no decimal point) is promoted to TyInt
 * - A variable only used in integer arithmetic (+, -, *, /) stays TyInt
 * - Loop counters (i = 0; i < N; i = i + 1) are always promoted to TyInt
 * - Comparisons between int-promoted vars use int comparison
 * - If a variable flows into a context requiring double (e.g., division that
 *   produces a fraction, or passed to a function expecting double), it stays double
 * - Variables involved in sum accumulation of integers are promoted to TyLong
 *   to avoid overflow
 */

import type {
  Module as IRModule,
  FunctionDef,
  Block,
  IRStmt,
  IRExpr,
  JvmType,
} from "../nodes.js";

const TY_INT: JvmType = { kind: "TyInt" };
const TY_LONG: JvmType = { kind: "TyLong" };
const TY_DOUBLE: JvmType = { kind: "TyDouble" };

interface VarInfo {
  /** All assigned values (init + reassignments) */
  assignments: IRExpr[];
  /** Does this variable appear in a division as numerator/denominator? */
  usedInDivision: boolean;
  /** Does this accumulate large sums (i.e., sum = sum + expr in loop)? */
  isAccumulator: boolean;
  /** Accumulation only involves small integer constants (safe to use int) */
  accumulatesOnlyConstants: boolean;
  /** Is this a loop counter? (i = 0; i < N; i = i + 1) */
  isLoopCounter: boolean;
}

function isIntegerLiteral(expr: IRExpr): boolean {
  if (expr.kind !== "Const") return false;
  if (typeof expr.value !== "number") return false;
  return Number.isInteger(expr.value);
}

/** Check if an expression is bounded to small values (safe for int accumulation).
 *  Returns true for: small constants, modulo results, and arithmetic on bounded exprs. */
function isBoundedIntExpr(expr: IRExpr): boolean {
  if (expr.kind === "Const" && typeof expr.value === "number" &&
    Number.isInteger(expr.value) && Math.abs(expr.value) <= 1000) {
    return true;
  }
  // Modulo always bounds the result
  if (expr.kind === "BinaryOp" && expr.op === "%") return true;
  // Arithmetic on bounded expressions is bounded
  if (expr.kind === "BinaryOp" &&
    (expr.op === "+" || expr.op === "-" || expr.op === "*")) {
    return isBoundedIntExpr(expr.left) && isBoundedIntExpr(expr.right);
  }
  // Unary minus on bounded is bounded
  if (expr.kind === "UnaryOp" && expr.op === "-") {
    return isBoundedIntExpr(expr.operand);
  }
  return false;
}

/** Walk a chain of +/- operations left-to-right, collecting the RHS terms.
 *  Returns the collected terms if the leftmost leaf is LoadLocal(varName), else null.
 *  Example: ((x + a) - b) + c → [a, b, c] */
function extractAccumTerms(expr: IRExpr, varName: string): IRExpr[] | null {
  if (expr.kind !== "BinaryOp" || (expr.op !== "+" && expr.op !== "-")) return null;
  // Direct pattern: x + expr
  if (expr.left.kind === "LoadLocal" && expr.left.name === varName) {
    return [expr.right];
  }
  // Nested pattern: (x + a - b ...) +/- c
  const inner = extractAccumTerms(expr.left, varName);
  if (inner !== null) {
    return [...inner, expr.right];
  }
  return null;
}

function isComparisonOp(op: string): boolean {
  return op === "==" || op === "!=" || op === "<" || op === ">" ||
    op === "<=" || op === ">=";
}

function isIntegerArithmetic(op: string): boolean {
  return op === "+" || op === "-" || op === "*" || op === "/" || op === "%" ||
    isComparisonOp(op);
}

/** Collect info about all variable declarations in a function. */
function analyzeFunction(func: FunctionDef): Map<string, VarInfo> {
  const vars = new Map<string, VarInfo>();

  function ensureVar(name: string): VarInfo {
    let info = vars.get(name);
    if (!info) {
      info = {
        assignments: [],
        usedInDivision: false,
        isAccumulator: false,
        accumulatesOnlyConstants: true,
        isLoopCounter: false,
      };
      vars.set(name, info);
    }
    return info;
  }

  function analyzeExpr(expr: IRExpr): void {
    switch (expr.kind) {
      case "BinaryOp":
        if (expr.op === "/") {
          markDivisionOperands(expr.left);
          markDivisionOperands(expr.right);
        }
        analyzeExpr(expr.left);
        analyzeExpr(expr.right);
        break;
      case "Call":
        for (const arg of expr.args) {
          analyzeExpr(arg);
        }
        break;
      case "StoreLocal": {
        const info = ensureVar(expr.name);
        info.assignments.push(expr.value);
        // Detect accumulator pattern: x = x +/- expr1 +/- expr2 ...
        // Walks left through chains of +/- to find LoadLocal(x) as leftmost leaf
        const accumTerms = extractAccumTerms(expr.value, expr.name);
        if (accumTerms !== null) {
          info.isAccumulator = true;
          // Check if all accumulated terms are bounded
          if (!accumTerms.every(isBoundedIntExpr)) {
            info.accumulatesOnlyConstants = false;
          }
        }
        analyzeExpr(expr.value);
        break;
      }
      case "UnaryOp":
        analyzeExpr(expr.operand);
        break;
      case "StringConcat":
        for (const part of expr.parts) analyzeExpr(part);
        break;
      default:
        break;
    }
  }

  function markDivisionOperands(expr: IRExpr): void {
    if (expr.kind === "LoadLocal") {
      ensureVar(expr.name).usedInDivision = true;
    }
  }

  function analyzeStmt(stmt: IRStmt): void {
    switch (stmt.kind) {
      case "VarDecl": {
        const info = ensureVar(stmt.name);
        if (stmt.init) {
          info.assignments.push(stmt.init);
          analyzeExpr(stmt.init);
        }
        break;
      }
      case "ExprStmt":
        analyzeExpr(stmt.expr);
        break;
      case "Return":
        if (stmt.expr) analyzeExpr(stmt.expr);
        break;
      case "If":
        analyzeExpr(stmt.condition);
        analyzeBlock(stmt.thenBlock);
        if (stmt.elseBlock) analyzeBlock(stmt.elseBlock);
        break;
      case "While":
        analyzeExpr(stmt.condition);
        analyzeBlock(stmt.body);
        // Check for loop counter update in body
        detectLoopCounter(stmt.condition, stmt.body);
        break;
      case "For":
        if (stmt.init) analyzeStmt(stmt.init);
        if (stmt.condition) analyzeExpr(stmt.condition);
        if (stmt.update) analyzeExpr(stmt.update);
        analyzeBlock(stmt.body);
        break;
      case "Block":
        analyzeBlock(stmt);
        break;
    }
  }

  function detectLoopCounter(condition: IRExpr, body: Block): void {
    // Pattern: while (i < N) { ... i = i + 1; }
    // Also: while (i * i <= N) { ... i = i + 2; }
    if (condition.kind !== "BinaryOp") return;
    // Extract counter name from condition — either direct (i < N) or nested (i * i <= N)
    let counterName: string | null = null;
    if (condition.left.kind === "LoadLocal") {
      counterName = condition.left.name;
    } else if (condition.left.kind === "BinaryOp" &&
      condition.left.left.kind === "LoadLocal") {
      counterName = condition.left.left.name;
    }
    if (!counterName) return;

    for (const stmt of body.stmts) {
      if (stmt.kind === "ExprStmt" && stmt.expr.kind === "StoreLocal" &&
        stmt.expr.name === counterName) {
        const val = stmt.expr.value;
        if (val.kind === "BinaryOp" &&
          (val.op === "+" || val.op === "-") &&
          val.left.kind === "LoadLocal" && val.left.name === counterName &&
          val.right.kind === "Const" && typeof val.right.value === "number" &&
          Number.isInteger(val.right.value)) {
          ensureVar(counterName).isLoopCounter = true;
        }
      }
    }
  }

  function analyzeBlock(block: Block): void {
    for (const stmt of block.stmts) {
      analyzeStmt(stmt);
    }
  }

  analyzeBlock(func.body);
  return vars;
}

/** Check if an assignment expression involves multiplication (risk of int overflow). */
function assignmentInvolvesMul(expr: IRExpr): boolean {
  if (expr.kind === "BinaryOp") {
    if (expr.op === "*") return true;
    return assignmentInvolvesMul(expr.left) || assignmentInvolvesMul(expr.right);
  }
  return false;
}

/** Determine the optimal JVM type for a variable. */
function chooseType(name: string, info: VarInfo): JvmType | null {

  // Check all assignments are integer literals or integer expressions
  const allIntegerAssignments = info.assignments.every((expr) => {
    if (isIntegerLiteral(expr)) return true;
    // BinaryOp must be arithmetic AND not string concatenation
    if (expr.kind === "BinaryOp" && isIntegerArithmetic(expr.op) &&
        expr.type.kind !== "TyString") return true;
    return false;
  });

  if (!allIntegerAssignments && info.assignments.length > 0) return null;

  // Variables used in division should stay double for correct floating-point results
  if (info.usedInDivision) return null;

  // Loop counters → int (safe for counters up to 2B)
  if (info.isLoopCounter) return TY_INT;

  // Accumulators that only add/subtract small constants → int (fits in 32-bit)
  // Accumulators that add variables or large values → long (safe for large sums)
  if (info.isAccumulator) {
    return info.accumulatesOnlyConstants ? TY_INT : TY_LONG;
  }

  // Variables that are reassigned with multiplication may overflow int;
  // use long for safety (e.g., Collatz n = n * 3 + 1).
  if (info.assignments.some(assignmentInvolvesMul)) return TY_LONG;

  // Simple integer variables → int
  if (info.assignments.length > 0 && allIntegerAssignments) return TY_INT;

  return null;
}

/** Rewrite types in expressions.
 *  `sigPromos` maps function names to their promoted param/return types. */
function rewriteExpr(
  expr: IRExpr,
  promotions: Map<string, JvmType>,
  sigPromos?: Map<string, { params: JvmType[]; returnType: JvmType }>,
): IRExpr {
  switch (expr.kind) {
    case "Const":
      return expr;
    case "LoadLocal": {
      const promoted = promotions.get(expr.name);
      if (promoted) {
        return { ...expr, type: promoted };
      }
      return expr;
    }
    case "StoreLocal": {
      const promoted = promotions.get(expr.name);
      const newValue = rewriteExpr(expr.value, promotions, sigPromos);
      const targetType = promoted ?? expr.type;
      return {
        ...expr,
        type: targetType,
        value: coerceExpr(newValue, targetType, promotions),
      };
    }
    case "BinaryOp": {
      const newLeft = rewriteExpr(expr.left, promotions, sigPromos);
      const newRight = rewriteExpr(expr.right, promotions, sigPromos);
      const leftType = getRewrittenType(newLeft, promotions);
      const rightType = getRewrittenType(newRight, promotions);

      // If both sides are int/long, result should be int/long
      if (isIntType(leftType) && isIntType(rightType) && isIntegerArithmetic(expr.op)) {
        if (isComparisonOp(expr.op)) {
          return {
            ...expr,
            left: coerceToSameInt(newLeft, newRight, promotions),
            right: coerceToSameInt(newRight, newLeft, promotions),
            type: { kind: "TyBoolean" },
          };
        }
        // For arithmetic, use the wider type
        const resultType = widerIntType(leftType, rightType);
        return {
          ...expr,
          left: coerceExpr(newLeft, resultType, promotions),
          right: coerceExpr(newRight, resultType, promotions),
          type: resultType,
        };
      }

      // Mixed int/double: widen int side to double
      if (isIntType(leftType) && rightType.kind === "TyDouble") {
        return { ...expr, left: coerceExpr(newLeft, TY_DOUBLE, promotions), right: newRight, type: TY_DOUBLE };
      }
      if (leftType.kind === "TyDouble" && isIntType(rightType)) {
        return { ...expr, left: newLeft, right: coerceExpr(newRight, TY_DOUBLE, promotions), type: TY_DOUBLE };
      }

      return { ...expr, left: newLeft, right: newRight };
    }
    case "UnaryOp": {
      const newOperand = rewriteExpr(expr.operand, promotions, sigPromos);
      const opType = getRewrittenType(newOperand, promotions);
      if (isIntType(opType) && expr.op === "-") {
        return { ...expr, operand: newOperand, type: opType };
      }
      return { ...expr, operand: newOperand };
    }
    case "Call": {
      const newArgs = expr.args.map((a) => rewriteExpr(a, promotions, sigPromos));
      // If this call targets a signature-promoted function, coerce args & return type
      const sigPromo = sigPromos?.get(expr.target);
      if (sigPromo) {
        const coercedArgs = newArgs.map((arg, i) => {
          const targetType = sigPromo.params[i];
          if (targetType) return coerceExpr(arg, targetType, promotions);
          return arg;
        });
        return { ...expr, args: coercedArgs, returnType: sigPromo.returnType };
      }
      // No signature promotion — coerce promoted args back to original types
      // so that int-promoted locals are widened to double at call boundaries.
      // Skip coercion for Rt.println which has int/long overloads.
      if (expr.className === "tyvm/runtime/Rt" && expr.target === "println") {
        return { ...expr, args: newArgs };
      }
      const coercedArgs = newArgs.map((arg, i) => {
        const origType = getOriginalExprType(expr.args[i]);
        const newType = getRewrittenType(arg, promotions);
        if (origType.kind !== newType.kind && origType.kind === "TyDouble" && isIntType(newType)) {
          return coerceExpr(arg, origType, promotions);
        }
        return arg;
      });
      return { ...expr, args: coercedArgs };
    }
    case "StringConcat": {
      const newParts = expr.parts.map((p) => rewriteExpr(p, promotions, sigPromos));
      return { ...expr, parts: newParts };
    }
    case "ChannelSend": {
      const newChannel = rewriteExpr(expr.channel, promotions, sigPromos);
      const newValue = rewriteExpr(expr.value, promotions, sigPromos);
      return { ...expr, channel: newChannel, value: newValue };
    }
    case "ChannelRecv": {
      const newChannel = rewriteExpr(expr.channel, promotions, sigPromos);
      return { ...expr, channel: newChannel };
    }
    case "Spawn": {
      const newCall = rewriteExpr(expr.call, promotions, sigPromos);
      if (newCall.kind === "Call") {
        return { ...expr, call: newCall };
      }
      return expr;
    }
    case "Await": {
      const newInner = rewriteExpr(expr.expr, promotions, sigPromos);
      return { ...expr, expr: newInner };
    }
    default:
      return expr;
  }
}

function getRewrittenType(expr: IRExpr, promotions: Map<string, JvmType>): JvmType {
  if (expr.kind === "LoadLocal") {
    return promotions.get(expr.name) ?? expr.type;
  }
  if (expr.kind === "Const" && expr.type.kind === "TyDouble" &&
    typeof expr.value === "number" && Number.isInteger(expr.value)) {
    // Integer literal that could be int
    return TY_INT;
  }
  if (expr.kind === "Call") {
    return expr.returnType;
  }
  if (expr.kind === "BinaryOp" || expr.kind === "UnaryOp" || expr.kind === "StoreLocal") {
    return (expr as { type: JvmType }).type;
  }
  return (expr as { type?: JvmType }).type ?? TY_DOUBLE;
}

/** Get the type of an expression as it exists BEFORE promotion rewrites. */
function getOriginalExprType(expr: IRExpr): JvmType {
  if (expr.kind === "Call") return expr.returnType;
  return (expr as { type?: JvmType }).type ?? TY_DOUBLE;
}

function isIntType(t: JvmType): boolean {
  return t.kind === "TyInt" || t.kind === "TyLong";
}

function widerIntType(a: JvmType, b: JvmType): JvmType {
  if (a.kind === "TyLong" || b.kind === "TyLong") return TY_LONG;
  return TY_INT;
}

function coerceExpr(expr: IRExpr, target: JvmType, promotions: Map<string, JvmType>): IRExpr {
  // Integer constant → just change the type on the node
  if (expr.kind === "Const" && typeof expr.value === "number" && Number.isInteger(expr.value)) {
    if (expr.type.kind === target.kind) return expr;
    return { ...expr, type: target };
  }

  // Check the actual node type (not the speculative type)
  const actual = expr.kind === "LoadLocal" ? (promotions.get(expr.name) ?? expr.type) :
    expr.kind === "Call" ? expr.returnType :
    (expr as { type?: JvmType }).type ?? { kind: "TyDouble" as const };
  if (actual.kind === target.kind) return expr;

  // Need a cast
  return { kind: "Cast", expr, fromType: actual, toType: target };
}

function coerceToSameInt(expr: IRExpr, other: IRExpr, promotions: Map<string, JvmType>): IRExpr {
  const et = getRewrittenType(expr, promotions);
  const ot = getRewrittenType(other, promotions);
  const target = widerIntType(et, ot);
  return coerceExpr(expr, target, promotions);
}

function rewriteStmt(
  stmt: IRStmt,
  promotions: Map<string, JvmType>,
  sigPromos?: Map<string, { params: JvmType[]; returnType: JvmType }>,
  funcReturnType?: JvmType,
): IRStmt {
  switch (stmt.kind) {
    case "VarDecl": {
      const promoted = promotions.get(stmt.name);
      const newInit = stmt.init ? rewriteExpr(stmt.init, promotions, sigPromos) : undefined;
      const newType = promoted ?? stmt.type;
      if (newInit) {
        return { ...stmt, type: newType, init: coerceExpr(newInit, newType, promotions) };
      }
      return { ...stmt, type: newType, init: newInit };
    }
    case "ExprStmt":
      return { ...stmt, expr: rewriteExpr(stmt.expr, promotions, sigPromos) };
    case "Return": {
      if (!stmt.expr) return stmt;
      let newExpr = rewriteExpr(stmt.expr, promotions, sigPromos);
      // Coerce return expression to match function return type
      if (funcReturnType) {
        newExpr = coerceExpr(newExpr, funcReturnType, promotions);
      }
      return { ...stmt, expr: newExpr };
    }
    case "If":
      return {
        ...stmt,
        condition: rewriteExpr(stmt.condition, promotions, sigPromos),
        thenBlock: rewriteBlock(stmt.thenBlock, promotions, sigPromos, funcReturnType),
        elseBlock: stmt.elseBlock ? rewriteBlock(stmt.elseBlock, promotions, sigPromos, funcReturnType) : undefined,
      };
    case "While":
      return {
        ...stmt,
        condition: rewriteExpr(stmt.condition, promotions, sigPromos),
        body: rewriteBlock(stmt.body, promotions, sigPromos, funcReturnType),
      };
    case "For":
      return {
        ...stmt,
        init: stmt.init ? rewriteStmt(stmt.init, promotions, sigPromos, funcReturnType) : undefined,
        condition: stmt.condition ? rewriteExpr(stmt.condition, promotions, sigPromos) : undefined,
        update: stmt.update ? rewriteExpr(stmt.update, promotions, sigPromos) : undefined,
        body: rewriteBlock(stmt.body, promotions, sigPromos, funcReturnType),
      };
    case "Block":
      return rewriteBlock(stmt, promotions, sigPromos, funcReturnType);
  }
}

function rewriteBlock(
  block: Block,
  promotions: Map<string, JvmType>,
  sigPromos?: Map<string, { params: JvmType[]; returnType: JvmType }>,
  funcReturnType?: JvmType,
): Block {
  return {
    ...block,
    stmts: block.stmts.map((s) => rewriteStmt(s, promotions, sigPromos, funcReturnType)),
  };
}

function promoteFunction(
  func: FunctionDef,
  sigPromos?: Map<string, { params: JvmType[]; returnType: JvmType }>,
  moduleGlobalNames?: Set<string>,
): FunctionDef {
  const varInfos = analyzeFunction(func);
  const promotions = new Map<string, JvmType>();

  // Seed promotions with params that are already int/long (from signature promotion)
  const paramNames = new Set(func.params.map((p) => p.name));
  for (const param of func.params) {
    if (isIntType(param.type)) {
      promotions.set(param.name, param.type);
    }
  }

  for (const [name, info] of varInfos) {
    if (promotions.has(name)) continue; // already promoted via param
    // Don't promote params that aren't already int/long — their JVM slot type
    // is fixed by the method signature and can't be changed here.
    if (paramNames.has(name)) continue;
    // Don't promote module globals — they become static fields with fixed double type
    if (moduleGlobalNames?.has(name)) continue;
    const newType = chooseType(name, info);
    if (newType) {
      promotions.set(name, newType);
    }
  }

  if (promotions.size === 0 && !sigPromos?.size) return func;

  return {
    ...func,
    body: rewriteBlock(func.body, promotions, sigPromos, func.returnType),
  };
}

// ---------------------------------------------------------------------------
// Whole-module function signature promotion
// ---------------------------------------------------------------------------

interface ArgWithContext {
  expr: IRExpr;
  callerPromoted: Set<string>;
}

interface FuncSigInfo {
  /** All argument expressions at every call site, per parameter index */
  callArgs: ArgWithContext[][];
}

/** Check if an expression is provably integer-valued.
 *  `promotedLocals` optionally provides locals known to be promoted to int/long. */
function isIntegerExpr(expr: IRExpr, promotedLocals?: Set<string>): boolean {
  if (isIntegerLiteral(expr)) return true;
  if (expr.kind === "LoadLocal") {
    return isIntType(expr.type) || (promotedLocals?.has(expr.name) ?? false);
  }
  if (expr.kind === "BinaryOp" && isIntegerArithmetic(expr.op)) {
    return isIntegerExpr(expr.left, promotedLocals) && isIntegerExpr(expr.right, promotedLocals);
  }
  if (expr.kind === "UnaryOp" && expr.op === "-") return isIntegerExpr(expr.operand, promotedLocals);
  if (expr.kind === "Call") return isIntType(expr.returnType);
  return false;
}

/** Pre-compute which locals in a function will be promoted to int/long. */
function precomputePromotedLocals(func: FunctionDef): Set<string> {
  const promoted = new Set<string>();
  const varInfos = analyzeFunction(func);
  for (const [name, info] of varInfos) {
    const newType = chooseType(name, info);
    if (newType) promoted.add(name);
  }
  return promoted;
}

/** Collect call-site info for all module-internal functions.
 *  Self-recursive calls are excluded — we only consider external callers
 *  to break the chicken-and-egg problem with recursive integer promotion. */
function analyzeFunctionSignatures(module: IRModule): Map<string, FuncSigInfo> {
  const infos = new Map<string, FuncSigInfo>();

  for (const func of module.functions) {
    infos.set(func.name, {
      callArgs: func.params.map(() => []),
    });
  }

  // Pre-compute local promotions per function so we know which args will be int
  const localPromos = new Map<string, Set<string>>();
  for (const func of module.functions) {
    localPromos.set(func.name, precomputePromotedLocals(func));
  }

  for (const callerFunc of module.functions) {
    const callerPromoted = localPromos.get(callerFunc.name);
    function scanExpr(expr: IRExpr): void {
      switch (expr.kind) {
        case "Call":
          // Only record non-self-recursive calls to module functions
          if (expr.target !== callerFunc.name &&
              expr.className === module.name &&
              infos.has(expr.target)) {
            const info = infos.get(expr.target)!;
            for (let i = 0; i < expr.args.length; i++) {
              if (i < info.callArgs.length) {
                info.callArgs[i].push({ expr: expr.args[i], callerPromoted: callerPromoted! });
              }
            }
          }
          for (const arg of expr.args) scanExpr(arg);
          break;
        case "BinaryOp":
          scanExpr(expr.left);
          scanExpr(expr.right);
          break;
        case "UnaryOp":
          scanExpr(expr.operand);
          break;
        case "StoreLocal":
          scanExpr(expr.value);
          break;
        case "StringConcat":
          for (const p of expr.parts) scanExpr(p);
          break;
        default:
          break;
      }
    }

    function scanStmt(stmt: IRStmt): void {
      switch (stmt.kind) {
        case "ExprStmt": scanExpr(stmt.expr); break;
        case "VarDecl": if (stmt.init) scanExpr(stmt.init); break;
        case "Return": if (stmt.expr) scanExpr(stmt.expr); break;
        case "If":
          scanExpr(stmt.condition);
          scanBlock(stmt.thenBlock);
          if (stmt.elseBlock) scanBlock(stmt.elseBlock);
          break;
        case "While":
          scanExpr(stmt.condition);
          scanBlock(stmt.body);
          break;
        case "For":
          if (stmt.init) scanStmt(stmt.init);
          if (stmt.condition) scanExpr(stmt.condition);
          if (stmt.update) scanExpr(stmt.update);
          scanBlock(stmt.body);
          break;
        case "Block": scanBlock(stmt); break;
      }
    }

    function scanBlock(block: Block): void {
      for (const s of block.stmts) scanStmt(s);
    }

    scanBlock(callerFunc.body);
  }

  return infos;
}

/** Determine which functions can have their signatures promoted to int */
function computeSignaturePromotions(
  module: IRModule,
  sigInfos: Map<string, FuncSigInfo>,
): Map<string, { params: JvmType[]; returnType: JvmType }> {
  const promotions = new Map<string, { params: JvmType[]; returnType: JvmType }>();

  for (const func of module.functions) {
    // Skip main — its signature is fixed by JVM
    if (func.name === "main") continue;

    const info = sigInfos.get(func.name);
    if (!info) continue;

    // Analyze internal usage of params (division, reassignment, etc.)
    const varInfos = analyzeFunction(func);

    // Check if all params can be promoted
    const newParams: JvmType[] = [];
    let anyPromoted = false;

    for (let i = 0; i < func.params.length; i++) {
      const param = func.params[i];
      if (param.type.kind !== "TyDouble") {
        newParams.push(param.type);
        continue;
      }

      // Check internal usage of this param
      const paramInfo = varInfos.get(param.name);
      // If the param is reassigned, allow it only if all reassignments are integer arithmetic
      if (paramInfo && paramInfo.assignments.length > 0) {
        const allIntReassign = paramInfo.assignments.every((expr) => {
          if (isIntegerLiteral(expr)) return true;
          if (expr.kind === "BinaryOp" && isIntegerArithmetic(expr.op)) return true;
          return false;
        });
        if (!allIntReassign) {
          newParams.push(param.type);
          continue;
        }
      }

      const callArgs = info.callArgs[i];
      // All call-site args must be integer expressions (considering caller's promotions)
      // For self-recursive functions with no external callers, treat as promotable
      if (callArgs.length > 0 && callArgs.every((a) => isIntegerExpr(a.expr, a.callerPromoted))) {
        // Use long if reassignment involves multiplication (overflow risk)
        const useLong = paramInfo && paramInfo.assignments.some(assignmentInvolvesMul);
        newParams.push(useLong ? TY_LONG : TY_INT);
        anyPromoted = true;
      } else if (callArgs.length === 0 && paramInfo && paramInfo.assignments.length > 0) {
        // Self-recursive function with no external callers: promote based on assignments
        const allIntReassign = paramInfo.assignments.every((expr) => {
          if (isIntegerLiteral(expr)) return true;
          if (expr.kind === "BinaryOp" && isIntegerArithmetic(expr.op)) return true;
          return false;
        });
        if (allIntReassign) {
          const useLong = paramInfo.assignments.some(assignmentInvolvesMul);
          newParams.push(useLong ? TY_LONG : TY_INT);
          anyPromoted = true;
        } else {
          newParams.push(param.type);
        }
      } else {
        newParams.push(param.type);
      }
    }

    // Check if return type can be promoted
    let newReturnType = func.returnType;
    if (func.returnType.kind === "TyDouble") {
      // Check all return expressions in the function body
      const returns = collectReturns(func.body);
      // If all returns are integer expressions (after param promotion), promote return
      if (returns.length > 0 && returns.every((r) => r === null || isIntegerExprWithParams(r, func.params, newParams, func.name))) {
        newReturnType = TY_INT;
        anyPromoted = true;
      }
    }

    if (anyPromoted) {
      promotions.set(func.name, { params: newParams, returnType: newReturnType });
    }
  }

  return promotions;
}

function isIntegerExprWithParams(expr: IRExpr, params: { name: string; type: JvmType }[], newParamTypes: JvmType[], selfName?: string): boolean {
  if (isIntegerLiteral(expr)) return true;
  if (expr.kind === "LoadLocal") {
    const paramIdx = params.findIndex((p) => p.name === expr.name);
    if (paramIdx >= 0) return isIntType(newParamTypes[paramIdx]);
    return isIntType(expr.type);
  }
  if (expr.kind === "BinaryOp" && isIntegerArithmetic(expr.op)) {
    return isIntegerExprWithParams(expr.left, params, newParamTypes, selfName) &&
      isIntegerExprWithParams(expr.right, params, newParamTypes, selfName);
  }
  if (expr.kind === "UnaryOp" && expr.op === "-") return isIntegerExprWithParams(expr.operand, params, newParamTypes, selfName);
  if (expr.kind === "Call") {
    // Self-recursive calls: optimistic -- if we promote, the return type will match
    if (selfName && expr.target === selfName) return true;
    return isIntType(expr.returnType);
  }
  return false;
}

function collectReturns(block: Block): (IRExpr | null)[] {
  const returns: (IRExpr | null)[] = [];
  function scan(stmt: IRStmt): void {
    switch (stmt.kind) {
      case "Return": returns.push(stmt.expr ?? null); break;
      case "If":
        stmt.thenBlock.stmts.forEach(scan);
        stmt.elseBlock?.stmts.forEach(scan);
        break;
      case "While": stmt.body.stmts.forEach(scan); break;
      case "For": stmt.body.stmts.forEach(scan); break;
      case "Block": stmt.stmts.forEach(scan); break;
      default: break;
    }
  }
  block.stmts.forEach(scan);
  return returns;
}

/** Apply signature promotions: change param/return types on function defs,
 *  but do NOT rewrite function bodies — phase 2 (promoteFunction) handles that
 *  since it knows about both param promotions and local promotions. */
function applySignaturePromotions(
  module: IRModule,
  sigPromos: Map<string, { params: JvmType[]; returnType: JvmType }>,
): IRModule {
  const newFunctions = module.functions.map((func) => {
    const promo = sigPromos.get(func.name);
    if (promo) {
      const newParams = func.params.map((p, i) => ({
        ...p,
        type: promo.params[i] ?? p.type,
      }));
      return { ...func, params: newParams, returnType: promo.returnType };
    }
    return func;
  });

  return { ...module, functions: newFunctions };
}

/** Collect top-level VarDecl names from main — these become module globals (static fields)
 *  and must not be int-promoted since the emitter forces them to TyDouble. */
function collectModuleGlobalNames(module: IRModule): Set<string> {
  const names = new Set<string>();
  for (const func of module.functions) {
    if (func.name !== "main") continue;
    for (const stmt of func.body.stmts) {
      if (stmt.kind === "VarDecl") {
        names.add(stmt.name);
      }
    }
  }
  return names;
}

/** Run the integer promotion pass on an entire module. */
export function intPromote(module: IRModule): IRModule {
  // Phase 1: Promote function signatures (whole-module analysis)
  const sigInfos = analyzeFunctionSignatures(module);
  const sigPromos = computeSignaturePromotions(module, sigInfos);
  let promoted = sigPromos.size > 0 ? applySignaturePromotions(module, sigPromos) : module;

  // Collect module globals to exclude from promotion
  const moduleGlobalNames = collectModuleGlobalNames(promoted);

  // Phase 2: Promote local variables + rewrite bodies (per-function)
  // Pass sigPromos so Call nodes get their args coerced and return types updated
  // Note: class methods are NOT promoted because they may reference module-level
  // globals whose types must stay consistent (TyDouble) across all functions.
  promoted = {
    ...promoted,
    functions: promoted.functions.map((f) => promoteFunction(f, sigPromos, moduleGlobalNames)),
  };

  return promoted;
}
