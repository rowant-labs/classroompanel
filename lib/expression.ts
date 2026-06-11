// Safe math expression engine for the blackboard.
// Parses model-authored expressions like "y = x²", "sin(2x)", "0.5x^2 - 3" into
// real evaluable functions — no eval(), no Function() — so graph blocks plot the
// actual curve the tutor wrote, with numerically-derived tangents and areas.

export type PlotPoint = { x: number; y: number };

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

type Node =
  | { kind: 'num'; value: number }
  | { kind: 'x' }
  | { kind: 'const'; value: number }
  | { kind: 'call'; fn: (v: number) => number; arg: Node }
  | { kind: 'unary'; op: '-'; arg: Node }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: Node; right: Node };

const FUNCTIONS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

export function normalizeExpression(raw: string): string {
  let expr = raw.trim().toLowerCase();
  expr = expr.replace(/^(y|f\s*\(\s*x\s*\))\s*=\s*/i, '');
  expr = expr
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\*\*/g, '^');
  return expr;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j += 1;
      const value = Number(expr.slice(i, j));
      if (Number.isNaN(value)) throw new Error(`Bad number near "${expr.slice(i, j)}"`);
      tokens.push({ kind: 'num', value });
      i = j;
      continue;
    }
    if (/[a-z]/.test(ch)) {
      let j = i;
      while (j < expr.length && /[a-z]/.test(expr[j])) j += 1;
      let word = expr.slice(i, j);
      // Split runs like "xsin" or "2x" handled later; here split known prefixes
      while (word.length > 0) {
        if (word === 'x') { tokens.push({ kind: 'ident', value: 'x' }); word = ''; break; }
        const fn = Object.keys(FUNCTIONS).find((name) => word.startsWith(name));
        if (fn) {
          tokens.push({ kind: 'ident', value: fn });
          word = word.slice(fn.length);
          continue;
        }
        if (word.startsWith('pi')) {
          tokens.push({ kind: 'ident', value: 'pi' });
          word = word.slice(2);
          continue;
        }
        if (word.startsWith('e')) {
          tokens.push({ kind: 'ident', value: 'e' });
          word = word.slice(1);
          continue;
        }
        if (word.startsWith('x')) {
          tokens.push({ kind: 'ident', value: 'x' });
          word = word.slice(1);
          continue;
        }
        throw new Error(`Unknown symbol "${word}"`);
      }
      i = j;
      continue;
    }
    if ('+-*/^'.includes(ch)) { tokens.push({ kind: 'op', value: ch }); i += 1; continue; }
    if (ch === '(') { tokens.push({ kind: 'lparen' }); i += 1; continue; }
    if (ch === ')') { tokens.push({ kind: 'rparen' }); i += 1; continue; }
    throw new Error(`Unexpected character "${ch}"`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  parse(): Node {
    const node = this.parseAdditive();
    if (this.pos < this.tokens.length) throw new Error('Unexpected trailing input');
    return node;
  }

  private peek(): Token | undefined { return this.tokens[this.pos]; }
  private next(): Token | undefined { return this.tokens[this.pos++]; }

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    let token = this.peek();
    while (token && token.kind === 'op' && (token.value === '+' || token.value === '-')) {
      this.next();
      const right = this.parseMultiplicative();
      left = { kind: 'binary', op: token.value as '+' | '-', left, right };
      token = this.peek();
    }
    return left;
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    for (;;) {
      const token = this.peek();
      if (token && token.kind === 'op' && (token.value === '*' || token.value === '/')) {
        this.next();
        const right = this.parseUnary();
        left = { kind: 'binary', op: token.value as '*' | '/', left, right };
        continue;
      }
      // Implicit multiplication: 2x, x sin(x), 3(x+1), (x+1)(x-1), 2pi
      if (token && (token.kind === 'num' || token.kind === 'ident' || token.kind === 'lparen')) {
        const right = this.parseUnary();
        left = { kind: 'binary', op: '*', left, right };
        continue;
      }
      return left;
    }
  }

  private parseUnary(): Node {
    const token = this.peek();
    if (token && token.kind === 'op' && token.value === '-') {
      this.next();
      return { kind: 'unary', op: '-', arg: this.parseUnary() };
    }
    if (token && token.kind === 'op' && token.value === '+') {
      this.next();
      return this.parseUnary();
    }
    return this.parsePower();
  }

  private parseImplicitProduct(): Node {
    let left = this.parseUnary();
    for (;;) {
      const token = this.peek();
      if (token && (token.kind === 'num' || token.kind === 'ident' || token.kind === 'lparen')) {
        left = { kind: 'binary', op: '*', left, right: this.parseUnary() };
        continue;
      }
      return left;
    }
  }

  private parsePower(): Node {
    const base = this.parseAtom();
    const token = this.peek();
    if (token && token.kind === 'op' && token.value === '^') {
      this.next();
      // Right-associative; exponent may be unary (-2)
      const exponent = this.parseUnary();
      return { kind: 'binary', op: '^', left: base, right: exponent };
    }
    return base;
  }

  private parseAtom(): Node {
    const token = this.next();
    if (!token) throw new Error('Unexpected end of expression');
    if (token.kind === 'num') return { kind: 'num', value: token.value };
    if (token.kind === 'lparen') {
      const node = this.parseAdditive();
      const closing = this.next();
      if (!closing || closing.kind !== 'rparen') throw new Error('Missing closing parenthesis');
      return node;
    }
    if (token.kind === 'ident') {
      if (token.value === 'x') return { kind: 'x' };
      if (token.value in CONSTANTS) return { kind: 'const', value: CONSTANTS[token.value] };
      if (token.value in FUNCTIONS) {
        const fn = FUNCTIONS[token.value];
        const argToken = this.peek();
        if (argToken && argToken.kind === 'lparen') {
          this.next();
          const arg = this.parseAdditive();
          const closing = this.next();
          if (!closing || closing.kind !== 'rparen') throw new Error('Missing closing parenthesis');
          return { kind: 'call', fn, arg };
        }
        // sin 2x — without parens, bind the whole implicit product (stop at + - * /)
        return { kind: 'call', fn, arg: this.parseImplicitProduct() };
      }
    }
    throw new Error('Unexpected token');
  }
}

function evaluate(node: Node, x: number): number {
  switch (node.kind) {
    case 'num': return node.value;
    case 'const': return node.value;
    case 'x': return x;
    case 'call': return node.fn(evaluate(node.arg, x));
    case 'unary': return -evaluate(node.arg, x);
    case 'binary': {
      const left = evaluate(node.left, x);
      const right = evaluate(node.right, x);
      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '^': return Math.pow(left, right);
      }
    }
  }
}

export type CompiledExpression = {
  source: string;
  evaluate: (x: number) => number;
};

export function compileExpression(raw: string): CompiledExpression | null {
  try {
    const normalized = normalizeExpression(raw);
    if (!normalized) return null;
    const ast = new Parser(tokenize(normalized)).parse();
    const fn = (x: number) => evaluate(ast, x);
    // Sanity probe: must produce at least one finite value somewhere reasonable
    const probes = [-4, -2, -1, -0.5, 0, 0.5, 1, 2, 4];
    if (!probes.some((p) => Number.isFinite(fn(p)))) return null;
    return { source: raw, evaluate: fn };
  } catch {
    return null;
  }
}

export function numericDerivative(fn: (x: number) => number, x: number, h = 1e-4): number {
  return (fn(x + h) - fn(x - h)) / (2 * h);
}

// Sample the curve into contiguous segments, splitting at discontinuities so
// asymptotes (tan, 1/x) don't draw vertical jump lines.
export function sampleCurve(
  fn: (x: number) => number,
  domain: [number, number],
  steps = 240,
): PlotPoint[][] {
  const [min, max] = domain;
  const span = max - min;
  if (!(span > 0)) return [];
  const segments: PlotPoint[][] = [];
  let current: PlotPoint[] = [];
  let prev: PlotPoint | null = null;

  for (let i = 0; i <= steps; i += 1) {
    const x = min + (span * i) / steps;
    const y = fn(x);
    if (!Number.isFinite(y) || Math.abs(y) > 1e6) {
      if (current.length > 1) segments.push(current);
      current = [];
      prev = null;
      continue;
    }
    const point = { x, y };
    if (prev && Math.abs(y - prev.y) > span * 40) {
      // Huge jump relative to the window → treat as a discontinuity
      if (current.length > 1) segments.push(current);
      current = [];
    }
    current.push(point);
    prev = point;
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

// Pick a y-window that shows the interesting part of the curve without letting
// asymptotes blow up the scale.
export function autoRangeY(segments: PlotPoint[][], focusY?: number): [number, number] {
  const ys: number[] = [];
  for (const segment of segments) for (const point of segment) ys.push(point.y);
  if (Number.isFinite(focusY)) ys.push(focusY as number);
  if (ys.length === 0) return [-5, 5];
  ys.sort((a, b) => a - b);
  // Trim the extreme 4% on each side so near-asymptote samples don't dominate
  const lo = ys[Math.floor(ys.length * 0.04)];
  const hi = ys[Math.min(ys.length - 1, Math.ceil(ys.length * 0.96))];
  let min = Math.min(lo, 0);
  let max = Math.max(hi, 0);
  if (max - min < 1e-9) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}
