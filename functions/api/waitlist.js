// Cloudflare Pages Function: /api/waitlist
// POST  { email }            -> saves the email to the WAITLIST KV namespace
// GET   ?format=csv|json     -> exports the list (requires header: Authorization: Bearer <ADMIN_TOKEN>)
//
// Bindings (set in Cloudflare dashboard > your Pages project > Settings):
//   WAITLIST     KV namespace binding
//   ADMIN_TOKEN  environment variable (secret) used to export the list

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.WAITLIST) {
    return json({ error: "The waitlist isn't set up yet. Please try again later." }, 503);
  }

  let data = {};
  const type = request.headers.get("Content-Type") || "";
  try {
    if (type.includes("application/json")) {
      data = await request.json();
    } else {
      data = Object.fromEntries(await request.formData());
    }
  } catch {
    return json({ error: "That request couldn't be read. Refresh the page and try again." }, 400);
  }

  // Honeypot: real people never fill the hidden "company" field.
  if (data.company) return json({ ok: true });

  const email = String(data.email || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ error: "Enter a full email address, like you@example.com." }, 400);
  }

  // Basic rate limit: 5 signups per IP per hour.
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateKey = `rate:${ip}`;
  const hits = parseInt((await env.WAITLIST.get(rateKey)) || "0", 10);
  if (hits >= 5) {
    return json({ error: "Too many signups from this connection. Try again in an hour." }, 429);
  }
  await env.WAITLIST.put(rateKey, String(hits + 1), { expirationTtl: 3600 });

  const key = `email:${email}`;
  if (await env.WAITLIST.get(key)) return json({ ok: true, already: true });

  await env.WAITLIST.put(
    key,
    JSON.stringify({
      email,
      joined: new Date().toISOString(),
      country: request.cf?.country || null,
      source: new URL(request.url).hostname,
    })
  );

  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return json({ error: "Not authorized." }, 401);
  }
  if (!env.WAITLIST) return json({ error: "WAITLIST binding is missing." }, 503);

  const rows = [];
  let cursor;
  do {
    const page = await env.WAITLIST.list({ prefix: "email:", cursor });
    for (const k of page.keys) {
      const v = await env.WAITLIST.get(k.name);
      if (v) rows.push(JSON.parse(v));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  rows.sort((a, b) => a.joined.localeCompare(b.joined));

  const format = new URL(request.url).searchParams.get("format");
  if (format === "json") return json({ count: rows.length, signups: rows });

  const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const csv = ["email,joined,country,source"]
    .concat(rows.map((r) => [r.email, r.joined, r.country, r.source].map(esc).join(",")))
    .join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lazarai-waitlist.csv"',
      "Cache-Control": "no-store",
    },
  });
}
