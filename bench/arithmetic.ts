// Heavy mixed arithmetic: tests mul, div, mod, sub across many iterations
let result = 0;
let i = 1;
while (i < 350000000) {
  result = result + i % 7 * 3 - i % 5 * 2 + i % 3;
  i = i + 1;
}
console.log(result);
