import { compileExpression, numericDerivative, sampleCurve, autoRangeY } from '../lib/expression';

function assertClose(actual: number, expected: number, label: string, tolerance = 1e-6) {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function evalExpr(expr: string, x: number): number {
  const compiled = compileExpression(expr);
  if (!compiled) throw new Error(`Failed to compile: ${expr}`);
  return compiled.evaluate(x);
}

// Basic arithmetic and precedence
assertClose(evalExpr('2 + 3 * 4', 0), 14, '2 + 3 * 4');
assertClose(evalExpr('(2 + 3) * 4', 0), 20, '(2 + 3) * 4');
assertClose(evalExpr('2 ^ 3 ^ 2', 0), 512, 'right-assoc power');
assertClose(evalExpr('-x^2', 2), -4, 'unary minus binds below power');

// Model-flavored notation
assertClose(evalExpr('y = x²', 3), 9, 'y = x² superscript');
assertClose(evalExpr('f(x) = 2x + 1', 4), 9, 'f(x) prefix and implicit multiply');
assertClose(evalExpr('sin(x)', Math.PI / 2), 1, 'sin(x)');
assertClose(evalExpr('2sin(x)', Math.PI / 2), 2, 'implicit multiply before function');
assertClose(evalExpr('sin 2x', Math.PI / 4), 1, 'sin without parens binds tight');
assertClose(evalExpr('sqrt(x)', 16), 4, 'sqrt');
assertClose(evalExpr('√x', 25), 5, 'unicode sqrt');
assertClose(evalExpr('e^x', 1), Math.E, 'e^x');
assertClose(evalExpr('2pi', 0), 2 * Math.PI, '2pi implicit');
assertClose(evalExpr('x(x+1)', 3), 12, 'x(x+1) implicit');
assertClose(evalExpr('ln(e)', 0), 1, 'ln(e)');
assertClose(evalExpr('log(100)', 0), 2, 'log base 10');
assertClose(evalExpr('abs(-3x)', 2), 6, 'abs');
assertClose(evalExpr('1/x', 4), 0.25, '1/x');
assertClose(evalExpr('0.5x^2 - 3', 4), 5, 'decimal coefficient');

// Rejections
if (compileExpression('rm -rf /') !== null) throw new Error('Should reject shell text');
if (compileExpression('') !== null) throw new Error('Should reject empty');
if (compileExpression('y = ') !== null) throw new Error('Should reject empty rhs');

// Derivative of x² at x=3 is 6
const square = compileExpression('x^2');
if (!square) throw new Error('x^2 failed to compile');
assertClose(numericDerivative(square.evaluate, 3), 6, 'derivative of x² at 3', 1e-3);

// Sampling splits asymptotes into segments
const reciprocal = compileExpression('1/x');
if (!reciprocal) throw new Error('1/x failed to compile');
const segments = sampleCurve(reciprocal.evaluate, [-5, 5]);
if (segments.length < 2) throw new Error(`1/x should split at the asymptote, got ${segments.length} segment(s)`);

// Auto range produces a finite, ordered window
const [yMin, yMax] = autoRangeY(segments);
if (!(Number.isFinite(yMin) && Number.isFinite(yMax) && yMin < yMax)) {
  throw new Error(`autoRangeY produced bad window [${yMin}, ${yMax}]`);
}

console.log('Expression engine: all assertions passed.');
