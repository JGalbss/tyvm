// ============================================================================
// JVM Class File Writer
//
// Produces valid JVM .class files as Uint8Array buffers.
// Targets class file version 49 (Java 5) to avoid StackMapTable requirement.
// ============================================================================

import { Opcode } from "./opcodes.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLASS_MAGIC = 0xcafebabe;
const CLASS_MAJOR_VERSION = 49;
const CLASS_MINOR_VERSION = 0;

// Constant pool tags
const CONSTANT_Utf8 = 1;
const CONSTANT_Integer = 3;
const CONSTANT_Float = 4;
const CONSTANT_Long = 5;
const CONSTANT_Double = 6;
const CONSTANT_Class = 7;
const CONSTANT_String = 8;
const CONSTANT_Fieldref = 9;
const CONSTANT_Methodref = 10;
const CONSTANT_InterfaceMethodref = 11;
const CONSTANT_NameAndType = 12;
const CONSTANT_MethodHandle = 15;
const CONSTANT_MethodType = 16;
const CONSTANT_InvokeDynamic = 18;

// Access flags
export const ACC_PUBLIC = 0x0001;
export const ACC_PRIVATE = 0x0002;
export const ACC_PROTECTED = 0x0004;
export const ACC_STATIC = 0x0008;
export const ACC_FINAL = 0x0010;
export const ACC_SUPER = 0x0020;
export const ACC_SYNCHRONIZED = 0x0020; // same bit, for methods
export const ACC_ABSTRACT = 0x0400;

// ---------------------------------------------------------------------------
// Constant Pool Entry types
// ---------------------------------------------------------------------------

type CpEntry =
  | { tag: typeof CONSTANT_Utf8; value: string }
  | { tag: typeof CONSTANT_Integer; value: number }
  | { tag: typeof CONSTANT_Float; value: number }
  | { tag: typeof CONSTANT_Long; value: bigint }
  | { tag: typeof CONSTANT_Double; value: number }
  | { tag: typeof CONSTANT_Class; nameIndex: number }
  | { tag: typeof CONSTANT_String; stringIndex: number }
  | { tag: typeof CONSTANT_Fieldref; classIndex: number; natIndex: number }
  | { tag: typeof CONSTANT_Methodref; classIndex: number; natIndex: number }
  | { tag: typeof CONSTANT_InterfaceMethodref; classIndex: number; natIndex: number }
  | { tag: typeof CONSTANT_NameAndType; nameIndex: number; descriptorIndex: number }
  | { tag: typeof CONSTANT_MethodHandle; referenceKind: number; referenceIndex: number }
  | { tag: typeof CONSTANT_MethodType; descriptorIndex: number }
  | { tag: typeof CONSTANT_InvokeDynamic; bootstrapMethodAttrIndex: number; natIndex: number };

// Placeholder entry for the second slot of Long/Double
type CpPlaceholder = { tag: 0 };

// ---------------------------------------------------------------------------
// Forward reference for jump patching
// ---------------------------------------------------------------------------

interface ForwardRef {
  /** Offset in the bytecode where the 2-byte jump target should be written */
  patchOffset: number;
  /** Bytecode offset of the jump instruction itself (for computing relative offset) */
  instrOffset: number;
}

// ---------------------------------------------------------------------------
// MethodBuilder
// ---------------------------------------------------------------------------

export class MethodBuilder {
  private bytecode: number[] = [];
  private labels: Map<number, number | null> = new Map(); // labelId -> offset or null if unresolved
  private forwardRefs: Map<number, ForwardRef[]> = new Map(); // labelId -> patches
  private nextLabelId = 0;

  /** User-specified max stack depth. If not set, a conservative estimate is used. */
  maxStack = 0;
  /** User-specified max locals count. If not set, a conservative estimate is used. */
  maxLocals = 0;

  /** Emit a single-byte opcode. */
  emit(opcode: Opcode): void {
    this.bytecode.push(opcode & 0xff);
  }

  /** Emit a raw byte. */
  emitByte(byte: number): void {
    this.bytecode.push(byte & 0xff);
  }

  /** Emit a 2-byte big-endian value. */
  emitShort(value: number): void {
    this.bytecode.push((value >>> 8) & 0xff);
    this.bytecode.push(value & 0xff);
  }

  /** Emit a 4-byte big-endian value. */
  emitInt(value: number): void {
    this.bytecode.push((value >>> 24) & 0xff);
    this.bytecode.push((value >>> 16) & 0xff);
    this.bytecode.push((value >>> 8) & 0xff);
    this.bytecode.push(value & 0xff);
  }

  /** Create a new label and return its id. */
  label(): number {
    const id = this.nextLabelId++;
    this.labels.set(id, null);
    return id;
  }

  /** Mark the current bytecode offset as the location of the given label. */
  placeLabel(id: number): void {
    const offset = this.bytecode.length;
    this.labels.set(id, offset);

    // Resolve any forward references to this label
    const refs = this.forwardRefs.get(id);
    if (refs) {
      for (const ref of refs) {
        const relative = offset - ref.instrOffset;
        this.bytecode[ref.patchOffset] = (relative >>> 8) & 0xff;
        this.bytecode[ref.patchOffset + 1] = relative & 0xff;
      }
      this.forwardRefs.delete(id);
    }
  }

  /**
   * Emit a jump instruction (e.g., GOTO, IFEQ) targeting a label.
   * If the label is already placed, the offset is computed immediately.
   * Otherwise a forward reference is recorded and patched later.
   */
  emitJump(opcode: Opcode, labelId: number): void {
    const instrOffset = this.bytecode.length;
    this.emit(opcode);

    const resolved = this.labels.get(labelId);
    if (resolved !== null && resolved !== undefined) {
      // Label already placed -- compute relative offset
      const relative = resolved - instrOffset;
      this.emitShort(relative);
    } else {
      // Forward reference -- write placeholder and record patch location
      const patchOffset = this.bytecode.length;
      this.emitShort(0);
      let refs = this.forwardRefs.get(labelId);
      if (!refs) {
        refs = [];
        this.forwardRefs.set(labelId, refs);
      }
      refs.push({ patchOffset, instrOffset });
    }
  }

  /**
   * Emit an ldc or ldc_w instruction depending on the constant pool index.
   * Indices <= 255 use the single-byte ldc; larger indices use ldc_w.
   */
  emitLdc(cpIndex: number): void {
    if (cpIndex <= 255) {
      this.emit(Opcode.LDC);
      this.emitByte(cpIndex);
    } else {
      this.emit(Opcode.LDC_W);
      this.emitShort(cpIndex);
    }
  }

  /** Return the current bytecode offset (length of emitted bytes so far). */
  currentOffset(): number {
    return this.bytecode.length;
  }

  /** Return the raw bytecode as a Uint8Array. */
  getBytecode(): Uint8Array {
    return new Uint8Array(this.bytecode);
  }
}

// ---------------------------------------------------------------------------
// Field info
// ---------------------------------------------------------------------------

interface FieldInfo {
  accessFlags: number;
  nameIndex: number;
  descriptorIndex: number;
  attributes: AttributeInfo[];
}

// ---------------------------------------------------------------------------
// Method info
// ---------------------------------------------------------------------------

interface MethodInfo {
  accessFlags: number;
  nameIndex: number;
  descriptorIndex: number;
  builder: MethodBuilder;
  /** Exception table entries (empty for v0.1). */
  exceptionTable: ExceptionTableEntry[];
}

interface ExceptionTableEntry {
  startPc: number;
  endPc: number;
  handlerPc: number;
  catchType: number;
}

// ---------------------------------------------------------------------------
// Attribute info
// ---------------------------------------------------------------------------

interface AttributeInfo {
  nameIndex: number;
  data: Uint8Array;
}

// ---------------------------------------------------------------------------
// ClassFileWriter
// ---------------------------------------------------------------------------

export class ClassFileWriter {
  // Constant pool (index 0 is unused; entries start at 1)
  private pool: (CpEntry | CpPlaceholder)[] = [{ tag: 0 }]; // slot 0 placeholder
  private poolDedup: Map<string, number> = new Map();

  // Class structure
  private accessFlags = 0;
  private thisClassIndex = 0;
  private superClassIndex = 0;
  private interfaces: number[] = [];
  private fields: FieldInfo[] = [];
  private methods: MethodInfo[] = [];
  private classAttributes: AttributeInfo[] = [];

  // -----------------------------------------------------------------------
  // Constant pool builders (with deduplication)
  // -----------------------------------------------------------------------

  private nextPoolIndex(): number {
    return this.pool.length;
  }

  /** Add a CONSTANT_Utf8 entry. Returns the constant pool index. */
  addUtf8(value: string): number {
    const key = `utf8:${value}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_Utf8, value });
    this.poolDedup.set(key, index);
    return index;
  }

  /** Add a CONSTANT_Integer entry. */
  addInteger(value: number): number {
    const key = `int:${value}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_Integer, value });
    this.poolDedup.set(key, index);
    return index;
  }

  /** Add a CONSTANT_Float entry. */
  addFloat(value: number): number {
    const key = `float:${value}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_Float, value });
    this.poolDedup.set(key, index);
    return index;
  }

  /** Add a CONSTANT_Long entry. Takes two constant pool slots. */
  addLong(value: bigint): number {
    const key = `long:${value}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_Long, value });
    this.pool.push({ tag: 0 }); // second slot placeholder
    this.poolDedup.set(key, index);
    return index;
  }

  /** Add a CONSTANT_Double entry. Takes two constant pool slots. */
  addDouble(value: number): number {
    const key = `double:${value}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_Double, value });
    this.pool.push({ tag: 0 }); // second slot placeholder
    this.poolDedup.set(key, index);
    return index;
  }

  /** Add a CONSTANT_Class entry. */
  addClass(internalName: string): number {
    const key = `class:${internalName}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const nameIndex = this.addUtf8(internalName);
    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_Class, nameIndex });
    this.poolDedup.set(key, index);
    return index;
  }

  /** Add a CONSTANT_String entry. */
  addString(value: string): number {
    const key = `string:${value}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const stringIndex = this.addUtf8(value);
    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_String, stringIndex });
    this.poolDedup.set(key, index);
    return index;
  }

  /** Add a CONSTANT_NameAndType entry. */
  addNameAndType(name: string, descriptor: string): number {
    const key = `nat:${name}:${descriptor}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const nameIndex = this.addUtf8(name);
    const descriptorIndex = this.addUtf8(descriptor);
    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_NameAndType, nameIndex, descriptorIndex });
    this.poolDedup.set(key, index);
    return index;
  }

  /** Add a CONSTANT_Fieldref entry. */
  addFieldref(className: string, fieldName: string, descriptor: string): number {
    const key = `fref:${className}:${fieldName}:${descriptor}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const classIndex = this.addClass(className);
    const natIndex = this.addNameAndType(fieldName, descriptor);
    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_Fieldref, classIndex, natIndex });
    this.poolDedup.set(key, index);
    return index;
  }

  /** Add a CONSTANT_Methodref entry. */
  addMethodref(className: string, methodName: string, descriptor: string): number {
    const key = `mref:${className}:${methodName}:${descriptor}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const classIndex = this.addClass(className);
    const natIndex = this.addNameAndType(methodName, descriptor);
    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_Methodref, classIndex, natIndex });
    this.poolDedup.set(key, index);
    return index;
  }

  /** Add a CONSTANT_InterfaceMethodref entry. */
  addInterfaceMethodref(className: string, methodName: string, descriptor: string): number {
    const key = `imref:${className}:${methodName}:${descriptor}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const classIndex = this.addClass(className);
    const natIndex = this.addNameAndType(methodName, descriptor);
    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_InterfaceMethodref, classIndex, natIndex });
    this.poolDedup.set(key, index);
    return index;
  }

  /** Add a CONSTANT_MethodHandle entry. */
  addMethodHandle(referenceKind: number, referenceIndex: number): number {
    const key = `mh:${referenceKind}:${referenceIndex}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_MethodHandle, referenceKind, referenceIndex });
    this.poolDedup.set(key, index);
    return index;
  }

  /** Add a CONSTANT_MethodType entry. */
  addMethodType(descriptor: string): number {
    const key = `mt:${descriptor}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const descriptorIndex = this.addUtf8(descriptor);
    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_MethodType, descriptorIndex });
    this.poolDedup.set(key, index);
    return index;
  }

  /** Add a CONSTANT_InvokeDynamic entry. */
  addInvokeDynamic(bootstrapMethodAttrIndex: number, name: string, descriptor: string): number {
    const key = `indy:${bootstrapMethodAttrIndex}:${name}:${descriptor}`;
    const existing = this.poolDedup.get(key);
    if (existing !== undefined) return existing;

    const natIndex = this.addNameAndType(name, descriptor);
    const index = this.nextPoolIndex();
    this.pool.push({ tag: CONSTANT_InvokeDynamic, bootstrapMethodAttrIndex, natIndex });
    this.poolDedup.set(key, index);
    return index;
  }

  // -----------------------------------------------------------------------
  // Class setup
  // -----------------------------------------------------------------------

  /**
   * Set the class identity.
   * @param accessFlags - e.g., ACC_PUBLIC | ACC_SUPER
   * @param thisClass - internal name, e.g., "com/example/Main"
   * @param superClass - internal name, e.g., "java/lang/Object"
   */
  setClass(accessFlags: number, thisClass: string, superClass: string): void {
    this.accessFlags = accessFlags;
    this.thisClassIndex = this.addClass(thisClass);
    this.superClassIndex = this.addClass(superClass);
  }

  /** Add an interface that this class implements. */
  addInterface(internalName: string): void {
    this.interfaces.push(this.addClass(internalName));
  }

  // -----------------------------------------------------------------------
  // Fields
  // -----------------------------------------------------------------------

  /** Add a field to the class. */
  addField(accessFlags: number, name: string, descriptor: string): void {
    const nameIndex = this.addUtf8(name);
    const descriptorIndex = this.addUtf8(descriptor);
    this.fields.push({
      accessFlags,
      nameIndex,
      descriptorIndex,
      attributes: [],
    });
  }

  // -----------------------------------------------------------------------
  // Methods
  // -----------------------------------------------------------------------

  /**
   * Add a method and return its MethodBuilder for emitting bytecode.
   */
  addMethod(accessFlags: number, name: string, descriptor: string): MethodBuilder {
    const nameIndex = this.addUtf8(name);
    const descriptorIndex = this.addUtf8(descriptor);
    // Pre-register the "Code" attribute name so it's in the pool before serialization
    this.addUtf8("Code");
    const builder = new MethodBuilder();
    this.methods.push({
      accessFlags,
      nameIndex,
      descriptorIndex,
      builder,
      exceptionTable: [],
    });
    return builder;
  }

  // -----------------------------------------------------------------------
  // Class attributes
  // -----------------------------------------------------------------------

  /** Add a raw attribute to the class. */
  addClassAttribute(name: string, data: Uint8Array): void {
    const nameIndex = this.addUtf8(name);
    this.classAttributes.push({ nameIndex, data });
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  /** Serialize the complete class file to bytes. */
  toBytes(): Uint8Array {
    const buf = new ByteBuffer();

    // Magic number
    buf.writeU4(CLASS_MAGIC);

    // Version
    buf.writeU2(CLASS_MINOR_VERSION);
    buf.writeU2(CLASS_MAJOR_VERSION);

    // Constant pool
    buf.writeU2(this.pool.length); // constant_pool_count
    for (let i = 1; i < this.pool.length; i++) {
      const entry = this.pool[i];
      this.writeCpEntry(buf, entry);
    }

    // Access flags, this class, super class
    buf.writeU2(this.accessFlags);
    buf.writeU2(this.thisClassIndex);
    buf.writeU2(this.superClassIndex);

    // Interfaces
    buf.writeU2(this.interfaces.length);
    for (const iface of this.interfaces) {
      buf.writeU2(iface);
    }

    // Fields
    buf.writeU2(this.fields.length);
    for (const field of this.fields) {
      buf.writeU2(field.accessFlags);
      buf.writeU2(field.nameIndex);
      buf.writeU2(field.descriptorIndex);
      buf.writeU2(field.attributes.length);
      for (const attr of field.attributes) {
        this.writeAttribute(buf, attr);
      }
    }

    // Methods
    buf.writeU2(this.methods.length);
    for (const method of this.methods) {
      this.writeMethod(buf, method);
    }

    // Class attributes
    buf.writeU2(this.classAttributes.length);
    for (const attr of this.classAttributes) {
      this.writeAttribute(buf, attr);
    }

    return buf.toUint8Array();
  }

  private writeCpEntry(buf: ByteBuffer, entry: CpEntry | CpPlaceholder): void {
    if (entry.tag === 0) {
      // Placeholder for second slot of Long/Double -- nothing to write
      return;
    }

    buf.writeU1(entry.tag);

    switch (entry.tag) {
      case CONSTANT_Utf8: {
        const encoded = new TextEncoder().encode(entry.value);
        buf.writeU2(encoded.length);
        buf.writeBytes(encoded);
        break;
      }
      case CONSTANT_Integer:
        buf.writeU4(entry.value | 0); // ensure 32-bit int
        break;
      case CONSTANT_Float: {
        const floatBuf = new ArrayBuffer(4);
        new DataView(floatBuf).setFloat32(0, entry.value, false);
        buf.writeBytes(new Uint8Array(floatBuf));
        break;
      }
      case CONSTANT_Long: {
        const longVal = entry.value;
        const high = Number((longVal >> 32n) & 0xffffffffn);
        const low = Number(longVal & 0xffffffffn);
        buf.writeU4(high);
        buf.writeU4(low);
        break;
      }
      case CONSTANT_Double: {
        const doubleBuf = new ArrayBuffer(8);
        new DataView(doubleBuf).setFloat64(0, entry.value, false);
        buf.writeBytes(new Uint8Array(doubleBuf));
        break;
      }
      case CONSTANT_Class:
        buf.writeU2(entry.nameIndex);
        break;
      case CONSTANT_String:
        buf.writeU2(entry.stringIndex);
        break;
      case CONSTANT_Fieldref:
      case CONSTANT_Methodref:
      case CONSTANT_InterfaceMethodref:
        buf.writeU2(entry.classIndex);
        buf.writeU2(entry.natIndex);
        break;
      case CONSTANT_NameAndType:
        buf.writeU2(entry.nameIndex);
        buf.writeU2(entry.descriptorIndex);
        break;
      case CONSTANT_MethodHandle:
        buf.writeU1(entry.referenceKind);
        buf.writeU2(entry.referenceIndex);
        break;
      case CONSTANT_MethodType:
        buf.writeU2(entry.descriptorIndex);
        break;
      case CONSTANT_InvokeDynamic:
        buf.writeU2(entry.bootstrapMethodAttrIndex);
        buf.writeU2(entry.natIndex);
        break;
    }
  }

  private writeMethod(buf: ByteBuffer, method: MethodInfo): void {
    buf.writeU2(method.accessFlags);
    buf.writeU2(method.nameIndex);
    buf.writeU2(method.descriptorIndex);

    // Build the Code attribute
    const codeAttr = this.buildCodeAttribute(method);

    // Method has 1 attribute: Code
    buf.writeU2(1);
    this.writeAttribute(buf, codeAttr);
  }

  private buildCodeAttribute(method: MethodInfo): AttributeInfo {
    const codeAttrNameIndex = this.addUtf8("Code");
    const bytecode = method.builder.getBytecode();

    // Conservative estimates if not explicitly set
    const maxStack = method.builder.maxStack > 0 ? method.builder.maxStack : 64;
    const maxLocals = method.builder.maxLocals > 0 ? method.builder.maxLocals : 64;

    const codeBuf = new ByteBuffer();
    codeBuf.writeU2(maxStack);
    codeBuf.writeU2(maxLocals);
    codeBuf.writeU4(bytecode.length);
    codeBuf.writeBytes(bytecode);

    // Exception table
    codeBuf.writeU2(method.exceptionTable.length);
    for (const entry of method.exceptionTable) {
      codeBuf.writeU2(entry.startPc);
      codeBuf.writeU2(entry.endPc);
      codeBuf.writeU2(entry.handlerPc);
      codeBuf.writeU2(entry.catchType);
    }

    // Code attributes (none for v0.1)
    codeBuf.writeU2(0);

    return {
      nameIndex: codeAttrNameIndex,
      data: codeBuf.toUint8Array(),
    };
  }

  private writeAttribute(buf: ByteBuffer, attr: AttributeInfo): void {
    buf.writeU2(attr.nameIndex);
    buf.writeU4(attr.data.length);
    buf.writeBytes(attr.data);
  }
}

// ---------------------------------------------------------------------------
// ByteBuffer helper -- growable big-endian byte writer
// ---------------------------------------------------------------------------

class ByteBuffer {
  private chunks: Uint8Array[] = [];
  private totalLength = 0;

  writeU1(value: number): void {
    const b = new Uint8Array(1);
    b[0] = value & 0xff;
    this.chunks.push(b);
    this.totalLength += 1;
  }

  writeU2(value: number): void {
    const b = new Uint8Array(2);
    b[0] = (value >>> 8) & 0xff;
    b[1] = value & 0xff;
    this.chunks.push(b);
    this.totalLength += 2;
  }

  writeU4(value: number): void {
    const b = new Uint8Array(4);
    b[0] = (value >>> 24) & 0xff;
    b[1] = (value >>> 16) & 0xff;
    b[2] = (value >>> 8) & 0xff;
    b[3] = value & 0xff;
    this.chunks.push(b);
    this.totalLength += 4;
  }

  writeBytes(data: Uint8Array): void {
    this.chunks.push(data);
    this.totalLength += data.length;
  }

  toUint8Array(): Uint8Array {
    const result = new Uint8Array(this.totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}
