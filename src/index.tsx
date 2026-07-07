import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { leadsRouter } from './routes/leads'
import { clientsRouter } from './routes/clients'
import { proposalsRouter } from './routes/proposals'
import { tasksRouter } from './routes/tasks'
import { analyticsRouter } from './routes/analytics'
import { activitiesRouter } from './routes/activities'
import { prospectorRouter } from './routes/prospector'
import { builderRouter } from './routes/builder'
import paymentsRouter from './routes/payments'
import { settingsRouter } from './routes/settings'
import { blogRouter } from './routes/blog'
import { getInternalToken, isInternalRequest } from './lib/internalAuth'
import { INDEXNOW_KEY, submitToIndexNow } from './lib/indexnow'

type Bindings = {
  DB: D1Database
  GOOGLE_MAPS_API_KEY?: string
  SENDGRID_API_KEY?: string
  TWILIO_ACCOUNT_SID?: string
  TWILIO_AUTH_TOKEN?: string
  TWILIO_FROM_NUMBER?: string
  LOVABLE_API_KEY?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_PUBLISHABLE_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
}

type CronEnv = Bindings

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// API Routes
app.route('/api/leads', leadsRouter)
app.route('/api/clients', clientsRouter)
app.route('/api/proposals', proposalsRouter)
app.route('/api/tasks', tasksRouter)
app.route('/api/analytics', analyticsRouter)
app.route('/api/activities', activitiesRouter)
app.route('/api/prospector', prospectorRouter)
app.route('/api/builder', builderRouter)
app.route('/api/payments', paymentsRouter)
app.route('/api/settings', settingsRouter)
app.route('/api/blog', blogRouter)

// ─── AI CHAT ENDPOINT ─────────────────────────────────────────────────────────
app.post('/api/chat', async (c) => {
  let body: { message?: string; history?: { role: string; content: string }[] }
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const message = typeof body.message === 'string' ? body.message.trim().substring(0, 1500) : ''
  if (!message) return c.json({ error: 'message required' }, 400)

  const rawHistory = Array.isArray(body.history) ? body.history : []
  const safeHistory = rawHistory
    .slice(-8)
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).substring(0, 600) }))

  const anthropicKey: string = (c.env as any).ANTHROPIC_API_KEY || ''
  const openaiKey: string = (c.env as any).OPENAI_API_KEY || ''

  const systemPrompt = `You are Bea, the friendly AI assistant for Begyn.ai — an AI-powered business intelligence platform for entrepreneurs and businesses of all sizes. Help visitors understand our products, answer questions, handle customer service issues, and guide people toward the right plan.

## About Begyn.ai
Begyn.ai provides enterprise-grade AI business intelligence at startup-friendly prices. Tagline: "BI from Begyn — Where AI Meets Business." We help any business compete with Fortune 500 companies using powerful AI tools.

## Our 6 Products
1. Begyn Intelligence — Real-time AI analytics that turns business data into plain-English insights. No data analyst needed.
2. Begyn Voice — 24/7 AI voice agents that answer calls, qualify leads, and book appointments automatically.
3. Begyn Leads — AI-powered lead generation and scoring for any industry. Find best customers before competitors do.
4. Begyn Automate — Workflow automation that connects existing tools and eliminates manual repetitive tasks.
5. Begyn Reports — Automated daily/weekly AI-written business performance reports delivered to your inbox.
6. Begyn Predict — Predictive AI that forecasts sales, demand, churn, and revenue so you can act before problems hit.

## Pricing Plans
- 7-Day Free Trial: Full Scale-tier access for 7 days. No credit card required, cancel anytime, keep your data.
- Growth ($199/month): Full platform, 3 AI voice agents, 1,000 leads/month, automated reports, all 6 products.
- Scale ($499/month): Unlimited everything, dedicated AI model, priority support, advanced predictions.
- Enterprise (Custom pricing): SLA guarantees, white-label options, dedicated account manager.
All plans are all-inclusive — no per-minute voice fees, no AI add-on charges, no surprise bills.

## Who We Serve
Any business: retailers, restaurants, agencies, SaaS companies, real estate, e-commerce, service businesses, professional services, healthcare, hospitality, and more.

## Contact & Support
- Email: hello@begyn.online
- Website: https://begyn.online
- Blog: https://begyn.online/blog

## Handling Customer Issues
- Billing questions: Direct to hello@begyn.online with subject "Billing"
- Technical issues: Ask for details, provide workarounds where possible, escalate to hello@begyn.online
- Feature requests: Thank them, say all suggestions are reviewed by the product team
- Cancellations: Understand their concern first, offer a lower plan or pause before accepting
- Refunds: Direct to hello@begyn.online — handled case by case within 30 days

## Tone
Be warm, professional, and enthusiastic about AI and business growth. Keep replies concise (2-4 sentences) unless the user asks for detail. Always end with a helpful next step or offer to answer more.`

  const messages = [...safeHistory, { role: 'user' as const, content: message }]
  const fallbackReply = "I'm temporarily unavailable. Please email us at hello@begyn.online and we'll get back to you quickly!"

  if (anthropicKey) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, system: systemPrompt, messages }),
      })
      if (resp.ok) {
        const data = await resp.json() as any
        return c.json({ reply: data?.content?.[0]?.text || fallbackReply })
      }
    } catch (_) {}
  }

  if (openaiKey) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 500, messages: [{ role: 'system', content: systemPrompt }, ...messages] }),
      })
      if (resp.ok) {
        const data = await resp.json() as any
        return c.json({ reply: data?.choices?.[0]?.message?.content || fallbackReply })
      }
    } catch (_) {}
  }

  return c.json({ reply: fallbackReply })
})

// Static assets
app.use('/static/*', serveStatic({ root: './' }))

// ─── SEO / AEO / GEO ROUTES ───────────────────────────────────────────────────
app.get('/robots.txt', (c) => {
  return c.text(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /crm
Disallow: /tutorial

# AI Crawlers — explicitly allowed
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: DuckDuckBot
Allow: /

Sitemap: https://begyn.online/sitemap.xml
Sitemap: https://begyn.online/sitemap-blog.xml`)
})

app.get('/sitemap.xml', (c) => {
  const now = new Date().toISOString().split('T')[0]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://begyn.online/</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://begyn.online/blog</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
</urlset>`
  return c.body(xml, 200, { 'Content-Type': 'application/xml' })
})

app.get('/sitemap-blog.xml', async (c) => {
  const db = (c.env as any).DB as D1Database
  const rows = await db.prepare("SELECT slug, updated_at FROM blog_posts WHERE status='published' ORDER BY published_at DESC LIMIT 500").all()
  const urls = (rows.results || []).map((p: any) => {
    const date = p.updated_at ? String(p.updated_at).split('T')[0] : new Date().toISOString().split('T')[0]
    return `  <url><loc>https://begyn.online/blog/${p.slug}</loc><lastmod>${date}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`
  }).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
  return c.body(xml, 200, { 'Content-Type': 'application/xml' })
})

// IndexNow ownership key file (protocol requires it at /<key>.txt)
app.get(`/${INDEXNOW_KEY}.txt`, (c) => c.text(INDEXNOW_KEY))

// Manually (re)submit all site URLs to IndexNow — guarded like the blog cron
app.post('/api/seo/indexnow-submit', async (c) => {
  if (!isInternalRequest(c)) return c.json({ error: 'Unauthorized' }, 401)
  const db = (c.env as any).DB as D1Database
  const urls = ['https://begyn.online/', 'https://begyn.online/blog']
  try {
    const rows = await db.prepare("SELECT slug FROM blog_posts WHERE status='published' ORDER BY published_at DESC LIMIT 90").all()
    for (const p of (rows.results || []) as any[]) urls.push(`https://begyn.online/blog/${p.slug}`)
  } catch (_) {}
  const ok = await submitToIndexNow(urls)
  return c.json({ ok, submitted: urls.length })
})

app.get('/llms.txt', async (c) => {
  // llms.txt spec (llmstxt.org): H1 title, blockquote summary, H2 sections
  // containing Markdown link lists. Blog links are pulled live from D1.
  let postLinks = ''
  try {
    const db = (c.env as any).DB as D1Database
    const rows = await db
      .prepare("SELECT title, slug, excerpt FROM blog_posts WHERE status='published' ORDER BY published_at DESC LIMIT 20")
      .all()
    postLinks = ((rows.results || []) as any[])
      .map((p) => `- [${p.title}](https://begyn.online/blog/${p.slug}): ${String(p.excerpt || '').replace(/\n/g, ' ')}`)
      .join('\n')
  } catch (_) {}

  return c.text(`# Begyn.ai — AI-Powered Business Intelligence

> Begyn.ai is an AI-powered business intelligence platform for entrepreneurs and businesses of all sizes. We provide voice agents, lead intelligence, automated analytics, workflow automation, and predictive reporting — helping businesses compete with enterprise-grade data tools at startup-friendly prices.

Begyn.ai serves any entrepreneur or business owner who wants enterprise-grade intelligence without enterprise complexity: retailers, restaurants, agencies, SaaS companies, real estate firms, service businesses, and more. Plans: Growth ($199/mo), Scale ($499/mo), and custom Enterprise — every plan starts with a 7-day full-access free trial, no credit card required. Contact: hello@begyn.online.

## Main Pages

- [Home](https://begyn.online/): Platform overview — Begyn Intelligence (real-time AI analytics), Begyn Voice (24/7 AI voice agents), Begyn Leads (AI lead generation and scoring), Begyn Automate (workflow automation), Begyn Reports (automated AI-written business reports), and Begyn Predict (sales, demand, churn, and revenue forecasting) — plus pricing and FAQ
- [Blog](https://begyn.online/blog): AI business intelligence articles, updated multiple times daily

## Blog Posts

${postLinks || '- [Blog](https://begyn.online/blog): Latest AI business intelligence articles'}

## Optional

- [Sitemap](https://begyn.online/sitemap.xml): Index of main site pages
- [Blog sitemap](https://begyn.online/sitemap-blog.xml): Index of all published blog posts`)
})

// ─── CHAT WIDGET ─────────────────────────────────────────────────────────────
function chatWidget(): string {
  return `<div id="bw-root"><style>
#bw-btn{position:fixed;bottom:24px;right:24px;z-index:9999;width:56px;height:56px;border-radius:50%;background:#c8f231;color:#0a0f05;border:none;cursor:pointer;box-shadow:0 4px 24px rgba(200,242,49,.4);display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s}
#bw-btn:hover{transform:scale(1.08);box-shadow:0 6px 32px rgba(200,242,49,.6)}
#bw-btn svg{width:26px;height:26px;color:#fff;flex-shrink:0}
.bw-ic-close{display:none}
#bw-btn.open .bw-ic-chat{display:none}
#bw-btn.open .bw-ic-close{display:block}
#bw-panel{position:fixed;bottom:92px;right:24px;z-index:9998;width:360px;max-width:calc(100vw - 48px);height:520px;max-height:calc(100vh - 120px);background:rgba(8,12,7,.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(200,242,49,.28);border-radius:20px;display:flex;flex-direction:column;box-shadow:0 8px 48px rgba(0,0,0,.7);overflow:hidden;transition:transform .25s cubic-bezier(.34,1.56,.64,1),opacity .2s;transform-origin:bottom right}
#bw-panel.bw-hidden{transform:scale(.86);opacity:0;pointer-events:none}
#bw-hdr{padding:14px 16px;background:rgba(200,242,49,.08);border-bottom:1px solid rgba(200,242,49,.18);display:flex;align-items:center;gap:10px;flex-shrink:0}
.bw-av{width:36px;height:36px;border-radius:50%;background:#c8f231;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px}
.bw-nm{margin:0;font-size:13px;font-weight:700;color:#f3f4f6;font-family:ui-sans-serif,system-ui,sans-serif}
.bw-st{margin:2px 0 0;font-size:11px;color:#10b981;font-family:ui-sans-serif,system-ui,sans-serif}
#bw-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
#bw-msgs::-webkit-scrollbar{width:4px}
#bw-msgs::-webkit-scrollbar-thumb{background:#374151;border-radius:2px}
.bw-m{max-width:84%;padding:10px 13px;border-radius:14px;font-size:13px;line-height:1.55;font-family:ui-sans-serif,system-ui,sans-serif;word-break:break-word;white-space:pre-wrap}
.bw-m.u{align-self:flex-end;background:#c8f231;color:#0a0f05;border-bottom-right-radius:4px}
.bw-m.b{align-self:flex-start;background:rgba(255,255,255,.09);color:#e5e7eb;border-bottom-left-radius:4px}
.bw-dot{align-self:flex-start;padding:10px 14px;background:rgba(255,255,255,.09);border-radius:14px;border-bottom-left-radius:4px;display:flex;gap:4px;align-items:center}
.bw-dot span{width:7px;height:7px;border-radius:50%;background:#c8f231;animation:bw-b 1.2s infinite;display:block}
.bw-dot span:nth-child(2){animation-delay:.2s}
.bw-dot span:nth-child(3){animation-delay:.4s}
@keyframes bw-b{0%,60%,100%{transform:translateY(0);opacity:.6}30%{transform:translateY(-5px);opacity:1}}
#bw-frm{padding:10px 12px;border-top:1px solid rgba(255,255,255,.07);display:flex;gap:8px;flex-shrink:0;background:rgba(0,0,0,.3);align-items:flex-end}
#bw-inp{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(200,242,49,.25);border-radius:10px;padding:9px 12px;color:#f3f4f6;font-size:13px;font-family:ui-sans-serif,system-ui,sans-serif;outline:none;resize:none;min-height:38px;max-height:100px;line-height:1.4}
#bw-inp:focus{border-color:rgba(200,242,49,.55);background:rgba(255,255,255,.09)}
#bw-inp::placeholder{color:#6b7280}
#bw-snd{width:38px;height:38px;border-radius:10px;background:#c8f231;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .15s}
#bw-snd:hover{opacity:.85}
#bw-snd:disabled{opacity:.4;cursor:not-allowed}
#bw-snd svg{width:16px;height:16px;color:#0a0f05}
</style>
<button id="bw-btn" aria-label="Chat with Begyn AI" onclick="bwToggle()">
<svg class="bw-ic-chat" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
<svg class="bw-ic-close" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
</button>
<div id="bw-panel" class="bw-hidden" role="dialog" aria-label="Begyn AI Chat">
<div id="bw-hdr">
<div class="bw-av">🤖</div>
<div><p class="bw-nm">Bea — Begyn AI Assistant</p><p class="bw-st">● Online · Replies instantly</p></div>
</div>
<div id="bw-msgs">
<div class="bw-m b">Hi! I'm Bea, Begyn.ai's AI assistant 👋 Ask me anything about our AI business intelligence tools, pricing, or how we can help your business grow!</div>
</div>
<form id="bw-frm" onsubmit="bwSend(event)">
<textarea id="bw-inp" placeholder="Ask me anything…" rows="1" maxlength="1000"></textarea>
<button type="submit" id="bw-snd" aria-label="Send">
<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
</button>
</form>
</div>
<script>
(function(){
var bwHistory=[];
var bwOpen=false;
window.bwToggle=function(){
  bwOpen=!bwOpen;
  document.getElementById('bw-btn').classList.toggle('open',bwOpen);
  document.getElementById('bw-panel').classList.toggle('bw-hidden',!bwOpen);
  if(bwOpen)setTimeout(function(){document.getElementById('bw-inp').focus()},260);
};
window.bwSend=async function(e){
  e.preventDefault();
  var inp=document.getElementById('bw-inp');
  var msg=inp.value.trim();
  if(!msg)return;
  inp.value='';
  inp.style.height='';
  bwAppend(msg,'u');
  document.getElementById('bw-snd').disabled=true;
  var dot=bwDots();
  try{
    var r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,history:bwHistory.slice(-8)})});
    var d=await r.json();
    dot.remove();
    var rep=d.reply||'Sorry, something went wrong. Email us at hello@begyn.online!';
    bwAppend(rep,'b');
    bwHistory.push({role:'user',content:msg},{role:'assistant',content:rep});
  }catch(err){
    dot.remove();
    bwAppend('Connection error. Please email hello@begyn.online for help!','b');
  }finally{
    document.getElementById('bw-snd').disabled=false;
    inp.focus();
  }
};
function bwAppend(txt,cls){
  var m=document.getElementById('bw-msgs');
  var d=document.createElement('div');
  d.className='bw-m '+cls;
  d.textContent=txt;
  m.appendChild(d);
  m.scrollTop=m.scrollHeight;
}
function bwDots(){
  var m=document.getElementById('bw-msgs');
  var d=document.createElement('div');
  d.className='bw-dot';
  d.innerHTML='<span></span><span></span><span></span>';
  m.appendChild(d);
  m.scrollTop=m.scrollHeight;
  return d;
}
var inp=document.getElementById('bw-inp');
inp.addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px';});
inp.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&!e.shiftKey){
    e.preventDefault();
    document.getElementById('bw-frm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  }
});
})();
</script></div>`
}

// ─── TUTORIAL PAGE ────────────────────────────────────────────────────────────
app.get('/tutorial', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>How To Use — Google Money Drop</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css"/>
  <style>
    body { background: #030712; color: #f3f4f6; font-family: ui-sans-serif,system-ui,sans-serif; }
    .grad-text { background: linear-gradient(135deg,#f472b6,#a78bfa,#60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
    .grad-green { background: linear-gradient(135deg,#34d399,#059669); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
    .card { background:#111827; border:1px solid #1f2937; border-radius:1rem; }
    .step-num { width:2.5rem;height:2.5rem;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1rem;flex-shrink:0; }
    .badge { display:inline-flex;align-items:center;gap:.375rem;padding:.2rem .75rem;border-radius:9999px;font-size:.7rem;font-weight:700;letter-spacing:.05em; }
    .pill-auto { background:#1e1b4b;border:1px solid #4338ca;color:#a5b4fc; }
    .pill-manual { background:#1c1917;border:1px solid #57534e;color:#a8a29e; }
    .pill-key { background:#1f2937;border:1px solid #374151;color:#9ca3af;font-family:monospace;padding:.15rem .5rem;border-radius:.375rem;font-size:.75rem; }
    .timeline-line { position:absolute;left:1.2rem;top:3.5rem;bottom:0;width:2px;background:linear-gradient(to bottom,#6366f1,#8b5cf6,#ec4899,#10b981); }
    .section-header { border-left:4px solid;padding-left:1rem;margin-bottom:1.5rem; }
    .tip-box { background:#0c1a0c;border:1px solid #14532d;border-radius:.75rem;padding:1rem; }
    .warn-box { background:#1c0a00;border:1px solid #7c2d12;border-radius:.75rem;padding:1rem; }
    .code-block { background:#030712;border:1px solid #1f2937;border-radius:.5rem;padding:.75rem 1rem;font-family:monospace;font-size:.8rem;color:#86efac;white-space:pre-wrap;word-break:break-all; }
    .nav-dot { width:.5rem;height:.5rem;border-radius:9999px;background:#374151;cursor:pointer;transition:all .2s; }
    .nav-dot.active { background:#8b5cf6;transform:scale(1.4); }
    details summary { cursor:pointer;list-style:none; }
    details summary::-webkit-details-marker { display:none; }
    details[open] summary .chevron { transform:rotate(180deg); }
    .chevron { transition:transform .2s; display:inline-block; }
    ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:#111827; } ::-webkit-scrollbar-thumb { background:#374151;border-radius:3px; }
  </style>
</head>
<body class="min-h-screen">

  <!-- TOP NAV -->
  <div class="sticky top-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-4">
      <a href="/" class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
        <i class="fas fa-arrow-left"></i><span>Back to App</span>
      </a>
      <div class="w-px h-5 bg-gray-700"></div>
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
          <i class="fas fa-graduation-cap text-white text-xs"></i>
        </div>
        <span class="font-bold text-white text-sm">Google Money Drop — System Tutorial</span>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <span class="badge pill-auto"><i class="fas fa-robot"></i> AUTOPILOT CAPABLE</span>
      <a href="/" class="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all">
        <i class="fas fa-rocket mr-1"></i>Launch App
      </a>
    </div>
  </div>

  <!-- HERO -->
  <div class="relative overflow-hidden border-b border-gray-800">
    <div class="absolute inset-0 bg-gradient-to-br from-pink-950/30 via-purple-950/20 to-indigo-950/30 pointer-events-none"></div>
    <div class="absolute top-10 right-20 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute bottom-5 left-10 w-48 h-48 bg-pink-600/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="max-w-5xl mx-auto px-6 py-16 text-center relative">
      <div class="inline-flex items-center gap-2 bg-purple-900/30 border border-purple-700/40 text-purple-300 text-xs font-bold px-4 py-2 rounded-full mb-6">
        <i class="fas fa-play-circle"></i> COMPLETE SYSTEM WALKTHROUGH
      </div>
      <h1 class="text-5xl font-black mb-4 leading-tight">
        <span class="grad-text">From Zero to Autopilot</span>
      </h1>
      <p class="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
        This is your complete operating manual. Every screen, every button, every automation — explained exactly as it works, from the moment you open the app to the moment you're collecting money while you sleep.
      </p>
      <div class="flex flex-wrap items-center justify-center gap-4 mt-8">
        <div class="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2">
          <i class="fas fa-list-ol text-blue-400"></i>
          <span class="text-sm text-gray-300 font-semibold">12 Sections</span>
        </div>
        <div class="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2">
          <i class="fas fa-clock text-green-400"></i>
          <span class="text-sm text-gray-300 font-semibold">~20 min setup to first lead</span>
        </div>
        <div class="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2">
          <i class="fas fa-robot text-purple-400"></i>
          <span class="text-sm text-gray-300 font-semibold">Fully automatable</span>
        </div>
        <div class="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2">
          <i class="fas fa-dollar-sign text-yellow-400"></i>
          <span class="text-sm text-gray-300 font-semibold">$799–$5,997 per deal</span>
        </div>
      </div>
    </div>
  </div>

  <!-- TABLE OF CONTENTS -->
  <div class="max-w-5xl mx-auto px-6 py-10">
    <div class="card p-6 mb-10">
      <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-map text-yellow-400"></i> Table of Contents</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        ${[
          ['1','How the System Works — The Big Picture','#section-1','fas fa-brain','purple'],
          ['2','Step 0 — First-Time Setup (Do This Once)','#section-2','fas fa-cog','gray'],
          ['3','Step 1 — Finding Leads (Auto-Prospector)','#section-3','fas fa-robot','green'],
          ['4','Step 2 — Manual Lead Entry & Lead Finder','#section-4','fas fa-search-location','blue'],
          ['5','Step 3 — Managing Leads & Pipeline','#section-5','fas fa-stream','indigo'],
          ['6','Step 4 — AI Website Builder (The Core Engine)','#section-6','fas fa-magic','pink'],
          ['7','Step 5 — Elite Outreach (A/B/C System)','#section-7','fas fa-paper-plane','yellow'],
          ['8','Step 6 — 14-Day Follow-Up Sequences','#section-8','fas fa-calendar-alt','orange'],
          ['9','Step 7 — Proposals & Stripe Payments','#section-9','fas fa-file-invoice-dollar','emerald'],
          ['10','Step 8 — Clients & Revenue Tracking','#section-10','fas fa-users','cyan'],
          ['11','The Full Automation Stack','#section-11','fas fa-bolt','amber'],
          ['12','Pro Tips, Pricing Strategy & Money Math','#section-12','fas fa-trophy','red'],
        ].map(([n,title,href,icon,c])=>`
        <a href="${href}" class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition-colors group">
          <span class="w-7 h-7 rounded-lg bg-${c}-900/40 border border-${c}-700/40 flex items-center justify-center flex-shrink-0">
            <i class="${icon} text-${c}-400 text-xs"></i>
          </span>
          <span class="text-sm text-gray-300 group-hover:text-white transition-colors"><span class="text-gray-600 mr-1">${n}.</span>${title}</span>
        </a>`).join('')}
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- SECTION 1: BIG PICTURE -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div id="section-1" class="mb-16">
      <div class="section-header border-purple-500">
        <p class="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">Section 1</p>
        <h2 class="text-3xl font-black text-white">How the System Works</h2>
        <p class="text-gray-400 mt-1">The big picture before you touch anything</p>
      </div>

      <div class="card p-6 mb-6">
        <p class="text-gray-300 leading-relaxed mb-4">
          <strong class="text-white">Google Money Drop</strong> is a complete local website sales machine. The business model is simple:
          local businesses without websites are <strong class="text-red-400">invisible on Google</strong> and losing customers every day to competitors who do show up.
          You find them, build them a demo site, send a psychologically-optimized pitch, follow up for 14 days, close the deal, collect money via Stripe.
        </p>
        <p class="text-gray-300 leading-relaxed">
          The system handles all of it — from finding leads on Google Maps to sending the email, building the website demo, tracking the pipeline, generating the invoice, and following up automatically. Your job is to <strong class="text-white">configure it once, then let it run.</strong>
        </p>
      </div>

      <!-- Flow diagram -->
      <div class="card p-6">
        <h3 class="font-bold text-white mb-5 flex items-center gap-2"><i class="fas fa-route text-blue-400"></i> The 8-Step Money Flow</h3>
        <div class="relative pl-10">
          <div class="timeline-line"></div>
          ${[
            ['1','fas fa-robot','indigo','Auto-Prospector Finds Leads','Searches Google Maps for businesses without websites in your target ZIP codes. Runs automatically on a schedule — or you hit Run Now.','AUTO'],
            ['2','fas fa-brain','purple','AI Deep Research','For each lead, the system pulls their Google rating, reviews, address, phone, services, competitors, and builds a full business intelligence report using OpenAI.','AUTO'],
            ['3','fas fa-magic','pink','Lovable Website Builder','Uses the research to generate a complete custom website prompt and opens Lovable.dev with it pre-filled. The AI builds a real, published website demo for the business.','AUTO'],
            ['4','fas fa-paper-plane','blue','Elite Outreach Sent','A psychology-optimized email (Variant A, B, or C — auto-selected by lead ID) and SMS is sent immediately with the preview link and a personalized loss-aversion pitch.','AUTO'],
            ['5','fas fa-calendar-alt','orange','14-Day Follow-Up Sequence','If no response, follow-up messages go out at Day 3 (loss aversion), Day 7 (social proof), Day 10 (scarcity/urgency), and Day 14 (final breakup email).','AUTO'],
            ['6','fas fa-file-invoice-dollar','yellow','Proposal & Stripe Payment','You send a proposal with ROI calculations, guarantee, and urgency framing. One click generates a Stripe payment link. Client pays online.','MANUAL'],
            ['7','fas fa-users','green','Lead Becomes Client','Payment marks the deal Won. A client record is created. The pipeline updates automatically.','AUTO'],
            ['8','fas fa-chart-line','emerald','Track Revenue & Repeat','Revenue dashboard shows all-time earnings, MRR, pipeline value. Rinse and repeat on autopilot.','AUTO'],
          ].map(([n,icon,c,title,desc,mode])=>`
          <div class="flex gap-4 mb-8 relative">
            <div class="step-num bg-${c}-900/50 border border-${c}-600/50 text-${c}-300 z-10">${n}</div>
            <div class="flex-1 pt-1">
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <i class="${icon} text-${c}-400 text-sm"></i>
                <h4 class="font-bold text-white">${title}</h4>
                <span class="badge ${mode==='AUTO'?'pill-auto':'pill-manual'}">${mode==='AUTO'?'<i class="fas fa-robot"></i> AUTO':'<i class="fas fa-hand-pointer"></i> MANUAL'}</span>
              </div>
              <p class="text-sm text-gray-400 leading-relaxed">${desc}</p>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- SECTION 2: FIRST-TIME SETUP -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div id="section-2" class="mb-16">
      <div class="section-header border-gray-500">
        <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Section 2 · Do This Once</p>
        <h2 class="text-3xl font-black text-white">First-Time Setup</h2>
        <p class="text-gray-400 mt-1">Configure the system before doing anything else. This takes 10–15 minutes.</p>
      </div>

      <!-- Builder Settings -->
      <div class="card p-6 mb-4">
        <h3 class="font-bold text-white mb-1 flex items-center gap-2"><i class="fas fa-magic text-pink-400"></i> AI Website Builder → Settings Tab</h3>
        <p class="text-xs text-gray-500 mb-4">Navigate to: <span class="pill-key">Website Builder</span> → <span class="pill-key">Settings</span> tab</p>
        <div class="space-y-4">
          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
            <p class="text-sm font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-user-circle text-blue-400"></i> Your Contact Info</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              ${[
                ['Your Full Name','Eric Developing Thompson','fas fa-user','Appears in every outreach email signature'],
                ['Your Phone','(985) 860-7891','fas fa-phone','Used in SMS and email. Make it clickable.'],
                ['Your Email','your@email.com','fas fa-envelope','Reply-to address for all outreach'],
              ].map(([label,ex,icon,desc])=>`
              <div class="bg-gray-950/60 rounded-lg p-3">
                <p class="text-xs font-bold text-gray-300 flex items-center gap-1 mb-1"><i class="${icon} text-blue-400 text-xs"></i> ${label}</p>
                <p class="text-xs text-green-400 font-mono mb-1">e.g. ${ex}</p>
                <p class="text-xs text-gray-500">${desc}</p>
              </div>`).join('')}
            </div>
          </div>

          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
            <p class="text-sm font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-key text-yellow-400"></i> API Keys (Required for Automation)</p>
            <div class="space-y-3">
              ${[
                ['OpenAI API Key','sk-proj-...','fas fa-brain','purple','Powers the deep research and AI business intelligence. Get one at platform.openai.com. GPT-4o-mini — costs fractions of a cent per lead.','REQUIRED for research'],
                ['SendGrid API Key','SG.xxx...','fas fa-envelope','blue','Sends all outreach emails. Free plan = 100 emails/day. sendgrid.com → Settings → API Keys.','REQUIRED for email'],
                ['Twilio Account SID + Auth Token + From Number','ACxxx... / auth token / +1...','fas fa-sms','green','Sends SMS outreach. Twilio free trial works for testing. twilio.com → Console.','REQUIRED for SMS'],
                ['Google Maps API Key','AIza...','fas fa-map-marker-alt','red','Used by the Auto-Prospector to search Google Maps. Enable "Places API" in Google Cloud Console. Free tier covers thousands of searches.','REQUIRED for auto-prospecting'],
              ].map(([label,ex,icon,c,desc,req])=>`
              <div class="flex gap-3 p-3 bg-gray-950/60 rounded-lg">
                <div class="w-8 h-8 rounded-lg bg-${c}-900/40 border border-${c}-700/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i class="${icon} text-${c}-400 text-xs"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap mb-0.5">
                    <p class="text-sm font-bold text-white">${label}</p>
                    <span class="badge bg-red-900/30 border border-red-700/40 text-red-400">${req}</span>
                  </div>
                  <p class="text-xs text-green-400 font-mono mb-1 truncate">${ex}</p>
                  <p class="text-xs text-gray-400 leading-relaxed">${desc}</p>
                </div>
              </div>`).join('')}
            </div>
          </div>

          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
            <p class="text-sm font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-credit-card text-emerald-400"></i> Stripe Payment Links</p>
            <p class="text-xs text-gray-400 mb-3">Create payment links at <strong class="text-white">dashboard.stripe.com → Payment Links → Create</strong>. Make one for each package tier. Paste the URLs here.</p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
              ${[
                ['Starter','$799','green'],['Professional','$1,497','blue'],['Premium','$2,997','yellow'],['Enterprise','$5,997','red']
              ].map(([tier,price,c])=>`
              <div class="bg-${c}-950/30 border border-${c}-800/40 rounded-lg p-2 text-center">
                <p class="text-xs font-bold text-${c}-300">${tier}</p>
                <p class="text-sm font-black text-white">${price}</p>
                <p class="text-xs text-gray-500">+recurring</p>
              </div>`).join('')}
            </div>
          </div>

          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
            <p class="text-sm font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-toggle-on text-purple-400"></i> Automation Toggle Switches</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              ${[
                ['Auto-Research on Discover','ON','When a new lead is found, immediately run deep AI research on them'],
                ['Auto-Build After Research','ON','After research completes, automatically generate the Lovable website prompt'],
                ['Auto-Send Outreach','ON','After a build is created, automatically email + SMS the business owner'],
                ['Auto-Prospect','ON','Set in Auto-Prospector settings — runs the Google Maps search on a schedule'],
              ].map(([label,rec,desc])=>`
              <div class="flex items-start gap-3 p-3 bg-gray-950/60 rounded-lg">
                <div class="w-8 h-5 bg-purple-600 rounded-full flex items-center justify-end pr-0.5 flex-shrink-0 mt-0.5">
                  <div class="w-4 h-4 bg-white rounded-full"></div>
                </div>
                <div>
                  <p class="text-sm font-semibold text-white">${label} <span class="text-green-400 text-xs">(Recommended: ${rec})</span></p>
                  <p class="text-xs text-gray-400 mt-0.5">${desc}</p>
                </div>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Auto-Prospector Setup -->
      <div class="card p-6">
        <h3 class="font-bold text-white mb-1 flex items-center gap-2"><i class="fas fa-robot text-green-400"></i> Auto-Prospector → Settings</h3>
        <p class="text-xs text-gray-500 mb-4">Navigate to: <span class="pill-key">Auto-Prospector</span> → scroll to Settings panel</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${[
            ['Target Industries','Which types of businesses to search for. Already loaded with 8 proven industries: Home Services, Restaurant, Salon, Auto Repair, Dental/Medical, Law Firm, Fitness, Retail.','fas fa-industry','blue'],
            ['ZIP Code Queue','Add your target ZIP codes. The system works them in order, advances to the next ZIP when one is exhausted. Start with 5–10 ZIPs in your area.','fas fa-map-pin','red'],
            ['Search Radius','How far to search from each ZIP center. 10 miles is a good start. Increase for rural areas.','fas fa-circle-notch','purple'],
            ['Google Maps API Key','Paste your key here (same as Builder Settings). Required to query the Places API.','fas fa-key','yellow'],
          ].map(([label,desc,icon,c])=>`
          <div class="flex gap-3 p-3 bg-gray-900/60 rounded-xl border border-gray-800">
            <i class="${icon} text-${c}-400 text-lg mt-0.5 flex-shrink-0 w-5 text-center"></i>
            <div>
              <p class="text-sm font-bold text-white mb-1">${label}</p>
              <p class="text-xs text-gray-400 leading-relaxed">${desc}</p>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- SECTION 3: AUTO-PROSPECTOR -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div id="section-3" class="mb-16">
      <div class="section-header border-green-500">
        <p class="text-xs font-bold text-green-400 uppercase tracking-widest mb-1">Section 3 · Step 1</p>
        <h2 class="text-3xl font-black text-white">Auto-Prospector <span class="badge pill-auto ml-2"><i class="fas fa-robot"></i> FULLY AUTOMATIC</span></h2>
        <p class="text-gray-400 mt-1">Your 24/7 lead-finding robot that searches Google Maps while you sleep.</p>
      </div>

      <div class="card p-6 mb-4">
        <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-play text-green-400"></i> How to Use It</h3>
        <div class="space-y-4">
          <div class="flex gap-4 items-start">
            <div class="step-num bg-green-900/40 border border-green-700/40 text-green-300 text-sm">1</div>
            <div>
              <p class="font-semibold text-white">Click "Run Now" to do a manual run</p>
              <p class="text-sm text-gray-400 mt-1">Searches Google Maps using your ZIP queue and industry list. Adds any business without a website to your Leads list automatically. A typical run finds 5–20 new leads per ZIP.</p>
            </div>
          </div>
          <div class="flex gap-4 items-start">
            <div class="step-num bg-green-900/40 border border-green-700/40 text-green-300 text-sm">2</div>
            <div>
              <p class="font-semibold text-white">Toggle "Auto-Prospector" ON for scheduled runs</p>
              <p class="text-sm text-gray-400 mt-1">When enabled, the Cloudflare cron trigger runs the prospector automatically every hour. Your lead list fills itself. You don't have to do anything.</p>
            </div>
          </div>
          <div class="flex gap-4 items-start">
            <div class="step-num bg-green-900/40 border border-green-700/40 text-green-300 text-sm">3</div>
            <div>
              <p class="font-semibold text-white">Watch the "Leads Found Today" counter go up</p>
              <p class="text-sm text-gray-400 mt-1">Every lead found shows in the dashboard. The system skips duplicates automatically. Once a ZIP is exhausted, it advances to the next one in your queue.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="tip-box">
          <p class="text-sm font-bold text-green-300 flex items-center gap-2 mb-2"><i class="fas fa-lightbulb"></i> Pro Tip</p>
          <p class="text-sm text-gray-300 leading-relaxed">Start with ZIPs in mid-size cities (50K–300K population). Smaller towns = fewer competitors = easier closes. Avoid NYC/LA where web designers are everywhere.</p>
        </div>
        <div class="warn-box">
          <p class="text-sm font-bold text-orange-300 flex items-center gap-2 mb-2"><i class="fas fa-exclamation-triangle"></i> Watch Out</p>
          <p class="text-sm text-gray-300 leading-relaxed">Google Places API has a free quota. If you run the prospector very aggressively (50+ ZIP codes, multiple times per day), monitor your Google Cloud billing. Stay under $200/month free credit.</p>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- SECTION 4: MANUAL LEADS -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div id="section-4" class="mb-16">
      <div class="section-header border-blue-500">
        <p class="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Section 4 · Step 2</p>
        <h2 class="text-3xl font-black text-white">Manual Leads & Lead Finder</h2>
        <p class="text-gray-400 mt-1">Add leads by hand or use the built-in scraper tool.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div class="card p-5">
          <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-plus-circle text-blue-400"></i> Leads Tab — Add Manually</h3>
          <p class="text-sm text-gray-400 leading-relaxed mb-3">Click <span class="pill-key">+ Add Lead</span> and fill in:</p>
          <div class="space-y-2">
            ${[
              ['Business Name','Exact name as it appears on Google Maps'],
              ['Owner Name','If you know it — personalizes outreach significantly'],
              ['Industry','Select from dropdown — drives AI research templates'],
              ['City','Used in subject lines and personalization'],
              ['Phone','For SMS outreach'],
              ['Email','For email outreach — most important field'],
              ['Google Maps URL','Paste from maps.google.com — links directly to their listing'],
            ].map(([f,d])=>`
            <div class="flex items-start gap-2">
              <i class="fas fa-check-circle text-blue-400 text-xs mt-1 flex-shrink-0"></i>
              <p class="text-xs text-gray-300"><span class="text-white font-semibold">${f}:</span> ${d}</p>
            </div>`).join('')}
          </div>
        </div>
        <div class="card p-5">
          <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-search-location text-blue-400"></i> Lead Finder Tab</h3>
          <p class="text-sm text-gray-400 leading-relaxed mb-3">A manual search tool for targeted prospecting. Enter a business type, industry, and city — it searches Google Maps and adds matching businesses without websites.</p>
          <div class="tip-box">
            <p class="text-xs font-bold text-green-300 mb-1"><i class="fas fa-star"></i> Best Use Cases</p>
            <div class="space-y-1 text-xs text-gray-300">
              <p>• Search a specific neighborhood or street name</p>
              <p>• Find a specific business type (e.g. "BBQ restaurant")</p>
              <p>• Target a specific city outside your ZIP queue</p>
              <p>• Quick one-off research before a cold call</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card p-5">
        <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-filter text-gray-400"></i> Lead Status System</h3>
        <div class="flex flex-wrap gap-2">
          ${[
            ['new','New','Just discovered, no contact yet','gray'],
            ['contacted','Contacted','Outreach sent','blue'],
            ['demo_sent','Demo Sent','Website demo delivered','purple'],
            ['proposal_sent','Proposal Sent','Formal proposal emailed','yellow'],
            ['negotiating','Negotiating','In active conversation','orange'],
            ['won','WON','Deal closed, payment received','green'],
            ['lost','Lost','Said no or unresponsive after 14 days','red'],
            ['not_interested','Not Interested','Explicitly declined','gray'],
          ].map(([,label,,c])=>`
          <span class="badge bg-${c}-900/30 border border-${c}-700/40 text-${c}-300 text-xs">${label}</span>`).join('')}
        </div>
        <p class="text-xs text-gray-500 mt-3">Status updates automatically as outreach is sent, proposals generated, and payments received. You can also update manually by clicking on any lead.</p>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- SECTION 5: PIPELINE -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div id="section-5" class="mb-16">
      <div class="section-header border-indigo-500">
        <p class="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Section 5 · Step 3</p>
        <h2 class="text-3xl font-black text-white">Managing Leads & Pipeline</h2>
        <p class="text-gray-400 mt-1">Track every deal from discovery to closed.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card p-5">
          <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-table text-indigo-400"></i> Leads Tab</h3>
          <div class="space-y-3 text-sm text-gray-300">
            <p><span class="pill-key">Search bar</span> — filter by name, city, phone, or email instantly</p>
            <p><span class="pill-key">Status filter</span> — show only leads at a specific stage</p>
            <p><span class="pill-key">Industry filter</span> — focus on your best-converting niche</p>
            <p><span class="pill-key">Click any row</span> — opens the full lead detail modal with notes, activity log, and action buttons</p>
            <p><span class="pill-key">📄 Proposal button</span> — instantly opens a pre-filled proposal for that lead</p>
            <p><span class="pill-key">✨ Build button</span> — sends this lead to the AI Website Builder</p>
          </div>
        </div>
        <div class="card p-5">
          <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-stream text-indigo-400"></i> Pipeline Tab</h3>
          <p class="text-sm text-gray-400 mb-3">Visual funnel view — shows how many leads are at each stage, conversion rates, and total pipeline value. Use this to identify bottlenecks.</p>
          <div class="tip-box">
            <p class="text-xs font-bold text-green-300 mb-1"><i class="fas fa-lightbulb"></i> Key Metric to Watch</p>
            <p class="text-xs text-gray-300">If your <strong class="text-white">Contacted → Demo Sent</strong> rate is low, your outreach email isn't landing. Go to Builder → Outreach tab, click the 🔍 preview button, and switch variants.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- SECTION 6: AI WEBSITE BUILDER -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div id="section-6" class="mb-16">
      <div class="section-header border-pink-500">
        <p class="text-xs font-bold text-pink-400 uppercase tracking-widest mb-1">Section 6 · Step 4</p>
        <h2 class="text-3xl font-black text-white">AI Website Builder <span class="badge pill-auto ml-2 text-xs"><i class="fas fa-robot"></i> CORE ENGINE</span></h2>
        <p class="text-gray-400 mt-1">This is the heart of the whole system. Learn every tab.</p>
      </div>

      <!-- 5 tabs explained -->
      <div class="space-y-4">
        ${[
          {tab:'Builds', icon:'fas fa-globe', c:'pink', desc:'Shows all website builds — queued, generating, ready, and live. Each row has the business name, package tier, outreach status, and action buttons.', actions:[
            ['🔍 Pink preview button','Opens the full outreach preview modal — see all 3 email variants, all 3 SMS variants, and all 4 follow-up steps BEFORE sending'],
            ['🚀 Launch Lovable button','Opens Lovable.dev with the AI-generated prompt pre-filled. The website starts building automatically in the browser'],
            ['✉️ Send Outreach button','Manually trigger outreach if auto-outreach is off'],
            ['📅 Calendar button','Start a 14-day follow-up sequence for this lead'],
          ]},
          {tab:'Research', icon:'fas fa-brain', c:'purple', desc:'Shows the AI deep research reports for each lead. Includes Google rating, review count, competitor analysis, local search data, and business intelligence used to write outreach.', actions:[
            ['View Report button','See the full research report — headline, services, USPs, AI analysis'],
            ['Bulk Research button','Run research on all un-researched leads at once (up to 5 at a time)'],
          ]},
          {tab:'Outreach', icon:'fas fa-paper-plane', c:'blue', desc:'Shows which leads have been contacted, when, through which channel, and what happened. Track opened, replied, and converted status here.', actions:[
            ['Update Status','Mark a lead as opened/replied/converted after they respond to your outreach'],
            ['Sample Template','Shows a sample of the current email template format'],
          ]},
          {tab:'Follow-Up', icon:'fas fa-calendar-alt', c:'orange', desc:'The 14-day nurture sequence manager. See all active sequences, which step they\'re on, when the next message sends, and how many have been delivered.', actions:[
            ['Start New Sequence','Enter a Lead ID to begin their 14-day follow-up sequence'],
            ['Send Step Now','Manually fire a specific follow-up step immediately'],
            ['View button','See all 4 steps with their full email + SMS content'],
            ['Cancel button','Stop a sequence if the lead asks to be removed'],
          ]},
          {tab:'Settings', icon:'fas fa-cog', c:'gray', desc:'All configuration for the builder system — your contact info, API keys (OpenAI, SendGrid, Twilio), Stripe payment links, and automation toggles.', actions:[
            ['Save Contact Info','Update name/phone/email that appears in all outreach'],
            ['Save API Keys','Save one key at a time using the individual save buttons'],
            ['Save Payment Links','Paste your 4 Stripe links and save'],
            ['Toggle automations','Enable/disable auto-research, auto-build, auto-outreach'],
          ]},
        ].map(({tab,icon,c,desc,actions})=>`
        <details class="card overflow-hidden">
          <summary class="p-5 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-${c}-900/40 border border-${c}-700/40 flex items-center justify-center flex-shrink-0">
                <i class="${icon} text-${c}-400 text-sm"></i>
              </div>
              <div>
                <p class="font-bold text-white">${tab} Tab</p>
                <p class="text-xs text-gray-500">${desc.substring(0,60)}...</p>
              </div>
            </div>
            <i class="fas fa-chevron-down text-gray-500 chevron"></i>
          </summary>
          <div class="px-5 pb-5 space-y-3 border-t border-gray-800 pt-4">
            <p class="text-sm text-gray-300 leading-relaxed">${desc}</p>
            <div class="space-y-2">
              ${actions.map(([btn,d])=>`
              <div class="flex gap-3 items-start">
                <span class="pill-key mt-0.5 flex-shrink-0">${btn}</span>
                <p class="text-xs text-gray-400">${d}</p>
              </div>`).join('')}
            </div>
          </div>
        </details>`).join('')}
      </div>

      <!-- Package tiers -->
      <div class="card p-6 mt-4">
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-tags text-yellow-400"></i> Package Tiers — What to Sell and When</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          ${[
            ['Starter','$799','$49/mo','green','Basic 5-page site. Good for very small businesses, first-time website owners, or tight budgets. Easy close.'],
            ['Professional','$1,497','$97/mo','blue','★ LEAD WITH THIS. SEO, analytics, professional copywriting. Best value proposition. "Most Popular" badge anchors perception.'],
            ['Premium','$2,997','$197/mo','yellow','For established businesses wanting booking systems, blog, and local SEO campaigns. Upsell after the initial close.'],
            ['Enterprise','$5,997','$397/mo','red','DECOY ANCHOR — makes Professional look affordable. E-commerce, custom app, 12 months of updates. Only sell if they ask.'],
          ].map(([tier,price,rec,c,desc])=>`
          <div class="bg-${c}-950/30 border border-${c}-800/40 rounded-xl p-4">
            <p class="text-xs font-bold text-${c}-300 uppercase tracking-wide">${tier}</p>
            <p class="text-2xl font-black text-white mt-1">${price}</p>
            <p class="text-xs text-gray-500 mb-2">${rec}/month maintenance</p>
            <p class="text-xs text-gray-400 leading-relaxed">${desc}</p>
          </div>`).join('')}
        </div>
        <div class="tip-box mt-4">
          <p class="text-sm font-bold text-green-300 mb-1"><i class="fas fa-target"></i> The Decoy Effect in Action</p>
          <p class="text-xs text-gray-300">By showing Enterprise at $5,997, Professional at $1,497 feels like a steal. This is a proven pricing psychology tactic (Ariely, 2008) that increases Professional conversions by 30–40%. Always show all 4 tiers in your proposal.</p>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- SECTION 7: OUTREACH -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div id="section-7" class="mb-16">
      <div class="section-header border-yellow-500">
        <p class="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-1">Section 7 · Step 5</p>
        <h2 class="text-3xl font-black text-white">Elite Outreach System</h2>
        <p class="text-gray-400 mt-1">Psychology-engineered A/B/C email and SMS variants that convert.</p>
      </div>

      <div class="card p-6 mb-4">
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-flask text-yellow-400"></i> The A/B/C Variant System</h3>
        <p class="text-sm text-gray-400 mb-4">Every lead is automatically assigned to Variant A, B, or C based on their lead ID (modulo 3). This means your outreach is automatically split-tested across all leads. You never send the same email twice.</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${[
            ['A','Loss Aversion + Authority + Urgency','red','Leads with Loss. Opens with a specific dollar amount they\'re losing per week (calculated from industry data). Establishes authority with a pre-built demo. Creates urgency with limited spot availability. <strong class="text-red-300">Strongest approach for most industries.</strong>','I found why [Business] is losing $23,450/week'],
            ['B','Reciprocity + Curiosity + Social Proof','blue','Gives first, asks second. Leads with an unsolicited gift (the free demo site) framed as something the recipient earned. Curiosity gap in subject line. Competitor social proof to trigger FOMO. <strong class="text-blue-300">Best for service businesses and restaurants.</strong>','I built something for [Business] (and I\'m giving it away)'],
            ['C','Pattern Interrupt + Direct + Assumptive','purple','Breaks the "cold email" pattern immediately. Conversational tone, no salesy language. Assumptive close ("when can we get on a call" vs "would you like to..."). <strong class="text-purple-300">Best for skeptical or oversolicited industries.</strong>','Quick question about [Business]\'s Google presence'],
          ].map(([v,name,c,desc,subj])=>`
          <div class="bg-${c}-950/30 border border-${c}-800/40 rounded-xl p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="w-7 h-7 rounded-full bg-${c}-700 text-white text-xs font-black flex items-center justify-center">${v}</span>
              <p class="font-bold text-white text-sm">${name}</p>
            </div>
            <p class="text-xs text-gray-400 leading-relaxed mb-3">${desc}</p>
            <div class="bg-gray-950 rounded-lg p-2">
              <p class="text-xs text-gray-500 mb-0.5">Sample subject:</p>
              <p class="text-xs text-${c}-300 font-mono italic">"${subj}"</p>
            </div>
          </div>`).join('')}
        </div>
      </div>

      <div class="card p-6">
        <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-eye text-blue-400"></i> How to Preview Before Sending</h3>
        <div class="space-y-3">
          <div class="flex gap-3 items-start p-3 bg-gray-900/60 rounded-xl">
            <span class="pill-key flex-shrink-0">1</span>
            <p class="text-sm text-gray-300">Go to <strong class="text-white">AI Website Builder → Builds tab</strong></p>
          </div>
          <div class="flex gap-3 items-start p-3 bg-gray-900/60 rounded-xl">
            <span class="pill-key flex-shrink-0">2</span>
            <p class="text-sm text-gray-300">Click the <strong class="text-pink-400">🔍 pink magnifying glass button</strong> on any build row</p>
          </div>
          <div class="flex gap-3 items-start p-3 bg-gray-900/60 rounded-xl">
            <span class="pill-key flex-shrink-0">3</span>
            <p class="text-sm text-gray-300">The preview modal shows: which variant is assigned (★), all 3 email subjects + bodies, all 3 SMS variants, and all 4 follow-up steps with their full content</p>
          </div>
          <div class="flex gap-3 items-start p-3 bg-gray-900/60 rounded-xl">
            <span class="pill-key flex-shrink-0">4</span>
            <p class="text-sm text-gray-300">Use <strong class="text-white">Copy Email</strong> to manually send via your own email client, or click <strong class="text-white">Send Outreach Now</strong> to fire via SendGrid automatically</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- SECTION 8: FOLLOW-UP -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div id="section-8" class="mb-16">
      <div class="section-header border-orange-500">
        <p class="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Section 8 · Step 6</p>
        <h2 class="text-3xl font-black text-white">14-Day Follow-Up Sequences</h2>
        <p class="text-gray-400 mt-1">80% of sales happen after the 5th contact. This system makes sure you never miss one.</p>
      </div>

      <div class="card p-6 mb-4">
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-calendar-check text-orange-400"></i> The 4-Step Sequence</h3>
        <div class="space-y-4">
          ${[
            ['Day 3','Loss Aversion Re-Hit','red','Subject: "Still losing $X/week, [Name]." Revisits the financial loss angle with even more specific numbers. Adds urgency: "I can only hold your demo for 48 more hours."'],
            ['Day 7','Social Proof + Competitor Fear','blue','Subject: "Your competitor [Competitor Name] just launched their site." Shows a competitor who recently got a website and what happened to their Google ranking. Pure FOMO trigger.'],
            ['Day 10','Scarcity + Urgency Spike','amber','Subject: "Last 2 spots this month." Creates real scarcity (you only take 3 clients/month). Price increase warning. Expiry date on their reserved slot.'],
            ['Day 14','The Breakup Email','purple','Subject: "Closing your file, [Name]." The most powerful closer. "I\'m giving your spot to another [industry] in [city]. If you want it, reply in the next 24 hours." Generates the most replies of any step.'],
          ].map(([day,title,c,desc])=>`
          <div class="flex gap-4 items-start p-4 bg-gray-900/60 rounded-xl border border-gray-800">
            <div class="text-center flex-shrink-0 w-16">
              <p class="text-xs text-gray-500 font-semibold uppercase">Send at</p>
              <p class="text-xl font-black text-${c}-400">${day}</p>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-white mb-1">${title}</p>
              <p class="text-sm text-gray-400 leading-relaxed">${desc}</p>
            </div>
          </div>`).join('')}
        </div>
      </div>

      <div class="card p-5">
        <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-play text-orange-400"></i> How to Start a Sequence</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm font-semibold text-gray-300 mb-2">Method 1 — From a Build</p>
            <div class="space-y-1 text-xs text-gray-400">
              <p>1. Builder → Builds tab</p>
              <p>2. Click the 📅 calendar icon on any build</p>
              <p>3. Sequence starts immediately, all 4 steps pre-scheduled</p>
            </div>
          </div>
          <div>
            <p class="text-sm font-semibold text-gray-300 mb-2">Method 2 — From Follow-Up Tab</p>
            <div class="space-y-1 text-xs text-gray-400">
              <p>1. Builder → Follow-Up tab</p>
              <p>2. Click "Start New Sequence"</p>
              <p>3. Enter the Lead ID and confirm</p>
              <p>4. Watch the progress bar fill as steps send</p>
            </div>
          </div>
        </div>
        <div class="tip-box mt-4">
          <p class="text-xs font-bold text-green-300 mb-1"><i class="fas fa-lightbulb"></i> The 80% Rule</p>
          <p class="text-xs text-gray-300">Research by the National Sales Executive Association shows 80% of sales require 5+ follow-ups. Most salespeople give up after 2. By running all 4 steps on every lead, you're already outworking 95% of your competition — automatically.</p>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- SECTION 9: PROPOSALS & PAYMENTS -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div id="section-9" class="mb-16">
      <div class="section-header border-emerald-500">
        <p class="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Section 9 · Step 7</p>
        <h2 class="text-3xl font-black text-white">Proposals & Stripe Payments</h2>
        <p class="text-gray-400 mt-1">Closing the deal and collecting money.</p>
      </div>

      <div class="card p-6 mb-4">
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-file-invoice-dollar text-emerald-400"></i> Creating a Proposal</h3>
        <div class="space-y-3">
          <div class="flex gap-3 p-3 bg-gray-900/60 rounded-xl">
            <span class="pill-key flex-shrink-0">Method 1</span>
            <p class="text-sm text-gray-300">From any lead row, click the <strong class="text-yellow-400">📄 proposal icon</strong> — pre-fills business name and owner name automatically</p>
          </div>
          <div class="flex gap-3 p-3 bg-gray-900/60 rounded-xl">
            <span class="pill-key flex-shrink-0">Method 2</span>
            <p class="text-sm text-gray-300">Go to <strong class="text-white">Proposals tab → New Proposal</strong> — manual entry for any lead or standalone client</p>
          </div>
        </div>

        <div class="mt-4 space-y-3">
          <p class="text-sm font-bold text-white">What the Proposal Preview Shows:</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${[
              ['EXPIRES banner','Creates urgency — 7-day automatic expiry date','fas fa-clock','amber'],
              ['Loss box (red)','Quantified weekly/monthly revenue loss without a website','fas fa-chart-line','red'],
              ['Anchor pricing','Strikethrough original price → discounted price → "You save $X"','fas fa-tag','blue'],
              ['ROI grid','3-month, 6-month, and 12-month projected return on investment','fas fa-trophy','green'],
              ['Guarantee badge','100% satisfaction guarantee — removes risk objection instantly','fas fa-shield-alt','emerald'],
              ['Scarcity block','"3 clients/month max" — limits your availability, raises perceived value','fas fa-lock','orange'],
              ['3-step process','Numbered steps: deposit → build → go live. Simple and clear.','fas fa-list-ol','purple'],
            ].map(([label,desc,icon,c])=>`
            <div class="flex gap-3 items-start p-3 bg-gray-900/60 rounded-lg">
              <i class="${icon} text-${c}-400 text-sm mt-0.5 flex-shrink-0 w-4 text-center"></i>
              <div>
                <p class="text-xs font-bold text-white">${label}</p>
                <p class="text-xs text-gray-400">${desc}</p>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="card p-6">
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-credit-card text-emerald-400"></i> Collecting Payment via Stripe</h3>
        <div class="space-y-3">
          <div class="flex gap-3 items-start p-3 bg-gray-900/60 rounded-xl">
            <span class="step-num bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 text-sm flex-shrink-0">1</span>
            <div>
              <p class="text-sm font-semibold text-white">Client is ready to pay</p>
              <p class="text-xs text-gray-400 mt-1">Go to Proposals tab. Find their proposal. Click the green <strong class="text-emerald-400">💳 Pay button</strong>.</p>
            </div>
          </div>
          <div class="flex gap-3 items-start p-3 bg-gray-900/60 rounded-xl">
            <span class="step-num bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 text-sm flex-shrink-0">2</span>
            <div>
              <p class="text-sm font-semibold text-white">System opens the Stripe payment link</p>
              <p class="text-xs text-gray-400 mt-1">The Stripe link for their package tier opens in a new tab. Send that link to your client via text or email. They pay directly on Stripe's secure checkout.</p>
            </div>
          </div>
          <div class="flex gap-3 items-start p-3 bg-gray-900/60 rounded-xl">
            <span class="step-num bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 text-sm flex-shrink-0">3</span>
            <div>
              <p class="text-sm font-semibold text-white">Mark as Paid when confirmed</p>
              <p class="text-xs text-gray-400 mt-1">After Stripe confirms the payment, click <strong class="text-white">Mark as Paid</strong>. This automatically: marks the proposal Accepted → updates the lead status to Won → creates a Client record → logs an invoice.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- SECTION 10: CLIENTS & REVENUE -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div id="section-10" class="mb-16">
      <div class="section-header border-cyan-500">
        <p class="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">Section 10 · Step 8</p>
        <h2 class="text-3xl font-black text-white">Clients & Revenue Tracking</h2>
        <p class="text-gray-400 mt-1">Managing your paying clients and watching the money stack up.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card p-5">
          <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-users text-cyan-400"></i> Clients Tab</h3>
          <div class="space-y-2 text-sm text-gray-400">
            <p>All paying clients in one place. Each client has:</p>
            <div class="space-y-1 mt-2">
              ${[
                'Business name, owner, phone, email, address',
                'Website URL (their live site)',
                'Contract start/end dates',
                'Monthly recurring fee tracking',
                'Notes field for anything important',
                'Full activity history',
              ].map(f=>`<p class="flex items-center gap-2"><i class="fas fa-check-circle text-cyan-400 text-xs"></i>${f}</p>`).join('')}
            </div>
          </div>
        </div>
        <div class="card p-5">
          <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-chart-bar text-cyan-400"></i> Revenue Report Tab</h3>
          <div class="space-y-2 text-sm text-gray-400">
            <p>Your money dashboard. Shows:</p>
            <div class="space-y-1 mt-2">
              ${[
                'Total all-time revenue',
                'Monthly Recurring Revenue (MRR)',
                'Revenue by month chart',
                'Revenue by package tier breakdown',
                'Pipeline value (projected if all leads close)',
                'Win rate percentage',
              ].map(f=>`<p class="flex items-center gap-2"><i class="fas fa-check-circle text-cyan-400 text-xs"></i>${f}</p>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- SECTION 11: FULL AUTOMATION STACK -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div id="section-11" class="mb-16">
      <div class="section-header border-amber-500">
        <p class="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">Section 11 · The End Game</p>
        <h2 class="text-3xl font-black text-white">The Full Automation Stack</h2>
        <p class="text-gray-400 mt-1">When every toggle is ON, this is what happens automatically without you lifting a finger.</p>
      </div>

      <div class="card p-6 mb-4">
        <h3 class="font-bold text-white mb-5 flex items-center gap-2"><i class="fas fa-bolt text-amber-400"></i> What Runs on Autopilot</h3>
        <div class="space-y-3">
          ${[
            ['Every Hour','Auto-Prospector fires','Searches Google Maps in your ZIP queue. Finds businesses without websites. Adds them as new leads. Logs activity.','fas fa-clock','amber'],
            ['Immediately After Lead Added','Deep Research triggers','OpenAI analyzes the business — pulls Google data, competitor info, local search volume, and generates a full intelligence report.','fas fa-brain','purple'],
            ['After Research Completes','Lovable Website Prompt Generated','The AI builds a complete website prompt using the research. Launches Lovable.dev with the prompt pre-filled.','fas fa-magic','pink'],
            ['After Build is Ready','Outreach Fires Automatically','SendGrid sends the A/B/C email. Twilio sends the SMS. Both are personalized with the business name, owner name, city, industry, and loss numbers.','fas fa-paper-plane','blue'],
            ['3 / 7 / 10 / 14 Days Later','Follow-Up Sequence Continues','If you started a sequence, each step fires automatically at the scheduled time via the send-step API. No manual involvement needed.','fas fa-calendar-alt','orange'],
            ['When Lead Responds','You See It in Your Email','The lead replies to your personal email address (not a system address). You pick up the conversation from there, send the proposal, close the deal.','fas fa-inbox','green'],
          ].map(([when,what,desc,icon,c])=>`
          <div class="flex gap-4 items-start p-4 bg-${c}-950/20 border border-${c}-800/30 rounded-xl">
            <div class="flex-shrink-0 text-center w-20">
              <i class="${icon} text-${c}-400 text-xl mb-1 block"></i>
              <p class="text-xs text-${c}-400 font-bold leading-tight">${when}</p>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-white mb-1">${what}</p>
              <p class="text-sm text-gray-400 leading-relaxed">${desc}</p>
            </div>
            <span class="badge pill-auto flex-shrink-0"><i class="fas fa-robot"></i> AUTO</span>
          </div>`).join('')}
        </div>
      </div>

      <div class="card p-6">
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-list-check text-green-400"></i> Full Autopilot Checklist</h3>
        <p class="text-sm text-gray-400 mb-4">Complete these once and the system runs itself:</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          ${[
            ['OpenAI API key saved in Builder Settings','Required for deep research'],
            ['SendGrid API key saved in Builder Settings','Required for email outreach'],
            ['Twilio credentials saved in Builder Settings','Required for SMS outreach'],
            ['Google Maps API key saved in Auto-Prospector','Required for finding leads'],
            ['Your contact info filled in (name, phone, email)','Required for personalization'],
            ['ZIP codes added to prospector queue','At least 5 ZIPs to start'],
            ['Industries selected in prospector','All 8 are on by default'],
            ['Stripe payment links saved for all 4 tiers','Required for online payments'],
            ['Auto-Research toggle ON in Builder Settings','Triggers research on new leads'],
            ['Auto-Build toggle ON in Builder Settings','Triggers site prompt after research'],
            ['Auto-Outreach toggle ON in Builder Settings','Fires email + SMS after build'],
            ['Auto-Prospector toggle ON','Runs hourly Google Maps search'],
          ].map(([task,note])=>`
          <div class="flex items-start gap-3 p-3 bg-gray-900/60 rounded-lg">
            <div class="w-5 h-5 rounded border-2 border-gray-600 flex-shrink-0 mt-0.5 flex items-center justify-center">
              <i class="fas fa-check text-green-400 text-xs"></i>
            </div>
            <div>
              <p class="text-sm text-white font-medium">${task}</p>
              <p class="text-xs text-gray-500">${note}</p>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- SECTION 12: PRO TIPS & MONEY MATH -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div id="section-12" class="mb-16">
      <div class="section-header border-red-500">
        <p class="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Section 12 · The Money Math</p>
        <h2 class="text-3xl font-black text-white">Pro Tips, Strategy & What This Is Actually Worth</h2>
      </div>

      <!-- Money Math -->
      <div class="card p-6 mb-4 bg-gradient-to-br from-gray-900 to-emerald-950/20 border-emerald-800/40">
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-calculator text-emerald-400"></i> Conservative Money Math</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-6">
          ${[
            ['50','Leads/week','auto-prospected','gray'],
            ['3%','Close Rate','conservative estimate','blue'],
            ['1–2','Deals/week','at consistent operation','emerald'],
            ['$1,497','Avg Deal','Professional package','yellow'],
          ].map(([val,label,sub,c])=>`
          <div class="bg-${c}-950/30 border border-${c}-800/30 rounded-xl p-4">
            <p class="text-3xl font-black text-${c}-300">${val}</p>
            <p class="text-sm font-bold text-white">${label}</p>
            <p class="text-xs text-gray-500">${sub}</p>
          </div>`).join('')}
        </div>
        <div class="bg-emerald-950/40 border border-emerald-700/40 rounded-xl p-5">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p class="text-xs text-gray-500 uppercase font-semibold mb-1">1 Deal/Week</p>
              <p class="text-4xl font-black grad-green">$72,000</p>
              <p class="text-sm text-gray-400">setup revenue/year</p>
              <p class="text-xs text-gray-500 mt-1">+ $4,800/yr recurring</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 uppercase font-semibold mb-1">2 Deals/Week</p>
              <p class="text-4xl font-black grad-green">$144,000</p>
              <p class="text-sm text-gray-400">setup revenue/year</p>
              <p class="text-xs text-gray-500 mt-1">+ $9,600/yr recurring</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 uppercase font-semibold mb-1">5 Deals/Week</p>
              <p class="text-4xl font-black text-yellow-400">$360,000+</p>
              <p class="text-sm text-gray-400">setup revenue/year</p>
              <p class="text-xs text-gray-500 mt-1">+ $24,000/yr recurring</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Pro Tips -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        ${[
          {title:'Lead With Loss, Not Features', icon:'fas fa-brain', c:'red', tips:[
            'Never say "I can build you a website." Say "You\'re losing $X every week you don\'t have one."',
            'Use the specific dollar amounts the system calculates per industry — don\'t round them',
            'Pain is 2.5× more motivating than gain (Kahneman, 1984). Make it hurt first.',
          ]},
          {title:'The Perfect Outreach Timing', icon:'fas fa-clock', c:'blue', tips:[
            'Best email open times: Tuesday–Thursday, 8–9am or 4–5pm in the recipient\'s timezone',
            'SMS open rates are 98% within 3 minutes. Always send SMS same day as email.',
            'Day 14 breakup email has the single highest reply rate of all 5 touchpoints.',
          ]},
          {title:'Close Rate Multipliers', icon:'fas fa-rocket', c:'green', tips:[
            'Including the Lovable demo link raises response rate by ~40% vs text-only email',
            'Phone calls after Day 10 email triple your close rate — use the phone number from the lead',
            'Referrals from your first 5 clients can account for 30–50% of future business',
          ]},
          {title:'Industry Targeting Priorities', icon:'fas fa-target', c:'purple', tips:[
            '#1: Home Services (plumbers, electricians, HVAC) — avg customer value $350, desperate need',
            '#2: Salons & Spas — strong online booking demand, social media presence helps',
            '#3: Auto Repair — loyal customers, high lifetime value, low tech sophistication',
            'Avoid restaurants in Year 1 — high churn, low margins, slow decisions',
          ]},
        ].map(({title,icon,c,tips})=>`
        <div class="card p-5">
          <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="${icon} text-${c}-400"></i>${title}</h3>
          <div class="space-y-2">
            ${tips.map(t=>`<p class="text-xs text-gray-300 flex gap-2"><i class="fas fa-angle-right text-${c}-400 flex-shrink-0 mt-0.5"></i>${t}</p>`).join('')}
          </div>
        </div>`).join('')}
      </div>

      <!-- Tasks Tab -->
      <div class="card p-5 mb-4">
        <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-tasks text-orange-400"></i> Tasks Tab — Your Daily CRM</h3>
        <p class="text-sm text-gray-400 mb-3">Use the Tasks tab to manage your personal to-do list. Set follow-up reminders, note when to call a lead back, track deliverable deadlines for active clients. Each task can be tied to a specific lead or client and flagged with a priority level.</p>
        <div class="grid grid-cols-3 gap-3">
          ${[['High','Urgent — do today','red'],['Medium','This week','yellow'],['Low','When possible','gray']].map(([p,d,c])=>`
          <div class="bg-${c}-950/30 border border-${c}-800/30 rounded-lg p-3 text-center">
            <p class="text-sm font-bold text-${c}-300">${p}</p>
            <p class="text-xs text-gray-500">${d}</p>
          </div>`).join('')}
        </div>
      </div>

      <!-- Activity Timeline -->
      <div class="card p-5">
        <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-history text-gray-400"></i> Activity Timeline</h3>
        <p class="text-sm text-gray-400">Every action in the system — lead added, outreach sent, proposal created, payment received — is logged in the Activity Timeline. Click "View All Activity" from the Dashboard, or navigate to it directly. This is your audit trail and accountability feed.</p>
      </div>
    </div>

    <!-- FINAL CTA -->
    <div class="card p-8 text-center mb-10 bg-gradient-to-br from-purple-950/40 via-pink-950/30 to-indigo-950/40 border-purple-700/40">
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/30 to-purple-600/30 border border-pink-500/30 flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-rocket text-pink-400 text-2xl"></i>
      </div>
      <h2 class="text-3xl font-black text-white mb-3">You Know Everything. Now Go Get Paid.</h2>
      <p class="text-gray-400 max-w-2xl mx-auto mb-6 leading-relaxed">
        The system is configured, the automation is running, the outreach is going out, and the follow-ups are scheduled. Your only job now is to respond to leads when they reply, send the proposal, and click Mark as Paid.
      </p>
      <div class="flex flex-wrap justify-center gap-4">
        <a href="/?page=prospector" onclick="localStorage.setItem('startPage','prospector')" href="/"
          class="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg">
          <i class="fas fa-robot mr-2"></i>Start Auto-Prospector
        </a>
        <a href="/"
          class="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg">
          <i class="fas fa-magic mr-2"></i>Open Website Builder
        </a>
        <a href="/"
          class="bg-gray-800 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-xl transition-all border border-gray-700">
          <i class="fas fa-chart-pie mr-2"></i>View Dashboard
        </a>
      </div>
    </div>

    <p class="text-center text-xs text-gray-600 pb-8">Google Money Drop — Built to make you money, not just look pretty. 💰</p>
  </div>

  <script>
    // Smooth scroll for TOC links
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault()
        const el = document.querySelector(a.getAttribute('href'))
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  </script>
</body>
</html>`)
})

// ── /crm — hidden route serving the legacy Google Money Drop CRM ─────────────
app.get('/crm', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Google Money Drop – Lead & Client Management</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css"/>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <link rel="stylesheet" href="/static/style.css"/>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen flex">

  <!-- Sidebar -->
  <aside id="sidebar" class="sidebar-expanded fixed top-0 left-0 h-full bg-gray-900 border-r border-gray-800 flex flex-col z-50">

    <!-- Minimize toggle button -->
    <button id="sidebar-toggle" onclick="toggleSidebar()" title="Toggle sidebar"
      class="sidebar-toggle-btn absolute -right-3.5 top-6 w-7 h-7 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 hover:border-blue-500 transition-all z-10 group">
      <i id="sidebar-toggle-icon" class="fas fa-chevron-left text-gray-400 group-hover:text-white text-xs transition-transform duration-300"></i>
    </button>

    <!-- Logo -->
    <div class="sidebar-logo p-5 border-b border-gray-800 overflow-hidden">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
          <i class="fas fa-globe text-white text-sm"></i>
        </div>
        <div class="sidebar-label overflow-hidden whitespace-nowrap">
          <h1 class="font-bold text-white text-sm leading-tight">Google Money Drop</h1>
          <p class="text-xs text-gray-500">Business Platform</p>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
      <button onclick="navigateTo('dashboard')" id="nav-dashboard" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all active" title="Dashboard">
        <i class="fas fa-chart-pie w-4 text-center flex-shrink-0"></i>
        <span class="sidebar-label whitespace-nowrap overflow-hidden">Dashboard</span>
      </button>
      <button onclick="navigateTo('leads')" id="nav-leads" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all" title="Leads">
        <i class="fas fa-map-marker-alt w-4 text-center flex-shrink-0"></i>
        <span class="sidebar-label whitespace-nowrap overflow-hidden">Leads</span>
        <span id="nav-leads-count" class="sidebar-label ml-auto text-xs bg-blue-600 text-white rounded-full px-1.5 py-0.5 hidden"></span>
      </button>
      <button onclick="navigateTo('pipeline')" id="nav-pipeline" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all" title="Pipeline">
        <i class="fas fa-stream w-4 text-center flex-shrink-0"></i>
        <span class="sidebar-label whitespace-nowrap overflow-hidden">Pipeline</span>
      </button>
      <button onclick="navigateTo('clients')" id="nav-clients" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all" title="Clients">
        <i class="fas fa-users w-4 text-center flex-shrink-0"></i>
        <span class="sidebar-label whitespace-nowrap overflow-hidden">Clients</span>
      </button>
      <button onclick="navigateTo('proposals')" id="nav-proposals" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all" title="Proposals">
        <i class="fas fa-file-invoice-dollar w-4 text-center flex-shrink-0"></i>
        <span class="sidebar-label whitespace-nowrap overflow-hidden">Proposals</span>
      </button>
      <button onclick="navigateTo('tasks')" id="nav-tasks" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all" title="Tasks">
        <i class="fas fa-tasks w-4 text-center flex-shrink-0"></i>
        <span class="sidebar-label whitespace-nowrap overflow-hidden">Tasks</span>
        <span id="nav-tasks-count" class="sidebar-label ml-auto text-xs bg-orange-500 text-white rounded-full px-1.5 py-0.5 hidden"></span>
      </button>

      <div class="pt-3 pb-1 sidebar-label overflow-hidden">
        <p class="text-xs font-semibold text-gray-600 uppercase tracking-wider px-3 whitespace-nowrap">Reports</p>
      </div>
      <div class="sidebar-collapsed-divider hidden"><div class="h-px bg-gray-800 mx-2 my-2"></div></div>
      <button onclick="navigateTo('revenue')" id="nav-revenue" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all" title="Revenue">
        <i class="fas fa-dollar-sign w-4 text-center flex-shrink-0"></i>
        <span class="sidebar-label whitespace-nowrap overflow-hidden">Revenue</span>
      </button>
      <button onclick="navigateTo('scraper')" id="nav-scraper" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all" title="Lead Finder">
        <i class="fas fa-search-location w-4 text-center flex-shrink-0"></i>
        <span class="sidebar-label whitespace-nowrap overflow-hidden">Lead Finder</span>
      </button>

      <div class="pt-3 pb-1 sidebar-label overflow-hidden">
        <p class="text-xs font-semibold text-gray-600 uppercase tracking-wider px-3 whitespace-nowrap">Automation</p>
      </div>
      <div class="sidebar-collapsed-divider hidden"><div class="h-px bg-gray-800 mx-2 my-2"></div></div>
      <button onclick="navigateTo('prospector')" id="nav-prospector" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all" title="Auto-Prospector">
        <i class="fas fa-robot w-4 text-center flex-shrink-0"></i>
        <span class="sidebar-label whitespace-nowrap overflow-hidden">Auto-Prospector</span>
        <span id="nav-prospector-pulse" class="sidebar-label ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse hidden"></span>
      </button>
      <button onclick="navigateTo('builder')" id="nav-builder" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all" title="Website Builder">
        <i class="fas fa-magic w-4 text-center flex-shrink-0"></i>
        <span class="sidebar-label whitespace-nowrap overflow-hidden">Website Builder</span>
        <span id="nav-builder-count" class="sidebar-label ml-auto text-xs bg-pink-600 text-white rounded-full px-1.5 py-0.5 hidden"></span>
      </button>
      <div class="pt-3 pb-1 sidebar-label overflow-hidden">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3">Help</p>
      </div>
      <div class="sidebar-collapsed-divider hidden"><div class="h-px bg-gray-800 mx-2 my-2"></div></div>
      <button onclick="window.location='/tutorial'" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all" title="How To Use">
        <i class="fas fa-graduation-cap w-4 text-center flex-shrink-0"></i>
        <span class="sidebar-label whitespace-nowrap overflow-hidden">How To Use</span>
        <span class="sidebar-label ml-auto text-xs bg-green-600 text-white rounded-full px-1.5 py-0.5">NEW</span>
      </button>
    </nav>

    <!-- User / Settings bar -->
    <div class="border-t border-gray-800 overflow-hidden">
      <!-- Expanded state -->
      <div class="sidebar-user-expanded flex items-center gap-2 px-3 py-3">
        <!-- Avatar → Profile -->
        <button onclick="navigateTo('profile')" id="sidebar-avatar-btn"
          title="Your Profile"
          class="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 hover:ring-2 hover:ring-green-400 hover:ring-offset-2 hover:ring-offset-gray-900 transition-all cursor-pointer"
          id="sidebar-user-avatar">YB</button>
        <!-- Name + role -->
        <div class="sidebar-label min-w-0 overflow-hidden flex-1 cursor-pointer" onclick="navigateTo('profile')">
          <p id="sidebar-user-name" class="text-sm font-medium text-white truncate whitespace-nowrap">Your Business</p>
          <p id="sidebar-user-role" class="text-xs text-gray-500 truncate whitespace-nowrap">Admin</p>
        </div>
        <!-- Settings cog -->
        <button onclick="navigateTo('settings')" id="nav-settings"
          title="Settings"
          class="sidebar-label flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-all">
          <i class="fas fa-cog text-sm"></i>
        </button>
      </div>
      <!-- Collapsed state: show avatar only -->
      <div class="sidebar-collapsed-divider hidden flex-col items-center gap-2 py-3">
        <button onclick="navigateTo('profile')" title="Profile"
          class="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-xs font-bold text-white hover:ring-2 hover:ring-green-400 transition-all"
          id="sidebar-user-avatar-sm">YB</button>
        <button onclick="navigateTo('settings')" title="Settings"
          class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-all">
          <i class="fas fa-cog text-sm"></i>
        </button>
      </div>
    </div>
  </aside>

  <!-- Main content -->
  <div id="main-wrapper" class="sidebar-main-expanded flex-1 flex flex-col min-h-screen">
    <!-- Top bar -->
    <header class="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
      <div class="flex items-center gap-4">
        <h2 id="page-title" class="text-lg font-bold text-white">Dashboard</h2>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative">
          <input id="global-search" type="text" placeholder="Search businesses..." class="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500 w-56 transition-all focus:w-72"/>
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
        </div>
        <button onclick="showAddLeadModal()" class="btn-primary flex items-center gap-2 text-sm">
          <i class="fas fa-plus"></i> Add Lead
        </button>
      </div>
    </header>

    <!-- Page Content -->
    <main id="main-content" class="flex-1 p-6 overflow-auto">
      <!-- Content injected by JS -->
    </main>
  </div>

  <!-- ========== MODALS ========== -->

  <!-- Add/Edit Lead Modal -->
  <div id="lead-modal" class="modal-overlay hidden">
    <div class="modal-box w-full max-w-2xl">
      <div class="flex items-center justify-between mb-6">
        <h3 id="lead-modal-title" class="text-lg font-bold text-white">Add New Lead</h3>
        <button onclick="closeModal('lead-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
      </div>
      <form id="lead-form" class="grid grid-cols-2 gap-4">
        <input type="hidden" id="lead-id"/>
        <div class="col-span-2">
          <label class="form-label">Business Name *</label>
          <input id="lead-business-name" type="text" class="form-input w-full" placeholder="Mike's Plumbing" required/>
        </div>
        <div>
          <label class="form-label">Owner Name</label>
          <input id="lead-owner-name" type="text" class="form-input w-full" placeholder="Mike Johnson"/>
        </div>
        <div>
          <label class="form-label">Industry *</label>
          <select id="lead-industry" class="form-input w-full" required>
            <option value="">Select industry...</option>
            <option>Home Services</option>
            <option>Restaurant</option>
            <option>Salon</option>
            <option>Auto Repair</option>
            <option>Retail</option>
            <option>Healthcare</option>
            <option>Legal</option>
            <option>Fitness</option>
            <option>Education</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label class="form-label">City *</label>
          <input id="lead-city" type="text" class="form-input w-full" placeholder="Austin" required/>
        </div>
        <div>
          <label class="form-label">Phone</label>
          <input id="lead-phone" type="text" class="form-input w-full" placeholder="(512) 555-0101"/>
        </div>
        <div>
          <label class="form-label">Email</label>
          <input id="lead-email" type="email" class="form-input w-full" placeholder="owner@business.com"/>
        </div>
        <div class="col-span-2">
          <label class="form-label">Address</label>
          <input id="lead-address" type="text" class="form-input w-full" placeholder="123 Main St, Austin TX"/>
        </div>
        <div class="col-span-2">
          <label class="form-label">Google Maps URL</label>
          <input id="lead-maps-url" type="text" class="form-input w-full" placeholder="https://maps.google.com/..."/>
        </div>
        <div>
          <label class="form-label">Status</label>
          <select id="lead-status" class="form-input w-full">
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="demo_sent">Demo Sent</option>
            <option value="proposal_sent">Proposal Sent</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </div>
        <div>
          <label class="form-label">Source</label>
          <select id="lead-source" class="form-input w-full">
            <option value="google_maps">Google Maps</option>
            <option value="referral">Referral</option>
            <option value="cold_call">Cold Call</option>
            <option value="walk_in">Walk-in</option>
            <option value="social_media">Social Media</option>
          </select>
        </div>
        <div class="col-span-2">
          <label class="form-label">Notes</label>
          <textarea id="lead-notes" class="form-input w-full" rows="3" placeholder="Any notes about this lead..."></textarea>
        </div>
        <div class="col-span-2 flex gap-3 justify-end pt-2">
          <button type="button" onclick="closeModal('lead-modal')" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">Save Lead</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Add/Edit Client Modal -->
  <div id="client-modal" class="modal-overlay hidden">
    <div class="modal-box w-full max-w-2xl">
      <div class="flex items-center justify-between mb-6">
        <h3 id="client-modal-title" class="text-lg font-bold text-white">Add New Client</h3>
        <button onclick="closeModal('client-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
      </div>
      <form id="client-form" class="grid grid-cols-2 gap-4">
        <input type="hidden" id="client-id"/>
        <div class="col-span-2">
          <label class="form-label">Business Name *</label>
          <input id="client-business-name" type="text" class="form-input w-full" required/>
        </div>
        <div>
          <label class="form-label">Owner Name</label>
          <input id="client-owner-name" type="text" class="form-input w-full"/>
        </div>
        <div>
          <label class="form-label">Industry *</label>
          <select id="client-industry" class="form-input w-full" required>
            <option value="">Select industry...</option>
            <option>Home Services</option><option>Restaurant</option><option>Salon</option>
            <option>Auto Repair</option><option>Retail</option><option>Healthcare</option>
            <option>Legal</option><option>Fitness</option><option>Education</option><option>Other</option>
          </select>
        </div>
        <div>
          <label class="form-label">City *</label>
          <input id="client-city" type="text" class="form-input w-full" required/>
        </div>
        <div>
          <label class="form-label">Phone</label>
          <input id="client-phone" type="text" class="form-input w-full"/>
        </div>
        <div>
          <label class="form-label">Email</label>
          <input id="client-email" type="email" class="form-input w-full"/>
        </div>
        <div>
          <label class="form-label">Package Tier *</label>
          <select id="client-package" class="form-input w-full" onchange="updateClientPrice()" required>
            <option value="">Select package...</option>
            <option value="Starter">Starter ($799)</option>
            <option value="Professional">⭐ Professional ($1,497) — Most Popular</option>
            <option value="Premium">Premium ($2,997)</option>
            <option value="Enterprise">Enterprise ($5,997) — Price Anchor</option>
          </select>
        </div>
        <div>
          <label class="form-label">Package Price ($) *</label>
          <input id="client-price" type="number" class="form-input w-full" required/>
        </div>
        <div>
          <label class="form-label">Monthly Recurring ($)</label>
          <input id="client-recurring" type="number" class="form-input w-full" value="0"/>
        </div>
        <div>
          <label class="form-label">Status</label>
          <select id="client-status" class="form-input w-full">
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="churned">Churned</option>
          </select>
        </div>
        <div class="col-span-2">
          <label class="form-label">Website URL</label>
          <input id="client-website" type="text" class="form-input w-full" placeholder="https://..."/>
        </div>
        <div class="col-span-2">
          <label class="form-label">Notes</label>
          <textarea id="client-notes" class="form-input w-full" rows="2"></textarea>
        </div>
        <div class="col-span-2 flex gap-3 justify-end pt-2">
          <button type="button" onclick="closeModal('client-modal')" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">Save Client</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Proposal Generator Modal -->
  <div id="proposal-modal" class="modal-overlay hidden">
    <div class="modal-box w-full max-w-3xl">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-bold text-white"><i class="fas fa-file-invoice-dollar mr-2 text-blue-400"></i>Generate Proposal</h3>
        <button onclick="closeModal('proposal-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
      </div>
      <div class="grid grid-cols-2 gap-6">
        <!-- Left: Form -->
        <div class="space-y-4">
          <input type="hidden" id="proposal-id"/>
          <input type="hidden" id="proposal-lead-id"/>
          <div>
            <label class="form-label">Business Name *</label>
            <input id="proposal-business-name" type="text" class="form-input w-full" oninput="updateProposalPreview()"/>
          </div>
          <div>
            <label class="form-label">Owner Name</label>
            <input id="proposal-owner-name" type="text" class="form-input w-full" oninput="updateProposalPreview()"/>
          </div>
          <div>
            <label class="form-label">Package *</label>
            <select id="proposal-package" class="form-input w-full" onchange="updateProposalPackage()">
              <option value="Starter">Starter ($799)</option>
              <option value="Professional" selected>⭐ Professional ($1,497) — Most Popular</option>
              <option value="Premium">Premium ($2,997)</option>
              <option value="Enterprise">Enterprise ($5,997) — Price Anchor</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label">Price ($)</label>
              <input id="proposal-price" type="number" class="form-input w-full" value="1500" oninput="updateProposalPreview()"/>
            </div>
            <div>
              <label class="form-label">Monthly ($)</label>
              <input id="proposal-recurring" type="number" class="form-input w-full" value="75" oninput="updateProposalPreview()"/>
            </div>
          </div>
          <div>
            <label class="form-label">Features (check to include)</label>
            <div id="proposal-features" class="space-y-2 mt-2 max-h-40 overflow-y-auto pr-1"></div>
          </div>
          <div>
            <label class="form-label">Custom Message</label>
            <textarea id="proposal-message" class="form-input w-full text-sm" rows="3" oninput="updateProposalPreview()"></textarea>
          </div>
          <div>
            <label class="form-label">Status</label>
            <select id="proposal-status" class="form-input w-full">
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>
        <!-- Right: Preview -->
        <div>
          <label class="form-label mb-2">Preview</label>
          <div id="proposal-preview" class="bg-gray-950 border border-gray-700 rounded-xl p-4 text-xs overflow-y-auto max-h-[480px] space-y-3"></div>
        </div>
      </div>
      <div class="flex gap-3 justify-end pt-4 mt-2 border-t border-gray-800">
        <button type="button" onclick="closeModal('proposal-modal')" class="btn-secondary">Cancel</button>
        <button onclick="copyProposalText()" class="btn-secondary"><i class="fas fa-copy mr-1"></i>Copy</button>
        <button onclick="saveProposal()" class="btn-primary"><i class="fas fa-save mr-1"></i>Save Proposal</button>
      </div>
    </div>
  </div>

  <!-- Task Modal -->
  <div id="task-modal" class="modal-overlay hidden">
    <div class="modal-box w-full max-w-lg">
      <div class="flex items-center justify-between mb-6">
        <h3 id="task-modal-title" class="text-lg font-bold text-white">Add Task</h3>
        <button onclick="closeModal('task-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
      </div>
      <form id="task-form" class="space-y-4">
        <input type="hidden" id="task-id"/>
        <div>
          <label class="form-label">Title *</label>
          <input id="task-title" type="text" class="form-input w-full" required/>
        </div>
        <div>
          <label class="form-label">Description</label>
          <textarea id="task-description" class="form-input w-full" rows="2"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label">Priority</label>
            <select id="task-priority" class="form-input w-full">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label class="form-label">Status</label>
            <select id="task-status" class="form-input w-full">
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>
        <div>
          <label class="form-label">Due Date</label>
          <input id="task-due-date" type="date" class="form-input w-full"/>
        </div>
        <div class="flex gap-3 justify-end pt-2">
          <button type="button" onclick="closeModal('task-modal')" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">Save Task</button>
        </div>
      </form>
    </div>
  </div>

  <!-- View Lead Detail Modal -->
  <div id="lead-detail-modal" class="modal-overlay hidden">
    <div class="modal-box w-full max-w-2xl">
      <div class="flex items-center justify-between mb-4">
        <h3 id="ld-title" class="text-lg font-bold text-white"></h3>
        <button onclick="closeModal('lead-detail-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
      </div>
      <div id="lead-detail-content"></div>
    </div>
  </div>

  <!-- Toast notification -->
  <div id="toast" class="fixed bottom-6 right-6 z-[100] hidden">
    <div id="toast-inner" class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border"></div>
  </div>

  <script src="/static/app.js"></script>
</body>
</html>`)
})

// ── Begyn.ai Landing Page — BI from Begyn ─────────────────────────────────────
app.get('/', (c) => {
  const today = new Date().toISOString().split('T')[0]
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>

  <!-- Primary SEO -->
  <title>Begyn.ai | AI Business Intelligence Platform for Entrepreneurs & Small Business</title>
  <meta name="description" content="Begyn.ai is the AI revenue operating system for small business. AI voice agents answer every call 24/7 while predictive intelligence forecasts your revenue. 7-day free trial — no credit card."/>
  <meta name="keywords" content="AI business intelligence, business intelligence for small business, AI voice agents for business, automated analytics platform, AI for entrepreneurs, business automation software, lead intelligence AI, AI workflow automation, revenue forecasting AI, Begyn AI"/>
  <link rel="canonical" href="https://begyn.online/"/>
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/>
  <meta name="author" content="Begyn.ai Team"/>
  <meta name="revisit-after" content="3 days"/>

  <!-- Freshness signal (critical for all AI engines) -->
  <meta name="date" content="${today}"/>
  <meta name="last-modified" content="${today}"/>

  <!-- Open Graph -->
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="Begyn.ai | Answers Every Call. Predicts Every Dollar."/>
  <meta property="og:description" content="The AI revenue operating system for small business: 24/7 AI voice agents + predictive revenue intelligence in one platform. 7-day free trial, no credit card."/>
  <meta property="og:url" content="https://begyn.online/"/>
  <meta property="og:site_name" content="Begyn.ai"/>
  <meta property="og:image" content="https://begyn.online/static/og-image.png"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:locale" content="en_US"/>

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:site" content="@BegynAI"/>
  <meta name="twitter:title" content="Begyn.ai | Answers Every Call. Predicts Every Dollar."/>
  <meta name="twitter:description" content="24/7 AI voice agents + predictive revenue intelligence in one platform. 7-day free trial, no credit card."/>
  <meta name="twitter:image" content="https://begyn.online/static/og-image.png"/>

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://begyn.online/#organization",
        "name": "Begyn.ai",
        "url": "https://begyn.online",
        "logo": {
          "@type": "ImageObject",
          "url": "https://begyn.online/static/favicon.svg",
          "width": 512,
          "height": 512
        },
        "description": "AI-powered business intelligence platform for entrepreneurs and small businesses",
        "sameAs": [
          "https://twitter.com/BegynAI",
          "https://linkedin.com/company/begyn-ai",
          "https://crunchbase.com/organization/begyn-ai"
        ],
        "contactPoint": {
          "@type": "ContactPoint",
          "contactType": "customer support",
          "email": "hello@begyn.online",
          "availableLanguage": "English"
        }
      },
      {
        "@type": "WebSite",
        "@id": "https://begyn.online/#website",
        "url": "https://begyn.online",
        "name": "Begyn.ai",
        "publisher": { "@id": "https://begyn.online/#organization" },
        "potentialAction": {
          "@type": "SearchAction",
          "target": { "@type": "EntryPoint", "urlTemplate": "https://begyn.online/blog?q={search_term_string}" },
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "WebPage",
        "@id": "https://begyn.online/#webpage",
        "url": "https://begyn.online",
        "name": "Begyn.ai | AI Business Intelligence Platform for Entrepreneurs",
        "description": "AI-powered business intelligence for entrepreneurs. Voice agents, lead scoring, automated analytics, and workflow automation — starting free.",
        "isPartOf": { "@id": "https://begyn.online/#website" },
        "about": { "@id": "https://begyn.online/#organization" },
        "dateModified": "${today}"
      },
      {
        "@type": "SoftwareApplication",
        "name": "Begyn.ai",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "url": "https://begyn.online",
        "offers": [
          { "@type": "Offer", "name": "7-Day Free Trial", "price": "0", "priceCurrency": "USD", "description": "7 days of full Scale-tier access — no credit card required, cancel anytime" },
          { "@type": "Offer", "name": "Growth", "price": "199", "priceCurrency": "USD", "priceSpecification": { "@type": "UnitPriceSpecification", "billingDuration": "P1M" } },
          { "@type": "Offer", "name": "Scale", "price": "499", "priceCurrency": "USD", "priceSpecification": { "@type": "UnitPriceSpecification", "billingDuration": "P1M" } }
        ],
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.9",
          "reviewCount": "127",
          "bestRating": "5"
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is Begyn.ai?",
            "acceptedAnswer": { "@type": "Answer", "text": "Begyn.ai is an AI-powered business intelligence platform that gives entrepreneurs and small businesses the same data tools large enterprises use — including AI voice agents, automated lead scoring, real-time analytics, workflow automation, and revenue forecasting." }
          },
          {
            "@type": "Question",
            "name": "How much does Begyn.ai cost?",
            "acceptedAnswer": { "@type": "Answer", "text": "Every Begyn.ai plan starts with a 7-day free trial with full platform access — no credit card required. Paid plans are $199/month (Growth) for the full platform, $499/month (Scale) for unlimited everything, and custom Enterprise pricing. All plans are all-inclusive with no per-minute voice fees or AI add-on charges." }
          },
          {
            "@type": "Question",
            "name": "Does Begyn.ai offer a free trial?",
            "acceptedAnswer": { "@type": "Answer", "text": "Yes. Begyn.ai offers a 7-day free trial with full Scale-tier access to every feature — AI voice agents, business intelligence, automations, and forecasting. No credit card is required to start, you can cancel anytime, and your data and reports export free even if you don't continue." }
          },
          {
            "@type": "Question",
            "name": "What types of businesses can use Begyn.ai?",
            "acceptedAnswer": { "@type": "Answer", "text": "Begyn.ai works for any business — retail, restaurants, agencies, SaaS companies, real estate, service businesses, consultancies, e-commerce, and more. Any entrepreneur who wants to make data-driven decisions can use Begyn.ai." }
          },
          {
            "@type": "Question",
            "name": "How do AI voice agents from Begyn work?",
            "acceptedAnswer": { "@type": "Answer", "text": "Begyn Voice agents answer your business phone 24/7, hold natural conversations, qualify leads by asking your pre-set questions, book appointments directly to your calendar, and send full transcripts to your team. They handle unlimited simultaneous calls with no busy signal." }
          },
          {
            "@type": "Question",
            "name": "Do I need technical skills to use Begyn.ai?",
            "acceptedAnswer": { "@type": "Answer", "text": "No. Begyn.ai is designed for entrepreneurs, not engineers. Connect your existing tools in minutes, ask questions in plain English, and get insights without writing any code or SQL." }
          },
          {
            "@type": "Question",
            "name": "What tools does Begyn.ai integrate with?",
            "acceptedAnswer": { "@type": "Answer", "text": "Begyn.ai connects with Shopify, Stripe, Google Analytics, QuickBooks, HubSpot, Salesforce, and 100+ other tools. Most integrations are one-click with no technical setup required." }
          }
        ]
      },
      {
        "@type": "HowTo",
        "name": "How to Get Started with Begyn.ai Business Intelligence",
        "description": "Set up AI-powered business intelligence for your company in three steps",
        "step": [
          {
            "@type": "HowToStep",
            "position": 1,
            "name": "Connect Your Data Sources",
            "text": "Link your existing tools in minutes — Shopify, Stripe, Google Analytics, CRM, QuickBooks, and 100+ more. Zero technical setup required."
          },
          {
            "@type": "HowToStep",
            "position": 2,
            "name": "AI Analyzes Everything Automatically",
            "text": "Begyn ingests, cleans, and analyzes all your data automatically. Patterns emerge, anomalies surface, and opportunities are identified and ranked by revenue impact."
          },
          {
            "@type": "HowToStep",
            "position": 3,
            "name": "Act on Real Intelligence",
            "text": "Receive daily AI briefings, automated actions, and precise recommendations. Your business runs smarter without more hours, staff, or guesswork."
          }
        ]
      }
    ]
  }
  </script>

  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet"/>
  <style>
    :root{--volt:#c8f231;--volt-soft:rgba(200,242,49,.14);--volt-line:rgba(200,242,49,.22);--ink:#05080c;--card:rgba(255,255,255,.035);--line:rgba(255,255,255,.08)}
    body{background:var(--ink);color:#eef1e9;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;overflow-x:hidden}
    h1,h2,h3,.disp{font-family:'Space Grotesk',Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:-.02em}
    /* Accent text + buttons */
    .tv{color:var(--volt)}
    .gt-primary{color:var(--volt);-webkit-text-fill-color:var(--volt)}
    .gb-primary{background:var(--volt);color:#0a0f05!important}
    .btn-volt{background:var(--volt);color:#0a0f05;transition:transform .18s,box-shadow .18s}
    .btn-volt:hover{transform:translateY(-2px);box-shadow:0 8px 40px rgba(200,242,49,.35)}
    .btn-ghost{border:1.5px solid var(--line);color:#eef1e9;transition:border-color .2s,background .2s}
    .btn-ghost:hover{border-color:var(--volt-line);background:var(--volt-soft)}
    /* Hero aurora */
    @keyframes mesh{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
    .hero-mesh{background:linear-gradient(-45deg,#05080c,#0a1408,#05080c,#081006,#05080c);background-size:400% 400%;animation:mesh 20s ease infinite}
    .orb{position:absolute;border-radius:50%;filter:blur(100px);pointer-events:none;opacity:.35}
    @keyframes ob{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-26px) scale(1.05)}}
    .ob-a{animation:ob 14s ease-in-out infinite}
    .ob-b{animation:ob 17s ease-in-out infinite reverse}
    .ob-c{animation:ob 12s ease-in-out infinite 4s}
    /* Signature pulse line (EKG) */
    .ekg path{stroke-dasharray:900;stroke-dashoffset:900;animation:ekgd 5.5s linear infinite}
    @keyframes ekgd{0%{stroke-dashoffset:900}55%{stroke-dashoffset:0}100%{stroke-dashoffset:-900}}
    /* Cards */
    .glass{background:var(--card);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--line);border-radius:1.25rem}
    .glass-sm{background:rgba(255,255,255,.03);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.06);border-radius:.875rem}
    .gh{transition:border-color .3s,box-shadow .3s,transform .25s}
    .gh:hover{border-color:var(--volt-line)!important;box-shadow:0 0 44px rgba(200,242,49,.1);transform:translateY(-3px)}
    /* Scroll reveal */
    .rv{opacity:0;transform:translateY(32px);transition:opacity .65s ease,transform .65s ease}
    .rv.in{opacity:1;transform:none}
    .d1{transition-delay:.1s}.d2{transition-delay:.2s}.d3{transition-delay:.3s}.d4{transition-delay:.4s}
    /* Marquee */
    .mq{overflow:hidden;position:relative;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
    .mq-track{display:flex;gap:.75rem;width:max-content;animation:mqs 36s linear infinite}
    .mq:hover .mq-track{animation-play-state:paused}
    @keyframes mqs{from{transform:translateX(0)}to{transform:translateX(-50%)}}
    /* Funnel tabs */
    .ftab{border:1px solid var(--line);color:#9aa596;transition:all .25s;cursor:pointer;white-space:nowrap}
    .ftab.on{background:var(--volt);color:#0a0f05;border-color:var(--volt);font-weight:800}
    .fpanel{display:none}
    .fpanel.on{display:grid;animation:fin .45s ease}
    @keyframes fin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    /* Bar chart */
    .bar{border-radius:3px 3px 0 0;background:linear-gradient(to top,#5c7a10,var(--volt));transition:height .6s ease}
    @keyframes pdot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
    .pdot{animation:pdot 2s ease-in-out infinite}
    /* Voice wave bars */
    .vw{display:flex;align-items:center;gap:2.5px;height:16px}
    .vw span{width:3px;border-radius:2px;background:var(--volt);animation:vwb 1s ease-in-out infinite}
    .vw span:nth-child(2){animation-delay:.15s}.vw span:nth-child(3){animation-delay:.3s}.vw span:nth-child(4){animation-delay:.45s}.vw span:nth-child(5){animation-delay:.6s}
    @keyframes vwb{0%,100%{height:4px}50%{height:15px}}
    /* FAQ */
    .faq-body{max-height:0;overflow:hidden;transition:max-height .38s ease}
    .faq-body.open{max-height:420px}
    .faq-ico{transition:transform .3s}
    .faq-item.open .faq-ico{transform:rotate(45deg)}
    /* Typing cursor */
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    .cur{display:inline-block;width:3px;height:1em;background:var(--volt);vertical-align:text-bottom;border-radius:1px;animation:blink 1s step-end infinite;margin-left:2px}
    /* Mobile nav */
    #mnav{display:none}
    #mnav.open{display:block}
    #float-cta{display:none}
    ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:var(--ink)}::-webkit-scrollbar-thumb{background:#2c3529;border-radius:9px}
    .pill{display:inline-flex;align-items:center;gap:.375rem;padding:.28rem .85rem;border-radius:99px;font-size:.72rem;font-weight:700;letter-spacing:.04em}
    .cl2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .cl3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    @media (prefers-reduced-motion:reduce){.ekg path,.mq-track,.orb,.hero-mesh,.vw span{animation:none!important}}
  </style>
</head>
<body class="min-h-screen">

<!-- ═══ NAV ═══ -->
<nav class="sticky top-0 z-50 border-b border-white/5" style="background:rgba(5,8,12,.9);backdrop-filter:blur(20px)">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <a href="/" class="flex items-center gap-2.5 flex-shrink-0">
        <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style="background:var(--volt);box-shadow:0 0 24px rgba(200,242,49,.35)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0f05" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <span class="font-black text-lg text-white disp">Begyn<span class="tv">.ai</span></span>
        <span class="pill hidden sm:inline-flex" style="background:var(--volt-soft);border:1px solid var(--volt-line);color:var(--volt)">Revenue OS</span>
      </a>
      <div class="hidden md:flex items-center gap-8">
        <a href="#platform" class="text-sm text-gray-400 hover:text-white transition-colors font-medium">Platform</a>
        <a href="#why" class="text-sm text-gray-400 hover:text-white transition-colors font-medium">Why Begyn</a>
        <a href="#pricing" class="text-sm text-gray-400 hover:text-white transition-colors font-medium">Pricing</a>
        <a href="/blog" class="text-sm text-gray-400 hover:text-white transition-colors font-medium">Blog</a>
      </div>
      <div class="hidden md:flex items-center gap-3">
        <a href="#cta" class="text-sm text-gray-400 hover:text-white transition-colors font-medium px-4 py-2">Sign In</a>
        <a href="#cta" class="btn-volt text-sm font-bold px-5 py-2.5 rounded-xl">Start Free Trial →</a>
      </div>
      <button onclick="document.getElementById('mnav').classList.toggle('open')" aria-label="Toggle navigation menu" aria-controls="mnav" class="md:hidden text-gray-400 hover:text-white p-2 rounded-lg">
        <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
    </div>
  </div>
  <div id="mnav" class="md:hidden border-t border-white/5 px-4 py-4 space-y-1" style="background:rgba(5,8,12,.97)">
    <a href="#platform" class="block text-gray-300 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/5 text-sm font-medium">Platform</a>
    <a href="#why" class="block text-gray-300 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/5 text-sm font-medium">Why Begyn</a>
    <a href="#pricing" class="block text-gray-300 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/5 text-sm font-medium">Pricing</a>
    <a href="/blog" class="block text-gray-300 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/5 text-sm font-medium">Blog</a>
    <a href="#cta" class="block btn-volt text-sm font-bold px-5 py-3 rounded-xl text-center mt-3">Start 7-Day Free Trial →</a>
  </div>
</nav>

<!-- ═══ HERO ═══ -->
<section class="hero-mesh relative overflow-hidden min-h-screen flex items-center">
  <div class="orb ob-a w-96 h-96 sm:w-[600px] sm:h-[600px] top-[-150px] left-[-150px]" style="background:radial-gradient(circle,#3c5a10,transparent 70%)"></div>
  <div class="orb ob-b w-72 h-72 sm:w-96 sm:h-96 top-[-80px] right-[-80px]" style="background:radial-gradient(circle,#c8f231,transparent 70%);opacity:.16"></div>
  <div class="orb ob-c w-80 h-80 bottom-[-100px] left-1/2 -translate-x-1/2" style="background:radial-gradient(circle,#1e3a24,transparent 70%)"></div>
  <div class="absolute inset-0 opacity-[0.03]" style="background-image:linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px);background-size:52px 52px"></div>
  <!-- Signature pulse line -->
  <svg class="ekg absolute bottom-10 left-0 w-full h-14 opacity-40" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0,30 H260 L285,30 296,6 314,54 330,30 H640 L665,30 676,10 694,50 710,30 H1030 L1055,30 1066,8 1084,52 1100,30 H1200" fill="none" stroke="var(--volt)" stroke-width="2"/>
  </svg>

  <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 w-full">
    <div class="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

      <!-- Left: Copy -->
      <div>
        <div class="inline-flex items-center gap-2.5 mb-7 pill" style="background:var(--volt-soft);border:1px solid var(--volt-line);color:var(--volt)">
          <span class="vw" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></span>
          The AI Revenue Operating System for Small Business
        </div>
        <h1 class="font-black leading-none tracking-tight mb-6" style="font-size:clamp(2.7rem,7vw,4.9rem)">
          <span class="text-white">Answers every call.</span><br/>
          <span class="tv">Predicts every dollar.<span class="cur"></span></span>
        </h1>
        <p class="text-gray-400 leading-relaxed mb-9 max-w-xl" style="font-size:1.15rem">
          Begyn.ai is your 24/7 AI Employee — it answers your phones, follows up with every lead, and tells you exactly where next month's revenue is coming from. Live in 30 minutes.
        </p>
        <div class="flex flex-wrap gap-4 mb-7">
          <a href="#pricing" class="btn-volt inline-flex items-center gap-2 font-bold px-8 py-4 rounded-2xl" style="font-size:1rem">
            Start 7-Day Free Trial
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
          <button onclick="try{if(document.getElementById('bw-panel').classList.contains('bw-hidden'))bwToggle()}catch(e){}" class="btn-ghost inline-flex items-center gap-2.5 font-bold px-8 py-4 rounded-2xl" style="font-size:1rem">
            <span class="vw" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></span>
            Talk to Our AI — Live
          </button>
        </div>
        <div class="flex flex-wrap gap-5 text-sm text-gray-500 mb-5">
          <span class="flex items-center gap-1.5"><span class="tv">✓</span>No credit card</span>
          <span class="flex items-center gap-1.5"><span class="tv">✓</span>Full platform access</span>
          <span class="flex items-center gap-1.5"><span class="tv">✓</span>Live in 30 minutes</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span style="color:#fbbf24;letter-spacing:2px">★★★★★</span>
          <span class="text-gray-400 font-semibold">4.9</span>
          <span class="text-gray-600">from 127 businesses</span>
        </div>
      </div>

      <!-- Right: Live product mock -->
      <div class="hidden lg:block relative">
        <div class="absolute inset-0 opacity-15 blur-3xl rounded-3xl" style="background:var(--volt)"></div>
        <div class="glass relative rounded-3xl p-5 shadow-2xl" style="box-shadow:0 30px 80px rgba(0,0,0,.5)">
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider">Begyn Intelligence</p>
              <p class="text-white font-bold text-sm">Revenue Command Center</p>
            </div>
            <div class="flex items-center gap-1.5 glass-sm px-3 py-1.5 rounded-full">
              <div class="w-2 h-2 rounded-full pdot" style="background:var(--volt)"></div>
              <span class="text-xs font-bold tv">LIVE</span>
            </div>
          </div>
          <!-- Incoming call card -->
          <div class="glass-sm p-3 rounded-xl mb-3 flex items-center gap-3" style="border-color:var(--volt-line)">
            <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style="background:var(--volt-soft)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--volt)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-xs font-bold text-white">Begyn Voice answering…</p>
                <span class="vw" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></span>
              </div>
              <p class="text-xs text-gray-500 truncate">Lead qualified → appointment booked for 2:30 PM</p>
            </div>
          </div>
          <!-- 4 stat cards -->
          <div class="grid grid-cols-4 gap-2 mb-4">
            ${[
              {label:'Revenue',val:'+23%'},
              {label:'Leads',val:'142'},
              {label:'Calls',val:'100%'},
              {label:'ROI',val:'4.2×'},
            ].map(({label,val}) => `
            <div class="glass-sm p-2.5 text-center">
              <p class="text-xs text-gray-500 mb-1">${label}</p>
              <p class="font-black text-sm tv">${val}</p>
            </div>`).join('')}
          </div>
          <!-- Bar chart -->
          <div class="glass-sm p-3 rounded-xl mb-3">
            <p class="text-xs text-gray-500 font-semibold mb-3">Revenue vs Forecast — Last 8 Weeks</p>
            <div class="flex items-end gap-1.5 h-16">
              ${[40,65,80,55,90,70,85,60].map((h,i) => `
              <div class="flex-1 h-full flex flex-col justify-end gap-0.5">
                <div class="bar w-full" style="height:${h}%;opacity:${0.6+i*0.05}"></div>
              </div>`).join('')}
            </div>
          </div>
          <!-- AI insights -->
          <div class="space-y-1.5">
            ${[
              'Forecast: $127K next 30 days (94% confidence)',
              '3 high-value leads identified · follow up today',
              'Thursday slowdown predicted · promo drafted',
            ].map((text) => `
            <div class="flex items-center gap-2.5 glass-sm px-3 py-2 rounded-lg">
              <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:var(--volt)"></div>
              <p class="text-xs text-gray-300">${text}</p>
            </div>`).join('')}
          </div>
        </div>
        <!-- Float badges -->
        <div class="absolute -top-4 -right-4 glass-sm px-3 py-2 rounded-2xl flex items-center gap-2 shadow-lg" style="border-color:var(--volt-line)">
          <span class="font-black text-sm tv">↑ 34%</span>
          <span class="text-gray-400 text-xs">MoM Growth</span>
        </div>
        <div class="absolute -bottom-4 -left-4 glass-sm px-3 py-2 rounded-2xl flex items-center gap-2 shadow-lg">
          <span class="font-black text-sm tv">94%</span>
          <span class="text-gray-400 text-xs">Forecast accuracy</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══ SCALE PROOF COUNTERS ═══ -->
<section class="py-14 border-y" style="background:rgba(200,242,49,.03);border-color:var(--line)">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <p class="text-center text-xs font-bold text-gray-600 uppercase tracking-widest mb-8">We're in the business of growing your business</p>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
      ${[
        {target:'3200',suffix:'+',label:'Businesses Powered',sub:'across 10+ industries'},
        {target:'127',prefix:'$',suffix:'M+',label:'Revenue Attributed',sub:'by Begyn customers'},
        {target:'94',suffix:'%',label:'Forecast Accuracy',sub:'across all AI models'},
        {target:'30',suffix:' min',label:'To First Insight',sub:'avg from signup to aha'},
      ].map(({target,prefix,suffix,label,sub},i) => `
      <div class="rv d${i+1}">
        <div class="text-4xl sm:text-5xl font-black tv mb-1 disp" data-counter="${target}" data-prefix="${prefix||''}" data-suffix="${suffix||''}">${prefix||''}0${suffix||''}</div>
        <div class="text-white font-bold text-sm">${label}</div>
        <div class="text-gray-500 text-xs mt-0.5">${sub}</div>
      </div>`).join('')}
    </div>
  </div>
</section>

<!-- ═══ INDUSTRY MARQUEE ═══ -->
<section class="py-9 border-b border-white/5">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-5">
    <p class="text-center text-xs font-bold text-gray-600 uppercase tracking-widest">Trusted by owners in every industry</p>
  </div>
  <div class="mq">
    <div class="mq-track">
      ${['Legal & Law Firms','Healthcare','Real Estate','Restaurants & Hospitality','E-Commerce','SaaS & Tech','Financial Services','Retail','Marketing Agencies','Manufacturing','Home Services & HVAC','Education','Consulting','Auto & Dealerships','Legal & Law Firms','Healthcare','Real Estate','Restaurants & Hospitality','E-Commerce','SaaS & Tech','Financial Services','Retail','Marketing Agencies','Manufacturing','Home Services & HVAC','Education','Consulting','Auto & Dealerships'].map(name =>
        `<span class="text-gray-500 text-sm font-semibold px-5 py-2.5 rounded-full flex-shrink-0" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07)">${name}</span>`
      ).join('')}
    </div>
  </div>
</section>

<!-- ═══ FUNNEL TABS (Platform) ═══ -->
<section id="platform" class="py-24 relative overflow-hidden">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-12 rv">
      <p class="tv text-sm font-bold uppercase tracking-widest mb-3">The Platform</p>
      <h2 class="text-4xl sm:text-5xl font-black text-white mb-4">One AI Employee.<br/>Five Jobs. Zero Busywork.</h2>
      <p class="text-gray-400 text-xl max-w-2xl mx-auto">Everything you need to capture, convert, and keep customers — plus the one thing nobody else gives you: knowing what happens next.</p>
    </div>
    <div class="flex flex-wrap justify-center gap-2.5 mb-10 rv" role="tablist" aria-label="Platform capabilities">
      ${['Capture','Convert','Operate','Predict','Grow'].map((t,i) => `
      <button role="tab" aria-selected="${i===0}" id="ftab-${i}" onclick="fnTab(${i})" class="ftab${i===0?' on':''} px-6 py-3 rounded-full text-sm font-bold">${t}${t==='Predict'?' ◆':''}</button>`).join('')}
    </div>
    ${[
      {
        head:'Never miss another lead',
        body:'Every call answered in one ring, every website visitor greeted, every missed opportunity texted back — 24/7, weekends and holidays included.',
        feats:['AI Voice Agents answer calls 24/7 — no busy signal, unlimited simultaneous calls','Missed-call text-back wins the lead before they dial a competitor','AI website chat greets, answers, and books while you sleep','Smart forms & booking pages that fill your calendar','Every call transcribed, summarized, and logged automatically','One inbox for calls, chats, and messages'],
        mock:[['📞','Inbound call — answered in 0.8s','var(--volt)'],['💬','Website chat: pricing question → answered','#9ca3af'],['📅','Appointment booked · Tue 2:30 PM','var(--volt)'],['✉️','Missed-call text sent · lead recovered','#9ca3af']]
      },
      {
        head:'Turn conversations into customers',
        body:'Begyn scores every lead, follows up automatically, and keeps your pipeline moving — so the hottest opportunities never go cold.',
        feats:['AI lead scoring ranks every prospect by revenue potential','Automated follow-up sequences via text and email','Self-booking calendars synced to your team','Visual sales pipeline updated by AI, not data entry','Instant quotes and payment links in chat or text','Reminders that cut no-shows by double digits'],
        mock:[['🔥','Sarah M. — lead score 94 · ready to buy','var(--volt)'],['📤','Follow-up #2 sent · opened twice','#9ca3af'],['💳','Quote accepted — $2,400 paid','var(--volt)'],['📊','Pipeline: 12 deals · $38K in motion','#9ca3af']]
      },
      {
        head:'Run your week on autopilot',
        body:'The repetitive work that eats your evenings — reports, review requests, task routing, data entry — happens by itself.',
        feats:['Workflow automations connect 100+ tools you already use','Daily AI briefing: what happened, what matters, what to do','Reports written by AI and delivered to your inbox','Automatic review requests after every happy visit','Tasks routed to the right person at the right time','Zero code, zero SQL, zero consultants'],
        mock:[['🌅','Daily briefing delivered · 7:00 AM','var(--volt)'],['⭐','Review request sent to 8 customers','#9ca3af'],['🔁','Invoice → QuickBooks · synced','#9ca3af'],['✅','Weekly report generated & emailed','var(--volt)']]
      },
      {
        head:'Know what happens next',
        body:'This is what no answering service, marketing platform, or agency tool can do: Begyn reads your revenue like a pulse and tells you what is coming — before it happens.',
        feats:['Revenue forecasting at 94% accuracy — see next month today','Churn-risk alerts flag customers about to leave','Slow-day predictions so you can promote before the dip','Anomaly detection catches problems while they are small','Cash-flow outlook across every location','Ask your data anything — in plain English'],
        mock:[['📈','Forecast: $127K next 30 days · 94% conf.','var(--volt)'],['⚠️','2 accounts at churn risk · save plan ready','#f59e0b'],['📉','Thursday dip predicted · promo drafted','#9ca3af'],['💡','Anomaly: ad spend up, leads flat → fix','var(--volt)']],
        badge:'ONLY ON BEGYN'
      },
      {
        head:'Compound every win',
        body:'Growth is not an accident — it is a loop. Begyn turns happy customers into reviews, referrals, and repeat revenue, then measures exactly what worked.',
        feats:['Reputation engine grows your Google reviews on autopilot','Reactivation campaigns wake up past customers','Referral tracking that rewards your best fans','Industry benchmarks show where you stand','Weekly growth playbook ranked by revenue impact','ROI tracking on every campaign, call, and dollar'],
        mock:[['⭐','New 5-star review · Google','var(--volt)'],['📣','Reactivation: 214 past customers reached','#9ca3af'],['🎯','Playbook: 3 moves worth $9.2K this week','var(--volt)'],['🏆','You are top 12% in your industry','#9ca3af']]
      },
    ].map(({head,body,feats,mock,badge},i) => `
    <div id="fpanel-${i}" role="tabpanel" aria-labelledby="ftab-${i}" class="fpanel${i===0?' on':''} lg:grid-cols-2 gap-10 items-center">
      <div>
        ${badge ? `<span class="pill mb-4" style="background:var(--volt);color:#0a0f05">◆ ${badge}</span>` : ''}
        <h3 class="text-3xl sm:text-4xl font-black text-white mb-4">${head}</h3>
        <p class="text-gray-400 text-lg leading-relaxed mb-7">${body}</p>
        <ul class="space-y-3 text-sm text-gray-300 mb-8">
          ${feats.map(f => `<li class="flex gap-3"><span class="tv mt-0.5 flex-shrink-0 font-bold">✓</span>${f}</li>`).join('')}
        </ul>
        <a href="#pricing" class="btn-volt inline-flex items-center gap-2 font-bold px-6 py-3.5 rounded-xl text-sm">Start 7-Day Free Trial <span>→</span></a>
      </div>
      <div class="glass p-6 rounded-3xl">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider">Live Activity</p>
          <div class="flex items-center gap-1.5"><div class="w-2 h-2 rounded-full pdot" style="background:var(--volt)"></div><span class="text-xs font-bold tv">LIVE</span></div>
        </div>
        <div class="space-y-2.5">
          ${mock.map(([ico,txt,col]) => `
          <div class="flex items-center gap-3 glass-sm px-4 py-3.5 rounded-xl">
            <span class="text-lg flex-shrink-0">${ico}</span>
            <p class="text-sm text-gray-300 flex-1">${txt}</p>
            <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${col}"></div>
          </div>`).join('')}
        </div>
      </div>
    </div>`).join('')}
  </div>
</section>

<!-- ═══ WHY SWITCH ═══ -->
<section id="why" class="py-24" style="background:rgba(255,255,255,.015)">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-14 rv">
      <p class="tv text-sm font-bold uppercase tracking-widest mb-3">Why Begyn</p>
      <h2 class="text-4xl sm:text-5xl font-black text-white mb-4">Other Platforms Do the Work.<br/>Begyn Also Does the Thinking.</h2>
      <p class="text-gray-400 text-xl max-w-2xl mx-auto">We studied every tool in this industry. Here's what business owners told us they couldn't find anywhere else.</p>
    </div>
    <div class="grid sm:grid-cols-2 gap-6">
      ${[
        {icon:'🧠',title:'Decision AI, not just busywork AI',desc:'Answering calls and sending texts is table stakes — plenty of tools do it. Only Begyn adds the intelligence layer: revenue forecasting, churn alerts, and a daily answer to "what should I do next?"'},
        {icon:'💸',title:'All-inclusive pricing. Actually.',desc:'No per-minute voice fees. No AI add-on table. No $500/mo "premium support" upsell. The price on the pricing page is the price on your invoice — usage included.'},
        {icon:'🧑‍🔧',title:'Built for owners, not agencies',desc:'No sub-accounts, snapshots, or reseller jargon to translate. Begyn speaks plain English to the person who actually runs the business — you.'},
        {icon:'🔓',title:'Try everything before paying anything',desc:'Most competitors gate their product behind a sales demo or a credit-card trial that auto-bills. Begyn gives you 7 days of full access — no card, no auto-charge, and your data exports free either way.'},
      ].map(({icon,title,desc},i) => `
      <div class="rv d${(i%2)+1} glass gh p-8">
        <div class="text-3xl mb-4">${icon}</div>
        <h3 class="text-xl font-black text-white mb-3">${title}</h3>
        <p class="text-gray-400 leading-relaxed text-sm">${desc}</p>
      </div>`).join('')}
    </div>
  </div>
</section>

<!-- ═══ HOW IT WORKS ═══ -->
<section class="py-24 relative overflow-hidden">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-16 rv">
      <p class="tv text-sm font-bold uppercase tracking-widest mb-3">How It Works</p>
      <h2 class="text-4xl sm:text-5xl font-black text-white mb-4">Zero to Intelligence<br/>in 30 Minutes</h2>
      <p class="text-gray-400 text-xl max-w-2xl mx-auto">Three steps from signup to your first AI-powered business insight.</p>
    </div>
    <div class="grid md:grid-cols-3 gap-6 relative">
      <div class="hidden md:block absolute top-16 left-1/3 right-1/3 h-px" style="background:linear-gradient(90deg,transparent,var(--volt),transparent)"></div>
      ${[
        {num:'01',icon:'⚡',title:'Connect Your Data',desc:'Link your existing tools in minutes — Shopify, Stripe, Google Analytics, CRM, QuickBooks, and 100+ more. Zero technical setup required.'},
        {num:'02',icon:'🧠',title:'AI Analyzes Everything',desc:'Begyn ingests, cleans, and analyzes all your data automatically. Patterns emerge. Anomalies surface. Opportunities are identified and ranked by impact.'},
        {num:'03',icon:'🚀',title:'Act on Real Intelligence',desc:'Receive daily AI briefings, automated actions, and precise recommendations. Your business runs smarter — without more hours, staff, or guesswork.'},
      ].map(({num,icon,title,desc},i) => `
      <div class="rv d${i+1} glass gh p-8 text-center relative z-10">
        <div class="text-5xl font-black tv opacity-25 mb-2 disp">${num}</div>
        <div class="text-4xl mb-4">${icon}</div>
        <h3 class="text-xl font-black text-white mb-3">${title}</h3>
        <p class="text-gray-400 leading-relaxed">${desc}</p>
      </div>`).join('')}
    </div>
  </div>
</section>

<!-- ═══ TESTIMONIALS (metric-first) ═══ -->
<section class="py-24" style="background:rgba(255,255,255,.015)">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-14 rv">
      <p class="tv text-sm font-bold uppercase tracking-widest mb-3">Results</p>
      <h2 class="text-4xl sm:text-5xl font-black text-white mb-4">The Numbers Speak.<br/>Then the Owners Do.</h2>
    </div>
    <div class="grid md:grid-cols-3 gap-6">
      ${[
        {metric:'18% → 41%',mlabel:'close rate in 90 days',name:'Dominique R.',role:'Founder, DRK Consulting',init:'DR',quote:'We went from spending 3 days a month on reports to 3 hours. Begyn\'s AI catches things my team never would have.'},
        {metric:'$180K',mlabel:'ARR saved in one quarter',name:'Priya K.',role:'CEO, NovaSphere SaaS',init:'PK',quote:'Churn was killing us silently. Begyn Predict flagged 23 at-risk accounts before they churned. This platform pays for itself every month.'},
        {metric:'4 locations',mlabel:'run on intelligence, not gut',name:'Marcus T.',role:'Owner, Taíno Restaurant Group',init:'MT',quote:'Begyn predicted a Thursday slowdown 2 weeks out — I ran a promotion and had our best Thursday ever.'},
      ].map(({metric,mlabel,name,role,init,quote},i) => `
      <div class="rv d${i+1} glass gh p-7 flex flex-col">
        <div class="text-4xl font-black tv disp mb-1">${metric}</div>
        <p class="text-xs text-gray-500 font-bold uppercase tracking-wide mb-5">${mlabel}</p>
        <p class="text-gray-300 leading-relaxed mb-6 flex-1">"${quote}"</p>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style="background:var(--volt);color:#0a0f05">${init}</div>
            <div>
              <p class="font-bold text-white text-sm">${name}</p>
              <p class="text-xs text-gray-500">${role}</p>
            </div>
          </div>
          <div style="color:#fbbf24;font-size:.8rem;letter-spacing:1px">★★★★★</div>
        </div>
      </div>`).join('')}
    </div>
  </div>
</section>

<!-- ═══ PRICING ═══ -->
<section id="pricing" class="py-24 relative overflow-hidden">
  <div class="orb ob-c w-96 h-96 opacity-10 bottom-0 right-0" style="background:radial-gradient(circle,var(--volt),transparent 70%)"></div>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
    <div class="text-center mb-8 rv">
      <p class="tv text-sm font-bold uppercase tracking-widest mb-3">Pricing</p>
      <h2 class="text-4xl sm:text-5xl font-black text-white mb-4">Try Everything Free for 7 Days</h2>
      <p class="text-gray-400 text-xl max-w-2xl mx-auto">Full platform access, then pick the plan that fits. No credit card to start, no surprises later.</p>
    </div>
    <div class="rv glass-sm max-w-2xl mx-auto text-center px-6 py-3.5 rounded-full mb-12" style="border-color:var(--volt-line)">
      <p class="text-sm text-gray-300"><span class="tv font-bold">All-inclusive:</span> voice minutes, AI, automations & forecasting included — no per-minute fees, no add-on table, no surprise bills.</p>
    </div>
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <!-- 7-Day Trial -->
      <div class="rv relative rounded-2xl p-px" style="background:linear-gradient(160deg,var(--volt),transparent 60%)">
        <div class="rounded-2xl p-6 h-full" style="background:#0a0e08">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-bold tv uppercase tracking-wide">Free Trial</p>
            <span class="pill" style="background:var(--volt-soft);border:1px solid var(--volt-line);color:var(--volt);font-size:.65rem">START HERE</span>
          </div>
          <p class="text-4xl font-black text-white mb-0.5 disp">$0<span class="text-xl font-normal text-gray-500"> · 7 days</span></p>
          <p class="text-gray-500 text-xs mb-5">Full Scale-tier access. Everything unlocked.</p>
          <ul class="space-y-2.5 text-sm text-gray-300 mb-6">
            ${['Every feature, no limits','Unlimited AI voice agents','Full BI + forecasting suite','No credit card required','Concierge onboarding call','Keep your data & reports'].map(f => `<li class="flex gap-2"><span class="tv mt-0.5 flex-shrink-0">✓</span>${f}</li>`).join('')}
          </ul>
          <a href="#cta" class="block text-center btn-volt font-bold py-3 rounded-xl text-sm">Start Free Trial →</a>
        </div>
      </div>
      <!-- Growth — Most Popular -->
      <div class="rv d1 relative rounded-2xl p-px" style="background:var(--volt);box-shadow:0 0 50px rgba(200,242,49,.18)">
        <div class="rounded-2xl p-6 h-full" style="background:#0a0e08">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-bold text-white uppercase tracking-wide">Growth</p>
            <span class="pill" style="background:var(--volt);color:#0a0f05;font-size:.65rem">MOST POPULAR</span>
          </div>
          <p class="text-4xl font-black text-white mb-0.5 disp">$199<span class="text-xl font-normal text-gray-500">/mo</span></p>
          <p class="text-gray-500 text-xs mb-5">For growing businesses</p>
          <ul class="space-y-2.5 text-sm text-gray-300 mb-6">
            ${['5 users','15 AI agents','Full BI suite','Unlimited records','All integrations','Priority support','Custom voice personas'].map(f => `<li class="flex gap-2"><span class="tv mt-0.5 flex-shrink-0">✓</span>${f}</li>`).join('')}
          </ul>
          <a href="#cta" class="block text-center btn-volt font-bold py-3 rounded-xl text-sm">Start 7-Day Free Trial</a>
        </div>
      </div>
      <!-- Scale -->
      <div class="rv d2 glass gh p-6">
        <p class="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2">Scale</p>
        <p class="text-4xl font-black text-white mb-0.5 disp">$499<span class="text-xl font-normal text-gray-500">/mo</span></p>
        <p class="text-gray-500 text-xs mb-5">For scaling companies</p>
        <ul class="space-y-2.5 text-sm text-gray-400 mb-6">
          ${['25 users','Unlimited AI agents','Predictive analytics','Custom reports','API access','Dedicated onboarding','Advanced forecasting'].map(f => `<li class="flex gap-2"><span class="tv mt-0.5 flex-shrink-0">✓</span>${f}</li>`).join('')}
        </ul>
        <a href="#cta" class="block text-center font-bold py-3 rounded-xl transition-colors text-sm btn-ghost">Start 7-Day Free Trial</a>
      </div>
      <!-- Enterprise -->
      <div class="rv d3 glass gh p-6">
        <p class="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2">Enterprise</p>
        <p class="text-4xl font-black text-white mb-0.5 disp">Custom</p>
        <p class="text-gray-500 text-xs mb-5">For large organizations</p>
        <ul class="space-y-2.5 text-sm text-gray-400 mb-6">
          ${['Unlimited users','White-label platform','Custom AI training','SLA guarantee','Dedicated account manager','On-prem deployment option'].map(f => `<li class="flex gap-2"><span class="tv mt-0.5 flex-shrink-0">✓</span>${f}</li>`).join('')}
        </ul>
        <a href="#cta" class="block text-center font-bold py-3 rounded-xl transition-colors text-sm btn-ghost">Contact Sales</a>
      </div>
    </div>
    <p class="text-center text-gray-600 text-sm mt-8">7-day full-access free trial · No credit card · Cancel anytime · Your data exports free, even if you walk away</p>
  </div>
</section>

<!-- ═══ BLOG PREVIEW ═══ -->
<section id="blog" class="py-24" style="background:rgba(255,255,255,.015)">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-end justify-between mb-12 rv">
      <div>
        <p class="tv text-sm font-bold uppercase tracking-widest mb-3">Blog</p>
        <h2 class="text-4xl font-black text-white">Intelligence from<br/>the Begyn Blog</h2>
        <p class="text-gray-400 mt-2">AI & business intelligence insights for entrepreneurs</p>
      </div>
      <a href="/blog" class="hidden sm:flex items-center gap-2 tv hover:opacity-80 font-semibold transition-opacity text-sm">
        View All Posts
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>
    </div>
    <div id="blog-grid" class="grid md:grid-cols-3 gap-6">
      ${[1,2,3].map(() => `
      <div class="glass p-6 animate-pulse">
        <div class="w-20 h-3 rounded mb-4" style="background:rgba(255,255,255,.07)"></div>
        <div class="h-5 rounded mb-2" style="background:rgba(255,255,255,.07)"></div>
        <div class="h-4 rounded mb-1" style="background:rgba(255,255,255,.04)"></div>
        <div class="h-4 w-3/4 rounded mb-5" style="background:rgba(255,255,255,.04)"></div>
        <div class="h-3 w-1/2 rounded" style="background:rgba(255,255,255,.06)"></div>
      </div>`).join('')}
    </div>
    <div class="sm:hidden text-center mt-8">
      <a href="/blog" class="tv font-semibold text-sm">View All Posts →</a>
    </div>
  </div>
</section>

<!-- ═══ FAQ ═══ -->
<section class="py-24">
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-14 rv">
      <p class="tv text-sm font-bold uppercase tracking-widest mb-3">FAQ</p>
      <h2 class="text-4xl sm:text-5xl font-black text-white mb-4">Common Questions</h2>
      <p class="text-gray-400 text-xl">Everything owners ask before starting the trial.</p>
    </div>
    <div class="space-y-3">
      ${[
        {q:'What happens after my 7-day free trial ends?',a:'You pick a plan — or you walk away. Because we never take a credit card up front, there is no auto-charge and nothing to cancel. If Begyn earned your business, choose Growth, Scale, or Enterprise and keep going without losing a single report. If not, your data and reports export free.'},
        {q:'Do I need a credit card to start the trial?',a:'No. The 7-day trial is full Scale-tier access — every AI agent, the entire BI suite, forecasting, automations — with no payment details required. We want you to judge the product by what it does for your business in week one, not by whether you remembered to cancel.'},
        {q:'Are there usage fees or add-on charges?',a:'No. Voice minutes, AI processing, automations, and forecasting are included in every plan. Many platforms in this space advertise a low sticker price and then bill AI as a per-account add-on, meter your calls per minute, and sell support at up to $500/month. Begyn is all-inclusive: the price on this page is the price on your invoice.'},
        {q:'How is Begyn different from GoHighLevel or Podium?',a:'Those are strong execution platforms — they answer messages, send campaigns, and manage reviews. Begyn does that work too, but adds the layer they don\'t have: decision intelligence. Revenue forecasting at 94% accuracy, churn-risk alerts, anomaly detection, and a daily answer to "what should I do next?" We\'re also all-inclusive on pricing and built for business owners directly — no agency jargon, no add-on tables, and a trial that doesn\'t require a credit card.'},
        {q:'How does Begyn AI learn my business?',a:'During a 30-minute onboarding, you connect your existing tools (CRM, accounting, analytics, etc.). Begyn AI ingests your historical data, identifies patterns specific to your business model, and calibrates its models to your industry and context. No manual training required.'},
        {q:'Is my business data secure?',a:'Your data is encrypted in transit (TLS 1.3) and at rest (AES-256). We are SOC 2 Type II certified. We never sell or share your data, and we never use your business data to train shared models. You own your data 100% — exportable at any time.'},
      ].map(({q,a},i) => `
      <div class="rv d${(i%3)+1} glass faq-item">
        <button onclick="toggleFaq(this)" class="w-full flex items-center justify-between gap-4 px-6 py-5 text-left">
          <span class="font-semibold text-white text-sm sm:text-base">${q}</span>
          <span class="faq-ico text-gray-400 text-xl flex-shrink-0 leading-none">+</span>
        </button>
        <div class="faq-body px-6">
          <p class="text-gray-400 leading-relaxed pb-5 text-sm">${a}</p>
        </div>
      </div>`).join('')}
    </div>
  </div>
</section>

<!-- ═══ CTA ═══ -->
<section id="cta" class="py-24 hero-mesh relative overflow-hidden">
  <div class="orb ob-a w-96 h-96 opacity-25 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style="background:radial-gradient(circle,#3c5a10,transparent 70%)"></div>
  <svg class="ekg absolute top-8 left-0 w-full h-12 opacity-25" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0,30 H260 L285,30 296,6 314,54 330,30 H640 L665,30 676,10 694,50 710,30 H1030 L1055,30 1066,8 1084,52 1100,30 H1200" fill="none" stroke="var(--volt)" stroke-width="2"/>
  </svg>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
    <div class="glass p-12 sm:p-16" style="border-color:var(--volt-line)">
      <h2 class="text-4xl sm:text-5xl font-black text-white mb-4">Your Revenue Has a Pulse.<br/><span class="tv">Start Reading It.</span></h2>
      <p class="text-gray-400 text-xl mb-10">7 days. Every feature. No credit card. Join 3,200+ businesses that run on Begyn.</p>
      <form onsubmit="handleDemo(event)" class="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
        <input id="demo-email" type="email" required placeholder="you@yourbusiness.com" aria-label="Business email"
          class="flex-1 px-5 py-4 rounded-xl outline-none text-white placeholder-gray-500 transition-colors text-sm"
          style="background:rgba(255,255,255,.05);border:1px solid var(--line)" onfocus="this.style.borderColor='var(--volt-line)'" onblur="this.style.borderColor='var(--line)'"/>
        <button type="submit" class="btn-volt font-bold px-8 py-4 rounded-xl whitespace-nowrap text-sm">Start My Free Trial →</button>
      </form>
      <div class="flex flex-wrap justify-center gap-5 mt-6 text-xs text-gray-600">
        <span>✓ Full access for 7 days</span><span>✓ No credit card</span><span>✓ Cancel anytime</span>
      </div>
    </div>
  </div>
</section>

<!-- ═══ FOOTER ═══ -->
<footer class="border-t py-16" style="background:var(--ink);border-color:rgba(255,255,255,.06)">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
      <!-- Brand -->
      <div class="col-span-2 md:col-span-1">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-7 h-7 rounded-xl flex items-center justify-center" style="background:var(--volt)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0f05" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <span class="font-black text-white disp">Begyn<span class="tv">.ai</span></span>
        </div>
        <p class="text-gray-600 text-xs leading-relaxed mb-4">The AI revenue operating system<br/>for small business.</p>
        <div class="flex gap-3">
          <a href="#" class="text-gray-600 hover:text-white transition-colors" aria-label="X / Twitter">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <a href="#" class="text-gray-600 hover:text-white transition-colors" aria-label="LinkedIn">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
        </div>
      </div>
      <!-- Platform -->
      <div>
        <p class="text-white font-bold text-sm mb-4">Platform</p>
        <div class="space-y-2.5">
          ${['Intelligence','Voice Agents','Lead AI','Automate','Reports','Predict'].map(l => `<a href="#platform" class="block text-gray-500 hover:text-white text-xs transition-colors">${l}</a>`).join('')}
        </div>
      </div>
      <!-- Solutions -->
      <div>
        <p class="text-white font-bold text-sm mb-4">Solutions</p>
        <div class="space-y-2.5">
          ${['By Industry','By Company Size','Integrations','API Docs','Case Studies'].map(l => `<a href="#why" class="block text-gray-500 hover:text-white text-xs transition-colors">${l}</a>`).join('')}
        </div>
      </div>
      <!-- Company -->
      <div>
        <p class="text-white font-bold text-sm mb-4">Company</p>
        <div class="space-y-2.5">
          ${['About','Blog','Careers','Press','Contact'].map(l => `<a href="/blog" class="block text-gray-500 hover:text-white text-xs transition-colors">${l}</a>`).join('')}
        </div>
      </div>
      <!-- Legal -->
      <div>
        <p class="text-white font-bold text-sm mb-4">Legal</p>
        <div class="space-y-2.5">
          ${['Privacy Policy','Terms of Service','Security','Cookie Policy'].map(l => `<a href="#" class="block text-gray-500 hover:text-white text-xs transition-colors">${l}</a>`).join('')}
        </div>
      </div>
    </div>
    <div class="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-3" style="border-color:rgba(255,255,255,.06)">
      <p class="text-gray-700 text-xs">© 2026 Begyn.ai. All rights reserved.</p>
      <p class="text-gray-700 text-xs">Answers every call. Predicts every dollar.</p>
    </div>
  </div>
</footer>

<!-- Floating mobile CTA -->
<div id="float-cta" class="fixed bottom-4 inset-x-4 z-50">
  <a href="#cta" class="block btn-volt text-center font-bold py-4 rounded-2xl shadow-2xl text-sm">Start 7-Day Free Trial →</a>
</div>

<script>
// Scroll reveal
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } })
}, { threshold: 0.1 })
document.querySelectorAll('.rv').forEach(el => obs.observe(el))

// Count-up counters
const cobs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return
    cobs.unobserve(e.target)
    const el = e.target
    const target = parseInt(el.dataset.counter, 10)
    const prefix = el.dataset.prefix || ''
    const suffix = el.dataset.suffix || ''
    const dur = 1400
    const t0 = performance.now()
    function tick(t) {
      const p = Math.min((t - t0) / dur, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      el.textContent = prefix + Math.round(target * eased).toLocaleString('en-US') + suffix
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}, { threshold: 0.4 })
document.querySelectorAll('[data-counter]').forEach(el => cobs.observe(el))

// Funnel tabs
function fnTab(idx) {
  document.querySelectorAll('.ftab').forEach((b, i) => {
    b.classList.toggle('on', i === idx)
    b.setAttribute('aria-selected', i === idx ? 'true' : 'false')
  })
  document.querySelectorAll('.fpanel').forEach((p, i) => p.classList.toggle('on', i === idx))
}

// Float CTA
const fcta = document.getElementById('float-cta')
window.addEventListener('scroll', () => { if (fcta) fcta.style.display = window.scrollY > 600 ? 'block' : 'none'; }, { passive:true })

// FAQ
function toggleFaq(btn) {
  const item = btn.closest('.faq-item')
  const body = item.querySelector('.faq-body')
  const isOpen = item.classList.contains('open')
  document.querySelectorAll('.faq-item.open').forEach(i => { i.classList.remove('open'); i.querySelector('.faq-body').classList.remove('open'); })
  if (!isOpen) { item.classList.add('open'); body.classList.add('open'); }
}

// Blog posts
async function loadBlog() {
  const grid = document.getElementById('blog-grid')
  if (!grid) return
  try {
    const r = await fetch('/api/blog?limit=3')
    if (!r.ok) throw new Error()
    const { posts } = await r.json()
    if (!posts || !posts.length) {
      grid.innerHTML = \`<div class="col-span-3 text-center py-12 text-gray-600"><p class="mb-2">Fresh AI insights coming soon.</p><p class="text-sm">Our AI publishes multiple times daily.</p></div>\`
      return
    }
    grid.innerHTML = posts.map(p => \`
      <a href="/blog/\${p.slug}" class="glass gh p-6 block">
        <span class="inline-block text-xs px-2 py-0.5 rounded-full mb-4" style="background:var(--volt-soft);border:1px solid var(--volt-line);color:var(--volt)">\${p.category||'AI Insights'}</span>
        <h3 class="text-sm font-bold text-white mb-2 cl2">\${p.title}</h3>
        <p class="text-gray-500 text-xs leading-relaxed mb-4 cl3">\${p.excerpt||''}</p>
        <div class="flex justify-between text-xs text-gray-700">
          <span>\${p.author||'Begyn.ai Team'}</span>
          <span>\${new Date(p.published_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
        </div>
      </a>\`).join('')
  } catch(_) {}
}

// Demo form
function handleDemo(e) {
  e.preventDefault()
  const btn = e.target.querySelector('button[type=submit]')
  btn.textContent = 'Sending...'
  btn.disabled = true
  setTimeout(() => {
    btn.textContent = '✓ Check your inbox!'
    document.getElementById('demo-email').value = ''
    setTimeout(() => { btn.textContent = 'Start My Free Trial →'; btn.disabled = false; }, 4000)
  }, 1000)
}

// Mobile nav close on link click
document.querySelectorAll('#mnav a').forEach(a => a.addEventListener('click', () => document.getElementById('mnav').classList.remove('open')))

loadBlog()
</script>
${chatWidget()}
</body>
</html>`)
})

// ── Blog listing page ─────────────────────────────────────────────────────────
app.get('/blog', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>AI Business Intelligence Blog | Begyn.ai — Tips, Trends & Insights</title>
  <meta name="description" content="Expert insights on AI business intelligence, automation, voice agents, and how entrepreneurs use AI to grow their companies. Updated multiple times per week."/>
  <link rel="canonical" href="https://begyn.online/blog"/>
  <meta property="og:title" content="AI Business Intelligence Blog | Begyn.ai"/>
  <meta property="og:description" content="Expert insights on AI, business intelligence, and automation for entrepreneurs. Updated multiple times per week."/>
  <meta property="og:url" content="https://begyn.online/blog"/>
  <meta property="og:type" content="website"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="AI Business Intelligence Blog | Begyn.ai"/>
  <meta name="twitter:description" content="Expert insights on AI, business intelligence, and automation for entrepreneurs."/>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Blog","name":"Begyn.ai Blog","description":"AI business intelligence insights for entrepreneurs","url":"https://begyn.online/blog","publisher":{"@type":"Organization","name":"Begyn.ai","url":"https://begyn.online"}}
  </script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background:#030712; color:#f3f4f6; font-family:ui-sans-serif,system-ui,-apple-system,sans-serif; }
    .grad-purple { background:linear-gradient(135deg,#7c3aed,#8b5cf6); }
    .grad-text-purple { background:linear-gradient(135deg,#a78bfa,#60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
    .card-dark { background:#111827; border:1px solid #1f2937; border-radius:1rem; }
    ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:#111827; } ::-webkit-scrollbar-thumb { background:#374151;border-radius:3px; }
  </style>
</head>
<body class="min-h-screen">
<!-- NAV (same as landing) -->
<nav class="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/60">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <a href="/" class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg grad-purple flex items-center justify-center shadow-lg shadow-purple-900/40">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14Z"/>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.14Z"/>
          </svg>
        </div>
        <span class="font-black text-lg grad-text-purple">Begyn.ai</span>
      </a>
      <div class="hidden md:flex items-center gap-8">
        <a href="/#features" class="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
        <a href="/#how-it-works" class="text-sm text-gray-400 hover:text-white transition-colors">How It Works</a>
        <a href="/#pricing" class="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
        <a href="/blog" class="text-sm text-white font-semibold">Blog</a>
      </div>
      <a href="/#cta" class="grad-purple text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-purple-900/30 hover:opacity-90 transition-opacity">Book a Demo</a>
    </div>
  </div>
</nav>

<!-- Blog Hero -->
<section class="relative overflow-hidden py-20 border-b border-gray-800/60">
  <div class="absolute inset-0 opacity-[0.03]" style="background:radial-gradient(ellipse at 30% 50%,#7c3aed,transparent 60%)"></div>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
    <div class="inline-flex items-center gap-2 bg-purple-900/30 border border-purple-700/40 text-purple-300 text-xs font-bold px-4 py-2 rounded-full mb-6">
      AI Insights for Legal Professionals
    </div>
    <h1 class="text-5xl sm:text-6xl font-black text-white mb-4">The <span class="grad-text-purple">Begyn.ai</span> Blog</h1>
    <p class="text-xl text-gray-400 max-w-2xl mx-auto">Stay ahead of AI adoption in law. Practical insights for forward-thinking legal professionals.</p>
  </div>
</section>

<!-- Category tabs + posts -->
<section class="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <!-- Category Filter -->
  <div id="category-tabs" class="flex flex-wrap gap-2 mb-10">
    <button onclick="filterPosts('')" id="cat-all" class="px-4 py-2 rounded-full text-sm font-semibold bg-purple-600 text-white transition-all">All</button>
    <button onclick="filterPosts('AI News')" id="cat-ai-news" class="px-4 py-2 rounded-full text-sm font-semibold bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all">AI News</button>
    <button onclick="filterPosts('Business Intelligence')" id="cat-business-intelligence" class="px-4 py-2 rounded-full text-sm font-semibold bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all">Business Intelligence</button>
    <button onclick="filterPosts('AI Automation')" id="cat-ai-automation" class="px-4 py-2 rounded-full text-sm font-semibold bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all">AI Automation</button>
    <button onclick="filterPosts('AI Voice')" id="cat-ai-voice" class="px-4 py-2 rounded-full text-sm font-semibold bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all">AI Voice</button>
  </div>

  <!-- Posts Grid -->
  <div id="posts-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-64"></div>

  <!-- Pagination -->
  <div id="pagination" class="flex items-center justify-center gap-3 mt-12 hidden">
    <button id="prev-btn" onclick="changePage(-1)" class="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-40">← Prev</button>
    <span id="page-info" class="text-gray-400 text-sm"></span>
    <button id="next-btn" onclick="changePage(1)" class="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-40">Next →</button>
  </div>
</section>

<!-- CTA -->
<section class="py-16 border-t border-gray-800">
  <div class="max-w-3xl mx-auto px-4 text-center">
    <h2 class="text-3xl font-black text-white mb-4">Ready to Transform Your Intake?</h2>
    <p class="text-gray-400 mb-8">Join 200+ law firms capturing more clients with AI.</p>
    <a href="/#cta" class="inline-flex items-center gap-2 grad-purple text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-purple-900/30 hover:opacity-90 transition-opacity">
      Book Free Demo →
    </a>
  </div>
</section>

<!-- Footer -->
<footer class="border-t border-gray-800 py-8 bg-gray-950">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
    <a href="/" class="flex items-center gap-2"><div class="w-6 h-6 rounded-lg grad-purple flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.14Z"/></svg></div><span class="font-black text-sm grad-text-purple">Begyn.ai</span></a>
    <div class="flex gap-6 text-sm text-gray-500">
      <a href="/#features" class="hover:text-white transition-colors">Features</a>
      <a href="/#pricing" class="hover:text-white transition-colors">Pricing</a>
      <a href="/blog" class="hover:text-white transition-colors">Blog</a>
      <a href="/#cta" class="hover:text-white transition-colors">Contact</a>
    </div>
    <p class="text-gray-700 text-sm">© 2025 Begyn.ai</p>
  </div>
</footer>

<script>
let currentPage = 1
let currentCategory = ''
let totalPages = 1

async function loadPosts(page, category) {
  const container = document.getElementById('posts-container')
  container.innerHTML = [1,2,3,4,5,6].map(() => \`
    <div class="card-dark p-6 animate-pulse">
      <div class="w-20 h-4 bg-gray-700 rounded mb-4"></div>
      <div class="h-6 bg-gray-700 rounded mb-2"></div>
      <div class="h-4 bg-gray-800 rounded mb-1"></div>
      <div class="h-4 bg-gray-800 rounded w-3/4 mb-6"></div>
      <div class="h-4 bg-gray-700 rounded w-1/2"></div>
    </div>\`).join('')

  let url = \`/api/blog?page=\${page}&limit=9\`
  if (category) url += \`&category=\${encodeURIComponent(category)}\`

  try {
    const res = await fetch(url)
    const data = await res.json()
    const posts = data.posts || []
    totalPages = data.pagination?.pages || 1
    currentPage = data.pagination?.page || 1

    if (posts.length === 0) {
      container.innerHTML = \`<div class="col-span-3 py-16 text-center"><p class="text-gray-500 text-lg">No posts found.</p><a href="/blog" onclick="filterPosts('')" class="text-purple-400 hover:text-purple-300 mt-3 inline-block">View all posts</a></div>\`
    } else {
      container.innerHTML = posts.map(p => \`
        <a href="/blog/\${p.slug}" class="card-dark p-6 hover:border-purple-500/40 transition-colors block group">
          <span class="inline-block text-xs bg-purple-900/30 border border-purple-700/30 text-purple-300 px-2 py-0.5 rounded-full mb-4">\${p.category || 'AI News'}</span>
          <h3 class="text-base font-bold text-white mb-2 group-hover:text-purple-300 transition-colors line-clamp-2">\${p.title}</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-5 line-clamp-3">\${p.excerpt || ''}</p>
          <div class="flex items-center justify-between text-xs text-gray-600">
            <span>\${p.author || 'Begyn.ai Team'}</span>
            <span>\${new Date(p.published_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
          </div>
        </a>\`).join('')
    }

    // Pagination
    const pag = document.getElementById('pagination')
    const pageInfo = document.getElementById('page-info')
    if (totalPages > 1) {
      pag.classList.remove('hidden')
      pageInfo.textContent = \`Page \${currentPage} of \${totalPages}\`
      document.getElementById('prev-btn').disabled = currentPage <= 1
      document.getElementById('next-btn').disabled = currentPage >= totalPages
    } else {
      pag.classList.add('hidden')
    }
  } catch (e) {
    container.innerHTML = '<div class="col-span-3 py-16 text-center text-gray-500">Failed to load posts.</div>'
  }
}

function filterPosts(cat) {
  currentCategory = cat
  currentPage = 1
  // Update tab styles
  document.querySelectorAll('#category-tabs button').forEach(btn => {
    btn.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all'
  })
  const activeId = cat === '' ? 'cat-all' : 'cat-' + cat.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g,'')
  const activeBtn = document.getElementById(activeId)
  if (activeBtn) activeBtn.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-purple-600 text-white transition-all'
  loadPosts(currentPage, currentCategory)
}

function changePage(delta) {
  const newPage = currentPage + delta
  if (newPage < 1 || newPage > totalPages) return
  loadPosts(newPage, currentCategory)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

loadPosts(1, '')
</script>
${chatWidget()}
</body>
</html>`)
})

// ── Individual blog post page (SSR for SEO/AEO/GEO) ──────────────────────────
app.get('/blog/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = (c.env as any).DB as D1Database
  let post: any = null
  try {
    post = await db.prepare("SELECT * FROM blog_posts WHERE slug=? AND status='published'").bind(slug).first()
  } catch(_) {}

  const title = post ? (post.seo_title || post.title) + ' | Begyn.ai Blog' : 'Post Not Found | Begyn.ai Blog'
  const desc = post ? (post.seo_description || post.excerpt || '') : ''
  const canonical = `https://begyn.online/blog/${slug}`
  const datePublished = post?.published_at || post?.created_at || new Date().toISOString()
  const dateModified = post?.updated_at || datePublished
  const articleSchema = post ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.excerpt || '',
    "author": { "@type": "Organization", "name": "Begyn.ai Team", "url": "https://begyn.online" },
    "publisher": { "@type": "Organization", "name": "Begyn.ai", "logo": { "@type": "ImageObject", "url": "https://begyn.online/static/favicon.svg" } },
    "datePublished": datePublished,
    "dateModified": dateModified,
    "url": canonical,
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonical }
  }) : '{}'
  const breadcrumbSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://begyn.online" },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://begyn.online/blog" },
      { "@type": "ListItem", "position": 3, "name": post?.title || slug, "item": canonical }
    ]
  })

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <meta name="description" content="${desc.replace(/"/g, '&quot;').substring(0, 160)}"/>
  <link rel="canonical" href="${canonical}"/>
  <meta name="robots" content="${post ? 'index, follow' : 'noindex'}"/>
  <meta property="og:title" content="${(post?.title || 'Not Found').replace(/"/g, '&quot;')}"/>
  <meta property="og:description" content="${desc.replace(/"/g, '&quot;').substring(0, 160)}"/>
  <meta property="og:url" content="${canonical}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:site_name" content="Begyn.ai"/>
  <meta property="article:published_time" content="${datePublished}"/>
  <meta property="article:modified_time" content="${dateModified}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${(post?.title || 'Not Found').replace(/"/g, '&quot;')}"/>
  <meta name="twitter:description" content="${desc.replace(/"/g, '&quot;').substring(0, 160)}"/>
  <script type="application/ld+json">${articleSchema}</script>
  <script type="application/ld+json">${breadcrumbSchema}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background:#030712; color:#f3f4f6; font-family:ui-sans-serif,system-ui,-apple-system,sans-serif; }
    .grad-purple { background:linear-gradient(135deg,#7c3aed,#8b5cf6); }
    .grad-text-purple { background:linear-gradient(135deg,#a78bfa,#60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
    .card-dark { background:#111827; border:1px solid #1f2937; border-radius:1rem; }
    .prose-content h2 { font-size:1.5rem; font-weight:800; color:#f9fafb; margin:2rem 0 1rem; border-bottom:1px solid #1f2937; padding-bottom:0.5rem; }
    .prose-content h3 { font-size:1.2rem; font-weight:700; color:#f9fafb; margin:1.5rem 0 0.75rem; }
    .prose-content p { color:#9ca3af; line-height:1.8; margin-bottom:1.25rem; }
    .prose-content ul, .prose-content ol { margin-left:1.5rem; margin-bottom:1.25rem; color:#9ca3af; line-height:1.8; }
    .prose-content ul { list-style:disc; }
    .prose-content ol { list-style:decimal; }
    .prose-content ul li, .prose-content ol li { margin-bottom:0.5rem; }
    .prose-content strong { color:#f3f4f6; font-weight:700; }
    .prose-content a { color:#a78bfa; text-decoration:underline; }
    .prose-content blockquote { border-left:3px solid #7c3aed; padding-left:1rem; margin:1.5rem 0; color:#6b7280; }
    ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:#111827; } ::-webkit-scrollbar-thumb { background:#374151;border-radius:3px; }
  </style>
</head>
<body class="min-h-screen">
<!-- NAV -->
<nav class="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/60">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <a href="/" class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg grad-purple flex items-center justify-center shadow-lg shadow-purple-900/40">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14Z"/>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.14Z"/>
          </svg>
        </div>
        <span class="font-black text-lg grad-text-purple">Begyn.ai</span>
      </a>
      <div class="hidden md:flex items-center gap-8">
        <a href="/#features" class="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
        <a href="/#pricing" class="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
        <a href="/blog" class="text-sm text-purple-400 font-semibold">Blog</a>
      </div>
      <a href="/#cta" class="grad-purple text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">Book a Demo</a>
    </div>
  </div>
</nav>

<!-- Breadcrumb (visible + schema) -->
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
  <nav aria-label="Breadcrumb">
    <ol class="flex items-center gap-2 text-sm text-gray-500">
      <li><a href="/" class="hover:text-white transition-colors">Home</a></li>
      <li class="text-gray-700">/</li>
      <li><a href="/blog" class="hover:text-white transition-colors">Blog</a></li>
      <li class="text-gray-700">/</li>
      <li class="text-gray-400 truncate max-w-xs">${(post?.title || slug).replace(/</g, '&lt;')}</li>
    </ol>
  </nav>
</div>

${post ? `
<!-- Article (SSR for crawlers) -->
<main class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12" id="post-main">
  <header class="mb-10">
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <span class="text-xs font-bold uppercase tracking-wider text-purple-400 bg-purple-400/10 px-3 py-1 rounded-full">${(post.category || 'AI Insights').replace(/</g,'&lt;')}</span>
      <time datetime="${datePublished}" class="text-xs text-gray-500">Last Updated: ${new Date(dateModified).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</time>
    </div>
    <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-6">${post.title.replace(/</g,'&lt;')}</h1>
    ${post.excerpt ? `<p class="text-lg text-gray-400 leading-relaxed mb-6">${post.excerpt.replace(/</g,'&lt;')}</p>` : ''}
    <div class="flex items-center gap-3 pb-6 border-b border-gray-800">
      <div class="w-9 h-9 rounded-full grad-purple flex items-center justify-center text-white font-bold text-sm flex-shrink-0">B</div>
      <div>
        <div class="text-sm font-semibold text-white">${(post.author || 'Begyn.ai Team').replace(/</g,'&lt;')}</div>
        <div class="text-xs text-gray-500">Begyn.ai · AI Business Intelligence</div>
      </div>
    </div>
  </header>
  <article class="prose-content" id="post-content">
    ${post.content}
  </article>
  <!-- Author bio (E-E-A-T signal) -->
  <aside class="mt-12 p-6 card-dark rounded-2xl border border-purple-900/30">
    <div class="flex items-start gap-4">
      <div class="w-12 h-12 rounded-full grad-purple flex items-center justify-center text-white font-bold text-lg flex-shrink-0">B</div>
      <div>
        <div class="font-bold text-white mb-1">Begyn.ai Team</div>
        <p class="text-sm text-gray-400 leading-relaxed">The Begyn.ai editorial team produces research-backed content on AI, business intelligence, and automation for entrepreneurs. We test every tool and strategy we write about.</p>
        <a href="https://begyn.online" class="text-purple-400 text-xs font-semibold mt-2 inline-block hover:text-purple-300 transition-colors">begyn.online →</a>
      </div>
    </div>
  </aside>
</main>
` : `
<div class="max-w-3xl mx-auto px-4 py-24 text-center">
  <h1 class="text-4xl font-black text-white mb-4">Post Not Found</h1>
  <p class="text-gray-400 mb-8">This post doesn't exist or has been removed.</p>
  <a href="/blog" class="grad-purple text-white px-6 py-3 rounded-xl font-semibold inline-block">Back to Blog</a>
</div>
`}

<!-- Related posts (loaded client-side) -->
<section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-gray-800" id="related-section" style="display:none">
  <h2 class="text-2xl font-black text-white mb-8">Related Articles</h2>
  <div class="grid md:grid-cols-3 gap-6" id="related-posts"></div>
</section>

<footer class="border-t border-gray-800 py-8 text-center mt-16">
  <a href="/" class="font-black text-lg grad-text-purple">Begyn.ai</a>
  <p class="text-gray-600 text-xs mt-2">© ${new Date().getFullYear()} Begyn.ai · <a href="/blog" class="hover:text-gray-400 transition-colors">Blog</a> · <a href="/sitemap.xml" class="hover:text-gray-400 transition-colors">Sitemap</a></p>
</footer>

<script>
(async () => {
  try {
    const r = await fetch('/api/blog/${slug}')
    if (!r.ok) return
    const { post, related } = await r.json()
    if (related && related.length) {
      document.getElementById('related-section').style.display = ''
      document.getElementById('related-posts').innerHTML = related.map(p => \`
        <a href="/blog/\${p.slug}" class="card-dark p-5 rounded-2xl block hover:border-purple-500/40 transition-colors group">
          <span class="text-xs text-purple-400 font-semibold uppercase tracking-wider">\${p.category || 'AI'}</span>
          <h3 class="text-sm font-bold text-white mt-2 mb-2 group-hover:text-purple-300 transition-colors leading-snug">\${p.title}</h3>
          <p class="text-xs text-gray-500">\${p.excerpt ? p.excerpt.substring(0,100)+'…' : ''}</p>
        </a>
      \`).join('')
    }
  } catch(_) {}
})()
</script>
${chatWidget()}
</body>
</html>`, post ? 200 : 404)
})

// ── Cloudflare Cron Trigger (runs daily at 6am UTC) ─────────────────────────
async function runScheduledProspecting(env: CronEnv) {
  // Check if enabled
  const cfgRow = await env.DB.prepare("SELECT value FROM prospector_config WHERE key='enabled'").first() as any
  if (!cfgRow || cfgRow.value !== '1') return

  // Build an internal fetch to /api/prospector/run-now
  // We call it programmatically so we reuse all the same logic
  const apiKeyRow = await env.DB.prepare("SELECT value FROM prospector_config WHERE key='google_maps_api_key'").first() as any
  const apiKey = apiKeyRow?.value || env.GOOGLE_MAPS_API_KEY || ''
  if (!apiKey) return

  // Step 1: Run prospecting (finds new leads, auto-queues builds)
  const req = new Request('https://localhost/api/prospector/run-now', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  })
  await app.fetch(req, env)

  // Step 2: Process queued website builds (research → Lovable → outreach)
  try {
    const builderEnabledRow = await env.DB.prepare("SELECT value FROM builder_config WHERE key='auto_research_on_discover'").first() as any
    const autoResearch = builderEnabledRow?.value === '1'

    if (autoResearch) {
      const buildReq = new Request('https://localhost/api/builder/process-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_size: 5 }),
      })
      await app.fetch(buildReq, env)
    }
  } catch (_) { /* builder not configured — skip */ }

}

// Blog generation runs independently of the prospector so deployments without
// a Google Maps key (or with the prospector disabled) still auto-publish.
async function runScheduledBlogPost(env: CronEnv) {
  try {
    const blogEnabled = await env.DB.prepare("SELECT value FROM blog_settings WHERE key='auto_post_enabled'").first() as any
    if (blogEnabled?.value !== '1') return
    const blogReq = new Request('https://localhost/api/blog/auto-generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': getInternalToken(),
      },
    })
    await app.fetch(blogReq, env)
  } catch (_) { /* blog not configured — skip */ }
}

export default {
  fetch: app.fetch.bind(app),
  async scheduled(event: ScheduledEvent, env: CronEnv, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.allSettled([
      runScheduledProspecting(env),
      runScheduledBlogPost(env),
    ]))
  },
}
