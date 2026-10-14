// Matrix multiply simulation: N^3 loop with arithmetic (no arrays needed)
// Simulates 200x200 matrix multiply by accumulating products, repeated 4 times
const N = 200;
let checksum = 0;
let rep = 0;
while (rep < 10) {
  let i = 0;
  while (i < N) {
    let j = 0;
    while (j < N) {
      let sum = 0;
      let k = 0;
      while (k < N) {
        sum = sum + (i * N + k) * (k * N + j);
        k = k + 1;
      }
      checksum = checksum + sum % 1000;
      j = j + 1;
    }
    i = i + 1;
  }
  rep = rep + 1;
}
console.log(checksum);
