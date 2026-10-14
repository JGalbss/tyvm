/**
 * Math utility functions — compiled to MathUtils.class
 *
 * These are imported by main.ts and demonstrate cross-file
 * function calls (INVOKESTATIC MathUtils.add etc.)
 */

export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export function square(x: number): number {
  return multiply(x, x);
}

export function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
