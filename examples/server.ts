import { serve, Controller, Get, Post } from "tyvm";

@Controller("/api")
class AppController {

  @Get("/health")
  health(): string {
    return '{"status":"ok","runtime":"virtual-threads"}';
  }

  @Get("/users")
  listUsers(): string {
    return '{"users":["alice","bob","charlie"]}';
  }

  @Post("/users")
  createUser(req: Request): string {
    const body = req.getBody();
    return '{"created":true,"body":' + body + '}';
  }
}

serve(8080);
