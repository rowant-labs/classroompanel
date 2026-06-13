import { buildDigest, splitIntoPseudoPages, DEFAULT_DIGEST_BUDGET_CHARS } from '../lib/curriculum-ingest';

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label);
}

function syntheticPage(n: number, length = 1500): string {
  const seed = `Page ${n} of the synthetic textbook. Chapter material about topic ${n}. `;
  return seed.repeat(Math.ceil(length / seed.length)).slice(0, length);
}

// --- Budget is respected, even when it is far smaller than the input ---
const bigBook = Array.from({ length: 900 }, (_, i) => syntheticPage(i + 1));
for (const budget of [1_000, 50_000, DEFAULT_DIGEST_BUDGET_CHARS]) {
  const digest = buildDigest(bigBook, budget);
  assert(digest.length <= budget, `digest (${digest.length} chars) must not exceed budget ${budget}`);
  assert(digest.length > budget * 0.5, `digest (${digest.length} chars) should actually use budget ${budget}`);
}

// --- Front matter (first pages, e.g. table of contents) is included in full ---
const tocLine = 'Table of Contents: Chapter 1 Kinematics page 10, Chapter 2 Dynamics page 50';
const frontBook = [
  'A Synthetic Course Title Page With Enough Characters To Count',
  tocLine,
  ...Array.from({ length: 198 }, (_, i) => syntheticPage(i + 3)),
];
const frontDigest = buildDigest(frontBook);
assert(frontDigest.includes(tocLine), 'front-matter table of contents must appear verbatim');
assert(frontDigest.startsWith('[p.1] '), 'digest must start with the first page marker');

// --- Late pages carry [p.N] markers so the model can cite structure ---
assert(frontDigest.includes('[p.150] '), 'page 150 must be sampled with its marker');
assert(frontDigest.includes(`[p.${frontBook.length}] `), 'the last page must be sampled with its marker');

// --- Sampled pages contribute their leading text ---
const page150Lead = syntheticPage(150).slice(0, 40);
assert(frontDigest.includes(page150Lead), 'sample must be the leading text of the page');

// --- Near-empty pages are skipped ---
const gappyBook = [
  ...Array.from({ length: 20 }, (_, i) => syntheticPage(i + 1)),
  'too short', // page 21: under the 40-char floor
  ...Array.from({ length: 20 }, (_, i) => syntheticPage(i + 22)),
];
const gappyDigest = buildDigest(gappyBook);
assert(!gappyDigest.includes('[p.21]'), 'a near-empty page must be skipped');
assert(gappyDigest.includes('[p.22] '), 'pages after a skipped page must still be sampled');

// --- Whitespace is collapsed ---
const messy = ['alpha\n\n   beta\t\tgamma ' + 'x'.repeat(60)];
assert(buildDigest(messy).includes('alpha beta gamma'), 'whitespace must be collapsed to single spaces');

// --- Small inputs work: fewer pages than the front-matter window ---
const tinyDigest = buildDigest(['Photosynthesis converts light energy into chemical energy in plants.']);
assert(tinyDigest.includes('Photosynthesis converts light energy'), 'single-page input must survive');
assert(tinyDigest.startsWith('[p.1] '), 'single-page input keeps its marker');
assert(buildDigest([]) === '', 'empty input yields an empty digest');

// --- splitIntoPseudoPages covers the whole text in order ---
const longText = Array.from({ length: 4000 }, (_, i) => `word${i}`).join(' ');
const pseudoPages = splitIntoPseudoPages(longText);
assert(pseudoPages.length === Math.ceil(longText.length / 2500), 'pseudo-page count matches 2500-char pages');
assert(pseudoPages.join('') === longText, 'pseudo-pages must reassemble to the original text');
const pseudoDigest = buildDigest(pseudoPages, 30_000);
assert(pseudoDigest.length <= 30_000, 'pseudo-page digest respects budget');
assert(pseudoDigest.includes('word0'), 'pseudo-page digest includes the start of the text');

console.log('Curriculum ingest: all assertions passed.');
