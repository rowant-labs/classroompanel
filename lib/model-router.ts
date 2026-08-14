import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { openai, createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { ProviderKeys } from './provider-keys';

export type ModelRole = 'tutor' | 'blackboard' | 'fast';

export type RoutedModel = {
  model: LanguageModel;
  provider: 'anthropic' | 'openai' | 'google';
  modelId: string;
  role: ModelRole;
};

// Model ids verified 2026-08-14 (Anthropic docs; Gemini 3.6 Flash GA 2026-07-21;
// GPT-5.6 family GA 2026-07-09). Order is preference within a provider-keyed
// pool; the router skips any provider without a key. Older-generation entries
// stay as deep fallbacks. Self-hosters can override via CLASSROOMPANEL_*_MODEL.
const defaultModels: Record<ModelRole, string[]> = {
  tutor: [
    'anthropic:claude-opus-5',
    'anthropic:claude-sonnet-5',
    'google:gemini-3.6-flash',
    'google:gemini-2.5-pro',
    'openai:gpt-5.6-sol',
  ],
  blackboard: [
    'anthropic:claude-sonnet-5',
    'google:gemini-3.6-flash',
    'anthropic:claude-opus-5',
    'google:gemini-2.5-flash',
    'openai:gpt-5.6-terra',
  ],
  fast: [
    'anthropic:claude-haiku-4-5',
    'google:gemini-2.5-flash',
    'openai:gpt-5.6-luna',
    'anthropic:claude-sonnet-5',
  ],
};

const envOverride: Record<ModelRole, string | undefined> = {
  tutor: process.env.CLASSROOMPANEL_TUTOR_MODEL,
  blackboard: process.env.CLASSROOMPANEL_BLACKBOARD_MODEL,
  fast: process.env.CLASSROOMPANEL_FAST_MODEL,
};

// A provider is usable when the server has its env key OR the request carried
// a visitor's own key (BYOK). The visitor's key wins so their spend is theirs.
function hasProviderKey(provider: string, keys?: ProviderKeys) {
  if (provider === 'anthropic') return Boolean(keys?.anthropic || process.env.ANTHROPIC_API_KEY);
  if (provider === 'openai') return Boolean(keys?.openai || process.env.OPENAI_API_KEY);
  if (provider === 'google') return Boolean(keys?.google || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY);
  return false;
}

function toModel(provider: RoutedModel['provider'], modelId: string, keys?: ProviderKeys): LanguageModel {
  if (provider === 'anthropic') return keys?.anthropic ? createAnthropic({ apiKey: keys.anthropic })(modelId) : anthropic(modelId);
  if (provider === 'openai') return keys?.openai ? createOpenAI({ apiKey: keys.openai })(modelId) : openai(modelId);
  return keys?.google ? createGoogleGenerativeAI({ apiKey: keys.google })(modelId) : google(modelId);
}

export function getRoutedModel(role: ModelRole, keys?: ProviderKeys): RoutedModel | null {
  return getRoutedModels(role, keys)[0] ?? null;
}

export function getRoutedModels(role: ModelRole, keys?: ProviderKeys): RoutedModel[] {
  const candidates = [envOverride[role], ...defaultModels[role]].filter(Boolean) as string[];
  const routedModels: RoutedModel[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    const [provider, ...modelParts] = candidate.split(':');
    const modelId = modelParts.join(':');

    if (!provider || !modelId) continue;
    if (provider !== 'anthropic' && provider !== 'openai' && provider !== 'google') continue;
    if (!hasProviderKey(provider, keys)) continue;

    routedModels.push({
      model: toModel(provider, modelId, keys),
      provider,
      modelId,
      role,
    });
  }

  return routedModels;
}

// Image generation lives outside the LanguageModel routing above: Gemini's
// image model goes through generateText with image response modality, while
// OpenAI's go through the dedicated image API. The route picks the call style
// per provider, so the router only resolves which candidates have live keys.
export type ImageModelCandidate = {
  provider: 'google' | 'openai';
  modelId: string;
};

const defaultImageModels = [
  'google:gemini-2.5-flash-image',
  'openai:gpt-image-1',
  'openai:dall-e-3',
];

export function getImageModelCandidates(keys?: ProviderKeys): ImageModelCandidate[] {
  const candidates = [process.env.CLASSROOMPANEL_IMAGE_MODEL, ...defaultImageModels].filter(Boolean) as string[];
  const out: ImageModelCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    const [provider, ...modelParts] = candidate.split(':');
    const modelId = modelParts.join(':');
    if (!modelId) continue;
    if (provider !== 'google' && provider !== 'openai') continue;
    if (!hasProviderKey(provider, keys)) continue;
    out.push({ provider, modelId });
  }

  return out;
}

// Reports availability only — never key values, never whether a given value
// came from the env or a header beyond the byok flags the client already knows.
export function modelStatus(keys?: ProviderKeys) {
  return {
    keys: {
      anthropic: hasProviderKey('anthropic', keys),
      openai: hasProviderKey('openai', keys),
      google: hasProviderKey('google', keys),
    },
    byok: {
      anthropic: Boolean(keys?.anthropic),
      openai: Boolean(keys?.openai),
      google: Boolean(keys?.google),
    },
    defaults: defaultModels,
    overrides: envOverride,
    imageModels: getImageModelCandidates(keys).map((candidate) => `${candidate.provider}:${candidate.modelId}`),
  };
}
