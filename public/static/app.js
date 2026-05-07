/* ===================================================
   LocalWeb CRM - Frontend Application
   =================================================== */

const API = '/api'
let currentPage = 'dashboard'
let charts = {}
let sidebarCollapsed = false

// ===== SIDEBAR TOGGLE =====
function toggleSidebar() {
  const sidebar     = document.getElementById('sidebar')
  const mainWrapper = document.getElementById('main-wrapper')
  const icon        = document.getElementById('sidebar-toggle-icon')

  sidebarCollapsed = !sidebarCollapsed

  if (sidebarCollapsed) {
    sidebar.classList.remove('sidebar-expanded')
    sidebar.classList.add('sidebar-collapsed')
    mainWrapper.classList.remove('sidebar-main-expanded')
    mainWrapper.classList.add('sidebar-main-collapsed')
  } else {
    sidebar.classList.remove('sidebar-collapsed')
    sidebar.classList.add('sidebar-expanded')
    mainWrapper.classList.remove('sidebar-main-collapsed')
    mainWrapper.classList.add('sidebar-main-expanded')
  }

  // persist preference
  try { localStorage.setItem('sidebar_collapsed', sidebarCollapsed ? '1' : '0') } catch(e) {}
}

function initSidebar() {
  try {
    const saved = localStorage.getItem('sidebar_collapsed')
    if (saved === '1') toggleSidebar()
  } catch(e) {}
}

// ===== NAVIGATION =====
function navigateTo(page) {
  currentPage = page
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'))
  const navEl = document.getElementById('nav-' + page)
  if (navEl) navEl.classList.add('active')

  const titles = {
    dashboard: 'Dashboard', leads: 'Leads', pipeline: 'Pipeline',
    clients: 'Clients', proposals: 'Proposals', tasks: 'Tasks',
    revenue: 'Revenue Report', scraper: 'Lead Finder', prospector: '🤖 Auto-Prospector',
    builder: '✨ Website Builder'
  }
  document.getElementById('page-title').textContent = titles[page] || page

  // destroy existing charts to avoid canvas reuse errors
  Object.values(charts).forEach(ch => { try { ch.destroy() } catch(e){} })
  charts = {}

  const pages = {
    dashboard: renderDashboard,
    leads: renderLeads,
    pipeline: renderPipeline,
    clients: renderClients,
    proposals: renderProposals,
    tasks: renderTasks,
    revenue: renderRevenue,
    scraper: renderScraper,
    prospector: renderProspector,
    builder: renderBuilder,
  }
  if (pages[page]) pages[page]()
}

// ===== HELPERS =====
function fmt$(n) { return '$' + (Number(n)||0).toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0}) }
function fmtDate(d) { if(!d) return '—'; return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }
function fmtDateTime(d) { if(!d) return '—'; const dt=new Date(d); return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' ' + dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) }
function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff/60000), h = Math.floor(m/60), day = Math.floor(h/24)
  if (day>0) return day+'d ago'; if (h>0) return h+'h ago'; if (m>0) return m+'m ago'; return 'just now'
}
function escHtml(s) { if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function statusBadge(s) { return `<span class="badge badge-${s}">${s.replace(/_/g,' ')}</span>` }
function priorityBadge(p) { return `<span class="badge badge-${p}">${p}</span>` }
function industryIcon(ind) {
  const icons = { 'Home Services':'wrench','Restaurant':'utensils','Salon':'scissors','Auto Repair':'car','Retail':'store','Healthcare':'heartbeat','Legal':'balance-scale','Fitness':'dumbbell','Education':'graduation-cap','Other':'building' }
  return icons[ind] || 'building'
}
function packageColor(tier) {
  if(tier==='Premium') return 'text-yellow-400'
  if(tier==='Professional') return 'text-blue-400'
  return 'text-green-400'
}

async function api(method, path, data) {
  try {
    const opts = { method, headers: {'Content-Type':'application/json'} }
    if (data) opts.body = JSON.stringify(data)
    const res = await fetch(API + path, opts)
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error || 'Request failed') }
    return await res.json()
  } catch(e) { showToast(e.message, 'error'); throw e }
}

function showToast(msg, type='info') {
  const toast = document.getElementById('toast')
  const inner = document.getElementById('toast-inner')
  const icons = { success:'check-circle', error:'times-circle', info:'info-circle' }
  inner.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border toast-${type}`
  inner.innerHTML = `<i class="fas fa-${icons[type]}"></i><span>${escHtml(msg)}</span>`
  toast.classList.remove('hidden')
  clearTimeout(toast._t)
  toast._t = setTimeout(() => toast.classList.add('hidden'), 3500)
}

function closeModal(id) { document.getElementById(id).classList.add('hidden') }
function openModal(id)  { document.getElementById(id).classList.remove('hidden') }

function setContent(html) { document.getElementById('main-content').innerHTML = html }

// ===== DASHBOARD =====
async function renderDashboard() {
  setContent(`<div class="flex items-center justify-center h-48"><div class="spinner"></div></div>`)
  const [stats, byStatus, byIndustry, recentActivity, pendingTasks] = await Promise.all([
    api('GET','/analytics/summary'),
    api('GET','/analytics/leads-by-status'),
    api('GET','/analytics/leads-by-industry'),
    api('GET','/analytics/recent-activity'),
    api('GET','/tasks?status=pending'),
  ])

  // update nav badges
  const newCount = stats.leads.new
  const taskCount = stats.tasks.pending
  const nc = document.getElementById('nav-leads-count')
  const tc = document.getElementById('nav-tasks-count')
  if(nc){ nc.textContent=newCount; nc.classList.toggle('hidden', newCount===0) }
  if(tc){ tc.textContent=taskCount; tc.classList.toggle('hidden', taskCount===0) }

  const convRate = stats.leads.conversionRate
  setContent(`
    <div class="space-y-6">
      <!-- Welcome banner -->
      <div class="bg-gradient-to-r from-blue-900/40 to-indigo-900/30 border border-blue-800/40 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-white">Welcome back! 👋</h2>
          <p class="text-blue-300 text-sm mt-1">Here's your business overview for today</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-blue-400 font-semibold uppercase tracking-wide">Monthly Recurring</p>
          <p class="text-3xl font-bold text-green-400">${fmt$(stats.revenue.monthly)}<span class="text-sm text-gray-400">/mo</span></p>
        </div>
      </div>

      <!-- KPI Stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${kpiCard('Total Leads','map-marker-alt',stats.leads.total,'blue',`${stats.leads.new} new`)}
        ${kpiCard('Active Clients','users',stats.clients.active,'green',`${stats.clients.total} total`)}
        ${kpiCard('Total Revenue','dollar-sign',fmt$(stats.revenue.total),'emerald',`${fmt$(stats.revenue.monthly)}/mo recurring`)}
        ${kpiCard('Conversion Rate','chart-line',convRate+'%','purple',`${stats.leads.won} won · ${stats.leads.lost} lost`)}
      </div>

      <!-- Charts row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Pipeline funnel -->
        <div class="card">
          <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-stream text-blue-400 text-sm"></i>Lead Pipeline</h3>
          <div class="space-y-3">
            ${renderPipelineFunnel(byStatus)}
          </div>
        </div>
        <!-- Industry chart -->
        <div class="card">
          <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-building text-indigo-400 text-sm"></i>Leads by Industry</h3>
          <div class="chart-wrapper" style="height:220px"><canvas id="industryChart"></canvas></div>
        </div>
        <!-- Tasks summary -->
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-white flex items-center gap-2"><i class="fas fa-tasks text-orange-400 text-sm"></i>Upcoming Tasks</h3>
            <button onclick="navigateTo('tasks')" class="text-xs text-blue-400 hover:text-blue-300">View all</button>
          </div>
          <div class="space-y-2">
            ${pendingTasks.slice(0,5).map(t=>`
              <div class="flex items-start gap-3 p-2.5 rounded-lg bg-gray-900/50 hover:bg-gray-900 cursor-pointer transition-colors" onclick="showEditTaskModal(${JSON.stringify(t).replace(/"/g,'&quot;')})">
                <div class="mt-0.5">${priorityDot(t.priority)}</div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-white truncate">${escHtml(t.title)}</p>
                  <p class="text-xs text-gray-500">${t.due_date ? fmtDate(t.due_date) : 'No due date'}</p>
                </div>
                <button onclick="event.stopPropagation();completeTask(${t.id})" class="btn-icon btn-sm flex-shrink-0" title="Mark done"><i class="fas fa-check text-green-400"></i></button>
              </div>
            `).join('') || `<div class="text-center py-6 text-gray-600 text-sm"><i class="fas fa-check-circle text-2xl mb-2 block text-green-700"></i>All caught up!</div>`}
          </div>
        </div>
      </div>

      <!-- Bottom row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Proposals stats -->
        <div class="card">
          <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-file-invoice-dollar text-yellow-400 text-sm"></i>Proposals Overview</h3>
          <div class="grid grid-cols-3 gap-3 text-center">
            <div class="bg-gray-900 rounded-xl p-3">
              <p class="text-2xl font-bold text-white">${stats.proposals.total}</p>
              <p class="text-xs text-gray-500 mt-1">Total</p>
            </div>
            <div class="bg-blue-900/30 rounded-xl p-3">
              <p class="text-2xl font-bold text-blue-400">${stats.proposals.sent}</p>
              <p class="text-xs text-gray-500 mt-1">Sent</p>
            </div>
            <div class="bg-green-900/30 rounded-xl p-3">
              <p class="text-2xl font-bold text-green-400">${stats.proposals.accepted}</p>
              <p class="text-xs text-gray-500 mt-1">Accepted</p>
            </div>
          </div>
          <div class="mt-4">
            <div class="flex justify-between text-xs text-gray-500 mb-1">
              <span>Acceptance rate</span>
              <span>${stats.proposals.total>0?Math.round(stats.proposals.accepted/stats.proposals.total*100):0}%</span>
            </div>
            <div class="progress-bar"><div class="progress-fill bg-gradient-to-r from-green-600 to-emerald-400" style="width:${stats.proposals.total>0?Math.round(stats.proposals.accepted/stats.proposals.total*100):0}%"></div></div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-white flex items-center gap-2"><i class="fas fa-history text-gray-400 text-sm"></i>Recent Activity</h3>
          </div>
          <div class="space-y-0 max-h-48 overflow-y-auto">
            ${recentActivity.slice(0,8).map(a => activityItem(a)).join('') || '<p class="text-gray-600 text-sm text-center py-4">No activity yet</p>'}
          </div>
        </div>
      </div>
    </div>
  `)

  // Render industry doughnut
  const iCtx = document.getElementById('industryChart')
  if(iCtx && byIndustry.length) {
    charts.industry = new Chart(iCtx, {
      type:'doughnut',
      data: {
        labels: byIndustry.map(x=>x.industry),
        datasets:[{ data: byIndustry.map(x=>x.count), backgroundColor:['#3b82f6','#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444'], borderWidth:0, hoverOffset:6 }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ color:'#9ca3af', boxWidth:10, padding:10, font:{size:11} } } }, cutout:'65%' }
    })
  }
}

function kpiCard(label, icon, value, color, sub) {
  const colors = { blue:'text-blue-400 bg-blue-900/30', green:'text-green-400 bg-green-900/30', emerald:'text-emerald-400 bg-emerald-900/30', purple:'text-purple-400 bg-purple-900/30' }
  const [tc,bc] = (colors[color]||'text-gray-400 bg-gray-800').split(' ')
  return `
    <div class="stat-card flex items-center gap-4">
      <div class="w-12 h-12 rounded-xl ${bc} flex items-center justify-center flex-shrink-0">
        <i class="fas fa-${icon} ${tc} text-lg"></i>
      </div>
      <div class="min-w-0">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-wide">${label}</p>
        <p class="text-2xl font-bold text-white mt-0.5">${value}</p>
        <p class="text-xs text-gray-500 mt-0.5 truncate">${sub}</p>
      </div>
    </div>`
}

function renderPipelineFunnel(byStatus) {
  const order = ['new','contacted','demo_sent','proposal_sent','won','lost']
  const colors = { new:'bg-blue-600', contacted:'bg-indigo-500', demo_sent:'bg-violet-500', proposal_sent:'bg-purple-500', won:'bg-green-500', lost:'bg-red-600' }
  const map = {}; byStatus.forEach(x => map[x.status]=x.count)
  const total = Object.values(map).reduce((a,b)=>a+Number(b),0) || 1
  return order.map(s => {
    const count = map[s]||0
    const pct = Math.round(count/total*100)
    return `<div>
      <div class="flex justify-between text-xs mb-1">
        <span class="text-gray-400 capitalize">${s.replace(/_/g,' ')}</span>
        <span class="text-white font-semibold">${count}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill ${colors[s]||'bg-gray-500'}" style="width:${pct}%"></div></div>
    </div>`
  }).join('')
}

function priorityDot(p) {
  const c = { high:'bg-red-500', medium:'bg-orange-400', low:'bg-green-500' }
  return `<span class="inline-block w-2 h-2 rounded-full ${c[p]||'bg-gray-400'} mt-1.5"></span>`
}

function activityItem(a) {
  const icons = { lead_created:'plus-circle text-blue-400', status_change:'exchange-alt text-purple-400', note_added:'sticky-note text-yellow-400', client_created:'user-plus text-green-400', proposal_sent:'paper-plane text-indigo-400', proposal_created:'file-plus text-indigo-400' }
  const icon = icons[a.action] || 'circle text-gray-500'
  return `<div class="timeline-item">
    <div class="timeline-dot bg-gray-900"><i class="fas fa-${icon.split(' ')[0]} ${icon.split(' ')[1]||''} text-xs"></i></div>
    <div class="flex-1 min-w-0">
      <p class="text-sm text-gray-300 truncate">${escHtml(a.description||a.action)}</p>
      <p class="text-xs text-gray-600">${timeAgo(a.created_at)}</p>
    </div>
  </div>`
}

// ===== LEADS =====
let leadsData = []
async function renderLeads() {
  setContent(`<div class="flex items-center justify-center h-48"><div class="spinner"></div></div>`)
  leadsData = await api('GET', '/leads')
  renderLeadsTable(leadsData)
}

function renderLeadsTable(data) {
  setContent(`
    <div class="space-y-4">
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="filter-bar">
          <input type="text" id="lead-search" placeholder="Search leads..." class="form-input w-48" oninput="filterLeads()" />
          <select id="lead-filter-status" class="form-input w-36" onchange="filterLeads()">
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="demo_sent">Demo Sent</option>
            <option value="proposal_sent">Proposal Sent</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
          <select id="lead-filter-industry" class="form-input w-40" onchange="filterLeads()">
            <option value="">All Industries</option>
            <option>Home Services</option><option>Restaurant</option><option>Salon</option>
            <option>Auto Repair</option><option>Retail</option><option>Healthcare</option>
            <option>Legal</option><option>Fitness</option><option>Other</option>
          </select>
        </div>
        <button onclick="showAddLeadModal()" class="btn-primary"><i class="fas fa-plus"></i> Add Lead</button>
      </div>

      <!-- Stats row -->
      <div class="grid grid-cols-3 md:grid-cols-6 gap-3" id="lead-stat-chips"></div>

      <!-- Table -->
      <div class="card p-0 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="data-table" id="leads-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Industry</th>
                <th>City</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Source</th>
                <th>Added</th>
                <th class="w-24">Actions</th>
              </tr>
            </thead>
            <tbody id="leads-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `)
  updateLeadStatChips(data)
  renderLeadRows(data)
}

function updateLeadStatChips(data) {
  const counts = {}
  data.forEach(l => { counts[l.status] = (counts[l.status]||0)+1 })
  const chips = [
    { label:'All', val:'', count:data.length, color:'bg-gray-800 text-gray-300' },
    { label:'New', val:'new', count:counts.new||0, color:'bg-blue-900/40 text-blue-300' },
    { label:'Contacted', val:'contacted', count:counts.contacted||0, color:'bg-indigo-900/40 text-indigo-300' },
    { label:'Demo', val:'demo_sent', count:counts.demo_sent||0, color:'bg-violet-900/40 text-violet-300' },
    { label:'Won', val:'won', count:counts.won||0, color:'bg-green-900/40 text-green-300' },
    { label:'Lost', val:'lost', count:counts.lost||0, color:'bg-red-900/40 text-red-300' },
  ]
  document.getElementById('lead-stat-chips').innerHTML = chips.map(c=>`
    <button onclick="quickFilterLeads('${c.val}')" class="${c.color} rounded-lg px-3 py-2 text-center cursor-pointer hover:opacity-80 transition-opacity border border-white/5">
      <p class="text-xl font-bold">${c.count}</p>
      <p class="text-xs mt-0.5 opacity-80">${c.label}</p>
    </button>`).join('')
}

function renderLeadRows(data) {
  const tbody = document.getElementById('leads-tbody')
  if(!tbody) return
  if(!data.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-map-marker-alt"></i><p class="text-lg font-semibold text-gray-500">No leads found</p><p class="text-sm mt-1">Add your first lead to get started</p></div></td></tr>`
    return
  }
  tbody.innerHTML = data.map(l => `
    <tr onclick="showLeadDetail(${l.id})">
      <td>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-blue-900/40 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-${industryIcon(l.industry)} text-blue-400 text-xs"></i>
          </div>
          <div class="min-w-0">
            <p class="font-semibold text-white truncate max-w-[160px]">${escHtml(l.business_name)}</p>
            ${l.owner_name ? `<p class="text-xs text-gray-500 truncate">${escHtml(l.owner_name)}</p>` : ''}
          </div>
        </div>
      </td>
      <td><span class="text-gray-400 text-sm">${escHtml(l.industry)}</span></td>
      <td><span class="text-gray-400 text-sm">${escHtml(l.city)}</span></td>
      <td>
        <div class="text-sm">
          ${l.phone ? `<a href="tel:${escHtml(l.phone)}" onclick="event.stopPropagation()" class="text-blue-400 hover:text-blue-300 block">${escHtml(l.phone)}</a>` : ''}
          ${l.email ? `<span class="text-gray-500 text-xs truncate block max-w-[120px]">${escHtml(l.email)}</span>` : ''}
          ${!l.phone && !l.email ? '<span class="text-gray-600 text-xs">No contact</span>' : ''}
        </div>
      </td>
      <td>${statusBadge(l.status)}</td>
      <td><span class="text-gray-500 text-xs capitalize">${(l.source||'').replace(/_/g,' ')}</span></td>
      <td><span class="text-gray-500 text-xs">${fmtDate(l.created_at)}</span></td>
      <td>
        <div class="row-actions flex items-center gap-1" onclick="event.stopPropagation()">
          <button onclick="showProposalModal({lead_id:${l.id},business_name:'${escHtml(l.business_name)}',owner_name:'${escHtml(l.owner_name||'')}'})" class="btn-icon btn-sm" title="Create proposal"><i class="fas fa-file-invoice-dollar text-yellow-400"></i></button>
          <button onclick="showEditLeadModal(${l.id})" class="btn-icon btn-sm" title="Edit"><i class="fas fa-edit text-blue-400"></i></button>
          <button onclick="confirmDeleteLead(${l.id})" class="btn-icon btn-sm" title="Delete"><i class="fas fa-trash text-red-400"></i></button>
        </div>
      </td>
    </tr>
  `).join('')
}

function filterLeads() {
  const q = (document.getElementById('lead-search')?.value||'').toLowerCase()
  const st = document.getElementById('lead-filter-status')?.value||''
  const ind = document.getElementById('lead-filter-industry')?.value||''
  let filtered = leadsData
  if(q) filtered = filtered.filter(l => (l.business_name+l.owner_name+l.city+l.phone+l.email).toLowerCase().includes(q))
  if(st) filtered = filtered.filter(l => l.status===st)
  if(ind) filtered = filtered.filter(l => l.industry===ind)
  renderLeadRows(filtered)
}

function quickFilterLeads(status) {
  const el = document.getElementById('lead-filter-status')
  if(el) { el.value=status; filterLeads() }
}

async function showLeadDetail(id) {
  const data = await api('GET', `/leads/${id}`)
  const l = data.lead
  document.getElementById('ld-title').textContent = l.business_name
  document.getElementById('lead-detail-content').innerHTML = `
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="space-y-3">
        <div><p class="text-xs text-gray-500 uppercase font-semibold">Status</p><div class="mt-1">${statusBadge(l.status)}</div></div>
        <div><p class="text-xs text-gray-500 uppercase font-semibold">Industry</p><p class="text-white text-sm mt-1">${escHtml(l.industry)}</p></div>
        <div><p class="text-xs text-gray-500 uppercase font-semibold">City</p><p class="text-white text-sm mt-1">${escHtml(l.city)}</p></div>
        ${l.owner_name?`<div><p class="text-xs text-gray-500 uppercase font-semibold">Owner</p><p class="text-white text-sm mt-1">${escHtml(l.owner_name)}</p></div>`:''}
        ${l.phone?`<div><p class="text-xs text-gray-500 uppercase font-semibold">Phone</p><a href="tel:${escHtml(l.phone)}" class="text-blue-400 text-sm mt-1 block">${escHtml(l.phone)}</a></div>`:''}
        ${l.email?`<div><p class="text-xs text-gray-500 uppercase font-semibold">Email</p><p class="text-blue-400 text-sm mt-1 break-all">${escHtml(l.email)}</p></div>`:''}
        ${l.address?`<div><p class="text-xs text-gray-500 uppercase font-semibold">Address</p><p class="text-white text-sm mt-1">${escHtml(l.address)}</p></div>`:''}
      </div>
      <div class="space-y-3">
        <div><p class="text-xs text-gray-500 uppercase font-semibold">Source</p><p class="text-white text-sm mt-1 capitalize">${(l.source||'').replace(/_/g,' ')}</p></div>
        <div><p class="text-xs text-gray-500 uppercase font-semibold">Added</p><p class="text-white text-sm mt-1">${fmtDate(l.created_at)}</p></div>
        ${l.notes?`<div><p class="text-xs text-gray-500 uppercase font-semibold">Notes</p><p class="text-gray-300 text-sm mt-1 whitespace-pre-wrap">${escHtml(l.notes)}</p></div>`:''}
        ${l.google_maps_url?`<div><a href="${escHtml(l.google_maps_url)}" target="_blank" class="btn-secondary btn-sm"><i class="fas fa-map-marker-alt mr-1 text-red-400"></i>View on Maps</a></div>`:''}
      </div>
    </div>

    <!-- Update status -->
    <div class="bg-gray-900 rounded-xl p-3 mb-4">
      <p class="text-xs text-gray-500 uppercase font-semibold mb-2">Update Status</p>
      <div class="flex flex-wrap gap-2">
        ${['new','contacted','demo_sent','proposal_sent','won','lost'].map(s=>`
          <button onclick="quickStatusChange(${l.id},'${s}')" class="badge badge-${s} cursor-pointer hover:opacity-80 ${l.status===s?'ring-2 ring-white/30':''}">${s.replace(/_/g,' ')}</button>
        `).join('')}
      </div>
    </div>

    <!-- Add note -->
    <div class="bg-gray-900 rounded-xl p-3 mb-4">
      <p class="text-xs text-gray-500 uppercase font-semibold mb-2">Add Note</p>
      <div class="flex gap-2">
        <input id="ld-note-input" type="text" class="form-input flex-1" placeholder="Add a note..."/>
        <button onclick="addLeadNote(${l.id})" class="btn-primary btn-sm">Add</button>
      </div>
    </div>

    <!-- Activity timeline -->
    ${data.activities.length?`
    <div class="mb-4">
      <p class="text-xs text-gray-500 uppercase font-semibold mb-2">Activity Timeline</p>
      <div class="space-y-0 max-h-40 overflow-y-auto">${data.activities.map(activityItem).join('')}</div>
    </div>`:''}

    <!-- Actions -->
    <div class="flex gap-2 pt-2 border-t border-gray-800">
      <button onclick="closeModal('lead-detail-modal');showEditLeadModal(${l.id})" class="btn-secondary btn-sm"><i class="fas fa-edit mr-1"></i>Edit</button>
      <button onclick="closeModal('lead-detail-modal');showProposalModal({lead_id:${l.id},business_name:'${escHtml(l.business_name)}',owner_name:'${escHtml(l.owner_name||'')}'})" class="btn-secondary btn-sm"><i class="fas fa-file-invoice-dollar mr-1 text-yellow-400"></i>Proposal</button>
      ${l.status==='won'?'':`<button onclick="closeModal('lead-detail-modal');convertToClient(${l.id})" class="btn-primary btn-sm"><i class="fas fa-user-plus mr-1"></i>Convert to Client</button>`}
    </div>
  `
  openModal('lead-detail-modal')
}

async function quickStatusChange(id, status) {
  await api('PATCH', `/leads/${id}/status`, { status })
  showToast('Status updated', 'success')
  closeModal('lead-detail-modal')
  renderLeads()
}

async function addLeadNote(id) {
  const note = document.getElementById('ld-note-input').value.trim()
  if(!note) return
  await api('POST', `/leads/${id}/notes`, { note })
  showToast('Note added', 'success')
  closeModal('lead-detail-modal')
  renderLeads()
}

function showAddLeadModal() {
  document.getElementById('lead-modal-title').textContent = 'Add New Lead'
  document.getElementById('lead-id').value = ''
  document.getElementById('lead-form').reset()
  document.getElementById('lead-source').value = 'google_maps'
  document.getElementById('lead-status').value = 'new'
  openModal('lead-modal')
}

async function showEditLeadModal(id) {
  let lead = leadsData.find(l=>l.id===id)
  if(!lead) { const d = await api('GET',`/leads/${id}`); lead = d.lead }
  document.getElementById('lead-modal-title').textContent = 'Edit Lead'
  document.getElementById('lead-id').value = lead.id
  document.getElementById('lead-business-name').value = lead.business_name||''
  document.getElementById('lead-owner-name').value = lead.owner_name||''
  document.getElementById('lead-industry').value = lead.industry||''
  document.getElementById('lead-city').value = lead.city||''
  document.getElementById('lead-phone').value = lead.phone||''
  document.getElementById('lead-email').value = lead.email||''
  document.getElementById('lead-address').value = lead.address||''
  document.getElementById('lead-maps-url').value = lead.google_maps_url||''
  document.getElementById('lead-status').value = lead.status||'new'
  document.getElementById('lead-source').value = lead.source||'google_maps'
  document.getElementById('lead-notes').value = lead.notes||''
  openModal('lead-modal')
}

document.getElementById('lead-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const id = document.getElementById('lead-id').value
  const data = {
    business_name: document.getElementById('lead-business-name').value,
    owner_name: document.getElementById('lead-owner-name').value,
    industry: document.getElementById('lead-industry').value,
    city: document.getElementById('lead-city').value,
    phone: document.getElementById('lead-phone').value,
    email: document.getElementById('lead-email').value,
    address: document.getElementById('lead-address').value,
    google_maps_url: document.getElementById('lead-maps-url').value,
    status: document.getElementById('lead-status').value,
    source: document.getElementById('lead-source').value,
    notes: document.getElementById('lead-notes').value,
  }
  try {
    if(id) await api('PUT', `/leads/${id}`, data)
    else await api('POST', '/leads', data)
    showToast(id?'Lead updated':'Lead added!', 'success')
    closeModal('lead-modal')
    if(currentPage==='leads') renderLeads()
    else if(currentPage==='pipeline') renderPipeline()
    else if(currentPage==='dashboard') renderDashboard()
  } catch(e) {}
})

async function confirmDeleteLead(id) {
  if(!confirm('Delete this lead? This cannot be undone.')) return
  await api('DELETE', `/leads/${id}`)
  showToast('Lead deleted', 'info')
  renderLeads()
}

function convertToClient(leadId) {
  const lead = leadsData.find(l=>l.id===leadId)
  if(!lead) return
  document.getElementById('client-modal-title').textContent = 'Convert Lead to Client'
  document.getElementById('client-id').value = ''
  document.getElementById('client-business-name').value = lead.business_name||''
  document.getElementById('client-owner-name').value = lead.owner_name||''
  document.getElementById('client-industry').value = lead.industry||''
  document.getElementById('client-city').value = lead.city||''
  document.getElementById('client-phone').value = lead.phone||''
  document.getElementById('client-email').value = lead.email||''
  document.getElementById('client-package').value = ''
  document.getElementById('client-price').value = ''
  document.getElementById('client-recurring').value = '0'
  document.getElementById('client-status').value = 'active'
  document.getElementById('client-notes').value = ''
  // Store lead_id for conversion
  document.getElementById('client-form').dataset.leadId = leadId
  openModal('client-modal')
}

// ===== PIPELINE KANBAN =====
async function renderPipeline() {
  setContent(`<div class="flex items-center justify-center h-48"><div class="spinner"></div></div>`)
  const leads = await api('GET', '/leads')
  const stages = [
    { key:'new', label:'New', color:'text-blue-400', dot:'bg-blue-500' },
    { key:'contacted', label:'Contacted', color:'text-indigo-400', dot:'bg-indigo-500' },
    { key:'demo_sent', label:'Demo Sent', color:'text-violet-400', dot:'bg-violet-500' },
    { key:'proposal_sent', label:'Proposal Sent', color:'text-purple-400', dot:'bg-purple-500' },
    { key:'won', label:'Won 🏆', color:'text-green-400', dot:'bg-green-500' },
    { key:'lost', label:'Lost', color:'text-red-400', dot:'bg-red-600' },
  ]
  const grouped = {}
  stages.forEach(s => { grouped[s.key] = leads.filter(l => l.status===s.key) })

  setContent(`
    <div class="overflow-x-auto pb-4">
      <div class="flex gap-4 min-w-max">
        ${stages.map(s => `
          <div class="kanban-col">
            <div class="kanban-col-header">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${s.dot}"></span>
                <span class="${s.color}">${s.label}</span>
              </div>
              <span class="text-gray-500 text-xs bg-gray-800 px-2 py-0.5 rounded-full">${grouped[s.key].length}</span>
            </div>
            <div class="kanban-cards" id="col-${s.key}">
              ${grouped[s.key].map(l => kanbanCard(l)).join('')}
              ${!grouped[s.key].length ? `<div class="text-center py-6 text-gray-700 text-xs">No leads</div>`:''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    <p class="text-xs text-gray-600 mt-2"><i class="fas fa-info-circle mr-1"></i>Click any card to view details and update status</p>
  `)
}

function kanbanCard(l) {
  return `<div class="kanban-card" onclick="showLeadDetail(${l.id})">
    <div class="flex items-start justify-between gap-2 mb-2">
      <p class="text-sm font-semibold text-white leading-tight">${escHtml(l.business_name)}</p>
      <i class="fas fa-${industryIcon(l.industry)} text-gray-600 text-xs flex-shrink-0 mt-0.5"></i>
    </div>
    ${l.owner_name?`<p class="text-xs text-gray-500 mb-1">${escHtml(l.owner_name)}</p>`:''}
    <p class="text-xs text-gray-600">${escHtml(l.city)}</p>
    ${l.phone?`<a href="tel:${escHtml(l.phone)}" onclick="event.stopPropagation()" class="text-xs text-blue-500 hover:text-blue-400 mt-1 block">${escHtml(l.phone)}</a>`:''}
    ${l.notes?`<p class="text-xs text-gray-600 mt-2 truncate-2 italic">${escHtml(l.notes)}</p>`:''}
    <div class="mt-2 pt-2 border-t border-gray-800 flex items-center justify-between">
      <span class="text-xs text-gray-600">${fmtDate(l.created_at)}</span>
      <button onclick="event.stopPropagation();showProposalModal({lead_id:${l.id},business_name:'${escHtml(l.business_name)}',owner_name:'${escHtml(l.owner_name||'')}'})" class="text-xs text-yellow-500 hover:text-yellow-400"><i class="fas fa-file-invoice-dollar"></i></button>
    </div>
  </div>`
}

// ===== CLIENTS =====
let clientsData = []
async function renderClients() {
  setContent(`<div class="flex items-center justify-center h-48"><div class="spinner"></div></div>`)
  clientsData = await api('GET', '/clients')
  renderClientsTable(clientsData)
}

function renderClientsTable(data) {
  const totalRevenue = data.reduce((a,c)=>a+(c.package_price||0),0)
  const totalMRR = data.filter(c=>c.status==='active').reduce((a,c)=>a+(c.recurring_fee||0),0)
  setContent(`
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="filter-bar">
          <input type="text" id="client-search" placeholder="Search clients..." class="form-input w-48" oninput="filterClients()"/>
          <select id="client-filter-status" class="form-input w-32" onchange="filterClients()">
            <option value="">All Status</option>
            <option value="active">Active</option><option value="completed">Completed</option>
            <option value="paused">Paused</option><option value="churned">Churned</option>
          </select>
        </div>
        <button onclick="showAddClientModal()" class="btn-primary"><i class="fas fa-plus"></i> Add Client</button>
      </div>

      <!-- Revenue summary -->
      <div class="grid grid-cols-3 gap-4">
        <div class="stat-card">
          <p class="text-xs text-gray-500 uppercase font-semibold">Total Clients</p>
          <p class="text-2xl font-bold text-white mt-1">${data.length}</p>
        </div>
        <div class="stat-card">
          <p class="text-xs text-gray-500 uppercase font-semibold">Total Revenue</p>
          <p class="text-2xl font-bold text-green-400 mt-1">${fmt$(totalRevenue)}</p>
        </div>
        <div class="stat-card">
          <p class="text-xs text-gray-500 uppercase font-semibold">Monthly Recurring</p>
          <p class="text-2xl font-bold text-emerald-400 mt-1">${fmt$(totalMRR)}<span class="text-sm text-gray-500">/mo</span></p>
        </div>
      </div>

      <div class="card p-0 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Package</th>
                <th>Price</th>
                <th>Monthly</th>
                <th>Status</th>
                <th>Website</th>
                <th>Started</th>
                <th class="w-24">Actions</th>
              </tr>
            </thead>
            <tbody id="clients-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `)
  renderClientRows(data)
}

function renderClientRows(data) {
  const tbody = document.getElementById('clients-tbody')
  if(!tbody) return
  if(!data.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-users"></i><p class="text-lg font-semibold text-gray-500">No clients yet</p><p class="text-sm mt-1">Convert a lead or add a client manually</p></div></td></tr>`
    return
  }
  tbody.innerHTML = data.map(c => `
    <tr>
      <td>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-green-900/40 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-${industryIcon(c.industry)} text-green-400 text-xs"></i>
          </div>
          <div class="min-w-0">
            <p class="font-semibold text-white truncate max-w-[150px]">${escHtml(c.business_name)}</p>
            ${c.owner_name?`<p class="text-xs text-gray-500">${escHtml(c.owner_name)}</p>`:''}
          </div>
        </div>
      </td>
      <td><span class="${packageColor(c.package_tier)} font-semibold text-sm">${escHtml(c.package_tier)}</span></td>
      <td><span class="text-money">${fmt$(c.package_price)}</span></td>
      <td>${c.recurring_fee>0?`<span class="text-emerald-400 font-semibold">${fmt$(c.recurring_fee)}<span class="text-gray-600 text-xs">/mo</span></span>`:'<span class="text-gray-600 text-xs">—</span>'}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${c.website_url?`<a href="${escHtml(c.website_url)}" target="_blank" onclick="event.stopPropagation()" class="text-blue-400 hover:text-blue-300 text-xs truncate block max-w-[120px]">${escHtml(c.website_url)}</a>`:'<span class="text-gray-600 text-xs">—</span>'}</td>
      <td><span class="text-gray-500 text-xs">${fmtDate(c.start_date)}</span></td>
      <td>
        <div class="row-actions flex items-center gap-1" onclick="event.stopPropagation()">
          <button onclick="showEditClientModal(${c.id})" class="btn-icon btn-sm" title="Edit"><i class="fas fa-edit text-blue-400"></i></button>
          <button onclick="confirmDeleteClient(${c.id})" class="btn-icon btn-sm" title="Delete"><i class="fas fa-trash text-red-400"></i></button>
        </div>
      </td>
    </tr>
  `).join('')
}

function filterClients() {
  const q = (document.getElementById('client-search')?.value||'').toLowerCase()
  const st = document.getElementById('client-filter-status')?.value||''
  let f = clientsData
  if(q) f = f.filter(c=>(c.business_name+c.owner_name).toLowerCase().includes(q))
  if(st) f = f.filter(c=>c.status===st)
  renderClientRows(f)
}

function showAddClientModal() {
  document.getElementById('client-modal-title').textContent = 'Add New Client'
  document.getElementById('client-id').value = ''
  document.getElementById('client-form').reset()
  document.getElementById('client-form').dataset.leadId = ''
  document.getElementById('client-recurring').value = '0'
  document.getElementById('client-status').value = 'active'
  openModal('client-modal')
}

async function showEditClientModal(id) {
  let c = clientsData.find(x=>x.id===id)
  if(!c) { const d = await api('GET',`/clients/${id}`); c = d.client }
  document.getElementById('client-modal-title').textContent = 'Edit Client'
  document.getElementById('client-id').value = c.id
  document.getElementById('client-business-name').value = c.business_name||''
  document.getElementById('client-owner-name').value = c.owner_name||''
  document.getElementById('client-industry').value = c.industry||''
  document.getElementById('client-city').value = c.city||''
  document.getElementById('client-phone').value = c.phone||''
  document.getElementById('client-email').value = c.email||''
  document.getElementById('client-package').value = c.package_tier||''
  document.getElementById('client-price').value = c.package_price||''
  document.getElementById('client-recurring').value = c.recurring_fee||0
  document.getElementById('client-status').value = c.status||'active'
  document.getElementById('client-website').value = c.website_url||''
  document.getElementById('client-notes').value = c.notes||''
  openModal('client-modal')
}

function updateClientPrice() {
  const pkg = document.getElementById('client-package').value
  const defaults = { Basic:650, Professional:1500, Premium:3000 }
  const recurring = { Basic:50, Professional:75, Premium:150 }
  if(defaults[pkg]) {
    document.getElementById('client-price').value = defaults[pkg]
    document.getElementById('client-recurring').value = recurring[pkg]
  }
}

document.getElementById('client-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const id = document.getElementById('client-id').value
  const leadId = document.getElementById('client-form').dataset.leadId
  const data = {
    lead_id: leadId||null,
    business_name: document.getElementById('client-business-name').value,
    owner_name: document.getElementById('client-owner-name').value,
    industry: document.getElementById('client-industry').value,
    city: document.getElementById('client-city').value,
    phone: document.getElementById('client-phone').value,
    email: document.getElementById('client-email').value,
    package_tier: document.getElementById('client-package').value,
    package_price: parseFloat(document.getElementById('client-price').value),
    recurring_fee: parseFloat(document.getElementById('client-recurring').value)||0,
    website_url: document.getElementById('client-website').value,
    status: document.getElementById('client-status').value,
    notes: document.getElementById('client-notes').value,
  }
  try {
    if(id) await api('PUT', `/clients/${id}`, data)
    else await api('POST', '/clients', data)
    showToast(id?'Client updated':'Client added!','success')
    closeModal('client-modal')
    if(currentPage==='clients') renderClients()
    else if(currentPage==='leads') renderLeads()
    else if(currentPage==='dashboard') renderDashboard()
  } catch(e) {}
})

async function confirmDeleteClient(id) {
  if(!confirm('Delete this client?')) return
  await api('DELETE', `/clients/${id}`)
  showToast('Client deleted','info')
  renderClients()
}

// ===== PROPOSALS =====
let proposalsData = []
const PACKAGES = {
  Basic: {
    price: 650, recurring: 50,
    features: ['5-Page Website','Mobile Responsive','Contact Form','Google Maps Integration','Click-to-Call','1 Year Domain + Hosting']
  },
  Professional: {
    price: 1500, recurring: 75,
    features: ['Everything in Basic','SEO Optimization','Google Business Profile','Image Gallery','Social Media Links','Basic Analytics','Email Setup']
  },
  Premium: {
    price: 3000, recurring: 150,
    features: ['Everything in Professional','Booking/Appointment System','Blog Setup','3 Months of Updates','Local SEO Campaign','Priority Support','Custom Domain Email']
  }
}

async function renderProposals() {
  setContent(`<div class="flex items-center justify-center h-48"><div class="spinner"></div></div>`)
  proposalsData = await api('GET', '/proposals')
  setContent(`
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="filter-bar">
          <input type="text" id="prop-search" placeholder="Search proposals..." class="form-input w-48" oninput="filterProposals()"/>
          <select id="prop-filter-status" class="form-input w-32" onchange="filterProposals()">
            <option value="">All Status</option>
            <option value="draft">Draft</option><option value="sent">Sent</option>
            <option value="accepted">Accepted</option><option value="declined">Declined</option>
          </select>
        </div>
        <button onclick="showProposalModal({})" class="btn-primary"><i class="fas fa-plus"></i> New Proposal</button>
      </div>

      <div class="card p-0 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Package</th>
                <th>Price</th>
                <th>Monthly</th>
                <th>Status</th>
                <th>Created</th>
                <th class="w-28">Actions</th>
              </tr>
            </thead>
            <tbody id="proposals-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `)
  renderProposalRows(proposalsData)
}

function renderProposalRows(data) {
  const tbody = document.getElementById('proposals-tbody')
  if(!tbody) return
  if(!data.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-file-invoice-dollar"></i><p class="text-lg font-semibold text-gray-500">No proposals yet</p></div></td></tr>`
    return
  }
  tbody.innerHTML = data.map(p=>`
    <tr>
      <td>
        <p class="font-semibold text-white">${escHtml(p.business_name)}</p>
        ${p.owner_name?`<p class="text-xs text-gray-500">${escHtml(p.owner_name)}</p>`:''}
      </td>
      <td><span class="${packageColor(p.package_tier)} font-semibold text-sm">${escHtml(p.package_tier)}</span></td>
      <td><span class="text-money">${fmt$(p.package_price)}</span></td>
      <td>${p.recurring_fee>0?`<span class="text-emerald-400 font-semibold">${fmt$(p.recurring_fee)}<span class="text-gray-600 text-xs">/mo</span></span>`:'—'}</td>
      <td>${statusBadge(p.status)}</td>
      <td><span class="text-gray-500 text-xs">${fmtDate(p.created_at)}</span></td>
      <td>
        <div class="flex items-center gap-1" onclick="event.stopPropagation()">
          <button onclick="showProposalModal(null,${p.id})" class="btn-icon btn-sm" title="Edit"><i class="fas fa-edit text-blue-400"></i></button>
          <button onclick="copyProposalById(${p.id})" class="btn-icon btn-sm" title="Copy text"><i class="fas fa-copy text-gray-400"></i></button>
          <button onclick="confirmDeleteProposal(${p.id})" class="btn-icon btn-sm" title="Delete"><i class="fas fa-trash text-red-400"></i></button>
        </div>
      </td>
    </tr>
  `).join('')
}

function filterProposals() {
  const q=(document.getElementById('prop-search')?.value||'').toLowerCase()
  const st=document.getElementById('prop-filter-status')?.value||''
  let f=proposalsData
  if(q) f=f.filter(p=>(p.business_name+p.owner_name).toLowerCase().includes(q))
  if(st) f=f.filter(p=>p.status===st)
  renderProposalRows(f)
}

function showProposalModal(leadData, proposalId) {
  // Reset form
  document.getElementById('proposal-id').value = ''
  document.getElementById('proposal-lead-id').value = ''

  if(leadData) {
    document.getElementById('proposal-business-name').value = leadData.business_name||''
    document.getElementById('proposal-owner-name').value = leadData.owner_name||''
    document.getElementById('proposal-lead-id').value = leadData.lead_id||''
    document.getElementById('proposal-package').value = 'Professional'
    document.getElementById('proposal-price').value = 1500
    document.getElementById('proposal-recurring').value = 75
    document.getElementById('proposal-status').value = 'draft'
    document.getElementById('proposal-message').value = leadData.business_name ? `Hi ${leadData.owner_name||'there'}, I noticed your business doesn't have a website yet. I've put together this proposal to help ${escHtml(leadData.business_name)} build a strong online presence and attract more customers.` : ''
  }

  if(proposalId) {
    const p = proposalsData.find(x=>x.id===proposalId)
    if(p) {
      document.getElementById('proposal-id').value = p.id
      document.getElementById('proposal-lead-id').value = p.lead_id||''
      document.getElementById('proposal-business-name').value = p.business_name||''
      document.getElementById('proposal-owner-name').value = p.owner_name||''
      document.getElementById('proposal-package').value = p.package_tier||'Professional'
      document.getElementById('proposal-price').value = p.package_price||1500
      document.getElementById('proposal-recurring').value = p.recurring_fee||0
      document.getElementById('proposal-status').value = p.status||'draft'
      document.getElementById('proposal-message').value = p.custom_message||''
    }
  }

  renderProposalFeatures()
  updateProposalPreview()
  openModal('proposal-modal')
}

function renderProposalFeatures() {
  const pkg = document.getElementById('proposal-package').value||'Professional'
  const pkgData = PACKAGES[pkg]||PACKAGES.Professional
  const container = document.getElementById('proposal-features')
  container.innerHTML = pkgData.features.map(f => `
    <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-900 rounded p-1">
      <input type="checkbox" value="${escHtml(f)}" checked class="accent-blue-500" onchange="updateProposalPreview()"/>
      <span class="text-sm text-gray-300">${escHtml(f)}</span>
    </label>
  `).join('')
  updateProposalPreview()
}

function updateProposalPackage() {
  const pkg = document.getElementById('proposal-package').value
  const pkgData = PACKAGES[pkg]
  if(pkgData) {
    document.getElementById('proposal-price').value = pkgData.price
    document.getElementById('proposal-recurring').value = pkgData.recurring
  }
  renderProposalFeatures()
}

function updateProposalPreview() {
  const biz = document.getElementById('proposal-business-name').value||'[Business Name]'
  const owner = document.getElementById('proposal-owner-name').value||'there'
  const pkg = document.getElementById('proposal-package').value||'Professional'
  const price = document.getElementById('proposal-price').value||0
  const recurring = document.getElementById('proposal-recurring').value||0
  const msg = document.getElementById('proposal-message').value||''
  const features = [...document.querySelectorAll('#proposal-features input:checked')].map(i=>i.value)

  document.getElementById('proposal-preview').innerHTML = `
    <div class="proposal-preview-header">
      <p class="text-blue-400 font-bold text-sm">WEBSITE PROPOSAL</p>
      <p class="text-white font-bold text-base mt-1">${escHtml(biz)}</p>
      <p class="text-gray-500 text-xs">Prepared for ${escHtml(owner)} · ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>
    </div>

    ${msg?`<div class="text-gray-300 text-xs leading-relaxed bg-gray-900/50 rounded-lg p-2">${escHtml(msg)}</div>`:''}

    <div class="bg-gray-900 rounded-lg p-3">
      <p class="text-xs font-bold text-white mb-1">${pkg} Package</p>
      <div class="flex items-end gap-2">
        <span class="text-2xl font-bold text-green-400">${fmt$(price)}</span>
        <span class="text-xs text-gray-500 mb-1">one-time setup</span>
      </div>
      ${recurring>0?`<p class="text-xs text-emerald-400 mt-1">+ ${fmt$(recurring)}/month maintenance</p>`:''}
    </div>

    <div>
      <p class="text-xs font-bold text-white mb-2">What's Included:</p>
      <div class="flex flex-wrap">${features.map(f=>`<span class="proposal-feature-tag"><i class="fas fa-check text-green-400"></i>${escHtml(f)}</span>`).join('')}</div>
    </div>

    <div class="bg-gray-900 rounded-lg p-3">
      <p class="text-xs font-bold text-white mb-1">Timeline</p>
      <p class="text-xs text-gray-400">Your website will be ready in <span class="text-white font-semibold">3–5 business days</span> after we receive your content and 50% deposit.</p>
    </div>

    <div class="border border-gray-700 rounded-lg p-3">
      <p class="text-xs font-bold text-white mb-1">Next Steps</p>
      <ol class="text-xs text-gray-400 space-y-1 list-decimal list-inside">
        <li>Review and approve this proposal</li>
        <li>Pay 50% deposit: ${fmt$(price/2)}</li>
        <li>Fill out our onboarding form</li>
        <li>We build your site — you review</li>
        <li>Go live + pay remaining balance</li>
      </ol>
    </div>
  `
}

async function saveProposal() {
  const id = document.getElementById('proposal-id').value
  const features = [...document.querySelectorAll('#proposal-features input:checked')].map(i=>i.value)
  const data = {
    lead_id: document.getElementById('proposal-lead-id').value||null,
    business_name: document.getElementById('proposal-business-name').value,
    owner_name: document.getElementById('proposal-owner-name').value,
    package_tier: document.getElementById('proposal-package').value,
    package_price: parseFloat(document.getElementById('proposal-price').value),
    recurring_fee: parseFloat(document.getElementById('proposal-recurring').value)||0,
    features,
    custom_message: document.getElementById('proposal-message').value,
    status: document.getElementById('proposal-status').value,
  }
  try {
    if(id) await api('PUT',`/proposals/${id}`,data)
    else await api('POST','/proposals',data)
    showToast(id?'Proposal updated':'Proposal saved!','success')
    closeModal('proposal-modal')
    if(currentPage==='proposals') renderProposals()
  } catch(e) {}
}

function copyProposalText() {
  const preview = document.getElementById('proposal-preview')
  const text = preview.innerText
  navigator.clipboard.writeText(text).then(()=>showToast('Proposal copied to clipboard!','success')).catch(()=>showToast('Copy failed','error'))
}

async function copyProposalById(id) {
  const p = proposalsData.find(x=>x.id===id)
  if(!p) return
  const features = (p.features||'').split(',').filter(Boolean)
  const text = `WEBSITE PROPOSAL\n${p.business_name}\n\n${p.custom_message||''}\n\n${p.package_tier} Package: ${fmt$(p.package_price)}${p.recurring_fee>0?' + '+fmt$(p.recurring_fee)+'/mo':''}\n\nIncludes:\n${features.map(f=>'✓ '+f).join('\n')}\n\nTimeline: 3–5 business days\nDeposit required: ${fmt$(p.package_price/2)}`
  navigator.clipboard.writeText(text).then(()=>showToast('Copied!','success'))
}

async function confirmDeleteProposal(id) {
  if(!confirm('Delete this proposal?')) return
  await api('DELETE',`/proposals/${id}`)
  showToast('Proposal deleted','info')
  renderProposals()
}

// ===== TASKS =====
let tasksData = []
async function renderTasks() {
  setContent(`<div class="flex items-center justify-center h-48"><div class="spinner"></div></div>`)
  tasksData = await api('GET', '/tasks')
  setContent(`
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="filter-bar">
          <div class="tab-bar" id="task-tab-bar">
            <button class="tab-btn active" onclick="filterTasksByStatus('pending',this)">Pending <span class="ml-1 text-xs opacity-70" id="t-pending-count"></span></button>
            <button class="tab-btn" onclick="filterTasksByStatus('in_progress',this)">In Progress</button>
            <button class="tab-btn" onclick="filterTasksByStatus('done',this)">Done</button>
            <button class="tab-btn" onclick="filterTasksByStatus('',this)">All</button>
          </div>
        </div>
        <button onclick="showAddTaskModal()" class="btn-primary"><i class="fas fa-plus"></i> Add Task</button>
      </div>
      <div id="tasks-content"></div>
    </div>
  `)
  renderTasksList(tasksData.filter(t=>t.status!=='done'))
  document.getElementById('t-pending-count').textContent = tasksData.filter(t=>t.status==='pending').length
}

function filterTasksByStatus(status, btn) {
  document.querySelectorAll('#task-tab-bar .tab-btn').forEach(b=>b.classList.remove('active'))
  btn.classList.add('active')
  const filtered = status ? tasksData.filter(t=>t.status===status) : tasksData
  renderTasksList(filtered)
}

function renderTasksList(data) {
  const cont = document.getElementById('tasks-content')
  if(!cont) return
  if(!data.length) {
    cont.innerHTML = `<div class="empty-state"><i class="fas fa-tasks"></i><p class="text-lg font-semibold text-gray-500">No tasks</p></div>`
    return
  }
  const now = Date.now()
  cont.innerHTML = `<div class="space-y-2">
    ${data.map(t => {
      const overdue = t.due_date && new Date(t.due_date).getTime() < now && t.status!=='done'
      return `<div class="card p-4 flex items-start gap-4 hover:border-gray-700 transition-colors">
        <button onclick="completeTask(${t.id})" class="w-5 h-5 rounded border-2 ${t.status==='done'?'border-green-500 bg-green-500':'border-gray-600 hover:border-green-500'} flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors">
          ${t.status==='done'?'<i class="fas fa-check text-white text-xs"></i>':''}
        </button>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="font-semibold text-white ${t.status==='done'?'line-through text-gray-500':''}">${escHtml(t.title)}</p>
            ${priorityBadge(t.priority)}
            ${statusBadge(t.status)}
            ${overdue?'<span class="badge bg-red-900/50 text-red-400 border border-red-800"><i class="fas fa-exclamation-triangle mr-1"></i>Overdue</span>':''}
          </div>
          ${t.description?`<p class="text-sm text-gray-500 mt-1">${escHtml(t.description)}</p>`:''}
          ${t.due_date?`<p class="text-xs mt-1 ${overdue?'text-red-400':'text-gray-600'}"><i class="fas fa-calendar mr-1"></i>${fmtDate(t.due_date)}</p>`:''}
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <button onclick="showEditTaskModal(${JSON.stringify(t).replace(/"/g,'&quot;')})" class="btn-icon btn-sm"><i class="fas fa-edit text-blue-400"></i></button>
          <button onclick="confirmDeleteTask(${t.id})" class="btn-icon btn-sm"><i class="fas fa-trash text-red-400"></i></button>
        </div>
      </div>`
    }).join('')}
  </div>`
}

async function completeTask(id) {
  await api('PATCH', `/tasks/${id}/status`, { status: 'done' })
  showToast('Task completed! ✓', 'success')
  tasksData = tasksData.map(t => t.id===id ? {...t, status:'done'} : t)
  const activeTab = document.querySelector('#task-tab-bar .tab-btn.active')
  if(activeTab) activeTab.click()
}

function showAddTaskModal() {
  document.getElementById('task-modal-title').textContent = 'Add Task'
  document.getElementById('task-id').value = ''
  document.getElementById('task-form').reset()
  document.getElementById('task-priority').value = 'medium'
  document.getElementById('task-status').value = 'pending'
  // Set default due date to tomorrow
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1)
  document.getElementById('task-due-date').value = tomorrow.toISOString().split('T')[0]
  openModal('task-modal')
}

function showEditTaskModal(task) {
  if(typeof task === 'string') task = JSON.parse(task)
  document.getElementById('task-modal-title').textContent = 'Edit Task'
  document.getElementById('task-id').value = task.id
  document.getElementById('task-title').value = task.title||''
  document.getElementById('task-description').value = task.description||''
  document.getElementById('task-priority').value = task.priority||'medium'
  document.getElementById('task-status').value = task.status||'pending'
  document.getElementById('task-due-date').value = task.due_date ? task.due_date.split('T')[0] : ''
  openModal('task-modal')
}

document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const id = document.getElementById('task-id').value
  const data = {
    title: document.getElementById('task-title').value,
    description: document.getElementById('task-description').value,
    priority: document.getElementById('task-priority').value,
    status: document.getElementById('task-status').value,
    due_date: document.getElementById('task-due-date').value||null,
  }
  try {
    if(id) await api('PUT', `/tasks/${id}`, data)
    else await api('POST', '/tasks', data)
    showToast(id?'Task updated':'Task added!','success')
    closeModal('task-modal')
    renderTasks()
  } catch(e) {}
})

async function confirmDeleteTask(id) {
  if(!confirm('Delete this task?')) return
  await api('DELETE', `/tasks/${id}`)
  showToast('Task deleted','info')
  renderTasks()
}

// ===== REVENUE REPORT =====
async function renderRevenue() {
  setContent(`<div class="flex items-center justify-center h-48"><div class="spinner"></div></div>`)
  const [summary, byMonth, byPackage, clients] = await Promise.all([
    api('GET','/analytics/summary'),
    api('GET','/analytics/revenue-by-month'),
    api('GET','/analytics/clients-by-package'),
    api('GET','/clients'),
  ])

  const totalRev = summary.revenue.total
  const mrr = summary.revenue.monthly
  const arr = mrr * 12

  setContent(`
    <div class="space-y-6">
      <!-- Summary cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${kpiCard('Total Revenue','dollar-sign',fmt$(totalRev),'emerald','All time')}
        ${kpiCard('MRR','sync',fmt$(mrr),'blue','Monthly recurring')}
        ${kpiCard('ARR','chart-line',fmt$(arr),'purple','Annual recurring')}
        ${kpiCard('Avg Deal Size','handshake',fmt$(summary.clients.total>0?totalRev/summary.clients.total:0),'green','Per client')}
      </div>

      <!-- Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card">
          <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-chart-bar text-blue-400 text-sm"></i>Revenue by Month</h3>
          <div class="chart-wrapper" style="height:240px"><canvas id="revenueChart"></canvas></div>
        </div>
        <div class="card">
          <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-chart-pie text-indigo-400 text-sm"></i>Revenue by Package</h3>
          <div class="chart-wrapper" style="height:240px"><canvas id="packageChart"></canvas></div>
        </div>
      </div>

      <!-- Package breakdown table -->
      <div class="card">
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-table text-gray-400 text-sm"></i>Package Breakdown</h3>
        <table class="data-table">
          <thead><tr><th>Package</th><th>Clients</th><th>Revenue</th><th>Avg Price</th><th>% of Revenue</th></tr></thead>
          <tbody>
            ${byPackage.map(p=>`<tr>
              <td><span class="${packageColor(p.package_tier)} font-semibold">${escHtml(p.package_tier)}</span></td>
              <td>${p.count}</td>
              <td><span class="text-money">${fmt$(p.revenue)}</span></td>
              <td><span class="text-green-300">${fmt$(p.count>0?p.revenue/p.count:0)}</span></td>
              <td>
                <div class="flex items-center gap-2">
                  <div class="progress-bar flex-1"><div class="progress-fill bg-blue-500" style="width:${totalRev>0?Math.round(p.revenue/totalRev*100):0}%"></div></div>
                  <span class="text-xs text-gray-400 w-8">${totalRev>0?Math.round(p.revenue/totalRev*100):0}%</span>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- Recurring clients -->
      <div class="card">
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-sync text-emerald-400 text-sm"></i>Active Recurring Revenue</h3>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr><th>Client</th><th>Package</th><th>Monthly Fee</th><th>Annual Value</th><th>Status</th></tr></thead>
            <tbody>
              ${clients.filter(c=>c.recurring_fee>0 && c.status==='active').map(c=>`<tr>
                <td><p class="font-semibold text-white">${escHtml(c.business_name)}</p><p class="text-xs text-gray-500">${escHtml(c.city)}</p></td>
                <td><span class="${packageColor(c.package_tier)} font-semibold text-sm">${escHtml(c.package_tier)}</span></td>
                <td><span class="text-money">${fmt$(c.recurring_fee)}/mo</span></td>
                <td><span class="text-emerald-300">${fmt$(c.recurring_fee*12)}/yr</span></td>
                <td>${statusBadge(c.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `)

  // Revenue by month chart
  if(byMonth.length) {
    const rCtx = document.getElementById('revenueChart')
    charts.revenue = new Chart(rCtx, {
      type:'bar',
      data: {
        labels: byMonth.map(x=>x.month),
        datasets:[{
          label:'Revenue',
          data: byMonth.map(x=>x.revenue||0),
          backgroundColor:'rgba(59,130,246,0.7)',
          borderColor:'#3b82f6',
          borderWidth:1,
          borderRadius:4,
        }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{ x:{ticks:{color:'#6b7280'},grid:{color:'#1f2937'}}, y:{ticks:{color:'#6b7280',callback:v=>'$'+v.toLocaleString()},grid:{color:'#1f2937'}} }
      }
    })
  }

  // Package pie
  if(byPackage.length) {
    const pCtx = document.getElementById('packageChart')
    charts.packages = new Chart(pCtx, {
      type:'doughnut',
      data:{
        labels: byPackage.map(x=>x.package_tier),
        datasets:[{data: byPackage.map(x=>x.revenue||0), backgroundColor:['#10b981','#3b82f6','#f59e0b'], borderWidth:0, hoverOffset:6}]
      },
      options:{responsive:true,maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{color:'#9ca3af',boxWidth:12,padding:12,font:{size:12}}}}, cutout:'60%'}
    })
  }
}

// ===== LEAD FINDER (Scraper Guide) =====
function renderScraper() {
  setContent(`
    <div class="space-y-6 max-w-4xl">
      <!-- Header -->
      <div class="bg-gradient-to-r from-indigo-900/40 to-blue-900/30 border border-indigo-800/40 rounded-2xl p-6">
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-xl bg-indigo-600/30 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-search-location text-indigo-400 text-xl"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold text-white">Lead Finder</h2>
            <p class="text-gray-400 text-sm mt-1">Find businesses on Google Maps that don't have websites — your best prospects.</p>
          </div>
        </div>
      </div>

      <!-- Quick Add Form -->
      <div class="card">
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-plus-circle text-blue-400 text-sm"></i>Quickly Add a Lead from Maps</h3>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="form-label">Business Name *</label>
            <input id="quick-biz" type="text" class="form-input w-full" placeholder="Pete's Plumbing"/>
          </div>
          <div>
            <label class="form-label">Industry *</label>
            <select id="quick-industry" class="form-input w-full">
              <option value="">Select...</option>
              <option>Home Services</option><option>Restaurant</option><option>Salon</option>
              <option>Auto Repair</option><option>Retail</option><option>Healthcare</option>
              <option>Legal</option><option>Fitness</option><option>Other</option>
            </select>
          </div>
          <div>
            <label class="form-label">City *</label>
            <input id="quick-city" type="text" class="form-input w-full" placeholder="Austin"/>
          </div>
          <div>
            <label class="form-label">Phone</label>
            <input id="quick-phone" type="text" class="form-input w-full" placeholder="(512) 555-0101"/>
          </div>
          <div>
            <label class="form-label">Google Maps URL</label>
            <input id="quick-maps" type="text" class="form-input w-full col-span-2" placeholder="Paste Google Maps link..."/>
          </div>
          <div>
            <label class="form-label">Owner Name</label>
            <input id="quick-owner" type="text" class="form-input w-full" placeholder="Optional"/>
          </div>
        </div>
        <div class="mt-4 flex gap-3">
          <button onclick="quickAddLead()" class="btn-primary"><i class="fas fa-plus mr-1"></i>Add Lead</button>
          <button onclick="navigateTo('leads')" class="btn-secondary"><i class="fas fa-list mr-1"></i>View All Leads</button>
        </div>
      </div>

      <!-- How to find leads -->
      <div class="card">
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-map text-green-400 text-sm"></i>How to Find Leads on Google Maps</h3>
        <div class="space-y-4">
          ${scraperStep(1,'Open Google Maps','Go to maps.google.com or open the Google Maps app','fas fa-map-marker-alt','blue')}
          ${scraperStep(2,'Search by Category & City','Type: "plumber in Austin TX" or "restaurant in Houston TX"','fas fa-search','indigo')}
          ${scraperStep(3,'Look for Missing Website Button','Listings with a website show a blue "Website" button. Listings WITHOUT a website button are your targets!','fas fa-globe','purple')}
          ${scraperStep(4,'Get Contact Info','Click the listing to find phone number, address, and business name','fas fa-phone','green')}
          ${scraperStep(5,'Add to CRM','Use the form above to add the lead instantly','fas fa-plus-circle','emerald')}
        </div>
      </div>

      <!-- Best niches -->
      <div class="card">
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-star text-yellow-400 text-sm"></i>Best Industries to Target</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          ${nicheCard('Home Services','Plumbers, electricians, HVAC — highest urgency, they need to be found fast','wrench','blue','⭐⭐⭐⭐⭐')}
          ${nicheCard('Restaurants & Cafes','Need online menus & reservation info','utensils','orange','⭐⭐⭐⭐⭐')}
          ${nicheCard('Salons & Barbershops','Booking systems are very valuable to them','scissors','pink','⭐⭐⭐⭐')}
          ${nicheCard('Auto Repair','Before/after galleries drive leads','car','yellow','⭐⭐⭐⭐')}
          ${nicheCard('Local Retail','Product showcases help sales','store','green','⭐⭐⭐')}
          ${nicheCard('Healthcare','Dentists, chiropractors — premium pricing','heartbeat','red','⭐⭐⭐⭐')}
        </div>
      </div>

      <!-- Scripts -->
      <div class="card">
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-comments text-purple-400 text-sm"></i>Sales Scripts</h3>
        <div class="space-y-4">
          <div>
            <p class="text-xs font-bold text-gray-400 uppercase mb-2">📞 Phone Script</p>
            <div class="bg-gray-900 rounded-xl p-4 text-sm text-gray-300 leading-relaxed italic border-l-4 border-blue-600">
              "Hi, is this [Owner Name]? Great! My name is [Your Name]. I was searching for [industry] businesses in [city] and found your listing on Google Maps — it looks great! I noticed you don't have a website yet, and I actually put together a quick mockup of what yours could look like. It only takes 2 minutes to show you — would you be open to a quick call this week?"
            </div>
            <button onclick="copyScript('phone')" class="btn-secondary btn-sm mt-2"><i class="fas fa-copy mr-1"></i>Copy Script</button>
          </div>
          <div>
            <p class="text-xs font-bold text-gray-400 uppercase mb-2">🚶 In-Person Script</p>
            <div class="bg-gray-900 rounded-xl p-4 text-sm text-gray-300 leading-relaxed italic border-l-4 border-green-600">
              "Hi [Owner], I'm [Name] — I help local businesses in [city] get online. I was in the area and noticed you don't have a website yet. I actually built a mockup of what yours could look like — can I show you real quick on my phone? It takes 2 minutes and there's zero obligation."
            </div>
            <button onclick="copyScript('inperson')" class="btn-secondary btn-sm mt-2"><i class="fas fa-copy mr-1"></i>Copy Script</button>
          </div>
          <div>
            <p class="text-xs font-bold text-gray-400 uppercase mb-2">📧 Email/Text Template</p>
            <div class="bg-gray-900 rounded-xl p-4 text-sm text-gray-300 leading-relaxed italic border-l-4 border-yellow-600">
              "Hi [Owner], I found [Business Name] on Google Maps while searching for [industry] in [city]. I noticed you don't have a website yet — I'd love to show you a free mockup I built for you. Reply 'YES' and I'll send it over. No cost, no commitment. — [Your Name]"
            </div>
            <button onclick="copyScript('email')" class="btn-secondary btn-sm mt-2"><i class="fas fa-copy mr-1"></i>Copy Script</button>
          </div>
        </div>
      </div>
    </div>
  `)
}

function scraperStep(n, title, desc, icon, color) {
  const colors = { blue:'bg-blue-900/30 text-blue-400', indigo:'bg-indigo-900/30 text-indigo-400', purple:'bg-purple-900/30 text-purple-400', green:'bg-green-900/30 text-green-400', emerald:'bg-emerald-900/30 text-emerald-400' }
  const cls = colors[color]||'bg-gray-800 text-gray-400'
  return `<div class="flex gap-4 items-start">
    <div class="w-10 h-10 rounded-xl ${cls} flex items-center justify-center flex-shrink-0">
      <i class="fas fa-${icon} text-sm"></i>
    </div>
    <div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-gray-600">STEP ${n}</span>
      </div>
      <p class="font-semibold text-white text-sm">${title}</p>
      <p class="text-sm text-gray-500 mt-0.5">${desc}</p>
    </div>
  </div>`
}

function nicheCard(title, desc, icon, color, stars) {
  const bg = { blue:'bg-blue-900/20 border-blue-800/30', orange:'bg-orange-900/20 border-orange-800/30', pink:'bg-pink-900/20 border-pink-800/30', yellow:'bg-yellow-900/20 border-yellow-800/30', green:'bg-green-900/20 border-green-800/30', red:'bg-red-900/20 border-red-800/30' }
  const tc = { blue:'text-blue-400', orange:'text-orange-400', pink:'text-pink-400', yellow:'text-yellow-400', green:'text-green-400', red:'text-red-400' }
  return `<div class="border rounded-xl p-4 ${bg[color]||'bg-gray-900/20 border-gray-800/30'}">
    <i class="fas fa-${icon} ${tc[color]||'text-gray-400'} text-lg mb-2"></i>
    <p class="font-semibold text-white text-sm">${title}</p>
    <p class="text-xs text-gray-500 mt-1">${desc}</p>
    <p class="text-xs mt-2">${stars}</p>
  </div>`
}

async function quickAddLead() {
  const biz = document.getElementById('quick-biz').value.trim()
  const ind = document.getElementById('quick-industry').value
  const city = document.getElementById('quick-city').value.trim()
  const phone = document.getElementById('quick-phone').value.trim()
  const maps = document.getElementById('quick-maps').value.trim()
  const owner = document.getElementById('quick-owner').value.trim()
  if(!biz || !ind || !city) { showToast('Business name, industry, and city are required','error'); return }
  try {
    await api('POST', '/leads', { business_name:biz, industry:ind, city, phone:phone||null, google_maps_url:maps||null, owner_name:owner||null, status:'new', source:'google_maps' })
    showToast(`Lead "${biz}" added!`, 'success')
    document.getElementById('quick-biz').value=''
    document.getElementById('quick-phone').value=''
    document.getElementById('quick-maps').value=''
    document.getElementById('quick-owner').value=''
  } catch(e) {}
}

function copyScript(type) {
  const scripts = {
    phone: `Hi, is this [Owner Name]? Great! My name is [Your Name]. I was searching for [industry] businesses in [city] and found your listing on Google Maps — it looks great! I noticed you don't have a website yet, and I actually put together a quick mockup of what yours could look like. It only takes 2 minutes to show you — would you be open to a quick call this week?`,
    inperson: `Hi [Owner], I'm [Name] — I help local businesses in [city] get online. I was in the area and noticed you don't have a website yet. I actually built a mockup of what yours could look like — can I show you real quick on my phone? It takes 2 minutes and there's zero obligation.`,
    email: `Hi [Owner], I found [Business Name] on Google Maps while searching for [industry] in [city]. I noticed you don't have a website yet — I'd love to show you a free mockup I built for you. Reply 'YES' and I'll send it over. No cost, no commitment. — [Your Name]`
  }
  navigator.clipboard.writeText(scripts[type]||'').then(()=>showToast('Script copied!','success'))
}

// ===== GLOBAL SEARCH =====
document.getElementById('global-search').addEventListener('input', async function() {
  const q = this.value.trim()
  if(!q) return
  if(currentPage==='leads') {
    document.getElementById('lead-search') && (document.getElementById('lead-search').value=q)
    filterLeads()
  } else if(currentPage==='clients') {
    document.getElementById('client-search') && (document.getElementById('client-search').value=q)
    filterClients()
  }
})

// Close modals on backdrop click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if(e.target === overlay) {
      const id = overlay.id
      closeModal(id)
    }
  })
})

// ===================================================
// ===== AUTO-PROSPECTOR =====
// ===================================================

let prospectorConfig = {}
let prospectorStatus = {}
let prospectorRunning = false

async function renderProspector() {
  setContent(`<div class="flex items-center justify-center h-48"><div class="spinner"></div></div>`)
  const [status, cfg] = await Promise.all([
    api('GET', '/prospector/status'),
    api('GET', '/prospector/config'),
  ])
  prospectorStatus = status
  prospectorConfig = cfg

  // show pulse on nav if enabled
  const pulse = document.getElementById('nav-prospector-pulse')
  if (pulse) pulse.classList.toggle('hidden', cfg.enabled !== '1')

  const zipStats = {}
  ;(status.zip_stats || []).forEach(s => { zipStats[s.status] = s.count })

  setContent(`
    <div class="space-y-5 max-w-6xl">

      <!-- Header banner -->
      <div class="bg-gradient-to-r from-violet-900/40 to-indigo-900/30 border border-violet-700/40 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-violet-600/30 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-robot text-violet-400 text-xl"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold text-white flex items-center gap-2">
              Auto-Prospector
              <span id="engine-status-badge" class="${cfg.enabled==='1' ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-gray-800 text-gray-500 border border-gray-700'} text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full ${cfg.enabled==='1' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}"></span>
                ${cfg.enabled==='1' ? 'ACTIVE' : 'PAUSED'}
              </span>
            </h2>
            <p class="text-gray-400 text-sm mt-0.5">Searches for new leads daily at <strong class="text-white">${cfg.cron_time || '06:00'} UTC</strong> · Advances ZIPs automatically · Runs forever</p>
          </div>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <button onclick="toggleProspectorEnabled()" class="${cfg.enabled==='1' ? 'bg-red-900/40 text-red-400 border border-red-700 hover:bg-red-900/60' : 'bg-green-900/40 text-green-400 border border-green-700 hover:bg-green-900/60'} px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2">
            <i class="fas fa-${cfg.enabled==='1' ? 'pause' : 'play'}"></i>
            ${cfg.enabled==='1' ? 'Pause Engine' : 'Enable Engine'}
          </button>
          <button onclick="runProspectorNow()" id="run-now-btn" class="btn-primary flex items-center gap-2">
            <i class="fas fa-bolt"></i> Run Now
          </button>
        </div>
      </div>

      <!-- Stats row -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
        ${prospectorKpi('Total Leads Found', status.run_stats?.total_leads || 0, 'user-plus', 'blue')}
        ${prospectorKpi('ZIPs Worked', status.total_zips_worked || 0, 'map-pin', 'indigo')}
        ${prospectorKpi('ZIPs Queued', zipStats['pending'] || 0, 'list', 'violet')}
        ${prospectorKpi('ZIPs Exhausted', zipStats['exhausted'] || 0, 'check-double', 'green')}
        ${prospectorKpi('Open Leads', status.open_leads || 0, 'inbox', 'orange')}
      </div>

      <!-- Main grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <!-- LEFT: Current ZIP + Settings -->
        <div class="space-y-4">

          <!-- Active ZIP card -->
          <div class="card">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-bold text-white flex items-center gap-2"><i class="fas fa-crosshairs text-violet-400 text-sm"></i>Currently Working</h3>
              <button onclick="openZipAdvanceModal()" class="text-xs text-violet-400 hover:text-violet-300 font-semibold">Change ZIP →</button>
            </div>
            ${status.active_zip ? `
              <div class="bg-gradient-to-br from-violet-900/30 to-indigo-900/20 border border-violet-800/40 rounded-xl p-4">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 rounded-lg bg-violet-700/40 flex items-center justify-center">
                    <i class="fas fa-map-marker-alt text-violet-300"></i>
                  </div>
                  <div>
                    <p class="text-2xl font-bold text-white">${escHtml(status.active_zip.zip)}</p>
                    <p class="text-sm text-violet-300">${escHtml(status.active_zip.city)}, ${escHtml(status.active_zip.state)}</p>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div class="bg-gray-900/60 rounded-lg p-2 text-center">
                    <p class="text-xl font-bold text-white">${status.active_zip.leads_found || 0}</p>
                    <p class="text-gray-500">Leads Found</p>
                  </div>
                  <div class="bg-gray-900/60 rounded-lg p-2 text-center">
                    <p class="text-xl font-bold text-white">${status.open_leads || 0}</p>
                    <p class="text-gray-500">Still Open</p>
                  </div>
                </div>
                <div class="mt-3">
                  <div class="flex justify-between text-xs mb-1">
                    <span class="text-gray-500">ZIP completion</span>
                    <span class="text-white">${calcZipCompletion(status)}%</span>
                  </div>
                  <div class="progress-bar"><div class="progress-fill bg-gradient-to-r from-violet-600 to-indigo-500" style="width:${calcZipCompletion(status)}%"></div></div>
                </div>
                <p class="text-xs text-gray-600 mt-2">Last searched: ${status.active_zip.last_searched_at ? timeAgo(status.active_zip.last_searched_at) : 'Never'}</p>
              </div>
            ` : `<div class="text-center py-6 text-gray-600"><i class="fas fa-map-marker-alt text-3xl mb-2 block"></i><p class="text-sm">No active ZIP — configure one below</p></div>`}

            <button onclick="manualAdvanceZip()" class="btn-secondary w-full mt-3 text-sm justify-center">
              <i class="fas fa-forward mr-1 text-violet-400"></i>Mark Exhausted & Advance to Next ZIP
            </button>
          </div>

          <!-- Settings card -->
          <div class="card">
            <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-cog text-gray-400 text-sm"></i>Engine Settings</h3>
            <div class="space-y-3">
              <div>
                <label class="form-label">Google Maps API Key</label>
                <div class="flex gap-2">
                  <input id="cfg-api-key" type="password" class="form-input flex-1 text-xs" value="${escHtml(cfg.google_maps_api_key||'')}" placeholder="AIza..."/>
                  <button onclick="saveApiKey()" class="btn-secondary btn-sm flex-shrink-0">Save</button>
                </div>
                <p class="text-xs text-gray-600 mt-1">Required for live searches. <a href="https://developers.google.com/maps/documentation/places/web-service/get-api-key" target="_blank" class="text-blue-500 hover:text-blue-400">Get API key →</a></p>
              </div>
              <div>
                <label class="form-label">Daily Run Time (UTC)</label>
                <select id="cfg-cron" class="form-input w-full text-sm" onchange="saveProspectorSetting('cron_time', this.value)">
                  ${['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00'].map(t=>`<option value="${t}" ${cfg.cron_time===t?'selected':''}>${t} UTC</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="form-label">Target Industries</label>
                <div class="grid grid-cols-2 gap-1 mt-1" id="industry-checkboxes">
                  ${['Home Services','Restaurant','Salon','Auto Repair','Retail','Healthcare','Legal','Fitness'].map(ind => {
                    const checked = (cfg.target_industries||'').includes(ind)
                    return `<label class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white p-1 rounded hover:bg-gray-800">
                      <input type="checkbox" value="${ind}" ${checked?'checked':''} class="accent-violet-500" onchange="saveIndustries()"/>
                      ${ind}
                    </label>`
                  }).join('')}
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="form-label">Max Results/ZIP</label>
                  <input id="cfg-max-results" type="number" class="form-input w-full text-sm" value="${cfg.max_results_per_zip||20}" onchange="saveProspectorSetting('max_results_per_zip', this.value)"/>
                </div>
                <div>
                  <label class="form-label">ZIPs Per Run</label>
                  <input id="cfg-max-zips" type="number" class="form-input w-full text-sm" value="${cfg.max_zips_per_run||3}" onchange="saveProspectorSetting('max_zips_per_run', this.value)"/>
                </div>
              </div>
              <div class="flex items-center justify-between py-2 border-t border-gray-800">
                <div>
                  <p class="text-sm text-white font-medium">Skip businesses with websites</p>
                  <p class="text-xs text-gray-500">Only add leads with no website</p>
                </div>
                <button onclick="toggleSetting('skip_has_website')" class="relative w-11 h-6 rounded-full transition-colors ${cfg.skip_has_website!=='0' ? 'bg-violet-600' : 'bg-gray-700'}" id="toggle-skip-website">
                  <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${cfg.skip_has_website!=='0' ? 'translate-x-5' : 'translate-x-0'}"></span>
                </button>
              </div>
              <div class="flex items-center justify-between py-2 border-t border-gray-800">
                <div>
                  <p class="text-sm text-white font-medium">Auto-advance ZIP</p>
                  <p class="text-xs text-gray-500">Move to next ZIP when current is exhausted</p>
                </div>
                <button onclick="toggleSetting('auto_advance_zip')" class="relative w-11 h-6 rounded-full transition-colors ${cfg.auto_advance_zip!=='0' ? 'bg-violet-600' : 'bg-gray-700'}" id="toggle-auto-advance">
                  <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${cfg.auto_advance_zip!=='0' ? 'translate-x-5' : 'translate-x-0'}"></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- CENTER: Run log + discovered leads -->
        <div class="lg:col-span-2 space-y-4">

          <!-- How it works -->
          <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <h3 class="font-bold text-white text-sm mb-3 flex items-center gap-2"><i class="fas fa-info-circle text-blue-400"></i>How the Infinite Loop Works</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              ${howItWorksStep('1','Search','Every day at 6am, searches Google Maps in current ZIP for businesses with no website','search','blue')}
              ${howItWorksStep('2','Add Leads','New businesses are auto-added to your CRM instantly','plus-circle','green')}
              ${howItWorksStep('3','Monitor','When ALL leads in ZIP reach a terminal status (won/lost/not interested/etc.)…','eye','yellow')}
              ${howItWorksStep('4','Advance','…it automatically moves to the nearest next ZIP and repeats forever','forward','violet')}
            </div>
          </div>

          <!-- Terminal status explainer -->
          <div class="card p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-bold text-white text-sm flex items-center gap-2"><i class="fas fa-flag-checkered text-orange-400"></i>Terminal Statuses — ZIP advances when ALL leads reach one</h3>
            </div>
            <div class="flex flex-wrap gap-2">
              ${['won','lost','not_interested','already_has_website','do_not_contact','already_done'].map(s=>`
                <span class="badge badge-${s==='won'?'won':s==='lost'||s==='do_not_contact'?'lost':s==='not_interested'||s==='already_done'?'completed':'demo_sent'} text-xs px-3 py-1">
                  <i class="fas fa-${s==='won'?'trophy':s==='lost'?'times':s==='not_interested'?'hand-paper':s==='already_has_website'?'globe':s==='do_not_contact'?'ban':'check'} mr-1"></i>${s.replace(/_/g,' ')}
                </span>`).join('')}
            </div>
            <p class="text-xs text-gray-600 mt-3"><i class="fas fa-lightbulb mr-1 text-yellow-600"></i>Mark leads with these statuses from the Leads page → row options, or use the quick-action below</p>
          </div>

          <!-- Recent run log -->
          <div class="card p-0 overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 class="font-bold text-white text-sm flex items-center gap-2"><i class="fas fa-history text-gray-400"></i>Recent Search Runs</h3>
              <button onclick="renderProspector()" class="text-xs text-gray-500 hover:text-gray-300"><i class="fas fa-sync mr-1"></i>Refresh</button>
            </div>
            <div class="overflow-x-auto">
              <table class="data-table text-xs">
                <thead>
                  <tr>
                    <th>ZIP / City</th>
                    <th>Industry</th>
                    <th>Discovered</th>
                    <th>Added</th>
                    <th>Skipped</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  ${(status.recent_runs||[]).length ? (status.recent_runs||[]).map(r=>`
                    <tr>
                      <td><span class="font-semibold text-white">${escHtml(r.zip)}</span><span class="text-gray-500 ml-1">${escHtml(r.city||'')}</span></td>
                      <td><span class="text-gray-400">${escHtml(r.industry)}</span></td>
                      <td><span class="text-blue-400 font-semibold">${r.leads_discovered||0}</span></td>
                      <td><span class="text-green-400 font-semibold">${r.leads_added||0}</span></td>
                      <td><span class="text-gray-500">${r.leads_skipped||0}</span></td>
                      <td>${r.status==='completed'?'<span class="badge badge-active">done</span>':r.status==='failed'?'<span class="badge badge-lost">failed</span>':'<span class="badge badge-pending">running</span>'}</td>
                      <td><span class="text-gray-600">${timeAgo(r.started_at)}</span></td>
                    </tr>
                  `).join('') : `<tr><td colspan="7" class="text-center py-8 text-gray-600">No runs yet — click "Run Now" to start</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <!-- ZIP Queue -->
          <div class="card p-0 overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 class="font-bold text-white text-sm flex items-center gap-2"><i class="fas fa-list-ol text-indigo-400"></i>ZIP Queue</h3>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">${(zipStats['pending']||0)} pending · ${(zipStats['active']||0)} active · ${(zipStats['exhausted']||0)} exhausted</span>
                <button onclick="openAddZipModal()" class="btn-secondary btn-sm"><i class="fas fa-plus mr-1"></i>Add ZIP</button>
              </div>
            </div>
            <div class="overflow-x-auto max-h-64 overflow-y-auto">
              <table class="data-table text-xs">
                <thead class="sticky top-0">
                  <tr>
                    <th>ZIP</th>
                    <th>City, State</th>
                    <th>Status</th>
                    <th>Leads</th>
                    <th>Distance</th>
                    <th>Last Searched</th>
                  </tr>
                </thead>
                <tbody id="zip-queue-tbody">
                  <tr><td colspan="6" class="text-center py-4 text-gray-600"><div class="spinner mx-auto"></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Add ZIP Modal -->
    <div id="add-zip-modal" class="modal-overlay hidden">
      <div class="modal-box w-full max-w-md">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-white text-lg">Add ZIP to Queue</h3>
          <button onclick="closeModal('add-zip-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
        </div>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="form-label">ZIP Code *</label>
              <input id="new-zip-code" type="text" class="form-input w-full" placeholder="90210" maxlength="5"/>
            </div>
            <div>
              <label class="form-label">City</label>
              <input id="new-zip-city" type="text" class="form-input w-full" placeholder="Beverly Hills"/>
            </div>
            <div>
              <label class="form-label">State</label>
              <input id="new-zip-state" type="text" class="form-input w-full" placeholder="CA" maxlength="2"/>
            </div>
            <div>
              <label class="form-label">Latitude</label>
              <input id="new-zip-lat" type="number" class="form-input w-full" placeholder="34.0901" step="0.0001"/>
            </div>
            <div>
              <label class="form-label">Longitude</label>
              <input id="new-zip-lng" type="number" class="form-input w-full" placeholder="-118.4065" step="0.0001"/>
            </div>
          </div>
          <p class="text-xs text-gray-600"><i class="fas fa-info-circle mr-1"></i>Lat/Lng is used for nearest-neighbor distance calculation. <a href="https://www.latlong.net" target="_blank" class="text-blue-500">Look up here →</a></p>
          <div class="flex gap-3 justify-end pt-2">
            <button onclick="closeModal('add-zip-modal')" class="btn-secondary">Cancel</button>
            <button onclick="addZipToQueue()" class="btn-primary">Add ZIP</button>
          </div>
        </div>
      </div>
    </div>
  `)

  // load ZIP queue async
  loadZipQueue()
}

function prospectorKpi(label, value, icon, color) {
  const colors = { blue:'text-blue-400 bg-blue-900/30', indigo:'text-indigo-400 bg-indigo-900/30', violet:'text-violet-400 bg-violet-900/30', green:'text-green-400 bg-green-900/30', orange:'text-orange-400 bg-orange-900/30' }
  const [tc, bc] = (colors[color]||'text-gray-400 bg-gray-800').split(' ')
  return `<div class="stat-card flex items-center gap-3">
    <div class="w-10 h-10 rounded-xl ${bc} flex items-center justify-center flex-shrink-0"><i class="fas fa-${icon} ${tc} text-base"></i></div>
    <div><p class="text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight">${label}</p><p class="text-2xl font-bold text-white">${value}</p></div>
  </div>`
}

function howItWorksStep(n, title, desc, icon, color) {
  const tc = { blue:'text-blue-400', green:'text-green-400', yellow:'text-yellow-400', violet:'text-violet-400' }
  return `<div class="text-center">
    <div class="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center mx-auto mb-2"><i class="fas fa-${icon} ${tc[color]||'text-gray-400'}"></i></div>
    <p class="text-xs font-bold text-white">${n}. ${title}</p>
    <p class="text-xs text-gray-500 mt-1 leading-relaxed">${desc}</p>
  </div>`
}

function calcZipCompletion(status) {
  const total = (status.active_zip?.leads_found || 0)
  if (!total) return 0
  const open = status.open_leads || 0
  const terminal = Math.max(0, total - open)
  return Math.min(100, Math.round(terminal / total * 100))
}

async function loadZipQueue() {
  const tbody = document.getElementById('zip-queue-tbody')
  if (!tbody) return
  const zips = await api('GET', '/prospector/zip-queue?limit=100')
  if (!zips.length) { tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-600">No ZIPs in queue</td></tr>`; return }
  const statusColors = { active:'badge-proposal_sent', pending:'badge-new', exhausted:'badge-won', skipped:'badge-lost' }
  tbody.innerHTML = zips.map(z => `
    <tr class="${z.status==='active'?'bg-violet-900/10':''}">
      <td><span class="font-bold ${z.status==='active'?'text-violet-300':'text-white'}">${escHtml(z.zip)}</span></td>
      <td><span class="text-gray-400">${escHtml(z.city||'')}, ${escHtml(z.state||'')}</span></td>
      <td><span class="badge ${statusColors[z.status]||'badge-new'}">${z.status==='active'?'🎯 active':z.status}</span></td>
      <td><span class="text-green-400">${z.leads_found||0}</span></td>
      <td><span class="text-gray-500 text-xs">${z.distance_from_seed ? Math.round(z.distance_from_seed)+'mi' : '—'}</span></td>
      <td><span class="text-gray-600">${z.last_searched_at ? timeAgo(z.last_searched_at) : 'Never'}</span></td>
    </tr>
  `).join('')
}

async function toggleProspectorEnabled() {
  const newVal = prospectorConfig.enabled === '1' ? '0' : '1'
  await api('PUT', '/prospector/config', { enabled: newVal })
  showToast(newVal === '1' ? 'Auto-Prospector enabled ✓' : 'Auto-Prospector paused', newVal==='1'?'success':'info')
  renderProspector()
}

async function saveApiKey() {
  const key = document.getElementById('cfg-api-key').value.trim()
  if (!key) { showToast('Enter your API key first', 'error'); return }
  await api('PUT', '/prospector/config', { google_maps_api_key: key })
  showToast('API key saved ✓', 'success')
}

async function saveProspectorSetting(key, value) {
  await api('PUT', '/prospector/config', { [key]: value })
}

async function saveIndustries() {
  const checked = [...document.querySelectorAll('#industry-checkboxes input:checked')].map(i=>i.value)
  await api('PUT', '/prospector/config', { target_industries: checked.join(',') })
  showToast('Industries saved', 'success')
}

async function toggleSetting(key) {
  const current = prospectorConfig[key]
  const newVal = current === '0' ? '1' : '0'
  await api('PUT', '/prospector/config', { [key]: newVal })
  showToast(`Setting updated`, 'success')
  renderProspector()
}

async function runProspectorNow() {
  if (prospectorRunning) return
  const apiKey = document.getElementById('cfg-api-key')?.value.trim() || prospectorConfig.google_maps_api_key
  if (!apiKey) { showToast('Add your Google Maps API key first!', 'error'); return }

  prospectorRunning = true
  const btn = document.getElementById('run-now-btn')
  if (btn) { btn.innerHTML = '<span class="spinner"></span> Searching...'; btn.disabled = true }
  showToast('Starting prospecting run — searching Google Maps...', 'info')

  try {
    const result = await api('POST', '/prospector/run-now', { api_key: apiKey })
    const added = result.total_added || 0
    const advMsg = result.advanced_to ? ` → Advanced to ZIP ${result.advanced_to.zip} (${result.advanced_to.city})` : ''
    showToast(`✓ Run complete! ${added} new leads added.${advMsg}`, 'success')
    renderProspector()
  } catch(e) {
    // error already shown by api()
  } finally {
    prospectorRunning = false
    if (btn) { btn.innerHTML = '<i class="fas fa-bolt"></i> Run Now'; btn.disabled = false }
  }
}

async function manualAdvanceZip() {
  if (!confirm('Mark the current ZIP as exhausted and advance to the next nearest ZIP?')) return
  const result = await api('POST', '/prospector/mark-zip-exhausted', {})
  if (result.success) {
    showToast('Advanced to next ZIP!', 'success')
    renderProspector()
  }
}

function openAddZipModal() {
  document.getElementById('new-zip-code').value = ''
  document.getElementById('new-zip-city').value = ''
  document.getElementById('new-zip-state').value = ''
  document.getElementById('new-zip-lat').value = ''
  document.getElementById('new-zip-lng').value = ''
  openModal('add-zip-modal')
}

async function addZipToQueue() {
  const zip   = document.getElementById('new-zip-code').value.trim()
  const city  = document.getElementById('new-zip-city').value.trim()
  const state = document.getElementById('new-zip-state').value.trim()
  const lat   = parseFloat(document.getElementById('new-zip-lat').value) || null
  const lng   = parseFloat(document.getElementById('new-zip-lng').value) || null
  if (!zip || zip.length < 5) { showToast('Enter a valid 5-digit ZIP', 'error'); return }
  await api('POST', '/prospector/zip-queue', { zip, city, state, lat, lng })
  showToast(`ZIP ${zip} added to queue!`, 'success')
  closeModal('add-zip-modal')
  renderProspector()
}

function openZipAdvanceModal() {
  openAddZipModal()
}

// =====================================================
// ===== WEBSITE BUILDER =====
// =====================================================

let builderConfig = {}
let builderStats  = {}
let builderBuilds = []

async function renderBuilder() {
  setContent(`<div class="flex items-center justify-center h-48"><div class="spinner"></div></div>`)
  const [stats, cfg] = await Promise.all([
    api('GET', '/builder/stats'),
    api('GET', '/builder/config'),
  ])
  builderStats  = stats
  builderConfig = cfg

  // update nav badge
  const queued = (stats.by_status || []).find(s => s.build_status === 'queued')?.count || 0
  const badge = document.getElementById('nav-builder-count')
  if (badge) { badge.textContent = queued; badge.classList.toggle('hidden', !queued) }

  const statusMap = {}
  ;(stats.by_status || []).forEach(s => { statusMap[s.build_status] = s.count })
  const outreachMap = {}
  ;(stats.outreach_stats || []).forEach(s => { outreachMap[s.outreach_status] = s.count })

  setContent(`
    <div class="space-y-5 max-w-7xl">

      <!-- Header -->
      <div class="bg-gradient-to-r from-pink-900/40 to-purple-900/30 border border-pink-700/40 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-pink-600/30 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-magic text-pink-400 text-xl"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold text-white flex items-center gap-2">
              Auto Website Builder
              <span class="bg-pink-900/50 text-pink-400 border border-pink-700 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse"></span>
                AI-POWERED
              </span>
            </h2>
            <p class="text-gray-400 text-sm mt-0.5">
              Discovers leads with no website → Builds a stunning site via Lovable.app → Sends intro message + proposal automatically
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <button onclick="openBuilderSettingsModal()" class="btn-secondary flex items-center gap-2 text-sm">
            <i class="fas fa-cog"></i> Settings
          </button>
          <button onclick="openBulkBuildModal()" class="btn-secondary flex items-center gap-2 text-sm">
            <i class="fas fa-layer-group"></i> Bulk Build
          </button>
          <button onclick="openSingleBuildModal()" class="btn-primary flex items-center gap-2">
            <i class="fas fa-plus"></i> Build Website
          </button>
        </div>
      </div>

      <!-- KPI Row -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
        ${builderKpi('Total Builds', stats.total_builds || 0, 'globe', 'pink')}
        ${builderKpi('Generated', statusMap['generated'] || 0, 'check-circle', 'green')}
        ${builderKpi('Queued', statusMap['queued'] || 0, 'clock', 'yellow')}
        ${builderKpi('Outreach Sent', outreachMap['sent'] || 0, 'paper-plane', 'blue')}
        ${builderKpi('Converted', outreachMap['converted'] || 0, 'trophy', 'purple')}
      </div>

      <!-- How It Works Banner -->
      <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <h3 class="font-bold text-white text-sm mb-3 flex items-center gap-2"><i class="fas fa-info-circle text-pink-400"></i>How the Auto Builder Works</h3>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          ${builderStep('1','Discover','Auto-Prospector finds businesses with no website','search-location','violet')}
          ${builderStep('2','Generate Prompt','All business info used to craft a detailed Lovable.app build prompt','code','blue')}
          ${builderStep('3','Build Site','Lovable.app creates a stunning, accurate website automatically','magic','pink')}
          ${builderStep('4','Send Outreach','Email + SMS sent with preview link & proposal (your contact info included)','paper-plane','green')}
          ${builderStep('5','Close Deal','Lead calls/replies → convert to paying client','trophy','yellow')}
        </div>
      </div>

      <!-- Package Tiers -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${builderPackageCard('Basic','$500–$800','fa-rocket','blue',['5-page website','Mobile-responsive','Click-to-call','Google Maps','Contact form','1-yr domain + hosting'],'On-page SEO (title tags, meta descriptions, alt text)','')}
        ${builderPackageCard('Professional','$1,200–$2,000','fa-star','pink',['8-page website','Advanced contact form','Customer review showcase','Photo gallery (lightbox)','Google Business Profile','Analytics dashboard','Social media integration'],'Full SEO: schema markup, local SEO, sitemap, Search Console','',true)}
        ${builderPackageCard('Premium','$2,500–$3,500','fa-crown','yellow',['All Professional features','Member portal + login','Online booking system','E-commerce store','Live chat widget','Email marketing','Loyalty program','Unlimited pages'],'Elite SEO: monthly blog posts, backlink strategy, citations, Core Web Vitals, GBP management','Ongoing: weekly blog posts, monthly audit, quarterly redesign review')}
      </div>

      <!-- Builds Table -->
      <div class="card p-0 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 class="font-bold text-white text-sm flex items-center gap-2"><i class="fas fa-layer-group text-pink-400"></i>Recent Website Builds</h3>
          <div class="flex gap-2">
            <select id="builder-filter-status" class="form-input text-xs py-1" onchange="filterBuilds(this.value)">
              <option value="">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="generating">Generating</option>
              <option value="generated">Generated</option>
              <option value="published">Published</option>
              <option value="failed">Failed</option>
            </select>
            <button onclick="renderBuilder()" class="text-xs text-gray-500 hover:text-gray-300 px-2"><i class="fas fa-sync mr-1"></i>Refresh</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table text-xs" id="builds-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Industry</th>
                <th>Package</th>
                <th>Build Status</th>
                <th>Outreach</th>
                <th>Preview</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="builds-tbody">
              <tr><td colspan="8" class="text-center py-8 text-gray-600"><div class="spinner mx-auto"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Outreach Preview Card -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div class="card">
          <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-envelope text-blue-400 text-sm"></i>Email Template Preview</h3>
          <div class="bg-gray-950 border border-gray-700 rounded-xl p-4 text-xs text-gray-300 leading-relaxed max-h-72 overflow-y-auto font-mono whitespace-pre-wrap">${escHtml(sampleEmailPreview(cfg))}</div>
        </div>
        <div class="card">
          <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-sms text-green-400 text-sm"></i>SMS Template Preview</h3>
          <div class="bg-gray-950 border border-gray-700 rounded-xl p-4 text-xs text-gray-300 leading-relaxed max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">${escHtml(sampleSmsPreview(cfg))}</div>
          <div class="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/40 rounded-xl">
            <p class="text-xs text-yellow-400 font-semibold mb-1"><i class="fas fa-key mr-1"></i>API Keys Required for Live Outreach</p>
            <p class="text-xs text-gray-400">• <strong class="text-white">SendGrid</strong> — free tier sends 100 emails/day</p>
            <p class="text-xs text-gray-400 mt-1">• <strong class="text-white">Twilio</strong> — ~$0.0079/SMS, trial gives $15 credit</p>
            <p class="text-xs text-gray-400 mt-1">• <strong class="text-white">Lovable.app</strong> — required to auto-generate sites</p>
            <button onclick="openBuilderSettingsModal()" class="mt-2 btn-secondary btn-sm text-xs w-full justify-center">Configure API Keys →</button>
          </div>
        </div>
      </div>

    </div>
  `)

  loadBuildsTable('')
}

function builderKpi(label, value, icon, color) {
  const colors = {
    pink:   'text-pink-400 bg-pink-900/30',
    green:  'text-green-400 bg-green-900/30',
    yellow: 'text-yellow-400 bg-yellow-900/30',
    blue:   'text-blue-400 bg-blue-900/30',
    purple: 'text-purple-400 bg-purple-900/30',
  }
  const [tc, bc] = (colors[color] || 'text-gray-400 bg-gray-800').split(' ')
  return `<div class="stat-card flex items-center gap-3">
    <div class="w-10 h-10 rounded-xl ${bc} flex items-center justify-center flex-shrink-0"><i class="fas fa-${icon} ${tc} text-base"></i></div>
    <div><p class="text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight">${label}</p><p class="text-2xl font-bold text-white">${value}</p></div>
  </div>`
}

function builderStep(n, title, desc, icon, color) {
  const tc = { violet:'text-violet-400', blue:'text-blue-400', pink:'text-pink-400', green:'text-green-400', yellow:'text-yellow-400' }
  return `<div class="text-center">
    <div class="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center mx-auto mb-2"><i class="fas fa-${icon} ${tc[color]||'text-gray-400'}"></i></div>
    <p class="text-xs font-bold text-white">${n}. ${title}</p>
    <p class="text-xs text-gray-500 mt-1 leading-relaxed">${desc}</p>
  </div>`
}

function builderPackageCard(name, price, icon, color, features, seo, extras, featured = false) {
  const colors = {
    blue:   { border: 'border-blue-700/50',   bg: 'bg-blue-900/20',   icon: 'bg-blue-700/30 text-blue-400',   badge: 'bg-blue-900/50 text-blue-400 border-blue-700' },
    pink:   { border: 'border-pink-700/50',   bg: 'bg-pink-900/20',   icon: 'bg-pink-700/30 text-pink-400',   badge: 'bg-pink-900/50 text-pink-400 border-pink-700' },
    yellow: { border: 'border-yellow-700/50', bg: 'bg-yellow-900/20', icon: 'bg-yellow-700/30 text-yellow-400', badge: 'bg-yellow-900/50 text-yellow-400 border-yellow-700' },
  }
  const c = colors[color] || colors.blue
  return `
    <div class="border ${c.border} ${c.bg} rounded-2xl p-5 ${featured ? 'ring-2 ring-pink-500/50' : ''}">
      ${featured ? '<div class="text-center mb-3"><span class="bg-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</span></div>' : ''}
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center flex-shrink-0"><i class="fas ${icon}"></i></div>
        <div>
          <p class="font-bold text-white">${name}</p>
          <p class="text-lg font-bold text-white">${price}</p>
        </div>
      </div>
      <ul class="space-y-1.5 mb-4">
        ${features.map(f => `<li class="flex items-start gap-2 text-xs text-gray-300"><i class="fas fa-check text-green-400 mt-0.5 flex-shrink-0"></i>${f}</li>`).join('')}
      </ul>
      <div class="border-t border-gray-800 pt-3 mt-3">
        <p class="text-xs text-gray-500 font-semibold mb-1"><i class="fas fa-search mr-1"></i>SEO</p>
        <p class="text-xs text-gray-400">${seo}</p>
      </div>
      ${extras ? `<div class="border-t border-gray-800 pt-3 mt-3"><p class="text-xs text-gray-500 font-semibold mb-1"><i class="fas fa-sync mr-1"></i>Ongoing</p><p class="text-xs text-gray-400">${extras}</p></div>` : ''}
    </div>`
}

function sampleEmailPreview(cfg) {
  const phone = cfg.owner_phone || '(985)860-7891'
  const email = cfg.owner_email || 'e.w.Thompson10.10@gmail.com'
  const name  = cfg.owner_name  || 'Eric Developing Thompson'
  return `Subject: I built a free website demo for [Business Name] 🚀

Hi [Owner Name],

My name is ${name} and I'm a local web developer specializing in helping local businesses get found online.

I noticed that [Business Name] doesn't currently have a website — so I went ahead and built you a FREE demo to show you exactly what your business could look like online.

👉 VIEW YOUR FREE WEBSITE DEMO:
[Lovable.app Preview Link]

YOUR DEMO INCLUDES:
✅ Professional mobile-responsive design
✅ Click-to-call button
✅ Google Maps integration
✅ Your services showcased beautifully
✅ Contact form so customers reach you 24/7
✅ SEO-optimized so Google can find you

PACKAGES:
🔹 Basic       $500–$800
🔸 Professional $1,200–$2,000
💎 Premium     $2,500–$3,500

📞 ${phone}
📧 ${email}

— ${name}`
}

function sampleSmsPreview(cfg) {
  const phone = cfg.owner_phone || '(985)860-7891'
  return `Hi [Owner]! I'm Eric Thompson, a local web developer. I built a FREE demo website for [Business Name] — check it out: [preview link]

Your site includes mobile design, click-to-call, Google Maps & more. Packages from $500.

Interested? Reply or call: ${phone}`
}

async function loadBuildsTable(statusFilter) {
  const tbody = document.getElementById('builds-tbody')
  if (!tbody) return
  const url = statusFilter ? `/builder/builds?status=${statusFilter}&limit=50` : '/builder/builds?limit=50'
  const builds = await api('GET', url)
  builderBuilds = builds
  if (!builds.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-600">
      <i class="fas fa-magic text-3xl mb-2 block text-gray-700"></i>
      No website builds yet — click "Build Website" to create your first one
    </td></tr>`
    return
  }
  const statusBadge = {
    queued:     '<span class="badge badge-new">⏳ Queued</span>',
    generating: '<span class="badge badge-pending"><span class="spinner" style="width:10px;height:10px;border-width:2px;margin-right:4px;display:inline-block;"></span>Building…</span>',
    generated:  '<span class="badge badge-active">✅ Generated</span>',
    published:  '<span class="badge badge-won">🌐 Published</span>',
    failed:     '<span class="badge badge-lost">❌ Failed</span>',
    cancelled:  '<span class="badge badge-lost">🚫 Cancelled</span>',
  }
  const outreachBadge = {
    pending:   '<span class="text-gray-500 text-xs">Pending</span>',
    sent:      '<span class="text-blue-400 text-xs font-semibold">📤 Sent</span>',
    opened:    '<span class="text-yellow-400 text-xs font-semibold">👁 Opened</span>',
    replied:   '<span class="text-green-400 text-xs font-semibold">💬 Replied</span>',
    converted: '<span class="text-purple-400 text-xs font-semibold">🎉 Converted!</span>',
  }
  const pkgColors = { Basic:'text-blue-400', Professional:'text-pink-400', Premium:'text-yellow-400' }
  tbody.innerHTML = builds.map(b => `
    <tr>
      <td>
        <div class="font-semibold text-white">${escHtml(b.business_name)}</div>
        <div class="text-gray-500 text-xs">${escHtml(b.city||'')}</div>
      </td>
      <td><span class="text-gray-400 text-xs">${escHtml(b.industry||'')}</span></td>
      <td><span class="font-semibold text-xs ${pkgColors[b.package_tier]||'text-gray-400'}">${escHtml(b.package_tier||'')}</span></td>
      <td>${statusBadge[b.build_status] || `<span class="badge badge-new">${b.build_status}</span>`}</td>
      <td>${outreachBadge[b.outreach_status] || '<span class="text-gray-500 text-xs">—</span>'}</td>
      <td>${b.preview_url
        ? `<a href="${escHtml(b.preview_url)}" target="_blank" class="text-pink-400 hover:text-pink-300 text-xs font-semibold"><i class="fas fa-external-link-alt mr-1"></i>View</a>`
        : '<span class="text-gray-600 text-xs">—</span>'}</td>
      <td><span class="text-gray-500 text-xs">${timeAgo(b.created_at)}</span></td>
      <td>
        <div class="flex items-center gap-1.5">
          <button onclick="viewBuildDetail(${b.id})" class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700" title="View Detail"><i class="fas fa-eye"></i></button>
          ${b.build_status === 'generated' && b.outreach_status === 'pending'
            ? `<button onclick="triggerOutreach(${b.id})" class="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-gray-700" title="Send Outreach"><i class="fas fa-paper-plane"></i></button>`
            : ''}
          <button onclick="openPromptPreview(${b.id})" class="text-xs text-gray-400 hover:text-yellow-300 px-2 py-1 rounded hover:bg-gray-700" title="View Prompt"><i class="fas fa-code"></i></button>
        </div>
      </td>
    </tr>
  `).join('')
}

function filterBuilds(status) {
  loadBuildsTable(status)
}

// ── Single Build Modal ────────────────────────────────────────────────────────
async function openSingleBuildModal() {
  // Load eligible leads (no website)
  const leads = await api('GET', '/leads?limit=200')
  const eligible = (leads.leads || leads || []).filter(l =>
    !l.has_website && !['won','not_interested','already_has_website','do_not_contact'].includes(l.status)
  )

  const opts = eligible.map(l =>
    `<option value="${l.id}">${escHtml(l.business_name)} — ${escHtml(l.city||'')} (${escHtml(l.industry||'')})</option>`
  ).join('')

  const html = `
    <div id="single-build-modal" class="modal-overlay">
      <div class="modal-box w-full max-w-lg">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-white text-lg flex items-center gap-2"><i class="fas fa-magic text-pink-400"></i>Build Website for Lead</h3>
          <button onclick="closeModal('single-build-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="form-label">Select Lead *</label>
            <select id="build-lead-select" class="form-input w-full" onchange="previewBuildPrompt(this.value)">
              <option value="">Choose a lead without a website…</option>
              ${opts}
            </select>
            <p class="text-xs text-gray-600 mt-1">Only showing leads without existing websites (${eligible.length} eligible)</p>
          </div>
          <div>
            <label class="form-label">Package Tier</label>
            <select id="build-pkg-select" class="form-input w-full" onchange="previewBuildPrompt(document.getElementById('build-lead-select').value)">
              <option value="Basic">Basic ($500–$800) — 5-page site</option>
              <option value="Professional" selected>Professional ($1,200–$2,000) — 8 pages + full SEO</option>
              <option value="Premium">Premium ($2,500–$3,500) — Full site + member portal + ongoing SEO</option>
            </select>
          </div>
          <div class="flex items-center justify-between py-2 border border-gray-800 rounded-xl px-3">
            <div>
              <p class="text-sm text-white font-medium">Auto-send outreach after build</p>
              <p class="text-xs text-gray-500">Email + SMS sent with preview link & proposal</p>
            </div>
            <input type="checkbox" id="build-auto-outreach" checked class="w-4 h-4 accent-pink-500"/>
          </div>
          <div id="build-prompt-preview-box" class="hidden">
            <label class="form-label">Lovable Prompt Preview</label>
            <div id="build-prompt-text" class="bg-gray-950 border border-gray-700 rounded-xl p-3 text-xs text-gray-400 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono"></div>
          </div>
          <div class="flex gap-3 justify-end pt-2">
            <button onclick="closeModal('single-build-modal')" class="btn-secondary">Cancel</button>
            <button onclick="submitSingleBuild()" class="btn-primary flex items-center gap-2"><i class="fas fa-magic"></i>Generate Website</button>
          </div>
        </div>
      </div>
    </div>`
  document.body.insertAdjacentHTML('beforeend', html)
}

async function previewBuildPrompt(leadId) {
  if (!leadId) return
  const pkg = document.getElementById('build-pkg-select')?.value || 'Professional'
  const box  = document.getElementById('build-prompt-preview-box')
  const text = document.getElementById('build-prompt-text')
  if (box) box.classList.remove('hidden')
  if (text) text.textContent = 'Loading preview…'
  try {
    const res = await api('GET', `/builder/preview-prompt/${leadId}?package=${pkg}`)
    if (text) text.textContent = res.prompt
  } catch (e) {
    if (text) text.textContent = 'Could not load preview'
  }
}

async function submitSingleBuild() {
  const leadId  = document.getElementById('build-lead-select')?.value
  const pkg     = document.getElementById('build-pkg-select')?.value || 'Professional'
  const outreach = document.getElementById('build-auto-outreach')?.checked ?? true
  if (!leadId) { showToast('Please select a lead', 'error'); return }

  const btn = document.querySelector('#single-build-modal .btn-primary')
  if (btn) { btn.innerHTML = '<span class="spinner"></span> Generating…'; btn.disabled = true }
  showToast('Sending to Lovable.app — building website…', 'info')

  try {
    const result = await api('POST', '/builder/build', {
      lead_id: parseInt(leadId),
      package_tier: pkg,
      auto_outreach: outreach,
    })
    closeModal('single-build-modal')
    showToast(`✅ Website built! ${outreach && result.outreach ? 'Outreach sent!' : 'Ready to preview.'}`, 'success')
    if (result.preview_url) {
      setTimeout(() => window.open(result.preview_url, '_blank'), 500)
    }
    renderBuilder()
  } catch(e) {
    if (btn) { btn.innerHTML = '<i class="fas fa-magic"></i>Generate Website'; btn.disabled = false }
  }
}

// ── Bulk Build Modal ──────────────────────────────────────────────────────────
function openBulkBuildModal() {
  const html = `
    <div id="bulk-build-modal" class="modal-overlay">
      <div class="modal-box w-full max-w-md">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-white text-lg flex items-center gap-2"><i class="fas fa-layer-group text-pink-400"></i>Bulk Build Websites</h3>
          <button onclick="closeModal('bulk-build-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
        </div>
        <div class="space-y-4">
          <div class="p-3 bg-yellow-900/20 border border-yellow-700/40 rounded-xl text-xs text-yellow-400">
            <i class="fas fa-exclamation-triangle mr-1"></i>
            Bulk build queues websites for all eligible leads with no website. Each build consumes 1 Lovable API call.
          </div>
          <div>
            <label class="form-label">Max Builds to Queue</label>
            <select id="bulk-limit" class="form-input w-full">
              <option value="5">5 websites</option>
              <option value="10" selected>10 websites</option>
              <option value="25">25 websites</option>
              <option value="50">50 websites</option>
            </select>
          </div>
          <div>
            <label class="form-label">Package Tier for All</label>
            <select id="bulk-pkg" class="form-input w-full">
              <option value="Basic">Basic ($500–$800)</option>
              <option value="Professional" selected>Professional ($1,200–$2,000)</option>
              <option value="Premium">Premium ($2,500–$3,500)</option>
            </select>
          </div>
          <div class="flex gap-3 justify-end pt-2">
            <button onclick="closeModal('bulk-build-modal')" class="btn-secondary">Cancel</button>
            <button onclick="submitBulkBuild()" class="btn-primary flex items-center gap-2"><i class="fas fa-layer-group"></i>Queue Builds</button>
          </div>
        </div>
      </div>
    </div>`
  document.body.insertAdjacentHTML('beforeend', html)
}

async function submitBulkBuild() {
  const limit = parseInt(document.getElementById('bulk-limit')?.value || '10')
  const pkg   = document.getElementById('bulk-pkg')?.value || 'Professional'
  try {
    const result = await api('POST', '/builder/bulk-build', { limit, package_tier: pkg })
    closeModal('bulk-build-modal')
    showToast(`✅ Queued ${result.queued_count} website builds!`, 'success')
    renderBuilder()
  } catch(e) { /* shown by api() */ }
}

// ── Builder Settings Modal ────────────────────────────────────────────────────
async function openBuilderSettingsModal() {
  const cfg = builderConfig
  const html = `
    <div id="builder-settings-modal" class="modal-overlay">
      <div class="modal-box w-full max-w-2xl">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-white text-lg flex items-center gap-2"><i class="fas fa-cog text-pink-400"></i>Website Builder Settings</h3>
          <button onclick="closeModal('builder-settings-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

          <!-- Contact Info -->
          <div class="space-y-3">
            <h4 class="text-sm font-bold text-white border-b border-gray-800 pb-2"><i class="fas fa-user mr-2 text-pink-400"></i>Your Contact Info (appears in outreach)</h4>
            <div>
              <label class="form-label">Your Name</label>
              <input id="bcfg-owner-name" type="text" class="form-input w-full" value="${escHtml(cfg.owner_name||'Eric Developing Thompson')}"/>
            </div>
            <div>
              <label class="form-label">Your Phone</label>
              <input id="bcfg-owner-phone" type="text" class="form-input w-full" value="${escHtml(cfg.owner_phone||'(985)860-7891')}"/>
            </div>
            <div>
              <label class="form-label">Your Email</label>
              <input id="bcfg-owner-email" type="email" class="form-input w-full" value="${escHtml(cfg.owner_email||'e.w.Thompson10.10@gmail.com')}"/>
            </div>
            <div>
              <label class="form-label">Default Package</label>
              <select id="bcfg-default-pkg" class="form-input w-full">
                ${['Basic','Professional','Premium'].map(p=>`<option value="${p}" ${cfg.default_package===p?'selected':''}>${p}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- API Keys -->
          <div class="space-y-3">
            <h4 class="text-sm font-bold text-white border-b border-gray-800 pb-2"><i class="fas fa-key mr-2 text-yellow-400"></i>API Keys</h4>
            <div>
              <label class="form-label">Lovable.app API Key</label>
              <input id="bcfg-lovable" type="password" class="form-input w-full text-xs" value="${escHtml(cfg.lovable_api_key||'')}" placeholder="lov_…"/>
              <p class="text-xs text-gray-600 mt-1"><a href="https://lovable.app" target="_blank" class="text-blue-500">Get at lovable.app</a> — required to auto-generate sites</p>
            </div>
            <div>
              <label class="form-label">SendGrid API Key (email outreach)</label>
              <input id="bcfg-sendgrid" type="password" class="form-input w-full text-xs" value="${escHtml(cfg.sendgrid_api_key||'')}" placeholder="SG.…"/>
              <p class="text-xs text-gray-600 mt-1"><a href="https://sendgrid.com" target="_blank" class="text-blue-500">sendgrid.com</a> — free 100 emails/day</p>
            </div>
            <div>
              <label class="form-label">Twilio Account SID (SMS)</label>
              <input id="bcfg-twilio-sid" type="password" class="form-input w-full text-xs" value="${escHtml(cfg.twilio_account_sid||'')}" placeholder="AC…"/>
            </div>
            <div>
              <label class="form-label">Twilio Auth Token</label>
              <input id="bcfg-twilio-token" type="password" class="form-input w-full text-xs" value="${escHtml(cfg.twilio_auth_token||'')}" placeholder="…"/>
            </div>
            <div>
              <label class="form-label">Twilio From Number</label>
              <input id="bcfg-twilio-from" type="text" class="form-input w-full text-xs" value="${escHtml(cfg.twilio_from_number||'')}" placeholder="+19855551234"/>
              <p class="text-xs text-gray-600 mt-1"><a href="https://twilio.com" target="_blank" class="text-blue-500">twilio.com</a> — ~$0.008/SMS, $15 trial credit</p>
            </div>
          </div>
        </div>

        <!-- Automation Toggles -->
        <div class="border-t border-gray-800 pt-4 mt-4 grid grid-cols-2 gap-4">
          <div class="flex items-center justify-between py-2 border border-gray-800 rounded-xl px-3">
            <div>
              <p class="text-sm text-white font-medium">Auto-build on discover</p>
              <p class="text-xs text-gray-500">Build sites for every new prospector lead</p>
            </div>
            <button onclick="toggleBuilderSetting('auto_build_on_discover', this)" class="relative w-11 h-6 rounded-full transition-colors ${cfg.auto_build_on_discover!=='0'?'bg-pink-600':'bg-gray-700'}">
              <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${cfg.auto_build_on_discover!=='0'?'translate-x-5':'translate-x-0'}"></span>
            </button>
          </div>
          <div class="flex items-center justify-between py-2 border border-gray-800 rounded-xl px-3">
            <div>
              <p class="text-sm text-white font-medium">Auto-send outreach</p>
              <p class="text-xs text-gray-500">Email + SMS after each build</p>
            </div>
            <button onclick="toggleBuilderSetting('auto_outreach', this)" class="relative w-11 h-6 rounded-full transition-colors ${cfg.auto_outreach!=='0'?'bg-pink-600':'bg-gray-700'}">
              <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${cfg.auto_outreach!=='0'?'translate-x-5':'translate-x-0'}"></span>
            </button>
          </div>
        </div>

        <div class="flex gap-3 justify-end pt-4 border-t border-gray-800 mt-4">
          <button onclick="closeModal('builder-settings-modal')" class="btn-secondary">Cancel</button>
          <button onclick="saveBuilderSettings()" class="btn-primary"><i class="fas fa-save mr-1"></i>Save Settings</button>
        </div>
      </div>
    </div>`
  document.body.insertAdjacentHTML('beforeend', html)
}

async function saveBuilderSettings() {
  const payload = {
    owner_name:           document.getElementById('bcfg-owner-name')?.value,
    owner_phone:          document.getElementById('bcfg-owner-phone')?.value,
    owner_email:          document.getElementById('bcfg-owner-email')?.value,
    default_package:      document.getElementById('bcfg-default-pkg')?.value,
    lovable_api_key:      document.getElementById('bcfg-lovable')?.value,
    sendgrid_api_key:     document.getElementById('bcfg-sendgrid')?.value,
    twilio_account_sid:   document.getElementById('bcfg-twilio-sid')?.value,
    twilio_auth_token:    document.getElementById('bcfg-twilio-token')?.value,
    twilio_from_number:   document.getElementById('bcfg-twilio-from')?.value,
  }
  await api('PUT', '/builder/config', payload)
  showToast('Builder settings saved ✓', 'success')
  closeModal('builder-settings-modal')
  renderBuilder()
}

async function toggleBuilderSetting(key, btn) {
  const isOn = btn.classList.contains('bg-pink-600')
  const newVal = isOn ? '0' : '1'
  await api('PUT', '/builder/config', { [key]: newVal })
  btn.classList.toggle('bg-pink-600', !isOn)
  btn.classList.toggle('bg-gray-700', isOn)
  const knob = btn.querySelector('span')
  if (knob) { knob.classList.toggle('translate-x-5', !isOn); knob.classList.toggle('translate-x-0', isOn) }
  showToast('Setting updated ✓', 'success')
}

// ── View Build Detail ─────────────────────────────────────────────────────────
async function viewBuildDetail(buildId) {
  const data = await api('GET', `/builder/builds/${buildId}`)
  const b = data.build || data
  const logs = data.outreach_log || []

  const html = `
    <div id="build-detail-modal" class="modal-overlay">
      <div class="modal-box w-full max-w-3xl">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-white text-lg flex items-center gap-2"><i class="fas fa-globe text-pink-400"></i>${escHtml(b.business_name)}</h3>
          <button onclick="closeModal('build-detail-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <!-- Info -->
          <div class="space-y-3">
            <div class="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-2 text-sm">
              <div class="flex justify-between"><span class="text-gray-500">Industry</span><span class="text-white">${escHtml(b.industry||'—')}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">City</span><span class="text-white">${escHtml(b.city||'—')}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Package</span><span class="font-bold text-pink-400">${escHtml(b.package_tier||'—')}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Build Status</span><span class="font-bold ${b.build_status==='generated'?'text-green-400':b.build_status==='failed'?'text-red-400':'text-yellow-400'}">${escHtml(b.build_status||'—')}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Outreach</span><span class="font-bold text-blue-400">${escHtml(b.outreach_status||'—')}</span></div>
              ${b.phone ? `<div class="flex justify-between"><span class="text-gray-500">Phone</span><span class="text-white">${escHtml(b.lead_phone||b.phone||'—')}</span></div>` : ''}
              ${b.email ? `<div class="flex justify-between"><span class="text-gray-500">Email</span><span class="text-white text-xs">${escHtml(b.lead_email||b.email||'—')}</span></div>` : ''}
              <div class="flex justify-between"><span class="text-gray-500">Created</span><span class="text-gray-400 text-xs">${timeAgo(b.created_at)}</span></div>
            </div>
            ${b.preview_url ? `
              <a href="${escHtml(b.preview_url)}" target="_blank" class="btn-primary w-full justify-center flex items-center gap-2 text-sm">
                <i class="fas fa-external-link-alt"></i>Open Website Preview
              </a>` : ''}
            ${b.build_status==='generated' && b.outreach_status==='pending' ? `
              <button onclick="triggerOutreach(${b.id})" class="btn-secondary w-full justify-center flex items-center gap-2 text-sm">
                <i class="fas fa-paper-plane text-blue-400"></i>Send Outreach Now
              </button>` : ''}
            ${b.error_message ? `<div class="p-3 bg-red-900/20 border border-red-700/40 rounded-xl text-xs text-red-400"><i class="fas fa-exclamation-circle mr-1"></i>${escHtml(b.error_message)}</div>` : ''}
          </div>
          <!-- Outreach Log + Prompt -->
          <div class="space-y-3">
            <div>
              <h4 class="text-sm font-bold text-white mb-2">Outreach History (${logs.length})</h4>
              ${logs.length ? logs.map(l => `
                <div class="flex items-start gap-2 p-2 bg-gray-900 rounded-lg mb-2">
                  <i class="fas fa-${l.channel==='email'?'envelope':'sms'} text-${l.channel==='email'?'blue':'green'}-400 mt-0.5 flex-shrink-0 text-xs"></i>
                  <div class="min-w-0">
                    <p class="text-xs text-white font-semibold">${escHtml(l.channel.toUpperCase())} → ${escHtml(l.recipient)}</p>
                    <p class="text-xs text-gray-500">${l.status} · ${timeAgo(l.sent_at)}</p>
                  </div>
                </div>`).join('') : '<p class="text-xs text-gray-600">No outreach sent yet</p>'}
            </div>
            ${b.lovable_prompt ? `
              <div>
                <h4 class="text-sm font-bold text-white mb-2">Lovable Prompt</h4>
                <div class="bg-gray-950 border border-gray-700 rounded-xl p-3 text-xs text-gray-400 max-h-52 overflow-y-auto whitespace-pre-wrap font-mono">${escHtml(b.lovable_prompt)}</div>
              </div>` : ''}
          </div>
        </div>
        <div class="flex gap-3 justify-end pt-4 border-t border-gray-800 mt-4">
          <button onclick="closeModal('build-detail-modal')" class="btn-secondary">Close</button>
        </div>
      </div>
    </div>`
  document.body.insertAdjacentHTML('beforeend', html)
}

async function openPromptPreview(buildId) {
  const b = builderBuilds.find(b => b.id === buildId)
  if (!b?.lovable_prompt) { showToast('No prompt available', 'error'); return }
  const html = `
    <div id="prompt-preview-modal" class="modal-overlay">
      <div class="modal-box w-full max-w-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-white">Lovable Prompt — ${escHtml(b.business_name)}</h3>
          <button onclick="closeModal('prompt-preview-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
        </div>
        <div class="bg-gray-950 border border-gray-700 rounded-xl p-4 text-xs text-gray-300 max-h-[60vh] overflow-y-auto whitespace-pre-wrap font-mono">${escHtml(b.lovable_prompt)}</div>
        <div class="flex gap-3 justify-end pt-4">
          <button onclick="navigator.clipboard.writeText(${JSON.stringify(b.lovable_prompt)}).then(()=>showToast('Copied!','success'))" class="btn-secondary"><i class="fas fa-copy mr-1"></i>Copy Prompt</button>
          <button onclick="closeModal('prompt-preview-modal')" class="btn-primary">Close</button>
        </div>
      </div>
    </div>`
  document.body.insertAdjacentHTML('beforeend', html)
}

async function triggerOutreach(buildId) {
  showToast('Sending outreach…', 'info')
  try {
    await api('POST', `/builder/outreach/${buildId}`, {})
    showToast('✅ Outreach sent!', 'success')
    renderBuilder()
  } catch(e) { /* shown */ }
}

// ===================================================
// ===== WEBSITE BUILDER =====
// ===================================================

let builderCfg = {}
let builderStats = {}
let builderActiveTab = 'builds'

async function renderBuilder() {
  setContent(`<div class="flex items-center justify-center h-48"><div class="spinner"></div></div>`)
  const [stats, cfg] = await Promise.all([
    api('GET', '/builder/stats'),
    api('GET', '/builder/config'),
  ])
  builderStats = stats
  builderCfg = cfg

  // update nav badge
  const pending = (stats.build_stats || []).find(s => s.build_status === 'queued')?.count || 0
  const badge = document.getElementById('nav-builder-count')
  if (badge) { badge.textContent = pending; badge.classList.toggle('hidden', !pending) }

  const buildCount  = (s, k) => (s.build_stats  || []).find(x => x.build_status   === k)?.count || 0
  const outCount    = (s, k) => (s.outreach_stats|| []).find(x => x.outreach_status === k)?.count || 0
  const resCount    = (s, k) => (s.research_stats|| []).find(x => x.research_status === k)?.count || 0

  setContent(`
  <div class="space-y-5 max-w-7xl">

    <!-- Hero Banner -->
    <div class="bg-gradient-to-r from-pink-900/40 via-purple-900/30 to-indigo-900/40 border border-pink-700/40 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/30 to-purple-600/30 flex items-center justify-center flex-shrink-0 border border-pink-500/30">
          <i class="fas fa-magic text-pink-400 text-2xl"></i>
        </div>
        <div>
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            AI Website Builder
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-pink-900/50 text-pink-400 border border-pink-700 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse"></span>POWERED BY AI
            </span>
          </h2>
          <p class="text-gray-400 text-sm mt-0.5">Deep-researches each business → Builds a stunning site → Sends personalized outreach automatically</p>
        </div>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <button onclick="openBuilderLeadPicker()" class="btn-primary flex items-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 border-0">
          <i class="fas fa-plus"></i> Build Site for Lead
        </button>
        <button onclick="runBulkResearch()" class="bg-indigo-900/40 text-indigo-400 border border-indigo-700 hover:bg-indigo-900/60 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2">
          <i class="fas fa-brain"></i> Bulk Research
        </button>
      </div>
    </div>

    <!-- KPI Row -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
      ${builderKpi('Websites Built', stats.total_builds || 0, 'globe', 'pink')}
      ${builderKpi('Researched', stats.total_researched || 0, 'brain', 'purple')}
      ${builderKpi('Outreach Sent', stats.total_outreach || 0, 'paper-plane', 'blue')}
      ${builderKpi('Converted', outCount(stats,'converted'), 'trophy', 'green')}
      ${builderKpi('Awaiting Reply', outCount(stats,'sent'), 'clock', 'orange')}
    </div>

    <!-- Pipeline flow -->
    <div class="grid grid-cols-4 gap-2">
      ${builderPipelineStep('1','Deep Research','fas fa-search','Scrapes Google Maps, reviews, competitors & feeds all data to AI','indigo', resCount(stats,'completed'))}
      ${builderPipelineStep('2','AI Analysis','fas fa-brain','GPT-4 studies the business, writes copy, designs color palette & picks package','purple', stats.total_researched || 0)}
      ${builderPipelineStep('3','Site Generated','fas fa-magic','Lovable.dev builds a stunning custom site in seconds using all research data','pink', buildCount(stats,'generated') + buildCount(stats,'published'))}
      ${builderPipelineStep('4','Auto-Outreach','fas fa-paper-plane','Personalized email + SMS sent immediately with preview link & proposal','green', outCount(stats,'sent') + outCount(stats,'converted'))}
    </div>

    <!-- Main tabs + content -->
    <div class="card p-0 overflow-hidden">
      <div class="flex border-b border-gray-800">
        ${['builds','research','outreach','settings'].map(t => `
          <button onclick="switchBuilderTab('${t}')" id="btab-${t}"
            class="px-5 py-3 text-sm font-semibold transition-all border-b-2 ${builderActiveTab===t ? 'border-pink-500 text-pink-400 bg-pink-900/10' : 'border-transparent text-gray-500 hover:text-gray-300'}">
            <i class="fas fa-${t==='builds'?'globe':t==='research'?'brain':t==='outreach'?'paper-plane':'cog'} mr-2"></i>
            ${t.charAt(0).toUpperCase()+t.slice(1)}
          </button>`).join('')}
      </div>
      <div id="builder-tab-content" class="p-4">
        ${builderActiveTab === 'builds'   ? renderBuilderBuildsTab(stats)   :
          builderActiveTab === 'research' ? renderBuilderResearchTab(stats)  :
          builderActiveTab === 'outreach' ? renderBuilderOutreachTab(stats)  :
          renderBuilderSettingsTab(cfg)}
      </div>
    </div>

  </div>

  <!-- Lead Picker Modal -->
  <div id="builder-lead-modal" class="modal-overlay hidden">
    <div class="modal-box w-full max-w-2xl">
      <div class="flex items-center justify-between mb-5">
        <h3 class="font-bold text-white text-lg flex items-center gap-2"><i class="fas fa-magic text-pink-400"></i> Build Website for Lead</h3>
        <button onclick="closeModal('builder-lead-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="form-label">Select Lead</label>
          <input id="blm-search" type="text" class="form-input w-full" placeholder="Search business name..." oninput="filterBuilderLeads(this.value)"/>
        </div>
        <div id="blm-lead-list" class="space-y-2 max-h-72 overflow-y-auto pr-1">
          <div class="text-center py-6 text-gray-600"><div class="spinner mx-auto"></div></div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="form-label">Package</label>
            <select id="blm-package" class="form-input w-full">
              <option value="Basic">Basic ($500-$800)</option>
              <option value="Professional" selected>Professional ($1,200-$2,000)</option>
              <option value="Premium">Premium ($2,500-$3,500)</option>
            </select>
          </div>
          <div class="flex items-end">
            <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer pb-2">
              <input type="checkbox" id="blm-skip-research" class="accent-pink-500"/>
              Skip Research
            </label>
          </div>
          <div class="flex items-end">
            <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer pb-2">
              <input type="checkbox" id="blm-auto-outreach" checked class="accent-pink-500"/>
              Auto Outreach
            </label>
          </div>
        </div>
        <div id="blm-selected-lead" class="hidden bg-gray-800/60 border border-gray-700 rounded-xl p-3">
          <p class="text-xs text-gray-500 mb-1">Selected lead:</p>
          <p id="blm-selected-name" class="text-white font-semibold"></p>
          <p id="blm-selected-info" class="text-xs text-gray-400 mt-0.5"></p>
        </div>
        <div class="flex gap-3 justify-end pt-2 border-t border-gray-800">
          <button onclick="closeModal('builder-lead-modal')" class="btn-secondary">Cancel</button>
          <button onclick="startBuildFromModal()" id="blm-build-btn" class="btn-primary bg-gradient-to-r from-pink-600 to-purple-600 border-0 flex items-center gap-2" disabled>
            <i class="fas fa-magic"></i> Research & Build
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Build Detail Modal -->
  <div id="build-detail-modal" class="modal-overlay hidden">
    <div class="modal-box w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-5">
        <h3 id="bdm-title" class="font-bold text-white text-lg"></h3>
        <button onclick="closeModal('build-detail-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
      </div>
      <div id="bdm-content"></div>
    </div>
  </div>

  <!-- Research Detail Modal -->
  <div id="research-detail-modal" class="modal-overlay hidden">
    <div class="modal-box w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-5">
        <h3 id="rdm-title" class="font-bold text-white text-lg flex items-center gap-2"><i class="fas fa-brain text-purple-400"></i> Research Report</h3>
        <button onclick="closeModal('research-detail-modal')" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
      </div>
      <div id="rdm-content"></div>
    </div>
  </div>
  `)
}

// ── Tab switch ────────────────────────────────────────────────────────────────
function switchBuilderTab(tab) {
  builderActiveTab = tab
  renderBuilder()
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function builderKpi(label, value, icon, color) {
  const c = { pink:'text-pink-400 bg-pink-900/30', purple:'text-purple-400 bg-purple-900/30', blue:'text-blue-400 bg-blue-900/30', green:'text-green-400 bg-green-900/30', orange:'text-orange-400 bg-orange-900/30' }
  const [tc, bc] = (c[color]||'text-gray-400 bg-gray-800').split(' ')
  return `<div class="stat-card flex items-center gap-3">
    <div class="w-10 h-10 rounded-xl ${bc} flex items-center justify-center flex-shrink-0"><i class="fas fa-${icon} ${tc}"></i></div>
    <div><p class="text-xs text-gray-500 font-semibold uppercase tracking-wide">${label}</p><p class="text-2xl font-bold text-white">${value}</p></div>
  </div>`
}

// ── Pipeline step ─────────────────────────────────────────────────────────────
function builderPipelineStep(n, title, icon, desc, color, count) {
  const colors = { indigo:'border-indigo-700/40 bg-indigo-900/20 text-indigo-400', purple:'border-purple-700/40 bg-purple-900/20 text-purple-400', pink:'border-pink-700/40 bg-pink-900/20 text-pink-400', green:'border-green-700/40 bg-green-900/20 text-green-400' }
  const cls = colors[color] || colors.indigo
  return `<div class="border ${cls} rounded-xl p-3 text-center">
    <div class="w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2 bg-gray-900/60"><i class="${icon} text-sm"></i></div>
    <p class="text-xs font-bold text-white">${n}. ${title}</p>
    <p class="text-xs text-gray-500 mt-1 leading-relaxed">${desc}</p>
    <p class="text-lg font-bold text-white mt-2">${count}</p>
    <p class="text-xs text-gray-600">completed</p>
  </div>`
}

// ── BUILDS TAB ────────────────────────────────────────────────────────────────
function renderBuilderBuildsTab(stats) {
  const builds = stats.recent_builds || []
  if (!builds.length) return `
    <div class="text-center py-16">
      <div class="w-16 h-16 rounded-2xl bg-pink-900/20 border border-pink-700/30 flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-magic text-pink-400 text-2xl"></i>
      </div>
      <h3 class="text-lg font-bold text-white mb-2">No websites built yet</h3>
      <p class="text-gray-500 text-sm mb-5">Click "Build Site for Lead" to create your first AI-powered website demo</p>
      <button onclick="openBuilderLeadPicker()" class="btn-primary bg-gradient-to-r from-pink-600 to-purple-600 border-0">
        <i class="fas fa-magic mr-2"></i> Build First Site
      </button>
    </div>`

  return `
    <div class="overflow-x-auto">
      <table class="data-table text-xs">
        <thead>
          <tr>
            <th>Business</th>
            <th>Package</th>
            <th>Research</th>
            <th>Build Status</th>
            <th>Outreach</th>
            <th>Preview</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${builds.map(b => {
            const conf = b.confidence_score || 0
            const confColor = conf >= 80 ? 'text-green-400' : conf >= 50 ? 'text-yellow-400' : 'text-orange-400'
            const buildStatusColors = { queued:'badge-new', researching:'badge-pending', generating:'badge-pending', generated:'badge-demo_sent', published:'badge-won', failed:'badge-lost', cancelled:'badge-lost' }
            const outColors = { pending:'badge-new', sent:'badge-demo_sent', opened:'badge-proposal_sent', replied:'badge-active', converted:'badge-won' }
            return `<tr>
              <td>
                <div>
                  <p class="font-semibold text-white">${escHtml(b.business_name)}</p>
                  <p class="text-gray-500">${escHtml(b.city||'')} · ${escHtml(b.industry||'')}</p>
                  ${b.hero_headline ? `<p class="text-xs text-purple-400 italic mt-0.5 truncate max-w-[200px]">"${escHtml(b.hero_headline)}"</p>` : ''}
                </div>
              </td>
              <td><span class="font-semibold ${b.package_tier==='Premium'?'text-yellow-400':b.package_tier==='Professional'?'text-blue-400':'text-green-400'}">${escHtml(b.package_tier||'')}</span></td>
              <td>
                ${conf ? `<span class="font-bold ${confColor}">${conf}%</span><span class="text-gray-600 ml-1">conf.</span>` : '<span class="text-gray-600">No research</span>'}
                ${b.market_demand_score ? `<br><span class="text-xs text-gray-500">Demand: ${b.market_demand_score}/100</span>` : ''}
              </td>
              <td><span class="badge ${buildStatusColors[b.build_status]||'badge-new'}">${(b.build_status||'').replace(/_/g,' ')}</span></td>
              <td><span class="badge ${outColors[b.outreach_status]||'badge-new'}">${(b.outreach_status||'pending').replace(/_/g,' ')}</span></td>
              <td>
                ${b.preview_url ? `<a href="${escHtml(b.preview_url)}" target="_blank" class="text-pink-400 hover:text-pink-300 text-xs flex items-center gap-1"><i class="fas fa-external-link-alt"></i> View</a>` : '<span class="text-gray-600">—</span>'}
              </td>
              <td><span class="text-gray-500">${timeAgo(b.created_at)}</span></td>
              <td>
                <div class="flex items-center gap-1">
                  <button onclick="viewBuildDetail(${b.id})" class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800 hover:bg-gray-700" title="View Details"><i class="fas fa-eye"></i></button>
                  ${!b.outreach_email_sent && !b.outreach_sms_sent ? `<button onclick="triggerOutreach(${b.id})" class="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-900/30 hover:bg-blue-900/50" title="Send Outreach"><i class="fas fa-paper-plane"></i></button>` : ''}
                  ${b.research_id ? `<button onclick="viewResearch(${b.research_id})" class="text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded bg-purple-900/30 hover:bg-purple-900/50" title="View Research"><i class="fas fa-brain"></i></button>` : ''}
                </div>
              </td>
            </tr>`}).join('')}
        </tbody>
      </table>
    </div>`
}

// ── RESEARCH TAB ──────────────────────────────────────────────────────────────
function renderBuilderResearchTab(stats) {
  return `
    <div class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- What deep research does -->
        <div class="md:col-span-2 bg-gradient-to-br from-indigo-900/20 to-purple-900/10 border border-indigo-700/30 rounded-xl p-4">
          <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-brain text-purple-400"></i>What Deep Research Does</h3>
          <div class="grid grid-cols-2 gap-3 text-xs">
            ${[
              ['fas fa-map-marker-alt text-red-400',    'Google Places Full Data',    'Rating, reviews, hours, photos, phone, address, price level, business types'],
              ['fas fa-star text-yellow-400',           'Real Customer Reviews',       'Top 5 reviews analyzed for themes, sentiment & testimonials to embed in site'],
              ['fas fa-users text-blue-400',            'Competitor Landscape',        'Scans 3km radius for up to 8 competitors — finds the gap your client can fill'],
              ['fas fa-robot text-green-400',           'GPT-4 Business Analysis',    'AI writes hero copy, about us, service descriptions, picks colors & brand tone'],
              ['fas fa-palette text-pink-400',          'Custom Color Palette',        'Industry-appropriate brand colors generated from competitor & style research'],
              ['fas fa-chart-line text-orange-400',     'Market Demand Score',         '0–100 demand score based on reviews, competitor density & local search data'],
              ['fas fa-bullseye text-purple-400',       'Target Customer Profile',     'Identifies exactly who their customers are so the site speaks directly to them'],
              ['fas fa-lightbulb text-cyan-400',        'Pain Point Discovery',        'Finds the exact reasons this business NEEDS a website right now'],
            ].map(([ic,title,desc]) => `
              <div class="flex gap-2">
                <i class="${ic} mt-0.5 flex-shrink-0 w-4"></i>
                <div><p class="font-semibold text-white">${title}</p><p class="text-gray-500 leading-relaxed">${desc}</p></div>
              </div>`).join('')}
          </div>
        </div>
        <!-- Quick research trigger -->
        <div class="bg-gray-900/60 border border-gray-700 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <h3 class="font-bold text-white mb-2">Research a Lead</h3>
            <p class="text-xs text-gray-500 mb-3">Run deep research on a specific lead without building a site yet.</p>
            <div class="space-y-2">
              <input id="research-lead-search" type="text" class="form-input w-full text-sm" placeholder="Search lead name..." oninput="filterResearchLeads(this.value)"/>
              <div id="research-lead-results" class="space-y-1 max-h-40 overflow-y-auto"></div>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-800">
            <button onclick="runBulkResearch()" class="btn-secondary w-full justify-center text-sm">
              <i class="fas fa-layer-group mr-1 text-purple-400"></i> Bulk Research (5 Leads)
            </button>
          </div>
        </div>
      </div>

      <!-- Research quality guide -->
      <div class="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
        <h3 class="font-bold text-white text-sm mb-3 flex items-center gap-2"><i class="fas fa-shield-alt text-green-400"></i>Research Confidence Score Guide</h3>
        <div class="grid grid-cols-4 gap-3 text-xs text-center">
          ${[['95%+','Google + AI','Full data, AI-generated copy, competitors','text-green-400'],
             ['70-94%','Google Only','Full Places data, no AI copy','text-yellow-400'],
             ['40-69%','AI Only','AI analysis, no Places data','text-orange-400'],
             ['<40%','Basic','Fallback templates only','text-red-400'],
          ].map(([score,sources,desc,color]) => `
            <div class="bg-gray-800/60 rounded-lg p-3">
              <p class="text-lg font-bold ${color}">${score}</p>
              <p class="font-semibold text-white mt-1">${sources}</p>
              <p class="text-gray-500 mt-1">${desc}</p>
            </div>`).join('')}
        </div>
      </div>
    </div>`
}

// ── OUTREACH TAB ──────────────────────────────────────────────────────────────
function renderBuilderOutreachTab(stats) {
  const builds = (stats.recent_builds || []).filter(b => b.outreach_status !== 'pending')
  return `
    <div class="space-y-4">
      <div class="grid grid-cols-4 gap-3 text-center">
        ${[['Sent','sent','paper-plane','blue'],['Opened','opened','eye','purple'],['Replied','replied','reply','yellow'],['Converted','converted','trophy','green']].map(([label,key,icon,c])=>{
          const cnt = (stats.outreach_stats||[]).find(x=>x.outreach_status===key)?.count||0
          const colors={blue:'text-blue-400 bg-blue-900/20 border-blue-700/40',purple:'text-purple-400 bg-purple-900/20 border-purple-700/40',yellow:'text-yellow-400 bg-yellow-900/20 border-yellow-700/40',green:'text-green-400 bg-green-900/20 border-green-700/40'}
          return `<div class="border ${colors[c]} rounded-xl p-3"><i class="fas fa-${icon} text-lg mb-1 block"></i><p class="text-2xl font-bold text-white">${cnt}</p><p class="text-xs text-gray-500">${label}</p></div>`
        }).join('')}
      </div>

      <!-- Outreach message preview -->
      <div class="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
        <h3 class="font-bold text-white text-sm mb-3 flex items-center gap-2"><i class="fas fa-envelope text-blue-400"></i>Sample Email Template (Personalized Per Business)</h3>
        <div class="bg-gray-950 rounded-lg p-3 text-xs text-gray-300 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto font-mono">Hi [Owner First Name],

My name is Eric Thompson, and I'm a local web developer in the [City] area.

I noticed [Business Name] doesn't have a website yet — so I built you a FREE demo:
👉 [PREVIEW LINK — unique per business]

✅ Custom design for your business  ✅ Real phone/address/services
✅ Click-to-call button             ✅ Google Maps embedded
✅ Mobile-friendly                  ✅ Professional copywriting

Packages from $500. Call/text me: (985)860-7891
— Eric Developing Thompson</div>
      </div>

      ${builds.length ? `
      <div class="overflow-x-auto">
        <table class="data-table text-xs">
          <thead><tr><th>Business</th><th>Channel</th><th>Status</th><th>Sent</th><th>Actions</th></tr></thead>
          <tbody>
            ${builds.map(b=>`<tr>
              <td><p class="font-semibold text-white">${escHtml(b.business_name)}</p><p class="text-gray-500">${escHtml(b.industry||'')}</p></td>
              <td>
                ${b.outreach_email_sent ? '<span class="text-blue-400 text-xs mr-1"><i class="fas fa-envelope mr-1"></i>Email</span>' : ''}
                ${b.outreach_sms_sent   ? '<span class="text-green-400 text-xs"><i class="fas fa-sms mr-1"></i>SMS</span>' : ''}
              </td>
              <td><span class="badge ${b.outreach_status==='converted'?'badge-won':b.outreach_status==='replied'?'badge-proposal_sent':b.outreach_status==='opened'?'badge-demo_sent':'badge-contacted'}">${(b.outreach_status||'').replace(/_/g,' ')}</span></td>
              <td><span class="text-gray-500">${b.outreach_sent_at ? timeAgo(b.outreach_sent_at) : '—'}</span></td>
              <td>
                <button onclick="updateOutreachStatus(${b.id})" class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800 hover:bg-gray-700">Update Status</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<div class="text-center py-8 text-gray-600"><i class="fas fa-paper-plane text-2xl mb-2 block"></i>No outreach sent yet</div>'}
    </div>`
}

// ── SETTINGS TAB ──────────────────────────────────────────────────────────────
function renderBuilderSettingsTab(cfg) {
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

      <!-- Contact Info -->
      <div class="space-y-4">
        <h3 class="font-bold text-white flex items-center gap-2 text-sm"><i class="fas fa-user-circle text-pink-400"></i>Your Contact Info (Appears in all outreach)</h3>
        <div>
          <label class="form-label">Your Name</label>
          <input id="bcfg-owner-name" type="text" class="form-input w-full" value="${escHtml(cfg.owner_name||'Eric Developing Thompson')}"/>
        </div>
        <div>
          <label class="form-label">Your Phone</label>
          <input id="bcfg-owner-phone" type="text" class="form-input w-full" value="${escHtml(cfg.owner_phone||'(985)860-7891')}"/>
        </div>
        <div>
          <label class="form-label">Your Email</label>
          <input id="bcfg-owner-email" type="email" class="form-input w-full" value="${escHtml(cfg.owner_email||'e.w.Thompson10.10@gmail.com')}"/>
        </div>
        <div>
          <label class="form-label">Default Package Tier</label>
          <select id="bcfg-default-pkg" class="form-input w-full">
            <option value="Basic" ${cfg.default_package==='Basic'?'selected':''}>Basic ($500–$800)</option>
            <option value="Professional" ${cfg.default_package==='Professional'||!cfg.default_package?'selected':''}>Professional ($1,200–$2,000)</option>
            <option value="Premium" ${cfg.default_package==='Premium'?'selected':''}>Premium ($2,500–$3,500)</option>
          </select>
        </div>
        <button onclick="saveBuilderContactInfo()" class="btn-primary w-full justify-center"><i class="fas fa-save mr-2"></i>Save Contact Info</button>
      </div>

      <!-- API Keys -->
      <div class="space-y-4">
        <h3 class="font-bold text-white flex items-center gap-2 text-sm"><i class="fas fa-key text-yellow-400"></i>API Integrations</h3>

        <div class="bg-gray-800/60 rounded-xl p-3 space-y-3">
          <p class="text-xs font-bold text-purple-400 uppercase tracking-wide flex items-center gap-1"><i class="fas fa-brain"></i> OpenAI (GPT-4 Business Analysis)</p>
          <div class="flex gap-2">
            <input id="bcfg-openai" type="password" class="form-input flex-1 text-xs" value="${escHtml(cfg.openai_api_key||'')}" placeholder="sk-..."/>
            <button onclick="saveBuilderKey('openai_api_key','bcfg-openai')" class="btn-secondary btn-sm flex-shrink-0">Save</button>
          </div>
          <p class="text-xs text-gray-600">Powers AI copywriting & business intelligence. <a href="https://platform.openai.com/api-keys" target="_blank" class="text-blue-500">Get key →</a></p>
        </div>

        <div class="bg-gray-800/60 rounded-xl p-3 space-y-3">
          <p class="text-xs font-bold text-pink-400 uppercase tracking-wide flex items-center gap-1"><i class="fas fa-magic"></i> Lovable.dev (Website Builder)</p>
          <div class="flex gap-2">
            <input id="bcfg-lovable" type="password" class="form-input flex-1 text-xs" value="${escHtml(cfg.lovable_api_key||'')}" placeholder="lvbl_..."/>
            <button onclick="saveBuilderKey('lovable_api_key','bcfg-lovable')" class="btn-secondary btn-sm flex-shrink-0">Save</button>
          </div>
          <p class="text-xs text-gray-600">Creates the actual website. <a href="https://lovable.dev" target="_blank" class="text-blue-500">Get key →</a> (Without key: generates Lovable-ready prompts)</p>
        </div>

        <div class="bg-gray-800/60 rounded-xl p-3 space-y-3">
          <p class="text-xs font-bold text-blue-400 uppercase tracking-wide flex items-center gap-1"><i class="fas fa-envelope"></i> SendGrid (Email Outreach)</p>
          <div class="flex gap-2">
            <input id="bcfg-sendgrid" type="password" class="form-input flex-1 text-xs" value="${escHtml(cfg.sendgrid_api_key||'')}" placeholder="SG...."/>
            <button onclick="saveBuilderKey('sendgrid_api_key','bcfg-sendgrid')" class="btn-secondary btn-sm flex-shrink-0">Save</button>
          </div>
          <p class="text-xs text-gray-600">Sends outreach emails. <a href="https://sendgrid.com" target="_blank" class="text-blue-500">Free 100/day →</a></p>
        </div>

        <div class="bg-gray-800/60 rounded-xl p-3 space-y-3">
          <p class="text-xs font-bold text-green-400 uppercase tracking-wide flex items-center gap-1"><i class="fas fa-sms"></i> Twilio (SMS Outreach)</p>
          <div class="space-y-2">
            <input id="bcfg-twilio-sid"   type="text"     class="form-input w-full text-xs" value="${escHtml(cfg.twilio_account_sid||'')}"  placeholder="Account SID: ACxxx..."/>
            <input id="bcfg-twilio-token" type="password" class="form-input w-full text-xs" value="${escHtml(cfg.twilio_auth_token||'')}"   placeholder="Auth Token"/>
            <input id="bcfg-twilio-from"  type="text"     class="form-input w-full text-xs" value="${escHtml(cfg.twilio_from_number||'')}"  placeholder="From number: +19851234567"/>
            <button onclick="saveTwilio()" class="btn-secondary w-full justify-center text-xs"><i class="fas fa-save mr-1"></i>Save Twilio</button>
          </div>
          <p class="text-xs text-gray-600">Sends SMS texts. <a href="https://twilio.com" target="_blank" class="text-blue-500">Get free trial →</a></p>
        </div>
      </div>

      <!-- Automation toggles -->
      <div class="md:col-span-2 space-y-3 border-t border-gray-800 pt-4">
        <h3 class="font-bold text-white text-sm flex items-center gap-2"><i class="fas fa-robot text-green-400"></i>Automation Settings</h3>
        <div class="grid grid-cols-3 gap-3">
          ${[
            ['auto_research_on_discover','Auto-Research on Discover','When prospector finds a new lead, instantly run deep research'],
            ['auto_build_after_research','Auto-Build After Research','Automatically build site after research completes'],
            ['auto_outreach','Auto-Send Outreach','Send email + SMS the moment a site is built'],
          ].map(([key,label,desc]) => `
            <div class="flex items-start justify-between bg-gray-800/40 rounded-xl p-3 gap-3">
              <div>
                <p class="text-sm font-semibold text-white">${label}</p>
                <p class="text-xs text-gray-500 mt-0.5">${desc}</p>
              </div>
              <button onclick="toggleBuilderSetting('${key}')" class="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors mt-0.5 ${cfg[key]!=='0'?'bg-pink-600':'bg-gray-700'}">
                <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${cfg[key]!=='0'?'translate-x-5':'translate-x-0'}"></span>
              </button>
            </div>`).join('')}
        </div>
      </div>
    </div>`
}

// ── Lead picker ───────────────────────────────────────────────────────────────
let blmLeads = []
let blmSelectedLeadId = null

async function openBuilderLeadPicker() {
  blmSelectedLeadId = null
  openModal('builder-lead-modal')
  document.getElementById('blm-selected-lead').classList.add('hidden')
  document.getElementById('blm-build-btn').disabled = true
  const data = await api('GET', '/leads?limit=200')
  blmLeads = (Array.isArray(data) ? data : data.leads || []).filter(l => !l.has_website && !['won','already_has_website','do_not_contact'].includes(l.status))
  renderBlmList(blmLeads)
}

function renderBlmList(list) {
  const el = document.getElementById('blm-lead-list')
  if (!list.length) { el.innerHTML = `<p class="text-center text-gray-600 text-sm py-4">No eligible leads found</p>`; return }
  el.innerHTML = list.slice(0, 30).map(l => `
    <button onclick="selectBuilderLead(${l.id},'${escHtml(l.business_name)}','${escHtml(l.industry||'')} · ${escHtml(l.city||'')}${l.phone?' · '+escHtml(l.phone):''}')"
      class="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-all group">
      <div class="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0 group-hover:bg-pink-900/30">
        <i class="fas fa-${industryIcon(l.industry)} text-gray-500 group-hover:text-pink-400 text-xs"></i>
      </div>
      <div class="min-w-0">
        <p class="text-sm font-semibold text-white truncate">${escHtml(l.business_name)}</p>
        <p class="text-xs text-gray-500 truncate">${escHtml(l.industry||'')} · ${escHtml(l.city||'')}${l.phone ? ' · '+escHtml(l.phone) : ''}${l.email ? ' · '+escHtml(l.email) : ''}</p>
      </div>
      <span class="badge badge-${l.status} text-xs ml-auto flex-shrink-0">${l.status.replace(/_/g,' ')}</span>
    </button>`).join('')
}

function filterBuilderLeads(q) {
  const filtered = q ? blmLeads.filter(l => (l.business_name+l.city+l.industry).toLowerCase().includes(q.toLowerCase())) : blmLeads
  renderBlmList(filtered)
}

function selectBuilderLead(id, name, info) {
  blmSelectedLeadId = id
  document.getElementById('blm-selected-name').textContent = name
  document.getElementById('blm-selected-info').textContent = info
  document.getElementById('blm-selected-lead').classList.remove('hidden')
  document.getElementById('blm-build-btn').disabled = false
  document.getElementById('blm-build-btn').innerHTML = `<i class="fas fa-magic"></i> Research & Build: ${name}`
}

async function startBuildFromModal() {
  if (!blmSelectedLeadId) return
  const pkg = document.getElementById('blm-package').value
  const skipResearch = document.getElementById('blm-skip-research').checked
  const autoOutreach = document.getElementById('blm-auto-outreach').checked
  const btn = document.getElementById('blm-build-btn')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span> Researching & Building...'
  try {
    const result = await api('POST', '/builder/build', { lead_id: blmSelectedLeadId, package_tier: pkg, skip_research: skipResearch, auto_outreach: autoOutreach })
    closeModal('builder-lead-modal')
    const advMsg = result.preview_url ? `<br><a href="${result.preview_url}" target="_blank" class="text-pink-400 underline">View Preview →</a>` : ''
    showToast(`✓ Site built! Package: ${result.package}. ${autoOutreach ? 'Outreach sent.' : ''}`, 'success')
    builderActiveTab = 'builds'
    renderBuilder()
  } catch(e) {
    // error shown by api()
    btn.disabled = false
    btn.innerHTML = '<i class="fas fa-magic"></i> Research & Build'
  }
}

// ── View build detail ─────────────────────────────────────────────────────────
async function viewBuildDetail(id) {
  openModal('build-detail-modal')
  document.getElementById('bdm-content').innerHTML = '<div class="flex justify-center py-12"><div class="spinner"></div></div>'
  const { build, outreach_log } = await api('GET', `/builder/builds/${id}`)
  document.getElementById('bdm-title').innerHTML = `<i class="fas fa-magic text-pink-400 mr-2"></i>${escHtml(build.business_name)} — ${escHtml(build.package_tier)} Site`

  let servicesHtml = ''
  try { const s = JSON.parse(build.services_copy||'[]'); servicesHtml = s.map(sv=>`<li><strong>${escHtml(sv.name)}</strong>: ${escHtml(sv.description)}</li>`).join('') } catch {}

  let uspHtml = ''
  try { const u = JSON.parse(build.unique_selling_points||'[]'); uspHtml = u.map(x=>`<li>${escHtml(x)}</li>`).join('') } catch {}

  let reviewsHtml = ''
  try { const r = JSON.parse(build.google_reviews||'[]'); reviewsHtml = r.map(rv=>`<div class="bg-gray-800/60 rounded-lg p-2 text-xs"><p class="text-yellow-400">${'★'.repeat(rv.rating||5)}</p><p class="text-gray-300 mt-1 italic">"${escHtml(rv.text?.slice(0,180))}"</p><p class="text-gray-500 mt-1">— ${escHtml(rv.author||'Customer')}</p></div>`).join('') } catch {}

  document.getElementById('bdm-content').innerHTML = `
    <div class="space-y-4">

      <!-- Status + Links -->
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-gray-800/60 rounded-xl p-3 text-center">
          <p class="text-xs text-gray-500 mb-1">Build Status</p>
          <span class="badge badge-${build.build_status==='generated'||build.build_status==='published'?'won':build.build_status==='failed'?'lost':'new'}">${(build.build_status||'').replace(/_/g,' ')}</span>
        </div>
        <div class="bg-gray-800/60 rounded-xl p-3 text-center">
          <p class="text-xs text-gray-500 mb-1">Package</p>
          <p class="font-bold ${build.package_tier==='Premium'?'text-yellow-400':build.package_tier==='Professional'?'text-blue-400':'text-green-400'}">${escHtml(build.package_tier||'')}</p>
        </div>
        <div class="bg-gray-800/60 rounded-xl p-3 text-center">
          <p class="text-xs text-gray-500 mb-1">Research Confidence</p>
          <p class="font-bold ${(build.confidence_score||0)>=80?'text-green-400':(build.confidence_score||0)>=50?'text-yellow-400':'text-orange-400'}">${build.confidence_score||0}%</p>
        </div>
      </div>

      ${build.preview_url ? `
      <div class="bg-pink-900/20 border border-pink-700/40 rounded-xl p-4 flex items-center justify-between gap-3">
        <div>
          <p class="text-xs text-pink-400 font-semibold uppercase tracking-wide mb-1">Preview URL</p>
          <a href="${escHtml(build.preview_url)}" target="_blank" class="text-white hover:text-pink-300 text-sm font-semibold break-all">${escHtml(build.preview_url)}</a>
        </div>
        <a href="${escHtml(build.preview_url)}" target="_blank" class="btn-primary flex-shrink-0 bg-gradient-to-r from-pink-600 to-purple-600 border-0 text-sm">
          <i class="fas fa-external-link-alt mr-1"></i> Open Site
        </a>
      </div>` : ''}

      <!-- Research Intel -->
      ${build.hero_headline ? `
      <div class="border border-gray-700 rounded-xl p-4">
        <h4 class="text-sm font-bold text-white mb-3 flex items-center gap-2"><i class="fas fa-brain text-purple-400"></i>AI Research Intelligence</h4>
        <div class="space-y-3 text-sm">
          <div><p class="text-xs text-gray-500">Hero Headline</p><p class="text-white font-semibold italic">"${escHtml(build.hero_headline)}"</p></div>
          ${build.hero_subheadline ? `<div><p class="text-xs text-gray-500">Subheadline</p><p class="text-gray-300">"${escHtml(build.hero_subheadline)}"</p></div>` : ''}
          ${build.business_description ? `<div><p class="text-xs text-gray-500">Business Description</p><p class="text-gray-300">${escHtml(build.business_description)}</p></div>` : ''}
          ${uspHtml ? `<div><p class="text-xs text-gray-500">Unique Selling Points</p><ul class="list-disc pl-4 text-gray-300 text-xs space-y-1">${uspHtml}</ul></div>` : ''}
          ${servicesHtml ? `<div><p class="text-xs text-gray-500">Services</p><ul class="list-disc pl-4 text-gray-300 text-xs space-y-1">${servicesHtml}</ul></div>` : ''}
          ${reviewsHtml ? `<div><p class="text-xs text-gray-500">Customer Reviews Used</p><div class="grid grid-cols-2 gap-2 mt-1">${reviewsHtml}</div></div>` : ''}
        </div>
      </div>` : ''}

      <!-- Outreach log -->
      <div class="border border-gray-700 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-bold text-white flex items-center gap-2"><i class="fas fa-paper-plane text-blue-400"></i>Outreach Log</h4>
          ${!build.outreach_email_sent && !build.outreach_sms_sent ? `<button onclick="triggerOutreach(${build.id})" class="btn-primary text-xs">Send Outreach Now</button>` : ''}
        </div>
        ${outreach_log.length ? outreach_log.map(log=>`
          <div class="bg-gray-800/60 rounded-lg p-3 mb-2">
            <div class="flex items-center gap-2 mb-1">
              <i class="fas fa-${log.channel==='email'?'envelope':'sms'} ${log.channel==='email'?'text-blue-400':'text-green-400'} text-xs"></i>
              <span class="text-xs font-semibold text-white">${log.channel.toUpperCase()} → ${escHtml(log.recipient)}</span>
              <span class="badge badge-${log.status==='sent'?'active':log.status==='failed'?'lost':'won'} text-xs ml-auto">${log.status}</span>
            </div>
            ${log.subject ? `<p class="text-xs text-gray-400 font-semibold mb-1">Subject: ${escHtml(log.subject)}</p>` : ''}
            <p class="text-xs text-gray-500 leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto">${escHtml(log.message?.slice(0, 500))}${(log.message?.length||0)>500?'…':''}</p>
          </div>`).join('') : `<p class="text-xs text-gray-600 text-center py-4">No outreach sent yet</p>`}
      </div>

      <!-- Lovable Prompt -->
      <details class="border border-gray-700 rounded-xl overflow-hidden">
        <summary class="p-3 text-sm font-semibold text-gray-400 cursor-pointer hover:text-white flex items-center gap-2">
          <i class="fas fa-code text-gray-600"></i> View Lovable Prompt (sent to website builder)
        </summary>
        <div class="p-3 bg-gray-950/60">
          <pre class="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto font-mono">${escHtml(build.lovable_prompt||'No prompt saved')}</pre>
          <button onclick="navigator.clipboard.writeText(${JSON.stringify(build.lovable_prompt||'')}); showToast('Prompt copied!','success')" class="btn-secondary btn-sm mt-2">
            <i class="fas fa-copy mr-1"></i> Copy Prompt
          </button>
        </div>
      </details>
    </div>`
}

// ── View research detail ──────────────────────────────────────────────────────
async function viewResearch(reportId) {
  openModal('research-detail-modal')
  document.getElementById('rdm-content').innerHTML = '<div class="flex justify-center py-12"><div class="spinner"></div></div>'
  // fetch research directly via builds endpoint that joins research
  const data = await api('GET', `/builder/builds/0`).catch(() => null)
  // Fallback: show a placeholder
  document.getElementById('rdm-content').innerHTML = `<p class="text-gray-400 text-sm">Research report #${reportId} — open a build's details to view full research inline.</p>`
}

// ── Research a single lead from the research tab ──────────────────────────────
let researchLeads = []
async function filterResearchLeads(q) {
  if (!researchLeads.length) {
    const d = await api('GET', '/leads?limit=200')
    researchLeads = Array.isArray(d) ? d : d.leads || []
  }
  const el = document.getElementById('research-lead-results')
  const list = q ? researchLeads.filter(l => (l.business_name+l.city).toLowerCase().includes(q.toLowerCase())) : researchLeads.slice(0, 8)
  el.innerHTML = list.slice(0,8).map(l => `
    <button onclick="runSingleResearch(${l.id},'${escHtml(l.business_name)}')" class="w-full text-left flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-gray-800 transition-all text-xs group">
      <span class="text-white font-medium">${escHtml(l.business_name)}</span>
      <span class="text-gray-500">${escHtml(l.city||'')} · ${escHtml(l.industry||'')}</span>
      <span class="text-purple-400 opacity-0 group-hover:opacity-100 flex-shrink-0"><i class="fas fa-brain mr-1"></i>Research</span>
    </button>`).join('')
}

async function runSingleResearch(leadId, name) {
  showToast(`Starting deep research on ${name}...`, 'info')
  try {
    await api('POST', '/builder/research', { lead_id: leadId })
    showToast(`✓ Research complete for ${name}!`, 'success')
    renderBuilder()
  } catch {}
}

async function runBulkResearch() {
  showToast('Starting bulk research on 5 leads...', 'info')
  try {
    const r = await api('POST', '/builder/bulk-research', { limit: 5 })
    showToast(`✓ Research complete for ${r.started} leads!`, 'success')
    renderBuilder()
  } catch {}
}

// ── Outreach trigger ──────────────────────────────────────────────────────────
async function triggerOutreach(buildId) {
  showToast('Sending outreach...', 'info')
  try {
    await api('POST', `/builder/outreach/${buildId}`)
    showToast('Outreach sent!', 'success')
    renderBuilder()
  } catch {}
}

// ── Update outreach status ─────────────────────────────────────────────────────
async function updateOutreachStatus(buildId) {
  const status = prompt('Update outreach status:\nOptions: pending, sent, opened, replied, converted', 'replied')
  if (!status) return
  await api('PUT', `/builder/builds/${buildId}`, { outreach_status: status })
  showToast('Status updated', 'success')
  renderBuilder()
}

// ── Settings savers ───────────────────────────────────────────────────────────
async function saveBuilderContactInfo() {
  const payload = {
    owner_name:  document.getElementById('bcfg-owner-name').value.trim(),
    owner_phone: document.getElementById('bcfg-owner-phone').value.trim(),
    owner_email: document.getElementById('bcfg-owner-email').value.trim(),
    default_package: document.getElementById('bcfg-default-pkg').value,
  }
  await api('PUT', '/builder/config', payload)
  showToast('Contact info saved ✓', 'success')
}

async function saveBuilderKey(key, inputId) {
  const val = document.getElementById(inputId).value.trim()
  if (!val || val.includes('••')) { showToast('Enter a valid key', 'error'); return }
  await api('PUT', '/builder/config', { [key]: val })
  showToast('API key saved ✓', 'success')
}

async function saveTwilio() {
  const payload = {
    twilio_account_sid:  document.getElementById('bcfg-twilio-sid').value.trim(),
    twilio_auth_token:   document.getElementById('bcfg-twilio-token').value.trim(),
    twilio_from_number:  document.getElementById('bcfg-twilio-from').value.trim(),
  }
  await api('PUT', '/builder/config', payload)
  showToast('Twilio settings saved ✓', 'success')
}

async function toggleBuilderSetting(key) {
  const current = builderCfg[key]
  await api('PUT', '/builder/config', { [key]: current === '0' ? '1' : '0' })
  showToast('Setting updated', 'success')
  renderBuilder()
}

// ===== INIT =====
initSidebar()
navigateTo('dashboard')
