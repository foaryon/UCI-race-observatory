/goal

> **Where the work happens.** This line named
> <https://github.com/foaryon/UCI-race-observatory>, which is the *published
> product* — a static bundle this pipeline deploys into, holding no pipeline,
> no evidence vault and no database. Work happens in the private source
> repository (`foaryon/Uci-race`), on `main`, which is the only branch either
> workflow listens to. Following this line as written would have put a session
> in a repository with nothing in it to change.

Evolve the existing UCI Race Observatory into the most comprehensive,
evidence-led, technically rigorous, visually advanced and analytically useful
professional road-cycling research platform possible.

The product scope is exclusively:

- UCI WorldTour Men
- UCI Women’s WorldTour
- Elite UCI Road World Championships:
  - Men Elite Road Race
  - Women Elite Road Race
  - Men Elite Individual Time Trial
  - Women Elite Individual Time Trial
  - Mixed Relay only when independently and adequately sourced

Do not replace the existing project with a generic greenfield application.
Do not force a generic dashboard, admin interface, visual template or
unrelated design system onto the current repository.
Do not impose a new architecture before understanding the actual codebase.

The existing UCI Race Observatory design is a good foundation. Preserve its
visual identity, premium cycling atmosphere, colour language, typography,
navigation patterns and strong existing components wherever practical.

The task is a deep upgrade of data, evidence, information architecture,
interaction design, analytics, reliability and maintainability—not a generic
visual redesign.

============================================================================
1. ABSOLUTE PRIORITY: MAXIMUM DEPTH FOR EVERY RACE AND STAGE
============================================================================

This is the overriding objective of the entire project:

Achieve the best practically attainable data quality, data reliability, data
coverage, evidence coverage, spatial precision, historical context and
analytical depth for EVERY supported race and EVERY individual stage.

Do not interpret this project as:
- a calendar with attractive but shallow race cards;
- a Tour de France showcase plus minimally covered other races;
- a UI exercise with limited supporting data;
- a first-pass import that stops after a profile appears to work;
- a system that calls coverage complete because dates, winners and basic
  metadata exist.

Interpret it as:

Build the strongest attainable, evidence-backed, stage-level research dataset
for the full target universe:

- every UCI WorldTour Men event;
- every UCI Women’s WorldTour event;
- every eligible Elite UCI Road World Championships event;
- every individual stage of every multi-stage race;
- every one-day race as a complete single route/stage entity.

The Tour de France is the current reference implementation and deepest
showcase case. It must not remain the only deeply researched exception.

The product must continuously pursue maximum practical depth for every target
race and stage: event identity, route, terrain, road surface, weather/wind,
participants, results, classifications, race events, rider/team performance,
historical context, evidence and methodology.

Never optimise for the appearance of broad coverage.
Optimise relentlessly for the highest attainable verified, evidenced and
analytically useful coverage of every race and every stage.

============================================================================
2. PRODUCT ROLE MODELS
============================================================================

Use the following websites as role models for product ambition, information
architecture and usability only:

1. ProCyclingStats
   https://www.procyclingstats.com/

   Learn from:
   - race/stage database breadth;
   - calendar and season navigation;
   - fast filters and dense information retrieval;
   - relationships between races, editions, stages, riders, teams, results
     and classifications;
   - historical comparison and discovery.

2. FirstCycling
   https://firstcycling.com/

   Learn from:
   - clear race, rider, team and result navigation;
   - concise mobile-friendly information hierarchy;
   - practical browsing of calendars, results and event pages.

3. La Flamme Rouge
   https://www.la-flamme-rouge.eu/

   Learn from:
   - cycling-specific route storytelling;
   - stage-profile-first thinking;
   - communicating terrain, route intent and decisive course features.

Do not copy or replicate:
- any third-party database;
- HTML, CSS, JavaScript or visual identity;
- route geometry, GPX files, profile graphics, charts, images, maps, logos,
  editorial prose, ratings, labels or proprietary metrics.

The intended Observatory combines:
- the navigational breadth and discoverability associated with ProCyclingStats;
- the practical clarity associated with FirstCycling;
- the route storytelling ambition associated with La Flamme Rouge;
- materially stronger provenance, uncertainty, spatial analysis and
  reproducibility than conventional cycling databases.

Core product promise:

“If the Observatory shows a fact, it can show the evidence.
If it shows a reconstructed route, it can show how it was reconstructed.
If it shows a derived metric, it can show its method and assumptions.
If data is unavailable, it says so clearly instead of simulating depth.”

============================================================================
3. REPOSITORY-FIRST IMPLEMENTATION
============================================================================

Before making broad changes, fully inspect the actual repository and deployed
website.

Create:

- docs/REPOSITORY_AUDIT.md
- docs/IMPLEMENTATION_PLAN.md
- docs/COMPATIBILITY_MATRIX.md
- docs/TOUR_CONTENT_AUDIT.md
- docs/ARCHITECTURE.md
- docs/DATA_DICTIONARY.md
- docs/DATA_SOURCES.md
- docs/QUALITY_MODEL.md
- docs/RESEARCH_BACKLOG.md

The repository audit must identify:

A. Existing technical structure
- framework/no-framework setup;
- application entry points;
- static pages and routes;
- GitHub Pages deployment configuration;
- build and local-development commands;
- JavaScript, CSS and asset conventions;
- reusable components and design patterns;
- data locations, schemas and generated data;
- scripts, imports, fetches and build steps;
- tests, linting, formatting and CI configuration.

B. Existing product behaviour
- every current page;
- filters, maps, charts, interactions and route behaviour;
- Tour de France-specific views;
- mobile/responsive behaviour;
- existing URLs and navigation that must continue to work.

C. Existing content/data inventory
- every data file;
- every field currently displayed;
- every map, profile, chart and image;
- every current source reference;
- every unsupported, duplicated, stale, unclear or cluttered element.

D. Migration strategy
- files to extend, refactor, retain, relocate, deprecate or remove;
- public URLs that must remain compatible;
- exact regression risks;
- data migration path;
- which current components can become reusable, data-contract-driven modules.

Do not start broad implementation before these audits and plans exist.

Implementation rules:
- Preserve the existing deployed GitHub Pages URL.
- Preserve public URLs and navigation wherever practical.
- Add redirects or compatibility handling if a path must change.
- Extend the repository’s established conventions rather than forcing a
  speculative ideal folder structure.
- Create top-level folders only when genuinely necessary and documented.
- Preserve useful existing Tour data; do not delete it merely because other
  races initially have lower coverage.

============================================================================
4. DESIGN PRESERVATION AND CONTENT CLEANUP
============================================================================

The existing visual design is fundamentally good and should remain recognisable.

Preserve where practical:
- colour language;
- typography;
- premium cycling atmosphere;
- existing header/navigation approach;
- visual personality;
- strong card/layout patterns;
- good interactive details;
- responsive behaviour.

The current issue is not insufficient ambition. It is that the existing
Tour-de-France-heavy experience mixes:
- genuinely valuable source-backed information;
- fields unavailable at equivalent quality for other races;
- content with unclear provenance;
- repeated facts;
- modules rendered because the page layout permits them, not because coverage
  supports them;
- high visual density without enough hierarchy or progressive disclosure.

Fix this without flattening the site’s identity.

Do not remove useful Tour data simply because it is Tour-specific. Instead:
- retain verified, well-sourced, useful material;
- relocate stage-level material away from overloaded race-level views;
- convert reusable content into components with explicit data contracts;
- remove, hide or quarantine unsupported, duplicated, irrelevant or unclear
  data;
- only render a component when the corresponding data contract is fulfilled;
- let races have unequal data depth while ensuring each feels intentional,
  premium and complete at its actual coverage level.

The desired experience:
- a newly announced race has an excellent minimal Race Card;
- a well-sourced event has a deep Stage Digital Twin;
- the strongest events have route, terrain, wind/weather, result and
  performance reconstruction;
- no page contains empty grids, fake depth, repeated metadata, placeholder
  charts, giant N/A blocks or unsupported claims.

============================================================================
5. TOUR DE FRANCE FORENSIC AUDIT
============================================================================

Before generalising or expanding the platform, audit the current Tour de France
content field by field and component by component.

For every currently visible Tour item, record:
- page/component location;
- exact displayed field, chart, map, image or profile;
- current source or missing source;
- type: official, observed, reported, open-licensed, commercial reference,
  reconstructed, derived, modelled or unknown;
- evidence/reliability status;
- public eligibility;
- duplication, staleness and clutter assessment;
- decision: retain, relocate, refactor, hide, quarantine, replace or remove;
- required race/stage coverage level;
- replacement/acquisition path where relevant.

Rules:
- Retain verified and useful Tour-specific depth.
- Relocate deep stage data that currently overloads race pages.
- Refactor valuable components into reusable data-driven modules.
- Hide/remove unsupported data, repeated data, decorative pseudo-metrics and
  empty modules.
- Document every decision; never silently discard content.
- Never invent replacement data.

============================================================================
6. MAXIMUM DEFENSIBLE DATA ACQUISITION
============================================================================

Operate at the maximum technically and legally defensible boundary of public
research and data engineering.

Be persistent, resourceful and systematic in finding the best available
information and data for every target race/stage.

Use:
- UCI calendar and result references;
- official race organisers;
- official race guides, technical guides, roadbooks and regulations;
- official route/stage pages;
- official result documents and classifications;
- host-city, regional and tourism sources;
- public archives;
- broadcaster and public event communications;
- eligible open geospatial, elevation and weather datasets;
- credible specialist cycling sites for discovery, comparison, corroboration
  and research leads;
- independent reconstruction and transparent calculation where primary sources
  are incomplete.

Do not:
- bypass paywalls, subscriptions, logins, rate limits, robots restrictions,
  technical controls or access restrictions;
- mirror, bulk replicate or make a substitute for a commercial database;
- rehost third-party route profiles, charts, GPX, route geometry, images,
  editorial text, logos, photos or proprietary metrics without valid rights;
- use private storage to evade source restrictions;
- invent, silently interpolate or fabricate data.

Classify every source and asset:

GREEN — explicitly approved/open/authorised
- Ingest, version, transform and publish with required attribution.

AMBER — public factual research and verification
- Extract only atomic factual claims necessary for research/product needs.
- Record publisher, URL, access time, content hash, field mapping, confidence
  and corroboration notes.
- Use as evidence or research leads.
- Do not mirror databases, copy expressive assets or recreate a commercial
  dataset through repeated systematic extraction.
- Public output must use our own data structure, wording, visuals and
  independently generated analytics.

RED — restricted or unsuitable
- Store reference metadata only.
- Seek an alternate official/open/licensed source or independent
  reconstruction.
- Never bypass restrictions or publish prohibited derivatives.

============================================================================
7. COMPLETE DATA UNIVERSE
============================================================================

For every target race and stage, investigate, acquire, validate, derive and
quality-score every realistically obtainable domain.

A. Event identity and governance
- official name, aliases, sponsor-name history, edition, season, UCI class;
- series, organiser/promoter/governing body;
- official race/UCI/results/technical-guide/live-tracking links;
- event status, postponements, cancellations and schedule revisions;
- primary source records and publication/update history.

B. Calendar and timing
- start/end dates, local times, time zones;
- stage dates, stage starts, schedules and time limits where available;
- rest days, programme timing and documented amendments;
- historical edition dates and calendar position.

C. Geography and geometry
- countries, regions, municipalities;
- start, finish, neutral-zone, checkpoint and intermediate coordinates;
- route geometry, route versions, circuits and alternatives;
- official vs reconstructed geometry status;
- GPX/GeoJSON provenance;
- kilometre markers and distance calibration;
- sprints, KOM/QOM, feed zones, finish circuits, cobbled/gravel/technical
  sectors and decisive route features;
- route accuracy, continuity, confidence and known deviations.

D. Stage and route facts
- stage number/title/type;
- official distance and independently calculated geometry distance;
- start/finish towns, venues and altitude;
- neutralised/racing distance;
- route modifications, shortenings, diversions and contingencies;
- official checkpoints and timing points;
- stage-level official documents and technical references.

E. Terrain and profile
- distance-calibrated elevation series;
- elevation source, DEM/version/resolution and processing timestamp;
- total ascent/descent with documented calculation method;
- grade distribution and grade-distance breakdown;
- climbs/descents/rolling/flat segmentation;
- climb length, gain, mean/max grade, altitude and route kilometre;
- official climb/category/name when sourced;
- internally detected climbs when derived;
- descents, false flats, valleys, plateaus, ridges and high-altitude terrain;
- profile resolution and uncertainty metadata.

F. Surface and course character
- road class, width where support exists;
- cobbles, gravel, dirt, pavé and unpaved sections;
- sector geometry, length, surface classification and confidence;
- corners, circuits, bridges, tunnels, coastal exposure, urban sections;
- verified hazards and roadworks.

G. Weather and wind
- eligible observations, reanalysis and/or model data;
- temperature, precipitation, humidity, pressure, cloud, wind speed/gusts/
  direction;
- route/time alignment and interpolation;
- headwind/tailwind/crosswind exposure;
- source, spatial resolution, temporal resolution and uncertainty;
- actual weather distinct from forecast and climatology.

H. Participants, teams and race context
- official start lists;
- team roster, rider number, nationality, status and role where supported;
- DNS, DNF, OTL, DSQ, withdrawals and replacements;
- team category/season context;
- rider bio/performance fields only when appropriately sourced;
- equipment data only where public, race-specific and substantiated;
- no rumours/speculation treated as facts.

I. Results, classifications and race events
- stage result and general classification;
- points, mountains, youth and team classifications;
- intermediate sprint/KOM/QOM results;
- time gaps, bonuses, penalties, time limits and corrections;
- classification snapshots after every stage;
- incidents, neutralisations, interruptions and official rulings;
- correction/version history.

J. Performance and race dynamics
- verified timing splits and route-position-linked gaps;
- speed by stage, climb or verified segment;
- climbing speed, VAM and pacing;
- breakaway distance/duration/group composition where supported;
- terrain-aware rider/team analysis;
- GC changes and time gained/lost by stage/route zone;
- reproducible calculations only;
- estimates clearly labelled and expressed as ranges with assumptions.

K. Historical/comparative context
- edition history and route evolution;
- prior editions and comparable stages;
- repeat climbs, sectors and course records;
- stage-type comparison across season/history;
- Men/Women comparisons only when fair, meaningful and contextually sound;
- historical weather/terrain/performance comparisons with limits stated.

L. Evidence, provenance and quality
- source URL, publisher, source type, access date and content hash;
- licence/terms and public/private eligibility;
- exact field-to-source mapping;
- corroboration count, conflicts and resolution rationale;
- official/observed/reported/reconstructed/derived/modelled status;
- confidence, uncertainty, limitations, refresh schedule and last audit date.

============================================================================
8. DATA DICTIONARY AND CYCLING ONTOLOGY
============================================================================

Maintain versioned, machine-readable and human-readable data dictionaries.

For every entity, relationship, field, unit and code list define:
- canonical name;
- human description;
- data type and unit;
- allowed values;
- null/missing semantics;
- source expectation;
- temporal validity;
- geometry/distance-axis linkage;
- whether official, observed, reconstructed, derived or modelled;
- calculation eligibility;
- public eligibility;
- validation rules;
- examples.

Define canonical entities and relationships at minimum:

- Race
- RaceEdition
- Stage
- RouteVersion
- RouteSegment
- RouteFeature
- Climb
- Descent
- SurfaceSector
- Checkpoint
- Sprint
- KOM/QOM
- Organisation
- Series
- Team
- Rider
- StartListEntry
- Result
- ClassificationSnapshot
- TimeSplit
- RaceEvent
- WeatherObservation
- WindSegment
- PerformanceMetric
- SourceAsset
- EvidenceClaim
- TransformationRun
- DerivedOutput
- CoverageAssessment
- QualityIncident
- ResearchTask

The dictionary is the contract between acquisition, storage, processing,
analytics, UI and testing. No undocumented one-off fields or semantics.

============================================================================
9. FIELD-LEVEL PROVENANCE
============================================================================

Implement a field-level provenance model inspired by standard provenance
principles.

For every significant fact, geometry, derived output and modelled estimate,
retain:

- entity/field identifier;
- value and unit;
- type: official | observed | reported | reconstructed | derived | modelled;
- source asset IDs;
- publisher/owner and source URL;
- access/retrieval date;
- source version/content hash where captured;
- licence/rights and public eligibility;
- transformation run and pipeline version;
- input asset IDs and parameters;
- temporal/spatial scope;
- confidence;
- uncertainty/range;
- conflicts;
- known limitations;
- reviewer/audit record.

No source -> no asserted fact.
No geometry -> no route map/profile.
No documented method -> no derived metric.
No uncertainty statement -> no fake precision.

============================================================================
10. DATA VERSIONING, CORRECTIONS AND REPRODUCIBILITY
============================================================================

Treat all data as versioned research records, not overwriteable web fields.

Requirements:
- immutable raw/source snapshots where permitted;
- source acquisition timestamp, hash, source version and import-run ID;
- semantic versioning for schema and calculation pipelines;
- versioned route geometry: no silent overwrites of corrected routes;
- versioned results and classifications: retain original, corrections,
  penalties, disqualifications and correction dates;
- reproducible build manifest per published race/stage release;
- manifest must include input source IDs/hashes, code commit, pipeline version,
  parameters, environment and output hashes;
- ability to rebuild a historical published race/stage view from its manifest;
- human-readable per-race/stage changelog: what changed, why, source evidence,
  affected metrics and date;
- data-diff UI for material route/result/classification revisions;
- dependency tracking: recalculation of all dependent outputs after a source
  correction.

Never silently alter a published fact, geometry, profile, result, score or
analytical conclusion.

============================================================================
11. CANONICAL ROUTE DISTANCE AXIS
============================================================================

Every route-dependent data item must join to one canonical, direction-aware
route axis measured from the official race start.

Each stage geometry must support:
- monotonic `distance_m` from start to finish;
- calibrated official distance and independently measured geometry distance;
- route version;
- segment bearing/direction;
- latitude, longitude and elevation at sampled points;
- segment ID and route-feature membership;
- alignment/uncertainty metadata.

Map all applicable layers to this axis:
- elevation and gradient;
- climbs and descents;
- surface sectors;
- wind/weather;
- checkpoints, sprints and KOM/QOM;
- results, gaps and splits;
- incidents/race events;
- rider/team performance overlays.

Every mapped event must retain:
- route-distance point/range;
- mapping method;
- positional error estimate;
- source/reference;
- confidence.

If a feature cannot be aligned defensibly, retain it as an unmapped factual
record. Never manufacture exact route placement.

============================================================================
12. MEASURED COVERAGE, QUALITY AND RESEARCH BACKLOG
============================================================================

Coverage must be measured, not assumed.

Generate machine-readable coverage and quality records for every race/stage.

Track:
- raw field coverage;
- provenance/evidence coverage;
- primary/corroborated-source coverage;
- analytical readiness;
- route geometry coverage;
- terrain/profile coverage;
- result/classification coverage;
- weather/wind coverage;
- performance-analysis coverage;
- spatial route coverage;
- confidence-weighted completeness;
- active research gaps and next acquisition actions.

Every field/domain must report:
- unavailable | partial | complete;
- none | single-source | corroborated | primary/official;
- official | observed | reported | reconstructed | derived | modelled;
- low | medium | high confidence;
- rights/public eligibility;
- spatial and temporal precision where relevant;
- last verified date;
- next concrete research action.

Generate:

1. Raw field coverage percentage.
2. Evidence coverage percentage.
3. Primary/corroborated evidence percentage.
4. Analytical-readiness score.
5. Spatial-coverage percentage across route distance.
6. Stage-completeness score across all domains.
7. Race-completeness score weighted across all stages.
8. Confidence-weighted coverage score.

Never let rich final-stage coverage hide missing early-stage coverage.

For every missing high-value field:
1. Search primary official sources.
2. Search organiser technical documents/roadbooks/route pages.
3. Search UCI references.
4. Search credible public sources for leads/corroboration.
5. Search eligible open data and archives.
6. Independently reconstruct/derive where methodologically valid.
7. Record search actions, gap, next action and recheck date.
8. Mark `research-exhausted` only after defensible documented exhaustion.

A field may be marked `research-exhausted` only after:
- primary source search;
- organiser/UCI/technical-material search;
- eligible open-data alternative search;
- reconstruction assessment;
- negative findings and dates recorded;
- future review trigger assigned.

============================================================================
13. CONFLICT, ANOMALY AND QUALITY-INCIDENT MANAGEMENT
============================================================================

Treat conflicting sources as research signals, never as values to silently
overwrite.

For each conflict:
- retain competing claims and their sources;
- classify: date, distance, geometry, elevation, result, classification,
  rider/team, weather, timing or event location;
- status: unresolved | provisional-preferred | resolved-primary-source;
- document resolution rationale and reviewer/pipeline version;
- retain alternatives in evidence records;
- trigger dependent recalculations after resolution.

Implement automated anomaly checks for:
- impossible route jumps;
- non-monotonic route distance;
- invalid elevation spikes;
- inconsistent stage distances;
- duplicate riders/results;
- impossible time gaps/classification totals;
- weather outside plausible bounds;
- coordinates outside expected geography;
- unsupported precision;
- stale source data;
- source/provenance mismatch;
- data leakage from private/restricted partitions.

No anomaly may be silently hidden. It must be fixed, explicitly accepted with
reason, or exposed as uncertainty.

============================================================================
14. STAGE DIGITAL TWIN PIPELINE
============================================================================

For every stage with sufficient source support, create a distance-calibrated,
evidence-versioned Stage Digital Twin.

Pipeline:

1. Collect verified event/stage facts.
2. Obtain permitted official geometry or independently reconstruct route
   geometry from allowed public facts and open mapping data.
3. Label route status precisely: official | reconstructed | approximate.
4. Validate start/finish, checkpoints, continuity and road plausibility.
5. Calibrate geometry against verified official distance and checkpoints.
6. Record distance deviation/alignment uncertainty.
7. Sample documented elevation data.
8. Generate distance/elevation/gradient series.
9. Detect/segment climbs, descents, terrain zones and route features with
   versioned algorithms.
10. Add weather/wind, results, splits and performance layers only if their
    prerequisite data contracts are fulfilled.
11. Publish map/profile/analysis with source, method, quality and limitations.

Never represent independently reconstructed geometry as organiser-provided GPX.

============================================================================
15. MODERN ROUTE, PROFILE AND CLIMB EXPERIENCE
============================================================================

Do not use static, poorly cropped elevation-profile images, screenshot-like
route cards, fixed profile thumbnails or generic climb image strips as the
main route experience.

The route profile must be a first-class analytical interface.

For every L2+ stage, build a modern, intelligent, interactive Stage Profile
Studio / Stage Digital Twin.

Core linked interaction:
- full-width, responsive, high-resolution profile generated from actual route
  and elevation data;
- synchronized route map, profile and canonical distance cursor;
- hover, mouse, keyboard, touch drag, click and tap update all linked surfaces;
- show current route position, distance, elevation, instantaneous/smoothed
  grade, cumulative ascent/descent, terrain type, route feature, weather/wind
  context and verified race context where available;
- map click/tap moves profile cursor to matching route distance;
- profile click/drag moves map marker and active route segment;
- selecting climbs, descents, sectors, sprints, feed zones, time checks,
  circuits or decisive segments highlights/zooms corresponding map/profile
  ranges;
- full keyboard operation and full touch support;
- no important interaction may depend exclusively on hover.

Profile requirements:
- render from project-generated distance/elevation data through a modern
  vector/canvas/WebGL solution, never copied profile artwork;
- adaptive sampling/level of detail for long Grand Tour stages;
- zoom, pan, range selection, reset, full-stage and selected-segment modes;
- vertical distance cursor and contextual tooltip;
- accessible grade/terrain/surface encoding: never colour alone;
- clear axes, units, legends, smoothing and aggregation rules;
- distinguish official climb categories/names from internally derived climbs;
- show source, processing method, elevation resolution and uncertainty through
  a compact details panel.

Climb intelligence:
- climbs are spatial, route-linked analytical objects—not cropped image strips;
- model each climb with:
  - start/end geometry;
  - route-kilometre range;
  - distance;
  - elevation gain;
  - mean/max grade;
  - altitude;
  - approach/descent context;
  - official name/category where sourced;
  - derived-climb identifier where computed;
  - linked profile/map segment;
  - source, method, confidence and limitations.
- display a modern expandable analytical card connected to the live map/profile;
- compare mode:
  - climb vs climb;
  - climb vs prior editions;
  - Men/Women route variants where comparability exists;
  - results/performance overlay only where valid data supports it;
- show climb-difficulty scoring only through transparent multi-factor models.

Map requirements:
- use a modern GPU/WebGL map implementation compatible with the existing
  stack, such as MapLibre GL JS where suitable;
- comply with tile/data licences and attribution;
- render route as data-driven layers:
  - active segment;
  - selected range;
  - grade/surface/terrain overlays;
  - route features/checkpoints;
  - climb boundaries;
  - kilometre markers;
  - wind-exposure overlays;
  - verified race-event/performance layers.
- 2D is default analytical mode;
- optional 3D terrain/hillshade only when useful, performant and non-obscuring;
- never use decorative 3D at the expense of route/profile precision or mobile UX.

Responsive behaviour:
- desktop: coordinated map/profile studio;
- tablet: adaptable stacked panels retaining shared cursor;
- mobile: profile-first exploration, touch-friendly controls, map/details in
  bottom sheet or equivalent, no loss of core analytical functions.

============================================================================
16. WIND EXPOSURE AND ROUTE-AERODYNAMICS MODEL
============================================================================

Wind is a first-class Stage Digital Twin layer, not a generic weather widget.

For each valid route segment:
- derive route bearing/direction;
- attach time-aligned wind speed, gusts and direction;
- calculate headwind, tailwind and crosswind components;
- preserve weather source, model/observation/reanalysis type, spatial
  resolution, temporal resolution and alignment offsets;
- distinguish actual observations, reanalysis, forecast archive and model data;
- show uncertainty rather than unsupported point-precise claims.

Support:
- full-stage wind-exposure profile;
- synchronized map/profile colour layers for headwind/crosswind/tailwind;
- segment-level exposure analysis;
- exposed routes, coast, valleys, ridges, bridges and open plains where
  geographic evidence supports the classification;
- race-time scenario ranges when peloton pass time is uncertain;
- comparable stage/edition analyses only with compatible methods/data.

Never state that wind caused a race outcome unless verified evidence supports
a causal claim. Display spatial-temporal correlation and labelled analytical
hypotheses only.

============================================================================
17. PERFORMANCE CALCULATION FIREWALL
============================================================================

No performance calculation may enter the UI without explicit calculation
eligibility.

Every input must be classified:

- VERIFIED:
  race-time-relevant, sourced and sufficiently precise.

- CORROBORATED_RANGE:
  multiple credible sources create a defensible range.

- USER_SCENARIO:
  user-selected assumption; never presented as observation.

- UNKNOWN:
  insufficiently evidenced; not eligible for numerical computation.

Mandatory policy:
- unverified rider mass must never produce one exact W/kg or watt number;
- generic rider-profile weight must not be assumed to be race-day mass;
- mass-dependent calculations must use verified inputs or uncertainty ranges;
- modelled values must show ranges and sensitivity analysis;
- never display calculated power as measured power;
- never infer private biometric, medical or physiological data;
- support explicit “not calculable” states;
- preserve data-time validity for rider metrics.

Every analytical card must display:
- observed | derived | modelled status;
- evidence confidence;
- input completeness;
- uncertainty range;
- source/method drawer;
- equation/model version and input IDs where relevant.

============================================================================
18. COVERAGE-DRIVEN COMPONENT RULES
============================================================================

Every UI component must declare a minimum data contract.

Examples:

Race header:
- L0: race identity, season, series, Men/Women, date and official reference.

Stage grid:
- L1: confirmed stage list and essential stage metadata.

Interactive route map:
- L2: valid route geometry, provenance, status and quality data.

Elevation profile:
- L2: calibrated geometry plus documented elevation input/method.

Climb/terrain studio:
- L3: validated profile, segmentation algorithm, method/version and limits.

Results/classifications:
- verified eligible result data, source and verification date.

Weather/wind:
- eligible source plus spatial/temporal alignment metadata.

Performance:
- evidence-supported inputs, calculation eligibility and uncertainty model.

If a component contract is not met:
- omit it rather than rendering blank/disabled/placeholder content;
- optionally expose its absence only in a concise coverage matrix;
- add missing prerequisites to the acquisition backlog.

============================================================================
19. PAGE HIERARCHY AND PROGRESSIVE DISCLOSURE
============================================================================

Race page:
1. Existing-style visual identity/hero.
2. Compact verified facts: dates, series, UCI class, Men/Women, location.
3. Coverage badge and concise availability summary.
4. Stage grid or one-day race overview.
5. Relevant season/historical context.
6. Supported high-value modules only.
7. Compact source/method entry point.

Stage page:
1. Stage identity and essential verified facts.
2. Stage Digital Twin map/profile studio where L2+.
3. Terrain/climb analysis where L3+.
4. Results/race story where verified.
5. Conditions/wind where supported.
6. Performance where supported.
7. Source/method/uncertainty panel.

Use progressive disclosure:
- essential facts first;
- deep analysis through intentional interaction;
- provenance always reachable but not visually dominant;
- no duplicated information across race and stage views;
- no giant technical dumps on default page load.

============================================================================
20. VISUALISATION INTEGRITY, ACCESSIBILITY AND EXPORT
============================================================================

All visualisations must be analytically honest, accessible and exportable.

Requirements:
- clear axes, units, legends, colour scales, smoothing and missing-data
  treatment;
- no misleading truncated axes or unlabeled vertical exaggeration;
- provide distinct “analysis scale” and “route-story scale” when vertical
  exaggeration is useful; label both;
- keyboard navigation, focus states, text alternatives and reduced-motion
  support for profile/map interactions;
- patterns/labels/accessible legends in addition to colour;
- export eligible project-owned/public outputs:
  - CSV;
  - GeoJSON;
  - profile summary;
  - PNG/SVG/PDF charts;
  - citations/provenance bundle;
  - reproducible analysis manifest.
- Apply source/right/public-eligibility gates to every export.

============================================================================
21. DATA ORGANISATION AND PUBLICATION BOUNDARIES
============================================================================

Fit the final data layout into the repository’s existing structure after audit.

Required logical layers:
- canonical race/stage data;
- source registry;
- field-level provenance;
- coverage/quality records;
- public-approved geometry;
- public-approved derived terrain/weather/performance;
- internal research/reference metadata excluded from deployment.

Every race/stage needs:
- canonical record;
- coverage record;
- provenance/source record;
- data-quality record;
- acquisition backlog;
- build/reproducibility manifest where published.

Every field must include where applicable:
- value and unit;
- status/type;
- source IDs;
- confidence;
- rights/public eligibility;
- method/version for reconstructed/derived/modelled fields;
- assumptions and limitations.

The public build must include public-approved material only.

Never leak private/restricted/reference-only content through:
- deployed assets;
- static bundles;
- search indexes;
- source maps;
- logs;
- generated charts;
- tests/fixtures;
- screenshots;
- public Git history.

============================================================================
22. SECURITY, SECRETS AND OPERATIONAL RESILIENCE
============================================================================

- Never commit API keys, credentials, session tokens or private source assets.
- Store secrets only in secure local or CI secret management.
- Sanitise imported text/HTML; never render third-party HTML directly.
- Rate-limit/cache permitted requests; imports must be resumable and idempotent.
- Use retry/backoff and keep a failure ledger.
- Keep data-acquisition logs separate from public artefacts.
- Back up permitted raw sources, canonical data, outputs and manifests.
- Test disaster recovery by rebuilding a selected season/stage from approved
  snapshots/manifests.
- Maintain dependency inventory plus licence/security scanning for shipped code.
- Enforce CI controls that prevent restricted/private data entering production.

============================================================================
23. QUALITY GATES AND TESTING
============================================================================

Before publishing data or enabling any UI component:

- validate schema and referential integrity;
- validate provenance and public eligibility;
- validate source classification/attribution;
- validate coverage level and component contract;
- validate geometry continuity/start/finish/checkpoint alignment;
- validate route-distance deviation;
- validate elevation-processing configuration;
- validate calculation reproducibility;
- test map/profile cursor synchronisation;
- test mouse, keyboard, touch and mobile interaction;
- run unit, integration, end-to-end, visual-regression and accessibility tests;
- confirm no private/restricted material enters public output;
- generate data-quality and coverage reports.

Fail build/deployment when:
- a displayed field lacks provenance;
- public asset lacks approved eligibility;
- derived metric lacks method/version;
- component lacks required data contract;
- required attribution is missing;
- a profile/map/chart uses unsupported input data;
- private/restricted material occurs in a public artefact;
- quality incident remains unreviewed.

============================================================================
24. RESEARCH PRIORITISATION AND EXECUTION
============================================================================

Work autonomously and persistently.

Continuously prioritise work across every race/stage using:

priority =
  coverage_gap
  × analytical_value
  × event_importance
  × source_availability_likelihood
  × reproducibility_value
  ÷ estimated_effort

Prioritise:
- stages lacking route geometry;
- geometry with no defensible elevation/profile;
- under-covered Women’s WorldTour events;
- Road World Championships events;
- events with high-quality technical material;
- features unlocking multiple modules;
- conflicts affecting many downstream metrics;
- gaps that block the canonical distance axis.

Do not over-polish one rich event while equivalent high-value races remain
under-researched.

Continue autonomously through source discovery, qualification, acquisition,
modelling, implementation, testing, debugging, documentation and coverage
expansion.

Escalate only when genuinely required:
- paid source/licence decision;
- authentication/credential ownership;
- written permission requirement;
- high-risk ambiguous reuse decision;
- irreversible deletion;
- true product-priority conflict.

Otherwise, continue.

============================================================================
25. EXECUTION PHASES
============================================================================

Phase 0 — Repository and Tour audit
- Inspect existing codebase and deployed site.
- Create all audit/compatibility/content documents.
- Inventory data and visually displayed elements.
- Do not perform broad changes before documenting baseline.

Phase 1 — Evidence/data foundation
- Implement source registry, provenance, data dictionary, coverage model,
  quality incidents, versioning, research backlogs and CI gates within the
  existing repository structure.

Phase 2 — Design-preserving cleanup
- Refactor the Tour-heavy experience through progressive disclosure.
- Retain verified depth and visual identity.
- Relocate/refactor useful content.
- Hide/remove unsupported clutter.

Phase 3 — Complete L0/L1 target-universe coverage
- Create verified Race Cards for all scope events.
- Create structured stage coverage for all confirmed stage races.
- Ensure all Women’s and Men’s target events are first-class entities.

Phase 4 — Systematic L2/L3 Stage Digital Twin expansion
- Research all races/stages toward route geometry, calibrated profiles,
  interactive terrain/climb models and wind/weather context.
- Prioritise rich sources first without abandoning weakly covered events.
- Maintain active research backlogs for every coverage gap.

Phase 5 — L4 results and performance reconstruction
- Add eligible results, classifications, timing, race dynamics and
  terrain-aware performance analysis.
- Use only supported inputs and transparent ranges/models.

Phase 6 — Continuous verification and release management
- Re-check sources, resolve conflicts, rebuild derived data after corrections,
  publish coverage deltas and maintain a clear acquisition roadmap.

============================================================================
26. COMPLETION STANDARD
============================================================================

The project can be complete only at a named release level, never in an
absolute sense.

Every release must publish:
- scope/date;
- measurable coverage metrics;
- confidence/evidence distribution;
- unresolved conflicts;
- research-exhausted fields;
- source refresh schedule;
- next highest-value acquisition tasks;
- reproducibility/build manifest.

The definition of done is not:
“every page renders.”

The definition of done is:
“every target race and stage has been researched to the maximum practical
depth; its coverage is measured; every enabled module is evidence-backed,
reproducible and honest about uncertainty; and every remaining gap has a
documented research status and next action.”

Final principle:

The Observatory must be maximally comprehensive without becoming deceptive.

If we know it, show evidence.
If we reconstructed it, show route and method.
If we derived it, show calculation and limits.
If we modelled it, show uncertainty and assumptions.
If it is unavailable, show the gap and keep searching.
