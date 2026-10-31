export interface Attempt {
  at: number;
  level: number;
  correct: number;
  passed: boolean;
  memoriseSeconds: number;
  recallSeconds: number;
}

export interface Progress {
  /** The level offered next: n+1 after passing level n, otherwise unchanged. */
  level: number;
  /** The highest level that may be chosen. */
  unlocked: number;
  groupSize: number;
  attempts: Attempt[];
}

const KEY = 'kioku:v1';

export function defaultProgress(): Progress {
  return { level: 1, unlocked: 1, groupSize: 1, attempts: [] };
}

/** Pure: returns the progress after recording an attempt. */
export function recordAttempt(progress: Progress, attempt: Attempt): Progress {
  const next: Progress = { ...progress, attempts: [...progress.attempts, attempt] };
  if (attempt.passed) {
    next.unlocked = Math.max(progress.unlocked, attempt.level + 1);
    next.level = attempt.level + 1;
  } else {
    next.level = attempt.level;
  }
  return next;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultProgress(), ...JSON.parse(raw) };
  } catch {
    // Storage unavailable or corrupt: start afresh.
  }
  return defaultProgress();
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Ignore: progress simply will not persist.
  }
}

export interface LevelStats {
  level: number;
  attempts: number;
  passes: number;
  bestMemoriseSeconds: number | null;
}

export interface Stats {
  attempts: number;
  passes: number;
  digitsRecalled: number;
  bestLevelPassed: number;
  perLevel: LevelStats[];
}

export function computeStats(attempts: Attempt[]): Stats {
  const byLevel = new Map<number, LevelStats>();
  let passes = 0;
  let digitsRecalled = 0;
  let bestLevelPassed = 0;
  for (const a of attempts) {
    const s = byLevel.get(a.level) ?? { level: a.level, attempts: 0, passes: 0, bestMemoriseSeconds: null };
    s.attempts++;
    digitsRecalled += a.correct;
    if (a.passed) {
      s.passes++;
      passes++;
      bestLevelPassed = Math.max(bestLevelPassed, a.level);
      if (s.bestMemoriseSeconds === null || a.memoriseSeconds < s.bestMemoriseSeconds) {
        s.bestMemoriseSeconds = a.memoriseSeconds;
      }
    }
    byLevel.set(a.level, s);
  }
  return {
    attempts: attempts.length,
    passes,
    digitsRecalled,
    bestLevelPassed,
    perLevel: [...byLevel.values()].sort((x, y) => x.level - y.level),
  };
}
