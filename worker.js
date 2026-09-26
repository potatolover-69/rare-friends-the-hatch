const ROBINHOOD_RPC = "https://rpc.mainnet.chain.robinhood.com/";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/rpc") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Max-Age": "86400"
          }
        });
      }

      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      const body = await request.text();

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const upstream = await fetch(ROBINHOOD_RPC, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "accept": "application/json"
            },
            body
          });

          if (upstream.ok || attempt === 1) {
            const response = new Response(upstream.body, upstream);
            response.headers.set("Access-Control-Allow-Origin", "*");
            response.headers.set("Cache-Control", "no-store");
            return response;
          }
        } catch (error) {
          if (attempt === 1) {
            return Response.json(
              { jsonrpc: "2.0", id: null, error: { code: -32098, message: "Robinhood RPC temporarily unavailable" } },
              { status: 502, headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } }
            );
          }
        }
      }
    }

    return env.ASSETS.fetch(request);
  }
};
