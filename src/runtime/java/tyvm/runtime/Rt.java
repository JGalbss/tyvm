package tyvm.runtime;

/**
 * Core runtime helpers for tyvm-compiled TypeScript programs.
 *
 * <p>This class provides the primitive operations that the compiler emits calls
 * to: printing, string concatenation for template literals, and boxing/unboxing
 * conversions between JVM primitives and {@link Object}.</p>
 *
 * <p>All methods are static; this class is not instantiable.</p>
 */
public final class Rt {

    private Rt() {
        // non-instantiable
    }

    // -----------------------------------------------------------------------
    //  println overloads
    // -----------------------------------------------------------------------

    /**
     * Prints a {@code double} to standard output.  If the value is a whole
     * number (no fractional part and within {@code long} range), it is
     * printed without a decimal point (e.g. {@code 5.0} prints as
     * {@code "5"}).
     *
     * @param v the value to print
     */
    public static void println(double v) {
        if (v == Math.floor(v) && !Double.isInfinite(v) && !Double.isNaN(v)
                && v >= Long.MIN_VALUE && v <= Long.MAX_VALUE) {
            System.out.println((long) v);
        } else {
            System.out.println(v);
        }
    }

    /**
     * Prints a {@code long} to standard output.
     *
     * @param v the value to print
     */
    public static void println(long v) {
        System.out.println(v);
    }

    /**
     * Prints an {@code int} to standard output.
     *
     * @param v the value to print
     */
    public static void println(int v) {
        System.out.println(v);
    }

    /**
     * Prints a {@code boolean} to standard output.
     *
     * @param v the value to print
     */
    public static void println(boolean v) {
        System.out.println(v);
    }

    /**
     * Prints a {@link String} to standard output.
     *
     * @param v the value to print
     */
    public static void println(String v) {
        System.out.println(v);
    }

    /**
     * Prints an arbitrary object to standard output.  {@code null} is
     * printed as the string {@code "undefined"} to match TypeScript
     * semantics.
     *
     * @param v the value to print
     */
    public static void println(Object v) {
        if (v == null) {
            System.out.println("undefined");
        } else if (v instanceof Double d) {
            println(d.doubleValue());
        } else {
            System.out.println(v);
        }
    }

    // -----------------------------------------------------------------------
    //  String concatenation (template literals)
    // -----------------------------------------------------------------------

    /**
     * Concatenates an arbitrary number of parts into a single {@link String}.
     *
     * <p>Each part is converted to its string representation.  {@code null}
     * maps to {@code "undefined"}, boxed {@link Double} values with no
     * fractional part are formatted as integers, and everything else uses
     * {@link Object#toString()}.</p>
     *
     * @param parts the values to concatenate
     * @return the concatenated string
     */
    public static String concat(String a, String b) {
        return a + b;
    }

    public static String concat(Object... parts) {
        StringBuilder sb = new StringBuilder();
        for (Object part : parts) {
            if (part == null) {
                sb.append("undefined");
            } else if (part instanceof Double d) {
                double dv = d.doubleValue();
                if (dv == Math.floor(dv) && !Double.isInfinite(dv) && !Double.isNaN(dv)
                        && dv >= Long.MIN_VALUE && dv <= Long.MAX_VALUE) {
                    sb.append((long) dv);
                } else {
                    sb.append(dv);
                }
            } else {
                sb.append(part);
            }
        }
        return sb.toString();
    }

    // -----------------------------------------------------------------------
    //  Unboxing helpers
    // -----------------------------------------------------------------------

    /**
     * Unboxes an {@link Object} to a {@code double}.
     *
     * <ul>
     *   <li>{@link Number} &rarr; {@code doubleValue()}</li>
     *   <li>{@link Boolean} &rarr; {@code 1.0} / {@code 0.0}</li>
     *   <li>{@link String} &rarr; parsed via {@link Double#parseDouble}</li>
     *   <li>{@code null} &rarr; {@code 0.0}</li>
     * </ul>
     *
     * @param v the value to convert
     * @return the {@code double} representation
     * @throws TyvmException if the value cannot be converted
     */
    public static double toDouble(Object v) {
        if (v == null) {
            return 0.0;
        }
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        if (v instanceof Boolean b) {
            return b.booleanValue() ? 1.0 : 0.0;
        }
        if (v instanceof String s) {
            try {
                return Double.parseDouble(s);
            } catch (NumberFormatException e) {
                return Double.NaN;
            }
        }
        throw new TyvmException("cannot convert " + v.getClass().getName() + " to double");
    }

    /**
     * Unboxes an {@link Object} to a {@code long}.
     *
     * <ul>
     *   <li>{@link Number} &rarr; {@code longValue()}</li>
     *   <li>{@link Boolean} &rarr; {@code 1} / {@code 0}</li>
     *   <li>{@link String} &rarr; parsed via {@link Long#parseLong}</li>
     *   <li>{@code null} &rarr; {@code 0}</li>
     * </ul>
     *
     * @param v the value to convert
     * @return the {@code long} representation
     * @throws TyvmException if the value cannot be converted
     */
    public static long toLong(Object v) {
        if (v == null) {
            return 0L;
        }
        if (v instanceof Number n) {
            return n.longValue();
        }
        if (v instanceof Boolean b) {
            return b.booleanValue() ? 1L : 0L;
        }
        if (v instanceof String s) {
            try {
                return Long.parseLong(s);
            } catch (NumberFormatException e) {
                throw new TyvmException("cannot convert string \"" + s + "\" to long", e);
            }
        }
        throw new TyvmException("cannot convert " + v.getClass().getName() + " to long");
    }

    /**
     * Converts an {@link Object} to a {@code boolean} using TypeScript
     * truthiness rules.
     *
     * <p>The following values are falsy: {@code null}, {@code false},
     * {@code 0} (any numeric zero), {@code NaN}, and the empty string
     * {@code ""}. Everything else is truthy.</p>
     *
     * @param v the value to test
     * @return the truthiness of the value
     */
    public static boolean toBoolean(Object v) {
        if (v == null) {
            return false;
        }
        if (v instanceof Boolean b) {
            return b.booleanValue();
        }
        if (v instanceof Number n) {
            double d = n.doubleValue();
            return d != 0.0 && !Double.isNaN(d);
        }
        if (v instanceof String s) {
            return !s.isEmpty();
        }
        return true;
    }

    // -----------------------------------------------------------------------
    //  Boxing helpers
    // -----------------------------------------------------------------------

    /**
     * Boxes a {@code double} into a {@link Double}.
     *
     * @param v the primitive value
     * @return the boxed value
     */
    public static Object box(double v) {
        return Double.valueOf(v);
    }

    /**
     * Boxes a {@code long} into a {@link Long}.
     *
     * @param v the primitive value
     * @return the boxed value
     */
    public static Object box(long v) {
        return Long.valueOf(v);
    }

    /**
     * Boxes a {@code boolean} into a {@link Boolean}.
     *
     * @param v the primitive value
     * @return the boxed value
     */
    public static Object box(boolean v) {
        return Boolean.valueOf(v);
    }
}
