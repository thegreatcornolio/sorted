import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { CLEAR_TRANSCRIPTS_PATH, handleContainerRequest, pollError, PULSE_PATH } from "./container";
import { SITE_ORIGIN } from "./pulse";

test("GET /api/pulse returns the aggregate and only the site origin", async () => {
  const response = await handleContainerRequest("GET", "/api/pulse", async () => []);
  assert.equal(response.status, 200);
  assert.equal(response.headers["Access-Control-Allow-Origin"], SITE_ORIGIN);
  assert.equal(response.headers["Access-Control-Allow-Origin"], "https://sorted.trilogybpo.com");
  const body = JSON.parse(response.body) as { total: number; nps?: unknown };
  assert.equal(body.total, 0);
  assert.equal("nps" in body, false);
});

test("POST /api/clear-results returns an empty pulse and GET does not clear", async () => {
  let cleared = 0;
  const clearedResponse = await handleContainerRequest(
    "POST",
    "/api/clear-results",
    async () => {
      throw new Error("clear must not read scores");
    },
    async () => {
      cleared += 1;
    },
  );
  assert.equal(cleared, 1);
  assert.equal(clearedResponse.status, 200);
  assert.equal(clearedResponse.headers["Access-Control-Allow-Origin"], "https://sorted.trilogybpo.com");
  const body = JSON.parse(clearedResponse.body) as { total: number; csat: number | null; promoters: number; detractors: number };
  assert.equal(body.total, 0);
  assert.equal(body.csat, null);
  assert.equal(body.promoters, 0);
  assert.equal(body.detractors, 0);
  assert.equal("nps" in body, false);

  cleared = 0;
  const read = await handleContainerRequest("GET", "/api/pulse", async () => [], async () => {
    cleared += 1;
  });
  assert.equal(read.status, 200);
  assert.equal(cleared, 0);
});

test("POST /api/clear-transcripts empties storage only after that route is called", async () => {
  let scores = 0;
  let transcripts = 0;
  const response = await handleContainerRequest(
    "POST",
    CLEAR_TRANSCRIPTS_PATH,
    async () => {
      throw new Error("clear must not read scores");
    },
    async () => {
      scores += 1;
    },
    async () => {
      transcripts += 1;
    },
  );
  assert.equal(transcripts, 1);
  assert.equal(scores, 0);
  assert.equal(response.status, 200);
  assert.equal(response.headers["Access-Control-Allow-Origin"], "https://sorted.trilogybpo.com");
  const body = JSON.parse(response.body) as { total: number };
  assert.equal(body.total, 0);

  const ignored = await handleContainerRequest("GET", PULSE_PATH, async () => [], async () => {
    scores += 1;
  }, async () => {
    transcripts += 1;
  });
  assert.equal(ignored.status, 200);
  assert.equal(transcripts, 1);
  assert.equal(scores, 0);
});

test("the pulse path answers a browser preflight and hides storage errors", async () => {
  const preflight = await handleContainerRequest("OPTIONS", `${PULSE_PATH}?x=1`, async () => {
    throw new Error("unused");
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers["Access-Control-Allow-Origin"], "https://sorted.trilogybpo.com");

  const failed = await handleContainerRequest("GET", PULSE_PATH, async () => {
    throw new Error("DefaultEndpointsProtocol=https;AccountKey=secret");
  });
  assert.equal(failed.status, 500);
  assert.equal(failed.headers["Access-Control-Allow-Origin"], "https://sorted.trilogybpo.com");
  assert.equal(failed.body.includes("AccountKey"), false);
  assert.equal(failed.body.includes("secret"), false);
  assert.equal(await handleContainerRequest("GET", "/upload", async () => []).then((result) => result.status), 404);
});

test("a poll error never repeats a connection string or an API key", () => {
  assert.equal(pollError(new Error("AccountKey=secret")), "Scoring poll failed.");
  assert.equal(pollError(new Error("api-key: secret")), "Scoring poll failed.");
  assert.equal(pollError(new Error("SORTED_STORAGE_CONNECTION_STRING is not set.")), "SORTED_STORAGE_CONNECTION_STRING is not set.");
  assert.equal(pollError(new Error("AZURE_OPENAI_API_KEY is not set.")), "AZURE_OPENAI_API_KEY is not set.");
});

test("the image runs the poller and does not bake a connection string", () => {
  const dockerfile = readFileSync(resolve(__dirname, "../Dockerfile"), "utf8");
  const ignore = readFileSync(resolve(__dirname, "../.dockerignore"), "utf8");
  const source = readFileSync(resolve(__dirname, "container.ts"), "utf8");
  assert.match(dockerfile, /COPY functions\/package\.json functions\/package-lock\.json \.\//);
  assert.match(dockerfile, /COPY functions\/tsconfig\.json \.\//);
  assert.match(dockerfile, /COPY functions\/src \.\/src/);
  assert.doesNotMatch(dockerfile, /^COPY package\.json/m);
  assert.match(dockerfile, /CMD \["node", "dist\/container\.js"\]/);
  assert.doesNotMatch(dockerfile, /\bfunc\b/);
  assert.doesNotMatch(dockerfile, /SORTED_STORAGE_CONNECTION_STRING\s*=/);
  assert.doesNotMatch(dockerfile, /AZURE_OPENAI_(ENDPOINT|API_KEY|DEPLOYMENT|API_VERSION)\s*=/);
  assert.doesNotMatch(dockerfile, /AccountKey|SharedAccessSignature|DefaultEndpointsProtocol/);
  assert.match(ignore, /local\.settings\.json/);
  assert.doesNotMatch(source, /loadLocalSettings/);
  assert.doesNotMatch(source, /readScoredResults/);
  assert.match(source, /readStoredScores/);
});
