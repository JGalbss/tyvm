package tyvm.runtime;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

/**
 * Built-in HTTP server for tyvm programs.
 *
 * <p>Provides a simple, Bun.serve()-style API for TypeScript programs compiled
 * with tyvm. Each incoming request is dispatched to a virtual thread, giving
 * the same thread-per-request model as modern Java servers.</p>
 *
 * <p>Usage from TypeScript:</p>
 * <pre>{@code
 * import { serve } from "tyvm";
 * serve(8080, (req) => {
 *   return { status: 200, body: "hello" };
 * });
 * }</pre>
 *
 * <p>Under the hood this wraps {@code com.sun.net.httpserver.HttpServer} with
 * a virtual-thread executor from Project Loom.</p>
 */
public final class HttpServer {

    private final com.sun.net.httpserver.HttpServer server;
    private final int port;

    /**
     * Represents an incoming HTTP request.
     */
    public static final class Request {
        public final String method;
        public final String path;
        public final String body;
        public final String url;

        public Request(String method, String path, String body, String url) {
            this.method = method;
            this.path = path;
            this.body = body;
            this.url = url;
        }

        public String getMethod() { return method; }
        public String getPath() { return path; }
        public String getBody() { return body; }
        public String getUrl() { return url; }
    }

    /**
     * Represents an HTTP response to send back.
     */
    public static final class Response {
        public final int status;
        public final String body;
        public final String contentType;

        public Response(int status, String body, String contentType) {
            this.status = status;
            this.body = body;
            this.contentType = contentType;
        }

        /** Convenience: 200 OK with plain text */
        public static Response ok(String body) {
            return new Response(200, body, "text/plain");
        }

        /** Convenience: 200 OK with JSON */
        public static Response json(String body) {
            return new Response(200, body, "application/json");
        }

        /** Convenience: 404 Not Found */
        public static Response notFound() {
            return new Response(404, "Not Found", "text/plain");
        }

        /** Convenience: error response */
        public static Response error(int status, String message) {
            return new Response(status, message, "text/plain");
        }

        public int getStatus() { return status; }
        public String getBody() { return body; }
        public String getContentType() { return contentType; }
    }

    /**
     * Functional interface for request handlers.
     * Compiled TypeScript lambdas/functions implement this.
     */
    @FunctionalInterface
    public interface Handler {
        Response handle(Request request);
    }

    /**
     * Simple router that maps method+path patterns to handlers.
     */
    public static final class Router {
        private final java.util.Map<String, Handler> routes = new java.util.LinkedHashMap<>();
        private Handler notFoundHandler = req -> Response.notFound();

        public Router get(String path, Handler handler) {
            routes.put("GET:" + path, handler);
            return this;
        }

        public Router post(String path, Handler handler) {
            routes.put("POST:" + path, handler);
            return this;
        }

        public Router put(String path, Handler handler) {
            routes.put("PUT:" + path, handler);
            return this;
        }

        public Router delete(String path, Handler handler) {
            routes.put("DELETE:" + path, handler);
            return this;
        }

        public Router onNotFound(Handler handler) {
            this.notFoundHandler = handler;
            return this;
        }

        /**
         * Match a request to a registered handler.
         * Supports exact matches and simple :param patterns.
         */
        public Response dispatch(Request req) {
            String key = req.method + ":" + req.path;

            // Try exact match first
            Handler exact = routes.get(key);
            if (exact != null) {
                return exact.handle(req);
            }

            // Try pattern matching (simple :param support)
            for (var entry : routes.entrySet()) {
                if (matchRoute(entry.getKey(), key)) {
                    return entry.getValue().handle(req);
                }
            }

            return notFoundHandler.handle(req);
        }

        private boolean matchRoute(String pattern, String actual) {
            String[] patParts = pattern.split("/");
            String[] actParts = actual.split("/");
            if (patParts.length != actParts.length) return false;
            for (int i = 0; i < patParts.length; i++) {
                if (patParts[i].startsWith(":")) continue;
                if (!patParts[i].equals(actParts[i])) return false;
            }
            return true;
        }
    }

    private HttpServer(int port) throws IOException {
        this.port = port;
        this.server = com.sun.net.httpserver.HttpServer.create(
            new InetSocketAddress(port), 0
        );
        // Use virtual threads for each request — Project Loom
        this.server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
    }

    /**
     * Create and start an HTTP server with a single handler for all requests.
     *
     * @param port    the port to listen on
     * @param handler the request handler
     * @return the running server
     */
    public static HttpServer serve(int port, Handler handler) {
        try {
            HttpServer srv = new HttpServer(port);
            srv.server.createContext("/", exchange -> {
                try {
                    Request req = readRequest(exchange);
                    Response res = handler.handle(req);
                    sendResponse(exchange, res);
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        sendResponse(exchange, Response.error(500, "Internal Server Error"));
                    } catch (Exception ignored) {}
                }
            });
            srv.server.start();
            System.out.println("tyvm server listening on http://localhost:" + port);
            return srv;
        } catch (IOException e) {
            throw new TyvmException("failed to start HTTP server on port " + port, e);
        }
    }

    /**
     * Create and start an HTTP server with a router.
     *
     * @param port   the port to listen on
     * @param router the router with registered routes
     * @return the running server
     */
    public static HttpServer serve(int port, Router router) {
        return serve(port, router::dispatch);
    }

    /**
     * Stop the server.
     *
     * @param delay seconds to wait for existing connections to finish
     */
    public void stop(int delay) {
        server.stop(delay);
        System.out.println("Server stopped.");
    }

    public void stop() {
        stop(0);
    }

    /**
     * Block the calling thread until the server is stopped.
     * Useful for keeping the main thread alive.
     */
    public void awaitShutdown() {
        try {
            Thread.currentThread().join();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public int getPort() {
        return port;
    }

    // -----------------------------------------------------------------------
    //  Internal helpers
    // -----------------------------------------------------------------------

    private static Request readRequest(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();
        String url = exchange.getRequestURI().toString();

        // Read body
        String body;
        try (InputStream is = exchange.getRequestBody();
             BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            body = sb.toString();
        }

        return new Request(method, path, body, url);
    }

    private static void sendResponse(HttpExchange exchange, Response response) throws IOException {
        byte[] bytes = response.body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", response.contentType);
        exchange.sendResponseHeaders(response.status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
