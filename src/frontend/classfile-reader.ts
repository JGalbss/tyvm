/**
 * JVM .class File Reader for Compile-Time Java Interop
 *
 * Parses JVM .class files to extract public method signatures, field types,
 * and constructors. This enables arbitrary Java library interop without
 * hardcoding type tables for every class.
 *
 * The parser reads just enough of the class file format to extract the
 * constant pool, method descriptors, and field descriptors. It does NOT
 * attempt to read bytecode, attributes, or other sections beyond what is
 * needed for type information.
 *
 * References:
 *   - JVM Spec Chapter 4: https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-4.html
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as childProcess from "node:child_process";
import type { JvmType } from "../ir/nodes.js";

// ---------------------------------------------------------------------------
// Constants: Class file structure
// ---------------------------------------------------------------------------

const CLASS_MAGIC = 0xcafebabe;

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
const CONSTANT_Dynamic = 17;
const CONSTANT_InvokeDynamic = 18;
const CONSTANT_Module = 19;
const CONSTANT_Package = 20;

// Access flags
const ACC_PUBLIC = 0x0001;
const ACC_STATIC = 0x0008;
const ACC_FINAL = 0x0010;
const ACC_ABSTRACT = 0x0400;
const ACC_SYNTHETIC = 0x1000;

// ---------------------------------------------------------------------------
// Exported types: parsed class information
// ---------------------------------------------------------------------------

export interface JavaMethodInfo {
  name: string;
  descriptor: string;
  paramTypes: JvmType[];
  returnType: JvmType;
  isStatic: boolean;
}

export interface JavaFieldInfo {
  name: string;
  descriptor: string;
  type: JvmType;
  isStatic: boolean;
  isFinal: boolean;
}

export interface JavaConstructorInfo {
  descriptor: string;
  paramTypes: JvmType[];
}

export interface JavaClassInfo {
  /** JVM internal name (slash-separated), e.g. "java/util/ArrayList" */
  className: string;
  methods: JavaMethodInfo[];
  fields: JavaFieldInfo[];
  constructors: JavaConstructorInfo[];
  isAbstract: boolean;
  superClassName: string | null;
  interfaceNames: string[];
}

// ---------------------------------------------------------------------------
// Reader: binary buffer cursor
// ---------------------------------------------------------------------------

class ClassFileReader {
  private buf: Buffer;
  private pos: number;

  constructor(buf: Buffer) {
    this.buf = buf;
    this.pos = 0;
  }

  u1(): number {
    const v = this.buf.readUInt8(this.pos);
    this.pos += 1;
    return v;
  }

  u2(): number {
    const v = this.buf.readUInt16BE(this.pos);
    this.pos += 2;
    return v;
  }

  u4(): number {
    const v = this.buf.readUInt32BE(this.pos);
    this.pos += 4;
    return v;
  }

  readBytes(n: number): Buffer {
    const slice = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return slice;
  }

  skip(n: number): void {
    this.pos += n;
  }

  get offset(): number {
    return this.pos;
  }
}

// ---------------------------------------------------------------------------
// Constant pool entry types (minimal, for our needs)
// ---------------------------------------------------------------------------

type CpEntry =
  | { tag: "Utf8"; value: string }
  | { tag: "Integer" }
  | { tag: "Float" }
  | { tag: "Long" }
  | { tag: "Double" }
  | { tag: "Class"; nameIndex: number }
  | { tag: "String"; stringIndex: number }
  | { tag: "Fieldref"; classIndex: number; natIndex: number }
  | { tag: "Methodref"; classIndex: number; natIndex: number }
  | { tag: "InterfaceMethodref"; classIndex: number; natIndex: number }
  | { tag: "NameAndType"; nameIndex: number; descriptorIndex: number }
  | { tag: "MethodHandle" }
  | { tag: "MethodType" }
  | { tag: "Dynamic" }
  | { tag: "InvokeDynamic" }
  | { tag: "Module" }
  | { tag: "Package" }
  | { tag: "Placeholder" }; // second slot of Long/Double

// ---------------------------------------------------------------------------
// Parse a .class file buffer into JavaClassInfo
// ---------------------------------------------------------------------------

export function parseClassFile(data: Buffer): JavaClassInfo {
  const r = new ClassFileReader(data);

  // 1. Magic number
  const magic = r.u4();
  if (magic !== CLASS_MAGIC) {
    throw new Error(`Not a valid class file (magic: 0x${magic.toString(16)})`);
  }

  // 2. Version (minor, major) — we don't care about these
  r.u2(); // minor
  r.u2(); // major

  // 3. Constant pool
  const cpCount = r.u2();
  // Constant pool indices are 1-based. Index 0 is unused.
  const cp: (CpEntry | null)[] = [null];

  for (let i = 1; i < cpCount; i++) {
    const tag = r.u1();
    switch (tag) {
      case CONSTANT_Utf8: {
        const length = r.u2();
        const bytes = r.readBytes(length);
        // Modified UTF-8, but for ASCII-range method names/descriptors,
        // standard UTF-8 decoding is fine.
        cp.push({ tag: "Utf8", value: bytes.toString("utf8") });
        break;
      }
      case CONSTANT_Integer:
        r.skip(4);
        cp.push({ tag: "Integer" });
        break;
      case CONSTANT_Float:
        r.skip(4);
        cp.push({ tag: "Float" });
        break;
      case CONSTANT_Long:
        r.skip(8);
        cp.push({ tag: "Long" });
        // Long takes two slots
        i++;
        cp.push({ tag: "Placeholder" });
        break;
      case CONSTANT_Double:
        r.skip(8);
        cp.push({ tag: "Double" });
        // Double takes two slots
        i++;
        cp.push({ tag: "Placeholder" });
        break;
      case CONSTANT_Class: {
        const nameIndex = r.u2();
        cp.push({ tag: "Class", nameIndex });
        break;
      }
      case CONSTANT_String: {
        const stringIndex = r.u2();
        cp.push({ tag: "String", stringIndex });
        break;
      }
      case CONSTANT_Fieldref: {
        const classIndex = r.u2();
        const natIndex = r.u2();
        cp.push({ tag: "Fieldref", classIndex, natIndex });
        break;
      }
      case CONSTANT_Methodref: {
        const classIndex = r.u2();
        const natIndex = r.u2();
        cp.push({ tag: "Methodref", classIndex, natIndex });
        break;
      }
      case CONSTANT_InterfaceMethodref: {
        const classIndex = r.u2();
        const natIndex = r.u2();
        cp.push({ tag: "InterfaceMethodref", classIndex, natIndex });
        break;
      }
      case CONSTANT_NameAndType: {
        const nameIndex = r.u2();
        const descriptorIndex = r.u2();
        cp.push({ tag: "NameAndType", nameIndex, descriptorIndex });
        break;
      }
      case CONSTANT_MethodHandle:
        r.skip(3); // reference_kind (u1) + reference_index (u2)
        cp.push({ tag: "MethodHandle" });
        break;
      case CONSTANT_MethodType:
        r.skip(2); // descriptor_index
        cp.push({ tag: "MethodType" });
        break;
      case CONSTANT_Dynamic:
        r.skip(4); // bootstrap_method_attr_index (u2) + name_and_type_index (u2)
        cp.push({ tag: "Dynamic" });
        break;
      case CONSTANT_InvokeDynamic:
        r.skip(4); // bootstrap_method_attr_index (u2) + name_and_type_index (u2)
        cp.push({ tag: "InvokeDynamic" });
        break;
      case CONSTANT_Module:
        r.skip(2); // name_index
        cp.push({ tag: "Module" });
        break;
      case CONSTANT_Package:
        r.skip(2); // name_index
        cp.push({ tag: "Package" });
        break;
      default:
        throw new Error(`Unknown constant pool tag ${tag} at index ${i}`);
    }
  }

  // Helper to resolve a UTF-8 string from the constant pool
  function cpUtf8(index: number): string {
    const entry = cp[index];
    if (!entry || entry.tag !== "Utf8") {
      throw new Error(`Expected Utf8 at constant pool index ${index}, got ${entry?.tag}`);
    }
    return entry.value;
  }

  // Helper to resolve a class name from the constant pool
  function cpClassName(index: number): string {
    const entry = cp[index];
    if (!entry || entry.tag !== "Class") {
      throw new Error(`Expected Class at constant pool index ${index}, got ${entry?.tag}`);
    }
    return cpUtf8(entry.nameIndex);
  }

  // 4. Access flags
  const accessFlags = r.u2();
  const isAbstract = (accessFlags & ACC_ABSTRACT) !== 0;

  // 5. This class
  const thisClassIndex = r.u2();
  const className = cpClassName(thisClassIndex);

  // 6. Super class
  const superClassIndex = r.u2();
  const superClassName = superClassIndex !== 0 ? cpClassName(superClassIndex) : null;

  // 7. Interfaces
  const interfacesCount = r.u2();
  const interfaceNames: string[] = [];
  for (let i = 0; i < interfacesCount; i++) {
    interfaceNames.push(cpClassName(r.u2()));
  }

  // 8. Fields
  const fieldsCount = r.u2();
  const fields: JavaFieldInfo[] = [];
  for (let i = 0; i < fieldsCount; i++) {
    const fAccessFlags = r.u2();
    const fNameIndex = r.u2();
    const fDescriptorIndex = r.u2();
    const fAttributesCount = r.u2();

    // Skip attributes
    for (let j = 0; j < fAttributesCount; j++) {
      r.skip(2); // attribute_name_index
      const attrLength = r.u4();
      r.skip(attrLength);
    }

    // Only include public fields
    if ((fAccessFlags & ACC_PUBLIC) === 0) continue;
    // Skip synthetic fields
    if ((fAccessFlags & ACC_SYNTHETIC) !== 0) continue;

    const fieldName = cpUtf8(fNameIndex);
    const fieldDescriptor = cpUtf8(fDescriptorIndex);

    fields.push({
      name: fieldName,
      descriptor: fieldDescriptor,
      type: descriptorToJvmType(fieldDescriptor),
      isStatic: (fAccessFlags & ACC_STATIC) !== 0,
      isFinal: (fAccessFlags & ACC_FINAL) !== 0,
    });
  }

  // 9. Methods
  const methodsCount = r.u2();
  const methods: JavaMethodInfo[] = [];
  const constructors: JavaConstructorInfo[] = [];

  for (let i = 0; i < methodsCount; i++) {
    const mAccessFlags = r.u2();
    const mNameIndex = r.u2();
    const mDescriptorIndex = r.u2();
    const mAttributesCount = r.u2();

    // Skip attributes
    for (let j = 0; j < mAttributesCount; j++) {
      r.skip(2); // attribute_name_index
      const attrLength = r.u4();
      r.skip(attrLength);
    }

    // Only include public methods
    if ((mAccessFlags & ACC_PUBLIC) === 0) continue;
    // Skip synthetic methods
    if ((mAccessFlags & ACC_SYNTHETIC) !== 0) continue;

    const methodName = cpUtf8(mNameIndex);
    const methodDescriptor = cpUtf8(mDescriptorIndex);

    if (methodName === "<init>") {
      // Constructor
      constructors.push({
        descriptor: methodDescriptor,
        paramTypes: parseMethodParamTypes(methodDescriptor),
      });
    } else if (methodName === "<clinit>") {
      // Class initializer — skip
      continue;
    } else {
      methods.push({
        name: methodName,
        descriptor: methodDescriptor,
        paramTypes: parseMethodParamTypes(methodDescriptor),
        returnType: parseMethodReturnType(methodDescriptor),
        isStatic: (mAccessFlags & ACC_STATIC) !== 0,
      });
    }
  }

  return {
    className,
    methods,
    fields,
    constructors,
    isAbstract,
    superClassName,
    interfaceNames,
  };
}

// ---------------------------------------------------------------------------
// JVM descriptor parsing -> JvmType
// ---------------------------------------------------------------------------

/**
 * Parse a single JVM type descriptor starting at position `pos` in the string.
 * Returns the parsed type and the new position after the descriptor.
 */
function parseSingleType(desc: string, pos: number): [JvmType, number] {
  const ch = desc[pos];
  switch (ch) {
    case "V":
      return [{ kind: "TyVoid" }, pos + 1];
    case "Z":
      return [{ kind: "TyBoolean" }, pos + 1];
    case "B":
      // byte — promote to int
      return [{ kind: "TyInt" }, pos + 1];
    case "C":
      // char — promote to int
      return [{ kind: "TyInt" }, pos + 1];
    case "S":
      // short — promote to int
      return [{ kind: "TyInt" }, pos + 1];
    case "I":
      return [{ kind: "TyInt" }, pos + 1];
    case "J":
      return [{ kind: "TyLong" }, pos + 1];
    case "F":
      return [{ kind: "TyFloat" }, pos + 1];
    case "D":
      return [{ kind: "TyDouble" }, pos + 1];
    case "L": {
      const semi = desc.indexOf(";", pos);
      if (semi < 0) {
        return [{ kind: "TyObject", className: "java/lang/Object" }, desc.length];
      }
      const className = desc.substring(pos + 1, semi);
      if (className === "java/lang/String") {
        return [{ kind: "TyString" }, semi + 1];
      }
      return [{ kind: "TyObject", className }, semi + 1];
    }
    case "[": {
      let arrayDepth = 0;
      let p = pos;
      while (p < desc.length && desc[p] === "[") {
        arrayDepth++;
        p++;
      }
      const [elemType, nextPos] = parseSingleType(desc, p);
      let result: JvmType = elemType;
      for (let d = 0; d < arrayDepth; d++) {
        result = { kind: "TyArray", elementType: result };
      }
      return [result, nextPos];
    }
    default:
      return [{ kind: "TyObject", className: "java/lang/Object" }, pos + 1];
  }
}

/**
 * Convert a JVM field descriptor to a JvmType.
 * E.g., "I" -> TyInt, "Ljava/lang/String;" -> TyString
 */
export function descriptorToJvmType(descriptor: string): JvmType {
  const [type] = parseSingleType(descriptor, 0);
  return type;
}

/**
 * Parse the parameter types from a JVM method descriptor.
 * E.g., "(IDLjava/lang/String;)V" -> [TyInt, TyDouble, TyString]
 */
export function parseMethodParamTypes(descriptor: string): JvmType[] {
  const params: JvmType[] = [];
  const openParen = descriptor.indexOf("(");
  const closeParen = descriptor.indexOf(")");
  if (openParen < 0 || closeParen < 0) return params;

  let pos = openParen + 1;
  while (pos < closeParen) {
    const [type, nextPos] = parseSingleType(descriptor, pos);
    params.push(type);
    pos = nextPos;
  }
  return params;
}

/**
 * Parse the return type from a JVM method descriptor.
 * E.g., "(ID)Ljava/lang/String;" -> TyString
 */
export function parseMethodReturnType(descriptor: string): JvmType {
  const closeParen = descriptor.indexOf(")");
  if (closeParen < 0) return { kind: "TyVoid" };
  const [type] = parseSingleType(descriptor, closeParen + 1);
  return type;
}

// ---------------------------------------------------------------------------
// Class file location: find .class files on disk
// ---------------------------------------------------------------------------

/** Cache of resolved class file paths to avoid repeated filesystem lookups. */
const classPathCache = new Map<string, string | null>();

/** Cache of parsed class information. */
const classInfoCache = new Map<string, JavaClassInfo | null>();

/** Lazily resolved JAVA_HOME path. */
let resolvedJavaHome: string | null | undefined = undefined;

function getJavaHome(): string | null {
  if (resolvedJavaHome !== undefined) return resolvedJavaHome;

  // 1. JAVA_HOME env
  if (process.env.JAVA_HOME) {
    resolvedJavaHome = process.env.JAVA_HOME;
    return resolvedJavaHome;
  }

  // 2. Try to detect via `java -XshowSettings:property` or similar
  try {
    const result = childProcess.execSync(
      "java -XshowSettings:property -version 2>&1",
      { encoding: "utf8", timeout: 5000 },
    );
    const match = result.match(/java\.home\s*=\s*(.+)/);
    if (match) {
      resolvedJavaHome = match[1].trim();
      return resolvedJavaHome;
    }
  } catch {
    // ignore
  }

  resolvedJavaHome = null;
  return null;
}

/**
 * Get the list of classpath entries to search for .class files.
 * Includes: current directory, out/, CLASSPATH env, and the JDK modules.
 */
function getClasspathEntries(): string[] {
  const entries: string[] = [];

  // Current directory
  entries.push(process.cwd());

  // out/ directory (common build output)
  entries.push(path.join(process.cwd(), "out"));

  // build/classes directory (Gradle convention)
  entries.push(path.join(process.cwd(), "build", "classes"));

  // target/classes directory (Maven convention)
  entries.push(path.join(process.cwd(), "target", "classes"));

  // CLASSPATH environment variable
  const cpEnv = process.env.CLASSPATH;
  if (cpEnv) {
    const separator = process.platform === "win32" ? ";" : ":";
    for (const entry of cpEnv.split(separator)) {
      if (entry.trim()) {
        entries.push(entry.trim());
      }
    }
  }

  return entries;
}

/**
 * Try to read a class from a JAR file.
 * Uses the `jar` command to extract a single entry.
 */
function readClassFromJar(jarPath: string, internalName: string): Buffer | null {
  const entryPath = internalName + ".class";
  try {
    // Use jar command to extract to stdout (available everywhere JDK is installed)
    const result = childProcess.execSync(
      `unzip -p "${jarPath}" "${entryPath}"`,
      { encoding: "buffer", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] },
    );
    if (result.length > 0 && result.readUInt32BE(0) === CLASS_MAGIC) {
      return result;
    }
  } catch {
    // Entry not found in JAR or unzip not available
  }
  return null;
}

/**
 * Try to read a class from JDK's jmod files (Java 9+ modular runtime).
 * The standard library classes are in $JAVA_HOME/jmods/java.base.jmod etc.
 */
function readClassFromJdkModules(internalName: string): Buffer | null {
  const javaHome = getJavaHome();
  if (!javaHome) return null;

  // jmod files are in $JAVA_HOME/jmods/ (for full JDK installs)
  const jmodsDir = path.join(javaHome, "jmods");
  if (fs.existsSync(jmodsDir)) {
    // Try common modules in priority order
    const modules = [
      "java.base.jmod",
      "java.logging.jmod",
      "java.sql.jmod",
      "java.desktop.jmod",
      "java.net.http.jmod",
      "java.xml.jmod",
    ];
    for (const mod of modules) {
      const jmodPath = path.join(jmodsDir, mod);
      if (!fs.existsSync(jmodPath)) continue;

      // jmod files are zip files. The classes are under "classes/" prefix.
      const entryPath = "classes/" + internalName + ".class";
      try {
        const result = childProcess.execSync(
          `unzip -p "${jmodPath}" "${entryPath}"`,
          { encoding: "buffer", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] },
        );
        if (result.length > 0 && result.readUInt32BE(0) === CLASS_MAGIC) {
          return result;
        }
      } catch {
        // Not in this module
      }
    }
  }

  // Java 8 style: rt.jar
  const rtJar = path.join(javaHome, "lib", "rt.jar");
  if (fs.existsSync(rtJar)) {
    return readClassFromJar(rtJar, internalName);
  }

  // JRE-only installs: $JAVA_HOME/lib/jrt-fs.jar won't help directly,
  // but the ct.sym or extracted modules might exist elsewhere.
  // Try the lib/modules image (Java 9+ JRE without jmods/)
  const modulesImage = path.join(javaHome, "lib", "modules");
  if (fs.existsSync(modulesImage)) {
    // Use jimage to extract (available in $JAVA_HOME/bin)
    try {
      const jimageBin = path.join(javaHome, "bin", "jimage");
      const result = childProcess.execSync(
        `"${jimageBin}" extract --dir=/dev/stdout --include="/${internalName}.class" "${modulesImage}"`,
        { encoding: "buffer", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] },
      );
      if (result.length > 0 && result.readUInt32BE(0) === CLASS_MAGIC) {
        return result;
      }
    } catch {
      // jimage extract may not support stdout. Fall back to javap approach.
    }

    // Alternative: use javap to get class info (this is a fallback)
    // We'll handle this in readClassFromJavap below.
  }

  return null;
}

/**
 * Find and read a .class file for the given JVM internal class name.
 * Searches: classpath directories, JAR files, JDK modules.
 *
 * @param internalName JVM internal name, e.g. "java/util/ArrayList"
 * @returns Buffer containing the .class file, or null if not found
 */
function findClassFile(internalName: string): Buffer | null {
  // Check path cache first
  const cached = classPathCache.get(internalName);
  if (cached === null) return null;
  if (cached !== undefined) {
    try {
      return fs.readFileSync(cached);
    } catch {
      classPathCache.set(internalName, null);
      return null;
    }
  }

  const entries = getClasspathEntries();
  const relPath = internalName + ".class";

  for (const entry of entries) {
    // Check if entry is a directory
    try {
      const stat = fs.statSync(entry);
      if (stat.isDirectory()) {
        const filePath = path.join(entry, relPath);
        if (fs.existsSync(filePath)) {
          classPathCache.set(internalName, filePath);
          return fs.readFileSync(filePath);
        }
      } else if (stat.isFile() && (entry.endsWith(".jar") || entry.endsWith(".zip"))) {
        const data = readClassFromJar(entry, internalName);
        if (data) {
          // Don't cache path for JAR entries, but mark as found
          classPathCache.set(internalName, entry);
          return data;
        }
      }
    } catch {
      // Entry doesn't exist or isn't accessible
    }
  }

  // Try JDK modules as last resort
  const jdkData = readClassFromJdkModules(internalName);
  if (jdkData) {
    classPathCache.set(internalName, "<jdk>");
    return jdkData;
  }

  classPathCache.set(internalName, null);
  return null;
}

/**
 * Fallback: use `javap` to get class information when we can't read .class directly.
 * This works even when classes are in the runtime image (lib/modules).
 */
function readClassFromJavap(internalName: string): JavaClassInfo | null {
  const dotName = internalName.replace(/\//g, ".");
  try {
    const result = childProcess.execSync(
      `javap -public -s "${dotName}"`,
      { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] },
    );
    return parseJavapOutput(result, internalName);
  } catch {
    return null;
  }
}

/**
 * Parse javap -public -s output into a JavaClassInfo.
 *
 * Example javap output:
 *   public class java.util.ArrayList<E> ... {
 *     public java.util.ArrayList();
 *       descriptor: ()V
 *     public boolean add(E);
 *       descriptor: (Ljava/lang/Object;)Z
 *     ...
 *   }
 */
function parseJavapOutput(output: string, internalName: string): JavaClassInfo {
  const methods: JavaMethodInfo[] = [];
  const fields: JavaFieldInfo[] = [];
  const constructors: JavaConstructorInfo[] = [];

  const lines = output.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Look for descriptor lines (they follow method/field declarations)
    if (line.startsWith("descriptor:")) {
      const descriptor = line.substring("descriptor:".length).trim();
      const prevLine = i > 0 ? lines[i - 1].trim() : "";

      if (descriptor.includes("(")) {
        // It's a method or constructor descriptor
        const isStatic = prevLine.includes("static ");
        const isConstructor = prevLine.includes(internalName.replace(/\//g, ".").split(".").pop() + "(")
          || prevLine.includes("<init>");

        if (isConstructor) {
          constructors.push({
            descriptor,
            paramTypes: parseMethodParamTypes(descriptor),
          });
        } else {
          // Extract method name from the previous line
          // Format: "public [static] returnType methodName(params...)"
          const methodNameMatch = prevLine.match(/\s(\w+)\s*\(/);
          if (methodNameMatch) {
            methods.push({
              name: methodNameMatch[1],
              descriptor,
              paramTypes: parseMethodParamTypes(descriptor),
              returnType: parseMethodReturnType(descriptor),
              isStatic,
            });
          }
        }
      } else {
        // It's a field descriptor
        const isStatic = prevLine.includes("static ");
        const isFinal = prevLine.includes("final ");
        // Extract field name from the previous line
        // Format: "public [static] [final] type fieldName;"
        const fieldNameMatch = prevLine.match(/\s(\w+)\s*;/);
        if (fieldNameMatch) {
          fields.push({
            name: fieldNameMatch[1],
            descriptor,
            type: descriptorToJvmType(descriptor),
            isStatic,
            isFinal,
          });
        }
      }
    }

    i++;
  }

  return {
    className: internalName,
    methods,
    fields,
    constructors,
    isAbstract: output.includes("abstract class") || output.includes("interface "),
    superClassName: null, // javap doesn't easily give us this in -s mode
    interfaceNames: [],
  };
}

// ---------------------------------------------------------------------------
// Public API: load class information
// ---------------------------------------------------------------------------

/**
 * Load and parse a Java class file, returning structured type information.
 * Results are cached for performance.
 *
 * @param internalName JVM internal name, e.g. "java/util/ArrayList"
 * @returns Parsed class info, or null if the class cannot be found
 */
export function loadJavaClass(internalName: string): JavaClassInfo | null {
  // Check cache
  const cached = classInfoCache.get(internalName);
  if (cached !== undefined) return cached;

  // Try to find and parse the .class file directly
  const classData = findClassFile(internalName);
  if (classData) {
    try {
      const info = parseClassFile(classData);
      classInfoCache.set(internalName, info);
      return info;
    } catch {
      // Fall through to javap
    }
  }

  // Fallback: use javap
  const javapInfo = readClassFromJavap(internalName);
  if (javapInfo) {
    classInfoCache.set(internalName, javapInfo);
    return javapInfo;
  }

  classInfoCache.set(internalName, null);
  return null;
}

// ---------------------------------------------------------------------------
// High-level query API (used by java-types.ts and lower.ts)
// ---------------------------------------------------------------------------

/**
 * Look up the return type of a static method on a Java class by reading the class file.
 * If the class has multiple overloads, returns the first match (by name).
 */
export function resolveStaticMethodTypeFromClassFile(
  javaClass: string,
  methodName: string,
): JvmType | undefined {
  const info = loadJavaClass(javaClass);
  if (!info) return undefined;

  const method = info.methods.find((m) => m.name === methodName && m.isStatic);
  return method?.returnType;
}

/**
 * Look up the return type of an instance method on a Java class by reading the class file.
 * If the class has multiple overloads, returns the first match (by name).
 */
export function resolveInstanceMethodTypeFromClassFile(
  javaClass: string,
  methodName: string,
): JvmType | undefined {
  const info = loadJavaClass(javaClass);
  if (!info) return undefined;

  const method = info.methods.find((m) => m.name === methodName && !m.isStatic);
  return method?.returnType;
}

/**
 * Look up the JVM method descriptor for an instance method on a Java class.
 * Useful for correct bytecode emission (handles overloads by matching arg count).
 */
export function resolveInstanceMethodDescriptorFromClassFile(
  javaClass: string,
  methodName: string,
  argCount: number,
): string | undefined {
  const info = loadJavaClass(javaClass);
  if (!info) return undefined;

  // Try to find a method matching both name and parameter count
  const method = info.methods.find(
    (m) => m.name === methodName && !m.isStatic && m.paramTypes.length === argCount,
  );
  if (method) return method.descriptor;

  // Fallback: just match by name (for varargs or when count doesn't match)
  const anyMatch = info.methods.find((m) => m.name === methodName && !m.isStatic);
  return anyMatch?.descriptor;
}

/**
 * Look up the JVM method descriptor for a static method on a Java class.
 */
export function resolveStaticMethodDescriptorFromClassFile(
  javaClass: string,
  methodName: string,
  argCount: number,
): string | undefined {
  const info = loadJavaClass(javaClass);
  if (!info) return undefined;

  const method = info.methods.find(
    (m) => m.name === methodName && m.isStatic && m.paramTypes.length === argCount,
  );
  if (method) return method.descriptor;

  const anyMatch = info.methods.find((m) => m.name === methodName && m.isStatic);
  return anyMatch?.descriptor;
}

/**
 * Look up the type of a static field on a Java class by reading the class file.
 */
export function resolveStaticFieldTypeFromClassFile(
  javaClass: string,
  fieldName: string,
): JvmType | undefined {
  const info = loadJavaClass(javaClass);
  if (!info) return undefined;

  const field = info.fields.find((f) => f.name === fieldName && f.isStatic);
  return field?.type;
}

/**
 * Look up the type of an instance field on a Java class by reading the class file.
 */
export function resolveInstanceFieldTypeFromClassFile(
  javaClass: string,
  fieldName: string,
): JvmType | undefined {
  const info = loadJavaClass(javaClass);
  if (!info) return undefined;

  const field = info.fields.find((f) => f.name === fieldName && !f.isStatic);
  return field?.type;
}

/**
 * Check if a constructor with the given parameter count exists on a Java class.
 * Returns the constructor descriptor if found.
 */
export function resolveConstructorDescriptorFromClassFile(
  javaClass: string,
  argCount: number,
): string | undefined {
  const info = loadJavaClass(javaClass);
  if (!info) return undefined;

  const ctor = info.constructors.find((c) => c.paramTypes.length === argCount);
  return ctor?.descriptor;
}

/**
 * Clear all caches. Useful for testing or when classpath changes.
 */
export function clearClassFileCache(): void {
  classPathCache.clear();
  classInfoCache.clear();
  resolvedJavaHome = undefined;
}
