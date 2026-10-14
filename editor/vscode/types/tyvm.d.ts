/**
 * Ambient type declarations for the tyvm runtime.
 *
 * These types describe the built-in primitives that the tyvm compiler
 * recognises: virtual-thread tasks, channels, and their factory functions.
 * Importing from "tyvm" is a no-op at compile time — the compiler
 * resolves spawn/channel by name — but the declarations give TypeScript
 * tooling full type information.
 */

declare module "tyvm" {
  /**
   * A handle to a virtual-thread task whose computation yields a value of
   * type `T`.
   */
  export interface Task<T> {
    /** Block until the task completes and return its result. */
    await(): T;
    /** Return `true` if the task has finished executing. */
    isDone(): boolean;
    /** Attempt to cancel the task. Returns `true` if cancellation succeeded. */
    cancel(): boolean;
  }

  /**
   * A typed channel for communicating between virtual threads.
   */
  export interface Channel<T> {
    /** Send a value into the channel (blocks if the channel is full). */
    send(value: T): void;
    /** Receive a value from the channel (blocks until one is available). */
    recv(): T;
    /** Receive a value, or return `defaultValue` if the channel is closed. */
    recvOrDefault(defaultValue: T): T;
    /** Close the channel. Subsequent sends will fail. */
    close(): void;
    /** Return `true` if the channel has been closed. */
    isClosed(): boolean;
  }

  /**
   * Spawn a function call on a new virtual thread.
   *
   * Usage:
   * ```ts
   * const task: Task<number> = spawn(computeResult(42));
   * const result: number = task.await();
   * ```
   */
  export function spawn<T>(call: T): Task<T>;

  /**
   * Create a new unbounded channel.
   */
  export function channel<T>(): Channel<T>;

  /**
   * Create a new bounded channel with the given capacity.
   */
  export function channel<T>(capacity: number): Channel<T>;

  // ─── HTTP Server ──────────────────────────────────────────────────────

  /** Incoming HTTP request. */
  export interface Request {
    /** HTTP method: "GET", "POST", etc. */
    method: string;
    /** URL path, e.g. "/api/users" */
    path: string;
    /** Full URL string */
    url: string;
    /** Request body as string */
    body: string;
  }

  /** HTTP response to send back. */
  export interface Response {
    status: number;
    body: string;
    contentType: string;
  }

  /** A running HTTP server. */
  export interface Server {
    /** Stop the server. */
    stop(): void;
    /** Get the port number. */
    getPort(): number;
    /** Block until server shuts down. */
    awaitShutdown(): void;
  }

  /** Route handler: takes a Request, returns a Response. */
  export type Handler = (req: Request) => Response;

  /** Router for mapping HTTP methods + paths to handlers. */
  export interface Router {
    get(path: string, handler: Handler): Router;
    post(path: string, handler: Handler): Router;
    put(path: string, handler: Handler): Router;
    delete(path: string, handler: Handler): Router;
    onNotFound(handler: Handler): Router;
  }

  /**
   * Start an HTTP server. Each request runs on its own virtual thread.
   *
   * ```ts
   * import { serve, json } from "tyvm";
   *
   * serve(8080, (req) => {
   *   return json({ message: "hello from tyvm!" });
   * });
   * ```
   */
  /** Start an HTTP server with a controller (handler from @Controller in module). */
  export function serve(port: number): Server;

  export function serve(port: number, handler: Handler): Server;

  /** Start an HTTP server with a router. */
  export function serve(port: number, router: Router): Server;

  /** Create a new router. */
  export function router(): Router;

  /** Create a 200 JSON response. */
  export function json(data: string): Response;

  /** Create a 200 text response. */
  export function text(data: string): Response;

  /** Create a response with status + body. */
  export function response(status: number, body: string, contentType?: string): Response;

  // ─── Durable Tasks ───────────────────────────────────────────────────

  /** Result of a durable task execution. */
  export interface TaskResult<T = any> {
    /** Whether the task completed successfully. */
    isSuccess(): boolean;
    /** Whether the task failed. */
    isFailure(): boolean;
    /** The return value (if successful). */
    value(): T;
    /** The error message (if failed). */
    error(): string;
    /** How long the task took in milliseconds. */
    duration(): number;
  }

  /** A durable task with retry, timeout, and checkpoint support. */
  export interface DurableTask<T = any> {
    /** Set max retry count with exponential backoff. */
    retry(maxRetries: number): DurableTask<T>;
    /** Set timeout in milliseconds. */
    timeout(ms: number): DurableTask<T>;
    /** Run the task and return a result. */
    run(): TaskResult<T>;
  }

  /**
   * Create a durable task that wraps a function call.
   *
   * ```ts
   * import { durable } from "tyvm";
   *
   * const result = durable(fetchUser(id))
   *   .retry(3)
   *   .timeout(5000)
   *   .run();
   *
   * if (result.isSuccess()) {
   *   console.log(result.value());
   * }
   * ```
   */
  export function durable<T>(call: T): DurableTask<T>;

  /**
   * Connect checkpoints to PostgreSQL. Call once at startup.
   *
   * ```ts
   * usePostgres("jdbc:postgresql://localhost:5432/mydb", "user", "pass");
   * ```
   */
  export function usePostgres(url: string, user: string, password: string): void;

  /**
   * Connect checkpoints to Redis. Call once at startup.
   *
   * ```ts
   * useRedis("localhost", 6379);
   * ```
   */
  export function useRedis(host: string, port: number): void;

  /**
   * Save a checkpoint (key-value) that survives crashes.
   * Backed by Postgres or Redis when configured, in-memory otherwise.
   *
   * ```ts
   * checkpoint("progress", "step-3");
   * ```
   */
  export function checkpoint(key: string, value: string): void;

  /**
   * Recover a previously checkpointed value.
   *
   * ```ts
   * const lastStep = recover("progress") ?? "step-1";
   * ```
   */
  export function recover(key: string): string | undefined;

  /** Workflow orchestration for multiple durable tasks. */
  export namespace workflow {
    /** Run tasks in sequence. Returns the result of the last task. */
    function sequential<T>(...tasks: DurableTask<T>[]): TaskResult<T>;
    /** Run tasks in parallel on virtual threads. Returns all results. */
    function parallel<T>(...tasks: DurableTask<T>[]): TaskResult<T>[];
    /** Race tasks — first to complete wins, rest are cancelled. */
    function race<T>(...tasks: DurableTask<T>[]): TaskResult<T>;
    /** Run tasks as a saga — sequential with rollback on failure. */
    function saga<T>(...tasks: DurableTask<T>[]): TaskResult<T>;
  }

  // ─── Decorators ──────────────────────────────────────────────────────

  /** Mark a class as an HTTP controller with a base path. */
  export function Controller(path: string): ClassDecorator;
  /** Map a method to GET requests at the given path. */
  export function Get(path?: string): MethodDecorator;
  /** Map a method to POST requests at the given path. */
  export function Post(path?: string): MethodDecorator;
  /** Map a method to PUT requests at the given path. */
  export function Put(path?: string): MethodDecorator;
  /** Map a method to DELETE requests at the given path. */
  export function Delete(path?: string): MethodDecorator;
  /** Map a method to PATCH requests at the given path. */
  export function Patch(path?: string): MethodDecorator;
}
