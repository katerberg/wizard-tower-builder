# Spell progression (leyline bands)

**Status:** Shipped. Non-dev runs start with one school spell; further spells are earned via Leyline Research rooms on height bands 25 / 50 / 75.

## Fantasy

Each tower awakens attuned to one elemental school. The wizard begins with a single spell and empty hotbar slots. Leyline energy at rows **25**, **50**, and **75** can be anchored with a **Leyline Research** room. Staff a mage through a clear night to awaken the next spell in that school — but only while the anchoring room stands.

## Run start

1. `activeSpellSchool` is chosen **uniformly at random** from fire / air / earth / water, **deterministic from `sessionSeed`**.
2. Hotbar slot 1 gets that school’s **first** spell (`fireball`, `gust`, `fault`, or `splash`). Slots 2–4 are empty; slots 5–6 stay empty.
3. A message announces the school and starter spell.
4. **Wand Strike** remains always-on auto-cast (off-hotbar).

## Leyline Research

| Piece | Detail |
|-------|--------|
| Blueprint | `leylineResearchRoom` (2×1, passable) — unlock via research node `bp-leyline-research` (requires Mana Springs) |
| Placement | Footprint must touch row **25**, **50**, or **75**; at most one leyline room per band; higher bands require prior tiers completed |
| Staffing | Cap **1** mage; allocate in the room inspector (separate from generic Research Rooms) |
| Ritual | Clear a night with ≥1 **alive stationed** mage in the room → mark that band’s tier **completed** |
| Persistence | Spell stays on the hotbar only while a leyline room still sits on that band |

### Tier → spell

| Band row | Tier | Hotbar slot |
|----------|------|-------------|
| 25 | 2 | School spell #2 |
| 50 | 3 | School spell #3 |
| 75 | 4 | School spell #4 |

Tiers are **sequential**: band 50’s ritual does nothing until tier 2 is complete.

### Loss and rebuild

- Destroying / tearing down the band’s room **immediately** removes that tier’s spell (message warns the player).
- Completed tiers are remembered: rebuilding in the same band **restores** the spell without another ritual.
- Losing a higher-tier room does not strip lower-tier spells.

## Dev mode

- Hotbar shows **all four** spells of the active school (today’s playtest kit).
- `devSetSpellSchool` still swaps the full kit.
- Band overlays still appear once the Leyline Research blueprint is unlocked.

## Explicit non-goals

- Height-clear “pick 1 of 3” spell offers (superseded by this track)
- Player-chosen school at start
- Cross-school spells (post–height-100 content)
- Substance / leyline harvest yields / mana-spring removal
- Spell bonuses on the tech tree

## Code map

| Area | Path |
|------|------|
| Config | [`src/config/spellProgression.ts`](../src/config/spellProgression.ts) |
| Helpers | [`src/model/spells/progression.ts`](../src/model/spells/progression.ts) |
| Room behavior | [`src/model/rooms/leylineResearch.ts`](../src/model/rooms/leylineResearch.ts) |
| Tests | [`src/model/spells/progression.test.ts`](../src/model/spells/progression.test.ts) |

See also [`RESEARCH.md`](RESEARCH.md) (spell track summary) and [`HEIGHT_PROGRESSION.md`](HEIGHT_PROGRESSION.md) (bands are spell-only, not enemy unlocks).
