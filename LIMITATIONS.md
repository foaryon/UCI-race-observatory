# Known gaps and limitations

Every entry here is also visible inside the product, at the point where the
data would otherwise appear.

## Data the project cannot lawfully obtain

**Points, mountains, youth and team classifications beyond the top ten.**
letour.fr serves these tables only from robots-disallowed `/ajax` paths. A
CC BY-SA fallback supplies the top ten with its authority downgrade shown.
They are *not* derived, because they depend on intermediate-sprint and KOM
placings that no reachable page publishes — deriving them would mean
inventing the inputs. The general classification, which depends only on data
we hold, is derived in full instead.

**Race-dynamics gap record (§5.13).** Live time-gap and group feeds sit
behind the same disallowed paths. Registered as `ACCESS_RESTRICTED`.

**ProCyclingStats and FirstCycling.** Both serve a bot challenge on
`robots.txt` itself. Bypassing a technical protection is prohibited, so
neither is used.

**Rider physiology, mass, power.** Out of scope by policy (§3.4), not by
availability.

**Road surface, width and lane count along the route.** OpenStreetMap is the
only realistic free source, and its Overpass query service disallows `/api/`
in robots.txt, so it is not used. The data itself is ODbL and redistributable
— the restriction is on this access method, not the data — and a bulk extract
would be a lawful alternative this project has not implemented. Partial cover
now comes from the organiser directly: its finish-line siting notes give
carriageway width for 17 stages and final-straight length for 16. Those
describe the finish only, and no road attribute is claimed anywhere else.

## Data that exists but is not trustworthy

**Stage 9 route geometry.** Two independent sources describe a superseded
185.5 km course; the stage was 154.6 km. Its published KM0 and finish match
the current start and finish towns, so those two coordinates are kept — but
the course between them was shortened and no trustworthy line exists to
measure along, so no profile is shown and the stage's course points carry no
kilometre.

**Stages 2 and 21: circuits drawn once.** Both feature a finishing circuit
ridden more than once — Montjuïc on stage 2, the Butte Montmartre on stage 21
— but the published line draws each lap a single time, so it measures 143 km
against an official 168.5 and 58 km against the 132.5 then published. A route
offset cannot be mapped to a position on such a line, so it is not used as a
distance axis. Stage 2 falls back to a third-party trace. Stage 21 has no
fallback left: its course was withdrawn entirely on 25 July, and the shortfall
recorded against it is now measured against the amended 89 km.

**Stage 14 official geometry.** Published as 395 parts: one continuous
156 km line plus 394 fragments totalling 8.5 km that sit away from it. The
fragments meet at junctions where more than one continuation is possible, so
no unique order exists. Testing the long part on its own is decisive — walking
the official distance backwards from the published finish lands 8.8 km from
the published KM0, so the long part is not the whole route either. The stage
falls back to a third-party trace.

**Stage 1 has no published finish point.** The organiser's point layer carries
KM0 for all 21 stages but a finish for 20; the Barcelona team time trial
starts and finishes in the same place. Its line is oriented from KM0 instead.

## Resolved

**Stages 3, 4 and 5 now have an independent cross-check.** Their third-party
traces had returned 404 on every run since the first, because the URLs were
built from a filename pattern and the publisher names those three files
`-course.gpx`, not `-parcours.gpx`. The URLs now come from the publisher's own
stage pages, captured alongside them. All three agree with the organiser's
line and its published distance to within 0.1 km, and 11 climbs are detected
on stages 3 and 4 that nothing measured before. Every stage but 9 and 21 now
carries at least one usable line, and 19 of 21 carry two.

**A publisher's index is authoritative about what it contains and silent
about what it does not.** Ten races carried a `CYCLINGSTAGE_PAGE` probe — a
landing page on cyclingstage.com while none of that site's four 2026 GPX index
pages (`/gpx-2026-pro-cycling-races`, `/giro-2026-gpx`,
`/tour-de-france-2026-gpx`, `/vuelta-2026-gpx`) names the race. The ladder read
that as "a page, but no trace", and for one of the ten it was wrong.

The Tour Down Under publishes a GPX for each of its six stages, written into
the prose of that stage's own route page and listed on no index anywhere on the
site. Read on 2026-08-08: five fetch, and stage 2 returns HTTP 404 from the
publisher. Three stages pass the length gate and are published; stages 1 and 3
disagree with the official distance by 3.69 % and 10.65 % and are quarantined.
That is the 35th race with published geometry, from a rung that had been
recorded as exhausted.

The same reading was applied to the other nine, which is what makes this a
finished rung rather than a lucky find. Tour de Romandie, La Vuelta Femenina
and Clásica de San Sebastián have route pages; all three were fetched and carry
no GPX and no download of any kind. The remaining five link nothing but an
archive year and a winners list — cyclingstage has not routed them yet. Those
three negatives are stored as `CYCLINGSTAGE_STAGE_NO_TRACE`, deliberately not
as `NOTHING_FOUND`, because a register with no word for "somebody looked and
there is nothing" cannot tell a finished rung from a skipped one.

`tools/research/discover_stage_page_gpx.py` reads all three page shapes the
publisher uses — `/<race>/stage-3-route-<abbr>/`, `/<race>/route-<abbr>/` for
a one-day race, and `/<race>/stage-3-<abbr>/` with no `route` in it at all,
which is where both Tours publish. The third was found by hand on the Tour de
France Femmes and is the one that mattered most; a publisher's addresses are
not a scheme, and the answer is to match what has been seen rather than derive
what ought to exist. The tool refuses an unnumbered route page on a
multi-stage race instead of attaching the trace to stage 1: on a stage race
that path is the route *overview*, and a trace linked there belongs to no
stage in particular.

**The UAE Tour publishes its own parcours, and three tools were built not to
look.** `probe_route_sources` selected races with zero route versions and
`probe_osm_routes` selected races where no stage at all could be drawn. Both
counted refused geometry as geometry, so a stage race holding fourteen usable
lines and seven the gate had quarantined counted as answered. Five of the
eight races with quarantined geometry had no route-probe row of any kind.
Asked, theuaetour.com turned out to publish a GPX for all seven of its stages;
every one lands within 0.68 km of the official distance, and the two stages
quarantined on the third-party trace at 3.64% and 4.42% come in at 0.37% and
0.04%. Two gaps closed with the organiser's own line, seven stages upgraded to
Tier-0.

Both tools now select any race with a stage the product cannot draw. The OSM
rung, asked at last for the seven remaining races, answers `OSM_NO_RELATION`
for every one — the Giro, the Giro Women, the Tour, Tirreno-Adriatico, the
Tour Auvergne Rhône-Alpes, the Volta a la Comunitat Valenciana and the Vuelta.
T5 is closed for the quarantined set with rows and dates rather than memory.

**Resolved: the Tour de France Femmes has geometry, from the third party, on
a path two patterns did not match.** Nine stages and 1,175 km, the largest
single gap in the project, closed on 2026-08-08. cyclingstage.com publishes a
GPX for each of the nine, linked from pages addressed `/stage-N-tdf-2026-women`
— no `route` anywhere in the path, which is why the discovery tool's two
patterns missed them, and listed on none of the site's four 2026 index pages.
All nine build and all nine pass the length gate: the worst is 1.8 km on a
149 km stage, 1.21%. Twenty-eight climbs detected. Spatial coverage 68.8% →
**73.5%**, and 36 races now carry published geometry.

The organiser findings below stand unchanged and are the reason this was
worth chasing at the third tier: ASO publishes this race's route as pictures,
so the third party is the only line there is.

**The organiser publishes it as pictures.** Tour de
France Femmes 2026 is nine stages and 1,175 km, and against an
organiser that publishes the men's Tour as feature services. Worked on
2026-08-08, the eighth of the race's nine days, and the answer is that the
geometry is not published by the organiser rather than that it was not found:

- All nine letourfemmes.fr stage pages carry `<div id="map">`, which is what
  sent this down the interactive-map path. It is a tab pane, not a map. Inside
  each is one `img.aso.fr` JPEG named `tdff26-etNN-cartepot` with a modal
  zoom. Across the nine pages, the count of coordinate-shaped content —
  `"coordinates":`, `<trkpt`, `LatLng(`, `encodePath` — is **zero**.
- Ten pages were opened in Chromium through the browse harness, which exists
  because a served page can be an empty container filled later by script.
  **Zero geometry payloads.** The `maps.googleapis.com` calls the browser did
  make come from partner widgets, not from a route line.
- ASO's public ArcGIS organisation — the source of the men's Tour geometry —
  lists **108 feature services**. It publishes the women's race for 2022,
  2023, 2024 and 2025 and has **no 2026 service**, while the race is running.

Filed as `ORGANISER_MAP_IS_RASTER`, which is deliberately not `NOTHING_FOUND`:
an organiser that ships a picture of its route has published the route, to a
reader rather than to a machine, and asking again will not turn it into
geometry.

**The organiser rung had been probed at the front door.** The T1 sweep
recorded `NOTHING_FOUND` for several races against their site's *landing*
page, and the vault already held per-stage pages for some of them that nothing
had ever looked at. Ten organiser route pages were opened in Chromium on
2026-08-08 — every address a link from a page already vaulted, none composed:

| page | payloads |
|---|---|
| `itzulia-women.eus/en/etapa/stage-1..3` | 0 |
| `vueltaburgos.com/feminas/etapa1..4` | 0 |
| `tourdesuisse.ch/en/women/route` | 0 |
| `lavuelta.es/en/overall-route` | 0 |
| `tourdesuisse.ch/en/stage/01` | 3, all refused |

The Tour de Suisse stage page is the only one that fetches anything
coordinate-shaped, and two things are true about it. The address is
`secure.cyclingprodata.com/tours/1070/jsonp/tour_noteams_noroutes.jsonp` — a
timing provider's feed whose own filename says it carries no routes — and that
host's robots.txt disallows the path. The harness refused it. Recorded as
`REFUSED` rather than as an absence, because those are different facts.

The other nine are `NOTHING_FOUND` with a note saying the page was *browsed*,
not merely fetched. That distinction is the point: "the HTML had no `.gpx` in
it" is not the same measurement as "a real browser loaded this page and it
requested no geometry".

**The amended final stage has a published line, and it is one lap.** Reading
ASO's GIS organisation turned up `TDF26_E21`, a service that appeared after
the 25 July amendment. It holds one polyline measuring **18.894 km** and three
points — a sprint, a finish and a category 4 climb. That is the Montmartre
circuit, not the 89 km stage. The organiser's announcement says the riders
"complete two additional laps of the Champs-Élysées before heading to the
Montmartre circuit" and states no lap count, so the stage cannot be composed
from it without inventing a number. The line is vaulted as evidence of what
the circuit is; it is not published as stage 21's route.

Two defects surfaced getting there, both the same shape. `capture_arcgis.py`
asked `TDF26_E21` for the field list `TDF26bis` carries; ArcGIS answers a
rejected query with **HTTP 200 and an error object in the body**, so the tool
vaulted the error as though it were geometry and reported the service as
holding nothing. It now reads each layer's own field list and refuses an error
body outright. And `parse_route_amendment` stopped matching the team
presentation time when ASO revised the announcement from "will take place at
3:40 p.m." to "will take place in Thoiry at 2:40 p.m." — the pattern had no
room for a place name, so the field silently dropped out and the only claim in
the ledger was the superseded one. Both artifacts now carry their own claim,
and the parser names any schedule field it can no longer match.

The same reading recovered a fact the register needed: the announcement says
89 km is "down from the **133 km** originally planned", which is the
organiser's own confirmation that the 132.50 km roadbook itinerary and the
132.528 km trace describe the route as published. That figure was read by the
parser and used only in prose; it is now a claim in its own right, so
`route_superseded_by_amendment` rests on the publisher's words rather than on
an inference from two numbers agreeing.

**Seven races now hold the organiser's own general classification, and the
probe that found them had been measuring the wrong thing.** Fourteen in-scope
stage races held nothing but a Wikipedia top ten — the encyclopaedia's habit
for a stage race, and the reason an organiser's own page is worth having.
`probe_result_pages --only-thin` was meant to find exactly those and selected
`result_rows <= 10`, a count across the whole race. A one-day classic with a
podium has three rows and was caught; a stage race with a top ten on each of
eight stages has eighty and was not, which is precisely backwards. The flag
now measures the deepest rank published.

Asked again, 88 races yielded ten result pages, and the new ones are deep:
Paris-Nice 89 riders, the Volta a Catalunya 125, the Tour Auvergne
Rhône-Alpes 91, the AlUla Tour 104, La Vuelta Femenina 102, the Tour of Oman
109. Three publishers were registered for it — paris-nice.fr,
voltacatalunya.cat and tour-auvergne-rhone-alpes.fr — each as its own source
row, because a licence and an access decision belong to a site rather than to
the company behind it.

**Two of those readings were wrong, and both are now refused twice over.**
An organiser's rankings page does not go blank between editions. Asked on
2026-08-08, `lavuelta.es/en/rankings` answers with 154 rows for a race that
starts on the 22nd — last year's finishing order at this year's address. That
was known and guarded where targets are minted, on the reasoning that nothing
could reach the product anyway because the parser would find no stage to
attach to. The reasoning was wrong: the Vuelta has twenty-one stage rows, its
route and schedule being held and only its results not, so a 153-rider general
classification was written onto a race that has not started. Two of the three
result tables were checked for future-dated stages and the third, the
classification snapshot, was where it landed.

And the Muscat Classic, a one-day race, held the Tour of Oman's 109-rider
general classification. The two share tour-of-oman.com; the probe walked the
classic's official URL, found `/en/rankings`, and recorded the stage race's
standings. The capture targets were keyed on the host, so both races claimed
one source id and the parser's map is a plain dict.

Both are refused at the parser now — a stage dated in the future writes
nothing but a pending entry, and a classification offered to a race with one
stage is a page about a different race — and both have an invariant. The
second is stated as identity rather than as "a classic has no classification",
which is not true here: a one-day race is stage 1 of itself and this project
stores its finishing order as exactly that for most of the calendar. What is
impossible is two races holding the same classification, from the same
publisher, over the same riders in the same order. Twenty rows is the floor,
because a team classification names eight or ten and the same few finish in
the same order all season; past twenty riders, coincidence is not a live
explanation.

## Known accuracy limits

**A tile that would not download was recorded as terrain with no elevation.**
The GLO-30 sampler treated "the fetch failed" and "the product has no tile
here" as one outcome. Both wrote every sample in the tile as `UNAVAILABLE`,
which is correct over open ocean — the product genuinely publishes no tile and
the 404 says so — and false when three downloads drop mid-run. On 2026-08-08
they did, and 10,718 samples of Pyrenean, Apennine and Tyrolean road that the
previous run had measured correctly were overwritten with an absence. The
coverage report then showed a 51.2 km hole in a route that has none.

The distinction is now the HTTP status. A status is the product answering, and
`UNAVAILABLE` is honest. No status, after two retries, is this machine's
network answering: the existing rows are left exactly as they are, the tile is
reported unreachable, and the run exits non-zero so `make derive` stops rather
than publishing coverage figures from a partial pass. Re-running with
`--resume` retries only the tiles that never answered — a resume, not a repair.
All 10,718 were recovered that way, and the worst coverage gap went back to
3.4 km. `tests/test_invariants.py` asserts that no elevation is recorded as
absent on the strength of a tile that never answered.

**T2, GPS tracker replay, is measured and empty.** The geometry ladder calls
this rung the highest-fidelity source for a finished race, and it had never
been tried. Tried on 2026-08-08 the way the organiser-map rung was — by
reading what the publishers' own pages link to, rather than by guessing an
address — across 60 vaulted pages from letour.fr, lavuelta.es, giroditalia.it,
rondevanvlaanderen.be and paris-roubaix.fr.

The only tracking-adjacent hosts any of them reference are
`fantasybytissot.letour.fr` (204 references), `www.tissotwatches.com` (120),
`gpsbabel.org` (5) and `gpsvennys.be` (1). The first is a fantasy game, the
second a sponsor, and the gpsbabel references turn out to be inside a
cyclingstage.com GPX file's own metadata — that file was produced with the
tool, it does not link to it.

No organiser page in the vault publishes, links or hints at a telemetry or
replay endpoint. `evidence.sources` holds no tracking host and
`evidence.observations` has never recorded one. This is recorded as a
measurement rather than an opinion: the rung is empty from the publishers'
side, and an address arrived at any other way would be one nobody fetched it
from.

**The length gate was strictest on the longest stages; nine of them are now
released, and nineteen are still refused.** `quality_gate._LENGTH_FAILS` used
to quarantine a route line differing from the official distance "by more than
2 km or more than 2%, whichever is tighter". The two clauses were joined by
`OR`, so the absolute one always won on a long stage: 2% of a 234 km stage is
4.68 km, and the gate allowed 2.0.

Measured 2026-08-08, across the 28 route versions quarantined under that rule:

| proportional error | versions |
| --- | ---: |
| ≤ 2 % | 9 |
| 2–5 % | 11 |
| 5–10 % | 4 |
| 10–20 % | 2 |
| > 20 % | 2 |

The nine at or under 2 % were 131–234 km stages erring by 1.16 % to 1.79 % —
inside the stated 2 % policy, failing only the absolute clause. None of the 28
had any other accepted route version, so the quarantine was the whole
difference between those stages having geometry and showing nothing.

The rule is now `greatest(0.5, 0.02 × official_km)`: the same 2 % standard,
with the absolute term turned from a ceiling for long stages into a floor for
short ones, where 2 % of a 9 km prologue is 180 m and inside the noise of any
traced line. The floor is 500 m rather than 2 km because that was measured
rather than chosen — against the 143 versions holding both a length and an
official distance, floors of 0.25 and 0.50 km both accept 141 with a worst
accepted error of 1.79 %, while 1.00 km accepts a 9 km prologue that is 784 m
out, 8.71 %, four times the policy. 500 m is the largest floor that admits
nothing the 2 % rule refuses. Nine versions were released; the worst
proportional error now published is 1.79 %, and `tests/test_invariants.py`
asserts that separately from the rule so the floor cannot quietly become a
second standard.

Twenty stay refused, and should. A line 8 % long produces a wrong gradient, a
wrong ascent and a wrong climb category, and a wrong number is worse than no
number.

**None of them is a misfiled trace, which is what settles it.** The obvious
hope for a quarantined set this size is that some of the files belong to other
stages — this project's most frequent defect is a key weaker than the thing it
selects, and a mis-assigned GPX would look exactly like a length disagreement.
Measured 2026-08-08 against every one of the twenty: the crow-flight distance
from the trace's first vertex to its last is always far shorter than the route,
and the three circuit stages close on themselves — Tanunda to Tanunda 0.1 km,
Monaco to Monaco 0.7 km, Granada to Granada 3.1 km. Every trace runs between
the towns its stage names.

The deltas are symmetric too: ten traces are longer than the published
distance and eleven are shorter, so there is no systematic offset to correct —
no neutralised-section convention, no lap-counting error, nothing that a rule
could fix. These are the right roads between the right places, described at a
length the organiser does not publish, and there is no third measurement to
break the tie. They stay refused.

**Two of those twenty are not mismatches at all.** Tour de France 2026 stage
9 traces to 185.609 km against an official 154.6 — 20.06 %, the second-worst
figure in the table — and ASO's own geometry layer states **185.5 km** for that
stage, 109 m from the trace. `build_official_routes` already refused that layer
as stale and said so in a §5.3 gap; the figure now also lives in
`geo.superseded_route_statements` as a number, because the length gate cannot
read a sentence. The trace reproduces a route the organiser published and later
changed. Filed as `route_superseded_by_amendment`, and the quarantine stands.

Stage 21 is the same fact with different evidence, which is why the gate asks
for both: stage 21's corroboration is geometric (the roadbook itinerary's
kilometre axis still runs to 132.50 km) and stage 9's is an attribute in a
feature service. Neither is a special case of the other.

**A stage number from outside the codebase is no safer than one inside it.**
Looking for those two missing organiser lines meant reading all 108 feature
services in ASO's GIS organisation. Three name a year; the rest do not. Among
the rest, `Traces_Etapes_Total` looked exactly like the answer — one polyline
layer, exactly 21 features, keyed on an `Etape` attribute running 1 to 21.

It is not this race. `Etape` 1 measures 151.3 km where Tour stage 1 is a
19.6 km time trial, and `Etape` 16 measures 169.6 km where stage 16 is a
26.1 km time trial. The service's `Date` field reads 29/08, 30/08, 31/08,
01/09 — with no year — and its `Etape` 1 is a closed loop at Nice while
`Etape` 8 ends in the Pyrenees. The Vuelta a España 2026 does start in Monaco
and ASO owns Unipublic, but it starts on 22 August with a 9 km time trial.
With no year anywhere in the service, the layer or the attributes, the edition
cannot be identified, so the geometry is recorded as read and refused.

Matching on `Etape` alone would have attached 21 lines to the Tour and
published them. That is the same fault the source-level invariant now guards
inside this codebase — a key weaker than the thing it selects — arriving from
outside it, where no invariant reaches. The defence is the one used here: a
stated length and a published date, checked against the stage before the
geometry is believed.

**The first of them is not a mismatch at all.** Tour de France 2026 stage
21 traces to 132.528 km against a stored distance of 89.00 km — 48.91 %, the
worst figure in the table — and the reason is not the file. ASO's own roadbook
itinerary for that stage runs to 132.50 km, 28 m from the trace, and the 89 km
comes from a letour.fr news item of 25 July 2026 announcing that the final
stage between Thoiry and Paris had been shortened. The geometry is faithful to
the route as published; the distance describes the route as ridden.

The quarantine stands — a line the race did not follow must not be drawn under
its result — but it is now filed as `route_superseded_by_amendment` rather
than `route_length_mismatch`, because calling it a mismatch states something
false about both cyclingstage.com's file and ASO's roadbook. The test is a
join on the itinerary's kilometre axis, not a list of stage numbers: the next
race-day reroute will not be this one.

**Waypoint positions are derived, not surveyed.** The roadbook publishes
names and distances, not coordinates. Positions come from projecting official
distance onto the route line. Geocoding is retained only as a cross-check and
disagrees by more than 750 m at 33 waypoints.

**Rider names come from a CC BY-SA source, not the organiser.** All 184 now
carry correct orthography — "Tadej Pogačar", "Søren Wærenskjold", "McNulty" —
joined to the organiser's entries by bib. The organiser publishes names only
inside lowercase ASCII URL slugs, which cannot distinguish "Mcnulty" from
"McNulty", so the more accurate source wins and each name records where it
came from.

**IGN elevation stops at the French border.** Stage 1 has no national-DEM
coverage and stage 3 has 45%. Copernicus covers them at ~90 m. The difference
between the two DEMs is published as the elevation envelope.

**Derived climbs are not official categories.** The detector finds 44 of the
66 climbs the organiser classifies on a stage still being raced — every HC,
12 of 13 Cat 1, 9 of 11 Cat 2, 15 of 21 Cat 3, but only 2 of 14 Cat 4. The
misses are concentrated where the threshold bites: a 150 m ascent gate cannot
see a Cat 4 climb that rises 90 m. Detections are never styled as ASO
categorisations.

**Why a rider left is published, but not by the organiser.** The manner and
stage of every exit — 11 DNF, 11 DNS, 2 OTL — comes from the CC BY-SA
startlist, not from letour.fr, and carries that authority tier. It reconciles
exactly against the official results: each rider's last classified stage is
their exit stage minus one, with no results afterwards, for all 24.

## Operational

**Stage 21 was raced, and its course is still withdrawn.** The organiser
shortened it from 133 km to 89 on 25 July, after the Ministry of the Interior
redeployed security forces to the wildfire response. The riders did not race
from Thoiry: the caravan paraded and transferred, the teams were presented at
Thoiry and travelled to Paris by bus, and the race was started from the finish
line on the Champs-Élysées at 17:50 for a finish at 19:45 local time.

The stored 133 km course — line, 50 roadbook rows, 7 official climbs, ascent
and jurisdictions — remains `CONFLICTING` and withheld from the product. The
organiser has still published no replacement itinerary: its overall-route page
and its own stage-21 page both continue to describe the Thoiry course, and no
89 km itinerary exists in a capturable form. The gap stays open rather than
being closed by reinstating a course that was not ridden.

**letour.fr publishes the final classification where the stage result goes.**
`/rankings/stage-21` carries the same table shape as every other stage, with
the same column headings — and Tadej Pogačar at the top with `73h 56' 26''`.
That is the whole race, not one day. Read as a stage result it produced a
rider who took three days to reach the Champs-Élysées, a stage winner who did
not win the stage, and a derived general classification that counted the race
twice: once through stages 1–20 and again through the row that is already
their sum.

The two are told apart by magnitude, because magnitude is what differs. No
stage of a modern Grand Tour approaches twelve hours — the longest in Tour
history, Les Sables-d'Olonne to Bayonne in 1919, took just over nineteen, and
nothing since the 1920s has come near half of it. A cumulative classification
passes twelve hours before the end of the third stage. There is no overlap to
arbitrate.

So the page is stored as what it is. **This is the only Tier-0 standing this
project holds**: every other classification is a CC BY-SA top ten, because
letour.fr serves them from robots-disallowed paths. Here the organiser
published the full field on a path robots.txt allows, so all 158 riders are
kept at the organiser's own authority.

Stage 21 therefore has no Tier-0 stage result, and that absence is registered
rather than implied. Its winner — Mathieu van der Poel — comes from the CC
BY-SA article and carries that tier.

**The two general classifications agree exactly.** The organiser's published
final standing and the one this project derived by summing its own per-stage
results are independent: one is ASO's total, the other is arithmetic over 20
stages of official results. Every gap in the top ten matches to the second —
386 s, 582 s, 716 s, 782 s — because stage 21 was ridden by the whole field in
the same time. An invariant now asserts that agreement, which is the strongest
check the general classification has ever had here.

Three invariants had to be restated to allow this, and none was weakened. They
encoded "every standing is a Tier-2 top ten" as though it meant "a standing
can never be Tier-0", which was true only while the fallback was the sole
source. What they were protecting — a top ten must never pass as the
organiser's word — is now stated properly: a standing's authority and
completeness must match the page it came from, and a standing flagged complete
must hold more than a top ten.

**The repository is private, and must stay private.** The Evidence Vault
holds letour.fr pages, ASO route geometry and third-party GPX traces, all of
which the source registry records as all-rights-reserved and
non-redistributable. §4.8 already withholds those traces from every export for
that reason; committing them is only defensible while the repository is not
published. It was briefly public and was made private on 25 July.

**Elevation and weather are not rebuildable offline.** `make all` restores
everything from the committed vault with no network, but the DEM ensemble and
the weather layer come from APIs whose responses are not vaulted, so a clean
rebuild produces a database without them and the checks that depend on them
report SKIP rather than passing on absent data. `make derive-network` fetches
them; the committed database snapshot carries them for anyone who would rather
not re-fetch.

**The Evidence Vault is committed but the database is not authoritative.**
The vault (gzipped, content-addressed) and a database snapshot are both in
Git; `make all` rebuilds everything from the vault with no network.

## What is held for each of the 137 registered races

The registry names 137 races for 2026 — 36 .UWT, 27 .WWT, 61 .Pro and the 13
championship races of the World Championships. **One of them is collected.**

Listing 137 names without saying which is which would imply coverage that
does not exist, so depth is measured per race on every build and published
beside the name:

| Tier | Races | What is held |
|---|---|---|
| CALENDAR | 42 | A name, dates and a UCI class, from a season list. |
| SCHEDULE | 13 | The race's own breakdown: dates, distances, venues, start times. |
| RESULTS | 81 | Who finished and in what order, with the final classifications. |
| ROUTE | 0 | A route line and elevation profile. |
| FULL | 1 | Route, results, roadbook itinerary and the analytics built on them. |

A race takes the highest tier for which **every lower tier also holds**, so
the label cannot overstate: a race with results but no route reads RESULTS.
The tier is a statement about this project, never about the race — a race at
CALENDAR is one nobody here has collected, not one that was never ridden.

Every race opens from the selector in the header, and the page that opens is
the one its depth supports: the stage product for the Tour, a race page with
schedule, classifications, starters and provenance for a race at RESULTS, and
a stated absence for a race at CALENDAR. A race with no route is not rendered
as a stage page with the route missing — that reads as a failed load rather
than as an absence.

**The 42 at CALENDAR are the races still to come.** Every completed race on
all three calendars is at RESULTS or better. Their own articles do not exist
yet — Wikipedia renders a link to an unwritten article as a red link, and
capturing one would vault an edit form — so the gap closes on its own as the
season is ridden, and it is measured rather than assumed.

**ENTRIES used to be a rung and is not any more.** The ladder assumed a start
list precedes a result, because that is the order the Tour was collected. It
is not the order the world publishes in: encyclopedic sources publish who
finished and rarely publish who started, so 81 races held complete standings
and no start list, and every one of them read SCHEDULE. A start list is not a
shallower fact than a result — it is a different one — so it is now a count
shown beside the race rather than a step on the way to it.

The 13 at SCHEDULE are the World Championships in Montréal, 20–27 September.
Their schedule table shares a distance cell between the elite women's and
elite men's time trials, and between the under-23 women's and junior men's
road races, so it is read with a rowspan-aware grid rather than the flat cell
reader the rest of the project uses. A reader that ignores `rowspan` shifts
every column after the elision, which is the failure mode that looks most
like data.

**Evidence placement is derived, and refuses to guess.** 24,731 of 25,666
claims are placed to a named race, by following the rows that cite a claim,
then the artifact those rows share, then other captures of the same URL. An
artifact serving more than one race is placed to none — the three season
calendars serve 124 between them and the championship article serves 13 — so
the per-race totals deliberately do not sum to the whole. Attributing by
hostname would work today and break the first time ASO publishes a second
race.

The residue is 930 claims on artifacts that no stored row cites: rider
identity pages, `robots.txt` fetches, and French-language duplicates of
ranking pages whose English equivalents were parsed.

## What the fleet's results are, and are not

The 81 races at RESULTS carry **2,030 placings across 203 classifications**,
read from each race's own CC BY-SA article. Every one is
`TIER_2_ENCYCLOPEDIC` and `is_partial`, and an invariant fails if a row of it
ever claims otherwise. The organiser's word is never mixed in: the parser
skips any race for which this project already holds official results, so the
Tour de France's full field is not joined by a top ten wearing the same shape.

**Per-stage placings are now read too**: 1,620 across 162 stages, in
`results.published_stage_results`. They needed their own table rather than a
place in the organiser's. `results.stage_result_records` requires a
`rider_id` because a Tier-0 result names a rider registered from a start list
and joined on an official bib; an encyclopedic top ten has neither, and
relaxing the column to admit one would put a name-matched row beside a
bib-matched one with nothing to tell them apart.

Each is checked twice over: once as it is read, against the winner the stage
list names, and once as stored, against the winner row already in the
database — a writer that dropped or reordered a placing would pass the first
and fail the second.

What is **not** taken from those articles:

**Race-specific minor competitions.** Nine kinds appear across the fleet:
breakaway, combativity, "Red Bull km", the Andalusian, Spanish and Hungarian
rider classifications, "beauties of Turkey sprints". They are named in the
parser's report rather than dropped in silence, and not stored, because the
five in the schema are the five the UCI standardises.

**Rider identity.** 2,030 rows name a rider as text and resolve none to
`core.riders`. There is no bib to join on across 88 races, and a wrong join
attributes a placing to the wrong person. The published label is stored and
the foreign key is left absent.

**Teams are resolved, because each article names its own starters.** 1,736
team registrations across 88 races come from the article's own team list, and
2,020 of the 2,030 rows join to a squad the same page says contested the
race. The 10 that do not are the publisher naming a team two ways on one page
— the standings say "Fenix–Deceuninck" where the start list says
"Fenix–Premier Tech" — and they are left unresolved rather than fuzzy-matched
onto a squad that might be a different one.

Four list items were rejected as team names for being too long: each is the
section's own prose, opening "Main article: List of teams and cyclists in
the 2026 …", which had been registering a paragraph as a squad. Nothing is
rejected silently — the parser names every item it drops.

### Two independent pages agree on every winner

The fleet's results come from one publisher, and one publisher agreeing with
itself is not evidence. Two separately edited pages do each name a winner —
the season calendar, and the race's own article — so they are held against
each other:

| | |
|---|---|
| Races with a winner on both pages | 81 |
| **Agree** | **81** |
| Disagree | 0 |
| Stage winners checked within each article | 162 |
| **Agree** | **162** |

Agreement is not proof: both pages can be edited from the same report, so
this bounds transcription error rather than establishing the result.

**The check earned its place on its first run**, by failing. It reported
seven cross-source disagreements and 71 of 162 stage disagreements, and every
one of them was this project's bug rather than a publisher's:

* the calendar lookup was keyed on the race name alone, so the men's Tour of
  Flanders was held against the women's — the same collision the registry
  slug already carried a class to avoid;
* a stage heading covers *two* ranked tables, that stage's result and the
  general classification after it, and the second was winning. Every stage
  was being compared against the race leader, which is why the same name
  repeated down whole races;
* a team time trial's result table has no rider column at all, so requiring
  one skipped it and let the classification below answer instead.

### Season victory counts, and the denominator that makes them mean anything

The fleet's 3,650 placings support one statement no single race page can
make: who has won most. It is published, and it is published with its
denominator attached everywhere it appears.

| | |
|---|---|
| Races with a held result | 82 |
| Overall victories counted | 81 |
| Stage victories counted | 162 |

**These are wins in the races this project holds, not wins in the season.** A
team that won a race held at CALENDAR depth appears nowhere here, because
nothing in this database records that they did. `races_seen` is stored on
every row so the numerator can never be read without it, and two invariants
plus a UI budget check that the figure survives into the bundle and onto the
page.

81 overall victories against 82 races is not an error: the Tour of
Magnificent Qinghai's general classification was withheld for listing two
riders at rank 4, so it contributes stage wins and no overall one. The gap is
reported rather than left to be noticed.

Names are counted as published and never merged. "Visma–Lease a Bike" and
"Team Visma | Lease a Bike" would be one team to a reader and are two strings
here; a rule that merged them would as readily merge two squads that differ.
The grouping key folds accents and spacing only, and the *displayed* spelling
is the one the source used — this project already fixed rider orthography
once for the Tour's start list, and folding it back in would undo that.

**The clean rebuild caught this step publishing a lie.** The denominator was
read from `analytics.race_coverage`, which is written by a later derive step,
so on a fresh database it came out zero — every count correct, over "0
races". It now counts the races itself from the result tables, with no
dependency on another step having run.

### The calendar sometimes links to a series, not an edition

Where a season's article does not exist yet, the calendar links to the series
page — `Tour_of_Norway`, not `2026_Tour_of_Norway`. Those pages carry a
Winners table spanning every edition, and one row of it read as this year's
result would be another year's, stored with full confidence.

Nothing is read from a page whose address names no season. Three races are in
that state — Tour of Norway, Tour de Romandie Féminin and the Surf Coast
Classic — and each is registered as a quality issue rather than quietly
skipped. An invariant fails if such a race is ever left unregistered.

Two disagreements between publishers are recorded rather than resolved:

**The Tour of Magnificent Qinghai lists two riders at rank 4** with different
times. Storing the table would lose one of them to the unique key on
`(snapshot, rank)` and leave ten riders looking like nine. The classification
is withheld and the contradiction registered as a quality issue.

**Itzulia Women is dated 15–17 May by the season calendar and stages on
16–18 May in its own article.** These are independent publishers, so neither
is corrected into the other; both are kept and the disagreement is shown.

## A capture bug that was biased, not random

The capture harness passed URLs to `urllib` unencoded. Publishers link to
their own pages in raw UTF-8 — `2026_Gent–Wevelgem` carries an en dash,
`2026_Clásica_de_Almería` an á — and `urllib` raises rather than encoding
them, so **26 of 89 race articles failed**.

The failures were not a random 29%. They were every race with an accent or a
dash in its name: the French, Spanish, Italian and Belgian half of the
calendar. The remaining 63 looked like a representative sample and were not,
which is why this is recorded here rather than fixed quietly. URLs are now
percent-encoded per component, idempotently, on the wire only — the
observation still records the address the publisher published.

## Blocking a second race

The observatory holds one race. The schema is ready for more — 19 tables
carry `race_id` or reach it through `stage_id`, and `core.stages` is unique
on `(race_id, stage_number)` — but ten of the derive and export steps are
not. They run `SELECT stage_number, stage_id FROM core.stages` and key a
dictionary on the stage number alone.

This was tested rather than assumed. A second Grand Tour was loaded into a
scratch database alongside this one: **42 stages went in, 21 survived the
dictionary, and which 21 depended on scan order.** Nothing raised. Every
profile, climb and weather sample would have been attributed to whichever
race the planner happened to return second.

An invariant now fails as soon as a second race exists, so the assumption
cannot be violated quietly. Scoping those queries by `race_id` is the work
that unblocks it, and it is small — the joins already exist.

**The label was the last thing to be scoped.** Every stage query was filtered
by `race_id` while the exported bundle still named its race with a literal,
so exporting a second race produced correctly-scoped data captioned "Tour de
France 2026". The caption now comes from the database and an invariant checks
it against the race the bundle was built from.

Two further things do not generalise, and both are additive rather than
structural:

**Parsers are per-publisher, by necessity.** About 2,000 of the ~7,000 lines
of tooling read ASO's HTML; the other 5,000 — capture, vault, geometry,
profiles, climbs, classification, export, licence enforcement — care about
neither the race nor the publisher. ASO covers a useful share of the men's
calendar, but RCS, Flanders Classics and the UCI each publish differently
and each need their own parser against the same claim interface.

**One-day races have no stage axis.** A Classic is modelled as a race with a
single stage, which the schema allows, but `stage_number` stops carrying
meaning and the roadbook itinerary — the spine of everything positional
here — is published in a different form or not at all.

## Profile reliability, measured

The organiser publishes a total ascent per stage. Summing the positive deltas
of our own elevation profile gives an independent figure. Comparing the two is
the only whole-profile cross-check this project has — every other test
compares a sample to its neighbours, which cannot detect a DEM that is
smoothly wrong over ten kilometres.

They agree within a few percent on most stages, and disagree sharply on seven.
The pattern is not terrain, it is coverage:

| Stage | Two-DEM samples | Published | From profile | Δ |
|---|---|---|---|---|
| 3 | 45% | 3850 m | 5367 m | **+39%** |
| 1 | 0% | 200 m | 250 m | **+25%** |
| 12 | 54% | 1800 m | 1412 m | −22% |
| 11 | 62% | 1400 m | 1107 m | −21% |

Stage 3 has 539 of 981 samples on Copernicus GLO-90 alone, because the
national DEM stops at the Spanish border, and stage 1 has no IGN coverage at
all. A ~90 m grid over Pyrenean terrain manufactures micro-ascents and summing
them inflates the total. The negative rows are the third-party GPX traces,
whose carried elevation is smoothed and under-reports climbing instead.

**No derived ascent is published, and none will be.** Thresholding the deltas
to suppress DEM noise was tested at 1, 2, 5 and 10 m. Reaching stage 3's
published figure needs a 10 m floor, and that same floor takes stage 7 from
−11% to −89% and stage 12 from 1676 m to 243. There is no threshold that is
right for both a Pyrenean stage and a flat one, so the derived figure stays a
diagnostic.

What is published is the disagreement itself, in the profile caption where a
reader meets the profile:

> 901 of 981 source points shown · elevation from Copernicus GLO-90 + IGN RGE
> ALTI · **45% of samples covered by two DEMs · profile ascent 39% above the
> published 3850 m**

## Climb detector: swept, not guessed

The detector's three constants — 150 m minimum ascent, 3% minimum mean
gradient, 40 m tolerated dip — were swept against the organiser's classified
list over a 4×3 grid.

| min ascent | 2.0% | 3.0% | 4.0% |
|---|---|---|---|
| 100 m | 61% | 54% | 41% |
| 150 m | 59% | **54%** | 41% |
| 200 m | 56% | 50% | 37% |
| 250 m | 52% | 46% | 33% |

Recall moves smoothly across the whole grid with no discontinuity, so the
current setting is a defensible choice rather than an artefact of a
threshold sitting on a cliff edge. Gradient dominates: 3% → 2% gains three
matches, 3% → 4% loses seven.

**But no setting exceeds 61%**, which makes the ceiling definitional rather
than a tuning problem. A Cat 4 climb that rises 90 m is below every threshold
tested, and loosening far enough to catch it buys recall with false summits.
A climb this project invented would be worse than one it missed, so the
constants stand and the limit is stated instead.

## Weather: where the answer actually came from

A weather sample used to record the coordinates of the *request*. Measuring
the distance between a sample and the point it describes therefore returned
exactly zero on all 1,313 rows — a number that reads as perfect accuracy and
is really an absence of measurement.

The provider's own reply is now stored: the grid cell it used, that cell's
model elevation, and the distance between the two points.

| | |
|---|---|
| Grid snap, mean | 1.0 km |
| Grid snap, 95th percentile | 3.0 km |
| Grid snap, worst | 6.6 km |
| Model terrain vs road, mean bias | ≈ 0 m |
| Model terrain vs road, worst | 224 m |

The horizontal snap is the smaller problem. The elevation mismatch is the
real one: the provider reports weather for its own terrain, so where that
terrain sits a couple of hundred metres from the road — as it does on stages
13, 18 and 15 — the temperature is out by roughly 1.5 °C at the standard
lapse rate, while looking entirely plausible.

Mean bias across the race is near zero, so aggregate figures are sound. What
is not sound is treating any single mountain sample as the temperature on
that road, and the stored elevation difference is what lets a reader tell
the two cases apart.
