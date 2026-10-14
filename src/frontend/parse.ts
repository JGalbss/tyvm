import ts from "typescript";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ParseResult {
  sourceFile: ts.SourceFile;
  program: ts.Program;
  checker: ts.TypeChecker;
  diagnostics: ts.Diagnostic[];
}

const defaultCompilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ES2022,
  strict: true,
  noEmit: true,
  experimentalDecorators: true,
  allowArbitraryExtensions: true,
};

/** Find tyvm's types/ directory (tyvm.d.ts + java.d.ts). */
function findTypesDir(): string | undefined {
  const candidates = [
    resolve(__dirname, "..", "..", "types"),
    resolve(__dirname, "..", "types"),
    resolve(process.cwd(), "node_modules", "tyvm", "types"),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "tyvm.d.ts"))) return dir;
  }
  return undefined;
}

/** Get ambient type definition files to include automatically. */
function getAmbientTypeFiles(): string[] {
  const typesDir = findTypesDir();
  if (!typesDir) return [];
  const files: string[] = [];
  const tyvmDts = join(typesDir, "tyvm.d.ts");
  const javaDts = join(typesDir, "java.d.ts");
  if (existsSync(tyvmDts)) files.push(tyvmDts);
  if (existsSync(javaDts)) files.push(javaDts);
  return files;
}

/**
 * For .tyvm files, we give TypeScript a virtual .ts path so it accepts the file,
 * but read from the real .tyvm path on disk.
 */
function toVirtualPath(filePath: string): string {
  if (filePath.endsWith(".tyvm")) {
    return filePath.slice(0, -5) + ".ts";
  }
  return filePath;
}

function isVirtualPath(fileName: string, realPath: string): boolean {
  return fileName === toVirtualPath(realPath);
}

/**
 * Parse a .tyvm or .ts file from disk and return a full program with type checker.
 * Automatically includes tyvm runtime type definitions.
 */
export function parseFile(filePath: string): ParseResult {
  const isTyvm = filePath.endsWith(".tyvm");
  const virtualPath = toVirtualPath(filePath);
  const ambientFiles = getAmbientTypeFiles();
  const rootFiles = [...ambientFiles, virtualPath];

  const defaultHost = ts.createCompilerHost(defaultCompilerOptions);

  const host: ts.CompilerHost = {
    ...defaultHost,
    getSourceFile(fileName, languageVersion, onError) {
      if (isTyvm && fileName === virtualPath) {
        const content = readFileSync(filePath, "utf-8");
        return ts.createSourceFile(
          virtualPath,
          content,
          languageVersion,
          true,
          ts.ScriptKind.TS,
        );
      }
      return defaultHost.getSourceFile(fileName, languageVersion, onError);
    },
    fileExists(fileName) {
      if (isTyvm && fileName === virtualPath) return true;
      return defaultHost.fileExists(fileName);
    },
    readFile(fileName) {
      if (isTyvm && fileName === virtualPath) {
        return readFileSync(filePath, "utf-8");
      }
      return defaultHost.readFile(fileName);
    },
    resolveModuleNames(moduleNames, containingFile, ...rest) {
      return moduleNames.map((name) => {
        const result = ts.resolveModuleName(name, containingFile, defaultCompilerOptions, defaultHost);
        if (result.resolvedModule) return result.resolvedModule;
        // Try with .tyvm extension
        const tyvmPath = resolve(dirname(containingFile), name + ".tyvm");
        if (defaultHost.fileExists(tyvmPath)) {
          return {
            resolvedFileName: toVirtualPath(tyvmPath),
            extension: ".ts" as ts.Extension,
            isExternalLibraryImport: false,
          };
        }
        return undefined;
      });
    },
  };

  const program = ts.createProgram(rootFiles, defaultCompilerOptions, host);
  const sourceFile = program.getSourceFile(virtualPath);
  if (!sourceFile) {
    throw new Error(`Could not load source file: ${filePath}`);
  }
  const checker = program.getTypeChecker();

  // Filter diagnostics: suppress errors from .d.ts ambient files and
  // errors about unknown module specifiers (java:*, tyvm)
  const diagnostics = [
    ...program.getSyntacticDiagnostics(sourceFile),
    ...program.getSemanticDiagnostics(sourceFile),
  ].filter((d) => {
    if (d.code === 2307) {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      if (msg.includes("'tyvm'") || msg.includes("'java:")) return false;
    }
    return true;
  });

  return { sourceFile, program, checker, diagnostics };
}

/**
 * Parse TypeScript source from a string. Useful for testing.
 */
export function parseSource(
  source: string,
  fileName: string = "input.ts",
): ParseResult {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );

  const defaultHost = ts.createCompilerHost(defaultCompilerOptions);
  const ambientFiles = getAmbientTypeFiles();

  const host: ts.CompilerHost = {
    ...defaultHost,
    getSourceFile(name, languageVersion) {
      if (name === fileName) return sourceFile;
      return defaultHost.getSourceFile(name, languageVersion);
    },
    fileExists(name) {
      if (name === fileName) return true;
      return defaultHost.fileExists(name);
    },
    readFile(name) {
      if (name === fileName) return source;
      return defaultHost.readFile(name);
    },
  };

  const rootFiles = [...ambientFiles, fileName];
  const program = ts.createProgram(rootFiles, defaultCompilerOptions, host);
  const checker = program.getTypeChecker();

  const sf = program.getSourceFile(fileName);
  if (!sf) {
    throw new Error(`Failed to create source file: ${fileName}`);
  }

  const diagnostics = [
    ...program.getSyntacticDiagnostics(sf),
    ...program.getSemanticDiagnostics(sf),
  ];

  return { sourceFile: sf, program, checker, diagnostics };
}
