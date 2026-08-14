// Browser side of BYOK: keys live in localStorage on the visitor's machine and
// are attached to generation requests as headers. Reading storage at call time
// (not hook-mount time) means a just-saved key applies to the very next request.

import { PROVIDERS, PROVIDER_KEY_HEADERS, sanitizeProviderKey, type ProviderKeys } from './provider-keys';

export const BYOK_STORAGE_KEY = 'classroompanel.keys.v1';

export function loadByokKeys(): ProviderKeys {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(BYOK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const keys: ProviderKeys = {};
    for (const provider of PROVIDERS) {
      const key = sanitizeProviderKey(parsed[provider]);
      if (key) keys[provider] = key;
    }
    return keys;
  } catch {
    return {};
  }
}

export function saveByokKeys(keys: ProviderKeys): ProviderKeys {
  const cleaned: ProviderKeys = {};
  for (const provider of PROVIDERS) {
    const key = sanitizeProviderKey(keys[provider]);
    if (key) cleaned[provider] = key;
  }
  if (typeof window !== 'undefined') {
    try {
      if (Object.keys(cleaned).length === 0) window.localStorage.removeItem(BYOK_STORAGE_KEY);
      else window.localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(cleaned));
    } catch {
      // storage full — keys just won't persist across reloads
    }
  }
  return cleaned;
}

export function byokHeaders(): Record<string, string> {
  const keys = loadByokKeys();
  const headers: Record<string, string> = {};
  for (const provider of PROVIDERS) {
    const key = keys[provider];
    if (key) headers[PROVIDER_KEY_HEADERS[provider]] = key;
  }
  return headers;
}

// Merge BYOK headers into a RequestInit without clobbering existing ones.
export function withByokHeaders(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  for (const [name, value] of Object.entries(byokHeaders())) {
    headers.set(name, value);
  }
  return { ...init, headers };
}

// Drop-in fetch for hooks that accept a fetch override (useObject).
export const byokFetch: typeof fetch = (input, init) => fetch(input, withByokHeaders(init));
