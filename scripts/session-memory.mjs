#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT_DIR = process.cwd();
const MEMORY_DIR = resolve(ROOT_DIR, 'memory');
const STATE_PATH = resolve(MEMORY_DIR, 'CURRENT_STATE.md');
const HISTORY_PATH = resolve(MEMORY_DIR, 'SESSION_HISTORY.md');

function parseArgs(argv) {
  const options = {};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const maybeValue = argv[index + 1];
      if (!maybeValue || maybeValue.startsWith('--')) {
        options[key] = 'true';
      } else {
        options[key] = maybeValue;
        index += 1;
      }
      continue;
    }
    positional.push(token);
  }

  return { options, positional };
}

function parseList(value) {
  if (!value) {
    return [];
  }

  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeGit(command) {
  try {
    return execSync(command, { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
  } catch {
    return 'n/a';
  }
}

function nowIso() {
  return new Date().toISOString();
}

function nowDisplay() {
  return new Date().toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function ensureMemoryFiles() {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }

  if (!existsSync(STATE_PATH)) {
    writeFileSync(
      STATE_PATH,
      [
        '# Current State',
        '',
        'Updated: not initialized',
        'Summary: no snapshot yet',
        '',
        '## Completed',
        '- none',
        '',
        '## In Progress',
        '- none',
        '',
        '## Next',
        '- run `npm run memory:snapshot -- --summary "..."`',
        '',
        '## Risks / Notes',
        '- none',
        '',
        '## Resume Checklist',
        '1. Open `memory/CURRENT_STATE.md`.',
        '2. Read latest entries in `memory/SESSION_HISTORY.md`.',
        '3. Run `git status --short`.',
        ''
      ].join('\n'),
      'utf8'
    );
  }

  if (!existsSync(HISTORY_PATH)) {
    writeFileSync(
      HISTORY_PATH,
      ['# Session History', '', '_Append-only timeline of snapshots._', ''].join('\n'),
      'utf8'
    );
  }
}

function asListSection(items, fallback = '- none') {
  if (items.length === 0) {
    return fallback;
  }

  return items.map((item) => `- ${item}`).join('\n');
}

function buildStateDocument({
  timestamp,
  summary,
  branch,
  commit,
  completed,
  inProgress,
  next,
  risks,
  notes
}) {
  const notesLine = notes ? `- ${notes}` : '- none';

  return [
    '# Current State',
    '',
    `Updated: ${timestamp}`,
    `Summary: ${summary}`,
    `Branch: ${branch}`,
    `Head: ${commit}`,
    '',
    '## Completed',
    asListSection(completed),
    '',
    '## In Progress',
    asListSection(inProgress),
    '',
    '## Next',
    asListSection(next),
    '',
    '## Risks / Notes',
    `${asListSection(risks)}`,
    notesLine === '- none' ? '' : notesLine,
    '',
    '## Resume Checklist',
    '1. Open `memory/CURRENT_STATE.md`.',
    '2. Open `memory/SESSION_HISTORY.md` and read the latest entry.',
    '3. Run `git status --short`.',
    '4. Continue with the first item from `## Next`.',
    ''
  ]
    .filter((line, index, array) => {
      if (line !== '') {
        return true;
      }
      return !(array[index - 1] === '' && array[index + 1] === '');
    })
    .join('\n');
}

function buildHistoryEntry({
  timestamp,
  isoTime,
  summary,
  branch,
  commit,
  completed,
  inProgress,
  next,
  risks,
  notes,
  gitStatus
}) {
  return [
    `## ${timestamp}`,
    '',
    `- Summary: ${summary}`,
    `- Branch: ${branch}`,
    `- Head: ${commit}`,
    `- Snapshot ID: ${isoTime}`,
    '',
    '### Completed',
    asListSection(completed),
    '',
    '### In Progress',
    asListSection(inProgress),
    '',
    '### Next',
    asListSection(next),
    '',
    '### Risks',
    asListSection(risks),
    '',
    '### Notes',
    notes ? `- ${notes}` : '- none',
    '',
    '### Git Status',
    '```text',
    gitStatus || 'clean working tree',
    '```',
    ''
  ].join('\n');
}

function cmdInit() {
  ensureMemoryFiles();
  console.log(`Memory initialized in ${MEMORY_DIR}`);
}

function cmdShow() {
  ensureMemoryFiles();
  process.stdout.write(readFileSync(STATE_PATH, 'utf8'));
}

function cmdSnapshot(rawArgs) {
  ensureMemoryFiles();

  const { options, positional } = parseArgs(rawArgs);
  const summary = (options.summary || positional.join(' ').trim() || 'Snapshot update').trim();
  const completed = parseList(options.done);
  const inProgress = parseList(options['in-progress']);
  const next = parseList(options.next);
  const risks = parseList(options.risks);
  const notes = options.notes?.trim() || '';

  const timestamp = nowDisplay();
  const isoTime = nowIso();
  const branch = safeGit('git rev-parse --abbrev-ref HEAD');
  const commit = safeGit('git rev-parse --short HEAD');
  const gitStatusRaw = safeGit('git status --short');
  const gitStatusLines = gitStatusRaw === 'n/a' ? ['n/a'] : gitStatusRaw.split('\n');
  const gitStatus = gitStatusLines.slice(0, 80).join('\n');

  const stateDocument = buildStateDocument({
    timestamp,
    summary,
    branch,
    commit,
    completed,
    inProgress,
    next,
    risks,
    notes
  });

  const historyEntry = buildHistoryEntry({
    timestamp,
    isoTime,
    summary,
    branch,
    commit,
    completed,
    inProgress,
    next,
    risks,
    notes,
    gitStatus
  });

  writeFileSync(STATE_PATH, `${stateDocument}\n`, 'utf8');
  appendFileSync(HISTORY_PATH, historyEntry, 'utf8');

  console.log(`Snapshot written: ${timestamp}`);
  console.log(`State file: ${STATE_PATH}`);
  console.log(`History file: ${HISTORY_PATH}`);
}

function printHelp() {
  console.log(
    [
      'Usage:',
      '  node scripts/session-memory.mjs init',
      '  node scripts/session-memory.mjs show',
      '  node scripts/session-memory.mjs snapshot --summary "..." [options]',
      '',
      'Snapshot options:',
      '  --done "item A|item B"',
      '  --in-progress "item A|item B"',
      '  --next "item A|item B"',
      '  --risks "item A|item B"',
      '  --notes "free text"'
    ].join('\n')
  );
}

function main() {
  const command = process.argv[2] || 'help';
  const args = process.argv.slice(3);

  switch (command) {
    case 'init':
      cmdInit();
      return;
    case 'show':
      cmdShow();
      return;
    case 'snapshot':
      cmdSnapshot(args);
      return;
    case 'help':
    default:
      printHelp();
  }
}

main();
