// Virtual thread support: spawn tasks and await their results.
//
// spawn(fn(args)) launches fn(args) on a virtual thread and returns a Task.
// task.await() blocks until the Task completes and returns the result.

import { Task, spawn } from "tyvm";

function slowCompute(n: number): number {
  let sum = 0;
  let i = 0;
  while (i < n) {
    sum = sum + i;
    i = i + 1;
  }
  return sum;
}

function main(): void {
  // Spawn three concurrent tasks on virtual threads
  const t1: Task<number> = spawn(slowCompute(10000000));
  const t2: Task<number> = spawn(slowCompute(20000000));
  const t3: Task<number> = spawn(slowCompute(30000000));

  // Await results
  const r1: number = t1.await();
  const r2: number = t2.await();
  const r3: number = t3.await();

  console.log(r1);
  console.log(r2);
  console.log(r3);
}
