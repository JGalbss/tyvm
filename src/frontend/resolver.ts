/**
 * Module Resolution for tyvm
 *
 * Resolves TypeScript import specifiers to file paths following standard
 * TypeScript module resolution rules:
 *   - Relative imports: ./foo, ../bar
 *   - Look for .ts files first, then .d.ts
 *   - Support index.ts in directories
 */

import { existsSync, statSync, readdirSync } from "node:fs";
import { resolve, dirname, join, extname } from "node:path";

export interface ResolvedModule {
  /** Absolute path to the resolved file. */
  filePath: string;
  /** Whether this is a type-only declaration file (.d.ts). */
  isDeclaration: boolean;
}

/**
 * Resolve an import specifier relative to the importing file.
 *
 * Returns undefined if the module cannot be found.
 */
export function resolveModuleSpecifier(
  specifier: string,
  importingFile: string,
): ResolvedModule | undefined {
  // Only handle relative imports (./foo, ../bar)
  if (!specifier.startsWith(".")) {
    return undefined;
  }

  const dir = dirname(importingFile);
  const base = resolve(dir, specifier);

  // 1. Exact file (if specifier already has extension)
  const ext = extname(specifier);
  if (ext === ".ts" || ext === ".d.ts") {
    if (existsSync(base)) {
      return {
        filePath: base,
        isDeclaration: base.endsWith(".d.ts"),
      };
    }
    return undefined;
  }

  // 2. Try .ts extension
  const tsPath = base + ".ts";
  if (existsSync(tsPath)) {
    return { filePath: tsPath, isDeclaration: false };
  }

  // 3. Try .d.ts extension
  const dtsPath = base + ".d.ts";
  if (existsSync(dtsPath)) {
    return { filePath: dtsPath, isDeclaration: true };
  }

  // 4. Directory with index.ts
  if (existsSync(base) && statSync(base).isDirectory()) {
    const indexTs = join(base, "index.ts");
    if (existsSync(indexTs)) {
      return { filePath: indexTs, isDeclaration: false };
    }
    const indexDts = join(base, "index.d.ts");
    if (existsSync(indexDts)) {
      return { filePath: indexDts, isDeclaration: true };
    }
  }

  return undefined;
}

/**
 * Collect all .ts files in a directory (recursively).
 * Excludes .d.ts files, node_modules, and hidden directories.
 */
export function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  const absDir = resolve(dir);

  function walk(current: string): void {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const full = join(current, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(full);
      } else if (
        entry.endsWith(".ts") &&
        !entry.endsWith(".d.ts") &&
        !entry.endsWith(".test.ts")
      ) {
        results.push(full);
      }
    }
  }

  walk(absDir);
  return results;
}

/**
 * Derive a JVM class name from an absolute file path relative to a project root.
 *
 * For example:
 *   /proj/src/math-utils.ts  with root=/proj/src  ->  "MathUtils"
 *   /proj/src/lib/helpers.ts  with root=/proj/src  ->  "lib/Helpers"
 *
 * The leaf filename is PascalCased; directory components are preserved as-is
 * (they become part of a JVM package path when needed).
 */
export function fileToClassName(filePath: string, projectRoot?: string): string {
  const name = filePath
    .replace(/\\/g, "/")
    .replace(/.*\//, "")        // basename
    .replace(/\.d\.ts$/, "")
    .replace(/\.tsx?$/, "");

  return toPascalCase(name);
}

/**
 * Convert a kebab-case or snake_case name to PascalCase.
 *   "math-utils" -> "MathUtils"
 *   "string_helpers" -> "StringHelpers"
 *   "foo" -> "Foo"
 */
function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : ""))
    .join("");
}
