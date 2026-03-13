import { describe, it, expect } from 'vitest';
import { 
  isExplicitEquation, 
  compileExplicitExpression, 
  safeEvaluateExpression, 
  sampleExpression 
} from '../graphMath';

describe('graphMath', () => {
  describe('isExplicitEquation', () => {
    it('should identify y=x as explicit', () => {
      expect(isExplicitEquation('y=x')).toBe(true);
    });
    it('should identify x^2 as explicit (implicit y=)', () => {
      expect(isExplicitEquation('x^2')).toBe(true);
    });
    it('should reject empty strings', () => {
      expect(isExplicitEquation('')).toBe(false);
      expect(isExplicitEquation('  ')).toBe(false);
    });
  });

  describe('compileExplicitExpression', () => {
    it('should compile valid expression', () => {
      const compiled = compileExplicitExpression('x^2');
      expect(compiled).not.toBeNull();
      expect(compiled.evaluate({ x: 2 })).toBe(4);
    });

    it('should handle y= prefix', () => {
      const compiled = compileExplicitExpression('y = 2x + 1');
      expect(compiled).not.toBeNull();
      expect(compiled.evaluate({ x: 5 })).toBe(11);
    });

    it('should return null for invalid expressions', () => {
      expect(compileExplicitExpression('y = invalid!!!')).toBeNull();
    });
  });

  describe('safeEvaluateExpression', () => {
    it('should evaluate correctly', () => {
      const compiled = compileExplicitExpression('x * 2');
      expect(safeEvaluateExpression(compiled, 10)).toBe(20);
    });

    it('should return NaN for non-numeric results', () => {
      const compiled = compileExplicitExpression('x');
      expect(safeEvaluateExpression(compiled, Infinity)).toBe(NaN);
    });
  });

  describe('sampleExpression', () => {
    it('should handle discontinuities (e.g., 1/x)', () => {
      const compiled = compileExplicitExpression('1/x');
      const viewport = { xMin: -1, xMax: 1, yMin: -10, yMax: 10 };
      const paths = sampleExpression(compiled, viewport, 100);
      
      // Should have at least two paths (one for x < 0, one for x > 0)
      expect(paths.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for null compiler', () => {
      expect(sampleExpression(null, {}, 100)).toEqual([]);
    });
  });
});
