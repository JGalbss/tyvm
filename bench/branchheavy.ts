// Branch-heavy: tests conditional branching with unpredictable patterns
let sum = 0;
let i = 0;
while (i < 500000000) {
  if (i % 3 == 0) {
    sum = sum + 1;
  } else if (i % 5 == 0) {
    sum = sum + 2;
  } else if (i % 7 == 0) {
    sum = sum + 3;
  } else {
    sum = sum - 1;
  }
  i = i + 1;
}
console.log(sum);
