import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { handleContainerRequest, pollError, PULSE_PATH } from "./container";
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

test("a poll error never repeats a connection string", () => {
  assert.equal(pollError(new Error("AccountKey=secret")), "Scoring poll failed.");
  assert.equal(pollError(new Error("SORTED_STORAGE_CONNECTION_STRING is not set.")), "SORTED_STORAGE_CONNECTION_STRING is not set.");
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
  assert.doesNotMatch(dockerfile, /AccountKey|SharedAccessSignature|DefaultEndpointsProtocol/);
  assert.match(ignore, /local\.settings\.json/);
  assert.doesNotMatch(source, /loadLocalSettings/);
});
