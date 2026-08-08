/* UCI Race Observatory — application shell.
 *
 * Architecture (MASTERPROMPT §8.1, §8.6): one piece of shared interaction
 * state — the route-distance cursor — which every view subscribes to. Profile,
 * route line, sky ribbon and itinerary table are projections of the same axis,
 * so they cannot disagree. State serialises to the URL, making any finding a
 * reproducible deep link.
 *
 * Loading: a small index up front, one lazily-fetched chunk per stage, cached
 * after first use. Cursor subscribers are re-registered on every stage render
 * and therefore cleared first — appending without clearing leaked a listener
 * per render and made scrubbing progressively slower.
 */

const DATA = 'data/';

const db = { index: null, races: null, quality: null, products: new Map(),
             chunks: new Map(), raceChunks: new Map() };

/* The quality register and the gap register were 57 % of index.json and no
 * page rendered either on load — they were reachable only by typing into the
 * command palette. Honesty data that costs every visitor bytes and shows
 * nobody anything is neither honest nor data. They live in their own file
 * now, fetched the first time something actually needs them. */
async function loadQuality() {
  if (db.quality) return db.quality;
  const r = await fetch(productPath(state.race || productSlug())
                       + 'quality.json');
  if (!r.ok) throw new Error('quality.json ' + r.status);
  db.quality = await r.json();
  return db.quality;
}
const state = { stage: null, km: null, strict: false, uncertainty: true,
                view: 'stage', race: null };

/* Set while this module is writing the hash itself, so the hashchange handler
   can tell a real back/forward from its own echo. */
let suppressHashRoute = false;

/* Cursor subscribers: cleared and rebuilt whenever the stage view is redrawn. */
let cursorSubs = [];
const onCursor = fn => { cursorSubs.push(fn); fn(); };
const clearCursorSubs = () => { cursorSubs = []; };
const emitCursor = () => { for (const fn of cursorSubs) fn(); writeUrl(); };

const $ = s => document.querySelector(s);
const el = (t, c, x) => {
  const n = document.createElement(t);
  if (c) n.className = c;
  if (x != null) n.textContent = x;
  return n;
};
const DEM_NAMES = {
  IGN_RGE_ALTI: 'IGN RGE ALTI',
  COPERNICUS_GLO90: 'Copernicus GLO-90',
  GPX_EMBEDDED_ELE: 'trace elevation',
};
const prettyDem = s => DEM_NAMES[s] || s;
const fmt = (v, d = 1) => v == null ? '—' : Number(v).toFixed(d);
const hhmmss = s => {
  if (s == null) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}' ${String(x).padStart(2, '0')}"`
           : `${m}' ${String(x).padStart(2, '0')}"`;
};

function readUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('stage')) state.stage = +p.get('stage');
  if (p.get('km')) state.km = +p.get('km');
  state.strict = p.get('strict') === '1';
  state.uncertainty = p.get('unc') !== '0';
  // The fleet is the homepage.
  //
  // This read `p.get('view') === 'races' ? 'races' : 'stage'`, so an address
  // with no view named — which is every arrival at the bare site — opened the
  // stage view. Boot then filled in the newest raced stage and `writeUrl`
  // stamped it into the address bar, which is why visiting the site landed a
  // reader on `#stage=20` of whichever race is the default product. Nothing
  // was broken in the sense of failing; the observatory simply had no front
  // door, and presented a project covering 137 races as one stage of one of
  // them.
  //
  // Explicit wins, then inference, then the fleet. An address naming a stage
  // or a race still opens the stage view, so every link already shared —
  // `#stage=12`, `#stage=4&race=giro-ditalia-2026-uwt` — resolves exactly
  // where it did.
  const named = p.get('view');
  state.view = named === 'stage' ? 'stage'
             : named === 'races' ? 'races'
             : (p.get('stage') || p.get('race')) ? 'stage'
             : 'races';
  if (p.get('race')) state.race = p.get('race');
  // `zoom=a-b` restricts the profile, strip and relief to a stretch of the
  // route. In the URL because §15 asks for range selection and this project's
  // rule is that a finding has to be a link somebody else can open — "look at
  // the last 8 km" is a finding.
  const z = p.get('zoom');
  state.range = null;
  if (z) {
    const [a, b] = z.split(':').map(Number);
    if (isFinite(a) && isFinite(b) && b > a) state.range = [a, b];
  }
}
/* Serialise the view to the hash.
 *
 * `push` distinguishes a navigation from a cursor move, and until now nothing
 * did: every call was replaceState, so the history stack held exactly one
 * entry however far you had travelled and Back left the site altogether.
 *
 * It cannot simply be pushState everywhere either. The cursor writes here on
 * every pointer move over the profile — one scrub across a mountain stage is
 * hundreds of calls — and pushing those would bury the previous stage under a
 * few hundred history entries, which is a worse back button than none. So
 * navigation pushes and scrubbing replaces.
 */
function writeUrl(push = false) {
  const p = new URLSearchParams();
  // The stage cursor belongs to the stage view. On the fleet there is no
  // stage on screen, so writing one would hand a reader a link to somewhere
  // their own screen is not — and would put `stage=20` back into the address
  // of the homepage, which is the thing being fixed.
  //
  // Guarded, because `p.set('stage', null)` writes the string "stage=null",
  // and a link carrying it reads back as NaN.
  if (state.view === 'stage') {
    if (state.stage != null) p.set('stage', state.stage);
    if (state.km != null) p.set('km', state.km.toFixed(2));
    // The selected race is in the URL for the same reason the stage is:
    // a finding has to be a link somebody else can open. Inside the stage
    // guard with the rest, because `readUrl` infers the stage view from a
    // race being named — leaving it outside would make the fleet's own
    // address read back as a stage view and bounce a reader straight off the
    // homepage again.
    const dflt = db.races && db.races.manifest.default_product;
    if (state.race && state.race !== dflt) p.set('race', state.race);
    // Colon-separated, not hyphen: a route kilometre is never negative but a
    // hyphen still reads ambiguously next to a decimal, and `8.5-12` invites
    // a parser to find three numbers in it.
    if (state.range) {
      p.set('zoom', state.range[0].toFixed(2) + ':' + state.range[1].toFixed(2));
    }
  }
  if (state.strict) p.set('strict', '1');
  if (!state.uncertainty) p.set('unc', '0');
  // No `view=races`: the fleet is the default, so its address is the bare
  // site. Naming the default in the URL is how the homepage acquired a hash
  // it did not need.
  const qs = p.toString();
  // An empty query is the home view, and its address is the site itself —
  // not a lone `#`, which is a character that survives copy-paste and makes
  // the front page look like a fragment of something.
  const url = qs ? '#' + qs : location.pathname + location.search;
  const here = location.hash || location.pathname + location.search;
  if (url === here) return;
  // `hashchange` fires on both, and the handler re-routes; the guard flag
  // stops it undoing the render that has just been done.
  suppressHashRoute = true;
  if (push) history.pushState(null, '', url);
  else history.replaceState(null, '', url);
  setTimeout(() => { suppressHashRoute = false; }, 0);
}

const stageMeta = () => db.index.stages.find(s => s.n === state.stage);
const chunk = () => {
  const per = db.chunks.get(state.race || productSlug());
  return (per && per.get(state.stage)) || null;
};
const profile = () => (chunk() && chunk().profile) || null;
const waypoints = () => (chunk() && chunk().waypoints) || [];
const climbs = () => (chunk() && chunk().climbs) || [];
const officialPoints = () => (chunk() && chunk().official_points) || [];

/* The organiser publishes course furniture as labelled points. A summit
   finish arrives as one point that is both, so the category rides alongside
   the kind rather than replacing it. */
const OFFICIAL_GLYPH = {
  START_REAL: { t: '0' }, FINISH: { t: '▮' }, SPRINT: { t: 'S' },
  SUMMIT: { t: '▲' }, TIME_CHECK: { t: 'T' }, START_CEREMONIAL: { t: 'D' },
};
const DEPARTURE_LABEL = {
  DNF: 'Abandoned during this stage',
  DNS: 'Did not start this stage',
  OTL: 'Finished outside the time limit',
  DSQ: 'Disqualified',
  HD: 'Withdrawn by the race jury',
};
const OFFICIAL_LABEL = {
  START_REAL: 'KM0, the real start', FINISH: 'Finish',
  SPRINT: 'Intermediate sprint', SUMMIT: 'Categorised summit',
  TIME_CHECK: 'Intermediate time check',
  START_CEREMONIAL: 'Ceremonial start',
};
const results = () => (chunk() && chunk().results) || [];

/* Where this stage's result came from, as the chunk records it.
 *
 * This was a literal — 'letour.fr (TIER_0_OFFICIAL)' — printed under every
 * result row on every race. True of the Tour, and of nothing else: the moment
 * a second race gained per-stage results the panel would have credited the
 * Giro's placings to the Tour's organiser. Only the Tour has them today, so it
 * was a latent lie rather than a live one; a source line that cannot be wrong
 * yet is still a source line nobody can check. */
const resultsSource = () => {
  const rs = chunk() && chunk().results_source;
  return rs && rs.source
    ? `${rs.source}${rs.tier ? ` (${rs.tier})` : ''}`
    : 'not recorded for this stage';
};

/* Every product lives under its own slug. It used to live at `data/` with the
 * race implied by whichever one had been exported, which is why 27 stages of
 * Giro and Vuelta geometry sat finished in the database and appeared nowhere
 * on the site: a path that names no race can only ever serve one. */
const productPath = slug => `${DATA}product/${slug}/`;

async function loadProduct(slug) {
  if (db.products.has(slug)) return db.products.get(slug);
  const r = await fetch(productPath(slug) + 'index.json');
  if (!r.ok) throw new Error(`no product for ${slug}`);
  const j = await r.json();
  db.products.set(slug, j);
  db.chunks.set(slug, new Map());
  return j;
}

async function loadStage(n) {
  // The slug comes from the product that is loaded, not from the race the
  // reader selected, and the two are allowed to differ.
  //
  // `state.race` names whatever race was picked; 64 of the 98 published races
  // have no product tree at all, only a race chunk. Composing a stage path
  // from `state.race` while `db.index` holds a different race's product asks
  // the server for a file that cannot exist — a key assembled from two
  // sources that do not agree, which is the shape of most of the defects
  // this project has had. It answered 404 on 50 of the 98 race pages, and
  // the throw below then logged a second error on top of the browser's.
  //
  // An absent product is an expected state, so it returns null rather than
  // raising: the caller already renders a designed absence for it, and a
  // `console.error` for something the interface handles by design is noise
  // that hides the errors worth seeing.
  const slug = productSlug();
  if (!slug || (state.race && state.race !== slug)) return null;
  const per = db.chunks.get(slug) || new Map();
  if (per.has(n)) return per.get(n);
  const r = await fetch(`${productPath(slug)}stage/${n}.json`);
  if (!r.ok) throw new Error(`stage ${n} chunk unavailable`);
  const j = await r.json();
  per.set(n, j);
  db.chunks.set(slug, per);
  return j;
}

/* Columnar profile → the {km,e,g,lon,lat} records the views want. Done once
   per stage load, not per render. */
/* Level of detail (§15: "adaptive sampling/level of detail for long Grand
 * Tour stages").
 *
 * The overview is 900 points whatever the stage is, so its spatial resolution
 * is a consequence of the stage's length: 14.7 m per point on a 12.7 km time
 * trial, 329.7 m on a 297.7 km classic. Whole-stage that is invisible. Zoomed
 * it is the thing you are looking at — asking to see the Poggio through a
 * 330 m sampling floor gets you a straight line where the ramp is.
 *
 * The fine series lives in its own file and is fetched once, the first time a
 * reader actually narrows the window past a quarter of the stage. A reader
 * who never zooms never pays for it, so the three-request load budget is
 * untouched, and the fetch happens while the coarse line is already drawn
 * rather than in place of drawing anything.
 */
const hiProfiles = new Map();
let hiPending = null;

function hiKey() {
  // Keyed on the loaded product for the same reason loadStage is: the race
  // the reader selected may not be the one whose chunks exist.
  return productSlug() + '/' + state.stage;
}

function wantHiProfile() {
  if (!state.range) return false;
  const p = profile();
  if (!p || !p.hi_points || !p.km || !p.km.length) return false;
  const full = p.km[p.km.length - 1];
  // A quarter of the stage. Above that the overview already has more points
  // in view than the chart has pixels to draw them on, so fetching finer data
  // would buy nothing a reader could see.
  return full > 0 && (state.range[1] - state.range[0]) / full < 0.25;
}

function ensureHiProfile() {
  const key = hiKey();
  if (hiProfiles.has(key) || hiPending === key) return;
  const slug = productSlug();
  if (!slug || (state.race && state.race !== slug)) return;
  hiPending = key;
  fetch(`data/product/${slug}/stage/${state.stage}.hi.json`)
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      hiPending = null;
      if (!d || !d.km) return;
      const rows = [];
      for (let i = 0; i < d.km.length; i++) {
        rows.push({ km: d.km[i], e: d.e[i], g: d.g[i], lon: null, lat: null });
      }
      hiProfiles.set(key, rows);
      // Only redraw if the reader is still looking at the same thing.
      if (hiKey() === key && wantHiProfile()) renderProfile();
    })
    .catch(() => { hiPending = null; });
}

/* The rows the profile line should be drawn from: the fine series when it is
 * both wanted and here, the overview otherwise. Deliberately not used by the
 * map or the relief view — the fine series carries no coordinates, because
 * neither of those redraws differently at a finer elevation resolution. */
function profileDrawRows() {
  if (wantHiProfile()) {
    ensureHiProfile();
    const rows = hiProfiles.get(hiKey());
    if (rows) return rows;
  }
  return profileRows();
}

function profileRows() {
  const p = profile();
  if (!p) return [];
  if (p._rows) return p._rows;
  const rows = [];
  for (let i = 0; i < p.km.length; i++) {
    rows.push({ km: p.km[i], e: p.e[i], g: p.g[i], lon: p.lon[i], lat: p.lat[i] });
  }
  Object.defineProperty(p, '_rows', { value: rows, enumerable: false });
  return rows;
}

/* How this stage's line was arrived at, in the reader's own terms. The
   kilometre axis rests on two published anchors, and saying how closely the
   line met them is the difference between a chart and a measurement. */
function provenanceNote() {
  const pv = chunk() && chunk().route_provenance;
  if (!pv) return '';
  const bits = [];
  if (pv.parts_joined > 1) {
    bits.push(`${pv.parts_joined} published parts joined end to end`);
  }
  if (pv.oriented && pv.oriented !== 'as-published') {
    bits.push('reversed to put the published finish at the end');
  }
  if (pv.km0_residual_m != null) {
    bits.push(`KM0 within ${Math.round(pv.km0_residual_m)} m of the published KM0`);
  }
  return bits.length ? ' · ' + bits.join(' · ') : '';
}

/* Designed absence — every empty state explains itself (§8.6). */
function absence(host, title, reason, gapKey, unlock) {
  host.innerHTML = '';
  const box = el('div', 'absence');
  // A mark, so an empty panel reads as a designed state at a glance rather
  // than as a panel that failed to load. Deliberately not a warning triangle:
  // a recorded gap is not an error, and dressing it as one would make the
  // honest parts of this site look like the broken parts.
  const mark = svgEl('svg', { class: 'absence__mark', viewBox: '0 0 24 24',
                              'aria-hidden': 'true' });
  mark.append(svgEl('circle', { cx: 12, cy: 12, r: 9, fill: 'none',
    stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }));
  mark.append(svgEl('path', { d: 'M8.5 12 H15.5', stroke: 'currentColor',
    'stroke-width': 1.5, 'stroke-linecap': 'round' }));
  box.append(mark, el('h3', null, title), el('p', null, reason));
  // What would change this. A gap with no stated route out reads as a
  // permanent condition of the world, and almost none of them are.
  if (unlock) box.append(el('p', 'absence__unlock', unlock));
  const btn = el('button', 'absence__why', 'Why is this missing?');
  btn.onclick = async () => {
    // Fetched on demand. Somebody asking why a panel is empty has asked for
    // the gap register; nobody else has.
    let gap = null;
    try {
      const q = await loadQuality();
      gap = (q.gaps || []).find(g =>
        g.subject.includes(`stage ${state.stage}`) && g.family === (gapKey || ''));
    } catch (e) { console.error(e); }
    openInspector({
      kind: 'Absence', title,
      rows: [['Reason', reason], ['Field family', gapKey || 'n/a'],
             ['Status', gap ? gap.status : 'UNAVAILABLE'],
             ['Blocking source', gap && gap.source ? gap.source : '—'],
             ['Registered fallback', gap && gap.fallback ? gap.fallback : 'none'],
             // The register carries both, and they are the two things a
             // reader actually wants from a gap: what happens next, and when.
             ['Next action', gap && gap.next_action ? gap.next_action : '—'],
             ['Next check', gap && gap.recheck_after ? gap.recheck_after : '—']],
      note: 'A recorded gap, not a rendering failure. The observatory never '
          + 'substitutes zero, an average, or an interpolated value for data '
          + 'it does not have.',
    });
  };
  box.append(btn);
  host.append(box);
}

/* Stage terrain, from the fourteen strings the publishers actually use.
 *
 * Across the fleet `type` arrives as "Mountain stage" and "Mountain", "Hilly
 * stage" and "Hilly", "Medium-mountain stage" and "Medium mountain stage"
 * (the hyphen is the only difference), "Individual time trial" and
 * "Individual time-trial", "Team time trial" and "Team Time-Trial". Fourteen
 * spellings for five ideas, because they come from different publishers and
 * nobody agreed a vocabulary.
 *
 * Eighteen stages carry no type at all, and that is the case worth designing
 * for rather than defaulting away: an unknown terrain gets no icon and says
 * so. Guessing "flat" because a field is empty would put a confident glyph on
 * a card that knows nothing, which is the one thing this project does not do.
 */
const STAGE_TYPE = [
  [/team\s*time.?trial/i, 'ttt', 'Team time trial'],
  [/individual\s*time.?trial|\bITT\b/i, 'itt', 'Individual time trial'],
  [/mountain/i, 'mountain', 'Mountain'],
  [/hilly|intermediate/i, 'hilly', 'Hilly'],
  [/flat/i, 'flat', 'Flat'],
];
function stageTerrain(type) {
  if (!type) return { key: null, label: 'Terrain not published' };
  // Medium mountain is hilly, not mountain, and it contains the word
  // "mountain" — so it is tested before the mountain rule rather than after.
  if (/medium[\s-]*mountain/i.test(type)) return { key: 'hilly', label: 'Medium mountain' };
  for (const [re, key, label] of STAGE_TYPE) {
    if (re.test(type)) return { key, label };
  }
  return { key: null, label: type };
}

/* 16×16 glyphs, drawn rather than lettered: the rail has to read at a glance
   and at 48 px, and a word does neither. */
const TERRAIN_PATH = {
  flat:     'M2 11 H14',
  hilly:    'M2 12 Q5 6 8 10 T14 5',
  mountain: 'M1 13 L5.5 5 L8.5 9.5 L11 4 L15 13 Z',
  itt:      'M8 3.2 A4.8 4.8 0 1 1 7.99 3.2 M8 5.4 V8 L10 9.6',
  ttt:      'M4 4.5 L8 8 L4 11.5 M9 4.5 L13 8 L9 11.5',
};
function terrainIcon(key) {
  const svg = svgEl('svg', { class: 'terrain', viewBox: '0 0 16 16',
                             'aria-hidden': 'true', focusable: 'false' });
  if (!key) {
    svg.append(svgEl('path', { d: 'M3 8 H13', stroke: 'currentColor',
      'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-dasharray': '2 2',
      fill: 'none', opacity: 0.6 }));
    return svg;
  }
  svg.append(svgEl('path', { d: TERRAIN_PATH[key], fill:
    key === 'mountain' ? 'currentColor' : 'none', stroke: 'currentColor',
    'stroke-width': 1.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  return svg;
}

/* The rail's micro-profile. `spark` is 32 integers 0–100 carried in the stage
   index, so the rail costs no fetch of its own — the page-load budget is three
   requests and a rail that fetched 21 chunks to draw 21 thumbnails would blow
   it by a factor of seven. A stage with no usable profile carries null and
   draws nothing; a flat line would claim the road is flat. */
function sparkPath(spark, w, h) {
  const n = spark.length;
  return spark.map((v, i) =>
    `${i ? 'L' : 'M'} ${(i / (n - 1) * w).toFixed(2)} ${(h - v / 100 * h).toFixed(2)}`
  ).join(' ');
}

function renderStagebar() {
  const bar = $('#stagebar');
  bar.innerHTML = '';
  db.index.stages.forEach(s => {
    const t = stageTerrain(s.type);
    const b = el('button', 'stagecard');
    b.type = 'button';
    b.setAttribute('aria-current', s.n === state.stage ? 'true' : 'false');
    b.classList.toggle('is-on', s.n === state.stage);

    const top = el('div', 'stagecard__top');
    top.append(el('span', 'stagecard__n', String(s.n)));
    const ico = terrainIcon(t.key);
    ico.classList.add('stagecard__icon');
    top.append(ico);
    // The geometry dot is kept from the old chip. It is the only place in the
    // rail that says whether a stage has a road behind it, and that is the
    // difference between a page with a profile and a page of absences.
    top.append(el('span', 'stagecard__dot ' + (
      s.geometry.state === 'OK' ? 'dot--ok'
      : s.geometry.state === 'CONFLICTING' ? 'dot--conflict' : 'dot--absent')));
    b.append(top);

    if (s.spark && s.spark.length > 1) {
      const sp = svgEl('svg', { class: 'stagecard__spark', viewBox: '0 0 64 12',
                                preserveAspectRatio: 'none', 'aria-hidden': 'true' });
      sp.append(svgEl('path', { d: sparkPath(s.spark, 64, 12) + ' L 64 12 L 0 12 Z',
                                fill: 'currentColor', opacity: 0.22 }));
      sp.append(svgEl('path', { d: sparkPath(s.spark, 64, 12), fill: 'none',
                                stroke: 'currentColor', 'stroke-width': 1 }));
      b.append(sp);
    } else {
      b.append(el('div', 'stagecard__spark stagecard__spark--none'));
    }

    const meta = el('div', 'stagecard__meta');
    meta.append(el('span', 'stagecard__km',
                   s.distance_km != null ? `${s.distance_km} km` : '—'));
    b.append(meta);
    if (s.winner) b.append(el('div', 'stagecard__winner', s.winner));

    b.title = `Stage ${s.n} · ${s.start} → ${s.finish}`
            + (s.distance_km != null ? ` · ${s.distance_km} km` : '')
            + ` · ${t.label}`
            + (s.winner ? ` · won by ${s.winner}` : '');
    b.setAttribute('aria-label', b.title);
    b.onclick = () => goStage(s.n);
    bar.append(b);
  });
  const on = bar.querySelector('.stagecard.is-on');
  if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function renderHero() {
  const s = stageMeta(), host = $('#stage-hero');
  host.innerHTML = '';
  const left = el('div');
  left.append(el('div', 'hero__title', `Stage ${s.n} — ${s.start} → ${s.finish}`));
  const meta = el('p', 'hero__meta', `${s.date || 'date unknown'} · ${s.type || '—'}`);
  left.append(meta);

  // The reason this stage's panels below will be empty, said once, in full,
  // before a visitor has to find it. Every panel already explains its own
  // absence via the "Why is this missing?" button, which is the right depth
  // for a routine gap — but it means a visitor has to open several panels to
  // learn that, say, a stage's entire course was rewritten the day before the
  // race. That is the headline fact for the stage, not a footnote three
  // clicks deep, so it is surfaced here whenever the geometry is withheld.
  if (s.geometry && s.geometry.state !== 'OK' && s.geometry.reason) {
    const amended = /amendment|superseded|shortened|redeployed/i
      .test(s.geometry.reason);
    const box = el('div', 'hero-notice' + (amended ? ' hero-notice--amended' : ''));
    box.append(el('div', 'hero-notice__label',
      amended ? 'Course changed after publication' : 'Route geometry withheld'));
    box.append(el('p', null, s.geometry.reason));
    host.append(box);
  }
  const admin = (chunk() && chunk().admin) || [];
  if (admin.length) {
    const p = el('p', 'hero__meta');
    p.append(document.createTextNode('Crosses: '));
    admin.forEach((x, i) => {
      if (i) p.append(document.createTextNode(' → '));
      const sp = el('span', 'admin' + (x.kind === 'COUNTRY' ? ' admin--country' : ''),
                    x.name + (x.code ? ` (${x.code})` : ''));
      sp.title = `${x.kind.toLowerCase()} · ${x.country}`;
      p.append(sp);
    });
    left.append(p);
  }
  // How current this race is, on the page most readers land on.
  //
  // A race with a stage product never reaches the race view, so the freshness
  // sentence added there was invisible for exactly the races people open —
  // the Tour's page could not say when it was last looked at while the Tour
  // de France Femmes' could. The fleet index is already loaded on every page
  // and carries the block, so this costs no request.
  //
  // The stage count comes from the product's own index rather than from a
  // schedule the fleet chunk holds and this view has not fetched.
  // Read from the product's own manifest, which is the file this view has
  // already loaded and which describes this race and no other.
  //
  // The first attempt read the fleet index instead, and got both halves
  // wrong. It paired whichever race the picker had selected with whichever
  // product was mounted — reporting "under way, a result is held for 0 of its
  // 21 stages" about a nine-stage race, the same key-too-weak defect as the
  // three fixed in the pipeline this morning, made in the interface an hour
  // later. And it depended on races.json, which the stage view deliberately
  // does not fetch at boot to keep the first paint cheap, so the line
  // rendered or did not depending on load ordering.
  //
  // The manifest has no such problem: it is the race's own, it is already
  // here, and it cannot describe a different race than the stages beside it.
  const mf = db.index && db.index.manifest;
  if (mf && mf.freshness) {
    const stages = db.index.stages || [];
    const line = freshnessLine({
      freshness: mf.freshness,
      schedule: stages,
      stage_results: Object.fromEntries(
        stages.filter(x => x.results_count > 0).map(x => [x.n, true])),
    });
    if (line) left.append(line);
  }

  const g = s.geometry;
  if (g.state === 'OK') {
    const p = el('p', 'hero__meta');
    p.append(document.createTextNode('Geometry: '),
             el('b', null, g.source === 'aso-arcgis'
                 ? 'official (ASO)' : 'third-party trace'));
    if (g.neutralised_km != null) {
      p.append(document.createTextNode(
        ` · ${fmt(g.neutralised_km, 2)} km neutralised before KM0`));
    }
    left.append(p);
  }
  // Road-infrastructure facts (§5.16), which this project has almost none of:
  // the OpenStreetMap query service was declined on robots grounds, so the
  // only lawful source is the organiser's own finish-line notes. They describe
  // the finish and nothing else, and that limit is stated rather than quietly
  // generalised to the rest of the route.
  const fin = officialPoints().find(o => o.kind === 'FINISH'
    && (o.final_straight_m != null || o.road_width_m != null));
  if (fin) {
    const p = el('p', 'hero__meta');
    p.append(document.createTextNode('Finish road: '));
    const bits = [];
    if (fin.final_straight_m != null) {
      bits.push(`${fin.final_straight_m} m final straight`);
    }
    if (fin.road_width_m != null) {
      bits.push(`${fmt(fin.road_width_m, 2)} m carriageway`);
    }
    p.append(el('b', null, bits.join(' · ')));
    p.title = fin.note || '';
    left.append(p);
  }
  if (s.winner) {
    const w = el('p', 'hero__meta');
    w.append(document.createTextNode('Winner: '), el('b', null, s.winner));
    left.append(w);
  }
  // Riders whose Tour ended here. The results table can only show that
  // someone stopped appearing; the published code says whether they
  // abandoned during the stage, never started it, or finished outside the
  // time limit — three different things.
  const gone = (chunk() && chunk().departures) || [];
  if (gone.length) {
    const p = el('p', 'hero__meta');
    p.append(document.createTextNode(
      `Left the race here: ${gone.length} rider${gone.length > 1 ? 's' : ''} — `));
    gone.forEach((d, i) => {
      if (i) p.append(document.createTextNode(', '));
      const sp = el('b', null, d.rider);
      sp.title = `${DEPARTURE_LABEL[d.outcome] || d.outcome}`
        + ` · published as ${d.code}` + (d.team ? ` · ${d.team}` : '');
      p.append(sp);
      p.append(el('span', 'muted', ` (${d.outcome})`));
    });
    left.append(p);
  }
  host.append(left);

  [['Distance', s.distance_km, 'km', 1],
   ['Elevation gain', s.elevation_gain_m, 'm', 0],
   ['Climbs detected', s.climb_count || null, '', 0],
   ['Waypoints', s.waypoint_count, '', 0],
   ['Classified', s.results_count || null, 'riders', 0]].forEach(([l, v, u, d]) => {
    const box = el('div', 'stat');
    box.append(el('div', 'stat__label', l));
    const val = el('div', 'stat__value');
    if (v == null) val.append(el('span', 'muted', '—'));
    else {
      val.append(document.createTextNode(fmt(v, d)));
      if (u) val.append(el('span', 'stat__unit', ' ' + u));
    }
    box.append(val);
    host.append(box);
  });
  if (s.results_count === 0) {
    // "Not yet raced" was shown unconditionally on zero results, which is
    // wrong for a stage that has been run and has a published winner but no
    // full placings table — stage 21 is exactly this: van der Poel's win is
    // held, letour.fr's classification page serves the race's overall GC at
    // that URL rather than the stage's own result, so the full field never
    // resolved. A rider name on the row and "not yet raced" beside it is a
    // contradiction on the same screen.
    const note = el('div', 'stat');
    note.append(el('div', 'stat__label', 'Result status'),
                el('span', 'tag tag--absent',
                  s.winner ? 'winner known, full field unavailable'
                           : 'not yet raced'));
    host.append(note);
  }
}

/* The profile's drawing box. The viewBox scales to the container, so these are
 * proportions rather than pixels — but the padding is where labels live, and
 * it was too tight on both axes: a four-digit altitude ("2067") overran 46
 * units of left gutter, and the km row sat 16 units into a 26-unit bottom
 * margin with its descenders clipped by the edge. Both are now measured
 * against the widest label they have to hold, and the top band is reserved
 * for climb names, which did not exist before and cannot overlap the course
 * furniture badges that already sit there.
 */
const W = 1000, H_DEFAULT = 300, PAD = { l: 60, r: 18, t: 52, b: 34 };

/* Slope bands. Descent is tested before magnitude, or a 6 % descent reads as
 * a 6 % climb — the sign is the whole difference between the two hardest
 * things a stage can ask of a rider. */
const gradeBand = g =>
  g == null ? null : g <= -1 ? 'down'
  : g < 4 ? '1' : g < 8 ? '2' : g < 12 ? '3' : '4';
const gradeColor = g => {
  const b = gradeBand(g);
  return b == null ? 'var(--st-absent)' : `var(--grade-${b})`;
};
const GRADE_LEGEND = [['< 4%', 'var(--grade-1)'], ['4–8%', 'var(--grade-2)'],
  ['8–12%', 'var(--grade-3)'], ['> 12%', 'var(--grade-4)'],
  ['descent', 'var(--grade-down)']];

const svgEl = (tag, attrs) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

function renderProfile() {
  const host = $('#profile-host'), s = stageMeta(), p = profile();
  $('#profile-legend').innerHTML = '';
  $('#profile-axis-note').textContent = '';
  if (!p) {
    absence(host, `No elevation profile for stage ${s.n}`,
      s.geometry.reason || 'No route geometry is available for this stage.',
      '§5.3');
    $('#scrub-readout').innerHTML = '';
    return;
  }
  /* The drawing box is proportional, so the rendered height is
     containerWidth × H/W. With H fixed the chart kept one aspect whatever
     room it was given, and in the twin grid it is given the map's height —
     which left a band of dead panel under the legend on every desktop.
     Solving H for the container's actual shape uses the room without
     distorting anything: the horizontal scale, the padding and the label
     sizes are all still measured against W, which does not move.
     Clamped, because a very tall thin column would stretch the terrain into
     a caricature and a very short one would flatten a mountain stage. */
  const box = host.getBoundingClientRect();
  const H = box.width > 0 && box.height > 0
    ? Math.round(Math.max(240, Math.min(560, W * box.height / box.width)))
    : H_DEFAULT;

  const all = profileDrawRows().filter(d => d.e != null);
  const fullKm = Math.max(...all.map(d => d.km));

  /* The view window (§15: zoom, pan, range selection, reset).
   *
   * Clamped to the route and to a floor of two hundred metres, because a
   * window narrower than the sample spacing contains one point and draws a
   * dot. Clamping here rather than at each caller means a hand-edited URL
   * cannot produce an empty chart.
   *
   * The window keeps one sample beyond each edge so the line reaches the
   * axis instead of stopping short of it — without that, a zoomed profile
   * has a visible gap at both ends and reads as missing data. */
  const clampRange = r => {
    if (!r) return null;
    let [a, b] = r;
    a = Math.max(0, Math.min(a, fullKm));
    b = Math.max(0, Math.min(b, fullKm));
    if (b - a < 0.2) return null;
    return [a, b];
  };
  const range = clampRange(state.range);
  const kmA = range ? range[0] : 0, kmB = range ? range[1] : fullKm;
  const inView = all.filter(d => d.km >= kmA && d.km <= kmB);
  const firstIdx = all.indexOf(inView[0]);
  const pts = inView.length < 2 ? all : all.slice(
    Math.max(0, firstIdx - 1),
    Math.min(all.length, firstIdx + inView.length + 1));

  const maxKm = fullKm;
  /* Elevation rescales to what is in view. A zoom that keeps the whole
     stage's vertical extent flattens the thing you zoomed in to look at,
     which defeats the zoom; rescaling is what makes a 3 % drag visible when
     the same stage also contains a 2 000 m col. The axis is labelled either
     way, so the scale is never implied. */
  const eMin = Math.min(...pts.map(d => d.e)), eMax = Math.max(...pts.map(d => d.e));
  const pad = Math.max(30, (eMax - eMin) * 0.12);
  const y0 = eMin - pad, y1 = eMax + pad;
  // A profile drawn confidently reads as a profile that is known. Where
  // only one DEM covers part of a stage, or where the profile's own total
  // ascent disagrees with the organiser's, the caption says so — the same
  // rule the rest of this product follows: state the doubt beside the number
  // rather than under it.
  const reliabilityNote = () => {
    const r = chunk() && chunk().profile_reliability;
    if (!r) return '';
    const bits = [];
    if (r.two_dem_fraction != null && r.two_dem_fraction < 0.999) {
      bits.push(`${Math.round(r.two_dem_fraction * 100)}% of samples covered `
                + `by two DEMs`);
    }
    if (r.ascent_delta_pct != null && Math.abs(r.ascent_delta_pct) >= 15) {
      const dir = r.ascent_delta_pct > 0 ? 'above' : 'below';
      bits.push(`profile ascent ${Math.abs(Math.round(r.ascent_delta_pct))}% `
                + `${dir} the published ${r.published_ascent_m} m`);
    }
    return bits.length ? ' · ' + bits.join(' · ') : '';
  };

  // How many samples the line in front of the reader is actually drawn from.
  // Published on the element rather than kept in a closure because it is the
  // number that decides whether a 500 m ramp is visible at all, and a claim
  // about resolution that cannot be read back is not checkable.
  const X = km => PAD.l + ((km - kmA) / (kmB - kmA)) * (W - PAD.l - PAD.r);
  const Y = e => PAD.t + (1 - (e - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);

  $('#profile-axis-note').textContent =
    `${p.emitted_points} of ${p.source_points} source points shown`
    + (p.dem_sources && p.dem_sources.length
        ? ` · elevation from ${p.dem_sources.map(prettyDem).join(' + ')}` : '')
    + reliabilityNote()
    + provenanceNote();

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img',
    'data-points': pts.length,
    'aria-label': `Elevation profile, stage ${s.n}, ${s.start} to ${s.finish}` });

  /* The area under the line, filled by the slope of the road beneath it.
   *
   * The fill used to be one flat --surface-2 shape, so the chart said where
   * the road went and the colour said nothing; steepness lived only in the
   * 2px stroke on top, which is invisible at a glance and on a phone.
   *
   * Runs of the same band are merged into a single sub-path rather than a
   * polygon per sample. A Tour stage carries some 1600 samples, and 1600
   * <path> nodes is a scroll-janking DOM for a chart that redraws on every
   * stage change; merged, it is five nodes whatever the stage's length. */
  const base = Y(y0);
  const bandRuns = {};
  for (let i = 1; i < pts.length; i++) {
    const b = gradeBand(pts[i].g);
    if (b == null) continue;
    const prev = bandRuns[b];
    if (prev && prev.end === i - 1) { prev.end = i; continue; }
    if (prev) prev.runs.push([prev.start, prev.end]);
    bandRuns[b] = { start: i - 1, end: i, runs: prev ? prev.runs : [] };
  }
  Object.entries(bandRuns).forEach(([b, r]) => {
    const runs = [...r.runs, [r.start, r.end]];
    const d = runs.map(([a, z]) => {
      let sub = `M ${X(pts[a].km)} ${base}`;
      for (let i = a; i <= z; i++) sub += ` L ${X(pts[i].km)} ${Y(pts[i].e)}`;
      return sub + ` L ${X(pts[z].km)} ${base} Z`;
    }).join(' ');
    // Descent recedes. The bands exist to show where the road is hard, and a
    // long alpine descent is both the largest area on a mountain profile and
    // the least demanding part of it — at equal opacity it was the loudest
    // thing on the chart, so stage 20 read as mostly cyan when what it is
    // mostly about is four categorised climbs.
    svg.append(svgEl('path', { d, fill: `var(--grade-${b})`,
                               opacity: b === 'down' ? 0.1 : 0.3,
                               stroke: 'none' }));
  });

  // §8.4.10 — the DEM disagreement band drawn AS the profile's thickness.
  // Where independent DEMs agree it is hairline; where they diverge (steep
  // terrain, the resolution gap, the cross-border seam) it visibly widens.
  // The line's uncertainty is inseparable from the line.
  if (state.uncertainty && p.elev_min && p.dem_count) {
    const band = [];
    const rows = profileRows();
    let hi = '', lo = [];
    rows.forEach((q, i) => {
      if (p.dem_count[i] < 2 || p.elev_min[i] == null) return;
      hi += (hi ? ' L ' : 'M ') + X(q.km) + ' ' + Y(p.elev_max[i]);
      lo.push([X(q.km), Y(p.elev_min[i])]);
    });
    if (hi && lo.length > 1) {
      const back = lo.reverse().map(([x, y]) => `L ${x} ${y}`).join(' ');
      svg.append(svgEl('path', {
        d: `${hi} ${back} Z`,
        fill: 'color-mix(in oklab, var(--st-derived) 55%, transparent)',
        stroke: 'color-mix(in oklab, var(--st-derived) 70%, transparent)',
        'stroke-width': 0.5 }));
    }
  }

  climbs().forEach(c => svg.append(svgEl('rect', {
    x: X(c.start_km), y: PAD.t, width: Math.max(1, X(c.end_km) - X(c.start_km)),
    height: H - PAD.t - PAD.b,
    fill: 'color-mix(in oklab, var(--series-2) 12%, transparent)' })));

  for (let i = 1; i < pts.length; i++) {
    svg.append(svgEl('line', {
      x1: X(pts[i - 1].km), y1: Y(pts[i - 1].e), x2: X(pts[i].km), y2: Y(pts[i].e),
      stroke: gradeColor(pts[i].g), 'stroke-width': 2, 'stroke-linecap': 'round' }));
  }

  /* Climb names, on the climbs. The organiser's categorised summits were
   * reachable only by reading the table below and matching a kilometre to a
   * bump — which is the reader doing a join the chart should have done. Names
   * sit in the reserved top band with a leader line down to the summit.
   *
   * Two rows, alternating, and a label is dropped rather than overprinted if
   * it still collides: a stage with nine summits in forty kilometres cannot
   * show nine names at this width, and an unreadable pile of overlapping text
   * is worse than the table it was meant to save you. */
  const oc = ((chunk() && chunk().official_climbs) || [])
    .filter(c => c.summit_km != null && c.name)
    .sort((a, b) => a.summit_km - b.summit_km);
  const rowEnd = [-Infinity, -Infinity];
  oc.forEach(c => {
    const x = X(c.summit_km);
    const width = c.name.length * 4.6 + (c.category ? 16 : 0);
    const row = rowEnd[0] + 6 <= x - width / 2 ? 0
              : rowEnd[1] + 6 <= x - width / 2 ? 1 : -1;
    if (row < 0) return;
    rowEnd[row] = x + width / 2;
    const y = 14 + row * 16;
    svg.append(svgEl('line', { x1: x, y1: y + 4, x2: x, y2: PAD.t,
      stroke: 'var(--grade-3)', 'stroke-width': 0.75, opacity: 0.5 }));
    const t = svgEl('text', { x, y, 'text-anchor': 'middle',
      class: 'profile__climb', fill: 'var(--text-2)' });
    t.textContent = (c.category ? `${c.category} · ` : '') + c.name;
    const title = svgEl('title', {});
    title.textContent = `${c.name}`
      + (c.category ? ` · category ${c.category}` : '')
      + ` · summit km ${c.summit_km.toFixed(1)}`
      + (c.summit_elev != null ? ` · ${c.summit_elev} m` : '')
      + (c.length_km != null ? ` · ${c.length_km} km at ${c.avg_grad}%` : '');
    t.append(title);
    svg.append(t);
  });

  const step = maxKm > 150 ? 25 : 10;
  for (let k = 0; k <= maxKm; k += step) {
    svg.append(svgEl('line', { x1: X(k), y1: H - PAD.b, x2: X(k),
      y2: H - PAD.b + 4, stroke: 'var(--line)' }));
    const t = svgEl('text', { x: X(k), y: H - PAD.b + 16, 'text-anchor': 'middle',
      fill: 'var(--text-3)', 'font-size': 10, 'font-family': 'var(--mono)' });
    t.textContent = k;
    svg.append(t);
  }
  [y0, (y0 + y1) / 2, y1].forEach(e => {
    svg.append(svgEl('line', { x1: PAD.l, y1: Y(e), x2: W - PAD.r, y2: Y(e),
      stroke: 'var(--line)', 'stroke-dasharray': '2 4' }));
    const t = svgEl('text', { x: PAD.l - 6, y: Y(e) + 3, 'text-anchor': 'end',
      fill: 'var(--text-3)', 'font-size': 10, 'font-family': 'var(--mono)' });
    t.textContent = Math.round(e);
    svg.append(t);
  });
  waypoints().forEach(w => {
    if (w.km == null) return;
    svg.append(svgEl('line', { x1: X(w.km), y1: H - PAD.b - 4, x2: X(w.km),
      y2: H - PAD.b, stroke: 'var(--text-3)' }));
  });

  // The organiser's own course furniture, placed by projecting each published
  // coordinate onto this line. These are Tier-0 positions, so they are drawn
  // against the profile rather than listed away from it: a summit marker that
  // does not sit on a summit is a visible contradiction, which is the point.
  officialPoints().forEach(o => {
    if (o.km == null) return;
    const x = X(o.km);
    svg.append(svgEl('line', { x1: x, y1: PAD.t, x2: x, y2: H - PAD.b,
      stroke: 'var(--st-observed)', 'stroke-width': 1,
      'stroke-dasharray': '3 3', opacity: 0.55 }));
    const g = svgEl('g', {});
    const badge = OFFICIAL_GLYPH[o.kind] || { t: '•', w: 12 };
    const text = o.kind === 'SUMMIT' || (o.kind === 'FINISH' && o.category)
      ? (o.category === 'HC' ? 'HC' : o.category) : badge.t;
    const w = text.length > 1 ? 18 : 13;
    g.append(svgEl('rect', { x: x - w / 2, y: PAD.t - 13, width: w, height: 13,
      rx: 3, fill: 'var(--st-observed)' }));
    const t = svgEl('text', { x, y: PAD.t - 3, 'text-anchor': 'middle',
      'font-size': 9, 'font-family': 'var(--mono)', fill: 'var(--surface-1)' });
    t.textContent = text;
    g.append(t);
    const title = svgEl('title', {});
    title.textContent = `${OFFICIAL_LABEL[o.kind] || o.kind}`
      + (o.category ? ` · category ${o.category}` : '')
      + ` · km ${o.km.toFixed(1)}`
      + (o.altitude != null ? ` · ${o.altitude} m` : '')
      + (o.climb_km != null ? ` · ${o.climb_km} km at ${o.climb_grad}%` : '')
      + (o.road_width_m != null ? ` · carriageway ${o.road_width_m} m` : '')
      + (o.final_straight_m != null
          ? ` · final straight ${o.final_straight_m} m` : '')
      + (o.passes && o.passes.length > 1
          ? `\nThe route passes here ${o.passes.length} times: km `
            + o.passes.map(k => k.toFixed(1)).join(', ') : '')
      + '\n' + (o.note || 'published by the organiser');
    g.append(title);
    svg.append(g);
  });

  const cursor = svgEl('g', {});
  svg.append(cursor);
  host.innerHTML = '';
  host.append(svg);

  const legendItems = GRADE_LEGEND.slice();
  if (state.uncertainty && p.dem_sources && p.dem_sources.length) {
    legendItems.push([`DEM spread · ${p.dem_sources.map(prettyDem).join(' vs ')}`,
                      'color-mix(in oklab, var(--st-derived) 70%, transparent)']);
  }
  legendItems.forEach(([label, c]) => {
    const sp = el('span'), i = el('i');
    i.style.background = c;
    sp.append(i, document.createTextNode(label));
    $('#profile-legend').append(sp);
  });

  // The inverse of X, and it has to be derived from the same window rather
  // than from the stage length. When the chart gained a zoom this read the
  // cursor against the full route while the chart drew a slice of it, so
  // pointing at a summit reported a kilometre several kilometres away — the
  // linked map and relief view then agreed with each other and with nothing
  // the reader was looking at.
  const kmAt = ev => {
    const r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    const f = (x - PAD.l) / (W - PAD.l - PAD.r);
    return Math.max(kmA, Math.min(kmB, kmA + f * (kmB - kmA)));
  };
  svg.style.cursor = 'crosshair';

  /* Range selection (§15). Drag across the chart to choose a stretch; the
   * profile, the surface strip, the relief view and the map all follow,
   * because they share one distance axis and a zoom that moved only the
   * chart would put four views on four different scales.
   *
   * Drag selects rather than scrubs, and the two have to be told apart: a
   * pointer that moves five pixels is a reader looking, and one that moves
   * fifty with the button down is a reader choosing. Below the threshold the
   * cursor keeps scrubbing, so the interaction nobody asked to change does
   * not change.
   */
  let brush = null;
  const brushRect = svgEl('rect', { class: 'profile__brush', x: 0, y: PAD.t,
    width: 0, height: Math.max(0, H - PAD.t - PAD.b), rx: 2 });
  brushRect.style.display = 'none';
  svg.append(brushRect);

  svg.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    brush = { fromKm: kmAt(ev), fromX: ev.clientX, moved: false };
    svg.setPointerCapture(ev.pointerId);
  });
  svg.addEventListener('pointermove', ev => {
    const km = kmAt(ev);
    if (brush) {
      if (Math.abs(ev.clientX - brush.fromX) > 5) brush.moved = true;
      if (brush.moved) {
        const a = Math.min(brush.fromKm, km), b = Math.max(brush.fromKm, km);
        brushRect.style.display = '';
        brushRect.setAttribute('x', X(a));
        brushRect.setAttribute('width', Math.max(1, X(b) - X(a)));
        return;
      }
    }
    state.km = km;
    emitCursor();
  });
  const endBrush = ev => {
    if (!brush) return;
    const wasMoved = brush.moved;
    const from = brush.fromKm, to = kmAt(ev);
    brush = null;
    brushRect.style.display = 'none';
    if (!wasMoved) return;
    const a = Math.min(from, to), b = Math.max(from, to);
    // A flick narrower than 200 m is a mis-drag, not a selection.
    if (b - a < 0.2) return;
    state.range = [a, b];
    writeUrl(true);
    renderStage();
  };
  svg.addEventListener('pointerup', endBrush);
  svg.addEventListener('pointercancel', () => {
    brush = null; brushRect.style.display = 'none';
  });
  svg.addEventListener('pointerleave', () => {
    if (brush) return;
    state.km = null;
    emitCursor();
  });

  // Wheel zooms about the pointer, which is what every map does, so the
  // kilometre under the cursor stays under the cursor. Non-passive because
  // it must preventDefault — otherwise the page scrolls out from under the
  // chart the reader is zooming.
  /* A zoom the reader cannot see is a zoom they cannot undo. The axis note
     states the window and offers the way out, and the whole-stage span never
     shows a control that would do nothing. */
  const note = $('#profile-axis-note');
  if (range) {
    note.textContent = '';
    note.append(document.createTextNode(
      `showing km ${kmA.toFixed(1)}–${kmB.toFixed(1)} of ${fullKm.toFixed(1)} · `));
    const back = el('button', 'linkish', 'whole stage');
    back.type = 'button';
    back.addEventListener('click', () => {
      state.range = null; writeUrl(true); renderStage();
    });
    note.append(back);
  }

  svg.addEventListener('wheel', ev => {
    ev.preventDefault();
    const focus = kmAt(ev);
    const span = kmB - kmA;
    const next = Math.max(0.2, Math.min(fullKm,
      span * (ev.deltaY > 0 ? 1.25 : 0.8)));
    if (next >= fullKm) state.range = null;
    else {
      const f = (focus - kmA) / span;
      let a = focus - f * next, b = a + next;
      if (a < 0) { a = 0; b = next; }
      if (b > fullKm) { b = fullKm; a = fullKm - next; }
      state.range = [a, b];
    }
    writeUrl();
    renderStage();
  }, { passive: false });

  onCursor(() => {
    cursor.innerHTML = '';
    const read = $('#scrub-readout');
    if (state.km == null) {
      read.innerHTML = '<span class="muted">Move across the profile, or use '
        + '←/→ to scrub the route-distance axis. Every view follows this cursor.'
        + '</span>';
      highlightWaypointRow(null);
      return;
    }
    const near = pts.reduce((a, b) =>
      Math.abs(b.km - state.km) < Math.abs(a.km - state.km) ? b : a);
    cursor.append(svgEl('line', { x1: X(near.km), y1: PAD.t, x2: X(near.km),
      y2: H - PAD.b, stroke: 'var(--series-1)' }));
    cursor.append(svgEl('circle', { cx: X(near.km), cy: Y(near.e), r: 4.5,
      fill: 'var(--series-1)', stroke: 'var(--surface-1)', 'stroke-width': 2 }));
    const w = nearestWaypoint(state.km);
    read.innerHTML = '';
    const add = (l, v) => {
      const sp = el('span');
      sp.append(el('span', 'muted', l + ' '), el('b', null, v));
      read.append(sp);
    };
    add('km', fmt(near.km, 2));
    add('elev', near.e == null ? '—' : Math.round(near.e) + ' m');
    add('grad', near.g == null ? '—' : fmt(near.g, 1) + ' %');
    // Which climb the cursor is on, where it is on one. Read from the
    // organiser's own categorised climbs by span, not by nearest summit — a
    // rider 2 km into a 24 km col is on that col, and the nearest summit to
    // them may be the previous one they have already come down.
    const onClimb = ((chunk() && chunk().official_climbs) || []).find(c =>
      c.summit_km != null && c.length_km != null
      && near.km >= c.summit_km - c.length_km && near.km <= c.summit_km);
    if (onClimb) {
      add('climb', (onClimb.category ? `${onClimb.category} · ` : '')
                 + onClimb.name);
    }
    const ni = profileRows().indexOf(near);
    if (p.dem_count && ni >= 0) {
      add('DEM spread', p.dem_count[ni] >= 2
        ? (p.elev_max[ni] - p.elev_min[ni]).toFixed(0) + ' m'
        : 'single source');
    }
    if (w) {
      add('waypoint', w.label);
      add('window', w.win && w.win[0] ? `${w.win[0]}–${w.win[1]}` : '—');
      add('sun', w.sun_el == null ? '—' : fmt(w.sun_el, 0) + '°');
      add('temp', w.temp == null ? '—' : fmt(w.temp, 1) + ' °C');
      add('wind', w.exposure || '—');
    }
    highlightWaypointRow(w);
  });
}

function nearestWaypoint(km) {
  const ws = waypoints().filter(w => w.km != null);
  if (!ws.length) return null;
  return ws.reduce((a, b) => Math.abs(b.km - km) < Math.abs(a.km - km) ? b : a);
}

function renderMap() {
  const host = $('#map-host'), s = stageMeta(), p = profile();
  $('#map-caption').textContent = '';
  if (!p) {
    absence(host, 'No route geometry',
      s.geometry.reason || 'No lawful geometry source for this stage.', '§5.3');
    return;
  }
  const pts = profileRows();
  const lons = p.lon, lats = p.lat;
  const x0 = Math.min(...lons), x1 = Math.max(...lons);
  const y0 = Math.min(...lats), y1 = Math.max(...lats);
  const kx = Math.cos((y0 + y1) / 2 * Math.PI / 180);
  const w = (x1 - x0) * kx || 1, h = (y1 - y0) || 1;
  // The box is squarer than it was. The old one was 520×(≤430) inside a panel
  // that had grown taller than the drawing, so a mountain stage that folds
  // back on itself was rendered into a letterbox and the panel showed as much
  // empty surface as route. It now fills the panel it is given and the
  // aspect follows the stage's own bounding box, clamped so a pan-flat
  // transfer stage does not become a hairline.
  const MW = 560, MH = Math.max(320, Math.min(560, MW * (h / w)));
  const P = 22;
  const X = lon => P + ((lon - x0) * kx / w) * (MW - 2 * P);
  const Y = lat => MH - P - ((lat - y0) / h) * (MH - 2 * P);

  const svg = svgEl('svg', { viewBox: `0 0 ${MW} ${MH}`, role: 'img',
    class: 'routemap',
    'aria-label': `Route line, stage ${s.n}, ${s.start} to ${s.finish}` });

  // The line carries the same grade encoding as the profile, so the two
  // panels are one instrument read two ways: the ramp you see standing up in
  // the profile is the stretch that turns red on the map. Runs are merged for
  // the same reason as the profile's fill — one node per band, not per sample.
  const segs = {};
  for (let i = 1; i < pts.length; i++) {
    const b = gradeBand(pts[i].g) || 'na';
    (segs[b] ||= []).push(
      `M ${X(pts[i - 1].lon)} ${Y(pts[i - 1].lat)} L ${X(pts[i].lon)} ${Y(pts[i].lat)}`);
  }
  Object.entries(segs).forEach(([b, d]) => svg.append(svgEl('path', {
    d: d.join(' '), fill: 'none',
    stroke: b === 'na' ? 'var(--st-absent)' : `var(--grade-${b})`,
    'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })));

  /* The selected stretch, drawn over the top (§15: selection "highlights/
   * zooms corresponding map/profile ranges").
   *
   * Highlighted rather than zoomed, deliberately. The map's job in this pair
   * is to say *where* — cropping it to the selection would throw away the
   * only view that answers "where in the stage is this", which is exactly
   * what a reader zooming into a climb wants to know. So the whole route
   * stays, the chosen stretch is drawn heavier over it, and the rest is left
   * legible rather than dimmed to grey: dimming would make the map a worse
   * map to solve a problem the map does not have.
   *
   * Grade colour is dropped for one neutral casing here, because a highlight
   * that also re-encoded gradient would compete with the line underneath it
   * and neither would read. */
  if (state.range) {
    const [ra, rb] = state.range;
    const sel = [];
    for (let i = 1; i < pts.length; i++) {
      const km = pts[i].km;
      if (km == null || km < ra || km > rb) continue;
      sel.push(`M ${X(pts[i - 1].lon)} ${Y(pts[i - 1].lat)} `
             + `L ${X(pts[i].lon)} ${Y(pts[i].lat)}`);
    }
    if (sel.length) {
      svg.append(svgEl('path', { d: sel.join(' '), fill: 'none',
        stroke: 'var(--text-1)', 'stroke-width': 7, 'stroke-opacity': 0.28,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      svg.append(svgEl('path', { d: sel.join(' '), fill: 'none',
        stroke: 'var(--text-1)', 'stroke-width': 1.5,
        'stroke-dasharray': '5 4',
        'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    }
  }

  const pin = (x, y, cls, glyph, label) => {
    const g = svgEl('g', { class: cls });
    g.append(svgEl('circle', { cx: x, cy: y, r: 7,
      fill: 'var(--surface-1)', stroke: 'currentColor', 'stroke-width': 2 }));
    const t = svgEl('text', { x, y: y + 3.2, 'text-anchor': 'middle',
      'font-size': 8, fill: 'currentColor' });
    t.textContent = glyph;
    g.append(t);
    const title = svgEl('title', {});
    title.textContent = label;
    g.append(title);
    return g;
  };
  // Categorised summits, from the organiser's own list, projected onto the
  // line by the kilometre they were published at.
  ((chunk() && chunk().official_climbs) || []).forEach(c => {
    if (c.summit_km == null) return;
    const q = pts.reduce((a, b2) =>
      Math.abs(b2.km - c.summit_km) < Math.abs(a.km - c.summit_km) ? b2 : a);
    svg.append(pin(X(q.lon), Y(q.lat), 'map-pin map-pin--kom', '▲',
      `${c.name}${c.category ? ` · category ${c.category}` : ''} · summit km `
      + `${c.summit_km.toFixed(1)}`));
  });
  const last = pts[pts.length - 1];
  svg.append(pin(X(pts[0].lon), Y(pts[0].lat), 'map-pin map-pin--start', '●',
    `Start · ${s.start}`));
  svg.append(pin(X(last.lon), Y(last.lat), 'map-pin map-pin--finish', '▮',
    `Finish · ${s.finish}`));

  const marker = svgEl('circle', { r: 5.5, fill: 'var(--text-1)',
    stroke: 'var(--surface-1)', 'stroke-width': 2, opacity: 0 });
  svg.append(marker);
  host.innerHTML = '';
  host.append(svg);

  // Where this line came from, said on the line rather than in a caption
  // nobody reads. The distinction matters more than any styling on this
  // panel: an organiser's published trace and a route this project
  // reconstructed are different kinds of claim, and §8 forbids showing the
  // second as though it were the first.
  /* Three states, because there are three kinds of line and the first version
   * of this badge only had two.
   *
   * It read `source.startsWith('aso')` and called everything else
   * "Independently reconstructed", with a tooltip saying the line was "built
   * by this project from published anchors and an open road network". That
   * was true of nothing. This project reconstructed zero routes — the method
   * was tried and rejected on measurement — and 157 of the 174 accepted lines
   * are third-party traces the database records honestly as
   * ACCEPTED_THIRD_PARTY. The page was taking an accurate ledger and printing
   * a method that had never been run, on thirty races.
   *
   * A third-party trace is `reported` in §9's vocabulary: somebody else
   * surveyed it, this project checked it against the organiser's published
   * distance and accepted it. That is neither the organiser's own file nor
   * our own reconstruction, and flattening it into either is the failure this
   * badge exists to prevent.
   *
   * Driven by the verdict column rather than by the shape of a source id, so
   * a new publisher cannot silently land in the wrong bucket. An unknown
   * verdict says so instead of guessing.
   */
  const pv = (chunk() && chunk().route_provenance) || {};
  const BADGE = {
    ACCEPTED: ['official', 'Official race geometry',
      'Published by the organiser. Not redistributed — what is shown is the '
      + 'derived, simplified product of it.'],
    ACCEPTED_THIRD_PARTY: ['thirdparty', 'Third-party trace',
      'Not the organiser’s file and not reconstructed here. A trace '
      + 'published by another party, accepted only after its length was '
      + 'checked against the distance the organiser published.'],
    RECONSTRUCTED: ['reconstructed', 'Independently reconstructed',
      'Not organiser-provided. Built by this project from published anchors '
      + 'and an open road network; the method is in the provenance note.'],
  };
  const [cls, label, why] = BADGE[pv.verdict]
    || ['unknown', 'Provenance not recorded',
        'This line is accepted but the record does not say how it was '
        + 'arrived at, so nothing is claimed about it here.'];
  const badge = el('span', 'mapbadge mapbadge--' + cls, label);
  badge.title = why + (pv.source ? ` Source: ${pv.source}.` : '');
  host.append(badge);

  $('#map-caption').textContent =
    'Route line only — no basemap tiles, so nothing implies surveyed '
  + 'cartographic accuracy. Line colour is road gradient, the same scale as '
  + 'the profile.' + provenanceNote();

  /* The other half of the link. The profile has moved this cursor since the
   * first release and the map only ever followed it, so a rider pointing at
   * a hairpin had no way to ask which kilometre it was. Nearest point in
   * projected space, which is the same space the reader is pointing in. */
  const kmAtPoint = (mx, my) => {
    let best = null, bestD = Infinity;
    for (const q of pts) {
      const dx = X(q.lon) - mx, dy = Y(q.lat) - my;
      const dd = dx * dx + dy * dy;
      if (dd < bestD) { bestD = dd; best = q; }
    }
    return bestD <= 20 * 20 ? best.km : null;
  };
  const toBox = ev => {
    const r = svg.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * MW,
            ((ev.clientY - r.top) / r.height) * MH];
  };
  svg.style.cursor = 'crosshair';
  svg.addEventListener('pointermove', ev => {
    const km = kmAtPoint(...toBox(ev));
    if (km != null) { state.km = km; emitCursor(); }
  });
  svg.addEventListener('pointerleave', () => { state.km = null; emitCursor(); });

  onCursor(() => {
    if (state.km == null) { marker.setAttribute('opacity', 0); return; }
    const near = pts.reduce((a, b) =>
      Math.abs(b.km - state.km) < Math.abs(a.km - state.km) ? b : a);
    marker.setAttribute('cx', X(near.lon));
    marker.setAttribute('cy', Y(near.lat));
    marker.setAttribute('opacity', 1);
  });
}

/* The route seen from an angle (§15's relief mode).
 *
 * A profile flattens the stage into a wall and a map flattens it into a plan.
 * Neither answers the question a rider asks first — where in the stage does
 * the hard part sit, and what is around it. This draws the same route on the
 * same distance axis as a ribbon standing on its own shadow, from the
 * coordinates and elevations already in the stage chunk. No new data, no
 * request, no library.
 *
 * Canvas rather than SVG. Nine hundred segments become nine hundred filled
 * quads that must be repainted on every frame of a drag; as SVG nodes that is
 * a repaint of nine hundred elements through the DOM, and it stutters on a
 * phone. §15 is explicit that 3D must not cost mobile performance, so the one
 * chart that needs a raster surface gets one. It carries an aria-label and a
 * text summary, and every control it offers by pointer it also offers by key.
 *
 * The projection is a plain axonometric one:
 *
 *   rx = x·cosθ − y·sinθ            θ — yaw, the compass rotation
 *   ry = x·sinθ + y·cosθ
 *   sx = rx
 *   sy = ry·sin(φ) − z·cos(φ)·VE    φ — camera elevation above the horizon
 *
 * At φ = 90° the ground plane is fully visible and height contributes
 * nothing: a plan. At φ = 0° the ground collapses and only height remains: an
 * elevation profile. Every angle between is a mix of the two, which is the
 * whole point — the same geometry, continuously, rather than two charts a
 * reader has to reconcile.
 *
 * Painter's algorithm by rotated y, so nearer ground overdraws farther ground.
 * That means drawing out of route order, which is correct for occlusion and
 * wrong for nothing else here.
 */
const RELIEF = {
  yaw: -0.6, pitch: 0.62, ve: 6, dragging: null,
  // Two named scales, because §20 requires vertical exaggeration to be
  // labelled and requires an analysis scale distinct from a story scale.
  // "True" is the honest one and looks like almost nothing, which is itself
  // the finding: road climbs are shallow next to the distances they cover.
  presets: { true: 1, reading: 6, story: 14 },
};

function reliefSamples() {
  const p = chunk() && chunk().profile;
  if (!p || !p.lon || !p.lat || !p.e) return null;
  const n = Math.min(p.lon.length, p.lat.length, p.e.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    if (p.lon[i] == null || p.lat[i] == null || p.e[i] == null) continue;
    out.push({ lon: p.lon[i], lat: p.lat[i], e: p.e[i],
               km: p.km ? p.km[i] : null, g: p.g ? p.g[i] : null });
  }
  // Zoomed with the profile, which is the point of the relief view under a
  // selection: a col picked out on the chart becomes the col drawn here,
  // rather than the same whole-stage ribbon with the interesting part still
  // two pixels wide.
  if (state.range) {
    const [a, b] = state.range;
    const win = out.filter(d => d.km != null && d.km >= a && d.km <= b);
    if (win.length > 8) return win;
  }
  return out.length > 8 ? out : null;
}

/* Paint one relief picture onto one canvas.
 *
 * Separated from `drawRelief` so the climb cards can use it. A climb is the
 * same geometry as a stage — a run of coordinates with elevations — over a
 * shorter span, and drawing it a second way would have produced two pictures
 * of one road that could disagree about it. Everything specific to the panel
 * (its controls, its caption, which samples the reader has zoomed to) stays
 * in the caller; this function knows only about points and a camera.
 *
 * Returns the elevation range it drew, because the caller needs it for the
 * text alternative and cannot get it back from a raster.
 */
function paintRelief(cv, pts, opt) {
  if (!cv || !pts || pts.length < 2) return null;
  const cssW = opt.width || 800;
  const cssH = opt.height || 340;
  const pad = opt.pad == null ? 18 : opt.pad;
  // Backing store at device resolution, coordinates in CSS pixels. Without
  // this the ribbon is soft on every phone and on any scaled desktop.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(cssW * dpr);
  cv.height = Math.round(cssH * dpr);
  cv.style.width = cssW + 'px';
  cv.style.height = cssH + 'px';
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cssW, cssH);

  // Local planar metres. One stage never spans enough longitude for the
  // cosine to drift, so a single scale factor at the mean latitude is exact
  // enough for a picture whose vertical axis is deliberately exaggerated.
  const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
  const lon0 = pts.reduce((a, p) => a + p.lon, 0) / pts.length;
  const mPerLon = 111320 * Math.cos(lat0 * Math.PI / 180);
  const zMin = Math.min(...pts.map(p => p.e));
  const zMax = Math.max(...pts.map(p => p.e));

  // Point the route's long axis along the canvas's long axis before the
  // reader's own rotation is applied. A stage is a line, not a blob, and a
  // line dropped into a landscape frame at an arbitrary compass bearing uses
  // a fifth of it — the first draft rendered the Galibier stage into 2 % of
  // the panel with empty black either side. The principal axis is the first
  // eigenvector of the coordinate covariance, which for a route is just
  // "which way does this stage mostly run".
  let sxx = 0, syy = 0, sxy = 0;
  const mx = pts.reduce((a, p) => a + (p.lon - lon0) * mPerLon, 0) / pts.length;
  const my = pts.reduce((a, p) => a + (p.lat - lat0) * 110540, 0) / pts.length;
  pts.forEach(p => {
    const dx = (p.lon - lon0) * mPerLon - mx, dy = (p.lat - lat0) * 110540 - my;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  });
  const principal = 0.5 * Math.atan2(2 * sxy, sxx - syy);

  const yaw = opt.yaw - principal;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const sp = Math.sin(opt.pitch), cp = Math.cos(opt.pitch);

  const raw = pts.map(p => {
    const x = (p.lon - lon0) * mPerLon;
    const y = (p.lat - lat0) * 110540;
    const rx = x * cy - y * sy;
    const ry = x * sy + y * cy;
    return { rx, ry, z: p.e - zMin, km: p.km, g: p.g };
  });

  // Fit after projecting, so rotating never pushes the route off the canvas.
  const project = (r, z) => ({ x: r.rx, y: r.ry * sp - z * cp * opt.ve });
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  raw.forEach(r => {
    [0, r.z].forEach(z => {
      const q = project(r, z);
      if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x;
      if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y;
    });
  });
  const k = Math.min((cssW - 2 * pad) / Math.max(x1 - x0, 1),
                     (cssH - 2 * pad) / Math.max(y1 - y0, 1));
  const ox = pad - x0 * k + (cssW - 2 * pad - (x1 - x0) * k) / 2;
  const oy = pad - y0 * k + (cssH - 2 * pad - (y1 - y0) * k) / 2;
  const S = (r, z) => { const q = project(r, z);
                        return [q.x * k + ox, q.y * k + oy]; };

  const css = getComputedStyle(document.documentElement);
  const tone = v => css.getPropertyValue(v).trim() || '#888';

  // Far ground first. The shadow is the route's plan projection, and it is
  // what makes the ribbon read as standing on something rather than floating.
  g.beginPath();
  raw.forEach((r, i) => { const [X, Y] = S(r, 0);
                          i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
  g.strokeStyle = tone('--line');
  g.lineWidth = 1;
  g.stroke();

  // Consecutive segments of one gradient band become one filled polygon.
  // Drawn per segment, nine hundred translucent quads overlap along nine
  // hundred shared edges and the ribbon comes out striped — the banding is an
  // artefact of the drawing, and on a chart whose colour means gradient an
  // artefact that looks like structure is a lie. One polygon per run has no
  // internal edges to double.
  const runs = [];
  for (let i = 0; i < raw.length - 1; i++) {
    const band = gradeBand(raw[i + 1].g);
    const last = runs[runs.length - 1];
    if (last && last.band === band) last.end = i + 1;
    else runs.push({ band, start: i, end: i + 1 });
  }

  // Painter's algorithm, by run rather than by segment: farther ground first,
  // so a valley behind a col is overdrawn by it. Ordering whole runs keeps
  // the merged fills intact, and a run is short enough that ordering within
  // one never matters.
  runs.sort((a, b) => {
    const ma = (raw[a.start].ry + raw[a.end].ry) / 2;
    const mb = (raw[b.start].ry + raw[b.end].ry) / 2;
    return ma - mb;
  });

  runs.forEach(run => {
    const col = tone(gradeColor(raw[run.end].g).replace(/^var\(|\)$/g, ''));
    g.beginPath();
    for (let i = run.start; i <= run.end; i++) {
      const [X, Y] = S(raw[i], raw[i].z);
      i === run.start ? g.moveTo(X, Y) : g.lineTo(X, Y);
    }
    for (let i = run.end; i >= run.start; i--) {
      const [X, Y] = S(raw[i], 0);
      g.lineTo(X, Y);
    }
    g.closePath();
    g.fillStyle = col;
    g.globalAlpha = 0.42;
    g.fill();
    g.globalAlpha = 1;

    // The ridge, opaque and continuous: it is the route, and it should read
    // as a line rather than as the top edge of a shape.
    g.beginPath();
    for (let i = run.start; i <= run.end; i++) {
      const [X, Y] = S(raw[i], raw[i].z);
      i === run.start ? g.moveTo(X, Y) : g.lineTo(X, Y);
    }
    g.strokeStyle = col;
    g.lineWidth = opt.ridge || 2.2;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();
  });

  // The shared cursor, on the same route position the profile and map use.
  if (opt.cursorKm != null) {
    let best = 0, bd = Infinity;
    raw.forEach((r, i) => {
      const d = Math.abs((r.km == null ? 0 : r.km) - opt.cursorKm);
      if (d < bd) { bd = d; best = i; }
    });
    const r = raw[best];
    const [cx, cyy] = S(r, r.z), [gx, gy] = S(r, 0);
    g.strokeStyle = tone('--text-1');
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(gx, gy); g.lineTo(cx, cyy); g.stroke();
    g.fillStyle = tone('--text-1');
    g.beginPath(); g.arc(cx, cyy, opt.ridge ? 2.5 : 3.5, 0, 2 * Math.PI);
    g.fill();
  }

  return { zMin, zMax };
}

function drawRelief() {
  const host = $('#relief-host');
  if (!host) return;
  const cv = host.querySelector('canvas');
  const pts = reliefSamples();
  if (!cv || !pts) return;
  const drawn = paintRelief(cv, pts, {
    width: host.clientWidth || 800, height: host.clientHeight || 340,
    yaw: RELIEF.yaw, pitch: RELIEF.pitch, ve: RELIEF.ve,
    cursorKm: state.km,
  });
  if (!drawn) return;
  const { zMin, zMax } = drawn;

  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label',
    `The route drawn in relief, rotated ${Math.round(-RELIEF.yaw * 180 / Math.PI)} `
    + `degrees and seen ${Math.round(RELIEF.pitch * 180 / Math.PI)} degrees above `
    + `the horizon, with height drawn ${RELIEF.ve} times its true scale. `
    + `The route rises from ${Math.round(zMin)} to ${Math.round(zMax)} metres. `
    + `The elevation profile above carries the same data as a chart.`);

  const scaleName = Object.entries(RELIEF.presets)
    .find(([, v]) => v === RELIEF.ve);
  $('#relief-caption').textContent =
    `Vertical scale ×${RELIEF.ve}`
    + (scaleName ? ` (${scaleName[0] === 'true' ? 'true scale — height and '
        + 'distance in the same units' : scaleName[0] + ' scale'})` : '')
    + `. Height is drawn ${RELIEF.ve} times its real size against the ground, `
    + `so the gradients you see are steeper than the road. `
    + `Colour is road gradient, the same scale as the profile. `
    + `Drag to turn it, or use the arrow keys; built from this stage's own `
    + `coordinates and elevations.`;
}

function renderRelief() {
  const host = $('#relief-host'), panel = $('#panel-relief');
  if (!host || !panel) return;
  host.innerHTML = '';
  panel.querySelectorAll('.absence-host').forEach(n => n.remove());
  const ctl = $('#relief-ctl');
  if (ctl) ctl.innerHTML = '';

  if (!reliefSamples()) {
    $('#relief-caption').textContent = '';
    const h = el('div', 'absence-host');
    (panel.querySelector('.panel__body') || panel).append(h);
    absence(h, 'No relief view for this stage',
      'The relief view is the stage\'s own coordinates and elevations drawn '
      + 'from an angle. Without route geometry and a sampled elevation series '
      + 'there is nothing to draw, and a smoothed guess at the shape of a '
      + 'mountain range would be a picture of nothing.', '§5.3');
    return;
  }

  const cv = el('canvas');
  cv.tabIndex = 0;
  host.append(cv);

  // Controls first as buttons, because a range input alone is awkward with a
  // keyboard and impossible to label with a named scale.
  [['True', 'true'], ['Reading', 'reading'], ['Story', 'story']]
    .forEach(([label, key]) => {
      const b = el('button', 'chip', label);
      b.type = 'button';
      b.title = `Vertical scale ×${RELIEF.presets[key]}`;
      b.addEventListener('click', () => {
        RELIEF.ve = RELIEF.presets[key];
        drawRelief();
      });
      ctl && ctl.append(b);
    });
  const reset = el('button', 'chip', 'Reset view');
  reset.type = 'button';
  reset.addEventListener('click', () => {
    RELIEF.yaw = -0.6; RELIEF.pitch = 0.62; RELIEF.ve = 6; drawRelief();
  });
  ctl && ctl.append(reset);

  const clampPitch = v => Math.max(0.08, Math.min(1.45, v));
  cv.addEventListener('pointerdown', e => {
    RELIEF.dragging = { x: e.clientX, y: e.clientY, moved: false };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (!RELIEF.dragging) return;
    const dx = e.clientX - RELIEF.dragging.x;
    const dy = e.clientY - RELIEF.dragging.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) RELIEF.dragging.moved = true;
    RELIEF.yaw += dx * 0.008;
    RELIEF.pitch = clampPitch(RELIEF.pitch + dy * 0.005);
    RELIEF.dragging.x = e.clientX;
    RELIEF.dragging.y = e.clientY;
    drawRelief();
  });
  const endDrag = () => { RELIEF.dragging = null; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  // Everything the pointer can do, the keyboard can do. §15 requires full
  // keyboard operation and forbids an interaction that exists only on hover
  // or drag, and a rotate-only-by-drag control is exactly that.
  cv.addEventListener('keydown', e => {
    const step = e.shiftKey ? 0.25 : 0.08;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': RELIEF.yaw -= step; break;
      case 'ArrowRight': RELIEF.yaw += step; break;
      case 'ArrowUp': RELIEF.pitch = clampPitch(RELIEF.pitch + step); break;
      case 'ArrowDown': RELIEF.pitch = clampPitch(RELIEF.pitch - step); break;
      case '+': case '=': RELIEF.ve = Math.min(30, RELIEF.ve + 1); break;
      case '-': case '_': RELIEF.ve = Math.max(1, RELIEF.ve - 1); break;
      case '0': RELIEF.yaw = -0.6; RELIEF.pitch = 0.62; RELIEF.ve = 6; break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); drawRelief(); }
  });

  drawRelief();
}

/* §7.F. Two surfaces read as the same on an elevation profile and ride
 * nothing alike, and until this existed the Observatory published Paris–
 * Roubaix's altitude and said nothing about its pavé.
 *
 * The four classes are kept apart deliberately. `paving_stones` is a made,
 * flat surface — a town square or a modern shared space — and calling it
 * cobbles because it is stone would put a pedestrianised plaza in the same
 * column as the Carrefour de l'Arbre. It gets its own class and its own
 * colour, and the caption says what it is.
 *
 * Colour is never the only carrier: each class has a fill pattern as well as
 * a hue, the table states the class in words, and every bar carries a title.
 * §20 requires that, and a surface strip is exactly the chart where a reader
 * with no colour vision would otherwise be left with a grey ribbon. */
/* Zoom the shared distance axis to a feature (§15: "selecting climbs,
 * descents, sectors, sprints ... highlights/zooms corresponding map/profile
 * ranges"). Every caller passes a route-kilometre span; the padding is a
 * fraction of that span rather than a fixed number of kilometres, so a
 * 400 m pavé sector and a 20 km col both arrive framed rather than one of
 * them filling the chart and the other lost in it.
 *
 * The cursor is placed at the feature too, because the map and the relief
 * view follow the cursor and a zoom that left it elsewhere would highlight
 * one thing and point at another. */
function zoomToSpan(a, b, label) {
  if (a == null || b == null || !(b > a)) return;
  const padKm = Math.max(0.15, (b - a) * 0.35);
  state.range = [Math.max(0, a - padKm), b + padKm];
  state.km = (a + b) / 2;
  writeUrl(true);
  renderStage();
  const note = $('#profile-axis-note');
  if (note && label) note.title = 'Zoomed to ' + label;
}

const SURFACE_CLASSES = {
  PAVE: ['Pavé', 'Cobbles and setts — the surface the classics are run on.'],
  GRAVEL: ['Gravel', 'Gravel, fine gravel and compacted stone.'],
  UNPAVED: ['Unpaved', 'Dirt, earth, sand and other unmade surfaces.'],
  SMOOTH_STONE: ['Paving stones', 'Flat laid stone. A made surface, and not '
    + 'pavé — usually a square or a town centre the route passes through.'],
};

function surfaceSectors() {
  const c = chunk();
  return (c && c.surface_sectors) || [];
}

function renderSurfaceStrip() {
  const strip = $('#surface-strip');
  if (!strip) return;
  const secs = surfaceSectors();
  strip.innerHTML = '';
  // Absent, not empty. A strip drawn with nothing in it says the road is
  // smooth; no strip at all says nothing, which is the honest thing to say
  // when there is nothing to say.
  strip.hidden = !secs.length;
  if (!secs.length) return;
  const s = stageMeta();
  const total = (s && s.km) || Math.max(...secs.map(x => x.end_km));
  // The strip shares the profile's window as well as its axis. Left on the
  // full route while the chart above it zoomed, every bar would sit under
  // the wrong kilometre — worse than not drawing it, because it would still
  // look aligned.
  const a = state.range ? state.range[0] : 0;
  const b = state.range ? state.range[1] : total;
  const span = Math.max(0.001, b - a);
  secs.filter(sec => sec.end_km > a && sec.start_km < b).forEach(sec => {
    const bar = el('span', 'surface-strip__bar surface-strip__bar--'
      + sec.class.toLowerCase());
    const from = Math.max(sec.start_km, a), to = Math.min(sec.end_km, b);
    bar.style.left = (100 * (from - a) / span) + '%';
    // A 200 m sector on a 260 km route is 0.08 % of the width and would
    // vanish; a floor of one pixel keeps it visible without moving its start.
    bar.style.width = 'max(1px, ' + (100 * (to - from) / span) + '%)';
    const names = sec.names.length ? sec.names.join(', ') : 'unnamed';
    bar.title = `${SURFACE_CLASSES[sec.class][0]} — ${names}, `
      + `${Math.round(sec.length_km * 1000)} m from km ${sec.start_km.toFixed(1)}`;
    strip.append(bar);
  });
  strip.setAttribute('role', 'img');
  strip.setAttribute('aria-label',
    `Road surface along the route: ${secs.length} sectors, `
    + secs.reduce((a, x) => a + x.length_km, 0).toFixed(1) + ' km in total');
}

function renderSurface() {
  const t = $('#surface-table'), panel = $('#panel-surface');
  const c = chunk(), secs = surfaceSectors();
  const survey = c && c.surface_survey;
  if (!t || !panel) return;
  t.innerHTML = '';
  panel.querySelectorAll('.absence-host').forEach(n => n.remove());
  $('#surface-caption').textContent = '';

  if (!secs.length) {
    const h = el('div', 'absence-host');
    (panel.querySelector('.panel__body') || panel).append(h);
    // The distinction the survey record exists for. One of these is a fact
    // about the road; the other is a fact about how far this project has got.
    if (survey) {
      absence(h, 'No rough surface on this route',
        'OpenStreetMap was asked about this route on '
        + survey.surveyed_at.slice(0, 10) + ' and offered '
        + survey.ways_offered + ' candidate ways within '
        + survey.corridor_m + ' m of it, none of which ran along the course '
        + 'far enough or straight enough to be a sector. So this is a smooth '
        + 'route as far as the road network records it, not an unresearched '
        + 'one.', '§7.F');
    } else {
      absence(h, 'Road surface not yet surveyed',
        'Surface sectors are matched from the OpenStreetMap road network '
        + 'against this route. That has not been run for this stage, so '
        + 'nothing is claimed either way — an absence here is this project’s, '
        + 'not the road\'s.', '§7.F',
        'Running the surface survey for this stage would fill it.');
    }
    return;
  }

  const head = el('thead'), hr = el('tr');
  ['km', 'Length', 'Surface', 'Road', 'Ways', 'Bearing'].forEach(x => {
    const th = el('th', null, x);
    th.scope = 'col';
    hr.append(th);
  });
  head.append(hr); t.append(head);
  const body = el('tbody');
  secs.forEach(sec => {
    const tr = el('tr');
    tr.append(el('td', 'num', sec.start_km.toFixed(1)));
    tr.append(el('td', 'num', Math.round(sec.length_km * 1000) + ' m'));
    const cls = el('td');
    cls.append(el('span', 'tag tag--surface-' + sec.class.toLowerCase(),
                  SURFACE_CLASSES[sec.class][0]));
    tr.append(cls);
    tr.append(el('td', null, sec.names.length ? sec.names.join(', ') : '—'));
    tr.append(el('td', 'num', String(sec.ways)));
    // The weakest agreement among the merged parts, in degrees. Shown because
    // it is the number that says how confident the match is, and hiding it
    // would make a 35° match look identical to a 4° one.
    tr.append(el('td', 'num', sec.max_bearing_delta_deg.toFixed(0) + '°'));
    tr.tabIndex = 0;
    tr.title = 'Show this sector on the profile, map and relief view';
    const go = () => zoomToSpan(sec.start_km, sec.end_km,
      sec.names.length ? sec.names.join(', ') : 'this sector');
    tr.onclick = go;
    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
    body.append(tr);
  });
  t.append(body);

  const totals = {};
  secs.forEach(s => { totals[s.class] = (totals[s.class] || 0) + s.length_km; });
  const summary = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${v.toFixed(2)} km ${SURFACE_CLASSES[k][0].toLowerCase()}`)
    .join(', ');
  $('#surface-caption').textContent =
    summary + '. Road surface from OpenStreetMap, © OpenStreetMap '
    + 'contributors, ODbL 1.0. Matched to this route by corridor, bearing and '
    + 'length — the kilometres are this project’s, the surface is not. '
    + (survey ? `Surveyed ${survey.surveyed_at.slice(0, 10)}; `
        + `${survey.ways_offered} ways offered, ${survey.sectors_kept} kept.`
      : '');
}

function renderSky() {
  const host = $('#sky-host'), ws = waypoints().filter(w => w.km != null);
  if (!ws.length || ws.every(w => w.sun_el == null)) {
    absence(host, 'No road-and-sky data',
      'These fields derive from official passage windows joined to route '
    + 'positions. Without usable route geometry there is nothing to join to.',
      '§5.3');
    return;
  }
  const maxKm = Math.max(...ws.map(w => w.km));
  const RW = 520, RH = 210, P = { l: 40, r: 12 };
  const X = km => P.l + (km / maxKm) * (RW - P.l - P.r);
  const svg = svgEl('svg', { viewBox: `0 0 ${RW} ${RH}`, role: 'img',
    'aria-label': 'Solar elevation, temperature and wind exposure along the route' });

  [{ key: 'sun_el', label: 'sun °', color: 'var(--series-4)', y: 14, h: 52 },
   { key: 'temp', label: '°C', color: 'var(--series-7)', y: 76, h: 52 }
  ].forEach(lane => {
    const vals = ws.map(w => w[lane.key]).filter(v => v != null);
    if (!vals.length) return;
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const Y = v => lane.y + lane.h - ((v - lo) / ((hi - lo) || 1)) * lane.h;
    let d = '';
    ws.forEach(w => {
      if (w[lane.key] == null) return;
      d += (d ? ' L ' : 'M ') + X(w.km) + ' ' + Y(w[lane.key]);
    });
    svg.append(svgEl('path', { d, fill: 'none', stroke: lane.color,
      'stroke-width': 2, 'stroke-linejoin': 'round' }));
    const t = svgEl('text', { x: 4, y: lane.y + 10, fill: 'var(--text-3)',
      'font-size': 10, 'font-family': 'var(--mono)' });
    t.textContent = `${lane.label} ${Math.round(lo)}–${Math.round(hi)}`;
    svg.append(t);
  });

  const cmap = { HEADWIND: 'var(--series-2)', TAILWIND: 'var(--series-3)',
                 CROSSWIND: 'var(--series-4)', LIGHT: 'var(--text-3)' };
  ws.forEach((w, i) => {
    if (!w.exposure) return;
    const nx = i < ws.length - 1 ? X(ws[i + 1].km) : X(w.km) + 3;
    svg.append(svgEl('rect', { x: X(w.km), y: 140,
      width: Math.max(2, nx - X(w.km) - 1), height: 20, rx: 3,
      fill: cmap[w.exposure] || 'var(--text-3)' }));
  });
  const wt = svgEl('text', { x: 4, y: 154, fill: 'var(--text-3)',
    'font-size': 10, 'font-family': 'var(--mono)' });
  wt.textContent = 'wind';
  svg.append(wt);

  if (state.uncertainty) {
    const widths = ws.map(w => w.win_s).filter(v => v != null);
    if (widths.length) {
      const hi = Math.max(...widths);
      ws.forEach(w => {
        if (w.win_s == null) return;
        svg.append(svgEl('rect', { x: X(w.km), y: 170, width: 2,
          height: (w.win_s / hi) * 18, fill: 'var(--st-derived)', opacity: .8 }));
      });
      const t = svgEl('text', { x: 4, y: 184, fill: 'var(--text-3)',
        'font-size': 10, 'font-family': 'var(--mono)' });
      t.textContent = `± ${Math.round(hi / 60)}′`;
      svg.append(t);
    }
  }
  const cur = svgEl('line', { y1: 8, y2: RH - 18, stroke: 'var(--series-1)',
    opacity: 0 });
  svg.append(cur);
  host.innerHTML = '';
  host.append(svg);
  const legend = el('div', 'legend');
  Object.entries(cmap).forEach(([k, c]) => {
    const sp = el('span'), i = el('i');
    i.style.background = c;
    sp.append(i, document.createTextNode(k.toLowerCase()));
    legend.append(sp);
  });
  host.append(legend);

  onCursor(() => {
    if (state.km == null) { cur.setAttribute('opacity', 0); return; }
    cur.setAttribute('x1', X(state.km));
    cur.setAttribute('x2', X(state.km));
    cur.setAttribute('opacity', 1);
  });
}

function renderWaypoints() {
  const t = $('#wp-table'), ws = waypoints(), s = stageMeta();
  t.innerHTML = '';
  if (!ws.length) {
    const panel = $('#panel-waypoints');
    panel.querySelectorAll('.absence-host').forEach(n => n.remove());
    const h = el('div', 'absence-host');
    (panel.querySelector('.panel__body') || panel).append(h);
    absence(h, `No roadbook itinerary for stage ${s.n}`,
      'The itinerary is the organiser\'s own list of course points with the '
    + 'time window the race is expected to pass each one. None was published '
    + 'in a form this project can read for this stage.',
      '§5.3',
      'A roadbook or timing document from the organiser would fill it. The '
    + 'itinerary is read from those, not derived from the route.');
    return;
  }
  const head = el('thead'), hr = el('tr');
  ['km', 'Waypoint', 'Elev', 'Passage window', '±', 'Sun', '°C', 'Wind', 'Exposure']
    .forEach(h => hr.append(el('th', null, h)));
  head.append(hr);
  t.append(head);
  const body = el('tbody');
  const q = ($('#wp-filter').value || '').toLowerCase();
  ws.filter(w => !q || w.label.toLowerCase().includes(q)).forEach(w => {
    const tr = el('tr');
    tr.dataset.km = w.km;
    [[fmt(w.km, 1), 'num'], [w.label, ''],
     [w.elev == null ? '—' : Math.round(w.elev), 'num'],
     [w.win && w.win[0] ? `${w.win[0]}–${w.win[1]}` : '—', 'num'],
     [w.win_s == null ? '—' : Math.round(w.win_s / 60) + '′', 'num'],
     [w.sun_el == null ? '—' : fmt(w.sun_el, 0) + '°', 'num'],
     [w.temp == null ? '—' : fmt(w.temp, 1), 'num'],
     [w.wind == null ? '—' : fmt(w.wind, 1), 'num'],
     [w.exposure || '—', '']].forEach(([v, c]) => {
      const td = el('td', c, String(v));
      if (v === '—') td.classList.add('muted');
      tr.append(td);
    });
    tr.onclick = () => { state.km = w.km; emitCursor(); openWaypointPassport(w); };
    body.append(tr);
  });
  t.append(body);
}

/* Sortable, filterable rider tables — the interaction the named role models
 * (ProCyclingStats, FirstCycling) build around and this product did not have
 * at all: every results/GC table here was a static printout in finish order,
 * with no way to sort by name or team and no way to find one rider in a
 * field of 160 without reading down the column by eye.
 *
 * State lives per table id so switching stages doesn't lose it, but a stage
 * that never held this table before defaults to unsorted (the data's own
 * order) rather than inheriting a column index from a differently-shaped
 * table on another stage.
 */
const sortState = new Map(); // table id -> {col, dir}

/* Fold a string for searching: lower case, and accents removed.
 *
 * A peloton is not spelled in ASCII. Pogačar, Vingegaard, Wærenskjold, García,
 * Küng — and a reader looking for any of them types the letters on their
 * keyboard. Comparing raw strings means "pogacar" finds nothing while
 * "Pogačar" sits on screen, which reads as a broken filter rather than as a
 * diacritic.
 *
 * Both sides are folded, so the filter is symmetric: typing the accented form
 * still matches, and a name stored in one publisher's orthography is found by
 * a reader who knows it in another's. NFD splits a letter from its combining
 * mark and the mark is then dropped; the same normalisation the ingest side
 * uses for identity keys, applied here for searching only — nothing displayed
 * is changed. */
const foldSearch = s => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function sortableTable(tableId, filterId, columns, rows, rowKey) {
  const t = $('#' + tableId);
  const q = filterId ? foldSearch(($('#' + filterId).value || '').trim()) : '';
  const filtered = q
    ? rows.filter(r => columns.some(c => c.filterable !== false
        && foldSearch(c.get(r)).includes(q)))
    : rows;

  const st = sortState.get(tableId);
  let sorted = filtered;
  if (st) {
    const col = columns[st.col];
    sorted = filtered.slice().sort((a, b) => {
      const av = col.sortKey ? col.sortKey(a) : col.get(a);
      const bv = col.sortKey ? col.sortKey(b) : col.get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;   // nulls last regardless of direction
      if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return st.dir === 'desc' ? -cmp : cmp;
    });
  }

  t.innerHTML = '';
  const head = el('thead'), hr = el('tr');
  columns.forEach((c, i) => {
    const th = el('th', null, c.label);
    if (c.sortKey !== false) {
      th.classList.add('sortable');
      if (st && st.col === i) th.classList.add(st.dir === 'desc' ? 'sort-desc' : 'sort-asc');
      th.onclick = () => {
        const cur = sortState.get(tableId);
        sortState.set(tableId, cur && cur.col === i
          ? { col: i, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
          : { col: i, dir: 'asc' });
        sortableTable(tableId, filterId, columns, rows, rowKey);
      };
    }
    hr.append(th);
  });
  head.append(hr); t.append(head);

  const body = el('tbody');
  const paint = list => list.forEach(r => {
    const tr = el('tr');
    columns.forEach(c => {
      const v = c.render ? c.render(r) : String(c.get(r) ?? '—');
      const td = el('td', c.cls || '', v);
      if (v === '—') td.classList.add('muted');
      tr.append(td);
    });
    if (rowKey) tr.onclick = () => rowKey(r);
    body.append(tr);
  });

  /* Long tables render their first window and grow when asked.
   *
   * The general classification is 158 rows and the startlist 184, and both
   * were built in full on every filter keystroke and every sort — on a phone
   * that is several hundred cells rebuilt between one character and the next.
   *
   * Chunked rather than windowed on scroll position: a virtual list has to
   * fake its own scrollbar with padding rows, and a table whose height lies
   * about its contents breaks the sticky header, in-page search and the
   * "shown of total" count this returns. Growing on demand keeps the DOM
   * honest — every row that exists is a row that is there.
   */
  const CHUNK = 50;
  if (sorted.length > CHUNK) {
    let shownTo = CHUNK;
    paint(sorted.slice(0, CHUNK));
    t.append(body);
    const more = el('tfoot');
    const trm = el('tr'), tdm = el('td');
    tdm.colSpan = columns.length;
    const btn = el('button', 'table__more');
    btn.type = 'button';
    const label = () => {
      btn.textContent = `Show ${Math.min(CHUNK, sorted.length - shownTo)} more `
                      + `· ${shownTo} of ${sorted.length}`;
    };
    btn.onclick = () => {
      paint(sorted.slice(shownTo, shownTo + CHUNK));
      shownTo = Math.min(sorted.length, shownTo + CHUNK);
      if (shownTo >= sorted.length) trm.remove(); else label();
    };
    label();
    tdm.append(btn); trm.append(tdm); more.append(trm); t.append(more);
    return { shown: sorted.length, total: rows.length };
  }

  paint(sorted);
  t.append(body);
  return { shown: sorted.length, total: rows.length };
}

function highlightWaypointRow(w) {
  document.querySelectorAll('#wp-table tbody tr').forEach(tr =>
    tr.classList.toggle('is-active', !!w && +tr.dataset.km === w.km));
}

const RESULT_COLUMNS = [
  { label: '#', get: r => r.rank, cls: 'num' },
  { label: 'Rider', get: r => r.rider },
  { label: 'Bib', get: r => r.bib, cls: 'num' },
  { label: 'Team', get: r => r.team },
  { label: 'Time', get: r => r.time_s, cls: 'num', render: r => hhmmss(r.time_s) },
  { label: 'Gap', get: r => r.gap_s, cls: 'num',
    render: r => r.gap_s ? '+' + hhmmss(r.gap_s) : '—' },
  { label: 'Bonus', get: r => r.bonus_s, cls: 'num',
    render: r => r.bonus_s ? `−${r.bonus_s}"` : '—' },
  { label: 'Pen', get: r => r.pen_s, cls: 'num',
    render: r => r.pen_s ? `+${r.pen_s}"` : '—' },
];

function renderResults() {
  const rs = results(), s = stageMeta();
  const panel = $('#panel-results');
  panel.querySelectorAll('.absence-host').forEach(n => n.remove());
  const filter = $('#res-filter');
  if (!rs.length) {
    $('#res-table').innerHTML = '';
    filter.hidden = true;
    const h = el('div', 'absence-host');
    panel.append(h);
    absence(h, `Stage ${s.n} has no result`,
      s.n >= 20 ? 'This stage has not been raced yet. The observatory shows no '
        + 'result rather than an empty or provisional-looking table.'
        : 'No result table was captured for this stage.', '§5.9');
    return;
  }
  filter.hidden = false;
  sortableTable('res-table', 'res-filter', RESULT_COLUMNS, rs, r =>
    openInspector({
      kind: 'Stage result', title: `${r.rider} — stage ${s.n}`,
      rows: [['Rank', r.rank], ['Bib', r.bib], ['Team', r.team],
             ['Finish time', hhmmss(r.time_s)],
             ['Gap', r.gap_s ? '+' + hhmmss(r.gap_s) : 'leader'],
             ['Bonus', r.bonus_s + ' s'], ['Penalty', r.pen_s + ' s'],
             ['Source', resultsSource()],
             ['Status', 'OBSERVED_FACT']],
      note: 'Parsed from the publisher\'s per-stage result table. Times '
          + 'normalise "03h 17\' 57\'\'" to seconds; the raw string is retained '
          + 'in the claim record with the artifact hash and cell locator.',
    }));
}

const GC_COLUMNS = [
  { label: '#', get: r => r.rank, cls: 'num' },
  { label: 'Rider', get: r => r.rider },
  { label: 'Team', get: r => r.team || null },
  { label: 'Time', get: r => r.time_s, cls: 'num', render: r => hhmmss(r.time_s) },
  { label: 'Gap', get: r => r.gap_s, cls: 'num',
    render: r => r.gap_s ? '+' + hhmmss(r.gap_s) : '—' },
];

/* Classifications — the Tier-2 fallback, rendered with its downgrade visible. */
function renderGC() {
  const c = chunk(), rows = (c && c.gc) || [];
  const filter = $('#gc-filter');
  if (!rows.length) {
    $('#gc-note').textContent = '';
    filter.hidden = true;
    const s = stageMeta();
    $('#gc-table').innerHTML = '';
    const panel = $('#panel-gc');
    panel.querySelectorAll('.absence-host').forEach(n => n.remove());
    const h = el('div', 'absence-host');
    (panel.querySelector('.panel__body') || panel).append(h);
    const unraced = s.results_count === 0;
    absence(h, `No general classification after stage ${s.n}`,
      unraced
        ? 'This stage has not been raced, so there is no standing after it. '
          + 'An empty table here would look like a classification in which '
          + 'nobody is placed.'
        : 'The classification is summed from official per-stage finish times, '
          + 'and this stage has none to add.',
      '§5.9',
      unraced
        ? 'It fills itself on the day: the stage result is captured, and the '
          + 'sum runs over every stage completed so far.'
        : 'A published result table for this stage would complete the sum.');
    return;
  }
  filter.hidden = false;
  const { shown, total } = sortableTable('gc-table', 'gc-filter', GC_COLUMNS, rows, r =>
    openInspector({
      kind: 'General classification', title: r.rider,
      rows: [['Rank', r.rank], ['Team', r.team || '—'],
             ['Cumulative time', hhmmss(r.time_s)],
             ['Gap to leader', r.gap_s ? '+' + hhmmss(r.gap_s) : 'leader'],
             ['Formula', 'general_classification (derived_gc/1.0.0)'],
             ['Status', 'DERIVED_REPRODUCIBLE']],
      note: 'Sum of official per-stage finish times plus penalties minus '
          + 'bonuses, over every stage this rider completed. Cross-checked '
          + 'against an independently published top ten: all ten positions, '
          + 'times and gaps reproduce exactly. Riders who miss a stage stop '
          + 'accumulating and leave the classification rather than carrying '
          + 'a stale total forward.',
    }));
  $('#gc-note').textContent = shown === total ? `${total} riders`
    : `${shown} of ${total} riders`;
}

function renderOfficialClimbs() {
  const t = $('#oc-table'), c = chunk(), rows = (c && c.official_climbs) || [];
  t.innerHTML = '';
  if (!rows.length) {
    const s = stageMeta();
    const panel = $('#panel-official-climbs');
    panel.querySelectorAll('.absence-host').forEach(n => n.remove());
    const h = el('div', 'absence-host');
    (panel.querySelector('.panel__body') || panel).append(h);
    // Two different absences wearing the same empty table. A flat stage has
    // no classified climbs because the organiser classified none; a stage
    // with no roadbook has none because nobody has read its list yet. Saying
    // "none" for both would report a fact about the road for one of them and
    // a fact about this project for the other.
    const known = !!(chunk() && chunk().profile);
    absence(h, `No classified climbs on stage ${s.n}`,
      known
        ? 'The organiser categorised no climb on this stage. That is the '
          + 'organiser\'s own judgement of the parcours, not an absence of '
          + 'data — the detected climb fingerprints below are computed '
          + 'regardless and are not categorisations.'
        : 'The organiser\'s categorised climb list is read from its roadbook, '
          + 'and none has been read for this stage.',
      '§5.4',
      known ? null
            : 'A roadbook for this stage would fill it.');
    return;
  }
  const head = el('thead'), hr = el('tr');
  ['Cat', 'Climb', 'Summit km', 'Summit', 'Length', 'Avg', 'Profile', 'Residual']
    .forEach(h => hr.append(el('th', null, h)));
  head.append(hr); t.append(head);
  const body = el('tbody');
  rows.forEach(r => {
    const tr = el('tr');
    const cat = el('td');
    const chip = el('span', 'cat cat--' + String(r.category).toLowerCase(),
                    r.category);
    cat.append(chip);
    tr.append(cat);
    [[r.name, ''], [fmt(r.summit_km, 1), 'num'],
     [r.summit_elev == null ? '—' : r.summit_elev + ' m', 'num'],
     [r.length_km == null ? '—' : fmt(r.length_km, 1) + ' km', 'num'],
     [r.avg_grad == null ? '—' : fmt(r.avg_grad, 1) + ' %', 'num'],
     [r.detected_elev == null ? '—' : Math.round(r.detected_elev) + ' m', 'num'],
     [r.residual_m == null ? '—'
       : (r.residual_m > 0 ? '+' : '') + Math.round(r.residual_m) + ' m', 'num']]
      .forEach(([v, cl]) => {
        const td = el('td', cl, String(v));
        if (v === '—') td.classList.add('muted');
        tr.append(td);
      });
    if (r.residual_m != null && Math.abs(r.residual_m) > 25) {
      tr.lastChild.style.color = 'var(--st-conflict)';
    }
    // The same organiser publishes each climb twice — once in the roadbook
    // table, once in the note attached to the summit's own coordinate. Where
    // the two disagree, both are shown; picking one silently would hide that
    // a published figure is wrong.
    const st = (chunk().climb_statements || []).find(x => x.name === r.name);
    const disputed = st && st.note_gradient != null && r.avg_grad != null
      && Math.abs(st.note_gradient - r.avg_grad) > 0.05;
    if (disputed) {
      tr.children[5].classList.add('is-disputed');
      tr.children[5].title = 'The organiser publishes two different gradients '
        + 'for this climb';
    }
    tr.onclick = () => {
      // The organiser publishes a summit and a length, so the climb's foot is
      // summit minus length. Where it publishes no length there is no span to
      // zoom to and the cursor move is all that is honest.
      if (r.summit_km != null && r.length_km) {
        zoomToSpan(r.summit_km - r.length_km, r.summit_km, r.name);
      } else if (r.summit_km != null) {
        state.km = r.summit_km; emitCursor();
      }
      const rows = [['ASO category', r.category],
             ['Summit at', fmt(r.summit_km, 2) + ' km'],
             ['Official summit altitude', (r.summit_elev ?? '—') + ' m'],
             ['Official length', r.length_km == null ? '—' : fmt(r.length_km, 1) + ' km'],
             ['Official avg gradient', r.avg_grad == null ? '—' : fmt(r.avg_grad, 1) + ' %']];
      if (disputed) {
        rows.push(['Gradient in the siting note',
                   fmt(st.note_gradient, 1) + ' %  — disagrees']);
      }
      if (st && st.position_residual_km != null) {
        rows.push(['Published coordinate falls at',
                   fmt(r.summit_km + st.position_residual_km, 2) + ' km'
                   + ` (${st.position_residual_km > 0 ? '+' : ''}`
                   + `${fmt(st.position_residual_km, 2)} km)`]);
      }
      rows.push(['Derived profile elevation', r.detected_elev == null
                  ? 'no detection matched' : Math.round(r.detected_elev) + ' m'],
                ['Residual', r.residual_m == null ? '—' : Math.round(r.residual_m) + ' m'],
                ['Status', disputed ? 'CONFLICTING' : 'OBSERVED_FACT']);
      openInspector({
        kind: 'Official climb', title: r.name,
        rows,
        note: 'Category, length and average gradient are the organiser\'s own '
            + 'figures and are never inferred from the profile. The residual '
            + 'compares the derived profile against the officially published '
            + 'summit altitude, which is an independent measurement of the '
            + 'same point — so it measures the profile, not the climb.'
            + (disputed ? ' This climb is published twice by the organiser '
              + 'with two different gradients. Both are shown; the elevation '
              + 'model measures the road itself and the disagreement is '
              + 'recorded in the gap register rather than resolved silently.'
              : ''),
      });
    };
    body.append(tr);
  });
  t.append(body);
}

function renderScales() {
  const host = $('#scales-host'), c = chunk();
  const scales = (c && c.points_scales) || {};
  host.innerHTML = '';
  if (!Object.keys(scales).length) {
    absence(host, 'No published points scales for this stage',
      'The organiser publishes these on the stage page; none were found for '
    + 'this stage.', '§5.1');
    return;
  }
  const order = ['SPRINT', 'KOM', 'POINTS_FINISH', 'KOM_FINISH', 'BONUS'];
  const title = { SPRINT: 'Intermediate sprint', KOM: 'Climb points',
                  POINTS_FINISH: 'Finish — green jersey',
                  KOM_FINISH: 'Finish — polka-dot jersey',
                  BONUS: 'Time bonuses' };
  order.filter(k => scales[k]).forEach(kind => {
    Object.entries(scales[kind]).forEach(([label, e]) => {
      const box = el('div', 'classif');
      const head = el('div', 'classif__head');
      head.append(el('h3', null, title[kind]));
      if (label && label !== title[kind]) {
        head.append(el('span', 'muted', label));
      }
      box.append(head);
      const strip = el('div', 'scale');
      e.places.slice(0, 15).forEach(([place, pts]) => {
        const cell = el('div', 'scale__cell');
        cell.append(el('span', 'scale__place', place + '.'),
                    el('b', null, pts + (e.unit === 'seconds' ? '″' : '')));
        strip.append(cell);
      });
      box.append(strip);
      box.onclick = () => openInspector({
        kind: title[kind], title: label,
        rows: [['Scale kind', kind], ['Unit', e.unit],
               ['Places awarded', e.places.length],
               ['Top value', e.places[0] ? e.places[0][1] : '—'],
               ['Source', 'letour.fr (TIER_0_OFFICIAL)'],
               ['Status', 'OBSERVED_FACT']],
        note: 'Published by the organiser on the stage page. Scales are kept '
            + 'apart by kind because they feed different classifications — '
            + 'merging an intermediate sprint into the mountains scale was a '
            + 'real bug this separation prevents.',
      });
      host.append(box);
    });
  });
}

/* Jerseys and standings were one panel with one fixed caption, and the caption
 * was wrong twice over. It described a Tier-2 fallback — true for stage 20's
 * top tens, false for stage 21's complete Tier-0 general classification — and
 * it explained the provenance of standings that are absent on nineteen of
 * twenty-one stages, where the panel holds nothing but the jersey strip.
 *
 * Two panels now, and the provenance moves onto each table, where the data has
 * carried it all along. A caption that is fixed while what it describes varies
 * is a caption that will be wrong about something. */
/* The jerseys, as jerseys.
 *
 * A classification is an abstraction; a jersey is an object, and the object
 * is how the sport itself names the abstraction — nobody says "the leader of
 * the mountains classification", they say the polka-dot. The strip used to
 * render the word "mountains" over a name, which is the abstraction with the
 * recognisable thing removed.
 *
 * TEAM is deliberately not given a jersey: the Tour awards no team jersey, and
 * drawing one would invent a garment to fill a slot in a layout. It gets a
 * plain marker and keeps its place in the row.
 */
const JERSEY_FILL = {
  GENERAL: '#f5d033', POINTS: '#2fae5a', MOUNTAINS: '#ffffff',
  YOUTH: '#ffffff', TEAM: null,
};
const JERSEY_NAME = {
  GENERAL: 'yellow jersey · general classification',
  POINTS: 'green jersey · points',
  MOUNTAINS: 'polka-dot jersey · mountains',
  YOUTH: 'white jersey · best young rider',
  TEAM: 'team classification',
};
function jerseyIcon(kind) {
  const fill = JERSEY_FILL[kind];
  const svg = svgEl('svg', { class: 'jerseyicon', viewBox: '0 0 32 32',
                             'aria-hidden': 'true', focusable: 'false' });
  if (!fill) {
    svg.append(svgEl('path', { d: 'M8 22 h16 M8 16 h16 M8 10 h16',
      stroke: 'var(--text-3)', 'stroke-width': 2, 'stroke-linecap': 'round' }));
    return svg;
  }
  // Body plus two sleeves — enough of a jersey to be read at 28 px.
  const body = 'M11 5 L7 8 L4 13 L8 15.5 L9 13 V27 H23 V13 L24 15.5 L28 13 '
             + 'L25 8 L21 5 C20 7.5 12 7.5 11 5 Z';
  svg.append(svgEl('path', { d: body, fill,
    stroke: 'rgba(0,0,0,.45)', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }));
  if (kind === 'MOUNTAINS') {
    [[12, 12], [19, 11], [15, 17], [21, 17], [12, 22], [19, 23]]
      .forEach(([cx, cy]) =>
        svg.append(svgEl('circle', { cx, cy, r: 1.9, fill: '#d62c2c' })));
  }
  return svg;
}

function renderJerseys() {
  const host = $('#jersey-host'), c = chunk();
  const jerseys = (c && c.jerseys) || {};
  host.innerHTML = '';
  $('#jersey-caption').textContent = '';
  if (!Object.keys(jerseys).length) {
    absence(host, 'No jersey holders recorded for this stage',
      'Jersey history comes from the CC BY-SA article, which records it per '
    + 'stage; this stage is not among them.', '§5.9');
    return;
  }
  const cls = (c && c.classifications) || {};
  const strip = el('div', 'jerseys');
  const sources = new Set();
  // A fixed order, so the row does not reshuffle between stages as the object
  // key order changes. Anything unexpected is appended rather than dropped.
  const ORDER = ['GENERAL', 'POINTS', 'MOUNTAINS', 'YOUTH', 'TEAM'];
  const keys = Object.keys(jerseys).sort((a, b) => {
    const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  keys.forEach(k => {
    const v = jerseys[k];
    sources.add(v.source);
    const j = el('div', 'jersey jersey--' + k.toLowerCase());
    j.append(jerseyIcon(k));
    const txt = el('div', 'jersey__text');
    txt.append(el('div', 'jersey__label', (JERSEY_NAME[k] || k.toLowerCase())
                                          .split(' · ')[0]));
    txt.append(el('div', 'jersey__holder', v.holder));

    // The leader's own number, taken from the classification table for the
    // same stage where one is held. The strip said who led and never by how
    // much, which is the only quantity anybody wanted from it.
    const lead = (cls[k] && cls[k].rows || []).find(r =>
      (r.rider || r.team) === v.holder) || (cls[k] && cls[k].rows || [])[0];
    if (lead) {
      const val = lead.points != null ? `${lead.points} pts`
        : lead.time_s != null ? hhmmss(lead.time_s)
        : lead.gap_s != null ? '+' + hhmmss(lead.gap_s) : null;
      const bits = [lead.nat, val].filter(Boolean);
      if (bits.length) txt.append(el('div', 'jersey__value', bits.join(' · ')));
    }
    j.append(txt);
    // The tag says where the holder came from, not the whole panel — the
    // classification tables behind these can be Tier 0 on one stage and a
    // Tier-2 fallback on the next.
    const official = cls[k] && cls[k].tier === 'TIER_0_OFFICIAL';
    j.append(el('span', 'tag ' + (official ? 'tag--observed' : 'tag--derived'),
                official ? 'observed' : 'reported'));
    j.title = `${JERSEY_NAME[k] || k.toLowerCase()} after this stage, `
            + `held by ${v.holder}, from ${v.source}`;
    strip.append(j);
  });
  host.append(strip);
  $('#jersey-caption').textContent =
    'Who led each classification after this stage, from '
    + [...sources].sort().join(' and ')
    + '. Wikipedia content is CC BY-SA 4.0.';
}

function renderClassifications() {
  const host = $('#classif-host'), c = chunk();
  host.innerHTML = '';
  $('#classif-note').textContent = '';
  $('#classif-caption').textContent = '';
  const cls = (c && c.classifications) || {};
  if (!Object.keys(cls).length) {
    absence(host, 'No classification standings for this stage',
      'The organiser publishes these tables only from paths its robots.txt '
    + 'disallows, and the CC BY-SA fallback carries standings for the most '
    + 'recent stage only. The jersey holders above are known; the ordered '
    + 'tables behind them are not.', '§5.9');
    return;
  }
  const kinds = Object.keys(cls);
  $('#classif-note').textContent =
    `${kinds.length} table${kinds.length > 1 ? 's' : ''}`;

  // The caption states what THIS stage's tables actually are, which differs
  // stage by stage: stage 20 carries five Tier-2 top tens, stage 21 carries
  // one Tier-0 classification of the whole field.
  const tiers = new Set(kinds.map(k => cls[k].tier));
  const partial = kinds.filter(k => cls[k].is_partial).length;
  const bits = [];
  if (tiers.has('TIER_0_OFFICIAL')) {
    bits.push('The organiser published this one itself.');
  }
  if (tiers.has('TIER_2_ENCYCLOPEDIC')) {
    bits.push('The organiser serves its own classification tables only from '
            + 'robots-disallowed paths, so a CC BY-SA encyclopedic source is '
            + 'used under §0.2 rule 7.');
  }
  if (partial) {
    bits.push(`${partial === kinds.length ? 'Each' : partial} table`
            + `${partial > 1 ? 's carry' : ' carries'} a published top ten `
            + 'rather than the full field.');
  }
  // Only say "downgrade" where there is one. On stage 21 there is not: the
  // organiser published its own final classification and the table is Tier-0.
  bits.push(tiers.has('TIER_2_ENCYCLOPEDIC')
    ? 'Every row shows the authority it was read at; the downgrade is never '
      + 'smoothed over.'
    : 'Every row shows the authority it was read at.');
  $('#classif-caption').textContent = bits.join(' ');

  Object.entries(cls).forEach(([kind, data]) => {
    const box = el('div', 'classif');
    const head = el('div', 'classif__head');
    head.append(el('h3', null, kind.toLowerCase()));
    // Per table, not per panel. This tag used to be a fixed "tier-2 fallback"
    // in the heading, which labelled the organiser's own Tier-0 final
    // classification as a fallback for itself.
    const official = data.tier === 'TIER_0_OFFICIAL';
    const tag = el('span', official ? 'tag tag--observed' : 'tag tag--derived',
                   data.tier.replace('TIER_', 'T').replace('_', ' '));
    tag.title = official
      ? `Published by ${data.source} — the organiser's own classification.`
      : `Sourced from ${data.source} — a lower authority tier than the `
        + `official result tables, because the official classification tables `
        + `are not lawfully reachable.`;
    head.append(tag);
    head.append(el('span', data.is_partial ? 'tag tag--absent' : 'tag',
                   data.is_partial ? 'top 10 only'
                                   : `full field · ${data.rows.length}`));
    box.append(head);
    const t = el('table');
    const body = el('tbody');
    data.rows.forEach(r => {
      const tr = el('tr');
      const val = r.points != null ? r.points + ' pts'
        : r.time_s != null ? hhmmss(r.time_s)
        : r.gap_s != null ? '+' + hhmmss(r.gap_s) : '—';
      [[r.rank, 'num'], [r.rider || r.team, ''], [val, 'num']]
        .forEach(([v, c2]) => tr.append(el('td', c2, String(v))));
      tr.onclick = () => openInspector({
        kind: `${kind} classification`, title: r.rider || r.team,
        rows: [['Rank', r.rank], ['Team', r.team || '—'],
               ['Nationality', r.nat || '—'], ['Value', val],
               ['Source', data.source], ['Authority tier', data.tier],
               ['Completeness', data.is_partial ? 'top 10 only'
                                                : `full field, ${data.rows.length} riders`],
               ['Status', 'NORMALIZED_FACT']],
        note: official
          ? 'Published by the organiser as its own classification, so this is '
            + 'a Tier-0 standing over the whole field rather than the top ten '
            + 'the encyclopedic fallback carries.'
          : 'The official source serves this table only from robots-'
            + 'disallowed paths, so a Tier-2 fallback is used under §0.2 '
            + 'rule 7. The authority downgrade is shown, never smoothed over. '
            + 'Wikipedia content is CC BY-SA 4.0.',
      });
      body.append(tr);
    });
    t.append(body);
    box.append(t);
    host.append(box);
  });
}

/* ── Climb studio (§15 climb intelligence) ─────────────────────────────────
 *
 * "Climbs are spatial, route-linked analytical objects—not cropped image
 * strips." Until now this site had two half-answers: a table of the
 * organiser's categorised climbs, and a wall of unnamed bars for the ones the
 * detector found. Neither could be opened, neither knew where it was, and
 * neither said anything about the road either side of it.
 *
 * A card here is one climb, and it carries everything §15 asks a climb to
 * carry. The figures all come from the bundle — `analytics.climb_terrain`,
 * `analytics.climb_difficulty` and `analytics.climb_endpoints` computed them
 * in the database — because a number the browser works out is a number no
 * invariant can hold and no rebuild can reproduce.
 *
 * The relief thumbnail is the same painter the stage relief panel uses, over
 * the climb's own kilometre window. Two renderers would have been two
 * pictures of one road that could disagree about it.
 */
const CLIMB = {
  // Selected for comparison. Keyed by the twelve-character climb id, which
  // is unique within a bundle and meaningless outside one — exactly the
  // lifetime a selection has.
  picked: new Set(),
  catalogue: null,   // climbs.json, once fetched
  fetching: false,
  sort: 'fiets',
  filter: '',
  open: new Set(),   // which cards are expanded
};

const CLIMB_SORTS = {
  fiets: ['Difficulty (Fiets)', c => -(c.fiets == null ? -1 : c.fiets)],
  ascent: ['Height gained', c => -(c.ascent || 0)],
  length: ['Length', c => -(c.length_km || 0)],
  steepest: ['Steepest kilometre', c => -(c.steepest_km == null ? -1 : c.steepest_km)],
  grad: ['Mean gradient', c => -(c.avg_grad || 0)],
};

/* The label a climb is known by. An organiser's name where one was sourced;
 * otherwise the place on the route, which is the only true thing available.
 * Never a generated name — "Climb 3" would read as an identity the climb
 * does not have. */
function climbLabel(c) {
  if (c.name) return c.name;
  const to = c.end_km == null ? null : c.end_km.toFixed(1);
  return to == null ? 'Unnamed climb' : `Unnamed climb, summit at km ${to}`;
}

/* Which race a climb belongs to, in words. The catalogue stores the slug on
 * the climb and the name once per race — repeating "Tour de France 2026" on
 * 138 rows was a tenth of the file — so the name has to be looked up, and a
 * caller that forgets prints `la-fleche-wallonne-femmes-2026-wwt` at a
 * reader. A climb from the stage chunk has no race field at all, because the
 * page it is on already says which race this is. */
function climbRaceName(c) {
  if (!c.race) return null;
  const r = CLIMB.catalogue && CLIMB.catalogue.races
    && CLIMB.catalogue.races[c.race];
  return r ? r.name : c.race;
}

/* The profile samples inside a climb's kilometre window, in the shape
 * `paintRelief` wants. Null when the stage carries no coordinates — a
 * 2D-only trace has a profile but no place, and a relief picture of it would
 * be invented. */
function climbSamples(c) {
  const p = profile();
  if (!p || !p.lon || !p.lat || !p.e || c.start_km == null) return null;
  const n = Math.min(p.lon.length, p.lat.length, p.e.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const km = p.km ? p.km[i] : null;
    if (km == null || km < c.start_km || km > c.end_km) continue;
    if (p.lon[i] == null || p.lat[i] == null || p.e[i] == null) continue;
    out.push({ lon: p.lon[i], lat: p.lat[i], e: p.e[i], km,
               g: p.g ? p.g[i] : null });
  }
  return out.length > 3 ? out : null;
}

/* One figure with its unit and its caveat. Missing renders as an em dash and
 * never as a zero — the rule the whole site is held to. */
function climbStat(label, value, title) {
  const box = el('div', 'climb-stat');
  const v = el('div', 'climb-stat__v', value == null ? '—' : String(value));
  if (value == null) v.classList.add('muted');
  box.append(v, el('div', 'climb-stat__k', label));
  if (title) box.title = title;
  return box;
}

function renderClimbStudio() {
  const host = $('#climb-cards');
  if (!host) return;
  const panel = $('#panel-climb-studio');
  host.innerHTML = '';
  panel.querySelectorAll('.absence-host').forEach(n => n.remove());
  const cs = climbs();
  const s = stageMeta();

  if (!cs.length) {
    $('#climb-studio-caption').textContent = '';
    const h = el('div', 'absence-host');
    host.append(h);
    // The two absences are different facts and must not share a sentence.
    // A flat stage genuinely has no climb; a stage with no geometry has no
    // detector output at all, and saying "no climbs" for it would report a
    // property of the road this project has never measured.
    const known = !!(chunk() && chunk().profile);
    absence(h, `No climbs detected on stage ${s.n}`,
      known
        ? 'The detector found no stretch of this stage that meets its '
          + 'thresholds. That is a statement about the road as this project '
          + 'measured it, not about the organiser\'s categorisation — a '
          + 'stage can carry a categorised climb the detector rejects, and '
          + 'the official climbs panel says so where it does.'
        : 'Climbs are detected from this project\'s own elevation series, '
          + 'and no usable route geometry is held for this stage, so no '
          + 'series exists to detect them in.',
      '§5.3',
      known ? null : 'Route geometry for this stage would produce them.');
    return;
  }

  cs.forEach(c => host.append(climbCard(c)));

  // The caption states the method and its limits once, for every card. §15
  // asks each climb to carry "source, method, confidence and limitations";
  // repeating four sentences on eight cards would bury them.
  const det = [...new Set(cs.map(c => c.detector).filter(Boolean))].join(', ');
  const named = cs.filter(c => c.name).length;
  $('#climb-studio-caption').textContent =
    `${cs.length} climb${cs.length === 1 ? '' : 's'} detected from this `
    + `project's own elevation series by ${det || 'the profile builder'}, not `
    + `read from any published climb list. `
    + (named
        ? `${named} of them sit within the matching window of a climb the `
          + `organiser categorised, and carry its name and category alongside `
          + `— never merged into — the measured figures. `
        : `None of them matched a climb the organiser categorised, so none `
          + `carries an official name. `)
    + `Height gained is the sum of positive elevation change along the `
    + `detected span, so it exceeds summit minus foot wherever the road `
    + `undulates. Click a card to frame that climb on the profile, the map `
    + `and the relief view.`;
}

function climbCard(c) {
  const card = el('article', 'climb-card');
  card.dataset.climb = c.id || '';

  const head = el('header', 'climb-card__head');
  const cat = el('span', 'cat cat--' + String(c.category || 'derived').toLowerCase(),
                 c.category || 'detected');
  if (!c.category) {
    cat.title = 'The organiser categorised no climb at this summit. This is '
      + 'a detection, and a detection is not a categorisation.';
  }
  head.append(cat, el('h3', 'climb-card__name', climbLabel(c)));
  if (c.summit_finish) {
    const f = el('span', 'climb-card__flag', 'summit finish');
    f.title = 'The detected summit is the end of the route.';
    head.append(f);
  }
  card.append(head);

  const where = el('p', 'climb-card__where');
  where.textContent = `km ${fmt(c.start_km, 1)} – ${fmt(c.end_km, 1)}`
    + (c.summit_at_pct == null ? ''
       : ` · ${fmt(c.summit_at_pct, 0)} % into the stage`);
  card.append(where);

  // The relief picture, at the reading scale. A fixed camera rather than the
  // stage panel's: these are meant to be compared with one another at a
  // glance, and a card that inherited the reader's current rotation would be
  // comparable only with whatever they last dragged.
  const pts = climbSamples(c);
  if (pts) {
    const wrap = el('div', 'climb-card__relief');
    const cv = document.createElement('canvas');
    wrap.append(cv);
    card.append(wrap);
    // Painted after layout, because the canvas needs its own CSS width and a
    // detached element has none.
    requestAnimationFrame(() => {
      const w = wrap.clientWidth || 260;
      const drawn = paintRelief(cv, pts, {
        width: w, height: 104, pad: 8, ridge: 1.6,
        yaw: -0.6, pitch: 0.55, ve: 8, cursorKm: null,
      });
      if (!drawn) return;
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label',
        `${climbLabel(c)} drawn in relief from this stage's own coordinates, `
        + `rising from ${Math.round(drawn.zMin)} to ${Math.round(drawn.zMax)} `
        + `metres, with height drawn 8 times its true scale. The figures `
        + `beside this picture carry the same climb as text.`);
    });
  }

  const stats = el('div', 'climb-card__stats');
  stats.append(
    climbStat('length', c.length_km == null ? null : fmt(c.length_km, 1) + ' km'),
    climbStat('height gained',
              c.ascent == null ? null : Math.round(c.ascent) + ' m',
              'The sum of positive elevation change along the climb, which '
              + 'exceeds summit minus foot wherever the road undulates.'),
    climbStat('mean grade',
              c.avg_grad == null ? null : fmt(c.avg_grad, 1) + ' %'),
    climbStat('steepest km',
              c.steepest_km == null ? null : fmt(c.steepest_km, 1) + ' %',
              c.steepest_km == null
                ? 'Shorter than a kilometre, so it has no steepest kilometre.'
                : `The hardest continuous kilometre, beginning at km `
                  + `${fmt(c.steepest_at, 1)}. Averaged over roughly a `
                  + `kilometre, so it carries far less of the elevation `
                  + `series' noise than the single steepest sample pair does.`),
    climbStat('summit',
              c.summit_elev == null ? null : Math.round(c.summit_elev) + ' m'));
  card.append(stats);

  // Everything a reader might want and most will not: kept behind a
  // disclosure rather than dropped, because §15 asks for the method and the
  // limitations and a card that shows five numbers and nothing else is the
  // "fixed profile thumbnail" the section opens by ruling out.
  const det = el('details', 'climb-card__more');
  if (CLIMB.open.has(c.id)) det.open = true;
  det.addEventListener('toggle', () => {
    det.open ? CLIMB.open.add(c.id) : CLIMB.open.delete(c.id);
  });
  det.append(el('summary', null, 'Method, context and the organiser\'s figures'));
  det.append(climbDetail(c));
  card.append(det);

  const acts = el('div', 'climb-card__acts');
  const zoom = el('button', 'btn btn--sm', 'Frame on profile & map');
  zoom.onclick = e => {
    e.stopPropagation();
    zoomToSpan(c.start_km, c.end_km, climbLabel(c));
  };
  acts.append(zoom);

  const pick = el('label', 'climb-card__pick');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = CLIMB.picked.has(c.id);
  box.onclick = e => e.stopPropagation();
  box.onchange = () => {
    box.checked ? CLIMB.picked.add(c.id) : CLIMB.picked.delete(c.id);
    card.classList.toggle('is-picked', box.checked);
    if (!$('#climb-compare').hidden) renderClimbCompare();
  };
  pick.append(box, el('span', null, 'compare'));
  acts.append(pick);
  card.append(acts);
  if (CLIMB.picked.has(c.id)) card.classList.add('is-picked');

  // The whole card is the target, not only the button — §15 is explicit that
  // no important interaction may depend on hover, and a click target the
  // size of a card is the one that works on a phone.
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Frame ${climbLabel(c)} on the profile and map`);
  const go = () => zoomToSpan(c.start_km, c.end_km, climbLabel(c));
  card.onclick = ev => {
    if (ev.target.closest('button, input, label, summary, a, details')) return;
    go();
  };
  card.onkeydown = ev => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    if (ev.target !== card) return;
    ev.preventDefault();
    go();
  };
  return card;
}

function climbDetail(c) {
  const box = el('div', 'climb-detail');
  const row = (k, v, title) => {
    const r = el('div', 'climb-detail__row');
    r.append(el('span', 'climb-detail__k', k),
             el('span', 'climb-detail__v' + (v == null ? ' muted' : ''),
                v == null ? '—' : String(v)));
    if (title) r.title = title;
    return r;
  };

  // Approach and descent. The window length travels with the figure because
  // 180 m over 5 km and 180 m over 1.4 km are not the same measurement, and
  // a climb that starts at km 2 has only 2 km of approach to describe.
  const app = c.approach_gain == null ? null
    : `${c.approach_gain > 0 ? '+' : ''}${Math.round(c.approach_gain)} m `
      + `over the ${fmt(c.approach_len, 1)} km before the foot`;
  box.append(row('approach', app,
    'How much the road rose or fell in the five kilometres before the climb '
    + 'begins, or in as much of the route as exists before it.'));

  const desc = c.summit_finish ? 'none — the route ends at the summit'
    : c.descent_drop == null ? null
    : `−${Math.round(c.descent_drop)} m over the ${fmt(c.descent_len, 1)} km `
      + `after the summit`;
  box.append(row('descent', desc,
    'How much the road fell in the five kilometres after the summit.'));

  box.append(row('steepest sample pair',
    c.max_grad == null ? null : fmt(c.max_grad, 1) + ' %',
    'The single steepest pair of adjacent elevation samples. On a series '
    + 'derived from a digital elevation model this measures noise as much as '
    + 'road, and the steepest kilometre is the figure to compare climbs by.'));

  if (c.fiets != null) {
    const f = el('div', 'climb-detail__model');
    f.append(el('div', 'climb-detail__k', 'difficulty'));
    const bar = el('div', 'fiets-bar');
    const total = c.fiets || 1;
    // Both terms drawn, so what the score is made of is visible rather than
    // asserted. §15 permits difficulty scoring "only through transparent
    // multi-factor models", and a single number with a formula in a tooltip
    // is not transparency.
    const g1 = el('span', 'fiets-bar__seg fiets-bar__seg--gain');
    g1.style.width = (100 * (c.fiets_gain || 0) / total) + '%';
    g1.title = `Height-gain term ${fmt(c.fiets_gain, 2)}`;
    const g2 = el('span', 'fiets-bar__seg fiets-bar__seg--alt');
    g2.style.width = (100 * (c.fiets_alt || 0) / total) + '%';
    g2.title = `Altitude term ${fmt(c.fiets_alt, 2)}`;
    bar.append(g1, g2);
    f.append(bar);
    f.append(el('p', 'climb-detail__note',
      `Fiets index ${fmt(c.fiets, 2)} = ${fmt(c.fiets_gain, 2)} from height `
      + `gained over the distance, plus ${fmt(c.fiets_alt, 2)} for altitude `
      + `above 1000 m. The formula is the one published by the Dutch `
      + `magazine Fiets — H²/(D×10) + (T−1000)/1000 — and the numbers put `
      + `into it are this project's own measurements, so it will differ from `
      + `a published Fiets figure wherever the detected extent of the climb `
      + `differs from the conventional one. It is not a category: the `
      + `organiser's own scale is shown separately and never merged with it.`));
    box.append(f);
  }

  // The organiser's own description of the same climb, beside this project's
  // measurement of it, with the differences left visible.
  if (c.name) {
    box.append(el('div', 'climb-detail__sep', 'The organiser\'s figures'));
    const d = (a, b) => (a == null || b == null) ? null
      : (a - b >= 0 ? '+' : '') + (a - b).toFixed(1);
    box.append(row('published summit',
      c.off_summit_elev == null ? null : c.off_summit_elev + ' m',
      'What the organiser publishes as this summit\'s altitude.'));
    box.append(row('measured minus published',
      d(c.summit_elev, c.off_summit_elev) == null ? null
        : d(c.summit_elev, c.off_summit_elev) + ' m',
      'The independent accuracy check on the elevation series: this '
      + 'project\'s measured summit against the organiser\'s published one.'));
    box.append(row('published length',
      c.off_length_km == null ? null : fmt(c.off_length_km, 1) + ' km'));
    box.append(row('published mean grade',
      c.off_avg_grad == null ? null : fmt(c.off_avg_grad, 1) + ' %'));
  }

  box.append(el('div', 'climb-detail__sep', 'Source, method and limits'));
  box.append(row('detected by', c.detector,
    'The version of the climb detector that produced this extent.'));
  box.append(row('derived-climb id', c.id,
    'Stable within this build only. The detector produces a new identity '
    + 'every time a profile is rebuilt, so this is not a citation.'));
  const g = chunk() && chunk().route_provenance;
  box.append(row('geometry', g && g.source ? g.source : null,
    'The route version these figures were measured on.'));
  if (c.summit) {
    box.append(row('summit position',
      `${c.summit[1].toFixed(4)}° N, ${c.summit[0].toFixed(4)}° E`,
      'The route sample nearest the detected summit kilometre.'));
  }
  box.append(el('p', 'climb-detail__note',
    'The foot of a climb is where the detector\'s thresholds put it, not '
    + 'where a road sign does, so both the length and the height gained '
    + 'depend on that choice. Two organisers tracing one col produce '
    + 'slightly different lines and therefore slightly different figures; '
    + 'where this project holds both, only the higher-authority one is '
    + 'published and the other is kept.'));
  return box;
}

/* ── Compare mode (§15) ───────────────────────────────────────────────────
 *
 * "climb vs climb; climb vs prior editions; Men/Women route variants where
 * comparability exists."
 *
 * The first is answered across every race this project holds geometry for,
 * which needs a catalogue no per-stage or per-race file can provide;
 * `data/climbs.json` is that catalogue and is fetched here, on the first
 * click, never on load. The three-request load budget is a budget on
 * loading.
 *
 * The third is answered by `analytics.climb_pairs`: two climbs are the same
 * col when their summits are within 400 m, matched by where they are rather
 * than by what they are called, because 424 of 468 climbs have no name to
 * match on. The separation travels with each pair so a 12 m match and a
 * 380 m match do not read as the same claim.
 *
 * The second is not answered, because this project holds no prior edition of
 * any race. That is stated as an absence against the gap register rather
 * than quietly omitted — a comparison mode that silently offers two of three
 * comparisons teaches a reader the third does not exist.
 */
async function loadClimbCatalogue() {
  if (CLIMB.catalogue || CLIMB.fetching) return CLIMB.catalogue;
  CLIMB.fetching = true;
  try {
    const r = await fetch(`${DATA}climbs.json`);
    if (!r.ok) throw new Error('climb catalogue unavailable');
    CLIMB.catalogue = await r.json();
  } finally {
    CLIMB.fetching = false;
  }
  return CLIMB.catalogue;
}

/* The climbs a reader has ticked, resolved against the catalogue so a
 * selection made on this stage can be held against a climb in another race.
 * Falls back to the stage chunk before the catalogue has arrived, so the
 * first paint is never empty while a fetch is in flight. */
function pickedClimbs() {
  const cat = CLIMB.catalogue && CLIMB.catalogue.climbs;
  if (cat) {
    const byId = new Map(cat.map(c => [c.id, c]));
    const out = [];
    CLIMB.picked.forEach(id => { if (byId.has(id)) out.push(byId.get(id)); });
    return out;
  }
  return climbs().filter(c => CLIMB.picked.has(c.id));
}

function renderClimbCompare() {
  const host = $('#climb-compare');
  if (!host || host.hidden) return;
  host.innerHTML = '';

  const cat = CLIMB.catalogue;
  if (!cat) {
    host.append(el('p', 'caption', 'Loading the climb catalogue…'));
    return;
  }

  host.append(el('h3', 'climb-compare__title', 'Compare climbs'));
  host.append(el('p', 'caption',
    `${cat.manifest.climbs} climbs across ${cat.manifest.races} races, every `
    + `one measured by this project from its own elevation series. Tick a `
    + `card above, or pick from the list, then read the two ascents against `
    + `each other on one axis.`));

  host.append(climbCompareChart());
  host.append(climbComparePicker());
  host.append(climbVariantPanel());
  host.append(climbPriorEditionsAbsence());
}

/* The overlay. Both climbs drawn from their own foot: x is distance from the
 * start of the climb, y is height above its start. Drawing them at their
 * route kilometres would put one at km 12 and the other at km 214 and
 * compare nothing; drawing them at their true altitudes would make a
 * comparison of two ascents look like a comparison of two mountains.
 *
 * The catalogue carries figures, not sample series — 468 climbs of samples
 * would be megabytes — so the shape drawn here is the climb's own measured
 * corner points: foot, steepest kilometre, summit. It is an honest reduction
 * and the caption says so. The full series is one click away on each climb's
 * own stage. */
/* The chart's line colours, named from the tokens that exist rather than
 * generated from an index. A generated `--series-N` walked off the end of the
 * palette at N=5 and drew two climbs in the browser's fallback black, which
 * on a dark theme is two invisible lines. Five is also the point past which
 * a reader stops telling colours apart, so the chart draws five and the
 * table below it carries every selection. */
const CLIMB_LINE_COLOURS = ['var(--series-1)', 'var(--series-2)',
  'var(--series-3)', 'var(--series-7)', 'var(--series-4)'];

function climbCompareChart() {
  const box = el('div', 'climb-compare__chart');
  const picked = pickedClimbs();
  if (picked.length < 2) {
    box.append(el('p', 'caption',
      picked.length === 1
        ? 'One climb selected. Tick a second to compare them.'
        : 'No climbs selected yet.'));
    return box;
  }
  const W = 640, H = 260, PAD = { l: 46, r: 12, t: 12, b: 34 };
  const maxLen = Math.max(...picked.map(c => c.length_km || 0));
  const maxUp = Math.max(...picked.map(c => c.ascent || 0));
  const X = km => PAD.l + (km / Math.max(maxLen, 0.1)) * (W - PAD.l - PAD.r);
  const Y = m => H - PAD.b - (m / Math.max(maxUp, 1)) * (H - PAD.t - PAD.b);

  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'climb-compare__svg',
    preserveAspectRatio: 'xMidYMid meet', role: 'img',
  });
  // Axes first, so the lines sit over them.
  svg.append(svgEl('line', { x1: PAD.l, y1: H - PAD.b, x2: W - PAD.r,
    y2: H - PAD.b, stroke: 'var(--line)' }));
  svg.append(svgEl('line', { x1: PAD.l, y1: PAD.t, x2: PAD.l, y2: H - PAD.b,
    stroke: 'var(--line)' }));
  [0, 0.5, 1].forEach(t => {
    const lab = svgEl('text', { x: PAD.l - 6, y: Y(maxUp * t) + 4,
      'text-anchor': 'end', class: 'axis-lab' });
    lab.textContent = Math.round(maxUp * t) + ' m';
    svg.append(lab);
  });
  [0, 0.5, 1].forEach(t => {
    const lab = svgEl('text', { x: X(maxLen * t), y: H - PAD.b + 16,
      'text-anchor': 'middle', class: 'axis-lab' });
    lab.textContent = fmt(maxLen * t, 1) + ' km';
    svg.append(lab);
  });

  const legend = el('ul', 'climb-compare__legend');
  picked.slice(0, CLIMB_LINE_COLOURS.length).forEach((c, i) => {
    const col = CLIMB_LINE_COLOURS[i % CLIMB_LINE_COLOURS.length];
    // Foot to summit, with the steepest kilometre marked where it begins.
    // A straight line between two measured points, and drawn as one: a
    // smoothed curve would suggest a shape that was never measured.
    const d = `M ${X(0)} ${Y(0)} L ${X(c.length_km || 0)} ${Y(c.ascent || 0)}`;
    svg.append(svgEl('path', { d, fill: 'none', stroke: col,
      'stroke-width': 2.4, 'stroke-linecap': 'round' }));
    if (c.steepest_km != null && c.steepest_at != null
        && c.start_km != null && c.length_km) {
      const at = c.steepest_at - c.start_km;
      if (at >= 0 && at <= c.length_km) {
        svg.append(svgEl('circle', {
          cx: X(at), cy: Y((c.ascent || 0) * (at / c.length_km)), r: 4,
          fill: col, stroke: 'var(--bg-1)', 'stroke-width': 1.5 }));
      }
    }
    const li = el('li');
    const swatch = el('span', 'climb-compare__swatch');
    swatch.style.background = col;
    li.append(swatch, el('span', null,
      `${climbLabel(c)} — ${climbRaceName(c) || 'this stage'}`));
    legend.append(li);
  });
  svg.setAttribute('aria-label',
    'Each selected climb drawn from its own foot: horizontal is distance '
    + 'from the start of the climb, vertical is height gained above it. '
    + picked.map(c => `${climbLabel(c)} climbs ${Math.round(c.ascent || 0)} `
        + `metres in ${fmt(c.length_km, 1)} kilometres`).join('; ') + '.');
  if (picked.length > CLIMB_LINE_COLOURS.length) {
    legend.append(el('li', 'caption',
      `${picked.length - CLIMB_LINE_COLOURS.length} further selected climb`
      + `${picked.length - CLIMB_LINE_COLOURS.length === 1 ? ' is' : 's are'} `
      + `in the table below but not on the chart: past five lines the colours `
      + `stop being distinguishable.`));
  }
  box.append(svg, legend);
  box.append(el('p', 'caption',
    'Each climb is drawn from its own foot, so two ascents can be read '
    + 'against each other rather than against where they happen to fall in '
    + 'their races. The line joins the measured foot to the measured summit '
    + 'and the dot marks where the steepest kilometre begins; it is not the '
    + 'road\'s shape, which is on each climb\'s own stage profile. Height '
    + 'gained is the sum of positive elevation change, so the summit sits '
    + 'above the straight line wherever the road undulates.'));
  box.append(climbCompareTable(picked));
  return box;
}

function climbCompareTable(picked) {
  const wrap = el('div', 'table-scroll');
  const t = el('table', 'climb-compare__table');
  // Three tables in this drawer share the class — the picked climbs, the
  // picker's own list, and the cross-race pairs — so the class alone cannot
  // say which is which. It names what it holds.
  t.dataset.role = 'picked';
  const head = el('thead'), hr = el('tr');
  ['Climb', 'Race', 'Length', 'Gained', 'Mean', 'Steepest km', 'Summit',
   'Fiets', 'gain term', 'alt term'].forEach(h => hr.append(el('th', null, h)));
  head.append(hr); t.append(head);
  const body = el('tbody');
  picked.forEach(c => {
    const tr = el('tr');
    tr.append(el('td', null, climbLabel(c)));
    tr.append(el('td', null, climbRaceName(c) || 'this stage'));
    [[c.length_km == null ? null : fmt(c.length_km, 1) + ' km'],
     [c.ascent == null ? null : Math.round(c.ascent) + ' m'],
     [c.avg_grad == null ? null : fmt(c.avg_grad, 1) + ' %'],
     [c.steepest_km == null ? null : fmt(c.steepest_km, 1) + ' %'],
     [c.summit_elev == null ? null : Math.round(c.summit_elev) + ' m'],
     [c.fiets == null ? null : fmt(c.fiets, 2)],
     [c.fiets_gain == null ? null : fmt(c.fiets_gain, 2)],
     [c.fiets_alt == null ? null : fmt(c.fiets_alt, 2)]]
      .forEach(([v]) => {
        const td = el('td', 'num', v == null ? '—' : v);
        if (v == null) td.classList.add('muted');
        tr.append(td);
      });
    body.append(tr);
  });
  t.append(body);
  wrap.append(t);
  return wrap;
}

function climbComparePicker() {
  const box = el('div', 'climb-picker');
  const bar = el('div', 'climb-picker__bar');
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'input';
  search.placeholder = 'Filter by climb, race or stage…';
  search.value = CLIMB.filter;
  search.oninput = () => { CLIMB.filter = search.value; fillPickerList(list); };
  const sort = document.createElement('select');
  sort.className = 'input';
  sort.setAttribute('aria-label', 'Sort climbs by');
  Object.entries(CLIMB_SORTS).forEach(([k, [label]]) => {
    const o = document.createElement('option');
    o.value = k; o.textContent = label;
    sort.append(o);
  });
  sort.value = CLIMB.sort;
  sort.onchange = () => { CLIMB.sort = sort.value; fillPickerList(list); };
  bar.append(search, sort);
  box.append(bar);
  const list = el('div', 'climb-picker__list');
  box.append(list);
  fillPickerList(list);
  return box;
}

// How many rows the picker draws at once. The catalogue is 468 climbs and a
// reader is choosing two of them; drawing all 468 would cost more than the
// whole comparison and answer a question nobody asked. The count of matches
// is always stated, so a truncated list never reads as a complete one.
const CLIMB_PICKER_ROWS = 40;

function fillPickerList(list) {
  list.innerHTML = '';
  const cat = CLIMB.catalogue;
  if (!cat) return;
  const q = CLIMB.filter.trim().toLowerCase();
  const match = c => !q
    || (c.name || '').toLowerCase().includes(q)
    || (climbRaceName(c) || '').toLowerCase().includes(q)
    || `stage ${c.stage}`.includes(q)
    || (c.from || '').toLowerCase().includes(q)
    || (c.to || '').toLowerCase().includes(q);
  const rows = cat.climbs.filter(match);
  rows.sort((a, b) => CLIMB_SORTS[CLIMB.sort][1](a) - CLIMB_SORTS[CLIMB.sort][1](b));
  list.append(el('p', 'caption',
    `${rows.length} climb${rows.length === 1 ? '' : 's'} match`
    + (rows.length > CLIMB_PICKER_ROWS
        ? `; the ${CLIMB_PICKER_ROWS} hardest by the current sort are shown.`
        : '.')));
  rows.slice(0, CLIMB_PICKER_ROWS).forEach(c => {
    const row = el('label', 'climb-picker__row');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = CLIMB.picked.has(c.id);
    box.onchange = () => {
      box.checked ? CLIMB.picked.add(c.id) : CLIMB.picked.delete(c.id);
      renderClimbStudio();
      renderClimbCompare();
    };
    const rn = climbRaceName(c);
    row.append(box);
    row.append(el('span', 'climb-picker__name', climbLabel(c)));
    row.append(el('span', 'climb-picker__race', `${rn} · stage ${c.stage}`));
    row.append(el('span', 'climb-picker__num',
      `${fmt(c.length_km, 1)} km · ${Math.round(c.ascent || 0)} m · `
      + (c.fiets == null ? '—' : fmt(c.fiets, 1))));
    list.append(row);
  });
}

/* Men/Women route variants, and every other pair of races that climbs one
 * col. The pairs are computed in the database from summit position; this only
 * renders them, and renders the measured separation with each, because a
 * threshold presented without its measurement is a threshold presented as a
 * fact. */
function climbVariantPanel() {
  const box = el('div', 'climb-variants');
  const cat = CLIMB.catalogue;
  const pairs = (cat && cat.pairs) || [];
  box.append(el('h4', null, 'The same col in two races'));
  if (!pairs.length) {
    box.append(el('p', 'caption',
      'No two races in this bundle climb a col whose summits fall within '
      + '400 m of each other, so there is no cross-race pair to show.'));
    return box;
  }
  const byId = new Map((cat.climbs || []).map(c => [c.id, c]));
  const nRace = s => (cat.races && cat.races[s] ? cat.races[s].name : s);
  const gendered = pairs.filter(p => p.gender_variant).length;
  box.append(el('p', 'caption',
    `${pairs.length} pair${pairs.length === 1 ? '' : 's'}`
    + (gendered ? `, ${gendered} of them a men's race and a women's race over `
                  + `the same summit` : '')
    + `. Matched by where the summit is, not by what it is called — 424 of `
    + `these climbs carry no published name. A pair means the two climbs end `
    + `in the same place; it does not mean they are the same ascent, because `
    + `approach direction is not compared and a col can be climbed from `
    + `either side. Selecting one puts both on the chart above.`));
  const wrap = el('div', 'table-scroll');
  const t = el('table', 'climb-compare__table');
  const head = el('thead'), hr = el('tr');
  ['', 'Climb', 'In', 'and', 'Summits apart', 'Δ length', 'Δ gained',
   'Δ mean grade'].forEach(h => hr.append(el('th', null, h)));
  head.append(hr); t.append(head);
  const body = el('tbody');
  pairs.forEach(p => {
    const a = byId.get(p.a), b = byId.get(p.b);
    const tr = el('tr');
    const pickCell = el('td');
    const btn = el('button', 'btn btn--sm', 'compare');
    btn.onclick = () => {
      CLIMB.picked.add(p.a); CLIMB.picked.add(p.b);
      renderClimbStudio();
      renderClimbCompare();
      $('#climb-compare').scrollIntoView({ block: 'nearest' });
    };
    pickCell.append(btn);
    tr.append(pickCell);
    tr.append(el('td', null, a ? climbLabel(a) : '—'));
    tr.append(el('td', null, nRace(p.race_a)));
    tr.append(el('td', null, nRace(p.race_b)));
    const sep = el('td', 'num', fmt(p.separation_m, 0) + ' m');
    sep.title = 'How far apart the two detected summits are. The pairing '
      + 'tolerance is 400 m; a match at a few metres is a much stronger '
      + 'claim than one near the limit.';
    tr.append(sep);
    [[p.d_length_km, v => (v > 0 ? '+' : '') + fmt(v, 1) + ' km'],
     [p.d_ascent_m, v => (v > 0 ? '+' : '') + Math.round(v) + ' m'],
     [p.d_grad_pct, v => (v > 0 ? '+' : '') + fmt(v, 1) + ' %']]
      .forEach(([v, f2]) => {
        const td = el('td', 'num', v == null ? '—' : f2(v));
        if (v == null) td.classList.add('muted');
        tr.append(td);
      });
    if (p.gender_variant) {
      tr.classList.add('is-variant');
      tr.children[1].append(el('span', 'tag tag--observed', 'M/W'));
    }
    body.append(tr);
  });
  t.append(body);
  wrap.append(t);
  box.append(wrap);
  return box;
}

/* §15 asks for "climb vs prior editions". This project holds one season, so
 * there is nothing to compare against — and the honest thing to do with a
 * requirement it cannot meet is to say so where a reader would look for it,
 * not to leave the comparison silently absent and let them conclude it does
 * not exist. */
function climbPriorEditionsAbsence() {
  const box = el('div', 'climb-prior');
  const h = el('div', 'absence-host');
  box.append(h);
  absence(h, 'No prior editions to compare against',
    'Comparing a climb with the same climb in earlier editions needs route '
    + 'geometry for those editions, and this project holds one season. '
    + 'Nothing here has been substituted for it: the cross-race pairs above '
    + 'are different races in the same season, which is a different '
    + 'comparison and is labelled as one.',
    '§7.K',
    'Route geometry for an earlier edition of any race already held would '
    + 'produce the first prior-edition pair, using the same summit-position '
    + 'matching the cross-race pairs use.');
  return box;
}

function armClimbCompare() {
  const btn = $('#climb-compare-open');
  const drawer = $('#climb-compare');
  if (!btn || !drawer || btn.dataset.armed) return;
  btn.dataset.armed = '1';
  btn.onclick = async () => {
    const open = drawer.hidden;
    drawer.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Hide comparison' : 'Compare climbs';
    if (!open) return;
    renderClimbCompare();
    try {
      await loadClimbCatalogue();
    } catch (e) {
      console.error(e);
      drawer.innerHTML = '';
      const h = el('div', 'absence-host');
      drawer.append(h);
      absence(h, 'The climb catalogue could not be loaded',
        'Comparing climbs across races reads data/climbs.json, and that '
        + 'request failed. Nothing is shown rather than a comparison built '
        + 'from the one stage this page has already loaded, which would '
        + 'look like a cross-race comparison and be nothing of the kind.',
        '§10');
      return;
    }
    renderClimbCompare();
  };
}

function renderFingerprints() {
  const host = $('#fingerprints');
  host.innerHTML = '';
  // Sourced from the index, not from loaded chunks: the wall compares every
  // climb in the Tour on one fixed scale, which it cannot do if it only knows
  // about stages the visitor happens to have opened.
  const all = db.index.climbs || [];
  if (!all.length) {
    host.append(el('p', 'caption', 'No climbs detected on any usable geometry.'));
    return;
  }
  const maxLen = Math.max(...all.map(c => c.length_km));
  const maxAsc = Math.max(...all.map(c => c.ascent));
  all.slice(0, 40).forEach(c => {
    const card = el('div', 'fp');
    const lab = el('div', 'fp__label');
    lab.append(el('span', 'fp__name', `S${c.stage}`),
               el('span', null, `${fmt(c.length_km, 1)} km`));
    card.append(lab);
    const svg = svgEl('svg', { viewBox: '0 0 140 40' });
    const col = c.avg_grad >= 8 ? 'var(--st-conflict)'
      : c.avg_grad >= 6 ? 'var(--series-2)'
      : c.avg_grad >= 4 ? 'var(--series-4)' : 'var(--text-3)';
    svg.append(svgEl('rect', { x: 0, y: 40 - (c.ascent / maxAsc) * 40,
      width: Math.max(3, (c.length_km / maxLen) * 140),
      height: (c.ascent / maxAsc) * 40, rx: 4, fill: col }));
    card.append(svg);
    const meta = el('div', 'fp__label');
    meta.append(el('span', null, `${Math.round(c.ascent)} m`),
                el('span', null, `${fmt(c.avg_grad, 1)}%`));
    card.append(meta);
    card.onclick = () => goStage(c.stage, c.start_km);
    host.append(card);
  });
}

function renderCoverage() {
  const host = $('#coverage');
  host.innerHTML = '';
  const cols = ['route', 'profile', 'climbs', 'itinerary', 'passage', 'sky', 'result'];
  const head = el('div', 'cov-row');
  head.append(el('div', 'cov-label cov-head', 'stage'));
  cols.forEach(c => head.append(el('div', 'cov-cell cov-head', c)));
  host.append(head);
  db.index.stages.forEach(s => {
    const ok = s.geometry.state === 'OK';
    const row = el('div', 'cov-row');
    row.append(el('div', 'cov-label', `S${s.n}`));
    [ok ? 'full' : s.geometry.state === 'CONFLICTING' ? 'conflict' : 'none',
     ok ? 'full' : 'none',
     s.climb_count ? 'derived' : 'none',
     s.waypoint_count ? 'full' : 'none',
     ok ? 'derived' : 'none',
     ok ? 'derived' : 'none',
     s.results_count ? 'full' : 'none'].forEach((k, i) => {
      const c = el('div', 'cov-cell cov--' + k);
      c.title = `${cols[i]}: ${k}`;
      if (k === 'none') c.textContent = '·';
      row.append(c);
    });
    row.style.cursor = 'pointer';
    row.onclick = () => goStage(s.n);
    host.append(row);
  });
}

/* ── the selected race ─────────────────────────────────────────────────
 *
 * One race is selected at all times, and it decides what the "This race"
 * view shows. Exactly one race in this build has a full stage product; the
 * other 136 have a detail chunk stating what is held for them, which is
 * rendered instead. Neither is a degraded version of the other — a race with
 * no route is not a stage page with the route missing, and drawing it that
 * way would read as a loading failure rather than as an honest absence.
 */
/* The product shown when nothing else is selected. It is a default, not a
 * privilege: any race in `races.json.manifest.products` has one. */
const productSlug = () => (db.index && db.index.manifest.race_slug) || null;
const hasProduct = slug =>
  !!(db.races && (db.races.manifest.products || []).includes(slug));
const selectedRace = () =>
  db.races && db.races.races.find(r => r.slug === state.race);

// A detail chunk's every field, as they are for a race that has none of
// them: not a fallback value in sight, because the fleet index already knows
// which of these fields hold real content — that is exactly what
// `event_depth` measures — so nothing here is a guess about a race the
// database has an actual answer for.
function raceAbsenceStub(idx) {
  return {
    ...idx,
    class_label: (db.races.manifest.class_labels || {})[idx.class],
    quality: [], schedule: [], standings: {}, teams: [], startlist: [],
    provenance: [], article: null, has_stage_product: false,
    stage_results: {},
  };
}

async function loadRaceChunk(slug) {
  if (db.raceChunks.has(slug)) return db.raceChunks.get(slug);
  const r = await fetch(DATA + 'race/' + encodeURIComponent(slug) + '.json');
  // Checked explicitly rather than left to `.json()` to fail on whatever a
  // 404 happens to return. A static host's error page is HTML, so that
  // failure mode worked by accident — a host that ever answered 404 with an
  // empty or JSON body would have handed `renderRaceDetail` a chunk with
  // nothing in it and no signal that anything was wrong.
  if (!r.ok) {
    const e = new Error(`race chunk ${slug} is not published (HTTP ${r.status})`);
    e.notPublished = r.status === 404;
    throw e;
  }
  const c = await r.json();
  db.raceChunks.set(slug, c);
  return c;
}

function buildRacePicker() {
  const sel = $('#race-picker');
  sel.innerHTML = '';
  const m = db.races.manifest;
  const byClass = new Map();
  db.races.races.forEach(r => {
    if (!byClass.has(r.class)) byClass.set(r.class, []);
    byClass.get(r.class).push(r);
  });
  for (const cls of Object.keys(m.class_labels)) {
    const rows = byClass.get(cls);
    if (!rows || !rows.length) continue;
    const g = el('optgroup');
    g.label = `${m.class_labels[cls]} (${rows.length})`;
    rows.forEach(r => {
      const o = el('option', null,
        `${r.name}${r.start ? ' · ' + r.start.slice(5) : ''} — ${r.depth}`);
      o.value = r.slug;
      g.append(o);
    });
    sel.append(g);
  }
  sel.value = state.race || productSlug();
  sel.onchange = () => goRace(sel.value);
}

async function goRace(slug) {
  const changed = state.race !== slug;
  state.race = slug;
  const sel = $('#race-picker');
  if (sel && sel.value !== slug) sel.value = slug;
  // A stage number belongs to the race it was read from. Resetting it only
  // inside the `hasProduct` branch below left the previous race's stage
  // attached to the new one, so selecting a one-day classic from stage 20 of
  // the Tour produced `#stage=20&race=scheldeprijs-2026-pro` — a URL that
  // advertises a twentieth stage of a race that has one, and which is how
  // `#race=<any>&stage=1` became a link a reader could arrive at and share.
  if (changed) {
    state.km = null;
    state.range = null;
  }
  // A race with its own product swaps the whole bundle in, index and all.
  // `db.index` used to be the one product loaded at boot, so selecting a
  // second race with geometry could only ever show the first one's stages.
  if (hasProduct(slug)) {
    try {
      db.index = await loadProduct(slug);
      state.stage = defaultStage();
      state.km = null;
      clearCursorSubs();
      buildPalette();
      await renderStage();
    } catch (e) {
      console.error(e);
    }
  }
  setView('stage');
}

/* The stage worth opening first.
 *
 * The most recent one with a result, because during a race that is the newest
 * thing to look at and after it the last. A hardcoded number goes stale the
 * day a stage finishes.
 *
 * For a race not yet ridden there is no result to follow, and falling to
 * stage 1 landed the Giro and the Vuelta on a stage whose geometry had been
 * refused — an empty page as the first impression of a race whose road is
 * half traced. So: the first stage that actually holds a route. Stage one only
 * if nothing does, which is an honest empty page rather than an accidental
 * one. */
function defaultStage() {
  const raced = db.index.stages.filter(s => s.results_count > 0);
  if (raced.length) return raced[raced.length - 1].n;
  const drawn = db.index.stages.find(s => s.geometry.state === 'OK');
  return (drawn || db.index.stages[0]).n;
}

const STARTLIST_COLUMNS = [
  { label: 'Bib', get: r => r.bib, cls: 'num' },
  { label: 'Rider', get: r => r.full_name || r.rider,
    render: r => r.full_name || r.rider },
  { label: 'Nat', get: r => r.nationality },
  { label: 'Age', get: r => r.age, cls: 'num' },
  { label: 'Team', get: r => r.team },
];

/* The startlist inspector, shared by both places a startlist is shown. */
function startlistInspector(r) {
  const sourced = r.full_name_source === 'wikipedia'
    ? 'Wikipedia (CC BY-SA 4.0), independently resolved'
    : r.full_name
      ? 'letour.fr startlist slug — may lose diacritics or capitals'
      : 'letour.fr startlist (published label only)';
  openInspector({
    kind: 'Startlist entry', title: r.full_name || r.rider,
    rows: [['Bib', r.bib], ['Published as', r.rider],
           ['Nationality', r.nationality || '—'],
           ['Age at start', r.age ?? '—'], ['Team', r.team],
           ['Name source', sourced]],
    note: 'Nationality and age are the two entity facts §5 asks for that a '
        + 'race entry itself carries. Full name is always a normalisation, '
        + 'never the organiser’s own orthography — shown with its source '
        + 'rather than passed off as read.',
  });
}

/* The race page's startlist, for races whose riders are held but whose
 * route is not. Separate table ids from the stage page's so both can exist
 * without one clearing the other. */
function renderRaceStartlist(c) {
  const list = (c && c.startlist) || [];
  const panel = $('#panel-race-startlist');
  if (!panel) return;
  panel.hidden = !list.length;
  if (!list.length) return;
  const { shown, total } = sortableTable(
    'race-startlist-table', 'race-startlist-filter',
    STARTLIST_COLUMNS, list, startlistInspector);
  $('#race-startlist-note').textContent =
    shown === total ? `${total} riders` : `${shown} of ${total} riders`;
}

function renderStartlist(c) {
  const list = (c && c.startlist) || [];
  $('#panel-startlist').hidden = !list.length;
  if (!list.length) return;
  const { shown, total } = sortableTable('startlist-table', 'startlist-filter',
    STARTLIST_COLUMNS, list, r => {
      // A slug-derived name lost its diacritics and internal capitals on the
      // way in (§ full_name_source), which is worth saying at the row a
      // reader actually clicked rather than only in a caption above the
      // whole table nobody reads before they've found what they wanted.
      const sourced = r.full_name_source === 'wikipedia'
        ? 'Wikipedia (CC BY-SA 4.0), independently resolved'
        : r.full_name
          ? 'letour.fr startlist slug — may lose diacritics or capitals'
          : 'letour.fr startlist (published label only)';
      openInspector({
        kind: 'Startlist entry', title: r.full_name || r.rider,
        rows: [['Bib', r.bib], ['Published as', r.rider],
               ['Nationality', r.nationality || '—'],
               ['Age at start', r.age ?? '—'], ['Team', r.team],
               ['Name source', sourced]],
        note: 'Nationality and age are the two entity facts §5 asks for that '
            + 'a race entry itself carries. Full name is always a '
            + 'normalisation, never the organiser’s own orthography — '
            + 'shown with its source rather than passed off as read.',
      });
    });
  $('#startlist-note').textContent = shown === total
    ? `${total} riders` : `${shown} of ${total} riders`;
  $('#startlist-caption').textContent =
    'Every rider entered, by bib. Nationality and age come from the '
    + 'startlist itself; full names are corrected against Wikipedia’s '
    + 'orthography where the same rider resolves there, and shown as '
    + 'published where it does not.';
}

/* How current this race is, in a sentence, at the top of its page.
 *
 * `status` on the race card is the calendar's word for the race — SCHEDULED,
 * COMPLETED — and it is written once when the calendar is read. The Tour de
 * France Femmes was in its sixth stage with six full result fields held and
 * its card still said SCHEDULED, because nothing about riding a bike changes
 * a field a parser wrote in February.
 *
 * `freshness.result_state` is the measured answer, judged in SQL against the
 * newest observation in the vault rather than against the reader's clock. It
 * is the difference between "this race has no result" and "this race has no
 * result and nobody has looked since it finished", which is the single most
 * useful thing this site can say about a gap — and it was reaching the
 * bundle and appearing on no page.
 *
 * Deliberately a sentence and not a badge. A badge saying RACING_NOW invites
 * a reader to think they are watching live timing; a sentence can say what
 * this actually is, which is a schedule that last looked at a stated moment. */
const FRESHNESS_SENTENCE = {
  RACING_NOW: c => `This race is under way. ${heldPhrase(c)}`,
  NOT_YET_RACED: () => 'This race has not been ridden yet.',
  HELD: () => 'The race has finished and a result is held for every stage.',
  HELD_IN_PART: c => `The race has finished. ${heldPhrase(c)}`,
  ABSENT_AND_CHECKED: () =>
    'The race has finished and no result is held. Something has been fetched '
    + 'for it since it finished, so this is a gap being worked rather than a '
    + 'pipeline that stopped looking.',
  ABSENT_AND_UNCHECKED: () =>
    'The race has finished, no result is held, and nothing has been fetched '
    + 'for it since it finished. Nobody has looked.',
  CANCELLED: () => 'The race was cancelled, so no result will ever exist.',
  DATES_UNKNOWN: () =>
    'No start date is held for this race, so nothing about its timing can be '
    + 'judged.',
  NO_EVIDENCE_AT_ALL: () =>
    'Nothing has ever been fetched for this race, so there is no date for it '
    + 'to be current to.',
};

function heldPhrase(c) {
  const sched = c.schedule || [];
  const withResult = Object.keys(c.stage_results || {}).length;
  if (!sched.length) return '';
  return `A result is held for ${withResult} of its ${sched.length} `
    + `stage${sched.length === 1 ? '' : 's'}.`;
}

function freshnessLine(c) {
  const f = c.freshness;
  if (!f || !f.result_state) return null;
  const say = FRESHNESS_SENTENCE[f.result_state];
  if (!say) return null;
  const p = el('p', 'racehero__fresh');
  p.append(el('span', 'racehero__fresh__state', say(c).trim()));

  // The two dates a reader judges staleness by, and they are different
  // questions: when the evidence behind this page was captured, and when
  // anything was last fetched for this race at all. A race can be current to
  // June and have been looked at yesterday, which means the looking found
  // nothing new — that is a healthy pipeline, and it reads as a stale one if
  // only the first date is shown.
  const when = [];
  if (f.evidence_current_on) when.push(`evidence current to ${f.evidence_current_on}`);
  if (f.last_look_on && f.last_look_on !== f.evidence_current_on) {
    when.push(`last looked ${f.last_look_on}`);
  }
  if (f.next_recheck_on) when.push(`next check ${f.next_recheck_on}`);
  if (when.length) p.append(el('span', 'racehero__fresh__when', when.join(' · ')));

  // Said out loud rather than left to be inferred from the dates. §15 and §22
  // both turn on this project not implying a live feed it does not have.
  p.title = 'These are scheduled fetches, not live timing. The freshest this '
    + 'page can be is the last run that succeeded.';
  return p;
}

function renderRaceDetail(c) {
  $('#race-name').textContent = c.name;

  const hero = $('#race-hero');
  hero.innerHTML = '';
  const box = el('div', 'racehero');
  const head = el('div');
  head.append(el('h2', null, c.name));
  const meta = el('div', 'racehero__meta');
  const bits = [
    ['Class', `${c.class} · ${c.class_label || ''}`],
    ['Dates', c.end && c.end !== c.start ? `${c.start} → ${c.end}` : c.start],
    ['Status', c.status],
    ['Depth held', c.depth],
  ];
  // The rest of the race card. Each is pushed only when it is held, because a
  // row reading "Organiser —" is a sentence about this project's collection
  // dressed up as a sentence about the race. What is missing is named once,
  // below, where it can say which of them are missing and why.
  if (c.organiser) bits.push(['Organiser', c.organiser]);
  if (c.race_director) bits.push(['Race director', c.race_director]);
  if (c.published_type) bits.push(['Type', c.published_type]);
  if (c.region) bits.push(['Region', c.region]);
  else if (c.countries && c.countries.length) {
    bits.push([c.countries.length > 1 ? 'Countries' : 'Country',
               c.countries.join(' · ')]);
  }
  if (c.race_km) bits.push(['Published distance', `${c.race_km} km`]);
  bits.forEach(([k, v]) => {
    const sp = el('span');
    sp.append(document.createTextNode(k + ' '));
    sp.append(el('b', null, v || '—'));
    meta.append(sp);
  });
  head.append(meta);
  const fr = freshnessLine(c);
  if (fr) head.append(fr);

  // The race's own site, as the publisher gave it. Some are printed as a bare
  // host — `letour.fr` — so a scheme is added to make the link work and the
  // text still shows what was published. Adding one is not inventing an
  // address; rewriting the host would be.
  if (c.official_url) {
    const raw = c.official_url;
    const href = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    const line = el('p', 'racehero__site');
    const a = el('a', 'race-link', raw.replace(/^https?:\/\//i, '')
                                      .replace(/\/$/, ''));
    a.href = href;
    a.rel = 'noopener nofollow';
    a.target = '_blank';
    a.title = 'The race’s own site, as the source printed it';
    line.append(document.createTextNode('Official site '));
    line.append(a);
    head.append(line);
  }
  box.append(head);
  const badge = el('span', 'depth depth--' + c.depth, c.depth);
  box.append(badge);
  hero.append(box);

  const legend = (db.races.manifest.depth_legend || [])
    .find(d => d.tier === c.depth) || {};
  const p = el('p', 'caption');
  p.textContent = `${legend.held || ''} ${legend.not_held || ''}`;
  hero.append(p);

  // Say which card fields are absent, once, rather than printing a dash beside
  // each. The distinction the sentence has to carry is that these are not
  // fields the race lacks — they are fields this project has not found a
  // source for, which is a statement about the collection.
  const CARD = [['organiser', 'the organiser'],
                ['official_url', 'an official site'],
                ['race_director', 'a race director'],
                ['region', 'a region']];
  const absent = CARD.filter(([k]) => !c[k]).map(([, label]) => label);
  if (absent.length) {
    const miss = el('p', 'caption');
    miss.textContent =
      'This card names no ' + absent.join(', ').replace(/, ([^,]*)$/, ' and $1')
      + '. The race has ' + (absent.length > 1 ? 'them' : 'one')
      + ' — no source this project holds publishes '
      + (absent.length > 1 ? 'them' : 'it') + ' for this race, which is a gap '
      + 'in the collection rather than a fact about the race.';
    hero.append(miss);
  }

  if (c.has_stage_product) {
    const link = el('p', 'caption');
    const a = el('a', 'race-link', 'Open the full stage product for this race →');
    a.href = '#stage=1';
    a.onclick = ev => { ev.preventDefault(); goRace(c.slug); };
    link.append(a);
    hero.append(link);
  }

  // ── designed absence, where a whole race is what is missing ───────────
  const nothing = !c.schedule.length && !Object.keys(c.standings).length
                  && !c.teams.length;
  $('#panel-race-absence').hidden = !nothing;
  if (nothing) {
    const host = $('#race-absence');
    host.innerHTML = '';
    const a = el('div', 'absence');
    a.append(el('h3', null, 'This race is registered and not collected'));
    const why = c.quality.find(q => q.rule === 'calendar_links_series_not_edition');
    a.append(el('p', null, why
      ? why.detail
      : 'The season calendar names it, with its dates and its UCI class, and '
      + 'that is all this project holds. Nothing here is missing because it '
      + 'failed to load — there is no start list, no result and no route in '
      + 'the database for it, and showing an empty table would say otherwise.'));
    host.append(a);
  }

  // ── schedule ──────────────────────────────────────────────────────────
  //
  // A one-day race's single stage often carries nothing the hero has not
  // already said: its date. A table of eight em-dashes is not an honest
  // absence, it is a panel pretending to hold something, so the schedule
  // appears only when it says something the header does not.
  const informative = c.schedule.some(
    st => st.km != null || st.from || st.type || st.winner || st.start_local);
  $('#panel-race-schedule').hidden = !informative;
  if (informative) {
    const oneDay = c.schedule.length === 1;
    const withResults = Object.keys(c.stage_results).length;
    $('#race-schedule-note').textContent = (oneDay
      ? 'a one-day race, modelled as a single stage'
      : `${c.schedule.length} stages`)
      + (withResults ? ` · ${withResults} carry a published result — open a row`
                     : '');
    // Cards, not rows. Twenty-one stages in an eight-column table asked the
    // reader to scan a grid to find the mountain days; a card can lead with
    // the terrain and the towns and put the rest underneath.
    const host = $('#race-stage-grid');
    host.innerHTML = '';
    c.schedule.forEach(st => {
      const t2 = stageTerrain(st.type);
      const card = el('article', 'stagegrid__card');
      const head = el('div', 'stagegrid__head');
      head.append(el('span', 'stagegrid__n', st.n === 0 ? 'P' : String(st.n)));
      const ico = terrainIcon(t2.key);
      ico.classList.add('stagegrid__icon');
      head.append(ico);
      if (st.km != null) {
        head.append(el('span', 'stagegrid__km', st.km.toFixed(1) + ' km'));
      }
      card.append(head);

      const towns = [st.from, st.to].filter(Boolean);
      card.append(el('div', 'stagegrid__towns',
        towns.length ? (towns[1] && towns[1] !== towns[0]
                        ? `${towns[0]} → ${towns[1]}` : towns[0])
                     : 'venues not published'));
      const meta = [st.date, st.start_local, t2.key ? t2.label : null]
        .filter(Boolean).join(' · ');
      card.append(el('div', 'stagegrid__meta', meta || '—'));
      if (st.winner) {
        const w = el('div', 'stagegrid__winner');
        w.append(el('span', 'stagegrid__winlabel', 'won by '),
                 document.createTextNode(st.winner));
        card.append(w);
      }

      // The stage's own placings sit behind the card that names it. Only a
      // card with something behind it is clickable, so a pointer never
      // promises a panel that turns out to be empty.
      const held = c.stage_results[String(st.n)];
      if (held) {
        card.classList.add('is-openable');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label',
          `Stage ${st.n}: open the published placings`);
        const open = () => openInspector({
          kind: 'Stage result',
          title: `${c.name} — ${st.n === 0 ? 'prologue' : 'stage ' + st.n}`,
          rows: held.rows.map(row => [
            `${row.rank}. ${[row.rider, row.team].filter(Boolean).join(' · ')}`
            + (row.nat ? ` (${row.nat})` : ''),
            row.time_s != null ? hhmmss(row.time_s)
              : row.gap_s != null
                ? (row.gap_s === 0 ? 'same time' : '+ ' + hhmmss(row.gap_s))
                : '—']),
          note: `${held.tier.replace(/_/g, ' ').toLowerCase()}`
              + (held.partial
                  ? `, published as a top ${held.rows.length}. That is the top `
                  + 'of the result, not the field that finished, and nothing '
                  + 'here may be read as a complete classification.'
                  : ', full field.'),
        });
        card.onclick = open;
        card.onkeydown = ev => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); }
        };
      }
      host.append(card);
    });
  }

  // ── standings ─────────────────────────────────────────────────────────
  const kinds = ['GENERAL', 'POINTS', 'MOUNTAINS', 'YOUTH', 'TEAM']
    .filter(k => c.standings[k]);
  $('#panel-race-standings').hidden = !kinds.length;
  if (kinds.length) {
    const first = c.standings[kinds[0]];
    $('#race-standings-note').textContent =
      `${first.tier.replace(/_/g, ' ').toLowerCase()}`;
    const host = $('#race-standings-host');
    host.innerHTML = '';
    kinds.forEach(k => {
      const block = c.standings[k];
      const wrap = el('div', 'standing');
      const h = el('div', 'standing__head');
      h.append(el('h3', null, CLASSIFICATION_LABEL[k] || k));
      h.append(el('span', 'tag ' + (block.partial ? 'tag--derived' : 'tag--observed'),
                 block.partial ? `top ${block.rows.length}, as published` : 'full field'));
      wrap.append(h);
      const t = el('table');
      const thead = el('thead'), tr = el('tr');
      const hasRider = block.rows.some(r => r.rider);
      const hasPoints = block.rows.some(r => r.points != null);
      const cols = ['#'].concat(hasRider ? ['Rider'] : [])
        .concat(['Team'], hasPoints ? ['Points'] : ['Time']);
      cols.forEach(x => tr.append(el('th', null, x)));
      thead.append(tr); t.append(thead);
      const tb = el('tbody');
      block.rows.forEach(row => {
        const r = el('tr');
        r.append(el('td', 'num', row.rank));
        if (hasRider) {
          r.append(el('td', null,
            (row.rider || '—') + (row.nat ? ` (${row.nat})` : '')));
        }
        r.append(el('td', null, row.team || '—'));
        r.append(el('td', 'num', hasPoints
          ? (row.points == null ? '—' : row.points)
          : row.time_s != null ? hhmmss(row.time_s)
          : row.gap_s != null ? (row.gap_s === 0 ? 'same time' : '+ ' + hhmmss(row.gap_s))
          : '—'));
        tb.append(r);
      });
      t.append(tb);
      const scroll = el('div', 'table-scroll');
      scroll.append(t);
      wrap.append(scroll);
      host.append(wrap);
    });
  }

  // ── teams ─────────────────────────────────────────────────────────────
  $('#panel-race-teams').hidden = !c.teams.length;
  if (c.teams.length) {
    $('#race-teams-note').textContent = `${c.teams.length} squads`;
    const host = $('#race-teams-host');
    host.innerHTML = '';
    c.teams.forEach(t => {
      const d = el('div', null, t.name);
      if (t.uci_code) d.append(el('span', 'race-sub', t.uci_code));
      host.append(d);
    });
  }

  // ── the riders inside those squads ────────────────────────────────────
  // Same rows and same inspector as the stage page's startlist, on the page
  // a race without a stage product actually shows. Rendered eagerly rather
  // than behind an observer: this page is short, so the panel is usually
  // already in view, and a lazy panel that never gets scrolled to is
  // indistinguishable from one that holds nothing.
  renderRaceStartlist(c);


  // ── disagreements ─────────────────────────────────────────────────────
  $('#panel-race-quality').hidden = !c.quality.length;
  if (c.quality.length) {
    const host = $('#race-quality-host');
    host.innerHTML = '';
    c.quality.forEach(q => {
      const d = el('div', 'qissue');
      d.append(el('div', 'qissue__rule', `${q.severity} · ${q.rule}`));
      d.append(el('p', null, q.description));
      d.append(el('p', null, q.detail));
      host.append(d);
    });
  }

  // ── provenance ────────────────────────────────────────────────────────
  const host = $('#race-provenance-host');
  host.innerHTML = '';
  if (!c.provenance.length) {
    const a = el('div', 'absence');
    a.append(el('h3', null, 'No evidence is placed to this race'));
    a.append(el('p', null,
      'Its registration rests on a season calendar that serves 124 races at '
      + 'once, and an artifact serving more than one race is placed to none '
      + 'rather than guessed at. That is a limit of the attribution, not an '
      + 'absence of the source.'));
    host.append(a);
  } else {
    const grid = el('div', 'prov');
    c.provenance.forEach(p2 => {
      const d = el('div');
      d.append(el('b', null, p2.source));
      d.append(el('span', null,
        `${p2.tier.replace(/_/g, ' ')} · ${p2.licence || 'licence not recorded'}`
        + ` · ${p2.artifacts} artifact${p2.artifacts === 1 ? '' : 's'}`
        + ` · ${p2.redistributable ? 'redistributable' : 'not redistributable'}`));
      grid.append(d);
    });
    host.append(grid);
  }
  $('#race-article-note').textContent = c.article
    ? `Read from ${c.article} under CC BY-SA 4.0. `
      + `${c.held.claims} evidence claims and ${c.held.artifacts} vaulted `
      + `artifacts are placed to this race.`
    : 'No article is registered for this race; it is known from the season '
      + 'calendar alone.';
}

/* ── race index ────────────────────────────────────────────────────────
 *
 * The registry names every race the observatory knows and states, for each,
 * exactly what is held for it. That second half is the point: 137 names with
 * one race collected reads as a fleet unless the difference is on the page.
 *
 * `races.json` is fetched only when this view is first opened. It is a
 * fleet-wide file and most visits never leave the stage product, so loading
 * it up front would cost every visitor 47 KB to render nothing.
 */
const raceFilter = { q: '', cls: null, depth: null };

async function loadRaces() {
  if (db.races) return db.races;
  db.races = await (await fetch(DATA + 'races.json')).json();
  return db.races;
}

const DEPTH_ORDER = ['CALENDAR', 'SCHEDULE', 'RESULTS', 'ROUTE', 'FULL'];

const dateRange = r => {
  if (!r.start) return '—';
  if (!r.end || r.end === r.start) return r.start;
  return `${r.start} → ${r.end}`;
};

function racesShown() {
  const q = raceFilter.q.toLowerCase();
  return db.races.races.filter(r =>
    (!q || r.name.toLowerCase().includes(q)
        || (r.organiser || '').toLowerCase().includes(q))
    && (!raceFilter.cls || r.class === raceFilter.cls)
    && (!raceFilter.depth || r.depth === raceFilter.depth));
}

/* The fleet's two registers, on a page rather than behind a keystroke.
 *
 * `TOUR_CONTENT_AUDIT.md` F4 recorded these as a relocation, not a removal:
 * 44 quality findings and 40 open gaps were in the bundle and reachable only
 * by typing a matching string into the command palette. A data product that
 * hides the part of itself admitting what it does not know has the incentive
 * exactly backwards. */
const registerFilter = { q: '' };

/* The open-data bundles, linked rather than merely generated. MASTER_GOAL §20
 * asks for eligible outputs to be downloadable, and 4 MB of CSV and GeoJSON
 * that no page points at is data nobody can fetch. One bundle per race with a
 * stage product, each named for its own race — they were briefly one bundle
 * whose manifest said "Tour de France 2026" over the whole fleet's rows. */
const OPEN_DATA = [
  ['csv/stages.csv', 'Stages'],
  ['csv/stage_results.csv', 'Stage results'],
  ['csv/general_classification.csv', 'General classification'],
  ['csv/classification_standings.csv', 'Classification standings'],
  ['csv/official_climbs.csv', 'Official climbs'],
  ['csv/roadbook_itinerary.csv', 'Roadbook itinerary'],
  ['csv/road_and_sky.csv', 'Road & sky'],
  ['csv/startlist.csv', 'Startlist'],
  ['csv/quality_issues.csv', 'Quality findings'],
  ['csv/gap_register.csv', 'Gap register'],
  ['geojson/routes.geojson', 'Route lines'],
  ['geojson/waypoints.geojson', 'Waypoints'],
  ['geojson/official_course_points.geojson', 'Official course points'],
];

function renderDownloads() {
  const host = $('#downloads-host');
  host.innerHTML = '';
  const slugs = (db.races && db.races.manifest.products) || [];
  if (!slugs.length) {
    absence(host, 'No open-data bundle is published',
      'The export centre emits one per race with a stage product; none is '
    + 'present in this build.', '§4.8');
    return;
  }
  slugs.forEach(slug => {
    const race = (db.races.races || []).find(r => r.slug === slug);
    const box = el('div', 'classif');
    const head = el('div', 'classif__head');
    head.append(el('h3', null, (race && race.name) || slug));
    const man = el('a', 'race-link', 'manifest');
    man.href = `exports/${slug}/MANIFEST.json`;
    head.append(man);
    box.append(head);
    const wrap = el('div', 'legend');
    OPEN_DATA.forEach(([path, label]) => {
      const a = el('a', 'dl', label);
      a.href = `exports/${slug}/${path}`;
      a.download = '';
      a.title = `${slug}/${path}`;
      wrap.append(a);
    });
    box.append(wrap);
    host.append(box);
  });
}

async function renderRegisters() {
  const host = $('#registers-host');
  let q;
  try {
    q = await loadQuality();
  } catch (e) {
    host.innerHTML = '';
    absence(host, 'The registers could not be loaded',
      'quality.json did not fetch. This is a delivery failure, not an '
    + 'absence of findings.', '');
    return;
  }
  const needle = registerFilter.q.trim().toLowerCase();
  const hit = t => !needle || t.toLowerCase().includes(needle);
  const issues = (q.quality || []).filter(
    x => hit(`${x.rule} ${x.subject} ${x.detail}`));
  const gaps = (q.gaps || []).filter(
    x => hit(`${x.family} ${x.subject} ${x.status} ${x.reason}`));

  $('#registers-note').textContent =
    `${issues.length} finding${issues.length === 1 ? '' : 's'} · `
    + `${gaps.length} open gap${gaps.length === 1 ? '' : 's'}`
    + (needle ? ' shown' : '');

  host.innerHTML = '';
  if (!issues.length && !gaps.length) {
    host.append(el('p', 'caption', 'Nothing matches this filter.'));
    return;
  }

  if (issues.length) {
    const box = el('div', 'classif');
    const bh = el('div', 'classif__head');
    bh.append(el('h3', null, 'automated findings'));
    box.append(bh);
    const t = el('table'), body = el('tbody');
    const head = el('thead'), hr = el('tr');
    ['Severity', 'Rule', 'Subject', 'What was found']
      .forEach(h => hr.append(el('th', null, h)));
    head.append(hr); t.append(head);
    issues.forEach(x => {
      const tr = el('tr');
      const sev = el('td');
      sev.append(el('span',
        'tag ' + (x.severity === 'BLOCKER' ? 'tag--absent' : 'tag--derived'),
        x.severity));
      tr.append(sev);
      tr.append(el('td', 'held', x.rule), el('td', null, x.subject),
                el('td', 'held', x.detail));
      tr.onclick = () => openInspector({
        kind: 'Quality finding', title: x.subject,
        rows: [['Rule', x.rule], ['Severity', x.severity],
               ['Detail', x.detail]],
        note: x.rationale });
      body.append(tr);
    });
    t.append(body); box.append(t); host.append(box);
  }

  if (gaps.length) {
    const box = el('div', 'classif');
    const bh = el('div', 'classif__head');
    bh.append(el('h3', null, 'open gaps'));
    box.append(bh);
    const t = el('table'), body = el('tbody');
    const head = el('thead'), hr = el('tr');
    ['Status', 'Family', 'Subject', 'Blocking source', 'Fallback']
      .forEach(h => hr.append(el('th', null, h)));
    head.append(hr); t.append(head);
    gaps.forEach(g => {
      const tr = el('tr');
      const st = el('td');
      st.append(el('span', 'tag tag--absent', g.status));
      tr.append(st);
      tr.append(el('td', 'held', g.family), el('td', null, g.subject),
                el('td', 'held', g.source || '—'),
                el('td', 'held', g.fallback || 'none'));
      tr.onclick = () => openInspector({
        kind: 'Gap register', title: g.subject,
        rows: [['Field family', g.family], ['Status', g.status],
               ['Blocking source', g.source || '—'],
               ['Fallback used', g.fallback || 'none']],
        note: g.reason });
      body.append(tr);
    });
    t.append(body); box.append(t); host.append(box);
  }
}

function renderRacesHero() {
  const m = db.races.manifest;
  const host = $('#races-hero');
  host.innerHTML = '';
  const h = el('div');
  h.append(el('h2', null, `${m.races} races registered for ${
    db.races.races[0] ? db.races.races[0].year : ''}`));
  const p = el('p', 'caption');
  const full = m.by_depth.FULL || 0;
  p.textContent =
    `${full} collected in full. ${m.by_depth.SCHEDULE || 0} hold a published `
  + `schedule and nothing more. ${m.by_depth.CALENDAR || 0} are names, dates `
  + `and a UCI class — this project has registered them and not yet collected `
  + `them, which is a statement about the observatory and not about the race.`;
  h.append(p);
  const ev = m.evidence_placement;
  const p2 = el('p', 'caption');
  p2.textContent =
    `${ev.claims_placed_to_a_race.toLocaleString()} of `
  + `${ev.claims_total.toLocaleString()} evidence claims are placed to a `
  + `named race. ${ev.note}`;
  h.append(p2);
  host.append(h);
  renderScores();
}

/* The §17 coverage scores, which existed only inside a generated Markdown
   report nobody browsing the site would find. They belong on the fleet view
   because they are statements about the fleet.
 *
 * Fetched once and lazily: coverage.json is not needed to render a race, and
 * a metric panel is not worth a blocking request on first paint. If the fetch
 * fails the panel stays hidden rather than showing zeros — a coverage figure
 * that reads 0 % because a file did not load is the worst possible failure
 * mode for a number whose entire job is to be trusted. */
/* §26 asks a release to publish its own conformance, unresolved conflicts,
 * research-exhausted fields, refresh schedule and next acquisition tasks.
 * Every one of those was generated and shipped in the bundle, and rendered
 * nowhere — present in the site's data directory but not in the site, which
 * is the same distinction as evidence held in a database nobody can read.
 *
 * Both fetch lazily beside the coverage scores, and both stay hidden if their
 * file does not load rather than rendering an empty verdict table: a
 * conformance panel showing nothing reads as "nothing to report", which is
 * the opposite of what an unreachable file means. */
const VERDICT_CLASS = {
  MET: 'ok', PARTIAL: 'partial', UNMET: 'bad',
  BLOCKED: 'bad', NOT_MECHANICALLY_CHECKED: 'nc',
};

let conformanceReport;
async function renderConformance() {
  if (conformanceReport === undefined) {
    try {
      conformanceReport = await (await fetch(DATA + 'conformance.json')).json();
    } catch { conformanceReport = null; }
  }
  if (!conformanceReport) return;
  const r = conformanceReport;
  const host = $('#conformance-host');
  host.innerHTML = '';
  $('#conformance-note').textContent =
    Object.entries(r.tally).sort()
      .map(([k, v]) => `${v} ${k.toLowerCase().replace(/_/g, ' ')}`).join(' · ');
  r.clauses.forEach(c => {
    const row = el('div', 'clause');
    row.append(el('span', 'clause__ref', c.ref));
    const mid = el('div');
    mid.append(el('div', 'clause__text', c.clause));
    mid.append(el('div', 'clause__detail', c.detail));
    row.append(mid);
    row.append(el('span', 'clause__verdict v--' + (VERDICT_CLASS[c.verdict] || 'nc'),
                  c.verdict.replace(/_/g, ' ').toLowerCase()));
    host.append(row);
  });
  $('#panel-conformance').hidden = false;
}

let queueReport;
async function renderQueue() {
  if (queueReport === undefined) {
    try {
      queueReport = await (await fetch(DATA + 'research_queue.json')).json();
    } catch { queueReport = null; }
  }
  if (!queueReport || !queueReport.queue || !queueReport.queue.length) return;
  const q = queueReport;
  $('#queue-note').textContent =
    `${q.open_in_scope} open in scope · ${q.research_exhausted} research-exhausted`;
  const t = $('#queue-table');
  t.innerHTML = '';
  const head = el('thead'), hr = el('tr');
  ['Priority', 'Race', 'Gap', 'Steps done', 'Next action']
    .forEach(h => hr.append(el('th', null, h)));
  head.append(hr); t.append(head);
  const body = el('tbody');
  q.queue.forEach(row => {
    const tr = el('tr');
    tr.append(el('td', 'num', row.priority));
    tr.append(el('td', null, row.race || '—'));
    tr.append(el('td', null, `${row.field_family} ${row.subject}`));
    // Which of the six §12 escalation steps have actually been attempted.
    // Read from the vault's own observations, so a step nobody ran shows as
    // not run — the column exists precisely so optimism cannot fill it.
    tr.append(el('td', 'num', (row.searched_steps || []).join(',') || '—'));
    tr.append(el('td', null, row.next_action));
    body.append(tr);
  });
  t.append(body);
  $('#queue-caption').textContent =
    `Ordered by §24's own priority formula, every input a count from the `
    + `database. ${q.method}`;
  $('#panel-queue').hidden = false;
}

let coverageReport;
async function renderScores() {
  if (coverageReport === undefined) {
    try {
      coverageReport = await (await fetch(DATA + 'coverage.json')).json();
    } catch { coverageReport = null; }
  }
  if (!coverageReport) return;
  renderConformance();
  renderQueue();
  const r = coverageReport;
  const cw = r.evidence.confidence_weighted_coverage;
  const host = $('#scores-host');
  host.innerHTML = '';
  const cards = [
    ['Evidence coverage', `${r.evidence.evidence_coverage.pct} %`,
     `${r.evidence.evidence_coverage.rows_citing_a_claim.toLocaleString()} of `
     + `${r.evidence.evidence_coverage.rows.toLocaleString()} normalised rows `
     + `walk back to bytes you can verify.`],
    ['Confidence-weighted', cw ? `${cw.score_pct} %` : '—',
     cw ? `Scored ${cw.rule} — the harshest reading available, counting only `
        + `what the organiser itself published.` : ''],
    ['Spatial coverage', `${r.spatial_coverage.pct} %`,
     `${Math.round(r.spatial_coverage.km_with_usable_geometry).toLocaleString()}`
     + ` km of ${Math.round(r.spatial_coverage.km_in_scope).toLocaleString()} km`
     + ` in scope carries usable geometry.`],
    ['Races in scope', `${r.scope.races_in_scope}`,
     `${r.scope.races_retained_out_of_scope} more are collected and retained `
     + `out of scope. The evidence is kept either way.`],
  ];
  cards.forEach(([label, value, note]) => {
    const d = el('div', 'score');
    d.append(el('div', 'score__label', label));
    d.append(el('div', 'score__value', value));
    d.append(el('div', 'score__note', note));
    host.append(d);
  });
  if (cw) {
    const bands = ['high', 'medium', 'low']
      .map(b => `${b} ${cw.bands[b].pct_of_cited} %`).join(' · ');
    $('#scores-caption').textContent =
      `Confidence composition of the cited rows: ${bands}. The weighting is `
      + `declared rather than tuned, so a reader who prefers another can apply `
      + `it to these same counts. Evidence current to `
      + `${(r.evidence_current_to || '').slice(0, 10)}.`;
  }
  $('#panel-scores').hidden = false;
}

/* Victories across every race with a held result. The denominator is in the
   caption and not optional: a win table that quietly means "of the 82 races
   we hold" while reading as "of the season" is arithmetically correct and
   completely misleading. */
const SCOPE_LABEL = { RIDER: 'Riders', TEAM: 'Teams', NATION: 'Nations' };

function renderSeason() {
  const season = db.races.manifest.season;
  const host = $('#season-host');
  host.innerHTML = '';
  if (!season || !season.leaders) {
    $('#panel-season').hidden = true;
    return;
  }
  $('#season-note').textContent =
    `over the ${season.races_seen} races with a held result`;
  for (const scope of ['RIDER', 'TEAM', 'NATION']) {
    const rows = (season.leaders[scope] || []).slice(0, 10);
    if (!rows.length) continue;
    const sec = el('section');
    sec.append(el('h3', null, SCOPE_LABEL[scope] || scope));
    const top = rows[0].wins || 1;
    rows.forEach(r => {
      const line = el('div', 'winrow');
      line.append(el('span', 'winrow__n', r.wins));
      const bar = el('span', 'winrow__bar');
      bar.style.width = Math.max(3, Math.round(70 * r.wins / top)) + 'px';
      line.append(bar);
      const nm = el('span', 'winrow__name', r.label);
      nm.title = `${r.race_wins} overall · ${r.stage_wins} stage`;
      line.append(nm);
      sec.append(line);
    });
    host.append(sec);
  }
  $('#season-caption').textContent = season.note;
}

function renderDepthLegend() {
  const m = db.races.manifest;
  const host = $('#depth-legend');
  host.innerHTML = '';
  m.depth_legend.forEach(d => {
    const card = el('div', 'dl');
    card.append(el('span', 'dl__n', String(m.by_depth[d.tier] || 0)));
    const badge = el('span', 'depth depth--' + d.tier, d.tier);
    card.append(badge);
    card.append(el('p', 'dl__held', d.held));
    card.append(el('p', 'dl__not', d.not_held));
    host.append(card);
  });
  $('#depth-caption').textContent =
    'A race is listed at the highest tier for which every lower tier also '
  + 'holds, so the label cannot overstate: a race with results but no route '
  + 'reads RESULTS. Counted from the database on every build, never asserted.';
}

function renderFacets() {
  const m = db.races.manifest;
  const host = $('#races-facets');
  host.innerHTML = '';
  const all = db.races.races;
  const add = (label, n, on, run) => {
    const b = el('button', 'facet');
    b.append(document.createTextNode(label));
    b.append(el('span', 'facet__n', String(n)));
    b.setAttribute('aria-pressed', String(on));
    b.onclick = run;
    host.append(b);
  };
  add('All classes', all.length, !raceFilter.cls,
      () => { raceFilter.cls = null; renderRaces(); });
  Object.keys(m.class_labels).forEach(c => {
    const n = all.filter(r => r.class === c).length;
    if (!n) return;
    add(m.class_labels[c], n, raceFilter.cls === c,
        () => { raceFilter.cls = raceFilter.cls === c ? null : c; renderRaces(); });
  });
  DEPTH_ORDER.forEach(d => {
    const n = all.filter(r => r.depth === d).length;
    if (!n) return;
    add(d, n, raceFilter.depth === d,
        () => { raceFilter.depth = raceFilter.depth === d ? null : d; renderRaces(); });
  });
}

/* Which family a race belongs to, for grouping. Read from the gender the
   derive step records and the class the UCI assigns, never from the name —
   "Tour of Flanders" is two races and the string cannot tell you which. The
   class is the fallback rather than the primary, because a .Pro race has a
   gender and its class does not carry one. */
function raceGroup(r) {
  if ((r.class || '').toUpperCase() === '.WC') return 'Worlds';
  const g = (r.gender || '').toUpperCase();
  if (g) return g === 'WOMEN' ? 'Women' : 'Men';
  return (r.class || '').toUpperCase() === '.WWT' ? 'Women' : 'Men';
}
const GROUP_ORDER = ['Men', 'Women', 'Worlds'];

/* A coverage bar, drawn only where the denominator is real.
   A race with no stages has no "percentage of stages with geometry" — the
   honest rendering of 0/0 is nothing, not an empty bar reading zero. */
function coverageBar(label, num, den) {
  if (!den) return null;
  const pct = Math.round((num / den) * 100);
  const box = el('div', 'cov');
  const head = el('div', 'cov__head');
  head.append(el('span', 'cov__label', label),
              el('span', 'cov__pct', `${num}/${den}`));
  const track = el('div', 'cov__track');
  const fill = el('div', 'cov__fill');
  fill.style.width = pct + '%';
  // Colour by completeness, and the number stays beside it — the bar is a
  // second reading of a figure that is already written down, never the only
  // one, because a length is not readable to somebody who cannot see it.
  fill.classList.add(pct === 100 ? 'cov__fill--full'
                   : pct > 0 ? 'cov__fill--part' : 'cov__fill--none');
  track.append(fill);
  box.append(head, track);
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', `${label}: ${num} of ${den}, ${pct} per cent`);
  return box;
}

function renderRaces() {
  renderFacets();
  const m = db.races.manifest;
  const rows = racesShown();
  $('#races-count').textContent =
    rows.length === db.races.races.length
      ? `${rows.length} of ${rows.length}`
      : `${rows.length} of ${db.races.races.length} shown`;

  const host = $('#races-grid');
  host.innerHTML = '';
  if (!rows.length) {
    host.append(el('p', 'muted', 'No race matches this filter.'));
    $('#races-attrib').textContent = m.attribution;
    return;
  }

  const groups = new Map(GROUP_ORDER.map(g => [g, []]));
  rows.forEach(r => groups.get(raceGroup(r)).push(r));

  GROUP_ORDER.forEach(g => {
    const list = groups.get(g);
    if (!list.length) return;
    // Sorted by date within the family, so the grid reads as a season.
    list.sort((a, b) => String(a.start || '').localeCompare(String(b.start || ''))
                     || a.name.localeCompare(b.name));
    const sec = el('section', 'racegroup');
    const h = el('h3', 'racegroup__title');
    h.append(document.createTextNode(g),
             el('span', 'racegroup__count', String(list.length)));
    sec.append(h);
    const grid = el('div', 'racegroup__grid');

    list.forEach(r => {
      const card = el('article', 'racecard');
      const a = el('a', 'race-link', r.name);
      a.href = '#race=' + encodeURIComponent(r.slug);
      a.onclick = ev => { ev.preventDefault(); goRace(r.slug); };
      const head = el('div', 'racecard__head');
      head.append(a);
      card.append(head);

      const meta = el('div', 'racecard__meta');
      meta.append(el('span', 'racecard__dates', dateRange(r)));
      meta.append(el('span', 'racecard__class', r.class || '—'));
      if (r.status && r.status !== 'COMPLETED' && r.status !== 'SCHEDULED') {
        meta.append(el('span', 'status-chip status-chip--' + r.status, r.status));
      }
      card.append(meta);
      if (r.organiser) card.append(el('div', 'racecard__org', r.organiser));

      // Both ladders, for the reason the table gave them two columns: a route
      // published before a race is ridden is invisible on the event ladder,
      // and the Vuelta's sixteen accepted lines once read the same as a race
      // holding nothing but a date.
      const badges = el('div', 'racecard__badges');
      const ev2 = el('span', 'depth depth--' + r.depth, r.event_depth || r.depth);
      ev2.title = 'What is known about the event';
      badges.append(ev2);
      if (r.spatial_depth && r.spatial_depth !== 'NONE') {
        const sp = el('span', 'depth depth--' + (
          r.spatial_depth === 'ITINERARY' ? 'FULL' : 'ROUTE'), r.spatial_depth);
        sp.title = 'What is known about the road, measured independently of '
                 + 'whether the race has been ridden';
        badges.append(sp);
      }
      card.append(badges);

      const h2 = r.held;
      const bars = el('div', 'racecard__cov');
      // Stage counts, both of them. `routes` is versions and `results` is
      // rider rows, so neither can be a numerator over stages: the Tour holds
      // 36 route versions across 21 stages, which as a percentage is 171.
      const geom = coverageBar('geometry', h2.stages_with_route, h2.stages);
      if (geom) bars.append(geom);
      const res = coverageBar('results', h2.stages_with_result, h2.stages);
      if (res) bars.append(res);
      if (bars.childNodes.length) card.append(bars);

      const bits = [];
      if (h2.stages) bits.push(`${h2.stages} stage${h2.stages > 1 ? 's' : ''}`);
      if (h2.entries) bits.push(`${h2.entries} entries`);
      if (h2.results) bits.push(`${h2.results} result rows`);
      if (h2.itinerary) bits.push(`${h2.itinerary} itinerary rows`);
      bits.push(`${h2.claims.toLocaleString()} claim${h2.claims === 1 ? '' : 's'}`);
      card.append(el('div', 'racecard__held', bits.join(' · ')));

      card.onclick = ev => {
        if (ev.target.closest('a')) return;
        goRace(r.slug);
      };
      grid.append(card);
    });
    sec.append(grid);
    host.append(sec);
  });

  $('#races-attrib').textContent = m.attribution;
}

const CLASSIFICATION_LABEL = {
  GENERAL: 'Final classification', POINTS: 'Points',
  MOUNTAINS: 'Mountains', YOUTH: 'Young rider', TEAM: 'Teams',
};

function setView(view) {
  state.view = view;
  const races = view === 'races';
  // "This race" is one of two pages depending on what is held for the
  // selected race: the stage product, or its detail chunk. The switch is not
  // cosmetic — rendering an empty stage page for a race with no route would
  // read as a broken load rather than as an absence.
  const onProduct = !races && hasProduct(state.race || productSlug());
  $('#main').hidden = !onProduct;
  $('#stagebar').hidden = !onProduct;
  $('#main-race').hidden = races || onProduct;
  $('#main-races').hidden = !races;
  $('#btn-view-stage').classList.toggle('is-on', !races);
  $('#btn-view-races').classList.toggle('is-on', races);
  $('#btn-view-stage').setAttribute('aria-selected', String(!races));
  $('#btn-view-races').setAttribute('aria-selected', String(races));
  writeUrl(true);

  if (!races && !onProduct) {
    // A CALENDAR-depth race (name, date, class only) is never published as
    // its own detail chunk \u2014 an individual page holding nothing beyond what
    // the fleet index already states is an empty room with a sign on the
    // door (make publish-tree). The fleet index carries every field that
    // race's absence panel needs, so a predicted-missing chunk renders
    // straight from it and skips the fetch as a pure optimisation.
    //
    // The correctness net is the fetch path itself, not this prediction: any
    // chunk fetch that 404s \u2014 this one or one the prediction got wrong \u2014
    // renders the exact same stub, built from the index rather than assumed
    // as "did not load". A prediction and its enforcement can drift; this
    // way drifting the wrong direction still reads as an honest absence.
    const idx = selectedRace();
    if (idx && idx.event_depth === 'CALENDAR') {
      renderRaceDetail(raceAbsenceStub(idx));
      return;
    }
    loadRaceChunk(state.race).then(renderRaceDetail).catch(e => {
      console.error(e);
      if (idx && e.notPublished) {
        renderRaceDetail(raceAbsenceStub(idx));
        return;
      }
      $('#race-hero').innerHTML =
        '<div class="absence"><h3>This race\u2019s detail did not load</h3>'
      + '<p>Nothing is shown rather than a partial page, because a partial '
      + 'page is indistinguishable from a race that holds little.</p></div>';
    });
    return;
  }
  if (onProduct) {
    $('#race-name').textContent = db.index.manifest.race;
    renderStagebar();
  }
  if (races) {
    loadRaces().then(() => {
      renderRacesHero(); renderDepthLegend(); renderSeason(); renderRaces();
      renderDownloads();
      renderRegisters().catch(e => console.error(e));
    }).catch(e => {
      console.error(e);
      $('#races-hero').innerHTML =
        '<div class="absence"><h3>The race registry did not load</h3>'
      + '<p>races.json is part of the data bundle. Nothing is shown here '
      + 'rather than a partial list, because a partial registry is '
      + 'indistinguishable from a small one.</p></div>';
    });
  }
}

function openInspector({ kind, title, rows, note }) {
  const b = $('#inspector-body');
  b.innerHTML = '';
  b.append(el('div', 'insp-h', kind), el('div', 'hero__title', title));
  const dl = el('dl');
  rows.forEach(([k, v]) => {
    const r = el('div', 'insp-row');
    r.append(el('dt', null, k), el('dd', null, String(v)));
    dl.append(r);
  });
  b.append(dl);
  if (note) {
    b.append(el('div', 'insp-h', 'Provenance'), el('p', 'caption', note));
  }
  b.append(el('div', 'insp-h', 'Evidence vault'));
  const m = db.index.manifest.evidence;
  b.append(el('p', 'hashline',
    `${m.artifacts} artifacts · ${m.claims} claims · ${m.observations} `
    + `observations · ${(m.vault_bytes / 1048576).toFixed(1)} MB, `
    + `content-addressed by SHA-256`));
  $('#inspector').classList.add('is-open');
}

function openWaypointPassport(w) {
  openInspector({
    kind: 'Roadbook waypoint', title: w.label,
    rows: [
      ['Route offset', fmt(w.km, 2) + ' km — OBSERVED (official roadbook)'],
      ['Position', w.lat ? `${fmt(w.lat, 5)}, ${fmt(w.lon, 5)}` : '—'],
      ['Position method', 'distance along route line — DERIVED'],
      ['Elevation', w.elev == null ? '—' : Math.round(w.elev) + ' m — DERIVED'],
      ['Passage window', w.win && w.win[0] ? `${w.win[0]} – ${w.win[1]}` : '—'],
      ['Window width', w.win_s == null ? '—' : w.win_s + ' s'],
      ['Sun elevation', w.sun_el == null ? '—' : fmt(w.sun_el, 2) + '°'],
      ['Temperature', w.temp == null ? '—' : fmt(w.temp, 1) + ' °C — OBSERVED'],
      ['Air density', w.rho == null ? '—' : fmt(w.rho, 4) + ' kg/m³'],
      ['Headwind', w.head == null ? '—' : fmt(w.head, 2) + ' m/s'],
      ['Crosswind', w.cross == null ? '—' : fmt(w.cross, 2) + ' m/s'],
      ['Geocode disagreement', w.pos_disagree_m == null ? 'not geocoded'
        : Math.round(w.pos_disagree_m) + ' m'],
    ],
    note: 'Route offset is Tier-0 observed from the official roadbook. Position '
        + 'is derived by projecting that offset onto the route line, which is '
        + 'materially more reliable than geocoding the label. Weather is '
        + 'observed at the window midpoint; solar geometry is deterministic. '
        + 'None of these describe a rider — they describe the road.',
  });
}

/* ── command palette ──────────────────────────────────────────────────── */
let paletteItems = [], paletteSel = 0;

function buildPalette() {
  paletteItems = [];
  db.index.stages.forEach(s => paletteItems.push({
    kind: 'stage', label: `Stage ${s.n} — ${s.start} → ${s.finish}`,
    hint: `${s.distance_km} km${s.winner ? ' · won by ' + s.winner : ''}`,
    run: () => goStage(s.n) }));
  db.index.startlist.forEach(r => paletteItems.push({
    kind: 'rider', label: r.full_name || r.rider,
    hint: `#${r.bib} · ${r.team}${r.nationality ? ' · ' + r.nationality : ''}`,
    run: () => openInspector({
      kind: 'Rider', title: r.full_name || r.rider,
      rows: [['Bib', r.bib], ['As published', r.rider],
             ['Team', r.team], ['UCI team code', r.uci_code || '—'],
             ['Nationality', r.nationality || '—'],
             ['Age at start', r.age != null ? r.age : '—'],
             ['White-jersey eligible', r.youth == null ? '—' : (r.youth ? 'yes' : 'no')],
             ['Full-name source', r.name_source || '—'],
             ['Status', r.name_source === 'wikipedia'
               ? 'NORMALIZED_FACT (correct orthography)'
               : 'NORMALIZED_FACT (reconstructed from a URL slug)']],
      note: r.name_source === 'letour_slug'
        ? 'This name was reconstructed from a lowercase ASCII URL slug, so it '
        + 'loses diacritics and internal capitals — "Mcnulty" rather than '
        + '"McNulty". The abbreviated form the result tables publish is kept '
        + 'alongside it, and neither overwrites the other.'
        : 'Identity resolved through the startlist registry (§5.24) on the '
        + 'official race bib. Orthography from the CC BY-SA source, which '
        + 'carries diacritics the official slug does not.' }) }));
  db.index.sources.forEach(s => paletteItems.push({
    kind: 'source', label: s.name, hint: `${s.tier} · ${s.access_mode}`,
    run: () => openInspector({
      kind: 'Source', title: s.name,
      rows: [['Publisher', s.publisher], ['Authority tier', s.tier],
             ['Access mode', s.access_mode], ['Licence', s.licence || '—'],
             ['Redistributable', s.redistributable ? 'yes' : 'no'],
             ['Registered fallback', s.fallback || '—']],
      note: s.note || '' }) }));
  // Gaps and quality findings enter the palette once quality.json has landed,
  // which openPalette triggers. Until then the palette holds everything else,
  // which is better than making every visitor pay for a register most will
  // never open.
  ((db.quality && db.quality.gaps) || []).forEach(g => paletteItems.push({
    kind: 'gap', label: g.subject, hint: `${g.family} · ${g.status}`,
    run: () => openInspector({
      kind: 'Gap register', title: g.subject,
      rows: [['Field family', g.family], ['Status', g.status],
             ['Blocking source', g.source || '—'],
             ['Fallback used', g.fallback || 'none']],
      note: g.reason }) }));
  ((db.quality && db.quality.quality) || []).forEach(q => paletteItems.push({
    kind: 'quality', label: `${q.rule} — ${q.subject}`, hint: q.severity,
    run: () => openInspector({
      kind: 'Quality issue', title: q.subject,
      rows: [['Rule', q.rule], ['Severity', q.severity]],
      note: q.detail + ' — ' + q.rationale }) }));
  // Every registered race is reachable by name from the palette, including
  // the ones that hold nothing but a name — searching for a race and being
  // told plainly that it is registered and uncollected is a better answer
  // than no result, which reads as "this race does not exist".
  if (db.races) {
    db.races.races.forEach(r => paletteItems.push({
      kind: 'race', label: r.name,
      hint: `${r.class} · ${dateRange(r)} · ${r.depth}`,
      run: () => goRace(r.slug) }));
  }
  // Climbs by the name the organiser gave them, which is how anybody looks
  // for one. Selecting a climb goes to its stage and parks the cursor on the
  // summit, so the profile, the map and the readout all arrive there together.
  (db.index.named_climbs || []).forEach(c => paletteItems.push({
    kind: 'climb', label: c.name,
    hint: `${c.category ? 'category ' + c.category + ' · ' : ''}stage ${c.stage}`
        + (c.summit_km != null ? ` · summit km ${c.summit_km}` : ''),
    run: () => goStage(c.stage, c.summit_km) }));
  db.index.manifest.formulas.forEach(f => paletteItems.push({
    kind: 'formula', label: f.id, hint: f.units,
    run: () => openInspector({
      kind: 'Formula', title: f.id,
      rows: [['Version', f.version], ['Expression', f.expression],
             ['Units', f.units]],
      note: f.description + (f.limitations ? ' — ' + f.limitations : '') }) }));
}

function openPalette() {
  $('#palette').hidden = false;
  $('#palette-input').value = '';
  $('#palette-input').focus();
  filterPalette('');
  // Races arrive in a file the stage view never fetches. Loading it here
  // rather than at boot keeps the first paint cheap, and the list refreshes
  // in place once it lands.
  const pending = [];
  if (!db.races) pending.push(loadRaces());
  if (!db.quality) pending.push(loadQuality());
  if (pending.length) {
    Promise.all(pending).then(() => {
      buildPalette();
      if (!$('#palette').hidden) filterPalette($('#palette-input').value);
    }).catch(e => console.error(e));
  }
}

function filterPalette(q) {
  const list = $('#palette-list');
  list.innerHTML = '';
  const ql = q.toLowerCase();
  const hits = paletteItems.filter(i =>
    !ql || i.label.toLowerCase().includes(ql) || i.kind.includes(ql)).slice(0, 40);
  paletteSel = 0;
  hits.forEach((it, i) => {
    const li = el('li');
    li.setAttribute('aria-selected', i === 0);
    li.append(el('span', 'palette__kind', it.kind), el('span', null, it.label),
              el('span', 'muted', it.hint || ''));
    li.onclick = () => { it.run(); $('#palette').hidden = true; };
    list.append(li);
  });
  list._hits = hits;
}

/* ── navigation ───────────────────────────────────────────────────────── */
async function goStage(n, km = null) {
  const moved = n !== state.stage;
  state.stage = n;
  state.km = km;
  // A different stage is somewhere you went; the same stage with the cursor
  // moved is not, and pushing it would make Back mean "undo my last hover".
  writeUrl(moved);
  await renderStage();
}

async function renderStage() {
  try {
    await loadStage(state.stage);
  } catch (e) {
    console.error(e);
  }
  clearCursorSubs();          // rebuilt below; never appended to
  renderStagebar();
  renderHero();
  renderProfile();
  renderSurfaceStrip();
  renderMap();
  renderRelief();
  renderSurface();
  renderSky();
  renderWaypoints();
  renderResults();
  renderGC();
  renderClimbStudio();
  armClimbCompare();
  // Only when the drawer is already open. A reader who opened the comparison
  // and then stepped to the next stage keeps it; one who never opened it
  // never pays the catalogue fetch.
  if ($('#climb-compare') && !$('#climb-compare').hidden) renderClimbCompare();
  renderOfficialClimbs();
  renderScales();
  renderJerseys();
  renderClassifications();
  renderFingerprints();
  renderCoverage();
  applyStrict();
  armStartlistObserver();
}

// The race-level chunk (teams, startlist, provenance) is a separate fetch
// from the stage product, and the lazy-loading budget this site holds itself
// to — one stage chunk on load, nothing else until asked for — applies to it
// as much as to any other chunk. Fetching it unconditionally on every stage
// render broke that budget outright: two invariant tests exist specifically
// to catch a chunk request appearing where it should not, and both caught it.
//
// An IntersectionObserver on a real sentinel element is what "asked for"
// means here: the startlist sits far enough down the page that reaching it
// takes a deliberate scroll, and that scroll is the request. The panel itself
// stays `hidden` until the fetch resolves — an element carrying `hidden`
// never intersects, having no box, so the sentinel is a separate, always
// present node placed right where the panel will appear.
let startlistObserver = null;
function armStartlistObserver() {
  if (startlistObserver) startlistObserver.disconnect();
  const sentinel = $('#startlist-sentinel');
  if (!sentinel) return;
  const slug = state.race || productSlug();
  startlistObserver = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting) || !slug) return;
    startlistObserver.disconnect();
    loadRaceChunk(slug).then(c => {
      if ((state.race || productSlug()) === slug) renderStartlist(c);
    }).catch(e => console.error(e));
  }, { rootMargin: '200px' });
  startlistObserver.observe(sentinel);
}

function applyStrict() {
  document.querySelectorAll('#panel-sky, #fingerprints, #classif-host')
    .forEach(n => {
      n.style.opacity = state.strict ? .25 : 1;
      n.style.pointerEvents = state.strict ? 'none' : '';
    });
}

/* Collapsible panels.
 *
 * Six zones of progressive disclosure only work if the closed ones stay
 * closed. The state is per panel in localStorage, because a reader who opens
 * the roadbook itinerary is telling you something about how they read this
 * site, and making them say it again on every stage change is the site not
 * listening.
 *
 * What folds is the panel BODY, never the <section>. Two reasons, and the
 * second is a bug waiting to happen: the head has to stay visible to be
 * clickable, and #startlist-sentinel is a real 1px element whose whole job is
 * to intersect the viewport — an ancestor with `display:none` has no
 * geometry, never intersects, and the startlist would silently never load.
 *
 * Closed by default on a phone regardless of the markup's preference: the
 * zones exist to stop a small screen being a mile of scrolling.
 */
const NARROW = () => window.matchMedia('(max-width: 760px)').matches;

function wireCollapsibles() {
  document.querySelectorAll('[data-collapsible]').forEach(panel => {
    if (panel.dataset.wired) return;
    panel.dataset.wired = '1';
    const head = panel.querySelector('.panel__head');
    if (!head) return;

    let body = panel.querySelector(':scope > .panel__body');
    if (!body) {
      body = el('div', 'panel__body');
      // Everything that is not the head becomes the body, in order.
      [...panel.children].filter(n => n !== head).forEach(n => body.append(n));
      panel.append(body);
    }
    const id = panel.id || Math.random().toString(36).slice(2);
    body.id = body.id || `${id}__body`;

    const key = `panel:${id}`;
    let stored = null;
    try { stored = localStorage.getItem(key); } catch (e) { /* private mode */ }
    const open = stored != null
      ? stored === 'open'
      : !(panel.dataset.default === 'closed' || NARROW());

    const btn = el('button', 'panel__toggle');
    btn.type = 'button';
    btn.setAttribute('aria-controls', body.id);
    const paint = v => {
      panel.classList.toggle('is-collapsed', !v);
      body.hidden = !v;
      btn.setAttribute('aria-expanded', String(v));
      btn.title = v ? 'Collapse this panel' : 'Expand this panel';
      btn.textContent = v ? '−' : '+';
    };
    paint(open);
    btn.onclick = () => {
      const now = btn.getAttribute('aria-expanded') !== 'true';
      paint(now);
      try { localStorage.setItem(key, now ? 'open' : 'closed'); } catch (e) { /* ignore */ }
    };
    head.append(btn);
  });
}

/* Open a panel from code — used when something navigates a reader to content
   inside a collapsed box, where leaving it shut would look like a dead link.
   Does not write to localStorage: this is the site's choice, not the
   reader's, and it should not overwrite a preference they set. */
function revealPanel(sel) {
  const panel = typeof sel === 'string' ? $(sel) : sel;
  if (!panel) return;
  const btn = panel.querySelector(':scope > .panel__head > .panel__toggle');
  if (btn && btn.getAttribute('aria-expanded') !== 'true') btn.click();
}

async function boot() {
  // Which products exist is now a question with more than one answer, so the
  // registry is read before any of them. It used to be the other way round —
  // one index.json fetched at a fixed path, the race it described implied by
  // whichever export had run last.
  readUrl();
  await loadRaces();
  const wanted = (state.race && hasProduct(state.race))
    ? state.race
    : db.races.manifest.default_product;
  db.index = await loadProduct(wanted);
  state.race = state.race || wanted;
  // Open on the most recent stage that has been raced, rather than a stage
  // number written into the source. During the race that is the newest thing
  // to look at; after it, the last stage. A hardcoded default would have
  // quietly gone stale the moment stage 20 finished.
  if (!db.index.stages.some(s => s.n === state.stage)) {
    state.stage = defaultStage();
  }
  $('#race-name').textContent = db.index.manifest.race;
  buildRacePicker();
  buildPalette();
  // Before the first render, so a panel that starts closed is closed on the
  // frame it first appears rather than opening and snapping shut.
  wireCollapsibles();
  await renderStage();
  setView(state.view);

  const m = db.index.manifest;
  const attrib = (m.licence_policy.attributed_sources || [])
    .map(a => a.attribution).join(' ');
  // The manifest stamps when the evidence was current, not when the file was
  // written — a wall-clock stamp would make every rebuild a different bundle.
  // The footer read `m.generated_at`, which no longer exists, and had been
  // printing "generated undefined" to every visitor.
  $('#footer').innerHTML =
    `Export <code>${m.export_version}</code> · evidence current to `
  + `${m.evidence_current_to} · `
  + `${m.evidence.artifacts} vaulted artifacts, ${m.evidence.claims} evidence `
  + `claims · ${m.licence_policy.reason} ${attrib}`;

  $('#btn-view-stage').onclick = () => setView('stage');
  $('#btn-view-races').onclick = () => setView('races');
  $('#registers-filter').oninput = e => {
    registerFilter.q = e.target.value;
    renderRegisters().catch(err => console.error(err));
  };

  $('#races-filter').oninput = e => {
    raceFilter.q = e.target.value;
    if (db.races) renderRaces();
  };

  $('#btn-theme').onclick = () => {
    const cur = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = cur === 'dark' ? 'light' : 'dark';
  };
  $('#tgl-strict').onchange = e => {
    state.strict = e.target.checked; writeUrl(); applyStrict();
  };
  $('#tgl-uncertainty').onchange = e => {
    state.uncertainty = e.target.checked; writeUrl(); renderStage();
  };
  $('#wp-filter').oninput = renderWaypoints;
  $('#res-filter').oninput = renderResults;
  $('#gc-filter').oninput = renderGC;
  $('#startlist-filter').oninput = () => {
    const c = db.raceChunks.get(state.race || productSlug());
    if (c) renderStartlist(c);
  };
  $('#race-startlist-filter').oninput = () => {
    const c = db.raceChunks.get(state.race || productSlug());
    if (c) renderRaceStartlist(c);
  };
  $('#btn-palette').onclick = openPalette;
  $('#btn-close-inspector').onclick = () =>
    $('#inspector').classList.remove('is-open');
  $('#palette-input').oninput = e => filterPalette(e.target.value);

  window.addEventListener('hashchange', () => {
    // Our own writes fire this too. Without the guard a pushState during
    // goStage re-entered renderStage on the next tick and drew the stage
    // twice — invisible, and twice the work on every navigation.
    if (suppressHashRoute) return;
    const before = state.stage, beforeView = state.view;
    const beforeRace = state.race;
    readUrl();
    if (state.race !== beforeRace) {
      const sel = $('#race-picker');
      if (sel) sel.value = state.race;
      setView(state.view);
      return;
    }
    if (state.view !== beforeView) setView(state.view);
    if (state.stage !== before) renderStage(); else emitCursor();
  });

  document.addEventListener('keydown', ev => {
    const pal = $('#palette');
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault(); openPalette(); return;
    }
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'i') {
      ev.preventDefault(); $('#inspector').classList.toggle('is-open'); return;
    }
    if (!pal.hidden) {
      const list = $('#palette-list'), hits = list._hits || [];
      if (ev.key === 'Escape') pal.hidden = true;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        paletteSel = Math.max(0, Math.min(hits.length - 1,
          paletteSel + (ev.key === 'ArrowDown' ? 1 : -1)));
        [...list.children].forEach((li, i) =>
          li.setAttribute('aria-selected', i === paletteSel));
        list.children[paletteSel] &&
          list.children[paletteSel].scrollIntoView({ block: 'nearest' });
      }
      if (ev.key === 'Enter' && hits[paletteSel]) {
        hits[paletteSel].run(); pal.hidden = true;
      }
      return;
    }
    if (ev.key === 'Escape') $('#inspector').classList.remove('is-open');
    const p = profile();
    if (ev.key === '[' || ev.key === ']') {
      const i = db.index.stages.findIndex(s => s.n === state.stage);
      const j = Math.max(0, Math.min(db.index.stages.length - 1,
        i + (ev.key === ']' ? 1 : -1)));
      goStage(db.index.stages[j].n);
      return;
    }
    if (!p) return;
    const maxKm = p.km[p.km.length - 1];
    const step = ev.shiftKey ? 5 : 0.5;
    if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      state.km = Math.min(maxKm, (state.km == null ? 0 : state.km) + step);
      emitCursor();
    }
    if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      state.km = Math.max(0, (state.km == null ? maxKm : state.km) - step);
      emitCursor();
    }
  });
}

boot();
