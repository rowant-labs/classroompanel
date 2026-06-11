import { buildImagePrompt, imageCacheKey, BOARD_IMAGE_STYLES } from '../lib/board-image';
import { imageBlockSchema, lessonStreamSchema, lessonSchema } from '../lib/lesson-schema';
import { heartLesson } from '../lib/sample-lessons';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// --- prompt framing ---------------------------------------------------------

for (const style of BOARD_IMAGE_STYLES) {
  const prompt = buildImagePrompt('A human heart cross-section', style);
  assert(prompt.includes('A human heart cross-section'), `prompt keeps the subject for style ${style}`);
  assert(/no(t include any)? text/i.test(prompt), `prompt bans embedded text for style ${style}`);
}

const unknownStyle = buildImagePrompt('A volcano', 'oil-painting');
const defaultStyle = buildImagePrompt('A volcano');
assert(unknownStyle === defaultStyle, 'unknown styles fall back to the illustration framing');

// --- cache keys -------------------------------------------------------------

assert(/^[a-f0-9]{40}$/.test(imageCacheKey('A volcano erupting', 'photo')), 'cache key is 40 hex chars');
assert(
  imageCacheKey('  A   Volcano erupting ', 'photo') === imageCacheKey('a volcano erupting', 'photo'),
  'cache key normalizes whitespace and case',
);
assert(
  imageCacheKey('A volcano erupting', 'photo') !== imageCacheKey('A volcano erupting', 'map'),
  'cache key separates styles',
);
assert(
  imageCacheKey('A volcano erupting') !== imageCacheKey('A volcano erupting', 'photo'),
  'cache key separates styled from unstyled prompts',
);

// --- schema -----------------------------------------------------------------

const imageBlock = heartLesson.blocks.find((block) => block.type === 'image');
assert(imageBlock, 'heart fixture carries an image block');
assert(imageBlockSchema.safeParse(imageBlock).success, 'fixture image block matches lenient schema');

const streamLesson = {
  ...heartLesson,
  tutorMessage: 'Let me show you the real thing while we trace the flow.',
};
const streamed = lessonStreamSchema.safeParse(streamLesson);
assert(streamed.success, `heart lesson satisfies the strict stream schema: ${JSON.stringify(!streamed.success && streamed.error.issues)}`);
assert(lessonSchema.safeParse(streamed.success ? streamed.data : null).success, 'strict stream output stays assignable to the lenient lesson schema');

const missingAlt = imageBlockSchema.safeParse({
  id: 'x', type: 'image', title: 't', prompt: 'A long enough prompt here', caption: 'c',
});
assert(!missingAlt.success, 'image blocks require accessible alt text');

const shortPrompt = imageBlockSchema.safeParse({
  id: 'x', type: 'image', title: 't', prompt: 'too short', alt: 'a fine alt text', caption: 'c',
});
assert(!shortPrompt.success, 'image blocks reject prompts too short to draw from');

console.log('Validated board image prompts, cache keys, and image block schema.');
