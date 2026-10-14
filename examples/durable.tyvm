import { serve, Controller, Get, Post, durable, checkpoint, recover } from "tyvm";

// Durable task example — agent-friendly HTTP API with
// retry, timeout, and checkpoint support on virtual threads

@Controller("/api")
class AgentController {

  @Get("/health")
  health(): string {
    return '{"status":"ok","runtime":"durable-virtual-threads"}';
  }

  @Post("/tasks/run")
  runTask(req: Request): string {
    const body = req.getBody();
    return '{"task":"started","input":' + body + '}';
  }

  @Get("/tasks/status")
  taskStatus(): string {
    const last = recover("last-task");
    return '{"checkpoint":"' + last + '"}';
  }

  @Post("/checkpoint")
  saveCheckpoint(req: Request): string {
    const body = req.getBody();
    checkpoint("last-task", body);
    return '{"saved":true}';
  }
}

serve(8080);
