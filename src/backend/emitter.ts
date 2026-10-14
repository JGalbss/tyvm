/**
 * JVM Bytecode Emitter
 *
 * Takes the IR (intermediate representation) and emits JVM .class files using
 * the ClassFileWriter. Each IRModule becomes a single class with top-level
 * functions as public static methods.
 */

import {
  ClassFileWriter,
  MethodBuilder,
  ACC_PUBLIC,
  ACC_STATIC,
  ACC_FINAL,
  ACC_SUPER,
} from "./classfile.js";
import { Opcode } from "./opcodes.js";
import { typeToDescriptor, methodDescriptor, typeSlotSize, parseDescriptorParams } from "./descriptors.js";
import {
  emitSpawn as emitSpawnConcurrency,
  emitAwait as emitAwaitConcurrency,
  emitChannelSend as emitChannelSendConcurrency,
  emitChannelRecv as emitChannelRecvConcurrency,
} from "./emit-concurrency.js";
import type {
  Module as IRModule,
  FunctionDef,
  Block,
  IRStmt,
  IRExpr,
  JvmType,
} from "../ir/nodes.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EmitResult {
  className: string;
  bytes: Uint8Array;
}

export interface EmitContext {
  writer: ClassFileWriter;
  method: MethodBuilder;
  locals: LocalScope;
  stack: StackTracker;
  className: string;
  moduleFunctions: Map<string, FunctionDef>;
  innerClasses: EmitResult[];
  spawnCounter: { value: number };
  /** Module-level variables emitted as static fields (name → type). */
  moduleGlobals: Map<string, JvmType>;
}

/** Returns the JvmType that an expression produces on the operand stack. */
function exprType(expr: IRExpr): JvmType {
  switch (expr.kind) {
    case "Const":
    case "LoadLocal":
    case "BinaryOp":
    case "UnaryOp":
    case "ArrayGet":
    case "FieldGet":
    case "Await":
    case "ChannelRecv":
    case "PropertyAccess":
    case "StaticFieldGet":
      return expr.type;
    case "StoreLocal":
    case "FieldSet":
    case "ArraySet":
    case "ChannelSend":
      return { kind: "TyVoid" };
    case "Call":
      return expr.returnType;
    case "NewObject":
      return { kind: "TyObject", className: expr.className };
    case "ArrayNew":
      return { kind: "TyArray", elementType: expr.elementType };
    case "Cast":
      return expr.toType;
    case "Spawn":
      return { kind: "TyTask", resultType: expr.call.returnType };
    case "StringConcat":
      return { kind: "TyString" };
    case "Serve":
      return { kind: "TyObject", className: "tyvm/runtime/HttpServer" };
  }
}

/** Tracks local variable name -> (slot, type) mappings within a method. */
class LocalScope {
  private slots: Map<string, { slot: number; type: JvmType }> = new Map();
  private nextSlot = 0;

  /** Allocate a slot for a parameter or local variable. */
  add(name: string, type: JvmType): number {
    const slot = this.nextSlot;
    this.slots.set(name, { slot, type });
    this.nextSlot += typeSlotSize(type);
    return slot;
  }

  getSlot(name: string): { slot: number; type: JvmType } | undefined {
    return this.slots.get(name);
  }

  getMaxLocals(): number {
    return this.nextSlot;
  }
}

/** Tracks operand stack depth to compute maxStack for the Code attribute. */
class StackTracker {
  private current = 0;
  private max = 0;

  push(n = 1): void {
    this.current += n;
    if (this.current > this.max) {
      this.max = this.current;
    }
  }

  pop(n = 1): void {
    this.current -= n;
  }

  getMax(): number {
    return this.max;
  }
}

// ---------------------------------------------------------------------------
// Helpers: type classification
// ---------------------------------------------------------------------------

function isReferenceType(type: JvmType): boolean {
  switch (type.kind) {
    case "TyString":
    case "TyObject":
    case "TyArray":
    case "TyTask":
    case "TyChannel":
      return true;
    default:
      return false;
  }
}

function isCategory2(type: JvmType): boolean {
  return type.kind === "TyDouble" || type.kind === "TyLong";
}

// ---------------------------------------------------------------------------
// Load/store helpers with short-form opcodes for slots 0-3
// ---------------------------------------------------------------------------

function emitLoad(ctx: EmitContext, slot: number, type: JvmType): void {
  const { method, stack } = ctx;
  const size = typeSlotSize(type);

  switch (type.kind) {
    case "TyDouble":
      if (slot <= 3) {
        method.emit(Opcode.DLOAD_0 + slot);
      } else {
        method.emit(Opcode.DLOAD);
        method.emitByte(slot);
      }
      break;
    case "TyLong":
      if (slot <= 3) {
        method.emit(Opcode.LLOAD_0 + slot);
      } else {
        method.emit(Opcode.LLOAD);
        method.emitByte(slot);
      }
      break;
    case "TyFloat":
      if (slot <= 3) {
        method.emit(Opcode.FLOAD_0 + slot);
      } else {
        method.emit(Opcode.FLOAD);
        method.emitByte(slot);
      }
      break;
    case "TyInt":
    case "TyBoolean":
      if (slot <= 3) {
        method.emit(Opcode.ILOAD_0 + slot);
      } else {
        method.emit(Opcode.ILOAD);
        method.emitByte(slot);
      }
      break;
    default:
      // Reference types
      if (slot <= 3) {
        method.emit(Opcode.ALOAD_0 + slot);
      } else {
        method.emit(Opcode.ALOAD);
        method.emitByte(slot);
      }
      break;
  }

  stack.push(size);
}

function emitStore(ctx: EmitContext, slot: number, type: JvmType): void {
  const { method, stack } = ctx;
  const size = typeSlotSize(type);

  switch (type.kind) {
    case "TyDouble":
      if (slot <= 3) {
        method.emit(Opcode.DSTORE_0 + slot);
      } else {
        method.emit(Opcode.DSTORE);
        method.emitByte(slot);
      }
      break;
    case "TyLong":
      if (slot <= 3) {
        method.emit(Opcode.LSTORE_0 + slot);
      } else {
        method.emit(Opcode.LSTORE);
        method.emitByte(slot);
      }
      break;
    case "TyFloat":
      if (slot <= 3) {
        method.emit(Opcode.FSTORE_0 + slot);
      } else {
        method.emit(Opcode.FSTORE);
        method.emitByte(slot);
      }
      break;
    case "TyInt":
    case "TyBoolean":
      if (slot <= 3) {
        method.emit(Opcode.ISTORE_0 + slot);
      } else {
        method.emit(Opcode.ISTORE);
        method.emitByte(slot);
      }
      break;
    default:
      // Reference types
      if (slot <= 3) {
        method.emit(Opcode.ASTORE_0 + slot);
      } else {
        method.emit(Opcode.ASTORE);
        method.emitByte(slot);
      }
      break;
  }

  stack.pop(size);
}

/** Emit the JVM default value for a type (0 for numeric, null for reference). */
function emitDefaultValue(ctx: EmitContext, type: JvmType): void {
  const { method, stack } = ctx;
  switch (type.kind) {
    case "TyDouble":
      method.emit(Opcode.DCONST_0);
      stack.push(2);
      break;
    case "TyFloat":
      method.emit(Opcode.FCONST_0);
      stack.push(1);
      break;
    case "TyLong":
      method.emit(Opcode.LCONST_0);
      stack.push(2);
      break;
    case "TyInt":
    case "TyBoolean":
      method.emit(Opcode.ICONST_0);
      stack.push(1);
      break;
    default:
      method.emit(Opcode.ACONST_NULL);
      stack.push(1);
      break;
  }
}

/** Emit the appropriate return instruction for a given type. */
function emitReturnOpcode(ctx: EmitContext, type: JvmType): void {
  const { method } = ctx;
  switch (type.kind) {
    case "TyVoid":
      method.emit(Opcode.RETURN);
      break;
    case "TyDouble":
      method.emit(Opcode.DRETURN);
      break;
    case "TyFloat":
      method.emit(Opcode.FRETURN);
      break;
    case "TyLong":
      method.emit(Opcode.LRETURN);
      break;
    case "TyInt":
    case "TyBoolean":
      method.emit(Opcode.IRETURN);
      break;
    default:
      method.emit(Opcode.ARETURN);
      break;
  }
}

// ---------------------------------------------------------------------------
// Expression / Statement emission
// ---------------------------------------------------------------------------

function emitExpr(ctx: EmitContext, expr: IRExpr): void {
  switch (expr.kind) {
    case "Const":
      emitConst(ctx, expr);
      break;
    case "LoadLocal":
      emitLoadLocal(ctx, expr);
      break;
    case "StoreLocal":
      emitStoreLocal(ctx, expr);
      break;
    case "BinaryOp":
      emitBinaryOp(ctx, expr);
      break;
    case "UnaryOp":
      emitUnaryOp(ctx, expr);
      break;
    case "Call":
      emitCall(ctx, expr);
      break;
    case "StringConcat":
      emitStringConcat(ctx, expr);
      break;
    case "NewObject":
      emitNewObject(ctx, expr);
      break;
    case "FieldGet":
      emitFieldGet(ctx, expr);
      break;
    case "FieldSet":
      emitFieldSet(ctx, expr);
      break;
    case "ArrayNew":
      emitArrayNew(ctx, expr);
      break;
    case "ArrayGet":
      emitArrayGet(ctx, expr);
      break;
    case "ArraySet":
      emitArraySet(ctx, expr);
      break;
    case "Cast":
      emitCast(ctx, expr);
      break;
    case "PropertyAccess":
      emitPropertyAccess(ctx, expr);
      break;
    case "StaticFieldGet":
      emitStaticFieldGet(ctx, expr);
      break;
    case "Spawn":
      emitSpawn(ctx, expr);
      break;
    case "Await":
      emitAwait(ctx, expr);
      break;
    case "ChannelSend":
      emitChannelSend(ctx, expr);
      break;
    case "ChannelRecv":
      emitChannelRecv(ctx, expr);
      break;
    case "Serve":
      emitServe(ctx, expr);
      break;
  }
}

function emitConst(ctx: EmitContext, expr: IRExpr & { kind: "Const" }): void {
  const { method, stack, writer } = ctx;
  const { value, type } = expr;

  if (type.kind === "TyDouble") {
    const v = value as number;
    if (v === 0.0) {
      method.emit(Opcode.DCONST_0);
    } else if (v === 1.0) {
      method.emit(Opcode.DCONST_1);
    } else {
      const idx = writer.addDouble(v);
      method.emit(Opcode.LDC2_W);
      method.emitShort(idx);
    }
    stack.push(2);
  } else if (type.kind === "TyFloat") {
    const v = value as number;
    if (v === 0.0) {
      method.emit(Opcode.FCONST_0);
    } else if (v === 1.0) {
      method.emit(Opcode.FCONST_1);
    } else if (v === 2.0) {
      method.emit(Opcode.FCONST_2);
    } else {
      const idx = writer.addFloat(v);
      method.emitLdc(idx);
    }
    stack.push(1);
  } else if (type.kind === "TyLong") {
    const v = value as number;
    if (v === 0) {
      method.emit(Opcode.LCONST_0);
    } else if (v === 1) {
      method.emit(Opcode.LCONST_1);
    } else {
      const idx = writer.addLong(BigInt(v));
      method.emit(Opcode.LDC2_W);
      method.emitShort(idx);
    }
    stack.push(2);
  } else if (type.kind === "TyInt") {
    const v = value as number;
    if (v >= -1 && v <= 5) {
      method.emit(Opcode.ICONST_0 + v);
    } else if (v >= -128 && v <= 127) {
      method.emit(Opcode.BIPUSH);
      method.emitByte(v);
    } else if (v >= -32768 && v <= 32767) {
      method.emit(Opcode.SIPUSH);
      method.emitShort(v);
    } else {
      const idx = writer.addInteger(v);
      method.emitLdc(idx);
    }
    stack.push(1);
  } else if (type.kind === "TyString") {
    const idx = writer.addString(value as string);
    method.emitLdc(idx);
    stack.push(1);
  } else if (type.kind === "TyBoolean") {
    method.emit(value ? Opcode.ICONST_1 : Opcode.ICONST_0);
    stack.push(1);
  } else {
    // null
    method.emit(Opcode.ACONST_NULL);
    stack.push(1);
  }
}

function emitLoadLocal(ctx: EmitContext, expr: IRExpr & { kind: "LoadLocal" }): void {
  const info = ctx.locals.getSlot(expr.name);
  if (!info) {
    // Fall back to module-level static field
    const globalType = ctx.moduleGlobals.get(expr.name);
    if (globalType) {
      const { method, stack, writer, className } = ctx;
      const desc = typeToDescriptor(globalType);
      const fieldRef = writer.addFieldref(className, expr.name, desc);
      method.emit(Opcode.GETSTATIC);
      method.emitShort(fieldRef);
      stack.push(typeSlotSize(globalType));
      return;
    }
    throw new Error(`Emitter: unknown local variable '${expr.name}'`);
  }
  emitLoad(ctx, info.slot, info.type);
}

function emitStoreLocal(ctx: EmitContext, expr: IRExpr & { kind: "StoreLocal" }): void {
  emitExpr(ctx, expr.value);
  const info = ctx.locals.getSlot(expr.name);
  if (!info) {
    // Fall back to module-level static field
    const globalType = ctx.moduleGlobals.get(expr.name);
    if (globalType) {
      const { method, stack, writer, className } = ctx;
      const desc = typeToDescriptor(globalType);
      const fieldRef = writer.addFieldref(className, expr.name, desc);
      method.emit(Opcode.PUTSTATIC);
      method.emitShort(fieldRef);
      stack.pop(typeSlotSize(globalType));
      return;
    }
    throw new Error(`Emitter: unknown local variable '${expr.name}'`);
  }
  emitStore(ctx, info.slot, info.type);
}

function emitBinaryOp(ctx: EmitContext, expr: IRExpr & { kind: "BinaryOp" }): void {
  const { method, stack } = ctx;
  const { op, left, right, type } = expr;

  const leftType = exprType(left);
  const rightType = exprType(right);

  // Short-circuit logical operators
  if (op === "&&") {
    emitShortCircuitAnd(ctx, expr);
    return;
  }
  if (op === "||") {
    emitShortCircuitOr(ctx, expr);
    return;
  }

  // String concatenation
  if (op === "+" && (leftType.kind === "TyString" || rightType.kind === "TyString")) {
    emitStringConcatBinary(ctx, left, right);
    return;
  }

  // String comparison (== / !=) — use String.equals() on JVM
  if ((leftType.kind === "TyString" || rightType.kind === "TyString") && (op === "==" || op === "!=")) {
    emitExpr(ctx, left);
    emitExpr(ctx, right);
    emitStringComparison(ctx, op);
    return;
  }

  // Object reference comparison (== / !=)
  if ((leftType.kind === "TyObject" || rightType.kind === "TyObject") && (op === "==" || op === "!=")) {
    emitExpr(ctx, left);
    emitExpr(ctx, right);
    emitObjectComparison(ctx, op);
    return;
  }

  // Emit both operands
  emitExpr(ctx, left);
  emitExpr(ctx, right);

  if (leftType.kind === "TyDouble") {
    switch (op) {
      case "+": method.emit(Opcode.DADD); stack.pop(2); break;
      case "-": method.emit(Opcode.DSUB); stack.pop(2); break;
      case "*": method.emit(Opcode.DMUL); stack.pop(2); break;
      case "/": method.emit(Opcode.DDIV); stack.pop(2); break;
      case "%": method.emit(Opcode.DREM); stack.pop(2); break;
      case "==": case "!=": case "<": case ">": case "<=": case ">=":
        emitDoubleComparison(ctx, op);
        break;
      default:
        throw new Error(`Emitter: unsupported double binary op '${op}'`);
    }
  } else if (leftType.kind === "TyInt" || leftType.kind === "TyBoolean") {
    switch (op) {
      case "+": method.emit(Opcode.IADD); stack.pop(1); break;
      case "-": method.emit(Opcode.ISUB); stack.pop(1); break;
      case "*": method.emit(Opcode.IMUL); stack.pop(1); break;
      case "/": method.emit(Opcode.IDIV); stack.pop(1); break;
      case "%": method.emit(Opcode.IREM); stack.pop(1); break;
      case "==": case "!=": case "<": case ">": case "<=": case ">=":
        emitIntComparison(ctx, op);
        break;
      default:
        throw new Error(`Emitter: unsupported int binary op '${op}'`);
    }
  } else if (leftType.kind === "TyLong") {
    switch (op) {
      case "+": method.emit(Opcode.LADD); stack.pop(2); break;
      case "-": method.emit(Opcode.LSUB); stack.pop(2); break;
      case "*": method.emit(Opcode.LMUL); stack.pop(2); break;
      case "/": method.emit(Opcode.LDIV); stack.pop(2); break;
      case "%": method.emit(Opcode.LREM); stack.pop(2); break;
      case "==": case "!=": case "<": case ">": case "<=": case ">=":
        emitLongComparison(ctx, op);
        break;
      default:
        throw new Error(`Emitter: unsupported long binary op '${op}'`);
    }
  } else if (leftType.kind === "TyFloat") {
    switch (op) {
      case "+": method.emit(Opcode.FADD); stack.pop(1); break;
      case "-": method.emit(Opcode.FSUB); stack.pop(1); break;
      case "*": method.emit(Opcode.FMUL); stack.pop(1); break;
      case "/": method.emit(Opcode.FDIV); stack.pop(1); break;
      case "%": method.emit(Opcode.FREM); stack.pop(1); break;
      default:
        throw new Error(`Emitter: unsupported float binary op '${op}'`);
    }
  } else {
    throw new Error(`Emitter: unsupported binary op type '${leftType.kind}'`);
  }
}

/**
 * String comparison using String.equals() — stack: [str1, str2] -> [boolean]
 */
function emitStringComparison(ctx: EmitContext, op: string): void {
  const { method, stack, writer } = ctx;
  const falseLabel = method.label();
  const endLabel = method.label();

  // Call String.equals(Object) — consumes str1 (receiver) + str2 (arg), pushes boolean
  const equalsRef = writer.addMethodref("java/lang/String", "equals", "(Ljava/lang/Object;)Z");
  method.emit(Opcode.INVOKEVIRTUAL);
  method.emitShort(equalsRef);
  stack.pop(1); // consumed 2 refs, pushed 1 int

  if (op === "==") {
    method.emitJump(Opcode.IFEQ, falseLabel); // if equals returned false, jump
  } else {
    method.emitJump(Opcode.IFNE, falseLabel); // if equals returned true, jump (we want !=)
  }
  stack.pop(1);

  method.emit(Opcode.ICONST_1);
  stack.push(1);
  method.emitJump(Opcode.GOTO, endLabel);
  stack.pop(1);

  method.placeLabel(falseLabel);
  method.emit(Opcode.ICONST_0);
  stack.push(1);

  method.placeLabel(endLabel);
}

/**
 * Object reference comparison — stack: [obj1, obj2] -> [boolean]
 */
function emitObjectComparison(ctx: EmitContext, op: string): void {
  const { method, stack } = ctx;
  const falseLabel = method.label();
  const endLabel = method.label();

  if (op === "==") {
    method.emitJump(Opcode.IF_ACMPNE, falseLabel);
  } else {
    method.emitJump(Opcode.IF_ACMPEQ, falseLabel);
  }
  stack.pop(2);

  method.emit(Opcode.ICONST_1);
  stack.push(1);
  method.emitJump(Opcode.GOTO, endLabel);
  stack.pop(1);

  method.placeLabel(falseLabel);
  method.emit(Opcode.ICONST_0);
  stack.push(1);

  method.placeLabel(endLabel);
}

function emitDoubleComparison(ctx: EmitContext, op: string): void {
  const { method, stack } = ctx;
  const falseLabel = method.label();
  const endLabel = method.label();

  // Two doubles (4 slots) on stack. DCMPL/DCMPG consumes them, pushes 1 int.
  switch (op) {
    case "==":
      method.emit(Opcode.DCMPL);
      stack.pop(4); stack.push(1);
      method.emitJump(Opcode.IFNE, falseLabel);
      stack.pop(1);
      break;
    case "!=":
      method.emit(Opcode.DCMPL);
      stack.pop(4); stack.push(1);
      method.emitJump(Opcode.IFEQ, falseLabel);
      stack.pop(1);
      break;
    case "<":
      method.emit(Opcode.DCMPG);
      stack.pop(4); stack.push(1);
      method.emitJump(Opcode.IFGE, falseLabel);
      stack.pop(1);
      break;
    case ">":
      method.emit(Opcode.DCMPL);
      stack.pop(4); stack.push(1);
      method.emitJump(Opcode.IFLE, falseLabel);
      stack.pop(1);
      break;
    case "<=":
      method.emit(Opcode.DCMPG);
      stack.pop(4); stack.push(1);
      method.emitJump(Opcode.IFGT, falseLabel);
      stack.pop(1);
      break;
    case ">=":
      method.emit(Opcode.DCMPL);
      stack.pop(4); stack.push(1);
      method.emitJump(Opcode.IFLT, falseLabel);
      stack.pop(1);
      break;
  }

  method.emit(Opcode.ICONST_1);
  stack.push(1);
  method.emitJump(Opcode.GOTO, endLabel);
  stack.pop(1);

  method.placeLabel(falseLabel);
  method.emit(Opcode.ICONST_0);
  stack.push(1);

  method.placeLabel(endLabel);
}

function emitIntComparison(ctx: EmitContext, op: string): void {
  const { method, stack } = ctx;
  const falseLabel = method.label();
  const endLabel = method.label();

  let branchOp: Opcode;
  switch (op) {
    case "==": branchOp = Opcode.IF_ICMPNE; break;
    case "!=": branchOp = Opcode.IF_ICMPEQ; break;
    case "<":  branchOp = Opcode.IF_ICMPGE; break;
    case ">":  branchOp = Opcode.IF_ICMPLE; break;
    case "<=": branchOp = Opcode.IF_ICMPGT; break;
    case ">=": branchOp = Opcode.IF_ICMPLT; break;
    default:
      throw new Error(`Emitter: unsupported int comparison '${op}'`);
  }

  method.emitJump(branchOp, falseLabel);
  stack.pop(2);

  method.emit(Opcode.ICONST_1);
  stack.push(1);
  method.emitJump(Opcode.GOTO, endLabel);
  stack.pop(1);

  method.placeLabel(falseLabel);
  method.emit(Opcode.ICONST_0);
  stack.push(1);

  method.placeLabel(endLabel);
}

function emitLongComparison(ctx: EmitContext, op: string): void {
  const { method, stack } = ctx;
  const falseLabel = method.label();
  const endLabel = method.label();

  // LCMP consumes two longs (4 slots), pushes int (-1, 0, 1)
  method.emit(Opcode.LCMP);
  stack.pop(4);
  stack.push(1);

  let branchOp: Opcode;
  switch (op) {
    case "==": branchOp = Opcode.IFNE; break;
    case "!=": branchOp = Opcode.IFEQ; break;
    case "<":  branchOp = Opcode.IFGE; break;
    case ">":  branchOp = Opcode.IFLE; break;
    case "<=": branchOp = Opcode.IFGT; break;
    case ">=": branchOp = Opcode.IFLT; break;
    default:
      throw new Error(`Emitter: unsupported long comparison '${op}'`);
  }

  method.emitJump(branchOp, falseLabel);
  stack.pop(1);

  method.emit(Opcode.ICONST_1);
  stack.push(1);
  method.emitJump(Opcode.GOTO, endLabel);
  stack.pop(1);

  method.placeLabel(falseLabel);
  method.emit(Opcode.ICONST_0);
  stack.push(1);

  method.placeLabel(endLabel);
}

function emitShortCircuitAnd(ctx: EmitContext, expr: IRExpr & { kind: "BinaryOp" }): void {
  const { method, stack } = ctx;
  const falseLabel = method.label();
  const endLabel = method.label();

  emitExpr(ctx, expr.left);
  method.emitJump(Opcode.IFEQ, falseLabel);
  stack.pop(1);

  emitExpr(ctx, expr.right);
  method.emitJump(Opcode.GOTO, endLabel);

  method.placeLabel(falseLabel);
  stack.pop(1);
  method.emit(Opcode.ICONST_0);
  stack.push(1);

  method.placeLabel(endLabel);
}

function emitShortCircuitOr(ctx: EmitContext, expr: IRExpr & { kind: "BinaryOp" }): void {
  const { method, stack } = ctx;
  const trueLabel = method.label();
  const endLabel = method.label();

  emitExpr(ctx, expr.left);
  method.emitJump(Opcode.IFNE, trueLabel);
  stack.pop(1);

  emitExpr(ctx, expr.right);
  method.emitJump(Opcode.GOTO, endLabel);

  method.placeLabel(trueLabel);
  stack.pop(1);
  method.emit(Opcode.ICONST_1);
  stack.push(1);

  method.placeLabel(endLabel);
}

function emitStringConcatBinary(ctx: EmitContext, left: IRExpr, right: IRExpr): void {
  const { method, stack, writer } = ctx;

  emitExprAsString(ctx, left);
  emitExprAsString(ctx, right);

  const concatRef = writer.addMethodref(
    "tyvm/runtime/Rt",
    "concat",
    "(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;"
  );
  method.emit(Opcode.INVOKESTATIC);
  method.emitShort(concatRef);
  stack.pop(2);
  stack.push(1);
}

function emitExprAsString(ctx: EmitContext, expr: IRExpr): void {
  const { method, stack, writer } = ctx;
  const et = exprType(expr);

  if (et.kind === "TyString") {
    emitExpr(ctx, expr);
    return;
  }

  emitExpr(ctx, expr);

  let desc: string;
  switch (et.kind) {
    case "TyDouble":
      desc = "(D)Ljava/lang/String;";
      break;
    case "TyFloat":
      desc = "(F)Ljava/lang/String;";
      break;
    case "TyLong":
      desc = "(J)Ljava/lang/String;";
      break;
    case "TyInt":
      desc = "(I)Ljava/lang/String;";
      break;
    case "TyBoolean":
      desc = "(Z)Ljava/lang/String;";
      break;
    default:
      desc = "(Ljava/lang/Object;)Ljava/lang/String;";
      break;
  }

  const valueOfRef = writer.addMethodref("java/lang/String", "valueOf", desc);
  method.emit(Opcode.INVOKESTATIC);
  method.emitShort(valueOfRef);
  const consumed = typeSlotSize(et);
  stack.pop(consumed);
  stack.push(1);
}

function emitUnaryOp(ctx: EmitContext, expr: IRExpr & { kind: "UnaryOp" }): void {
  const { method, stack } = ctx;
  const operandType = exprType(expr.operand);
  emitExpr(ctx, expr.operand);

  switch (expr.op) {
    case "-":
      if (operandType.kind === "TyDouble") {
        method.emit(Opcode.DNEG);
      } else if (operandType.kind === "TyFloat") {
        method.emit(Opcode.FNEG);
      } else if (operandType.kind === "TyLong") {
        method.emit(Opcode.LNEG);
      } else {
        method.emit(Opcode.INEG);
      }
      break;
    case "!":
      method.emit(Opcode.ICONST_1);
      stack.push(1);
      method.emit(Opcode.IXOR);
      stack.pop(1);
      break;
    case "~":
      method.emit(Opcode.ICONST_M1);
      stack.push(1);
      method.emit(Opcode.IXOR);
      stack.pop(1);
      break;
  }
}

function emitCall(ctx: EmitContext, expr: IRExpr & { kind: "Call" }): void {
  const { method, stack, writer, className } = ctx;
  const { target, args, returnType, isStatic } = expr;
  const callClassName = expr.className || className;

  if (isStatic) {
    // Parse expected param types from explicit descriptor (if any)
    const expectedParams = expr.explicitDescriptor
      ? parseDescriptorParams(expr.explicitDescriptor)
      : undefined;

    for (let i = 0; i < args.length; i++) {
      emitExpr(ctx, args[i]);
      // Convert arg type to match expected descriptor type
      if (expectedParams && i < expectedParams.length) {
        emitImplicitConversion(ctx, exprType(args[i]), expectedParams[i]);
      }
    }

    const paramTypes = expectedParams ?? args.map((a) => exprType(a));
    const desc = expr.explicitDescriptor ?? methodDescriptor(paramTypes, returnType);
    const methodRef = writer.addMethodref(callClassName, target, desc);

    method.emit(Opcode.INVOKESTATIC);
    method.emitShort(methodRef);

    for (const pt of paramTypes) {
      stack.pop(typeSlotSize(pt));
    }

    if (returnType.kind !== "TyVoid") {
      stack.push(typeSlotSize(returnType));
    }
  } else {
    // Non-static (virtual) call: args[0] is the receiver, args[1..] are method params
    // Parse expected param types from explicit descriptor (if any)
    const expectedParams = expr.explicitDescriptor
      ? parseDescriptorParams(expr.explicitDescriptor)
      : undefined;

    // Emit receiver
    emitExpr(ctx, args[0]);

    // Emit method parameters with conversions
    const methodArgs = args.slice(1);
    for (let i = 0; i < methodArgs.length; i++) {
      emitExpr(ctx, methodArgs[i]);
      if (expectedParams && i < expectedParams.length) {
        emitImplicitConversion(ctx, exprType(methodArgs[i]), expectedParams[i]);
      }
    }

    const paramTypes = expectedParams ?? methodArgs.map((a) => exprType(a));
    const desc = expr.explicitDescriptor ?? methodDescriptor(paramTypes, returnType);
    const methodRef = writer.addMethodref(callClassName, target, desc);

    method.emit(Opcode.INVOKEVIRTUAL);
    method.emitShort(methodRef);

    // Pop receiver
    stack.pop(1);
    // Pop all params
    for (const pt of paramTypes) {
      stack.pop(typeSlotSize(pt));
    }

    if (returnType.kind !== "TyVoid") {
      stack.push(typeSlotSize(returnType));
    }
  }
}

function emitStringConcat(ctx: EmitContext, expr: IRExpr & { kind: "StringConcat" }): void {
  const { method, stack, writer } = ctx;
  const { parts } = expr;

  // NEW java/lang/StringBuilder
  const sbClass = writer.addClass("java/lang/StringBuilder");
  method.emit(Opcode.NEW);
  method.emitShort(sbClass);
  stack.push(1);

  // DUP
  method.emit(Opcode.DUP);
  stack.push(1);

  // INVOKESPECIAL StringBuilder.<init>()V
  const initRef = writer.addMethodref("java/lang/StringBuilder", "<init>", "()V");
  method.emit(Opcode.INVOKESPECIAL);
  method.emitShort(initRef);
  stack.pop(1); // consumes the DUP'd ref

  for (const part of parts) {
    emitExpr(ctx, part);
    const partType = exprType(part);

    let appendDesc: string;
    switch (partType.kind) {
      case "TyDouble":
        appendDesc = "(D)Ljava/lang/StringBuilder;";
        break;
      case "TyFloat":
        appendDesc = "(F)Ljava/lang/StringBuilder;";
        break;
      case "TyLong":
        appendDesc = "(J)Ljava/lang/StringBuilder;";
        break;
      case "TyInt":
        appendDesc = "(I)Ljava/lang/StringBuilder;";
        break;
      case "TyBoolean":
        appendDesc = "(Z)Ljava/lang/StringBuilder;";
        break;
      case "TyString":
        appendDesc = "(Ljava/lang/String;)Ljava/lang/StringBuilder;";
        break;
      default:
        appendDesc = "(Ljava/lang/Object;)Ljava/lang/StringBuilder;";
        break;
    }

    const appendRef = writer.addMethodref("java/lang/StringBuilder", "append", appendDesc);
    method.emit(Opcode.INVOKEVIRTUAL);
    method.emitShort(appendRef);

    // append consumes the builder ref + the arg, returns builder ref
    stack.pop(typeSlotSize(partType)); // arg consumed
    // builder ref stays (consumed then returned -- net zero for the ref)
  }

  // toString
  const toStringRef = writer.addMethodref(
    "java/lang/StringBuilder",
    "toString",
    "()Ljava/lang/String;"
  );
  method.emit(Opcode.INVOKEVIRTUAL);
  method.emitShort(toStringRef);
  // Consumes StringBuilder ref, produces String ref: net zero change
}

function emitNewObject(ctx: EmitContext, expr: IRExpr & { kind: "NewObject" }): void {
  const { method, stack, writer } = ctx;

  const classIdx = writer.addClass(expr.className);
  method.emit(Opcode.NEW);
  method.emitShort(classIdx);
  stack.push(1);

  method.emit(Opcode.DUP);
  stack.push(1);

  for (const arg of expr.args) {
    emitExpr(ctx, arg);
  }

  const paramTypes = expr.args.map((a) => exprType(a));
  const desc = methodDescriptor(paramTypes, { kind: "TyVoid" });
  const initRef = writer.addMethodref(expr.className, "<init>", desc);
  method.emit(Opcode.INVOKESPECIAL);
  method.emitShort(initRef);

  // Pop the DUP'd ref and all args; the original ref remains
  stack.pop(1);
  for (const arg of expr.args) {
    stack.pop(typeSlotSize(exprType(arg)));
  }
}

function emitFieldGet(ctx: EmitContext, expr: IRExpr & { kind: "FieldGet" }): void {
  const { method, stack, writer } = ctx;
  const objType = exprType(expr.object);

  emitExpr(ctx, expr.object);

  if (objType.kind !== "TyObject") {
    throw new Error(`Emitter: FieldGet on non-object type '${objType.kind}'`);
  }

  const desc = typeToDescriptor(expr.type);
  const fieldRef = writer.addFieldref(objType.className, expr.fieldName, desc);
  method.emit(Opcode.GETFIELD);
  method.emitShort(fieldRef);
  stack.pop(1); // object ref
  stack.push(typeSlotSize(expr.type));
}

function emitFieldSet(ctx: EmitContext, expr: IRExpr & { kind: "FieldSet" }): void {
  const { method, stack, writer } = ctx;
  const objType = exprType(expr.object);
  const valType = exprType(expr.value);

  emitExpr(ctx, expr.object);
  emitExpr(ctx, expr.value);

  if (objType.kind !== "TyObject") {
    throw new Error(`Emitter: FieldSet on non-object type '${objType.kind}'`);
  }

  const desc = typeToDescriptor(valType);
  const fieldRef = writer.addFieldref(objType.className, expr.fieldName, desc);
  method.emit(Opcode.PUTFIELD);
  method.emitShort(fieldRef);
  stack.pop(1 + typeSlotSize(valType)); // object ref + value
}

function emitArrayNew(ctx: EmitContext, expr: IRExpr & { kind: "ArrayNew" }): void {
  const { method, stack, writer } = ctx;

  emitExpr(ctx, expr.size);

  switch (expr.elementType.kind) {
    case "TyBoolean":
      method.emit(Opcode.NEWARRAY); method.emitByte(4); break;
    case "TyInt":
      method.emit(Opcode.NEWARRAY); method.emitByte(10); break;
    case "TyFloat":
      method.emit(Opcode.NEWARRAY); method.emitByte(6); break;
    case "TyDouble":
      method.emit(Opcode.NEWARRAY); method.emitByte(7); break;
    case "TyLong":
      method.emit(Opcode.NEWARRAY); method.emitByte(11); break;
    default: {
      let internalName: string;
      if (expr.elementType.kind === "TyString") {
        internalName = "java/lang/String";
      } else if (expr.elementType.kind === "TyObject") {
        internalName = expr.elementType.className;
      } else {
        internalName = typeToDescriptor(expr.elementType);
      }
      const classIdx = writer.addClass(internalName);
      method.emit(Opcode.ANEWARRAY);
      method.emitShort(classIdx);
      break;
    }
  }
  // Size int consumed, array ref produced: net zero
}

function emitArrayGet(ctx: EmitContext, expr: IRExpr & { kind: "ArrayGet" }): void {
  const { method, stack } = ctx;

  emitExpr(ctx, expr.array);
  emitExpr(ctx, expr.index);

  switch (expr.type.kind) {
    case "TyInt": method.emit(Opcode.IALOAD); break;
    case "TyLong": method.emit(Opcode.LALOAD); break;
    case "TyFloat": method.emit(Opcode.FALOAD); break;
    case "TyDouble": method.emit(Opcode.DALOAD); break;
    case "TyBoolean": method.emit(Opcode.BALOAD); break;
    default: method.emit(Opcode.AALOAD); break;
  }

  stack.pop(2); // array ref + index
  stack.push(typeSlotSize(expr.type));
}

function emitArraySet(ctx: EmitContext, expr: IRExpr & { kind: "ArraySet" }): void {
  const { method, stack } = ctx;
  const valType = exprType(expr.value);

  emitExpr(ctx, expr.array);
  emitExpr(ctx, expr.index);
  emitExpr(ctx, expr.value);

  switch (valType.kind) {
    case "TyInt": method.emit(Opcode.IASTORE); break;
    case "TyLong": method.emit(Opcode.LASTORE); break;
    case "TyFloat": method.emit(Opcode.FASTORE); break;
    case "TyDouble": method.emit(Opcode.DASTORE); break;
    case "TyBoolean": method.emit(Opcode.BASTORE); break;
    default: method.emit(Opcode.AASTORE); break;
  }

  stack.pop(2 + typeSlotSize(valType)); // array ref + index + value
}

function emitCast(ctx: EmitContext, expr: IRExpr & { kind: "Cast" }): void {
  const { method, stack } = ctx;

  emitExpr(ctx, expr.expr);

  const from = expr.fromType.kind;
  const to = expr.toType.kind;

  if (from === to) return;

  const fromSize = typeSlotSize(expr.fromType);
  const toSize = typeSlotSize(expr.toType);

  if (from === "TyInt" && to === "TyDouble") { method.emit(Opcode.I2D); }
  else if (from === "TyInt" && to === "TyLong") { method.emit(Opcode.I2L); }
  else if (from === "TyInt" && to === "TyFloat") { method.emit(Opcode.I2F); }
  else if (from === "TyDouble" && to === "TyInt") { method.emit(Opcode.D2I); }
  else if (from === "TyDouble" && to === "TyLong") { method.emit(Opcode.D2L); }
  else if (from === "TyDouble" && to === "TyFloat") { method.emit(Opcode.D2F); }
  else if (from === "TyLong" && to === "TyInt") { method.emit(Opcode.L2I); }
  else if (from === "TyLong" && to === "TyDouble") { method.emit(Opcode.L2D); }
  else if (from === "TyLong" && to === "TyFloat") { method.emit(Opcode.L2F); }
  else if (from === "TyFloat" && to === "TyInt") { method.emit(Opcode.F2I); }
  else if (from === "TyFloat" && to === "TyDouble") { method.emit(Opcode.F2D); }
  else if (from === "TyFloat" && to === "TyLong") { method.emit(Opcode.F2L); }
  else if (isReferenceType(expr.fromType) && isReferenceType(expr.toType)) {
    let internalName: string;
    if (expr.toType.kind === "TyString") internalName = "java/lang/String";
    else if (expr.toType.kind === "TyObject") internalName = expr.toType.className;
    else internalName = typeToDescriptor(expr.toType);
    const classIdx = ctx.writer.addClass(internalName);
    method.emit(Opcode.CHECKCAST);
    method.emitShort(classIdx);
  }

  stack.pop(fromSize);
  stack.push(toSize);
}

/**
 * Emit an implicit type conversion between primitive numeric types.
 * This is used when a Java interop method returns one numeric type but
 * the TypeScript variable expects a different one (e.g., int -> double).
 */
function emitImplicitConversion(ctx: EmitContext, fromType: JvmType, toType: JvmType): void {
  if (fromType.kind === toType.kind) return;

  const { method, stack } = ctx;
  const fromSize = typeSlotSize(fromType);
  const toSize = typeSlotSize(toType);

  // Primitive numeric conversions
  if (fromType.kind === "TyInt" && toType.kind === "TyDouble") {
    method.emit(Opcode.I2D);
    stack.pop(fromSize); stack.push(toSize);
  } else if (fromType.kind === "TyInt" && toType.kind === "TyLong") {
    method.emit(Opcode.I2L);
    stack.pop(fromSize); stack.push(toSize);
  } else if (fromType.kind === "TyInt" && toType.kind === "TyFloat") {
    method.emit(Opcode.I2F);
    stack.pop(fromSize); stack.push(toSize);
  } else if (fromType.kind === "TyDouble" && toType.kind === "TyInt") {
    method.emit(Opcode.D2I);
    stack.pop(fromSize); stack.push(toSize);
  } else if (fromType.kind === "TyDouble" && toType.kind === "TyLong") {
    method.emit(Opcode.D2L);
    stack.pop(fromSize); stack.push(toSize);
  } else if (fromType.kind === "TyLong" && toType.kind === "TyDouble") {
    method.emit(Opcode.L2D);
    stack.pop(fromSize); stack.push(toSize);
  } else if (fromType.kind === "TyLong" && toType.kind === "TyInt") {
    method.emit(Opcode.L2I);
    stack.pop(fromSize); stack.push(toSize);
  } else if (fromType.kind === "TyFloat" && toType.kind === "TyDouble") {
    method.emit(Opcode.F2D);
    stack.pop(fromSize); stack.push(toSize);
  } else if (fromType.kind === "TyFloat" && toType.kind === "TyInt") {
    method.emit(Opcode.F2I);
    stack.pop(fromSize); stack.push(toSize);
  } else if (isReferenceType(fromType) && isReferenceType(toType)) {
    // Reference type cast: only emit CHECKCAST for downcasts (e.g., Object -> String)
    // Skip upcasts to java/lang/Object (always safe in the JVM)
    if (toType.kind === "TyObject" && toType.className === "java/lang/Object") {
      return; // Upcast to Object is implicit in the JVM
    }
    if (fromType.kind !== toType.kind ||
        (fromType.kind === "TyObject" && toType.kind === "TyObject" && fromType.className !== (toType as typeof fromType).className)) {
      let internalName: string;
      if (toType.kind === "TyString") internalName = "java/lang/String";
      else if (toType.kind === "TyObject") internalName = toType.className;
      else return; // No conversion needed
      const classIdx = ctx.writer.addClass(internalName);
      method.emit(Opcode.CHECKCAST);
      method.emitShort(classIdx);
    }
  }
  // For other mismatches (e.g., Object -> primitive), do nothing for now
}

function emitPropertyAccess(ctx: EmitContext, expr: IRExpr & { kind: "PropertyAccess" }): void {
  const { method, stack, writer } = ctx;
  const objType = exprType(expr.object);

  emitExpr(ctx, expr.object);

  // Special case: array.length
  if (expr.property === "length" && objType.kind === "TyArray") {
    method.emit(Opcode.ARRAYLENGTH);
    stack.pop(1);
    stack.push(1);
    return;
  }

  // Special case: string.length
  if (expr.property === "length" && objType.kind === "TyString") {
    const ref = writer.addMethodref("java/lang/String", "length", "()I");
    method.emit(Opcode.INVOKEVIRTUAL);
    method.emitShort(ref);
    stack.pop(1);
    // String.length() returns int, but TS types it as number (double) — convert
    method.emit(Opcode.I2D);
    stack.push(2);
    return;
  }

  if (objType.kind === "TyObject") {
    const desc = typeToDescriptor(expr.type);
    const fieldRef = writer.addFieldref(objType.className, expr.property, desc);
    method.emit(Opcode.GETFIELD);
    method.emitShort(fieldRef);
    stack.pop(1);
    stack.push(typeSlotSize(expr.type));
  } else {
    throw new Error(`Emitter: PropertyAccess on type '${objType.kind}' not supported`);
  }
}

function emitStaticFieldGet(ctx: EmitContext, expr: IRExpr & { kind: "StaticFieldGet" }): void {
  const { method, stack, writer } = ctx;
  const desc = typeToDescriptor(expr.type);
  const fieldRef = writer.addFieldref(expr.className, expr.fieldName, desc);
  method.emit(Opcode.GETSTATIC);
  method.emitShort(fieldRef);
  stack.push(typeSlotSize(expr.type));
}

// ---------------------------------------------------------------------------
// Spawn / Await / Channel emission (delegated to emit-concurrency)
// ---------------------------------------------------------------------------

function emitSpawn(ctx: EmitContext, expr: IRExpr & { kind: "Spawn" }): void {
  emitSpawnConcurrency(ctx, expr.call, expr.call.args, emitExpr, exprType);
}

function emitAwait(ctx: EmitContext, expr: IRExpr & { kind: "Await" }): void {
  emitAwaitConcurrency(ctx, expr.expr, expr.type, emitExpr);
}

function emitChannelSend(ctx: EmitContext, expr: IRExpr & { kind: "ChannelSend" }): void {
  emitChannelSendConcurrency(ctx, expr.channel, expr.value, emitExpr, exprType);
}

function emitChannelRecv(ctx: EmitContext, expr: IRExpr & { kind: "ChannelRecv" }): void {
  emitChannelRecvConcurrency(ctx, expr.channel, expr.type, emitExpr);
}

/**
 * Emit serve(port, handler) — creates an HttpServer.Handler inner class
 * that delegates to the named static handler function, then calls
 * HttpServer.serve(port, handler).
 *
 * The handler function must have signature: (Request) -> Response
 * i.e., static Response handlerName(HttpServer$Request req)
 */
function emitServe(ctx: EmitContext, expr: IRExpr & { kind: "Serve" }): void {
  const { method, stack, writer } = ctx;
  const handlerName = expr.handlerName;

  // Generate inner class implementing HttpServer.Handler
  const idx = ctx.spawnCounter.value++;
  const innerClassName = `${ctx.className}$Handler${idx}`;

  const icw = new ClassFileWriter();
  icw.setClass(ACC_PUBLIC | ACC_SUPER, innerClassName, "java/lang/Object");
  icw.addInterface("tyvm/runtime/HttpServer$Handler");

  // Constructor
  const initM = icw.addMethod(ACC_PUBLIC, "<init>", "()V");
  initM.emit(Opcode.ALOAD_0);
  const objInit = icw.addMethodref("java/lang/Object", "<init>", "()V");
  initM.emit(Opcode.INVOKESPECIAL);
  initM.emitShort(objInit);
  initM.emit(Opcode.RETURN);
  initM.maxStack = 1;
  initM.maxLocals = 1;

  // handle(Request) -> Response method — delegates to the static function
  const handleM = icw.addMethod(ACC_PUBLIC, "handle",
    "(Ltyvm/runtime/HttpServer$Request;)Ltyvm/runtime/HttpServer$Response;");
  handleM.emit(Opcode.ALOAD_1); // load Request arg
  const delegateRef = icw.addMethodref(ctx.className, handlerName,
    "(Ltyvm/runtime/HttpServer$Request;)Ltyvm/runtime/HttpServer$Response;");
  handleM.emit(Opcode.INVOKESTATIC);
  handleM.emitShort(delegateRef);
  handleM.emit(Opcode.ARETURN);
  handleM.maxStack = 2;
  handleM.maxLocals = 2;

  ctx.innerClasses.push({ className: innerClassName, bytes: icw.toBytes() });

  // Now emit: new Handler(), then HttpServer.serve(port, handler)
  // Push port
  emitExpr(ctx, expr.port);
  // Convert to int if it's double
  const portType = exprType(expr.port);
  if (portType.kind === "TyDouble") {
    method.emit(Opcode.D2I);
    stack.pop(1); // double is 2 slots, int is 1
  } else if (portType.kind === "TyLong") {
    method.emit(Opcode.L2I);
    stack.pop(1);
  }

  // new Handler()
  const classIdx = writer.addClass(innerClassName);
  method.emit(Opcode.NEW);
  method.emitShort(classIdx);
  stack.push(1);
  method.emit(Opcode.DUP);
  stack.push(1);
  const initRef = writer.addMethodref(innerClassName, "<init>", "()V");
  method.emit(Opcode.INVOKESPECIAL);
  method.emitShort(initRef);
  stack.pop(1);

  // Call HttpServer.serve(int, Handler) -> HttpServer
  const serveRef = writer.addMethodref(
    "tyvm/runtime/HttpServer", "serve",
    "(ILtyvm/runtime/HttpServer$Handler;)Ltyvm/runtime/HttpServer;");
  method.emit(Opcode.INVOKESTATIC);
  method.emitShort(serveRef);
  stack.pop(1); // consumes handler ref, port stays consumed, pushes HttpServer ref
}

function emitStmt(ctx: EmitContext, stmt: IRStmt): void {
  switch (stmt.kind) {
    case "ExprStmt":
      emitExprStmt(ctx, stmt);
      break;
    case "VarDecl":
      emitVarDecl(ctx, stmt);
      break;
    case "Return":
      emitReturn(ctx, stmt);
      break;
    case "If":
      emitIf(ctx, stmt);
      break;
    case "While":
      emitWhile(ctx, stmt);
      break;
    case "For":
      emitFor(ctx, stmt);
      break;
    case "Block":
      emitBlock(ctx, stmt);
      break;
  }
}

function emitExprStmt(ctx: EmitContext, stmt: IRStmt & { kind: "ExprStmt" }): void {
  const { method, stack } = ctx;
  emitExpr(ctx, stmt.expr);

  const resultType = exprType(stmt.expr);
  if (resultType.kind !== "TyVoid") {
    if (isCategory2(resultType)) {
      method.emit(Opcode.POP2);
      stack.pop(2);
    } else {
      method.emit(Opcode.POP);
      stack.pop(1);
    }
  }
}

function emitVarDecl(ctx: EmitContext, stmt: IRStmt & { kind: "VarDecl" }): void {
  const { method, stack, writer, className } = ctx;
  // Module-level globals → PUTSTATIC instead of local store
  if (ctx.moduleGlobals.has(stmt.name)) {
    if (stmt.init) {
      emitExpr(ctx, stmt.init);
      const initType = exprType(stmt.init);
      emitImplicitConversion(ctx, initType, stmt.type);
    } else {
      emitDefaultValue(ctx, stmt.type);
    }
    const desc = typeToDescriptor(stmt.type);
    const fieldRef = writer.addFieldref(className, stmt.name, desc);
    method.emit(Opcode.PUTSTATIC);
    method.emitShort(fieldRef);
    stack.pop(typeSlotSize(stmt.type));
    return;
  }

  const slot = ctx.locals.add(stmt.name, stmt.type);

  if (stmt.init) {
    emitExpr(ctx, stmt.init);
    // Insert implicit type conversion if the init expression's type differs from the var's type
    const initType = exprType(stmt.init);
    emitImplicitConversion(ctx, initType, stmt.type);
  } else {
    emitDefaultValue(ctx, stmt.type);
  }

  emitStore(ctx, slot, stmt.type);
}

function emitReturn(ctx: EmitContext, stmt: IRStmt & { kind: "Return" }): void {
  if (stmt.expr) {
    emitExpr(ctx, stmt.expr);
    emitReturnOpcode(ctx, exprType(stmt.expr));
  } else {
    ctx.method.emit(Opcode.RETURN);
  }
}

/**
 * Branch fusion: if the condition is a comparison BinaryOp, emit the operands
 * and a direct conditional branch instead of compare-to-boolean + IFEQ.
 * Returns true if fusion was applied.
 */
function tryEmitFusedBranch(
  ctx: EmitContext,
  condition: IRExpr,
  targetLabel: number,
  branchIfTrue: boolean,
): boolean {
  if (condition.kind !== "BinaryOp") return false;

  const { op, left, right } = condition;
  const leftType = exprType(left);

  // Int comparisons → use IF_ICMPxx
  if (leftType.kind === "TyInt" || leftType.kind === "TyBoolean") {
    if (op === "<" || op === ">" || op === "<=" || op === ">=" || op === "==" || op === "!=") {
      emitExpr(ctx, left);
      emitExpr(ctx, right);

      // Map: for "branch if condition is FALSE" (branchIfTrue=false),
      // we negate the comparison
      let branchOp: Opcode;
      if (branchIfTrue) {
        switch (op) {
          case "<":  branchOp = Opcode.IF_ICMPLT; break;
          case ">":  branchOp = Opcode.IF_ICMPGT; break;
          case "<=": branchOp = Opcode.IF_ICMPLE; break;
          case ">=": branchOp = Opcode.IF_ICMPGE; break;
          case "==": branchOp = Opcode.IF_ICMPEQ; break;
          case "!=": branchOp = Opcode.IF_ICMPNE; break;
          default: return false;
        }
      } else {
        // Negate: branch if NOT condition
        switch (op) {
          case "<":  branchOp = Opcode.IF_ICMPGE; break;
          case ">":  branchOp = Opcode.IF_ICMPLE; break;
          case "<=": branchOp = Opcode.IF_ICMPGT; break;
          case ">=": branchOp = Opcode.IF_ICMPLT; break;
          case "==": branchOp = Opcode.IF_ICMPNE; break;
          case "!=": branchOp = Opcode.IF_ICMPEQ; break;
          default: return false;
        }
      }

      ctx.method.emitJump(branchOp, targetLabel);
      ctx.stack.pop(2);
      return true;
    }
  }

  // Long comparisons → use LCMP + IFxx
  if (leftType.kind === "TyLong") {
    if (op === "<" || op === ">" || op === "<=" || op === ">=" || op === "==" || op === "!=") {
      emitExpr(ctx, left);
      emitExpr(ctx, right);

      ctx.method.emit(Opcode.LCMP);
      ctx.stack.pop(4); ctx.stack.push(1);

      let branchOp: Opcode;
      if (branchIfTrue) {
        switch (op) {
          case "<":  branchOp = Opcode.IFLT; break;
          case ">":  branchOp = Opcode.IFGT; break;
          case "<=": branchOp = Opcode.IFLE; break;
          case ">=": branchOp = Opcode.IFGE; break;
          case "==": branchOp = Opcode.IFEQ; break;
          case "!=": branchOp = Opcode.IFNE; break;
          default: return false;
        }
      } else {
        switch (op) {
          case "<":  branchOp = Opcode.IFGE; break;
          case ">":  branchOp = Opcode.IFLE; break;
          case "<=": branchOp = Opcode.IFGT; break;
          case ">=": branchOp = Opcode.IFLT; break;
          case "==": branchOp = Opcode.IFNE; break;
          case "!=": branchOp = Opcode.IFEQ; break;
          default: return false;
        }
      }

      ctx.method.emitJump(branchOp, targetLabel);
      ctx.stack.pop(1);
      return true;
    }
  }

  // Double comparisons → use DCMPL/DCMPG + IFxx
  if (leftType.kind === "TyDouble") {
    if (op === "<" || op === ">" || op === "<=" || op === ">=" || op === "==" || op === "!=") {
      emitExpr(ctx, left);
      emitExpr(ctx, right);

      let cmpOp: Opcode;
      let branchOp: Opcode;

      if (branchIfTrue) {
        switch (op) {
          case "<":  cmpOp = Opcode.DCMPG; branchOp = Opcode.IFLT; break;
          case ">":  cmpOp = Opcode.DCMPL; branchOp = Opcode.IFGT; break;
          case "<=": cmpOp = Opcode.DCMPG; branchOp = Opcode.IFLE; break;
          case ">=": cmpOp = Opcode.DCMPL; branchOp = Opcode.IFGE; break;
          case "==": cmpOp = Opcode.DCMPL; branchOp = Opcode.IFEQ; break;
          case "!=": cmpOp = Opcode.DCMPL; branchOp = Opcode.IFNE; break;
          default: return false;
        }
      } else {
        switch (op) {
          case "<":  cmpOp = Opcode.DCMPG; branchOp = Opcode.IFGE; break;
          case ">":  cmpOp = Opcode.DCMPL; branchOp = Opcode.IFLE; break;
          case "<=": cmpOp = Opcode.DCMPG; branchOp = Opcode.IFGT; break;
          case ">=": cmpOp = Opcode.DCMPL; branchOp = Opcode.IFLT; break;
          case "==": cmpOp = Opcode.DCMPL; branchOp = Opcode.IFNE; break;
          case "!=": cmpOp = Opcode.DCMPL; branchOp = Opcode.IFEQ; break;
          default: return false;
        }
      }

      ctx.method.emit(cmpOp);
      ctx.stack.pop(4); ctx.stack.push(1);
      ctx.method.emitJump(branchOp, targetLabel);
      ctx.stack.pop(1);
      return true;
    }
  }

  return false;
}

/** Emit condition and branch-if-false to the given label. */
function emitConditionBranchIfFalse(ctx: EmitContext, condition: IRExpr, falseLabel: number): void {
  // Try fused branch first
  if (tryEmitFusedBranch(ctx, condition, falseLabel, false)) return;

  // Fallback: emit condition as boolean, then IFEQ
  const { method, stack } = ctx;
  const condType = exprType(condition);
  emitExpr(ctx, condition);

  if (condType.kind === "TyDouble") {
    method.emit(Opcode.DCONST_0);
    stack.push(2);
    method.emit(Opcode.DCMPG);
    stack.pop(4); stack.push(1);
  }

  method.emitJump(Opcode.IFEQ, falseLabel);
  stack.pop(1);
}

function emitIf(ctx: EmitContext, stmt: IRStmt & { kind: "If" }): void {
  const { method } = ctx;

  if (stmt.elseBlock) {
    const elseLabel = method.label();
    const endLabel = method.label();

    emitConditionBranchIfFalse(ctx, stmt.condition, elseLabel);
    emitBlock(ctx, stmt.thenBlock);
    method.emitJump(Opcode.GOTO, endLabel);
    method.placeLabel(elseLabel);
    emitBlock(ctx, stmt.elseBlock);
    method.placeLabel(endLabel);
  } else {
    const endLabel = method.label();

    emitConditionBranchIfFalse(ctx, stmt.condition, endLabel);
    emitBlock(ctx, stmt.thenBlock);
    method.placeLabel(endLabel);
  }
}

function emitWhile(ctx: EmitContext, stmt: IRStmt & { kind: "While" }): void {
  const { method } = ctx;
  const loopLabel = method.label();
  const endLabel = method.label();

  method.placeLabel(loopLabel);
  emitConditionBranchIfFalse(ctx, stmt.condition, endLabel);
  emitBlock(ctx, stmt.body);
  method.emitJump(Opcode.GOTO, loopLabel);
  method.placeLabel(endLabel);
}

function emitFor(ctx: EmitContext, stmt: IRStmt & { kind: "For" }): void {
  const { method, stack } = ctx;

  if (stmt.init) {
    emitStmt(ctx, stmt.init);
  }

  const loopLabel = method.label();
  const endLabel = method.label();

  method.placeLabel(loopLabel);

  if (stmt.condition) {
    emitConditionBranchIfFalse(ctx, stmt.condition, endLabel);
  }

  emitBlock(ctx, stmt.body);

  if (stmt.update) {
    emitExpr(ctx, stmt.update);
    const updateType = exprType(stmt.update);
    if (updateType.kind !== "TyVoid") {
      if (isCategory2(updateType)) {
        method.emit(Opcode.POP2);
        stack.pop(2);
      } else {
        method.emit(Opcode.POP);
        stack.pop(1);
      }
    }
  }

  method.emitJump(Opcode.GOTO, loopLabel);
  method.placeLabel(endLabel);
}

function emitBlock(ctx: EmitContext, block: Block): void {
  for (const stmt of block.stmts) {
    emitStmt(ctx, stmt);
  }
}

// ---------------------------------------------------------------------------
// Function / Module emission
// ---------------------------------------------------------------------------

function emitFunction(
  writer: ClassFileWriter,
  className: string,
  func: FunctionDef,
  moduleFunctions: Map<string, FunctionDef>,
  innerClasses: EmitResult[],
  spawnCounter: { value: number },
  methodName?: string,
  moduleGlobals?: Map<string, JvmType>,
): void {
  const name = methodName ?? func.name;
  const accessFlags = ACC_PUBLIC | ACC_STATIC;

  const paramTypes = func.params.map((p) => p.type);
  const desc = methodDescriptor(paramTypes, func.returnType);

  const method = writer.addMethod(accessFlags, name, desc);
  const locals = new LocalScope();
  const stack = new StackTracker();

  for (const param of func.params) {
    locals.add(param.name, param.type);
  }

  const ctx: EmitContext = {
    writer,
    method,
    locals,
    stack,
    className,
    moduleFunctions,
    innerClasses,
    spawnCounter,
    moduleGlobals: moduleGlobals ?? new Map(),
  };

  emitBlock(ctx, func.body);

  // Ensure method ends with a return instruction
  if (!endsWithReturn(func.body)) {
    if (func.returnType.kind === "TyVoid") {
      method.emit(Opcode.RETURN);
    } else {
      emitDefaultValue(ctx, func.returnType);
      emitReturnOpcode(ctx, func.returnType);
    }
  }

  method.maxStack = Math.max(stack.getMax(), 1);
  method.maxLocals = Math.max(locals.getMaxLocals(), 1);
}

function endsWithReturn(block: Block): boolean {
  if (block.stmts.length === 0) return false;
  const last = block.stmts[block.stmts.length - 1];
  if (last.kind === "Return") return true;
  if (last.kind === "Block") return endsWithReturn(last);
  if (last.kind === "If" && last.elseBlock) {
    return endsWithReturn(last.thenBlock) && endsWithReturn(last.elseBlock);
  }
  return false;
}

function isJvmMainSignature(func: FunctionDef): boolean {
  if (func.name !== "main") return false;
  if (func.params.length === 1) {
    const p = func.params[0];
    if (
      p.name === "args" &&
      p.type.kind === "TyArray" &&
      p.type.elementType.kind === "TyString"
    ) {
      return func.returnType.kind === "TyVoid";
    }
  }
  return false;
}

function needsMainWrapper(func: FunctionDef): boolean {
  if (func.name !== "main") return false;
  if (isJvmMainSignature(func)) return false;
  if (func.params.length === 0) {
    return (
      func.returnType.kind === "TyVoid" ||
      func.returnType.kind === "TyInt" ||
      func.returnType.kind === "TyDouble"
    );
  }
  return false;
}

function emitMainWrapper(
  writer: ClassFileWriter,
  className: string,
  func: FunctionDef,
): void {
  const method = writer.addMethod(
    ACC_PUBLIC | ACC_STATIC,
    "main",
    "([Ljava/lang/String;)V",
  );

  const implDesc = methodDescriptor([], func.returnType);
  const implRef = writer.addMethodref(className, "main$impl", implDesc);

  method.emit(Opcode.INVOKESTATIC);
  method.emitShort(implRef);

  if (func.returnType.kind !== "TyVoid") {
    if (isCategory2(func.returnType)) {
      method.emit(Opcode.POP2);
    } else {
      method.emit(Opcode.POP);
    }
  }

  method.emit(Opcode.RETURN);

  method.maxStack = Math.max(typeSlotSize(func.returnType), 1);
  method.maxLocals = 1; // args parameter occupies slot 0
}

/**
 * Walk an IR block and patch LoadLocal/StoreLocal/BinaryOp types to match
 * the actual module global types (which may have been int-promoted).
 */
function fixupGlobalTypes(block: Block, globals: Map<string, JvmType>): void {
  for (const stmt of block.stmts) {
    fixupStmtGlobalTypes(stmt, globals);
  }
}

function fixupStmtGlobalTypes(stmt: IRStmt, globals: Map<string, JvmType>): void {
  switch (stmt.kind) {
    case "ExprStmt":
      fixupExprGlobalTypes(stmt.expr, globals);
      break;
    case "VarDecl":
      if (stmt.init) fixupExprGlobalTypes(stmt.init, globals);
      break;
    case "Return":
      if (stmt.expr) fixupExprGlobalTypes(stmt.expr, globals);
      break;
    case "If":
      fixupExprGlobalTypes(stmt.condition, globals);
      fixupGlobalTypes(stmt.thenBlock, globals);
      if (stmt.elseBlock) fixupGlobalTypes(stmt.elseBlock, globals);
      break;
    case "While":
      fixupExprGlobalTypes(stmt.condition, globals);
      fixupGlobalTypes(stmt.body, globals);
      break;
    case "For":
      if (stmt.init) fixupStmtGlobalTypes(stmt.init as IRStmt, globals);
      if (stmt.condition) fixupExprGlobalTypes(stmt.condition, globals);
      if (stmt.update) fixupExprGlobalTypes(stmt.update, globals);
      fixupGlobalTypes(stmt.body, globals);
      break;
    case "Block":
      fixupGlobalTypes(stmt, globals);
      break;
  }
}

function fixupExprGlobalTypes(expr: IRExpr, globals: Map<string, JvmType>): void {
  switch (expr.kind) {
    case "LoadLocal": {
      const gt = globals.get(expr.name);
      if (gt) (expr as any).type = gt;
      break;
    }
    case "StoreLocal": {
      const gt = globals.get(expr.name);
      if (gt) (expr as any).type = gt;
      fixupExprGlobalTypes(expr.value, globals);
      break;
    }
    case "BinaryOp":
      fixupExprGlobalTypes(expr.left, globals);
      fixupExprGlobalTypes(expr.right, globals);
      // If both sides are now int, the result should be int too (for arithmetic)
      if (exprType(expr.left).kind === "TyInt" && exprType(expr.right).kind === "TyInt") {
        if (expr.type.kind === "TyDouble") (expr as any).type = { kind: "TyInt" };
      }
      break;
    case "UnaryOp":
      fixupExprGlobalTypes(expr.operand, globals);
      break;
    case "Call":
      for (const arg of expr.args) fixupExprGlobalTypes(arg, globals);
      break;
    case "Const":
    case "NewObject":
    case "ArrayNew":
    case "ArrayGet":
    case "ArraySet":
    case "FieldGet":
    case "FieldSet":
    case "PropertyAccess":
    case "StaticFieldGet":
    case "Cast":
    case "StringConcat":
    case "Spawn":
    case "Await":
    case "ChannelSend":
    case "ChannelRecv":
    case "Serve":
      break;
  }
}

function emitModule(module: IRModule): EmitResult[] {
  const writer = new ClassFileWriter();
  const className = module.name;

  writer.setClass(ACC_PUBLIC | ACC_SUPER | ACC_FINAL, className, "java/lang/Object");

  const moduleFunctions = new Map<string, FunctionDef>();
  for (const func of module.functions) {
    moduleFunctions.set(func.name, func);
  }

  // Collect module-level variables from all main functions' bodies and declare
  // them as static fields so they are accessible from all functions.
  // The synthetic main wraps top-level statements (variable declarations, serve() calls, etc.).
  const moduleGlobals = new Map<string, JvmType>();
  for (const func of module.functions) {
    if (func.name !== "main") continue;
    for (const stmt of func.body.stmts) {
      if (stmt.kind === "VarDecl" && !moduleGlobals.has(stmt.name)) {
        // Module globals are accessed from multiple functions/class methods.
        // Keep numeric types as TyDouble to avoid int-promotion mismatches
        // across function boundaries.
        let fieldType = stmt.type;
        if (fieldType.kind === "TyInt") {
          fieldType = { kind: "TyDouble" };
          stmt.type = fieldType;
        }
        moduleGlobals.set(stmt.name, fieldType);
        const desc = typeToDescriptor(fieldType);
        writer.addField(ACC_STATIC, stmt.name, desc);
      }
    }
  }

  // No type fixup needed — module globals keep their declared type (TyDouble
  // for numeric vars) and are excluded from int promotion to avoid cross-function
  // type mismatches.

  const innerClasses: EmitResult[] = [];
  const spawnCounter = { value: 0 };

  for (const func of module.functions) {
    if (needsMainWrapper(func)) {
      emitFunction(writer, className, func, moduleFunctions, innerClasses, spawnCounter, "main$impl", moduleGlobals);
      emitMainWrapper(writer, className, func);
    } else {
      emitFunction(writer, className, func, moduleFunctions, innerClasses, spawnCounter, undefined, moduleGlobals);
    }
  }

  for (const classDef of module.classes) {
    for (const methodDef of classDef.methods) {
      emitFunction(writer, className, methodDef, moduleFunctions, innerClasses, spawnCounter, undefined, moduleGlobals);
    }
  }

  return [
    { className, bytes: writer.toBytes() },
    ...innerClasses,
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function emit(module: IRModule): EmitResult[] {
  return emitModule(module);
}
