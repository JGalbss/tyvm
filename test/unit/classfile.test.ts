import { describe, it, expect } from "vitest";
import { ClassFileWriter, ACC_PUBLIC, ACC_SUPER, ACC_STATIC } from "../../src/backend/classfile.js";
import { Opcode } from "../../src/backend/opcodes.js";

describe("ClassFileWriter", () => {
  it("produces valid class file magic number", () => {
    const writer = new ClassFileWriter();
    writer.setClass(ACC_PUBLIC | ACC_SUPER, "Test", "java/lang/Object");

    const bytes = writer.toBytes();

    // CAFEBABE magic
    expect(bytes[0]).toBe(0xca);
    expect(bytes[1]).toBe(0xfe);
    expect(bytes[2]).toBe(0xba);
    expect(bytes[3]).toBe(0xbe);
  });

  it("produces correct version numbers", () => {
    const writer = new ClassFileWriter();
    writer.setClass(ACC_PUBLIC | ACC_SUPER, "Test", "java/lang/Object");

    const bytes = writer.toBytes();

    // Minor version (0)
    expect(bytes[4]).toBe(0);
    expect(bytes[5]).toBe(0);
    // Major version (49 = Java 5, no StackMapTable required)
    expect(bytes[6]).toBe(0);
    expect(bytes[7]).toBe(49);
  });

  it("deduplicates constant pool entries", () => {
    const writer = new ClassFileWriter();
    writer.setClass(ACC_PUBLIC | ACC_SUPER, "Test", "java/lang/Object");

    const idx1 = writer.addUtf8("hello");
    const idx2 = writer.addUtf8("hello");

    expect(idx1).toBe(idx2);
  });

  it("handles double constants taking two pool slots", () => {
    const writer = new ClassFileWriter();
    writer.setClass(ACC_PUBLIC | ACC_SUPER, "Test", "java/lang/Object");

    const idx = writer.addDouble(3.14);
    // Next entry should skip a slot (doubles take 2 slots)
    const nextIdx = writer.addUtf8("next");
    expect(nextIdx).toBe(idx + 2);
  });

  it("can add a method with bytecode", () => {
    const writer = new ClassFileWriter();
    writer.setClass(ACC_PUBLIC | ACC_SUPER, "Test", "java/lang/Object");

    const method = writer.addMethod(
      ACC_PUBLIC | ACC_STATIC,
      "test",
      "()V",
    );
    method.emit(Opcode.RETURN);
    method.maxStack = 1;
    method.maxLocals = 1;

    const bytes = writer.toBytes();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("resolves forward jump labels", () => {
    const writer = new ClassFileWriter();
    writer.setClass(ACC_PUBLIC | ACC_SUPER, "Test", "java/lang/Object");

    const method = writer.addMethod(
      ACC_PUBLIC | ACC_STATIC,
      "test",
      "()V",
    );

    const endLabel = method.label();
    method.emitJump(Opcode.GOTO, endLabel);
    method.emit(Opcode.NOP);
    method.placeLabel(endLabel);
    method.emit(Opcode.RETURN);

    const bytecode = method.getBytecode();
    // GOTO(3 bytes) + NOP(1 byte) + RETURN(1 byte) = 5 bytes
    expect(bytecode.length).toBe(5);

    // GOTO offset should be 4 (jump over the 3-byte GOTO instruction + 1 NOP)
    // GOTO is at offset 0, target is at offset 4
    // Relative offset = 4 - 0 = 4
    expect(bytecode[1]).toBe(0); // high byte
    expect(bytecode[2]).toBe(4); // low byte
  });
});
