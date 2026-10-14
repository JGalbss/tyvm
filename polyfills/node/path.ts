// Node.js "path" polyfill for tyvm
//
// Implements path manipulation functions using pure string operations.
// Uses java.io.File.separator and java.lang.System to resolve the
// platform-specific separator and current working directory.
//
// Usage:
//   import { join, resolve, dirname, basename, extname } from "node:path";
//
// Compile & run:
//   node dist/cli.js compile your-file.ts
//   java -cp out:runtime/tyvm-runtime.jar your-file

// --- Java interop imports ---
// java.io.File     — provides File.separator for the platform path separator
// java.lang.System — provides System.getProperty for cwd and OS detection
import { File } from "java:java.io.File";
import { System } from "java:java.lang.System";

// =========================================================================
// sep — platform-specific path separator ("/" on Unix, "\" on Windows)
// =========================================================================
// Backed by: java.io.File.separator
const sep: string = File.separator;

// =========================================================================
// delimiter — platform-specific path delimiter (":" on Unix, ";" on Windows)
// =========================================================================
// Backed by: java.io.File.pathSeparator
const delimiter: string = File.pathSeparator;

// =========================================================================
// isAbsolute(p) — returns true if the path is absolute
// =========================================================================
// A path is absolute if it starts with "/" (Unix) or a drive letter (Windows).
// Backed by: string inspection (charAt / first character check)
function isAbsolute(p: string): boolean {
  if (p.length === 0) {
    return false;
  }
  // Unix absolute paths start with "/"
  const first: string = p.charAt(0);
  if (first === "/") {
    return true;
  }
  // Windows absolute paths: check for drive letter like "C:\"
  // Since tyvm is on the JVM, also check File.separator for "\"
  if (p.length >= 3) {
    const second: string = p.charAt(1);
    const third: string = p.charAt(2);
    if (second === ":" && (third === "/" || third === "\\")) {
      return true;
    }
  }
  return false;
}

// =========================================================================
// normalize(p) — normalizes a path by resolving ".." and "." segments
//                and collapsing repeated separators
// =========================================================================
// Strategy: split on "/" and "\", process segments, rebuild with sep.
// Since tyvm lacks array support, we use java.io.File which normalizes
// paths internally via its constructor.
//
// Backed by: java.io.File (constructor normalizes the path)
function normalize(p: string): string {
  const f: File = new File(p);
  return f.getPath();
}

// =========================================================================
// join(...paths) — joins path segments with the platform separator
// =========================================================================
// Since tyvm does not support rest parameters or arrays, we provide
// overloads for common arities (2, 3, 4 segments).
//
// Backed by: java.io.File constructor chaining
//   new File(parent, child) joins two path segments

function join2(a: string, b: string): string {
  // Use File(parent, child) to join, which handles separator insertion
  const f: File = new File(a, b);
  return f.getPath();
}

function join3(a: string, b: string, c: string): string {
  const ab: File = new File(a, b);
  const abc: File = new File(ab.getPath(), c);
  return abc.getPath();
}

function join4(a: string, b: string, c: string, d: string): string {
  const ab: File = new File(a, b);
  const abc: File = new File(ab.getPath(), c);
  const abcd: File = new File(abc.getPath(), d);
  return abcd.getPath();
}

// =========================================================================
// resolve(...paths) — resolves a sequence of paths to an absolute path
// =========================================================================
// Processes segments right to left; if an absolute segment is encountered,
// it becomes the base. Otherwise the current working directory is prepended.
//
// Backed by: java.io.File (getAbsolutePath) + java.lang.System (user.dir)

function resolve1(a: string): string {
  const f: File = new File(a);
  return f.getAbsolutePath();
}

function resolve2(a: string, b: string): string {
  // If b is absolute, it is the result; otherwise resolve relative to a
  if (isAbsolute(b)) {
    const f: File = new File(b);
    return f.getAbsolutePath();
  }
  const base: File = new File(a);
  const combined: File = new File(base.getAbsolutePath(), b);
  return combined.getAbsolutePath();
}

function resolve3(a: string, b: string, c: string): string {
  const ab: string = resolve2(a, b);
  return resolve2(ab, c);
}

// =========================================================================
// dirname(p) — returns the directory portion of a path
// =========================================================================
// Backed by: java.io.File.getParent()
function dirname(p: string): string {
  const f: File = new File(p);
  const parent: string = f.getParent();
  if (parent === null) {
    return ".";
  }
  return parent;
}

// =========================================================================
// basename(p, ext?) — returns the last portion of a path
// =========================================================================
// Optionally strips a trailing extension if provided.
//
// Backed by: java.io.File.getName()
function basename(p: string): string {
  const f: File = new File(p);
  return f.getName();
}

function basenameWithExt(p: string, ext: string): string {
  const f: File = new File(p);
  const name: string = f.getName();
  // If the name ends with the given extension, strip it
  if (name.endsWith(ext)) {
    const endIdx: number = name.length() - ext.length();
    return name.substring(0, endIdx);
  }
  return name;
}

// =========================================================================
// extname(p) — returns the extension of the path (including the dot)
// =========================================================================
// Scans from the end of the basename for the last "." character.
//
// Backed by: java.io.File.getName() + String.lastIndexOf
function extname(p: string): string {
  const f: File = new File(p);
  const name: string = f.getName();
  const dotIndex: number = name.lastIndexOf(".");
  if (dotIndex <= 0) {
    // No dot, or dot is the first character (hidden file like ".gitignore")
    return "";
  }
  return name.substring(dotIndex);
}
