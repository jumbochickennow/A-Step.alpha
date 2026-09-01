export type Env = Cloudflare.Env;

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}
