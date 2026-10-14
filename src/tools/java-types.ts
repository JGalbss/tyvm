/**
 * Auto-generate TypeScript declarations from Java classes using `javap`.
 *
 * Usage:
 *   generateDts("java.util.concurrent.ConcurrentHashMap")
 *   → returns a `declare module "java:java.util.concurrent.ConcurrentHashMap" { ... }` string
 *
 *   generateDtsForPackage("java.util.concurrent")
 *   → generates declarations for all public classes in the package
 */

import { execSync } from "node:child_process";

// ── Java type → TypeScript type mapping ──────────────────────────────────

const JAVA_TO_TS: Record<string, string> = {
  "void": "void",
  "boolean": "boolean",
  "byte": "number",
  "short": "number",
  "int": "number",
  "long": "number",
  "float": "number",
  "double": "number",
  "char": "string",
  "java.lang.String": "string",
  "java.lang.Object": "any",
  "java.lang.Boolean": "boolean",
  "java.lang.Byte": "number",
  "java.lang.Short": "number",
  "java.lang.Integer": "number",
  "java.lang.Long": "number",
  "java.lang.Float": "number",
  "java.lang.Double": "number",
  "java.lang.Character": "string",
  "java.lang.Void": "void",
  "java.lang.Number": "number",
};

function mapJavaType(javaType: string, classGenerics: string[], knownClasses?: Set<string>): string {
  // Strip trailing whitespace
  javaType = javaType.trim();

  // Arrays
  if (javaType.endsWith("[]")) {
    return mapJavaType(javaType.slice(0, -2), classGenerics, knownClasses) + "[]";
  }

  // Varargs (T...)
  if (javaType.endsWith("...")) {
    return mapJavaType(javaType.slice(0, -3), classGenerics, knownClasses) + "[]";
  }

  // Generics: extract base and params
  const genericMatch = javaType.match(/^(.+?)<(.+)>$/);
  if (genericMatch) {
    const base = genericMatch[1].trim();
    const params = splitGenericParams(genericMatch[2]);
    const mappedParams = params.map((p) => mapJavaType(p, classGenerics, knownClasses));

    // Known generic containers
    if (base === "java.util.List" || base === "java.util.ArrayList" || base === "java.util.LinkedList") {
      return `${mappedParams[0]}[]`;
    }
    if (base === "java.util.Set" || base === "java.util.HashSet" || base === "java.util.TreeSet") {
      return `Set<${mappedParams[0]}>`;
    }
    if (base === "java.util.Map" || base === "java.util.HashMap" || base === "java.util.TreeMap") {
      return `Map<${mappedParams[0]}, ${mappedParams[1] ?? "any"}>`;
    }
    if (base === "java.util.Optional") {
      return `${mappedParams[0]} | null`;
    }
    if (base === "java.util.concurrent.CompletableFuture" || base === "java.util.concurrent.Future") {
      return `Promise<${mappedParams[0]}>`;
    }
    if (base === "java.util.function.Function" || base === "java.util.function.UnaryOperator") {
      return `(arg: ${mappedParams[0]}) => ${mappedParams[1] ?? "any"}`;
    }
    if (base === "java.util.function.BiFunction" || base === "java.util.function.BinaryOperator") {
      return `(a: ${mappedParams[0]}, b: ${mappedParams[1] ?? "any"}) => ${mappedParams[2] ?? "any"}`;
    }
    if (base === "java.util.function.Consumer") {
      return `(value: ${mappedParams[0]}) => void`;
    }
    if (base === "java.util.function.BiConsumer") {
      return `(a: ${mappedParams[0]}, b: ${mappedParams[1] ?? "any"}) => void`;
    }
    if (base === "java.util.function.Supplier") {
      return `() => ${mappedParams[0]}`;
    }
    if (base === "java.util.function.Predicate") {
      return `(value: ${mappedParams[0]}) => boolean`;
    }
    if (base === "java.util.Enumeration" || base === "java.util.Iterator") {
      return `Iterable<${mappedParams[0]}>`;
    }
    if (base === "java.util.Collection") {
      return `${mappedParams[0]}[]`;
    }

    // Generic class reference with params
    const simpleName = base.split(".").pop()!;
    return `${simpleName}<${mappedParams.join(", ")}>`;
  }

  // Wildcards: ? extends X → X, ? super X → any, ? → any
  if (javaType.startsWith("?")) {
    const extendsMatch = javaType.match(/^\?\s+extends\s+(.+)/);
    if (extendsMatch) return mapJavaType(extendsMatch[1], classGenerics, knownClasses);
    return "any";
  }

  // Direct mapping
  if (JAVA_TO_TS[javaType]) return JAVA_TO_TS[javaType];

  // Single letter = generic type parameter (T, K, V, etc.)
  if (javaType.length === 1 && javaType >= "A" && javaType <= "Z") return javaType;
  // Or multi-letter generic params from the class
  if (classGenerics.includes(javaType)) return javaType;

  // Inner class reference: Foo$Bar → FooBar
  if (javaType.includes("$")) {
    const clean = javaType.replace(/\$/g, ".");
    // Check if the parent class is known
    if (knownClasses?.has(javaType.split("$")[0])) {
      return clean.split(".").pop()!;
    }
    return "any";
  }

  // Known class from the same batch — use simple name
  if (knownClasses?.has(javaType)) {
    return javaType.split(".").pop()!;
  }

  // Unknown Java type → any
  return "any";
}

/** Split generic params respecting nested <> */
function splitGenericParams(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of s) {
    if (ch === "<") depth++;
    if (ch === ">") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// ── Parse javap output ───────────────────────────────────────────────────

interface JavaMember {
  kind: "constructor" | "method" | "field";
  isStatic: boolean;
  isAbstract: boolean;
  name: string;
  returnType: string;
  params: string[];
  typeParams: string[];
}

interface JavaClass {
  fullName: string;
  simpleName: string;
  kind: "class" | "interface" | "enum";
  isAbstract: boolean;
  typeParams: string[];
  members: JavaMember[];
}

function parseClassHeader(line: string): { kind: "class" | "interface" | "enum"; isAbstract: boolean; typeParams: string[] } {
  const isAbstract = line.includes(" abstract ");
  let kind: "class" | "interface" | "enum" = "class";
  if (line.includes(" interface ")) kind = "interface";
  if (line.includes(" enum ")) kind = "enum";

  // Extract type params from class declaration
  const typeParamMatch = line.match(/<([^>]+)>/);
  const typeParams: string[] = [];
  if (typeParamMatch) {
    // Just get the names: "K, V" from "<K, V>" or "T extends Foo" → "T"
    for (const p of splitGenericParams(typeParamMatch[1])) {
      const name = p.trim().split(/\s+/)[0];
      typeParams.push(name);
    }
  }

  return { kind, isAbstract, typeParams };
}

function parseMemberLine(line: string, classGenerics: string[]): JavaMember | null {
  line = line.trim();
  if (!line.startsWith("public")) return null;
  if (line.endsWith("{") || line.endsWith("}")) return null;
  // Remove trailing semicolon
  line = line.replace(/;$/, "").trim();

  // Remove "public", "static", "abstract", "final", "default", "synchronized", "transient", "volatile"
  const isStatic = line.includes(" static ");
  const isAbstract = line.includes(" abstract ");

  // Remove modifiers
  line = line
    .replace(/\bpublic\b/, "")
    .replace(/\bstatic\b/, "")
    .replace(/\babstract\b/, "")
    .replace(/\bfinal\b/, "")
    .replace(/\bdefault\b/, "")
    .replace(/\bsynchronized\b/, "")
    .replace(/\btransient\b/, "")
    .replace(/\bvolatile\b/, "")
    .replace(/\bnative\b/, "")
    .trim();

  // Remove throws clause
  line = line.replace(/\s+throws\s+.*$/, "");

  // Check for method-level type params: <T> returnType name(...)
  let methodTypeParams: string[] = [];
  const methodTpMatch = line.match(/^<([^>]+)>\s+/);
  if (methodTpMatch) {
    for (const p of splitGenericParams(methodTpMatch[1])) {
      methodTypeParams.push(p.trim().split(/\s+/)[0]);
    }
    line = line.slice(methodTpMatch[0].length);
  }

  const allGenerics = [...classGenerics, ...methodTypeParams];

  // Field: type name (no parens)
  if (!line.includes("(")) {
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      return {
        kind: "field",
        isStatic,
        isAbstract,
        name: parts[parts.length - 1],
        returnType: parts.slice(0, -1).join(" "),
        params: [],
        typeParams: methodTypeParams,
      };
    }
    return null;
  }

  // Constructor or method
  const parenIdx = line.indexOf("(");
  const preParens = line.slice(0, parenIdx).trim();
  const paramStr = line.slice(parenIdx + 1, line.lastIndexOf(")")).trim();

  const preParts = preParens.split(/\s+/);

  let name: string;
  let returnType: string;
  let kind: "constructor" | "method";

  if (preParts.length === 1) {
    // Constructor: ClassName(...)
    kind = "constructor";
    name = "constructor";
    returnType = "void";
  } else {
    kind = "method";
    name = preParts[preParts.length - 1];
    returnType = preParts.slice(0, -1).join(" ");
  }

  // Parse params — split by comma respecting generics
  const params = paramStr ? splitGenericParams(paramStr) : [];

  return {
    kind,
    isStatic,
    isAbstract,
    name,
    returnType,
    params,
    typeParams: methodTypeParams,
  };
}

function parseJavapOutput(output: string, fullClassName: string): JavaClass {
  const lines = output.split("\n");
  const simpleName = fullClassName.split(".").pop()!;

  // First line after "Compiled from" is the class declaration
  let headerLine = "";
  for (const line of lines) {
    if (line.includes("class ") || line.includes("interface ") || line.includes("enum ")) {
      headerLine = line;
      break;
    }
  }

  const header = parseClassHeader(headerLine);
  const members: JavaMember[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("public")) continue;
    if (trimmed.endsWith("{")) continue; // class header

    const member = parseMemberLine(trimmed, header.typeParams);
    if (member) members.push(member);
  }

  return {
    fullName: fullClassName,
    simpleName,
    kind: header.kind,
    isAbstract: header.isAbstract,
    typeParams: header.typeParams,
    members,
  };
}

// ── Generate .d.ts ───────────────────────────────────────────────────────

function renderMethod(m: JavaMember, classGenerics: string[], indent: string, knownClasses?: Set<string>): string {
  const allGenerics = [...classGenerics, ...m.typeParams];
  const tsParams = m.params.map((p, i) => {
    const tsType = mapJavaType(p, allGenerics, knownClasses);
    return `arg${i}: ${tsType}`;
  }).join(", ");

  const tsReturn = mapJavaType(m.returnType, allGenerics, knownClasses);
  const methodTpStr = m.typeParams.length > 0 ? `<${m.typeParams.join(", ")}>` : "";

  return `${indent}${m.name}${methodTpStr}(${tsParams}): ${tsReturn};`;
}

export function generateDts(fullClassName: string, classpath?: string, knownClasses?: Set<string>): string {
  const cpArg = classpath ? `-cp ${classpath}` : "";
  let output: string;
  try {
    output = execSync(`javap -public ${cpArg} ${fullClassName}`, {
      encoding: "utf-8",
      timeout: 10000,
    });
  } catch (err: any) {
    throw new Error(`Could not find Java class: ${fullClassName}\n${err.stderr ?? err.message}`);
  }

  const cls = parseJavapOutput(output, fullClassName);
  const moduleName = `java:${fullClassName}`;
  const tpStr = cls.typeParams.length > 0 ? `<${cls.typeParams.join(", ")}>` : "";

  const lines: string[] = [];
  lines.push(`declare module "${moduleName}" {`);

  // Separate static vs instance members
  const staticMethods = cls.members.filter((m) => m.isStatic && m.kind === "method");
  const staticFields = cls.members.filter((m) => m.isStatic && m.kind === "field");
  const instanceMethods = cls.members.filter((m) => !m.isStatic && m.kind === "method");
  const constructors = cls.members.filter((m) => m.kind === "constructor");
  const instanceFields = cls.members.filter((m) => !m.isStatic && m.kind === "field");

  const hasInstance = constructors.length > 0 || instanceMethods.length > 0 || instanceFields.length > 0;
  const hasStatic = staticMethods.length > 0 || staticFields.length > 0;

  if (hasInstance) {
    // Export as a class
    lines.push(`  export class ${cls.simpleName}${tpStr} {`);

    // Constructors
    for (const c of constructors) {
      const tsParams = c.params.map((p, i) => {
        return `arg${i}: ${mapJavaType(p, cls.typeParams, knownClasses)}`;
      }).join(", ");
      lines.push(`    constructor(${tsParams});`);
    }

    for (const f of instanceFields) {
      lines.push(`    ${f.name}: ${mapJavaType(f.returnType, cls.typeParams, knownClasses)};`);
    }

    for (const m of instanceMethods) {
      lines.push(renderMethod(m, cls.typeParams, "    ", knownClasses));
    }

    for (const m of staticMethods) {
      lines.push(`    static ${renderMethod(m, cls.typeParams, "", knownClasses).trim()}`);
    }

    for (const f of staticFields) {
      lines.push(`    static ${f.name}: ${mapJavaType(f.returnType, cls.typeParams, knownClasses)};`);
    }

    lines.push("  }");
  } else {
    lines.push(`  export const ${cls.simpleName}: {`);
    for (const f of staticFields) {
      lines.push(`    readonly ${f.name}: ${mapJavaType(f.returnType, cls.typeParams, knownClasses)};`);
    }
    for (const m of staticMethods) {
      lines.push(renderMethod(m, cls.typeParams, "    ", knownClasses));
    }
    lines.push("  };");
  }

  lines.push("}");
  return lines.join("\n");
}

/**
 * Batch-generate declarations — single `javap` call for all classes.
 * Returns a Map from className → dts string, plus errors.
 */
export function generateDtsBatch(
  classNames: string[],
  classpath?: string,
): { results: Map<string, string>; errors: Map<string, string> } {
  const results = new Map<string, string>();
  const errors = new Map<string, string>();

  if (classNames.length === 0) return { results, errors };

  // Build known classes set for cross-referencing
  const knownClasses = new Set(classNames);

  const cpArg = classpath ? `-cp ${classpath}` : "";
  let output: string;
  try {
    output = execSync(`javap -public ${cpArg} ${classNames.join(" ")}`, {
      encoding: "utf-8",
      timeout: 60000,
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (err: any) {
    // If batch fails, fall back to one-by-one
    for (const name of classNames) {
      try {
        results.set(name, generateDts(name, classpath, knownClasses));
      } catch (e: any) {
        errors.set(name, e.message.split("\n")[0]);
      }
    }
    return { results, errors };
  }

  // Split batch output by "Compiled from" markers
  const chunks = output.split(/(?=^Compiled from )/m);

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;

    const classLine = chunk
      .split("\n")
      .find((l) => /\b(class|interface|enum)\s+[\w.$]+/.test(l));
    if (!classLine) continue;

    const match = classLine.match(/\b(?:class|interface|enum)\s+([\w.$]+)/);
    if (!match) continue;

    const fullName = match[1];

    try {
      const cls = parseJavapOutput(chunk, fullName);
      const dts = renderClassDts(cls, knownClasses);
      results.set(fullName, dts);
    } catch (e: any) {
      errors.set(fullName, e.message);
    }
  }

  return { results, errors };
}

/** Render a parsed JavaClass to a declare module string. */
function renderClassDts(cls: JavaClass, knownClasses?: Set<string>): string {
  const moduleName = `java:${cls.fullName}`;
  const tpStr = cls.typeParams.length > 0 ? `<${cls.typeParams.join(", ")}>` : "";
  const lines: string[] = [];
  lines.push(`declare module "${moduleName}" {`);

  const staticMethods = cls.members.filter((m) => m.isStatic && m.kind === "method");
  const staticFields = cls.members.filter((m) => m.isStatic && m.kind === "field");
  const instanceMethods = cls.members.filter((m) => !m.isStatic && m.kind === "method");
  const constructors = cls.members.filter((m) => m.kind === "constructor");
  const instanceFields = cls.members.filter((m) => !m.isStatic && m.kind === "field");

  const hasInstance = constructors.length > 0 || instanceMethods.length > 0 || instanceFields.length > 0;

  if (hasInstance) {
    lines.push(`  export class ${cls.simpleName}${tpStr} {`);
    for (const c of constructors) {
      const tsParams = c.params.map((p, i) =>
        `arg${i}: ${mapJavaType(p, cls.typeParams, knownClasses)}`).join(", ");
      lines.push(`    constructor(${tsParams});`);
    }
    for (const f of instanceFields) {
      lines.push(`    ${f.name}: ${mapJavaType(f.returnType, cls.typeParams, knownClasses)};`);
    }
    for (const m of instanceMethods) {
      lines.push(renderMethod(m, cls.typeParams, "    ", knownClasses));
    }
    for (const m of staticMethods) {
      lines.push(`    static ${renderMethod(m, cls.typeParams, "", knownClasses).trim()}`);
    }
    for (const f of staticFields) {
      lines.push(`    static ${f.name}: ${mapJavaType(f.returnType, cls.typeParams, knownClasses)};`);
    }
    lines.push("  }");
  } else {
    lines.push(`  export const ${cls.simpleName}: {`);
    for (const f of staticFields) {
      lines.push(`    readonly ${f.name}: ${mapJavaType(f.returnType, cls.typeParams, knownClasses)};`);
    }
    for (const m of staticMethods) {
      lines.push(renderMethod(m, cls.typeParams, "    ", knownClasses));
    }
    lines.push("  };");
  }

  lines.push("}");
  return lines.join("\n");
}

/** List all public classes in a Java package using javap on known JDK modules. */
export function listPackageClasses(packageName: string): string[] {
  // Use java --list-modules + jar to enumerate, or just try common patterns
  // For JDK packages, we can list the module contents
  try {
    const modName = getModuleForPackage(packageName);
    if (modName) {
      const output = execSync(
        `java --describe-module ${modName} 2>/dev/null | grep "exports ${packageName}" || true`,
        { encoding: "utf-8" },
      );
      if (output.includes(packageName)) {
        // The package is exported — list classes via jar
        const javaHome = execSync("java -XshowSettings:property -version 2>&1 | grep java.home | awk '{print $NF}'", {
          encoding: "utf-8",
        }).trim();
        const jmodPath = `${javaHome}/jmods/${modName}.jmod`;
        try {
          const jarOutput = execSync(
            `jar tf "${jmodPath}" 2>/dev/null | grep "classes/${packageName.replace(/\\./g, '/')}/" | grep '\\.class$' | grep -v '\\$' || true`,
            { encoding: "utf-8" },
          );
          return jarOutput
            .split("\n")
            .filter(Boolean)
            .map((line) =>
              line
                .replace(/^classes\//, "")
                .replace(/\.class$/, "")
                .replace(/\//g, "."),
            );
        } catch {
          // fallback
        }
      }
    }
  } catch {
    // fallback
  }
  return [];
}

function getModuleForPackage(pkg: string): string | null {
  const moduleMap: Record<string, string> = {
    "java.lang": "java.base",
    "java.util": "java.base",
    "java.io": "java.base",
    "java.nio": "java.base",
    "java.math": "java.base",
    "java.net": "java.base",
    "java.time": "java.base",
    "java.text": "java.base",
    "java.security": "java.base",
    "java.net.http": "java.net.http",
    "java.sql": "java.sql",
    "javax.sql": "java.sql",
  };

  // Try exact match, then prefix match
  if (moduleMap[pkg]) return moduleMap[pkg];
  for (const [prefix, mod] of Object.entries(moduleMap)) {
    if (pkg.startsWith(prefix + ".")) return mod;
  }
  return "java.base";
}
