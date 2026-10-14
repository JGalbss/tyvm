/**
 * Concurrency Bytecode Emission
 *
 * Handles spawn, await, and channel operations by generating inner classes
 * that implement java.util.concurrent.Callable and emitting the bytecode
 * for Task/Channel runtime interactions.
 */

import {
  ClassFileWriter,
  MethodBuilder,
  ACC_PUBLIC,
  ACC_PRIVATE,
  ACC_FINAL,
  ACC_SUPER,
} from "./classfile.js";
import { Opcode } from "./opcodes.js";
import { typeToDescriptor, methodDescriptor, typeSlotSize } from "./descriptors.js";
import type { JvmType, Call, IRExpr } from "../ir/nodes.js";
import type { EmitResult, EmitContext } from "./emitter.js";

// ---------------------------------------------------------------------------
// Boxing / Unboxing helpers
// ---------------------------------------------------------------------------

/** Map a primitive type to its box class and valueOf descriptor. */
function boxInfo(type: JvmType): { className: string; desc: string } | undefined {
  switch (type.kind) {
    case "TyDouble":  return { className: "java/lang/Double",  desc: "(D)Ljava/lang/Double;" };
    case "TyFloat":   return { className: "java/lang/Float",   desc: "(F)Ljava/lang/Float;" };
    case "TyLong":    return { className: "java/lang/Long",    desc: "(J)Ljava/lang/Long;" };
    case "TyInt":     return { className: "java/lang/Integer", desc: "(I)Ljava/lang/Integer;" };
    case "TyBoolean": return { className: "java/lang/Boolean", desc: "(Z)Ljava/lang/Boolean;" };
    default:          return undefined;
  }
}

/** Emit boxing instructions for a primitive return value in Callable.call(). */
function emitBoxForCallable(cw: ClassFileWriter, method: MethodBuilder, type: JvmType): void {
  const info = boxInfo(type);
  if (info) {
    const ref = cw.addMethodref(info.className, "valueOf", info.desc);
    method.emit(Opcode.INVOKESTATIC);
    method.emitShort(ref);
  } else if (type.kind === "TyVoid") {
    method.emit(Opcode.ACONST_NULL);
  }
  // Reference types need no boxing
}

/** Box a primitive value on the stack to its wrapper type. */
export function emitBoxIfNeeded(ctx: EmitContext, type: JvmType): void {
  const { method, stack, writer } = ctx;
  const info = boxInfo(type);
  if (!info) return;

  const ref = writer.addMethodref(info.className, "valueOf", info.desc);
  method.emit(Opcode.INVOKESTATIC);
  method.emitShort(ref);

  const fromSize = typeSlotSize(type);
  if (fromSize === 2) {
    stack.pop(2);
    stack.push(1);
  }
  // For 1-slot types, net is zero (1 in, 1 out)
}

/** Unbox an Object on the stack to the expected primitive type. */
export function emitUnbox(ctx: EmitContext, type: JvmType): void {
  const { method, stack, writer } = ctx;
  switch (type.kind) {
    case "TyDouble": {
      const ref = writer.addMethodref("tyvm/runtime/Rt", "toDouble", "(Ljava/lang/Object;)D");
      method.emit(Opcode.INVOKESTATIC);
      method.emitShort(ref);
      stack.pop(1);
      stack.push(2);
      break;
    }
    case "TyLong": {
      const ref = writer.addMethodref("tyvm/runtime/Rt", "toLong", "(Ljava/lang/Object;)J");
      method.emit(Opcode.INVOKESTATIC);
      method.emitShort(ref);
      stack.pop(1);
      stack.push(2);
      break;
    }
    case "TyBoolean": {
      const ref = writer.addMethodref("tyvm/runtime/Rt", "toBoolean", "(Ljava/lang/Object;)Z");
      method.emit(Opcode.INVOKESTATIC);
      method.emitShort(ref);
      break;
    }
    case "TyInt": {
      const castRef = writer.addClass("java/lang/Number");
      method.emit(Opcode.CHECKCAST);
      method.emitShort(castRef);
      const intValRef = writer.addMethodref("java/lang/Number", "intValue", "()I");
      method.emit(Opcode.INVOKEVIRTUAL);
      method.emitShort(intValRef);
      break;
    }
    case "TyFloat": {
      const castRef = writer.addClass("java/lang/Number");
      method.emit(Opcode.CHECKCAST);
      method.emitShort(castRef);
      const floatValRef = writer.addMethodref("java/lang/Number", "floatValue", "()F");
      method.emit(Opcode.INVOKEVIRTUAL);
      method.emitShort(floatValRef);
      break;
    }
    case "TyString": {
      const castRef = writer.addClass("java/lang/String");
      method.emit(Opcode.CHECKCAST);
      method.emitShort(castRef);
      break;
    }
    case "TyVoid":
      method.emit(Opcode.POP);
      stack.pop(1);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Inner class generation for spawn
// ---------------------------------------------------------------------------

/** Emit a load instruction directly into a MethodBuilder (no EmitContext needed). */
function emitRawLoad(method: MethodBuilder, slot: number, type: JvmType): void {
  switch (type.kind) {
    case "TyDouble":
      if (slot <= 3) method.emit(Opcode.DLOAD_0 + slot);
      else { method.emit(Opcode.DLOAD); method.emitByte(slot); }
      break;
    case "TyLong":
      if (slot <= 3) method.emit(Opcode.LLOAD_0 + slot);
      else { method.emit(Opcode.LLOAD); method.emitByte(slot); }
      break;
    case "TyFloat":
      if (slot <= 3) method.emit(Opcode.FLOAD_0 + slot);
      else { method.emit(Opcode.FLOAD); method.emitByte(slot); }
      break;
    case "TyInt":
    case "TyBoolean":
      if (slot <= 3) method.emit(Opcode.ILOAD_0 + slot);
      else { method.emit(Opcode.ILOAD); method.emitByte(slot); }
      break;
    default:
      if (slot <= 3) method.emit(Opcode.ALOAD_0 + slot);
      else { method.emit(Opcode.ALOAD); method.emitByte(slot); }
      break;
  }
}

/**
 * Generate an inner class that implements java.util.concurrent.Callable.
 * Captures the arguments to the spawned call as fields, and its call()
 * method invokes the target with those captured args.
 */
export function generateCallableInnerClass(
  ctx: EmitContext,
  spawnCall: Call,
  exprTypeFn: (expr: IRExpr) => JvmType,
): string {
  const idx = ctx.spawnCounter.value++;
  const innerClassName = `${ctx.className}$Task${idx}`;

  const cw = new ClassFileWriter();
  cw.setClass(ACC_PUBLIC | ACC_SUPER, innerClassName, "java/lang/Object");
  cw.addInterface("java/util/concurrent/Callable");

  const argTypes = spawnCall.args.map(exprTypeFn);

  // Fields for each captured argument
  for (let i = 0; i < argTypes.length; i++) {
    cw.addField(ACC_PRIVATE | ACC_FINAL, `arg${i}`, typeToDescriptor(argTypes[i]));
  }

  // Constructor
  emitCallableConstructor(cw, innerClassName, argTypes);

  // call() method
  emitCallableCallMethod(cw, innerClassName, argTypes, spawnCall);

  ctx.innerClasses.push({ className: innerClassName, bytes: cw.toBytes() });
  return innerClassName;
}

function emitCallableConstructor(
  cw: ClassFileWriter,
  innerClassName: string,
  argTypes: JvmType[],
): void {
  const paramDescs = argTypes.map(typeToDescriptor).join("");
  const initMethod = cw.addMethod(ACC_PUBLIC, "<init>", `(${paramDescs})V`);

  initMethod.emit(Opcode.ALOAD_0);
  const objectInitRef = cw.addMethodref("java/lang/Object", "<init>", "()V");
  initMethod.emit(Opcode.INVOKESPECIAL);
  initMethod.emitShort(objectInitRef);

  let paramSlot = 1;
  for (let i = 0; i < argTypes.length; i++) {
    const fieldRef = cw.addFieldref(innerClassName, `arg${i}`, typeToDescriptor(argTypes[i]));
    initMethod.emit(Opcode.ALOAD_0);
    emitRawLoad(initMethod, paramSlot, argTypes[i]);
    initMethod.emit(Opcode.PUTFIELD);
    initMethod.emitShort(fieldRef);
    paramSlot += typeSlotSize(argTypes[i]);
  }

  initMethod.emit(Opcode.RETURN);
  initMethod.maxStack = Math.max(3, argTypes.reduce((acc, t) => acc + typeSlotSize(t), 0) + 1);
  initMethod.maxLocals = paramSlot;
}

function emitCallableCallMethod(
  cw: ClassFileWriter,
  innerClassName: string,
  argTypes: JvmType[],
  spawnCall: Call,
): void {
  const callMethod = cw.addMethod(ACC_PUBLIC, "call", "()Ljava/lang/Object;");

  for (let i = 0; i < argTypes.length; i++) {
    const fieldRef = cw.addFieldref(innerClassName, `arg${i}`, typeToDescriptor(argTypes[i]));
    callMethod.emit(Opcode.ALOAD_0);
    callMethod.emit(Opcode.GETFIELD);
    callMethod.emitShort(fieldRef);
  }

  const desc = methodDescriptor(argTypes, spawnCall.returnType);
  const methodRef = cw.addMethodref(spawnCall.className, spawnCall.target, desc);
  callMethod.emit(Opcode.INVOKESTATIC);
  callMethod.emitShort(methodRef);

  emitBoxForCallable(cw, callMethod, spawnCall.returnType);
  callMethod.emit(Opcode.ARETURN);

  const argSlots = argTypes.reduce((acc, t) => acc + typeSlotSize(t), 0);
  callMethod.maxStack = Math.max(argSlots + 4, 4);
  callMethod.maxLocals = Math.max(argSlots + 2, 2);
}

// ---------------------------------------------------------------------------
// Spawn / Await / Channel emission
// ---------------------------------------------------------------------------

export function emitSpawn(
  ctx: EmitContext,
  spawnCall: Call,
  spawnArgs: IRExpr[],
  emitExprFn: (ctx: EmitContext, expr: IRExpr) => void,
  exprTypeFn: (expr: IRExpr) => JvmType,
): void {
  const { method, stack, writer } = ctx;

  const innerClassName = generateCallableInnerClass(ctx, spawnCall, exprTypeFn);

  const classIdx = writer.addClass(innerClassName);
  method.emit(Opcode.NEW);
  method.emitShort(classIdx);
  stack.push(1);

  method.emit(Opcode.DUP);
  stack.push(1);

  for (const arg of spawnArgs) {
    emitExprFn(ctx, arg);
  }

  const argTypes = spawnArgs.map(exprTypeFn);
  const paramDescs = argTypes.map(typeToDescriptor).join("");
  const initRef = writer.addMethodref(innerClassName, "<init>", `(${paramDescs})V`);
  method.emit(Opcode.INVOKESPECIAL);
  method.emitShort(initRef);

  stack.pop(1); // DUP'd ref
  for (const arg of spawnArgs) {
    stack.pop(typeSlotSize(exprTypeFn(arg)));
  }

  const spawnRef = writer.addMethodref(
    "tyvm/runtime/Task",
    "spawn",
    "(Ljava/util/concurrent/Callable;)Ltyvm/runtime/Task;",
  );
  method.emit(Opcode.INVOKESTATIC);
  method.emitShort(spawnRef);
}

export function emitAwait(ctx: EmitContext, taskExpr: IRExpr, resultType: JvmType, emitExprFn: (ctx: EmitContext, expr: IRExpr) => void): void {
  const { method, stack, writer } = ctx;

  emitExprFn(ctx, taskExpr);

  const awaitRef = writer.addMethodref("tyvm/runtime/Task", "await", "()Ljava/lang/Object;");
  method.emit(Opcode.INVOKEVIRTUAL);
  method.emitShort(awaitRef);

  emitUnbox(ctx, resultType);
}

export function emitChannelSend(
  ctx: EmitContext,
  channelExpr: IRExpr,
  valueExpr: IRExpr,
  emitExprFn: (ctx: EmitContext, expr: IRExpr) => void,
  exprTypeFn: (expr: IRExpr) => JvmType,
): void {
  const { method, stack, writer } = ctx;

  emitExprFn(ctx, channelExpr);
  emitExprFn(ctx, valueExpr);
  emitBoxIfNeeded(ctx, exprTypeFn(valueExpr));

  const sendRef = writer.addMethodref("tyvm/runtime/Channel", "send", "(Ljava/lang/Object;)V");
  method.emit(Opcode.INVOKEVIRTUAL);
  method.emitShort(sendRef);
  stack.pop(2);
}

export function emitChannelRecv(
  ctx: EmitContext,
  channelExpr: IRExpr,
  resultType: JvmType,
  emitExprFn: (ctx: EmitContext, expr: IRExpr) => void,
): void {
  const { method, writer } = ctx;

  emitExprFn(ctx, channelExpr);

  const recvRef = writer.addMethodref("tyvm/runtime/Channel", "recv", "()Ljava/lang/Object;");
  method.emit(Opcode.INVOKEVIRTUAL);
  method.emitShort(recvRef);

  emitUnbox(ctx, resultType);
}
