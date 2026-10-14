import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";
import * as ts from "typescript";

let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

// ── TypeScript Language Service for .tyvm files ──────────────────────────

/** Find tyvm's types/ directory relative to the extension. */
function findTypesDir(extensionPath: string): string | undefined {
  const candidates = [
    path.resolve(extensionPath, "..", "..", "types"),
    path.resolve(extensionPath, "types"),
  ];
  // Also check workspace
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (ws) {
    candidates.push(
      path.join(ws, "node_modules", "tyvm", "types"),
      path.join(ws, "types"),
    );
  }
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "tyvm.d.ts"))) return dir;
  }
  return undefined;
}

function getAmbientFiles(extensionPath: string): string[] {
  const typesDir = findTypesDir(extensionPath);
  if (!typesDir) return [];
  const files: string[] = [];
  for (const f of ["tyvm.d.ts", "java.d.ts"]) {
    const p = path.join(typesDir, f);
    if (fs.existsSync(p)) files.push(p);
  }
  return files;
}

/**
 * Manages a TypeScript LanguageService that understands .tyvm files.
 * This is what gives us hover, completions, go-to-def, diagnostics, etc.
 */
class TyvmLanguageService {
  private ls: ts.LanguageService;
  private files = new Map<string, { version: number; content: string }>();
  private ambientFiles: string[];
  private compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    strict: true,
    noEmit: true,
    experimentalDecorators: true,
    allowJs: false,
    skipLibCheck: true,
  };

  constructor(extensionPath: string) {
    this.ambientFiles = getAmbientFiles(extensionPath);

    // Pre-load ambient files
    for (const f of this.ambientFiles) {
      this.files.set(f, { version: 0, content: fs.readFileSync(f, "utf-8") });
    }

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => [...this.files.keys()],
      getScriptVersion: (fileName) =>
        String(this.files.get(fileName)?.version ?? 0),
      getScriptSnapshot: (fileName) => {
        const entry = this.files.get(fileName);
        if (entry) return ts.ScriptSnapshot.fromString(entry.content);
        try {
          return ts.ScriptSnapshot.fromString(
            fs.readFileSync(fileName, "utf-8"),
          );
        } catch {
          return undefined;
        }
      },
      getCurrentDirectory: () =>
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd(),
      getCompilationSettings: () => this.compilerOptions,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: (fileName) =>
        this.files.has(fileName) || ts.sys.fileExists(fileName),
      readFile: (fileName) =>
        this.files.get(fileName)?.content ?? ts.sys.readFile(fileName),
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
      resolveModuleNames: (moduleNames, containingFile) => {
        return moduleNames.map((name) => {
          const result = ts.resolveModuleName(
            name,
            containingFile,
            this.compilerOptions,
            ts.sys,
          );
          if (result.resolvedModule) return result.resolvedModule;

          // Try .tyvm extension → resolve as virtual .ts path
          const dir = path.dirname(containingFile);
          const tyvmPath = path.resolve(dir, name + ".tyvm");
          if (fs.existsSync(tyvmPath)) {
            return {
              resolvedFileName: this.toVirtual(tyvmPath),
              extension: ".ts" as ts.Extension,
              isExternalLibraryImport: false,
            };
          }
          return undefined;
        });
      },
    };

    this.ls = ts.createLanguageService(host, ts.createDocumentRegistry());
  }

  /** Map real .tyvm path → virtual .ts path for TypeScript internals. */
  private toVirtual(filePath: string): string {
    return filePath.endsWith(".tyvm")
      ? filePath.slice(0, -5) + ".ts"
      : filePath;
  }

  /** Called when a .tyvm document is opened or changed. */
  updateDocument(doc: vscode.TextDocument): void {
    const key = this.toVirtual(doc.uri.fsPath);
    const existing = this.files.get(key);
    if (existing) {
      existing.version++;
      existing.content = doc.getText();
    } else {
      this.files.set(key, { version: 0, content: doc.getText() });
    }
  }

  /** Called when a .tyvm document is closed. */
  removeDocument(uri: vscode.Uri): void {
    this.files.delete(this.toVirtual(uri.fsPath));
  }

  /** Hot-reload ambient type files (e.g. after `tyvm install`). */
  reloadAmbientFiles(extensionPath: string): void {
    // Remove old ambient entries
    for (const f of this.ambientFiles) {
      this.files.delete(f);
    }
    // Re-discover and reload
    this.ambientFiles = getAmbientFiles(extensionPath);
    for (const f of this.ambientFiles) {
      this.files.set(f, { version: Date.now(), content: fs.readFileSync(f, "utf-8") });
    }
  }

  getCompletions(
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] | undefined {
    this.updateDocument(doc);
    const offset = doc.offsetAt(position);
    const completions = this.ls.getCompletionsAtPosition(
      this.toVirtual(doc.uri.fsPath),
      offset,
      { includeCompletionsForModuleExports: true },
    );
    if (!completions) return undefined;

    return completions.entries.map((entry) => {
      const kind = this.tsKindToVscode(entry.kind);
      const item = new vscode.CompletionItem(entry.name, kind);
      item.sortText = entry.sortText;
      item.insertText = entry.insertText ?? entry.name;
      if (entry.replacementSpan) {
        const start = doc.positionAt(entry.replacementSpan.start);
        const end = doc.positionAt(
          entry.replacementSpan.start + entry.replacementSpan.length,
        );
        item.range = new vscode.Range(start, end);
      }
      return item;
    });
  }

  getHover(
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | undefined {
    this.updateDocument(doc);
    const offset = doc.offsetAt(position);
    const info = this.ls.getQuickInfoAtPosition(this.toVirtual(doc.uri.fsPath), offset);
    if (!info) return undefined;

    const display = ts.displayPartsToString(info.displayParts);
    const docs = ts.displayPartsToString(info.documentation);
    const parts: string[] = [];
    if (display) parts.push("```typescript\n" + display + "\n```");
    if (docs) parts.push(docs);

    const start = doc.positionAt(info.textSpan.start);
    const end = doc.positionAt(info.textSpan.start + info.textSpan.length);
    return new vscode.Hover(
      new vscode.MarkdownString(parts.join("\n\n")),
      new vscode.Range(start, end),
    );
  }

  getDefinition(
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location[] | undefined {
    this.updateDocument(doc);
    const offset = doc.offsetAt(position);
    const defs = this.ls.getDefinitionAtPosition(this.toVirtual(doc.uri.fsPath), offset);
    if (!defs || defs.length === 0) return undefined;

    return defs.map((d) => {
      const uri = vscode.Uri.file(d.fileName);
      const start = this.tsPositionToVscode(d.fileName, d.textSpan.start);
      const end = this.tsPositionToVscode(
        d.fileName,
        d.textSpan.start + d.textSpan.length,
      );
      return new vscode.Location(uri, new vscode.Range(start, end));
    });
  }

  getSignatureHelp(
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.SignatureHelp | undefined {
    this.updateDocument(doc);
    const offset = doc.offsetAt(position);
    const sigHelp = this.ls.getSignatureHelpItems(this.toVirtual(doc.uri.fsPath), offset, {});
    if (!sigHelp || sigHelp.items.length === 0) return undefined;

    const result = new vscode.SignatureHelp();
    result.activeSignature = sigHelp.selectedItemIndex;
    result.activeParameter = sigHelp.argumentIndex;
    result.signatures = sigHelp.items.map((item) => {
      const label =
        ts.displayPartsToString(item.prefixDisplayParts) +
        item.parameters
          .map((p) => ts.displayPartsToString(p.displayParts))
          .join(ts.displayPartsToString(item.separatorDisplayParts)) +
        ts.displayPartsToString(item.suffixDisplayParts);
      const sig = new vscode.SignatureInformation(
        label,
        ts.displayPartsToString(item.documentation),
      );
      sig.parameters = item.parameters.map(
        (p) =>
          new vscode.ParameterInformation(
            ts.displayPartsToString(p.displayParts),
            ts.displayPartsToString(p.documentation),
          ),
      );
      return sig;
    });
    return result;
  }

  getDiagnostics(doc: vscode.TextDocument): vscode.Diagnostic[] {
    this.updateDocument(doc);
    const virtualPath = this.toVirtual(doc.uri.fsPath);
    const syntactic = this.ls.getSyntacticDiagnostics(virtualPath);
    const semantic = this.ls.getSemanticDiagnostics(virtualPath);
    const all = [...syntactic, ...semantic];

    return all
      .filter((d) => {
        // Suppress "Cannot find module" for tyvm and java: imports
        if (d.code === 2307) {
          const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
          if (msg.includes("'tyvm'") || msg.includes("'java:")) return false;
        }
        return true;
      })
      .filter((d) => d.start !== undefined && d.length !== undefined)
      .map((d) => {
        const start = doc.positionAt(d.start!);
        const end = doc.positionAt(d.start! + d.length!);
        const severity =
          d.category === ts.DiagnosticCategory.Error
            ? vscode.DiagnosticSeverity.Error
            : d.category === ts.DiagnosticCategory.Warning
              ? vscode.DiagnosticSeverity.Warning
              : vscode.DiagnosticSeverity.Information;
        const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
        const diag = new vscode.Diagnostic(
          new vscode.Range(start, end),
          msg,
          severity,
        );
        diag.source = "tyvm";
        diag.code = d.code;
        return diag;
      });
  }

  private tsPositionToVscode(
    fileName: string,
    offset: number,
  ): vscode.Position {
    // Try open docs first
    const doc = vscode.workspace.textDocuments.find(
      (d) => d.uri.fsPath === fileName,
    );
    if (doc) return doc.positionAt(offset);
    // Fallback: read from disk
    try {
      const content = fs.readFileSync(fileName, "utf-8");
      let line = 0;
      let col = 0;
      for (let i = 0; i < offset && i < content.length; i++) {
        if (content[i] === "\n") {
          line++;
          col = 0;
        } else {
          col++;
        }
      }
      return new vscode.Position(line, col);
    } catch {
      return new vscode.Position(0, 0);
    }
  }

  private tsKindToVscode(kind: string): vscode.CompletionItemKind {
    switch (kind) {
      case ts.ScriptElementKind.functionElement:
      case ts.ScriptElementKind.memberFunctionElement:
        return vscode.CompletionItemKind.Function;
      case ts.ScriptElementKind.variableElement:
      case ts.ScriptElementKind.localVariableElement:
      case ts.ScriptElementKind.letElement:
      case ts.ScriptElementKind.constElement:
        return vscode.CompletionItemKind.Variable;
      case ts.ScriptElementKind.classElement:
        return vscode.CompletionItemKind.Class;
      case ts.ScriptElementKind.interfaceElement:
        return vscode.CompletionItemKind.Interface;
      case ts.ScriptElementKind.keyword:
        return vscode.CompletionItemKind.Keyword;
      case ts.ScriptElementKind.memberVariableElement:
        return vscode.CompletionItemKind.Field;
      case ts.ScriptElementKind.moduleElement:
        return vscode.CompletionItemKind.Module;
      case ts.ScriptElementKind.typeElement:
        return vscode.CompletionItemKind.TypeParameter;
      default:
        return vscode.CompletionItemKind.Text;
    }
  }
}

// ── Extension activation ─────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("tyvm");
  outputChannel.appendLine("tyvm extension activated");

  // Initialize language service
  const langService = new TyvmLanguageService(context.extensionPath);
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("tyvm");
  context.subscriptions.push(diagnosticCollection);

  const TYVM_SELECTOR: vscode.DocumentSelector = { language: "tyvm" };

  // ── Hover provider ───────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(TYVM_SELECTOR, {
      provideHover(doc, pos) {
        return langService.getHover(doc, pos);
      },
    }),
  );

  // ── Completion provider ──────────────────────────────────────────────
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      TYVM_SELECTOR,
      {
        provideCompletionItems(doc, pos) {
          return langService.getCompletions(doc, pos);
        },
      },
      ".", // trigger on dot
      '"', // trigger on quote (for imports)
    ),
  );

  // ── Go-to-definition ────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(TYVM_SELECTOR, {
      provideDefinition(doc, pos) {
        return langService.getDefinition(doc, pos);
      },
    }),
  );

  // ── Signature help ──────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.languages.registerSignatureHelpProvider(
      TYVM_SELECTOR,
      {
        provideSignatureHelp(doc, pos) {
          return langService.getSignatureHelp(doc, pos);
        },
      },
      "(", // trigger
      ",", // retrigger
    ),
  );

  // ── Diagnostics on change ───────────────────────────────────────────
  const refreshDiagnostics = (doc: vscode.TextDocument) => {
    if (doc.languageId !== "tyvm") return;
    const diags = langService.getDiagnostics(doc);
    diagnosticCollection.set(doc.uri, diags);
  };

  vscode.workspace.onDidOpenTextDocument(refreshDiagnostics, null, context.subscriptions);
  vscode.workspace.onDidChangeTextDocument(
    (e) => refreshDiagnostics(e.document),
    null,
    context.subscriptions,
  );
  vscode.workspace.onDidCloseTextDocument(
    (doc) => {
      diagnosticCollection.delete(doc.uri);
      langService.removeDocument(doc.uri);
    },
    null,
    context.subscriptions,
  );

  // Refresh all open .tyvm docs
  for (const doc of vscode.workspace.textDocuments) {
    refreshDiagnostics(doc);
  }

  // ── Status bar ──────────────────────────────────────────────────────
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  statusBarItem.text = "$(zap) tyvm";
  statusBarItem.tooltip = "TypeScript → JVM bytecode";
  statusBarItem.command = "tyvm.run";
  context.subscriptions.push(statusBarItem);

  const updateStatusBar = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId === "tyvm") {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  };
  vscode.window.onDidChangeActiveTextEditor(
    updateStatusBar,
    null,
    context.subscriptions,
  );
  updateStatusBar();

  // ── Commands ────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("tyvm.compile", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No file open");
        return;
      }
      await editor.document.save();
      await compileFile(editor.document.uri.fsPath);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tyvm.run", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No file open");
        return;
      }
      await editor.document.save();
      await runFile(editor.document.uri.fsPath);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tyvm.init", async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage("No workspace folder open");
        return;
      }
      await initProject(workspaceFolder.uri.fsPath);
    }),
  );

  // File watcher for .tyvm files
  const watcher = vscode.workspace.createFileSystemWatcher("**/*.tyvm");
  context.subscriptions.push(watcher);

  // Watch type declaration files — hot-reload after `tyvm install`
  const typesWatcher = vscode.workspace.createFileSystemWatcher("**/types/java.d.ts");
  typesWatcher.onDidChange(() => {
    outputChannel.appendLine("java.d.ts changed — reloading types");
    langService.reloadAmbientFiles(context.extensionPath);
    // Re-run diagnostics on all open .tyvm files
    for (const doc of vscode.workspace.textDocuments) {
      refreshDiagnostics(doc);
    }
    vscode.window.setStatusBarMessage("$(check) tyvm types reloaded", 3000);
  });
  typesWatcher.onDidCreate(() => {
    outputChannel.appendLine("java.d.ts created — loading types");
    langService.reloadAmbientFiles(context.extensionPath);
    for (const doc of vscode.workspace.textDocuments) {
      refreshDiagnostics(doc);
    }
    vscode.window.setStatusBarMessage("$(check) tyvm types loaded", 3000);
  });
  context.subscriptions.push(typesWatcher);

  // Also watch tyvm.d.ts
  const tyvmTypesWatcher = vscode.workspace.createFileSystemWatcher("**/types/tyvm.d.ts");
  tyvmTypesWatcher.onDidChange(() => {
    langService.reloadAmbientFiles(context.extensionPath);
    for (const doc of vscode.workspace.textDocuments) {
      refreshDiagnostics(doc);
    }
  });
  context.subscriptions.push(tyvmTypesWatcher);
}

// ── Helpers ──────────────────────────────────────────────────────────────

function findTyvmBinary(): string {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceFolder) {
    const localBin = path.join(
      workspaceFolder,
      "node_modules",
      ".bin",
      "tyvm",
    );
    if (fs.existsSync(localBin)) return localBin;
  }
  try {
    const globalBin = execSync("which tyvm", { encoding: "utf-8" }).trim();
    if (globalBin) return globalBin;
  } catch {}
  return "npx tyvm";
}

async function compileFile(filePath: string) {
  const terminal = getTerminal();
  const tyvmBin = findTyvmBinary();
  const config = vscode.workspace.getConfiguration("tyvm");
  const outDir = config.get<string>("outputDir", "out");
  terminal.show();
  terminal.sendText(`${tyvmBin} compile "${filePath}" --out "${outDir}"`);
}

async function runFile(filePath: string) {
  const terminal = getTerminal();
  const tyvmBin = findTyvmBinary();
  terminal.show();
  terminal.sendText(`${tyvmBin} run "${filePath}"`);
}

async function initProject(workspacePath: string) {
  const tsconfigPath = path.join(workspacePath, "tsconfig.json");
  if (fs.existsSync(tsconfigPath)) {
    const overwrite = await vscode.window.showWarningMessage(
      "tsconfig.json already exists. Overwrite?",
      "Yes",
      "No",
    );
    if (overwrite !== "Yes") return;
  }

  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ES2022",
      moduleResolution: "node",
      strict: true,
      noEmit: true,
      experimentalDecorators: true,
      skipLibCheck: true,
    },
    include: ["**/*.tyvm", "**/*.ts"],
    exclude: ["node_modules", "out"],
  };

  fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n");

  const samplePath = path.join(workspacePath, "main.tyvm");
  if (!fs.existsSync(samplePath)) {
    const sample = `import { spawn, channel, serve, json } from "tyvm";

// Your first tyvm program — runs on JVM virtual threads
const task = spawn(compute(42));
const result = task.await();
console.log(result);

function compute(n: number): number {
  return n * n;
}
`;
    fs.writeFileSync(samplePath, sample);
  }

  vscode.window.showInformationMessage("tyvm project initialized!");
}

let terminal: vscode.Terminal | undefined;

function getTerminal(): vscode.Terminal {
  if (terminal && !terminal.exitStatus) return terminal;
  terminal = vscode.window.createTerminal({
    name: "tyvm",
    iconPath: new vscode.ThemeIcon("zap"),
  });
  return terminal;
}

export function deactivate() {
  outputChannel?.dispose();
  statusBarItem?.dispose();
}
