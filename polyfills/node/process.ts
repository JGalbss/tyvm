// Node.js `process` polyfill for tyvm
//
// Implements a subset of Node's process global backed by Java's System,
// Runtime, and ProcessHandle classes. Provides access to environment
// variables, process info, memory usage, and high-resolution timing.
//
// Usage:
//   import { env, argv, cwd, exit, pid, platform, hrtime, memoryUsage } from "node:process";
//   import { stdout, stderr } from "node:process";

import { System } from "java:java.lang.System";
import { Runtime } from "java:java.lang.Runtime";
import { ProcessHandle } from "java:java.lang.ProcessHandle";
import { HashMap } from "java:java.util.HashMap";
import { StringBuilder } from "java:java.lang.StringBuilder";

// ---------------------------------------------------------------------------
// env — environment variables via java.lang.System.getenv()
// ---------------------------------------------------------------------------

// Wrapper around System.getenv() that provides a get() method.
// Node's process.env is a plain object, but since tyvm cannot create
// dynamic property accessors, we expose it as a class with get/has.
class Env {
  // Retrieve an environment variable by name. Returns empty string if unset,
  // matching the common Node pattern of `process.env.FOO || ""`.
  get(name: string): string {
    const value: string | null = System.getenv(name);
    if (value === null) {
      return "";
    }
    return value;
  }

  // Check whether an environment variable is defined.
  has(name: string): boolean {
    return System.getenv(name) !== null;
  }
}

export const env: Env = new Env();

// ---------------------------------------------------------------------------
// argv — command-line arguments
// ---------------------------------------------------------------------------

// In a real Node.js process, argv[0] is the node binary path and argv[1]
// is the script path. On the JVM, command-line args are passed to main().
// This is populated by the tyvm runtime bootstrap; here we provide the
// empty default. The runtime should call _setArgv() before user code runs.
let _argv: string[] = [];

export function getArgv(): string[] {
  return _argv;
}

// Called by the tyvm runtime to inject the actual command-line arguments.
export function _setArgv(args: string[]): void {
  _argv = args;
}

// ---------------------------------------------------------------------------
// cwd — current working directory
// ---------------------------------------------------------------------------

// Returns the current working directory, read from the JVM system property.
export function cwd(): string {
  return System.getProperty("user.dir");
}

// ---------------------------------------------------------------------------
// exit — terminate the process
// ---------------------------------------------------------------------------

// Exit the JVM process with the given status code (default 0).
// Backed by java.lang.System.exit().
export function exit(code: number): void {
  System.exit(code);
}

// ---------------------------------------------------------------------------
// pid — process ID
// ---------------------------------------------------------------------------

// Get the current process ID using java.lang.ProcessHandle (Java 9+).
export function getPid(): number {
  return ProcessHandle.current().pid();
}

export const pid: number = ProcessHandle.current().pid();

// ---------------------------------------------------------------------------
// platform — operating system platform
// ---------------------------------------------------------------------------

// Returns a Node-style platform string derived from the JVM "os.name"
// system property. Maps common Java os.name values to Node equivalents.
export function getPlatform(): string {
  const osName: string = System.getProperty("os.name");
  if (osName === null) {
    return "unknown";
  }
  // Java os.name values: "Linux", "Mac OS X", "Windows 10", etc.
  // Convert to Node-style: "linux", "darwin", "win32"
  if (osName.indexOf("Linux") !== -1) {
    return "linux";
  }
  if (osName.indexOf("Mac") !== -1) {
    return "darwin";
  }
  if (osName.indexOf("Windows") !== -1) {
    return "win32";
  }
  return "unknown";
}

export const platform: string = getPlatform();

// ---------------------------------------------------------------------------
// version — fake Node.js version string
// ---------------------------------------------------------------------------

// tyvm is not Node.js, but some libraries check process.version for
// compatibility. We report a reasonable LTS version.
export const version: string = "v20.0.0-tyvm";

// ---------------------------------------------------------------------------
// stdout / stderr — output streams
// ---------------------------------------------------------------------------

// Minimal writable stream that delegates to System.out / System.err.
// In a full implementation these would be proper Stream objects, but
// write() covers the most common use case.

class StdoutStream {
  // Write a string to standard output (System.out).
  write(data: string): void {
    System.out.print(data);
  }
}

class StderrStream {
  // Write a string to standard error (System.err).
  write(data: string): void {
    System.err.print(data);
  }
}

export const stdout: StdoutStream = new StdoutStream();
export const stderr: StderrStream = new StderrStream();

// ---------------------------------------------------------------------------
// hrtime — high-resolution time
// ---------------------------------------------------------------------------

// Returns the current high-resolution time as [seconds, nanoseconds].
// Backed by java.lang.System.nanoTime(). Note: nanoTime() returns an
// arbitrary origin; it is only useful for measuring elapsed intervals.
//
// Since tyvm may not support tuple returns, we return the value as
// a total nanosecond count. For the [sec, nsec] pair form, use hrtimePair().
export function hrtime(): number {
  return System.nanoTime();
}

// Returns high-resolution time as a two-element array [seconds, nanoseconds],
// matching Node's process.hrtime() return type.
export function hrtimePair(): number[] {
  const nanos: number = System.nanoTime();
  const seconds: number = Math.floor(nanos / 1000000000);
  const remainder: number = nanos - (seconds * 1000000000);
  const result: number[] = [seconds, remainder];
  return result;
}

// ---------------------------------------------------------------------------
// memoryUsage — JVM memory information
// ---------------------------------------------------------------------------

// Returns a HashMap with memory usage fields matching Node's
// process.memoryUsage() shape. All values are in bytes.
// Backed by java.lang.Runtime.getRuntime().
export function memoryUsage(): HashMap<string, number> {
  const rt: Runtime = Runtime.getRuntime();
  const result: HashMap<string, number> = new HashMap();

  // Total memory currently available to the JVM
  const totalMem: number = rt.totalMemory();
  // Free memory within the total
  const freeMem: number = rt.freeMemory();
  // Maximum memory the JVM will attempt to use
  const maxMem: number = rt.maxMemory();
  // Currently used = total - free
  const usedMem: number = totalMem - freeMem;

  // Map to Node-style field names:
  // rss (resident set size) ~= total memory allocated by JVM
  result.put("rss", totalMem);
  // heapTotal ~= max memory available
  result.put("heapTotal", maxMem);
  // heapUsed ~= currently used memory
  result.put("heapUsed", usedMem);
  // external — not applicable on JVM, set to 0
  result.put("external", 0);

  return result;
}
