import './style.css';
import {
  MEMORISE_SECONDS,
  RECALL_SECONDS,
  REFLECT_SECONDS,
  deleteCell,
  emptyCells,
  generateDigits,
  groupDigits,
  insertCell,
  scoreRecall,
} from './game';
import { Attempt, computeStats, loadProgress, recordAttempt, saveProgress } from './storage';

type Phase = 'home' | 'memorise' | 'reflect' | 'recall' | 'result' | 'stats';

const MAX_GROUPS_PER_ROW = 5;
const DOUBLE_PRESS_MS = 600;

const app = document.querySelector<HTMLDivElement>('#app')!;

let progress = loadProgress();
let phase: Phase = 'home';
let level = progress.level;
let target = '';
let groupIndex = 0;
let lastRightAt = -Infinity;
let cells: string[] = [];
let selected = 0;
let memoriseSeconds = 0;
let lastAttempt: Attempt | null = null;
let lastCorrect = 0;

let timerId: number | undefined;
let timerStart = 0;
let timerLimit = 0;

// ---- timer -----------------------------------------------------------------

function elapsed(): number {
  return Math.min(timerLimit, (performance.now() - timerStart) / 1000);
}

function formatClock(seconds: number): string {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function updateTimer(): void {
  const label = document.querySelector<HTMLElement>('#timer');
  const bar = document.querySelector<HTMLElement>('#bar');
  if (!label || !bar) return;
  const remaining = timerLimit - elapsed();
  label.textContent = formatClock(remaining);
  bar.style.width = `${(remaining / timerLimit) * 100}%`;
}

function startTimer(limit: number, onExpire: () => void): void {
  stopTimer();
  timerLimit = limit;
  timerStart = performance.now();
  timerId = window.setInterval(() => {
    if (elapsed() >= timerLimit) onExpire();
    else updateTimer();
  }, 100);
}

/** Stops the timer and returns the seconds that had elapsed. */
function stopTimer(): number {
  const seconds = timerId === undefined ? 0 : elapsed();
  window.clearInterval(timerId);
  timerId = undefined;
  return seconds;
}

// ---- round flow ------------------------------------------------------------

function startRound(): void {
  target = generateDigits(level);
  groupIndex = 0;
  lastRightAt = -Infinity;
  phase = 'memorise';
  render();
  startTimer(MEMORISE_SECONDS, finishMemorise);
}

function finishMemorise(): void {
  memoriseSeconds = stopTimer();
  phase = 'reflect';
  render();
  startTimer(REFLECT_SECONDS, startRecall);
}

function startRecall(): void {
  stopTimer();
  cells = emptyCells(level);
  selected = 0;
  phase = 'recall';
  render();
  startTimer(RECALL_SECONDS, submitRecall);
}

function submitRecall(): void {
  const recallSeconds = stopTimer();
  lastCorrect = scoreRecall(target, cells);
  lastAttempt = {
    at: Date.now(),
    level,
    correct: lastCorrect,
    passed: lastCorrect === level,
    memoriseSeconds,
    recallSeconds,
  };
  progress = recordAttempt(progress, lastAttempt);
  saveProgress(progress);
  level = progress.level;
  phase = 'result';
  render();
}

function goHome(): void {
  stopTimer();
  level = progress.level;
  phase = 'home';
  render();
}

// ---- views -----------------------------------------------------------------

function timerHtml(label: string, skip: string): string {
  return `
    <div class="timer-row">
      <span class="phase-label">${label}</span>
      <span id="timer" class="timer"></span>
      <button data-action="skip">${skip}</button>
      <button data-action="home" class="quiet">Quit</button>
    </div>
    <div class="bar"><i id="bar"></i></div>`;
}

function homeHtml(): string {
  const levelOptions = Array.from({ length: progress.unlocked }, (_, i) => i + 1)
    .map((n) => `<option value="${n}"${n === level ? ' selected' : ''}>Level ${n}</option>`)
    .join('');
  const groupOptions = [2, 3, 4, 5]
    .map((n) => `<option value="${n}"${n === progress.groupSize ? ' selected' : ''}>${n}</option>`)
    .join('');
  return `
    <h1>Kioku <span class="kanji">記憶</span></h1>
    <section class="card">
      <h2>Digits</h2>
      <p>Level ${level}: memorise <strong>${level}</strong> digit${level === 1 ? '' : 's'}. Recall them all correctly to reach level ${level + 1}.</p>
      <div class="controls">
        <label>Level <select id="level">${levelOptions}</select></label>
        <label>Digits per group <select id="group">${groupOptions}</select></label>
      </div>
      <p class="times">${MEMORISE_SECONDS} s to memorise, ${REFLECT_SECONDS} s of reflection, ${RECALL_SECONDS / 60} min to recall. Each stage can be ended early.</p>
      <div class="actions">
        <button data-action="start" class="primary">Start (Enter)</button>
        <button data-action="stats">Statistics</button>
      </div>
    </section>
    <section class="card help">
      <h2>Controls</h2>
      <h3>Memorise</h3>
      <ul>
        <li><kbd>→</kbd> next group, <kbd>←</kbd> previous group</li>
        <li><kbd>Space</kbd> or <kbd>↑</kbd> back to the start</li>
        <li>Stop the timer: <kbd>→</kbd> twice quickly at the end, the Finished button, or <kbd>Enter</kbd></li>
      </ul>
      <h3>Recall</h3>
      <ul>
        <li>Click a cell or use the arrow keys to select it; type <kbd>0</kbd>–<kbd>9</kbd> to fill it</li>
        <li><kbd>Backspace</kbd> deletes the digit to the left</li>
        <li><kbd>+</kbd> inserts an item, shifting later ones along; <kbd>–</kbd> deletes one, shifting them back</li>
        <li><kbd>Enter</kbd> submits</li>
      </ul>
    </section>`;
}

function memoriseHtml(): string {
  const groups = groupDigits(target, progress.groupSize);
  const atEnd = groupIndex === groups.length - 1;
  return `
    ${timerHtml('Memorise', 'Finished (Enter)')}
    <div class="stage">
      <div class="big-digits" data-action="next">${groups[groupIndex]}</div>
      <div class="progress">${groupIndex + 1} / ${groups.length}</div>
      <p class="hint">${atEnd ? 'Press → again to finish' : '&nbsp;'}</p>
      <div class="actions">
        <button data-action="prev">← Back</button>
        <button data-action="next">Next →</button>
        <button data-action="restart">Start of number</button>
      </div>
    </div>`;
}

function reflectHtml(): string {
  return `
    ${timerHtml('Reflect', 'Skip to recall (Enter)')}
    <div class="stage"><p class="reflect">Recall is about to begin. Use this time to rehearse.</p></div>`;
}

/** Groups that fit on one row of the grid; keeps rows even so ↑ and ↓ match what is shown. */
function groupsPerRow(): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const narrow = window.matchMedia('(max-width: 600px)').matches;
  const cell = (narrow ? 1.8 : 2.1) * rem;
  const groupGap = (narrow ? 0.6 : 0.9) * rem;
  const groupWidth = progress.groupSize * cell + (progress.groupSize - 1) * 3;
  const available = Math.min(app.clientWidth, 52 * rem) - 2 * (narrow ? 0.75 : 1) * rem;
  return Math.max(1, Math.min(MAX_GROUPS_PER_ROW, Math.floor((available + groupGap) / (groupWidth + groupGap))));
}

function gridHtml(count: number, render: (index: number) => string): string {
  const size = progress.groupSize;
  const rowLength = size * groupsPerRow();
  let html = '';
  for (let row = 0; row < count; row += rowLength) {
    html += '<div class="row">';
    for (let g = row; g < Math.min(count, row + rowLength); g += size) {
      html += '<span class="group">';
      for (let i = g; i < Math.min(count, g + size); i++) html += render(i);
      html += '</span>';
    }
    html += '</div>';
  }
  return html;
}

function keypadHtml(): string {
  const key = (k: string, label: string, extra = '') =>
    `<button class="key${extra}" data-key="${k}" aria-label="${label}">${label}</button>`;
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => key(d, d)).join('');
  return `
    <div class="keypad">
      <div class="digits">
        ${digits}
        ${key('Backspace', '⌫', ' util')}${key('0', '0')}${key('Enter', 'Done', ' util')}
      </div>
      <div class="edit">
        ${key('ArrowLeft', '←', ' util')}${key('ArrowRight', '→', ' util')}
        ${key('+', 'Insert +', ' util')}${key('-', 'Delete −', ' util')}
      </div>
    </div>`;
}

function recallHtml(): string {
  const grid = gridHtml(
    level,
    (i) => `<span class="cell${i === selected ? ' selected' : ''}" data-index="${i}">${cells[i]}</span>`,
  );
  return `
    ${timerHtml('Recall', 'Submit (Enter)')}
    <div class="grid recall" id="grid">${grid}</div>
    ${keypadHtml()}`;
}

function resultHtml(): string {
  const a = lastAttempt!;
  const grid = gridHtml(a.level, (i) => {
    const ok = cells[i] === target[i];
    const wrong = cells[i] ? `<small>${cells[i]}</small>` : '<small>·</small>';
    return `<span class="cell ${ok ? 'ok' : 'bad'}">${target[i]}${ok ? '' : wrong}</span>`;
  });
  return `
    <h1>${a.passed ? 'Level passed' : 'Not quite'}</h1>
    <p class="score"><strong>${lastCorrect}</strong> / ${a.level} correct · memorised in ${a.memoriseSeconds.toFixed(1)} s</p>
    <div class="grid" id="grid">${grid}</div>
    <p class="hint">Small digits show what you entered where it differed.</p>
    <div class="actions">
      <button data-action="start" class="primary">${a.passed ? `Level ${progress.level} (Enter)` : `Retry level ${a.level} (Enter)`}</button>
      <button data-action="stats">Statistics</button>
      <button data-action="home">Home</button>
    </div>`;
}

function statsHtml(): string {
  const s = computeStats(progress.attempts);
  const rate = s.attempts ? Math.round((s.passes / s.attempts) * 100) : 0;
  const rows = s.perLevel
    .map(
      (l) => `<tr><td>${l.level}</td><td>${l.attempts}</td><td>${l.passes}</td>
        <td>${l.bestMemoriseSeconds === null ? '–' : `${l.bestMemoriseSeconds.toFixed(1)} s`}</td></tr>`,
    )
    .join('');
  const recent = progress.attempts
    .slice(-15)
    .reverse()
    .map(
      (a) => `<tr><td>${new Date(a.at).toLocaleString('en-GB')}</td><td>${a.level}</td>
        <td>${a.correct} / ${a.level}</td><td>${a.passed ? 'Pass' : 'Fail'}</td>
        <td>${a.memoriseSeconds.toFixed(1)} s</td><td>${a.recallSeconds.toFixed(1)} s</td></tr>`,
    )
    .join('');
  return `
    <h1>Statistics</h1>
    <div class="tiles">
      <div><b>${s.bestLevelPassed}</b><span>Highest level passed</span></div>
      <div><b>${s.attempts}</b><span>Attempts</span></div>
      <div><b>${rate}%</b><span>Pass rate</span></div>
      <div><b>${s.digitsRecalled}</b><span>Digits recalled</span></div>
    </div>
    ${s.attempts === 0 ? '<p>No attempts yet.</p>' : `
    <h2>By level</h2>
    <table><thead><tr><th>Level</th><th>Attempts</th><th>Passes</th><th>Fastest pass</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>Recent attempts</h2>
    <table><thead><tr><th>When</th><th>Level</th><th>Score</th><th></th><th>Memorise</th><th>Recall</th></tr></thead><tbody>${recent}</tbody></table>`}
    <div class="actions">
      <button data-action="home" class="primary">Home</button>
      <button data-action="reset" class="quiet">Reset progress</button>
    </div>`;
}

function render(): void {
  const views: Record<Phase, () => string> = {
    home: homeHtml,
    memorise: memoriseHtml,
    reflect: reflectHtml,
    recall: recallHtml,
    result: resultHtml,
    stats: statsHtml,
  };
  app.innerHTML = views[phase]();
  updateTimer();
}

// ---- input -----------------------------------------------------------------

function groupCount(): number {
  return Math.ceil(target.length / progress.groupSize);
}

function finishAction(): void {
  if (phase === 'memorise') finishMemorise();
  else if (phase === 'reflect') startRecall();
  else if (phase === 'recall') submitRecall();
}

app.addEventListener('click', (event) => {
  const cell = (event.target as HTMLElement).closest<HTMLElement>('.cell[data-index]');
  if (cell && phase === 'recall') {
    selected = Number(cell.dataset.index);
    render();
    return;
  }
  const key = (event.target as HTMLElement).closest<HTMLElement>('[data-key]')?.dataset.key;
  if (key && phase === 'recall') {
    onRecallKey(key);
    return;
  }
  const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
  switch (action) {
    case 'start':
      startRound();
      break;
    case 'skip':
      finishAction();
      break;
    case 'home':
      goHome();
      break;
    case 'stats':
      stopTimer();
      phase = 'stats';
      render();
      break;
    case 'prev':
      groupIndex = Math.max(0, groupIndex - 1);
      render();
      break;
    case 'next':
      advance();
      break;
    case 'restart':
      groupIndex = 0;
      render();
      break;
    case 'reset':
      if (confirm('Delete all progress and statistics?')) {
        progress = { ...progress, level: 1, unlocked: 1, attempts: [] };
        saveProgress(progress);
        goHome();
      }
      break;
  }
});

app.addEventListener('change', (event) => {
  const el = event.target as HTMLSelectElement;
  if (el.id === 'level') level = Number(el.value);
  if (el.id === 'group') {
    progress = { ...progress, groupSize: Number(el.value) };
    saveProgress(progress);
  }
  render();
});

/** Move to the next group; a second quick press at the end stops the timer. */
function advance(): void {
  const now = performance.now();
  if (groupIndex < groupCount() - 1) {
    groupIndex++;
    lastRightAt = -Infinity;
  } else if (now - lastRightAt < DOUBLE_PRESS_MS) {
    return finishMemorise();
  } else {
    lastRightAt = now;
  }
  render();
}

function onMemoriseKey(event: KeyboardEvent): boolean {
  switch (event.key) {
    case 'ArrowRight':
      advance();
      return true;
    case 'ArrowLeft':
      groupIndex = Math.max(0, groupIndex - 1);
      break;
    case ' ':
    case 'ArrowUp':
      groupIndex = 0;
      break;
    case 'Enter':
      return (finishMemorise(), true);
    default:
      return false;
  }
  render();
  return true;
}

function onRecallKey(key: string): boolean {
  const rowLength = progress.groupSize * groupsPerRow();
  const clamp = (n: number) => Math.max(0, Math.min(level - 1, n));
  if (/^[0-9]$/.test(key)) {
    cells[selected] = key;
    selected = clamp(selected + 1);
  } else {
    switch (key) {
      case 'ArrowLeft':
        selected = clamp(selected - 1);
        break;
      case 'ArrowRight':
        selected = clamp(selected + 1);
        break;
      case 'ArrowUp':
        selected = clamp(selected - rowLength);
        break;
      case 'ArrowDown':
        selected = clamp(selected + rowLength);
        break;
      case 'Backspace':
        if (selected === level - 1 && cells[selected]) cells[selected] = '';
        else if (selected > 0) cells[--selected] = '';
        break;
      case '+':
        cells = insertCell(cells, selected);
        break;
      case '-':
      case '–':
        cells = deleteCell(cells, selected);
        break;
      case 'Enter':
        return (submitRecall(), true);
      default:
        return false;
    }
  }
  render();
  return true;
}

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLSelectElement || event.ctrlKey || event.metaKey || event.altKey) return;
  let handled = false;
  if (event.key === 'Enter' && event.repeat) {
    handled = true;
  } else if (event.key === 'Escape' && phase !== 'home') {
    goHome();
    handled = true;
  } else if (phase === 'memorise') {
    handled = onMemoriseKey(event);
  } else if (phase === 'reflect' && event.key === 'Enter') {
    startRecall();
    handled = true;
  } else if (phase === 'recall') {
    handled = onRecallKey(event.key);
  } else if ((phase === 'home' || phase === 'result') && event.key === 'Enter') {
    startRound();
    handled = true;
  }
  if (handled) event.preventDefault();
});

render();

window.addEventListener('resize', () => {
  if (phase === 'recall' || phase === 'result') render();
});
