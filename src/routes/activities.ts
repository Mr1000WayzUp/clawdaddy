import { Hono } from 'hono'

type Bindings = { DB: D1Database }
export const activitiesRouter = new Hono<{ Bindings: Bindings }>()

// GET activities (optionally filtered by entity)
activitiesRouter.get('/', async (c) => {
  const { entity_type, entity_id, limit } = c.req.query()
  let query = 'SELECT * FROM activities WHERE 1=1'
  const params: any[] = []
  if (entity_type) { query += ' AND entity_type = ?'; params.push(entity_type) }
  if (entity_id) { query += ' AND entity_id = ?'; params.push(entity_id) }
  query += ' ORDER BY created_at DESC'
  if (limit) { query += ' LIMIT ?'; params.push(parseInt(limit)) }
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(results)
})

// POST add activity manually
activitiesRouter.post('/', async (c) => {
  const { entity_type, entity_id, action, description } = await c.req.json()
  const result = await c.env.DB.prepare(
    `INSERT INTO activities (entity_type, entity_id, action, description) VALUES (?,?,?,?)`
  ).bind(entity_type, entity_id, action, description || null).run()
  const activity = await c.env.DB.prepare('SELECT * FROM activities WHERE id = ?').bind(result.meta.last_row_id).first()
  return c.json(activity, 201)
})
