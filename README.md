# Rare Friends: The Hatch

**Play the GitHub Pages preview:** https://rare-friends-the-hatch.jamiecrypto0000.workers.dev/

**Rare Friends Vibeathon 2026 · Character Spotlight · Token Activity · Economy Potential**

A social-deduction horror game built with FriendSDK. Your selected owned Rare Friend is the playable character in a haunted Garden where five other Friend avatars perform containment chores. One of them is secretly the Mimic.

## Character Spotlight

- The selected owned Friend is rendered from FriendSDK canonical artwork and is never recolored or replaced.
- NPC Keepers attempt to load canonical Friend artwork from other token IDs. These NPC appearances do not imply ownership or eligibility.
- Friend #334137 (Gen 6 · Mask · Garden · Hatch) drives the game's identity: Mask becomes the Mimic mechanic, Garden becomes the map, and Hatch becomes the shared objective.

## Core loop

Move through the Garden → perform containment chores → observe other Keepers doing their own chores → survive sabotage → discover/report bodies → compare every Keeper's statement during meetings → vote out the Mimic.

The Mimic deliberately behaves like a normal worker most of the time, takes occasional detours, sabotages systems, kills only when isolated, then lies during meetings. Evidence is circumstantial rather than a direct reveal.

## Puzzle tasks

The six containment stations are interactive mini-puzzles rather than one-button chores:

- Lamp Court — relay/circuit sequence
- Moon Pond — mirror/reflection alignment
- Central Hatch — containment bolt sequence
- Old Shrine — symbol-order puzzle
- Tool Shed — fuse selection and repair
- Memorial Ward — boundary-stone pattern

The Mimic can sabotage a secured station, marking it unstable and forcing the puzzle to be solved again.

## Lighting

The Garden now uses global moonlight and local environmental lamps instead of a player-centered darkness bubble. Street lamps normally illuminate the routes. A Lamp Court sabotage makes them visibly flicker before the Garden falls into a readable blackout. A purchased flashlight adds a directional beam, and rare pairs of eyes can briefly appear in the darkness before vanishing.

## Round pressure

The round now runs on an absolute six-minute wall clock. It does not pause for puzzles, shops, maps, meetings or browser tab switches. The player must secure all six stations **and** expose the Mimic before sunrise.

Sabotage is randomized across the Garden while avoiding recent repeat locations. Only one critical sabotage is active at a time, but each has a visible countdown and a catastrophic fail state if ignored. Lamp Court and Tool Shed failures can destroy the electrical system; Hatch, Pond, Shrine and Memorial failures can break containment.

Body reports use a red/blue emergency siren transition. Keeper testimony is manual-paced rather than auto-skipped, clues narrow the suspect pool without directly revealing the Mimic, and both the Mimic identity and statement variants change between rounds.

## Prototype RF economy

The Night Market includes optional utility sinks:

- Field Flashlight — 0.10 RF (a weak emergency flashlight is provided free at round start)
- Battery Pack — 0.10 RF
- UV Scanner — 0.20 RF
- Emergency Flare — 0.30 RF (temporary light only; it does not repair a sabotaged circuit)
- Ward — 0.10 RF

Purchases exercise FriendSDK buy/play/settle activity. The intended burn/sink behavior and the displayed **+0.15 to +0.20 RF win reward are simulated MVP economy concepts**, not a claim that the live Rare Friends ecosystem currently burns or distributes RF this way. Flashlight charge drains while the light is on, making Battery Packs a repeat optional utility sink.

The base deduction game remains playable without purchases.

## Controls

- WASD / Arrow keys — move
- Click/tap — move
- E — use / task interaction
- R — report body
- F — toggle purchased flashlight
- M — open/close the full Garden map
- G — open the RF Night Market
- Meeting — call one emergency meeting
- Shop / Gear — open the RF Night Market

## Competition polish

- Expanded 3000 × 2100 Garden with named landmarks, collision-aware exploration, minimap and full map
- Eight-step animated first-time tutorial explaining movement, chores, gear, battery drain, reporting, meetings and voting
- Finite flashlight charge with optional Battery Pack refills
- Frozen corpse poses plus transparent spirits for murdered Keepers
- Non-blocking toast notifications and a more readable UI font stack
- Animated sunrise victory sequence with reward count-up and particles
- Rain, puddle ripples, wet lamp reflections and moving Moon Pond highlights
- Cinematic meeting statements now show each Keeper's Rare Friend portrait when available

- Smarter social-deduction AI with real chore routes, memory and personality-driven meeting reports
- Mimic deception that avoids direct identity giveaways
- Premium sliding settings with graphics preset, FPS cap, zoom, brightness, fog, grain, motion/accessibility and full audio controls
- Procedural ambience and event stingers
- Context-sensitive interaction prompts
- Live Friend / RF economy HUD plus a post-round investigation log
- Performance presets that change world detail and particle density

## Development

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Production:

```bash
npm run build
```

The static FriendSDK preview is emitted to `dist/`.

## Deployment

Cloudflare configuration is included in `wrangler.jsonc`. Connected deployments build from `main`.

## Status

Vibeathon prototype under active development. Current gameplay is a single-player practice lobby with AI Keepers; a real multiplayer release would need an authoritative room/network backend.
