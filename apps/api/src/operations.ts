import { timingSafeEqual } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";

type Metric = { count: number; durationMs: number };

export class HttpOperations {
  private active = 0;
  private readonly starts = new WeakMap<FastifyRequest, bigint>();
  private readonly metrics = new Map<string, Metric>();

  attach(app: FastifyInstance): void {
    app.addHook("onRequest", async (request) => {
      this.active += 1;
      this.starts.set(request, process.hrtime.bigint());
    });
    app.addHook("onResponse", async (request, reply) => {
      this.active = Math.max(0, this.active - 1);
      const started = this.starts.get(request);
      const durationMs = started
        ? Number(process.hrtime.bigint() - started) / 1_000_000
        : 0;
      const route = request.routeOptions.url ?? "unmatched";
      const key = JSON.stringify([request.method, route, reply.statusCode]);
      const metric = this.metrics.get(key) ?? { count: 0, durationMs: 0 };
      metric.count += 1;
      metric.durationMs += durationMs;
      this.metrics.set(key, metric);
    });
  }

  render(service: string): string {
    const prefix = service.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
    const lines = [
      `# HELP ${prefix}_http_requests_active Current HTTP requests.`,
      `# TYPE ${prefix}_http_requests_active gauge`,
      `${prefix}_http_requests_active ${this.active}`,
      `# HELP ${prefix}_http_requests_total Completed HTTP requests.`,
      `# TYPE ${prefix}_http_requests_total counter`,
      `# HELP ${prefix}_http_request_duration_ms_total Total request duration.`,
      `# TYPE ${prefix}_http_request_duration_ms_total counter`,
    ];
    for (const [key, metric] of this.metrics) {
      const [method, route, status] = JSON.parse(key) as [string, string, number];
      const labels = `method="${method}",route="${route}",status="${status}"`;
      lines.push(`${prefix}_http_requests_total{${labels}} ${metric.count}`);
      lines.push(
        `${prefix}_http_request_duration_ms_total{${labels}} ${metric.durationMs.toFixed(3)}`,
      );
    }
    return `${lines.join("\n")}\n`;
  }
}

export function validBearerToken(
  authorization: string | undefined,
  expected: string | undefined,
): boolean {
  if (!authorization?.startsWith("Bearer ") || !expected) return false;
  const actual = Buffer.from(authorization.slice(7));
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
