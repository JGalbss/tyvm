let count = 0;
let i = 0;
while (i < 15000) {
  let j = 0;
  while (j < 15000) {
    count = count + 1;
    j = j + 1;
  }
  i = i + 1;
}
console.log(count);
