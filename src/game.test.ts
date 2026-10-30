import { describe, expect, it } from 'vitest';
import { deleteCell, generateDigits, groupDigits, insertCell, scoreRecall } from './game';
import { computeStats, defaultProgress, recordAttempt, type Attempt } from './storage';

const attempt = (level: number, passed: boolean, memoriseSeconds = 10): Attempt => ({
  at: 0,
  level,
  correct: passed ? level : level - 1,
  passed,
  memoriseSeconds,
  recallSeconds: 5,
});

describe('game', () => {
  it('generates the requested number of digits', () => {
    expect(generateDigits(17)).toMatch(/^\d{17}$/);
  });

  it('scores one point per correct digit in place', () => {
    expect(scoreRecall('12345', ['1', '2', '9', '4', ''])).toBe(3);
  });

  it('inserts and deletes items, shifting the rest', () => {
    expect(insertCell(['1', '2', '3'], 1)).toEqual(['1', '', '2']);
    expect(deleteCell(['1', '2', '3'], 0)).toEqual(['2', '3', '']);
  });

  it('groups digits', () => {
    expect(groupDigits('1234567', 3)).toEqual(['123', '456', '7']);
  });
});

describe('progress', () => {
  it('advances to n+1 after passing level n', () => {
    const next = recordAttempt(defaultProgress(), attempt(1, true));
    expect(next.level).toBe(2);
    expect(next.unlocked).toBe(2);
  });

  it('stays on level n after a miss', () => {
    let p = recordAttempt(defaultProgress(), attempt(1, true));
    p = recordAttempt(p, attempt(2, false));
    expect(p.level).toBe(2);
    expect(p.unlocked).toBe(2);
  });

  it('does not lower the unlocked level when replaying an earlier one', () => {
    let p = defaultProgress();
    for (const n of [1, 2, 3]) p = recordAttempt(p, attempt(n, true));
    p = recordAttempt(p, attempt(1, true));
    expect(p.unlocked).toBe(4);
    expect(p.level).toBe(2);
  });

  it('computes stats', () => {
    const s = computeStats([attempt(1, true, 8), attempt(1, true, 5), attempt(2, false)]);
    expect(s.attempts).toBe(3);
    expect(s.passes).toBe(2);
    expect(s.bestLevelPassed).toBe(1);
    expect(s.perLevel[0].bestMemoriseSeconds).toBe(5);
  });
});
