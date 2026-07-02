# Changelog

## 2026-07-02 — Domain repoint

- Moved `elite-writer.insightprofit.live` from the old elite-writer-app project to **elite-writer-v5** on Vercel (founder-approved reuse, no new domain minted).
- Vercel side done; the domain still 404s because Cloudflare DNS for `elite-writer.insightprofit.live` points at a non-Vercel origin. DNS record must be changed to CNAME `cname.vercel-dns.com` (see ops report 2026-07-02).
- RESOLVED: root cause was a missing DNS record (no `elite-writer` record existed; requests fell through to the zone catch-all → VPS 404). Founder added CNAME `elite-writer` → `cname.vercel-dns.com` (proxied) in Cloudflare; Vercel SSL cert force-issued via API (`cert_wohRWZgsyQQAgrd4pzdz5vcB`) after a transient 525. Verified 200, serving Elite Writer V5.
