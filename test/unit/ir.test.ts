import { describe, it, expect } from "vitest";
import { parseSource } from "../../src/frontend/parse.js";
import { lower } from "../../src/frontend/lower.js";
import { processDecorators } from "../../src/ir/passes/decorator-process.js";

describe("IR Lowering", () => {
  it("lowers a simple function", () => {
    const result = parseSource(`
      function add(a: number, b: number): number {
        return a + b;
      }
    `);
    const ir = lower(result);

    expect(ir.kind).toBe("Module");
    expect(ir.functions).toHaveLength(1);

    const fn = ir.functions[0];
    expect(fn.name).toBe("add");
    expect(fn.params).toHaveLength(2);
    expect(fn.params[0].name).toBe("a");
    expect(fn.params[0].type.kind).toBe("TyDouble");
    expect(fn.returnType.kind).toBe("TyDouble");
  });

  it("lowers console.log to Rt.println", () => {
    const result = parseSource(`
      function main(): void {
        console.log("hello");
      }
    `);
    const ir = lower(result);
    const fn = ir.functions[0];
    const stmt = fn.body.stmts[0];

    expect(stmt.kind).toBe("ExprStmt");
    if (stmt.kind === "ExprStmt") {
      expect(stmt.expr.kind).toBe("Call");
      if (stmt.expr.kind === "Call") {
        expect(stmt.expr.target).toBe("println");
        expect(stmt.expr.className).toBe("tyvm/runtime/Rt");
        expect(stmt.expr.isStatic).toBe(true);
      }
    }
  });

  it("lowers if/else", () => {
    const result = parseSource(`
      function test(x: number): number {
        if (x > 0) {
          return 1;
        } else {
          return 0;
        }
      }
    `);
    const ir = lower(result);
    const fn = ir.functions[0];
    const stmt = fn.body.stmts[0];

    expect(stmt.kind).toBe("If");
    if (stmt.kind === "If") {
      expect(stmt.condition.kind).toBe("BinaryOp");
      expect(stmt.thenBlock.stmts).toHaveLength(1);
      expect(stmt.elseBlock).toBeDefined();
    }
  });

  it("lowers while loop", () => {
    const result = parseSource(`
      function count(): void {
        let i = 0;
        while (i < 10) {
          i = i + 1;
        }
      }
    `);
    const ir = lower(result);
    const fn = ir.functions[0];

    expect(fn.body.stmts).toHaveLength(2);
    expect(fn.body.stmts[0].kind).toBe("VarDecl");
    expect(fn.body.stmts[1].kind).toBe("While");
  });

  it("lowers string concatenation", () => {
    const result = parseSource(`
      function greet(name: string): string {
        return "Hello, " + name;
      }
    `);
    const ir = lower(result);
    const fn = ir.functions[0];
    const ret = fn.body.stmts[0];

    expect(ret.kind).toBe("Return");
    if (ret.kind === "Return" && ret.expr) {
      expect(ret.expr.kind).toBe("BinaryOp");
      if (ret.expr.kind === "BinaryOp") {
        expect(ret.expr.op).toBe("+");
        expect(ret.expr.type.kind).toBe("TyString");
      }
    }
  });

  it("wraps top-level statements in synthetic main", () => {
    const result = parseSource(`
      const x = 42;
      console.log(x);
    `);
    const ir = lower(result);

    const mainFn = ir.functions.find((f) => f.name === "main");
    expect(mainFn).toBeDefined();
    expect(mainFn!.params).toHaveLength(1);
    expect(mainFn!.params[0].name).toBe("args");
  });

  it("parses and lowers decorators on classes and methods", () => {
    const result = parseSource(`
      declare function Controller(path: string): any;
      declare function Get(path: string): any;

      @Controller("/users")
      class UserController {
        @Get("/")
        list(): string {
          return "user list";
        }
      }
    `);

    // Should not have syntax errors
    const syntaxErrors = result.diagnostics.filter(
      (d) => d.category === 1 && (d.code as number) < 2000,
    );
    expect(syntaxErrors).toHaveLength(0);

    const ir = lower(result);

    // Class should exist with decorators
    expect(ir.classes).toHaveLength(1);
    const cls = ir.classes[0];
    expect(cls.name).toBe("UserController");
    expect(cls.decorators).toBeDefined();
    expect(cls.decorators).toHaveLength(1);
    expect(cls.decorators![0].name).toBe("Controller");
    expect(cls.decorators![0].arguments).toHaveLength(1);
    expect(cls.decorators![0].arguments[0].kind).toBe("Const");

    // Method should have decorator
    expect(cls.methods).toHaveLength(1);
    const method = cls.methods[0];
    expect(method.name).toBe("list");
    expect(method.decorators).toBeDefined();
    expect(method.decorators).toHaveLength(1);
    expect(method.decorators![0].name).toBe("Get");
  });

  it("processes decorators into route metadata", () => {
    const result = parseSource(`
      declare function Controller(path: string): any;
      declare function Get(path: string): any;
      declare function Post(path: string): any;

      @Controller("/users")
      class UserController {
        @Get("/")
        list(): string {
          return "user list";
        }

        @Post("/create")
        create(): string {
          return "created";
        }
      }
    `);

    const ir = lower(result);
    const { controllers } = processDecorators(ir);

    expect(controllers).toHaveLength(1);
    expect(controllers[0].className).toBe("UserController");
    expect(controllers[0].basePath).toBe("/users");
    expect(controllers[0].routes).toHaveLength(2);
    expect(controllers[0].routes[0].httpMethod).toBe("GET");
    expect(controllers[0].routes[0].path).toBe("/users");
    expect(controllers[0].routes[0].methodName).toBe("list");
    expect(controllers[0].routes[1].httpMethod).toBe("POST");
    expect(controllers[0].routes[1].path).toBe("/users/create");
    expect(controllers[0].routes[1].methodName).toBe("create");

    // Decorators should be cleared after processing
    expect(ir.classes[0].decorators).toBeUndefined();
    for (const method of ir.classes[0].methods) {
      expect(method.decorators).toBeUndefined();
    }

    // Should have generated a __handler__ function
    const initFn = ir.functions.find((f) => f.name === "__handler__");
    expect(initFn).toBeDefined();
  });
});
