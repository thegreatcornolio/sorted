import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import type { CallJudgment } from "./openai";
import { scoreOne } from "./run";
import { handleUpload, filesFromBody } from "./uploadServer";
import { uploadFiles, watchTranscript } from "./uploadFiles";
import type { TranscriptStore } from "./store";

type Blob = { body: Buffer; contentType: string };

class MemoryStore implements TranscriptStore {
  blobs = new Map<string, Blob>();

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

const now = () => new Date("2026-11-07T10:30:00.000Z");

function refundJudgment(): CallJudgment {
  return {
    predicted_nps: 2,
    nps_category: "detractor",
    sentiment_start: "negative",
    sentiment_end: "negative",
    resolved: false,
    csat: 1,
    primary_reason: "The refund never arrived.",
    evidence: "The refund never arrived.",
    summary: "The refund was still missing at the end of the call.",
    vulnerable: false,
    vulnerability_reason: "",
    next_step: "",
  };
}

function pleasedJudgment(): CallJudgment {
  return {
    predicted_nps: 10,
    nps_category: "promoter",
    sentiment_start: "positive",
    sentiment_end: "positive",
    resolved: true,
    csat: 5,
    primary_reason: "They were pleased with the call.",
    evidence: "Really pleased with the call.",
    summary: "The caller was pleased at the end.",
    vulnerable: false,
    vulnerability_reason: "",
    next_step: "",
  };
}
const page = readFileSync(resolve(__dirname, "../upload/index.html"), "utf8");

test("the upload page source has no storage key", () => {
  assert.doesNotMatch(page, /AccountKey|DefaultEndpointsProtocol|SharedAccessSignature|AccountName=/i);
  assert.equal(page.includes("SORTED_STORAGE_CONNECTION_STRING"), false);
  assert.match(page, /incomingtranscripts/);
  assert.match(page, /processedtranscripts/);
  assert.doesNotMatch(page, />\s*Process\s*</);
});

test("upload only stores the file until the blob trigger scores it", async () => {
  const incoming = new MemoryStore();
  const processed = new MemoryStore();
  const summary = await uploadFiles(incoming, [
    { name: "notes/harper.txt", bytes: Buffer.from("Customer: The refund never arrived."), contentType: "text/plain" },
  ]);
  assert.deepEqual(summary.uploaded, ["harper.txt"]);
  assert.deepEqual(summary.rejected, []);
  assert.equal(incoming.blobs.has("harper.txt"), true);
  assert.equal(processed.blobs.has("harper.txt"), false);
  assert.deepEqual(await watchTranscript(incoming, processed, "harper.txt"), {
    file: "harper.txt",
    state: "processing",
    error: null,
    result: null,
  });

  const outcome = await scoreOne(
    incoming,
    processed,
    "harper.txt",
    incoming.blobs.get("harper.txt")!.body,
    now,
    undefined,
    async () => refundJudgment(),
  );
  assert.equal(outcome.status, "scored");
  assert.equal(incoming.blobs.has("harper.txt"), false);
  const progress = await watchTranscript(incoming, processed, "harper.txt");
  assert.equal(progress.state, "scored");
  const result = progress.result as { nps: number | null; evidence: string };
  assert.equal(result.nps, null);
  assert.equal(result.evidence, "The refund never arrived.");
});

test("a rejected file is not stored and does not block a good one", async () => {
  const incoming = new MemoryStore();
  const processed = new MemoryStore();
  const summary = await uploadFiles(incoming, [
    { name: "..", bytes: Buffer.from("Customer: Really pleased."), contentType: "text/plain" },
    { name: "photo.png", bytes: Buffer.from("nope"), contentType: "image/png" },
    { name: "notes/../call.txt", bytes: Buffer.from("NPS: 9\nCustomer: Really pleased with the call."), contentType: "" },
  ]);
  assert.deepEqual(summary.uploaded, ["call.txt"]);
  assert.equal(summary.rejected.length, 2);
  assert.equal(incoming.blobs.has("call.txt"), true);
  assert.equal(processed.blobs.has("call.txt"), false);
  const outcome = await scoreOne(
    incoming,
    processed,
    "call.txt",
    incoming.blobs.get("call.txt")!.body,
    now,
    undefined,
    async () => pleasedJudgment(),
  );
  assert.equal(outcome.status, "scored");
  const result = JSON.parse(processed.blobs.get("results/call.txt.json")?.body.toString() ?? "") as { npsBand: string };
  assert.equal(result.npsBand, "promoter");
});

test("the local page posts files and does not embed them in the site", async () => {
  const body = Buffer.from(
    JSON.stringify({
      files: [{ name: "call.txt", contentType: "text/plain", body: Buffer.from("Customer: Really pleased.").toString("base64") }],
    }),
  );
  const posted = filesFromBody(body);
  assert.equal(posted[0]?.name, "call.txt");
  assert.equal(posted[0]?.bytes.toString(), "Customer: Really pleased.");

  const home = await handleUpload("GET", "/", Buffer.alloc(0), { page, upload: async () => ({ uploaded: [], rejected: [], scored: [], failed: [] }) });
  assert.equal(home.status, 200);
  assert.equal(home.body, page);

  const idle = { page, upload: async () => ({ uploaded: [], rejected: [] }), status: async () => ({ file: "", state: "processing" as const, error: null, result: null }) };
  const upload = await handleUpload("POST", "/upload", body, {
    ...idle,
    upload: async (files) => {
      assert.equal(files[0]?.name, "call.txt");
      return { uploaded: ["call.txt"], rejected: [] };
    },
  });
  assert.equal(upload.status, 200);
  assert.deepEqual(JSON.parse(upload.body), { uploaded: ["call.txt"], rejected: [] });

  const status = await handleUpload("GET", "/status?name=call.txt", Buffer.alloc(0), {
    ...idle,
    status: async (name) => ({ file: name, state: "processing", error: null, result: null }),
  });
  assert.equal(status.status, 200);
  assert.deepEqual(JSON.parse(status.body), { file: "call.txt", state: "processing", error: null, result: null });

  const missing = await handleUpload("GET", "/scoring", Buffer.alloc(0), idle);
  assert.equal(missing.status, 404);
});
