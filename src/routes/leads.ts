import { Hono } from 'hono'

type Bindings = { DB: D1Database }
export const leadsRouter = new Hono<{ Bindings: Bindings }>()

// GET all leads
leadsRouter.get('/', async (c) => {
  const { status, industry, city, search } = c.req.query()
  let query = 'SELECT * FROM leads WHERE 1=1'
  const params: any[] = []
  if (status) { query += ' AND status = ?'; params.push(status) }
  if (industry) { query += ' AND industry = ?'; params.push(industry) }
  if (city) { query += ' AND city = ?'; params.push(city) }
  if (search) { query += ' AND (business_name LIKE ? OR owner_name LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`) }
  query += ' ORDER BY created_at DESC'
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(results)
})

// GET single lead
leadsRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first()
  if (!lead) return c.json({ error: 'Not found' }, 404)
  const activities = await c.env.DB.prepare('SELECT * FROM activities WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC').bind('lead', id).all()
  const tasks = await c.env.DB.prepare('SELECT * FROM tasks WHERE entity_type = ? AND entity_id = ? ORDER BY due_date ASC').bind('lead', id).all()
  const proposals = await c.env.DB.prepare('SELECT * FROM proposals WHERE lead_id = ? ORDER BY created_at DESC').bind(id).all()
  return c.json({ lead, activities: activities.results, tasks: tasks.results, proposals: proposals.results })
})

// POST create lead
leadsRouter.post('/', async (c) => {
  const body = await c.req.json()
  const { business_name, owner_name, industry, city, phone, email, address, google_maps_url, status, notes, source } = body
  if (!business_name || !industry || !city) return c.json({ error: 'Missing required fields' }, 400)
  const result = await c.env.DB.prepare(
    `INSERT INTO leads (business_name, owner_name, industry, city, phone, email, address, google_maps_url, status, notes, source) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(business_name, owner_name||null, industry, city, phone||null, email||null, address||null, google_maps_url||null, status||'new', notes||null, source||'google_maps').run()
  await c.env.DB.prepare(`INSERT INTO activities (entity_type, entity_id, action, description) VALUES ('lead',?,'lead_created','Lead added: ' || ?)`)
    .bind(result.meta.last_row_id, business_name).run()
  const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(result.meta.last_row_id).first()
  return c.json(lead, 201)
})

// PUT update lead
leadsRouter.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { business_name, owner_name, industry, city, phone, email, address, google_maps_url, status, notes, source } = body
  const prev = await c.env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first() as any
  if (!prev) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare(
    `UPDATE leads SET business_name=?, owner_name=?, industry=?, city=?, phone=?, email=?, address=?, google_maps_url=?, status=?, notes=?, source=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(business_name, owner_name||null, industry, city, phone||null, email||null, address||null, google_maps_url||null, status, notes||null, source||'google_maps', id).run()
  if (prev.status !== status) {
    await c.env.DB.prepare(`INSERT INTO activities (entity_type, entity_id, action, description) VALUES ('lead',?,'status_change','Status changed from ' || ? || ' to ' || ?)`)
      .bind(id, prev.status, status).run()
  }
  const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first()
  return c.json(lead)
})

// DELETE lead
leadsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// PATCH status only
leadsRouter.patch('/:id/status', async (c) => {
  const id = c.req.param('id')
  const { status } = await c.req.json()
  const prev = await c.env.DB.prepare('SELECT status FROM leads WHERE id = ?').bind(id).first() as any
  await c.env.DB.prepare('UPDATE leads SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, id).run()
  if (prev && prev.status !== status) {
    await c.env.DB.prepare(`INSERT INTO activities (entity_type, entity_id, action, description) VALUES ('lead',?,'status_change','Status changed from ' || ? || ' to ' || ?)`)
      .bind(id, prev.status, status).run()
  }
  return c.json({ success: true })
})

// POST add note
leadsRouter.post('/:id/notes', async (c) => {
  const id = c.req.param('id')
  const { note } = await c.req.json()
  const lead = await c.env.DB.prepare('SELECT notes FROM leads WHERE id = ?').bind(id).first() as any
  const newNotes = lead?.notes ? lead.notes + '\n' + note : note
  await c.env.DB.prepare('UPDATE leads SET notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(newNotes, id).run()
  await c.env.DB.prepare(`INSERT INTO activities (entity_type, entity_id, action, description) VALUES ('lead',?,'note_added',?)`)
    .bind(id, note).run()
  return c.json({ success: true })
})
