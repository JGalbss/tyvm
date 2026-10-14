// Fan-out / fan-in pattern using channels and virtual threads.
//
// Multiple worker threads pull jobs from a shared channel, compute
// results, and push them to a results channel. A separate dispatcher
// thread distributes work while the main thread collects results.

import { spawn, Channel, channel } from "tyvm";

function worker(jobs: Channel<number>, results: Channel<number>): void {
  // Process jobs until receiving the stop signal (-1)
  let job: number = jobs.recv();
  while (job >= 0) {
    // Compute the triangular number T(job) = sum of 0..job-1
    let sum = 0;
    let i = 0;
    while (i < job) {
      sum = sum + i;
      i = i + 1;
    }
    results.send(sum);
    job = jobs.recv();
  }
}

function dispatch(jobs: Channel<number>, numJobs: number, numWorkers: number): void {
  // Send jobs
  let j = 0;
  while (j < numJobs) {
    jobs.send(100 + j);
    j = j + 1;
  }
  // Send stop signals (one per worker)
  let w = 0;
  while (w < numWorkers) {
    jobs.send(0 - 1);
    w = w + 1;
  }
}

function main(): void {
  const jobs: Channel<number> = channel();
  const results: Channel<number> = channel();

  const numWorkers = 3;
  const numJobs = 9;

  // Start workers
  let w = 0;
  while (w < numWorkers) {
    spawn(worker(jobs, results));
    w = w + 1;
  }

  // Dispatch jobs on a separate thread so main can receive results
  spawn(dispatch(jobs, numJobs, numWorkers));

  // Collect all results
  let total = 0;
  let r = 0;
  while (r < numJobs) {
    total = total + results.recv();
    r = r + 1;
  }
  console.log(total);
}
