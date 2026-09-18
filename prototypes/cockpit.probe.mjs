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

console.log('\n── Proben aus Ticket #32 (Zahlen aus #25) ──');
const rel = run('Release 32, keine Reservation', 'release', 32, [],
  '8·6·5·5·5·4·4·4·3·3·3·3·3·3·3·2·2·2·2·2·2·2·2·2·2·2·2·2·2·2·2·2');
console.log(`   Pool ${rel.pool.booster} · Teilnahme ${rel.participation.booster}`
  + ` · RankPool ${rel.rank.booster} · Rangtotal `
  + rel.rows.reduce((a, r) => a + r.booster, 0));
console.log(`   Tiefe ${rel.depth} (Deckel ${rel.depthCap}) · ShapedRemainder `
  + `${rel.shapedRemainder} · Kurve reicht bis Rang `
  + rel.rows.filter((r) => r.booster > 2).length);
console.log(`   PreparationList: ${rel.prep.fetchDisplays} Displays, `
  + `${rel.prep.looseBooster} lose · ${rel.prep.fetchEnvelopes} Promo-Envelopes, `
  + `Ausbeute ${rel.prep.envelopeYield} → ${rel.pool.winnersDerived} WinnerPacks `
  + `· ranked ${rel.allocation.ranked}`);

console.log('\n── Die Staffel am Release-Umschlag ⟨32, 2⟩ ──');
[0, 10, 11, 16, 21, 22, 31, 32, 43].forEach((tp) => {
  st.type = 'release'; st.players = 32; st.displays = [];
  st.pin = { tournamentPacks: true }; st.val = { tournamentPacks: tp };
  st.manualWinner = {};
  const p = distribute(settings());
  console.log(`   ${String(tp).padStart(2)} Packs → ${p.pool.winnersDerived} WinnerPacks`
    + `   (Schwellen ${p.prep.thresholds.join(' / ')})`);
});

console.log('\n── Ausbeute 1 fällt auf die alte Schwelle zurück (Weekly ⟨9, 1⟩) ──');
[5, 6, 8, 9, 14, 15].forEach((tp) => {
  st.type = 'weekly'; st.players = 32; st.displays = [];
  st.pin = { tournamentPacks: true }; st.val = { tournamentPacks: tp };
  st.manualWinner = {};
  const p = distribute(settings());
  console.log(`   ${String(tp).padStart(2)} Packs → ${p.pool.winnersDerived}`
    + `   (Schwelle ${p.prep.thresholds.join(' / ')}, alt ceil(2·9/3) = 6)`);
});

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
