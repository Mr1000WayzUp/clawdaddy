import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import dealerRouter from './routes/dealership'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())
app.route('/api/dealer', dealerRouter)

app.use('/static/*', serveStatic({ root: './' }))

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Cruz Business Information Tracker</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css"/>
  <style>
    body { background:#030712; color:#f3f4f6; font-family:ui-sans-serif,system-ui,sans-serif; }
    ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-track{background:#111827} ::-webkit-scrollbar-thumb{background:#374151;border-radius:3px}
    .nav-btn { display:flex;align-items:center;gap:.5rem;padding:.5rem 1.25rem;border-radius:.5rem;font-size:.875rem;font-weight:600;color:#9ca3af;transition:all .15s;cursor:pointer;border:none;background:transparent; }
    .nav-btn:hover { background:#1f2937;color:#f3f4f6; }
    .active-tab { background:#1d4ed8!important;color:#fff!important; }
    .card { background:#111827;border:1px solid #1f2937;border-radius:.75rem; }
    .input { width:100%;padding:.5rem .75rem;background:#1f2937;border:1px solid #374151;border-radius:.5rem;color:#f3f4f6;font-size:.875rem;outline:none;transition:border-color .15s; }
    .input:focus { border-color:#3b82f6; }
    .input::placeholder { color:#4b5563; }
    .btn { display:inline-flex;align-items:center;gap:.375rem;padding:.5rem 1rem;border-radius:.5rem;font-size:.875rem;font-weight:600;cursor:pointer;transition:all .15s;border:none; }
    .btn-primary { background:#1d4ed8;color:#fff; }
    .btn-primary:hover { background:#1e40af; }
    .btn-success { background:#065f46;color:#6ee7b7; }
    .btn-success:hover { background:#047857; }
    .btn-ghost { background:#1f2937;color:#d1d5db; }
    .btn-ghost:hover { background:#374151; }
    .btn-danger { background:#7f1d1d;color:#fca5a5; }
    .btn-danger:hover { background:#991b1b; }
    .modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;display:flex;align-items:center;justify-content:center;padding:1rem; }
    .modal { background:#111827;border:1px solid #374151;border-radius:1rem;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,.5); }
    label { display:block;font-size:.75rem;font-weight:600;color:#9ca3af;margin-bottom:.25rem;text-transform:uppercase;letter-spacing:.05em; }
    select.input { appearance:none; }
  </style>
</head>
<body class="min-h-screen">

<!-- HEADER -->
<header class="sticky top-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800">
  <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg">
        <i class="fas fa-car text-white text-sm"></i>
      </div>
      <div>
        <h1 class="font-black text-white text-lg leading-none">Cruz Business</h1>
        <p class="text-xs text-gray-500">Information Tracker</p>
      </div>
    </div>
    <nav class="flex items-center gap-1">
      <button class="nav-btn" data-tab="dashboard" onclick="setTab('dashboard')"><i class="fas fa-chart-line text-xs"></i> Dashboard</button>
      <button class="nav-btn" data-tab="customers" onclick="setTab('customers')"><i class="fas fa-users text-xs"></i> Customers</button>
      <button class="nav-btn" data-tab="deals" onclick="setTab('deals')"><i class="fas fa-handshake text-xs"></i> Deals</button>
      <button class="nav-btn" data-tab="payments" onclick="setTab('payments')"><i class="fas fa-dollar-sign text-xs"></i> Payments</button>
      <button class="nav-btn" data-tab="expenses" onclick="setTab('expenses')"><i class="fas fa-receipt text-xs"></i> Expenses</button>
    </nav>
  </div>
</header>

<main class="max-w-7xl mx-auto px-4 py-6">

  <!-- ALERT BANNER -->
  <div id="alert-banner" class="hidden mb-6 bg-red-950 border border-red-800 rounded-xl px-5 py-3 flex items-center gap-3">
    <i class="fas fa-bell text-red-400 text-lg"></i>
    <p class="font-bold text-red-300" id="alert-count"></p>
  </div>

  <!-- ── DASHBOARD ── -->
  <div id="tab-dashboard" class="tab-panel">

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
      <div class="card p-5">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Customers</p>
        <p class="text-3xl font-black text-white" id="stat-customers">—</p>
      </div>
      <div class="card p-5">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Active Deals</p>
        <p class="text-3xl font-black text-blue-400" id="stat-deals">—</p>
      </div>
      <div class="card p-5">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Total Owed (Customer)</p>
        <p class="text-3xl font-black text-white" id="stat-owed">—</p>
      </div>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <div class="card p-5">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Payments Overdue</p>
        <p class="text-3xl font-black text-red-400" id="stat-overdue">—</p>
      </div>
      <div class="card p-5">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Unpaid Expenses</p>
        <p class="text-3xl font-black text-orange-400" id="stat-expense-unpaid">—</p>
      </div>
      <div class="card p-5">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Overdue Expenses</p>
        <p class="text-3xl font-black text-red-400" id="stat-expense-overdue">—</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <!-- Overdue -->
      <div class="card p-5">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-3 h-3 rounded-full bg-red-500"></div>
          <h2 class="font-bold text-white">Overdue Payments</h2>
        </div>
        <div id="overdue-list"></div>
      </div>

      <!-- Due Soon -->
      <div class="card p-5">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
          <h2 class="font-bold text-white">Due Within 7 Days</h2>
        </div>
        <div id="due-soon-list"></div>
      </div>

      <!-- Overdue Expenses -->
      <div class="card p-5">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-3 h-3 rounded-full bg-orange-400"></div>
          <h2 class="font-bold text-white">Overdue Bills &amp; Expenses</h2>
        </div>
        <div id="overdue-expenses-list"></div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Recent payments -->
      <div class="card p-5">
        <h2 class="font-bold text-white mb-4">Recent Payments</h2>
        <div id="recent-payments-list"></div>
      </div>
      <!-- Upcoming schedule -->
      <div class="card p-5">
        <h2 class="font-bold text-white mb-4">Upcoming Schedule</h2>
        <div id="upcoming-schedule-list"></div>
      </div>
    </div>
  </div>

  <!-- ── CUSTOMERS ── -->
  <div id="tab-customers" class="tab-panel" style="display:none">
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xl font-bold text-white">Customers</h2>
      <button class="btn btn-primary" onclick="showAddCustomerModal()"><i class="fas fa-plus"></i> Add Customer</button>
    </div>
    <div class="card mb-4 px-4 py-3 flex items-center gap-3">
      <i class="fas fa-search text-gray-500"></i>
      <input class="input flex-1 bg-transparent border-0 p-0 focus:ring-0" placeholder="Search by name, phone, email…" oninput="loadCustomers(this.value)" />
    </div>
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-800 text-left">
            <th class="py-3 px-4 text-gray-400 font-semibold">Name</th>
            <th class="py-3 px-4 text-gray-400 font-semibold">Phone</th>
            <th class="py-3 px-4 text-gray-400 font-semibold">Email</th>
            <th class="py-3 px-4 text-gray-400 font-semibold text-center">Deals</th>
            <th class="py-3 px-4 text-gray-400 font-semibold text-right">Balance Owed</th>
            <th class="py-3 px-4 text-gray-400 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody id="customers-tbody"></tbody>
      </table>
    </div>
  </div>

  <!-- ── DEALS ── -->
  <div id="tab-deals" class="tab-panel" style="display:none">
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xl font-bold text-white">Deals</h2>
      <div class="flex items-center gap-3">
        <select id="deal-status-filter" class="input w-auto text-sm" onchange="loadDeals()">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="paid_off">Paid Off</option>
          <option value="defaulted">Defaulted</option>
        </select>
        <button class="btn btn-primary" onclick="showAddDealModal()"><i class="fas fa-plus"></i> Add Deal</button>
      </div>
    </div>
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-800 text-left">
            <th class="py-3 px-4 text-gray-400 font-semibold">Customer</th>
            <th class="py-3 px-4 text-gray-400 font-semibold">Vehicle</th>
            <th class="py-3 px-4 text-gray-400 font-semibold text-right">Sale Price</th>
            <th class="py-3 px-4 text-gray-400 font-semibold text-right">Down Pmt</th>
            <th class="py-3 px-4 text-gray-400 font-semibold text-right">Remaining</th>
            <th class="py-3 px-4 text-gray-400 font-semibold text-center">Status</th>
            <th class="py-3 px-4 text-gray-400 font-semibold text-center">Next Due</th>
            <th class="py-3 px-4 text-gray-400 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody id="deals-tbody"></tbody>
      </table>
    </div>
  </div>

  <!-- ── PAYMENTS ── -->
  <div id="tab-payments" class="tab-panel" style="display:none">
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xl font-bold text-white">Payment History</h2>
    </div>
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-800 text-left">
            <th class="py-3 px-4 text-gray-400 font-semibold">Customer</th>
            <th class="py-3 px-4 text-gray-400 font-semibold">Vehicle</th>
            <th class="py-3 px-4 text-gray-400 font-semibold">Date Paid</th>
            <th class="py-3 px-4 text-gray-400 font-semibold text-right">Amount</th>
            <th class="py-3 px-4 text-gray-400 font-semibold">Method</th>
            <th class="py-3 px-4 text-gray-400 font-semibold">Notes</th>
          </tr>
        </thead>
        <tbody id="payments-tbody"></tbody>
      </table>
    </div>
  </div>

  <!-- ── EXPENSES ── -->
  <div id="tab-expenses" class="tab-panel" style="display:none">
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xl font-bold text-white">Business Expenses</h2>
      <div class="flex items-center gap-3">
        <select id="expense-category-filter" class="input w-auto text-sm" onchange="loadExpenses()">
          <option value="">All Categories</option>
          <option value="bill">Bills</option>
          <option value="repair">Repairs</option>
          <option value="tax">Taxes</option>
          <option value="registration">Registration</option>
          <option value="other">Other</option>
        </select>
        <select id="expense-status-filter" class="input w-auto text-sm" onchange="loadExpenses()">
          <option value="">All Statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
        <button class="btn btn-primary" onclick="showAddExpenseModal()"><i class="fas fa-plus"></i> Add Expense</button>
      </div>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="card p-4">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Bills Unpaid</p>
        <p class="text-2xl font-black text-blue-400" id="exp-sum-bill">—</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Repairs Unpaid</p>
        <p class="text-2xl font-black text-purple-400" id="exp-sum-repair">—</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Taxes Unpaid</p>
        <p class="text-2xl font-black text-orange-400" id="exp-sum-tax">—</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Registrations Unpaid</p>
        <p class="text-2xl font-black text-teal-400" id="exp-sum-registration">—</p>
      </div>
    </div>
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-800 text-left">
            <th class="py-3 px-4 text-gray-400 font-semibold">Description</th>
            <th class="py-3 px-4 text-gray-400 font-semibold">Category</th>
            <th class="py-3 px-4 text-gray-400 font-semibold">Vendor</th>
            <th class="py-3 px-4 text-gray-400 font-semibold text-right">Amount</th>
            <th class="py-3 px-4 text-gray-400 font-semibold">Due Date</th>
            <th class="py-3 px-4 text-gray-400 font-semibold text-center">Status</th>
            <th class="py-3 px-4 text-gray-400 font-semibold">Vehicle</th>
            <th class="py-3 px-4 text-gray-400 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody id="expenses-tbody"></tbody>
      </table>
    </div>
  </div>

</main>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- MODALS -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->

<!-- Add/Edit Customer -->
<div id="add-customer-modal" class="modal-backdrop" style="display:none">
  <div class="modal max-w-lg w-full">
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
      <h3 class="font-bold text-white text-lg" id="customer-modal-title">Add Customer</h3>
      <button onclick="closeModal('add-customer-modal')" class="text-gray-500 hover:text-white transition-colors"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-6 space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label>First Name *</label><input id="cust-first" class="input" placeholder="John" /></div>
        <div><label>Last Name *</label><input id="cust-last" class="input" placeholder="Smith" /></div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><label>Phone</label><input id="cust-phone" class="input" placeholder="(555) 000-0000" /></div>
        <div><label>Email</label><input id="cust-email" class="input" placeholder="john@email.com" /></div>
      </div>
      <div><label>Street Address</label><input id="cust-address" class="input" placeholder="123 Main St" /></div>
      <div class="grid grid-cols-3 gap-3">
        <div class="col-span-1"><label>City</label><input id="cust-city" class="input" placeholder="City" /></div>
        <div><label>State</label><input id="cust-state" class="input" placeholder="LA" maxlength="2" /></div>
        <div><label>ZIP</label><input id="cust-zip" class="input" placeholder="70000" /></div>
      </div>
      <div><label>Notes</label><textarea id="cust-notes" class="input" rows="2" placeholder="Any notes about this customer…"></textarea></div>
    </div>
    <div class="flex justify-end gap-3 px-6 pb-5">
      <button class="btn btn-ghost" onclick="closeModal('add-customer-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="saveCustomer()"><i class="fas fa-save"></i> Save Customer</button>
    </div>
  </div>
</div>

<!-- Customer Detail Modal -->
<div id="customer-modal" class="modal-backdrop" style="display:none">
  <div class="modal max-w-2xl w-full">
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
      <h3 class="font-bold text-white text-lg" id="customer-detail-name"></h3>
      <button onclick="closeModal('customer-modal')" class="text-gray-500 hover:text-white transition-colors"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-6">
      <div class="grid grid-cols-2 gap-4 mb-5 text-sm">
        <div><p class="text-gray-500 text-xs uppercase font-semibold mb-1">Phone</p><p class="text-white font-mono" id="customer-detail-phone"></p></div>
        <div><p class="text-gray-500 text-xs uppercase font-semibold mb-1">Email</p><p class="text-white" id="customer-detail-email"></p></div>
        <div class="col-span-2"><p class="text-gray-500 text-xs uppercase font-semibold mb-1">Address</p><p class="text-white" id="customer-detail-address"></p></div>
        <div class="col-span-2"><p class="text-gray-500 text-xs uppercase font-semibold mb-1">Notes</p><p class="text-gray-400 italic" id="customer-detail-notes"></p></div>
      </div>
      <div class="flex items-center justify-between mb-3">
        <h4 class="font-bold text-white">Deals</h4>
        <button id="customer-detail-add-deal-btn" class="btn btn-primary text-xs py-1.5"><i class="fas fa-plus"></i> Add Deal</button>
      </div>
      <div id="customer-detail-deals" class="space-y-3"></div>
    </div>
  </div>
</div>

<!-- Add/Edit Deal -->
<div id="add-deal-modal" class="modal-backdrop" style="display:none">
  <div class="modal max-w-xl w-full">
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
      <h3 class="font-bold text-white text-lg" id="deal-modal-title">Add Deal</h3>
      <button onclick="closeModal('add-deal-modal')" class="text-gray-500 hover:text-white transition-colors"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-6 space-y-4">
      <div><label>Customer *</label>
        <select id="deal-customer-select" class="input"></select>
      </div>
      <div class="grid grid-cols-4 gap-3">
        <div><label>Year</label><input id="deal-year" class="input" placeholder="2020" maxlength="4" /></div>
        <div class="col-span-1"><label>Make</label><input id="deal-make" class="input" placeholder="Ford" /></div>
        <div class="col-span-2"><label>Model</label><input id="deal-model" class="input" placeholder="F-150" /></div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div><label>Color</label><input id="deal-color" class="input" placeholder="Silver" /></div>
        <div><label>Stock #</label><input id="deal-stock" class="input" placeholder="A001" /></div>
        <div><label>VIN</label><input id="deal-vin" class="input" placeholder="1FTFW…" /></div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><label>Sale Price *</label><input id="deal-sale-price" class="input" type="number" step="0.01" placeholder="8500.00" oninput="updateFinanced()" /></div>
        <div><label>Down Payment</label><input id="deal-down-payment" class="input" type="number" step="0.01" placeholder="500.00" oninput="updateFinanced()" /></div>
      </div>
      <div class="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
        <span class="text-gray-400 text-sm font-semibold">Amount Financed</span>
        <span class="text-white font-black text-xl" id="deal-financed-display">$0.00</span>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><label>Deal Date *</label><input id="deal-date" class="input" type="date" /></div>
        <div><label>Status</label>
          <select id="deal-status-select" class="input">
            <option value="active">Active</option>
            <option value="paid_off">Paid Off</option>
            <option value="defaulted">Defaulted</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><label>Pay Frequency</label>
          <select id="deal-pay-frequency" class="input" onchange="togglePaymentDay()">
            <option value="monthly">Monthly</option>
            <option value="biweekly">Bi-Weekly</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div id="payment-day-row"><label>Payment Day of Month</label>
          <input id="deal-payment-day" class="input" type="number" min="1" max="28" placeholder="e.g. 15" />
        </div>
      </div>
      <div><label>Notes</label><textarea id="deal-notes" class="input" rows="2" placeholder="Any notes about this deal…"></textarea></div>
    </div>
    <div class="flex justify-end gap-3 px-6 pb-5">
      <button class="btn btn-ghost" onclick="closeModal('add-deal-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="saveDeal()"><i class="fas fa-save"></i> Save Deal</button>
    </div>
  </div>
</div>

<!-- Deal Detail Modal -->
<div id="deal-detail-modal" class="modal-backdrop" style="display:none">
  <div class="modal max-w-3xl w-full">
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
      <div>
        <h3 class="font-bold text-white text-lg" id="deal-detail-title"></h3>
        <div class="flex items-center gap-3 mt-1">
          <span class="text-sm text-gray-400" id="deal-detail-customer"></span>
          <span class="text-sm text-blue-400 font-mono" id="deal-detail-phone"></span>
          <span id="deal-detail-status"></span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="editDealFromDetail()" class="btn btn-ghost text-xs py-1.5"><i class="fas fa-pen"></i> Edit</button>
        <button onclick="deleteDealFromDetail()" class="btn btn-danger text-xs py-1.5"><i class="fas fa-trash"></i></button>
        <button onclick="closeModal('deal-detail-modal')" class="text-gray-500 hover:text-white transition-colors ml-1"><i class="fas fa-times"></i></button>
      </div>
    </div>
    <div class="p-6">

      <!-- Deal Info -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div class="card p-3"><p class="text-xs text-gray-500 mb-1">Sale Price</p><p class="font-bold text-white" id="deal-detail-sale"></p></div>
        <div class="card p-3"><p class="text-xs text-gray-500 mb-1">Down Payment</p><p class="font-bold text-green-400" id="deal-detail-down"></p></div>
        <div class="card p-3"><p class="text-xs text-gray-500 mb-1">Financed</p><p class="font-bold text-white" id="deal-detail-financed"></p></div>
        <div class="card p-3"><p class="text-xs text-gray-500 mb-1">Remaining</p><p class="font-bold text-red-400" id="deal-detail-remaining"></p></div>
      </div>
      <div class="grid grid-cols-3 md:grid-cols-6 gap-3 text-sm mb-4">
        <div><p class="text-gray-500 text-xs">Total Paid</p><p class="text-green-400 font-semibold" id="deal-detail-paid"></p></div>
        <div><p class="text-gray-500 text-xs">Deal Date</p><p class="text-gray-300" id="deal-detail-date"></p></div>
        <div><p class="text-gray-500 text-xs">Pay Frequency</p><p class="text-gray-300" id="deal-detail-frequency"></p></div>
        <div><p class="text-gray-500 text-xs">Payment Day</p><p class="text-gray-300" id="deal-detail-payment-day"></p></div>
        <div><p class="text-gray-500 text-xs">VIN</p><p class="text-gray-300 font-mono text-xs" id="deal-detail-vin"></p></div>
        <div><p class="text-gray-500 text-xs">Color</p><p class="text-gray-300" id="deal-detail-color"></p></div>
      </div>
      <p class="text-xs text-gray-500 italic mb-4" id="deal-detail-notes"></p>

      <!-- Record Payment Button -->
      <div class="flex items-center justify-between mb-3">
        <h4 class="font-bold text-white">Payment Schedule</h4>
        <div class="flex gap-2">
          <button class="btn btn-ghost text-xs py-1.5" onclick="document.getElementById('gen-schedule-form').style.display=document.getElementById('gen-schedule-form').style.display==='none'?'block':'none'"><i class="fas fa-magic"></i> Auto-Generate</button>
          <button class="btn btn-ghost text-xs py-1.5" onclick="showAddScheduleForm()"><i class="fas fa-plus"></i> Add Entry</button>
          <button class="btn btn-success text-xs py-1.5" onclick="showRecordPaymentModal()"><i class="fas fa-dollar-sign"></i> Record Payment</button>
        </div>
      </div>

      <!-- Auto-generate form -->
      <div id="gen-schedule-form" class="bg-gray-800 rounded-lg p-4 mb-3 border border-gray-700" style="display:none">
        <p class="text-sm font-semibold text-white mb-3">Auto-Generate Payment Schedule</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div><label>Frequency</label>
            <select id="gen-frequency" class="input text-sm">
              <option value="monthly">Monthly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div><label># of Payments</label><input id="gen-num-payments" class="input text-sm" type="number" min="1" placeholder="12" /></div>
          <div><label>Amount Each</label><input id="gen-amount" class="input text-sm" type="number" step="0.01" placeholder="250.00" /></div>
          <div><label>First Due Date</label><input id="gen-start-date" class="input text-sm" type="date" /></div>
        </div>
        <div class="flex gap-2 justify-end">
          <button class="btn btn-ghost text-xs" onclick="document.getElementById('gen-schedule-form').style.display='none'">Cancel</button>
          <button class="btn btn-primary text-xs" onclick="generatePaymentSchedule()"><i class="fas fa-magic"></i> Generate</button>
        </div>
      </div>

      <!-- Manual add entry form -->
      <div id="schedule-form-area" class="bg-gray-800 rounded-lg p-4 mb-3 border border-gray-700" style="display:none">
        <div class="grid grid-cols-3 gap-3 mb-3">
          <div><label>Due Date</label><input id="sched-due-date" class="input text-sm" type="date" /></div>
          <div><label>Amount Due</label><input id="sched-amount" class="input text-sm" type="number" step="0.01" placeholder="250.00" /></div>
          <div><label>Notes</label><input id="sched-notes" class="input text-sm" placeholder="Optional" /></div>
        </div>
        <div class="flex gap-2 justify-end">
          <button class="btn btn-ghost text-xs" onclick="showAddScheduleForm()">Cancel</button>
          <button class="btn btn-primary text-xs" onclick="addScheduleEntry()"><i class="fas fa-plus"></i> Add</button>
        </div>
      </div>

      <!-- Schedule table -->
      <div class="card overflow-hidden mb-5">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800">
            <th class="py-2 px-3 text-left text-gray-500 font-semibold">Due Date</th>
            <th class="py-2 px-3 text-right text-gray-500 font-semibold">Amount</th>
            <th class="py-2 px-3 text-center text-gray-500 font-semibold">Status</th>
            <th class="py-2 px-3 text-right text-gray-500 font-semibold">Action</th>
          </tr></thead>
          <tbody id="deal-detail-schedule"></tbody>
        </table>
      </div>

      <!-- Payment history -->
      <h4 class="font-bold text-white mb-3">Payment History</h4>
      <div class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800">
            <th class="py-2 px-3 text-left text-gray-500 font-semibold">Date</th>
            <th class="py-2 px-3 text-right text-gray-500 font-semibold">Amount</th>
            <th class="py-2 px-3 text-left text-gray-500 font-semibold">Method</th>
            <th class="py-2 px-3 text-right text-gray-500 font-semibold">Remove</th>
          </tr></thead>
          <tbody id="deal-detail-payments"></tbody>
        </table>
      </div>

    </div>
  </div>
</div>

<!-- Record Payment Modal -->
<div id="record-payment-modal" class="modal-backdrop" style="display:none">
  <div class="modal max-w-md w-full">
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
      <h3 class="font-bold text-white text-lg">Record Payment</h3>
      <button onclick="closeModal('record-payment-modal')" class="text-gray-500 hover:text-white transition-colors"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-6 space-y-4">
      <input type="hidden" id="pay-deal-id" />
      <input type="hidden" id="pay-schedule-id" />
      <div class="grid grid-cols-2 gap-4">
        <div><label>Date Received *</label><input id="pay-date" class="input" type="date" /></div>
        <div><label>Amount Paid *</label><input id="pay-amount" class="input" type="number" step="0.01" placeholder="0.00" /></div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><label>Payment Method</label>
          <select id="pay-method" class="input">
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="card">Card</option>
            <option value="money_order">Money Order</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div><label>Reference / Check #</label><input id="pay-ref" class="input" placeholder="Optional" /></div>
      </div>
      <div><label>Received By</label><input id="pay-received-by" class="input" placeholder="Staff name" /></div>
      <div><label>Notes</label><textarea id="pay-notes" class="input" rows="2" placeholder="Any notes…"></textarea></div>
    </div>
    <div class="flex justify-end gap-3 px-6 pb-5">
      <button class="btn btn-ghost" onclick="closeModal('record-payment-modal')">Cancel</button>
      <button class="btn btn-success" onclick="savePayment()"><i class="fas fa-check"></i> Record Payment</button>
    </div>
  </div>
</div>

<!-- Add/Edit Expense -->
<div id="add-expense-modal" class="modal-backdrop" style="display:none">
  <div class="modal max-w-xl w-full">
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
      <h3 class="font-bold text-white text-lg" id="expense-modal-title">Add Expense</h3>
      <button onclick="closeModal('add-expense-modal')" class="text-gray-500 hover:text-white transition-colors"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-6 space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label>Category *</label>
          <select id="exp-category" class="input" onchange="toggleExpenseFields()">
            <option value="bill">Bill</option>
            <option value="repair">Repair</option>
            <option value="tax">Tax</option>
            <option value="registration">Registration</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div><label>Status</label>
          <select id="exp-status" class="input" onchange="toggleExpenseFields()">
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>
      <div><label>Description *</label><input id="exp-description" class="input" placeholder="Electricity bill, brake job, etc." /></div>
      <div class="grid grid-cols-2 gap-4">
        <div><label>Vendor / Payee</label><input id="exp-vendor" class="input" placeholder="Vendor name" /></div>
        <div><label>Amount *</label><input id="exp-amount" class="input" type="number" step="0.01" placeholder="0.00" /></div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><label>Expense Date *</label><input id="exp-expense-date" class="input" type="date" /></div>
        <div><label>Due Date</label><input id="exp-due-date" class="input" type="date" /></div>
      </div>
      <div id="exp-deal-row"><label>Linked Vehicle</label>
        <select id="exp-deal-id" class="input">
          <option value="">None (not vehicle-specific)</option>
        </select>
      </div>
      <div id="exp-payment-method-row"><label>Payment Method</label>
        <select id="exp-payment-method" class="input">
          <option value="cash">Cash</option>
          <option value="check">Check</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div><label>Reference #</label><input id="exp-reference" class="input" placeholder="Check #, receipt #, etc." /></div>
      <div class="flex items-center gap-3">
        <input type="checkbox" id="exp-recurring" class="w-4 h-4 accent-blue-500" onchange="toggleExpenseFields()" />
        <label class="!mb-0 !text-sm !normal-case !tracking-normal text-gray-300 cursor-pointer" for="exp-recurring">Recurring expense</label>
      </div>
      <div id="exp-recur-row" style="display:none"><label>Recur Frequency</label>
        <select id="exp-recur-frequency" class="input">
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>
      <div><label>Notes</label><textarea id="exp-notes" class="input" rows="2" placeholder="Any notes…"></textarea></div>
    </div>
    <div class="flex justify-end gap-3 px-6 pb-5">
      <button class="btn btn-ghost" onclick="closeModal('add-expense-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="saveExpense()"><i class="fas fa-save"></i> Save Expense</button>
    </div>
  </div>
</div>

<!-- Toast -->
<div id="toast" style="display:none"></div>

<script src="/static/dealer.js"></script>
</body>
</html>`)
})

export default {
  fetch: app.fetch.bind(app),
}
