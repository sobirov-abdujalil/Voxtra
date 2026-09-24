export interface ServerConfig {
  port: number;
  corsOrigin: string;
  assemblyApiKey: string | undefined;
  assemblyTokenUrl: string;
  gitCommit?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 3001),
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
    assemblyApiKey: env.ASSEMBLYAI_API_KEY || undefined,
    assemblyTokenUrl: 'https://agents.assemblyai.com/v1/token',
    gitCommit: env.GIT_COMMIT ?? 'unknown',
  };
}
