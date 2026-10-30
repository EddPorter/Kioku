export const MEMORISE_SECONDS = 60;
export const REFLECT_SECONDS = 10;
export const RECALL_SECONDS = 240;

export function generateDigits(count: number, rng: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < count; i++) out += Math.floor(rng() * 10);
  return out;
}

export function emptyCells(count: number): string[] {
  return Array.from({ length: count }, () => '');
}

/** One point per digit recalled in the correct position. */
export function scoreRecall(target: string, cells: string[]): number {
  let score = 0;
  for (let i = 0; i < target.length; i++) if (cells[i] === target[i]) score++;
  return score;
}

/** Insert an empty item at `index`, shifting later items along; the last item falls off. */
export function insertCell(cells: string[], index: number): string[] {
  const next = cells.slice();
  next.splice(index, 0, '');
  next.length = cells.length;
  return next;
}

/** Remove the item at `index`, shifting later items back; an empty item is added at the end. */
export function deleteCell(cells: string[], index: number): string[] {
  const next = cells.slice();
  next.splice(index, 1);
  next.push('');
  return next;
}

export function groupDigits(digits: string, size: number): string[] {
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += size) groups.push(digits.slice(i, i + size));
  return groups;
}
