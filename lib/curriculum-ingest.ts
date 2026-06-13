// Turns a long document (hundreds of pages of extracted PDF text, or a large
// pasted/text file split into pseudo-pages) into a bounded digest the course
// generator can read: full front matter (title pages + table of contents)
// followed by the leading text of every remaining page, each tagged [p.N] so
// the model can reconstruct the document's structure.

export const DEFAULT_DIGEST_BUDGET_CHARS = 240_000;
export const PSEUDO_PAGE_CHARS = 2_500;

const FRONT_MATTER_PAGES = 12;
const FRONT_MATTER_CAP_CHARS = 30_000;
const MIN_PAGE_CHARS = 40;
const MIN_SAMPLE_CHARS = 150;
const MAX_SAMPLE_CHARS = 600;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Split a long flat text into pseudo-pages so buildDigest can sample it evenly. */
export function splitIntoPseudoPages(text: string, pageChars: number = PSEUDO_PAGE_CHARS): string[] {
  const pages: string[] = [];
  for (let offset = 0; offset < text.length; offset += pageChars) {
    pages.push(text.slice(offset, offset + pageChars));
  }
  return pages;
}

/**
 * Build a digest of per-page texts that never exceeds budgetChars:
 * - the first ~12 pages nearly in full (capped) — front matter and table of contents;
 * - then the leading text of every remaining page, with a per-page allowance
 *   computed from the remaining budget (clamped to a useful range), each
 *   prefixed with a [p.N] marker. Near-empty pages are skipped.
 */
export function buildDigest(pages: string[], budgetChars: number = DEFAULT_DIGEST_BUDGET_CHARS): string {
  const collapsed = pages.map(collapseWhitespace);
  const parts: string[] = [];
  // Track length as if every part costs its text plus one newline separator,
  // which slightly overestimates the joined length — safely under budget.
  let used = 0;

  const push = (piece: string) => {
    parts.push(piece);
    used += piece.length + 1;
  };

  // Front matter: the opening pages in (nearly) full, for title + table of contents.
  const frontPageCount = Math.min(FRONT_MATTER_PAGES, collapsed.length);
  let frontUsed = 0;
  // Where rest-sampling should start: if the front-matter cap breaks early, the
  // unvisited front pages (often a multi-page table of contents) still get sampled.
  let frontEnd = frontPageCount;
  for (let i = 0; i < frontPageCount; i++) {
    const text = collapsed[i];
    if (text.length < MIN_PAGE_CHARS) continue;
    const marker = `[p.${i + 1}] `;
    const room = Math.min(FRONT_MATTER_CAP_CHARS - frontUsed, budgetChars - used) - marker.length - 1;
    if (room < MIN_PAGE_CHARS) {
      frontEnd = i;
      break;
    }
    const body = text.slice(0, room);
    push(marker + body);
    frontUsed += marker.length + body.length;
  }

  // Sample the leading text of the remaining pages so the whole document's
  // scope — first chapter to last — is visible to the model.
  const restIndexes: number[] = [];
  for (let i = frontEnd; i < collapsed.length; i++) {
    if (collapsed[i].length >= MIN_PAGE_CHARS) restIndexes.push(i);
  }

  if (restIndexes.length > 0) {
    const remaining = Math.max(0, budgetChars - used);
    // If the budget can't give every page a minimum-size sample, keep a strided
    // subset (always including the last page) instead of dropping the tail —
    // coverage must stay end-to-end for the model to see the whole document.
    let sampled = restIndexes;
    const maxSampledPages = Math.floor(remaining / MIN_SAMPLE_CHARS);
    if (maxSampledPages > 0 && maxSampledPages < restIndexes.length) {
      const stride = Math.ceil(restIndexes.length / maxSampledPages);
      sampled = restIndexes.filter((_, position) => position % stride === 0);
      const lastIndex = restIndexes[restIndexes.length - 1];
      if (sampled[sampled.length - 1] !== lastIndex) sampled.push(lastIndex);
    }
    const perPageAllowance = clamp(
      Math.floor(remaining / sampled.length),
      MIN_SAMPLE_CHARS,
      MAX_SAMPLE_CHARS,
    );
    for (const i of sampled) {
      const marker = `[p.${i + 1}] `;
      const bodyRoom = Math.min(
        perPageAllowance - marker.length - 1,
        budgetChars - used - marker.length - 1,
      );
      if (bodyRoom < MIN_PAGE_CHARS) break; // budget exhausted
      push(marker + collapsed[i].slice(0, bodyRoom));
    }
  }

  return parts.join('\n');
}
