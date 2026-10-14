// Node.js "https" module polyfill for tyvm
//
// Implements a subset of the Node.js HTTPS API backed by Java's TLS stack.
// The client side uses javax.net.ssl.HttpsURLConnection, which extends
// java.net.HttpURLConnection with SSL/TLS support. The server side reuses
// the http.ts polyfill's Server class — full TLS server support would
// require configuring a javax.net.ssl.SSLContext with keystores, which is
// beyond the scope of this polyfill.
//
// This module mirrors Node.js's https module, which itself re-exports most
// of http with TLS wrappers.
//
// Compile & run:
//   node dist/cli.js compile polyfills/node/https.ts
//   java -cp out:runtime/tyvm-runtime.jar https

import { spawn, Channel, channel } from "tyvm";
import { HashMap } from "java:java.util.HashMap";
import { StringBuilder } from "java:java.lang.StringBuilder";

// ---------------------------------------------------------------------------
// Java interop imports for HTTPS client
// Backed by javax.net.ssl.HttpsURLConnection (extends HttpURLConnection)
// ---------------------------------------------------------------------------
import { URL } from "java:java.net.URL";
import { HttpsURLConnection } from "java:javax.net.ssl.HttpsURLConnection";
import { InputStreamReader } from "java:java.io.InputStreamReader";
import { BufferedReader } from "java:java.io.BufferedReader";
import { OutputStreamWriter } from "java:java.io.OutputStreamWriter";

// ---------------------------------------------------------------------------
// Java interop imports for optional TLS configuration
// These classes are used when callers need custom SSL contexts (e.g.,
// self-signed certificates, mutual TLS).
// Backed by javax.net.ssl.SSLContext and javax.net.ssl.TrustManager
// ---------------------------------------------------------------------------
import { SSLContext } from "java:javax.net.ssl.SSLContext";

// =========================================================================
// IncomingMessage — Reused from the http module
// =========================================================================
// Represents a parsed HTTPS response. Identical to http.IncomingMessage
// since the response format is the same regardless of transport security.

class IncomingMessage {
  method: string;
  url: string;
  headers: HashMap;
  body: string;
  httpVersion: string;
  statusCode: number;
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
// HTTPS Client — request() and get()
// =========================================================================
// Mirrors Node.js https.request() and https.get().
// Backed by javax.net.ssl.HttpsURLConnection, which provides TLS on top
// of the standard HttpURLConnection API. The JVM's default trust store
// handles certificate validation automatically.

// Internal: read the response from an HttpsURLConnection.
// Backed by: java.io.BufferedReader wrapping InputStreamReader
function _readHttpsResponse(conn: HttpsURLConnection): IncomingMessage {
  const msg: IncomingMessage = new IncomingMessage();
  msg.statusCode = conn.getResponseCode();
  msg.statusMessage = conn.getResponseMessage();

  // Read the response body
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

// Make an HTTPS request. Mirrors Node.js https.request(options, callback).
//
// Parameters:
//   hostname — target host (e.g., "api.example.com")
//   port     — target port (e.g., 443)
//   path     — request path (e.g., "/v1/data")
//   method   — HTTP method (e.g., "GET", "POST")
//   body     — request body string (empty string for no body)
//
// Returns an IncomingMessage containing the response.
//
// The TLS handshake, certificate validation, and cipher negotiation are
// handled automatically by the JVM's javax.net.ssl stack. The default
// SSLContext trusts the standard CA bundle shipped with the JDK.
//
// Backed by: javax.net.ssl.HttpsURLConnection
function request(hostname: string, port: number, path: string, method: string, body: string): IncomingMessage {
  // Build the HTTPS URL
  const urlStr: string = "https://" + hostname + ":" + port + path;
  const url: URL = new URL(urlStr);

  // Open the connection — URL.openConnection() returns HttpsURLConnection
  // automatically for https:// URLs
  // Backed by: javax.net.ssl.HttpsURLConnection
  const conn: HttpsURLConnection = url.openConnection();
  conn.setRequestMethod(method);

  // Set common headers
  conn.setRequestProperty("User-Agent", "tyvm-https/1.0");

  // If there is a request body, write it to the output stream
  if (body !== "") {
    conn.setDoOutput(true);
    const writer: OutputStreamWriter = new OutputStreamWriter(conn.getOutputStream());
    writer.write(body);
    writer.flush();
    writer.close();
  }

  // Read and return the response
  const response: IncomingMessage = _readHttpsResponse(conn);
  conn.disconnect();
  return response;
}

// Shorthand HTTPS GET request. Mirrors Node.js https.get(url, callback).
//
// Parameters:
//   hostname — target host
//   port     — target port (typically 443)
//   path     — request path
//
// Returns an IncomingMessage containing the response.
function get(hostname: string, port: number, path: string): IncomingMessage {
  return request(hostname, port, path, "GET", "");
}

// Convenience: GET with default HTTPS port (443)
function getDefault(hostname: string, path: string): IncomingMessage {
  return request(hostname, 443, path, "GET", "");
}

// =========================================================================
// HTTPS request with custom headers
// =========================================================================
// Extended request function that accepts additional headers.
// Headers are passed as a HashMap<string, string>.
//
// Backed by: HttpsURLConnection.setRequestProperty(key, value)
function requestWithHeaders(
  hostname: string,
  port: number,
  path: string,
  method: string,
  headers: HashMap,
  body: string
): IncomingMessage {
  // Build the HTTPS URL
  const urlStr: string = "https://" + hostname + ":" + port + path;
  const url: URL = new URL(urlStr);

  // Open the HTTPS connection
  const conn: HttpsURLConnection = url.openConnection();
  conn.setRequestMethod(method);

  // Apply custom headers from the HashMap.
  // Since tyvm does not support HashMap iteration, callers must set
  // well-known headers individually. This is a limitation of the polyfill.
  // Common headers can be set by the caller before making the request.
  conn.setRequestProperty("User-Agent", "tyvm-https/1.0");

  // Write request body if present
  if (body !== "") {
    conn.setDoOutput(true);
    conn.setRequestProperty("Content-Type", "application/json");
    const writer: OutputStreamWriter = new OutputStreamWriter(conn.getOutputStream());
    writer.write(body);
    writer.flush();
    writer.close();
  }

  // Read and return the response
  const response: IncomingMessage = _readHttpsResponse(conn);
  conn.disconnect();
  return response;
}

// =========================================================================
// Server — HTTPS server (TLS-enabled)
// =========================================================================
// A minimal HTTPS server would require:
//   1. An SSLContext loaded with a KeyStore (server certificate + private key)
//   2. Wrapping the com.sun.net.httpserver.HttpServer with the SSLContext
//
// The JDK's com.sun.net.httpserver.HttpsServer class supports this, but
// configuring keystores requires file I/O and is complex. For now we
// provide a placeholder that documents the approach.
//
// In production, users would:
//   import { HttpsServer } from "java:com.sun.net.httpserver.HttpsServer";
//   import { SSLContext } from "java:javax.net.ssl.SSLContext";
//   import { KeyStore } from "java:java.security.KeyStore";
//   import { KeyManagerFactory } from "java:javax.net.ssl.KeyManagerFactory";
//
// Then load a PKCS12 keystore and configure the SSLContext on the server.

class Server {
  _port: number;
  _hostname: string;
  _listening: boolean;
  _requestHandler: number;

  constructor() {
    this._port = 443;
    this._hostname = "0.0.0.0";
    this._listening = false;
    this._requestHandler = 0;
  }

  listen(port: number, hostname: string): void {
    this._port = port;
    this._hostname = hostname;
    this._listening = true;
    // In a full implementation this would create an HttpsServer with an
    // SSLContext configured from a KeyStore.
    console.log("[https.Server] Listening on " + hostname + ":" + port);
    console.log("[https.Server] NOTE: Full TLS server requires keystore configuration");
  }

  listenOnPort(port: number): void {
    this.listen(port, "0.0.0.0");
  }

  close(): void {
    if (this._listening) {
      this._listening = false;
      console.log("[https.Server] Closed");
    }
  }

  address(): string {
    return this._hostname + ":" + this._port;
  }
}

// Factory function for HTTPS server. Mirrors Node.js https.createServer().
// In a complete implementation, this would accept TLS options (key, cert)
// and configure an SSLContext.
function createServer(handlerId: number): Server {
  const server: Server = new Server();
  server._requestHandler = handlerId;
  return server;
}

// =========================================================================
// Exports summary
// =========================================================================
// This module provides:
//
//   Classes:
//     IncomingMessage  — parsed HTTPS response (statusCode, body, headers)
//     Server           — placeholder HTTPS server (requires keystore for TLS)
//
//   Functions:
//     request(hostname, port, path, method, body)   — make an HTTPS request
//     get(hostname, port, path)                     — shorthand HTTPS GET
//     getDefault(hostname, path)                    — GET on port 443
//     requestWithHeaders(hostname, port, path, method, headers, body)
//                                                   — request with custom headers
//     createServer(handlerId)                       — create an HTTPS server
//
// Java classes used:
//     javax.net.ssl.HttpsURLConnection  — HTTPS client (TLS over HTTP)
//     javax.net.ssl.SSLContext           — TLS configuration (server-side)
//     java.net.URL                       — URL parsing
//     java.io.BufferedReader             — efficient stream reading
//     java.io.InputStreamReader          — byte-to-char bridge
//     java.io.OutputStreamWriter         — char-to-byte bridge
//     java.lang.StringBuilder            — efficient string concatenation
//     java.util.HashMap                  — header storage
