// ==========================================================================
// Node.js `readline` polyfill for tyvm
// ==========================================================================
//
// Implements createInterface and question for interactive line-by-line
// input from stdin (or any input stream). Since tyvm has no event loop,
// reading is synchronous and blocking.
//
// Java backing classes:
//   java.io.BufferedReader    — efficient line-by-line reading
//   java.io.InputStreamReader — bridge byte stream to character reader
//   java.lang.System          — access to System.in and System.out
//
// Usage:
//   import { createInterface, question } from "node:readline";

import { BufferedReader } from "java:java.io.BufferedReader";
import { InputStreamReader } from "java:java.io.InputStreamReader";
import { System } from "java:java.lang.System";
import { ArrayList } from "java:java.util.ArrayList";

// ---------------------------------------------------------------------------
// Interface — wraps a BufferedReader for line-by-line input
// ---------------------------------------------------------------------------

export class Interface {
  _reader: BufferedReader;
  _closed: boolean;

  constructor(reader: BufferedReader) {
    this._reader = reader;
    this._closed = false;
  }

  // ---- question(prompt) -> string ----------------------------------------
  // Display a prompt on stdout, then read one line of input.
  // Returns the user's input (without trailing newline), or null if
  // the input stream has ended.
  //
  // Backed by: System.out.print + BufferedReader.readLine()

  question(prompt: string): string {
    if (this._closed) {
      return null;
    }
    System.out.print(prompt);
    System.out.flush();
    const line: string = this._reader.readLine();
    return line;
  }

  // ---- readLine() -> string ----------------------------------------------
  // Read a single line without displaying a prompt.
  //
  // Backed by: BufferedReader.readLine()

  readLine(): string {
    if (this._closed) {
      return null;
    }
    return this._reader.readLine();
  }

  // ---- readAllLines() -> ArrayList<string> --------------------------------
  // Read all remaining lines until EOF. Returns an ArrayList of strings.
  //
  // Backed by: BufferedReader.readLine() in a loop

  readAllLines(): ArrayList {
    const lines: ArrayList = new ArrayList();
    if (this._closed) {
      return lines;
    }
    let line: string = this._reader.readLine();
    while (line !== null) {
      lines.add(line);
      line = this._reader.readLine();
    }
    return lines;
  }

  // ---- close() -----------------------------------------------------------
  // Close the underlying reader. After this, all reads return null.
  //
  // Backed by: BufferedReader.close()

  close(): void {
    if (!this._closed) {
      this._closed = true;
      this._reader.close();
    }
  }
}

// ---------------------------------------------------------------------------
// createInterface() -> Interface
// ---------------------------------------------------------------------------
// Create a readline Interface that reads from System.in (stdin).
// This is the most common use case in Node.js:
//   const rl = readline.createInterface({ input: process.stdin });
//
// Backed by: BufferedReader wrapping InputStreamReader wrapping System.in

export function createInterface(): Interface {
  const isr: InputStreamReader = new InputStreamReader(System.in);
  const reader: BufferedReader = new BufferedReader(isr);
  return new Interface(reader);
}

// ---------------------------------------------------------------------------
// createInterfaceFromReader(reader) -> Interface
// ---------------------------------------------------------------------------
// Create a readline Interface from an existing BufferedReader.
// Useful when reading from a file or other input stream.

export function createInterfaceFromReader(reader: BufferedReader): Interface {
  return new Interface(reader);
}

// ---------------------------------------------------------------------------
// question(prompt) -> string
// ---------------------------------------------------------------------------
// Convenience: create a temporary interface, ask one question, close it.
// This is a common one-shot pattern.
//
// WARNING: Each call creates a new BufferedReader on System.in. For
// multiple questions, use createInterface() and call question() on
// the returned Interface to avoid losing buffered data.

export function question(prompt: string): string {
  const isr: InputStreamReader = new InputStreamReader(System.in);
  const reader: BufferedReader = new BufferedReader(isr);
  System.out.print(prompt);
  System.out.flush();
  const line: string = reader.readLine();
  return line;
}
