import { Hono } from 'hono'

type Bindings = { DB: D1Database }
export const settingsRouter = new Hono<{ Bindings: Bindings }>()

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getCfg(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM builder_config').all()
  const m: Record<string, string> = {}
  for (const r of results as any[]) m[r.key] = r.value ?? ''
  return m
}
async function setCfg(db: D1Database, key: string, value: string) {
  await db.prepare('INSERT OR REPLACE INTO builder_config (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP)').bind(key, value).run()
}
async function getProspectorCfg(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM prospector_config').all()
  const m: Record<string, string> = {}
  for (const r of results as any[]) m[r.key] = r.value ?? ''
  return m
}
async function setProspectorCfg(db: D1Database, key: string, value: string) {
  await db.prepare('UPDATE prospector_config SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key=?').bind(value, key).run()
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/all  — full snapshot of every setting the UI needs
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.get('/all', async (c) => {
  const [cfg, prospCfg] = await Promise.all([
    getCfg(c.env.DB),
    getProspectorCfg(c.env.DB),
  ])

  // Mask secrets
  const safe = { ...cfg }
  if (safe.sendgrid_api_key?.length > 6)   safe.sendgrid_api_key   = safe.sendgrid_api_key.slice(0,6)  + '••••••••'
  if (safe.twilio_auth_token?.length > 4)  safe.twilio_auth_token  = safe.twilio_auth_token.slice(0,4) + '••••••••'
  if (safe.lovable_api_key?.length > 6)    safe.lovable_api_key    = safe.lovable_api_key.slice(0,6)   + '••••••••'
  if (safe.openai_api_key?.length > 6)     safe.openai_api_key     = safe.openai_api_key.slice(0,6)    + '••••••••'
  if (safe.stripe_secret_key?.length > 6)  safe.stripe_secret_key  = safe.stripe_secret_key.slice(0,6) + '••••••••'

  const prospSafe = { ...prospCfg }
  if (prospSafe.google_maps_api_key?.length > 6) prospSafe.google_maps_api_key = prospSafe.google_maps_api_key.slice(0,6) + '••••••••'

  return c.json({ builder: safe, prospector: prospSafe })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/settings/builder  — save any builder_config keys in bulk
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.put('/builder', async (c) => {
  const body = await c.req.json()
  for (const [key, value] of Object.entries(body)) {
    if (String(value).includes('••')) continue
    await setCfg(c.env.DB, key, String(value))
  }
  return c.json({ success: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/settings/prospector  — save any prospector_config keys in bulk
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.put('/prospector', async (c) => {
  const body = await c.req.json()
  for (const [key, value] of Object.entries(body)) {
    if (String(value).includes('••')) continue
    await setProspectorCfg(c.env.DB, key, String(value))
  }
  return c.json({ success: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/profile  — current admin user profile
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.get('/profile', async (c) => {
  const user = await c.env.DB.prepare(
    'SELECT id, full_name, business_name, email, phone, avatar_initials, avatar_color, role, bio, timezone, google_email, google_name, google_picture, auth_provider, created_at FROM app_users WHERE id=1'
  ).first()
  return c.json(user || {})
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/settings/profile  — update admin user profile
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.put('/profile', async (c) => {
  const { full_name, business_name, email, phone, bio, timezone, avatar_color } = await c.req.json()

  // Compute initials from full_name
  const initials = (full_name || 'YB').split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase()

  await c.env.DB.prepare(`
    INSERT INTO app_users (id, full_name, business_name, email, phone, bio, timezone, avatar_initials, avatar_color, updated_at)
    VALUES (1,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      full_name=excluded.full_name, business_name=excluded.business_name,
      email=excluded.email, phone=excluded.phone, bio=excluded.bio,
      timezone=excluded.timezone, avatar_initials=excluded.avatar_initials,
      avatar_color=excluded.avatar_color, updated_at=CURRENT_TIMESTAMP
  `).bind(full_name||'Your Name', business_name||'Your Business', email||'', phone||'', bio||'', timezone||'America/Chicago', initials, avatar_color||'green').run()

  return c.json({ success: true, initials })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/members  — all team members
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.get('/members', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, full_name, email, role, status, avatar_initials, avatar_color, invited_at, last_active, permissions FROM app_members ORDER BY created_at DESC'
  ).all()
  return c.json(results)
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/members  — invite a new member
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.post('/members', async (c) => {
  const { full_name, email, role } = await c.req.json()
  if (!email) return c.json({ error: 'Email required' }, 400)

  const initials = (full_name || email).split(/[\s@]/)[0].slice(0,2).toUpperCase()
  const colors = ['blue','purple','pink','orange','yellow','teal','indigo','red']
  const color = colors[Math.floor(Math.random() * colors.length)]

  try {
    await c.env.DB.prepare(`
      INSERT INTO app_members (full_name, email, role, status, avatar_initials, avatar_color)
      VALUES (?,?,?,?,?,?)
    `).bind(full_name || email.split('@')[0], email, role || 'viewer', 'invited', initials, color).run()
    return c.json({ success: true, message: `Invitation sent to ${email}` })
  } catch(e: any) {
    if (e.message?.includes('UNIQUE')) return c.json({ error: 'Member already exists' }, 409)
    return c.json({ error: 'Failed to add member' }, 500)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/settings/members/:id  — update member role/status/permissions
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.put('/members/:id', async (c) => {
  const id = c.req.param('id')
  const { role, status, permissions } = await c.req.json()

  const fields: string[] = []
  const vals: any[] = []
  if (role)        { fields.push('role=?');        vals.push(role) }
  if (status)      { fields.push('status=?');      vals.push(status) }
  if (permissions) { fields.push('permissions=?'); vals.push(JSON.stringify(permissions)) }
  fields.push('updated_at=CURRENT_TIMESTAMP')
  vals.push(id)

  await c.env.DB.prepare(`UPDATE app_members SET ${fields.join(',')} WHERE id=?`).bind(...vals).run()
  return c.json({ success: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/settings/members/:id  — remove a member
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.delete('/members/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM app_members WHERE id=?').bind(id).run()
  return c.json({ success: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/google-auth-url  — OAuth redirect URL (placeholder)
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.get('/google-auth-url', async (c) => {
  const cfg = await getCfg(c.env.DB)
  const clientId = cfg.google_oauth_client_id || ''
  const redirectUri = cfg.google_oauth_redirect_uri || `${new URL(c.req.url).origin}/auth/google/callback`

  if (!clientId) {
    return c.json({ error: 'Google OAuth Client ID not configured. Add it in Settings → Integrations.' }, 400)
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  })

  return c.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/google/callback  — OAuth callback handler
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.get('/google-callback', async (c) => {
  const { code, error } = c.req.query()
  if (error) return c.html(`<script>window.opener?.postMessage({type:'google-auth-error',error:'${error}'},'*');window.close()</script>`)
  if (!code)  return c.html(`<script>window.opener?.postMessage({type:'google-auth-error',error:'No code'},'*');window.close()</script>`)

  const cfg = await getCfg(c.env.DB)
  const clientId     = cfg.google_oauth_client_id     || ''
  const clientSecret = cfg.google_oauth_client_secret || ''
  const redirectUri  = cfg.google_oauth_redirect_uri  || `${new URL(c.req.url).origin}/api/settings/google-callback`

  if (!clientId || !clientSecret) {
    return c.html(`<script>window.opener?.postMessage({type:'google-auth-error',error:'OAuth not configured'},'*');window.close()</script>`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
    })
    const tokens: any = await tokenRes.json()
    if (tokens.error) throw new Error(tokens.error_description || tokens.error)

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })
    const googleUser: any = await userRes.json()

    // Update profile with Google info
    await c.env.DB.prepare(`
      UPDATE app_users SET google_id=?, google_email=?, google_name=?, google_picture=?, auth_provider='google', updated_at=CURRENT_TIMESTAMP WHERE id=1
    `).bind(googleUser.id, googleUser.email, googleUser.name, googleUser.picture).run()

    return c.html(`
      <html><body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px">
        <div style="font-size:48px">✓</div>
        <p style="font-size:18px;font-weight:bold">Connected as ${googleUser.name}</p>
        <p style="color:#6b7280;font-size:14px">You can close this window</p>
        <script>window.opener?.postMessage({type:'google-auth-success',email:'${googleUser.email}',name:'${googleUser.name}',picture:'${googleUser.picture}'},'*');setTimeout(()=>window.close(),1500)</script>
      </body></html>
    `)
  } catch(e: any) {
    return c.html(`<script>window.opener?.postMessage({type:'google-auth-error',error:'${e.message}'},'*');window.close()</script>`)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/disconnect-google  — remove Google link from profile
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.post('/disconnect-google', async (c) => {
  await c.env.DB.prepare(
    "UPDATE app_users SET google_id=NULL, google_email=NULL, google_name=NULL, google_picture=NULL, auth_provider='local', updated_at=CURRENT_TIMESTAMP WHERE id=1"
  ).run()
  return c.json({ success: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/zip-queue  — list all ZIP codes in the queue
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.get('/zip-queue', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT zip, city, state, priority, status, last_searched_at as last_run, leads_found FROM zip_queue ORDER BY priority ASC, id ASC LIMIT 100'
  ).all()
  return c.json(results)
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/zip-queue  — add a ZIP code
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.post('/zip-queue', async (c) => {
  const { zip, city, state } = await c.req.json()
  if (!zip) return c.json({ error: 'ZIP required' }, 400)
  try {
    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO zip_queue (zip, city, state, status, priority) VALUES (?,?,?,'pending', (SELECT COALESCE(MAX(priority),0)+1 FROM zip_queue))"
    ).bind(zip.trim(), city || '', state || '').run()
    return c.json({ success: true })
  } catch(e: any) {
    return c.json({ error: 'Failed to add ZIP' }, 500)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/settings/zip-queue/:zip  — remove a ZIP
// ─────────────────────────────────────────────────────────────────────────────
settingsRouter.delete('/zip-queue/:zip', async (c) => {
  const zip = c.req.param('zip')
  await c.env.DB.prepare('DELETE FROM zip_queue WHERE zip=?').bind(zip).run()
  return c.json({ success: true })
})
