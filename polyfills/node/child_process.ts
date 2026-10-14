// ==========================================================================
// Node.js `child_process` polyfill for tyvm
// ==========================================================================
//
// Implements exec, execSync, and spawn by delegating to Java's
// java.lang.ProcessBuilder. Since tyvm has no event loop, the async
// exec() variant blocks and returns the result directly (same as execSync).
//
// Java backing classes:
//   java.lang.ProcessBuilder — configure and launch OS processes
//   java.lang.Process        — represents a running OS process
//   java.io.BufferedReader   — read stdout/stderr line-by-line
//   java.io.InputStreamReader — bridge byte stream to character stream
//   java.lang.StringBuilder  — accumulate output
//
// Usage:
//   import { execSync, exec, spawn } from "node:child_process";

import { ProcessBuilder } from "java:java.lang.ProcessBuilder";
import { BufferedReader } from "java:java.io.BufferedReader";
import { InputStreamReader } from "java:java.io.InputStreamReader";
import { StringBuilder } from "java:java.lang.StringBuilder";
import { ArrayList } from "java:java.util.ArrayList";
import { System } from "java:java.lang.System";

// ---------------------------------------------------------------------------
// Internal: read an InputStream to a string via BufferedReader
// ---------------------------------------------------------------------------

function _readStream(inputStream: any): string {
  const reader: BufferedReader = new BufferedReader(new InputStreamReader(inputStream));
  const sb: StringBuilder = new StringBuilder();
  let line: string = reader.readLine();
  let first: boolean = true;
  while (line !== null) {
    if (!first) {
      sb.append("\n");
    }
    sb.append(line);
    first = false;
    line = reader.readLine();
  }
  reader.close();
  return sb.toString();
}

// ---------------------------------------------------------------------------
// Internal: split a shell command string into a list for ProcessBuilder
// ---------------------------------------------------------------------------
// This is a simplified splitter. For full shell parsing, the command is
// wrapped in `sh -c` (Unix) or `cmd /c` (Windows).

function _buildShellCommand(command: string): ArrayList {
  const parts: ArrayList = new ArrayList();
  // Detect OS to choose the shell
  const osName: string = System.getProperty("os.name");
  if (osName !== null && osName.indexOf("Windows") !== -1) {
    parts.add("cmd");
    parts.add("/c");
  } else {
    parts.add("/bin/sh");
    parts.add("-c");
  }
  parts.add(command);
  return parts;
}

// ---------------------------------------------------------------------------
// ExecResult — returned by exec / execSync
// ---------------------------------------------------------------------------

export class ExecResult {
  stdout: string;
  stderr: string;
  status: number;

  constructor(stdout: string, stderr: string, status: number) {
    this.stdout = stdout;
    this.stderr = stderr;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// execSync(command) -> string
// ---------------------------------------------------------------------------
// Execute a shell command synchronously and return its stdout as a string.
// Throws (via Java) if the process cannot be started.
//
// Backed by: java.lang.ProcessBuilder

export function execSync(command: string): string {
  const parts: ArrayList = _buildShellCommand(command);
  const pb: ProcessBuilder = new ProcessBuilder(parts);
  // Redirect stderr to stdout so we get combined output
  pb.redirectErrorStream(true);
  const proc: any = pb.start();
  const output: string = _readStream(proc.getInputStream());
  proc.waitFor();
  return output;
}

// ---------------------------------------------------------------------------
// exec(command) -> ExecResult
// ---------------------------------------------------------------------------
// Execute a shell command and return an ExecResult with stdout, stderr,
// and exit status. In Node.js this is async with a callback; here it
// blocks because tyvm has no event loop.
//
// Backed by: java.lang.ProcessBuilder

export function exec(command: string): ExecResult {
  const parts: ArrayList = _buildShellCommand(command);
  const pb: ProcessBuilder = new ProcessBuilder(parts);
  const proc: any = pb.start();

  const stdout: string = _readStream(proc.getInputStream());
  const stderr: string = _readStream(proc.getErrorStream());
  const status: number = proc.waitFor();

  return new ExecResult(stdout, stderr, status);
}

// ---------------------------------------------------------------------------
// SpawnResult — returned by spawn
// ---------------------------------------------------------------------------

export class SpawnResult {
  stdout: string;
  stderr: string;
  status: number;
  pid: number;

  constructor(stdout: string, stderr: string, status: number, pid: number) {
    this.stdout = stdout;
    this.stderr = stderr;
    this.status = status;
    this.pid = pid;
  }
}

// ---------------------------------------------------------------------------
// spawn(command, args) -> SpawnResult
// ---------------------------------------------------------------------------
// Spawn a child process with explicit command and argument list.
// In Node.js this returns a ChildProcess with streams; here we block
// and collect output because tyvm has no event loop.
//
// Backed by: java.lang.ProcessBuilder

export function spawn(command: string, args: ArrayList): SpawnResult {
  const parts: ArrayList = new ArrayList();
  parts.add(command);

  // Append each argument
  let i = 0;
  while (i < args.size()) {
    parts.add(args.get(i));
    i = i + 1;
  }

  const pb: ProcessBuilder = new ProcessBuilder(parts);
  const proc: any = pb.start();

  const stdout: string = _readStream(proc.getInputStream());
  const stderr: string = _readStream(proc.getErrorStream());
  const status: number = proc.waitFor();
  const pid: number = proc.pid();

  return new SpawnResult(stdout, stderr, status, pid);
}

// ---------------------------------------------------------------------------
// execFileSync(file, args) -> string
// ---------------------------------------------------------------------------
// Execute a file directly (without shell interpretation) with arguments.
// Returns stdout as a string.
//
// Backed by: java.lang.ProcessBuilder

export function execFileSync(file: string, args: ArrayList): string {
  const parts: ArrayList = new ArrayList();
  parts.add(file);

  let i = 0;
  while (i < args.size()) {
    parts.add(args.get(i));
    i = i + 1;
  }

  const pb: ProcessBuilder = new ProcessBuilder(parts);
  pb.redirectErrorStream(true);
  const proc: any = pb.start();
  const output: string = _readStream(proc.getInputStream());
  proc.waitFor();
  return output;
}
