/**
 * Java Interop Type Resolution Tables
 *
 * Centralized tables mapping well-known JDK class methods and fields
 * to their JVM types. Used by the lowerer to resolve types for Java
 * interop calls without relying on the TypeScript type checker.
 *
 * For classes not in these tables, falls back to the classfile reader
 * which can parse any .class file from the classpath or JDK modules.
 */

import type { JvmType } from "../ir/nodes.js";
import {
  resolveStaticMethodTypeFromClassFile,
  resolveInstanceMethodTypeFromClassFile,
  resolveInstanceMethodDescriptorFromClassFile,
  resolveStaticFieldTypeFromClassFile,
} from "./classfile-reader.js";

const TY_VOID: JvmType = { kind: "TyVoid" };
const TY_BOOLEAN: JvmType = { kind: "TyBoolean" };
const TY_INT: JvmType = { kind: "TyInt" };
const TY_DOUBLE: JvmType = { kind: "TyDouble" };
const TY_STRING: JvmType = { kind: "TyString" };
const TY_OBJECT: JvmType = { kind: "TyObject", className: "java/lang/Object" };

// ---------------------------------------------------------------------------
// Static method return types (class.method -> JvmType)
// ---------------------------------------------------------------------------

const STATIC_METHOD_TYPES: Record<string, JvmType> = {
  // java.lang.Math
  "java/lang/Math.sqrt": TY_DOUBLE,
  "java/lang/Math.abs": TY_DOUBLE,
  "java/lang/Math.sin": TY_DOUBLE,
  "java/lang/Math.cos": TY_DOUBLE,
  "java/lang/Math.tan": TY_DOUBLE,
  "java/lang/Math.log": TY_DOUBLE,
  "java/lang/Math.exp": TY_DOUBLE,
  "java/lang/Math.pow": TY_DOUBLE,
  "java/lang/Math.floor": TY_DOUBLE,
  "java/lang/Math.ceil": TY_DOUBLE,
  "java/lang/Math.random": TY_DOUBLE,
  "java/lang/Math.max": TY_DOUBLE,
  "java/lang/Math.min": TY_DOUBLE,

  // java.lang.System
  "java/lang/System.currentTimeMillis": { kind: "TyLong" },
  "java/lang/System.nanoTime": { kind: "TyLong" },
  "java/lang/System.exit": TY_VOID,
  "java/lang/System.getenv": TY_STRING,

  // java.lang.Integer
  "java/lang/Integer.parseInt": TY_INT,
  "java/lang/Integer.valueOf": TY_INT,
  "java/lang/Integer.toString": TY_STRING,

  // java.lang.Long
  "java/lang/Long.parseLong": { kind: "TyLong" },

  // java.lang.Double
  "java/lang/Double.parseDouble": TY_DOUBLE,

  // java.lang.String (static)
  "java/lang/String.valueOf": TY_STRING,
  "java/lang/String.format": TY_STRING,
  "java/lang/String.join": TY_STRING,

  // java.util.Arrays
  "java/util/Arrays.sort": TY_VOID,
  "java/util/Arrays.fill": TY_VOID,
  "java/util/Arrays.toString": TY_STRING,

  // java.util.Collections
  "java/util/Collections.sort": TY_VOID,
  "java/util/Collections.reverse": TY_VOID,

  // tyvm.runtime.HttpServer$Response (static factory methods)
  "tyvm/runtime/HttpServer$Response.ok": { kind: "TyObject", className: "tyvm/runtime/HttpServer$Response" },
  "tyvm/runtime/HttpServer$Response.json": { kind: "TyObject", className: "tyvm/runtime/HttpServer$Response" },
  "tyvm/runtime/HttpServer$Response.notFound": { kind: "TyObject", className: "tyvm/runtime/HttpServer$Response" },
  "tyvm/runtime/HttpServer$Response.error": { kind: "TyObject", className: "tyvm/runtime/HttpServer$Response" },

  // tyvm.runtime.HttpServer$Request (instance methods)

  // java.nio.file.Path
  "java/nio/file/Path.of": { kind: "TyObject", className: "java/nio/file/Path" },

  // java.nio.file.Files
  "java/nio/file/Files.readString": TY_STRING,
  "java/nio/file/Files.writeString": { kind: "TyObject", className: "java/nio/file/Path" },
  "java/nio/file/Files.exists": TY_BOOLEAN,
  "java/nio/file/Files.delete": TY_VOID,
  "java/nio/file/Files.createDirectories": { kind: "TyObject", className: "java/nio/file/Path" },
  "java/nio/file/Files.size": { kind: "TyLong" },
  "java/nio/file/Files.isDirectory": TY_BOOLEAN,
  "java/nio/file/Files.isRegularFile": TY_BOOLEAN,

  // java.lang.Thread
  "java/lang/Thread.currentThread": { kind: "TyObject", className: "java/lang/Thread" },
  "java/lang/Thread.sleep": TY_VOID,

  // java.lang.System (property access)
  "java/lang/System.getProperty": TY_STRING,

  // tyvm.runtime.Channel (factory method)
  "tyvm/runtime/Channel.make": { kind: "TyObject", className: "tyvm/runtime/Channel" },

  // tyvm.runtime.DurableTask
  "tyvm/runtime/DurableTask.create": { kind: "TyObject", className: "tyvm/runtime/DurableTask" },
  "tyvm/runtime/DurableTask.checkpoint": TY_VOID,
  "tyvm/runtime/DurableTask.recover": TY_STRING,
  "tyvm/runtime/DurableTask.usePostgres": TY_VOID,
  "tyvm/runtime/DurableTask.useRedis": TY_VOID,

  // tyvm.runtime.DurableTask$Workflow
  "tyvm/runtime/DurableTask$Workflow.sequential": { kind: "TyObject", className: "tyvm/runtime/DurableTask$TaskResult" },
  "tyvm/runtime/DurableTask$Workflow.parallel": { kind: "TyArray", elementType: { kind: "TyObject", className: "tyvm/runtime/DurableTask$TaskResult" } },
  "tyvm/runtime/DurableTask$Workflow.race": { kind: "TyObject", className: "tyvm/runtime/DurableTask$TaskResult" },
  "tyvm/runtime/DurableTask$Workflow.saga": { kind: "TyObject", className: "tyvm/runtime/DurableTask$TaskResult" },
};

/**
 * Look up the return type for a static method on a Java class.
 * Checks the hardcoded table first, then falls back to reading the .class file.
 */
export function resolveStaticMethodType(javaClass: string, method: string): JvmType | undefined {
  return STATIC_METHOD_TYPES[`${javaClass}.${method}`]
    ?? resolveStaticMethodTypeFromClassFile(javaClass, method);
}

// ---------------------------------------------------------------------------
// Instance method return types (by method name, class-agnostic)
// ---------------------------------------------------------------------------

const INSTANCE_METHOD_TYPES: Record<string, JvmType> = {
  // Collection / List / Map
  size: TY_INT,
  isEmpty: TY_BOOLEAN,
  contains: TY_BOOLEAN,
  containsKey: TY_BOOLEAN,
  containsValue: TY_BOOLEAN,
  add: TY_BOOLEAN,
  remove: TY_BOOLEAN,
  offer: TY_BOOLEAN,
  addAll: TY_BOOLEAN,
  retainAll: TY_BOOLEAN,
  removeAll: TY_BOOLEAN,
  get: TY_OBJECT,
  put: TY_OBJECT,
  set: TY_OBJECT,
  peek: TY_OBJECT,
  poll: TY_OBJECT,
  getOrDefault: TY_OBJECT,
  clear: TY_VOID,
  sort: TY_VOID,
  forEach: TY_VOID,
  indexOf: TY_INT,
  lastIndexOf: TY_INT,
  hashCode: TY_INT,
  compareTo: TY_INT,
  length: TY_INT,
  toString: TY_STRING,
  toArray: { kind: "TyArray", elementType: TY_OBJECT },
  iterator: { kind: "TyObject", className: "java/util/Iterator" },
  keySet: { kind: "TyObject", className: "java/util/Set" },
  entrySet: { kind: "TyObject", className: "java/util/Set" },
  values: { kind: "TyObject", className: "java/util/Collection" },
  subList: { kind: "TyObject", className: "java/util/List" },

  // String instance methods
  charAt: TY_INT,
  substring: TY_STRING,
  trim: TY_STRING,
  toLowerCase: TY_STRING,
  toUpperCase: TY_STRING,
  replace: TY_STRING,
  replaceAll: TY_STRING,
  concat: TY_STRING,
  strip: TY_STRING,
  startsWith: TY_BOOLEAN,
  endsWith: TY_BOOLEAN,
  equals: TY_BOOLEAN,
  equalsIgnoreCase: TY_BOOLEAN,
  matches: TY_BOOLEAN,
  split: { kind: "TyArray", elementType: TY_STRING },
  getBytes: { kind: "TyArray", elementType: TY_INT },

  // PrintStream / IO
  println: TY_VOID,
  print: TY_VOID,
  flush: TY_VOID,
  close: TY_VOID,

  // Iterator
  hasNext: TY_BOOLEAN,
  next: TY_OBJECT,

  // tyvm.runtime.HttpServer$Request
  getMethod: TY_STRING,
  getUrl: TY_STRING,
  getBody: TY_STRING,

  // tyvm.runtime.HttpServer$Response
  getStatus: TY_INT,
  getContentType: TY_STRING,

  // tyvm.runtime.DurableTask
  retry: { kind: "TyObject", className: "tyvm/runtime/DurableTask" },
  timeout: { kind: "TyObject", className: "tyvm/runtime/DurableTask" },
  run: { kind: "TyObject", className: "tyvm/runtime/TaskResult" },

  // tyvm.runtime.TaskResult
  isSuccess: TY_BOOLEAN,
  isFailure: TY_BOOLEAN,
  value: TY_OBJECT,
  error: TY_STRING,
  duration: { kind: "TyLong" },

  // java.io.File
  exists: TY_BOOLEAN,
  isDirectory: TY_BOOLEAN,
  isFile: TY_BOOLEAN,
  canRead: TY_BOOLEAN,
  canWrite: TY_BOOLEAN,
  getName: TY_STRING,
  getPath: TY_STRING,
  getAbsolutePath: TY_STRING,
  getParent: TY_STRING,
  delete: TY_BOOLEAN,
  mkdir: TY_BOOLEAN,
  mkdirs: TY_BOOLEAN,
};

/**
 * Look up the return type for a Java instance method by name.
 * Checks the hardcoded table first. Note: class-aware classfile fallback
 * is handled via resolveInstanceMethodTypeForClass() below.
 */
export function resolveInstanceMethodType(method: string): JvmType | undefined {
  return INSTANCE_METHOD_TYPES[method];
}

/**
 * Look up the return type for a Java instance method with class context.
 * Checks the hardcoded (class-agnostic) table first, then falls back to
 * reading the .class file for the specific class.
 */
export function resolveInstanceMethodTypeForClass(
  javaClass: string,
  method: string,
): JvmType | undefined {
  return INSTANCE_METHOD_TYPES[method]
    ?? resolveInstanceMethodTypeFromClassFile(javaClass, method);
}

// ---------------------------------------------------------------------------
// Instance method descriptors (for type-erased generics)
// ---------------------------------------------------------------------------

/**
 * Resolve the JVM method descriptor for a Java interop instance method call.
 * Handles type erasure for generic collection classes where parameters are
 * Object in the bytecode but typed in TypeScript.
 *
 * Returns undefined if no explicit descriptor override is needed.
 */
export function resolveInstanceMethodDescriptor(
  javaClass: string,
  method: string,
  argCount: number,
  firstArgIsInt: boolean,
): string | undefined {
  if (!javaClass.startsWith("java/util/")) {
    return resolveInstanceMethodDescriptorFromClassFile(javaClass, method, argCount);
  }

  switch (method) {
    case "add":
      if (argCount === 1) return "(Ljava/lang/Object;)Z";
      if (argCount === 2) return "(ILjava/lang/Object;)V";
      return undefined;
    case "get":
      return "(I)Ljava/lang/Object;";
    case "set":
      return "(ILjava/lang/Object;)Ljava/lang/Object;";
    case "remove":
      if (argCount === 1) {
        return firstArgIsInt
          ? "(I)Ljava/lang/Object;"
          : "(Ljava/lang/Object;)Z";
      }
      return undefined;
    case "contains":
      return "(Ljava/lang/Object;)Z";
    case "indexOf":
    case "lastIndexOf":
      return "(Ljava/lang/Object;)I";
    case "size":
      return "()I";
    case "isEmpty":
      return "()Z";
    case "clear":
      return "()V";
    case "toString":
      return "()Ljava/lang/String;";
    case "toArray":
      return "()[Ljava/lang/Object;";
    case "put":
      return "(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;";
    case "containsKey":
    case "containsValue":
      return "(Ljava/lang/Object;)Z";
    case "iterator":
      return "()Ljava/util/Iterator;";
    case "sort":
      return "(Ljava/util/Comparator;)V";
    case "addAll":
      return "(Ljava/util/Collection;)Z";
    case "subList":
      return "(II)Ljava/util/List;";
    default:
      // Fall back to classfile reader for unknown methods
      return resolveInstanceMethodDescriptorFromClassFile(javaClass, method, argCount);
  }
}

// ---------------------------------------------------------------------------
// Static field types
// ---------------------------------------------------------------------------

const STATIC_FIELD_TYPES: Record<string, JvmType> = {
  // java.lang.Math
  "java/lang/Math.PI": TY_DOUBLE,
  "java/lang/Math.E": TY_DOUBLE,

  // java.lang.Integer
  "java/lang/Integer.MAX_VALUE": TY_INT,
  "java/lang/Integer.MIN_VALUE": TY_INT,

  // java.lang.Long
  "java/lang/Long.MAX_VALUE": { kind: "TyLong" },
  "java/lang/Long.MIN_VALUE": { kind: "TyLong" },

  // java.lang.Double
  "java/lang/Double.MAX_VALUE": TY_DOUBLE,
  "java/lang/Double.MIN_VALUE": TY_DOUBLE,
  "java/lang/Double.NaN": TY_DOUBLE,
  "java/lang/Double.POSITIVE_INFINITY": TY_DOUBLE,
  "java/lang/Double.NEGATIVE_INFINITY": TY_DOUBLE,

  // java.lang.System streams
  "java/lang/System.out": { kind: "TyObject", className: "java/io/PrintStream" },
  "java/lang/System.err": { kind: "TyObject", className: "java/io/PrintStream" },
  "java/lang/System.in": { kind: "TyObject", className: "java/io/InputStream" },

  // java.lang.Boolean
  "java/lang/Boolean.TRUE": { kind: "TyObject", className: "java/lang/Boolean" },
  "java/lang/Boolean.FALSE": { kind: "TyObject", className: "java/lang/Boolean" },
};

/**
 * Look up the type of a static field on a Java class.
 * Checks the hardcoded table first, then falls back to reading the .class file.
 */
export function resolveStaticFieldType(javaClass: string, fieldName: string): JvmType | undefined {
  return STATIC_FIELD_TYPES[`${javaClass}.${fieldName}`]
    ?? resolveStaticFieldTypeFromClassFile(javaClass, fieldName);
}
