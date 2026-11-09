import assert from "node:assert/strict";
import test from "node:test";
import { aggregatePulse } from "./pulse";
import { loadScores, reconcilePulse, rememberScore, seedScores, type PulseLedger } from "./pulseLedger";
import { packPulse, unpackPulse } from "./pulseTable";
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
    reason: npsBand === "detractor" ? "They wanted to cancel" : null,
    evidence: npsBand === "detractor" ? "Please cancel the cover." : "Thank you.",
    company: null,
    scoredAt,
  };
}
