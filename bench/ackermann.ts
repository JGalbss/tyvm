// Ackermann function: extreme recursion depth + function call stress
function ack(m: number, n: number): number {
  if (m == 0) {
    return n + 1;
  }
  if (n == 0) {
    return ack(m - 1, 1);
  }
  return ack(m - 1, ack(m, n - 1));
}

const result = ack(3, 11);
console.log(result);
