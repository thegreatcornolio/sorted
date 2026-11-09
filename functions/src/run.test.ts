import assert from "node:assert/strict";
import test from "node:test";
import { scoreIncoming, scoreOne, transcriptName } from "./run";
import type { TranscriptStore } from "./store";

type Blob = { body: Buffer; contentType: string };

class MemoryStore implements TranscriptStore {
  blobs = new Map<string, Blob>();

  constructor(files: Record<string, string> = {}) {
    for (const [name, text] of Object.entries(files)) {
      this.blobs.set(name, { body: Buffer.from(text), contentType: "text/plain; charset=utf-8" });
    }
  }

  async list(): Promise<{ name: string }[]> {
    return [...this.blobs.keys()].map((name) => ({ name }));
  }

  async read(name: string): Promise<Buffer> {
    const blob = this.blobs.get(name);
    if (!blob) throw new Error(`Missing ${name}`);
    return blob.body;
  }

  async write(name: string, body: Buffer, contentType: string): Promise<void> {
    this.blobs.set(name, { body, contentType });
  }

  async remove(name: string): Promise<void> {
    this.blobs.delete(name);
  }
}

const now = () => new Date("2026-11-07T09:40:00.000Z");

test("scores every file in the incoming container and moves successes to processed", async () => {
  const incoming = new MemoryStore({
    "folder/": "",
    "harper.txt": "Company: Harper Stores\nCustomer: The refund never arrived.",
    "empty.txt": "  \n",
    "../outside.txt": "Customer: Really pleased.",
  });
  const processed = new MemoryStore({
    "stay.txt": "leave me",
    "results/old.json": "{}",
  });

  const summary = await scoreIncoming(incoming, processed, now);

  assert.deepEqual(summary.scored, ["harper.txt"]);
  assert.equal(incoming.blobs.has("harper.txt"), false);
  assert.equal(processed.blobs.get("harper.txt")?.body.toString(), "Company: Harper Stores\nCustomer: The refund never arrived.");
  assert.equal(processed.blobs.get("stay.txt")?.body.toString(), "leave me");
  assert.equal(processed.blobs.has("results/old.json"), true);
  assert.equal(incoming.blobs.has("folder/"), true);

  const result = JSON.parse(processed.blobs.get("results/harper.txt.json")?.body.toString() ?? "") as {
    file: string;
    sentiment: string;
    mix: { positive: number; neutral: number; negative: number };
    nps: number | null;
    npsBand: string | null;
    reason: string | null;
    evidence: string;
    company: string;
    scoredAt: string;
  };
  assert.equal(result.file, "harper.txt");
  assert.equal(result.sentiment, "negative");
  assert.deepEqual(result.mix, { positive: 0, neutral: 0, negative: 100 });
  assert.equal(result.nps, null);
  assert.equal(result.npsBand, null);
  assert.equal(result.reason, null);
  assert.equal(result.evidence, "The refund never arrived.");
  assert.equal(result.company, "Harper Stores");
  assert.equal(result.scoredAt, "2026-11-07T09:40:00.000Z");
  assert.equal(processed.blobs.get("results/harper.txt.json")?.contentType, "application/json; charset=utf-8");
  assert.equal(processed.blobs.has("results/harper.txt.error.json"), false);

  assert.equal(incoming.blobs.has("empty.txt"), true);
  assert.equal(processed.blobs.has("results/empty.txt.json"), false);
  const error = JSON.parse(processed.blobs.get("results/empty.txt.error.json")?.body.toString() ?? "") as {
    file: string;
    error: string;
    failedAt: string;
  };
  assert.equal(error.file, "empty.txt");
  assert.match(error.error, /empty/i);
  assert.equal(error.failedAt, "2026-11-07T09:40:00.000Z");
  assert.equal(summary.failed.some((item) => item.file === "empty.txt"), true);
  assert.equal(incoming.blobs.has("../outside.txt"), true);
  assert.equal([...processed.blobs.keys()].some((name) => name.includes("..")), false);
});

test("a failed move leaves the file in incoming and writes the error beside the result", async () => {
  const incoming = new MemoryStore({
    "call.txt": "NPS: 2\nCustomer: The refund never arrived.",
  });
  const processed = new MemoryStore();
  const blocked: TranscriptStore = {
    list: () => processed.list(),
    read: (name) => processed.read(name),
    async write(name, body, contentType) {
      if (!name.startsWith("results/")) throw new Error("copy failed");
      await processed.write(name, body, contentType);
    },
    remove: (name) => processed.remove(name),
  };

  const summary = await scoreIncoming(incoming, blocked, now);

  assert.deepEqual(summary.scored, []);
  assert.deepEqual(summary.failed, [{ file: "call.txt", error: "copy failed" }]);
  assert.equal(incoming.blobs.has("call.txt"), true);
  assert.equal(processed.blobs.has("call.txt"), false);
  const result = JSON.parse(processed.blobs.get("results/call.txt.json")?.body.toString() ?? "") as {
    nps: number;
    npsBand: string;
    reason: string;
  };
  assert.equal(result.nps, 2);
  assert.equal(result.npsBand, "detractor");
  assert.equal(result.reason, "A refund that is missing or short");
  const error = JSON.parse(processed.blobs.get("results/call.txt.error.json")?.body.toString() ?? "") as { error: string };
  assert.equal(error.error, "copy failed");
});

test("a later success clears the error beside the result", async () => {
  const incoming = new MemoryStore({
    "call.txt": "Customer: Really pleased.",
  });
  const processed = new MemoryStore({
    "results/call.txt.error.json": JSON.stringify({ file: "call.txt", error: "old", failedAt: "2020-01-01T00:00:00.000Z" }),
  });
  const summary = await scoreIncoming(incoming, processed, now);
  assert.deepEqual(summary.scored, ["call.txt"]);
  assert.equal(incoming.blobs.has("call.txt"), false);
  assert.equal(processed.blobs.has("results/call.txt.error.json"), false);
  assert.equal(processed.blobs.has("results/call.txt.json"), true);
  assert.equal(processed.blobs.has("call.txt"), true);
});

test("a blob that cannot be scored stays in incoming and gets an error file", async () => {
  const incoming = new MemoryStore({ "empty.txt": "  \n" });
  const processed = new MemoryStore();
  const outcome = await scoreOne(incoming, processed, "empty.txt", Buffer.from("  \n"), now);
  assert.equal(outcome.status, "failed");
  assert.equal(incoming.blobs.has("empty.txt"), true);
  assert.equal(processed.blobs.has("empty.txt"), false);
  const error = JSON.parse(processed.blobs.get("results/empty.txt.error.json")?.body.toString() ?? "") as { error: string };
  assert.match(error.error, /empty/i);
});

test("a store failure leaves the transcript in incoming", async () => {
  const incoming = new MemoryStore({ "call.txt": "Customer: Really pleased." });
  const processed = new MemoryStore();
  const outcome = await scoreOne(incoming, processed, "call.txt", Buffer.from("Customer: Really pleased."), now, async () => {
    throw new Error("Sentiment pulse store is full.");
  });
  assert.equal(outcome.status, "failed");
  assert.equal(incoming.blobs.has("call.txt"), true);
  assert.equal(processed.blobs.has("call.txt"), false);
  const error = JSON.parse(processed.blobs.get("results/call.txt.error.json")?.body.toString() ?? "") as { error: string };
  assert.match(error.error, /store is full/);
});

test("transcript names are the blob names in the container", () => {
  assert.equal(transcriptName("team/call.txt"), "team/call.txt");
  assert.throws(() => transcriptName("../call.txt"), /not a file/);
  assert.throws(() => transcriptName("team/../call.txt"), /not a file/);
  assert.throws(() => transcriptName(""), /not a file/);
});
