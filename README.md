# Rare Friends: The Hatch

**Rare Friends Vibeathon 2026 · Character Spotlight**

A psychological anomaly-survival horror game built with **FriendSDK v0.1.2**.

Your verified Rare Friend keeps watch over a familiar garden until sunrise. Each watch may contain a subtle anomaly: an object moves, disappears, duplicates, distorts, the hatch opens, or an unwanted presence appears. Report correctly before the timer expires. Three mistakes trigger containment failure.

## Why the NFT matters

- The selected owned Generations NFT is the playable character through FriendSDK.
- The Friend's token identity seeds the anomaly order, so different Friends receive different nights.
- The game's original concept was inspired by Friend #334137: Gen 6 · Mask · Garden · Hatch.
- Canonical Friend artwork is rendered by FriendSDK and is not replaced or recolored.

## Core loop

Study the garden → patrol → identify changes → report the anomaly or declare the garden safe → survive eight watches.

As corruption rises, visual interference and a hostile presence begin to manifest.

## Simulated RF economy

Ward Charges cost **0.1 simulated RF**. A Ward never pays a reward; consuming one only tells the player whether the current watch contains an anomaly. This is a deterministic utility sink rather than a gambling mechanic.

No live RF transactions occur in the Vibeathon preview.

## Controls

- WASD / Arrow keys — walk
- Click/tap — move
- REPORT — open the anomaly report
- WARD — buy/use simulated Ward Charges
- Settings — mute and reduced-motion support

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

The repository includes `wrangler.jsonc` for Cloudflare. Connected Cloudflare builds can use:

- Deploy command: `npx wrangler deploy`
- Root directory: `/`

Wrangler runs `npm run build` before deploying the generated `dist/` assets.

## Status

Vibeathon prototype under active development.
