/* =====================================================
   LocalWeb CRM – Full Frontend Application
   ===================================================== */

const API = axios.create({ baseURL: '/api' });

// ===== STATE =====
let currentPage = 'dashboard';
let allLeads = [], allClients = [], allProposals = [], allTasks = [];
let dashCharts = {};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  navigateTo('dashboard');
  setupGlobalSearch();
  setInterval(refreshBadges, 30000);
});

// ===== NAVIGATION =====
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  const titles = {
    dashboard: 'Dashboard', leads: 'Leads', pipeline: 'Pipeline',
    clients: 'Clients', proposals: 'Proposals', tasks: 'Tasks',
    revenue: 'Revenue & Analytics', scraper: 'Lead Finder'
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  const content = document.getElementById('main-content');
  content.innerHTML = '<div class="flex items-center justify-center h-64"><div class="spinner"></div></div>';

  const pages = {
    dashboard: renderDashboard,
    leads: renderLeads,
    pipeline: renderPipeline,
    clients: renderClients,
    proposals: renderProposals,
    tasks: renderTasks,
    revenue: renderRevenue,
    scraper: renderScraper,
  };
  if (pages[page]) pages[page]();
  refreshBadges();
}

// ===== BADGES =====
async function refreshBadges() {
  try {
    const [leadsRes, tasksRes] = await Promise.all([
      API.get('/leads?status=new'),
      API.get('/tasks?status=pending')
    ]);
    const newLeads = leadsRes.data.length;
    const pendingTasks = tasksRes.data.length;

    const lc = document.getElementById('nav-leads-count');
    if (lc) { lc.textContent = newLeads; lc.classList.toggle('hidden', newLeads === 0); }
    const tc = document.getElementById('nav-tasks-count');
    if (tc) { tc.textContent = pendingTasks; tc.classList.toggle('hidden', pendingTasks === 0); }
  } catch(e) {}
}

// ===== GLOBAL SEARCH =====
function setupGlobalSearch() {
  const input = document.getElementById('global-search');
  let debounce;
  input.addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const q = e.target.value.trim();
      if (q.length > 1) performGlobalSearch(q);
    }, 350);
  });
}

async function performGlobalSearch(q) {
  try {
    const [leadsRes, clientsRes] = await Promise.all([
      API.get(`/leads?search=${encodeURIComponent(q)}`),
      API.get(`/clients?search=${encodeURIComponent(q)}`)
    ]);
    // Navigate to leads if results found
    if (leadsRes.data.length > 0 || clientsRes.data.length > 0) {
      navigateTo('leads');
      setTimeout(() => {
        const s = document.getElementById('leads-search');
        if (s) { s.value = q; filterLeads(); }
      }, 300);
    }
  } catch(e) {}
}

// =====================================================
// DASHBOARD
// =====================================================
async function renderDashboard() {
  try {
    const [summaryRes, statusRes, industryRes, activityRes, revenueRes] = await Promise.all([
      API.get('/analytics/summary'),
      API.get('/analytics/leads-by-status'),
      API.get('/analytics/leads-by-industry'),
      API.get('/analytics/recent-activity'),
      API.get('/analytics/revenue-by-month'),
    ]);
    const s = summaryRes.data;
    const byStatus = statusRes.data;
    const byIndustry = industryRes.data;
    const recentActivity = activityRes.data;
    const revenueByMonth = revenueRes.data;

    document.getElementById('main-content').innerHTML = `
      <!-- KPI Row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        ${statCard('Total Leads', s.leads.total, 'fas fa-map-marker-alt', 'blue', `${s.leads.new} new`)}
        ${statCard('Active Clients', s.clients.active, 'fas fa-users', 'green', `${s.clients.total} total`)}
        ${statCard('Total Revenue', '$' + fmt(s.revenue.total), 'fas fa-dollar-sign', 'emerald', '+$' + fmt(s.revenue.monthly) + '/mo recurring')}
        ${statCard('Conversion Rate', s.leads.conversionRate + '%', 'fas fa-chart-line', 'indigo', `${s.leads.won} won / ${s.leads.lost} lost`)}
      </div>

      <!-- Second KPI Row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        ${statCard('Pipeline (In Progress)', s.leads.contacted, 'fas fa-stream', 'violet', 'Contacted + Demo + Proposal')}
        ${statCard('Open Proposals', s.proposals.sent, 'fas fa-file-invoice-dollar', 'amber', `${s.proposals.accepted} accepted`)}
        ${statCard('Monthly Recurring', '$' + fmt(s.revenue.monthly), 'fas fa-sync-alt', 'teal', '$' + fmt(s.revenue.annualRecurring) + '/yr ARR')}
        ${statCard('Pending Tasks', s.tasks.pending, 'fas fa-tasks', s.tasks.overdue > 0 ? 'red' : 'slate', s.tasks.overdue > 0 ? s.tasks.overdue + ' overdue' : 'All on track')}
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <!-- Pipeline funnel -->
        <div class="card">
          <h3 class="font-bold text-white text-sm mb-4"><i class="fas fa-funnel-dollar mr-2 text-blue-400"></i>Lead Pipeline</h3>
          <div id="pipeline-funnel" class="space-y-3"></div>
        </div>
        <!-- Revenue chart -->
        <div class="card lg:col-span-2">
          <h3 class="font-bold text-white text-sm mb-4"><i class="fas fa-chart-bar mr-2 text-green-400"></i>Monthly Revenue</h3>
          <div class="chart-wrapper" style="height:200px">
            <canvas id="revenueChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Bottom Row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Industry breakdown -->
        <div class="card">
          <h3 class="font-bold text-white text-sm mb-4"><i class="fas fa-industry mr-2 text-purple-400"></i>Leads by Industry</h3>
          <div class="chart-wrapper" style="height:200px">
            <canvas id="industryChart"></canvas>
          </div>
        </div>
        <!-- Recent Activity -->
        <div class="card lg:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-white text-sm"><i class="fas fa-bolt mr-2 text-yellow-400"></i>Recent Activity</h3>
          </div>
          <div class="space-y-1 max-h-52 overflow-y-auto pr-1">
            ${recentActivity.slice(0, 12).map(a => activityItem(a)).join('') || '<p class="text-muted text-center py-4">No activity yet</p>'}
          </div>
        </div>
      </div>
    `;

    // Pipeline funnel
    const statusOrder = ['new', 'contacted', 'demo_sent', 'proposal_sent', 'won', 'lost'];
    const statusColors = { new:'#3b82f6', contacted:'#8b5cf6', demo_sent:'#a78bfa', proposal_sent:'#c4b5fd', won:'#10b981', lost:'#ef4444' };
    const statusMap = {};
    byStatus.forEach(r => statusMap[r.status] = r.count);
    const total = s.leads.total || 1;
    const funnelContainer = document.getElementById('pipeline-funnel');
    funnelContainer.innerHTML = statusOrder.map(st => {
      const cnt = statusMap[st] || 0;
      const pct = Math.round((cnt / total) * 100);
      return `<div>
        <div class="flex justify-between text-xs mb-1">
          <span class="font-medium" style="color:${statusColors[st]}">${st.replace('_',' ').replace(/\b\w/g,l=>l.toUpperCase())}</span>
          <span class="text-gray-400">${cnt} (${pct}%)</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%;background:${statusColors[st]}"></div>
        </div>
      </div>`;
    }).join('');

    // Revenue chart
    const months = revenueByMonth.map(r => r.month ? r.month.slice(0,7) : '');
    const revenues = revenueByMonth.map(r => r.revenue || 0);
    renderChart('revenueChart', 'bar', months, revenues, '#10b981', 'Revenue ($)');

    // Industry chart
    renderChart('industryChart', 'doughnut',
      byIndustry.map(r => r.industry),
      byIndustry.map(r => r.count),
      ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16'],
      'Leads'
    );

  } catch(e) {
    console.error(e);
    document.getElementById('main-content').innerHTML = errorState('Failed to load dashboard');
  }
}

function statCard(label, value, icon, color, sub) {
  const colors = {
    blue:'from-blue-500 to-blue-700', green:'from-green-500 to-emerald-600',
    emerald:'from-emerald-400 to-green-600', indigo:'from-indigo-500 to-indigo-700',
    violet:'from-violet-500 to-purple-700', amber:'from-amber-400 to-orange-500',
    teal:'from-teal-400 to-cyan-600', red:'from-red-500 to-rose-700',
    slate:'from-slate-500 to-slate-700'
  };
  return `<div class="stat-card">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">${label}</p>
        <p class="text-2xl font-bold text-white">${value}</p>
        ${sub ? `<p class="text-xs text-gray-500 mt-1">${sub}</p>` : ''}
      </div>
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]||colors.blue} flex items-center justify-center shadow-lg flex-shrink-0">
        <i class="${icon} text-white text-sm"></i>
      </div>
    </div>
  </div>`;
}

function activityItem(a) {
  const icons = {
    lead_created:'fa-plus', status_change:'fa-exchange-alt', note_added:'fa-sticky-note',
    client_created:'fa-user-plus', proposal_sent:'fa-paper-plane', proposal_created:'fa-file-alt'
  };
  const colors = {
    lead_created:'bg-blue-900 text-blue-400', status_change:'bg-purple-900 text-purple-400',
    note_added:'bg-yellow-900 text-yellow-400', client_created:'bg-green-900 text-green-400',
    proposal_sent:'bg-indigo-900 text-indigo-400', proposal_created:'bg-violet-900 text-violet-400'
  };
  const icon = icons[a.action] || 'fa-circle';
  const color = colors[a.action] || 'bg-gray-800 text-gray-400';
  return `<div class="timeline-item">
    <div class="timeline-dot ${color}"><i class="fas ${icon}"></i></div>
    <div class="min-w-0">
      <p class="text-xs text-gray-300 leading-snug">${a.description || a.action}</p>
      <p class="text-xs text-gray-600 mt-0.5">${timeAgo(a.created_at)}</p>
    </div>
  </div>`;
}

function renderChart(canvasId, type, labels, data, color, label) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (dashCharts[canvasId]) dashCharts[canvasId].destroy();
  const isDonut = type === 'doughnut';
  dashCharts[canvasId] = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: Array.isArray(color) ? color.map(c => c + 'cc') : (isDonut ? labels.map((_, i) => ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16'][i%8] + 'cc') : color + '33'),
        borderColor: Array.isArray(color) ? color : color,
        borderWidth: isDonut ? 2 : 1.5,
        borderRadius: isDonut ? 0 : 6,
        fill: !isDonut,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: isDonut, labels: { color: '#9ca3af', font: { size: 11 }, boxWidth: 12, padding: 12 } }
      },
      scales: isDonut ? {} : {
        x: { grid: { color: '#1f2937' }, ticks: { color: '#6b7280', font: { size: 11 } } },
        y: { grid: { color: '#1f2937' }, ticks: { color: '#6b7280', font: { size: 11 } } }
      }
    }
  });
}

// =====================================================
// LEADS
// =====================================================
async function renderLeads() {
  try {
    const res = await API.get('/leads');
    allLeads = res.data;
    renderLeadsUI(allLeads);
  } catch(e) {
    document.getElementById('main-content').innerHTML = errorState('Failed to load leads');
  }
}

function renderLeadsUI(leads) {
  const statusCounts = {};
  leads.forEach(l => statusCounts[l.status] = (statusCounts[l.status]||0)+1);

  document.getElementById('main-content').innerHTML = `
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-5">
      <div class="flex flex-wrap gap-2">
        <div class="tab-bar">
          <button class="tab-btn active" onclick="filterLeadsByStatus('all', this)">All <span class="ml-1 text-xs opacity-70">${leads.length}</span></button>
          ${['new','contacted','demo_sent','proposal_sent','won','lost'].map(s =>
            `<button class="tab-btn" onclick="filterLeadsByStatus('${s}', this)">${s.replace('_',' ')} <span class="ml-1 text-xs opacity-70">${statusCounts[s]||0}</span></button>`
          ).join('')}
        </div>
      </div>
      <div class="flex gap-2 items-center">
        <input id="leads-search" type="text" placeholder="Search leads..." class="form-input" style="width:200px" oninput="filterLeads()"/>
        <select id="leads-industry" class="form-input" style="width:150px" onchange="filterLeads()">
          <option value="">All industries</option>
          ${[...new Set(allLeads.map(l=>l.industry))].sort().map(i=>`<option>${i}</option>`).join('')}
        </select>
        <button onclick="showAddLeadModal()" class="btn-primary"><i class="fas fa-plus mr-1"></i>Add Lead</button>
        <button onclick="showImportModal()" class="btn-secondary"><i class="fas fa-upload mr-1"></i>Import</button>
      </div>
    </div>

    <!-- Table -->
    <div class="card p-0 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Business</th><th>Industry</th><th>City</th>
              <th>Contact</th><th>Status</th><th>Source</th><th>Date</th><th>Actions</th>
            </tr>
          </thead>
          <tbody id="leads-tbody">
            ${renderLeadsRows(leads)}
          </tbody>
        </table>
      </div>
      ${leads.length === 0 ? emptyState('map-marker-alt', 'No leads yet', 'Add your first lead or use the Lead Finder tool') : ''}
    </div>
  `;
}

function renderLeadsRows(leads) {
  if (leads.length === 0) return `<tr><td colspan="8" class="text-center text-gray-600 py-8">No leads match filters</td></tr>`;
  return leads.map(l => `
    <tr onclick="showLeadDetail(${l.id})">
      <td>
        <div class="font-semibold text-white text-sm">${esc(l.business_name)}</div>
        ${l.owner_name ? `<div class="text-xs text-gray-500">${esc(l.owner_name)}</div>` : ''}
      </td>
      <td><span class="text-sm">${esc(l.industry)}</span></td>
      <td><span class="text-sm">${esc(l.city)}</span></td>
      <td>
        ${l.phone ? `<div class="text-xs text-gray-300"><i class="fas fa-phone mr-1 text-gray-500"></i>${esc(l.phone)}</div>` : ''}
        ${l.email ? `<div class="text-xs text-gray-400"><i class="fas fa-envelope mr-1 text-gray-500"></i>${esc(l.email)}</div>` : ''}
        ${!l.phone && !l.email ? '<span class="text-gray-600 text-xs">—</span>' : ''}
      </td>
      <td><span class="badge badge-${l.status}">${l.status.replace('_',' ')}</span></td>
      <td><span class="text-xs text-gray-500">${l.source||'—'}</span></td>
      <td><span class="text-xs text-gray-600">${fmtDate(l.created_at)}</span></td>
      <td onclick="event.stopPropagation()">
        <div class="flex gap-1 row-actions">
          <button class="btn-icon" onclick="editLead(${l.id})" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="btn-icon" onclick="showProposalModal(${l.id})" title="Proposal"><i class="fas fa-file-invoice-dollar"></i></button>
          <button class="btn-icon" onclick="convertToClient(${l.id})" title="Convert to Client"><i class="fas fa-user-plus"></i></button>
          <button class="btn-icon" onclick="deleteLead(${l.id})" title="Delete" style="color:#f87171"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

let currentLeadStatusFilter = 'all';
function filterLeadsByStatus(status, btn) {
  currentLeadStatusFilter = status;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  filterLeads();
}

function filterLeads() {
  const search = (document.getElementById('leads-search')?.value || '').toLowerCase();
  const industry = document.getElementById('leads-industry')?.value || '';
  let filtered = allLeads;
  if (currentLeadStatusFilter !== 'all') filtered = filtered.filter(l => l.status === currentLeadStatusFilter);
  if (search) filtered = filtered.filter(l =>
    l.business_name.toLowerCase().includes(search) ||
    (l.owner_name||'').toLowerCase().includes(search) ||
    (l.phone||'').includes(search) ||
    (l.city||'').toLowerCase().includes(search)
  );
  if (industry) filtered = filtered.filter(l => l.industry === industry);
  const tbody = document.getElementById('leads-tbody');
  if (tbody) tbody.innerHTML = renderLeadsRows(filtered);
}

async function showLeadDetail(id) {
  try {
    const res = await API.get(`/leads/${id}`);
    const { lead: l, activities, tasks, proposals } = res.data;
    document.getElementById('ld-title').textContent = l.business_name;
    document.getElementById('lead-detail-content').innerHTML = `
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          ${detailRow('Industry', l.industry)}
          ${detailRow('City', l.city)}
          ${detailRow('Owner', l.owner_name || '—')}
          ${detailRow('Phone', l.phone ? `<a href="tel:${l.phone}" class="text-blue-400">${l.phone}</a>` : '—')}
          ${detailRow('Email', l.email ? `<a href="mailto:${l.email}" class="text-blue-400">${l.email}</a>` : '—')}
          ${detailRow('Source', l.source || '—')}
        </div>
        <div>
          ${detailRow('Status', `<span class="badge badge-${l.status}">${l.status.replace('_',' ')}</span>`)}
          ${detailRow('Added', fmtDate(l.created_at))}
          ${l.google_maps_url ? detailRow('Maps', `<a href="${l.google_maps_url}" target="_blank" class="text-blue-400 text-xs">View on Maps</a>`) : ''}
          ${l.address ? detailRow('Address', l.address) : ''}
        </div>
      </div>
      ${l.notes ? `<div class="bg-gray-900 rounded-lg p-3 mb-4 text-sm text-gray-300"><i class="fas fa-sticky-note mr-2 text-yellow-400"></i>${esc(l.notes)}</div>` : ''}

      <!-- Quick status change -->
      <div class="mb-4">
        <label class="form-label">Update Status</label>
        <div class="flex flex-wrap gap-2 mt-1">
          ${['new','contacted','demo_sent','proposal_sent','won','lost'].map(s =>
            `<button onclick="quickUpdateLeadStatus(${l.id},'${s}')" class="btn-secondary btn-sm ${l.status===s?'border-blue-500 text-blue-400':''}">${s.replace('_',' ')}</button>`
          ).join('')}
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap gap-2 mb-4">
        <button onclick="closeModal('lead-detail-modal');editLead(${l.id})" class="btn-secondary btn-sm"><i class="fas fa-pen mr-1"></i>Edit</button>
        <button onclick="closeModal('lead-detail-modal');showProposalModal(${l.id})" class="btn-primary btn-sm"><i class="fas fa-file-invoice-dollar mr-1"></i>Create Proposal</button>
        <button onclick="closeModal('lead-detail-modal');convertToClient(${l.id})" class="btn-secondary btn-sm"><i class="fas fa-user-plus mr-1"></i>Convert to Client</button>
      </div>

      <!-- Proposals -->
      ${proposals.length > 0 ? `
        <div class="mb-4">
          <h4 class="text-xs font-bold text-gray-500 uppercase mb-2">Proposals</h4>
          ${proposals.map(p => `<div class="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2 mb-2 text-sm">
            <span class="text-white">${p.package_tier} – $${fmt(p.package_price)}</span>
            <span class="badge badge-${p.status}">${p.status}</span>
          </div>`).join('')}
        </div>` : ''}

      <!-- Timeline -->
      <div>
        <h4 class="text-xs font-bold text-gray-500 uppercase mb-2">Activity Timeline</h4>
        ${activities.length > 0
          ? `<div class="max-h-48 overflow-y-auto">${activities.map(a => activityItem(a)).join('')}</div>`
          : '<p class="text-muted">No activity recorded</p>'}
      </div>

      <!-- Add Note -->
      <div class="mt-4">
        <div class="flex gap-2">
          <input id="new-note-input" type="text" class="form-input flex-1" placeholder="Add a note..."/>
          <button onclick="addNote(${l.id})" class="btn-primary btn-sm"><i class="fas fa-plus"></i></button>
        </div>
      </div>
    `;
    openModal('lead-detail-modal');
  } catch(e) { showToast('Failed to load lead details', 'error'); }
}

async function addNote(leadId) {
  const input = document.getElementById('new-note-input');
  const note = input.value.trim();
  if (!note) return;
  try {
    await API.post(`/leads/${leadId}/notes`, { note });
    input.value = '';
    showToast('Note added');
    showLeadDetail(leadId);
  } catch(e) { showToast('Failed to add note', 'error'); }
}

async function quickUpdateLeadStatus(id, status) {
  try {
    await API.patch(`/leads/${id}/status`, { status });
    showToast('Status updated to ' + status.replace('_',' '));
    showLeadDetail(id);
    const lead = allLeads.find(l => l.id === id);
    if (lead) lead.status = status;
    filterLeads();
  } catch(e) { showToast('Failed to update status', 'error'); }
}

async function deleteLead(id) {
  if (!confirm('Delete this lead? This cannot be undone.')) return;
  try {
    await API.delete(`/leads/${id}`);
    allLeads = allLeads.filter(l => l.id !== id);
    filterLeads();
    showToast('Lead deleted');
  } catch(e) { showToast('Failed to delete lead', 'error'); }
}

async function convertToClient(leadId) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!lead) return;
  // Pre-fill client modal from lead data
  openClientModal(null, lead);
}

// =====================================================
// PIPELINE (Kanban)
// =====================================================
async function renderPipeline() {
  try {
    const res = await API.get('/leads');
    allLeads = res.data;
    renderPipelineUI(allLeads);
  } catch(e) {
    document.getElementById('main-content').innerHTML = errorState('Failed to load pipeline');
  }
}

function renderPipelineUI(leads) {
  const stages = [
    { key: 'new',           label: 'New Leads',     color: '#3b82f6', icon: 'fa-inbox' },
    { key: 'contacted',     label: 'Contacted',     color: '#8b5cf6', icon: 'fa-phone' },
    { key: 'demo_sent',     label: 'Demo Sent',     color: '#a78bfa', icon: 'fa-desktop' },
    { key: 'proposal_sent', label: 'Proposal Sent', color: '#c4b5fd', icon: 'fa-file-invoice-dollar' },
    { key: 'won',           label: 'Won',           color: '#10b981', icon: 'fa-check-circle' },
    { key: 'lost',          label: 'Lost',          color: '#ef4444', icon: 'fa-times-circle' },
  ];
  const grouped = {};
  stages.forEach(s => grouped[s.key] = []);
  leads.forEach(l => { if (grouped[l.status] !== undefined) grouped[l.status].push(l); });

  document.getElementById('main-content').innerHTML = `
    <div class="flex gap-4 overflow-x-auto pb-4" style="min-height:calc(100vh - 160px)">
      ${stages.map(stage => `
        <div class="kanban-col">
          <div class="kanban-col-header" style="border-top: 3px solid ${stage.color}">
            <div class="flex items-center gap-2" style="color:${stage.color}">
              <i class="fas ${stage.icon} text-xs"></i>
              <span>${stage.label}</span>
            </div>
            <span class="text-gray-500 text-xs font-bold">${grouped[stage.key].length}</span>
          </div>
          <div class="kanban-cards" id="kanban-${stage.key}">
            ${grouped[stage.key].map(l => kanbanCard(l, stage.color)).join('')}
            ${grouped[stage.key].length === 0 ? '<p class="text-center text-gray-700 text-xs py-4">No leads</p>' : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function kanbanCard(l, color) {
  return `<div class="kanban-card" onclick="showLeadDetail(${l.id})">
    <p class="font-semibold text-white text-xs leading-tight mb-1">${esc(l.business_name)}</p>
    <p class="text-xs text-gray-500 mb-2">${esc(l.industry)} · ${esc(l.city)}</p>
    ${l.phone ? `<p class="text-xs text-gray-400"><i class="fas fa-phone mr-1 text-gray-600"></i>${esc(l.phone)}</p>` : ''}
    <div class="flex gap-1 mt-2 flex-wrap">
      ${['contacted','demo_sent','won','lost'].map(s =>
        l.status !== s ? `<button onclick="event.stopPropagation();moveCard(${l.id},'${s}')" class="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all">${s.replace('_',' ')}</button>` : ''
      ).join('')}
    </div>
  </div>`;
}

async function moveCard(leadId, newStatus) {
  try {
    await API.patch(`/leads/${leadId}/status`, { status: newStatus });
    const lead = allLeads.find(l => l.id === leadId);
    if (lead) lead.status = newStatus;
    renderPipelineUI(allLeads);
    showToast('Moved to ' + newStatus.replace('_',' '));
  } catch(e) { showToast('Failed to move', 'error'); }
}

// =====================================================
// CLIENTS
// =====================================================
async function renderClients() {
  try {
    const res = await API.get('/clients');
    allClients = res.data;
    renderClientsUI(allClients);
  } catch(e) {
    document.getElementById('main-content').innerHTML = errorState('Failed to load clients');
  }
}

function renderClientsUI(clients) {
  const totalMRR = clients.filter(c=>c.status==='active').reduce((s,c)=>s+c.recurring_fee,0);
  const totalRevenue = clients.reduce((s,c)=>s+c.package_price,0);

  document.getElementById('main-content').innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-4 mb-5">
      <div class="flex gap-4">
        <div class="text-sm"><span class="text-gray-500">Total Revenue: </span><span class="text-money">$${fmt(totalRevenue)}</span></div>
        <div class="text-sm"><span class="text-gray-500">MRR: </span><span class="text-money">$${fmt(totalMRR)}/mo</span></div>
        <div class="text-sm"><span class="text-gray-500">Active: </span><span class="text-white font-bold">${clients.filter(c=>c.status==='active').length}</span></div>
      </div>
      <div class="flex gap-2 items-center">
        <input id="clients-search" type="text" placeholder="Search clients..." class="form-input" style="width:200px" oninput="filterClients()"/>
        <select id="clients-status" class="form-input" style="width:130px" onchange="filterClients()">
          <option value="">All statuses</option>
          <option>active</option><option>completed</option><option>paused</option><option>churned</option>
        </select>
        <button onclick="openClientModal()" class="btn-primary"><i class="fas fa-plus mr-1"></i>Add Client</button>
      </div>
    </div>

    <div class="card p-0 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Business</th><th>Industry</th><th>Package</th><th>Price</th>
              <th>Monthly</th><th>Website</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody id="clients-tbody">
            ${renderClientsRows(clients)}
          </tbody>
        </table>
      </div>
      ${clients.length === 0 ? emptyState('users', 'No clients yet', 'Convert a lead or add a client directly') : ''}
    </div>
  `;
}

function renderClientsRows(clients) {
  if (clients.length === 0) return `<tr><td colspan="8" class="text-center text-gray-600 py-8">No clients match filters</td></tr>`;
  return clients.map(c => `
    <tr>
      <td>
        <div class="font-semibold text-white text-sm">${esc(c.business_name)}</div>
        ${c.owner_name ? `<div class="text-xs text-gray-500">${esc(c.owner_name)}</div>` : ''}
        ${c.phone ? `<div class="text-xs text-gray-500"><i class="fas fa-phone mr-1"></i>${esc(c.phone)}</div>` : ''}
      </td>
      <td>${esc(c.industry)}</td>
      <td><span class="text-sm font-medium text-indigo-300">${c.package_tier}</span></td>
      <td><span class="text-money">$${fmt(c.package_price)}</span></td>
      <td>${c.recurring_fee > 0 ? `<span class="text-green-400 text-sm">$${fmt(c.recurring_fee)}/mo</span>` : '<span class="text-gray-600">—</span>'}</td>
      <td>${c.website_url ? `<a href="${c.website_url}" target="_blank" onclick="event.stopPropagation()" class="text-blue-400 text-xs hover:underline"><i class="fas fa-external-link-alt mr-1"></i>View</a>` : '<span class="text-gray-600 text-xs">—</span>'}</td>
      <td><span class="badge badge-${c.status}">${c.status}</span></td>
      <td onclick="event.stopPropagation()">
        <div class="flex gap-1 row-actions">
          <button class="btn-icon" onclick="openClientModal(${c.id})" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="btn-icon" onclick="deleteClient(${c.id})" title="Delete" style="color:#f87171"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterClients() {
  const search = (document.getElementById('clients-search')?.value || '').toLowerCase();
  const status = document.getElementById('clients-status')?.value || '';
  let filtered = allClients;
  if (search) filtered = filtered.filter(c =>
    c.business_name.toLowerCase().includes(search) ||
    (c.owner_name||'').toLowerCase().includes(search) ||
    (c.phone||'').includes(search)
  );
  if (status) filtered = filtered.filter(c => c.status === status);
  const tbody = document.getElementById('clients-tbody');
  if (tbody) tbody.innerHTML = renderClientsRows(filtered);
}

async function deleteClient(id) {
  if (!confirm('Delete this client?')) return;
  try {
    await API.delete(`/clients/${id}`);
    allClients = allClients.filter(c => c.id !== id);
    renderClientsUI(allClients);
    showToast('Client deleted');
  } catch(e) { showToast('Failed to delete', 'error'); }
}

// =====================================================
// PROPOSALS
// =====================================================
async function renderProposals() {
  try {
    const res = await API.get('/proposals');
    allProposals = res.data;
    renderProposalsUI(allProposals);
  } catch(e) {
    document.getElementById('main-content').innerHTML = errorState('Failed to load proposals');
  }
}

function renderProposalsUI(proposals) {
  document.getElementById('main-content').innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-4 mb-5">
      <div class="tab-bar">
        <button class="tab-btn active" onclick="filterProposalsByStatus('all',this)">All <span class="ml-1 text-xs opacity-70">${proposals.length}</span></button>
        ${['draft','sent','accepted','declined'].map(s =>
          `<button class="tab-btn" onclick="filterProposalsByStatus('${s}',this)">${s} <span class="ml-1 text-xs opacity-70">${proposals.filter(p=>p.status===s).length}</span></button>`
        ).join('')}
      </div>
      <div class="flex gap-2 items-center">
        <input id="proposals-search" type="text" placeholder="Search proposals..." class="form-input" style="width:200px" oninput="filterProposals()"/>
        <button onclick="showProposalModal()" class="btn-primary"><i class="fas fa-plus mr-1"></i>New Proposal</button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" id="proposals-grid">
      ${renderProposalCards(proposals)}
    </div>
    ${proposals.length === 0 ? emptyState('file-invoice-dollar', 'No proposals yet', 'Create your first proposal from a lead') : ''}
  `;
}

function renderProposalCards(proposals) {
  if (proposals.length === 0) return '<p class="col-span-3 text-center text-gray-600 py-8">No proposals match filters</p>';
  return proposals.map(p => {
    const features = p.features ? p.features.split(',').filter(Boolean) : [];
    return `<div class="card hover:border-gray-600 transition-all cursor-pointer" onclick="editProposal(${p.id})">
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="font-bold text-white text-sm">${esc(p.business_name)}</h3>
          ${p.owner_name ? `<p class="text-xs text-gray-500">${esc(p.owner_name)}</p>` : ''}
        </div>
        <span class="badge badge-${p.status}">${p.status}</span>
      </div>
      <div class="flex items-center gap-3 mb-3">
        <div>
          <p class="text-xs text-gray-500">Package</p>
          <p class="text-sm font-semibold text-indigo-300">${p.package_tier}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">One-time</p>
          <p class="text-money text-sm">$${fmt(p.package_price)}</p>
        </div>
        ${p.recurring_fee > 0 ? `<div>
          <p class="text-xs text-gray-500">Monthly</p>
          <p class="text-green-400 text-sm font-bold">$${fmt(p.recurring_fee)}/mo</p>
        </div>` : ''}
      </div>
      ${features.length > 0 ? `<div class="flex flex-wrap gap-1 mb-3">
        ${features.slice(0,4).map(f=>`<span class="proposal-feature-tag"><i class="fas fa-check"></i>${f}</span>`).join('')}
        ${features.length > 4 ? `<span class="text-xs text-gray-500">+${features.length-4} more</span>` : ''}
      </div>` : ''}
      <div class="flex gap-2 mt-3 pt-3 border-t border-gray-800">
        <button onclick="event.stopPropagation();editProposal(${p.id})" class="btn-secondary btn-sm flex-1"><i class="fas fa-pen mr-1"></i>Edit</button>
        <button onclick="event.stopPropagation();markProposalSent(${p.id})" class="btn-primary btn-sm flex-1" ${p.status==='sent'?'disabled':''}>
          <i class="fas fa-paper-plane mr-1"></i>${p.status==='sent'?'Sent':'Mark Sent'}
        </button>
        <button onclick="event.stopPropagation();deleteProposal(${p.id})" class="btn-icon" style="color:#f87171"><i class="fas fa-trash text-xs"></i></button>
      </div>
    </div>`;
  }).join('');
}

let currentProposalStatusFilter = 'all';
function filterProposalsByStatus(status, btn) {
  currentProposalStatusFilter = status;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  filterProposals();
}
function filterProposals() {
  const search = (document.getElementById('proposals-search')?.value || '').toLowerCase();
  let filtered = allProposals;
  if (currentProposalStatusFilter !== 'all') filtered = filtered.filter(p => p.status === currentProposalStatusFilter);
  if (search) filtered = filtered.filter(p => p.business_name.toLowerCase().includes(search) || (p.owner_name||'').toLowerCase().includes(search));
  const grid = document.getElementById('proposals-grid');
  if (grid) grid.innerHTML = renderProposalCards(filtered);
}

async function markProposalSent(id) {
  try {
    const p = allProposals.find(p => p.id === id);
    if (!p) return;
    await API.put(`/proposals/${id}`, { ...p, status: 'sent', features: p.features });
    p.status = 'sent';
    renderProposalsUI(allProposals);
    showToast('Proposal marked as sent');
  } catch(e) { showToast('Failed to update', 'error'); }
}

async function deleteProposal(id) {
  if (!confirm('Delete this proposal?')) return;
  try {
    await API.delete(`/proposals/${id}`);
    allProposals = allProposals.filter(p => p.id !== id);
    renderProposalsUI(allProposals);
    showToast('Proposal deleted');
  } catch(e) { showToast('Failed to delete', 'error'); }
}

// =====================================================
// TASKS
// =====================================================
async function renderTasks() {
  try {
    const res = await API.get('/tasks');
    allTasks = res.data;
    renderTasksUI(allTasks);
  } catch(e) {
    document.getElementById('main-content').innerHTML = errorState('Failed to load tasks');
  }
}

function renderTasksUI(tasks) {
  const now = new Date();
  document.getElementById('main-content').innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-4 mb-5">
      <div class="tab-bar">
        <button class="tab-btn active" onclick="filterTasksByStatus('all',this)">All</button>
        <button class="tab-btn" onclick="filterTasksByStatus('pending',this)">Pending</button>
        <button class="tab-btn" onclick="filterTasksByStatus('in_progress',this)">In Progress</button>
        <button class="tab-btn" onclick="filterTasksByStatus('done',this)">Done</button>
      </div>
      <button onclick="openTaskModal()" class="btn-primary"><i class="fas fa-plus mr-1"></i>Add Task</button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" id="tasks-grid">
      ${renderTaskCards(tasks, now)}
    </div>
    ${tasks.length === 0 ? emptyState('tasks', 'No tasks yet', 'Create tasks to stay on top of your pipeline') : ''}
  `;
}

function renderTaskCards(tasks, now) {
  if (tasks.length === 0) return '<p class="col-span-3 text-center text-gray-600 py-8">No tasks match filters</p>';
  return tasks.map(t => {
    const overdue = t.due_date && new Date(t.due_date) < now && t.status !== 'done';
    return `<div class="card ${overdue ? 'border-red-900' : ''} hover:border-gray-600 transition-all">
      <div class="flex items-start justify-between mb-2">
        <h3 class="font-semibold text-white text-sm pr-2">${esc(t.title)}</h3>
        <div class="flex gap-1 flex-shrink-0">
          <span class="badge badge-${t.priority}">${t.priority}</span>
        </div>
      </div>
      ${t.description ? `<p class="text-xs text-gray-500 mb-2 truncate-2">${esc(t.description)}</p>` : ''}
      <div class="flex items-center gap-3 text-xs text-gray-500 mb-3">
        ${t.due_date ? `<span class="${overdue?'text-red-400 font-semibold':''}"><i class="fas fa-calendar mr-1"></i>${fmtDate(t.due_date)}</span>` : ''}
        <span class="badge badge-${t.status} text-xs">${t.status.replace('_',' ')}</span>
      </div>
      <div class="flex gap-2 pt-2 border-t border-gray-800">
        ${t.status !== 'done' ? `<button onclick="completeTask(${t.id})" class="btn-secondary btn-sm flex-1"><i class="fas fa-check mr-1 text-green-400"></i>Done</button>` : ''}
        <button onclick="openTaskModal(${t.id})" class="btn-secondary btn-sm ${t.status==='done'?'flex-1':''}"><i class="fas fa-pen mr-1"></i>Edit</button>
        <button onclick="deleteTask(${t.id})" class="btn-icon" style="color:#f87171"><i class="fas fa-trash text-xs"></i></button>
      </div>
    </div>`;
  }).join('');
}

let currentTaskFilter = 'all';
function filterTasksByStatus(status, btn) {
  currentTaskFilter = status;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const filtered = status === 'all' ? allTasks : allTasks.filter(t => t.status === status);
  const grid = document.getElementById('tasks-grid');
  if (grid) grid.innerHTML = renderTaskCards(filtered, new Date());
}

async function completeTask(id) {
  try {
    await API.patch(`/tasks/${id}/status`, { status: 'done' });
    const t = allTasks.find(t => t.id === id);
    if (t) t.status = 'done';
    filterTasksByStatus(currentTaskFilter, null);
    showToast('Task completed!');
    refreshBadges();
  } catch(e) { showToast('Failed to update task', 'error'); }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await API.delete(`/tasks/${id}`);
    allTasks = allTasks.filter(t => t.id !== id);
    filterTasksByStatus(currentTaskFilter, null);
    showToast('Task deleted');
  } catch(e) { showToast('Failed to delete', 'error'); }
}

// =====================================================
// REVENUE ANALYTICS
// =====================================================
async function renderRevenue() {
  try {
    const [summaryRes, packageRes, monthlyRes, cityRes] = await Promise.all([
      API.get('/analytics/summary'),
      API.get('/analytics/clients-by-package'),
      API.get('/analytics/revenue-by-month'),
      API.get('/analytics/leads-by-city'),
    ]);
    const s = summaryRes.data;
    const byPackage = packageRes.data;
    const byMonth = monthlyRes.data;
    const byCity = cityRes.data;

    document.getElementById('main-content').innerHTML = `
      <!-- Revenue KPIs -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        ${statCard('Total Revenue', '$' + fmt(s.revenue.total), 'fas fa-dollar-sign', 'emerald', 'All-time one-time sales')}
        ${statCard('Monthly Recurring', '$' + fmt(s.revenue.monthly), 'fas fa-sync-alt', 'teal', 'MRR')}
        ${statCard('Annual Recurring', '$' + fmt(s.revenue.annualRecurring), 'fas fa-calendar-check', 'indigo', 'ARR projection')}
        ${statCard('Avg Deal Size', s.clients.total > 0 ? '$' + fmt(Math.round(s.revenue.total / s.clients.total)) : '$0', 'fas fa-chart-pie', 'violet', `from ${s.clients.total} clients`)}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <!-- Revenue trend -->
        <div class="card">
          <h3 class="font-bold text-white text-sm mb-4"><i class="fas fa-chart-line mr-2 text-green-400"></i>Revenue by Month</h3>
          <div class="chart-wrapper" style="height:220px">
            <canvas id="revTrendChart"></canvas>
          </div>
        </div>
        <!-- Package breakdown -->
        <div class="card">
          <h3 class="font-bold text-white text-sm mb-4"><i class="fas fa-box mr-2 text-indigo-400"></i>Revenue by Package</h3>
          <div class="chart-wrapper" style="height:220px">
            <canvas id="packageChart"></canvas>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Package table -->
        <div class="card">
          <h3 class="font-bold text-white text-sm mb-4"><i class="fas fa-list mr-2 text-purple-400"></i>Package Performance</h3>
          <table class="data-table">
            <thead><tr><th>Package</th><th>Clients</th><th>Revenue</th><th>Avg</th></tr></thead>
            <tbody>
              ${byPackage.map(p => `<tr>
                <td><span class="font-medium text-indigo-300">${p.package_tier}</span></td>
                <td>${p.count}</td>
                <td><span class="text-money">$${fmt(p.revenue)}</span></td>
                <td><span class="text-gray-300">$${fmt(Math.round(p.revenue / p.count))}</span></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <!-- City breakdown -->
        <div class="card">
          <h3 class="font-bold text-white text-sm mb-4"><i class="fas fa-city mr-2 text-blue-400"></i>Leads by City</h3>
          ${byCity.map(c => `
            <div class="mb-3">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-gray-300 font-medium">${c.city}</span>
                <span class="text-gray-500">${c.count} leads</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill bg-blue-500" style="width:${Math.round((c.count/byCity[0].count)*100)}%"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Charts
    renderChart('revTrendChart', 'line',
      byMonth.map(r => r.month||''),
      byMonth.map(r => r.revenue||0),
      '#10b981', 'Revenue ($)'
    );
    renderChart('packageChart', 'doughnut',
      byPackage.map(p => p.package_tier),
      byPackage.map(p => p.revenue),
      ['#6366f1','#8b5cf6','#a78bfa'],
      'Revenue'
    );

  } catch(e) {
    document.getElementById('main-content').innerHTML = errorState('Failed to load revenue data');
  }
}

// =====================================================
// LEAD FINDER / SCRAPER GUIDE
// =====================================================
function renderScraper() {
  document.getElementById('main-content').innerHTML = `
    <div class="max-w-4xl mx-auto space-y-6">
      <!-- Hero -->
      <div class="card bg-gradient-to-br from-blue-950 to-indigo-950 border-blue-800">
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-search-location text-white text-lg"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold text-white mb-1">Lead Finder Tool</h2>
            <p class="text-blue-200 text-sm">Find local businesses on Google Maps that don't have websites. Use the methods below to build your lead list quickly.</p>
          </div>
        </div>
      </div>

      <!-- Manual Entry -->
      <div class="card">
        <h3 class="font-bold text-white text-sm mb-4"><i class="fas fa-plus-circle mr-2 text-green-400"></i>Quick Add Lead</h3>
        <p class="text-gray-400 text-sm mb-4">Found a business manually? Add it directly:</p>
        <button onclick="showAddLeadModal()" class="btn-primary"><i class="fas fa-plus mr-2"></i>Add Lead Manually</button>
      </div>

      <!-- Bulk Import -->
      <div class="card">
        <h3 class="font-bold text-white text-sm mb-4"><i class="fas fa-file-csv mr-2 text-blue-400"></i>Bulk Import from CSV</h3>
        <p class="text-gray-400 text-sm mb-4">Import leads scraped from tools like Outscraper, Phantombuster, or Google Maps scraper.</p>
        <div class="bg-gray-900 rounded-lg p-4 mb-4">
          <p class="text-xs font-bold text-gray-400 mb-2">Expected CSV format:</p>
          <code class="text-xs text-green-400">business_name, industry, city, phone, email, address, google_maps_url</code>
        </div>
        <div class="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-blue-500 transition-all cursor-pointer" onclick="document.getElementById('csv-file-input').click()">
          <i class="fas fa-cloud-upload-alt text-3xl text-gray-600 mb-3"></i>
          <p class="text-gray-400 text-sm font-medium">Click to upload CSV file</p>
          <p class="text-gray-600 text-xs mt-1">or paste data below</p>
          <input type="file" id="csv-file-input" accept=".csv" class="hidden" onchange="handleCsvUpload(event)"/>
        </div>
        <div class="mt-4">
          <label class="form-label">Or paste CSV data directly</label>
          <textarea id="csv-paste" class="form-input w-full font-mono text-xs" rows="5" placeholder="business_name,industry,city,phone,email&#10;Mike's Plumbing,Home Services,Austin,(512) 555-0101,mike@example.com"></textarea>
          <button onclick="parseCsvPaste()" class="btn-primary mt-2"><i class="fas fa-upload mr-1"></i>Import Leads</button>
        </div>
      </div>

      <!-- Scraping Guide -->
      <div class="card">
        <h3 class="font-bold text-white text-sm mb-4"><i class="fas fa-robot mr-2 text-purple-400"></i>Google Maps Scraping Methods</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${scraperMethodCard('Outscraper', 'Paid', 'Most reliable. Search "plumber in Austin", export CSV, filter for no-website results.', 'https://outscraper.com', 'fas fa-star text-yellow-400', '$50-100/mo')}
          ${scraperMethodCard('Phantombuster', 'Paid', 'Google Maps Extractor phantom. Schedule runs for continuous lead generation.', 'https://phantombuster.com', 'fas fa-ghost text-purple-400', '$30-70/mo')}
          ${scraperMethodCard('Manual Google Maps', 'Free', 'Search "[industry] in [city]", check each listing for website button. Slow but free.', '#', 'fas fa-map text-green-400', 'Free')}
        </div>
      </div>

      <!-- Search Query Templates -->
      <div class="card">
        <h3 class="font-bold text-white text-sm mb-4"><i class="fas fa-search mr-2 text-cyan-400"></i>High-Converting Search Queries</h3>
        <p class="text-sm text-gray-400 mb-4">Use these search terms in Google Maps to find businesses without websites:</p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          ${['plumber in [city]','electrician [city]','hair salon [city]','auto repair [city]','restaurant [city]','nail salon [city]','HVAC contractor [city]','landscaping [city]','dentist [city]','chiropractor [city]','pizza place [city]','barber shop [city]'].map(q =>
            `<div class="bg-gray-900 rounded-lg px-3 py-2 text-xs font-mono text-green-400 flex items-center justify-between gap-2">
              <span>${q}</span>
              <button onclick="copyText('${q}')" class="text-gray-500 hover:text-white"><i class="fas fa-copy text-xs"></i></button>
            </div>`
          ).join('')}
        </div>
      </div>

      <!-- Outreach Scripts -->
      <div class="card">
        <h3 class="font-bold text-white text-sm mb-4"><i class="fas fa-phone-alt mr-2 text-orange-400"></i>Outreach Scripts</h3>
        <div class="space-y-4">
          ${scriptCard('Phone Script', 'fas fa-phone text-green-400', `"Hi, may I speak with the owner? Hi [Name], I'm [Your Name] with [Company]. I was searching for [industry] businesses in [city] and found your listing on Google Maps. I noticed you don't have a website yet — I actually put together a quick mockup of what one could look like for your business. It takes about 2 minutes to show you. Would you be available for a quick call this week?"`)}
          ${scriptCard('In-Person Script', 'fas fa-walking text-blue-400', `"Hi! I'm [Name]. I help local businesses get online with professional websites. I was in the area and noticed your business on Google Maps — I actually built a quick demo site for you. Mind if I show you on my phone? Takes about 2 minutes. No pressure at all." [Show demo, mention their competitor who has a website]`)}
          ${scriptCard('Email Template', 'fas fa-envelope text-purple-400', `Subject: Quick question about [Business Name]'s online presence\n\nHi [Owner Name],\n\nI was searching for [industry] businesses in [city] and came across [Business Name] on Google Maps. You have great reviews!\n\nI noticed you don't have a website yet — I actually built a quick demo to show what it could look like for you.\n\nWould you have 10 minutes this week for a quick call?\n\nBest,\n[Your Name]`)}
        </div>
      </div>
    </div>
  `;
}

function scraperMethodCard(name, type, desc, url, icon, price) {
  return `<div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
    <div class="flex items-center gap-2 mb-2">
      <i class="${icon}"></i>
      <h4 class="font-bold text-white text-sm">${name}</h4>
      <span class="ml-auto text-xs text-gray-500">${price}</span>
    </div>
    <p class="text-xs text-gray-400 mb-3">${desc}</p>
    ${url !== '#' ? `<a href="${url}" target="_blank" class="text-blue-400 text-xs hover:underline"><i class="fas fa-external-link-alt mr-1"></i>Visit</a>` : '<span class="text-xs text-gray-600">No signup needed</span>'}
  </div>`;
}

function scriptCard(title, icon, script) {
  const id = 'script-' + title.replace(/\s+/g,'');
  return `<div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
    <div class="flex items-center justify-between mb-2">
      <h4 class="font-semibold text-white text-sm flex items-center gap-2"><i class="${icon}"></i>${title}</h4>
      <button onclick="copyText(document.getElementById('${id}').textContent)" class="btn-secondary btn-sm"><i class="fas fa-copy mr-1"></i>Copy</button>
    </div>
    <p class="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed" id="${id}">${script}</p>
  </div>`;
}

// =====================================================
// CSV IMPORT
// =====================================================
function handleCsvUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('csv-paste').value = e.target.result;
    parseCsvPaste();
  };
  reader.readAsText(file);
}

async function parseCsvPaste() {
  const raw = document.getElementById('csv-paste')?.value?.trim();
  if (!raw) { showToast('No data to import', 'error'); return; }
  const lines = raw.split('\n').filter(l => l.trim());
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g,''));
  const rows = lines.slice(1);
  if (rows.length === 0) { showToast('No data rows found', 'error'); return; }

  let imported = 0, failed = 0;
  for (const row of rows) {
    const cols = row.split(',').map(c => c.trim().replace(/"/g,''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
    const lead = {
      business_name: obj.business_name || obj.name || '',
      industry: obj.industry || obj.category || 'Other',
      city: obj.city || obj.location || '',
      phone: obj.phone || obj.phone_number || '',
      email: obj.email || '',
      address: obj.address || '',
      google_maps_url: obj.google_maps_url || obj.maps_url || obj.url || '',
      status: 'new', source: 'import'
    };
    if (!lead.business_name || !lead.city) { failed++; continue; }
    try {
      await API.post('/leads', lead);
      imported++;
    } catch(e) { failed++; }
  }
  showToast(`Imported ${imported} leads${failed > 0 ? `, ${failed} failed` : ''}`, imported > 0 ? 'success' : 'error');
  if (imported > 0) {
    document.getElementById('csv-paste').value = '';
    navigateTo('leads');
  }
}

// =====================================================
// MODAL HELPERS
// =====================================================
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ===== LEAD MODAL =====
function showAddLeadModal() {
  document.getElementById('lead-modal-title').textContent = 'Add New Lead';
  document.getElementById('lead-form').reset();
  document.getElementById('lead-id').value = '';
  openModal('lead-modal');
}

async function editLead(id) {
  const lead = allLeads.find(l => l.id === id) || (await API.get(`/leads/${id}`)).data.lead;
  document.getElementById('lead-modal-title').textContent = 'Edit Lead';
  document.getElementById('lead-id').value = lead.id;
  document.getElementById('lead-business-name').value = lead.business_name || '';
  document.getElementById('lead-owner-name').value = lead.owner_name || '';
  document.getElementById('lead-industry').value = lead.industry || '';
  document.getElementById('lead-city').value = lead.city || '';
  document.getElementById('lead-phone').value = lead.phone || '';
  document.getElementById('lead-email').value = lead.email || '';
  document.getElementById('lead-address').value = lead.address || '';
  document.getElementById('lead-maps-url').value = lead.google_maps_url || '';
  document.getElementById('lead-status').value = lead.status || 'new';
  document.getElementById('lead-source').value = lead.source || 'google_maps';
  document.getElementById('lead-notes').value = lead.notes || '';
  openModal('lead-modal');
}

document.getElementById('lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('lead-id').value;
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
  };
  try {
    if (id) {
      const res = await API.put(`/leads/${id}`, data);
      const idx = allLeads.findIndex(l => l.id == id);
      if (idx >= 0) allLeads[idx] = res.data;
      showToast('Lead updated');
    } else {
      const res = await API.post('/leads', data);
      allLeads.unshift(res.data);
      showToast('Lead added!');
    }
    closeModal('lead-modal');
    if (currentPage === 'leads') filterLeads();
    else if (currentPage === 'pipeline') renderPipelineUI(allLeads);
    refreshBadges();
  } catch(err) { showToast('Failed to save lead', 'error'); }
});

// ===== CLIENT MODAL =====
function openClientModal(id = null, prefillLead = null) {
  document.getElementById('client-modal-title').textContent = id ? 'Edit Client' : 'Add Client';
  document.getElementById('client-form').reset();
  document.getElementById('client-id').value = id || '';

  if (prefillLead) {
    document.getElementById('client-business-name').value = prefillLead.business_name || '';
    document.getElementById('client-owner-name').value = prefillLead.owner_name || '';
    document.getElementById('client-industry').value = prefillLead.industry || '';
    document.getElementById('client-city').value = prefillLead.city || '';
    document.getElementById('client-phone').value = prefillLead.phone || '';
    document.getElementById('client-email').value = prefillLead.email || '';
    document.getElementById('client-package').value = 'Professional';
    document.getElementById('client-price').value = 1500;
    document.getElementById('client-recurring').value = 75;
    // Store lead_id for conversion
    document.getElementById('client-id').dataset.leadId = prefillLead.id;
  } else if (id) {
    const c = allClients.find(c => c.id === id);
    if (c) {
      document.getElementById('client-business-name').value = c.business_name;
      document.getElementById('client-owner-name').value = c.owner_name || '';
      document.getElementById('client-industry').value = c.industry;
      document.getElementById('client-city').value = c.city;
      document.getElementById('client-phone').value = c.phone || '';
      document.getElementById('client-email').value = c.email || '';
      document.getElementById('client-package').value = c.package_tier;
      document.getElementById('client-price').value = c.package_price;
      document.getElementById('client-recurring').value = c.recurring_fee || 0;
      document.getElementById('client-status').value = c.status;
      document.getElementById('client-website').value = c.website_url || '';
      document.getElementById('client-notes').value = c.notes || '';
    }
  }
  openModal('client-modal');
}

function updateClientPrice() {
  const pkg = document.getElementById('client-package').value;
  const defaults = { Basic: 650, Professional: 1500, Premium: 3000 };
  const recurring = { Basic: 50, Professional: 75, Premium: 150 };
  if (defaults[pkg]) {
    document.getElementById('client-price').value = defaults[pkg];
    document.getElementById('client-recurring').value = recurring[pkg];
  }
}

document.getElementById('client-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const idEl = document.getElementById('client-id');
  const id = idEl.value;
  const leadId = idEl.dataset.leadId;
  const data = {
    lead_id: leadId || null,
    business_name: document.getElementById('client-business-name').value,
    owner_name: document.getElementById('client-owner-name').value,
    industry: document.getElementById('client-industry').value,
    city: document.getElementById('client-city').value,
    phone: document.getElementById('client-phone').value,
    email: document.getElementById('client-email').value,
    package_tier: document.getElementById('client-package').value,
    package_price: parseFloat(document.getElementById('client-price').value),
    recurring_fee: parseFloat(document.getElementById('client-recurring').value) || 0,
    status: document.getElementById('client-status').value,
    website_url: document.getElementById('client-website').value,
    notes: document.getElementById('client-notes').value,
  };
  try {
    if (id) {
      const res = await API.put(`/clients/${id}`, data);
      const idx = allClients.findIndex(c => c.id == id);
      if (idx >= 0) allClients[idx] = res.data;
      showToast('Client updated');
    } else {
      const res = await API.post('/clients', data);
      allClients.unshift(res.data);
      showToast('Client added!');
    }
    idEl.dataset.leadId = '';
    closeModal('client-modal');
    if (currentPage === 'clients') renderClientsUI(allClients);
    else if (currentPage === 'leads') { const res = await API.get('/leads'); allLeads = res.data; filterLeads(); }
  } catch(err) { showToast('Failed to save client', 'error'); }
});

// ===== PROPOSAL MODAL =====
const PACKAGES = {
  Basic: {
    price: 700, recurring: 50,
    features: ['5-Page Website','Mobile Responsive','Contact Form','Google Maps Integration','Click-to-Call','1 Year Hosting Included']
  },
  Professional: {
    price: 1500, recurring: 75,
    features: ['Everything in Basic','SEO Optimization','Google Business Profile','Image Gallery','Social Media Links','Analytics Dashboard','Professional Email Setup']
  },
  Premium: {
    price: 3000, recurring: 150,
    features: ['Everything in Professional','Booking/Appointment System','Blog Setup','3 Months of Updates','Local SEO Campaign','Monthly Report','Priority Support']
  }
};

async function showProposalModal(leadId = null) {
  // Reset form
  document.getElementById('proposal-id').value = '';
  document.getElementById('proposal-lead-id').value = leadId || '';
  document.getElementById('proposal-package').value = 'Professional';
  document.getElementById('proposal-price').value = 1500;
  document.getElementById('proposal-recurring').value = 75;
  document.getElementById('proposal-status').value = 'draft';
  document.getElementById('proposal-message').value = '';

  if (leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (lead) {
      document.getElementById('proposal-business-name').value = lead.business_name;
      document.getElementById('proposal-owner-name').value = lead.owner_name || '';
      document.getElementById('proposal-message').value = `Hi ${lead.owner_name || lead.business_name}, I noticed your business on Google Maps and noticed you don't have a website yet. I've put together a professional proposal that I think you'll love. Would love to show you what we can build for ${lead.business_name}!`;
    }
  } else {
    document.getElementById('proposal-business-name').value = '';
    document.getElementById('proposal-owner-name').value = '';
  }

  renderProposalFeatureChecks('Professional');
  updateProposalPreview();
  openModal('proposal-modal');
}

async function editProposal(id) {
  try {
    const res = await API.get(`/proposals/${id}`);
    const p = res.data;
    document.getElementById('proposal-id').value = p.id;
    document.getElementById('proposal-lead-id').value = p.lead_id || '';
    document.getElementById('proposal-business-name').value = p.business_name;
    document.getElementById('proposal-owner-name').value = p.owner_name || '';
    document.getElementById('proposal-package').value = p.package_tier;
    document.getElementById('proposal-price').value = p.package_price;
    document.getElementById('proposal-recurring').value = p.recurring_fee || 0;
    document.getElementById('proposal-status').value = p.status;
    document.getElementById('proposal-message').value = p.custom_message || '';
    const selectedFeatures = p.features ? p.features.split(',').filter(Boolean) : [];
    renderProposalFeatureChecks(p.package_tier, selectedFeatures);
    updateProposalPreview();
    openModal('proposal-modal');
  } catch(e) { showToast('Failed to load proposal', 'error'); }
}

function renderProposalFeatureChecks(pkg, selected = null) {
  const allFeatures = [
    '5-Page Website','Mobile Responsive','Contact Form','Google Maps Integration','Click-to-Call',
    '1 Year Hosting Included','SEO Optimization','Google Business Profile','Image Gallery',
    'Social Media Links','Analytics Dashboard','Professional Email Setup',
    'Booking/Appointment System','Blog Setup','3 Months of Updates','Local SEO Campaign',
    'Monthly Report','Priority Support'
  ];
  const pkgFeatures = PACKAGES[pkg]?.features || [];
  const container = document.getElementById('proposal-features');
  const activeFeatures = selected || pkgFeatures;
  container.innerHTML = allFeatures.map(f => `
    <label class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white">
      <input type="checkbox" class="feature-check rounded" value="${f}" ${activeFeatures.includes(f) ? 'checked' : ''} onchange="updateProposalPreview()"/>
      ${f}
    </label>
  `).join('');
}

function updateProposalPackage() {
  const pkg = document.getElementById('proposal-package').value;
  const pkgData = PACKAGES[pkg];
  if (pkgData) {
    document.getElementById('proposal-price').value = pkgData.price;
    document.getElementById('proposal-recurring').value = pkgData.recurring;
    renderProposalFeatureChecks(pkg);
  }
  updateProposalPreview();
}

function getSelectedFeatures() {
  return [...document.querySelectorAll('.feature-check:checked')].map(cb => cb.value);
}

function updateProposalPreview() {
  const biz = document.getElementById('proposal-business-name')?.value || '[Business Name]';
  const owner = document.getElementById('proposal-owner-name')?.value || '';
  const pkg = document.getElementById('proposal-package')?.value || 'Professional';
  const price = parseFloat(document.getElementById('proposal-price')?.value) || 0;
  const recurring = parseFloat(document.getElementById('proposal-recurring')?.value) || 0;
  const message = document.getElementById('proposal-message')?.value || '';
  const features = getSelectedFeatures();

  const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const preview = document.getElementById('proposal-preview');
  if (!preview) return;

  preview.innerHTML = `
    <div class="proposal-preview-header">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-blue-400 font-bold text-sm">🌐 LocalWeb Solutions</div>
          <div class="text-gray-500 text-xs">${today}</div>
        </div>
        <div class="text-right">
          <div class="text-white font-bold text-xs">${pkg} Package</div>
          <div class="text-green-400 font-bold">$${fmt(price)}</div>
        </div>
      </div>
    </div>

    <div class="mb-3">
      <div class="text-gray-500 text-xs mb-1">PREPARED FOR</div>
      <div class="text-white font-bold text-sm">${esc(biz)}</div>
      ${owner ? `<div class="text-gray-400 text-xs">${esc(owner)}</div>` : ''}
    </div>

    ${message ? `<div class="bg-blue-950 rounded-lg p-3 mb-3">
      <p class="text-blue-200 text-xs leading-relaxed">${esc(message)}</p>
    </div>` : ''}

    <div class="mb-3">
      <div class="text-gray-500 text-xs mb-2 font-bold">WHAT'S INCLUDED</div>
      <div class="flex flex-wrap">
        ${features.map(f => `<span class="proposal-feature-tag"><i class="fas fa-check"></i>${f}</span>`).join('')}
      </div>
    </div>

    <div class="bg-gray-900 rounded-lg p-3 mb-3">
      <div class="flex justify-between items-center mb-2">
        <span class="text-gray-400 text-xs">Website Package</span>
        <span class="text-white font-bold text-xs">$${fmt(price)}</span>
      </div>
      ${recurring > 0 ? `<div class="flex justify-between items-center mb-2">
        <span class="text-gray-400 text-xs">Monthly Maintenance</span>
        <span class="text-green-400 text-xs font-bold">$${fmt(recurring)}/mo</span>
      </div>` : ''}
      <div class="divider"></div>
      <div class="flex justify-between items-center">
        <span class="text-white font-bold text-xs">Total Investment</span>
        <span class="text-green-400 font-bold">$${fmt(price)}${recurring > 0 ? ` + $${fmt(recurring)}/mo` : ''}</span>
      </div>
    </div>

    <div class="text-gray-600 text-xs text-center">Ready to get started? Reply to this proposal or call us today.</div>
  `;
}

async function saveProposal() {
  const id = document.getElementById('proposal-id').value;
  const leadId = document.getElementById('proposal-lead-id').value;
  const features = getSelectedFeatures();
  const data = {
    lead_id: leadId || null,
    business_name: document.getElementById('proposal-business-name').value,
    owner_name: document.getElementById('proposal-owner-name').value,
    package_tier: document.getElementById('proposal-package').value,
    package_price: parseFloat(document.getElementById('proposal-price').value),
    recurring_fee: parseFloat(document.getElementById('proposal-recurring').value) || 0,
    features: features,
    custom_message: document.getElementById('proposal-message').value,
    status: document.getElementById('proposal-status').value,
  };
  if (!data.business_name) { showToast('Business name required', 'error'); return; }
  try {
    if (id) {
      const res = await API.put(`/proposals/${id}`, data);
      const idx = allProposals.findIndex(p => p.id == id);
      if (idx >= 0) allProposals[idx] = res.data;
      showToast('Proposal updated');
    } else {
      const res = await API.post('/proposals', data);
      allProposals.unshift(res.data);
      showToast('Proposal saved!');
    }
    closeModal('proposal-modal');
    if (currentPage === 'proposals') renderProposalsUI(allProposals);
  } catch(err) { showToast('Failed to save proposal', 'error'); }
}

function copyProposalText() {
  const biz = document.getElementById('proposal-business-name')?.value || '';
  const owner = document.getElementById('proposal-owner-name')?.value || '';
  const pkg = document.getElementById('proposal-package')?.value || '';
  const price = document.getElementById('proposal-price')?.value || '';
  const recurring = document.getElementById('proposal-recurring')?.value || '';
  const message = document.getElementById('proposal-message')?.value || '';
  const features = getSelectedFeatures();
  const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

  const text = `WEBSITE PROPOSAL - LocalWeb Solutions
${today}

Prepared for: ${biz}${owner ? ` (${owner})` : ''}

${message ? message + '\n\n' : ''}PACKAGE: ${pkg}

WHAT'S INCLUDED:
${features.map(f => `✓ ${f}`).join('\n')}

INVESTMENT:
• Website Package: $${price}
${parseFloat(recurring) > 0 ? `• Monthly Maintenance: $${recurring}/mo\n` : ''}
Total: $${price}${parseFloat(recurring) > 0 ? ` + $${recurring}/month` : ''}

Ready to get started? Reply to this message or give us a call!`;

  copyText(text);
}

// ===== TASK MODAL =====
async function openTaskModal(id = null) {
  document.getElementById('task-modal-title').textContent = id ? 'Edit Task' : 'Add Task';
  document.getElementById('task-form').reset();
  document.getElementById('task-id').value = id || '';
  if (id) {
    const t = allTasks.find(t => t.id === id);
    if (t) {
      document.getElementById('task-title').value = t.title;
      document.getElementById('task-description').value = t.description || '';
      document.getElementById('task-priority').value = t.priority;
      document.getElementById('task-status').value = t.status;
      document.getElementById('task-due-date').value = t.due_date ? t.due_date.slice(0,10) : '';
    }
  }
  openModal('task-modal');
}

document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const data = {
    title: document.getElementById('task-title').value,
    description: document.getElementById('task-description').value,
    priority: document.getElementById('task-priority').value,
    status: document.getElementById('task-status').value,
    due_date: document.getElementById('task-due-date').value || null,
  };
  try {
    if (id) {
      const res = await API.put(`/tasks/${id}`, data);
      const idx = allTasks.findIndex(t => t.id == id);
      if (idx >= 0) allTasks[idx] = res.data;
      showToast('Task updated');
    } else {
      const res = await API.post('/tasks', data);
      allTasks.unshift(res.data);
      showToast('Task added!');
    }
    closeModal('task-modal');
    if (currentPage === 'tasks') renderTasksUI(allTasks);
    refreshBadges();
  } catch(err) { showToast('Failed to save task', 'error'); }
});

// ===== IMPORT MODAL =====
function showImportModal() { navigateTo('scraper'); }

// =====================================================
// HELPERS
// =====================================================
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
  catch(e) { return d; }
}

function timeAgo(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'Just now';
}

function detailRow(label, value) {
  return `<div class="flex items-start gap-2 mb-2">
    <span class="text-xs text-gray-500 w-20 flex-shrink-0 font-semibold pt-0.5">${label}</span>
    <span class="text-sm text-gray-200">${value}</span>
  </div>`;
}

function emptyState(icon, title, sub) {
  return `<div class="empty-state">
    <i class="fas fa-${icon}"></i>
    <p class="font-semibold text-gray-400 mb-1">${title}</p>
    <p class="text-xs text-gray-600">${sub}</p>
  </div>`;
}

function errorState(msg) {
  return `<div class="empty-state">
    <i class="fas fa-exclamation-triangle text-red-500"></i>
    <p class="font-semibold text-red-400 mb-1">${msg}</p>
    <button onclick="navigateTo(currentPage)" class="btn-secondary btn-sm mt-2">Retry</button>
  </div>`;
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!', 'info'));
}

// ===== TOAST =====
let toastTimer;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const inner = document.getElementById('toast-inner');
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  inner.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border toast-${type}`;
  inner.innerHTML = `<i class="fas ${icons[type]||'fa-check-circle'}"></i>${msg}`;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ===== CLOSE MODAL ON OVERLAY CLICK =====
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});

// ===== ESC KEY TO CLOSE MODALS =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
  }
});
