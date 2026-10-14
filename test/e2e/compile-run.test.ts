import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve, join } from "node:path";
import { mkdirSync } from "node:fs";

const ROOT = resolve(import.meta.dirname, "../..");
const CLI = join(ROOT, "dist/cli.js");
const FIXTURES = join(ROOT, "test/fixtures");
const OUT = join(ROOT, "out/test");
const RUNTIME = join(ROOT, "runtime/tyvm-runtime.jar");

function compile(fixture: string): string {
  mkdirSync(OUT, { recursive: true });
  execSync(`node ${CLI} compile ${join(FIXTURES, fixture)} --out ${OUT}`, {
    cwd: ROOT,
    encoding: "utf-8",
  });

  const className = fixture.replace(/\.ts$/, "");
  const output = execSync(
    `java -cp "${OUT}:${RUNTIME}" ${className}`,
    { cwd: ROOT, encoding: "utf-8" },
  );
  return output.trim();
}

describe("End-to-end compilation", () => {
  it("hello.ts prints greeting", () => {
    expect(compile("hello.ts")).toBe("hello from tyvm!");
  });

  it("add.ts computes 2 + 3 = 5", () => {
    expect(compile("add.ts")).toBe("5");
  });

  it("arithmetic.ts computes correctly", () => {
    const lines = compile("arithmetic.ts").split("\n");
    expect(lines[0]).toBe("13");
    expect(lines[1]).toBe("7");
    expect(lines[2]).toBe("30");
    expect(lines[3]).toBe("3.3333333333333335");
  });

  it("control-flow.ts computes fibonacci", () => {
    const lines = compile("control-flow.ts").split("\n");
    expect(lines).toEqual([
      "0", "1", "1", "2", "3", "5", "8", "13", "21", "34",
    ]);
  });

  it("strings.ts concatenates strings", () => {
    const lines = compile("strings.ts").split("\n");
    expect(lines[0]).toBe("Hello, world!");
    expect(lines[1]).toBe("Hello, tyvm!");
  });
});
