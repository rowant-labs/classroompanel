import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export type ModelRole = 'tutor' | 'blackboard' | 'fast';

export type RoutedModel = {
  model: LanguageModel;
  provider: 'anthropic' | 'openai' | 'google';
  modelId: string;
  role: ModelRole;
};

const defaultModels: Record<ModelRole, string[]> = {
  tutor: [
    'anthropic:claude-opus-4-8',
    'anthropic:claude-sonnet-4-6',
    'google:gemini-2.5-pro',
    'google:gemini-2.5-flash',
  ],
  blackboard: [
    'anthropic:claude-sonnet-4-6',
    'google:gemini-2.5-flash',
    'anthropic:claude-opus-4-8',
    'google:gemini-2.5-pro',
  ],
  fast: [
    'anthropic:claude-haiku-4-5',
    'google:gemini-2.5-flash',
    'anthropic:claude-sonnet-4-6',
  ],
};

const envOverride: Record<ModelRole, string | undefined> = {
  tutor: process.env.CLASSROOMPANEL_TUTOR_MODEL,
  blackboard: process.env.CLASSROOMPANEL_BLACKBOARD_MODEL,
  fast: process.env.CLASSROOMPANEL_FAST_MODEL,
};

function hasProviderKey(provider: string) {
  if (provider === 'anthropic') return Boolean(process.env.ANTHROPIC_API_KEY);
  if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  if (provider === 'google') return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY);
  return false;
}

function toModel(provider: RoutedModel['provider'], modelId: string): LanguageModel {
  if (provider === 'anthropic') return anthropic(modelId);
  if (provider === 'openai') return openai(modelId);
  return google(modelId);
}

export function getRoutedModel(role: ModelRole): RoutedModel | null {
  return getRoutedModels(role)[0] ?? null;
}

export function getRoutedModels(role: ModelRole): RoutedModel[] {
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
    if (!hasProviderKey(provider)) continue;

    routedModels.push({
      model: toModel(provider, modelId),
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

export function getImageModelCandidates(): ImageModelCandidate[] {
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
    if (!hasProviderKey(provider)) continue;
    out.push({ provider, modelId });
  }

  return out;
}

export function modelStatus() {
  return {
    keys: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY),
    },
    defaults: defaultModels,
    overrides: envOverride,
    imageModels: getImageModelCandidates().map((candidate) => `${candidate.provider}:${candidate.modelId}`),
  };
}
