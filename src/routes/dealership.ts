import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

app.get('/dashboard', async (c) => {
  const db = c.env.DB
  const today = new Date().toISOString().split('T')[0]
  const in7Days = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]

  const [statsCustomers, statsDeals, statsOwed, overdue, dueSoon, recentPayments, upcomingSchedule] = await Promise.all([
    db.prepare('SELECT COUNT(*) as cnt FROM dealer_customers').first<{ cnt: number }>(),
    db.prepare("SELECT COUNT(*) as cnt FROM dealer_deals WHERE status='active'").first<{ cnt: number }>(),
    db.prepare(`
      SELECT COALESCE(SUM(d.amount_financed - COALESCE(paid.total,0)), 0) as total
      FROM dealer_deals d
      LEFT JOIN (
        SELECT deal_id, SUM(amount_paid) as total FROM dealer_payment_records GROUP BY deal_id
      ) paid ON paid.deal_id = d.id
      WHERE d.status = 'active'
    `).first<{ total: number }>(),
    db.prepare(`
      SELECT s.id, s.due_date, s.amount_due, s.status,
             d.id as deal_id, d.vehicle_year, d.vehicle_make, d.vehicle_model,
             c.id as customer_id, c.first_name, c.last_name, c.phone
      FROM dealer_payment_schedules s
      JOIN dealer_deals d ON d.id = s.deal_id
      JOIN dealer_customers c ON c.id = d.customer_id
      WHERE s.due_date < ? AND s.status NOT IN ('paid')
      ORDER BY s.due_date ASC
    `).bind(today).all(),
    db.prepare(`
      SELECT s.id, s.due_date, s.amount_due, s.status,
             d.id as deal_id, d.vehicle_year, d.vehicle_make, d.vehicle_model,
             c.id as customer_id, c.first_name, c.last_name, c.phone
      FROM dealer_payment_schedules s
      JOIN dealer_deals d ON d.id = s.deal_id
      JOIN dealer_customers c ON c.id = d.customer_id
      WHERE s.due_date >= ? AND s.due_date <= ? AND s.status NOT IN ('paid')
      ORDER BY s.due_date ASC
    `).bind(today, in7Days).all(),
    db.prepare(`
      SELECT r.*, d.vehicle_year, d.vehicle_make, d.vehicle_model,
             c.first_name, c.last_name
      FROM dealer_payment_records r
      JOIN dealer_deals d ON d.id = r.deal_id
      JOIN dealer_customers c ON c.id = d.customer_id
      ORDER BY r.created_at DESC LIMIT 10
    `).all(),
    db.prepare(`
      SELECT s.id, s.due_date, s.amount_due, s.status,
             d.id as deal_id, d.vehicle_year, d.vehicle_make, d.vehicle_model,
             c.first_name, c.last_name, c.phone
      FROM dealer_payment_schedules s
      JOIN dealer_deals d ON d.id = s.deal_id
      JOIN dealer_customers c ON c.id = d.customer_id
      WHERE s.due_date > ? AND s.status NOT IN ('paid')
      ORDER BY s.due_date ASC LIMIT 15
    `).bind(in7Days).all(),
  ])

  return c.json({
    stats: {
      total_customers: statsCustomers?.cnt ?? 0,
      active_deals: statsDeals?.cnt ?? 0,
      total_owed: statsOwed?.total ?? 0,
      overdue_count: overdue.results.length,
      due_soon_count: dueSoon.results.length,
    },
    overdue: overdue.results,
    due_soon: dueSoon.results,
    recent_payments: recentPayments.results,
    upcoming_schedule: upcomingSchedule.results,
  })
})

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────

app.get('/customers', async (c) => {
  const { search } = c.req.query()
  let q = `
    SELECT c.*,
      COUNT(DISTINCT d.id) as deal_count,
      COALESCE(SUM(d.amount_financed) - COALESCE(SUM(paid.total), 0), 0) as total_owed
    FROM dealer_customers c
    LEFT JOIN dealer_deals d ON d.customer_id = c.id AND d.status = 'active'
    LEFT JOIN (
      SELECT deal_id, SUM(amount_paid) as total FROM dealer_payment_records GROUP BY deal_id
    ) paid ON paid.deal_id = d.id
  `
  const params: any[] = []
  if (search) {
    q += ` WHERE c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?`
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
  }
  q += ' GROUP BY c.id ORDER BY c.last_name ASC, c.first_name ASC'
  const { results } = await c.env.DB.prepare(q).bind(...params).all()
  return c.json(results)
})

app.get('/customers/:id', async (c) => {
  const id = c.req.param('id')
  const customer = await c.env.DB.prepare('SELECT * FROM dealer_customers WHERE id=?').bind(id).first()
  if (!customer) return c.json({ error: 'Not found' }, 404)
  const deals = await c.env.DB.prepare(`
    SELECT d.*,
      COALESCE(SUM(r.amount_paid), 0) as total_paid,
      d.amount_financed - COALESCE(SUM(r.amount_paid), 0) as remaining_balance,
      COUNT(DISTINCT s.id) as schedule_count,
      COUNT(DISTINCT CASE WHEN s.status NOT IN ('paid') AND s.due_date < date('now') THEN s.id END) as overdue_count
    FROM dealer_deals d
    LEFT JOIN dealer_payment_records r ON r.deal_id = d.id
    LEFT JOIN dealer_payment_schedules s ON s.deal_id = d.id
    WHERE d.customer_id = ?
    GROUP BY d.id
    ORDER BY d.deal_date DESC
  `).bind(id).all()
  return c.json({ customer, deals: deals.results })
})

app.post('/customers', async (c) => {
  const b = await c.req.json()
  const { first_name, last_name, phone, email, address, city, state, zip, notes } = b
  if (!first_name || !last_name) return c.json({ error: 'first_name and last_name required' }, 400)
  const r = await c.env.DB.prepare(
    `INSERT INTO dealer_customers (first_name,last_name,phone,email,address,city,state,zip,notes) VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(first_name, last_name, phone||null, email||null, address||null, city||null, state||null, zip||null, notes||null).run()
  const customer = await c.env.DB.prepare('SELECT * FROM dealer_customers WHERE id=?').bind(r.meta.last_row_id).first()
  return c.json(customer, 201)
})

app.put('/customers/:id', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json()
  const { first_name, last_name, phone, email, address, city, state, zip, notes } = b
  if (!first_name || !last_name) return c.json({ error: 'first_name and last_name required' }, 400)
  await c.env.DB.prepare(
    `UPDATE dealer_customers SET first_name=?,last_name=?,phone=?,email=?,address=?,city=?,state=?,zip=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(first_name, last_name, phone||null, email||null, address||null, city||null, state||null, zip||null, notes||null, id).run()
  const customer = await c.env.DB.prepare('SELECT * FROM dealer_customers WHERE id=?').bind(id).first()
  return c.json(customer)
})

app.delete('/customers/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM dealer_customers WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ─── DEALS ────────────────────────────────────────────────────────────────────

app.get('/deals', async (c) => {
  const { customer_id, status } = c.req.query()
  let q = `
    SELECT d.*,
      c.first_name, c.last_name, c.phone, c.email,
      COALESCE(SUM(r.amount_paid), 0) as total_paid,
      d.amount_financed - COALESCE(SUM(r.amount_paid), 0) as remaining_balance,
      COUNT(DISTINCT s.id) as schedule_count,
      COUNT(DISTINCT CASE WHEN s.status NOT IN ('paid') AND s.due_date < date('now') THEN s.id END) as overdue_count,
      MIN(CASE WHEN s.status NOT IN ('paid') THEN s.due_date END) as next_due_date,
      MIN(CASE WHEN s.status NOT IN ('paid') THEN s.amount_due END) as next_due_amount
    FROM dealer_deals d
    JOIN dealer_customers c ON c.id = d.customer_id
    LEFT JOIN dealer_payment_records r ON r.deal_id = d.id
    LEFT JOIN dealer_payment_schedules s ON s.deal_id = d.id
    WHERE 1=1
  `
  const params: any[] = []
  if (customer_id) { q += ' AND d.customer_id=?'; params.push(customer_id) }
  if (status) { q += ' AND d.status=?'; params.push(status) }
  q += ' GROUP BY d.id ORDER BY d.deal_date DESC'
  const { results } = await c.env.DB.prepare(q).bind(...params).all()
  return c.json(results)
})

app.get('/deals/:id', async (c) => {
  const id = c.req.param('id')
  const deal = await c.env.DB.prepare(`
    SELECT d.*, c.first_name, c.last_name, c.phone, c.email, c.address,
      COALESCE(paid.total, 0) as total_paid,
      d.amount_financed - COALESCE(paid.total, 0) as remaining_balance
    FROM dealer_deals d
    JOIN dealer_customers c ON c.id = d.customer_id
    LEFT JOIN (SELECT deal_id, SUM(amount_paid) as total FROM dealer_payment_records GROUP BY deal_id) paid ON paid.deal_id = d.id
    WHERE d.id = ?
  `).bind(id).first()
  if (!deal) return c.json({ error: 'Not found' }, 404)
  const schedule = await c.env.DB.prepare(
    'SELECT * FROM dealer_payment_schedules WHERE deal_id=? ORDER BY due_date ASC'
  ).bind(id).all()
  const payments = await c.env.DB.prepare(
    'SELECT * FROM dealer_payment_records WHERE deal_id=? ORDER BY paid_date DESC'
  ).bind(id).all()
  return c.json({ deal, schedule: schedule.results, payments: payments.results })
})

app.post('/deals', async (c) => {
  const b = await c.req.json()
  const { customer_id, vehicle_year, vehicle_make, vehicle_model, vehicle_vin, vehicle_color, vehicle_stock, sale_price, down_payment, deal_date, status, notes } = b
  if (!customer_id || !sale_price || !deal_date) return c.json({ error: 'customer_id, sale_price, deal_date required' }, 400)
  const dp = parseFloat(down_payment) || 0
  const sp = parseFloat(sale_price)
  const financed = sp - dp
  const r = await c.env.DB.prepare(
    `INSERT INTO dealer_deals (customer_id,vehicle_year,vehicle_make,vehicle_model,vehicle_vin,vehicle_color,vehicle_stock,sale_price,down_payment,amount_financed,deal_date,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(customer_id, vehicle_year||null, vehicle_make||null, vehicle_model||null, vehicle_vin||null, vehicle_color||null, vehicle_stock||null, sp, dp, financed, deal_date, status||'active', notes||null).run()
  const deal = await c.env.DB.prepare('SELECT * FROM dealer_deals WHERE id=?').bind(r.meta.last_row_id).first()
  return c.json(deal, 201)
})

app.put('/deals/:id', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json()
  const { vehicle_year, vehicle_make, vehicle_model, vehicle_vin, vehicle_color, vehicle_stock, sale_price, down_payment, deal_date, status, notes } = b
  const dp = parseFloat(down_payment) || 0
  const sp = parseFloat(sale_price) || 0
  const financed = sp - dp
  await c.env.DB.prepare(
    `UPDATE dealer_deals SET vehicle_year=?,vehicle_make=?,vehicle_model=?,vehicle_vin=?,vehicle_color=?,vehicle_stock=?,sale_price=?,down_payment=?,amount_financed=?,deal_date=?,status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(vehicle_year||null, vehicle_make||null, vehicle_model||null, vehicle_vin||null, vehicle_color||null, vehicle_stock||null, sp, dp, financed, deal_date, status, notes||null, id).run()
  const deal = await c.env.DB.prepare('SELECT * FROM dealer_deals WHERE id=?').bind(id).first()
  return c.json(deal)
})

app.delete('/deals/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM dealer_deals WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ─── PAYMENT SCHEDULES ────────────────────────────────────────────────────────

app.post('/schedule', async (c) => {
  const b = await c.req.json()
  const { deal_id, due_date, amount_due, notes } = b
  if (!deal_id || !due_date || !amount_due) return c.json({ error: 'deal_id, due_date, amount_due required' }, 400)
  const r = await c.env.DB.prepare(
    `INSERT INTO dealer_payment_schedules (deal_id,due_date,amount_due,notes) VALUES (?,?,?,?)`
  ).bind(deal_id, due_date, parseFloat(amount_due), notes||null).run()
  const entry = await c.env.DB.prepare('SELECT * FROM dealer_payment_schedules WHERE id=?').bind(r.meta.last_row_id).first()
  return c.json(entry, 201)
})

app.post('/schedule/bulk', async (c) => {
  const b = await c.req.json()
  const { deal_id, entries } = b
  if (!deal_id || !Array.isArray(entries) || entries.length === 0) return c.json({ error: 'deal_id and entries[] required' }, 400)
  const inserted: any[] = []
  for (const e of entries) {
    if (!e.due_date || !e.amount_due) continue
    const r = await c.env.DB.prepare(
      `INSERT INTO dealer_payment_schedules (deal_id,due_date,amount_due,notes) VALUES (?,?,?,?)`
    ).bind(deal_id, e.due_date, parseFloat(e.amount_due), e.notes||null).run()
    inserted.push({ id: r.meta.last_row_id, ...e })
  }
  return c.json({ inserted: inserted.length, entries: inserted }, 201)
})

app.put('/schedule/:id', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json()
  const { due_date, amount_due, status, notes } = b
  await c.env.DB.prepare(
    `UPDATE dealer_payment_schedules SET due_date=?,amount_due=?,status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(due_date, parseFloat(amount_due)||0, status||'pending', notes||null, id).run()
  const entry = await c.env.DB.prepare('SELECT * FROM dealer_payment_schedules WHERE id=?').bind(id).first()
  return c.json(entry)
})

app.delete('/schedule/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM dealer_payment_schedules WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ─── PAYMENT RECORDS ─────────────────────────────────────────────────────────

app.get('/payments', async (c) => {
  const { deal_id, limit } = c.req.query()
  let q = `
    SELECT r.*, d.vehicle_year, d.vehicle_make, d.vehicle_model,
           c.first_name, c.last_name, c.phone
    FROM dealer_payment_records r
    JOIN dealer_deals d ON d.id = r.deal_id
    JOIN dealer_customers c ON c.id = d.customer_id
    WHERE 1=1
  `
  const params: any[] = []
  if (deal_id) { q += ' AND r.deal_id=?'; params.push(deal_id) }
  q += ' ORDER BY r.paid_date DESC, r.created_at DESC'
  q += ` LIMIT ${parseInt(limit as string) || 50}`
  const { results } = await c.env.DB.prepare(q).bind(...params).all()
  return c.json(results)
})

app.post('/payments', async (c) => {
  const b = await c.req.json()
  const { deal_id, schedule_id, paid_date, amount_paid, payment_method, reference_number, received_by, notes } = b
  if (!deal_id || !paid_date || !amount_paid) return c.json({ error: 'deal_id, paid_date, amount_paid required' }, 400)
  const r = await c.env.DB.prepare(
    `INSERT INTO dealer_payment_records (deal_id,schedule_id,paid_date,amount_paid,payment_method,reference_number,received_by,notes) VALUES (?,?,?,?,?,?,?,?)`
  ).bind(deal_id, schedule_id||null, paid_date, parseFloat(amount_paid), payment_method||'cash', reference_number||null, received_by||null, notes||null).run()

  // Mark linked schedule entry as paid
  if (schedule_id) {
    await c.env.DB.prepare(
      `UPDATE dealer_payment_schedules SET status='paid', updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).bind(schedule_id).run()
  }

  // Check if deal is fully paid off
  const deal = await c.env.DB.prepare('SELECT * FROM dealer_deals WHERE id=?').bind(deal_id).first() as any
  const paidTotal = await c.env.DB.prepare('SELECT COALESCE(SUM(amount_paid),0) as total FROM dealer_payment_records WHERE deal_id=?').bind(deal_id).first() as any
  if (deal && paidTotal && paidTotal.total >= deal.amount_financed) {
    await c.env.DB.prepare(`UPDATE dealer_deals SET status='paid_off', updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(deal_id).run()
  }

  const record = await c.env.DB.prepare('SELECT * FROM dealer_payment_records WHERE id=?').bind(r.meta.last_row_id).first()
  return c.json(record, 201)
})

app.delete('/payments/:id', async (c) => {
  const id = c.req.param('id')
  const record = await c.env.DB.prepare('SELECT * FROM dealer_payment_records WHERE id=?').bind(id).first() as any
  if (record?.schedule_id) {
    await c.env.DB.prepare(`UPDATE dealer_payment_schedules SET status='pending', updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(record.schedule_id).run()
  }
  await c.env.DB.prepare('DELETE FROM dealer_payment_records WHERE id=?').bind(id).run()
  return c.json({ success: true })
})

export default app
