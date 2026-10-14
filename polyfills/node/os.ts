// Node.js "os" polyfill for tyvm
//
// Implements operating system utility functions by delegating to
// java.lang.System (system properties) and java.lang.Runtime (memory/CPU).
//
// Usage:
//   import { platform, arch, homedir, tmpdir } from "node:os";
//
// Compile & run:
//   node dist/cli.js compile your-file.ts
//   java -cp out:runtime/tyvm-runtime.jar your-file

// --- Java interop imports ---
// java.lang.System  — system properties (os.name, os.arch, user.home, etc.)
// java.lang.Runtime — runtime info (available processors, memory)
import { System } from "java:java.lang.System";
import { Runtime } from "java:java.lang.Runtime";
import { InetAddress } from "java:java.net.InetAddress";

// =========================================================================
// EOL — platform-specific end-of-line marker
// =========================================================================
// Backed by: java.lang.System.lineSeparator()
// Returns "\n" on Unix/macOS, "\r\n" on Windows.
const EOL: string = System.lineSeparator();

// =========================================================================
// platform() — returns the operating system platform
// =========================================================================
// Maps Java's os.name property to Node.js platform strings:
//   "Linux"       -> "linux"
//   "Mac OS X"    -> "darwin"
//   "Windows ..." -> "win32"
//
// Backed by: java.lang.System.getProperty("os.name")
function platform(): string {
  const osName: string = System.getProperty("os.name");
  // Java os.name returns values like "Linux", "Mac OS X", "Windows 10"
  if (osName.startsWith("Linux")) {
    return "linux";
  }
  if (osName.startsWith("Mac")) {
    return "darwin";
  }
  if (osName.startsWith("Windows")) {
    return "win32";
  }
  // Fallback: return the raw Java os.name in lowercase
  return osName.toLowerCase();
}

// =========================================================================
// arch() — returns the CPU architecture
// =========================================================================
// Maps Java's os.arch to Node.js architecture strings:
//   "amd64" / "x86_64" -> "x64"
//   "aarch64"          -> "arm64"
//   "x86" / "i386"     -> "ia32"
//
// Backed by: java.lang.System.getProperty("os.arch")
function arch(): string {
  const osArch: string = System.getProperty("os.arch");
  if (osArch === "amd64") {
    return "x64";
  }
  if (osArch === "x86_64") {
    return "x64";
  }
  if (osArch === "aarch64") {
    return "arm64";
  }
  if (osArch === "x86") {
    return "ia32";
  }
  if (osArch === "i386") {
    return "ia32";
  }
  return osArch;
}

// =========================================================================
// type() — returns the operating system name
// =========================================================================
// Maps to standard uname-style names:
//   Linux   -> "Linux"
//   macOS   -> "Darwin"
//   Windows -> "Windows_NT"
//
// Backed by: java.lang.System.getProperty("os.name")
function type(): string {
  const osName: string = System.getProperty("os.name");
  if (osName.startsWith("Linux")) {
    return "Linux";
  }
  if (osName.startsWith("Mac")) {
    return "Darwin";
  }
  if (osName.startsWith("Windows")) {
    return "Windows_NT";
  }
  return osName;
}

// =========================================================================
// cpus() — returns the number of available processors
// =========================================================================
// Node.js returns an array of CPU info objects; since tyvm lacks complex
// object arrays, we return the count of available processors as a number.
//
// Backed by: java.lang.Runtime.getRuntime().availableProcessors()
function cpus(): number {
  const rt: Runtime = Runtime.getRuntime();
  return rt.availableProcessors();
}

// =========================================================================
// totalmem() — returns total system memory in bytes
// =========================================================================
// NOTE: Java's Runtime only exposes JVM heap memory, not physical RAM.
// Runtime.maxMemory() returns the maximum amount of memory the JVM will
// attempt to use, which is the closest available approximation.
//
// Backed by: java.lang.Runtime.getRuntime().maxMemory()
function totalmem(): number {
  const rt: Runtime = Runtime.getRuntime();
  return rt.maxMemory();
}

// =========================================================================
// freemem() — returns free memory in bytes
// =========================================================================
// Returns the amount of free memory in the JVM. This is JVM heap free
// memory, not system-wide free memory.
//
// Backed by: java.lang.Runtime.getRuntime().freeMemory()
function freemem(): number {
  const rt: Runtime = Runtime.getRuntime();
  return rt.freeMemory();
}

// =========================================================================
// homedir() — returns the home directory of the current user
// =========================================================================
// Backed by: java.lang.System.getProperty("user.home")
function homedir(): string {
  return System.getProperty("user.home");
}

// =========================================================================
// tmpdir() — returns the default directory for temporary files
// =========================================================================
// Backed by: java.lang.System.getProperty("java.io.tmpdir")
function tmpdir(): string {
  return System.getProperty("java.io.tmpdir");
}

// =========================================================================
// hostname() — returns the hostname of the operating system
// =========================================================================
// Backed by: java.net.InetAddress.getLocalHost().getHostName()
function hostname(): string {
  const addr: InetAddress = InetAddress.getLocalHost();
  return addr.getHostName();
}
