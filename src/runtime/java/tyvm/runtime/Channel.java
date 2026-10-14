package tyvm.runtime;

import java.util.Iterator;
import java.util.NoSuchElementException;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedTransferQueue;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * A Go-style channel for typed, thread-safe communication between virtual
 * threads.
 *
 * <p>Channels come in two flavours:</p>
 * <ul>
 *   <li><b>Unbuffered</b> ({@link #make()}) &mdash; backed by a
 *       {@link LinkedTransferQueue}; a {@link #send(Object)} blocks until a
 *       matching {@link #recv()} is ready.</li>
 *   <li><b>Buffered</b> ({@link #make(int)}) &mdash; backed by an
 *       {@link ArrayBlockingQueue}; a {@code send} blocks only when the
 *       buffer is full.</li>
 * </ul>
 *
 * <p>Channels implement {@link Iterable} so they can be consumed with an
 * enhanced for-loop. Iteration terminates when the channel is closed and
 * drained.</p>
 *
 * @param <T> the element type
 */
public final class Channel<T> implements Iterable<T> {

    /**
     * Sentinel value placed into the queue to unblock receivers when the
     * channel is closed.  We use a unique {@code Object} instance that can
     * never collide with real payloads (the queue is typed to {@code Object}
     * internally, with casts at the API boundary).
     */
    private static final Object POISON = new Object();

    private final BlockingQueue<Object> queue;
    private final AtomicBoolean closed = new AtomicBoolean(false);
    private final boolean unbuffered;

    @SuppressWarnings("unchecked")
    private Channel(BlockingQueue<?> queue, boolean unbuffered) {
        this.queue = (BlockingQueue<Object>) queue;
        this.unbuffered = unbuffered;
    }

    // -----------------------------------------------------------------------
    //  Factory methods
    // -----------------------------------------------------------------------

    /**
     * Creates an unbuffered channel.  A {@link #send(Object)} on an
     * unbuffered channel blocks until another thread calls {@link #recv()}.
     *
     * @param <T> the element type
     * @return a new unbuffered channel
     */
    public static <T> Channel<T> make() {
        return new Channel<>(new LinkedTransferQueue<>(), true);
    }

    /**
     * Creates a buffered channel with the given capacity.
     *
     * @param capacity the maximum number of elements that can be buffered
     * @param <T>      the element type
     * @return a new buffered channel
     * @throws IllegalArgumentException if {@code capacity} is not positive
     */
    public static <T> Channel<T> make(int capacity) {
        if (capacity <= 0) {
            throw new IllegalArgumentException("channel capacity must be positive, got " + capacity);
        }
        return new Channel<>(new ArrayBlockingQueue<>(capacity), false);
    }

    // -----------------------------------------------------------------------
    //  Core operations
    // -----------------------------------------------------------------------

    /**
     * Sends a value into the channel.
     *
     * <p>For unbuffered channels, this blocks until a receiver is ready.
     * For buffered channels, this blocks only when the buffer is full.</p>
     *
     * @param value the value to send (must not be {@code null})
     * @throws ChannelClosedException if the channel has been closed
     * @throws TyvmException          if the thread is interrupted while
     *                                waiting
     * @throws NullPointerException   if {@code value} is {@code null}
     */
    public void send(T value) {
        if (value == null) {
            throw new NullPointerException("cannot send null on a channel");
        }
        if (closed.get()) {
            throw new ChannelClosedException("send on closed channel");
        }
        try {
            if (unbuffered) {
                // LinkedTransferQueue.transfer blocks until a consumer takes
                // the element, giving true unbuffered (rendezvous) semantics.
                ((LinkedTransferQueue<Object>) queue).transfer(value);
            } else {
                queue.put(value);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TyvmException("interrupted during channel send", e);
        }
        // Race: channel may have been closed between our check and the put.
        // That is acceptable; the receiver will still see the value.
    }

    /**
     * Receives the next value from the channel, blocking until one is
     * available.
     *
     * @return the received value
     * @throws ChannelClosedException if the channel is closed and drained
     * @throws TyvmException          if the thread is interrupted while
     *                                waiting
     */
    @SuppressWarnings("unchecked")
    public T recv() {
        try {
            Object value = queue.take();
            if (value == POISON) {
                // Put the sentinel back so other waiting receivers also wake.
                queue.put(POISON);
                throw new ChannelClosedException("recv on closed channel");
            }
            return (T) value;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TyvmException("interrupted during channel recv", e);
        }
    }

    /**
     * Closes the channel.  After closing, any {@link #send(Object)} call
     * will throw {@link ChannelClosedException}.  Receivers will drain any
     * remaining buffered values and then also receive a
     * {@link ChannelClosedException}.
     *
     * <p>Closing an already-closed channel is a no-op.</p>
     */
    public void close() {
        if (closed.compareAndSet(false, true)) {
            // Enqueue the poison pill so that blocked receivers wake up.
            // offer() is non-blocking; for an unbuffered (transfer) queue it
            // will only succeed if a receiver is already waiting, but the
            // poison pill will be picked up on the next recv() regardless
            // because closed==true.
            queue.offer(POISON);
        }
    }

    /**
     * Attempts to receive a value from the channel.  If the channel is closed
     * and drained, returns the supplied {@code defaultValue} instead of
     * throwing {@link ChannelClosedException}.
     *
     * <p>This is useful in languages or compilers that do not yet support
     * try/catch: callers can use a sentinel to detect closure.</p>
     *
     * @param defaultValue the value to return when the channel is closed
     * @return the received value, or {@code defaultValue} if closed
     * @throws TyvmException if the thread is interrupted while waiting
     */
    @SuppressWarnings("unchecked")
    public T recvOrDefault(T defaultValue) {
        try {
            return recv();
        } catch (ChannelClosedException e) {
            return defaultValue;
        }
    }

    /**
     * Returns {@code true} if this channel has been closed.
     *
     * @return whether the channel is closed
     */
    public boolean isClosed() {
        return closed.get();
    }

    // -----------------------------------------------------------------------
    //  Iterable support
    // -----------------------------------------------------------------------

    /**
     * Returns an iterator that yields values from this channel until it is
     * closed and fully drained.  The iterator's {@link Iterator#next()}
     * method blocks just like {@link #recv()}.
     *
     * @return a blocking iterator over the channel's values
     */
    @Override
    public Iterator<T> iterator() {
        return new ChannelIterator();
    }

    private final class ChannelIterator implements Iterator<T> {

        private T next;
        private boolean done;

        @Override
        public boolean hasNext() {
            if (done) {
                return false;
            }
            try {
                next = recv();
                return true;
            } catch (ChannelClosedException e) {
                done = true;
                return false;
            }
        }

        @Override
        public T next() {
            if (done) {
                throw new NoSuchElementException("channel iterator exhausted");
            }
            return next;
        }
    }

    @Override
    public String toString() {
        return "Channel[" + (unbuffered ? "unbuffered" : "buffered") +
                ", closed=" + closed.get() + "]";
    }
}
