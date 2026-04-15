/* ══════════════════════════════════════════════════════════════════════════
   app.js — Router, KPI loader, global utilities
   ══════════════════════════════════════════════════════════════════════════ */

const API = '/api';

// ─── Utilities ─────────────────────────────────────────────────────────────
const fmtCurrency = v => {
  const n = Number(v) || 0;
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
};

const fmtNum   = v => Number(v || 0).toLocaleString('en-US');
const fmtPct   = v => (v !== null && v !== undefined ? (v > 0 ? '+' : '') + v + '%' : '—');

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ─── Counter animation ──────────────────────────────────────────────────────
function animateCounter(el, end, isCurrency = false, durationMs = 900) {
  const start = 0;
  const step  = end / (durationMs / 16);
  let   cur   = start;
  const tick  = () => {
    cur = Math.min(cur + step, end);
    el.textContent = isCurrency ? fmtCurrency(cur) : fmtNum(Math.round(cur));
    if (cur < end) requestAnimationFrame(tick);
    else           el.textContent = isCurrency ? fmtCurrency(end) : fmtNum(end);
  };
  requestAnimationFrame(tick);
}

function setMoM(elId, pct) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (pct === null || pct === undefined) { el.textContent = ''; return; }
  el.textContent = (pct > 0 ? '▲ +' : pct < 0 ? '▼ ' : '● ') + Math.abs(pct) + '% MoM';
  el.className = 'kpi-mom ' + (pct > 0 ? 'up' : pct < 0 ? 'down' : '');
}

// ─── Sparkline ──────────────────────────────────────────────────────────────
function drawSparkline(canvasId, data, color = 'rgba(255,255,255,0.8)') {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data.length) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.offsetWidth  || 200;
  canvas.height = canvas.offsetHeight || 40;
  const w = canvas.width; const h = canvas.height;
  const max = Math.max(...data); const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * h * 0.9 - h * 0.05,
  }));
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color.replace('0.8)', '0.3)'));
  grad.addColorStop(1, color.replace('0.8)', '0)'));
  ctx.lineTo(pts[pts.length-1].x, h);
  ctx.lineTo(pts[0].x, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
}

// ─── Export table to CSV ────────────────────────────────────────────────────
function exportTableToCSV(tableId, filename) {
  const tbl = document.getElementById(tableId);
  if (!tbl) return;
  const rows = [...tbl.querySelectorAll('tr')];
  const csv  = rows.map(r =>
    [...r.querySelectorAll('th,td')]
      .map(c => `"${c.textContent.trim().replace(/"/g,'""')}"`)
      .join(',')
  ).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename + '_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  showToast('Xuất CSV thành công!', 'success');
}

// ─── Clock ──────────────────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('current-time');
  if (el) el.textContent = new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
setInterval(updateClock, 1000);
updateClock();

// ─── DB Status ──────────────────────────────────────────────────────────────
async function checkDbStatus() {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  try {
    await fetchJSON(`${API}/stats/years`);
    if (dot)  { dot.className = 'status-dot online'; }
    if (text) { text.textContent = 'Đã kết nối DB'; }
  } catch {
    if (dot)  { dot.className = 'status-dot offline'; }
    if (text) { text.textContent = 'Lỗi kết nối'; }
  }
}


// ════════════════════════════════════════════════════════════════════════════
// App namespace
// ════════════════════════════════════════════════════════════════════════════
const App = {
  currentPage: 'dashboard',
  yearFilter: '',
  revenueMode: 'revenue',

  // ─── Routing ─────────────────────────────────────────────────────────────
  navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    const navEl  = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (pageEl) pageEl.classList.add('active');
    if (navEl)  navEl.classList.add('active');

    const titles = {
      dashboard: ['Dashboard',     'Tổng quan kinh doanh'],
      reports:   ['Báo Cáo',       'Phân tích theo thời gian'],
      charts:    ['Biểu Đồ',       'Trực quan hóa dữ liệu'],
      pivot:     ['Pivot Table',   'Phân tích đa chiều'],
      rfm:       ['Phân Tích RFM', 'Phân nhóm khách hàng'],
      search:    ['Tìm Kiếm',      'Tra cứu đơn / khách / sản phẩm'],
      employees: ['Nhân Viên',     'Hiệu suất sales'],
      alerts:    ['🚨 Cảnh Báo',   'Sản phẩm & khách hàng cần xử lý'],
      chatbot:   ['Chatbot AI',    'Trợ lý phân tích thông minh'],
    };
    const [title, crumb] = titles[page] || [page, ''];
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-breadcrumb').textContent = crumb;

    this.currentPage = page;
    this.loadPage(page);
  },

  loadPage(page) {
    if (page === 'dashboard') this.loadDashboard();
    else if (page === 'charts')    Charts.loadAll();
    else if (page === 'reports')   Reports.load();
    else if (page === 'rfm')       this.loadRFM();
    else if (page === 'employees') this.loadEmployees();
    else if (page === 'alerts')    Alerts.load();
    else if (page === 'search')    Search.init();
    else if (page === 'pivot')     Pivot.init();
  },

  // ─── Year filter ─────────────────────────────────────────────────────────
  async initYearSelects() {
    try {
      const years = await fetchJSON(`${API}/stats/years`);
      ['global-year-select','report-year','pivot-year'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        years.forEach(y => {
          const o = document.createElement('option');
          o.value = y; o.textContent = y;
          sel.appendChild(o);
        });
      });
    } catch(e) { console.warn('Year select:', e); }
  },

  // ─── Dashboard ───────────────────────────────────────────────────────────
  async loadDashboard() {
    await Promise.allSettled([
      this.loadKPIs(),
      this.loadTopProducts(),
      this.loadTopCustomers(),
      this.loadLowStock(),
    ]);
    Charts.loadRevenue(this.yearFilter, this.revenueMode);
    Charts.loadProductLine();
  },

  async loadKPIs() {
    try {
      const d = await fetchJSON(`${API}/stats/overview`);
      animateCounter(document.getElementById('kv-revenue'), d.revenue, true);
      animateCounter(document.getElementById('kv-orders'),   d.orders,  false);
      animateCounter(document.getElementById('kv-customers'),d.customers,false);
      animateCounter(document.getElementById('kv-products'), d.products, false);
      setMoM('mom-revenue', d.mom_revenue_pct);
      setMoM('mom-orders',  d.mom_orders_pct);
      // Sparklines (fetch revenue monthly for spark)
      try {
        const monthly = await fetchJSON(`${API}/stats/revenue`);
        const revVals = monthly.map(r => Number(r.revenue));
        const ordVals = monthly.map(r => Number(r.orders));
        drawSparkline('sp-revenue',   revVals, 'rgba(255,255,255,0.9)');
        drawSparkline('sp-orders',    ordVals, 'rgba(255,255,255,0.9)');
        drawSparkline('sp-customers', revVals, 'rgba(255,255,255,0.9)');
        drawSparkline('sp-products',  revVals, 'rgba(255,255,255,0.9)');
      } catch {}
    } catch(e) {
      showToast('Không tải được KPI: ' + e.message, 'error');
    }
  },

  async loadTopProducts() {
    try {
      const rows = await fetchJSON(`${API}/stats/top-products?limit=10`);
      const maxR = rows[0] ? Number(rows[0].revenue) : 1;
      const tbody = document.getElementById('tbody-top-products');
      tbody.innerHTML = rows.map((r, i) => `
        <tr>
          <td class="rank">${i+1}</td>
          <td>${r.productName}</td>
          <td><span class="status-badge" style="background:var(--accent-glow);color:var(--accent2)">${r.productLine}</span></td>
          <td class="num">${fmtCurrency(r.revenue)}</td>
          <td class="num">${fmtNum(r.qty)}</td>
          <td class="num ${Number(r.profitPerUnit)>=0?'growth-up':'growth-down'}">${fmtCurrency(r.profitPerUnit)}</td>
        </tr>`).join('');
    } catch(e) { console.warn('top-products:', e); }
  },

  async loadTopCustomers() {
    try {
      const rows = await fetchJSON(`${API}/stats/top-customers?limit=10`);
      const tbody = document.getElementById('tbody-top-customers');
      tbody.innerHTML = rows.map((r, i) => `
        <tr>
          <td class="rank">${i+1}</td>
          <td>${r.customerName}</td>
          <td>${r.country}</td>
          <td class="num">${fmtCurrency(r.revenue)}</td>
          <td class="num">${fmtCurrency(r.paid)}</td>
          <td class="num">${fmtNum(r.orders)}</td>
        </tr>`).join('');
    } catch(e) { console.warn('top-customers:', e); }
  },

  async loadLowStock() {
    try {
      const rows = await fetchJSON(`${API}/stats/low-stock?threshold=2000`);
      document.getElementById('low-stock-count').textContent = rows.length;
      const list = document.getElementById('low-stock-list');
      list.innerHTML = rows.slice(0,10).map(r => `
        <div class="alert-item">
          <div class="alert-qty">${fmtNum(r.quantityInStock)}</div>
          <div class="alert-info">
            <div class="alert-name" title="${r.productName}">${r.productName}</div>
            <div class="alert-line">${r.productLine} · MSRP $${Number(r.MSRP).toFixed(0)}</div>
          </div>
        </div>`).join('');
    } catch(e) { console.warn('low-stock:', e); }
  },

  async loadEmployees() {
    try {
      const rows = await fetchJSON(`${API}/stats/employees?limit=15`);
      const maxR = rows[0] ? Number(rows[0].revenue) : 1;
      const tbody = document.getElementById('tbody-employees');
      tbody.innerHTML = rows.map((r, i) => {
        const pct = maxR ? Math.round(Number(r.revenue) / maxR * 100) : 0;
        return `<tr>
          <td class="rank">${i+1}</td>
          <td><strong>${r.name}</strong></td>
          <td>${r.office}</td>
          <td class="num">${fmtNum(r.customers)}</td>
          <td class="num">${fmtNum(r.orders)}</td>
          <td class="num">${fmtCurrency(r.revenue)}</td>
          <td>
            <div class="progress-bar-wrap perf-bar">
              <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:var(--accent)"></div></div>
              <span style="font-size:10px;color:var(--text-muted)">${pct}%</span>
            </div>
          </td>
        </tr>`;
      }).join('');

      // Chart
      Charts.drawEmployeeChart(rows);
    } catch(e) {
      showToast('Không tải nhân viên: ' + e.message, 'error');
    }
  },

  async loadRFM() {
    try {
      const rows = await fetchJSON(`${API}/stats/rfm`);
      // Classify segments
      const classify = (r) => {
        const R = r.recency_days, F = r.frequency, M = r.monetary;
        if (R < 180 && F >= 4 && M > 100000) return {label:'Champion',  cls:'rfm-champion'};
        if (R < 365 && F >= 3)                return {label:'Trung Thành',cls:'rfm-loyal'};
        if (R < 365 && M > 50000)             return {label:'Tiềm Năng', cls:'rfm-potential'};
        if (R > 365 && F >= 2)                return {label:'Rủi Ro',    cls:'rfm-atrisk'};
        return {label:'Mất Khách', cls:'rfm-lost'};
      };
      const tbody = document.getElementById('tbody-rfm');
      tbody.innerHTML = rows.map((r, i) => {
        const seg = classify(r);
        return `<tr>
          <td class="rank">${i+1}</td>
          <td><strong>${r.customerName}</strong></td>
          <td>${r.country}</td>
          <td class="num ${r.recency_days > 365 ? 'growth-down' : 'growth-up'}">${fmtNum(r.recency_days)}</td>
          <td class="num">${fmtNum(r.frequency)}</td>
          <td class="num">${fmtCurrency(r.monetary)}</td>
          <td><span class="rfm-badge ${seg.cls}">${seg.label}</span></td>
        </tr>`;
      }).join('');

      // Charts
      const top10M = rows.slice(0,10);
      Charts.drawBarChart('chart-rfm-monetary',
        top10M.map(r => r.customerName.split(' ').slice(-1)[0]),
        top10M.map(r => Number(r.monetary)),
        'Monetary ($)', '#6366f1');

      const sorted = [...rows].sort((a,b) => b.frequency - a.frequency).slice(0,10);
      Charts.drawBarChart('chart-rfm-freq',
        sorted.map(r => r.customerName.split(' ').slice(-1)[0]),
        sorted.map(r => Number(r.frequency)),
        'Frequency', '#06b6d4');

    } catch(e) {
      showToast('Không tải RFM: ' + e.message, 'error');
    }
  },

  // ─── Revenue chart mode toggle ─────────────────────────────────────────
  switchRevenueMode(mode, btn) {
    this.revenueMode = mode;
    document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    Charts.loadRevenue(this.yearFilter, mode);
  },

  // ─── Export helper ─────────────────────────────────────────────────────
  exportTable(tableId, name) {
    exportTableToCSV(tableId, name);
  },

  // ─── Refresh all ───────────────────────────────────────────────────────
  refreshAll() {
    showToast('Đang làm mới dữ liệu...', 'info');
    this.loadPage(this.currentPage);
  },

  // ─── Theme toggle ──────────────────────────────────────────────────────
  toggleTheme() {
    const light = document.body.classList.toggle('light');
    document.getElementById('theme-icon').textContent = light ? '☀️' : '🌙';
    localStorage.setItem('theme', light ? 'light' : 'dark');
  },
};

// ─── Navigation wiring ─────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => App.navigate(item.dataset.page));
});

document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// Year filter
document.getElementById('global-year-select')?.addEventListener('change', function() {
  App.yearFilter = this.value;
  if (App.currentPage === 'dashboard') Charts.loadRevenue(App.yearFilter, App.revenueMode);
  else if (App.currentPage === 'charts') Charts.loadAll();
});

// ─── Init ────────────────────────────────────────────────────────────────
(async () => {
  // Restore theme
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light');
    const ti = document.getElementById('theme-icon');
    if (ti) ti.textContent = '☀️';
  }
  await App.initYearSelects();
  await checkDbStatus();
  // Pre-load alerts badge count silently
  try {
    const d = await fetchJSON(`${API}/stats/alerts`);
    const total = d.summary.total_product_alerts + d.summary.total_customer_alerts;
    const badge = document.getElementById('nav-alert-badge');
    if (badge && total > 0) { badge.textContent = total; badge.style.display='inline-block'; }
  } catch {}
  App.navigate('dashboard');
})();
