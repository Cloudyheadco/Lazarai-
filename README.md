# Lazarai website

Landing page for Lazarai and GHOSTWALL_x, with a working waitlist on Cloudflare Pages.

```
lazarai-site/
├── public/index.html          the website
└── functions/api/waitlist.js  saves signups and exports the list
```

## Deploy (about 15 minutes)

Cloudflare's drag-and-drop upload does not run server functions, so deploy from GitHub.

1. **Push to GitHub.** Create a repo (for example `lazarai-site`) and push this folder to it.
2. **Create the Pages project.** Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick the repo.
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: **public**
3. **Create the storage.** Workers & Pages → KV → Create namespace → name it `lazarai-waitlist`.
4. **Connect the storage.** Your Pages project → Settings → Bindings → Add → KV namespace.
   - Variable name: **WAITLIST** (exactly this)
   - Namespace: `lazarai-waitlist`
5. **Add an export password.** Settings → Variables and Secrets → Add → type **Secret**.
   - Name: **ADMIN_TOKEN**
   - Value: a long random string (keep it somewhere safe)
6. **Redeploy** so the new settings take effect: Deployments → latest → Retry deployment.
7. **Connect lazarai.io**: your Pages project → Custom domains → Set up a custom domain → enter `lazarai.io`, then add `www.lazarai.io` too.
   - If the domain is registered outside Cloudflare, Cloudflare shows the DNS records to add at your registrar (or move the domain's nameservers to Cloudflare, which is easiest).
   - SSL is automatic. Then turn on SSL/TLS → Edge Certificates → **Always Use HTTPS**.

## Test it

Open your site, scroll to the bottom and join with your own email. You should see "You're on the list."

## Export the waitlist

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" https://lazarai.io/api/waitlist -o waitlist.csv
```

Add `?format=json` to the URL for JSON instead. You can also browse entries in the dashboard under KV → `lazarai-waitlist` (keys start with `email:`).

## Run it locally

```bash
npx wrangler pages dev public --kv WAITLIST
```

## Built-in protection

- A hidden "honeypot" field quietly discards most spam bots.
- Each IP address can sign up at most 5 times per hour.
- Duplicate emails are stored once; the visitor sees "You're already on the list."

## Moving to Buttondown later

Export the CSV above and import it into Buttondown (Subscribers → Import). Then either point the form at Buttondown, or keep this function and have it forward each signup to Buttondown's API.
# Lazarai-
