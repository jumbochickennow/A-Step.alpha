interface TestEnv extends WorkerEnv {
  TEST_MIGRATIONS: import('@cloudflare/vitest-plugin').D1Migration[];
}

declare module 'cloudflare:workers' {
  interface ProvidedEnv extends TestEnv {}
}
