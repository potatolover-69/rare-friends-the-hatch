# Rare Friends: The Hatch

**Builder / contact**  
potatolover-69 · https://github.com/potatolover-69

**Categories**  
Character Spotlight · Token Activity · Economy Potential

**One sentence**  
Rare Friends: The Hatch is a social-deduction horror game where your selected Rare Friend survives a haunted Garden, watches other Friend Keepers perform chores, investigates sabotage and murders, debates testimony in meetings, and votes out the hidden Mimic while optional RF gear demonstrates a simulated token economy.

## Source

Repository: https://github.com/potatolover-69/rare-friends-the-hatch  
Submission snapshot: https://github.com/potatolover-69/rare-friends-the-hatch/tree/0eb0c58f2384524a63540601e78451978f2547c7  
Stack: React + TypeScript + Canvas 2D + FriendSDK v0.1.2

## Playable preview

**Public demo:** TODO — add final Cloudflare preview URL before opening the official PR.

The preview requires a browser wallet holding a qualifying Generations NFT (generation 1 or higher) on Robinhood mainnet (chain 4663) so FriendSDK can verify and select the Friend.

## Why Rare Friends matters

- The selected owned Generations NFT is the playable character.
- Its canonical Friend artwork is preserved.
- Friend #334137 inspired the core identity: **Mask** becomes the Mimic / deception mechanic, **Garden** becomes the level, and **Hatch** becomes the shared containment objective.
- Other Keeper slots attempt to render distinct Friend artwork for the social-deduction cast; fallback artwork is used if a public sprite read is unavailable.
- The selected Friend remains visually central throughout movement, chores, meetings, sabotage and victory/failure states.

## How to play

Move through the Garden, complete containment chores and observe the other Keepers. Every AI Keeper follows chore routes, pauses to work and builds an alibi. One Keeper is secretly the Mimic.

The Mimic behaves like a normal worker most of the time, occasionally takes detours, sabotages systems, kills only when isolated, changes route after a kill and lies during meetings.

When a body is found, either the player or an AI Keeper can report it. During the meeting, surviving Keepers describe what they were doing and who they remember seeing. The Mimic also gives testimony, but its story can be false. Compare testimony, routes and system evidence, then vote.

### Controls

- WASD / Arrow keys — move
- Click / tap — move
- E — interact / perform task
- R — report nearby body
- F — toggle purchased flashlight
- Meeting — call one emergency meeting
- Shop / Gear — open the RF Night Market

## Simulated RF economy

All costs and rewards are clearly presented as **MVP / simulated economy concepts**. They are not claims about live Rare Friends token burning or reward distribution.

Optional gear:

| Item | Simulated cost | Utility |
| --- | ---: | --- |
| Flashlight | 0.10 RF | Directional warm beam during dark periods |
| UV Scanner | 0.20 RF | Adds an extra inconsistency clue during meetings |
| Emergency Flare | 0.30 RF | Restores Garden lighting immediately |
| Ward | 0.10 RF | Cancels active Hatch sabotage |

A successful round currently displays a **simulated +0.40 RF victory reward**.

The base game remains playable without purchasing gear.

## Category fit

### Character Spotlight
The owned Friend is the main playable character and keeps its canonical artwork. The game's Mask / Garden / Hatch identity is derived directly from the selected project's Rare Friend traits.

### Token Activity
The Night Market uses FriendSDK's supported buy / play / settle flow for optional gear activity in the preview while clearly labeling the economy as simulated.

### Economy Potential
The design supports optional utility sinks, survival rewards and future multiplayer/social deduction progression without making purchases required to play.

## Checks and known issues

- FriendSDK viewport: 960 × 640.
- Keyboard and click/tap movement are implemented.
- Mute support is present.
- The game uses a pinned FriendSDK v0.1.2 commit.
- Robinhood RPC availability can be intermittent; the project currently includes a fallback transport for public Friend verification / artwork reads.
- The current build is a single-player practice lobby with AI Keepers. True multiplayer would require an authoritative realtime backend.
- Additional Friend avatar reads depend on public chain / artwork availability and can fall back to local Keeper rendering.
- Final submission should record the result of `npm run build`, `npm run check`, and browser playthrough verification before the PR is marked ready.

## Credits

Built for Rare Friends Vibeathon 2026 using FriendSDK. Canonical Rare Friend artwork and SDK game infrastructure come from FriendSDK / Rare Friends. Original game design, social-deduction systems, Garden rendering, Mimic behavior, meetings and UI are implemented in this repository.
