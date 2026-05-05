import { Hono } from 'hono'

type Bindings = { DB: D1Database }
export const tasksRouter = new Hono<{ Bindings: Bindings }>()

// GET all tasks
tasksRouter.get('/', async (c) => {
  const { status, priority, search } = c.req.query()
  let query = 'SELECT * FROM tasks WHERE 1=1'
  const params: any[] = []
  if (status) { query += ' AND status = ?'; params.push(status) }
  if (priority) { query += ' AND priority = ?'; params.push(priority) }
  if (search) { query += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
  query += ' ORDER BY CASE priority WHEN "high" THEN 1 WHEN "medium" THEN 2 ELSE 3 END, due_date ASC'
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(results)
})

// GET single task
tasksRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first()
  if (!task) return c.json({ error: 'Not found' }, 404)
  return c.json(task)
})

// POST create task
tasksRouter.post('/', async (c) => {
  const body = await c.req.json()
  const { title, description, entity_type, entity_id, due_date, priority, status } = body
  if (!title) return c.json({ error: 'Title required' }, 400)
  const result = await c.env.DB.prepare(
    `INSERT INTO tasks (title, description, entity_type, entity_id, due_date, priority, status) VALUES (?,?,?,?,?,?,?)`
  ).bind(title, description||null, entity_type||null, entity_id||null, due_date||null, priority||'medium', status||'pending').run()
  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(result.meta.last_row_id).first()
  return c.json(task, 201)
})

// PUT update task
tasksRouter.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { title, description, entity_type, entity_id, due_date, priority, status } = body
  const prev = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first()
  if (!prev) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare(
    `UPDATE tasks SET title=?, description=?, entity_type=?, entity_id=?, due_date=?, priority=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(title, description||null, entity_type||null, entity_id||null, due_date||null, priority||'medium', status||'pending', id).run()
  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first()
  return c.json(task)
})

// PATCH status
tasksRouter.patch('/:id/status', async (c) => {
  const id = c.req.param('id')
  const { status } = await c.req.json()
  await c.env.DB.prepare('UPDATE tasks SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, id).run()
  return c.json({ success: true })
})

// DELETE task
tasksRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})
