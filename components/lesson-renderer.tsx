'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LessonBlock } from '@/lib/lesson-schema';
import type { LessonView } from '@/lib/lesson-view';
import { compileExpression, numericDerivative, sampleCurve, autoRangeY } from '@/lib/expression';
import { byokHeaders } from '@/lib/byok-client';

// The tutor's read of a say-it-back explanation (from /api/selfexplain).
export type SelfExplainGrade = {
  coveredIndices: number[];
  covered: boolean;
  feedback: string;
};

// Per-do-block interaction state, owned by the workspace so record-keeping
// stays in one place and board switches reset it like the quiz selection.
export type DoBlockState = {
  choice?: number;
  text?: string;
  revealed?: boolean;
  selfMark?: 'covered' | 'missed';
  // Say-it-back grading: true while the tutor reads the answer; the grade
  // replaces the self-mark buttons when it arrives. Absent = self-mark flow.
  grading?: boolean;
  grade?: SelfExplainGrade;
};

type LessonRendererProps = {
  lesson: LessonView;
  selectedAnswer?: number | null;
  onSelectAnswer?: (index: number) => void;
  onReteach?: (index: number) => void;
  doStates?: Record<string, DoBlockState>;
  onPredictCommit?: (block: PredictBlock, choice: number) => void;
  onSelfExplainReveal?: (block: SelfExplainBlock, text: string) => void;
  onSelfExplainMark?: (block: SelfExplainBlock, covered: boolean) => void;
  // Identity of the board VIEW (not the lesson — model-chosen lesson ids are
  // only unique within a lesson, so consecutive boards can collide). Local
  // do-block state like the self-explain draft is keyed on this.
  boardKey?: string;
  isDrawing?: boolean;
};

export function LessonRenderer({
  lesson,
  selectedAnswer = null,
  onSelectAnswer,
  onReteach,
  doStates = {},
  onPredictCommit,
  onSelfExplainReveal,
  onSelfExplainMark,
  boardKey,
  isDrawing = false,
}: LessonRendererProps) {
  const explanation = lesson.blocks.find((block) => block.type === 'explanation');
  const graph = lesson.blocks.find((block) => block.type === 'graph');
  const diagram = lesson.blocks.find((block) => block.type === 'diagram');
  const sketch = lesson.blocks.find((block) => block.type === 'sketch');
  const simulation = lesson.blocks.find((block) => block.type === 'simulation');
  const freeBody = lesson.blocks.find((block) => block.type === 'freeBody');
  const equation = lesson.blocks.find((block) => block.type === 'equation');
  const image = lesson.blocks.find((block) => block.type === 'image');
  const steps = lesson.blocks.find((block) => block.type === 'steps');
  const quiz = lesson.blocks.find((block) => block.type === 'quiz');
  const predict = lesson.blocks.find((block) => block.type === 'predict');
  const selfExplain = lesson.blocks.find((block) => block.type === 'selfExplain');

  // Which block owns the big visual slot; everything else folds into the
  // bottom row so a lesson with several visuals still reads as one board.
  const primaryVisual = freeBody ? 'freeBody' : graph ? 'graph' : image ? 'image' : simulation ? 'simulation' : sketch ? 'sketch' : 'diagram';
  const answerState = quiz && selectedAnswer !== null
    ? selectedAnswer === quiz.answerIndex ? 'correct' : 'wrong'
    : 'waiting';

  return (
    <section className={`lesson-blackboard answer-${answerState}`} key={lesson.id}>
      <div className="board-frame">
        <div className="board-rail">
          <span>{lesson.subject}</span>
          <span className={isDrawing ? 'drawing-light is-busy' : 'drawing-light'}>{isDrawing ? 'Drawing' : 'Ready'}</span>
        </div>

        <div className="chalkboard" aria-live="polite">
          <div className="chalk-smudge smudge-one" />
          <div className="chalk-smudge smudge-two" />

          <header className="board-title-group chalk-reveal">
            <span className="chalk-kicker">Today on the board</span>
            <h1>{lesson.title}</h1>
            {lesson.objective && <p>{lesson.objective}</p>}
          </header>

          {predict && predict.type === 'predict' && (
            <PredictPanel
              block={predict}
              state={doStates[predict.id]}
              onCommit={onPredictCommit}
              isDrawing={isDrawing}
            />
          )}

          <div className="board-workspace">
            <section className="chalk-narration chalk-reveal delay-1">
              {explanation && explanation.type === 'explanation' && (
                <>
                  <span className="chalk-kicker">{explanation.eyebrow ?? 'Tutor note'}</span>
                  <h2>{explanation.title}</h2>
                  <p>{explanation.body}</p>
                </>
              )}
              {steps && steps.type === 'steps' && (
                <div className="chalk-steps">
                  <span className="chalk-kicker">{steps.title}</span>
                  <ol>
                    {steps.steps.map((step, index) => (
                      <li key={step} style={{ '--step-delay': `${360 + index * 130}ms` } as CSSProperties}>
                        <span>{index + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {!explanation && !steps && isDrawing && (
                <p className="board-pending">The tutor is writing on the board…</p>
              )}
            </section>

            <section className="chalk-visual chalk-reveal delay-2">
              {freeBody && freeBody.type === 'freeBody' ? (
                <FreeBodyDiagram block={freeBody} />
              ) : graph && graph.type === 'graph' ? (
                <LiveGraph block={graph} />
              ) : image && image.type === 'image' ? (
                <BoardImage block={image} />
              ) : simulation && simulation.type === 'simulation' ? (
                <BoardSimulation block={simulation} />
              ) : sketch && sketch.type === 'sketch' ? (
                <BoardSketch block={sketch} />
              ) : diagram && diagram.type === 'diagram' ? (
                <DiagramSketch title={diagram.title} nodes={diagram.nodes} />
              ) : (
                <DiagramSketch
                  title={isDrawing ? 'Sketching…' : 'Concept map'}
                  nodes={[{ label: lesson.subject, detail: lesson.objective || undefined }, { label: lesson.title }]}
                />
              )}
            </section>
          </div>

          <div className="board-bottom">
            {equation && equation.type === 'equation' && (
              <section className="chalk-equation chalk-reveal delay-3">
                <EquationBoard block={equation} />
              </section>
            )}

            {image && image.type === 'image' && primaryVisual !== 'image' && !equation && (
              <section className="chalk-live-sketch chalk-reveal delay-3">
                <BoardImage block={image} compact />
              </section>
            )}

            {sketch && sketch.type === 'sketch' && primaryVisual !== 'sketch' && !equation && (!image || primaryVisual === 'image') && (
              <section className="chalk-live-sketch chalk-reveal delay-3">
                <BoardSketch block={sketch} compact />
              </section>
            )}

            {!sketch && simulation && simulation.type === 'simulation' && primaryVisual !== 'simulation' && !equation && (!image || primaryVisual === 'image') && (
              <section className="chalk-live-sketch chalk-reveal delay-3">
                <BoardSimulation block={simulation} compact />
              </section>
            )}

            {diagram && diagram.type === 'diagram' && (graph || freeBody || sketch || simulation || image) && (
              <section className="chalk-diagram chalk-reveal delay-3">
                <DiagramSketch title={diagram.title} nodes={diagram.nodes} compact />
              </section>
            )}

            {selfExplain && selfExplain.type === 'selfExplain' && (
              <SelfExplainPanel
                key={`${boardKey ?? lesson.id}:${selfExplain.id}`}
                block={selfExplain}
                state={doStates[selfExplain.id]}
                onReveal={onSelfExplainReveal}
                onMark={onSelfExplainMark}
                isDrawing={isDrawing}
              />
            )}

            {quiz && quiz.type === 'quiz' && (
              <section className="chalk-quiz chalk-reveal delay-4">
                <div>
                  <span className="chalk-kicker">Quick check</span>
                  <h2>{quiz.question}</h2>
                </div>
                <div className="board-choices">
                  {quiz.choices.map((choice, index) => {
                    const isSelected = selectedAnswer === index;
                    const isCorrect = index === quiz.answerIndex;
                    return (
                      <button
                        type="button"
                        className={`board-choice ${isSelected ? 'selected' : ''} ${selectedAnswer !== null && isCorrect ? 'correct' : ''}`}
                        key={choice}
                        onClick={() => onSelectAnswer?.(index)}
                        disabled={isDrawing && selectedAnswer === null}
                      >
                        <span>{String.fromCharCode(65 + index)}</span>
                        {choice}
                      </button>
                    );
                  })}
                </div>
                <p className="board-response">
                  {selectedAnswer === null
                    ? 'Pick one. The board will adjust from your answer.'
                    : selectedAnswer === quiz.answerIndex
                      ? 'Got it! Ready to go deeper whenever you are.'
                      : `Let's redraw the key idea: ${quiz.explanation}`}
                </p>
                {selectedAnswer !== null && onReteach && (
                  <button type="button" className="reteach-button" onClick={() => onReteach(selectedAnswer)} disabled={isDrawing}>
                    {selectedAnswer === quiz.answerIndex ? 'Draw the next board' : 'Redraw this idea'}
                  </button>
                )}
              </section>
            )}

            {!quiz && isDrawing && (
              <section className="chalk-quiz chalk-reveal delay-4">
                <p className="board-pending">Quick check coming up…</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

type BoardMark = Extract<LessonBlock, { type: 'sketch' }>['marks'][number];
type ImageBlock = Extract<LessonBlock, { type: 'image' }>;
export type PredictBlock = Extract<LessonBlock, { type: 'predict' }>;
export type SelfExplainBlock = Extract<LessonBlock, { type: 'selfExplain' }>;
type SketchBlock = Extract<LessonBlock, { type: 'sketch' }>;
type SimulationBlock = Extract<LessonBlock, { type: 'simulation' }>;
type FreeBodyBlock = Extract<LessonBlock, { type: 'freeBody' }>;
type EquationBlock = Extract<LessonBlock, { type: 'equation' }>;
type GraphBlock = Extract<LessonBlock, { type: 'graph' }>;

// ---------------------------------------------------------------------------
// Do-blocks: predict (commit before the reveal) and selfExplain (say it back).
// Interaction state lives in the workspace via doStates/callbacks so attempts
// land in the learner record; only the self-explain draft is local.
// ---------------------------------------------------------------------------

function PredictPanel({
  block,
  state,
  onCommit,
  isDrawing,
}: {
  block: PredictBlock;
  state?: DoBlockState;
  onCommit?: (block: PredictBlock, choice: number) => void;
  isDrawing: boolean;
}) {
  const committed = state?.choice !== undefined;
  const calledIt = committed && state?.choice === block.answerIndex;
  return (
    <section className={`chalk-predict chalk-reveal delay-1 ${committed ? 'committed' : ''}`}>
      <div>
        <span className="chalk-kicker">Predict first</span>
        <p className="predict-setup">{block.setup}</p>
        <h2>{block.question}</h2>
      </div>
      <div className="board-choices">
        {block.choices.map((choice, index) => {
          const isSelected = committed && state?.choice === index;
          const isCorrect = index === block.answerIndex;
          return (
            <button
              type="button"
              className={`board-choice ${isSelected ? 'selected' : ''} ${committed && isCorrect ? 'correct' : ''}`}
              key={choice}
              onClick={() => onCommit?.(block, index)}
              disabled={committed || isDrawing}
            >
              <span>{String.fromCharCode(65 + index)}</span>
              {choice}
            </button>
          );
        })}
      </div>
      <p className="board-response">
        {!committed
          ? 'Commit to a guess before reading on — wrong guesses teach best.'
          : `${calledIt ? 'You called it! ' : 'Not what you guessed — even better: '}${block.reveal}`}
      </p>
    </section>
  );
}

function SelfExplainPanel({
  block,
  state,
  onReveal,
  onMark,
  isDrawing,
}: {
  block: SelfExplainBlock;
  state?: DoBlockState;
  onReveal?: (block: SelfExplainBlock, text: string) => void;
  onMark?: (block: SelfExplainBlock, covered: boolean) => void;
  isDrawing: boolean;
}) {
  const [draft, setDraft] = useState('');
  const revealed = state?.revealed === true;
  const marked = state?.selfMark;
  const ready = draft.trim().length >= 20;

  return (
    <section className="chalk-selfexplain chalk-reveal delay-4">
      <div>
        <span className="chalk-kicker">Say it back</span>
        <h2>{block.prompt}</h2>
      </div>
      {!revealed ? (
        <>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="Explain it in your own words, from memory…"
            aria-label={block.prompt}
            disabled={isDrawing}
          />
          <div className="selfexplain-actions">
            <button
              type="button"
              className="reteach-button"
              onClick={() => onReveal?.(block, draft.trim())}
              disabled={!ready || isDrawing}
            >
              Compare with the key ideas
            </button>
            {!ready && <small>Write a sentence or two first — saying it is the practice.</small>}
          </div>
        </>
      ) : (
        <>
          {state?.text && <blockquote className="selfexplain-yours">“{state.text}”</blockquote>}
          {state?.grading ? (
            <p className="selfexplain-reading">The tutor is reading your answer…</p>
          ) : state?.grade ? (
            <>
              <div className="selfexplain-keypoints">
                <span className="chalk-kicker">A good answer hits these</span>
                <ul>
                  {block.keyPoints.map((point, index) => {
                    const hit = state.grade!.coveredIndices.includes(index);
                    return (
                      <li key={point} className={hit ? 'kp-hit' : 'kp-miss'}>
                        <span aria-hidden="true">{hit ? '✓' : '○'}</span> {point}
                      </li>
                    );
                  })}
                </ul>
                <p className="selfexplain-exemplar">One way to say it: {block.exemplar}</p>
              </div>
              <p className="selfexplain-feedback">{state.grade.feedback}</p>
            </>
          ) : (
            <>
              <div className="selfexplain-keypoints">
                <span className="chalk-kicker">A good answer hits these</span>
                <ul>
                  {block.keyPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <p className="selfexplain-exemplar">One way to say it: {block.exemplar}</p>
              </div>
              {!marked ? (
                <div className="selfexplain-actions">
                  <button type="button" className="reteach-button" onClick={() => onMark?.(block, true)}>
                    I covered these
                  </button>
                  <button type="button" className="reteach-button" onClick={() => onMark?.(block, false)}>
                    I missed some
                  </button>
                </div>
              ) : (
                <p className="board-response">
                  {marked === 'covered'
                    ? 'Nice — explaining it in your own words is what makes it stick.'
                    : 'Good honesty — spotting the gap is how it closes. The quick check below will help.'}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Live graph: plots the model's actual expression and lets the student drag
// the focus point along the curve.
// ---------------------------------------------------------------------------

const VIEW = { width: 760, height: 420, left: 58, right: 736, top: 30, bottom: 372 };

function LiveGraph({ block }: { block: GraphBlock }) {
  const compiled = useMemo(() => compileExpression(block.expression), [block.expression]);

  const domain = useMemo<[number, number]>(() => {
    const min = block.domainMin ?? -5;
    const max = block.domainMax ?? 5;
    return max - min > 1e-6 ? [min, max] : [-5, 5];
  }, [block.domainMin, block.domainMax]);

  const [focusX, setFocusX] = useState(() => clampFocus(block.focusX, domain));
  useEffect(() => {
    setFocusX(clampFocus(block.focusX, domain));
  }, [block.id, block.focusX, domain]);

  if (!compiled) {
    return (
      <div className="board-graph">
        <div className="visual-label">
          <span>{block.title}</span>
          {block.subtitle && <small>{block.subtitle}</small>}
        </div>
        <div className="graph-fallback">
          <span className="expression-chip">{block.expression}</span>
          <p>This one is easier to talk through than to plot — see the notes on the left.</p>
        </div>
      </div>
    );
  }

  const fn = compiled.evaluate;
  const segments = sampleCurve(fn, domain);
  const focusY = fn(focusX);
  const range = autoRangeY(segments, Number.isFinite(focusY) ? focusY : undefined);
  const span = domain[1] - domain[0];

  const sx = (x: number) => VIEW.left + ((x - domain[0]) / span) * (VIEW.right - VIEW.left);
  const sy = (y: number) => VIEW.bottom - ((y - range[0]) / (range[1] - range[0])) * (VIEW.bottom - VIEW.top);

  const paths = segments.map((segment) =>
    segment.map((point, index) => `${index === 0 ? 'M' : 'L'}${sx(point.x).toFixed(1)} ${sy(clampY(point.y, range)).toFixed(1)}`).join(' '),
  );

  const showFocus = Number.isFinite(focusY) && focusY >= range[0] && focusY <= range[1];
  const slope = showFocus ? numericDerivative(fn, focusX) : 0;
  const showTangent = (block.highlight === 'tangent' || block.highlight === 'slope') && showFocus && Number.isFinite(slope);

  // Tangent segment through the focus point, spanning ~30% of the window each way
  const dx = span * 0.3;
  const tangent = showTangent
    ? {
        x1: sx(focusX - dx), y1: sy(clampY(focusY - slope * dx, range)),
        x2: sx(focusX + dx), y2: sy(clampY(focusY + slope * dx, range)),
      }
    : null;

  // Shaded area under the curve from the y-axis (or domain edge) to the focus point
  let areaPath: string | null = null;
  if (block.highlight === 'area' && showFocus) {
    const start = domain[0] < 0 && domain[1] > 0 ? 0 : domain[0];
    const [from, to] = start <= focusX ? [start, focusX] : [focusX, start];
    const samples: string[] = [];
    const steps = 60;
    for (let i = 0; i <= steps; i += 1) {
      const x = from + ((to - from) * i) / steps;
      const y = fn(x);
      if (Number.isFinite(y)) samples.push(`L${sx(x).toFixed(1)} ${sy(clampY(y, range)).toFixed(1)}`);
    }
    if (samples.length > 1) {
      const baseline = sy(clampY(0, range));
      areaPath = `M${sx(from).toFixed(1)} ${baseline}${samples.join('')}L${sx(to).toFixed(1)} ${baseline} Z`;
    }
  }

  const zeroXVisible = domain[0] <= 0 && domain[1] >= 0;
  const zeroYVisible = range[0] <= 0 && range[1] >= 0;

  return (
    <div className="board-graph">
      <div className="visual-label">
        <span>{block.title}</span>
        {block.subtitle && <small>{block.subtitle}</small>}
      </div>
      <div className="graph-stage">
        <div className="expression">{block.expression}</div>
        <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="img" aria-label={`Graph of ${block.expression}`}>
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={`v-${i}`} x1={VIEW.left + ((VIEW.right - VIEW.left) * (i + 1)) / 8} y1={VIEW.top} x2={VIEW.left + ((VIEW.right - VIEW.left) * (i + 1)) / 8} y2={VIEW.bottom} className="grid-line" />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={`h-${i}`} x1={VIEW.left} y1={VIEW.top + ((VIEW.bottom - VIEW.top) * (i + 1)) / 6} x2={VIEW.right} y2={VIEW.top + ((VIEW.bottom - VIEW.top) * (i + 1)) / 6} className="grid-line" />
          ))}

          <line x1={VIEW.left} y1={zeroYVisible ? sy(0) : VIEW.bottom} x2={VIEW.right} y2={zeroYVisible ? sy(0) : VIEW.bottom} className="axis-line" />
          <line x1={zeroXVisible ? sx(0) : VIEW.left} y1={VIEW.top} x2={zeroXVisible ? sx(0) : VIEW.left} y2={VIEW.bottom} className="axis-line" />

          <text x={VIEW.left} y={VIEW.bottom + 24} className="axis-tick">{formatNumber(domain[0])}</text>
          <text x={VIEW.right - 8} y={VIEW.bottom + 24} textAnchor="end" className="axis-tick">{formatNumber(domain[1])}</text>
          <text x={VIEW.left - 8} y={VIEW.top + 12} textAnchor="end" className="axis-tick">{formatNumber(range[1])}</text>
          <text x={VIEW.left - 8} y={VIEW.bottom} textAnchor="end" className="axis-tick">{formatNumber(range[0])}</text>

          {areaPath && <path d={areaPath} className="chalk-area" />}
          {paths.map((d, index) => <path key={index} d={d} className="chalk-curve" />)}
          {tangent && <line className="real-tangent" x1={tangent.x1} y1={tangent.y1} x2={tangent.x2} y2={tangent.y2} />}
          {showFocus && block.highlight !== 'curve' && (
            <circle className="pulse-point" cx={sx(focusX)} cy={sy(focusY)} r="9" />
          )}
        </svg>
        <div className="graph-controls">
          <input
            type="range"
            className="graph-slider"
            min={domain[0]}
            max={domain[1]}
            step={span / 160}
            value={focusX}
            onChange={(event) => setFocusX(Number(event.target.value))}
            aria-label="Move the focus point along the curve"
          />
          <div className="graph-readout">
            <span>x = {formatNumber(focusX)}</span>
            <span>f(x) = {Number.isFinite(focusY) ? formatNumber(focusY) : '—'}</span>
            {(block.highlight === 'tangent' || block.highlight === 'slope') && (
              <span className="readout-accent">slope ≈ {Number.isFinite(slope) ? formatNumber(slope) : '—'}</span>
            )}
            {block.highlight === 'area' && <span className="readout-accent">area is shaded up to x</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function clampFocus(focusX: number | undefined, domain: [number, number]): number {
  const fallback = domain[0] + (domain[1] - domain[0]) * 0.6;
  if (typeof focusX !== 'number' || !Number.isFinite(focusX)) return fallback;
  return Math.min(domain[1], Math.max(domain[0], focusX));
}

function clampY(y: number, range: [number, number]): number {
  return Math.min(range[1], Math.max(range[0], y));
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return Number(value.toFixed(2)).toString();
}

// ---------------------------------------------------------------------------
// Board image: a generated picture taped to the blackboard. The lesson block
// carries only the prompt; the picture itself is generated (and disk-cached)
// by /api/board-image, so saved sessions stay tiny and replays are instant.
// ---------------------------------------------------------------------------

type BoardImageResult = { url?: string; error?: 'unavailable' | 'failed' };

// Module-level: revisiting a board (or re-rendering during streaming) must
// never trigger a second generation for the same prompt.
const boardImageCache = new Map<string, BoardImageResult>();

const imageStyleLabels: Record<NonNullable<ImageBlock['style']>, string> = {
  photo: 'Photograph',
  illustration: 'Illustration',
  diagram: 'Diagram',
  cutaway: 'Cutaway view',
  map: 'Map',
};

function BoardImage({ block, compact = false }: { block: ImageBlock; compact?: boolean }) {
  const cacheKey = `${block.style ?? 'auto'}|${block.prompt}`;
  const [result, setResult] = useState<BoardImageResult | null>(() => boardImageCache.get(cacheKey) ?? null);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const cached = boardImageCache.get(cacheKey);
    if (cached?.url) {
      setResult(cached);
      return;
    }
    let cancelled = false;
    setResult(null);
    setLoaded(false);
    fetch('/api/board-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...byokHeaders() },
      body: JSON.stringify({ prompt: block.prompt, style: block.style }),
    })
      .then(async (response): Promise<BoardImageResult> => {
        const data = await response.json().catch(() => null);
        if (response.ok && typeof data?.url === 'string') return { url: data.url };
        return { error: response.status === 503 ? 'unavailable' : 'failed' };
      })
      .catch((): BoardImageResult => ({ error: 'failed' }))
      .then((next) => {
        if (next.url) boardImageCache.set(cacheKey, next);
        if (!cancelled) setResult(next);
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, block.prompt, block.style, attempt]);

  return (
    <div className={compact ? 'board-photo compact' : 'board-photo'}>
      <div className="visual-label sketch-heading">
        <span>{block.title}</span>
        {block.style && <small>{imageStyleLabels[block.style]}</small>}
      </div>
      <figure className="photo-frame">
        <span className="photo-tape tape-left" aria-hidden="true" />
        <span className="photo-tape tape-right" aria-hidden="true" />
        <div className={`photo-stage ${result?.url && loaded ? 'is-loaded' : ''}`}>
          {result?.url && (
            <img src={result.url} alt={block.alt} draggable={false} onLoad={() => setLoaded(true)} />
          )}
          {(!result || (result.url && !loaded)) && (
            <div className="photo-loading" role="status">
              <span className="photo-shimmer" aria-hidden="true" />
              <p>Developing the picture…</p>
              <small>{block.alt}</small>
            </div>
          )}
          {result?.error && (
            <div className="photo-fallback">
              <span className="chalk-kicker">Picture this</span>
              <p>{block.alt}</p>
              {result.error === 'failed' ? (
                <button
                  type="button"
                  onClick={() => {
                    boardImageCache.delete(cacheKey);
                    setAttempt((count) => count + 1);
                  }}
                >
                  Try the picture again
                </button>
              ) : (
                <small>No picture service right now — imagine it from the description above.</small>
              )}
            </div>
          )}
        </div>
        <figcaption className="photo-caption">{block.caption}</figcaption>
      </figure>
      {block.lookFor && block.lookFor.length > 0 && (
        <div className="photo-lookfor">
          <span className="chalk-kicker">Look for</span>
          <ul>
            {block.lookFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Physics, sketches, simulations, equations (chalk components)
// ---------------------------------------------------------------------------

const vectorAnchors: Record<FreeBodyBlock['forces'][number]['direction'], { x1: number; y1: number; x2: number; y2: number; labelX: number; labelY: number }> = {
  left: { x1: 48, y1: 56, x2: 22, y2: 56, labelX: 20, labelY: 50 },
  right: { x1: 52, y1: 56, x2: 78, y2: 56, labelX: 80, labelY: 50 },
  up: { x1: 50, y1: 50, x2: 50, y2: 22, labelX: 53, labelY: 22 },
  down: { x1: 50, y1: 62, x2: 50, y2: 88, labelX: 53, labelY: 86 },
  'up-left': { x1: 47, y1: 52, x2: 25, y2: 30, labelX: 20, labelY: 28 },
  'up-right': { x1: 53, y1: 52, x2: 75, y2: 30, labelX: 75, labelY: 28 },
  'down-left': { x1: 47, y1: 60, x2: 25, y2: 82, labelX: 20, labelY: 82 },
  'down-right': { x1: 53, y1: 60, x2: 75, y2: 82, labelX: 75, labelY: 82 },
};

function FreeBodyDiagram({ block }: { block: FreeBodyBlock }) {
  return (
    <div className="free-body-board">
      <div className="visual-label">
        <span>{block.title}</span>
        {block.motion && <small>{block.motion}</small>}
      </div>
      <div className="free-body-canvas">
        <svg viewBox="0 0 100 100" role="img" aria-label={block.title}>
          <defs>
            <marker id="vector-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" className="vector-head" />
            </marker>
          </defs>
          <line x1="14" y1="75" x2="86" y2="75" className="surface-line" />
          <rect x="36" y="44" width="28" height="18" rx="3" className="object-box" />
          <circle cx="42" cy="66" r="3.5" className="wheel" />
          <circle cx="58" cy="66" r="3.5" className="wheel" />
          <text x="50" y="55" textAnchor="middle" className="object-label">{block.objectLabel}</text>
          {block.surface && <text x="50" y="83" textAnchor="middle" className="surface-label">{block.surface}</text>}
          {block.forces.map((force, index) => {
            const anchor = vectorAnchors[force.direction];
            return (
              <g className={`force-vector tone-${force.tone ?? 'chalk'}`} key={force.id} style={{ '--mark-delay': `${260 + index * 130}ms` } as CSSProperties}>
                <line x1={anchor.x1} y1={anchor.y1} x2={anchor.x2} y2={anchor.y2} markerEnd="url(#vector-arrow)" />
                <text x={anchor.labelX} y={anchor.labelY} textAnchor={anchor.labelX < 50 ? 'end' : 'start'}>
                  {force.label}{force.magnitude ? ` ${force.magnitude}` : ''}
                </text>
              </g>
            );
          })}
          {block.equation && <text x="50" y="14" textAnchor="middle" className="equation-callout">{block.equation}</text>}
        </svg>
      </div>
    </div>
  );
}

function EquationBoard({ block }: { block: EquationBlock }) {
  return (
    <div className="equation-board">
      <span className="chalk-kicker">{block.title}</span>
      <div className="given-row">
        {block.givens.map((given) => <span key={given}>{given}</span>)}
      </div>
      <ol className="equation-steps">
        {block.steps.map((step, index) => (
          <li key={`${step.left}-${step.right}-${index}`} style={{ '--step-delay': `${240 + index * 130}ms` } as CSSProperties}>
            <strong>{step.left}</strong>
            <span>=</span>
            <strong>{step.right}</strong>
            {step.note && <em>{step.note}</em>}
          </li>
        ))}
      </ol>
      <div className="equation-result">{block.result}</div>
    </div>
  );
}

function BoardSketch({ block, compact = false }: { block: SketchBlock; compact?: boolean }) {
  return (
    <div className={compact ? 'board-sketch compact' : 'board-sketch'}>
      <div className="visual-label sketch-heading">
        <span>{block.title}</span>
        {block.caption && <small>{block.caption}</small>}
      </div>
      <SketchCanvas marks={block.marks} layout={block.layout} compact={compact} />
    </div>
  );
}

function BoardSimulation({ block, compact = false }: { block: SimulationBlock; compact?: boolean }) {
  const [activeFrame, setActiveFrame] = useState(0);

  useEffect(() => {
    setActiveFrame(0);
  }, [block.id, block.frames.length]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveFrame((frame) => (frame + 1) % block.frames.length);
    }, 2400);

    return () => window.clearInterval(timer);
  }, [block.frames.length]);

  const frame = block.frames[Math.min(activeFrame, block.frames.length - 1)];

  return (
    <div className={compact ? 'board-simulation compact' : 'board-simulation'}>
      <div className="visual-label sketch-heading">
        <span>{block.title}</span>
        <small>{frame.caption}</small>
      </div>
      <div className="simulation-tabs" role="tablist" aria-label={block.title}>
        {block.frames.map((item, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={index === activeFrame}
            className={index === activeFrame ? 'active' : ''}
            key={`${item.label}-${index}`}
            onClick={() => setActiveFrame(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <SketchCanvas marks={frame.marks} layout="timeline" compact={compact} />
    </div>
  );
}

function SketchCanvas({ marks, layout, compact = false }: { marks: BoardMark[]; layout: SketchBlock['layout']; compact?: boolean }) {
  return (
    <div className={compact ? 'sketch-canvas compact' : 'sketch-canvas'} data-layout={layout}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" className="arrow-head" />
          </marker>
        </defs>
        {marks.filter((mark) => mark.kind === 'arrow').map((mark, index) => (
          <g key={mark.id} className={`sketch-arrow tone-${mark.tone ?? 'chalk'}`} style={{ '--mark-delay': `${240 + index * 110}ms` } as CSSProperties}>
            <line x1={mark.x} y1={mark.y} x2={mark.toX ?? mark.x + 12} y2={mark.toY ?? mark.y} markerEnd="url(#arrowhead)" />
            <text x={(mark.x + (mark.toX ?? mark.x + 12)) / 2} y={(mark.y + (mark.toY ?? mark.y)) / 2 - 2}>{mark.text}</text>
          </g>
        ))}
      </svg>
      {marks.filter((mark) => mark.kind !== 'arrow').map((mark, index) => (
        <SketchMark mark={mark} key={mark.id} index={index} />
      ))}
    </div>
  );
}

function SketchMark({ mark, index }: { mark: BoardMark; index: number }) {
  const style = {
    '--mark-delay': `${260 + index * 115}ms`,
    left: `${mark.x}%`,
    top: `${mark.y}%`,
    width: mark.w ? `${mark.w}%` : undefined,
    minHeight: mark.h ? `${mark.h}%` : undefined,
  } as CSSProperties;

  return (
    <div className={`sketch-mark kind-${mark.kind} tone-${mark.tone ?? 'chalk'}`} style={style}>
      <strong>{mark.text}</strong>
      {mark.detail && <span>{mark.detail}</span>}
    </div>
  );
}

function DiagramSketch({ title, nodes, compact = false }: { title: string; nodes: Array<{ label: string; detail?: string }>; compact?: boolean }) {
  return (
    <div className={compact ? 'diagram-sketch compact' : 'diagram-sketch'}>
      <span className="chalk-kicker">{title}</span>
      <div className="diagram-nodes">
        {nodes.slice(0, compact ? 5 : 6).map((node, index) => (
          <div className="diagram-node" key={`${node.label}-${index}`} style={{ '--node-delay': `${index * 120}ms` } as CSSProperties}>
            <strong>{node.label}</strong>
            {node.detail && <span>{node.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
