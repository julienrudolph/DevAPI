const target = new URL(
  process.env.LOAD_TEST_URL ?? "http://localhost:8080/api/health",
);
const allowRemote = process.env.LOAD_TEST_ALLOW_REMOTE === "true";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

if (!["http:", "https:"].includes(target.protocol)) {
  throw new Error("LOAD_TEST_URL muss HTTP oder HTTPS verwenden.");
}
if (!allowRemote && !localHosts.has(target.hostname)) {
  throw new Error(
    "Externe Ziele sind standardmäßig gesperrt. Setze LOAD_TEST_ALLOW_REMOTE=true nur für ein ausdrücklich freigegebenes Testsystem.",
  );
}

const totalRequests = readPositiveInteger("LOAD_TEST_REQUESTS", 200, 5_000);
const concurrency = readPositiveInteger("LOAD_TEST_CONCURRENCY", 10, 50);
const timeoutMs = readPositiveInteger("LOAD_TEST_TIMEOUT_MS", 5_000, 60_000);
const maximumP95Ms = readPositiveInteger(
  "LOAD_TEST_MAX_P95_MS",
  1_000,
  60_000,
);
const durations = [];
const failures = [];
let nextRequest = 0;

async function worker() {
  while (nextRequest < totalRequests) {
    const requestNumber = nextRequest;
    nextRequest += 1;
    const startedAt = performance.now();
    try {
      const response = await fetch(target, {
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
      await response.arrayBuffer();
      durations.push(performance.now() - startedAt);
      if (!response.ok) {
        failures.push(`#${requestNumber + 1}: HTTP ${response.status}`);
      }
    } catch (error) {
      failures.push(
        `#${requestNumber + 1}: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
      );
    }
  }
}

await Promise.all(
  Array.from(
    { length: Math.min(concurrency, totalRequests) },
    () => worker(),
  ),
);

durations.sort((left, right) => left - right);
const p50 = percentile(durations, 0.5);
const p95 = percentile(durations, 0.95);
const p99 = percentile(durations, 0.99);
const summary = {
  target: target.toString(),
  requests: totalRequests,
  concurrency,
  failures: failures.length,
  p50Ms: Math.round(p50),
  p95Ms: Math.round(p95),
  p99Ms: Math.round(p99),
};
console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  console.error(failures.slice(0, 10).join("\n"));
  process.exitCode = 1;
} else if (p95 > maximumP95Ms) {
  console.error(
    `Die p95-Latenz ${Math.round(p95)} ms überschreitet das Limit ${maximumP95Ms} ms.`,
  );
  process.exitCode = 1;
}

function readPositiveInteger(name, fallback, maximum) {
  const rawValue = process.env[name];
  const value = rawValue === undefined ? fallback : Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} muss zwischen 1 und ${maximum} liegen.`);
  }
  return value;
}

function percentile(values, quantile) {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  return values[
    Math.min(values.length - 1, Math.ceil(values.length * quantile) - 1)
  ];
}
