// ============================================================================
// JVM Type Descriptor Utilities
// ============================================================================

import type { JvmType } from "../ir/nodes.js";

/**
 * Converts an IR JvmType to its JVM type descriptor string.
 *
 * Examples:
 *   TyInt    -> "I"
 *   TyDouble -> "D"
 *   TyString -> "Ljava/lang/String;"
 *   TyArray({ elementType: TyInt }) -> "[I"
 */
export function typeToDescriptor(type: JvmType): string {
  switch (type.kind) {
    case "TyVoid":
      return "V";
    case "TyBoolean":
      return "Z";
    case "TyInt":
      return "I";
    case "TyLong":
      return "J";
    case "TyFloat":
      return "F";
    case "TyDouble":
      return "D";
    case "TyString":
      return "Ljava/lang/String;";
    case "TyArray":
      return "[" + typeToDescriptor(type.elementType);
    case "TyObject":
      return "L" + type.className.replace(/\./g, "/") + ";";
    case "TyTask":
      return "Ltyvm/runtime/Task;";
    case "TyChannel":
      return "Ltyvm/runtime/Channel;";
  }
}

/**
 * Builds a JVM method descriptor from parameter types and a return type.
 *
 * Example: methodDescriptor([TyDouble, TyDouble], TyDouble) -> "(DD)D"
 */
export function methodDescriptor(params: JvmType[], returnType: JvmType): string {
  const paramDescriptors = params.map(typeToDescriptor).join("");
  return "(" + paramDescriptors + ")" + typeToDescriptor(returnType);
}

/**
 * Returns the JVM internal name (slash-separated) for a type.
 * For reference types this is the class name without the L...; wrapper.
 * For primitives, returns the single-char descriptor.
 *
 * Examples:
 *   TyString -> "java/lang/String"
 *   TyObject("com.example.Foo") -> "com/example/Foo"
 *   TyInt -> "I"
 */
export function typeToInternalName(type: JvmType): string {
  switch (type.kind) {
    case "TyVoid":
      return "V";
    case "TyBoolean":
      return "Z";
    case "TyInt":
      return "I";
    case "TyLong":
      return "J";
    case "TyFloat":
      return "F";
    case "TyDouble":
      return "D";
    case "TyString":
      return "java/lang/String";
    case "TyArray":
      return "[" + typeToDescriptor(type.elementType);
    case "TyObject":
      return type.className.replace(/\./g, "/");
    case "TyTask":
      return "tyvm/runtime/Task";
    case "TyChannel":
      return "tyvm/runtime/Channel";
  }
}

/**
 * Returns the number of local variable / operand stack slots a type occupies.
 * Long and Double take 2 slots; everything else takes 1.
 */
export function typeSlotSize(type: JvmType): number {
  switch (type.kind) {
    case "TyLong":
    case "TyDouble":
      return 2;
    default:
      return 1;
  }
}

/**
 * Parse the parameter types from a JVM method descriptor.
 * E.g., "(ILjava/lang/Object;)Z" -> [TyInt, TyObject("java/lang/Object")]
 */
export function parseDescriptorParams(descriptor: string): JvmType[] {
  const params: JvmType[] = [];
  // Strip the parens and return type: "(...)R" -> extract between ( and )
  const openParen = descriptor.indexOf("(");
  const closeParen = descriptor.indexOf(")");
  if (openParen < 0 || closeParen < 0) return params;

  let i = openParen + 1;
  const paramStr = descriptor.substring(0, closeParen);

  while (i < paramStr.length) {
    const ch = paramStr[i];
    switch (ch) {
      case "I":
        params.push({ kind: "TyInt" });
        i++;
        break;
      case "J":
        params.push({ kind: "TyLong" });
        i++;
        break;
      case "F":
        params.push({ kind: "TyFloat" });
        i++;
        break;
      case "D":
        params.push({ kind: "TyDouble" });
        i++;
        break;
      case "Z":
        params.push({ kind: "TyBoolean" });
        i++;
        break;
      case "V":
        params.push({ kind: "TyVoid" });
        i++;
        break;
      case "L": {
        // Object type: Lcom/example/Foo;
        const semi = paramStr.indexOf(";", i);
        if (semi < 0) { i++; break; }
        const className = paramStr.substring(i + 1, semi);
        if (className === "java/lang/String") {
          params.push({ kind: "TyString" });
        } else {
          params.push({ kind: "TyObject", className });
        }
        i = semi + 1;
        break;
      }
      case "[": {
        // Array type: [I, [Ljava/lang/Object;, etc.
        // For simplicity, find the element type
        let arrayDepth = 0;
        while (i < paramStr.length && paramStr[i] === "[") {
          arrayDepth++;
          i++;
        }
        // Parse the element type (just one level for now)
        const elemCh = paramStr[i];
        let elementType: JvmType;
        if (elemCh === "L") {
          const semi = paramStr.indexOf(";", i);
          const className = paramStr.substring(i + 1, semi);
          elementType = className === "java/lang/String"
            ? { kind: "TyString" }
            : { kind: "TyObject", className };
          i = semi + 1;
        } else {
          switch (elemCh) {
            case "I": elementType = { kind: "TyInt" }; break;
            case "J": elementType = { kind: "TyLong" }; break;
            case "F": elementType = { kind: "TyFloat" }; break;
            case "D": elementType = { kind: "TyDouble" }; break;
            case "Z": elementType = { kind: "TyBoolean" }; break;
            default: elementType = { kind: "TyObject", className: "java/lang/Object" }; break;
          }
          i++;
        }
        // Wrap in TyArray for each depth level
        let arrType: JvmType = elementType;
        for (let d = 0; d < arrayDepth; d++) {
          arrType = { kind: "TyArray", elementType: arrType };
        }
        params.push(arrType);
        break;
      }
      default:
        i++;
        break;
    }
  }

  return params;
}
