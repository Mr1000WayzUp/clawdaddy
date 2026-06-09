/* ClawDaddy Dealership Payment Tracker */

let currentTab = 'dashboard';
let allCustomers = [];
let editingCustomer = null;
let editingDeal = null;
let currentDealId = null;

const $ = id => document.getElementById(id);
const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const today = () => new Date().toISOString().split('T')[0];

function showToast(msg, type = 'success') {
  const t = $('toast');
  const colors = { success: 'bg-green-900 border-green-700 text-green-200', error: 'bg-red-900 border-red-700 text-red-200', info: 'bg-blue-900 border-blue-700 text-blue-200' };
  t.className = 'fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-medium ' + (colors[type] || colors.success);
  t.textContent = msg;
  t.style.display = 'flex';
  setTimeout(() => { t.style.display = 'none'; }, 3500);
}

function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active-tab', b.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.style.display = p.id === 'tab-' + tab ? 'block' : 'none';
  });
  if (tab === 'dashboard') loadDashboard();
  else if (tab === 'customers') loadCustomers();
  else if (tab === 'deals') loadDeals();
  else if (tab === 'payments') loadAllPayments();
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

async function loadDashboard() {
  const res = await fetch('/api/dealer/dashboard');
  const data = await res.json();
  const { stats, overdue, due_soon, recent_payments, upcoming_schedule } = data;

  // Stats
  $('stat-customers').textContent = stats.total_customers;
  $('stat-deals').textContent = stats.active_deals;
  $('stat-owed').textContent = fmt$(stats.total_owed);
  $('stat-overdue').textContent = stats.overdue_count;

  // Alerts banner
  const alertBanner = $('alert-banner');
  const totalAlerts = overdue.length + due_soon.length;
  if (totalAlerts > 0) {
    alertBanner.style.display = 'block';
    $('alert-count').textContent = totalAlerts + ' payment' + (totalAlerts !== 1 ? 's' : '') + ' need your attention';
  } else {
    alertBanner.style.display = 'none';
  }

  // Overdue
  const overdueEl = $('overdue-list');
  if (overdue.length === 0) {
    overdueEl.innerHTML = '<p class="text-gray-500 text-sm py-4 text-center">No overdue payments</p>';
  } else {
    overdueEl.innerHTML = overdue.map(p => {
      const daysLate = Math.floor((Date.now() - new Date(p.due_date + 'T12:00:00').getTime()) / 864e5);
      return `
        <div class="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
          <div class="flex items-center gap-3">
            <div class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
            <div>
              <p class="font-semibold text-white">${p.first_name} ${p.last_name}</p>
              <p class="text-xs text-gray-400">${[p.vehicle_year, p.vehicle_make, p.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'}</p>
              ${p.phone ? '<p class="text-xs text-blue-400 font-mono">' + p.phone + '</p>' : ''}
            </div>
          </div>
          <div class="text-right">
            <p class="font-bold text-red-400">${fmt$(p.amount_due)}</p>
            <p class="text-xs text-red-500">${daysLate} day${daysLate !== 1 ? 's' : ''} overdue</p>
            <p class="text-xs text-gray-500">Was due ${fmtDate(p.due_date)}</p>
          </div>
        </div>`;
    }).join('');
  }

  // Due soon
  const dueSoonEl = $('due-soon-list');
  if (due_soon.length === 0) {
    dueSoonEl.innerHTML = '<p class="text-gray-500 text-sm py-4 text-center">Nothing due in the next 7 days</p>';
  } else {
    dueSoonEl.innerHTML = due_soon.map(p => {
      const daysLeft = Math.ceil((new Date(p.due_date + 'T12:00:00').getTime() - Date.now()) / 864e5);
      const urgency = daysLeft <= 2 ? 'text-orange-400' : 'text-yellow-400';
      return `
        <div class="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
          <div class="flex items-center gap-3">
            <div class="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0"></div>
            <div>
              <p class="font-semibold text-white">${p.first_name} ${p.last_name}</p>
              <p class="text-xs text-gray-400">${[p.vehicle_year, p.vehicle_make, p.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'}</p>
              ${p.phone ? '<p class="text-xs text-blue-400 font-mono">' + p.phone + '</p>' : ''}
            </div>
          </div>
          <div class="text-right">
            <p class="font-bold text-white">${fmt$(p.amount_due)}</p>
            <p class="text-xs ${urgency}">Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</p>
            <p class="text-xs text-gray-500">${fmtDate(p.due_date)}</p>
          </div>
        </div>`;
    }).join('');
  }

  // Recent payments
  const recentEl = $('recent-payments-list');
  if (recent_payments.length === 0) {
    recentEl.innerHTML = '<p class="text-gray-500 text-sm py-4 text-center">No payments recorded yet</p>';
  } else {
    recentEl.innerHTML = recent_payments.map(p => `
      <div class="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
        <div>
          <p class="font-semibold text-white">${p.first_name} ${p.last_name}</p>
          <p class="text-xs text-gray-400">${[p.vehicle_year, p.vehicle_make, p.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'} · ${capitalize(p.payment_method)}</p>
        </div>
        <div class="text-right">
          <p class="font-bold text-green-400">${fmt$(p.amount_paid)}</p>
          <p class="text-xs text-gray-500">${fmtDate(p.paid_date)}</p>
        </div>
      </div>
    `).join('');
  }

  // Upcoming schedule
  const upcomingEl = $('upcoming-schedule-list');
  if (upcoming_schedule.length === 0) {
    upcomingEl.innerHTML = '<p class="text-gray-500 text-sm py-4 text-center">No upcoming scheduled payments</p>';
  } else {
    upcomingEl.innerHTML = upcoming_schedule.map(p => `
      <div class="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
        <div>
          <p class="font-semibold text-white">${p.first_name} ${p.last_name}</p>
          <p class="text-xs text-gray-400">${[p.vehicle_year, p.vehicle_make, p.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'}</p>
        </div>
        <div class="text-right">
          <p class="font-bold text-white">${fmt$(p.amount_due)}</p>
          <p class="text-xs text-gray-400">${fmtDate(p.due_date)}</p>
        </div>
      </div>
    `).join('');
  }
}

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────

async function loadCustomers(search) {
  const url = search ? '/api/dealer/customers?search=' + encodeURIComponent(search) : '/api/dealer/customers';
  const res = await fetch(url);
  allCustomers = await res.json();

  const tbody = $('customers-tbody');
  if (allCustomers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-500">No customers yet. Add your first customer!</td></tr>';
    return;
  }
  tbody.innerHTML = allCustomers.map(c => `
    <tr class="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors" onclick="viewCustomer(${c.id})">
      <td class="py-3 px-4 font-semibold text-white">${c.first_name} ${c.last_name}</td>
      <td class="py-3 px-4 text-gray-300 font-mono text-sm">${c.phone || '—'}</td>
      <td class="py-3 px-4 text-gray-400 text-sm">${c.email || '—'}</td>
      <td class="py-3 px-4 text-center">
        <span class="px-2 py-1 rounded-full text-xs font-bold ${c.deal_count > 0 ? 'bg-blue-900 text-blue-300' : 'bg-gray-800 text-gray-500'}">${c.deal_count}</span>
      </td>
      <td class="py-3 px-4 text-right font-bold ${c.total_owed > 0 ? 'text-white' : 'text-gray-500'}">${fmt$(c.total_owed)}</td>
      <td class="py-3 px-4 text-right">
        <button onclick="event.stopPropagation();editCustomer(${c.id})" class="text-gray-500 hover:text-blue-400 transition-colors mr-3" title="Edit"><i class="fas fa-pen text-xs"></i></button>
        <button onclick="event.stopPropagation();deleteCustomer(${c.id},'${c.first_name} ${c.last_name}')" class="text-gray-500 hover:text-red-400 transition-colors" title="Delete"><i class="fas fa-trash text-xs"></i></button>
      </td>
    </tr>
  `).join('');
}

async function viewCustomer(id) {
  const res = await fetch('/api/dealer/customers/' + id);
  const { customer, deals } = await res.json();

  $('customer-detail-name').textContent = customer.first_name + ' ' + customer.last_name;
  $('customer-detail-phone').textContent = customer.phone || '—';
  $('customer-detail-email').textContent = customer.email || '—';
  $('customer-detail-address').textContent = [customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ') || '—';
  $('customer-detail-notes').textContent = customer.notes || '—';
  $('customer-detail-add-deal-btn').onclick = () => { closeModal('customer-modal'); showAddDealModal(customer.id, customer.first_name + ' ' + customer.last_name); };

  const dealsList = $('customer-detail-deals');
  if (deals.length === 0) {
    dealsList.innerHTML = '<p class="text-gray-500 text-sm py-4">No deals yet.</p>';
  } else {
    dealsList.innerHTML = deals.map(d => {
      const vehicle = [d.vehicle_year, d.vehicle_make, d.vehicle_model].filter(Boolean).join(' ') || 'Vehicle';
      const statusColor = { active: 'bg-green-900 text-green-300', paid_off: 'bg-gray-700 text-gray-400', defaulted: 'bg-red-900 text-red-400' }[d.status] || 'bg-gray-700 text-gray-400';
      return `
        <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors" onclick="closeModal('customer-modal');openDealDetail(${d.id})">
          <div class="flex items-start justify-between mb-2">
            <div>
              <p class="font-semibold text-white">${vehicle}</p>
              <p class="text-xs text-gray-400">Deal Date: ${fmtDate(d.deal_date)}</p>
            </div>
            <span class="px-2 py-1 rounded-full text-xs font-bold ${statusColor}">${d.status.replace('_', ' ')}</span>
          </div>
          <div class="grid grid-cols-3 gap-3 text-sm mt-3">
            <div><p class="text-gray-500 text-xs">Sale Price</p><p class="font-bold text-white">${fmt$(d.sale_price)}</p></div>
            <div><p class="text-gray-500 text-xs">Down Pmt</p><p class="font-bold text-green-400">${fmt$(d.down_payment)}</p></div>
            <div><p class="text-gray-500 text-xs">Remaining</p><p class="font-bold ${d.remaining_balance > 0 ? 'text-red-400' : 'text-green-400'}">${fmt$(d.remaining_balance)}</p></div>
          </div>
          ${d.overdue_count > 0 ? '<p class="text-xs text-red-400 mt-2 font-semibold"><i class="fas fa-exclamation-triangle mr-1"></i>' + d.overdue_count + ' overdue payment' + (d.overdue_count > 1 ? 's' : '') + '</p>' : ''}
        </div>`;
    }).join('');
  }
  openModal('customer-modal');
}

function showAddCustomerModal(id) {
  editingCustomer = id || null;
  $('customer-modal-title').textContent = id ? 'Edit Customer' : 'Add Customer';
  if (!id) {
    ['cust-first', 'cust-last', 'cust-phone', 'cust-email', 'cust-address', 'cust-city', 'cust-state', 'cust-zip', 'cust-notes'].forEach(f => { $(f).value = ''; });
  }
  openModal('add-customer-modal');
}

async function editCustomer(id) {
  const res = await fetch('/api/dealer/customers/' + id);
  const { customer } = await res.json();
  editingCustomer = id;
  $('customer-modal-title').textContent = 'Edit Customer';
  $('cust-first').value = customer.first_name || '';
  $('cust-last').value = customer.last_name || '';
  $('cust-phone').value = customer.phone || '';
  $('cust-email').value = customer.email || '';
  $('cust-address').value = customer.address || '';
  $('cust-city').value = customer.city || '';
  $('cust-state').value = customer.state || '';
  $('cust-zip').value = customer.zip || '';
  $('cust-notes').value = customer.notes || '';
  openModal('add-customer-modal');
}

async function saveCustomer() {
  const body = {
    first_name: $('cust-first').value.trim(),
    last_name: $('cust-last').value.trim(),
    phone: $('cust-phone').value.trim(),
    email: $('cust-email').value.trim(),
    address: $('cust-address').value.trim(),
    city: $('cust-city').value.trim(),
    state: $('cust-state').value.trim(),
    zip: $('cust-zip').value.trim(),
    notes: $('cust-notes').value.trim(),
  };
  if (!body.first_name || !body.last_name) { showToast('First and last name are required', 'error'); return; }
  const url = editingCustomer ? '/api/dealer/customers/' + editingCustomer : '/api/dealer/customers';
  const method = editingCustomer ? 'PUT' : 'POST';
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { showToast('Error saving customer', 'error'); return; }
  closeModal('add-customer-modal');
  showToast(editingCustomer ? 'Customer updated' : 'Customer added');
  loadCustomers();
  editingCustomer = null;
}

async function deleteCustomer(id, name) {
  if (!confirm('Delete ' + name + '? This will also delete all their deals and payment records.')) return;
  await fetch('/api/dealer/customers/' + id, { method: 'DELETE' });
  showToast('Customer deleted');
  loadCustomers();
}

// ─── DEALS ────────────────────────────────────────────────────────────────────

async function loadDeals(statusFilter) {
  const status = statusFilter || $('deal-status-filter')?.value || '';
  const url = '/api/dealer/deals' + (status ? '?status=' + status : '');
  const res = await fetch(url);
  const deals = await res.json();

  const tbody = $('deals-tbody');
  if (deals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-gray-500">No deals yet. Add your first deal!</td></tr>';
    return;
  }
  tbody.innerHTML = deals.map(d => {
    const vehicle = [d.vehicle_year, d.vehicle_make, d.vehicle_model].filter(Boolean).join(' ') || 'Vehicle';
    const statusColor = { active: 'bg-green-900 text-green-300', paid_off: 'bg-gray-700 text-gray-400', defaulted: 'bg-red-900 text-red-400' }[d.status] || 'bg-gray-700 text-gray-400';
    const overdueFlag = d.overdue_count > 0 ? '<span class="ml-2 px-1.5 py-0.5 rounded text-xs bg-red-900 text-red-400 font-bold">!' + d.overdue_count + ' OD</span>' : '';
    const safeName = (d.first_name + ' ' + d.last_name).replace(/'/g, "\\'");
    return `
      <tr class="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors" onclick="openDealDetail(${d.id})">
        <td class="py-3 px-4">
          <p class="font-semibold text-white">${d.first_name} ${d.last_name}</p>
          <p class="text-xs text-gray-400 font-mono">${d.phone || ''}</p>
        </td>
        <td class="py-3 px-4 text-gray-300">${vehicle}${overdueFlag}</td>
        <td class="py-3 px-4 text-right text-gray-300">${fmt$(d.sale_price)}</td>
        <td class="py-3 px-4 text-right text-green-400 font-semibold">${fmt$(d.down_payment)}</td>
        <td class="py-3 px-4 text-right font-bold ${d.remaining_balance > 0 ? 'text-white' : 'text-green-400'}">${fmt$(d.remaining_balance)}</td>
        <td class="py-3 px-4 text-center">
          <span class="px-2 py-1 rounded-full text-xs font-bold ${statusColor}">${d.status.replace('_', ' ')}</span>
        </td>
        <td class="py-3 px-4 text-center text-gray-400 text-sm">${fmtDate(d.next_due_date) || '—'}</td>
        <td class="py-3 px-4 text-right">
          <button onclick="event.stopPropagation();editDeal(${d.id})" class="text-gray-500 hover:text-blue-400 transition-colors mr-3" title="Edit"><i class="fas fa-pen text-xs"></i></button>
          <button onclick="event.stopPropagation();deleteDeal(${d.id},'${safeName}')" class="text-gray-500 hover:text-red-400 transition-colors" title="Delete"><i class="fas fa-trash text-xs"></i></button>
        </td>
      </tr>`;
  }).join('');
}

async function showAddDealModal(customerId, customerName) {
  editingDeal = null;
  const res = await fetch('/api/dealer/customers');
  allCustomers = await res.json();
  const sel = $('deal-customer-select');
  sel.innerHTML = '<option value="">Select customer…</option>' + allCustomers.map(c => `<option value="${c.id}">${c.first_name} ${c.last_name}</option>`).join('');
  if (customerId) sel.value = customerId;
  $('deal-modal-title').textContent = 'Add Deal';
  ['deal-year', 'deal-make', 'deal-model', 'deal-vin', 'deal-color', 'deal-stock', 'deal-sale-price', 'deal-down-payment', 'deal-notes', 'deal-payment-day'].forEach(f => { $(f).value = ''; });
  $('deal-date').value = today();
  $('deal-status-select').value = 'active';
  $('deal-pay-frequency').value = 'monthly';
  $('deal-financed-display').textContent = '$0.00';
  togglePaymentDay();
  openModal('add-deal-modal');
}

async function editDeal(id) {
  const res = await fetch('/api/dealer/deals/' + id);
  const { deal } = await res.json();
  editingDeal = id;
  const custRes = await fetch('/api/dealer/customers');
  allCustomers = await custRes.json();
  const sel = $('deal-customer-select');
  sel.innerHTML = '<option value="">Select customer…</option>' + allCustomers.map(c => `<option value="${c.id}">${c.first_name} ${c.last_name}</option>`).join('');
  $('deal-modal-title').textContent = 'Edit Deal';
  sel.value = deal.customer_id;
  $('deal-year').value = deal.vehicle_year || '';
  $('deal-make').value = deal.vehicle_make || '';
  $('deal-model').value = deal.vehicle_model || '';
  $('deal-vin').value = deal.vehicle_vin || '';
  $('deal-color').value = deal.vehicle_color || '';
  $('deal-stock').value = deal.vehicle_stock || '';
  $('deal-sale-price').value = deal.sale_price || '';
  $('deal-down-payment').value = deal.down_payment || '';
  $('deal-date').value = deal.deal_date || '';
  $('deal-status-select').value = deal.status || 'active';
  $('deal-notes').value = deal.notes || '';
  $('deal-pay-frequency').value = deal.pay_frequency || 'monthly';
  $('deal-payment-day').value = deal.payment_day || '';
  updateFinanced();
  togglePaymentDay();
  openModal('add-deal-modal');
}

async function deleteDeal(id, name) {
  if (!confirm('Delete deal for ' + name + '? All schedule entries and payment records will be removed.')) return;
  await fetch('/api/dealer/deals/' + id, { method: 'DELETE' });
  showToast('Deal deleted');
  loadDeals();
}

function editDealFromDetail() {
  closeModal('deal-detail-modal');
  editDeal(currentDealId);
}

async function deleteDealFromDetail() {
  if (!confirm('Delete this deal? All schedule entries and payment records will be removed.')) return;
  await fetch('/api/dealer/deals/' + currentDealId, { method: 'DELETE' });
  closeModal('deal-detail-modal');
  showToast('Deal deleted');
  loadDeals();
}

function togglePaymentDay() {
  const freq = $('deal-pay-frequency').value;
  $('payment-day-row').style.display = freq === 'monthly' ? 'block' : 'none';
}

function updateFinanced() {
  const sp = parseFloat($('deal-sale-price').value) || 0;
  const dp = parseFloat($('deal-down-payment').value) || 0;
  $('deal-financed-display').textContent = fmt$(sp - dp);
}

async function saveDeal() {
  const customer_id = $('deal-customer-select').value;
  const sale_price = $('deal-sale-price').value;
  const deal_date = $('deal-date').value;
  if (!customer_id) { showToast('Please select a customer', 'error'); return; }
  if (!sale_price) { showToast('Sale price is required', 'error'); return; }
  if (!deal_date) { showToast('Deal date is required', 'error'); return; }
  const body = {
    customer_id, sale_price, down_payment: $('deal-down-payment').value || 0, deal_date,
    vehicle_year: $('deal-year').value, vehicle_make: $('deal-make').value,
    vehicle_model: $('deal-model').value, vehicle_vin: $('deal-vin').value,
    vehicle_color: $('deal-color').value, vehicle_stock: $('deal-stock').value,
    status: $('deal-status-select').value, notes: $('deal-notes').value,
    pay_frequency: $('deal-pay-frequency').value,
    payment_day: $('deal-payment-day').value ? parseInt($('deal-payment-day').value) : null,
  };
  const url = editingDeal ? '/api/dealer/deals/' + editingDeal : '/api/dealer/deals';
  const method = editingDeal ? 'PUT' : 'POST';
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { showToast('Error saving deal', 'error'); return; }
  const deal = await res.json();
  closeModal('add-deal-modal');
  showToast(editingDeal ? 'Deal updated' : 'Deal created');
  editingDeal = null;
  openDealDetail(deal.id);
}

async function openDealDetail(id) {
  currentDealId = id;
  const res = await fetch('/api/dealer/deals/' + id);
  const { deal, schedule, payments } = await res.json();
  renderDealDetail(deal, schedule, payments);
  openModal('deal-detail-modal');
}

function renderDealDetail(deal, schedule, payments) {
  const vehicle = [deal.vehicle_year, deal.vehicle_make, deal.vehicle_model].filter(Boolean).join(' ') || 'Vehicle';
  const statusColor = { active: 'bg-green-900 text-green-300', paid_off: 'bg-gray-700 text-gray-400', defaulted: 'bg-red-900 text-red-400' }[deal.status] || 'bg-gray-700 text-gray-400';

  $('deal-detail-title').textContent = vehicle;
  $('deal-detail-customer').textContent = deal.first_name + ' ' + deal.last_name;
  $('deal-detail-phone').textContent = deal.phone || '—';
  $('deal-detail-status').innerHTML = '<span class="px-2 py-1 rounded-full text-xs font-bold ' + statusColor + '">' + deal.status.replace('_', ' ') + '</span>';
  $('deal-detail-vin').textContent = deal.vehicle_vin || '—';
  $('deal-detail-color').textContent = deal.vehicle_color || '—';
  $('deal-detail-date').textContent = fmtDate(deal.deal_date);
  $('deal-detail-frequency').textContent = capitalize(deal.pay_frequency || 'monthly');
  $('deal-detail-payment-day').textContent = deal.payment_day ? 'Day ' + deal.payment_day : '—';
  $('deal-detail-sale').textContent = fmt$(deal.sale_price);
  $('deal-detail-down').textContent = fmt$(deal.down_payment);
  $('deal-detail-financed').textContent = fmt$(deal.amount_financed);
  $('deal-detail-paid').textContent = fmt$(deal.total_paid);
  $('deal-detail-remaining').textContent = fmt$(deal.remaining_balance);
  $('deal-detail-notes').textContent = deal.notes || '—';

  // Schedule
  const schedEl = $('deal-detail-schedule');
  if (schedule.length === 0) {
    schedEl.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-gray-500 text-sm">No payment schedule yet. Add entries below.</td></tr>';
  } else {
    const todayStr = today();
    schedEl.innerHTML = schedule.map(s => {
      const isOverdue = s.status !== 'paid' && s.due_date < todayStr;
      const rowColor = s.status === 'paid' ? 'text-gray-500' : isOverdue ? 'text-red-400' : 'text-white';
      const statusBadge = s.status === 'paid'
        ? '<span class="px-2 py-0.5 rounded-full text-xs bg-green-900 text-green-400">Paid</span>'
        : isOverdue
          ? '<span class="px-2 py-0.5 rounded-full text-xs bg-red-900 text-red-400">Overdue</span>'
          : '<span class="px-2 py-0.5 rounded-full text-xs bg-yellow-900 text-yellow-400">Pending</span>';
      return `
        <tr class="border-b border-gray-800">
          <td class="py-2.5 px-3 ${rowColor}">${fmtDate(s.due_date)}</td>
          <td class="py-2.5 px-3 text-right ${rowColor} font-semibold">${fmt$(s.amount_due)}</td>
          <td class="py-2.5 px-3 text-center">${statusBadge}</td>
          <td class="py-2.5 px-3 text-right">
            ${s.status !== 'paid' ? '<button onclick="recordPaymentFromSchedule(' + s.id + ',' + s.amount_due + ')" class="text-xs bg-green-900 hover:bg-green-800 text-green-300 px-2 py-1 rounded mr-1 transition-colors">Pay</button>' : ''}
            <button onclick="deleteScheduleEntry(${s.id})" class="text-xs text-gray-600 hover:text-red-400 transition-colors"><i class="fas fa-times"></i></button>
          </td>
        </tr>`;
    }).join('');
  }

  // Payments
  const pymtEl = $('deal-detail-payments');
  if (payments.length === 0) {
    pymtEl.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-gray-500 text-sm">No payments recorded yet.</td></tr>';
  } else {
    pymtEl.innerHTML = payments.map(p => `
      <tr class="border-b border-gray-800">
        <td class="py-2.5 px-3 text-gray-300">${fmtDate(p.paid_date)}</td>
        <td class="py-2.5 px-3 text-right font-bold text-green-400">${fmt$(p.amount_paid)}</td>
        <td class="py-2.5 px-3 text-gray-400 text-sm">${capitalize(p.payment_method)}${p.reference_number ? ' #' + p.reference_number : ''}</td>
        <td class="py-2.5 px-3 text-right">
          <button onclick="deletePayment(${p.id})" class="text-xs text-gray-600 hover:text-red-400 transition-colors"><i class="fas fa-times"></i></button>
        </td>
      </tr>`).join('');
  }
}

async function refreshDealDetail() {
  if (!currentDealId) return;
  const res = await fetch('/api/dealer/deals/' + currentDealId);
  const { deal, schedule, payments } = await res.json();
  renderDealDetail(deal, schedule, payments);
}

// Add schedule entry
function showAddScheduleForm() {
  $('schedule-form-area').style.display = $('schedule-form-area').style.display === 'none' ? 'block' : 'none';
}

async function addScheduleEntry() {
  const due_date = $('sched-due-date').value;
  const amount_due = $('sched-amount').value;
  if (!due_date || !amount_due) { showToast('Due date and amount required', 'error'); return; }
  const res = await fetch('/api/dealer/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deal_id: currentDealId, due_date, amount_due, notes: $('sched-notes').value }),
  });
  if (!res.ok) { showToast('Error adding schedule entry', 'error'); return; }
  $('sched-due-date').value = '';
  $('sched-amount').value = '';
  $('sched-notes').value = '';
  showToast('Schedule entry added');
  refreshDealDetail();
}

async function generatePaymentSchedule() {
  const numPayments = parseInt($('gen-num-payments').value);
  const amount = parseFloat($('gen-amount').value);
  const startDate = $('gen-start-date').value;
  const frequency = $('gen-frequency').value;
  if (!numPayments || !amount || !startDate) { showToast('Fill in all fields to generate schedule', 'error'); return; }

  const entries = [];
  let d = new Date(startDate + 'T12:00:00');
  for (let i = 0; i < numPayments; i++) {
    entries.push({ due_date: d.toISOString().split('T')[0], amount_due: amount });
    if (frequency === 'weekly') d = new Date(d.getTime() + 7 * 864e5);
    else if (frequency === 'biweekly') d = new Date(d.getTime() + 14 * 864e5);
    else { // monthly
      d = new Date(d);
      d.setMonth(d.getMonth() + 1);
    }
  }

  const res = await fetch('/api/dealer/schedule/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deal_id: currentDealId, entries }),
  });
  if (!res.ok) { showToast('Error generating schedule', 'error'); return; }
  const data = await res.json();
  showToast(data.inserted + ' payment entries added');
  $('gen-schedule-form').style.display = 'none';
  refreshDealDetail();
}

async function deleteScheduleEntry(id) {
  if (!confirm('Remove this scheduled payment?')) return;
  await fetch('/api/dealer/schedule/' + id, { method: 'DELETE' });
  showToast('Removed');
  refreshDealDetail();
}

// Record payment
function showRecordPaymentModal() {
  $('pay-deal-id').value = currentDealId;
  $('pay-schedule-id').value = '';
  $('pay-date').value = today();
  $('pay-amount').value = '';
  $('pay-method').value = 'cash';
  $('pay-ref').value = '';
  $('pay-received-by').value = '';
  $('pay-notes').value = '';
  openModal('record-payment-modal');
}

function recordPaymentFromSchedule(scheduleId, amount) {
  $('pay-deal-id').value = currentDealId;
  $('pay-schedule-id').value = scheduleId;
  $('pay-date').value = today();
  $('pay-amount').value = amount;
  $('pay-method').value = 'cash';
  $('pay-ref').value = '';
  $('pay-received-by').value = '';
  $('pay-notes').value = '';
  openModal('record-payment-modal');
}

async function savePayment() {
  const deal_id = $('pay-deal-id').value;
  const paid_date = $('pay-date').value;
  const amount_paid = $('pay-amount').value;
  if (!paid_date || !amount_paid) { showToast('Date and amount required', 'error'); return; }
  const body = {
    deal_id, paid_date, amount_paid,
    schedule_id: $('pay-schedule-id').value || null,
    payment_method: $('pay-method').value,
    reference_number: $('pay-ref').value,
    received_by: $('pay-received-by').value,
    notes: $('pay-notes').value,
  };
  const res = await fetch('/api/dealer/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { showToast('Error recording payment', 'error'); return; }
  closeModal('record-payment-modal');
  showToast('Payment recorded!');
  refreshDealDetail();
  if (currentTab === 'dashboard') loadDashboard();
}

async function deletePayment(id) {
  if (!confirm('Remove this payment record?')) return;
  await fetch('/api/dealer/payments/' + id, { method: 'DELETE' });
  showToast('Payment removed');
  refreshDealDetail();
}

// ─── ALL PAYMENTS TAB ─────────────────────────────────────────────────────────

async function loadAllPayments() {
  const res = await fetch('/api/dealer/payments?limit=100');
  const payments = await res.json();
  const tbody = $('payments-tbody');
  if (payments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-500">No payments recorded yet.</td></tr>';
    return;
  }
  tbody.innerHTML = payments.map(p => `
    <tr class="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
      <td class="py-3 px-4 font-semibold text-white">${p.first_name} ${p.last_name}</td>
      <td class="py-3 px-4 text-gray-400 text-sm">${[p.vehicle_year, p.vehicle_make, p.vehicle_model].filter(Boolean).join(' ') || '—'}</td>
      <td class="py-3 px-4 text-gray-300">${fmtDate(p.paid_date)}</td>
      <td class="py-3 px-4 text-right font-bold text-green-400">${fmt$(p.amount_paid)}</td>
      <td class="py-3 px-4 text-gray-400 text-sm">${capitalize(p.payment_method)}${p.reference_number ? ' · #' + p.reference_number : ''}</td>
      <td class="py-3 px-4 text-gray-400 text-sm">${p.notes || '—'}</td>
    </tr>`).join('');
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function openModal(id) { $(id).style.display = 'flex'; }
function closeModal(id) { $(id).style.display = 'none'; }
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ') : ''; }

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.style.display = 'none';
  }
});

// Init
setTab('dashboard');
