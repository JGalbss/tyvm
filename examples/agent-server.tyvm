import {
  serve, Controller, Get, Post,
  useRedis, checkpoint, recover,
  spawn, channel
} from "tyvm";

// Connect checkpoints to Redis so state survives crashes
useRedis("localhost", 6379);

// Shared task counter (module-level state → JVM static field)
let taskCount = 0;

@Controller("/api")
class AgentController {

  @Get("/health")
  health(): string {
    return '{"status":"ok","runtime":"tyvm-durable-vthreads","tasks":' + taskCount + '}';
  }

  // Submit a new task — runs on its own virtual thread
  @Post("/tasks")
  submitTask(req: Request): string {
    taskCount = taskCount + 1;
    const id = taskCount;
    const body = req.getBody();

    // Checkpoint the task input so we can recover after crash
    checkpoint("task:" + id + ":input", body);
    checkpoint("task:" + id + ":status", "queued");

    // Spawn the task on a virtual thread
    spawn(processTask(id, body));

    return '{"id":' + id + ',"status":"queued"}';
  }

  // Check task status — reads from Redis, survives restarts
  @Get("/tasks/status")
  taskStatus(req: Request): string {
    const path = req.getPath();
    // Extract task ID from query string: /api/tasks/status?id=1
    const url = req.getUrl();
    const id = extractParam(url, "id");
    const status = recover("task:" + id + ":status");
    const result = recover("task:" + id + ":result");
    return '{"id":' + id + ',"status":"' + status + '","result":' + result + '}';
  }

  // List recent checkpoints — shows what survived
  @Get("/tasks/recover")
  recoverTasks(): string {
    const count = recover("task-count");
    return '{"recoveredTaskCount":' + count + '}';
  }
}

// Process a task on a virtual thread with checkpoint updates
function processTask(id: number, input: string): string {
  checkpoint("task:" + id + ":status", "running");
  checkpoint("task-count", "" + id);

  // Simulate work in stages with checkpoints between each
  checkpoint("task:" + id + ":stage", "1-parse");
  const parsed = parseInput(input);

  checkpoint("task:" + id + ":stage", "2-process");
  const processed = transform(parsed);

  checkpoint("task:" + id + ":stage", "3-complete");
  checkpoint("task:" + id + ":status", "done");
  checkpoint("task:" + id + ":result", '"' + processed + '"');

  return processed;
}

function parseInput(input: string): string {
  return input;
}

function transform(data: string): string {
  return "processed:" + data;
}

function extractParam(url: string, param: string): string {
  return "1";
}

serve(8080);
