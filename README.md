# UCI Race Observatory

> If it shows a number, it can show why it exists.

The published product. It is built from a private, evidence-first source
repository: every figure resolves to a content-addressed copy of the page it
was read from, and anything the project could not obtain, could not trust, or
measured with known error is stated at the point where the data would
otherwise appear — not omitted, and never rendered as a zero.

## What is in it

**137 races registered for 2026** — 36 UCI WorldTour, 27 Women's WorldTour,
61 ProSeries and the 13 championship races of the World Championships — each
listed by name with a *measured* depth beside it, so a name never implies a
dataset:

| Tier | Races | What is held |
|---|---|---|
| CALENDAR | 39 | A name, dates and a UCI class. Mostly races still to come. |
| SCHEDULE | 14 | The race's own breakdown: stage dates, distances, venues, start times. |
| RESULTS | 50 | Who finished and in what order, with the final classifications. |
| ROUTE | 33 | The above, plus a route line and elevation profile. |
| FULL | 1 | Route, results, roadbook itinerary and the analytics built on them. |

A race sits at the highest tier for which **every lower tier also holds**, so
the label cannot overstate: a race with results but no route reads RESULTS.
The tier describes this project's holdings, never the race.

Depth is tracked on two independent axes underneath that ladder, because what
is known about the event and what is known about the road do not arrive
together — a route can be published years before a result exists. 84 races
hold a result; 33 hold usable, length-checked geometry.

**The fleet is the front door.** Arriving at the site shows every registered
race with its measured depth. The observatory used to open on a single stage
of a single race, which introduced a 137-race project as one afternoon in
July; an address that names a stage or a race still resolves straight to it,
so links already shared open exactly where they did.

What opens depends on what is held:

* The Tour de France 2026 is the one race at FULL, and it opens the stage
  product: 21 stages, the roadbook itinerary, elevation profiles from a
  two-DEM ensemble, derived climbs, passage windows and the weather and sun
  along the road during them.
* A race at ROUTE or RESULTS opens its own page — schedule, final
  classifications with the authority they carry, the squads that started, the
  publishers its evidence came from, and any disagreement this project found
  and did not resolve. Opening a stage row shows that stage's own placings,
  stated as the published top ten they are rather than as a finishing field.
* A race at CALENDAR opens a page that says so in words. It is not a stage
  page with the data missing, because that would read as a failed load rather
  than as an honest absence.

The fleet view also carries the one statement no single race page can make:
who has won most, across the 84 races a result is held for. It is not a season
standing and says so — a win in a race this project has not collected is
invisible there, and the number of races counted travels with every figure.

## What is not here, and why

The Evidence Vault — raw pages from race organisers, ASO route geometry,
third-party GPX traces — is recorded all-rights-reserved and
non-redistributable in the project's source ledger, so it stays in the private
repository. Retention is not redistribution.

Two things are therefore withheld from this bundle, and it says so itself in
`data/index.json` rather than leaving you to notice:

* **Third-party route traces.** Only derived, simplified profile products are
  published; the GPX stays in the vault.
* **The organiser's roadbook prose.** Its sentences describing each course
  point are its own writing. Every figure they state — final-straight length,
  carriageway width, summit altitude, gradient — is parsed out and published
  as a number instead, and each point keeps its position, category and
  kilometre. Facts about a public race are not the organiser's to withhold;
  its sentences are.

Classification standings, jersey history and stage winners derived from
English Wikipedia are used under CC BY-SA 4.0 and carry that attribution in
the manifest — as does the fleet registry, whose race names, dates, classes
and 1,620 encyclopedic placings come from the season calendar articles and
from each race's own article.

Those fleet standings are `TIER_2_ENCYCLOPEDIC` and partial: a published top
ten, stored as a top ten and never completed by inference. They are kept apart
from an organiser's own record rather than merged into it, and any race for
which this project holds official results is not touched by the encyclopedic
parser at all — 1,789 of the placings held are the organiser's own full field
rather than a sample.

Every race winner that can be checked twice, is: 82 are held against a second,
independently edited page — the season calendar against the race's own article
— and all 82 agree. Seven have no second source, and are shown as held once
rather than as corroborated.

## Limitations

`LIMITATIONS.md` is the full register: what could not lawfully be obtained,
what exists but is not trustworthy, and the known accuracy limits — including
the stages whose published geometry describes a course that was later changed,
and the Tour's final stage, shortened from 133 km to 89 km on 25 July after the
Ministry of the Interior redeployed security forces to the wildfire response —
raced from the Champs-Élysées, with its withdrawn course still withheld and no
replacement itinerary published.

Every entry there is also visible inside the product.
