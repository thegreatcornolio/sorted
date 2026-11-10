import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { aggregatePulse } from "./pulse";
import { loadScores, reconcilePulse, rememberScore, seedScores, type PulseLedger } from "./pulseLedger";
import { packPulse, readPulseRecord, unpackPulse } from "./pulseTable";
import type { ScoredRecord } from "./run";

test("a successful score is stored for one pulse read", async () => {
  const ledger = memoryLedger();
  await rememberScore(ledger, record("later.json", "2026-11-08T12:00:00.000Z", "detractor"));
  await rememberScore(ledger, record("first.json", "2026-11-08T11:00:00.000Z", "promoter"));
  await rememberScore(ledger, record("later.json", "2026-11-08T13:00:00.000Z", "detractor"));

  const calls = await loadScores(ledger);
  const pulse = aggregatePulse(calls);
  assert.equal(calls.length, 2);
  assert.equal(pulse.promoters, 1);
  assert.equal(pulse.detractors, 1);
  assert.equal(pulse.evidence?.file, "later.json");
  assert.equal(JSON.stringify(pulse).includes("\"nps\""), false);
});

test("an empty store stays empty until the first seed", async () => {
  const ledger = memoryLedger();
  assert.equal(await ledger.read(), null);
  await seedScores(ledger, [record("kept.json", "2026-11-08T10:00:00.000Z", "passive")]);
  await seedScores(ledger, [record("ignored.json", "2026-11-08T11:00:00.000Z", "promoter")]);
  const calls = await loadScores(ledger);
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as ScoredRecord).file, "kept.json");
});

test("a written empty pulse is not refilled from old scores", async () => {
  const ledger = memoryLedger();
  await rememberScore(ledger, record("old.json", "2026-11-08T12:00:00.000Z", "detractor"));
  await ledger.write([]);
  await seedScores(ledger, [record("old.json", "2026-11-08T12:00:00.000Z", "detractor")]);
  assert.deepEqual(await loadScores(ledger), []);
  await rememberScore(ledger, record("new.json", "2026-11-08T13:00:00.000Z", "promoter"));
  const calls = await loadScores(ledger);
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as ScoredRecord).file, "new.json");
});

test("no result json clears stored scores on the next poll", async () => {
  const ledger = memoryLedger();
  await rememberScore(ledger, record("old.json", "2026-11-08T12:00:00.000Z", "detractor"));
  let loads = 0;
  await reconcilePulse(ledger, false, async () => {
    loads += 1;
    return [record("should-not-load.json", "2026-11-08T13:00:00.000Z", "promoter")];
  });
  assert.equal(loads, 0);
  const pulse = aggregatePulse(await loadScores(ledger));
  assert.equal(pulse.total, 0);
  assert.equal(pulse.promoters, 0);
  assert.equal(pulse.detractors, 0);
  assert.equal(pulse.evidence, null);
  assert.deepEqual(pulse.movement, []);
});

test("result json that is still present keeps the stored pulse", async () => {
  const ledger = memoryLedger();
  await rememberScore(ledger, record("kept.json", "2026-11-08T12:00:00.000Z", "promoter"));
  let loads = 0;
  await reconcilePulse(ledger, true, async () => {
    loads += 1;
    return [];
  });
  assert.equal(loads, 0);
  assert.equal((await loadScores(ledger)).length, 1);
});

test("a pulse read returns the one table record and does not wait on a stuck call", async () => {
  const entity = packPulse(JSON.stringify([{ file: "a.json", sentiment: "positive", npsBand: "promoter", scoredAt: "2026-11-08T00:00:00.000Z" }]));
  const calls = await readPulseRecord("UseDevelopmentStorage=true", async () => entity, 1_000);
  assert.equal(calls?.[0] && (calls[0] as { file: string }).file, "a.json");

  const started = Date.now();
  await assert.rejects(
    () => readPulseRecord("UseDevelopmentStorage=true", () => new Promise(() => undefined), 40),
    /could not be read/,
  );
  assert.ok(Date.now() - started < 1_000);

  const missing = Object.assign(new Error("missing"), { statusCode: 404 });
  assert.equal(await readPulseRecord("UseDevelopmentStorage=true", async () => { throw missing; }, 1_000), null);
});

test("the pulse request does not share the poll lock or list blobs", () => {
  const table = readFileSync(resolve(__dirname, "pulseTable.ts"), "utf8");
  const request = table.slice(table.indexOf("export async function readPulseRecord"), table.indexOf("async function readTableEntity"));
  assert.doesNotMatch(request, /createTable|exclusive|listBlobs|seedStore/);
  const azure = readFileSync(resolve(__dirname, "azure.ts"), "utf8");
  const reader = azure.slice(azure.indexOf("export async function readStoredScores"), azure.indexOf("function pulseStore"));
  assert.match(reader, /readPulseRecord/);
  assert.doesNotMatch(reader, /seedStore|scoreIncoming|listResultRecords|pulseStore|judgeTranscript|AZURE_OPENAI/);
});

test("the table entity round-trips a pulse larger than one property", () => {
  const body = JSON.stringify([{ file: "x".repeat(40_000), sentiment: "mixed" }]);
  assert.ok(body.length > 30_000);
  const packed = packPulse(body);
  assert.equal(typeof packed.p0, "string");
  assert.equal(typeof packed.p1, "string");
  assert.equal(unpackPulse(packed), body);
});

function memoryLedger(): PulseLedger {
  let body: unknown[] | null = null;
  return {
    async read() {
      return body ? body.map((item) => ({ ...(item as object) })) : null;
    },
    async write(calls) {
      body = calls.map((item) => ({ ...(item as object) }));
    },
    async update(change) {
      const current = body ? body.map((item) => ({ ...(item as object) })) : null;
      const next = await change(current);
      body = next.map((item) => ({ ...(item as object) }));
    },
  };
}

function record(file: string, scoredAt: string, npsBand: ScoredRecord["npsBand"]): ScoredRecord {
  const sentiment = npsBand === "promoter" ? "positive" : npsBand === "detractor" ? "negative" : "mixed";
  return {
    file,
    sentiment,
    mix: sentiment === "positive" ? { positive: 100, neutral: 0, negative: 0 } : sentiment === "negative" ? { positive: 0, neutral: 0, negative: 100 } : { positive: 0, neutral: 100, negative: 0 },
    nps: null,
    npsBand,
    csat: npsBand === "detractor" ? 1 : npsBand === "promoter" ? 5 : 3,
    csatBand: npsBand === "detractor" ? "negative" : npsBand === "promoter" ? "positive" : "neutral",
    reason: npsBand === "detractor" ? "They wanted to cancel" : null,
    evidence: npsBand === "detractor" ? "Please cancel the cover." : "Thank you.",
    company: null,
    predictedNps: npsBand === "promoter" ? 9 : npsBand === "passive" ? 8 : 3,
    sentimentStart: sentiment,
    sentimentEnd: sentiment,
    resolved: npsBand === "promoter",
    summary: "Stored score.",
    vulnerable: false,
    vulnerability_reason: "",
    next_step: "",
    scoredAt,
  };
}
