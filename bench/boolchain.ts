// Boolean chain: tests short-circuit evaluation and boolean operations
let trueCount = 0;
let i = 0;
while (i < 300000000) {
  const a = i % 2 == 0;
  const b = i % 3 == 0;
  const c = i % 5 == 0;
  if (a && b || c && !a) {
    trueCount = trueCount + 1;
  }
  i = i + 1;
}
console.log(trueCount);
