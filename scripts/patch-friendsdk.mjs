import { readFile, writeFile } from "node:fs/promises";

const file = "node_modules/@rarefriends/friendsdk/src/generation-sprites.ts";
const source = await readFile(file, "utf8");
const from = 'rpcUrl: "https://rpc.mainnet.chain.robinhood.com"';
const to = 'rpcUrl: "/rpc"';

if (!source.includes(from) && !source.includes(to)) {
  throw new Error("FriendSDK RPC manifest changed; refusing to patch an unknown version.");
}

if (source.includes(from)) {
  await writeFile(file, source.replace(from, to));
  console.log("Patched FriendSDK browser RPC to same-origin /rpc");
} else {
  console.log("FriendSDK browser RPC already patched");
}
