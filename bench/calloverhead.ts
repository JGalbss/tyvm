// Function call overhead: many small function calls in a tight loop
function add(a: number, b: number): number {
  return a + b;
}

function sub(a: number, b: number): number {
  return a - b;
}

function compute(x: number): number {
  return add(sub(x % 7, 3), sub(x % 5, 2));
}

let sum = 0;
let i = 0;
while (i < 200000000) {
  sum = sum + compute(i);
  i = i + 1;
}
console.log(sum);
