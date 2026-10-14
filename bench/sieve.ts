// Prime counting via trial division: tests function calls + branch + modulo
const N = 15000000;
let count = 1; // count 2 as prime

function isPrime(n: number): boolean {
  if (n % 2 == 0) {
    return false;
  }
  let d = 3;
  while (d * d <= n) {
    if (n % d == 0) {
      return false;
    }
    d = d + 2;
  }
  return true;
}

let i = 3;
while (i < N) {
  if (isPrime(i)) {
    count = count + 1;
  }
  i = i + 2;
}
console.log(count);
