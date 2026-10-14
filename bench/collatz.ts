// Collatz conjecture: tests branches + division + recursion-like patterns
function collatzSteps(n: number): number {
  let steps = 0;
  while (n != 1) {
    if (n % 2 == 0) {
      n = n / 2;
    } else {
      n = n * 3 + 1;
    }
    steps = steps + 1;
  }
  return steps;
}

let total = 0;
let i = 1;
while (i <= 2000000) {
  total = total + collatzSteps(i);
  i = i + 1;
}
console.log(total);
