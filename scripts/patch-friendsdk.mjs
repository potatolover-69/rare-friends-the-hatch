import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../node_modules/@rarefriends/friendsdk/", import.meta.url);
const fallbackRpc = "https://robinhood-rpc.publicnode.com";

async function patch(path, transform) {
  const url = new URL(path, root);
  const before = await readFile(url, "utf8");
  const after = transform(before);
  if (after === before) { console.log(`FriendSDK patch already applied or not needed: ${path}`); return; }
  await writeFile(url, after);
}

// Friend artwork reads: official Robinhood RPC first, then a browser-safe public fallback.
await patch("src/friend-sprites.ts", source => source
  .replace(
    'import { createPublicClient, http } from "viem";',
    'import { createPublicClient, fallback, http } from "viem";'
  )
  .replace(
    'transport: http(GENERATION_SPRITE_MANIFEST.rpcUrl, { retryCount: 1, timeout: 12_000 }),',
    'transport: fallback([http(GENERATION_SPRITE_MANIFEST.rpcUrl, { retryCount: 1, timeout: 7_000 }), http("' + fallbackRpc + '", { retryCount: 1, timeout: 7_000 })]),'
  )
);

// Wallet ownership verification / Friend picker: same fallback behavior.
await patch("src/wallet.ts", source => source
  .replace(
    'import { createPublicClient, http, isAddress, type Address, type PublicClient } from "viem";',
    'import { createPublicClient, fallback, http, isAddress, type Address, type PublicClient } from "viem";'
  )
  .replace(
    'return createPublicClient({ transport: http(options.rpcUrl ?? GENERATION_SPRITE_MANIFEST.rpcUrl, { batch: options.batch ? { wait: 50, batchSize: 50 } : false }), cacheTime: 0, pollingInterval: 1_000 });',
    'return createPublicClient({ transport: options.rpcUrl ? http(options.rpcUrl, { batch: options.batch ? { wait: 50, batchSize: 50 } : false }) : fallback([http(GENERATION_SPRITE_MANIFEST.rpcUrl, { batch: options.batch ? { wait: 50, batchSize: 50 } : false, retryCount: 1, timeout: 7_000 }), http("' + fallbackRpc + '", { batch: options.batch ? { wait: 50, batchSize: 50 } : false, retryCount: 1, timeout: 7_000 })]), cacheTime: 0, pollingInterval: 1_000 });'
  )
);

// The preview iframe CSP must permit the fallback endpoint.
await patch("scripts/dev-game.mjs", source => source
  .replace(
    "connect-src 'self' https://rpc.mainnet.chain.robinhood.com;",
    "connect-src 'self' https://rpc.mainnet.chain.robinhood.com https://robinhood-rpc.publicnode.com;"
  )
);

console.log("Patched FriendSDK with Robinhood RPC fallback.");
