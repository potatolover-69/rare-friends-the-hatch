# Rare Friends: The Hatch

**Rare Friends Vibeathon 2026 · Character Spotlight · Token Activity · Economy Potential**

A social-deduction horror game built with FriendSDK. Your selected owned Rare Friend is the playable character in a haunted Garden where five other Friend avatars perform containment chores. One of them is secretly the Mimic.

## Character Spotlight

- The selected owned Friend is rendered from FriendSDK canonical artwork and is never recolored or replaced.
- NPC Keepers attempt to load canonical Friend artwork from other token IDs. These NPC appearances do not imply ownership or eligibility.
- Friend #334137 (Gen 6 · Mask · Garden · Hatch) drives the game's identity: Mask becomes the Mimic mechanic, Garden becomes the map, and Hatch becomes the shared objective.

## Core loop

Move through the Garden → perform containment chores → observe other Keepers doing their own chores → survive sabotage → discover/report bodies → compare every Keeper's statement during meetings → vote out the Mimic.

The Mimic deliberately behaves like a normal worker most of the time, takes occasional detours, sabotages systems, kills only when isolated, then lies during meetings. Evidence is circumstantial rather than a direct reveal.

## Lighting

The Garden now uses global moonlight and local environmental lamps instead of a player-centered darkness bubble. Blackouts dim the whole level but keep navigation readable. A purchased flashlight adds an optional directional beam.

## Prototype RF economy

The Night Market includes optional utility sinks:

- Flashlight — 0.10 RF
- UV Scanner — 0.20 RF
- Emergency Flare — 0.30 RF
- Ward — 0.10 RF

Purchases exercise FriendSDK buy/play/settle activity. The intended burn/sink behavior and the displayed **+0.40 RF win reward are simulated MVP economy concepts**, not a claim that the live Rare Friends ecosystem currently burns or distributes RF this way.

The base deduction game remains playable without purchases.

## Controls

- WASD / Arrow keys — move
- Click/tap — move
- E — use / task interaction
- R — report body
- F — toggle purchased flashlight
- Meeting — call one emergency meeting
- Shop / Gear — open the RF Night Market

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
