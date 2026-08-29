export type Env = WorkerEnv;

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}
