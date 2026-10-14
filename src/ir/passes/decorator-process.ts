/**
 * Decorator Processing Pass
 *
 * Compiles NestJS-style decorators into a real HTTP request handler.
 *
 * Input:
 *   @Controller("/api/users")
 *   class UserController {
 *     @Get("/")
 *     list(): string { return '{"users":[]}'; }
 *     @Post("/")
 *     create(body: string): string { return '{"created":true}'; }
 *   }
 *   serve(8080);
 *
 * Output: generates a __handler__ function that dispatches requests to
 * the right controller method based on HTTP method + path matching.
 * The serve() call is wired to use this generated handler.
 */

import type {
  Module as IRModule,
  ClassDef,
  FunctionDef,
  Decorator,
  IRStmt,
  IRExpr,
  Block,
  JvmType,
} from "../nodes.js";

const HTTP_METHOD_DECORATORS = new Set(["Get", "Post", "Put", "Delete", "Patch"]);

export interface RouteEntry {
  httpMethod: string;
  path: string;
  className: string;
  methodName: string;
}

export interface ControllerMetadata {
  className: string;
  basePath: string;
  routes: RouteEntry[];
}

const TY_STRING: JvmType = { kind: "TyString" };
const TY_VOID: JvmType = { kind: "TyVoid" };
const TY_OBJECT: JvmType = { kind: "TyObject", className: "java/lang/Object" };
const TY_REQUEST: JvmType = { kind: "TyObject", className: "tyvm/runtime/HttpServer$Request" };
const TY_RESPONSE: JvmType = { kind: "TyObject", className: "tyvm/runtime/HttpServer$Response" };

/**
 * Process decorators in the module. Extracts controller/route metadata,
 * generates a __handler__ dispatch function, and clears decorators.
 */
export function processDecorators(mod: IRModule): {
  module: IRModule;
  controllers: ControllerMetadata[];
} {
  const controllers: ControllerMetadata[] = [];

  for (const cls of mod.classes) {
    if (!cls.decorators || cls.decorators.length === 0) continue;

    const controllerDec = cls.decorators.find(d => d.name === "Controller");
    if (controllerDec) {
      const meta = processController(cls, controllerDec);
      controllers.push(meta);
      cls.decorators = undefined;
    }

    // Clear @Injectable (marker only)
    if (cls.decorators) {
      cls.decorators = cls.decorators.filter(d => d.name !== "Injectable");
      if (cls.decorators.length === 0) cls.decorators = undefined;
    }

    // Clear method decorators
    for (const method of cls.methods) {
      if (method.decorators) method.decorators = undefined;
    }
  }

  // Generate __handler__ function if we found controllers
  if (controllers.length > 0) {
    const allRoutes: RouteEntry[] = [];
    for (const c of controllers) {
      for (const r of c.routes) {
        allRoutes.push(r);
      }
    }
    const handlerFn = generateHandlerFunction(mod, allRoutes);
    mod.functions.push(handlerFn);
  }

  return { module: mod, controllers };
}

function processController(cls: ClassDef, dec: Decorator): ControllerMetadata {
  let basePath = "/";
  if (dec.arguments.length > 0) {
    const firstArg = dec.arguments[0];
    if (firstArg.kind === "Const" && typeof firstArg.value === "string") {
      basePath = firstArg.value;
    }
  }

  const routes: RouteEntry[] = [];
  for (const method of cls.methods) {
    if (!method.decorators) continue;
    for (const methodDec of method.decorators) {
      if (!HTTP_METHOD_DECORATORS.has(methodDec.name)) continue;
      let methodPath = "/";
      if (methodDec.arguments.length > 0) {
        const firstArg = methodDec.arguments[0];
        if (firstArg.kind === "Const" && typeof firstArg.value === "string") {
          methodPath = firstArg.value;
        }
      }
      const fullPath = normalizePath(basePath + methodPath);
      routes.push({
        httpMethod: methodDec.name.toUpperCase(),
        path: fullPath,
        className: cls.name,
        methodName: method.name,
      });
    }
  }

  return { className: cls.name, basePath, routes };
}

/**
 * Generate a __handler__(req: Request) -> Response function that dispatches
 * to the right controller method by checking path and method.
 *
 * Generated code equivalent:
 *   function __handler__(req: Request): Response {
 *     const path = req.getPath();
 *     const method = req.getMethod();
 *     if (path === "/api/users" && method === "GET") {
 *       const result = UserController.list();
 *       return Response.json(result);
 *     }
 *     ...
 *     return Response.error(404, '{"error":"not found"}');
 *   }
 */
function findMethodDef(mod: IRModule, className: string, methodName: string): FunctionDef | undefined {
  const cls = mod.classes.find(c => c.name === className);
  if (cls) return cls.methods.find(m => m.name === methodName);
  return undefined;
}

function generateHandlerFunction(mod: IRModule, routes: RouteEntry[]): FunctionDef {
  const moduleName = mod.name;
  const stmts: IRStmt[] = [];

  // const path = req.getPath();
  stmts.push({
    kind: "VarDecl",
    name: "path",
    type: TY_STRING,
    init: {
      kind: "Call",
      target: "getPath",
      className: "tyvm/runtime/HttpServer$Request",
      args: [{ kind: "LoadLocal", name: "req", type: TY_REQUEST }],
      returnType: TY_STRING,
      isStatic: false,
    },
  });

  // const method = req.getMethod();
  stmts.push({
    kind: "VarDecl",
    name: "method",
    type: TY_STRING,
    init: {
      kind: "Call",
      target: "getMethod",
      className: "tyvm/runtime/HttpServer$Request",
      args: [{ kind: "LoadLocal", name: "req", type: TY_REQUEST }],
      returnType: TY_STRING,
      isStatic: false,
    },
  });

  // Generate if-chain for each route
  for (const route of routes) {
    const pathCheck: IRExpr = {
      kind: "BinaryOp",
      op: "==",
      left: { kind: "LoadLocal", name: "path", type: TY_STRING },
      right: { kind: "Const", value: route.path, type: TY_STRING },
      type: { kind: "TyBoolean" },
    };

    const methodCheck: IRExpr = {
      kind: "BinaryOp",
      op: "==",
      left: { kind: "LoadLocal", name: "method", type: TY_STRING },
      right: { kind: "Const", value: route.httpMethod, type: TY_STRING },
      type: { kind: "TyBoolean" },
    };

    const condition: IRExpr = {
      kind: "BinaryOp",
      op: "&&",
      left: pathCheck,
      right: methodCheck,
      type: { kind: "TyBoolean" },
    };

    // Call the controller method, passing the request if the method accepts one
    const methodDef = findMethodDef(mod, route.className, route.methodName);
    const callArgs: IRExpr[] = [];
    if (methodDef && methodDef.params.length > 0) {
      // Pass the request object to the controller method
      callArgs.push({ kind: "LoadLocal", name: "req", type: TY_REQUEST });
    }

    const callExpr: IRExpr = {
      kind: "Call",
      target: route.methodName,
      className: moduleName,
      args: callArgs,
      returnType: TY_STRING,
      isStatic: true,
    };

    // Return Response.json(result)
    const responseExpr: IRExpr = {
      kind: "Call",
      target: "json",
      className: "tyvm/runtime/HttpServer$Response",
      args: [callExpr],
      returnType: TY_RESPONSE,
      isStatic: true,
    };

    const ifStmt: IRStmt = {
      kind: "If",
      condition,
      thenBlock: {
        kind: "Block",
        stmts: [{ kind: "Return", expr: responseExpr }],
      },
    };

    stmts.push(ifStmt);
  }

  // Default: return Response.error(404, ...)
  const notFoundExpr: IRExpr = {
    kind: "Call",
    target: "error",
    className: "tyvm/runtime/HttpServer$Response",
    args: [
      { kind: "Const", value: 404, type: { kind: "TyInt" } },
      { kind: "Const", value: '{"error":"not found"}', type: TY_STRING },
    ],
    returnType: TY_RESPONSE,
    isStatic: true,
  };
  stmts.push({ kind: "Return", expr: notFoundExpr });

  return {
    kind: "FunctionDef",
    name: "__handler__",
    params: [{ name: "req", type: TY_REQUEST }],
    returnType: TY_RESPONSE,
    body: { kind: "Block", stmts },
    isExported: false,
    isTask: false,
  };
}

function normalizePath(path: string): string {
  let normalized = path.replace(/\/+/g, "/");
  if (!normalized.startsWith("/")) normalized = "/" + normalized;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
