// Bring-your-own-key (BYOK): visitors can supply their own provider API keys,
// which ride each generation request as headers and are used for that one call.
// They are NEVER stored or logged server-side — the only persistent copy lives
// in the visitor's own browser (see byok-client.ts).

export type Provider = 'anthropic' | 'openai' | 'google';

export type ProviderKeys = Partial<Record<Provider, string>>;

export const PROVIDER_KEY_HEADERS: Record<Provider, string> = {
  anthropic: 'x-classroompanel-key-anthropic',
  openai: 'x-classroompanel-key-openai',
  google: 'x-classroompanel-key-google',
};

export const PROVIDERS: Provider[] = ['anthropic', 'openai', 'google'];

// Real API keys are short printable-ASCII tokens; anything else is noise (or
// header-smuggling attempts) and gets dropped rather than forwarded upstream.
export function sanitizeProviderKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 256) return undefined;
  if (/[^\x21-\x7e]/.test(trimmed)) return undefined;
  return trimmed;
}

export function keysFromRequest(request: Request): ProviderKeys {
  const keys: ProviderKeys = {};
  for (const provider of PROVIDERS) {
    const key = sanitizeProviderKey(request.headers.get(PROVIDER_KEY_HEADERS[provider]));
    if (key) keys[provider] = key;
  }
  return keys;
}
