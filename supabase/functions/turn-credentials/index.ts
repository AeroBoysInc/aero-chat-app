const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // JWT is already verified by Supabase's gateway — no need to re-check auth.
    const keyId = Deno.env.get("CLOUDFLARE_TURN_KEY_ID");
    const apiToken = Deno.env.get("CLOUDFLARE_TURN_API_TOKEN");

    if (!keyId || !apiToken) {
      console.error("Missing CLOUDFLARE_TURN_KEY_ID or CLOUDFLARE_TURN_API_TOKEN");
      return new Response(
        JSON.stringify({ error: "TURN not configured" }),
        {
          status: 503,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const cfRes = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 86400 }),
      },
    );

    if (!cfRes.ok) {
      const errText = await cfRes.text();
      console.error("Cloudflare TURN error:", cfRes.status, errText);
      return new Response(
        JSON.stringify({ error: "TURN credential generation failed" }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const cfData = await cfRes.json();

    return new Response(JSON.stringify(cfData), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("turn-credentials error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
