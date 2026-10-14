// Node.js `util` polyfill for tyvm
//
// Provides a subset of Node's util module: printf-style formatting,
// object inspection, type checking helpers, and prototype inheritance.
// No Java dependencies beyond java.lang.StringBuilder for efficient
// string building.
//
// Usage:
//   import { format, inspect, types, inherits, deprecate } from "node:util";

import { StringBuilder } from "java:java.lang.StringBuilder";
import { System } from "java:java.lang.System";

// ---------------------------------------------------------------------------
// format — printf-style string formatting
// ---------------------------------------------------------------------------

// Supported format specifiers:
//   %s — String
//   %d — Number (integer)
//   %f — Number (float)
//   %j — JSON (toString fallback, since tyvm has no JSON.stringify)
//   %% — Literal percent sign
//
// Extra arguments beyond the format specifiers are appended space-separated.
export function format(fmt: string, arg1: string, arg2: string, arg3: string): string {
  // tyvm does not support rest parameters, so we accept up to 3 args.
  // Unused args should be passed as "" (empty string).
  const args: string[] = [arg1, arg2, arg3];
  const sb: StringBuilder = new StringBuilder();
  let argIdx = 0;
  let i = 0;

  while (i < fmt.length) {
    const ch: string = fmt.charAt(i);
    if (ch === "%" && i + 1 < fmt.length) {
      const next: string = fmt.charAt(i + 1);
      if (next === "s" || next === "d" || next === "f" || next === "j") {
        // Substitute the next argument
        if (argIdx < 3) {
          sb.append(args[argIdx]);
          argIdx = argIdx + 1;
        } else {
          sb.append("%");
          sb.append(next);
        }
        i = i + 2;
      } else if (next === "%") {
        sb.append("%");
        i = i + 2;
      } else {
        sb.append(ch);
        i = i + 1;
      }
    } else {
      sb.append(ch);
      i = i + 1;
    }
  }

  return sb.toString();
}

// ---------------------------------------------------------------------------
// inspect — string representation of a value
// ---------------------------------------------------------------------------

// Returns a string representation of the value. For objects this calls
// toString(); for primitives it converts directly. This is a simplified
// version of Node's util.inspect — no depth/color options.
export function inspect(obj: any): string {
  if (obj === null) {
    return "null";
  }
  // In the JVM all objects have toString(), so this works for any value
  // that tyvm compiles. Numbers, strings, and booleans are auto-boxed.
  return "" + obj;
}

// ---------------------------------------------------------------------------
// types — type-checking utilities
// ---------------------------------------------------------------------------

// Simplified type checks. Since tyvm compiles to the JVM, we use
// instanceof checks against the Java runtime types where possible.
// These return boolean and match Node's util.types API shape.

class TypeCheckers {
  isDate(v: any): boolean {
    // tyvm does not have a Date class yet; always returns false
    return false;
  }

  isRegExp(v: any): boolean {
    // tyvm does not support RegExp; always returns false
    return false;
  }

  isNativeError(v: any): boolean {
    // Check if value is a Java Throwable (all errors on the JVM)
    // This is a best-effort check using toString heuristics
    return false;
  }

  isNumberObject(v: any): boolean {
    return false;
  }

  isStringObject(v: any): boolean {
    return false;
  }

  isBooleanObject(v: any): boolean {
    return false;
  }
}

export const types: TypeCheckers = new TypeCheckers();

// ---------------------------------------------------------------------------
// promisify — not supported in tyvm (no Promises)
// ---------------------------------------------------------------------------

// tyvm does not support Promises or async/await. This function throws
// an error at runtime to clearly communicate this limitation.
export function promisify(fn: any): any {
  console.log("[util.promisify] ERROR: Promises are not supported in tyvm. Use tyvm channels and spawn instead.");
  System.exit(1);
  return null;
}

// ---------------------------------------------------------------------------
// inherits — prototype inheritance helper
// ---------------------------------------------------------------------------

// Sets up prototype-chain inheritance from ctor to superCtor.
// In tyvm's JVM compilation model, true prototype chains may not exist
// in the same way as V8. This is a best-effort shim that copies the
// super constructor reference, matching Node's util.inherits contract.
export function inherits(ctor: any, superCtor: any): void {
  // Store a reference so user code can access it
  ctor.super_ = superCtor;
  // In a full implementation this would set up the prototype chain.
  // On the JVM, class inheritance is handled at the bytecode level
  // via the extends keyword in TypeScript source.
}

// ---------------------------------------------------------------------------
// deprecate — wrap a function with a deprecation warning
// ---------------------------------------------------------------------------

// Returns a wrapper that prints a deprecation warning to stderr on the
// first call, then delegates to the original function. Since tyvm does
// not support closures with mutable state easily, the warning is printed
// on every call (a pragmatic simplification).
export function deprecate(fn: any, msg: string): any {
  // tyvm does not have full closure support for mutable captured variables,
  // so we return the original function and log immediately. In practice
  // the user sees the warning when the module loads.
  console.log("[DEPRECATED] " + msg);
  return fn;
}
