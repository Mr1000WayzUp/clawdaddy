import { Hono } from 'hono'

type Bindings = { DB: D1Database; GOOGLE_MAPS_API_KEY?: string }
export const prospectorRouter = new Hono<{ Bindings: Bindings }>()

// ── Haversine distance in miles ──────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ── Terminal statuses – a lead is "done" when it reaches one of these ────────
const TERMINAL_STATUSES = ['won', 'lost', 'not_interested', 'already_has_website', 'do_not_contact', 'already_done']

// ── Helper: get config map ───────────────────────────────────────────────────
async function getConfig(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM prospector_config').all()
  const map: Record<string, string> = {}
  for (const r of results as any[]) map[r.key] = r.value ?? ''
  return map
}

async function setConfig(db: D1Database, key: string, value: string) {
  await db.prepare('UPDATE prospector_config SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key=?').bind(value, key).run()
}

// ── Check if a ZIP is exhausted (all leads terminal) ────────────────────────
async function isZipExhausted(db: D1Database, zip: string): Promise<boolean> {
  const total = await db.prepare(`SELECT COUNT(*) as c FROM leads WHERE city IN (SELECT city FROM zip_queue WHERE zip=?) OR address LIKE ?`).bind(zip, `%${zip}%`).first() as any
  if (!total?.c || total.c === 0) return false
  const terminal = await db.prepare(
    `SELECT COUNT(*) as c FROM leads WHERE (city IN (SELECT city FROM zip_queue WHERE zip=?) OR address LIKE ?) AND status IN (${TERMINAL_STATUSES.map(()=>'?').join(',')})`
  ).bind(zip, `%${zip}%`, ...TERMINAL_STATUSES).first() as any
  return terminal?.c >= total.c
}

// ── Advance to next nearest pending ZIP ─────────────────────────────────────
async function advanceToNextZip(db: D1Database, currentZip: string): Promise<any | null> {
  // mark current as exhausted
  await db.prepare(`UPDATE zip_queue SET status='exhausted', exhausted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE zip=?`).bind(currentZip).run()

  // get current ZIP coords
  const cur = await db.prepare('SELECT lat, lng FROM zip_queue WHERE zip=?').bind(currentZip).first() as any
  if (!cur) return null

  // find nearest pending ZIP by haversine
  const { results } = await db.prepare(`SELECT * FROM zip_queue WHERE status='pending' ORDER BY priority DESC, distance_from_seed ASC LIMIT 50`).all()
  if (!results.length) return null

  let best: any = null, bestDist = Infinity
  for (const z of results as any[]) {
    if (z.lat && z.lng) {
      const d = haversine(cur.lat, cur.lng, z.lat, z.lng)
      if (d < bestDist) { bestDist = d; best = z }
    } else {
      if (!best) best = z
    }
  }
  if (!best) return null

  await db.prepare(`UPDATE zip_queue SET status='active', updated_at=CURRENT_TIMESTAMP WHERE zip=?`).bind(best.zip).run()
  await setConfig(db, 'current_active_zip', best.zip)
  await db.prepare(`INSERT INTO activities (entity_type, entity_id, action, description) VALUES ('system',0,'zip_advanced','Auto-prospector advanced to ZIP ' || ? || ' (' || ? || ', ' || ? || ')')`).bind(best.zip, best.city, best.state).run()
  return best
}

// ── Core search function: calls Google Maps Places API ───────────────────────
async function searchPlacesForZip(
  apiKey: string, zip: string, city: string, state: string, industry: string, maxResults: number
): Promise<any[]> {
  const industryKeywords: Record<string, string> = {
    'Home Services': 'plumber OR electrician OR HVAC OR contractor',
    'Restaurant': 'restaurant OR cafe OR diner OR eatery',
    'Salon': 'hair salon OR barbershop OR nail salon OR beauty salon',
    'Auto Repair': 'auto repair OR car mechanic OR auto shop',
    'Retail': 'retail store OR shop OR boutique',
    'Healthcare': 'dentist OR chiropractor OR doctor OR clinic',
    'Legal': 'law office OR attorney OR lawyer',
    'Fitness': 'gym OR fitness center OR yoga studio',
    'Education': 'tutoring OR school OR learning center',
  }
  const keyword = industryKeywords[industry] || industry
  const query = encodeURIComponent(`${keyword} in ${city} ${state} ${zip}`)
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Places API HTTP ${res.status}`)
  const data: any = await res.json()
  if (data.status === 'REQUEST_DENIED') throw new Error(`Places API denied: ${data.error_message}`)
  return (data.results || []).slice(0, maxResults)
}

// ── Get Place Details (website, phone) ───────────────────────────────────────
async function getPlaceDetails(apiKey: string, placeId: string): Promise<any> {
  const fields = 'name,formatted_phone_number,website,formatted_address,geometry'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return {}
  const data: any = await res.json()
  return data.result || {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/prospector/config
prospectorRouter.get('/config', async (c) => {
  const cfg = await getConfig(c.env.DB)
  return c.json(cfg)
})

// PUT /api/prospector/config
prospectorRouter.put('/config', async (c) => {
  const body = await c.req.json()
  for (const [key, value] of Object.entries(body)) {
    await setConfig(c.env.DB, key, String(value))
  }
  return c.json({ success: true })
})

// GET /api/prospector/status
prospectorRouter.get('/status', async (c) => {
  const cfg = await getConfig(c.env.DB)
  const activeZip = await c.env.DB.prepare(`SELECT * FROM zip_queue WHERE status='active' LIMIT 1`).first()
  const zipStats  = await c.env.DB.prepare(`SELECT status, COUNT(*) as count FROM zip_queue GROUP BY status`).all()
  const runStats  = await c.env.DB.prepare(`SELECT COUNT(*) as total, SUM(leads_added) as leads FROM search_runs WHERE status='completed'`).first() as any
  const recentRuns = await c.env.DB.prepare(`SELECT * FROM search_runs ORDER BY started_at DESC LIMIT 10`).all()
  const pendingLeads = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM leads WHERE status NOT IN (${TERMINAL_STATUSES.map(()=>'?').join(',')})`, ).bind(...TERMINAL_STATUSES).first() as any

  return c.json({
    enabled: cfg.enabled === '1',
    cron_time: cfg.cron_time,
    seed_zip: cfg.seed_zip,
    current_active_zip: cfg.current_active_zip || cfg.seed_zip,
    last_run_at: cfg.last_run_at,
    total_leads_found: parseInt(cfg.total_leads_found || '0'),
    total_zips_worked: parseInt(cfg.total_zips_worked || '0'),
    active_zip: activeZip,
    zip_stats: zipStats.results,
    run_stats: { total_runs: runStats?.total || 0, total_leads: runStats?.leads || 0 },
    recent_runs: recentRuns.results,
    open_leads: pendingLeads?.c || 0,
    terminal_statuses: TERMINAL_STATUSES,
  })
})

// GET /api/prospector/zip-queue
prospectorRouter.get('/zip-queue', async (c) => {
  const { status, limit } = c.req.query()
  let q = 'SELECT * FROM zip_queue WHERE 1=1'
  const p: any[] = []
  if (status) { q += ' AND status=?'; p.push(status) }
  q += ' ORDER BY priority DESC, distance_from_seed ASC'
  if (limit) { q += ' LIMIT ?'; p.push(parseInt(limit)) }
  const { results } = await c.env.DB.prepare(q).bind(...p).all()
  return c.json(results)
})

// POST /api/prospector/zip-queue  – add a custom ZIP
prospectorRouter.post('/zip-queue', async (c) => {
  const { zip, city, state, lat, lng } = await c.req.json()
  if (!zip) return c.json({ error: 'zip required' }, 400)
  // calc distance from seed
  const cfg = await getConfig(c.env.DB)
  const seedZip = await c.env.DB.prepare('SELECT lat,lng FROM zip_queue WHERE zip=?').bind(cfg.seed_zip).first() as any
  const dist = (seedZip && lat && lng) ? haversine(seedZip.lat, seedZip.lng, lat, lng) : 0
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO zip_queue (zip,city,state,lat,lng,status,seed_zip,distance_from_seed) VALUES (?,?,?,?,?,'pending',?,?)`
  ).bind(zip, city||'', state||'', lat||null, lng||null, cfg.seed_zip, dist).run()
  return c.json({ success: true })
})

// GET /api/prospector/runs
prospectorRouter.get('/runs', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM search_runs ORDER BY started_at DESC LIMIT 50').all()
  return c.json(results)
})

// GET /api/prospector/discovered
prospectorRouter.get('/discovered', async (c) => {
  const { zip, status, limit } = c.req.query()
  let q = 'SELECT * FROM discovered_places WHERE 1=1'
  const p: any[] = []
  if (zip)    { q += ' AND zip=?'; p.push(zip) }
  if (status) { q += ' AND status=?'; p.push(status) }
  q += ' ORDER BY discovered_at DESC'
  q += ' LIMIT ?'; p.push(parseInt(limit||'100'))
  const { results } = await c.env.DB.prepare(q).bind(...p).all()
  return c.json(results)
})

// POST /api/prospector/run-now  – manually trigger a prospecting run
prospectorRouter.post('/run-now', async (c) => {
  const body = await c.req.json().catch(() => ({})) as any
  const cfg = await getConfig(c.env.DB)
  const apiKey = body.api_key || cfg.google_maps_api_key || c.env.GOOGLE_MAPS_API_KEY || ''

  if (!apiKey) return c.json({ error: 'Google Maps API key not configured. Add it in Settings.' }, 400)

  const activeZipRow = await c.env.DB.prepare(`SELECT * FROM zip_queue WHERE status='active' LIMIT 1`).first() as any
  if (!activeZipRow) return c.json({ error: 'No active ZIP in queue. Add a seed ZIP first.' }, 400)

  const industries = (cfg.target_industries || 'Home Services,Restaurant,Salon,Auto Repair').split(',').map(s=>s.trim()).filter(Boolean)
  const maxResults = parseInt(cfg.max_results_per_zip || '20')
  const skipHasWebsite = cfg.skip_has_website !== '0'

  const runResults: any[] = []
  let totalAdded = 0

  for (const industry of industries) {
    // create run record
    const runInsert = await c.env.DB.prepare(
      `INSERT INTO search_runs (zip,city,state,industry,status) VALUES (?,?,?,'${industry}','running')`
    ).bind(activeZipRow.zip, activeZipRow.city, activeZipRow.state).run()
    const runId = runInsert.meta.last_row_id

    try {
      const places = await searchPlacesForZip(apiKey, activeZipRow.zip, activeZipRow.city, activeZipRow.state, industry, maxResults)
      let added = 0, skipped = 0

      for (const place of places) {
        // check duplicate
        const exists = await c.env.DB.prepare('SELECT id FROM discovered_places WHERE place_id=?').bind(place.place_id).first()
        if (exists) { skipped++; continue }

        // get details for website/phone
        const details = await getPlaceDetails(apiKey, place.place_id)
        const hasWebsite = !!(details.website || place.website)

        // extract address parts
        const addr = details.formatted_address || place.formatted_address || ''
        const zipMatch = addr.match(/\b\d{5}\b/)
        const placeZip = zipMatch ? zipMatch[0] : activeZipRow.zip

        // insert into discovered_places
        const dpInsert = await c.env.DB.prepare(
          `INSERT OR IGNORE INTO discovered_places (place_id,business_name,address,city,state,zip,phone,website,has_website,lat,lng,industry,google_rating,google_review_count,status,run_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(
          place.place_id, place.name, addr,
          activeZipRow.city, activeZipRow.state, placeZip,
          details.formatted_phone_number || null,
          details.website || null,
          hasWebsite ? 1 : 0,
          place.geometry?.location?.lat || null,
          place.geometry?.location?.lng || null,
          industry,
          place.rating || null,
          place.user_ratings_total || 0,
          hasWebsite ? 'skipped_has_website' : 'new',
          runId
        ).run()

        if (hasWebsite && skipHasWebsite) { skipped++; continue }

        // check if already a lead
        const leadExists = await c.env.DB.prepare('SELECT id FROM leads WHERE business_name=? AND city=?').bind(place.name, activeZipRow.city).first()
        if (leadExists) { skipped++; await c.env.DB.prepare('UPDATE discovered_places SET status=? WHERE place_id=?').bind('skipped_duplicate', place.place_id).run(); continue }

        // add as lead
        const leadInsert = await c.env.DB.prepare(
          `INSERT INTO leads (business_name,industry,city,phone,address,status,source,notes) VALUES (?,?,?,?,?,'new','auto_prospector',?)`
        ).bind(
          place.name, industry, activeZipRow.city,
          details.formatted_phone_number || null,
          addr,
          `Auto-discovered from ZIP ${activeZipRow.zip} · Rating: ${place.rating||'N/A'} (${place.user_ratings_total||0} reviews)`
        ).run()

        await c.env.DB.prepare('UPDATE discovered_places SET status=?, lead_id=? WHERE place_id=?').bind('added_as_lead', leadInsert.meta.last_row_id, place.place_id).run()
        await c.env.DB.prepare(`INSERT INTO activities (entity_type,entity_id,action,description) VALUES ('lead',?,'auto_discovered','Auto-discovered by prospector in ZIP ' || ?)`).bind(leadInsert.meta.last_row_id, activeZipRow.zip).run()

        // Auto-queue website build if enabled
        try {
          const builderCfgRow = await c.env.DB.prepare("SELECT value FROM builder_config WHERE key='auto_build_on_discover'").first() as any
          if (builderCfgRow?.value === '1') {
            const defPkgRow = await c.env.DB.prepare("SELECT value FROM builder_config WHERE key='default_package'").first() as any
            const buildPkg = defPkgRow?.value || 'Professional'
            // Generate a minimal prompt inline (full prompt built by builder route on process)
            const leadData = { ...place, city: activeZipRow.city, state: activeZipRow.state, address: addr, phone: details.formatted_phone_number || null, industry, google_rating: place.rating, google_review_count: place.user_ratings_total || 0 }
            await c.env.DB.prepare(
              `INSERT OR IGNORE INTO website_builds (lead_id,business_name,industry,city,phone,address,package_tier,build_status,lovable_prompt) VALUES (?,?,?,?,?,?,?,'queued','[Auto-queued — process via /api/builder/process-queue]')`
            ).bind(leadInsert.meta.last_row_id, place.name, industry, activeZipRow.city, details.formatted_phone_number||null, addr, buildPkg).run()
          }
        } catch (_) { /* builder tables may not exist yet — ignore */ }

        added++
        totalAdded++
      }

      // update run record
      await c.env.DB.prepare(`UPDATE search_runs SET status='completed', leads_discovered=?, leads_added=?, leads_skipped=?, completed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(places.length, added, skipped, runId).run()
      // update zip stats
      await c.env.DB.prepare(`UPDATE zip_queue SET leads_found=leads_found+?, last_searched_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE zip=?`).bind(added, activeZipRow.zip).run()
      runResults.push({ industry, discovered: places.length, added, skipped })

    } catch (err: any) {
      await c.env.DB.prepare(`UPDATE search_runs SET status='failed', error_message=?, completed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(err.message, runId).run()
      runResults.push({ industry, error: err.message })
    }
  }

  // update global stats
  const prev = await getConfig(c.env.DB)
  await setConfig(c.env.DB, 'last_run_at', new Date().toISOString())
  await setConfig(c.env.DB, 'total_leads_found', String(parseInt(prev.total_leads_found||'0') + totalAdded))

  // check if ZIP is now exhausted → auto-advance
  let advancedTo: any = null
  if (cfg.auto_advance_zip === '1') {
    const exhausted = await isZipExhausted(c.env.DB, activeZipRow.zip)
    if (exhausted) {
      await setConfig(c.env.DB, 'total_zips_worked', String(parseInt(prev.total_zips_worked||'0') + 1))
      advancedTo = await advanceToNextZip(c.env.DB, activeZipRow.zip)
    }
  }

  return c.json({ success: true, zip: activeZipRow.zip, results: runResults, total_added: totalAdded, advanced_to: advancedTo })
})

// POST /api/prospector/check-and-advance  – check exhaustion and advance ZIP
prospectorRouter.post('/check-and-advance', async (c) => {
  const cfg = await getConfig(c.env.DB)
  const activeZip = cfg.current_active_zip || cfg.seed_zip
  const exhausted = await isZipExhausted(c.env.DB, activeZip)
  if (!exhausted) return c.json({ advanced: false, reason: 'ZIP not yet exhausted', zip: activeZip })
  const next = await advanceToNextZip(c.env.DB, activeZip)
  return c.json({ advanced: true, from: activeZip, to: next })
})

// POST /api/prospector/mark-zip-exhausted
prospectorRouter.post('/mark-zip-exhausted', async (c) => {
  const { zip } = await c.req.json()
  const cfg = await getConfig(c.env.DB)
  await advanceToNextZip(c.env.DB, zip || cfg.current_active_zip)
  const prev = await getConfig(c.env.DB)
  await setConfig(c.env.DB, 'total_zips_worked', String(parseInt(prev.total_zips_worked||'0') + 1))
  return c.json({ success: true })
})

// POST /api/prospector/reset-zip/:zip
prospectorRouter.post('/reset-zip/:zip', async (c) => {
  const zip = c.req.param('zip')
  await c.env.DB.prepare(`UPDATE zip_queue SET status='pending', leads_found=0, leads_terminal=0, last_searched_at=NULL, exhausted_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE zip=?`).bind(zip).run()
  return c.json({ success: true })
})

// GET /api/prospector/terminal-statuses
prospectorRouter.get('/terminal-statuses', async (c) => {
  return c.json(TERMINAL_STATUSES)
})

// POST /api/prospector/leads/:id/terminal  – mark a lead with a terminal status
prospectorRouter.post('/leads/:id/terminal', async (c) => {
  const id = c.req.param('id')
  const { status } = await c.req.json()
  if (!TERMINAL_STATUSES.includes(status)) return c.json({ error: 'Invalid terminal status' }, 400)
  await c.env.DB.prepare('UPDATE leads SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, id).run()
  await c.env.DB.prepare(`INSERT INTO activities (entity_type,entity_id,action,description) VALUES ('lead',?,'terminal_status','Lead marked as: ' || ?)`).bind(id, status).run()
  return c.json({ success: true })
})
