# Rare Friends: The Hatch

**Builder:** [potatolover-69](https://github.com/potatolover-69) · **Categories:** Character Spotlight · Token Activity · Economy Potential · **SDK:** FriendSDK v0.1.2

**One sentence:** A social-deduction horror game where your verified Rare Friend works through a haunted Garden, watches other Friend Keepers do real chores, survives sabotage and murders, compares their testimony in meetings, and votes out the hidden Mimic while optional simulated-RF gear demonstrates an economy loop.

- **▶ Playable preview:** https://potatolover-69.github.io/rare-friends-the-hatch/
- **Source:** https://github.com/potatolover-69/rare-friends-the-hatch
- **Reviewed snapshot:** https://github.com/potatolover-69/rare-friends-the-hatch/tree/9296cbbe55d49b631327c601d2d8ca4771c61680
- **Requirements:** browser wallet on **Robinhood mainnet (4663)** holding a hardwired Rare Friends Generations NFT (**generation ≥ 1**). FriendSDK verifies ownership and lets the player choose the Friend.

## What did you build?

**The Hatch** is a 960 × 640 social-deduction horror game set in a realistic-feeling night Garden. Your selected Rare Friend is the playable character. Five Keeper characters move between Lamp Court, Moon Pond, Central Hatch and Old Shrine, stop to perform chores and build alibis. One Keeper is secretly the Mimic.

The Mimic usually behaves like a normal worker so it is difficult to identify. It takes occasional detours, sabotages the lights or Hatch, kills only when isolated, then changes route. Bodies can be reported by the player or discovered by another Keeper.

Meetings are the deduction game: every survivor gives a report based on what it was doing and who it remembers seeing. The Mimic gives testimony too, but can lie and redirect suspicion. The player compares testimony, system logs, routes and contradictions before voting.

## How does it use Rare Friends?

- **Character Spotlight:** the selected owned Generations NFT is the hero and keeps its canonical FriendSDK artwork.
- Friend #334137 inspired the game identity: **Mask** becomes the Mimic/deception mechanic, **Garden** becomes the level and **Hatch** becomes the shared containment objective.
- Other Keeper slots attempt to render distinct Friend artwork through public FriendSDK sprite reads; if a public read is unavailable the game falls back to its Keeper rendering instead of failing.
- The Friend remains central during movement, chores, reports, meetings and the end screen.

## Play it

Open **https://potatolover-69.github.io/rare-friends-the-hatch/**, connect a wallet on Robinhood mainnet and choose a qualifying Generations Friend.

**Controls:** WASD / arrows move · click/tap moves toward a point · **E** interact / perform chore · **R** report a nearby body · **F** toggle a purchased flashlight · **Meeting** calls one emergency meeting · **Shop / Gear** opens the RF Night Market.

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
| Flashlight | 0.10 RF | Warm directional beam, toggle with F |
| UV Scanner | 0.20 RF | Adds an inconsistency clue during meetings |
| Emergency Flare | 0.30 RF | Restores Garden lighting immediately |
| Ward | 0.10 RF | Cancels active Hatch sabotage |

A successful round displays a **simulated +0.40 RF victory reward**. Purchases use the FriendSDK preview's supported buy / play / settle path so the prototype demonstrates **Token Activity**, while the optional gear + victory reward loop demonstrates **Economy Potential**.

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
