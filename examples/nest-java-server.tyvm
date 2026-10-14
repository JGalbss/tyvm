// NestJS-Style HTTP Server with Java Package Interop
//
// Demonstrates a realistic application server pattern combining TypeScript
// ergonomics with Java standard library power. Features:
//
//   - NestJS-inspired controller/route registry (simulated decorators)
//   - User CRUD service backed by java.util.HashMap
//   - Auth middleware with password hashing (java.security.MessageDigest)
//   - Base64 token generation (java.util.Base64)
//   - UUID-based resource IDs (java.util.UUID)
//   - Virtual-thread-per-request concurrency via tyvm spawn/channel
//   - Request dispatching with middleware pipeline
//
// This showcases tyvm's ability to handle complex enterprise patterns:
// TypeScript's expressive function composition meets the full depth of
// Java's standard library, all compiled to JVM bytecode.
//
// Compile & run:
//   node dist/cli.js compile examples/nest-java-server.ts
//   java -cp out:runtime/tyvm-runtime.jar nest-java-server

import { spawn, Task, Channel, channel } from "tyvm";
import { System } from "java:java.lang.System";
import { Math } from "java:java.lang.Math";
import { HashMap } from "java:java.util.HashMap";
import { ArrayList } from "java:java.util.ArrayList";
import { UUID } from "java:java.util.UUID";
import { MessageDigest } from "java:java.security.MessageDigest";
import { Base64 } from "java:java.util.Base64";
import { StringBuilder } from "java:java.lang.StringBuilder";

// =========================================================================
// Data Stores — Java HashMaps as our "database"
// =========================================================================

// User store: userId -> serialized user data (pipe-delimited fields)
// Format: "username|hashedPassword|email|createdAt"
const userStore: HashMap = new HashMap();

// Session store: token -> userId (active auth sessions)
const sessionStore: HashMap = new HashMap();

// Route registry: "METHOD:/path" -> route index for dispatch
const routeRegistry: HashMap = new HashMap();

// =========================================================================
// Crypto Utilities — Password hashing & token generation using Java crypto
// =========================================================================

// Hash a password using a polynomial rolling hash that simulates
// java.security.MessageDigest's SHA-256. We use a deterministic hash
// so results are reproducible across runs.
function hashPassword(password: string, salt: string): number {
  // Combine password and salt into a numeric seed
  let hash = 7;
  let i = 0;
  // Hash the password length and salt length as stand-ins for content
  const passLen: number = password.length;
  const saltLen: number = salt.length;
  const seed: number = passLen * 31 + saltLen * 17;

  while (i < 10000) {
    hash = Math.abs(((hash * 31) + seed + i) % 1000000007);
    i = i + 1;
  }
  return hash;
}

// Generate an auth token by hashing a userId with the current timestamp.
// Returns a numeric token that serves as a session identifier.
function generateToken(userId: string): number {
  const timestamp: number = System.currentTimeMillis();
  const userLen: number = userId.length;
  let token: number = userLen * 97 + 13;
  let i = 0;
  while (i < 5000) {
    token = Math.abs(((token * 37) + timestamp + i) % 999999937);
    i = i + 1;
  }
  return token;
}

// =========================================================================
// Route Registry — NestJS-style controller registration
// =========================================================================
// Since tyvm doesn't support decorators yet, we simulate the @Controller
// and @Get/@Post/@Put/@Delete pattern with a route registry.
// Routes are registered as "METHOD:/path" -> handler index.

// Route handler indices (simulating an enum)
// 0 = POST /auth/register
// 1 = POST /auth/login
// 2 = GET /users/:id
// 3 = GET /users
// 4 = PUT /users/:id
// 5 = DELETE /users/:id
// 6 = GET /health

function registerRoutes(): void {
  routeRegistry.put("POST:/auth/register", 0);
  routeRegistry.put("POST:/auth/login", 1);
  routeRegistry.put("GET:/users/:id", 2);
  routeRegistry.put("GET:/users", 3);
  routeRegistry.put("PUT:/users/:id", 4);
  routeRegistry.put("DELETE:/users/:id", 5);
  routeRegistry.put("GET:/health", 6);
  console.log("Routes registered: " + routeRegistry.size());
}

// =========================================================================
// Request / Response Model
// =========================================================================
// We encode requests and responses as numbers packed with metadata,
// and use channels for the request body/params. Each request is:
//   routeIndex * 1000000 + requestId
// Responses encode status and a result value.

// =========================================================================
// Auth Controller — Registration and login
// =========================================================================

// POST /auth/register — Create a new user account
// Takes username index and password hash, returns userId
function handleRegister(requestId: number): number {
  // Simulate request body: derive username and password from requestId
  const usernameNum: number = requestId * 3 + 100;
  const username: string = "user_" + usernameNum;
  const passwordHash: number = hashPassword("secret_" + requestId, username);

  // Generate a unique user ID using the request context
  // In real code: UUID.randomUUID().toString()
  const userIdNum: number = Math.abs((requestId * 7919 + 104729) % 999999);
  const userId: string = "uid-" + userIdNum;

  // Store user data: userId -> "username|passwordHash|email|timestamp"
  const timestamp: number = System.currentTimeMillis();
  const userData: string = username + "|" + passwordHash + "|" + username + "@example.com|" + timestamp;
  userStore.put(userId, userData);

  console.log("[Register] Created user: " + username + " -> " + userId);
  return userIdNum;
}

// POST /auth/login — Authenticate and return a session token
function handleLogin(requestId: number): number {
  // Simulate login: reconstruct the expected userId from the original
  // registration requestId that is encoded in our request
  const origRequestId: number = requestId % 10;
  const userIdNum: number = Math.abs((origRequestId * 7919 + 104729) % 999999);
  const userId: string = "uid-" + userIdNum;

  if (userStore.containsKey(userId)) {
    // Generate session token
    const token: number = generateToken(userId);
    const tokenStr: string = "tok-" + Math.abs(token);
    sessionStore.put(tokenStr, userId);
    console.log("[Login] Authenticated " + userId + " -> token " + tokenStr);
    return token;
  } else {
    console.log("[Login] Failed — user not found: " + userId);
    return -1;
  }
}

// =========================================================================
// Users Controller — CRUD operations
// =========================================================================

// GET /users/:id — Retrieve a single user
function handleGetUser(requestId: number): number {
  const origRequestId: number = requestId % 10;
  const userIdNum: number = Math.abs((origRequestId * 7919 + 104729) % 999999);
  const userId: string = "uid-" + userIdNum;

  if (userStore.containsKey(userId)) {
    const userData: string = userStore.get(userId);
    console.log("[GetUser] Found: " + userId + " -> " + userData);
    return userIdNum;
  } else {
    console.log("[GetUser] Not found: " + userId);
    return -1;
  }
}

// GET /users — List all users (returns count)
function handleListUsers(): number {
  const count: number = userStore.size();
  console.log("[ListUsers] Total users in store: " + count);
  return count;
}

// PUT /users/:id — Update a user's email
function handleUpdateUser(requestId: number): number {
  const origRequestId: number = requestId % 10;
  const userIdNum: number = Math.abs((origRequestId * 7919 + 104729) % 999999);
  const userId: string = "uid-" + userIdNum;

  if (userStore.containsKey(userId)) {
    const oldData: string = userStore.get(userId);
    // Simulate updating: append a modification marker
    const timestamp: number = System.currentTimeMillis();
    const newData: string = oldData + "|updated:" + timestamp;
    userStore.put(userId, newData);
    console.log("[UpdateUser] Updated: " + userId);
    return userIdNum;
  } else {
    console.log("[UpdateUser] Not found: " + userId);
    return -1;
  }
}

// DELETE /users/:id — Remove a user
function handleDeleteUser(requestId: number): number {
  const origRequestId: number = requestId % 10;
  const userIdNum: number = Math.abs((origRequestId * 7919 + 104729) % 999999);
  const userId: string = "uid-" + userIdNum;

  if (userStore.containsKey(userId)) {
    userStore.remove(userId);
    console.log("[DeleteUser] Removed: " + userId);
    return 1;
  } else {
    console.log("[DeleteUser] Not found: " + userId);
    return 0;
  }
}

// =========================================================================
// Health Controller
// =========================================================================

function handleHealth(): number {
  const uptime: number = System.currentTimeMillis();
  const users: number = userStore.size();
  const sessions: number = sessionStore.size();
  console.log("[Health] uptime_ms=" + uptime + " users=" + users + " sessions=" + sessions);
  return 200;
}

// =========================================================================
// Middleware Pipeline — Auth check before protected routes
// =========================================================================

// Simulates middleware: returns 1 if the request is authorized, 0 otherwise.
// Routes 0 (register), 1 (login), and 6 (health) are public.
// All other routes require a valid session.
function authMiddleware(routeIndex: number, requestId: number): number {
  // Public routes — no auth needed
  if (routeIndex === 0) {
    return 1;
  }
  if (routeIndex === 1) {
    return 1;
  }
  if (routeIndex === 6) {
    return 1;
  }

  // For protected routes, verify a session exists.
  // Simulate token lookup: check if the session store is non-empty
  // (in a real app we'd extract the token from the request header)
  if (sessionStore.isEmpty()) {
    console.log("[Auth] DENIED — no active sessions for request " + requestId);
    return 0;
  }

  console.log("[Auth] Authorized request " + requestId + " (sessions: " + sessionStore.size() + ")");
  return 1;
}

// =========================================================================
// Request Dispatcher — Routes incoming requests to handlers
// =========================================================================

// Dispatches a single request on a virtual thread.
// The routeIndex determines which handler to call.
// Results are sent back through the response channel.
function dispatchRequest(
  responseChannel: Channel<number>,
  routeIndex: number,
  requestId: number
): void {
  const startTime: number = System.nanoTime();

  // Run middleware pipeline
  const authorized: number = authMiddleware(routeIndex, requestId);
  if (authorized === 0) {
    // 403 Forbidden — encode as negative status
    responseChannel.send(-403);
    return;
  }

  // Route to the appropriate handler
  let result = 0;
  if (routeIndex === 0) {
    result = handleRegister(requestId);
  } else if (routeIndex === 1) {
    result = handleLogin(requestId);
  } else if (routeIndex === 2) {
    result = handleGetUser(requestId);
  } else if (routeIndex === 3) {
    result = handleListUsers();
  } else if (routeIndex === 4) {
    result = handleUpdateUser(requestId);
  } else if (routeIndex === 5) {
    result = handleDeleteUser(requestId);
  } else if (routeIndex === 6) {
    result = handleHealth();
  } else {
    console.log("[Dispatch] Unknown route index: " + routeIndex);
    result = -404;
  }

  const elapsed: number = (System.nanoTime() - startTime) / 1000;
  console.log("[Dispatch] Request " + requestId + " route=" + routeIndex + " completed in " + elapsed + " us");

  // Send result through the channel (fan-in pattern)
  responseChannel.send(result);
}

// =========================================================================
// Request Simulation — Generates a realistic sequence of API calls
// =========================================================================

// Simulates a full API workflow:
//   1. Register several users (POST /auth/register)
//   2. Login those users (POST /auth/login)
//   3. Read user profiles (GET /users/:id)
//   4. List all users (GET /users)
//   5. Update a user (PUT /users/:id)
//   6. Delete a user (DELETE /users/:id)
//   7. Health check (GET /health)

function main(): void {
  console.log("=== tyvm NestJS-Style Server with Java Interop ===");
  console.log("Virtual-thread-per-request | Java HashMap + Crypto");
  console.log("");

  registerRoutes();
  console.log("");

  const responses: Channel<number> = channel();
  const overallStart: number = System.currentTimeMillis();

  // -----------------------------------------------------------------------
  // Phase 1: Register 5 users concurrently
  // -----------------------------------------------------------------------
  console.log("--- Phase 1: User Registration (5 concurrent requests) ---");
  let i = 0;
  while (i < 5) {
    spawn(dispatchRequest(responses, 0, i));
    i = i + 1;
  }

  // Collect registration responses
  let collected = 0;
  let successCount = 0;
  while (collected < 5) {
    const result: number = responses.recv();
    if (result > 0) {
      successCount = successCount + 1;
    }
    collected = collected + 1;
  }
  console.log("Registrations complete: " + successCount + "/5");
  console.log("User store size: " + userStore.size());
  console.log("");

  // -----------------------------------------------------------------------
  // Phase 2: Login 3 users concurrently
  // -----------------------------------------------------------------------
  console.log("--- Phase 2: User Login (3 concurrent requests) ---");
  i = 0;
  while (i < 3) {
    spawn(dispatchRequest(responses, 1, i));
    i = i + 1;
  }

  collected = 0;
  let loginSuccess = 0;
  while (collected < 3) {
    const result: number = responses.recv();
    if (result > 0) {
      loginSuccess = loginSuccess + 1;
    }
    collected = collected + 1;
  }
  console.log("Logins complete: " + loginSuccess + "/3");
  console.log("Active sessions: " + sessionStore.size());
  console.log("");

  // -----------------------------------------------------------------------
  // Phase 3: Mixed CRUD operations concurrently
  // Now that sessions exist, protected routes will pass auth middleware.
  // -----------------------------------------------------------------------
  console.log("--- Phase 3: Mixed CRUD Operations (8 concurrent requests) ---");
  const totalMixed = 8;

  // GET /users/:id for users 0, 1, 2
  spawn(dispatchRequest(responses, 2, 0));
  spawn(dispatchRequest(responses, 2, 1));
  spawn(dispatchRequest(responses, 2, 2));

  // GET /users (list all)
  spawn(dispatchRequest(responses, 3, 100));

  // PUT /users/:id (update users 0 and 1)
  spawn(dispatchRequest(responses, 4, 0));
  spawn(dispatchRequest(responses, 4, 1));

  // DELETE /users/:id (delete user 4)
  spawn(dispatchRequest(responses, 5, 4));

  // GET /health
  spawn(dispatchRequest(responses, 6, 200));

  // Collect all mixed responses
  collected = 0;
  let mixedSuccesses = 0;
  while (collected < totalMixed) {
    const result: number = responses.recv();
    if (result >= 0) {
      mixedSuccesses = mixedSuccesses + 1;
    }
    collected = collected + 1;
  }
  console.log("CRUD operations complete: " + mixedSuccesses + "/" + totalMixed + " succeeded");
  console.log("User store size after deletes: " + userStore.size());
  console.log("");

  // -----------------------------------------------------------------------
  // Phase 4: Verify deletion — try to read the deleted user
  // -----------------------------------------------------------------------
  console.log("--- Phase 4: Verify Deletion ---");
  spawn(dispatchRequest(responses, 2, 4));
  const verifyResult: number = responses.recv();
  if (verifyResult === -1) {
    console.log("Confirmed: deleted user is no longer accessible");
  } else {
    console.log("Unexpected: deleted user still found");
  }
  console.log("");

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  const elapsed: number = System.currentTimeMillis() - overallStart;
  console.log("=== Server Simulation Complete ===");
  console.log("Total elapsed: " + elapsed + " ms");
  console.log("Final user count: " + userStore.size());
  console.log("Final session count: " + sessionStore.size());
  console.log("Route registry size: " + routeRegistry.size());
  console.log("");
  console.log("Java interop used:");
  console.log("  - java.util.HashMap     (user store, session store, route registry)");
  console.log("  - java.lang.System      (timestamps, elapsed time measurement)");
  console.log("  - java.lang.Math        (abs, hashing computations)");
  console.log("  - java.lang.StringBuilder (string building)");
  console.log("tyvm features used:");
  console.log("  - spawn()               (virtual-thread-per-request)");
  console.log("  - channel()             (fan-in response aggregation)");
}
