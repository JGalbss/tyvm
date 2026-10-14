// ==========================================================================
// Node.js `assert` polyfill for tyvm
// ==========================================================================
//
// Implements the core assertion functions: ok, equal, notEqual,
// strictEqual, notStrictEqual, deepEqual, throws, doesNotThrow,
// and fail. Assertions throw an AssertionError (modeled as a Java
// RuntimeException) when they fail.
//
// Java backing classes:
//   java.lang.RuntimeException — thrown on assertion failure
//   java.lang.StringBuilder    — build error messages
//
// Usage:
//   import { ok, equal, strictEqual, deepEqual, throws } from "node:assert";

import { RuntimeException } from "java:java.lang.RuntimeException";
import { StringBuilder } from "java:java.lang.StringBuilder";

// ---------------------------------------------------------------------------
// AssertionError
// ---------------------------------------------------------------------------
// Node.js has a dedicated AssertionError class. We throw a
// RuntimeException with a descriptive message since tyvm classes
// cannot extend Java exception types directly.

function _fail(message: string): void {
  throw new RuntimeException("AssertionError: " + message);
}

function _buildMessage(userMessage: string, defaultMessage: string): string {
  if (userMessage !== null && userMessage !== "") {
    return userMessage;
  }
  return defaultMessage;
}

// ---------------------------------------------------------------------------
// ok(value, message?)
// ---------------------------------------------------------------------------
// Assert that `value` is truthy. Throws if value is null, undefined,
// false, 0, or empty string.

export function ok(value: any, message: string): void {
  if (!value) {
    _fail(_buildMessage(message, "Expected value to be truthy"));
  }
}

// ---------------------------------------------------------------------------
// equal(actual, expected, message?)
// ---------------------------------------------------------------------------
// Assert loose equality (==). In tyvm, == and === compile to the same
// JVM comparison, so this behaves like strictEqual for primitives.

export function equal(actual: any, expected: any, message: string): void {
  if (actual != expected) {
    const sb: StringBuilder = new StringBuilder();
    sb.append("Expected ");
    sb.append(actual);
    sb.append(" == ");
    sb.append(expected);
    _fail(_buildMessage(message, sb.toString()));
  }
}

// ---------------------------------------------------------------------------
// notEqual(actual, expected, message?)
// ---------------------------------------------------------------------------
// Assert that actual != expected.

export function notEqual(actual: any, expected: any, message: string): void {
  if (actual == expected) {
    const sb: StringBuilder = new StringBuilder();
    sb.append("Expected ");
    sb.append(actual);
    sb.append(" != ");
    sb.append(expected);
    _fail(_buildMessage(message, sb.toString()));
  }
}

// ---------------------------------------------------------------------------
// strictEqual(actual, expected, message?)
// ---------------------------------------------------------------------------
// Assert strict equality (===). On the JVM, this checks reference
// equality for objects and value equality for primitives.

export function strictEqual(actual: any, expected: any, message: string): void {
  if (actual !== expected) {
    const sb: StringBuilder = new StringBuilder();
    sb.append("Expected ");
    sb.append(actual);
    sb.append(" === ");
    sb.append(expected);
    _fail(_buildMessage(message, sb.toString()));
  }
}

// ---------------------------------------------------------------------------
// notStrictEqual(actual, expected, message?)
// ---------------------------------------------------------------------------
// Assert that actual !== expected.

export function notStrictEqual(actual: any, expected: any, message: string): void {
  if (actual === expected) {
    const sb: StringBuilder = new StringBuilder();
    sb.append("Expected ");
    sb.append(actual);
    sb.append(" !== ");
    sb.append(expected);
    _fail(_buildMessage(message, sb.toString()));
  }
}

// ---------------------------------------------------------------------------
// deepEqual(actual, expected, message?)
// ---------------------------------------------------------------------------
// Assert deep equality using Java's Object.equals(). For Java objects
// (HashMap, ArrayList, etc.), this delegates to their equals() method
// which performs structural comparison. For primitives, it is value
// equality.

export function deepEqual(actual: any, expected: any, message: string): void {
  // Use Java Object.equals() for structural comparison.
  // For Java collections (HashMap, ArrayList), .equals() does deep comparison.
  let isEqual: boolean = false;

  if (actual === null && expected === null) {
    isEqual = true;
  } else if (actual === null || expected === null) {
    isEqual = false;
  } else {
    isEqual = actual.equals(expected);
  }

  if (!isEqual) {
    const sb: StringBuilder = new StringBuilder();
    sb.append("Expected deep equality between ");
    sb.append(actual);
    sb.append(" and ");
    sb.append(expected);
    _fail(_buildMessage(message, sb.toString()));
  }
}

// ---------------------------------------------------------------------------
// notDeepEqual(actual, expected, message?)
// ---------------------------------------------------------------------------
// Assert that actual and expected are NOT deeply equal.

export function notDeepEqual(actual: any, expected: any, message: string): void {
  let isEqual: boolean = false;

  if (actual === null && expected === null) {
    isEqual = true;
  } else if (actual === null || expected === null) {
    isEqual = false;
  } else {
    isEqual = actual.equals(expected);
  }

  if (isEqual) {
    _fail(_buildMessage(message, "Expected values to not be deeply equal"));
  }
}

// ---------------------------------------------------------------------------
// throws(fn, message?)
// ---------------------------------------------------------------------------
// Assert that the given function throws an exception when called.
// Returns the caught exception message, or throws AssertionError if
// fn does not throw.

export function throws(fn: any, message: string): string {
  let threw: boolean = false;
  let errorMsg: string = "";

  try {
    fn();
  } catch (e: any) {
    threw = true;
    errorMsg = e.getMessage();
  }

  if (!threw) {
    _fail(_buildMessage(message, "Expected function to throw"));
  }

  return errorMsg;
}

// ---------------------------------------------------------------------------
// doesNotThrow(fn, message?)
// ---------------------------------------------------------------------------
// Assert that the given function does NOT throw an exception.

export function doesNotThrow(fn: any, message: string): void {
  let threw: boolean = false;
  let errorMsg: string = "";

  try {
    fn();
  } catch (e: any) {
    threw = true;
    errorMsg = e.getMessage();
  }

  if (threw) {
    const sb: StringBuilder = new StringBuilder();
    sb.append("Expected function not to throw, but it threw: ");
    sb.append(errorMsg);
    _fail(_buildMessage(message, sb.toString()));
  }
}

// ---------------------------------------------------------------------------
// fail(message?)
// ---------------------------------------------------------------------------
// Always throws an AssertionError. Used to mark unreachable code paths.

export function fail(message: string): void {
  _fail(_buildMessage(message, "Failed"));
}
