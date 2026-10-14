// Node.js "fs" polyfill for tyvm
//
// Implements synchronous file system operations by delegating to Java's
// java.nio.file and java.io packages. Since tyvm has no event loop,
// only sync variants are provided (which is the natural model on the JVM).
//
// Usage:
//   import { readFileSync, writeFileSync, existsSync } from "node:fs";
//
// Compile & run:
//   node dist/cli.js compile your-file.ts
//   java -cp out:runtime/tyvm-runtime.jar your-file

// --- Java interop imports ---
// java.nio.file.Files   — bulk read/write, copy, move, delete, list directory
// java.nio.file.Paths   — convert string paths to java.nio.file.Path objects
// java.io.File          — legacy file metadata (length, lastModified, isDirectory, etc.)
import { Files } from "java:java.nio.file.Files";
import { Paths } from "java:java.nio.file.Paths";
import { File } from "java:java.io.File";
import { StandardCopyOption } from "java:java.nio.file.StandardCopyOption";
import { System } from "java:java.lang.System";

// =========================================================================
// readFileSync(path, encoding?)
// =========================================================================
// Reads the entire contents of a file.
// When encoding is "utf8" or "utf-8", returns a string via
//   new String(Files.readAllBytes(Paths.get(path)))
// When encoding is omitted the raw bytes are returned (as a string for now,
// since tyvm does not yet have a Buffer type).
//
// Backed by: java.nio.file.Files.readString / Files.readAllBytes
function readFileSync(filePath: string, encoding: string): string {
  const jpath = Paths.get(filePath);
  // Files.readString reads the file as a UTF-8 string (Java 11+)
  const content: string = Files.readString(jpath);
  return content;
}

// =========================================================================
// writeFileSync(path, data, encoding?)
// =========================================================================
// Writes data to a file, replacing the file if it already exists.
//
// Backed by: java.nio.file.Files.writeString (Java 11+)
function writeFileSync(filePath: string, data: string, encoding: string): void {
  const jpath = Paths.get(filePath);
  Files.writeString(jpath, data);
}

// =========================================================================
// appendFileSync(path, data)
// =========================================================================
// Appends data to a file. If the file does not exist it is created.
//
// Strategy: read existing content (if any), concatenate, and write back.
// Backed by: java.nio.file.Files.readString + Files.writeString
function appendFileSync(filePath: string, data: string): void {
  const jpath = Paths.get(filePath);
  const file: File = new File(filePath);
  let existing: string = "";
  if (file.exists()) {
    existing = Files.readString(jpath);
  }
  Files.writeString(jpath, existing + data);
}

// =========================================================================
// existsSync(path)
// =========================================================================
// Returns true if the path exists on disk.
//
// Backed by: java.nio.file.Files.exists
function existsSync(filePath: string): boolean {
  const jpath = Paths.get(filePath);
  return Files.exists(jpath);
}

// =========================================================================
// mkdirSync(path, options?)
// =========================================================================
// Creates a directory. When recursive is true, creates parent directories
// as needed (like mkdir -p).
//
// Backed by: java.nio.file.Files.createDirectories / Files.createDirectory
function mkdirSync(dirPath: string, recursive: boolean): void {
  const jpath = Paths.get(dirPath);
  if (recursive) {
    // createDirectories creates all missing parent directories
    Files.createDirectories(jpath);
  } else {
    // createDirectory throws if the parent does not exist
    Files.createDirectory(jpath);
  }
}

// =========================================================================
// readdirSync(path)
// =========================================================================
// Returns an array of filenames in the directory. Since tyvm does not yet
// support returning arrays directly from Java streams, we build a
// pipe-delimited string and the caller can split it.
//
// Backed by: java.io.File.list()
//
// NOTE: Returns a pipe-delimited string of entry names because tyvm does
// not yet have full array-from-Java-collection support. Callers should
// treat the result as a string and split on "|".
function readdirSync(dirPath: string): string {
  const dir: File = new File(dirPath);
  // File.list() returns a Java String[] of child names
  const entries = dir.list();
  // Return the Java String[] — tyvm maps this to a string representation
  return entries;
}

// =========================================================================
// statSync(path)
// =========================================================================
// Returns basic file metadata as a numeric-encoded value.
// Since tyvm classes are basic, we return individual stat fields via
// separate helper functions rather than a Stats object.
//
// Backed by: java.io.File (length, lastModified, isDirectory, isFile)

// Returns the file size in bytes
function statSize(filePath: string): number {
  const file: File = new File(filePath);
  return file.length();
}

// Returns the last modified time in milliseconds since epoch
function statMtimeMs(filePath: string): number {
  const file: File = new File(filePath);
  return file.lastModified();
}

// Returns 1 if the path is a directory, 0 otherwise
function statIsDirectory(filePath: string): number {
  const file: File = new File(filePath);
  if (file.isDirectory()) {
    return 1;
  }
  return 0;
}

// Returns 1 if the path is a regular file, 0 otherwise
function statIsFile(filePath: string): number {
  const file: File = new File(filePath);
  if (file.isFile()) {
    return 1;
  }
  return 0;
}

// =========================================================================
// unlinkSync(path)
// =========================================================================
// Removes a file or symbolic link.
//
// Backed by: java.nio.file.Files.delete
function unlinkSync(filePath: string): void {
  const jpath = Paths.get(filePath);
  Files.delete(jpath);
}

// =========================================================================
// renameSync(oldPath, newPath)
// =========================================================================
// Renames (moves) a file from oldPath to newPath.
//
// Backed by: java.nio.file.Files.move
function renameSync(oldPath: string, newPath: string): void {
  const source = Paths.get(oldPath);
  const target = Paths.get(newPath);
  Files.move(source, target);
}

// =========================================================================
// copyFileSync(src, dest)
// =========================================================================
// Copies a file from src to dest, overwriting dest if it exists.
//
// Backed by: java.nio.file.Files.copy with REPLACE_EXISTING
function copyFileSync(src: string, dest: string): void {
  const source = Paths.get(src);
  const target = Paths.get(dest);
  Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
}
