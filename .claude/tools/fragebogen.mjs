#!/usr/bin/env node
// A one-screen-per-decision questionnaire for the maintainer.
//
// Node built-ins only, no build step (ADR 0004). Start it with:
//   node .claude/tools/fragebogen.mjs review/<name>-fragen.json
//
// Identifiers and comments are English; everything on screen is German,
// because this is a planning artifact, not part of the app. See README.md.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';

const FIRST_PORT = 7777;
const LAST_PORT = 7797;
const SHUTDOWN_DELAY_MS = 800;

function fail(message) {
  console.error(`\nfragebogen: ${message}\n`);
  process.exit(1);
}

function loadQuestions(argPath) {
  if (!argPath) {
    fail('Keine Fragendatei angegeben.\n  node .claude/tools/fragebogen.mjs review/<name>-fragen.json');
  }
  const file = resolve(process.cwd(), argPath);
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') fail(`Fragendatei nicht gefunden: ${file}`);
    fail(`Fragendatei nicht lesbar: ${file} (${error.code})`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    fail(`Fragendatei ist kein gültiges JSON: ${file}\n  ${error.message}`);
  }
  if (!Array.isArray(data.decisions) || data.decisions.length === 0) {
    fail(`Fragendatei enthält keine Entscheide (Feld "decisions"): ${file}`);
  }
  for (const [index, decision] of data.decisions.entries()) {
    if (!decision.id) fail(`Entscheid ${index + 1} hat keine "id": ${file}`);
    if (!Array.isArray(decision.options) || decision.options.length === 0) {
      fail(`Entscheid "${decision.id}" hat keine Optionen: ${file}`);
    }
  }
  return { file, data };
}

// `<name>-fragen.json` -> `<name>-antworten.json`, next to the source.
function answerPath(questionFile) {
  const name = basename(questionFile).replace(/-fragen\.json$/, '') || 'fragebogen';
  return join(dirname(questionFile), `${name}-antworten.json`);
}

function listen(server, port) {
  return new Promise((ok, no) => {
    server.once('error', no);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', no);
      ok(port);
    });
  });
}

async function listenOnFreePort(server) {
  for (let port = FIRST_PORT; port <= LAST_PORT; port += 1) {
    try {
      return await listen(server, port);
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
    }
  }
  fail(`Kein freier Port zwischen ${FIRST_PORT} und ${LAST_PORT} gefunden.`);
}

const page = (data) => `<!doctype html>
<html lang="de">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Entscheide ${escapeHtml(data.batch ?? '')}</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #fbfaf8;
  --card: #ffffff;
  --ink: #1d1b19;
  --muted: #6d6863;
  --line: #e2ded8;
  --accent: #7a4f2c;
  --code-bg: #f2efe9;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #171614;
    --card: #201e1b;
    --ink: #eae6e0;
    --muted: #a19a91;
    --line: #35322d;
    --accent: #d7a679;
    --code-bg: #2a2723;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 19px/1.65 ui-serif, Georgia, "Times New Roman", serif;
  padding: 4rem 1.5rem 8rem;
}
main { max-width: 46rem; margin: 0 auto; }
.progress {
  font: 500 0.8rem/1.4 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 2.5rem;
}
h1 { font-size: 1.9rem; line-height: 1.25; font-weight: 600; margin: 0 0 1rem; }
.meta {
  font: 0.85rem/1.5 ui-sans-serif, system-ui, sans-serif;
  color: var(--muted);
  margin-bottom: 2rem;
}
.severity {
  display: inline-block;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.1rem 0.7rem;
  margin-right: 0.6rem;
  color: var(--accent);
}
.stake { font-size: 1.12rem; margin: 0 0 2.5rem; }
.note {
  border-left: 3px solid var(--line);
  padding: 0.2rem 0 0.2rem 1.2rem;
  color: var(--muted);
  font-size: 0.97rem;
  margin: 0 0 2.5rem;
}
h2 {
  font: 500 0.8rem/1.4 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 3rem 0 1rem;
}
details {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  margin-bottom: 0.7rem;
}
summary {
  cursor: pointer;
  padding: 0.9rem 1.2rem;
  font-size: 1rem;
  list-style: none;
}
summary::-webkit-details-marker { display: none; }
summary::before { content: "▸ "; color: var(--muted); }
details[open] > summary::before { content: "▾ "; }
details pre {
  margin: 0;
  padding: 0 1.2rem 1.2rem;
  overflow-x: auto;
  font: 0.82rem/1.55 ui-monospace, SFMono-Regular, Menlo, monospace;
}
code {
  background: var(--code-bg);
  border-radius: 4px;
  padding: 0.08em 0.35em;
  font: 0.85em/1 ui-monospace, SFMono-Regular, Menlo, monospace;
}
label.option {
  display: block;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  padding: 1.1rem 1.3rem;
  margin-bottom: 0.8rem;
  cursor: pointer;
}
label.option:hover { border-color: var(--accent); }
label.option input { margin-right: 0.6rem; }
label.option .label { font-weight: 600; }
label.option .consequence {
  display: block;
  margin: 0.5rem 0 0 1.55rem;
  color: var(--muted);
  font-size: 0.97rem;
}
.field { margin-top: 1.6rem; }
.field > span {
  display: block;
  font: 0.85rem/1.5 ui-sans-serif, system-ui, sans-serif;
  color: var(--muted);
  margin-bottom: 0.4rem;
}
textarea, input[type=text] {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  color: inherit;
  font: inherit;
  font-size: 1rem;
  padding: 0.8rem 1rem;
  resize: vertical;
}
textarea:focus, input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
nav {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 3.5rem;
  border-top: 1px solid var(--line);
  padding-top: 1.5rem;
}
button {
  font: 500 1rem/1 ui-sans-serif, system-ui, sans-serif;
  padding: 0.85rem 1.6rem;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--card);
  color: inherit;
  cursor: pointer;
}
button:hover:not(:disabled) { border-color: var(--accent); }
button:disabled { opacity: 0.35; cursor: default; }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.summary-item {
  border-top: 1px solid var(--line);
  padding: 1.5rem 0;
}
.summary-item h3 { font-size: 1.1rem; font-weight: 600; margin: 0 0 0.5rem; }
.summary-item .answer { margin: 0.2rem 0; }
.summary-item .answer em { color: var(--muted); font-style: normal; }
.done { text-align: center; padding-top: 4rem; font-size: 1.3rem; }
</style>
<main id="app"></main>
<script>
const DATA = ${JSON.stringify(data)};
const answers = DATA.decisions.map((d) => ({
  decisionId: d.id,
  optionId: null,
  freeText: '',
  note: ''
}));
let step = 0; // 0..n-1 decisions, n = summary

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Inline \`code\` spans, so a JSON title can name an identifier as such.
const rich = (s) => esc(s).replace(/\`([^\`]+)\`/g, '<code>$1</code>');

function renderDecision(i) {
  const d = DATA.decisions[i];
  const a = answers[i];
  return \`
    <p class="progress">Entscheid \${i + 1} von \${DATA.decisions.length} · Stapel \${esc(DATA.batch || '')}</p>
    <h1>\${rich(d.title)}</h1>
    <p class="meta">
      <span class="severity">\${esc(d.severity || '')}</span>
      PR #\${esc(d.origin?.pr ?? '?')} · Befund \${esc(d.origin?.finding ?? '?')}
    </p>
    <p class="stake">\${rich(d.stake || '')}</p>
    \${d.note ? \`<p class="note">\${rich(d.note)}</p>\` : ''}
    \${(d.evidence || []).length ? '<h2>Belege</h2>' : ''}
    \${(d.evidence || []).map((e) => \`
      <details><summary>\${rich(e.heading)}</summary><pre>\${esc(e.text)}</pre></details>\`).join('')}
    <h2>Wie entscheidest du?</h2>
    \${d.options.map((o) => \`
      <label class="option">
        <input type="radio" name="option" value="\${esc(o.id)}" \${a.optionId === o.id ? 'checked' : ''}>
        <span class="label">\${rich(o.label)}</span>
        <span class="consequence">\${rich(o.consequence || '')}</span>
      </label>\`).join('')}
    \${d.allowFreeText === false ? '' : \`
      <label class="option">
        <input type="radio" name="option" value="__other__" \${a.optionId === '__other__' ? 'checked' : ''}>
        <span class="label">anders</span>
        <span class="consequence">
          <textarea id="freeText" rows="3" placeholder="Was stattdessen?">\${esc(a.freeText)}</textarea>
        </span>
      </label>\`}
    <label class="field">
      <span>Notiz (optional)</span>
      <textarea id="note" rows="3">\${esc(a.note)}</textarea>
    </label>
    <nav>
      <button id="back" \${i === 0 ? 'disabled' : ''}>Zurück</button>
      <button id="next" class="primary">\${i === DATA.decisions.length - 1 ? 'Zur Übersicht' : 'Weiter'}</button>
    </nav>\`;
}

function renderSummary() {
  return \`
    <p class="progress">Übersicht · Stapel \${esc(DATA.batch || '')} · \${esc(DATA.date || '')}</p>
    <h1>Deine Antworten</h1>
    \${DATA.decisions.map((d, i) => {
      const a = answers[i];
      const chosen = d.options.find((o) => o.id === a.optionId);
      let text;
      if (chosen) text = rich(chosen.label);
      else if (a.optionId === '__other__') text = 'anders: ' + (a.freeText ? rich(a.freeText) : '<em>nichts eingetragen</em>');
      else text = '<em>noch offen</em>';
      return \`<div class="summary-item">
        <h3>\${rich(d.title)}</h3>
        <p class="answer">\${text}</p>
        \${a.note ? \`<p class="answer"><em>Notiz:</em> \${rich(a.note)}</p>\` : ''}
      </div>\`;
    }).join('')}
    <nav>
      <button id="back">Zurück</button>
      <button id="send" class="primary">Antworten speichern</button>
    </nav>\`;
}

function collect() {
  if (step >= DATA.decisions.length) return;
  const a = answers[step];
  const picked = document.querySelector('input[name=option]:checked');
  a.optionId = picked ? picked.value : null;
  const free = document.getElementById('freeText');
  if (free) a.freeText = free.value;
  a.note = document.getElementById('note').value;
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = step < DATA.decisions.length ? renderDecision(step) : renderSummary();
  window.scrollTo(0, 0);
  const back = document.getElementById('back');
  if (back) back.onclick = () => { collect(); step -= 1; render(); };
  const next = document.getElementById('next');
  if (next) next.onclick = () => { collect(); step += 1; render(); };
  const send = document.getElementById('send');
  if (send) send.onclick = submit;
  // Typing an own answer is the choice; nobody should have to tick the radio too.
  const free = document.getElementById('freeText');
  if (free) free.onfocus = () => { document.querySelector('input[value="__other__"]').checked = true; };
}

async function submit() {
  document.getElementById('send').disabled = true;
  const body = {
    batch: DATA.batch,
    date: DATA.date,
    answeredAt: new Date().toISOString(),
    answers: answers.map((a) => ({
      decisionId: a.decisionId,
      optionId: a.optionId === '__other__' ? null : a.optionId,
      freeText: a.optionId === '__other__' ? a.freeText : '',
      note: a.note
    }))
  };
  const response = await fetch('/answers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  document.getElementById('app').innerHTML = result.ok
    ? '<p class="done">Gespeichert — du kannst das Fenster schliessen.</p>'
    : '<p class="done">Konnte nicht gespeichert werden: ' + esc(result.error) + '</p>';
}

render();
</script>
</html>`;

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function readBody(request) {
  return new Promise((ok, no) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) no(new Error('Antwort zu gross'));
    });
    request.on('end', () => ok(body));
    request.on('error', no);
  });
}

const { file, data } = loadQuestions(process.argv[2]);
const target = answerPath(file);
const html = page(data);

const server = createServer(async (request, response) => {
  if (request.method === 'POST' && request.url === '/answers') {
    try {
      const body = JSON.parse(await readBody(request));
      writeFileSync(target, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true }));
      console.log(`fragebogen: Antworten geschrieben nach ${target}`);
      setTimeout(() => server.close(() => process.exit(0)), SHUTDOWN_DELAY_MS);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: false, error: error.message }));
      console.error(`fragebogen: Speichern fehlgeschlagen — ${error.message}`);
    }
    return;
  }
  if (request.method === 'GET' && (request.url === '/' || request.url.startsWith('/?'))) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
    return;
  }
  if (request.url === '/favicon.ico') {
    response.writeHead(204);
    response.end();
    return;
  }
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('nicht gefunden');
});

const port = await listenOnFreePort(server);
const url = `http://127.0.0.1:${port}/`;
console.log(`\nfragebogen: ${data.decisions.length} Entscheide aus ${file}`);
console.log(`fragebogen: ${url}\n`);
if (process.platform === 'darwin' && !process.env.FRAGEBOGEN_NO_OPEN) {
  spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
}
