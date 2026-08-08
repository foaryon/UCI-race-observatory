# Coverage report

**Generated, not written.** Every figure below is read from the database at build time by `tools/export/emit_coverage_report.py`. Editing this file by hand achieves nothing: the next `make registers` overwrites it. Definitions and judgement live in `docs/QUALITY_MODEL.md`; this holds the values.

`coverage-report/1.0.0` · evidence current to `2026-08-08T13:23:36+00:00`

---

## 1. Scope

- **67** races in scope (UCI WorldTour, UCI Women's WorldTour, Elite Road World Championships)
- **70** races collected and retained out of scope
- **137** races registered in total
- **200** in-scope stages

Out of scope is a presentation decision, not a judgement about a race. Every excluded race keeps its evidence in the vault.

| Reason | Races |
| --- | ---: |
| .Pro is outside the published scope: the product covers the UCI WorldTour, the UCI Women's WorldTour and the Elite Road World Championships. The evidence is retained. | 61 |
| Under-23 and Junior championship events are collected and not published; the product covers the Elite events only | 8 |
| this event has no single gender, and the published record has no way to say so without filing it under one | 1 |

## 2. Evidence

- **1,321** vaulted artifacts (5,438 MB), **2,567** observations
- **46,819** claims, of which **43,273** (92.4 %) place against a race

Claims that place against no race are not a loss: the season calendars describe many races at once and are correctly attributable to none. They are recorded as unplaced rather than assigned by similarity.

| Authority tier | Claims |
| --- | ---: |
| `TIER_0_OFFICIAL` | 36,547 |
| `TIER_2_ENCYCLOPEDIC` | 10,271 |
| `TIER_A_ARCHIVE` | 1 |

**Evidence coverage: 17,644 / 17,644 = 100.0 %.** Every normalised row must be walkable back to bytes somebody else can verify.

**Raw field coverage: 634 of 640 declared columns = 99.06 %** hold at least one value. 0 more sit in tables with no rows yet.

> Share of declared columns that hold at least one value, over the columns whose table has rows at all. A column in an empty table is not an unfilled field — there is nothing yet for it to be unfilled in — so it is counted separately rather than dragging the figure down.

**Confidence-weighted coverage: 62.77 %** — the same rows, scored `high = 1.0, medium = 0.0, low = 0.0`.

> Declared rather than tuned, and deliberately the harshest reading available: it counts only what the organiser itself published and gives no credit to geodata or encyclopedic corroboration. A weighting with nothing to adjust cannot be adjusted toward a flattering answer. The composition below is published so a reader who prefers another weighting can apply it to these same counts.

| Confidence | Rows | Share of cited | Sources |
| --- | ---: | ---: | --- |
| high | 11,076 | 62.77 % | 0 official |
| medium | 0 | 0.0 % | 1g geodata |
| low | 6,568 | 37.23 % | 2 encyclopedic |

The medium band is empty, and that is a fact about this table rather than about the geodata sources. Route geometry is not recorded as a claim: `geo.route_versions` carries the source and the artifact hash directly, so a trace is walkable back to bytes by a different path and is counted in the spatial coverage below instead of here. Every row this score does cover comes from a published document, not a road file.

## 3. Coverage

Two axes, because what is known about the event and what is known about the road are independent. A route can be published years before a result exists.

**In scope** — event depth: CALENDAR 14, RESULTS 48, SCHEDULE 5; road depth: ITINERARY 1, NONE 37, ROUTE 29

**All registered** — event depth: CALENDAR 39, RESULTS 83, SCHEDULE 15; road depth: ITINERARY 1, NONE 101, ROUTE 35

**Spatial coverage: 18,169 km of 24,716 km = 73.5 %** of in-scope racing distance carries usable, length-checked geometry.

> The denominator is itself incomplete: only 171 of 200 in-scope stages publish a distance. It is reported as measured rather than extrapolated.

> A further **16 stages** hold usable route geometry that this percentage cannot count, because no official distance is published for them and they are therefore absent from both sides of the fraction. They are the one-day classics: the road is mapped, its length is unverified against the organiser, and neither fact is visible in the number above.

**1 concluded in-scope races carry no result.** 48 in-scope races carry a result; 19 have not been raced yet.

### Analytical readiness

Per analysis, not collapsed into one number: a stage ready for a profile is not thereby ready for a wind field, and one figure would let each cover for the other.

| Analysis | Requires | Stages ready |
| --- | --- | ---: |
| `elevation_profile` | usable geometry with sampled elevation | 136 / 200 |
| `gradient_series` | profile plus a windowed gradient | 136 / 200 |
| `climb_detection` | a gradient series on usable geometry | 102 / 200 |
| `climb_residual_vs_official` | a detection matched to a published summit altitude | 13 / 200 |
| `passage_window` | official schedules on a distance axis | 19 / 200 |
| `solar_position` | a passage window and a position | 19 / 200 |
| `wind_components` | a passage window, a position and a weather grid | 19 / 200 |
| `derived_general_classification` | Tier-0 per-stage times for every prior stage | 20 / 200 |

## 4. Confidence distribution

| Level | Races in scope |
| --- | ---: |
| `verified` | 47 |
| `provisional` | 14 |
| `sourced` | 6 |

## 5. Unresolved conflicts and open gaps

| Severity | Rule | Findings |
| --- | --- | ---: |
| BLOCKER | `route_length_mismatch` | 19 |
| INFO | `route_length_unverifiable` | 18 |
| INFO | `classification_snapshot_not_published` | 7 |
| INFO | `route_superseded_by_amendment` | 2 |
| INFO | `schedule_corroborated_by_parcours` | 2 |
| INFO | `race_status_disputed_by_organiser` | 1 |
| WARNING | `waypoint_position_disagreement` | 32 |
| WARNING | `route_jump_between_vertices` | 15 |
| WARNING | `profile_elevation_residual` | 5 |
| WARNING | `calendar_links_series_not_edition` | 3 |
| WARNING | `published_rank_sequence_broken` | 1 |
| WARNING | `stage_date_outside_race_window` | 1 |

| Gap status | Count |
| --- | ---: |
| `UNAVAILABLE` | 202 |
| `CONFLICTING` | 27 |
| `ACCESS_RESTRICTED` | 3 |
| `PENDING_MANUAL_REVIEW` | 3 |
| `OUT_OF_SCOPE` | 1 |

**Research-exhausted fields: 0.** None. MASTER_GOAL §12 permits that mark only after a documented eight-step search, and no gap has been through it. Claiming exhaustion without the search would be the same kind of lie as inventing the data.

## 6. Method and limits

- **17** derived quantities registered, **0** without a declared limitation.
- An empty `limitations` field reads as "no known limits", which for a windowed gradient or a modelled wind is the opposite of true. An invariant fails the build on one.

## 7. Sources

| Source | Tier | Access | Licence | Redistributable |
| --- | --- | --- | --- | --- |
| `aso-arcgis` | TIER_0_OFFICIAL | OPEN_API | All rights reserved | no |
| `aso-arcgis-gpx` | TIER_0_OFFICIAL | OPEN_API | All rights reserved | no |
| `aso-storage` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `beneluxtour.eu` | TIER_0_OFFICIAL | UNREACHABLE | All rights reserved | no |
| `cadelevansgreatoceanroadrace.com.au` | TIER_0_OFFICIAL | CHALLENGE_WALLED | All rights reserved | no |
| `climbfinder.com` | TIER_2_ENCYCLOPEDIC | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `copenhagensprint.com` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `copernicus-dem-glo30` | TIER_1G_GEODATA | OPEN_API | Copernicus DEM licence (free use and redistribution, attribution required) | yes |
| `cyclassics-hamburg.de` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `cyclingcols.com` | TIER_2_ENCYCLOPEDIC | TERMS_PROHIBITED | All rights reserved | no |
| `cyclingprodata.com` | TIER_1_SPECIALIST | SUBRESOURCE_DISALLOWED | All rights reserved | no |
| `cyclingsportpromotion.com` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `cyclingstage.com` | TIER_1G_GEODATA | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `dataride.uci.ch` | TIER_0_OFFICIAL | BROWSER_REQUIRED | All rights reserved | no |
| `ddvl.eu` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `download.geofabrik.de` | TIER_1G_GEODATA | SUBRESOURCE_DISALLOWED | ODbL 1.0 | yes |
| `eschborn-frankfurt.de` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `firstcycling` | TIER_1_SPECIALIST | CHALLENGE_WALLED | All rights reserved | no |
| `gent-wevelgem.be` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `gpcqm.ca` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `ign-geoplateforme` | TIER_1G_GEODATA | OPEN_API | Etalab-2.0 | yes |
| `ilombardia.it` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `inflandersfieldsmiddelkerkewevelgem.be` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `itzulia-women.eus` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `itzulia.eus` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `klasikoa.eus` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `komoot.com` | TIER_2_ENCYCLOPEDIC | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `la-flamme-rouge.eu` | TIER_2_ENCYCLOPEDIC | CHALLENGE_WALLED | All rights reserved | no |
| `la-fleche-wallonne-femmes.be` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `la-fleche-wallonne.be` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `lavuelta.es` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `lavueltafemenina.es` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `letour.fr` | TIER_0_OFFICIAL | SUBRESOURCE_DISALLOWED | All rights reserved | no |
| `letourfemmes.fr` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `liege-bastogne-liege-femmes.be` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `liege-bastogne-liege.be` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `milanosanremo.it` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `nominatim.openstreetmap.org` | TIER_1G_GEODATA | OPEN_API | ODbL 1.0 | yes |
| `omloophetnieuwsblad.be` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `open-meteo` | TIER_1W_WEATHER | OPEN_API | CC BY 4.0 | yes |
| `openrunner.com` | TIER_2_ENCYCLOPEDIC | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `osrm-demo` | TIER_1G_GEODATA | OPEN_API | ODbL | no |
| `overpass-api.de` | TIER_1G_GEODATA | SUBRESOURCE_DISALLOWED | ODbL 1.0 | yes |
| `overpass.kumi.systems` | TIER_1G_GEODATA | OPEN_API | ODbL 1.0 | yes |
| `overpass.private.coffee` | TIER_1G_GEODATA | OPEN_API | ODbL 1.0 | yes |
| `paris-nice.fr` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `paris-roubaix-femmes.fr` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `paris-roubaix.fr` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `pco.bzh` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `procyclingstats` | TIER_1_SPECIALIST | CHALLENGE_WALLED | All rights reserved | no |
| `ridewithgps.com` | TIER_2_ENCYCLOPEDIC | SUBRESOURCE_DISALLOWED | All rights reserved | no |
| `rondevanbrugge.be` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `shcmty.net` | TIER_X_LAPSED_DOMAIN | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `strava.com` | TIER_2_ENCYCLOPEDIC | CREDENTIAL_REQUIRED | All rights reserved | no |
| `swisstopo` | TIER_1G_GEODATA | SERVER_RENDERED_ALLOWED | Open Government Data | no |
| `thealulatour.com` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `theuaetour.com` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `theuaetourwomen.com` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `tour-auvergne-rhone-alpes.fr` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `tour-of-britain.com` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `tour-of-oman.com` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `tourdepologne.pl` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `tourderomandie.ch` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `tourderomandiefeminin.ch` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `tourdesuisse.ch` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `tourdownunder.com.au` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `tourofguangxi.com.cn` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `trobroleon.com` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `trofeobinda.com` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `uci.org` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `veloviewer.com` | TIER_2_ENCYCLOPEDIC | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `velowire.com` | TIER_2_ENCYCLOPEDIC | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `voltacatalunya.cat` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `vueltaburgos.com` | TIER_0_OFFICIAL | SERVER_RENDERED_ALLOWED | All rights reserved | no |
| `web.archive.org` | TIER_A_ARCHIVE | SERVER_RENDERED_ALLOWED | Varies with the archived publisher | no |
| `wikipedia` | TIER_2_ENCYCLOPEDIC | SERVER_RENDERED_ALLOWED | CC-BY-SA-4.0 | yes |

Refresh schedule and acquisition roadmap: `docs/DATA_SOURCES.md` §6 and `docs/RESEARCH_BACKLOG.md`.
