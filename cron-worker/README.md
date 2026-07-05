# begyn-blog-cron

Standalone Cloudflare Worker that fires the blog auto-generator on a schedule.
Cloudflare Pages projects cannot have cron triggers, so this Worker calls
`https://begyn.online/api/blog/trigger-cron` every 4 hours with the
`CRON_SECRET` (set via `wrangler secret put CRON_SECRET --name begyn-blog-cron`;
must match the Pages project's CRON_SECRET).

Deploy: `npx wrangler deploy` from this directory.
