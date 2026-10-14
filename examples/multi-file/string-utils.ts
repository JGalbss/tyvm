/**
 * String utility functions — compiled to StringUtils.class
 *
 * Demonstrates cross-file string operations.
 */

export function greet(name: string): string {
  return "Hello, " + name + "!";
}

export function repeat(s: string, times: number): string {
  let result = "";
  let i = 0;
  while (i < times) {
    result = result + s;
    i = i + 1;
  }
  return result;
}

export function exclaim(message: string): string {
  return message + "!!!";
}
