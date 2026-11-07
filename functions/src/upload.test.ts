import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { handleUpload, filesFromBody } from "./uploadServer";
import { uploadThenScore } from "./uploadFiles";
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
const page = readFileSync(resolve(__dirname, "../upload/index.html"), "utf8");

test("the upload page source has no storage key", () => {
  assert.doesNotMatch(page, /AccountKey|DefaultEndpointsProtocol|SharedAccessSignature|AccountName=/i);
  assert.equal(page.includes("SORTED_STORAGE_CONNECTION_STRING"), false);
  assert.match(page, /incomingtranscripts/);
  assert.match(page, /processedtranscripts/);
});

test("uploads a transcript and the existing scorer moves it", async () => {
  const incoming = new MemoryStore();
  const processed = new MemoryStore();
  const summary = await uploadThenScore(
    incoming,
    processed,
    [{ name: "notes/harper.txt", bytes: Buffer.from("Customer: The refund never arrived."), contentType: "text/plain" }],
    now,
  );
  assert.deepEqual(summary.uploaded, ["harper.txt"]);
  assert.deepEqual(summary.rejected, []);
  assert.deepEqual(summary.scored, ["harper.txt"]);
  assert.equal(incoming.blobs.has("harper.txt"), false);
  assert.equal(processed.blobs.get("harper.txt")?.body.toString(), "Customer: The refund never arrived.");
  const result = JSON.parse(processed.blobs.get("results/harper.txt.json")?.body.toString() ?? "") as { nps: number | null; evidence: string };
  assert.equal(result.nps, null);
  assert.equal(result.evidence, "The refund never arrived.");
});

test("a rejected file is not stored and does not block a good one", async () => {
  const incoming = new MemoryStore();
  const processed = new MemoryStore();
  const summary = await uploadThenScore(
    incoming,
    processed,
    [
      { name: "..", bytes: Buffer.from("Customer: Really pleased."), contentType: "text/plain" },
      { name: "photo.png", bytes: Buffer.from("nope"), contentType: "image/png" },
      { name: "notes/../call.txt", bytes: Buffer.from("NPS: 9\nCustomer: Really pleased."), contentType: "" },
    ],
    now,
  );
  assert.deepEqual(summary.uploaded, ["call.txt"]);
  assert.equal(summary.rejected.length, 2);
  assert.equal(incoming.blobs.has("../secret.txt"), false);
  assert.equal(processed.blobs.has("../call.txt"), false);
  assert.equal(processed.blobs.has("call.txt"), true);
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

  const upload = await handleUpload("POST", "/upload", body, {
    page,
    upload: async (files) => {
      assert.equal(files[0]?.name, "call.txt");
      return { uploaded: ["call.txt"], rejected: [], scored: ["call.txt"], failed: [] };
    },
  });
  assert.equal(upload.status, 200);
  assert.deepEqual(JSON.parse(upload.body), { uploaded: ["call.txt"], rejected: [], scored: ["call.txt"], failed: [] });

  const missing = await handleUpload("GET", "/scoring", Buffer.alloc(0), { page, upload: async () => ({ uploaded: [], rejected: [], scored: [], failed: [] }) });
  assert.equal(missing.status, 404);
});
