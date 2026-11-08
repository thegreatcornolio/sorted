export type TranscriptStore = {
  list(): Promise<{ name: string }[]>;
  read(name: string): Promise<Buffer>;
  write(name: string, body: Buffer, contentType: string): Promise<void>;
  remove(name: string): Promise<void>;
};
