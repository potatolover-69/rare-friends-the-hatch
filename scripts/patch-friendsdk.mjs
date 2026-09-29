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



// Friend picker history: the Robinhood public RPC limits eth_getLogs block ranges.
// Keep the SDK's owner-filtered discovery model, but page the exact same indexed
// Transfer queries instead of asking one provider call to span the whole chain.
await patch("src/owned-friends.ts", source => {
  if (source.includes("MAX_TRANSFER_BLOCKS_PER_QUERY")) return source;
  return source
    .replace(
      "const MAX_OWNED_FRIENDS = 10_000;",
      "const MAX_OWNED_FRIENDS = 10_000;\nconst MAX_TRANSFER_BLOCKS_PER_QUERY = 10_000_000n;\nconst CANONICAL_TRANSFER_START_BLOCK = 63_102_373n;"
    )
    .replace(
`  const query = { address: deployment.generations, event: TRANSFER, fromBlock: 0n, toBlock: blockNumber, strict: true } as const;
  const [received, sent] = await Promise.all([
    client.getLogs({ ...query, args: { to: account } }),
    client.getLogs({ ...query, args: { from: account } }),
  ]).catch(cause => {
    active();
    throw new Error("Could not load this account's Friend transfers. Retry with an RPC that supports owner-filtered history; the SDK will not scan the collection.", { cause });
  });
  active();`,
`  const pages = [];
  const transferStartBlock = deployment.generations.toLowerCase() === GENERATION_SPRITE_MANIFEST.generations.toLowerCase()
    ? CANONICAL_TRANSFER_START_BLOCK : 0n;
  try {
    for (let fromBlock = transferStartBlock; fromBlock <= blockNumber; fromBlock += MAX_TRANSFER_BLOCKS_PER_QUERY) {
      active();
      const pageEnd = fromBlock + MAX_TRANSFER_BLOCKS_PER_QUERY - 1n;
      const toBlock = pageEnd < blockNumber ? pageEnd : blockNumber;
      const query = { address: deployment.generations, event: TRANSFER, fromBlock, toBlock, strict: true } as const;
      pages.push(await Promise.all([
        client.getLogs({ ...query, args: { to: account } }),
        client.getLogs({ ...query, args: { from: account } }),
      ]));
      active();
    }
  } catch (cause) {
    active();
    throw new Error("Could not load this account's Friend transfers. The preview retried with paginated owner-filtered history but the RPC still failed.", { cause });
  }
  const received = pages.flatMap(([page]) => page);
  const sent = pages.flatMap(([, page]) => page);
  active();`
    );
});

// The preview iframe CSP must permit the fallback endpoint.
await patch("scripts/dev-game.mjs", source => source
  .replace(
    "connect-src 'self' https://rpc.mainnet.chain.robinhood.com;",
    "media-src 'self' blob: https://raw.githubusercontent.com; connect-src 'self' https://rpc.mainnet.chain.robinhood.com https://robinhood-rpc.publicnode.com;"
  )
);

console.log("Patched FriendSDK with Robinhood RPC fallback and paginated owner history.");
