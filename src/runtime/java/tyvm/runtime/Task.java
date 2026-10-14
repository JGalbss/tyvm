package tyvm.runtime;

import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * A lightweight task that runs a {@link Callable} on a Java 21 virtual thread.
 *
 * <p>Tasks are the primary concurrency primitive for tyvm-compiled async
 * functions.  Each task is backed by a virtual thread, making it practical
 * to create millions of concurrent tasks without exhausting OS thread
 * resources.</p>
 *
 * <p>Create tasks via the static {@link #spawn(Callable)} factory and
 * retrieve results with {@link #await()} or {@link #awaitTimeout(long)}.</p>
 *
 * @param <T> the result type of the task
 */
public final class Task<T> {

    private final CompletableFuture<T> future;
    private final Thread thread;

    private Task(CompletableFuture<T> future, Thread thread) {
        this.future = future;
        this.thread = thread;
    }

    /**
     * Spawns a new task on a virtual thread and begins execution immediately.
     *
     * @param callable the computation to run
     * @param <T>      the result type
     * @return a {@code Task} representing the in-flight computation
     */
    public static <T> Task<T> spawn(Callable<T> callable) {
        CompletableFuture<T> future = new CompletableFuture<>();
        Thread vt = Thread.ofVirtual().start(() -> {
            try {
                T result = callable.call();
                future.complete(result);
            } catch (Throwable t) {
                future.completeExceptionally(t);
            }
        });
        return new Task<>(future, vt);
    }

    /**
     * Blocks the calling thread until this task completes and returns its
     * result.
     *
     * <p>If the task's callable threw an exception, that exception is
     * re-thrown wrapped in a {@link TyvmException}.  If the calling thread
     * is interrupted while waiting, the interrupt flag is restored and a
     * {@link TyvmException} is thrown.</p>
     *
     * @return the computed result
     * @throws TyvmException if the task failed or the wait was interrupted
     */
    public T await() {
        try {
            return future.get();
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RuntimeException re) {
                throw re;
            }
            if (cause instanceof Error err) {
                throw err;
            }
            throw new TyvmException("task failed", cause);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TyvmException("task await interrupted", e);
        }
    }

    /**
     * Blocks the calling thread until this task completes or the timeout
     * elapses, whichever comes first.
     *
     * @param millis maximum time to wait, in milliseconds
     * @return the computed result
     * @throws TyvmException if the task failed, the wait was interrupted,
     *                       or the timeout elapsed
     */
    public T awaitTimeout(long millis) {
        try {
            return future.get(millis, TimeUnit.MILLISECONDS);
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RuntimeException re) {
                throw re;
            }
            if (cause instanceof Error err) {
                throw err;
            }
            throw new TyvmException("task failed", cause);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TyvmException("task await interrupted", e);
        } catch (TimeoutException e) {
            throw new TyvmException("task timed out after " + millis + "ms", e);
        }
    }

    /**
     * Returns {@code true} if this task has finished (successfully or
     * exceptionally).
     *
     * @return whether the task is done
     */
    public boolean isDone() {
        return future.isDone();
    }

    /**
     * Attempts to cancel this task by interrupting the underlying virtual
     * thread.
     *
     * @return {@code true} if cancellation was requested successfully
     */
    public boolean cancel() {
        thread.interrupt();
        return future.cancel(true);
    }

    /**
     * Returns the underlying {@link CompletableFuture} for advanced
     * composition.
     *
     * @return the future backing this task
     */
    public CompletableFuture<T> toFuture() {
        return future;
    }
}
