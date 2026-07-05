// Scheduler: fires the Begyn.ai blog auto-generator on a cron schedule.
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      fetch('https://begyn.online/api/blog/trigger-cron', {
        headers: { 'x-cron-key': env.CRON_SECRET },
      })
    )
  },
}
