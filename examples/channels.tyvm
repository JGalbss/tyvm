// Channel-based concurrency: Go-style channels for typed communication
// between virtual threads.
//
// channel() creates an unbuffered channel; send() blocks until a receiver
// is ready, and recv() blocks until a value is available.

import { spawn, Channel, channel } from "tyvm";

function producer(ch: Channel<number>, count: number): void {
  let i = 0;
  while (i < count) {
    ch.send(i * i);
    i = i + 1;
  }
}

function main(): void {
  const ch: Channel<number> = channel();

  // Producer sends 10 squared values on a virtual thread
  spawn(producer(ch, 10));

  // Receive all 10 values and sum them
  let sum = 0;
  let i = 0;
  while (i < 10) {
    const val: number = ch.recv();
    console.log(val);
    sum = sum + val;
    i = i + 1;
  }
  // 0 + 1 + 4 + 9 + 16 + 25 + 36 + 49 + 64 + 81 = 285
  console.log(sum);
}
