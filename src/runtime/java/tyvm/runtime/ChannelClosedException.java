package tyvm.runtime;

/**
 * Thrown when an operation is attempted on a closed {@link Channel}.
 *
 * <p>This is an unchecked exception because channel closure is typically a
 * programming-logic concern rather than a recoverable I/O error.</p>
 */
public class ChannelClosedException extends TyvmException {

    private static final long serialVersionUID = 1L;

    /** Constructs an exception with a default message. */
    public ChannelClosedException() {
        super("channel is closed");
    }

    /**
     * Constructs an exception with the given detail message.
     *
     * @param message the detail message
     */
    public ChannelClosedException(String message) {
        super(message);
    }

    /**
     * Constructs an exception with the given detail message and cause.
     *
     * @param message the detail message
     * @param cause   the underlying cause
     */
    public ChannelClosedException(String message, Throwable cause) {
        super(message, cause);
    }
}
