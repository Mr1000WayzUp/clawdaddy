import { Hono } from 'hono'

type Bindings = { DB: D1Database }
export const clientsRouter = new Hono<{ Bindings: Bindings }>()

// GET all clients
clientsRouter.get('/', async (c) => {
  const { status, industry, city, search } = c.req.query()
  let query = 'SELECT * FROM clients WHERE 1=1'
  const params: any[] = []
  if (status) { query += ' AND status = ?'; params.push(status) }
  if (industry) { query += ' AND industry = ?'; params.push(industry) }
  if (city) { query += ' AND city = ?'; params.push(city) }
  if (search) { query += ' AND (business_name LIKE ? OR owner_name LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`) }
  query += ' ORDER BY created_at DESC'
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(results)
})

// GET single client
clientsRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const client = await c.env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first()
  if (!client) return c.json({ error: 'Not found' }, 404)
  const activities = await c.env.DB.prepare('SELECT * FROM activities WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC').bind('client', id).all()
  const tasks = await c.env.DB.prepare('SELECT * FROM tasks WHERE entity_type = ? AND entity_id = ? ORDER BY due_date ASC').bind('client', id).all()
  return c.json({ client, activities: activities.results, tasks: tasks.results })
})

// POST create client
clientsRouter.post('/', async (c) => {
  const body = await c.req.json()
  const { lead_id, business_name, owner_name, industry, city, phone, email, address, package_tier, package_price, recurring_fee, website_url, status, notes } = body
  if (!business_name || !industry || !city || !package_tier || !package_price) return c.json({ error: 'Missing required fields' }, 400)
  const result = await c.env.DB.prepare(
    `INSERT INTO clients (lead_id, business_name, owner_name, industry, city, phone, email, address, package_tier, package_price, recurring_fee, website_url, status, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(lead_id||null, business_name, owner_name||null, industry, city, phone||null, email||null, address||null, package_tier, package_price, recurring_fee||0, website_url||null, status||'active', notes||null).run()

  if (lead_id) {
    await c.env.DB.prepare('UPDATE leads SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind('won', lead_id).run()
    await c.env.DB.prepare(`INSERT INTO activities (entity_type, entity_id, action, description) VALUES ('lead',?,'status_change','Status changed to won - converted to client')`)
      .bind(lead_id).run()
  }
  await c.env.DB.prepare(`INSERT INTO activities (entity_type, entity_id, action, description) VALUES ('client',?,'client_created','New client onboarded: ' || ?)`)
    .bind(result.meta.last_row_id, business_name).run()
  const client = await c.env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(result.meta.last_row_id).first()
  return c.json(client, 201)
})

// PUT update client
clientsRouter.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { business_name, owner_name, industry, city, phone, email, address, package_tier, package_price, recurring_fee, website_url, status, notes } = body
  const prev = await c.env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first() as any
  if (!prev) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare(
    `UPDATE clients SET business_name=?, owner_name=?, industry=?, city=?, phone=?, email=?, address=?, package_tier=?, package_price=?, recurring_fee=?, website_url=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(business_name, owner_name||null, industry, city, phone||null, email||null, address||null, package_tier, package_price, recurring_fee||0, website_url||null, status, notes||null, id).run()
  if (prev.status !== status) {
    await c.env.DB.prepare(`INSERT INTO activities (entity_type, entity_id, action, description) VALUES ('client',?,'status_change','Status changed from ' || ? || ' to ' || ?)`)
      .bind(id, prev.status, status).run()
  }
  const client = await c.env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first()
  return c.json(client)
})

// DELETE client
clientsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM clients WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})
