package tyvm.runtime;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * A structured-concurrency scope that groups related {@link Task}s and
 * ensures they are all completed (or cancelled) before the scope exits.
 *
 * <p>This is a lightweight, non-preview alternative to
 * {@code java.util.concurrent.StructuredTaskScope} from Project Loom.  It
 * tracks every task spawned within the scope and provides bulk
 * {@link #awaitAll()} and {@link #cancel()} operations.</p>
 *
 * <h2>Usage</h2>
 * <pre>{@code
 * Scope scope = Scope.open();
 * try {
 *     Task<Integer> a = scope.spawn(() -> compute(1));
 *     Task<Integer> b = scope.spawn(() -> compute(2));
 *     scope.awaitAll();
 *     int result = a.await() + b.await();
 * } finally {
 *     scope.cancel();
 * }
 * }</pre>
 */
public final class Scope {

    private final CopyOnWriteArrayList<Task<?>> tasks = new CopyOnWriteArrayList<>();
    private volatile boolean cancelled;

    private Scope() {
        // use factory
    }

    /**
     * Opens a new scope.
     *
     * @return a fresh, empty scope
     */
    public static Scope open() {
        return new Scope();
    }

    /**
     * Spawns a new {@link Task} within this scope.  The task starts
     * executing immediately on a virtual thread.
     *
     * @param callable the computation to run
     * @param <T>      the result type
     * @return the spawned task
     * @throws TyvmException if the scope has already been cancelled
     */
    public <T> Task<T> spawn(Callable<T> callable) {
        if (cancelled) {
            throw new TyvmException("cannot spawn in a cancelled scope");
        }
        Task<T> task = Task.spawn(callable);
        tasks.add(task);
        return task;
    }

    /**
     * Blocks until every task spawned in this scope has completed
     * (successfully or exceptionally).
     *
     * <p>If any task threw an exception, this method does <em>not</em>
     * rethrow it.  Callers should inspect individual tasks via
     * {@link Task#await()} to observe failures.</p>
     */
    public void awaitAll() {
        for (Task<?> task : tasks) {
            try {
                task.await();
            } catch (Exception ignored) {
                // Individual task failures are not propagated here;
                // callers should await() specific tasks to observe errors.
            }
        }
    }

    /**
     * Cancels every task in this scope by interrupting its virtual thread
     * and marks the scope as cancelled so no further tasks can be spawned.
     */
    public void cancel() {
        cancelled = true;
        for (Task<?> task : tasks) {
            task.cancel();
        }
    }

    /**
     * Returns an unmodifiable snapshot of all tasks spawned in this scope.
     *
     * @return the list of tasks
     */
    public List<Task<?>> tasks() {
        return List.copyOf(tasks);
    }

    /**
     * Returns {@code true} if this scope has been cancelled.
     *
     * @return whether the scope is cancelled
     */
    public boolean isCancelled() {
        return cancelled;
    }
}
