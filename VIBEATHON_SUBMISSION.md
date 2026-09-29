# Rare Friends: The Hatch

**Builder:** [potatolover-69](https://github.com/potatolover-69) · **Categories:** Character Spotlight · Token Activity · Economy Potential · **SDK:** FriendSDK v0.1.2

**One sentence:** A social-deduction horror game where your verified Rare Friend works through a haunted Garden, watches other Friend Keepers do real chores, survives sabotage and murders, compares their testimony in meetings, and votes out the hidden Mimic while optional simulated-RF gear demonstrates an economy loop.

- **▶ Playable preview:** https://rare-friends-the-hatch.jamiecrypto0000.workers.dev/
- **Source:** https://github.com/potatolover-69/rare-friends-the-hatch
- **Reviewed snapshot:** https://github.com/potatolover-69/rare-friends-the-hatch/tree/9296cbbe55d49b631327c601d2d8ca4771c61680
- **Requirements:** browser wallet on **Robinhood mainnet (4663)** holding a hardwired Rare Friends Generations NFT (**generation ≥ 1**). FriendSDK verifies ownership and lets the player choose the Friend.

## What did you build?

**The Hatch** is a 960 × 640 social-deduction horror game set in a realistic-feeling night Garden. Your selected Rare Friend is the playable character. Five Keeper characters roam a larger Garden between six puzzle stations — Lamp Court, Moon Pond, Central Hatch, Old Shrine, Tool Shed and Memorial Ward — stop to perform chores and build alibis. One Keeper is secretly the Mimic.

The Mimic usually behaves like a normal worker so it is difficult to identify. It takes occasional detours, sabotages the lights or Hatch, kills only when isolated, then changes route. Bodies can be reported by the player or discovered by another Keeper.

Meetings are the deduction game: a body report triggers a cinematic statement sequence where surviving Keepers are shown one-by-one on a camera-style panel and explain what they were doing and who they remember seeing. The Mimic gives testimony too, but can lie and redirect suspicion. The player compares testimony, system logs, routes and contradictions before voting.

## How does it use Rare Friends?

- **Character Spotlight:** the selected owned Generations NFT is the hero and keeps its canonical FriendSDK artwork.
- Friend #334137 inspired the game identity: **Mask** becomes the Mimic/deception mechanic, **Garden** becomes the level and **Hatch** becomes the shared containment objective.
- Other Keeper slots attempt to render distinct Friend artwork through public FriendSDK sprite reads; if a public read is unavailable the game falls back to its Keeper rendering instead of failing.
- The Friend remains central during movement, chores, reports, meetings and the end screen.

## Play it

Open **https://rare-friends-the-hatch.jamiecrypto0000.workers.dev/**, connect a wallet on Robinhood mainnet and choose a qualifying Generations Friend.

**Controls:** WASD / arrows move · click/tap moves toward a point · **E** interact / perform chore · **R** report a nearby body · **F** toggle a purchased flashlight · **M** open the full Garden map · **G** open the RF Night Market · **Meeting** calls one emergency meeting.

### Puzzle stations

- **Lamp Court — Restore the Circuit:** connect relay nodes in the maintenance order; sabotage makes the street lights flicker and die.
- **Moon Pond — Align the Reflection:** rotate three mirrors so the animated moon reflection converges on the ward.
- **Central Hatch — Lock the Bolts:** follow the carved compass sequence to reseal containment.
- **Old Shrine — Arrange the Offering:** enter the ritual symbols in the warding order.
- **Tool Shed — Replace the Fuse:** identify and install the correct service fuse and repair kit.
- **Memorial Ward — Re-anchor the Boundary:** toggle the correct memorial stones to restore the perimeter seal.

Completed stations can be sabotaged and become unstable again, forcing the player to revisit and solve them a second time.

### How a round works

1. Complete containment chores and observe where the Keepers go.
2. React to light or Hatch sabotage without losing track of other characters.
3. Find/report a body, or wait for an AI Keeper to discover it.
4. Read every Keeper's testimony.
5. Compare statements with system evidence and what you personally saw.
6. Vote. Eject the Mimic to win; eject the wrong Friend and the night continues.

## Simulated RF economy

**All purchases, sinks and rewards in this MVP are simulated concepts and are labelled as such. No claim is made that the live Rare Friends ecosystem currently burns or distributes RF this way.** The deduction game remains playable without buying gear.

| Item | Simulated cost | Utility |
|---|---:|---|
| Flashlight | 0.10 RF | Warm directional beam with a finite charge; toggle with F |
| Battery Pack | 0.10 RF | Consumable refill that restores flashlight charge to 100% |
| UV Scanner | 0.20 RF | Adds an inconsistency clue during meetings |
| Emergency Flare | 0.30 RF | Restores Garden lighting immediately |
| Ward | 0.10 RF | Cancels active Hatch sabotage |

A successful round displays a **small simulated +0.15 RF reward, increased to +0.20 RF when all six containment puzzles are completed**. Purchases use the FriendSDK preview's supported buy / play / settle path so the prototype demonstrates **Token Activity**, while the optional gear + victory reward loop demonstrates **Economy Potential**.

### Exploration, onboarding and presentation

- The Garden is expanded to a 3000 × 2100 scrolling world with named landmarks, longer routes and collision against tree trunks and rocks.
- A clickable minimap plus a full **M** map shows the player, six puzzle stations, route lines, water/landmark context and exploration landmarks without revealing Keeper positions.
- First-time players receive a eight-step animated tutorial covering movement, chores, the RF shop, flashlight batteries, reporting bodies, meeting testimony, voting and winning.
- Temporary gameplay messages use short non-blocking toast notifications instead of covering the action bar.
- Murdered Keepers stop moving, remain in a corpse pose and display a faint transparent spirit beside the body.
- Victory has a sunrise animation, particles, a count-up simulated RF reward and a post-round investigation log.

## Why the three categories fit

**Character Spotlight** — your verified Generations Friend is the playable lead, preserves canonical artwork and gives the Mask / Garden / Hatch design its identity.

**Token Activity** — optional RF-priced gear creates repeated spend decisions in the preview through FriendSDK's game action flow.

**Economy Potential** — survival utility, information tools and win rewards create a future economy loop without making spending mandatory.

## Run locally

Node.js 22+:

```sh
git clone https://github.com/potatolover-69/rare-friends-the-hatch.git
cd rare-friends-the-hatch
npm install
npm run dev
```

Production build:

```sh
npm run build
```

## Competition polish

- **Deduction-first AI:** Keepers perform visible chores, remember nearby Friends and give personality-driven testimony; AI votes use suspicion and memory rather than knowing the Mimic's identity.
- **Sneakier Mimic:** it spends most of the round following legitimate chore routes, takes short context-aware detours, avoids witnesses before kills and lies during meetings.
- **Readable horror:** global moonlight keeps navigation clear; blackout remains threatening without turning the world into a player-centered black bubble.
- **Weather/grounding:** rain, wet-ground reflections, puddle ripples, route streetlights and animated Moon Pond reflections give the procedural Garden more physical depth.
- **Premium settings:** Low/Medium/High/Ultra graphics presets, 30/60/120 FPS caps, camera zoom, brightness, fog, film grain, screen shake, reduced motion, objective hints, and separate master/music/ambience/SFX controls.
- **Procedural audio:** a low Garden drone and event stingers are synthesized in-browser, so the preview does not depend on external audio files.
- **Judge-friendly HUD:** selected Friend identity, live preview RF balance, RF spent, simulated reward messaging, contextual interaction labels and a post-round night log are visible in-game.

## Checks and known limitations

- FriendSDK viewport: **960 × 640**.
- Keyboard and click/tap movement are implemented.
- Mute support is implemented.
- FriendSDK is pinned to the Vibeathon-era v0.1.2 source commit.
- Public Robinhood RPC availability can be intermittent; the preview has a fallback public RPC transport for Friend verification/artwork reads.
- This build is a **single-player practice lobby with AI Keepers**. Real online multiplayer would require an authoritative realtime backend.
- Additional Friend avatar reads depend on public chain/artwork availability and can fall back to local Keeper rendering.
- Simulated RF progress is session-only.
- Before judging, the latest GitHub Pages workflow result should be checked together with a real-wallet playthrough.

## Credits

Built for Rare Friends Vibeathon 2026 with **FriendSDK v0.1.2**. Rare Friend canonical artwork and SDK infrastructure are from Rare Friends / FriendSDK. Garden rendering, Mimic AI, social-deduction systems, meetings, testimony, shop and UI are original to this project. Built with AI assistance.
