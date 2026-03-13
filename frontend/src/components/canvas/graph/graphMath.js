import { compile, help } from 'mathjs';

/**
 * Checks if the input string is a simple explicit equation of the form y = f(x)
 * or just f(x) (which we assume means y = f(x)).
 */
export function isExplicitEquation(input) {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  // We accept "y = ..." or just the expression
  if (trimmed.startsWith('y=')) {
    return trimmed.length > 2;
  }
  return trimmed.length > 0;
}

/**
 * Compiles a mathematical expression string using mathjs.
 * @returns compiled expression or null if invalid.
 */
export function compileExplicitExpression(input) {
  if (!isExplicitEquation(input)) return null;
  
  let exprString = input.trim();
  if (exprString.startsWith('y=')) {
    exprString = exprString.substring(2).trim();
  }

  try {
    const compiled = compile(exprString);
    // Test evaluation to ensure it works with basic numbers
    const testVal = compiled.evaluate({ x: 1 });
    if (typeof testVal !== 'number' && typeof testVal !== 'bigint' && typeof testVal?.toNumber !== 'function') {
      // If it returns something else (like a function or object), consider it invalid for plotting
      return null;
    }
    return compiled;
  } catch (e) {
    return null;
  }
}

/**
 * Evaluates a compiled mathjs expression for a given x value.
 * Handles errors and non-numeric results.
 */
export function safeEvaluateExpression(compiled, x) {
  if (!compiled) return NaN;
  try {
    let result = compiled.evaluate({ x });
    // Handle mathjs units/bignumbers if they slip through
    if (result && typeof result.toNumber === 'function') {
      result = result.toNumber();
    }
    if (typeof result !== 'number' || !isFinite(result)) {
      return NaN;
    }
    return result;
  } catch (e) {
    return NaN;
  }
}

/**
 * Samples a compiled expression across the viewport's x-range.
 * Returns an array of continuous "paths" (arrays of points) to handle discontinuities.
 */
export function sampleExpression(compiled, viewport, widthPx, maxSamples = 1000) {
  if (!compiled) return [];

  const { xMin, xMax, yMin, yMax } = viewport;
  const rangeX = xMax - xMin;
  const rangeY = yMax - yMin;
  if (rangeX <= 0) return [];

  const numSamples = Math.min(maxSamples, Math.max(100, widthPx));
  const step = rangeX / (numSamples - 1);

  const paths = [];
  let currentPath = [];
  let lastY = null;

  for (let i = 0; i < numSamples; i++) {
    const x = xMin + i * step;
    const y = safeEvaluateExpression(compiled, x);

    if (isNaN(y)) {
      if (currentPath.length > 0) {
        paths.push(currentPath);
        currentPath = [];
      }
      lastY = null;
    } else {
      // Basic jump detection for discontinuities (e.g. 1/x)
      // If the jump in y is huge compared to the viewport height, break the path
      if (lastY !== null && rangeY > 0) {
        const jump = Math.abs(y - lastY);
        if (jump > rangeY * 2) { 
          paths.push(currentPath);
          currentPath = [];
        }
      }
      currentPath.push({ x, y });
      lastY = y;
    }
  }

  if (currentPath.length > 0) {
    paths.push(currentPath);
  }

  return paths;
}
