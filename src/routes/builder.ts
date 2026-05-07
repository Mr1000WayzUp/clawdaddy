import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  SENDGRID_API_KEY?: string
  TWILIO_ACCOUNT_SID?: string
  TWILIO_AUTH_TOKEN?: string
  TWILIO_FROM_NUMBER?: string
  LOVABLE_API_KEY?: string
}

export const builderRouter = new Hono<{ Bindings: Bindings }>()

// ── Config helpers ────────────────────────────────────────────────────────────
async function getCfg(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM builder_config').all()
  const m: Record<string, string> = {}
  for (const r of results as any[]) m[r.key] = r.value ?? ''
  return m
}
async function setCfg(db: D1Database, key: string, value: string) {
  await db.prepare('INSERT OR REPLACE INTO builder_config (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP)').bind(key, value).run()
}

// ── Package feature sets ──────────────────────────────────────────────────────
const PACKAGES: Record<string, { features: string[]; seo: string; extras: string }> = {
  Basic: {
    features: [
      '5-page website (Home, About, Services, Gallery, Contact)',
      'Mobile-responsive design',
      'Click-to-call button',
      'Google Maps integration',
      'Contact form',
      'Social media links',
      'Business hours display',
      'Custom domain ready',
    ],
    seo: 'Basic on-page SEO (title tags, meta descriptions, alt text)',
    extras: '',
  },
  Professional: {
    features: [
      '8-page website (Home, About, Services, Gallery, Reviews, FAQ, Blog, Contact)',
      'Mobile-responsive premium design',
      'Click-to-call & click-to-email',
      'Google Maps integration',
      'Advanced contact form with auto-responder',
      'Social media feed integration',
      'Business hours & holiday schedule',
      'Photo gallery with lightbox',
      'Customer review showcase',
      'Google Business Profile optimization',
      'Analytics dashboard setup',
      'Custom domain + SSL',
    ],
    seo: 'Full SEO optimization (schema markup, local SEO, sitemap, Google Search Console setup)',
    extras: '',
  },
  Premium: {
    features: [
      'Unlimited pages — everything in Professional plus:',
      'Member portal with login/registration',
      'Online booking / appointment scheduler',
      'E-commerce store (products, cart, checkout)',
      'Live chat widget',
      'Email marketing integration',
      'Loyalty / rewards program',
      'Advanced photo & video gallery',
      'Interactive before/after gallery',
      'Customer testimonials with video embed',
      'Staff / team profiles',
      'Newsletter signup with automated sequences',
      'Social media auto-posting',
      'Custom domain + SSL + CDN',
      'Priority support & monthly updates',
    ],
    seo: `Elite SEO: technical SEO audit, monthly keyword-optimized blog posts, backlink strategy,
Google Business Profile management, local citation building, Core Web Vitals optimization,
schema markup, Open Graph tags, XML sitemap, robots.txt, Google Search Console + Analytics 4`,
    extras: 'Ongoing: weekly blog posts, monthly site audit, quarterly redesign review, member portal upgrades as needed',
  },
}

// ── Generate the Lovable prompt ───────────────────────────────────────────────
function generateLovablePrompt(lead: any, pkg: string): string {
  const p = PACKAGES[pkg] || PACKAGES['Professional']
  const industryThemes: Record<string, string> = {
    'Home Services':  'trustworthy navy & orange, tool/wrench iconography, bold CTAs',
    'Restaurant':     'warm appetizing tones (cream, deep red, gold), food photography hero, menu-forward layout',
    'Salon':          'elegant rose gold & charcoal, beauty lifestyle imagery, booking-focused',
    'Auto Repair':    'strong dark theme with red accents, car silhouettes, service-badge grid',
    'Retail':         'clean e-commerce feel, bright product photography, promotional banners',
    'Healthcare':     'clean clinical whites & teal, calming, trust signals, HIPAA-friendly',
    'Legal':          'professional navy & gold, authoritative typography, case-study highlights',
    'Fitness':        'energetic dark theme with electric blue/green, transformation gallery',
    'Education':      'friendly bright blues & yellows, student-focused, course/class listings',
  }
  const theme = industryThemes[lead.industry] || 'modern professional design with strong brand colors'

  const featureList = p.features.map(f => `  - ${f}`).join('\n')
  const rating = lead.google_rating ? `${lead.google_rating} stars (${lead.google_review_count || 0} reviews)` : 'not available'

  return `Create a STUNNING, PRODUCTION-READY, fully-responsive ${pkg} tier website for a real local business.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Business Name: ${lead.business_name}
Owner: ${lead.owner_name || 'Business Owner'}
Industry: ${lead.industry}
Location: ${lead.address || lead.city + (lead.state ? ', ' + lead.state : '')}
Phone: ${lead.phone || 'N/A'}
Email: ${lead.email || 'N/A'}
Google Rating: ${rating}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN DIRECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Theme: ${theme}
Style: Ultra-modern, high-conversion, magazine-quality
Typography: Bold hero headlines, clean body text, professional hierarchy
Imagery: Use high-quality placeholder/stock images relevant to ${lead.industry} in ${lead.city}
Animations: Subtle scroll-reveal animations, hover effects, smooth transitions
Mobile: 100% mobile-first, perfect on all screen sizes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED PAGES & FEATURES (${pkg.toUpperCase()} PACKAGE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${featureList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEO REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${p.seo}
${p.extras ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nONGOING SERVICES\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${p.extras}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Use the REAL business name "${lead.business_name}" prominently throughout
2. Phone number ${lead.phone || '[PHONE]'} must be clickable (tel: link) everywhere it appears
3. Address "${lead.address || lead.city}" must appear in footer and contact section
4. Hero section must have a strong CTA ("Call Now", "Book Today", "Get a Free Quote")
5. All sections must feel complete — NO placeholder lorem ipsum text
6. Include a trust section (years in business estimate, service guarantee, licensed & insured badges)
7. Footer must include: business name, phone, address, hours (Mon-Fri 8am-6pm, Sat 9am-4pm), copyright ${new Date().getFullYear()}
8. Google Maps embed using address: ${lead.address || lead.city}
9. Every page must load fast — optimize all assets
10. Accessibility: proper ARIA labels, alt text, keyboard navigation

Make this website so impressive that when ${lead.owner_name || 'the business owner'} sees it, they immediately want to buy it.`
}

// ── Generate outreach message ─────────────────────────────────────────────────
function generateOutreachMessage(lead: any, build: any, cfg: Record<string, string>, channel: 'email' | 'sms'): { subject?: string; body: string } {
  const ownerFirstName = lead.owner_name ? lead.owner_name.split(' ')[0] : 'there'
  const previewUrl = build.preview_url || build.lovable_project_url || '[preview link]'

  if (channel === 'sms') {
    return {
      body: `Hi ${ownerFirstName}! I'm Eric Thompson, a local web developer. I built a FREE demo website for ${lead.business_name} — check it out: ${previewUrl}

Your site includes mobile design, click-to-call, Google Maps & more. Packages start at $500.

Interested? Reply or call me: ${cfg.owner_phone}`,
    }
  }

  // Email
  const subject = `I built a free website demo for ${lead.business_name} 🚀`
  const body = `Hi ${ownerFirstName},

My name is Eric Thompson and I'm a local web developer specializing in helping ${lead.industry} businesses like yours get found online and win more customers.

I noticed that ${lead.business_name} doesn't currently have a website — so I went ahead and built you a FREE demo to show you exactly what your business could look like online.

👉 VIEW YOUR FREE WEBSITE DEMO:
${previewUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S INCLUDED IN YOUR DEMO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Professional mobile-responsive design
✅ Click-to-call button (customers call you directly)
✅ Google Maps integration
✅ Your services showcased beautifully
✅ Contact form so customers can reach you 24/7
✅ SEO-optimized so Google can find you

━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUR PACKAGES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔹 Basic      — $500–$800   (5-page site, mobile, contact form)
🔸 Professional — $1,200–$2,000 (8 pages, SEO, Google Business)
💎 Premium    — $2,500–$3,500 (full site, booking, member portal, ongoing SEO)

All packages include: domain setup, hosting, SSL certificate, and 30 days of free support.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHY THIS MATTERS FOR YOU:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 97% of consumers search online before visiting a local business
• Businesses with websites earn 39% more revenue than those without
• Your competitors are already online — let's get you ahead of them

I'd love to hop on a quick 10-minute call to walk you through the demo and answer any questions.

📞 Call/Text: ${cfg.owner_phone}
📧 Email: ${cfg.owner_email}
🌐 I serve the ${lead.city} area

No pressure, no obligation — just a free demo built specifically for ${lead.business_name}.

Looking forward to hearing from you,

Eric Developing Thompson
Local Web Developer | ${lead.city} Area
📞 ${cfg.owner_phone}
📧 ${cfg.owner_email}

P.S. The demo I built for you took me time and effort — I made it specifically for ${lead.business_name}. Even if you're not ready today, I'd love to hear your thoughts on it!`

  return { subject, body }
}

// ── Send email via SendGrid ───────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, body: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
  if (!apiKey) return { success: false, error: 'SendGrid API key not configured' }
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'e.w.Thompson10.10@gmail.com', name: 'Eric Thompson - Local Web Developer' },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    })
    if (res.status === 202) return { success: true }
    const err = await res.text()
    return { success: false, error: err }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ── Send SMS via Twilio ───────────────────────────────────────────────────────
async function sendSMS(to: string, body: string, sid: string, token: string, from: string): Promise<{ success: boolean; error?: string }> {
  if (!sid || !token || !from) return { success: false, error: 'Twilio credentials not configured' }
  // Clean phone number - keep only digits and +
  const cleanTo = to.replace(/[^\d+]/g, '')
  const formattedTo = cleanTo.startsWith('+') ? cleanTo : `+1${cleanTo}`
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: formattedTo, From: from, Body: body }).toString(),
    })
    const data: any = await res.json()
    if (data.sid) return { success: true }
    return { success: false, error: data.message || 'Unknown Twilio error' }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ── Launch Lovable project via API ────────────────────────────────────────────
async function launchLovableProject(prompt: string, businessName: string, apiKey: string): Promise<{ url?: string; projectId?: string; error?: string }> {
  if (!apiKey) {
    // Return a simulated URL for demo mode (no API key)
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    return {
      url: `https://lovable.app/projects/demo-${slug}-${Date.now().toString(36)}`,
      projectId: `demo-${Date.now().toString(36)}`,
    }
  }
  try {
    const res = await fetch('https://api.lovable.app/v1/projects', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: businessName, prompt }),
    })
    if (!res.ok) {
      const err = await res.text()
      return { error: `Lovable API error ${res.status}: ${err}` }
    }
    const data: any = await res.json()
    return { url: data.url || data.project_url, projectId: data.id || data.project_id }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/builder/config
builderRouter.get('/config', async (c) => {
  const cfg = await getCfg(c.env.DB)
  // Mask sensitive keys
  const safe = { ...cfg }
  if (safe.sendgrid_api_key) safe.sendgrid_api_key = safe.sendgrid_api_key.slice(0, 6) + '••••••••'
  if (safe.twilio_auth_token) safe.twilio_auth_token = safe.twilio_auth_token.slice(0, 4) + '••••••••'
  if (safe.lovable_api_key) safe.lovable_api_key = safe.lovable_api_key.slice(0, 6) + '••••••••'
  return c.json(safe)
})

// PUT /api/builder/config
builderRouter.put('/config', async (c) => {
  const body = await c.req.json()
  for (const [key, value] of Object.entries(body)) {
    // Don't overwrite masked values
    if (String(value).includes('••')) continue
    await setCfg(c.env.DB, key, String(value))
  }
  return c.json({ success: true })
})

// GET /api/builder/stats
builderRouter.get('/stats', async (c) => {
  const total    = await c.env.DB.prepare('SELECT COUNT(*) as c FROM website_builds').first() as any
  const byStatus = await c.env.DB.prepare('SELECT build_status, COUNT(*) as count FROM website_builds GROUP BY build_status').all()
  const outreach = await c.env.DB.prepare('SELECT outreach_status, COUNT(*) as count FROM website_builds GROUP BY outreach_status').all()
  const recent   = await c.env.DB.prepare('SELECT wb.*, l.phone, l.email FROM website_builds wb LEFT JOIN leads l ON wb.lead_id=l.id ORDER BY wb.created_at DESC LIMIT 20').all()
  return c.json({
    total_builds: total?.c || 0,
    by_status: byStatus.results,
    outreach_stats: outreach.results,
    recent_builds: recent.results,
  })
})

// GET /api/builder/builds
builderRouter.get('/builds', async (c) => {
  const { status, limit } = c.req.query()
  let q = 'SELECT wb.*, l.phone as lead_phone, l.email as lead_email FROM website_builds wb LEFT JOIN leads l ON wb.lead_id=l.id WHERE 1=1'
  const p: any[] = []
  if (status) { q += ' AND wb.build_status=?'; p.push(status) }
  q += ' ORDER BY wb.created_at DESC LIMIT ?'; p.push(parseInt(limit || '50'))
  const { results } = await c.env.DB.prepare(q).bind(...p).all()
  return c.json(results)
})

// GET /api/builder/builds/:id
builderRouter.get('/builds/:id', async (c) => {
  const id = c.req.param('id')
  const build = await c.env.DB.prepare('SELECT wb.*, l.phone as lead_phone, l.email as lead_email FROM website_builds wb LEFT JOIN leads l ON wb.lead_id=l.id WHERE wb.id=?').bind(id).first()
  if (!build) return c.json({ error: 'Not found' }, 404)
  const logs = await c.env.DB.prepare('SELECT * FROM outreach_log WHERE build_id=? ORDER BY sent_at DESC').bind(id).all()
  return c.json({ build, outreach_log: logs.results })
})

// POST /api/builder/build  – generate a website for a lead
builderRouter.post('/build', async (c) => {
  const body = await c.req.json() as any
  const { lead_id, package_tier, auto_outreach } = body

  if (!lead_id) return c.json({ error: 'lead_id required' }, 400)

  const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(lead_id).first() as any
  if (!lead) return c.json({ error: 'Lead not found' }, 404)

  const cfg = await getCfg(c.env.DB)
  const pkg = package_tier || cfg.default_package || 'Professional'

  // Check if build already exists for this lead
  const existing = await c.env.DB.prepare('SELECT id FROM website_builds WHERE lead_id=? AND build_status NOT IN (?,?)').bind(lead_id, 'failed', 'cancelled').first()
  if (existing) return c.json({ error: 'A build already exists for this lead', existing_id: (existing as any).id }, 409)

  // Generate Lovable prompt
  const prompt = generateLovablePrompt({ ...lead, state: (lead.address || '').includes('TX') ? 'TX' : (lead.city || '') }, pkg)

  // Insert build record
  const insert = await c.env.DB.prepare(
    `INSERT INTO website_builds (lead_id,business_name,industry,city,phone,email,address,owner_name,google_rating,google_review_count,package_tier,build_status,lovable_prompt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,'generating',?)`
  ).bind(
    lead_id, lead.business_name, lead.industry, lead.city,
    lead.phone || null, lead.email || null, lead.address || null, lead.owner_name || null,
    lead.google_rating || null, lead.google_review_count || 0, pkg, prompt
  ).run()
  const buildId = insert.meta.last_row_id

  // Launch Lovable project
  const lovableApiKey = cfg.lovable_api_key || c.env.LOVABLE_API_KEY || ''
  const lovable = await launchLovableProject(prompt, lead.business_name, lovableApiKey)

  if (lovable.error) {
    await c.env.DB.prepare('UPDATE website_builds SET build_status=?,error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind('failed', lovable.error, buildId).run()
    return c.json({ error: lovable.error, build_id: buildId }, 500)
  }

  // Update build with Lovable URL
  await c.env.DB.prepare(
    'UPDATE website_builds SET build_status=?,lovable_project_url=?,preview_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).bind('generated', lovable.url, lovable.url, buildId).run()

  // Log activity
  await c.env.DB.prepare(
    `INSERT INTO activities (entity_type,entity_id,action,description) VALUES ('lead',?,'website_built','Website demo built (${pkg} package) — ${lovable.url}')`
  ).bind(lead_id).run()

  // Auto-outreach if enabled
  let outreachResult: any = null
  const shouldOutreach = auto_outreach !== undefined ? auto_outreach : cfg.auto_outreach === '1'
  if (shouldOutreach && (lead.email || lead.phone)) {
    const buildRow = { preview_url: lovable.url, lovable_project_url: lovable.url }
    outreachResult = await performOutreach(c.env.DB, buildId, lead, buildRow, cfg, c.env)
  }

  // Update lead status
  await c.env.DB.prepare("UPDATE leads SET status='demo_sent', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='new'").bind(lead_id).run()

  // Update stats
  const prevTotal = parseInt(cfg.total_builds || '0')
  await setCfg(c.env.DB, 'total_builds', String(prevTotal + 1))

  return c.json({
    success: true,
    build_id: buildId,
    preview_url: lovable.url,
    lovable_project_url: lovable.url,
    package: pkg,
    outreach: outreachResult,
  })
})

// ── Core outreach function ────────────────────────────────────────────────────
async function performOutreach(db: D1Database, buildId: number, lead: any, build: any, cfg: Record<string, string>, env: Bindings): Promise<any> {
  const results: any = { email: null, sms: null }

  // Email outreach
  if (lead.email) {
    const msg = generateOutreachMessage(lead, build, cfg, 'email')
    const apiKey = cfg.sendgrid_api_key?.includes('••') ? (env.SENDGRID_API_KEY || '') : (cfg.sendgrid_api_key || env.SENDGRID_API_KEY || '')
    const emailResult = await sendEmail(lead.email, msg.subject!, msg.body, apiKey)
    results.email = emailResult

    await db.prepare('INSERT INTO outreach_log (build_id,lead_id,channel,recipient,subject,message,status) VALUES (?,?,?,?,?,?,?)')
      .bind(buildId, lead.id, 'email', lead.email, msg.subject, msg.body, emailResult.success ? 'sent' : 'failed').run()

    if (emailResult.success) {
      await db.prepare('UPDATE website_builds SET outreach_email_sent=1, outreach_message=?, outreach_sent_at=CURRENT_TIMESTAMP, outreach_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .bind(msg.body, 'sent', buildId).run()
      await db.prepare(`INSERT INTO activities (entity_type,entity_id,action,description) VALUES ('lead',?,'outreach_sent','Outreach email sent to ${lead.email}')`)
        .bind(lead.id).run()
      const prevSent = parseInt((await db.prepare("SELECT value FROM builder_config WHERE key='total_outreach_sent'").first() as any)?.value || '0')
      await setCfg(db, 'total_outreach_sent', String(prevSent + 1))
    }
  }

  // SMS outreach
  if (lead.phone) {
    const msg = generateOutreachMessage(lead, build, cfg, 'sms')
    const sid   = cfg.twilio_account_sid?.includes('••') ? (env.TWILIO_ACCOUNT_SID || '') : (cfg.twilio_account_sid || env.TWILIO_ACCOUNT_SID || '')
    const token = cfg.twilio_auth_token?.includes('••')  ? (env.TWILIO_AUTH_TOKEN || '')  : (cfg.twilio_auth_token || env.TWILIO_AUTH_TOKEN || '')
    const from  = cfg.twilio_from_number || env.TWILIO_FROM_NUMBER || ''
    const smsResult = await sendSMS(lead.phone, msg.body, sid, token, from)
    results.sms = smsResult

    await db.prepare('INSERT INTO outreach_log (build_id,lead_id,channel,recipient,message,status) VALUES (?,?,?,?,?,?)')
      .bind(buildId, lead.id, 'sms', lead.phone, msg.body, smsResult.success ? 'sent' : 'failed').run()

    if (smsResult.success) {
      await db.prepare('UPDATE website_builds SET outreach_sms_sent=1, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(buildId).run()
      await db.prepare(`INSERT INTO activities (entity_type,entity_id,action,description) VALUES ('lead',?,'sms_sent','Outreach SMS sent to ${lead.phone}')`)
        .bind(lead.id).run()
    }
  }

  return results
}

// POST /api/builder/outreach/:buildId  – manually trigger outreach for a build
builderRouter.post('/outreach/:buildId', async (c) => {
  const buildId = parseInt(c.req.param('buildId'))
  const build = await c.env.DB.prepare('SELECT * FROM website_builds WHERE id=?').bind(buildId).first() as any
  if (!build) return c.json({ error: 'Build not found' }, 404)
  const lead  = await c.env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(build.lead_id).first() as any
  if (!lead)  return c.json({ error: 'Lead not found' }, 404)
  const cfg = await getCfg(c.env.DB)
  const result = await performOutreach(c.env.DB, buildId, lead, build, cfg, c.env)
  return c.json({ success: true, result })
})

// GET /api/builder/preview-prompt/:leadId  – preview the prompt without building
builderRouter.get('/preview-prompt/:leadId', async (c) => {
  const leadId = c.req.param('leadId')
  const pkg    = c.req.query('package') || 'Professional'
  const lead   = await c.env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(leadId).first() as any
  if (!lead) return c.json({ error: 'Lead not found' }, 404)
  const prompt = generateLovablePrompt(lead, pkg)
  const msg    = generateOutreachMessage(lead, { preview_url: '[preview URL will go here]' }, {
    owner_name: 'Eric Developing Thompson', owner_phone: '(985)860-7891', owner_email: 'e.w.Thompson10.10@gmail.com'
  }, 'email')
  return c.json({ prompt, outreach_preview: msg, package: pkg, features: PACKAGES[pkg]?.features })
})

// POST /api/builder/bulk-build  – queue builds for all eligible leads
builderRouter.post('/bulk-build', async (c) => {
  const body = await c.req.json().catch(() => ({})) as any
  const limit = parseInt(body.limit || '10')
  // Get leads with no website, no existing build
  const { results } = await c.env.DB.prepare(`
    SELECT l.* FROM leads l
    LEFT JOIN website_builds wb ON wb.lead_id = l.id AND wb.build_status NOT IN ('failed','cancelled')
    WHERE l.has_website = 0 AND wb.id IS NULL AND l.status NOT IN ('won','lost','not_interested','already_has_website','do_not_contact','already_done')
    ORDER BY l.created_at DESC LIMIT ?
  `).bind(limit).all()

  const queued: any[] = []
  for (const lead of results as any[]) {
    const cfg = await getCfg(c.env.DB)
    const pkg = body.package_tier || cfg.default_package || 'Professional'
    const prompt = generateLovablePrompt(lead, pkg)
    const insert = await c.env.DB.prepare(
      `INSERT INTO website_builds (lead_id,business_name,industry,city,phone,email,address,owner_name,package_tier,build_status,lovable_prompt) VALUES (?,?,?,?,?,?,?,?,?,'queued',?)`
    ).bind(lead.id, lead.business_name, lead.industry, lead.city, lead.phone||null, lead.email||null, lead.address||null, lead.owner_name||null, pkg, prompt).run()
    queued.push({ lead_id: lead.id, business_name: lead.business_name, build_id: insert.meta.last_row_id })
  }

  return c.json({ success: true, queued_count: queued.length, builds: queued })
})

// POST /api/builder/process-queue  – process queued builds (called by cron or manually)
builderRouter.post('/process-queue', async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM website_builds WHERE build_status='queued' ORDER BY created_at ASC LIMIT 5").all()
  if (!results.length) return c.json({ processed: 0 })

  const cfg = await getCfg(c.env.DB)
  const lovableApiKey = cfg.lovable_api_key || c.env.LOVABLE_API_KEY || ''
  let processed = 0

  for (const build of results as any[]) {
    await c.env.DB.prepare("UPDATE website_builds SET build_status='generating' WHERE id=?").bind(build.id).run()
    const lovable = await launchLovableProject(build.lovable_prompt, build.business_name, lovableApiKey)

    if (lovable.error) {
      await c.env.DB.prepare('UPDATE website_builds SET build_status=?,error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind('failed', lovable.error, build.id).run()
    } else {
      await c.env.DB.prepare('UPDATE website_builds SET build_status=?,lovable_project_url=?,preview_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind('generated', lovable.url, lovable.url, build.id).run()
      processed++

      if (cfg.auto_outreach === '1') {
        const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(build.lead_id).first() as any
        if (lead) await performOutreach(c.env.DB, build.id, lead, { preview_url: lovable.url }, cfg, c.env)
      }
    }
  }

  return c.json({ processed, total_queued: results.length })
})

// DELETE /api/builder/builds/:id
builderRouter.delete('/builds/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('UPDATE website_builds SET build_status=? WHERE id=?').bind('cancelled', id).run()
  return c.json({ success: true })
})

// PUT /api/builder/builds/:id  – update build (e.g. add published URL, notes)
builderRouter.put('/builds/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json() as any
  const fields: string[] = []
  const vals: any[] = []
  const allowed = ['build_status', 'preview_url', 'published_url', 'outreach_status', 'notes']
  for (const k of allowed) {
    if (body[k] !== undefined) { fields.push(`${k}=?`); vals.push(body[k]) }
  }
  if (!fields.length) return c.json({ error: 'No valid fields' }, 400)
  fields.push('updated_at=CURRENT_TIMESTAMP')
  vals.push(id)
  await c.env.DB.prepare(`UPDATE website_builds SET ${fields.join(',')} WHERE id=?`).bind(...vals).run()
  return c.json({ success: true })
})
