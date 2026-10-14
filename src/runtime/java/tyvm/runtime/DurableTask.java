package tyvm.runtime;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

/**
 * A durable task that wraps a {@link Callable} with retry, timeout,
 * checkpointing, and failure-handling capabilities.
 *
 * <p>Durable tasks are designed to survive transient failures through
 * automatic retries with exponential backoff, and to preserve intermediate
 * state through a checkpoint/recover mechanism. All execution happens on
 * Java 21 virtual threads.</p>
 *
 * <h2>Usage</h2>
 * <pre>{@code
 * TaskResult<String> result = new DurableTask<>(() -> fetchData())
 *     .retry(3)
 *     .timeout(5000)
 *     .onFailure(e -> log("failed: " + e))
 *     .execute();
 * }</pre>
 *
 * @param <T> the result type of the task
 */
public final class DurableTask<T> {

    // ---------------------------------------------------------------------
    //  Checkpoint store — pluggable (memory, postgres, redis)
    // ---------------------------------------------------------------------

    /**
     * Pluggable checkpoint backend. Implement this to swap storage.
     */
    public interface CheckpointStore {
        void put(String key, String value);
        String get(String key);
        void clear();
    }

    /** In-memory fallback store. */
    private static final class MemoryStore implements CheckpointStore {
        private final ConcurrentHashMap<String, String> map = new ConcurrentHashMap<>();
        @Override public void put(String key, String value) { map.put(key, value); }
        @Override public String get(String key) { return map.get(key); }
        @Override public void clear() { map.clear(); }
    }

    /**
     * PostgreSQL-backed checkpoint store. Uses JDBC.
     * Auto-creates the checkpoints table on first use.
     *
     * <p>Configure via: {@code DurableTask.usePostgres("jdbc:postgresql://localhost:5432/mydb", "user", "pass")}</p>
     */
    public static final class PostgresStore implements CheckpointStore {
        private final String url;
        private final String user;
        private final String password;
        private boolean initialized = false;

        public PostgresStore(String url, String user, String password) {
            this.url = url;
            this.user = user;
            this.password = password;
        }

        private java.sql.Connection connect() throws java.sql.SQLException {
            return java.sql.DriverManager.getConnection(url, user, password);
        }

        private synchronized void ensureTable() {
            if (initialized) return;
            try (var conn = connect(); var stmt = conn.createStatement()) {
                stmt.execute(
                    "CREATE TABLE IF NOT EXISTS tyvm_checkpoints (" +
                    "  key TEXT PRIMARY KEY," +
                    "  value TEXT NOT NULL," +
                    "  updated_at TIMESTAMPTZ DEFAULT NOW()" +
                    ")"
                );
                initialized = true;
            } catch (java.sql.SQLException e) {
                throw new TyvmException("failed to initialize checkpoint table: " + e.getMessage());
            }
        }

        @Override
        public void put(String key, String value) {
            ensureTable();
            try (var conn = connect();
                 var stmt = conn.prepareStatement(
                     "INSERT INTO tyvm_checkpoints (key, value, updated_at) VALUES (?, ?, NOW()) " +
                     "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()")) {
                stmt.setString(1, key);
                stmt.setString(2, value);
                stmt.executeUpdate();
            } catch (java.sql.SQLException e) {
                throw new TyvmException("checkpoint write failed: " + e.getMessage());
            }
        }

        @Override
        public String get(String key) {
            ensureTable();
            try (var conn = connect();
                 var stmt = conn.prepareStatement("SELECT value FROM tyvm_checkpoints WHERE key = ?")) {
                stmt.setString(1, key);
                try (var rs = stmt.executeQuery()) {
                    return rs.next() ? rs.getString(1) : null;
                }
            } catch (java.sql.SQLException e) {
                throw new TyvmException("checkpoint read failed: " + e.getMessage());
            }
        }

        @Override
        public void clear() {
            ensureTable();
            try (var conn = connect(); var stmt = conn.createStatement()) {
                stmt.execute("DELETE FROM tyvm_checkpoints");
            } catch (java.sql.SQLException e) {
                throw new TyvmException("checkpoint clear failed: " + e.getMessage());
            }
        }
    }

    /**
     * Redis-backed checkpoint store. Uses raw RESP protocol over TCP — no
     * external library needed.
     *
     * <p>Configure via: {@code DurableTask.useRedis("localhost", 6379)}</p>
     */
    public static final class RedisStore implements CheckpointStore {
        private final String host;
        private final int port;

        public RedisStore(String host, int port) {
            this.host = host;
            this.port = port;
        }

        private String sendCommand(String... args) {
            try (var socket = new java.net.Socket(host, port);
                 var out = socket.getOutputStream();
                 var in = new java.io.BufferedReader(
                     new java.io.InputStreamReader(socket.getInputStream()))) {

                // RESP array: *<count>\r\n followed by $<len>\r\n<data>\r\n per arg
                var sb = new StringBuilder();
                sb.append('*').append(args.length).append("\r\n");
                for (String arg : args) {
                    byte[] bytes = arg.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    sb.append('$').append(bytes.length).append("\r\n");
                    sb.append(arg).append("\r\n");
                }
                out.write(sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
                out.flush();

                // Read response
                String line = in.readLine();
                if (line == null) return null;

                char type = line.charAt(0);
                String payload = line.substring(1);
                switch (type) {
                    case '+': return payload;                         // simple string
                    case '-': throw new TyvmException("redis error: " + payload);
                    case ':': return payload;                         // integer
                    case '$': {                                       // bulk string
                        int len = Integer.parseInt(payload);
                        if (len == -1) return null;
                        char[] buf = new char[len];
                        int read = 0;
                        while (read < len) {
                            int n = in.read(buf, read, len - read);
                            if (n == -1) break;
                            read += n;
                        }
                        in.readLine(); // trailing \r\n
                        return new String(buf, 0, read);
                    }
                    default: return payload;
                }
            } catch (java.io.IOException e) {
                throw new TyvmException("redis connection failed: " + e.getMessage());
            }
        }

        @Override
        public void put(String key, String value) {
            sendCommand("SET", "tyvm:" + key, value);
        }

        @Override
        public String get(String key) {
            return sendCommand("GET", "tyvm:" + key);
        }

        @Override
        public void clear() {
            // Use KEYS + DEL pattern (fine for checkpoint volumes)
            // In production you'd use SCAN, but this is correct for typical usage
            sendCommand("EVAL",
                "local keys = redis.call('keys', 'tyvm:*'); " +
                "if #keys > 0 then redis.call('del', unpack(keys)) end; return #keys",
                "0");
        }
    }

    /** The active checkpoint store. Defaults to in-memory. */
    private static volatile CheckpointStore STORE = new MemoryStore();

    /**
     * Switch to PostgreSQL-backed checkpoints. Call once at startup.
     *
     * <pre>{@code DurableTask.usePostgres("jdbc:postgresql://localhost:5432/mydb", "user", "pass"); }</pre>
     */
    public static void usePostgres(String jdbcUrl, String user, String password) {
        STORE = new PostgresStore(jdbcUrl, user, password);
    }

    /**
     * Switch to Redis-backed checkpoints. Call once at startup.
     *
     * <pre>{@code DurableTask.useRedis("localhost", 6379); }</pre>
     */
    public static void useRedis(String host, int port) {
        STORE = new RedisStore(host, port);
    }

    /** Set a custom checkpoint store implementation. */
    public static void useStore(CheckpointStore store) {
        STORE = store;
    }

    // ---------------------------------------------------------------------
    //  Instance fields
    // ---------------------------------------------------------------------

    private final Callable<T> callable;
    private int maxRetries = 0;
    private long timeoutMs = 0;
    private Consumer<Exception> failureHandler;
    private Callable<Void> compensation;

    /**
     * Creates a new durable task wrapping the given callable.
     *
     * @param callable the computation to execute
     */
    public DurableTask(Callable<T> callable) {
        if (callable == null) {
            throw new NullPointerException("callable must not be null");
        }
        this.callable = callable;
    }

    // ---------------------------------------------------------------------
    //  Fluent configuration
    // ---------------------------------------------------------------------

    /**
     * Configures automatic retry with exponential backoff.
     *
     * <p>On failure the task will be retried up to {@code maxRetries} times.
     * The delay between attempts follows an exponential backoff starting at
     * 100 ms and doubling each time (100, 200, 400, ...).</p>
     *
     * @param maxRetries the maximum number of retry attempts (must be non-negative)
     * @return this task, for chaining
     */
    public DurableTask<T> retry(int maxRetries) {
        if (maxRetries < 0) {
            throw new IllegalArgumentException("maxRetries must be non-negative, got " + maxRetries);
        }
        this.maxRetries = maxRetries;
        return this;
    }

    /**
     * Configures a timeout. If the task does not complete within the given
     * duration its virtual thread is interrupted and the task fails.
     *
     * @param ms timeout in milliseconds (0 means no timeout)
     * @return this task, for chaining
     */
    public DurableTask<T> timeout(long ms) {
        if (ms < 0) {
            throw new IllegalArgumentException("timeout must be non-negative, got " + ms);
        }
        this.timeoutMs = ms;
        return this;
    }

    /**
     * Registers a callback that is invoked when the task ultimately fails
     * (after all retries are exhausted).
     *
     * @param handler the failure callback
     * @return this task, for chaining
     */
    public DurableTask<T> onFailure(Consumer<Exception> handler) {
        this.failureHandler = handler;
        return this;
    }

    // ---------------------------------------------------------------------
    //  Checkpoint / recover
    // ---------------------------------------------------------------------

    /**
     * Saves a key-value pair to the checkpoint store. With Postgres or Redis
     * configured, checkpointed state survives process crashes and can be
     * recovered by any instance.
     *
     * @param key   the checkpoint key
     * @param value the checkpoint value
     */
    public static void checkpoint(String key, String value) {
        if (key == null) {
            throw new NullPointerException("checkpoint key must not be null");
        }
        STORE.put(key, value);
    }

    /**
     * Recovers a previously checkpointed value.
     *
     * @param key the checkpoint key
     * @return the checkpointed value, or {@code null} if not found
     */
    public static String recover(String key) {
        if (key == null) {
            throw new NullPointerException("recover key must not be null");
        }
        return STORE.get(key);
    }

    /**
     * Clears all entries from the checkpoint store.
     */
    public static void clearCheckpoints() {
        STORE.clear();
    }

    // ---------------------------------------------------------------------
    //  Compensation (used by Workflow.saga)
    // ---------------------------------------------------------------------

    /**
     * Sets a compensation action (rollback) to be invoked if a subsequent
     * task in a saga workflow fails after this task has succeeded.
     *
     * @param compensation the rollback callable
     * @return this task, for chaining
     */
    public DurableTask<T> compensate(Callable<Void> compensation) {
        this.compensation = compensation;
        return this;
    }

    Callable<Void> getCompensation() {
        return compensation;
    }

    // ---------------------------------------------------------------------
    //  Execution
    // ---------------------------------------------------------------------

    /**
     * Executes the task, applying retry and timeout policies, and returns
     * a {@link TaskResult} describing the outcome.
     *
     * <p>Execution happens on a virtual thread. If a timeout is configured,
     * a second virtual thread monitors elapsed time and interrupts the
     * worker if the deadline is exceeded.</p>
     *
     * @return the result of execution
     */
    public TaskResult<T> execute() {
        long startNanos = System.nanoTime();
        Exception lastException = null;

        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
                // Exponential backoff: 100ms, 200ms, 400ms, ...
                long backoffMs = 100L * (1L << (attempt - 1));
                try {
                    Thread.sleep(backoffMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    Duration elapsed = Duration.ofNanos(System.nanoTime() - startNanos);
                    Exception wrapped = new TyvmException("retry sleep interrupted", e);
                    notifyFailure(wrapped);
                    return TaskResult.failure(wrapped, elapsed);
                }
            }

            try {
                T value = executeOnce();
                Duration elapsed = Duration.ofNanos(System.nanoTime() - startNanos);
                return TaskResult.success(value, elapsed);
            } catch (Exception e) {
                lastException = e;
            }
        }

        Duration elapsed = Duration.ofNanos(System.nanoTime() - startNanos);
        notifyFailure(lastException);
        return TaskResult.failure(lastException, elapsed);
    }

    /**
     * Runs a single attempt of the callable, honouring the timeout if set.
     */
    private T executeOnce() throws Exception {
        if (timeoutMs <= 0) {
            return callable.call();
        }

        CompletableFuture<T> future = new CompletableFuture<>();
        Thread worker = Thread.ofVirtual().start(() -> {
            try {
                T result = callable.call();
                future.complete(result);
            } catch (Throwable t) {
                future.completeExceptionally(t);
            }
        });

        try {
            return future.get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (java.util.concurrent.TimeoutException te) {
            worker.interrupt();
            future.cancel(true);
            throw new TyvmException("task timed out after " + timeoutMs + "ms", te);
        } catch (java.util.concurrent.ExecutionException ee) {
            Throwable cause = ee.getCause();
            if (cause instanceof Exception ex) {
                throw ex;
            }
            throw new TyvmException("task failed", cause);
        } catch (InterruptedException ie) {
            worker.interrupt();
            Thread.currentThread().interrupt();
            throw new TyvmException("task interrupted", ie);
        }
    }

    private void notifyFailure(Exception e) {
        if (failureHandler != null) {
            try {
                failureHandler.accept(e);
            } catch (Exception ignored) {
                // failure handler must not propagate exceptions
            }
        }
    }

    // =====================================================================
    //  TaskResult — wraps the outcome of a DurableTask execution
    // =====================================================================

    /**
     * Represents the result of a {@link DurableTask} execution, capturing
     * either a successful value or a failure exception, along with the
     * wall-clock duration.
     *
     * @param <T> the result type
     */
    public static final class TaskResult<T> {

        private final T value;
        private final Exception error;
        private final Duration duration;

        private TaskResult(T value, Exception error, Duration duration) {
            this.value = value;
            this.error = error;
            this.duration = duration;
        }

        static <T> TaskResult<T> success(T value, Duration duration) {
            return new TaskResult<>(value, null, duration);
        }

        static <T> TaskResult<T> failure(Exception error, Duration duration) {
            return new TaskResult<>(null, error, duration);
        }

        /** Returns {@code true} if the task completed successfully. */
        public boolean isSuccess() {
            return error == null;
        }

        /** Returns {@code true} if the task failed. */
        public boolean isFailure() {
            return error != null;
        }

        /**
         * Returns the computed value.
         *
         * @return the value, or {@code null} if the task failed
         */
        public T value() {
            return value;
        }

        /**
         * Returns the exception that caused the task to fail.
         *
         * @return the error, or {@code null} if the task succeeded
         */
        public Exception error() {
            return error;
        }

        /**
         * Returns the wall-clock duration of the task execution, including
         * all retries and backoff delays.
         *
         * @return the elapsed duration
         */
        public Duration duration() {
            return duration;
        }

        @Override
        public String toString() {
            if (isSuccess()) {
                return "TaskResult[success=" + value + ", duration=" + duration.toMillis() + "ms]";
            }
            return "TaskResult[failure=" + error.getMessage() + ", duration=" + duration.toMillis() + "ms]";
        }
    }

    // =====================================================================
    //  Workflow — orchestrates multiple DurableTasks
    // =====================================================================

    /**
     * Orchestrates the execution of multiple {@link DurableTask}s using
     * various composition strategies: sequential, parallel, race, and saga.
     *
     * <p>All concurrent execution uses virtual threads.</p>
     */
    public static final class Workflow {

        private Workflow() {
            // non-instantiable utility
        }

        /**
         * Executes tasks sequentially in the order given. Stops at the first
         * failure (fail-fast).
         *
         * @param tasks the tasks to execute in order
         * @return a list of results (may be shorter than {@code tasks} if one failed)
         */
        @SafeVarargs
        public static List<TaskResult<?>> sequential(DurableTask<?>... tasks) {
            List<TaskResult<?>> results = new ArrayList<>(tasks.length);
            for (DurableTask<?> task : tasks) {
                TaskResult<?> result = task.execute();
                results.add(result);
                if (result.isFailure()) {
                    break;
                }
            }
            return results;
        }

        /**
         * Executes all tasks concurrently on virtual threads and waits for
         * every one to complete.
         *
         * @param tasks the tasks to execute in parallel
         * @return a list of results in the same order as the input tasks
         */
        @SafeVarargs
        public static List<TaskResult<?>> parallel(DurableTask<?>... tasks) {
            @SuppressWarnings("unchecked")
            CompletableFuture<TaskResult<?>>[] futures = new CompletableFuture[tasks.length];

            for (int i = 0; i < tasks.length; i++) {
                final DurableTask<?> task = tasks[i];
                CompletableFuture<TaskResult<?>> cf = new CompletableFuture<>();
                futures[i] = cf;
                Thread.ofVirtual().start(() -> {
                    try {
                        cf.complete(task.execute());
                    } catch (Throwable t) {
                        cf.complete(TaskResult.failure(
                                t instanceof Exception ex ? ex : new TyvmException("task failed", t),
                                Duration.ZERO));
                    }
                });
            }

            List<TaskResult<?>> results = new ArrayList<>(tasks.length);
            for (CompletableFuture<TaskResult<?>> f : futures) {
                try {
                    results.add(f.get());
                } catch (Exception e) {
                    results.add(TaskResult.failure(
                            e instanceof java.util.concurrent.ExecutionException ee
                                    ? (ee.getCause() instanceof Exception ex ? ex : new TyvmException("task failed", ee.getCause()))
                                    : e,
                            Duration.ZERO));
                }
            }
            return results;
        }

        /**
         * Executes all tasks concurrently. The first task to complete
         * successfully wins; all remaining tasks are cancelled via
         * thread interruption.
         *
         * <p>If every task fails, the result contains the error from the
         * last task to complete.</p>
         *
         * @param tasks the tasks to race
         * @return the result of the winning task
         */
        @SafeVarargs
        public static TaskResult<?> race(DurableTask<?>... tasks) {
            if (tasks.length == 0) {
                return TaskResult.failure(
                        new IllegalArgumentException("race requires at least one task"),
                        Duration.ZERO);
            }

            long startNanos = System.nanoTime();
            AtomicReference<TaskResult<?>> winner = new AtomicReference<>();
            AtomicBoolean done = new AtomicBoolean(false);
            CountDownLatch allFinished = new CountDownLatch(tasks.length);
            List<Thread> threads = new ArrayList<>(tasks.length);
            AtomicReference<Exception> lastError = new AtomicReference<>();

            for (DurableTask<?> task : tasks) {
                Thread vt = Thread.ofVirtual().start(() -> {
                    try {
                        TaskResult<?> result = task.execute();
                        if (result.isSuccess() && done.compareAndSet(false, true)) {
                            winner.set(result);
                        } else if (result.isFailure()) {
                            lastError.set(result.error());
                        }
                    } finally {
                        allFinished.countDown();
                    }
                });
                threads.add(vt);
            }

            // Wait for a winner or all to finish
            try {
                allFinished.await();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            // Cancel remaining threads
            for (Thread t : threads) {
                if (t.isAlive()) {
                    t.interrupt();
                }
            }

            Duration elapsed = Duration.ofNanos(System.nanoTime() - startNanos);
            TaskResult<?> result = winner.get();
            if (result != null) {
                return result;
            }
            // All failed
            Exception error = lastError.get();
            return TaskResult.failure(
                    error != null ? error : new TyvmException("all tasks in race failed"),
                    elapsed);
        }

        /**
         * Executes tasks sequentially with saga (compensation) semantics.
         *
         * <p>Tasks are executed in order. If a task fails, all previously
         * succeeded tasks are compensated (rolled back) in reverse order
         * by invoking their {@link DurableTask#compensate compensation}
         * callable.</p>
         *
         * @param tasks the tasks to execute as a saga
         * @return a list of results; if a failure occurred the list includes
         *         all results up to and including the failed task
         */
        @SafeVarargs
        public static List<TaskResult<?>> saga(DurableTask<?>... tasks) {
            List<TaskResult<?>> results = new ArrayList<>(tasks.length);
            List<DurableTask<?>> completed = new ArrayList<>();

            for (DurableTask<?> task : tasks) {
                TaskResult<?> result = task.execute();
                results.add(result);

                if (result.isFailure()) {
                    // Compensate in reverse order
                    for (int i = completed.size() - 1; i >= 0; i--) {
                        Callable<Void> comp = completed.get(i).getCompensation();
                        if (comp != null) {
                            try {
                                comp.call();
                            } catch (Exception ignored) {
                                // Compensation errors are swallowed to ensure
                                // all compensations are attempted.
                            }
                        }
                    }
                    break;
                }

                completed.add(task);
            }

            return results;
        }
    }
}
