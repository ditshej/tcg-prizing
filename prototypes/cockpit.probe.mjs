/* Probe für den Rechenkern des Cockpit-Prototyps.
   `node prototypes/cockpit.probe.mjs` im Worktree.

   Der Prototyp ist eine einzelne HTML-Datei, also schneidet diese Probe den
   reinen Kern heraus und lässt ihn ohne DOM laufen. Geprüft werden die Zahlen
   aus Ticket #28 — sie stammen aus #21 und sind von Hand nachgerechnet; wenn
   eine davon kippt, hat sich der Kern geändert und nicht die Oberfläche. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'cockpit.prototype.html'), 'utf8');
const script = html.slice(html.indexOf('<script>\n/*'), html.lastIndexOf('</script>'));

try { new Function(script.replace(/^<script>/, '')); console.log('parse: ok'); }
catch (e) { console.log('parse: FAIL —', e.message); process.exit(1); }

// Der Kern endet, wo die DOM-Bausteine anfangen.
const bi = script.indexOf('   Bausteine');
const head = script.slice(0, script.lastIndexOf('/*', bi));
const api = new Function('render', head.replace(/^<script>/, '') +
  '\nreturn { distribute, settings, st, get, suggestions, offerFor, TYPES };')(() => {});
const { distribute, settings, st } = api;

let bad = 0;
const run = (label, type, players, displays, expect) => {
  st.type = type; st.players = players; st.displays = displays.slice();
  st.pin = {}; st.val = {}; st.manualWinner = {};
  const p = distribute(settings());
  const got = p.rows.slice(0, p.depth).map((r) => r.booster).join('·');
  const ok = got === expect;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`      erwartet ${expect}\n      gerechnet ${got}`);
  return p;
};

console.log('\n── Proben aus Ticket #28 (Zahlen aus #21) ──');
run('Weekend 32, keine Reservation', 'weekend', 32, [], '29·14·7·4·3·3·2·2');
run('Weekend 32, d=(1,0,…)', 'weekend', 32, [1], '24·16·9·5·3·3·2·2');
const ot = run('Weekend 48, d=(1,0,…) — Überholung', 'weekend', 48, [1],
               '24·34·16·9·5·3·3·2');

console.log('\n── Was die Überholung meldet ──');
console.log(`   overtake: Rang ${ot.overtake.over} bekommt ${ot.overtake.gets}, `
  + `Rang ${ot.overtake.under} nur ${ot.overtake.has}`);
console.log(`   markierte Kacheln: ${ot.flagged.join(', ')}`);
api.suggestions(ot).forEach((s) => console.log('   •', s.label));

console.log('\n── Offer auf dem Ausgangsfall ──');
st.type = 'weekend'; st.players = 32; st.displays = [];
st.pin = {}; st.val = {}; st.manualWinner = {};
console.log('  ', JSON.stringify(api.offerFor(distribute(settings()))));

console.log('\n── Gleichstand: Display UND Booster auf demselben Rang ──');
st.players = 48; st.displays = [1, 1];
const tie = distribute(settings());
console.log('  ', tie.rows.slice(0, 4)
  .map((r) => `${r.booster}${r.displays ? ` (${r.reserved} aus Display)` : ''}`).join(' · '));
console.log(`   settled=${tie.settledCount} overtake=${!!tie.overtake}`);

process.exit(bad ? 1 : 0);
