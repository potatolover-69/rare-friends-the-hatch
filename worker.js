
const BLOCKSCOUT_API = "https://robinhoodchain.blockscout.com/api";

function hexToDecimalString(value) {
  if (value === "latest") return "latest";
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) return null;
  return BigInt(value).toString(10);
}

async function blockscoutLogs(rpcItem) {
  const filter = rpcItem?.params?.[0];
  if (!filter || typeof filter !== "object" || !filter.address || !Array.isArray(filter.topics)) return null;

  const fromBlock = hexToDecimalString(filter.fromBlock ?? "0x0");
  const toBlock = hexToDecimalString(filter.toBlock ?? "latest");
  if (fromBlock === null || toBlock === null) return null;

  const url = new URL(BLOCKSCOUT_API);
  url.searchParams.set("module", "logs");
  url.searchParams.set("action", "getLogs");
  url.searchParams.set("fromBlock", fromBlock);
  url.searchParams.set("toBlock", toBlock);
  url.searchParams.set("address", filter.address);

  let previousTopic = null;
  for (let i = 0; i < Math.min(4, filter.topics.length); i++) {
    const topic = filter.topics[i];
    if (typeof topic === "string") {
      url.searchParams.set("topic" + i, topic);
      if (previousTopic !== null) {
        url.searchParams.set("topic" + previousTopic + "_" + i + "_opr", "and");
      }
      previousTopic = i;
    }
  }

  const response = await fetch(url.toString(), {
    headers: { "accept": "application/json", "user-agent": "rare-friends-the-hatch/1.0" }
  });
  if (!response.ok) throw new Error("Blockscout logs HTTP " + response.status);

  const data = await response.json();
  if (data?.status === "0") {
    const message = String(data?.message ?? "").toLowerCase();
    const result = String(data?.result ?? "").toLowerCase();
    if (message.includes("no") || result.includes("no records") || result.includes("no logs")) return [];
    throw new Error("Blockscout logs error: " + String(data?.result ?? data?.message ?? "unknown"));
  }
  if (!Array.isArray(data?.result)) throw new Error("Blockscout returned invalid logs");

  return data.result.map((log) => ({
    address: log.address,
    blockHash: log.blockHash ?? null,
    blockNumber: log.blockNumber,
    data: log.data ?? "0x",
    logIndex: log.logIndex,
    removed: false,
    topics: log.topics ?? [],
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex ?? "0x0"
  }));
}

const RPCS = [
  "https://rpc.mainnet.chain.robinhood.com/",
  "https://robinhood-rpc.publicnode.com/",
  "https://robinhood.drpc.org/",
  "https://robinhood.rpc.blxrbdn.com/"
];

function cors(headers = new Headers()) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "content-type");
  return headers;
}

function isCacheableRpc(payload) {
  const list = Array.isArray(payload) ? payload : [payload];
  return list.length > 0 && list.every(item =>
    item && typeof item === "object" &&
    ["eth_call", "eth_chainId", "eth_getCode", "eth_getBalance", "eth_blockNumber"].includes(item.method)
  );
}

function immutableBlockRead(payload) {
  const list = Array.isArray(payload) ? payload : [payload];
  return list.every(item => {
    if (!item || item.method !== "eth_call") return false;
    const tag = Array.isArray(item.params) ? item.params[1] : undefined;
    return typeof tag === "string" && /^0x[0-9a-f]+$/i.test(tag);
  });
}

async function proxyRpc(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors() });
  }

  const body = await request.text();
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON-RPC body" } },
      { status: 400, headers: cors(new Headers({ "Cache-Control": "no-store" })) }
    );
  }

  // FriendSDK discovers owned NFTs with owner-filtered Transfer history.
  // Public JSON-RPC endpoints often reject that full-range eth_getLogs query,
  // so answer those reads from the official Robinhood Blockscout indexer.
  if (!Array.isArray(payload) && payload?.method === "eth_getLogs") {
    try {
      const logs = await blockscoutLogs(payload);
      if (logs !== null) {
        return Response.json(
          { jsonrpc: "2.0", id: payload.id ?? null, result: logs },
          { status: 200, headers: cors(new Headers({ "Cache-Control": "public, max-age=30", "X-RPC-Upstream": "blockscout" })) }
        );
      }
    } catch (error) {
      // Fall through to ordinary JSON-RPC providers if the indexer is unavailable.
    }
  }

  // Cache identical read calls at the edge. Reads pinned to a concrete block are immutable.
  const cacheable = isCacheableRpc(payload);
  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = "/__rpc_cache__/" + encodeURIComponent(body);
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cache = caches.default;

  if (cacheable) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const headers = cors(new Headers(hit.headers));
      headers.set("X-RPC-Cache", "HIT");
      return new Response(hit.body, { status: hit.status, headers });
    }
  }

  let lastStatus = 502;
  let lastText = "";

  for (let index = 0; index < RPCS.length; index++) {
    const endpoint = RPCS[index];
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/json",
          "user-agent": "rare-friends-the-hatch/1.0"
        },
        body
      });

      const text = await upstream.text();
      lastStatus = upstream.status;
      lastText = text;

      // Retry/fail over on rate limits and transient server failures.
      if (upstream.status === 429 || upstream.status >= 500) continue;

      const headers = cors(new Headers({
        "content-type": upstream.headers.get("content-type") || "application/json",
        "Cache-Control": cacheable
          ? (immutableBlockRead(payload) ? "public, max-age=86400" : "public, max-age=15")
          : "no-store",
        "X-RPC-Upstream": String(index + 1),
        "X-RPC-Cache": "MISS"
      }));

      const response = new Response(text, { status: upstream.status, headers });

      if (cacheable && upstream.ok) {
        const ttl = immutableBlockRead(payload) ? 86400 : 15;
        const cached = new Response(text, {
          status: upstream.status,
          headers: {
            "content-type": upstream.headers.get("content-type") || "application/json",
            "Cache-Control": "public, max-age=" + ttl
          }
        });
        await cache.put(cacheKey, cached);
      }

      return response;
    } catch (error) {
      lastStatus = 502;
      lastText = error instanceof Error ? error.message : "RPC transport error";
    }
  }

  return Response.json(
    {
      jsonrpc: "2.0",
      id: Array.isArray(payload) ? null : (payload?.id ?? null),
      error: {
        code: -32098,
        message: "All Robinhood RPC providers are temporarily unavailable",
        data: { status: lastStatus, detail: lastText.slice(0, 240) }
      }
    },
    { status: 502, headers: cors(new Headers({ "Cache-Control": "no-store" })) }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/rpc") return proxyRpc(request);
    return env.ASSETS.fetch(request);
  }
};
