# Rare Friends: The Hatch

A short psychological anomaly-survival horror game built for the 2026 Rare Friends Vibeathon with FriendSDK v0.1.2.

## Premise
Your verified Rare Friend is assigned one rule: keep watch over the garden and never let whatever is beneath the hatch learn that you are afraid.

The selected NFT is the playable Friend. Its token id seeds the order of anomalies, so different Friends receive different nights.

## Controls
- WASD / Arrow keys: walk
- Click/tap: move
- E / tap nearby labels: interact
- REPORT: identify the current anomaly
- SAFE: declare that nothing changed
- Ward charges: simulated 0.1 RF each, consumed for a truthful signal about whether the current round contains an anomaly

## Objective
Survive 8 watches with fewer than 3 corruption marks. Wrong reports and timeouts increase corruption. At high corruption, the thing beneath the hatch begins manifesting.

## Economy
All RF activity is simulated.
- Ward Charge: 0.1 RF
- Using a Ward always consumes one charge
- Ward reward value: 0 RF
- No gambling and no live transactions

## Local development
```bash
npm ci
npm run dev
```

## Production build
```bash
npm run build
```

Output: `dist/`.
