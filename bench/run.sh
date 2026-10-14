#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="$ROOT/dist/cli.js"
OUT="$ROOT/out/bench"
RUNTIME="$ROOT/runtime/tyvm-runtime.jar"
RUNS=${1:-5}

mkdir -p "$OUT"

BOLD=$'\033[1m'
CYAN=$'\033[36m'
GREEN=$'\033[32m'
RED=$'\033[31m'
DIM=$'\033[2m'
RESET=$'\033[0m'

BENCHMARKS=(
  fib
  ackermann
  sum-loop
  nested-loops
  arithmetic
  branchheavy
  boolchain
  calloverhead
  collatz
  sieve
  matmul
  stringconcat
)

echo "${BOLD}tyvm benchmark suite${RESET}"
echo "Runs: $RUNS per benchmark (median reported)"
echo "Node $(node --version) | Bun $(bun --version) | Java $(java --version 2>&1 | head -1)"
echo ""

median_ms() {
  local times=""
  for ((r=1; r<=RUNS; r++)); do
    local start end
    start=$(python3 -c 'import time; print(int(time.time()*1000))')
    eval "$@" > /dev/null 2>&1
    end=$(python3 -c 'import time; print(int(time.time()*1000))')
    times="$times $((end - start))"
  done
  echo "$times" | tr ' ' '\n' | sort -n | sed '/^$/d' | awk "NR==$((RUNS/2+1)){print}"
}

echo "${CYAN}Compiling benchmarks with tyvm...${RESET}"
for b in "${BENCHMARKS[@]}"; do
  node "$CLI" compile "$ROOT/bench/${b}.ts" --out "$OUT" 2>/dev/null || echo "  ⚠ failed to compile $b"
done

# JVM warmup (2 rounds to ensure C2 compilation)
for b in "${BENCHMARKS[@]}"; do
  java -XX:+UseSerialGC -Xms128m -Xss4m -cp "$OUT:$RUNTIME" "$b" > /dev/null 2>&1 || true
  java -XX:+UseSerialGC -Xms128m -Xss4m -cp "$OUT:$RUNTIME" "$b" > /dev/null 2>&1 || true
done
echo ""

RESULTS=""

for b in "${BENCHMARKS[@]}"; do
  echo "${DIM}benchmarking ${b}...${RESET}"

  node_ms=$(median_ms "node --experimental-strip-types '$ROOT/bench/${b}.ts'")
  bun_ms=$(median_ms "bun '$ROOT/bench/${b}.ts'")
  tyvm_ms=$(median_ms "java -XX:+UseSerialGC -Xms128m -Xss4m -cp '$OUT:$RUNTIME' '$b'")

  RESULTS="$RESULTS
$b $node_ms $bun_ms $tyvm_ms"
done

echo ""
echo "${BOLD}Results (median of $RUNS runs, milliseconds)${RESET}"
echo ""
printf "  ${BOLD}%-16s %8s %8s %8s  %s${RESET}\n" "Benchmark" "Node" "Bun" "tyvm" "vs Bun"
printf "  %-16s %8s %8s %8s  %s\n" "────────────────" "────────" "────────" "────────" "──────"

echo "$RESULTS" | while read -r name node_ms bun_ms tyvm_ms; do
  [ -z "$name" ] && continue
  if [ "$tyvm_ms" -le "$bun_ms" ] 2>/dev/null; then
    color="$GREEN"
    ratio=$(python3 -c "print(f'{${bun_ms}/${tyvm_ms}:.1f}x')")
    tag="${color}${ratio} faster${RESET}"
  else
    color="$RED"
    ratio=$(python3 -c "print(f'{${tyvm_ms}/${bun_ms}:.1f}x')")
    tag="${color}${ratio} slower${RESET}"
  fi
  printf "  %-16s %6d ms %6d ms %6d ms  %b\n" "$name" "$node_ms" "$bun_ms" "$tyvm_ms" "$tag"
done

echo ""
echo "Notes:"
echo "  - tyvm times are runtime-only (compilation excluded)"
echo "  - JVM includes ~50-80ms startup overhead"
echo "  - Node/Bun include their TS stripping overhead"
echo ""
echo "Benchmarks:"
echo "  fib          recursive fibonacci fib(38), pure recursion"
echo "  ackermann    ack(3,11), extreme recursion depth"
echo "  sum-loop     100M iterations, tight accumulator loop"
echo "  nested-loops 15Kx15K, nested iteration"
echo "  arithmetic   50M iters, mixed mul/div/mod/sub"
echo "  branchheavy  200M iters, unpredictable if/else chains"
echo "  boolchain    200M iters, short-circuit boolean logic"
echo "  calloverhead 200M iters, nested function calls"
echo "  collatz      5M numbers, Collatz sequence (branch + div)"
echo "  sieve        trial-division prime count to 5M"
echo "  matmul       200x200 matrix multiply (N^3 loop)"
echo "  stringconcat 2M string concatenations"
