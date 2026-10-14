// Java interop: File I/O using java.io
//
// Demonstrates using Java standard library classes for file operations,
// showcasing the tyvm Java interop system with real-world APIs.

import { File } from "java:java.io.File";
import { System } from "java:java.lang.System";

function main(): void {
  // Get the temp directory
  const tmpDir: string = System.getProperty("java.io.tmpdir");
  console.log(tmpDir);

  // Check if a file exists using java.io.File
  const f: File = new File("/tmp");
  const exists: boolean = f.exists();
  console.log(exists);

  const isDir: boolean = f.isDirectory();
  console.log(isDir);

  const name: string = f.getName();
  console.log(name);
}
