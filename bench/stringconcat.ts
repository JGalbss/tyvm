// String concatenation: builds a large string from repeated appends
let s = "";
let i = 0;
while (i < 5000000) {
  s = s + "abcde";
  i = i + 1;
}
console.log(s.length);
