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

// Static assets
app.use('/static/*', serveStatic({ root: './' }))

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

// Main app - serve the SPA
app.get('*', (c) => {
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

export default {
  fetch: app.fetch.bind(app),
  async scheduled(event: ScheduledEvent, env: CronEnv, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledProspecting(env))
  },
}
