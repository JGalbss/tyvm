package tyvm.runtime;

/**
 * Base runtime exception for the tyvm TypeScript-to-JVM compiler.
 *
 * <p>All tyvm-specific runtime errors extend this class, making it possible
 * to catch every compiler-runtime failure with a single handler while still
 * allowing fine-grained catches for specific subtypes.</p>
 */
public class TyvmException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** Constructs an exception with no detail message. */
    public TyvmException() {
        super();
    }

    /**
     * Constructs an exception with the given detail message.
     *
     * @param message the detail message
     */
    public TyvmException(String message) {
        super(message);
    }

    /**
     * Constructs an exception with the given detail message and cause.
     *
     * @param message the detail message
     * @param cause   the underlying cause
     */
    public TyvmException(String message, Throwable cause) {
        super(message, cause);
    }

    /**
     * Constructs an exception with the given cause.
     *
     * @param cause the underlying cause
     */
    public TyvmException(Throwable cause) {
        super(cause);
    }
}
