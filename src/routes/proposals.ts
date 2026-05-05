import { Hono } from 'hono'

type Bindings = { DB: D1Database }
export const proposalsRouter = new Hono<{ Bindings: Bindings }>()

// GET all proposals
proposalsRouter.get('/', async (c) => {
  const { status, search } = c.req.query()
  let query = 'SELECT * FROM proposals WHERE 1=1'
  const params: any[] = []
  if (status) { query += ' AND status = ?'; params.push(status) }
  if (search) { query += ' AND (business_name LIKE ? OR owner_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
  query += ' ORDER BY created_at DESC'
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(results)
})

// GET single proposal
proposalsRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const proposal = await c.env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(id).first()
  if (!proposal) return c.json({ error: 'Not found' }, 404)
  return c.json(proposal)
})

// POST create proposal
proposalsRouter.post('/', async (c) => {
  const body = await c.req.json()
  const { lead_id, client_id, business_name, owner_name, package_tier, package_price, recurring_fee, features, custom_message, status } = body
  if (!business_name || !package_tier || !package_price) return c.json({ error: 'Missing required fields' }, 400)
  const featuresStr = Array.isArray(features) ? features.join(',') : (features || '')
  const result = await c.env.DB.prepare(
    `INSERT INTO proposals (lead_id, client_id, business_name, owner_name, package_tier, package_price, recurring_fee, features, custom_message, status) VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).bind(lead_id||null, client_id||null, business_name, owner_name||null, package_tier, package_price, recurring_fee||0, featuresStr, custom_message||null, status||'draft').run()

  if (status === 'sent' && lead_id) {
    await c.env.DB.prepare('UPDATE leads SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind('proposal_sent', lead_id).run()
    await c.env.DB.prepare(`INSERT INTO activities (entity_type, entity_id, action, description) VALUES ('lead',?,'proposal_sent','Proposal sent: ' || ?)`)
      .bind(lead_id, business_name).run()
  }
  await c.env.DB.prepare(`INSERT INTO activities (entity_type, entity_id, action, description) VALUES ('proposal',?,'proposal_created','Proposal created for ' || ?)`)
    .bind(result.meta.last_row_id, business_name).run()

  const proposal = await c.env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(result.meta.last_row_id).first()
  return c.json(proposal, 201)
})

// PUT update proposal
proposalsRouter.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { lead_id, client_id, business_name, owner_name, package_tier, package_price, recurring_fee, features, custom_message, status } = body
  const prev = await c.env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(id).first() as any
  if (!prev) return c.json({ error: 'Not found' }, 404)
  const featuresStr = Array.isArray(features) ? features.join(',') : (features || '')

  let sentAt = prev.sent_at
  let acceptedAt = prev.accepted_at
  if (status === 'sent' && prev.status !== 'sent') sentAt = new Date().toISOString()
  if (status === 'accepted' && prev.status !== 'accepted') acceptedAt = new Date().toISOString()

  await c.env.DB.prepare(
    `UPDATE proposals SET lead_id=?, client_id=?, business_name=?, owner_name=?, package_tier=?, package_price=?, recurring_fee=?, features=?, custom_message=?, status=?, sent_at=?, accepted_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(lead_id||null, client_id||null, business_name, owner_name||null, package_tier, package_price, recurring_fee||0, featuresStr, custom_message||null, status, sentAt||null, acceptedAt||null, id).run()

  if (prev.status !== status) {
    if (status === 'sent' && lead_id) {
      await c.env.DB.prepare('UPDATE leads SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind('proposal_sent', lead_id).run()
    }
    await c.env.DB.prepare(`INSERT INTO activities (entity_type, entity_id, action, description) VALUES ('proposal',?,'status_change','Proposal status: ' || ? || ' → ' || ?)`)
      .bind(id, prev.status, status).run()
  }
  const proposal = await c.env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(id).first()
  return c.json(proposal)
})

// DELETE proposal
proposalsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM proposals WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})
