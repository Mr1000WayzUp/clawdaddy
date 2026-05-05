import { Hono } from 'hono'

type Bindings = { DB: D1Database }
export const analyticsRouter = new Hono<{ Bindings: Bindings }>()

// GET dashboard summary stats
analyticsRouter.get('/summary', async (c) => {
  const [
    totalLeads,
    newLeads,
    contactedLeads,
    wonLeads,
    lostLeads,
    totalClients,
    activeClients,
    totalRevenue,
    monthlyRecurring,
    totalProposals,
    sentProposals,
    acceptedProposals,
    pendingTasks,
    overdueTasks,
  ] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM leads').first() as any,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM leads WHERE status='new'").first() as any,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM leads WHERE status IN ('contacted','demo_sent','proposal_sent')").first() as any,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM leads WHERE status='won'").first() as any,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM leads WHERE status='lost'").first() as any,
    c.env.DB.prepare('SELECT COUNT(*) as count FROM clients').first() as any,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM clients WHERE status='active'").first() as any,
    c.env.DB.prepare('SELECT COALESCE(SUM(package_price),0) as total FROM clients').first() as any,
    c.env.DB.prepare("SELECT COALESCE(SUM(recurring_fee),0) as total FROM clients WHERE status='active'").first() as any,
    c.env.DB.prepare('SELECT COUNT(*) as count FROM proposals').first() as any,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM proposals WHERE status='sent'").first() as any,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM proposals WHERE status='accepted'").first() as any,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM tasks WHERE status != 'done'").first() as any,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM tasks WHERE status != 'done' AND due_date < datetime('now')").first() as any,
  ])

  const conversionRate = totalLeads?.count > 0
    ? Math.round((wonLeads?.count / totalLeads?.count) * 100)
    : 0

  return c.json({
    leads: {
      total: totalLeads?.count || 0,
      new: newLeads?.count || 0,
      contacted: contactedLeads?.count || 0,
      won: wonLeads?.count || 0,
      lost: lostLeads?.count || 0,
      conversionRate,
    },
    clients: {
      total: totalClients?.count || 0,
      active: activeClients?.count || 0,
    },
    revenue: {
      total: totalRevenue?.total || 0,
      monthly: monthlyRecurring?.total || 0,
      annualRecurring: (monthlyRecurring?.total || 0) * 12,
    },
    proposals: {
      total: totalProposals?.count || 0,
      sent: sentProposals?.count || 0,
      accepted: acceptedProposals?.count || 0,
    },
    tasks: {
      pending: pendingTasks?.count || 0,
      overdue: overdueTasks?.count || 0,
    }
  })
})

// GET leads by status (for pipeline chart)
analyticsRouter.get('/leads-by-status', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM leads GROUP BY status ORDER BY count DESC`
  ).all()
  return c.json(results)
})

// GET leads by industry
analyticsRouter.get('/leads-by-industry', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT industry, COUNT(*) as count FROM leads GROUP BY industry ORDER BY count DESC LIMIT 8`
  ).all()
  return c.json(results)
})

// GET revenue by month (clients grouped by start_date month)
analyticsRouter.get('/revenue-by-month', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', start_date) as month, 
      COUNT(*) as deals, 
      SUM(package_price) as revenue
     FROM clients 
     GROUP BY month 
     ORDER BY month DESC 
     LIMIT 12`
  ).all()
  return c.json(results.reverse())
})

// GET clients by package tier
analyticsRouter.get('/clients-by-package', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT package_tier, COUNT(*) as count, SUM(package_price) as revenue FROM clients GROUP BY package_tier`
  ).all()
  return c.json(results)
})

// GET recent activities
analyticsRouter.get('/recent-activity', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM activities ORDER BY created_at DESC LIMIT 20`
  ).all()
  return c.json(results)
})

// GET leads by city
analyticsRouter.get('/leads-by-city', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT city, COUNT(*) as count FROM leads GROUP BY city ORDER BY count DESC LIMIT 10`
  ).all()
  return c.json(results)
})
