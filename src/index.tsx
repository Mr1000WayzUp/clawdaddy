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

type Bindings = {
  DB: D1Database
  GOOGLE_MAPS_API_KEY?: string
  SENDGRID_API_KEY?: string
  TWILIO_ACCOUNT_SID?: string
  TWILIO_AUTH_TOKEN?: string
  TWILIO_FROM_NUMBER?: string
  LOVABLE_API_KEY?: string
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

// Static assets
app.use('/static/*', serveStatic({ root: './' }))

// Main app - serve the SPA
app.get('*', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LocalWeb CRM – Lead & Client Management</title>
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
          <h1 class="font-bold text-white text-sm leading-tight">LocalWeb CRM</h1>
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
    </nav>

    <!-- User -->
    <div class="border-t border-gray-800 overflow-hidden">
      <div class="sidebar-user-expanded flex items-center gap-3 px-4 py-3">
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">YB</div>
        <div class="sidebar-label min-w-0 overflow-hidden">
          <p class="text-sm font-medium text-white truncate whitespace-nowrap">Your Business</p>
          <p class="text-xs text-gray-500 truncate whitespace-nowrap">Admin</p>
        </div>
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
            <option value="Basic">Basic ($500–$800)</option>
            <option value="Professional">Professional ($1,200–$2,000)</option>
            <option value="Premium">Premium ($2,500–$3,500)</option>
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
              <option value="Basic">Basic ($500–$800)</option>
              <option value="Professional" selected>Professional ($1,200–$2,000)</option>
              <option value="Premium">Premium ($2,500–$3,500)</option>
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

  // Fake a Request to reuse the Hono handler
  const req = new Request('https://localhost/api/prospector/run-now', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  })
  await app.fetch(req, env)
}

export default {
  fetch: app.fetch.bind(app),
  async scheduled(event: ScheduledEvent, env: CronEnv, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledProspecting(env))
  },
}
