/**
 * AssemblyAI Voice Agent token integration (server-side only).
 *
 * Verified against official docs (Sep 2026):
 * - Server mints a one-time temporary token:
 *   GET https://agents.assemblyai.com/v1/token?expires_in_seconds=300
 *   with header `Authorization: Bearer <ASSEMBLYAI_API_KEY>`
 *   -> { token, expires_in_seconds }
 * - Browser opens wss://agents.assemblyai.com/v1/ws?token=<token>
 *   and sends `session.update` first. The raw API key never leaves the server.
 */
export interface TokenResult {
  token: string;
  expires_in_seconds: number;
}

export async function mintVoiceToken(
  apiKey: string,
  tokenUrl: string,
  expiresInSeconds = 300,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenResult> {
  const url = `${tokenUrl}?expires_in_seconds=${expiresInSeconds}`;
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`AssemblyAI token request failed with status ${res.status}`);
  }
  const body = (await res.json()) as TokenResult;
  if (typeof body.token !== 'string' || body.token.length === 0) {
    throw new Error('AssemblyAI token response missing token');
  }
  return body;
}
