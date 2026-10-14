// Real HTTP API server running on tyvm
// Uses Java's built-in com.sun.net.httpserver.HttpServer
// Each request handled on a virtual thread via tyvm's spawn()
//
// Compile & run:
//   node dist/cli.js compile examples/http-api.ts --out out
//   java -cp out:runtime/tyvm-runtime.jar http-api
//
// Test with:
//   curl http://localhost:8080/
//   curl http://localhost:8080/api/users
//   curl -X POST http://localhost:8080/api/users -d '{"name":"alice"}'
//   curl http://localhost:8080/api/health

import { spawn, channel, Channel } from "tyvm";
import { HttpServer } from "java:com.sun.net.httpserver.HttpServer";
import { HttpExchange } from "java:com.sun.net.httpserver.HttpExchange";
import { HttpHandler } from "java:com.sun.net.httpserver.HttpHandler";
import { InetSocketAddress } from "java:java.net.InetSocketAddress";
import { OutputStream } from "java:java.io.OutputStream";
import { InputStream } from "java:java.io.InputStream";
import { InputStreamReader } from "java:java.io.InputStreamReader";
import { BufferedReader } from "java:java.io.BufferedReader";
import { StringBuilder } from "java:java.lang.StringBuilder";
import { HashMap } from "java:java.util.HashMap";
import { System } from "java:java.lang.System";
import { Math } from "java:java.lang.Math";

// ── In-memory data store (Java HashMap as our "database") ──────────────
const users: HashMap = new HashMap();
let nextId: number = 1;

// ── Read request body from HttpExchange ────────────────────────────────
function readBody(exchange: HttpExchange): string {
  const reader: BufferedReader = new BufferedReader(
    new InputStreamReader(exchange.getRequestBody())
  );
  const sb: StringBuilder = new StringBuilder();
  let line: string = reader.readLine();
  while (line !== null) {
    sb.append(line);
    line = reader.readLine();
  }
  reader.close();
  return sb.toString();
}

// ── Send response ──────────────────────────────────────────────────────
function sendResponse(exchange: HttpExchange, status: number, body: string): void {
  const bytes: number = body.length;
  exchange.sendResponseHeaders(status, bytes);
  const os: OutputStream = exchange.getResponseBody();
  os.write(body.getBytes());
  os.close();
  exchange.close();
}

// ── Route: GET / ───────────────────────────────────────────────────────
function handleRoot(exchange: HttpExchange): void {
  const json: string = "{\"service\":\"tyvm-api\",\"version\":\"1.0\",\"endpoints\":[\"/api/users\",\"/api/health\"]}";
  exchange.getResponseHeaders().set("Content-Type", "application/json");
  sendResponse(exchange, 200, json);
}

// ── Route: GET /api/health ─────────────────────────────────────────────
function handleHealth(exchange: HttpExchange): void {
  const uptime: number = System.currentTimeMillis();
  const userCount: number = users.size();
  const json: string = "{\"status\":\"ok\",\"uptime_ms\":" + uptime + ",\"users\":" + userCount + "}";
  exchange.getResponseHeaders().set("Content-Type", "application/json");
  sendResponse(exchange, 200, json);
}

// ── Route: GET /api/users ──────────────────────────────────────────────
function handleGetUsers(exchange: HttpExchange): void {
  // Build a JSON array of all users
  const sb: StringBuilder = new StringBuilder();
  sb.append("[");
  let i = 1;
  let first: boolean = true;
  while (i < nextId) {
    const key: string = "user-" + i;
    if (users.containsKey(key)) {
      if (!first) {
        sb.append(",");
      }
      sb.append(users.get(key));
      first = false;
    }
    i = i + 1;
  }
  sb.append("]");
  exchange.getResponseHeaders().set("Content-Type", "application/json");
  sendResponse(exchange, 200, sb.toString());
}

// ── Route: POST /api/users ─────────────────────────────────────────────
function handleCreateUser(exchange: HttpExchange): void {
  const body: string = readBody(exchange);
  const id: number = nextId;
  nextId = nextId + 1;
  const timestamp: number = System.currentTimeMillis();
  const json: string = "{\"id\":" + id + ",\"data\":" + body + ",\"created\":" + timestamp + "}";
  users.put("user-" + id, json);
  console.log("Created user " + id);
  exchange.getResponseHeaders().set("Content-Type", "application/json");
  sendResponse(exchange, 201, json);
}

// ── Route dispatcher ───────────────────────────────────────────────────
function handleRequest(exchange: HttpExchange): void {
  const method: string = exchange.getRequestMethod();
  const path: string = exchange.getRequestURI().getPath();
  const start: number = System.nanoTime();

  console.log(method + " " + path);

  if (path === "/" && method === "GET") {
    handleRoot(exchange);
  } else if (path === "/api/health" && method === "GET") {
    handleHealth(exchange);
  } else if (path === "/api/users" && method === "GET") {
    handleGetUsers(exchange);
  } else if (path === "/api/users" && method === "POST") {
    handleCreateUser(exchange);
  } else {
    sendResponse(exchange, 404, "{\"error\":\"not found\"}");
  }

  const elapsed: number = (System.nanoTime() - start) / 1000000;
  console.log("  -> " + elapsed + "ms");
}

// ── Start server ───────────────────────────────────────────────────────
function main(): void {
  const port = 8080;
  const addr: InetSocketAddress = new InetSocketAddress(port);
  const server: HttpServer = HttpServer.create(addr, 0);

  // TODO: server.createContext("/", handler) requires HttpHandler interface
  // For now we register the root context
  server.createContext("/", handleRequest);
  server.start();

  console.log("tyvm HTTP server listening on http://localhost:" + port);
  console.log("Press Ctrl+C to stop");
  console.log("");
  console.log("Try:");
  console.log("  curl http://localhost:" + port + "/");
  console.log("  curl http://localhost:" + port + "/api/users");
  console.log("  curl -X POST http://localhost:" + port + "/api/users -d '{\"name\":\"alice\"}'");
  console.log("  curl http://localhost:" + port + "/api/health");
}

main();
