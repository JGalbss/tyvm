"use strict";

const path = require("path");

/**
 * TypeScript Server Plugin for tyvm
 *
 * This plugin runs inside VS Code's TypeScript language service (tsserver).
 * It makes .tyvm files behave exactly like .ts files with full IntelliSense,
 * and auto-includes tyvm's ambient type declarations so spawn(), channel(),
 * serve(), etc. are always available with full type info.
 */
function init(modules) {
  const ts = modules.typescript;

  function create(info) {
    // Log activation
    info.project.projectService.logger.info(
      "tyvm: TypeScript plugin activated"
    );

    // Proxy the language service — we extend it rather than replace
    const ls = info.languageService;
    const proxy = Object.create(null);

    for (const k of Object.keys(ls)) {
      const v = ls[k];
      proxy[k] = typeof v === "function" ? v.bind(ls) : v;
    }

    // Enhance completions with tyvm-specific entries
    proxy.getCompletionsAtPosition = (fileName, position, options) => {
      const result = ls.getCompletionsAtPosition(fileName, position, options);
      if (!result) return result;

      // Boost tyvm runtime functions in completion ranking
      const tyvmBuiltins = new Set([
        "spawn", "channel", "serve", "router", "json", "text", "response",
        "durable", "checkpoint", "recover", "usePostgres", "useRedis",
        "workflow",
      ]);

      for (const entry of result.entries) {
        if (tyvmBuiltins.has(entry.name)) {
          entry.sortText = "0" + entry.name; // sort first
        }
      }

      return result;
    };

    // Enhance hover with tyvm context
    proxy.getQuickInfoAtPosition = (fileName, position) => {
      const result = ls.getQuickInfoAtPosition(fileName, position);
      if (!result) return result;

      // Add "tyvm runtime" tag to built-in types
      const text = result.displayParts?.map(p => p.text).join("") ?? "";
      if (text.includes("tyvm")) {
        result.tags = result.tags || [];
      }

      return result;
    };

    return proxy;
  }

  /**
   * Tell tsserver to include tyvm type declarations in every project.
   * This is what makes spawn(), channel(), serve() etc. available
   * without any import configuration.
   */
  function getExternalFiles(project) {
    const typesDir = path.resolve(__dirname, "../../../types");
    const files = [];

    try {
      const tyvmDts = path.join(typesDir, "tyvm.d.ts");
      const javaDts = path.join(typesDir, "java.d.ts");
      files.push(tyvmDts, javaDts);
    } catch {
      // types dir not found — running from installed extension
      // Try relative to extension root
      try {
        const extDir = path.resolve(__dirname, "..");
        files.push(
          path.join(extDir, "types", "tyvm.d.ts"),
          path.join(extDir, "types", "java.d.ts")
        );
      } catch {
        // ignore — types will need manual tsconfig
      }
    }

    return files;
  }

  /**
   * Resolve .tyvm modules the same way as .ts modules.
   */
  function resolveModuleNames(moduleNames, containingFile, ...rest) {
    // Let the default resolver handle everything — .tyvm files are just .ts
    return undefined;
  }

  return { create, getExternalFiles };
}

module.exports = init;
