import { Hono } from 'hono'
import { isInternalRequest } from '../lib/internalAuth'
import { submitToIndexNow } from '../lib/indexnow'

type Env = {
  DB: D1Database
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
  CRON_SECRET?: string
}

export const blogRouter = new Hono<{ Bindings: Env }>()

// ── GET /api/blog — list published posts ─────────────────────────────────────
blogRouter.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 50)
  const category = c.req.query('category')
  const offset = (page - 1) * limit

  let query = "SELECT id,title,slug,excerpt,category,tags,author,views,published_at,created_at FROM blog_posts WHERE status='published'"
  const params: (string | number)[] = []

  if (category) {
    query += ' AND category=?'
    params.push(category)
  }

  query += ' ORDER BY published_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const countQuery = category
    ? "SELECT COUNT(*) as total FROM blog_posts WHERE status='published' AND category=?"
    : "SELECT COUNT(*) as total FROM blog_posts WHERE status='published'"
  const countParams = category ? [category] : []

  const [postsResult, countResult] = await Promise.all([
    env_db(c).prepare(query).bind(...params).all(),
    env_db(c).prepare(countQuery).bind(...countParams).first() as Promise<{ total: number } | null>,
  ])

  const posts = (postsResult.results || []).map((p: any) => ({
    ...p,
    tags: safeParseJson(p.tags, []),
  }))

  return c.json({
    posts,
    pagination: {
      page,
      limit,
      total: countResult?.total || 0,
      pages: Math.ceil((countResult?.total || 0) / limit),
    },
  })
})

// ── GET /api/blog/settings — get blog settings ────────────────────────────────
blogRouter.get('/settings', async (c) => {
  const rows = await env_db(c).prepare('SELECT key, value FROM blog_settings').all()
  const settings: Record<string, string | null> = {}
  for (const row of (rows.results || []) as { key: string; value: string | null }[]) {
    settings[row.key] = row.value
  }
  // Never expose API keys in the response
  delete settings['anthropic_api_key']
  delete settings['openai_api_key']
  return c.json({ settings })
})

// ── POST /api/blog/settings — update a blog setting ──────────────────────────
blogRouter.post('/settings', async (c) => {
  const body = await c.req.json<{ key: string; value: string }>()
  if (!body.key) return c.json({ error: 'key required' }, 400)

  await env_db(c)
    .prepare('INSERT OR REPLACE INTO blog_settings (key, value) VALUES (?, ?)')
    .bind(body.key, body.value)
    .run()

  return c.json({ ok: true })
})

// ── GET /api/blog/trigger-cron — manually trigger auto-generate ───────────────
// Guarded: generation makes paid AI API calls, so only the in-process cron
// (internal token) or a caller presenting CRON_SECRET may trigger it.
blogRouter.get('/trigger-cron', async (c) => {
  if (!isInternalRequest(c)) return c.json({ error: 'Unauthorized' }, 401)
  return autoGeneratePost(c)
})

// ── POST /api/blog/auto-generate — generate + publish a new AI blog post ──────
blogRouter.post('/auto-generate', async (c) => {
  if (!isInternalRequest(c)) return c.json({ error: 'Unauthorized' }, 401)
  return autoGeneratePost(c)
})

// ── POST /api/blog/update-post — edit a published post (internal only) ───────
blogRouter.post('/update-post', async (c) => {
  if (!isInternalRequest(c)) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json<{ slug: string; find?: string; replace?: string }>()
  if (!body.slug || !body.find || body.replace === undefined) {
    return c.json({ error: 'slug, find, replace required' }, 400)
  }
  const result = await env_db(c)
    .prepare(
      `UPDATE blog_posts SET
         title=REPLACE(title,?1,?2), seo_title=REPLACE(seo_title,?1,?2),
         excerpt=REPLACE(excerpt,?1,?2), seo_description=REPLACE(seo_description,?1,?2),
         content=REPLACE(content,?1,?2), updated_at=?3
       WHERE slug=?4`
    )
    .bind(body.find, body.replace, new Date().toISOString(), body.slug)
    .run()
  return c.json({ ok: true, changed: result.meta?.changes ?? 0 })
})

// ── GET /api/blog/:slug — get post by slug ────────────────────────────────────
blogRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const post = await env_db(c)
    .prepare("SELECT * FROM blog_posts WHERE slug=? AND status='published'")
    .bind(slug)
    .first() as any

  if (!post) return c.json({ error: 'Not found' }, 404)

  // Increment views
  await env_db(c)
    .prepare('UPDATE blog_posts SET views=views+1 WHERE id=?')
    .bind(post.id)
    .run()

  post.tags = safeParseJson(post.tags, [])
  post.source_urls = safeParseJson(post.source_urls, [])

  // Fetch related posts (same category, different slug, max 3)
  const related = await env_db(c)
    .prepare(
      "SELECT id,title,slug,excerpt,category,published_at FROM blog_posts WHERE status='published' AND category=? AND slug!=? ORDER BY published_at DESC LIMIT 3"
    )
    .bind(post.category, slug)
    .all()

  return c.json({ post, related: related.results || [] })
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function env_db(c: any): D1Database {
  return c.env.DB
}

function safeParseJson(val: string | null, fallback: any) {
  if (!val) return fallback
  try {
    return JSON.parse(val)
  } catch {
    return fallback
  }
}

async function autoGeneratePost(c: any): Promise<Response> {
  const db: D1Database = c.env.DB

  // 1. Check if auto-post is enabled
  const enabledRow = await db
    .prepare("SELECT value FROM blog_settings WHERE key='auto_post_enabled'")
    .first() as any
  if (enabledRow?.value !== '1') {
    return c.json({ error: 'Auto-post is disabled' }, 403)
  }

  // 2. Resolve API key (env var takes precedence over DB)
  const anthropicKey: string = c.env.ANTHROPIC_API_KEY ||
    ((await db.prepare("SELECT value FROM blog_settings WHERE key='anthropic_api_key'").first() as any)?.value || '')
  const openaiKey: string = c.env.OPENAI_API_KEY ||
    ((await db.prepare("SELECT value FROM blog_settings WHERE key='openai_api_key'").first() as any)?.value || '')

  if (!anthropicKey && !openaiKey) {
    return c.json({ error: 'No AI API key configured' }, 400)
  }

  // 3. Fetch AI news from RSS feeds
  const rssFeeds = [
    'https://techcrunch.com/category/artificial-intelligence/feed/',
    'https://www.artificialintelligence-news.com/feed/',
    'https://feeds.feedburner.com/oreilly/radar/ai',
  ]

  const articles: { title: string; description: string; link: string }[] = []

  for (const feedUrl of rssFeeds) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const resp = await fetch(feedUrl, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!resp.ok) continue
      const xml = await resp.text()

      // Parse <item> blocks
      const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []
      for (const item of itemMatches.slice(0, 5)) {
        const title = extractTag(item, 'title')
        const description = extractTag(item, 'description')
        const link = extractTag(item, 'link')
        if (title) {
          articles.push({ title, description: stripHtml(description || ''), link: link || feedUrl })
        }
        if (articles.length >= 5) break
      }
      if (articles.length >= 5) break
    } catch {
      // skip failed feed
    }
  }

  // 4. Pick topic (first article if available, otherwise generic fallback)
  const topic = articles.length > 0
    ? `${articles[0].title}\n\n${articles[0].description}`
    : 'The latest advancements in AI and how businesses can leverage them for business intelligence, automation, and competitive advantage'

  const sourceUrls = articles.slice(0, 3).map((a) => a.link)

  // 5. Build prompt
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const systemPrompt = `You are a content writer for Begyn.ai, a business intelligence platform that helps entrepreneurs and businesses leverage AI. Write SEO-optimized blog posts about AI, business intelligence, automation, and how modern businesses can use AI to grow. Today's date is ${dateStr} — when referencing the current year or writing timely content, use ${today.getFullYear()}, never an earlier year.`

  const userPrompt = `Write an 800-1200 word SEO-optimized blog post for Begyn.ai based on this AI news topic:

${topic}

Make the content relevant to entrepreneurs, business owners, and companies adopting AI for business intelligence and automation. Return ONLY valid JSON (no markdown, no code fences) with exactly these fields:
{
  "title": "...",
  "slug": "kebab-case-slug",
  "excerpt": "160 char max SEO excerpt",
  "content": "Full HTML content using h2, p, ul, strong tags",
  "category": "AI News",
  "tags": ["tag1","tag2","tag3"],
  "seo_title": "SEO optimized title under 60 chars",
  "seo_description": "Meta description under 160 chars"
}`

  // 6. Call AI
  let aiResponse = ''
  let aiError = ''

  if (anthropicKey) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })
      const data = await resp.json() as any
      if (resp.ok) {
        aiResponse = data?.content?.[0]?.text || ''
      } else {
        aiError = `Anthropic ${resp.status}: ${JSON.stringify(data)}`
      }
    } catch (e: any) {
      aiError = `Anthropic fetch error: ${e?.message}`
    }
  }

  if (!aiResponse && openaiKey) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 2500,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })
      if (resp.ok) {
        const data = await resp.json() as any
        aiResponse = data?.choices?.[0]?.message?.content || ''
      }
    } catch {
      // no AI available
    }
  }

  if (!aiResponse) {
    return c.json({ error: 'Failed to generate content from AI', detail: aiError }, 500)
  }

  // 7. Parse JSON from AI response
  let postData: any
  try {
    // Strip potential markdown code fences
    const cleaned = aiResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    postData = JSON.parse(cleaned)
  } catch {
    return c.json({ error: 'Failed to parse AI response as JSON', raw: aiResponse.substring(0, 500) }, 500)
  }

  // 8. Validate required fields
  if (!postData.title || !postData.slug || !postData.content) {
    return c.json({ error: 'AI response missing required fields' }, 500)
  }

  // Model output is untrusted — strip active HTML before it's stored/rendered
  postData.content = sanitizeArticleHtml(String(postData.content))

  // 9. Deduplicate slug
  let slug: string = slugify(postData.slug)
  const existing = await db.prepare('SELECT id FROM blog_posts WHERE slug=?').bind(slug).first()
  if (existing) {
    slug = `${slug}-${Date.now()}`
  }

  // 10. Insert into DB
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO blog_posts (title, slug, excerpt, content, category, tags, author, status, seo_title, seo_description, source_urls, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Begyn.ai Team', 'published', ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      postData.title,
      slug,
      postData.excerpt || '',
      postData.content,
      postData.category || 'AI News',
      JSON.stringify(Array.isArray(postData.tags) ? postData.tags : []),
      postData.seo_title || postData.title,
      postData.seo_description || postData.excerpt || '',
      JSON.stringify(sourceUrls),
      now,
      now,
      now
    )
    .run()

  // 11. Update last_auto_post
  await db
    .prepare("INSERT OR REPLACE INTO blog_settings (key, value) VALUES ('last_auto_post', ?)")
    .bind(now)
    .run()

  // 12. Instant-index the new post + refreshed listing (best-effort)
  await submitToIndexNow([
    `https://begyn.online/blog/${slug}`,
    'https://begyn.online/blog',
    'https://begyn.online/',
  ])

  return c.json({ ok: true, slug, title: postData.title })
}

function extractTag(xml: string, tag: string): string {
  // Handle CDATA sections
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
  if (cdataMatch) return cdataMatch[1].trim()
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? match[1].trim() : ''
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').trim().substring(0, 500)
}

// Allowlist-based sanitizer for AI-generated article HTML. Only basic
// formatting tags survive; everything else (script, iframe, event handlers,
// javascript: URLs) is removed. Runs in a Worker, so no DOM parser available.
const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i',
  'a', 'blockquote', 'code', 'pre', 'br', 'hr', 'table', 'thead', 'tbody',
  'tr', 'th', 'td',
])

function sanitizeArticleHtml(html: string): string {
  // Drop entire script/style/iframe/object/embed blocks including content
  let out = html.replace(/<(script|style|iframe|object|embed|svg|math|form)[\s\S]*?<\/\1\s*>/gi, '')
  out = out.replace(/<(script|style|iframe|object|embed|svg|math|form)[^>]*\/?>/gi, '')

  // Rewrite remaining tags: keep allowlisted ones, strip their attributes
  // (except safe href on <a>), drop everything else
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s[^<>]*)?)>/g, (full, tag, attrs) => {
    const name = tag.toLowerCase()
    if (!ALLOWED_TAGS.has(name)) return ''
    const isClosing = full.startsWith('</')
    if (isClosing) return `</${name}>`
    if (name === 'a') {
      const hrefMatch = /href\s*=\s*"([^"]*)"/i.exec(attrs) || /href\s*=\s*'([^']*)'/i.exec(attrs)
      const href = hrefMatch ? hrefMatch[1].trim() : ''
      const safeHref = /^(https?:\/\/|\/|#)/i.test(href) ? href : '#'
      return `<a href="${safeHref.replace(/"/g, '&quot;')}" rel="noopener">`
    }
    return `<${name}>`
  })

  return out
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80)
}
