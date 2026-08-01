interface R2ObjectBody {
  body: ReadableStream<Uint8Array>;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ExportedHandler<Env = unknown> {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>;
}
