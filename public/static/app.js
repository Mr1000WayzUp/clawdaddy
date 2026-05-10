/* ===================================================
   Google Money Drop - Frontend Application
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
    builder: '✨ Website Builder', activity: 'Activity Timeline',
    settings: '⚙️ Settings', profile: '👤 My Profile'
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
    activity: renderActivity,
    settings: renderSettings,
    profile: renderProfile,
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
  if(tier==='Enterprise') return 'text-red-400'
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
      <div onclick="navigateTo('revenue')" class="bg-gradient-to-r from-blue-900/40 to-indigo-900/30 border border-blue-800/40 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:shadow-xl hover:scale-[1.01] transition-all">
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
        ${kpiCard('Total Leads','map-marker-alt',stats.leads.total,'blue',`${stats.leads.new} new`,'leads')}
        ${kpiCard('Active Clients','users',stats.clients.active,'green',`${stats.clients.total} total`,'clients')}
        ${kpiCard('Total Revenue','dollar-sign',fmt$(stats.revenue.total),'emerald',`${fmt$(stats.revenue.monthly)}/mo recurring`,'revenue')}
        ${kpiCard('Conversion Rate','chart-line',convRate+'%','purple',`${stats.leads.won} won · ${stats.leads.lost} lost`,'pipeline')}
      </div>

      <!-- Charts row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Pipeline funnel -->
        <div onclick="navigateTo('pipeline')" class="card cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all">
          <h3 class="font-bold text-white mb-4 flex items-center gap-2"><i class="fas fa-stream text-blue-400 text-sm"></i>Lead Pipeline</h3>
          <div class="space-y-3">
            ${renderPipelineFunnel(byStatus)}
          </div>
        </div>
        <!-- Industry chart -->
        <div onclick="navigateTo('leads')" class="card cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all">
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
        <div onclick="navigateTo('proposals')" class="card cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all">
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
        <div onclick="navigateTo('activity')" class="card cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all">
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

function kpiCard(label, icon, value, color, sub, clickTarget) {
  const colors = { blue:'text-blue-400 bg-blue-900/30', green:'text-green-400 bg-green-900/30', emerald:'text-emerald-400 bg-emerald-900/30', purple:'text-purple-400 bg-purple-900/30' }
  const [tc,bc] = (colors[color]||'text-gray-400 bg-gray-800').split(' ')
  const clickAttr = clickTarget ? `onclick="navigateTo('${clickTarget}')" class="cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all"` : ''
  return `
    <div class="stat-card flex items-center gap-4" ${clickAttr}>
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
        <div class="stat-card cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all" onclick="navigateTo('revenue')">
          <p class="text-xs text-gray-500 uppercase font-semibold">Total Clients</p>
          <p class="text-2xl font-bold text-white mt-1">${data.length}</p>
        </div>
        <div class="stat-card cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all" onclick="navigateTo('revenue')">
          <p class="text-xs text-gray-500 uppercase font-semibold">Total Revenue</p>
          <p class="text-2xl font-bold text-green-400 mt-1">${fmt$(totalRevenue)}</p>
        </div>
        <div class="stat-card cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all" onclick="navigateTo('revenue')">
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
  const defaults = { Starter:799, Professional:1497, Premium:2997, Enterprise:5997 }
  const recurring = { Starter:49, Professional:97, Premium:197, Enterprise:397 }
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
  Starter: {
    price: 799, recurring: 49,
    features: ['5-Page Website','Mobile Responsive','Contact Form','Google Maps Integration','Click-to-Call','1 Year Domain + Hosting']
  },
  Professional: {
    price: 1497, recurring: 97,
    features: ['Everything in Starter','SEO Optimization','Google Business Profile','Image Gallery','Social Media Links','Analytics Dashboard','Professional Copywriting']
  },
  Premium: {
    price: 2997, recurring: 197,
    features: ['Everything in Professional','Online Booking System','Blog + Content Marketing','3 Months Free Updates','Local SEO Campaign','Priority Support','Custom Domain Email']
  },
  Enterprise: {
    price: 5997, recurring: 397,
    features: ['Everything in Premium','E-Commerce / Online Store','Custom Web Application','12 Months of Updates','Dedicated Account Manager','Monthly SEO Reports','Google Ads Management']
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
                <th>Payment</th>
                <th>Created</th>
                <th class="w-40">Actions</th>
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
      <td>
        ${p.payment_status === 'paid' ? 
          `<span class="inline-flex items-center gap-1 px-2 py-1 bg-emerald-900/30 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-semibold"><i class="fas fa-check-circle"></i> Paid</span>` :
          p.stripe_payment_link ? 
            `<span class="inline-flex items-center gap-1 px-2 py-1 bg-amber-900/30 border border-amber-500/30 rounded-lg text-amber-400 text-xs font-semibold"><i class="fas fa-clock"></i> Sent</span>` :
            `<span class="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 text-xs"><i class="fas fa-circle"></i> Pending</span>`
        }
      </td>
      <td><span class="text-gray-500 text-xs">${fmtDate(p.created_at)}</span></td>
      <td>
        <div class="flex items-center gap-1" onclick="event.stopPropagation()">
          ${p.status === 'accepted' || p.payment_status === 'paid' ? 
            `<span class="text-xs text-emerald-400 font-semibold"><i class="fas fa-check-circle"></i> Paid</span>` :
            `<button onclick="openPaymentLink(${p.id}, '${escHtml(p.package_tier)}', ${p.package_price})" class="btn-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-3 py-1.5 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all" title="Send Payment Link"><i class="fas fa-credit-card"></i> Pay</button>`
          }
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
  const biz      = document.getElementById('proposal-business-name').value||'[Business Name]'
  const owner    = document.getElementById('proposal-owner-name').value||'there'
  const pkg      = document.getElementById('proposal-package').value||'Professional'
  const price    = parseFloat(document.getElementById('proposal-price').value)||0
  const recurring= parseFloat(document.getElementById('proposal-recurring').value)||0
  const msg      = document.getElementById('proposal-message').value||''
  const features = [...document.querySelectorAll('#proposal-features input:checked')].map(i=>i.value)

  // --- Loss Aversion + ROI Calculations ---
  const industryROI = { Starter:4.2, Professional:6.8, Premium:9.5, Enterprise:14 }
  const roi12mo     = price > 0 ? (industryROI[pkg]||6.8) * price : 0
  const breakEven   = price > 0 ? Math.ceil(price / (roi12mo / 12 / 30)) : 0
  const anchor      = pkg === 'Starter' ? 1497 : pkg === 'Professional' ? 2997 : pkg === 'Premium' ? 5997 : 9997
  const savings     = anchor - price

  // Expiry: 7 days from now
  const expiry   = new Date(Date.now() + 7*24*60*60*1000)
  const expiryStr= expiry.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})

  document.getElementById('proposal-preview').innerHTML = `
    <!-- PROPOSAL HEADER -->
    <div class="proposal-preview-header relative overflow-hidden">
      <div class="absolute top-0 right-0 bg-amber-500 text-black text-xs font-black px-3 py-1 rounded-bl-lg">EXPIRES ${expiryStr}</div>
      <p class="text-blue-400 font-black text-xs tracking-widest uppercase">Exclusive Website Proposal</p>
      <p class="text-white font-bold text-lg mt-1">${escHtml(biz)}</p>
      <p class="text-gray-400 text-xs mt-0.5">Prepared personally for ${escHtml(owner)} · ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>
    </div>

    <!-- LOSS AVERSION OPENER -->
    <div class="bg-red-950/40 border border-red-800/40 rounded-xl p-3">
      <p class="text-red-300 font-bold text-xs flex items-center gap-2 mb-1"><i class="fas fa-exclamation-triangle"></i> What's Happening Right Now Without a Website</p>
      <p class="text-gray-300 text-xs leading-relaxed">Every week, <span class="text-white font-bold">hundreds of people</span> in your area search Google for your type of business. Without a website, <span class="text-red-400 font-bold">100% of them go to your competitors</span> — not because they're better, but because they show up online and you don't.</p>
      <div class="flex items-center gap-4 mt-2">
        <div class="text-center"><p class="text-red-400 font-black text-lg">${fmt$(Math.round(price * 0.6))}</p><p class="text-gray-500 text-xs">Est. monthly loss</p></div>
        <div class="text-center"><p class="text-red-400 font-black text-lg">${fmt$(Math.round(price * 7.2))}</p><p class="text-gray-500 text-xs">Est. annual loss</p></div>
        <div class="text-center"><p class="text-emerald-400 font-black text-lg">${breakEven}d</p><p class="text-gray-500 text-xs">Break-even</p></div>
      </div>
    </div>

    ${msg?`<div class="text-gray-300 text-xs leading-relaxed bg-blue-950/30 border border-blue-800/30 rounded-xl p-3 italic">"${escHtml(msg)}"</div>`:''}

    <!-- PRICING ANCHOR + PACKAGE -->
    <div class="bg-gray-900 rounded-xl p-4 border-2 border-blue-500/50 relative">
      ${pkg==='Professional'?'<div class="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-black px-4 py-1 rounded-full">⭐ MOST POPULAR</div>':''}
      ${savings>0?`<p class="text-xs text-gray-500 line-through mb-0.5">Regular price: ${fmt$(anchor)}</p>`:''}
      <p class="text-xs font-bold text-blue-400 uppercase tracking-wide">${escHtml(pkg)} Package</p>
      <div class="flex items-end gap-2 mt-1">
        <span class="text-3xl font-black text-emerald-400">${fmt$(price)}</span>
        <span class="text-xs text-gray-400 mb-1">one-time · professional website</span>
      </div>
      ${savings>0?`<p class="text-xs text-amber-400 font-semibold mt-1">🎉 You save ${fmt$(savings)} today</p>`:''}
      ${recurring>0?`<p class="text-xs text-gray-400 mt-1">+ ${fmt$(recurring)}/month hosting &amp; maintenance</p>`:''}
    </div>

    <!-- ROI SECTION -->
    <div class="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-3">
      <p class="text-emerald-400 font-bold text-xs mb-2"><i class="fas fa-chart-line mr-1"></i> Your Projected Return on Investment</p>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div><p class="text-white font-black text-sm">${fmt$(Math.round(roi12mo * 0.25))}</p><p class="text-gray-500 text-xs">3-Month ROI</p></div>
        <div><p class="text-emerald-400 font-black text-sm">${fmt$(Math.round(roi12mo * 0.5))}</p><p class="text-gray-500 text-xs">6-Month ROI</p></div>
        <div><p class="text-emerald-400 font-black text-base">${fmt$(Math.round(roi12mo))}</p><p class="text-gray-500 text-xs">12-Month ROI</p></div>
      </div>
      <p class="text-gray-500 text-xs mt-2 text-center">Based on average conversion rates for ${escHtml(pkg)} websites in your industry.</p>
    </div>

    <!-- FEATURES -->
    <div>
      <p class="text-xs font-bold text-white mb-2">Everything You Get:</p>
      <div class="flex flex-wrap">${features.map(f=>`<span class="proposal-feature-tag"><i class="fas fa-check text-green-400"></i>${escHtml(f)}</span>`).join('')}</div>
    </div>

    <!-- GUARANTEE -->
    <div class="bg-gray-900 border border-gray-700 rounded-xl p-3 flex items-start gap-3">
      <i class="fas fa-shield-alt text-2xl text-emerald-400 mt-0.5"></i>
      <div>
        <p class="text-white font-bold text-xs">100% Satisfaction Guarantee</p>
        <p class="text-gray-400 text-xs mt-0.5">If you're not completely happy with your website after the first revision, we'll refund your deposit — no questions, no hassle. Zero risk to you.</p>
      </div>
    </div>

    <!-- SCARCITY + TIMELINE -->
    <div class="bg-amber-950/40 border border-amber-700/40 rounded-xl p-3">
      <p class="text-amber-300 font-bold text-xs flex items-center gap-2"><i class="fas fa-clock"></i> Limited Availability</p>
      <p class="text-gray-300 text-xs mt-1">We only take <span class="text-white font-bold">3 new website clients per month</span> to ensure every site gets our full attention. This proposal expires <span class="text-amber-400 font-bold">${expiryStr}</span>.</p>
    </div>

    <!-- NEXT STEPS -->
    <div class="border border-gray-700 rounded-xl p-3">
      <p class="text-xs font-bold text-white mb-2">How It Works — 3 Simple Steps</p>
      <div class="space-y-1">
        <div class="flex items-center gap-2"><span class="w-5 h-5 bg-blue-600 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0">1</span><p class="text-xs text-gray-300"><span class="text-white font-semibold">Accept &amp; pay deposit</span> (50% = ${fmt$(price/2)}) — locks in your spot &amp; your price</p></div>
        <div class="flex items-center gap-2"><span class="w-5 h-5 bg-blue-600 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0">2</span><p class="text-xs text-gray-300"><span class="text-white font-semibold">We build in 3–5 days</span> — you review, request changes, approve</p></div>
        <div class="flex items-center gap-2"><span class="w-5 h-5 bg-emerald-600 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0">3</span><p class="text-xs text-gray-300"><span class="text-white font-semibold">Go live &amp; start winning customers</span> — pay remaining balance on launch day</p></div>
      </div>
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
      ${builderPipelineStep('3','Lovable URL Ready','fas fa-magic','One-click Lovable Build URL generated — click to auto-start site building (no API key needed)','pink', buildCount(stats,'prompt_ready') + buildCount(stats,'published'))}
      ${builderPipelineStep('4','Auto-Outreach','fas fa-paper-plane','Personalized email + SMS sent immediately with preview link & proposal','green', outCount(stats,'sent') + outCount(stats,'converted'))}
    </div>

    <!-- Main tabs + content -->
    <div class="card p-0 overflow-hidden">
      <div class="flex border-b border-gray-800 overflow-x-auto">
        ${[
          {k:'builds',   icon:'globe',        label:'Builds'},
          {k:'research', icon:'brain',         label:'Research'},
          {k:'outreach', icon:'paper-plane',   label:'Outreach'},
          {k:'followup', icon:'calendar-alt',  label:'Follow-Up'},
          {k:'settings', icon:'cog',           label:'Settings'},
        ].map(t => `
          <button onclick="switchBuilderTab('${t.k}')" id="btab-${t.k}"
            class="whitespace-nowrap px-5 py-3 text-sm font-semibold transition-all border-b-2 ${builderActiveTab===t.k ? 'border-pink-500 text-pink-400 bg-pink-900/10' : 'border-transparent text-gray-500 hover:text-gray-300'}">
            <i class="fas fa-${t.icon} mr-2"></i>${t.label}
          </button>`).join('')}
      </div>
      <div id="builder-tab-content" class="p-4">
        ${builderActiveTab === 'builds'   ? renderBuilderBuildsTab(stats)   :
          builderActiveTab === 'research' ? renderBuilderResearchTab(stats)  :
          builderActiveTab === 'outreach' ? renderBuilderOutreachTab(stats)  :
          builderActiveTab === 'followup' ? '<div class="flex justify-center py-12"><div class="spinner"></div></div>' :
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
              <option value="Starter">Starter ($799)</option>
              <option value="Professional" selected>⭐ Professional ($1,497) — Most Popular</option>
              <option value="Premium">Premium ($2,997)</option>
              <option value="Enterprise">Enterprise ($5,997) — Price Anchor</option>
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

  // If followup tab is active, populate it async after the DOM is painted
  if (builderActiveTab === 'followup') {
    renderBuilderFollowupTab()
  }
}

// ── Tab switch ────────────────────────────────────────────────────────────────
function switchBuilderTab(tab) {
  builderActiveTab = tab
  if (tab === 'followup') {
    // async tab — render shell first, then populate
    renderBuilder().then(() => renderBuilderFollowupTab())
  } else {
    renderBuilder()
  }
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
            const buildStatusColors = { queued:'badge-new', researching:'badge-pending', generating:'badge-pending', prompt_ready:'badge-demo_sent', generated:'badge-demo_sent', published:'badge-won', failed:'badge-lost', cancelled:'badge-lost' }
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
                ${b.preview_url ? `<a href="${escHtml(b.preview_url)}" target="_blank" class="text-pink-400 hover:text-pink-300 text-xs flex items-center gap-1 font-semibold"><i class="fas fa-magic mr-1"></i>Open in Lovable</a>` : '<span class="text-gray-600">—</span>'}
              </td>
              <td><span class="text-gray-500">${timeAgo(b.created_at)}</span></td>
              <td>
                <div class="flex items-center gap-1">
                  <button onclick="viewBuildDetail(${b.id})" class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800 hover:bg-gray-700" title="View Details"><i class="fas fa-eye"></i></button>
                  <button onclick="showOutreachPreview(${b.lead_id}, '${b.package_tier||'Professional'}')" class="text-xs text-pink-400 hover:text-pink-300 px-2 py-1 rounded bg-pink-900/30 hover:bg-pink-900/50" title="Preview All Outreach Variants"><i class="fas fa-search-plus"></i></button>
                  ${!b.outreach_email_sent && !b.outreach_sms_sent ? `<button onclick="triggerOutreach(${b.id})" class="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-900/30 hover:bg-blue-900/50" title="Send Outreach Now"><i class="fas fa-paper-plane"></i></button>` : ''}
                  <button onclick="startFollowupSequence(${b.lead_id}, ${b.id})" class="text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded bg-purple-900/30 hover:bg-purple-900/50" title="Start 14-Day Follow-Up"><i class="fas fa-calendar-plus"></i></button>
                  ${b.research_id ? `<button onclick="viewResearch(${b.research_id})" class="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded bg-indigo-900/30 hover:bg-indigo-900/50" title="View Research"><i class="fas fa-brain"></i></button>` : ''}
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


// ─────────────────────────────────────────────────────────────────────────────
// FOLLOW-UP TAB
// ─────────────────────────────────────────────────────────────────────────────

let followupData = { sequences: [] }

async function renderBuilderFollowupTab() {
  const el = document.getElementById('builder-tab-content')
  if (el) el.innerHTML = '<div class="flex justify-center py-12"><div class="spinner"></div></div>'
  try {
    followupData = await api('GET', '/builder/followup-list')
  } catch { followupData = { sequences: [] } }

  const seqs = followupData.sequences || []
  const statusColor = { active: 'text-emerald-400', completed: 'text-blue-400', cancelled: 'text-gray-500', paused: 'text-amber-400' }
  const dayLabels = ['—', 'Day 3', 'Day 7', 'Day 10', 'Day 14']

  const html = `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-white flex items-center gap-2"><i class="fas fa-calendar-alt text-purple-400"></i> 14-Day Follow-Up Sequences</h3>
          <p class="text-xs text-gray-500 mt-0.5">Automated nurture campaigns — psychology-optimized messages at days 3, 7, 10, 14</p>
        </div>
        <button onclick="renderBuilder()" class="btn-secondary btn-sm"><i class="fas fa-sync-alt mr-1"></i>Refresh</button>
      </div>

      <!-- Stats bar -->
      <div class="grid grid-cols-4 gap-3 text-center">
        ${[
          ['Active', seqs.filter(s=>s.status==='active').length, 'play-circle', 'emerald'],
          ['Completed', seqs.filter(s=>s.status==='completed').length, 'check-circle', 'blue'],
          ['Messages Sent', seqs.reduce((a,s)=>a+(s.sent_count||0),0), 'paper-plane', 'purple'],
          ['Pending Send', seqs.reduce((a,s)=>a+(s.pending_count||0),0), 'clock', 'amber'],
        ].map(([lbl,cnt,icon,c])=>`
          <div class="bg-${c}-900/20 border border-${c}-700/30 rounded-xl p-3">
            <i class="fas fa-${icon} text-${c}-400 text-lg mb-1 block"></i>
            <p class="text-2xl font-black text-white">${cnt}</p>
            <p class="text-xs text-gray-500">${lbl}</p>
          </div>`).join('')}
      </div>

      <!-- Sequences table -->
      ${seqs.length ? `
      <div class="overflow-x-auto rounded-xl border border-gray-800">
        <table class="data-table text-xs">
          <thead>
            <tr>
              <th>Business</th><th>Status</th><th>Progress</th><th>Next Send</th>
              <th>Sent</th><th>Pending</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${seqs.map(s => {
              const progressPct = Math.round((s.current_step / 4) * 100)
              return `<tr>
                <td>
                  <p class="font-semibold text-white">${escHtml(s.business_name)}</p>
                  <p class="text-gray-500">${escHtml(s.industry||'')} · ${escHtml(s.city||'')}</p>
                </td>
                <td><span class="${statusColor[s.status]||'text-gray-400'} font-semibold capitalize">${s.status}</span></td>
                <td>
                  <div class="flex items-center gap-2">
                    <div class="flex-1 bg-gray-800 rounded-full h-1.5">
                      <div class="bg-purple-500 h-1.5 rounded-full" style="width:${progressPct}%"></div>
                    </div>
                    <span class="text-gray-400 whitespace-nowrap">Step ${s.current_step}/4</span>
                  </div>
                  <p class="text-gray-600 mt-0.5">${dayLabels[s.current_step]||'Complete'}</p>
                </td>
                <td>${s.next_send_at ? `<span class="text-amber-400">${timeAgo(s.next_send_at)}</span>` : '—'}</td>
                <td><span class="text-emerald-400 font-semibold">${s.sent_count||0}</span></td>
                <td><span class="text-amber-400 font-semibold">${s.pending_count||0}</span></td>
                <td>
                  <div class="flex items-center gap-1">
                    <button onclick="viewFollowupDetail(${s.id}, ${s.lead_id})"
                      class="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-900/20 hover:bg-blue-900/40">
                      <i class="fas fa-eye"></i> View
                    </button>
                    ${s.status === 'active' && s.current_step < 4 ? `
                    <button onclick="sendNextStep(${s.id}, ${(s.current_step||0)+1})"
                      class="text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded bg-purple-900/20 hover:bg-purple-900/40">
                      <i class="fas fa-paper-plane"></i> Send Next
                    </button>` : ''}
                    ${s.status === 'active' ? `
                    <button onclick="cancelSequence(${s.id})"
                      class="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-900/20 hover:bg-red-900/40">
                      <i class="fas fa-ban"></i>
                    </button>` : ''}
                  </div>
                </td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>` : `
      <div class="text-center py-12 text-gray-600">
        <i class="fas fa-calendar-alt text-4xl mb-3 block text-gray-700"></i>
        <p class="font-semibold text-gray-500">No follow-up sequences yet</p>
        <p class="text-xs mt-1">Start a sequence from any build's detail view, or from the Leads tab</p>
      </div>`}

      <!-- Psychology summary -->
      <div class="bg-purple-950/30 border border-purple-800/30 rounded-xl p-4">
        <h4 class="text-sm font-bold text-purple-300 mb-3"><i class="fas fa-brain mr-2"></i>14-Day Psychology Sequence Blueprint</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          ${[
            {day:'Day 3', trigger:'Loss Aversion', desc:'Quantify weekly revenue losses. Pain motivates 2.5× more than gain.', icon:'chart-line', c:'red'},
            {day:'Day 7', trigger:'Social Proof', desc:'Competitors who got websites and thrived. Fear of being left behind.', icon:'users', c:'blue'},
            {day:'Day 10', trigger:'Scarcity + Urgency', desc:'Only 2 spots left this month. Price increase coming. Time pressure.', icon:'clock', c:'amber'},
            {day:'Day 14', trigger:'Final + Breakup', desc:'Last contact. "I\'ll give your spot to another business." Pattern interrupt.', icon:'flag-checkered', c:'purple'},
          ].map(s=>`
            <div class="bg-${s.c}-950/40 border border-${s.c}-800/30 rounded-lg p-3">
              <p class="text-xs font-black text-${s.c}-400"><i class="fas fa-${s.icon} mr-1"></i>${s.day}</p>
              <p class="text-xs font-semibold text-white mt-1">${s.trigger}</p>
              <p class="text-xs text-gray-400 mt-1 leading-relaxed">${s.desc}</p>
            </div>`).join('')}
        </div>
      </div>
    </div>
  `

  if (el) el.innerHTML = html
  return html
}

async function viewFollowupDetail(seqId, leadId) {
  const modal = document.createElement('div')
  modal.className = 'modal-overlay'
  modal.id = 'followup-detail-modal'
  modal.innerHTML = `
    <div class="modal-content max-w-3xl">
      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-white flex items-center gap-2"><i class="fas fa-calendar-alt text-purple-400"></i>Follow-Up Sequence Detail</h3>
          <button onclick="document.getElementById('followup-detail-modal').remove()" class="text-gray-400 hover:text-white"><i class="fas fa-times text-xl"></i></button>
        </div>
        <div id="fud-body" class="text-center py-8"><div class="spinner mx-auto"></div></div>
      </div>
    </div>`
  document.body.appendChild(modal)

  try {
    const data = await api('GET', `/builder/followup/${leadId}`)
    const seq  = data.sequence
    const msgs = data.messages || []
    const steps = [1,2,3,4]
    const dayLabel = {1:'Day 3',2:'Day 7',3:'Day 10',4:'Day 14'}
    const triggerLabel = {1:'Loss Aversion',2:'Social Proof',3:'Scarcity + Urgency',4:'Final Breakup'}
    const statusCls = {sent:'text-emerald-400',scheduled:'text-amber-400',failed:'text-red-400',cancelled:'text-gray-500'}

    document.getElementById('fud-body').innerHTML = `
      <div class="space-y-3">
        <div class="grid grid-cols-3 gap-3 text-center text-xs">
          <div class="bg-gray-800 rounded-lg p-2"><p class="text-gray-400">Status</p><p class="text-white font-bold capitalize">${seq?.status||'—'}</p></div>
          <div class="bg-gray-800 rounded-lg p-2"><p class="text-gray-400">Current Step</p><p class="text-white font-bold">Step ${seq?.current_step||0} / 4</p></div>
          <div class="bg-gray-800 rounded-lg p-2"><p class="text-gray-400">Next Send</p><p class="text-amber-400 font-bold">${seq?.next_send_at ? fmtDate(seq.next_send_at) : 'Complete'}</p></div>
        </div>
        ${steps.map(step => {
          const stepMsgs = msgs.filter(m=>m.step_number===step)
          const email    = stepMsgs.find(m=>m.channel==='email')
          const sms      = stepMsgs.find(m=>m.channel==='sms')
          const allSent  = stepMsgs.every(m=>m.status==='sent')
          return `
            <div class="border ${allSent?'border-emerald-700/40 bg-emerald-950/20':'border-gray-700'} rounded-xl overflow-hidden">
              <div class="flex items-center justify-between p-3 ${allSent?'bg-emerald-900/10':'bg-gray-800/40'}">
                <div class="flex items-center gap-2">
                  <span class="w-6 h-6 rounded-full ${allSent?'bg-emerald-600':'bg-purple-700'} text-white text-xs flex items-center justify-center font-bold">${step}</span>
                  <div>
                    <p class="text-sm font-semibold text-white">${dayLabel[step]} — ${triggerLabel[step]}</p>
                    <p class="text-xs text-gray-500">${stepMsgs.length} message(s)</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  ${stepMsgs.map(m=>`<span class="text-xs ${statusCls[m.status]||'text-gray-400'} capitalize">${m.channel}: ${m.status}</span>`).join(' · ')}
                  ${!allSent && seq?.status==='active' ? `
                    <button onclick="sendNextStep(${seq.id}, ${step})" class="btn-sm bg-purple-700 hover:bg-purple-600 text-white text-xs">
                      <i class="fas fa-paper-plane mr-1"></i>Send Now
                    </button>` : ''}
                </div>
              </div>
              ${email ? `
                <div class="p-3 border-t border-gray-800">
                  <p class="text-xs text-blue-400 font-semibold mb-1"><i class="fas fa-envelope mr-1"></i>Email — ${escHtml(email.subject||'')}</p>
                  <div class="text-xs text-gray-400 max-h-28 overflow-y-auto leading-relaxed whitespace-pre-line bg-gray-950/60 rounded p-2">${escHtml((email.body||'').substring(0,600))}${(email.body||'').length>600?'…':''}</div>
                </div>` : ''}
              ${sms ? `
                <div class="p-3 border-t border-gray-800">
                  <p class="text-xs text-green-400 font-semibold mb-1"><i class="fas fa-sms mr-1"></i>SMS</p>
                  <div class="text-xs text-gray-400 bg-gray-950/60 rounded p-2">${escHtml(sms.body||'')}</div>
                </div>` : ''}
            </div>`
        }).join('')}
      </div>`
  } catch(e) {
    document.getElementById('fud-body').innerHTML = `<p class="text-red-400">Error loading sequence: ${e.message}</p>`
  }
}

async function sendNextStep(seqId, stepNum) {
  if (!confirm(`Send follow-up Step ${stepNum} now?\n\nThis will send the email and/or SMS immediately.`)) return
  showToast('Sending follow-up messages...', 'info')
  try {
    const r = await api('POST', '/builder/followup/send-step', { sequence_id: seqId, step_number: stepNum })
    showToast(`Step ${stepNum} sent! (${r.sent} messages)`, 'success')
    renderBuilder()
  } catch(e) {
    showToast('Send failed: ' + e.message, 'error')
  }
}

async function cancelSequence(seqId) {
  if (!confirm('Cancel this follow-up sequence?\n\nAll scheduled messages will be cancelled.')) return
  await api('POST', '/builder/followup/cancel', { sequence_id: seqId })
  showToast('Sequence cancelled', 'info')
  renderBuilder()
}

async function startFollowupSequence(leadId, buildId) {
  showToast('Starting 14-day sequence...', 'info')
  try {
    const r = await api('POST', '/builder/followup/start', { lead_id: leadId, build_id: buildId })
    showToast('Follow-up sequence started! 4 steps scheduled.', 'success')
    switchBuilderTab('followup')
    renderBuilder()
  } catch(e) {
    showToast('Error: ' + e.message, 'error')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTREACH PREVIEW MODAL
// ─────────────────────────────────────────────────────────────────────────────

async function showOutreachPreview(leadId, pkg) {
  const modal = document.createElement('div')
  modal.className = 'modal-overlay'
  modal.id = 'outreach-preview-modal'
  modal.innerHTML = `
    <div class="modal-content" style="max-width:760px">
      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
              <i class="fas fa-paper-plane text-blue-400"></i>Outreach Preview
            </h3>
            <p class="text-xs text-gray-400 mt-0.5">Full A/B/C variants + SMS + 14-day follow-up sequence</p>
          </div>
          <button onclick="document.getElementById('outreach-preview-modal').remove()" class="text-gray-400 hover:text-white">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        <div id="opm-body" class="text-center py-8"><div class="spinner mx-auto"></div></div>
      </div>
    </div>`
  document.body.appendChild(modal)

  try {
    const data = await api('GET', `/builder/preview-outreach/${leadId}?package=${pkg||'Professional'}`)
    const variantColors = { A:'blue', B:'purple', C:'amber' }
    const activeV = data.active_variant

    document.getElementById('opm-body').innerHTML = `
      <div class="space-y-4 text-left max-h-[70vh] overflow-y-auto pr-1">

        <!-- Loss Numbers Banner -->
        <div class="bg-red-950/40 border border-red-800/40 rounded-xl p-3 grid grid-cols-3 gap-3 text-center">
          <div><p class="text-red-400 font-black text-xl">$${(data.loss_numbers?.weeklyLoss||0).toLocaleString()}</p><p class="text-xs text-gray-500">Weekly Loss Est.</p></div>
          <div><p class="text-red-400 font-black text-xl">$${(data.loss_numbers?.monthlyLoss||0).toLocaleString()}</p><p class="text-xs text-gray-500">Monthly Loss Est.</p></div>
          <div><p class="text-amber-400 font-black text-xl">${data.loss_numbers?.breakEvenDays||0}d</p><p class="text-xs text-gray-500">Break-Even Days</p></div>
        </div>

        <!-- Active variant badge -->
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 bg-blue-700 text-white text-xs font-bold rounded-full">
            Active Variant: ${activeV} (auto-selected by lead ID)
          </span>
          ${data.industry_intel?.urgencyHook ? `<span class="text-xs text-gray-500 italic">"${escHtml(data.industry_intel.urgencyHook)}"</span>` : ''}
        </div>

        <!-- Email Variants Tabs -->
        <div class="border border-gray-700 rounded-xl overflow-hidden">
          <div class="flex border-b border-gray-700 bg-gray-900">
            ${['A','B','C'].map(v=>`
              <button onclick="showEmailVariant('${v}')" id="ev-tab-${v}"
                class="flex-1 py-2 text-xs font-bold transition-all ${v===activeV?'text-blue-400 border-b-2 border-blue-500 bg-blue-900/20':'text-gray-500 hover:text-gray-300'}">
                ${v===activeV?'★ ':''}Variant ${v}
                <span class="text-gray-600 font-normal ml-1">${v==='A'?'Loss Aversion':v==='B'?'Reciprocity':'Pattern Interrupt'}</span>
              </button>`).join('')}
          </div>
          ${['A','B','C'].map(v=>`
            <div id="ev-body-${v}" class="${v!==activeV?'hidden':''} p-4 space-y-3">
              <div class="bg-gray-950 rounded-lg p-2">
                <p class="text-xs text-gray-500 mb-1">Subject Line:</p>
                <p class="text-sm font-semibold text-white">${escHtml((data.email_variants?.[v]?.subject)||'')}</p>
              </div>
              <div class="bg-gray-950 rounded-lg p-3 max-h-52 overflow-y-auto">
                <pre class="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">${escHtml((data.email_variants?.[v]?.body)||'')}</pre>
              </div>
              <button onclick="navigator.clipboard.writeText(${JSON.stringify((data.email_variants?.[v]?.body)||'')}); showToast('Email copied!','success')"
                class="btn-secondary btn-sm"><i class="fas fa-copy mr-1"></i>Copy Email</button>
            </div>`).join('')}
        </div>

        <!-- SMS Variants -->
        <div class="border border-gray-700 rounded-xl p-4 space-y-2">
          <p class="text-sm font-bold text-green-400 flex items-center gap-2"><i class="fas fa-sms"></i>SMS Variants</p>
          ${['A','B','C'].map(v=>`
            <div class="bg-gray-900 rounded-lg p-3">
              <p class="text-xs text-gray-500 mb-1">SMS Variant ${v}${v===activeV?' (Active)':''}:</p>
              <p class="text-xs text-gray-300">${escHtml(data.sms_variants?.[v]||'')}</p>
            </div>`).join('')}
        </div>

        <!-- Follow-Up Steps Preview -->
        <div class="border border-gray-700 rounded-xl overflow-hidden">
          <div class="bg-purple-900/20 border-b border-gray-700 p-3">
            <p class="text-sm font-bold text-purple-300 flex items-center gap-2"><i class="fas fa-calendar-alt"></i>14-Day Follow-Up Sequence Preview</p>
          </div>
          <div class="divide-y divide-gray-800">
            ${(data.followup_steps||[]).map(s=>`
              <details class="group">
                <summary class="p-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/40 list-none">
                  <div class="flex items-center gap-3">
                    <span class="w-7 h-7 bg-purple-800 text-white text-xs font-bold rounded-full flex items-center justify-center">${s.step}</span>
                    <div>
                      <p class="text-xs font-semibold text-white">Day ${s.day}</p>
                      <p class="text-xs text-gray-500">${escHtml(s.subject||'')}</p>
                    </div>
                  </div>
                  <i class="fas fa-chevron-down text-gray-600 group-open:rotate-180 transition-transform"></i>
                </summary>
                <div class="p-3 bg-gray-950/60 space-y-2">
                  <pre class="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">${escHtml((s.emailBody||'').substring(0,500))}...</pre>
                  <div class="bg-gray-900 rounded p-2 text-xs text-gray-400">${escHtml(s.smsBody||'')}</div>
                </div>
              </details>`).join('')}
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-3 pt-2">
          ${data.has_build ? `
          <button onclick="startFollowupSequenceFromPreview(${leadId})"
            class="btn-primary flex-1">
            <i class="fas fa-calendar-plus mr-2"></i>Start 14-Day Sequence
          </button>` : ''}
          <button onclick="document.getElementById('outreach-preview-modal').remove()"
            class="btn-secondary flex-1">Close</button>
        </div>
      </div>`
  } catch(e) {
    document.getElementById('opm-body').innerHTML = `<p class="text-red-400 p-4">Error: ${escHtml(e.message)}</p>`
  }
}

function showEmailVariant(v) {
  ['A','B','C'].forEach(x => {
    const tab  = document.getElementById('ev-tab-' + x)
    const body = document.getElementById('ev-body-' + x)
    if (tab && body) {
      const active = x === v
      body.classList.toggle('hidden', !active)
      tab.className = `flex-1 py-2 text-xs font-bold transition-all ${active ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-900/20' : 'text-gray-500 hover:text-gray-300'}`
    }
  })
}

async function startFollowupSequenceFromPreview(leadId) {
  document.getElementById('outreach-preview-modal')?.remove()
  await startFollowupSequence(leadId, null)
}

// ── Outreach trigger ──────────────────────────────────────────────────────────
async function triggerOutreach(buildId) {
  showToast('Sending outreach...', 'info')
  try {
    await api('POST', `/builder/outreach/${buildId}`)
    showToast('✓ Outreach sent! Email + SMS delivered.', 'success')
    renderBuilder()
  } catch(e) { showToast(e.message||'Send failed','error') }
}

async function triggerOutreachAndClose(buildId) {
  document.getElementById('outreach-preview-modal')?.remove()
  await triggerOutreach(buildId)
}

async function startFollowupFromPreview(leadId) {
  try {
    await api('POST', '/builder/followup/start', { lead_id: leadId })
    showToast('✓ 14-day follow-up sequence queued! Check Follow-Up tab.', 'success')
  } catch(e) { showToast(e.message || 'Failed to start sequence', 'error') }
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

// ============================================================================
// SETTINGS PAGE — full app control panel
// ============================================================================
let settingsTab = 'profile'
let settingsData = null

async function renderSettings() {
  setContent(`<div class="flex items-center justify-center h-48"><div class="spinner"></div></div>`)
  try {
    const [all, profile] = await Promise.all([
      api('GET', '/settings/all'),
      api('GET', '/settings/profile'),
    ])
    settingsData = { ...all, profile }
    _renderSettingsUI()
  } catch(e) {
    setContent(`<div class="text-center py-12 text-red-400"><i class="fas fa-exclamation-triangle text-3xl mb-3 block"></i>Failed to load settings: ${e.message}</div>`)
  }
}

function _renderSettingsUI() {
  const { builder: b, prospector: p, profile: u } = settingsData
  const tabs = [
    { k:'profile',       icon:'user-circle',    label:'Profile' },
    { k:'api-keys',      icon:'key',            label:'API Keys' },
    { k:'outreach',      icon:'paper-plane',    label:'Outreach' },
    { k:'prospector',    icon:'robot',          label:'Prospector' },
    { k:'payments',      icon:'credit-card',    label:'Payments' },
    { k:'members',       icon:'users',          label:'Team' },
    { k:'danger',        icon:'shield-alt',     label:'System' },
  ]

  const togBtn = (key, cfg, src='builder') => {
    const on = cfg[key] !== '0'
    return `<button onclick="toggleSettingFromPage('${key}','${src}')"
      class="relative w-12 h-6 rounded-full transition-colors ${on ? 'bg-violet-600' : 'bg-gray-700'}" id="stog-${key}">
      <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-0'}"></span>
    </button>`
  }

  const apiRow = (label, key, id, placeholder, hint='') => `
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">${label}</label>
      <div class="flex gap-2">
        <input id="${id}" type="password" class="form-input flex-1 font-mono text-sm"
          value="${escHtml(settingsData.builder[key]||'')}" placeholder="${placeholder}"
          onfocus="if(this.value.includes('••')){this.value=''}" />
        <button onclick="saveSettingKey('${key}','${id}')" class="btn-secondary px-4 text-sm whitespace-nowrap">
          <i class="fas fa-save mr-1"></i>Save
        </button>
      </div>
      ${hint ? `<p class="text-xs text-gray-500">${hint}</p>` : ''}
    </div>`

  // Tab content
  const tabContent = {

    // ── Profile ──────────────────────────────────────────────────────────────
    'profile': `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Avatar card -->
        <div class="card flex flex-col items-center gap-4 py-8">
          <div id="settings-avatar" class="w-24 h-24 rounded-full bg-gradient-to-br from-${u.avatar_color||'green'}-400 to-${u.avatar_color||'emerald'}-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl">
            ${escHtml(u.avatar_initials||'YB')}
          </div>
          <div class="text-center">
            <p class="font-bold text-white text-lg">${escHtml(u.full_name||'Your Name')}</p>
            <p class="text-gray-400 text-sm">${escHtml(u.business_name||'Your Business')}</p>
            <span class="mt-2 inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-700">
              ${escHtml(u.role||'admin')}
            </span>
          </div>
          <div class="w-full pt-2 border-t border-gray-800">
            <p class="text-xs text-gray-500 text-center mb-3">Avatar Color</p>
            <div class="flex flex-wrap justify-center gap-2">
              ${['green','blue','purple','pink','orange','red','yellow','teal'].map(c=>`
                <button onclick="setAvatarColor('${c}')" title="${c}"
                  class="w-7 h-7 rounded-full bg-${c}-500 hover:scale-110 transition-transform ring-2 ring-offset-2 ring-offset-gray-900 ${(u.avatar_color||'green')===c ? 'ring-white' : 'ring-transparent'}">
                </button>`).join('')}
            </div>
          </div>
          <!-- Google Connect -->
          <div class="w-full pt-2 border-t border-gray-800">
            ${u.google_email ? `
              <div class="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                ${u.google_picture ? `<img src="${u.google_picture}" class="w-8 h-8 rounded-full" alt="Google avatar"/>` : '<i class="fab fa-google text-blue-400 text-xl"></i>'}
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-semibold text-white truncate">${escHtml(u.google_name||'')}</p>
                  <p class="text-xs text-gray-400 truncate">${escHtml(u.google_email)}</p>
                </div>
                <button onclick="disconnectGoogle()" class="text-xs text-red-400 hover:text-red-300 whitespace-nowrap">Unlink</button>
              </div>` : `
              <button onclick="connectGoogle()" class="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold text-sm py-2.5 rounded-lg transition-all">
                <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sign in with Google
              </button>`}
          </div>
        </div>

        <!-- Edit form -->
        <div class="lg:col-span-2 card space-y-5">
          <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-user-edit text-blue-400"></i> Personal Information</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="form-label">Full Name</label>
              <input id="prof-name" type="text" class="form-input w-full" value="${escHtml(u.full_name||'')}" placeholder="Your Full Name"/>
            </div>
            <div>
              <label class="form-label">Business Name</label>
              <input id="prof-biz" type="text" class="form-input w-full" value="${escHtml(u.business_name||'')}" placeholder="Your Business Name"/>
            </div>
            <div>
              <label class="form-label">Email Address</label>
              <input id="prof-email" type="email" class="form-input w-full" value="${escHtml(u.email||'')}" placeholder="you@yourbusiness.com"/>
            </div>
            <div>
              <label class="form-label">Phone Number</label>
              <input id="prof-phone" type="tel" class="form-input w-full" value="${escHtml(u.phone||'')}" placeholder="(555) 555-5555"/>
            </div>
            <div>
              <label class="form-label">Timezone</label>
              <select id="prof-tz" class="form-input w-full">
                ${['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','America/Phoenix'].map(tz=>
                  `<option value="${tz}" ${(u.timezone||'America/Chicago')===tz?'selected':''}>${tz.replace('America/','').replace('Pacific/','Pacific/')}</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label class="form-label">Role</label>
              <input type="text" class="form-input w-full bg-gray-900 text-gray-500" value="${escHtml(u.role||'admin')}" disabled/>
            </div>
          </div>
          <div>
            <label class="form-label">Bio / Notes</label>
            <textarea id="prof-bio" class="form-input w-full h-24 resize-none" placeholder="Brief bio or notes about your business...">${escHtml(u.bio||'')}</textarea>
          </div>
          <div class="flex gap-3 pt-2 border-t border-gray-800">
            <button onclick="saveProfile()" class="btn-primary flex items-center gap-2">
              <i class="fas fa-save"></i> Save Profile
            </button>
            <button onclick="renderSettings()" class="btn-secondary">
              <i class="fas fa-undo"></i> Reset
            </button>
          </div>
        </div>
      </div>`,

    // ── API Keys ─────────────────────────────────────────────────────────────
    'api-keys': `
      <div class="space-y-6">
        <div class="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 flex gap-3">
          <i class="fas fa-info-circle text-blue-400 mt-0.5 flex-shrink-0"></i>
          <p class="text-sm text-blue-300">API keys are stored encrypted in your database. They are never exposed in full — only the first 6 characters are shown after saving. Click a field and retype to update.</p>
        </div>

        <!-- OpenAI -->
        <div class="card space-y-4">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-8 h-8 rounded-lg bg-emerald-900/50 border border-emerald-700 flex items-center justify-center"><i class="fas fa-brain text-emerald-400 text-sm"></i></div>
            <div><h3 class="font-bold text-white text-sm">OpenAI</h3><p class="text-xs text-gray-500">Deep research, AI copywriting, outreach personalization</p></div>
            <a href="https://platform.openai.com/api-keys" target="_blank" class="ml-auto text-xs text-blue-400 hover:text-blue-300"><i class="fas fa-external-link-alt mr-1"></i>Get Key</a>
          </div>
          ${apiRow('OpenAI API Key','openai_api_key','s-openai','sk-proj-...','Powers AI research + email/SMS personalization. GPT-4o-mini. ~$0.001/lead.')}
        </div>

        <!-- Google Maps -->
        <div class="card space-y-4">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-8 h-8 rounded-lg bg-red-900/50 border border-red-700 flex items-center justify-center"><i class="fab fa-google text-red-400 text-sm"></i></div>
            <div><h3 class="font-bold text-white text-sm">Google Maps / Places</h3><p class="text-xs text-gray-500">Auto-Prospector lead discovery engine</p></div>
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" class="ml-auto text-xs text-blue-400 hover:text-blue-300"><i class="fas fa-external-link-alt mr-1"></i>Get Key</a>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Google Maps API Key</label>
            <div class="flex gap-2">
              <input id="s-gmaps" type="password" class="form-input flex-1 font-mono text-sm"
                value="${escHtml(settingsData.prospector.google_maps_api_key||'')}" placeholder="AIza..."
                onfocus="if(this.value.includes('••')){this.value=''}"/>
              <button onclick="saveProspectorKey('google_maps_api_key','s-gmaps')" class="btn-secondary px-4 text-sm whitespace-nowrap">
                <i class="fas fa-save mr-1"></i>Save
              </button>
            </div>
            <p class="text-xs text-gray-500">Enable: Places API, Maps JavaScript API, Geocoding API. Free tier = 28,000 calls/month.</p>
          </div>
        </div>

        <!-- SendGrid -->
        <div class="card space-y-4">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-8 h-8 rounded-lg bg-blue-900/50 border border-blue-700 flex items-center justify-center"><i class="fas fa-envelope text-blue-400 text-sm"></i></div>
            <div><h3 class="font-bold text-white text-sm">SendGrid</h3><p class="text-xs text-gray-500">All outreach emails + follow-up sequences</p></div>
            <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" class="ml-auto text-xs text-blue-400 hover:text-blue-300"><i class="fas fa-external-link-alt mr-1"></i>Get Key</a>
          </div>
          ${apiRow('SendGrid API Key','sendgrid_api_key','s-sendgrid','SG.xxx...','Free plan = 100 emails/day. Paid = 40,000/month for $19.95.')}
        </div>

        <!-- Twilio -->
        <div class="card space-y-4">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-8 h-8 rounded-lg bg-red-900/50 border border-red-700 flex items-center justify-center"><i class="fas fa-sms text-red-400 text-sm"></i></div>
            <div><h3 class="font-bold text-white text-sm">Twilio SMS</h3><p class="text-xs text-gray-500">SMS outreach + follow-up text messages</p></div>
            <a href="https://console.twilio.com" target="_blank" class="ml-auto text-xs text-blue-400 hover:text-blue-300"><i class="fas fa-external-link-alt mr-1"></i>Console</a>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account SID</label>
              <input id="s-twilio-sid" type="text" class="form-input font-mono text-sm" value="${escHtml(b.twilio_account_sid||'')}" placeholder="ACxxxxxxx"/>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Auth Token</label>
              <input id="s-twilio-token" type="password" class="form-input font-mono text-sm" value="${escHtml(b.twilio_auth_token||'')}" placeholder="••••••••"
                onfocus="if(this.value.includes('••')){this.value=''}"/>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">From Number</label>
              <input id="s-twilio-from" type="tel" class="form-input font-mono text-sm" value="${escHtml(b.twilio_from_number||'')}" placeholder="+15551234567"/>
            </div>
          </div>
          <button onclick="saveTwilioFromSettings()" class="btn-secondary text-sm">
            <i class="fas fa-save mr-1"></i> Save Twilio Settings
          </button>
        </div>

        <!-- Lovable -->
        <div class="card space-y-4">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-8 h-8 rounded-lg bg-pink-900/50 border border-pink-700 flex items-center justify-center"><i class="fas fa-magic text-pink-400 text-sm"></i></div>
            <div><h3 class="font-bold text-white text-sm">Lovable.dev</h3><p class="text-xs text-gray-500">AI website generation — sends prompts to build demo sites</p></div>
            <a href="https://lovable.dev" target="_blank" class="ml-auto text-xs text-blue-400 hover:text-blue-300"><i class="fas fa-external-link-alt mr-1"></i>Get Key</a>
          </div>
          ${apiRow('Lovable API Key','lovable_api_key','s-lovable','lv-...','Used to generate website demos for your leads automatically.')}
        </div>

        <!-- Google OAuth -->
        <div class="card space-y-4">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-8 h-8 rounded-lg bg-blue-900/50 border border-blue-700 flex items-center justify-center"><i class="fab fa-google text-blue-400 text-sm"></i></div>
            <div><h3 class="font-bold text-white text-sm">Google OAuth (Sign In with Google)</h3><p class="text-xs text-gray-500">Enables Google sign-in for your profile and team members</p></div>
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" class="ml-auto text-xs text-blue-400 hover:text-blue-300"><i class="fas fa-external-link-alt mr-1"></i>Setup</a>
          </div>
          ${apiRow('OAuth Client ID','google_oauth_client_id','s-gclient','123456-abcdef.apps.googleusercontent.com','Create OAuth 2.0 credentials → Web Application type.')}
          ${apiRow('OAuth Client Secret','google_oauth_client_secret','s-gsecret','GOCSPX-...','Keep this secret. Never share it publicly.')}
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Redirect URI (add this to Google Console)</label>
            <div class="flex gap-2 items-center bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
              <code class="text-xs text-green-400 flex-1">${window.location.origin}/api/settings/google-callback</code>
              <button onclick="navigator.clipboard.writeText('${window.location.origin}/api/settings/google-callback');showToast('Copied!','success')" class="text-gray-400 hover:text-white">
                <i class="fas fa-copy text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>`,

    // ── Outreach Settings ─────────────────────────────────────────────────────
    'outreach': `
      <div class="space-y-6">
        <!-- Contact Info -->
        <div class="card space-y-4">
          <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-address-card text-blue-400"></i> Your Contact Info (appears in every email/SMS)</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="form-label">Your Full Name</label>
              <input id="s-owner-name" type="text" class="form-input w-full" value="${escHtml(b.owner_name||'')}" placeholder="Eric Thompson"/>
            </div>
            <div>
              <label class="form-label">Your Phone</label>
              <input id="s-owner-phone" type="tel" class="form-input w-full" value="${escHtml(b.owner_phone||'')}" placeholder="(985) 860-7891"/>
            </div>
            <div>
              <label class="form-label">Your Email</label>
              <input id="s-owner-email" type="email" class="form-input w-full" value="${escHtml(b.owner_email||'')}" placeholder="you@email.com"/>
            </div>
            <div>
              <label class="form-label">Default Package</label>
              <select id="s-default-pkg" class="form-input w-full">
                ${['Starter','Professional','Premium','Enterprise'].map(pkg=>`<option value="${pkg}" ${(b.default_package||'Professional')===pkg?'selected':''}>${pkg}</option>`).join('')}
              </select>
            </div>
          </div>
          <button onclick="saveOutreachContactInfo()" class="btn-primary text-sm"><i class="fas fa-save mr-1"></i> Save Contact Info</button>
        </div>

        <!-- Email Settings -->
        <div class="card space-y-4">
          <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-envelope text-blue-400"></i> Email Settings</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="form-label">From Name</label>
              <input id="s-from-name" type="text" class="form-input w-full" value="${escHtml(b.from_name||b.owner_name||'')}" placeholder="Eric at WebPro Agency"/>
            </div>
            <div>
              <label class="form-label">From Email</label>
              <input id="s-from-email" type="email" class="form-input w-full" value="${escHtml(b.from_email||b.owner_email||'')}" placeholder="eric@webproagency.com"/>
            </div>
            <div>
              <label class="form-label">Reply-To Email</label>
              <input id="s-reply-to" type="email" class="form-input w-full" value="${escHtml(b.reply_to||b.owner_email||'')}" placeholder="replies@webproagency.com"/>
            </div>
          </div>
          <button onclick="saveEmailSettings()" class="btn-secondary text-sm"><i class="fas fa-save mr-1"></i> Save Email Settings</button>
        </div>

        <!-- Automation Toggles -->
        <div class="card space-y-4">
          <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-robot text-purple-400"></i> Automation Toggles</h3>
          <div class="space-y-4">
            ${[
              ['auto_send_outreach','Auto-Send Outreach','Automatically email + SMS leads when research completes'],
              ['auto_followup','Auto Follow-Up Sequences','Start 14-day follow-up automatically after outreach'],
              ['auto_research','Auto Deep Research','Research every new lead automatically on creation'],
            ].map(([key, label, desc]) => `
              <div class="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                <div>
                  <p class="text-sm font-semibold text-white">${label}</p>
                  <p class="text-xs text-gray-500">${desc}</p>
                </div>
                ${togBtn(key, b)}
              </div>`).join('')}
          </div>
        </div>
      </div>`,

    // ── Prospector Settings ───────────────────────────────────────────────────
    'prospector': `
      <div class="space-y-6">
        <!-- Engine controls -->
        <div class="card space-y-4">
          <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-robot text-green-400"></i> Auto-Prospector Engine</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="form-label">Daily Run Time (UTC)</label>
              <select id="s-cron" class="form-input w-full" onchange="saveProspectorSettingDirect('cron_time',this.value)">
                ${['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'].map(t=>
                  `<option value="${t}" ${(p.cron_time||'06:00')===t?'selected':''}>${t} UTC</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label class="form-label">Max Results Per ZIP</label>
              <input id="s-max-results" type="number" min="5" max="60" class="form-input w-full"
                value="${p.max_results_per_zip||20}"
                onchange="saveProspectorSettingDirect('max_results_per_zip',this.value)"/>
            </div>
            <div>
              <label class="form-label">Max ZIPs Per Run</label>
              <input id="s-max-zips" type="number" min="1" max="10" class="form-input w-full"
                value="${p.max_zips_per_run||3}"
                onchange="saveProspectorSettingDirect('max_zips_per_run',this.value)"/>
            </div>
            <div>
              <label class="form-label">Min Rating Filter</label>
              <input id="s-min-rating" type="number" min="0" max="5" step="0.5" class="form-input w-full"
                value="${p.min_rating||3.0}"
                onchange="saveProspectorSettingDirect('min_rating',this.value)"/>
              <p class="text-xs text-gray-500 mt-1">Only prospect businesses rated above this threshold</p>
            </div>
          </div>
        </div>

        <!-- Toggles -->
        <div class="card space-y-4">
          <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-sliders-h text-blue-400"></i> Filter Settings</h3>
          <div class="space-y-4">
            ${[
              ['skip_has_website','Skip Businesses With Websites','Only prospect businesses that have no website'],
              ['auto_advance_zip','Auto-Advance ZIP Codes','Move to next ZIP when current one is exhausted'],
              ['skip_low_rating','Skip Low-Rated Businesses','Filter out businesses below minimum rating'],
            ].map(([key, label, desc]) => `
              <div class="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                <div>
                  <p class="text-sm font-semibold text-white">${label}</p>
                  <p class="text-xs text-gray-500">${desc}</p>
                </div>
                ${togBtn(key, p, 'prospector')}
              </div>`).join('')}
          </div>
        </div>

        <!-- Target Industries -->
        <div class="card space-y-4">
          <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-industry text-orange-400"></i> Target Industries</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2" id="s-industries-grid">
            ${['restaurant','salon','plumber','electrician','dentist','lawyer','gym','mechanic','landscaping','roofing','cleaning','photography','bakery','florist','pet grooming','chiropractor','real estate','insurance','accounting','hvac'].map(ind => {
              const checked = (p.target_industries||'').includes(ind)
              return `<label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-800 transition-all">
                <input type="checkbox" ${checked?'checked':''} value="${ind}" onchange="saveIndustriesFromSettings()" class="rounded border-gray-600 text-violet-600 focus:ring-violet-500"/>
                <span class="text-sm text-gray-300 capitalize">${ind}</span>
              </label>`
            }).join('')}
          </div>
        </div>

        <!-- ZIP Queue -->
        <div class="card space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-map-marker-alt text-red-400"></i> ZIP Code Queue</h3>
            <button onclick="loadSettingsZipQueue()" class="btn-secondary btn-sm"><i class="fas fa-sync-alt mr-1"></i>Refresh</button>
          </div>
          <div class="flex gap-2">
            <input id="s-zip-input" type="text" class="form-input flex-1" placeholder="Enter ZIP code (e.g. 70360)"/>
            <input id="s-zip-city" type="text" class="form-input w-36" placeholder="City"/>
            <input id="s-zip-state" type="text" class="form-input w-20" placeholder="LA"/>
            <button onclick="addZipCode()" class="btn-primary px-4 whitespace-nowrap"><i class="fas fa-plus mr-1"></i>Add</button>
          </div>
          <div id="s-zip-list" class="space-y-2 max-h-64 overflow-y-auto">
            <div class="text-center text-gray-600 text-sm py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading ZIPs...</div>
          </div>
        </div>
      </div>`,

    // ── Payments ──────────────────────────────────────────────────────────────
    'payments': `
      <div class="space-y-6">
        <div class="card space-y-4">
          <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-credit-card text-emerald-400"></i> Stripe Configuration</h3>
          ${apiRow('Stripe Secret Key','stripe_secret_key','s-stripe-secret','sk_live_... or sk_test_...','Used server-side for creating payment intents. Never exposed to clients.')}
          ${apiRow('Stripe Publishable Key','stripe_pub_key','s-stripe-pub','pk_live_... or pk_test_...','Safe to use on the frontend for Stripe.js elements.')}
          ${apiRow('Stripe Webhook Secret','stripe_webhook_secret','s-stripe-webhook','whsec_...','From Stripe Dashboard → Webhooks. Verifies incoming webhook events.')}
        </div>

        <div class="card space-y-4">
          <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-link text-blue-400"></i> Stripe Payment Links (pre-created in Stripe Dashboard)</h3>
          <p class="text-sm text-gray-400">Create Payment Links in your Stripe Dashboard, then paste the URLs here. They are used in proposals and sent directly to clients.</p>
          <div class="space-y-3">
            ${[['Starter — $799','stripe_starter_link','s-stripe-starter'],['Professional — $1,497','stripe_professional_link','s-stripe-pro'],['Premium — $2,997','stripe_premium_link','s-stripe-premium'],['Enterprise — $5,997','stripe_enterprise_link','s-stripe-enterprise']].map(([label,key,id])=>`
              <div>
                <label class="form-label">${label}</label>
                <input id="${id}" type="url" class="form-input w-full" value="${escHtml(b[key]||'')}" placeholder="https://buy.stripe.com/..."/>
              </div>`).join('')}
          </div>
          <button onclick="saveStripeLinksFromSettings()" class="btn-primary text-sm"><i class="fas fa-save mr-1"></i> Save Payment Links</button>
        </div>
      </div>`,

    // ── Team Members ──────────────────────────────────────────────────────────
    'members': `
      <div class="space-y-6">
        <div class="card space-y-4">
          <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-user-plus text-green-400"></i> Invite Team Member</h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input id="m-name" type="text" class="form-input" placeholder="Full Name"/>
            <input id="m-email" type="email" class="form-input" placeholder="email@company.com"/>
            <select id="m-role" class="form-input">
              <option value="viewer">Viewer — read only</option>
              <option value="manager">Manager — create/edit</option>
              <option value="admin">Admin — full access</option>
            </select>
          </div>
          <button onclick="inviteMember()" class="btn-primary text-sm"><i class="fas fa-paper-plane mr-1"></i> Send Invitation</button>
        </div>
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-users text-blue-400"></i> Team Members</h3>
            <button onclick="loadMembersTable()" class="btn-secondary btn-sm"><i class="fas fa-sync-alt mr-1"></i>Refresh</button>
          </div>
          <div id="s-members-table">
            <div class="text-center py-8 text-gray-600"><i class="fas fa-spinner fa-spin text-2xl mb-2 block"></i>Loading members...</div>
          </div>
        </div>
      </div>`,

    // ── System / Danger ───────────────────────────────────────────────────────
    'danger': `
      <div class="space-y-6">
        <!-- App info -->
        <div class="card space-y-3">
          <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-info-circle text-blue-400"></i> System Information</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            ${[
              ['App Name','Google Money Drop'],
              ['Version','2.0.0'],
              ['Platform','Cloudflare Pages'],
              ['Database','D1 SQLite'],
            ].map(([k,v])=>`
              <div class="bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 mb-1">${k}</p>
                <p class="text-sm font-semibold text-white">${v}</p>
              </div>`).join('')}
          </div>
        </div>

        <!-- Data management -->
        <div class="card space-y-4">
          <h3 class="font-bold text-white text-base flex items-center gap-2"><i class="fas fa-database text-yellow-400"></i> Data Management</h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-gray-700">
              <div>
                <p class="text-sm font-semibold text-white">Export All Leads</p>
                <p class="text-xs text-gray-500">Download a CSV of all leads in the system</p>
              </div>
              <button onclick="exportLeadsCSV()" class="btn-secondary text-sm"><i class="fas fa-download mr-1"></i>Export CSV</button>
            </div>
            <div class="flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-gray-700">
              <div>
                <p class="text-sm font-semibold text-white">Clear All API Keys</p>
                <p class="text-xs text-gray-500">Reset all stored API keys — does not delete leads or clients</p>
              </div>
              <button onclick="clearAllApiKeys()" class="bg-orange-900/40 text-orange-400 border border-orange-700 hover:bg-orange-900/60 px-4 py-2 rounded-lg text-sm font-semibold transition-all">
                <i class="fas fa-eraser mr-1"></i>Clear Keys
              </button>
            </div>
          </div>
        </div>

        <!-- Danger zone -->
        <div class="border border-red-800/50 rounded-xl p-5 bg-red-900/10 space-y-4">
          <h3 class="font-bold text-red-400 text-base flex items-center gap-2"><i class="fas fa-exclamation-triangle"></i> Danger Zone</h3>
          <p class="text-sm text-gray-400">These actions are <strong class="text-red-400">irreversible</strong>. Double-check before proceeding.</p>
          <div class="space-y-3">
            <div class="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-red-900/50">
              <div>
                <p class="text-sm font-semibold text-white">Reset All Sequences</p>
                <p class="text-xs text-gray-500">Cancel all active follow-up sequences and mark as cancelled</p>
              </div>
              <button onclick="if(confirm('Cancel ALL follow-up sequences?'))api('POST','/builder/followup/cancel-all').then(()=>showToast('All sequences cancelled','success'))"
                class="bg-red-900/40 text-red-400 border border-red-700 hover:bg-red-900/60 px-4 py-2 rounded-lg text-sm font-semibold transition-all">
                <i class="fas fa-ban mr-1"></i>Cancel All
              </button>
            </div>
          </div>
        </div>
      </div>`
  }[settingsTab] || '<p class="text-gray-500">Select a tab</p>'

  setContent(`
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-white flex items-center gap-2"><i class="fas fa-cog text-gray-400"></i> Settings</h2>
          <p class="text-gray-500 text-sm mt-0.5">Control every aspect of the Google Money Drop system</p>
        </div>
      </div>

      <!-- Tab nav -->
      <div class="flex gap-1 flex-wrap border-b border-gray-800 pb-0">
        ${tabs.map(t => `
          <button onclick="switchSettingsTab('${t.k}')"
            class="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-all whitespace-nowrap
              ${settingsTab===t.k ? 'border-violet-500 text-violet-400 bg-violet-900/10' : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}">
            <i class="fas fa-${t.icon}"></i>${t.label}
          </button>`).join('')}
      </div>

      <!-- Tab content -->
      <div id="settings-tab-content">
        ${tabContent}
      </div>
    </div>
  `)

  // Load deferred data
  if (settingsTab === 'prospector') loadSettingsZipQueue()
  if (settingsTab === 'members')    loadMembersTable()
}

function switchSettingsTab(tab) {
  settingsTab = tab
  renderSettings()
}

// ── Settings action handlers ──────────────────────────────────────────────────
async function saveSettingKey(key, inputId) {
  const val = document.getElementById(inputId)?.value.trim()
  if (!val || val.includes('••')) { showToast('Enter a valid key','error'); return }
  await api('PUT', '/settings/builder', { [key]: val })
  showToast('✓ Key saved','success')
  renderSettings()
}

async function saveProspectorKey(key, inputId) {
  const val = document.getElementById(inputId)?.value.trim()
  if (!val || val.includes('••')) { showToast('Enter a valid key','error'); return }
  await api('PUT', '/settings/prospector', { [key]: val })
  showToast('✓ Key saved','success')
  renderSettings()
}

async function saveProspectorSettingDirect(key, value) {
  await api('PUT', '/settings/prospector', { [key]: value })
  showToast('✓ Saved','success')
}

async function toggleSettingFromPage(key, src='builder') {
  const btn = document.getElementById('stog-' + key)
  const isOn = btn?.classList.contains('bg-violet-600')
  const newVal = isOn ? '0' : '1'
  if (src === 'prospector') {
    await api('PUT', '/settings/prospector', { [key]: newVal })
  } else {
    await api('PUT', '/settings/builder', { [key]: newVal })
  }
  // update toggle UI instantly
  if (btn) {
    btn.classList.toggle('bg-violet-600', !isOn)
    btn.classList.toggle('bg-gray-700', isOn)
    const dot = btn.querySelector('span')
    if (dot) { dot.classList.toggle('translate-x-6', !isOn); dot.classList.toggle('translate-x-0', isOn) }
  }
  showToast('✓ Setting updated','success')
}

async function saveOutreachContactInfo() {
  const payload = {
    owner_name:      document.getElementById('s-owner-name')?.value.trim(),
    owner_phone:     document.getElementById('s-owner-phone')?.value.trim(),
    owner_email:     document.getElementById('s-owner-email')?.value.trim(),
    default_package: document.getElementById('s-default-pkg')?.value,
  }
  await api('PUT', '/settings/builder', payload)
  // Also update sidebar display
  await refreshSidebarProfile()
  showToast('✓ Contact info saved','success')
}

async function saveEmailSettings() {
  const payload = {
    from_name:  document.getElementById('s-from-name')?.value.trim(),
    from_email: document.getElementById('s-from-email')?.value.trim(),
    reply_to:   document.getElementById('s-reply-to')?.value.trim(),
  }
  await api('PUT', '/settings/builder', payload)
  showToast('✓ Email settings saved','success')
}

async function saveTwilioFromSettings() {
  const payload = {
    twilio_account_sid:  document.getElementById('s-twilio-sid')?.value.trim(),
    twilio_auth_token:   document.getElementById('s-twilio-token')?.value.trim(),
    twilio_from_number:  document.getElementById('s-twilio-from')?.value.trim(),
  }
  await api('PUT', '/settings/builder', payload)
  showToast('✓ Twilio settings saved','success')
}

async function saveIndustriesFromSettings() {
  const checked = [...document.querySelectorAll('#s-industries-grid input[type=checkbox]:checked')].map(el => el.value)
  await api('PUT', '/settings/prospector', { target_industries: checked.join(',') })
  showToast('✓ Industries saved','success')
}

async function saveStripeLinksFromSettings() {
  const payload = {
    stripe_starter_link:      document.getElementById('s-stripe-starter')?.value.trim(),
    stripe_professional_link: document.getElementById('s-stripe-pro')?.value.trim(),
    stripe_premium_link:      document.getElementById('s-stripe-premium')?.value.trim(),
    stripe_enterprise_link:   document.getElementById('s-stripe-enterprise')?.value.trim(),
  }
  await api('PUT', '/settings/builder', payload)
  showToast('✓ Stripe payment links saved','success')
}

async function setAvatarColor(color) {
  settingsData.profile.avatar_color = color
  await api('PUT', '/settings/profile', { ...settingsData.profile, avatar_color: color })
  showToast(`✓ Avatar color set to ${color}`,'success')
  renderSettings()
}

async function saveProfile() {
  const payload = {
    full_name:     document.getElementById('prof-name')?.value.trim(),
    business_name: document.getElementById('prof-biz')?.value.trim(),
    email:         document.getElementById('prof-email')?.value.trim(),
    phone:         document.getElementById('prof-phone')?.value.trim(),
    bio:           document.getElementById('prof-bio')?.value.trim(),
    timezone:      document.getElementById('prof-tz')?.value,
    avatar_color:  settingsData.profile.avatar_color,
  }
  const result = await api('PUT', '/settings/profile', payload)
  showToast('✓ Profile saved','success')
  await refreshSidebarProfile()
  renderSettings()
}

async function refreshSidebarProfile() {
  try {
    const u = await api('GET', '/settings/profile')
    const nameEl = document.getElementById('sidebar-user-name')
    const roleEl = document.getElementById('sidebar-user-role')
    const avatarEl = document.getElementById('sidebar-user-avatar')
    const avatarSmEl = document.getElementById('sidebar-user-avatar-sm')
    if (nameEl) nameEl.textContent = u.business_name || 'Your Business'
    if (roleEl) roleEl.textContent = u.role || 'Admin'
    const initials = u.avatar_initials || 'YB'
    if (avatarEl) avatarEl.textContent = initials
    if (avatarSmEl) avatarSmEl.textContent = initials
  } catch(e) {}
}

async function connectGoogle() {
  try {
    const { url, error } = await api('GET', '/settings/google-auth-url')
    if (error) { showToast(error, 'error'); return }
    const popup = window.open(url, 'google-auth', 'width=500,height=600,left=200,top=100')
    window.addEventListener('message', async function handler(e) {
      if (e.data?.type === 'google-auth-success') {
        window.removeEventListener('message', handler)
        showToast(`✓ Connected as ${e.data.name}`, 'success')
        renderSettings()
      } else if (e.data?.type === 'google-auth-error') {
        window.removeEventListener('message', handler)
        showToast('Google sign-in failed: ' + e.data.error, 'error')
      }
    })
  } catch(e) { showToast('Failed to start Google auth: ' + e.message, 'error') }
}

async function disconnectGoogle() {
  if (!confirm('Disconnect your Google account from this profile?')) return
  await api('POST', '/settings/disconnect-google')
  showToast('✓ Google account disconnected','success')
  renderSettings()
}

async function loadSettingsZipQueue() {
  const container = document.getElementById('s-zip-list')
  if (!container) return
  try {
    const zips = await api('GET', '/settings/zip-queue')
    if (!zips.length) {
      container.innerHTML = '<div class="text-center text-gray-600 text-sm py-4"><i class="fas fa-map-marker-alt text-2xl mb-2 block"></i>No ZIP codes queued. Add one above.</div>'
      return
    }
    container.innerHTML = zips.map(z => `
      <div class="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2.5 border border-gray-700">
        <div class="w-8 h-8 rounded-full ${z.status==='active' ? 'bg-green-900/50 text-green-400' : z.status==='completed' ? 'bg-gray-700 text-gray-500' : 'bg-blue-900/50 text-blue-400'} flex items-center justify-center text-xs font-bold flex-shrink-0">
          ${z.status==='active'?'▶':z.status==='completed'?'✓':'⏳'}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-white">${escHtml(z.zip)} <span class="text-gray-400 font-normal">${escHtml(z.city||'')}${z.state?', '+escHtml(z.state):''}</span></p>
          <p class="text-xs text-gray-500">${z.leads_found||0} leads found · ${z.status}</p>
        </div>
        <button onclick="deleteZip('${escHtml(z.zip)}')" class="text-gray-600 hover:text-red-400 transition-colors">
          <i class="fas fa-trash text-xs"></i>
        </button>
      </div>`).join('')
  } catch(e) {
    container.innerHTML = `<p class="text-red-400 text-sm py-2">Failed to load ZIPs: ${e.message}</p>`
  }
}

async function addZipCode() {
  const zip   = document.getElementById('s-zip-input')?.value.trim()
  const city  = document.getElementById('s-zip-city')?.value.trim()
  const state = document.getElementById('s-zip-state')?.value.trim()
  if (!zip) { showToast('Enter a ZIP code','error'); return }
  await api('POST', '/settings/zip-queue', { zip, city, state })
  showToast(`✓ ZIP ${zip} added to queue`,'success')
  document.getElementById('s-zip-input').value = ''
  document.getElementById('s-zip-city').value  = ''
  document.getElementById('s-zip-state').value = ''
  loadSettingsZipQueue()
}

async function deleteZip(zip) {
  if (!confirm(`Remove ZIP ${zip} from queue?`)) return
  await api('DELETE', `/settings/zip-queue/${zip}`)
  showToast(`✓ ZIP ${zip} removed`,'success')
  loadSettingsZipQueue()
}

async function inviteMember() {
  const full_name = document.getElementById('m-name')?.value.trim()
  const email     = document.getElementById('m-email')?.value.trim()
  const role      = document.getElementById('m-role')?.value
  if (!email) { showToast('Email required','error'); return }
  try {
    const result = await api('POST', '/settings/members', { full_name, email, role })
    showToast(result.message || `✓ ${email} invited`,'success')
    document.getElementById('m-name').value  = ''
    document.getElementById('m-email').value = ''
    loadMembersTable()
  } catch(e) { showToast(e.message||'Failed to invite member','error') }
}

async function loadMembersTable() {
  const container = document.getElementById('s-members-table')
  if (!container) return
  try {
    const members = await api('GET', '/settings/members')
    if (!members.length) {
      container.innerHTML = `
        <div class="text-center py-10 text-gray-600">
          <i class="fas fa-users text-4xl mb-3 block"></i>
          <p class="text-sm">No team members yet.</p>
          <p class="text-xs mt-1">Use the form above to invite your first team member.</p>
        </div>`
      return
    }
    const roleColors = { admin:'bg-red-900/50 text-red-400 border-red-700', manager:'bg-blue-900/50 text-blue-400 border-blue-700', viewer:'bg-gray-800 text-gray-400 border-gray-700' }
    const statusColors = { active:'text-green-400', invited:'text-yellow-400', suspended:'text-red-400' }
    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-800">
              <th class="text-left text-xs text-gray-500 uppercase tracking-wider pb-3 font-semibold">Member</th>
              <th class="text-left text-xs text-gray-500 uppercase tracking-wider pb-3 font-semibold">Role</th>
              <th class="text-left text-xs text-gray-500 uppercase tracking-wider pb-3 font-semibold">Status</th>
              <th class="text-left text-xs text-gray-500 uppercase tracking-wider pb-3 font-semibold">Invited</th>
              <th class="pb-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            ${members.map(m => `
              <tr class="hover:bg-gray-800/50 transition-colors">
                <td class="py-3 pr-4">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-${m.avatar_color||'blue'}-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      ${escHtml(m.avatar_initials||m.full_name.slice(0,2).toUpperCase())}
                    </div>
                    <div>
                      <p class="font-semibold text-white">${escHtml(m.full_name)}</p>
                      <p class="text-xs text-gray-500">${escHtml(m.email)}</p>
                    </div>
                  </div>
                </td>
                <td class="py-3 pr-4">
                  <select onchange="updateMemberRole(${m.id}, this.value)" class="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-300">
                    <option value="viewer"  ${m.role==='viewer'  ?'selected':''}>Viewer</option>
                    <option value="manager" ${m.role==='manager' ?'selected':''}>Manager</option>
                    <option value="admin"   ${m.role==='admin'   ?'selected':''}>Admin</option>
                  </select>
                </td>
                <td class="py-3 pr-4">
                  <span class="text-xs font-semibold ${statusColors[m.status]||'text-gray-400'} capitalize">${m.status}</span>
                </td>
                <td class="py-3 pr-4 text-xs text-gray-500">${fmtDate(m.invited_at)}</td>
                <td class="py-3 text-right">
                  <button onclick="removeMember(${m.id},'${escHtml(m.email)}')" class="text-gray-600 hover:text-red-400 transition-colors px-2">
                    <i class="fas fa-trash text-xs"></i>
                  </button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`
  } catch(e) {
    container.innerHTML = `<p class="text-red-400 text-sm p-4">Failed to load members: ${e.message}</p>`
  }
}

async function updateMemberRole(id, role) {
  await api('PUT', `/settings/members/${id}`, { role })
  showToast(`✓ Role updated to ${role}`,'success')
}

async function removeMember(id, email) {
  if (!confirm(`Remove ${email} from your team?`)) return
  await api('DELETE', `/settings/members/${id}`)
  showToast(`✓ ${email} removed`,'success')
  loadMembersTable()
}

async function exportLeadsCSV() {
  const leads = await api('GET', '/leads?limit=9999')
  const rows = [
    ['ID','Business','Industry','City','Phone','Email','Status','Source','Created'],
    ...leads.map(l => [l.id, l.business_name, l.industry, l.city, l.phone||'', l.email||'', l.status, l.source||'', fmtDate(l.created_at)])
  ]
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
  showToast(`✓ Exported ${leads.length} leads`,'success')
}

async function clearAllApiKeys() {
  if (!confirm('This will clear all stored API keys.\n\nYou will need to re-enter them to restore functionality.\n\nContinue?')) return
  const keys = ['openai_api_key','sendgrid_api_key','twilio_auth_token','lovable_api_key','stripe_secret_key','stripe_webhook_secret']
  const payload = {}
  keys.forEach(k => payload[k] = '')
  await api('PUT', '/settings/builder', payload)
  showToast('✓ All API keys cleared','success')
  renderSettings()
}

// ============================================================================
// PROFILE PAGE — user info, Google auth, team overview
// ============================================================================
async function renderProfile() {
  setContent(`<div class="flex items-center justify-center h-48"><div class="spinner"></div></div>`)
  try {
    const [profile, members] = await Promise.all([
      api('GET', '/settings/profile'),
      api('GET', '/settings/members'),
    ])
    _renderProfileUI(profile, members)
  } catch(e) {
    setContent(`<div class="text-center py-12 text-red-400"><i class="fas fa-exclamation-triangle text-3xl mb-3 block"></i>Failed to load profile: ${e.message}</div>`)
  }
}

function _renderProfileUI(u, members) {
  const colorMap = {
    green:'from-green-400 to-emerald-600', blue:'from-blue-400 to-blue-600',
    purple:'from-purple-400 to-purple-600', pink:'from-pink-400 to-rose-600',
    orange:'from-orange-400 to-orange-600', red:'from-red-400 to-red-600',
    yellow:'from-yellow-400 to-amber-500', teal:'from-teal-400 to-teal-600'
  }
  const grad = colorMap[u.avatar_color||'green'] || colorMap.green

  setContent(`
    <div class="space-y-6 max-w-4xl mx-auto">

      <!-- Profile hero -->
      <div class="card bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-br from-violet-900/20 to-transparent pointer-events-none"></div>
        <div class="relative flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6">
          <!-- Avatar -->
          <div class="flex flex-col items-center gap-3 flex-shrink-0">
            <div class="w-28 h-28 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-4xl font-black text-white shadow-2xl ring-4 ring-white/10">
              ${u.google_picture
                ? `<img src="${escHtml(u.google_picture)}" class="w-full h-full rounded-full object-cover" alt="avatar"/>`
                : escHtml(u.avatar_initials||'YB')}
            </div>
            <button onclick="navigateTo('settings')" class="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              <i class="fas fa-edit"></i> Edit Profile
            </button>
          </div>
          <!-- Info -->
          <div class="flex-1 text-center sm:text-left">
            <h2 class="text-2xl font-black text-white">${escHtml(u.full_name||'Your Name')}</h2>
            <p class="text-gray-400 text-base mt-0.5">${escHtml(u.business_name||'Your Business')}</p>
            <div class="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
              <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-700 capitalize">${escHtml(u.role||'admin')}</span>
              ${u.google_email ? `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-900/50 text-blue-400 border border-blue-700"><i class="fab fa-google mr-1"></i>Google Connected</span>` : ''}
              <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-800 text-gray-400 border border-gray-700">${escHtml(u.timezone||'America/Chicago')}</span>
            </div>
            <div class="flex gap-4 mt-4 text-sm text-gray-400 flex-wrap justify-center sm:justify-start">
              ${u.email ? `<span><i class="fas fa-envelope mr-1.5 text-gray-600"></i>${escHtml(u.email)}</span>` : ''}
              ${u.phone ? `<span><i class="fas fa-phone mr-1.5 text-gray-600"></i>${escHtml(u.phone)}</span>` : ''}
            </div>
            ${u.bio ? `<p class="text-gray-400 text-sm mt-3 max-w-lg">${escHtml(u.bio)}</p>` : ''}
          </div>
          <!-- Quick actions -->
          <div class="flex flex-col gap-2 flex-shrink-0">
            <button onclick="navigateTo('settings')" class="btn-primary text-sm whitespace-nowrap">
              <i class="fas fa-cog mr-1.5"></i> Open Settings
            </button>
            ${!u.google_email ? `
              <button onclick="connectGoogle()" class="flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold text-sm py-2 px-4 rounded-lg transition-all whitespace-nowrap">
                <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sign in with Google
              </button>` : `
              <button onclick="disconnectGoogle()" class="btn-secondary text-sm text-red-400 border-red-800 whitespace-nowrap">
                <i class="fas fa-unlink mr-1.5"></i> Disconnect Google
              </button>`}
          </div>
        </div>
      </div>

      <!-- Google account info -->
      ${u.google_email ? `
        <div class="card border border-blue-800/40 bg-blue-900/10 flex items-center gap-4 p-4">
          ${u.google_picture ? `<img src="${escHtml(u.google_picture)}" class="w-12 h-12 rounded-full flex-shrink-0" alt="Google"/>` : '<i class="fab fa-google text-blue-400 text-2xl flex-shrink-0"></i>'}
          <div>
            <p class="font-semibold text-white text-sm">Signed in with Google</p>
            <p class="text-xs text-gray-400">${escHtml(u.google_name||'')} · ${escHtml(u.google_email)}</p>
          </div>
          <button onclick="disconnectGoogle()" class="ml-auto text-xs text-red-400 hover:text-red-300 border border-red-800 rounded-lg px-3 py-1.5 transition-all">Disconnect</button>
        </div>` : ''}

      <!-- Edit form inline -->
      <div class="card space-y-4">
        <h3 class="font-bold text-white flex items-center gap-2"><i class="fas fa-user-edit text-blue-400"></i> Quick Edit Profile</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="form-label">Full Name</label>
            <input id="prof-name" type="text" class="form-input w-full" value="${escHtml(u.full_name||'')}"/>
          </div>
          <div>
            <label class="form-label">Business Name</label>
            <input id="prof-biz" type="text" class="form-input w-full" value="${escHtml(u.business_name||'')}"/>
          </div>
          <div>
            <label class="form-label">Email</label>
            <input id="prof-email" type="email" class="form-input w-full" value="${escHtml(u.email||'')}"/>
          </div>
          <div>
            <label class="form-label">Phone</label>
            <input id="prof-phone" type="tel" class="form-input w-full" value="${escHtml(u.phone||'')}"/>
          </div>
          <div>
            <label class="form-label">Timezone</label>
            <select id="prof-tz" class="form-input w-full">
              ${['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','America/Phoenix'].map(tz=>
                `<option value="${tz}" ${(u.timezone||'America/Chicago')===tz?'selected':''}>${tz.replace('_',' ')}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Avatar Color</label>
            <div class="flex gap-2 mt-1 flex-wrap">
              ${['green','blue','purple','pink','orange','red','yellow','teal'].map(c=>`
                <button onclick="setAvatarColor('${c}')" title="${c}"
                  class="w-7 h-7 rounded-full bg-${c}-500 hover:scale-110 transition-transform ring-2 ring-offset-2 ring-offset-gray-900 ${(u.avatar_color||'green')===c?'ring-white':'ring-transparent'}">
                </button>`).join('')}
            </div>
          </div>
        </div>
        <div>
          <label class="form-label">Bio</label>
          <textarea id="prof-bio" class="form-input w-full h-20 resize-none" placeholder="Brief description...">${escHtml(u.bio||'')}</textarea>
        </div>
        <div class="flex gap-3 pt-2 border-t border-gray-800">
          <button onclick="saveProfile()" class="btn-primary"><i class="fas fa-save mr-1.5"></i> Save Changes</button>
          <button onclick="navigateTo('settings')" class="btn-secondary"><i class="fas fa-cog mr-1.5"></i> Full Settings</button>
        </div>
      </div>

      <!-- Team members -->
      <div class="card">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-white flex items-center gap-2"><i class="fas fa-users text-purple-400"></i> Team Members
            <span class="ml-1 text-xs bg-gray-700 text-gray-300 rounded-full px-2 py-0.5">${members.length}</span>
          </h3>
          <button onclick="navigateTo('settings');settingsTab='members';renderSettings()" class="btn-secondary btn-sm">
            <i class="fas fa-user-plus mr-1"></i> Manage Team
          </button>
        </div>
        ${members.length === 0 ? `
          <div class="text-center py-8 text-gray-600">
            <i class="fas fa-user-friends text-4xl mb-3 block"></i>
            <p class="text-sm">No team members yet.</p>
            <button onclick="navigateTo('settings');settingsTab='members';renderSettings()" class="text-violet-400 text-xs hover:text-violet-300 mt-2 inline-flex items-center gap-1">
              <i class="fas fa-plus"></i> Invite your first team member
            </button>
          </div>` : `
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            ${members.map(m => `
              <div class="flex items-center gap-3 bg-gray-800 rounded-xl p-3 border border-gray-700">
                <div class="w-10 h-10 rounded-full bg-${m.avatar_color||'blue'}-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  ${escHtml(m.avatar_initials || m.full_name.slice(0,2).toUpperCase())}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-white truncate">${escHtml(m.full_name)}</p>
                  <p class="text-xs text-gray-500 truncate">${escHtml(m.email)}</p>
                  <span class="text-xs capitalize ${m.status==='active'?'text-green-400':m.status==='invited'?'text-yellow-400':'text-red-400'}">${m.status}</span>
                  <span class="text-xs text-gray-600 ml-2">· ${m.role}</span>
                </div>
              </div>`).join('')}
          </div>`}
      </div>

    </div>
  `)
}

// ===== INIT =====
initSidebar()
navigateTo('dashboard')
refreshSidebarProfile()

// ===== ACTIVITY TIMELINE (NEW) =====
async function renderActivity() {
  setContent(`<div class="flex items-center justify-center h-48"><div class="spinner"></div></div>`)
  const activities = await api('GET', '/analytics/recent-activity?limit=100')
  
  setContent(`
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-400">Complete timeline of all system activities</p>
        <button onclick="navigateTo('dashboard')" class="btn-secondary btn-sm">
          <i class="fas fa-arrow-left"></i> Back to Dashboard
        </button>
      </div>

      <!-- Activity Timeline -->
      <div class="card">
        <div class="space-y-0 max-h-[600px] overflow-y-auto">
          ${activities.map(a => activityItem(a)).join('') || '<p class="text-gray-600 text-sm text-center py-8">No activity yet</p>'}
        </div>
      </div>
    </div>
  `)
}

// ============================================================================
// STRIPE PAYMENT INTEGRATION
// ============================================================================

// Open payment link for proposal
async function openPaymentLink(proposalId, packageTier, amount) {
  try {
    const response = await api('POST', '/payments/create-payment-link', {
      proposal_id: proposalId,
      package_tier: packageTier,
      amount: amount
    })

    if (response.error) {
      alert(`Payment Configuration Error:\n\n${response.message || response.error}\n\nPlease configure Stripe payment links in the AI Website Builder → Settings tab.`)
      return
    }

    // Open Stripe payment link in new tab
    window.open(response.payment_link, '_blank')
    
    // Show success message
    showToast(`Payment link opened! Amount: ${fmt$(amount)}`, 'success')
    
    // Refresh proposals to show updated status
    setTimeout(() => {
      if (currentPage === 'proposals') renderProposals()
    }, 1000)
  } catch (error) {
    console.error('Payment link error:', error)
    alert('Failed to open payment link. Please check Settings → Stripe Configuration.')
  }
}

// Copy payment link to clipboard
async function copyPaymentLink(proposalId) {
  try {
    const response = await api('GET', `/payments/proposal/${proposalId}/payment-link`)
    
    if (response.error) {
      alert(response.message || response.error)
      return
    }

    // Copy to clipboard
    await navigator.clipboard.writeText(response.payment_link)
    showToast('Payment link copied to clipboard!', 'success')
  } catch (error) {
    console.error('Copy payment link error:', error)
    showToast('Failed to copy payment link', 'error')
  }
}

// Mark proposal as paid (manual verification)
async function markProposalPaid(proposalId, amount) {
  if (!confirm('Mark this proposal as PAID?\n\nThis will:\n• Update proposal status to Accepted\n• Mark lead as Won\n• Create client record\n• Generate invoice\n\nContinue?')) {
    return
  }

  try {
    const response = await api('POST', '/payments/mark-paid', {
      proposal_id: proposalId,
      amount_paid: amount,
      stripe_payment_id: `manual_${Date.now()}`
    })

    if (response.success) {
      showToast('Proposal marked as paid!', 'success')
      if (currentPage === 'proposals') renderProposals()
    } else {
      alert('Failed to mark as paid: ' + (response.error || 'Unknown error'))
    }
  } catch (error) {
    console.error('Mark paid error:', error)
    alert('Failed to mark proposal as paid')
  }
}

// Show payment status modal with link
async function showPaymentModal(proposalId) {
  try {
    const response = await api('GET', `/payments/proposal/${proposalId}/payment-link`)
    
    if (response.error) {
      alert(response.message || response.error)
      return
    }

    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.innerHTML = `
      <div class="modal-content max-w-lg">
        <div class="p-6 space-y-4">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="text-xl font-bold text-white">Payment Link</h3>
              <p class="text-sm text-gray-400 mt-1">${escHtml(response.business_name)} - ${escHtml(response.package_tier)} Package</p>
            </div>
            <button onclick="this.closest('.modal-overlay').remove()" class="text-gray-400 hover:text-white">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p class="text-3xl font-bold text-emerald-400">${fmt$(response.amount)}</p>
            <p class="text-sm text-gray-400 mt-1">Total Amount</p>
          </div>

          <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p class="text-xs text-gray-400 mb-2">Stripe Payment Link:</p>
            <div class="flex items-center gap-2">
              <input type="text" value="${escHtml(response.payment_link)}" readonly 
                     class="form-input flex-1 text-xs font-mono bg-gray-900 text-blue-400" />
              <button onclick="navigator.clipboard.writeText('${escHtml(response.payment_link)}'); showToast('Copied!', 'success')" 
                      class="btn-secondary px-3 py-2">
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>

          <div class="flex gap-3">
            <button onclick="window.open('${escHtml(response.payment_link)}', '_blank')" 
                    class="btn-primary flex-1">
              <i class="fas fa-external-link-alt"></i> Open Payment Page
            </button>
            <button onclick="markProposalPaid(${proposalId}, ${response.amount})" 
                    class="btn-secondary">
              <i class="fas fa-check"></i> Mark as Paid
            </button>
          </div>

          <p class="text-xs text-gray-500 text-center">
            Share this link with your client to collect payment via Stripe
          </p>
        </div>
      </div>
    `
    document.body.appendChild(modal)
  } catch (error) {
    console.error('Show payment modal error:', error)
    alert('Failed to load payment information')
  }
}

// Save Stripe payment links
async function saveStripeLinks() {
  try {
    await api('PUT', '/builder/config', {
      stripe_starter_link:      (document.getElementById('bcfg-stripe-starter')?.value||'').trim(),
      stripe_professional_link: (document.getElementById('bcfg-stripe-professional')?.value||'').trim(),
      stripe_premium_link:      (document.getElementById('bcfg-stripe-premium')?.value||'').trim(),
      stripe_enterprise_link:   (document.getElementById('bcfg-stripe-enterprise')?.value||'').trim(),
    })
    showToast('Stripe payment links saved! ✓', 'success')
  } catch (e) {
    showToast('Failed to save Stripe links', 'error')
  }
}

