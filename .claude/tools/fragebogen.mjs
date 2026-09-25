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

// ---------------------------------------------------------------------------
// Charts
//
// An evidence entry of type "chart" is a declarative spec in the question file;
// the server turns it into inline SVG here. Node built-ins only, no packages,
// no build step (ADR 0004). Colours come from the dataviz palette and are
// emitted as CSS custom properties, so light and dark are two selected sets
// rather than an automatic flip.

const VIZ = {
  light: {
    surface: '#ffffff',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    s1: '#2a78d6',
    s2: '#eb6834',
    s3: '#1baf7a',
    critical: '#d03b3b',
    context: '#9a988f',
    ghost: '#e4e3dc',
    target: '#8a887f'
  },
  dark: {
    surface: '#201e1b',
    grid: '#2f2d29',
    axis: '#45423c',
    s1: '#3987e5',
    s2: '#d95926',
    s3: '#199e70',
    critical: '#d03b3b',
    context: '#78756e',
    ghost: '#3a3833',
    target: '#8a877f'
  }
};

const INK_CANDIDATES = ['#ffffff', '#141312'];

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a, b) {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

// A label set inside a coloured fill takes whichever ink clears contrast better.
function inkOn(fill) {
  return INK_CANDIDATES.reduce((best, ink) =>
    contrastRatio(ink, fill) > contrastRatio(best, fill) ? ink : best);
}

function vizCssVars(mode) {
  const palette = VIZ[mode];
  const lines = Object.entries(palette).map(([role, hex]) => `  --viz-${role}: ${hex};`);
  for (const slot of ['s1', 's2', 's3', 'critical', 'context']) {
    lines.push(`  --viz-on-${slot}: ${inkOn(palette[slot])};`);
  }
  return lines.join('\n');
}

let svgSeq = 0;

// Rough advance width; used only to decide whether a label fits inside a mark.
const textWidth = (value, size) => String(value).length * size * 0.58;

function svgText(x, y, value, { cls = 'viz-muted', anchor = 'start', size = 12, weight = 400 } = {}) {
  return `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}">${escapeHtml(value)}</text>`;
}

// Horizontal bar: square at the baseline, rounded data-end.
function barPath(x, y, width, height, radius) {
  if (width <= 0.5) return '';
  const r = Math.max(0, Math.min(radius, width, height / 2));
  if (r === 0) return `M${x} ${y}h${width}v${height}h${-width}z`;
  return `M${x} ${y}h${width - r}a${r} ${r} 0 0 1 ${r} ${r}v${height - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(width - r)}z`;
}

// Vertical column: square at the baseline, rounded cap.
function colPath(x, y, width, height, radius) {
  if (height <= 0.5) return '';
  const r = Math.max(0, Math.min(radius, width / 2, height));
  if (r === 0) return `M${x} ${y}h${width}v${height}h${-width}z`;
  return `M${x} ${y + height}V${y + r}a${r} ${r} 0 0 1 ${r} ${-r}h${width - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V${y + height}z`;
}

function legendHtml(items) {
  const keys = items.map((item) => {
    let style = `background: var(--viz-${item.tone})`;
    if (item.tone === 'hatch') {
      style = 'background: repeating-linear-gradient(45deg, var(--viz-critical) 0 3px, var(--viz-surface) 3px 5px)';
    } else if (item.tone === 'ghost') {
      // The silhouette's key carries its edge, the way it appears in the panel.
      style += '; box-shadow: inset 0 2px 0 var(--viz-target)';
    }
    return `<li><span class="viz-key" style="${style}"></span>${richHtml(item.label)}</li>`;
  });
  return `<ul class="viz-legend">${keys.join('')}</ul>`;
}

// Stacked bars against a reference line. Anything a bar pushes past the
// reference is redrawn as hatched overhang, so "too long" is visible as such.
function renderStackedBars(spec) {
  const width = 720;
  const gutter = 56;
  const padRight = 92;
  const plotX = gutter;
  const plotWidth = width - gutter - padRight;
  const barHeight = 24;
  const rowGap = 30;
  const topPad = 34;
  const brackets = spec.brackets || [];
  const bracketBand = brackets.length ? 46 : 12;
  const height = topPad + spec.bars.length * (barHeight + rowGap) + bracketBand;

  const totals = spec.bars.map((bar) => bar.segments.reduce((sum, seg) => sum + seg.value, 0));
  const reference = spec.reference?.value ?? null;
  const max = spec.max || Math.max(...totals, reference ?? 0) * 1.06;
  const toX = (value) => plotX + (value / max) * plotWidth;
  const toneOf = {};
  spec.series.forEach((series, index) => { toneOf[series.key] = `s${index + 1}`; });

  const id = `viz${++svgSeq}`;
  const parts = [];

  parts.push(`<defs><pattern id="${id}-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<rect width="7" height="7" fill="var(--viz-critical)"/>`
    + `<line x1="0" y1="0" x2="0" y2="7" stroke="var(--viz-surface)" stroke-width="2.6"/>`
    + `</pattern></defs>`);

  const rowY = (index) => topPad + index * (barHeight + rowGap);
  const lastBarBottom = rowY(spec.bars.length - 1) + barHeight;

  if (spec.rowsLabel) {
    parts.push(svgText(0, topPad - 10, spec.rowsLabel, { anchor: 'start', size: 12 }));
  }

  if (reference !== null) {
    const x = toX(reference);
    parts.push(`<line x1="${x}" y1="${topPad - 16}" x2="${x}" y2="${lastBarBottom + 8}" class="viz-ref"/>`);
    parts.push(svgText(x, topPad - 22, spec.reference.label, { anchor: 'middle', size: 12, weight: 600 }));
  }

  spec.bars.forEach((bar, barIndex) => {
    const y = rowY(barIndex);
    parts.push(svgText(plotX - 12, y + barHeight / 2 + 5, bar.label,
      { cls: 'viz-strong', anchor: 'end', size: 14, weight: 600 }));

    // Fill pieces: a segment that crosses the reference is cut in two.
    const pieces = [];
    let cursor = 0;
    for (const segment of bar.segments) {
      const start = cursor;
      const end = cursor + segment.value;
      cursor = end;
      if (reference !== null && start < reference && end > reference) {
        pieces.push({ key: segment.key, start, end: reference, over: false });
        pieces.push({ key: segment.key, start: reference, end, over: true });
      } else {
        pieces.push({ key: segment.key, start, end, over: reference !== null && start >= reference });
      }
    }

    pieces.forEach((piece, index) => {
      const isFirst = index === 0;
      const isLast = index === pieces.length - 1;
      const x0 = toX(piece.start) + (isFirst ? 0 : 1);
      const x1 = toX(piece.end) - (isLast ? 0 : 1);
      const fill = piece.over ? `url(#${id}-hatch)` : `var(--viz-${toneOf[piece.key]})`;
      parts.push(`<path d="${barPath(x0, y, x1 - x0, barHeight, isLast ? 4 : 0)}" fill="${fill}"/>`);
    });

    // Labels belong to whole segments, not to the pieces the reference cut.
    cursor = 0;
    for (const segment of bar.segments) {
      const start = cursor;
      const end = cursor + segment.value;
      cursor = end;
      const boxWidth = toX(end) - toX(start);
      const label = String(segment.value);
      if (boxWidth < textWidth(label, 12) + 18) continue;
      const centre = (start + end) / 2;
      const overCentre = reference !== null && centre >= reference;
      const tone = overCentre ? 'critical' : toneOf[segment.key];
      parts.push(svgText(toX(centre), y + barHeight / 2 + 4, label,
        { cls: `viz-on-${tone}`, anchor: 'middle', size: 12, weight: 600 }));
    }

    if (bar.total) {
      parts.push(svgText(toX(totals[barIndex]) + 10, y + barHeight / 2 + 5, bar.total,
        { cls: 'viz-strong', size: 13, weight: 600 }));
    }
  });

  for (const bracket of brackets) {
    const y = rowY(bracket.bar ?? spec.bars.length - 1) + barHeight + 11;
    const x0 = toX(bracket.from);
    const x1 = toX(bracket.to);
    parts.push(`<path d="M${x0} ${y}v6h${x1 - x0}v-6" class="viz-bracket"/>`);
    parts.push(svgText((x0 + x1) / 2, y + 22, bracket.label,
      { cls: bracket.tone === 'critical' ? 'viz-strong' : 'viz-muted', anchor: 'middle', size: 12 }));
  }

  const svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-t ${id}-d">`
    + `<title id="${id}-t">${escapeHtml(spec.title)}</title>`
    + `<desc id="${id}-d">${escapeHtml(spec.description || spec.title)}</desc>`
    + parts.join('')
    + `</svg>`;

  const legend = legendHtml([
    ...spec.series.map((series, index) => ({ tone: `s${index + 1}`, label: series.label })),
    ...(spec.overhangLegend ? [{ tone: 'hatch', label: spec.overhangLegend }] : [])
  ]);
  return { svg, legend };
}

// Small multiples: one panel per candidate row, the target row as a silhouette
// behind each. Where the two coincide, nothing of the silhouette shows.
function renderSmallMultiples(spec) {
  const width = 720;
  const gutter = 126;
  const padRight = 10;
  const plotX = gutter;
  const plotWidth = width - gutter - padRight;
  const panelHeight = 78;
  const panelGap = 18;
  const axisBand = 24;
  const topPad = 12;
  const height = topPad + spec.panels.length * (panelHeight + panelGap) + axisBand;

  const count = Math.max(spec.target.values.length, ...spec.panels.map((p) => p.values.length));
  const band = plotWidth / count;
  const barWidth = Math.min(24, band - 8);
  const max = spec.max || Math.max(...spec.target.values, ...spec.panels.flatMap((p) => p.values));
  const toX = (index) => plotX + index * band + (band - barWidth) / 2;
  const toY = (value, top) => top + panelHeight - (value / max) * panelHeight;
  const TONES = { match: 's1', current: 's2' };

  const id = `viz${++svgSeq}`;
  const parts = [];

  spec.panels.forEach((panel, panelIndex) => {
    const top = topPad + panelIndex * (panelHeight + panelGap);
    const tone = TONES[panel.tone] || 'context';

    parts.push(`<line x1="${plotX}" y1="${top + panelHeight}" x2="${plotX + plotWidth}" y2="${top + panelHeight}" class="viz-base"/>`);

    // The target row is one continuous step area, edge to edge, so the bars'
    // own air shows it too: where a row matches, the silhouette has no lip.
    const base = top + panelHeight;
    const steps = spec.target.values
      .map((value, index) => `V${toY(value, top)}H${plotX + (index + 1) * band}`)
      .join('');
    parts.push(`<path d="M${plotX} ${base}${steps}V${base}z" fill="var(--viz-ghost)"/>`);

    panel.values.forEach((value, index) => {
      const y = toY(value, top);
      parts.push(`<path d="${colPath(toX(index), y, barWidth, base - y, 4)}" fill="var(--viz-${tone})"/>`);
    });

    // The silhouette's own edge, drawn last: it is never hidden by a row, and
    // where the row matches it lies flat on every cap.
    parts.push(`<path d="M${plotX} ${toY(spec.target.values[0], top)}${steps}" class="viz-target"/>`);

    // One direct label per panel: the opening rank, where the rows differ most.
    const first = panel.values[0];
    const headY = toY(first, top);
    const inside = headY - top < 16;
    parts.push(svgText(toX(0) + barWidth / 2, inside ? headY + 14 : headY - 6, String(first), {
      cls: inside ? `viz-on-${tone}` : 'viz-strong',
      anchor: 'middle',
      size: 12,
      weight: 600
    }));

    // The gutter label sits on the baseline, beside the data, not floating in
    // the empty air above a flat row.
    parts.push(svgText(plotX - 14, base - (panel.tag ? 16 : 3), panel.label,
      { cls: 'viz-strong', anchor: 'end', size: 14, weight: 600 }));
    if (panel.tag) {
      parts.push(svgText(plotX - 14, base - 2, panel.tag, { anchor: 'end', size: 11 }));
    }
  });

  const axisY = topPad + spec.panels.length * (panelHeight + panelGap) + 6;
  for (const index of [0, 4, 9, count - 1]) {
    parts.push(svgText(toX(index) + barWidth / 2, axisY, String(index + 1), { anchor: 'middle', size: 11 }));
  }
  parts.push(svgText(plotX - 14, axisY, spec.xLabel || 'Rang', { anchor: 'end', size: 11 }));

  const svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-t ${id}-d">`
    + `<title id="${id}-t">${escapeHtml(spec.title)}</title>`
    + `<desc id="${id}-d">${escapeHtml(spec.description || spec.title)}</desc>`
    + parts.join('')
    + `</svg>`;

  const legend = legendHtml([
    { tone: 'ghost', label: spec.target.label },
    { tone: 's1', label: spec.matchLabel || 'Treffer' },
    { tone: 's2', label: spec.currentLabel || 'aktueller Wert' },
    { tone: 'context', label: spec.contextLabel || 'übrige' }
  ]);
  return { svg, legend };
}

const CHART_KINDS = {
  'stacked-bars': renderStackedBars,
  'small-multiples': renderSmallMultiples
};

// Inline `code` spans; the server's twin of the client's `rich`.
function richHtml(value) {
  return escapeHtml(value).replace(/`([^`]+)`/g, '<code>$1</code>');
}

// Walks the question data and replaces every chart spec with rendered markup,
// so the client only has to drop the string in.
function renderCharts(data) {
  for (const decision of data.decisions) {
    for (const entry of decision.evidence || []) {
      if (entry.type !== 'chart') continue;
      const render = CHART_KINDS[entry.chart?.kind];
      if (!render) fail(`Unbekannter Diagrammtyp "${entry.chart?.kind}" bei Entscheid "${decision.id}".`);
      const { svg, legend } = render(entry.chart);
      entry.svg = svg;
      entry.legend = legend;
      delete entry.chart;
    }
  }
  return data;
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
${vizCssVars('light')}
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
${vizCssVars('dark')}
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
figure.chart {
  margin: 0 0 0.7rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  padding: 1.4rem 1.4rem 1.2rem;
}
figure.chart > figcaption {
  font: 500 0.8rem/1.4 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 1.2rem;
}
figure.chart svg { display: block; width: 100%; height: auto; overflow: visible; }
figure.chart svg text {
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}
svg .viz-strong { fill: var(--ink); }
svg .viz-muted { fill: var(--muted); }
svg .viz-on-s1 { fill: var(--viz-on-s1); }
svg .viz-on-s2 { fill: var(--viz-on-s2); }
svg .viz-on-s3 { fill: var(--viz-on-s3); }
svg .viz-on-context { fill: var(--viz-on-context); }
svg .viz-on-critical { fill: var(--viz-on-critical); }
svg .viz-ref { stroke: var(--muted); stroke-width: 1.5; }
svg .viz-base { stroke: var(--viz-axis); stroke-width: 1; }
svg .viz-grid { stroke: var(--viz-grid); stroke-width: 1; }
svg .viz-bracket { fill: none; stroke: var(--viz-axis); stroke-width: 1; }
svg .viz-target { fill: none; stroke: var(--viz-target); stroke-width: 1.5; stroke-linejoin: round; }
.viz-legend {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1.2rem;
  margin: 1.3rem 0 0;
  padding: 0;
  font: 0.82rem/1.5 ui-sans-serif, system-ui, sans-serif;
  color: var(--muted);
}
.viz-legend li { display: flex; align-items: center; gap: 0.45rem; }
.viz-key { width: 0.8rem; height: 0.8rem; border-radius: 3px; flex: none; }
.chart-caption {
  font: 0.86rem/1.6 ui-sans-serif, system-ui, sans-serif;
  color: var(--muted);
  margin: 1.1rem 0 0;
}
figure.chart > details { margin: 1.1rem 0 0; }
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
const DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};
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

// A chart shows on arrival — that is the point of it. The numbers it was made
// from stay one click away underneath, never replaced by the picture.
function renderEvidence(e) {
  if (e.type !== 'chart') {
    return \`<details><summary>\${rich(e.heading)}</summary><pre>\${esc(e.text)}</pre></details>\`;
  }
  return \`<figure class="chart">
    <figcaption>\${rich(e.heading)}</figcaption>
    \${e.svg}
    \${e.legend}
    \${e.caption ? \`<p class="chart-caption">\${rich(e.caption)}</p>\` : ''}
    \${e.text ? \`<details><summary>\${rich(e.numbersLabel || 'Die Zahlen')}</summary><pre>\${esc(e.text)}</pre></details>\` : ''}
  </figure>\`;
}

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
    \${(d.evidence || []).map(renderEvidence).join('')}
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
const html = page(renderCharts(data));

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
