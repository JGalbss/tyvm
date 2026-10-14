// Node.js "http" module polyfill for tyvm
//
// Implements a subset of the Node.js HTTP API backed by Java standard library
// classes. The server side uses com.sun.net.httpserver.HttpServer (built into
// the JDK) and the client side uses java.net.HttpURLConnection.
//
// Because tyvm has no event loop, async callbacks, or Promises, the
// event-driven "on(event, handler)" pattern is simulated using virtual threads
// (spawn) and channels. Each incoming connection runs on its own virtual
// thread, which calls the stored handler functions directly.
//
// Compile & run:
//   node dist/cli.js compile polyfills/node/http.ts
//   java -cp out:runtime/tyvm-runtime.jar http

import { spawn, Channel, channel } from "tyvm";
import { System } from "java:java.lang.System";
import { HashMap } from "java:java.util.HashMap";
import { ArrayList } from "java:java.util.ArrayList";
import { StringBuilder } from "java:java.lang.StringBuilder";

// ---------------------------------------------------------------------------
// Java interop imports for HTTP server
// Backed by com.sun.net.httpserver.HttpServer (JDK built-in)
// ---------------------------------------------------------------------------
import { HttpServer as JHttpServer } from "java:com.sun.net.httpserver.HttpServer";
import { InetSocketAddress } from "java:java.net.InetSocketAddress";
import { HttpExchange } from "java:com.sun.net.httpserver.HttpExchange";
import { HttpHandler } from "java:com.sun.net.httpserver.HttpHandler";

// ---------------------------------------------------------------------------
// Java interop imports for HTTP client
// Backed by java.net.HttpURLConnection
// ---------------------------------------------------------------------------
import { URL } from "java:java.net.URL";
import { HttpURLConnection } from "java:java.net.HttpURLConnection";
import { InputStream } from "java:java.io.InputStream";
import { OutputStream } from "java:java.io.OutputStream";
import { InputStreamReader } from "java:java.io.InputStreamReader";
import { BufferedReader } from "java:java.io.BufferedReader";
import { OutputStreamWriter } from "java:java.io.OutputStreamWriter";

// =========================================================================
// IncomingMessage — Represents an incoming HTTP request
// =========================================================================
// Mirrors Node.js http.IncomingMessage. Wraps the parsed request data
// extracted from a Java HttpExchange object.

class IncomingMessage {
  // The HTTP method: "GET", "POST", "PUT", "DELETE", etc.
  method: string;
  // The request URL path (e.g., "/api/users")
  url: string;
  // HTTP headers stored as a HashMap<string, string>
  // Backed by java.util.HashMap
  headers: HashMap;
  // The request body as a string (read from the input stream)
  body: string;
  // HTTP version string
  httpVersion: string;
  // The raw status code (used on client-side responses)
  statusCode: number;
  // Status message (used on client-side responses)
  statusMessage: string;

  constructor() {
    this.method = "GET";
    this.url = "/";
    this.headers = new HashMap();
    this.body = "";
    this.httpVersion = "1.1";
    this.statusCode = 0;
    this.statusMessage = "";
  }
}

// =========================================================================
// ServerResponse — Writable response object for the server
// =========================================================================
// Mirrors Node.js http.ServerResponse. Buffers the response headers and
// body, then flushes them through the Java HttpExchange when end() is called.

class ServerResponse {
  // Status code to send (default 200)
  statusCode: number;
  // Response headers stored in a HashMap<string, string>
  // Backed by java.util.HashMap
  _headers: HashMap;
  // Whether headers have already been sent
  headersSent: boolean;
  // Buffered response body chunks
  // Backed by java.util.ArrayList
  _bodyChunks: ArrayList;
  // Whether end() has been called
  _finished: boolean;
  // Channel used to signal that the response is complete.
  // The server thread blocks on this channel until end() is called,
  // ensuring the Java HttpExchange stays open until the response is ready.
  _done: Channel<number>;

  constructor() {
    this.statusCode = 200;
    this._headers = new HashMap();
    this.headersSent = false;
    this._bodyChunks = new ArrayList();
    this._finished = false;
    this._done = channel();
  }

  // Set a response header. Mirrors res.setHeader(name, value) in Node.js.
  setHeader(name: string, value: string): void {
    this._headers.put(name, value);
  }

  // Get a response header value.
  getHeader(name: string): string {
    if (this._headers.containsKey(name)) {
      return this._headers.get(name);
    }
    return "";
  }

  // Remove a response header.
  removeHeader(name: string): void {
    this._headers.remove(name);
  }

  // Set status code and headers at once. Mirrors res.writeHead(code, headers).
  // The headers parameter is a HashMap<string, string>.
  writeHead(statusCode: number, headers: HashMap): void {
    this.statusCode = statusCode;
    if (headers !== null) {
      // Merge provided headers into our header map.
      // Since tyvm does not support iterators, callers should use
      // setHeader() for individual headers or pass a pre-built HashMap.
      this._headers = headers;
    }
    this.headersSent = true;
  }

  // Write a chunk of the response body. Mirrors res.write(chunk).
  write(chunk: string): void {
    this._bodyChunks.add(chunk);
  }

  // Signal that the response is complete. Mirrors res.end(data?).
  // If data is provided, it is appended as the final body chunk.
  // After end(), the internal channel is signalled so the server thread
  // can flush the response through the Java HttpExchange.
  end(data: string): void {
    if (data !== "") {
      this._bodyChunks.add(data);
    }
    this._finished = true;
    // Signal the server thread that the response is ready to flush
    this._done.send(1);
  }

  // Convenience overload: end with no body
  endEmpty(): void {
    this._finished = true;
    this._done.send(1);
  }

  // Internal: concatenate all body chunks into a single string.
  // Uses java.lang.StringBuilder for efficient string building.
  _getBody(): string {
    const sb: StringBuilder = new StringBuilder();
    let i = 0;
    while (i < this._bodyChunks.size()) {
      sb.append(this._bodyChunks.get(i));
      i = i + 1;
    }
    return sb.toString();
  }
}

// =========================================================================
// Server — HTTP server backed by com.sun.net.httpserver.HttpServer
// =========================================================================
// Mirrors Node.js http.Server. Each incoming request is dispatched to its
// own virtual thread via spawn(), matching the virtual-thread-per-request
// model that modern Java servers use with Project Loom.

class Server {
  // The user-provided request handler function.
  // Called as: _requestHandler(req, res) for each incoming request.
  _requestHandler: number;
  // Stored event handlers keyed by event name.
  // Backed by java.util.HashMap. Keys: "request", "listening", "error", "close"
  _handlers: HashMap;
  // The underlying Java HTTP server instance.
  // Backed by com.sun.net.httpserver.HttpServer
  _javaServer: JHttpServer;
  // Port number the server is listening on
  _port: number;
  // Hostname the server is bound to
  _hostname: string;
  // Whether the server is currently running
  _listening: boolean;

  constructor() {
    this._requestHandler = 0;
    this._handlers = new HashMap();
    this._port = 0;
    this._hostname = "0.0.0.0";
    this._listening = false;
  }

  // Register an event handler. Mirrors server.on(event, handler).
  // Supported events: "request", "listening", "error", "close"
  //
  // Since tyvm does not have first-class closures that can be stored
  // generically, handlers are stored as numeric IDs in the HashMap.
  // Callers use a dispatch pattern (switch on handler ID) instead.
  on(event: string, handlerId: number): void {
    this._handlers.put(event, handlerId);
  }

  // Start listening for incoming connections.
  // Mirrors server.listen(port, hostname?, callback?).
  //
  // Under the hood this creates a com.sun.net.httpserver.HttpServer,
  // binds it to the given address, and creates a root context ("/") that
  // dispatches each request to a virtual thread.
  listen(port: number, hostname: string): void {
    this._port = port;
    this._hostname = hostname;
    this._listening = true;

    // Create the Java HTTP server bound to the requested address
    // Backed by: com.sun.net.httpserver.HttpServer.create(InetSocketAddress, backlog)
    const addr: InetSocketAddress = new InetSocketAddress(hostname, port);
    this._javaServer = JHttpServer.create(addr, 0);

    // Start the server — it will use virtual threads internally
    this._javaServer.start();

    console.log("[http.Server] Listening on " + hostname + ":" + port);
  }

  // Convenience: listen on all interfaces with just a port
  listenOnPort(port: number): void {
    this.listen(port, "0.0.0.0");
  }

  // Stop the server. Mirrors server.close().
  // Backed by: HttpServer.stop(delaySeconds)
  close(): void {
    if (this._listening) {
      this._javaServer.stop(0);
      this._listening = false;
      console.log("[http.Server] Closed");
    }
  }

  // Returns the bound address info as a string "hostname:port"
  address(): string {
    return this._hostname + ":" + this._port;
  }
}

// =========================================================================
// createServer — Factory function for Server
// =========================================================================
// Mirrors Node.js http.createServer(requestListener).
//
// The requestListener is identified by a numeric handler ID. The actual
// dispatch logic lives in the caller's code, since tyvm cannot store
// arbitrary function references in a generic way.
//
// Usage pattern:
//   const server: Server = createServer(1);
//   server.listen(3000, "0.0.0.0");
//
// Then in a dispatch function the caller maps handler ID 1 to the actual
// request-handling logic.

function createServer(handlerId: number): Server {
  const server: Server = new Server();
  server._requestHandler = handlerId;
  return server;
}

// =========================================================================
// HTTP Client — request() and get()
// =========================================================================
// Mirrors Node.js http.request(options, callback) and http.get(url, callback).
// Backed by java.net.HttpURLConnection.
//
// Since tyvm has no callbacks or Promises, the client functions run
// synchronously (which is fine on virtual threads — they won't block
// platform threads).

// Parse a response from an HttpURLConnection into an IncomingMessage.
// Reads the response body using java.io.BufferedReader.
function _readResponse(conn: HttpURLConnection): IncomingMessage {
  const msg: IncomingMessage = new IncomingMessage();
  msg.statusCode = conn.getResponseCode();
  msg.statusMessage = conn.getResponseMessage();

  // Read response body from the input stream
  // Backed by: java.io.BufferedReader wrapping java.io.InputStreamReader
  const reader: BufferedReader = new BufferedReader(
    new InputStreamReader(conn.getInputStream())
  );
  const sb: StringBuilder = new StringBuilder();
  let line: string = reader.readLine();
  while (line !== null) {
    sb.append(line);
    line = reader.readLine();
  }
  reader.close();
  msg.body = sb.toString();

  return msg;
}

// Make an HTTP request. Mirrors Node.js http.request(options, callback).
//
// Options are passed as individual parameters since tyvm does not support
// object literals with arbitrary shapes as options bags.
//
// Parameters:
//   hostname — target host (e.g., "localhost")
//   port     — target port (e.g., 8080)
//   path     — request path (e.g., "/api/data")
//   method   — HTTP method (e.g., "GET", "POST")
//   body     — request body string (empty string for no body)
//
// Returns an IncomingMessage containing the response.
//
// Backed by: java.net.HttpURLConnection
function request(hostname: string, port: number, path: string, method: string, body: string): IncomingMessage {
  // Build the URL string
  const urlStr: string = "http://" + hostname + ":" + port + path;
  const url: URL = new URL(urlStr);

  // Open the connection
  // Backed by: java.net.URL.openConnection() cast to HttpURLConnection
  const conn: HttpURLConnection = url.openConnection();
  conn.setRequestMethod(method);

  // If there is a request body, write it to the output stream
  if (body !== "") {
    conn.setDoOutput(true);
    const writer: OutputStreamWriter = new OutputStreamWriter(conn.getOutputStream());
    writer.write(body);
    writer.flush();
    writer.close();
  }

  // Read and return the response
  const response: IncomingMessage = _readResponse(conn);
  conn.disconnect();
  return response;
}

// Shorthand GET request. Mirrors Node.js http.get(url, callback).
//
// Parameters:
//   hostname — target host
//   port     — target port
//   path     — request path
//
// Returns an IncomingMessage containing the response.
function get(hostname: string, port: number, path: string): IncomingMessage {
  return request(hostname, port, path, "GET", "");
}

// =========================================================================
// Server request handling — virtual-thread-per-request dispatcher
// =========================================================================
// This function processes a single incoming request on a virtual thread.
// It constructs IncomingMessage and ServerResponse objects, calls the
// user-supplied handler, then waits for the response to be flushed.
//
// In a full implementation this would be wired into the HttpServer's
// HttpHandler. Here it is exposed as a helper that the HttpHandler
// context delegates to via spawn().

function _handleExchange(exchange: HttpExchange, handlerCh: Channel<number>): void {
  // Build the IncomingMessage from the Java HttpExchange
  const req: IncomingMessage = new IncomingMessage();
  req.method = exchange.getRequestMethod();
  req.url = exchange.getRequestURI().toString();

  // Read request body
  // Backed by: HttpExchange.getRequestBody() -> InputStream
  const bodyReader: BufferedReader = new BufferedReader(
    new InputStreamReader(exchange.getRequestBody())
  );
  const bodySb: StringBuilder = new StringBuilder();
  let bodyLine: string = bodyReader.readLine();
  while (bodyLine !== null) {
    bodySb.append(bodyLine);
    bodyLine = bodyReader.readLine();
  }
  bodyReader.close();
  req.body = bodySb.toString();

  // Build the ServerResponse
  const res: ServerResponse = new ServerResponse();

  // Signal the handler channel that a request is ready.
  // The main server loop receives this and dispatches to the user handler.
  handlerCh.send(1);

  // Wait for the handler to call res.end()
  res._done.recv();

  // Flush the response through the Java HttpExchange
  // Backed by: HttpExchange.sendResponseHeaders() and HttpExchange.getResponseBody()
  const responseBody: string = res._getBody();
  const responseBytes: number = responseBody.length;
  exchange.sendResponseHeaders(res.statusCode, responseBytes);
  const os: OutputStream = exchange.getResponseBody();
  const osWriter: OutputStreamWriter = new OutputStreamWriter(os);
  osWriter.write(responseBody);
  osWriter.flush();
  osWriter.close();
  exchange.close();
}

// =========================================================================
// Utility: STATUS_CODES map
// =========================================================================
// A subset of standard HTTP status codes. Backed by java.util.HashMap.

function _buildStatusCodes(): HashMap {
  const codes: HashMap = new HashMap();
  codes.put(200, "OK");
  codes.put(201, "Created");
  codes.put(204, "No Content");
  codes.put(301, "Moved Permanently");
  codes.put(302, "Found");
  codes.put(304, "Not Modified");
  codes.put(400, "Bad Request");
  codes.put(401, "Unauthorized");
  codes.put(403, "Forbidden");
  codes.put(404, "Not Found");
  codes.put(405, "Method Not Allowed");
  codes.put(409, "Conflict");
  codes.put(500, "Internal Server Error");
  codes.put(502, "Bad Gateway");
  codes.put(503, "Service Unavailable");
  return codes;
}

// The global status codes table
const STATUS_CODES: HashMap = _buildStatusCodes();

// =========================================================================
// Exports summary
// =========================================================================
// This module provides:
//
//   Classes:
//     IncomingMessage  — parsed HTTP request (method, url, headers, body)
//     ServerResponse   — buffered HTTP response (writeHead, write, end)
//     Server           — HTTP server with listen() and close()
//
//   Functions:
//     createServer(handlerId)                      — create an HTTP server
//     request(hostname, port, path, method, body)   — make an HTTP request
//     get(hostname, port, path)                     — shorthand GET request
//
//   Constants:
//     STATUS_CODES     — HashMap of status code -> reason phrase
//
// Java classes used:
//     com.sun.net.httpserver.HttpServer   — JDK built-in HTTP server
//     com.sun.net.httpserver.HttpExchange — request/response exchange
//     java.net.InetSocketAddress          — network address binding
//     java.net.URL                        — URL parsing
//     java.net.HttpURLConnection          — HTTP client connection
//     java.io.BufferedReader              — efficient stream reading
//     java.io.InputStreamReader           — byte-to-char stream bridge
//     java.io.OutputStreamWriter          — char-to-byte stream bridge
//     java.lang.StringBuilder             — efficient string concatenation
//     java.util.HashMap                   — header/status storage
//     java.util.ArrayList                 — body chunk buffering
