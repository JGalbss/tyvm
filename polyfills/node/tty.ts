// ==========================================================================
// Node.js `tty` polyfill for tyvm
// ==========================================================================
//
// Implements isatty() and basic ReadStream/WriteStream classes. On the
// JVM there is no direct equivalent of POSIX isatty(), but Java's
// System.console() returns non-null when the JVM is attached to a
// terminal, which is a reasonable approximation.
//
// Java backing classes:
//   java.lang.System   — access to console, stdin, stdout, stderr
//   java.io.Console    — non-null when attached to a real terminal
//
// Usage:
//   import { isatty, ReadStream, WriteStream } from "node:tty";

import { System } from "java:java.lang.System";

// ---------------------------------------------------------------------------
// isatty(fd) -> boolean
// ---------------------------------------------------------------------------
// Check whether a given file descriptor refers to a terminal.
// On the JVM, we approximate this using System.console():
//   fd 0 (stdin)  — console is non-null
//   fd 1 (stdout) — console is non-null
//   fd 2 (stderr) — console is non-null
//   other fds     — always false
//
// Backed by: java.lang.System.console()

export function isatty(fd: number): boolean {
  if (fd < 0 || fd > 2) {
    return false;
  }
  // System.console() returns null when input/output is redirected
  const console: any = System.console();
  return console !== null;
}

// ---------------------------------------------------------------------------
// ReadStream — represents a TTY input stream (fd 0)
// ---------------------------------------------------------------------------
// In Node.js, process.stdin is a tty.ReadStream when the process is
// running in a terminal. This class provides the isTTY flag and basic
// column/row information.

export class ReadStream {
  isTTY: boolean;
  fd: number;

  constructor() {
    this.fd = 0;
    const console: any = System.console();
    this.isTTY = console !== null;
  }

  // Check if this stream is connected to a TTY.
  isRaw(): boolean {
    // Java does not provide raw mode detection; default to false.
    return false;
  }

  // Set raw mode. On the JVM we cannot truly toggle raw mode without
  // native code; this is a no-op that returns the stream for chaining.
  setRawMode(mode: boolean): ReadStream {
    // No-op: JVM does not support raw mode without JNI
    return this;
  }
}

// ---------------------------------------------------------------------------
// WriteStream — represents a TTY output stream (fd 1 or 2)
// ---------------------------------------------------------------------------
// In Node.js, process.stdout and process.stderr are tty.WriteStream
// instances when connected to a terminal.

export class WriteStream {
  isTTY: boolean;
  fd: number;
  columns: number;
  rows: number;

  constructor(fd: number) {
    this.fd = fd;
    const console: any = System.console();
    this.isTTY = console !== null;

    // Terminal size: Java does not expose this directly before Java 22.
    // We provide reasonable defaults. Applications that need accurate
    // terminal dimensions should use platform-specific detection.
    this.columns = 80;
    this.rows = 24;
  }

  // Write a string to the underlying stream.
  // Backed by: System.out.print / System.err.print
  write(data: string): void {
    if (this.fd === 2) {
      System.err.print(data);
    } else {
      System.out.print(data);
    }
  }

  // Clear the current line. Uses ANSI escape codes.
  // Only works when isTTY is true.
  clearLine(dir: number): void {
    if (this.isTTY) {
      // dir: -1 = left of cursor, 0 = entire line, 1 = right of cursor
      if (dir === -1) {
        this.write("\u001b[1K");
      } else if (dir === 1) {
        this.write("\u001b[0K");
      } else {
        this.write("\u001b[2K");
      }
    }
  }

  // Move the cursor to the beginning of the line.
  cursorTo(x: number): void {
    if (this.isTTY) {
      this.write("\u001b[" + (x + 1) + "G");
    }
  }

  // Move the cursor relative to its current position.
  moveCursor(dx: number, dy: number): void {
    if (this.isTTY) {
      if (dx > 0) {
        this.write("\u001b[" + dx + "C");
      } else if (dx < 0) {
        this.write("\u001b[" + (0 - dx) + "D");
      }
      if (dy > 0) {
        this.write("\u001b[" + dy + "B");
      } else if (dy < 0) {
        this.write("\u001b[" + (0 - dy) + "A");
      }
    }
  }

  // Get the terminal size as [columns, rows].
  getWindowSize(): number[] {
    const size: number[] = [this.columns, this.rows];
    return size;
  }
}
