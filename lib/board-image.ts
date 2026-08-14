// Board image generation: turns an image block's prompt into a real picture.
// Pure helpers (style framing, cache key) live here so they can be tested;
// generation is only called from the /api/board-image route (Node runtime).

import { createHash } from 'node:crypto';
import { generateText, generateImage } from 'ai';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { getImageModelCandidates } from './model-router';
import type { ProviderKeys } from './provider-keys';

export type BoardImageStyle = 'photo' | 'illustration' | 'diagram' | 'cutaway' | 'map';

export const BOARD_IMAGE_STYLES: BoardImageStyle[] = ['photo', 'illustration', 'diagram', 'cutaway', 'map'];

// Every style shares the same framing so pictures feel like they belong on the
// blackboard: one clear subject, dark-friendly, no embedded text (the board
// itself does the labeling via caption and look-for chips).
const styleFraming: Record<BoardImageStyle, string> = {
  photo: 'A clear, well-lit photographic image with a single obvious subject, neutral dark background, shallow depth of field.',
  illustration: 'A clean, friendly educational illustration with simple shapes and a limited warm palette, on a dark slate background.',
  diagram: 'A precise scientific diagram showing structure clearly, flat colors with strong outlines, on a dark slate background.',
  cutaway: 'A cutaway or cross-section view revealing the inside structure, clean edges, flat colors with strong outlines, on a dark slate background.',
  map: 'A simple, uncluttered map with clear region shapes and high contrast, minimal detail outside the area of interest, on a dark slate background.',
};

export function buildImagePrompt(prompt: string, style?: string): string {
  const framing = styleFraming[(style as BoardImageStyle) ?? 'illustration'] ?? styleFraming.illustration;
  return `${framing}\n\nSubject: ${prompt.trim()}\n\nThis image is for a classroom blackboard lesson. Show exactly one teaching-worthy visual. Do not include any text, labels, captions, watermarks, or arrows in the image itself.`;
}

export function imageCacheKey(prompt: string, style?: string): string {
  const normalized = `${style ?? 'auto'}|${prompt.trim().toLowerCase().replace(/\s+/g, ' ')}`;
  return createHash('sha256').update(normalized).digest('hex').slice(0, 40);
}

export type GeneratedBoardImage = {
  bytes: Uint8Array;
  mediaType: string;
  model: string;
};

export async function generateBoardImage(prompt: string, style?: string, keys?: ProviderKeys): Promise<GeneratedBoardImage> {
  const candidates = getImageModelCandidates(keys);
  if (candidates.length === 0) {
    throw new ImageGenerationUnavailableError();
  }

  const googleProvider = keys?.google ? createGoogleGenerativeAI({ apiKey: keys.google }) : google;
  const openaiProvider = keys?.openai ? createOpenAI({ apiKey: keys.openai }) : openai;
  const fullPrompt = buildImagePrompt(prompt, style);
  const failures: string[] = [];

  for (const candidate of candidates) {
    const label = `${candidate.provider}:${candidate.modelId}`;
    try {
      if (candidate.provider === 'google') {
        // Gemini image models emit pictures as files on a text generation call.
        const result = await generateText({
          model: googleProvider(candidate.modelId),
          prompt: fullPrompt,
          providerOptions: { google: { responseModalities: ['TEXT', 'IMAGE'] } },
        });
        const image = result.files.find((file) => file.mediaType?.startsWith('image/'));
        if (!image) throw new Error('Gemini returned no image file.');
        return { bytes: image.uint8Array, mediaType: image.mediaType, model: label };
      }

      const result = await generateImage({
        model: openaiProvider.image(candidate.modelId),
        prompt: fullPrompt,
        size: '1024x1024',
      });
      return { bytes: result.image.uint8Array, mediaType: result.image.mediaType ?? 'image/png', model: label };
    } catch (error) {
      failures.push(label);
      console.warn(`Board image generation failed with ${label}`, error);
    }
  }

  throw new Error(`Board image generation failed (${failures.join(', ')}).`);
}

export class ImageGenerationUnavailableError extends Error {
  constructor() {
    super('No image-capable provider configured.');
    this.name = 'ImageGenerationUnavailableError';
  }
}
