import ts from "typescript";

export interface CompilerError {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}

export function formatDiagnostic(diag: ts.Diagnostic): CompilerError {
  const file = diag.file?.fileName ?? "<unknown>";
  let line = 0;
  let column = 0;

  if (diag.file && diag.start !== undefined) {
    const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
    line = pos.line + 1;
    column = pos.character + 1;
  }

  const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
  const severity = diag.category === ts.DiagnosticCategory.Error ? "error" : "warning";

  return { file, line, column, message, severity };
}

export function formatCompilerError(err: CompilerError): string {
  return `${err.severity}: ${err.file}:${err.line}:${err.column} - ${err.message}`;
}

export class TyvmError extends Error {
  constructor(
    message: string,
    public readonly file?: string,
    public readonly line?: number,
    public readonly column?: number,
  ) {
    super(message);
    this.name = "TyvmError";
  }

  format(): string {
    const loc = this.file ? `${this.file}:${this.line ?? 0}:${this.column ?? 0}` : "<unknown>";
    return `error: ${loc} - ${this.message}`;
  }
}

export function unsupported(node: ts.Node, feature: string): never {
  const sf = node.getSourceFile();
  const pos = sf.getLineAndCharacterOfPosition(node.getStart());
  throw new TyvmError(
    `Unsupported: ${feature}`,
    sf.fileName,
    pos.line + 1,
    pos.character + 1,
  );
}
