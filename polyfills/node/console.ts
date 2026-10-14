// ==========================================================================
// Node.js `console` polyfill for tyvm
// ==========================================================================
//
// Implements the Console class with log, error, warn, info, debug,
// table, time, timeEnd, timeLog, count, countReset, assert, clear,
// group, groupEnd, dir, and trace.
//
// Java backing classes:
//   java.lang.System       — System.out, System.err, System.nanoTime()
//   java.io.PrintStream    — formatted output
//   java.util.HashMap      — store timers and counters
//   java.lang.StringBuilder — build formatted strings
//
// Usage:
//   import { Console, log, error, warn, time, timeEnd, table } from "node:console";

import { System } from "java:java.lang.System";
import { HashMap } from "java:java.util.HashMap";
import { StringBuilder } from "java:java.lang.StringBuilder";
import { ArrayList } from "java:java.util.ArrayList";

// ---------------------------------------------------------------------------
// Console class
// ---------------------------------------------------------------------------

export class Console {
  _timers: HashMap;
  _counters: HashMap;
  _groupDepth: number;

  constructor() {
    this._timers = new HashMap();
    this._counters = new HashMap();
    this._groupDepth = 0;
  }

  // ---- Internal: build indent prefix for group() -------------------------

  _indent(): string {
    let result: string = "";
    let i = 0;
    while (i < this._groupDepth) {
      result = result + "  ";
      i = i + 1;
    }
    return result;
  }

  // ---- log(args...) ------------------------------------------------------
  // Print to stdout with a newline. Accepts up to 4 arguments (tyvm
  // does not support rest parameters).
  //
  // Backed by: System.out.println()

  log(arg1: any, arg2: any, arg3: any, arg4: any): void {
    const sb: StringBuilder = new StringBuilder();
    sb.append(this._indent());
    if (arg1 !== null) {
      sb.append(arg1);
    }
    if (arg2 !== null) {
      sb.append(" ");
      sb.append(arg2);
    }
    if (arg3 !== null) {
      sb.append(" ");
      sb.append(arg3);
    }
    if (arg4 !== null) {
      sb.append(" ");
      sb.append(arg4);
    }
    System.out.println(sb.toString());
  }

  // ---- Convenience: log with fewer arguments -----------------------------

  log1(arg1: any): void {
    this.log(arg1, null, null, null);
  }

  log2(arg1: any, arg2: any): void {
    this.log(arg1, arg2, null, null);
  }

  // ---- info(args...) -----------------------------------------------------
  // Alias for log(). In Node.js, console.info is identical to console.log.

  info(arg1: any, arg2: any, arg3: any, arg4: any): void {
    this.log(arg1, arg2, arg3, arg4);
  }

  // ---- debug(args...) ----------------------------------------------------
  // Alias for log(). In Node.js, console.debug is identical to console.log.

  debug(arg1: any, arg2: any, arg3: any, arg4: any): void {
    this.log(arg1, arg2, arg3, arg4);
  }

  // ---- error(args...) ----------------------------------------------------
  // Print to stderr with a newline.
  //
  // Backed by: System.err.println()

  error(arg1: any, arg2: any, arg3: any, arg4: any): void {
    const sb: StringBuilder = new StringBuilder();
    sb.append(this._indent());
    if (arg1 !== null) {
      sb.append(arg1);
    }
    if (arg2 !== null) {
      sb.append(" ");
      sb.append(arg2);
    }
    if (arg3 !== null) {
      sb.append(" ");
      sb.append(arg3);
    }
    if (arg4 !== null) {
      sb.append(" ");
      sb.append(arg4);
    }
    System.err.println(sb.toString());
  }

  // ---- warn(args...) -----------------------------------------------------
  // Alias for error(). In Node.js, console.warn writes to stderr.

  warn(arg1: any, arg2: any, arg3: any, arg4: any): void {
    this.error(arg1, arg2, arg3, arg4);
  }

  // ---- table(data) -------------------------------------------------------
  // Print tabular data. Accepts an ArrayList of HashMaps, or an ArrayList
  // of ArrayLists, or a HashMap. Output is a simplified table format.
  //
  // For simplicity, this prints each item on its own line with an index.

  table(data: any): void {
    if (data === null) {
      this.log1("null");
      return;
    }

    const indent: string = this._indent();

    // Try to treat it as an ArrayList
    const list: ArrayList = data;
    if (list !== null) {
      System.out.println(indent + "(index)\tValue");
      System.out.println(indent + "-------\t-----");
      let i = 0;
      while (i < list.size()) {
        const sb: StringBuilder = new StringBuilder();
        sb.append(indent);
        sb.append(i);
        sb.append("\t");
        sb.append(list.get(i));
        System.out.println(sb.toString());
        i = i + 1;
      }
      return;
    }

    // Fallback: just print the object's toString()
    System.out.println(indent + data);
  }

  // ---- time(label) -------------------------------------------------------
  // Start a timer with the given label. The timer records the current
  // nanosecond timestamp.
  //
  // Backed by: System.nanoTime()

  time(label: string): void {
    if (label === null) {
      label = "default";
    }
    this._timers.put(label, System.nanoTime());
  }

  // ---- timeEnd(label) ----------------------------------------------------
  // Stop the timer and print the elapsed time in milliseconds.

  timeEnd(label: string): void {
    if (label === null) {
      label = "default";
    }
    const startNanos: any = this._timers.get(label);
    if (startNanos === null) {
      this.warn("Timer '" + label + "' does not exist", null, null, null);
      return;
    }
    const elapsed: number = System.nanoTime() - startNanos;
    const ms: number = elapsed / 1000000.0;
    this._timers.remove(label);

    const sb: StringBuilder = new StringBuilder();
    sb.append(this._indent());
    sb.append(label);
    sb.append(": ");
    sb.append(ms);
    sb.append("ms");
    System.out.println(sb.toString());
  }

  // ---- timeLog(label, args...) -------------------------------------------
  // Print the current elapsed time for a timer without stopping it.

  timeLog(label: string, arg1: any): void {
    if (label === null) {
      label = "default";
    }
    const startNanos: any = this._timers.get(label);
    if (startNanos === null) {
      this.warn("Timer '" + label + "' does not exist", null, null, null);
      return;
    }
    const elapsed: number = System.nanoTime() - startNanos;
    const ms: number = elapsed / 1000000.0;

    const sb: StringBuilder = new StringBuilder();
    sb.append(this._indent());
    sb.append(label);
    sb.append(": ");
    sb.append(ms);
    sb.append("ms");
    if (arg1 !== null) {
      sb.append(" ");
      sb.append(arg1);
    }
    System.out.println(sb.toString());
  }

  // ---- count(label) ------------------------------------------------------
  // Increment and print a counter with the given label.

  count(label: string): void {
    if (label === null) {
      label = "default";
    }
    let current: any = this._counters.get(label);
    let value: number = 1;
    if (current !== null) {
      value = current + 1;
    }
    this._counters.put(label, value);

    const sb: StringBuilder = new StringBuilder();
    sb.append(this._indent());
    sb.append(label);
    sb.append(": ");
    sb.append(value);
    System.out.println(sb.toString());
  }

  // ---- countReset(label) -------------------------------------------------
  // Reset a counter to zero.

  countReset(label: string): void {
    if (label === null) {
      label = "default";
    }
    this._counters.put(label, 0);
  }

  // ---- assert(value, message) -------------------------------------------
  // If value is falsy, print "Assertion failed: <message>" to stderr.
  // Unlike Node.js assert, this does NOT throw — it only prints.

  assert(value: any, message: string): void {
    if (!value) {
      if (message === null) {
        message = "console.assert";
      }
      this.error("Assertion failed:", message, null, null);
    }
  }

  // ---- clear() -----------------------------------------------------------
  // Clear the console. Outputs the ANSI escape code for clearing the
  // screen when connected to a TTY.

  clear(): void {
    // ANSI: clear screen + move cursor to top-left
    System.out.print("\u001b[2J\u001b[H");
    System.out.flush();
  }

  // ---- group(label?) -----------------------------------------------------
  // Increase indentation for subsequent output.

  group(label: string): void {
    if (label !== null) {
      this.log1(label);
    }
    this._groupDepth = this._groupDepth + 1;
  }

  // ---- groupEnd() --------------------------------------------------------
  // Decrease indentation level.

  groupEnd(): void {
    if (this._groupDepth > 0) {
      this._groupDepth = this._groupDepth - 1;
    }
  }

  // ---- dir(obj) ----------------------------------------------------------
  // Print an object's string representation to stdout.

  dir(obj: any): void {
    const sb: StringBuilder = new StringBuilder();
    sb.append(this._indent());
    sb.append(obj);
    System.out.println(sb.toString());
  }

  // ---- trace(message?) ---------------------------------------------------
  // Print a stack trace to stderr.
  //
  // Backed by: new Throwable().printStackTrace() via RuntimeException

  trace(message: string): void {
    if (message === null) {
      message = "Trace";
    }
    System.err.println(this._indent() + message);
    // Print a Java stack trace for debugging
    const t: any = new java.lang.Throwable(message);
    t.printStackTrace(System.err);
  }
}

// ---------------------------------------------------------------------------
// Default console instance and convenience exports
// ---------------------------------------------------------------------------

const _console: Console = new Console();

export function log(arg1: any, arg2: any, arg3: any, arg4: any): void {
  _console.log(arg1, arg2, arg3, arg4);
}

export function error(arg1: any, arg2: any, arg3: any, arg4: any): void {
  _console.error(arg1, arg2, arg3, arg4);
}

export function warn(arg1: any, arg2: any, arg3: any, arg4: any): void {
  _console.warn(arg1, arg2, arg3, arg4);
}

export function info(arg1: any, arg2: any, arg3: any, arg4: any): void {
  _console.info(arg1, arg2, arg3, arg4);
}

export function debug(arg1: any, arg2: any, arg3: any, arg4: any): void {
  _console.debug(arg1, arg2, arg3, arg4);
}

export function table(data: any): void {
  _console.table(data);
}

export function time(label: string): void {
  _console.time(label);
}

export function timeEnd(label: string): void {
  _console.timeEnd(label);
}

export function timeLog(label: string, arg1: any): void {
  _console.timeLog(label, arg1);
}

export function count(label: string): void {
  _console.count(label);
}

export function countReset(label: string): void {
  _console.countReset(label);
}

export function clear(): void {
  _console.clear();
}

export function group(label: string): void {
  _console.group(label);
}

export function groupEnd(): void {
  _console.groupEnd();
}

export function dir(obj: any): void {
  _console.dir(obj);
}

export function trace(message: string): void {
  _console.trace(message);
}
