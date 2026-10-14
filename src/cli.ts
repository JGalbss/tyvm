#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync, statSync, readFileSync, readdirSync, copyFileSync } from "node:fs";
import { resolve, dirname, basename, join, extname } from "node:path";
import { execSync } from "node:child_process";
import { parseFile } from "./frontend/parse.js";
import { lower } from "./frontend/lower.js";
import { emit } from "./backend/emitter.js";
import type { EmitResult } from "./backend/emitter.js";
import { inlineFunctions } from "./ir/passes/inline.js";
import { intPromote } from "./ir/passes/int-promote.js";
import { optimizeStrings } from "./ir/passes/string-opt.js";
import { processDecorators } from "./ir/passes/decorator-process.js";
import { formatDiagnostic, formatCompilerError } from "./utils/diagnostics.js";
import {
  compileFromEntry,
  compileDirectory,
  type CompiledModule,
} from "./frontend/project.js";
import type { Module as IRModule } from "./ir/nodes.js";
import { generateDts, generateDtsBatch } from "./tools/java-types.js";

const VERSION = "0.1.0";
const VALID_EXTENSIONS = new Set([".ts", ".tyvm"]);

// ---------------------------------------------------------------------------
// Colors (minimal — no dependencies)
// ---------------------------------------------------------------------------

const isColor = process.stderr.isTTY !== false;
const dim = (s: string) => isColor ? `\x1b[2m${s}\x1b[0m` : s;
const bold = (s: string) => isColor ? `\x1b[1m${s}\x1b[0m` : s;
const green = (s: string) => isColor ? `\x1b[32m${s}\x1b[0m` : s;
const red = (s: string) => isColor ? `\x1b[31m${s}\x1b[0m` : s;
const cyan = (s: string) => isColor ? `\x1b[36m${s}\x1b[0m` : s;
const yellow = (s: string) => isColor ? `\x1b[33m${s}\x1b[0m` : s;

function usage(): void {
  console.log(`${bold("tyvm")} ${dim(VERSION)} — TypeScript → JVM bytecode

${bold("USAGE")}
  ${cyan("tyvm")} <file>                Compile and run a .tyvm or .ts file
  ${cyan("tyvm compile")} <file>        Compile to .class files
  ${cyan("tyvm run")} <file>            Compile and run
  ${cyan("tyvm init")}                  Initialize a new tyvm project
  ${cyan("tyvm check")} <file>          Type-check without compiling
  ${cyan("tyvm version")}               Print version
  ${cyan("tyvm help")}                  Show this help

${bold("OPTIONS")}
  ${dim("--out")} <dir>    Output directory for .class files ${dim("(default: ./out)")}
  ${dim("--verbose")}      Print detailed compilation info
  ${dim("--cp")} <path>    Additional classpath entries

${bold("EXAMPLES")}
  ${dim("$")} tyvm server.tyvm                  ${dim("# compile + run")}
  ${dim("$")} tyvm compile src/ --out build      ${dim("# compile directory")}
  ${dim("$")} tyvm init                          ${dim("# create project scaffold")}
  ${dim("$")} tyvm install java.util.concurrent  ${dim("# generate types for java package")}
  ${dim("$")} tyvm install java.net.http.HttpClient ${dim("# generate types for a class")}`);
}

interface CliOptions {
  command: "compile" | "run" | "version" | "help" | "init" | "check" | "install";
  inputFile?: string;
  outDir: string;
  run: boolean;
  verbose: boolean;
  classpath: string[];
  installPackages: string[];
}

function parseArgs(args: string[]): CliOptions {
  const opts: CliOptions = {
    command: "help",
    outDir: "./out",
    run: false,
    verbose: false,
    classpath: [],
    installPackages: [],
  };

  let i = 0;
  if (args.length === 0) return opts;

  const cmd = args[i++];
  if (cmd === "version" || cmd === "--version" || cmd === "-v") {
    opts.command = "version";
    return opts;
  }
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    opts.command = "help";
    return opts;
  }
  if (cmd === "init") {
    opts.command = "init";
    return opts;
  }
  if (cmd === "install" || cmd === "add") {
    opts.command = "install";
    // Collect all remaining args as package names
    while (i < args.length) {
      opts.installPackages.push(args[i++]);
    }
    return opts;
  }
  if (cmd === "check") {
    opts.command = "check";
  } else if (cmd === "compile") {
    opts.command = "compile";
  } else if (cmd === "run") {
    opts.command = "run";
    opts.run = true;
  } else {
    // Bare file path → compile + run
    opts.command = "run";
    opts.run = true;
    opts.inputFile = cmd;
  }

  while (i < args.length) {
    const arg = args[i++];
    if (arg === "--out" || arg === "-o") {
      opts.outDir = args[i++] ?? "./out";
    } else if (arg === "--run") {
      opts.run = true;
    } else if (arg === "--verbose" || arg === "-V") {
      opts.verbose = true;
    } else if (arg === "--cp" || arg === "--classpath") {
      opts.classpath.push(args[i++] ?? "");
    } else if (!arg.startsWith("-")) {
      opts.inputFile = arg;
    }
  }

  return opts;
}

function findRuntimeJar(): string | undefined {
  const candidates = [
    join(dirname(new URL(import.meta.url).pathname), "..", "runtime", "tyvm-runtime.jar"),
    join(process.cwd(), "runtime", "tyvm-runtime.jar"),
    join(dirname(new URL(import.meta.url).pathname), "..", "..", "runtime", "tyvm-runtime.jar"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** Find tyvm package root (where types/ lives) */
function findPackageRoot(): string {
  const url = new URL(import.meta.url);
  let dir = dirname(url.pathname);
  // Walk up until we find types/tyvm.d.ts
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, "types", "tyvm.d.ts"))) return dir;
    dir = dirname(dir);
  }
  return dirname(url.pathname);
}

/**
 * Optimize an IR module through the standard pass pipeline.
 */
function optimizeModule(irModule: IRModule): IRModule {
  let m = irModule;
  const { module: processed } = processDecorators(m);
  m = processed;
  m = inlineFunctions(m);
  m = intPromote(m);
  m = optimizeStrings(m);
  return m;
}

function isDir(inputPath: string): boolean {
  try {
    return statSync(inputPath).isDirectory();
  } catch {
    return false;
  }
}

function hasRelativeImports(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");
    return /import\s+.*from\s+["']\./.test(content);
  } catch {
    return false;
  }
}

function isValidSourceFile(filePath: string): boolean {
  return VALID_EXTENSIONS.has(extname(filePath));
}

// ---------------------------------------------------------------------------
// Single-file compilation
// ---------------------------------------------------------------------------

function compileSingleFile(
  inputPath: string,
  outDir: string,
  verbose: boolean,
): { emitResults: EmitResult[]; mainClass: string } {
  const t0 = performance.now();
  if (verbose) console.log(dim(`  parse ${inputPath}`));

  const parseResult = parseFile(inputPath);

  const errors = parseResult.diagnostics.filter(
    (d) => d.category === 0 /* Error */,
  );
  if (errors.length > 0) {
    for (const d of errors) {
      console.error(formatCompilerError(formatDiagnostic(d)));
    }
  }

  const t1 = performance.now();
  if (verbose) console.log(dim(`  lower → IR`));
  let irModule = lower(parseResult);

  if (verbose) console.log(dim(`  optimize`));
  irModule = optimizeModule(irModule);

  const t2 = performance.now();
  if (verbose) console.log(dim(`  emit bytecode`));
  const emitResults = emit(irModule);
  const t3 = performance.now();

  mkdirSync(outDir, { recursive: true });
  for (const result of emitResults) {
    const classFilePath = join(outDir, result.className + ".class");
    writeFileSync(classFilePath, result.bytes);
    if (verbose) {
      console.log(dim(`  → ${classFilePath} (${result.bytes.length}B)`));
    }
  }

  const totalMs = (t3 - t0).toFixed(0);
  const mainClass = emitResults[0]?.className ?? "Main";
  console.log(
    `${green("✓")} ${bold(basename(inputPath))} → ${emitResults.length} class file(s) ${dim(`in ${totalMs}ms`)}`,
  );

  return { emitResults, mainClass };
}

// ---------------------------------------------------------------------------
// Multi-file compilation
// ---------------------------------------------------------------------------

function compileMultiFile(
  inputPath: string,
  outDir: string,
  verbose: boolean,
): { emitResults: EmitResult[]; mainClass: string } {
  const t0 = performance.now();

  if (verbose) {
    console.log(dim(
      isDir(inputPath)
        ? `  scanning ${inputPath}/`
        : `  resolving dependencies for ${basename(inputPath)}`,
    ));
  }

  const compiledModules: CompiledModule[] = isDir(inputPath)
    ? compileDirectory(inputPath)
    : compileFromEntry(inputPath);

  const allEmitResults: EmitResult[] = [];
  let mainClass = "Main";

  for (const mod of compiledModules) {
    if (mod.isDeclaration) continue;
    if (verbose) console.log(dim(`  compile ${basename(mod.filePath)}`));
    const optimized = optimizeModule(mod.irModule);
    const emitResults = emit(optimized);
    for (const result of emitResults) {
      allEmitResults.push(result);
    }
  }

  const entryModule = compiledModules.find(
    (m) => !m.isDeclaration && resolve(m.filePath) === resolve(inputPath),
  );
  if (entryModule) {
    mainClass = entryModule.irModule.name;
  } else if (allEmitResults.length > 0) {
    const lastNonDecl = [...compiledModules].reverse().find((m) => !m.isDeclaration);
    if (lastNonDecl) mainClass = lastNonDecl.irModule.name;
  }

  mkdirSync(outDir, { recursive: true });
  for (const result of allEmitResults) {
    const classFilePath = join(outDir, result.className + ".class");
    writeFileSync(classFilePath, result.bytes);
    if (verbose) {
      console.log(dim(`  → ${classFilePath} (${result.bytes.length}B)`));
    }
  }

  const totalMs = (performance.now() - t0).toFixed(0);
  const srcCount = compiledModules.filter((m) => !m.isDeclaration).length;
  const inputLabel = isDir(inputPath) ? basename(inputPath) + "/" : basename(inputPath);
  console.log(
    `${green("✓")} ${bold(inputLabel)} → ${allEmitResults.length} class file(s) from ${srcCount} source(s) ${dim(`in ${totalMs}ms`)}`,
  );

  return { emitResults: allEmitResults, mainClass };
}

// ---------------------------------------------------------------------------
// tyvm init — scaffold a new project
// ---------------------------------------------------------------------------

function initProject(): void {
  const cwd = process.cwd();
  const pkgRoot = findPackageRoot();

  // tsconfig.json — tells VS Code how to type-check .tyvm files
  const tsconfigPath = join(cwd, "tsconfig.json");
  if (!existsSync(tsconfigPath)) {
    const typesDir = join(pkgRoot, "types");
    // Use relative path if types are in a parent (installed via npm)
    // or absolute if running from source
    const tsconfig = {
      compilerOptions: {
        target: "ES2022",
        module: "ES2022",
        moduleResolution: "bundler",
        strict: true,
        noEmit: true,
        experimentalDecorators: true,
        skipLibCheck: true,
        types: [],
      },
      include: ["**/*.tyvm", "**/*.ts"],
      exclude: ["node_modules", "out"],
      files: [
        join(typesDir, "tyvm.d.ts"),
        join(typesDir, "java.d.ts"),
      ],
    };
    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n");
    console.log(`${green("✓")} created tsconfig.json`);
  } else {
    console.log(dim("  tsconfig.json already exists, skipping"));
  }

  // .vscode/settings.json — associate .tyvm with TypeScript
  const vscodePath = join(cwd, ".vscode");
  const settingsPath = join(vscodePath, "settings.json");
  if (!existsSync(settingsPath)) {
    mkdirSync(vscodePath, { recursive: true });
    const settings = {
      "files.associations": {
        "*.tyvm": "typescript",
      },
      "typescript.tsdk": "node_modules/typescript/lib",
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    console.log(`${green("✓")} created .vscode/settings.json`);
  } else {
    // Merge file associations into existing settings
    try {
      const existing = JSON.parse(readFileSync(settingsPath, "utf-8"));
      if (!existing["files.associations"]?.["*.tyvm"]) {
        existing["files.associations"] = existing["files.associations"] || {};
        existing["files.associations"]["*.tyvm"] = "typescript";
        writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + "\n");
        console.log(`${green("✓")} updated .vscode/settings.json with .tyvm association`);
      } else {
        console.log(dim("  .vscode/settings.json already configured"));
      }
    } catch {
      console.log(dim("  .vscode/settings.json exists but couldn't be updated"));
    }
  }

  // Create sample main.tyvm if no .tyvm files exist
  const hasTyvmFiles = existsSync(join(cwd, "main.tyvm")) ||
    existsSync(join(cwd, "src")) && readdirSync(join(cwd, "src")).some(f => f.endsWith(".tyvm"));

  if (!hasTyvmFiles) {
    const sample = `import { spawn, serve, json } from "tyvm";

// A virtual-thread HTTP server on the JVM
serve(8080, (req) => {
  return json('{"message": "hello from tyvm!"}');
});
`;
    writeFileSync(join(cwd, "main.tyvm"), sample);
    console.log(`${green("✓")} created main.tyvm`);
  }

  console.log(`
${bold("Ready!")} Open this folder in VS Code for full IntelliSense.

  ${cyan("tyvm main.tyvm")}           ${dim("# compile + run")}
  ${cyan("tyvm compile main.tyvm")}   ${dim("# compile only")}
`);
}

// ---------------------------------------------------------------------------
// tyvm install — auto-generate .d.ts from Java classes
// ---------------------------------------------------------------------------

function installPackages(packages: string[]): void {
  if (packages.length === 0) {
    console.error(red("error") + ": no packages specified");
    console.error(dim("  usage: tyvm install <java.package.ClassName> [...]"));
    console.error(dim("         tyvm install <group:artifact:version>     # Maven package"));
    console.error(dim("         tyvm install <path/to/library.jar>        # local JAR"));
    console.error(dim("  example: tyvm install java.util.concurrent.ConcurrentHashMap"));
    console.error(dim("           tyvm install org.springaicommunity:claude-code-sdk:1.0.0-SNAPSHOT"));
    process.exit(1);
  }

  const t0 = performance.now();

  // Check for Maven coordinates (group:artifact:version) or JAR paths
  let classpath: string | undefined;
  const javaTargets: string[] = [];

  for (const pkg of packages) {
    if (pkg.endsWith(".jar") && existsSync(pkg)) {
      // Local JAR file
      classpath = resolve(pkg);
      const classes = listJarClasses(classpath);
      console.log(`${green("+")} found ${bold(String(classes.length))} classes in ${basename(pkg)}`);
      javaTargets.push(...classes);
    } else if (pkg.includes(":") && pkg.split(":").length >= 3) {
      // Maven coordinates: group:artifact:version
      const jarPath = downloadMavenArtifact(pkg);
      if (jarPath) {
        classpath = jarPath;
        const classes = listJarClasses(jarPath);
        console.log(`${green("+")} found ${bold(String(classes.length))} classes in ${basename(jarPath)}`);
        javaTargets.push(...classes);
      }
    } else {
      javaTargets.push(pkg);
    }
  }

  // Resolve all classes — a package name (no uppercase last segment) expands via javap probing
  const classNames: string[] = [];
  for (const pkg of javaTargets) {
    const expanded = resolveJavaTarget(pkg);
    classNames.push(...expanded);
  }

  if (classNames.length === 0) {
    console.error(red("error") + ": no Java classes found");
    process.exit(1);
  }

  console.log(dim(`  resolving ${classNames.length} class(es)...`));

  // Generate declarations
  const typesDir = join(findPackageRoot(), "types");
  mkdirSync(typesDir, { recursive: true });

  // Read existing java.d.ts to preserve the header and any manually added types
  const javaDtsPath = join(typesDir, "java.d.ts");
  let existingContent = "";
  if (existsSync(javaDtsPath)) {
    existingContent = readFileSync(javaDtsPath, "utf-8");
  }

  // Collect existing manually-declared modules to avoid duplicates
  const existingModules = new Set<string>();
  for (const m of existingContent.matchAll(/declare module "([^"]+)"/g)) {
    existingModules.add(m[1]);
  }

  // Filter out already-declared classes
  const toGenerate = classNames.filter((cls) => {
    const moduleName = `java:${cls}`;
    if (existingModules.has(moduleName)) {
      console.log(dim(`  skip ${cls} (already declared)`));
      return false;
    }
    return true;
  });

  // Batch generate — single javap call
  const { results, errors } = generateDtsBatch(toGenerate, classpath);
  const newDecls: string[] = [];
  let success = 0;
  let failed = 0;

  for (const cls of toGenerate) {
    const dts = results.get(cls);
    if (dts) {
      newDecls.push(dts);
      success++;
      console.log(`  ${green("+")} ${cls}`);
    } else {
      const err = errors.get(cls);
      failed++;
      console.error(`  ${red("✗")} ${cls}${err ? ` — ${err}` : ""}`);
    }
  }

  if (newDecls.length > 0) {
    // Append to java.d.ts (before the wildcard fallback)
    let content = existingContent;

    // Remove existing wildcard fallback — we'll re-add it at the end
    // Remove any old wildcard fallback
    content = content.replace(/\/\/ -{10,}[\s\S]*?declare module "java:\*"[\s\S]*?\n}\n?$/, "").trimEnd();

    content += "\n\n";
    content += newDecls.join("\n\n");
    content += "\n";

    writeFileSync(javaDtsPath, content);

    // Also copy to vscode extension types if it exists
    const vscodeDtsPath = join(findPackageRoot(), "editor", "vscode", "types", "java.d.ts");
    if (existsSync(dirname(vscodeDtsPath))) {
      writeFileSync(vscodeDtsPath, content);
    }
  }

  const ms = (performance.now() - t0).toFixed(0);
  console.log(
    `\n${green("✓")} installed ${bold(String(success))} type declaration(s)` +
    (failed > 0 ? `, ${red(String(failed))} failed` : "") +
    ` ${dim(`in ${ms}ms`)}`,
  );
  if (success > 0) {
    console.log(dim(`  → ${javaDtsPath}`));
  }
}

/** List public classes in a JAR file. */
function listJarClasses(jarPath: string): string[] {
  try {
    const output = execSync(`jar tf "${jarPath}" | grep '\\.class$' | grep -v '\\$'`, {
      encoding: "utf-8",
      timeout: 5000,
    });
    return output
      .split("\n")
      .filter(Boolean)
      .map((line) => line.replace(/\.class$/, "").replace(/\//g, "."));
  } catch {
    return [];
  }
}

/** Download a Maven artifact JAR. Returns the path to the downloaded JAR. */
function downloadMavenArtifact(coords: string): string | undefined {
  const parts = coords.split(":");
  if (parts.length < 3) return undefined;

  const [groupId, artifactId, version] = parts;
  const groupPath = groupId.replace(/\./g, "/");
  const libDir = join(findPackageRoot(), "lib");
  mkdirSync(libDir, { recursive: true });

  const jarName = `${artifactId}-${version}.jar`;
  const jarPath = join(libDir, jarName);

  // Already downloaded?
  if (existsSync(jarPath)) {
    console.log(dim(`  using cached ${jarName}`));
    return jarPath;
  }

  console.log(dim(`  downloading ${groupId}:${artifactId}:${version}...`));

  // Try repositories in order
  const repos = [
    // Maven Central
    `https://repo1.maven.org/maven2/${groupPath}/${artifactId}/${version}/${artifactId}-${version}.jar`,
    // Sonatype snapshots (need metadata lookup for snapshots)
  ];

  // For SNAPSHOT versions, resolve via metadata
  if (version.endsWith("-SNAPSHOT")) {
    const metadataUrl = `https://central.sonatype.com/repository/maven-snapshots/${groupPath}/${artifactId}/${version}/maven-metadata.xml`;
    try {
      const metadata = execSync(`curl -sL "${metadataUrl}"`, { encoding: "utf-8", timeout: 10000 });
      const tsMatch = metadata.match(/<timestamp>([^<]+)<\/timestamp>/);
      const bnMatch = metadata.match(/<buildNumber>([^<]+)<\/buildNumber>/);
      if (tsMatch && bnMatch) {
        const snapshotVersion = version.replace("-SNAPSHOT", `-${tsMatch[1]}-${bnMatch[1]}`);
        repos.unshift(
          `https://central.sonatype.com/repository/maven-snapshots/${groupPath}/${artifactId}/${version}/${artifactId}-${snapshotVersion}.jar`,
        );
      }
    } catch {
      // ignore
    }
  }

  for (const url of repos) {
    try {
      execSync(`curl -sLf -o "${jarPath}" "${url}"`, { timeout: 30000 });
      if (existsSync(jarPath) && statSync(jarPath).size > 0) {
        console.log(dim(`  downloaded ${jarName} (${(statSync(jarPath).size / 1024).toFixed(0)}KB)`));
        return jarPath;
      }
    } catch {
      continue;
    }
  }

  console.error(red("error") + `: could not download ${coords}`);
  return undefined;
}

/** Resolve a java target — could be a class name or a package. */
function resolveJavaTarget(target: string): string[] {
  // If it looks like a class name (last segment starts with uppercase), try directly
  const parts = target.split(".");
  const last = parts[parts.length - 1];
  if (last[0] >= "A" && last[0] <= "Z") {
    return [target];
  }

  // It's a package — probe for common classes in it
  console.log(dim(`  scanning package ${target}...`));
  const found: string[] = [];

  // Try well-known class names in the package via javap
  const candidates = probePackageClasses(target);
  for (const cls of candidates) {
    try {
      execSync(`javap -public ${cls} 2>/dev/null`, { encoding: "utf-8", timeout: 3000 });
      found.push(cls);
    } catch {
      // class doesn't exist
    }
  }

  if (found.length === 0) {
    console.error(red("error") + `: no classes found in package ${target}`);
    console.error(dim("  try specifying the full class name, e.g. tyvm install java.util.HashMap"));
  }

  return found;
}

/** Find JAVA_HOME */
function findJavaHome(): string | undefined {
  // JAVA_HOME env var
  if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }
  try {
    const output = execSync("java -XshowSettings:all -version 2>&1", {
      encoding: "utf-8",
      timeout: 5000,
    });
    return output.match(/java\.home\s*=\s*(.+)/)?.[1]?.trim();
  } catch {
    return undefined;
  }
}

/** Probe for known class names in a Java package by scanning jmod files. */
function probePackageClasses(pkg: string): string[] {
  const javaHome = findJavaHome();
  if (!javaHome) return [];

  const jmodsDir = join(javaHome, "jmods");
  if (!existsSync(jmodsDir)) return [];

  const pkgPath = pkg.replace(/\./g, "/");

  // Scan ALL jmod files for classes in this package
  const moduleNames = ["java.base", "java.net.http", "java.sql", "java.logging",
    "java.xml", "java.desktop", "java.management", "java.naming",
    "java.security.jgss", "java.security.sasl", "java.compiler"];

  for (const mod of moduleNames) {
    const jmodPath = join(jmodsDir, `${mod}.jmod`);
    if (!existsSync(jmodPath)) continue;

    try {
      const output = execSync(
        `jar tf "${jmodPath}" 2>/dev/null | grep "^classes/${pkgPath}/[^/]*\\.class$" | grep -v '\\$' || true`,
        { encoding: "utf-8", timeout: 5000 },
      );
      const classes = output
        .split("\n")
        .filter(Boolean)
        .map((line) =>
          line.replace(/^classes\//, "").replace(/\.class$/, "").replace(/\//g, "."),
        );
      if (classes.length > 0) return classes;
    } catch {
      continue;
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// tyvm check — type-check only
// ---------------------------------------------------------------------------

function checkFile(inputPath: string, verbose: boolean): void {
  const t0 = performance.now();
  const parseResult = parseFile(inputPath);

  const errors = parseResult.diagnostics.filter((d) => d.category === 0);
  const warnings = parseResult.diagnostics.filter((d) => d.category === 1);

  if (errors.length === 0 && warnings.length === 0) {
    const ms = (performance.now() - t0).toFixed(0);
    console.log(`${green("✓")} ${bold(basename(inputPath))} — no errors ${dim(`(${ms}ms)`)}`);
    return;
  }

  for (const d of errors) {
    console.error(red("error") + ": " + formatDiagnostic(d));
  }
  for (const d of warnings) {
    console.error(yellow("warn") + ": " + formatDiagnostic(d));
  }

  if (errors.length > 0) {
    console.error(`\n${red(errors.length + " error(s)")}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);
  const opts = parseArgs(args);

  switch (opts.command) {
    case "version":
      console.log(`tyvm ${VERSION}`);
      return;

    case "help":
      usage();
      return;

    case "init":
      initProject();
      return;

    case "install":
      installPackages(opts.installPackages);
      return;

    case "check":
      if (!opts.inputFile) {
        console.error(red("error") + ": no input file specified");
        process.exit(1);
      }
      checkFile(resolve(opts.inputFile), opts.verbose);
      return;

    case "compile":
    case "run":
      break;
  }

  if (!opts.inputFile) {
    console.error(red("error") + ": no input file specified");
    console.error(dim("  run `tyvm help` for usage"));
    process.exit(1);
  }

  const inputPath = resolve(opts.inputFile);

  if (!existsSync(inputPath)) {
    console.error(red("error") + `: file not found: ${opts.inputFile}`);
    process.exit(1);
  }

  if (!isDir(inputPath) && !isValidSourceFile(inputPath)) {
    console.error(red("error") + `: unsupported file type: ${extname(inputPath)}`);
    console.error(dim("  tyvm supports .tyvm and .ts files"));
    process.exit(1);
  }

  const outDir = resolve(opts.outDir);
  const useMultiFile = isDir(inputPath) || hasRelativeImports(inputPath);

  let mainClass: string;

  if (useMultiFile) {
    const result = compileMultiFile(inputPath, outDir, opts.verbose);
    mainClass = result.mainClass;
  } else {
    const result = compileSingleFile(inputPath, outDir, opts.verbose);
    mainClass = result.mainClass;
  }

  // Run if requested
  if (opts.run) {
    const runtimeJar = findRuntimeJar();
    const cpEntries = [outDir, ...opts.classpath];
    if (runtimeJar) cpEntries.push(runtimeJar);
    const cp = cpEntries.join(":");

    if (opts.verbose) {
      console.log(dim(`  java -cp "${cp}" ${mainClass}`));
    }

    try {
      execSync(`java -cp "${cp}" ${mainClass}`, {
        encoding: "utf-8",
        stdio: "inherit",
      });
    } catch {
      process.exit(1);
    }
  }
}

main();
