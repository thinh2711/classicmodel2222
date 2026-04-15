/* ══════════════════════════════════════════════════════════════════════════
   charts.js — All Chart.js visualizations
   ══════════════════════════════════════════════════════════════════════════ */

const CHART_DEFAULTS = {
  font:   { family: 'Inter', size: 12 },
  color:  '#7a8099',
};

Chart.defaults.font.family = 'Inter';
Chart.defaults.color = '#7a8099';

const PALETTE = [
  '#6366f1','#06b6d4','#10b981','#f59e0b',
  '#ef4444','#ec4899','#8b5cf6','#f97316',
  '#22c55e','#3b82f6',
];

const _charts = {};

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

const Charts = {

  // ─── Revenue over time (line) ────────────────────────────────────────
  async loadRevenue(year = '', mode = 'revenue') {
    try {
      const url = year ? `${API}/stats/revenue?year=${year}` : `${API}/stats/revenue`;
      const rows = await fetchJSON(url);
      const labels = rows.map(r => `T${r.mo}/${r.yr}`);
      const data   = rows.map(r => Number(r[mode] || 0));

      destroyChart('revenue-month');
      const ctx = document.getElementById('chart-revenue-month');
      if (!ctx) return;

      const grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 280);
      grad.addColorStop(0, 'rgba(99,102,241,0.35)');
      grad.addColorStop(1, 'rgba(99,102,241,0)');

      _charts['revenue-month'] = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: mode === 'revenue' ? 'Doanh Thu ($)' : 'Số Đơn',
            data,
            borderColor: '#6366f1',
            backgroundColor: grad,
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: '#6366f1',
            fill: true,
            tension: 0.4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(19,23,32,.9)',
              borderColor: '#2a3350', borderWidth: 1,
              callbacks: {
                label: ctx => mode === 'revenue'
                  ? ' ' + fmtCurrency(ctx.raw)
                  : ' ' + fmtNum(ctx.raw) + ' đơn',
              },
            },
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { maxRotation: 45 } },
            y: {
              grid: { color: 'rgba(255,255,255,.04)' },
              ticks: { callback: v => mode === 'revenue' ? fmtCurrency(v) : fmtNum(v) },
            },
          },
        },
      });
    } catch(e) { console.warn('revenue chart:', e); }
  },

  // ─── Product line doughnut ────────────────────────────────────────────
  async loadProductLine() {
    try {
      const rows = await fetchJSON(`${API}/stats/by-productline`);
      destroyChart('productline');
      const ctx = document.getElementById('chart-productline');
      if (!ctx) return;
      _charts['productline'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: rows.map(r => r.productLine),
          datasets: [{
            data: rows.map(r => Number(r.revenue)),
            backgroundColor: PALETTE,
            borderColor: 'var(--surface)',
            borderWidth: 3,
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { padding: 14, boxWidth: 12 } },
            tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtCurrency(c.raw)}` } },
          },
        },
      });
    } catch(e) { console.warn('productline chart:', e); }
  },

  // ─── Revenue by year (bar) ────────────────────────────────────────────
  async loadRevenueByYear() {
    try {
      const rows = await fetchJSON(`${API}/stats/revenue-by-year`);
      destroyChart('revenue-year');
      const ctx = document.getElementById('chart-revenue-year');
      if (!ctx) return;
      _charts['revenue-year'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: rows.map(r => 'Năm ' + r.yr),
          datasets: [{
            label: 'Doanh Thu ($)',
            data: rows.map(r => Number(r.revenue)),
            backgroundColor: PALETTE,
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => ' ' + fmtCurrency(c.raw) } },
          },
          scales: {
            y: {
              grid: { color: 'rgba(255,255,255,.04)' },
              ticks: { callback: v => fmtCurrency(v) },
            },
            x: { grid: { display: false } },
          },
        },
      });
    } catch(e) { console.warn('revenue-year chart:', e); }
  },

  // ─── Order status pie ─────────────────────────────────────────────────
  async loadOrderStatus() {
    try {
      const rows = await fetchJSON(`${API}/stats/order-status`);
      destroyChart('order-status');
      const ctx = document.getElementById('chart-order-status');
      if (!ctx) return;
      const colors = {
        Shipped:'#22c55e', Resolved:'#6366f1', Cancelled:'#ef4444',
        'On Hold':'#f59e0b', Disputed:'#ec4899', 'In Process':'#06b6d4',
      };
      _charts['order-status'] = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: rows.map(r => r.status),
          datasets: [{
            data: rows.map(r => r.cnt),
            backgroundColor: rows.map(r => colors[r.status] || '#6366f1'),
            borderColor: 'var(--surface)',
            borderWidth: 3,
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 12, boxWidth: 14 } },
            tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtNum(c.raw)} đơn` } },
          },
        },
      });
    } catch(e) { console.warn('order-status chart:', e); }
  },

  // ─── By office horizontal bar ─────────────────────────────────────────
  async loadOffice() {
    try {
      const rows = await fetchJSON(`${API}/stats/by-office`);
      destroyChart('office');
      const ctx = document.getElementById('chart-office');
      if (!ctx) return;
      _charts['office'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: rows.map(r => `${r.city}, ${r.country}`),
          datasets: [{
            label: 'Doanh Thu ($)',
            data: rows.map(r => Number(r.revenue)),
            backgroundColor: PALETTE,
            borderRadius: 4,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => ' ' + fmtCurrency(c.raw) } },
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,.04)' },
              ticks: { callback: v => fmtCurrency(v) },
            },
            y: { grid: { display: false } },
          },
        },
      });
    } catch(e) { console.warn('office chart:', e); }
  },

  // ─── Top 10 products bar ──────────────────────────────────────────────
  async loadTopProductsBar() {
    try {
      const rows = await fetchJSON(`${API}/stats/top-products?limit=10`);
      destroyChart('top-products-bar');
      const ctx = document.getElementById('chart-top-products-bar');
      if (!ctx) return;
      _charts['top-products-bar'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: rows.map(r => r.productName.substring(0,35) + (r.productName.length>35?'…':'')),
          datasets: [{
            label: 'Doanh Thu ($)',
            data: rows.map(r => Number(r.revenue)),
            backgroundColor: rows.map(r => PALETTE[PALETTE.indexOf(PALETTE[Math.floor(Math.random()*PALETTE.length)])]),
            backgroundColor: 'rgba(99,102,241,0.75)',
            borderRadius: 6,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => ' ' + fmtCurrency(c.raw) } },
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,.04)' },
              ticks: { callback: v => fmtCurrency(v) },
            },
            y: { grid: { display: false }, ticks: { font: { size: 11 } } },
          },
        },
      });
    } catch(e) { console.warn('top products bar:', e); }
  },

  // ─── Employee chart ───────────────────────────────────────────────────
  drawEmployeeChart(rows) {
    destroyChart('employees');
    const ctx = document.getElementById('chart-employees');
    if (!ctx) return;
    _charts['employees'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: rows.map(r => r.name),
        datasets: [
          {
            label: 'Doanh Thu ($)',
            data: rows.map(r => Number(r.revenue)),
            backgroundColor: 'rgba(99,102,241,0.8)',
            borderRadius: 6,
            yAxisID: 'y',
          },
          {
            label: 'Số Đơn',
            data: rows.map(r => Number(r.orders)),
            backgroundColor: 'rgba(6,182,212,0.6)',
            borderRadius: 6,
            yAxisID: 'y2',
            type: 'bar',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: c => c.datasetIndex===0
                ? ' ' + fmtCurrency(c.raw)
                : ' ' + fmtNum(c.raw) + ' đơn',
            },
          },
        },
        scales: {
          y:  { position:'left',  ticks:{ callback:v=>fmtCurrency(v) }, grid:{color:'rgba(255,255,255,.04)'} },
          y2: { position:'right', ticks:{ callback:v=>fmtNum(v) }, grid:{display:false} },
          x:  { grid:{display:false}, ticks:{maxRotation:45,font:{size:11}} },
        },
      },
    });
  },

  // ─── Generic bar chart (reusable) ────────────────────────────────────
  drawBarChart(canvasId, labels, data, label, color = '#6366f1') {
    destroyChart(canvasId.replace('chart-',''));
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const key = canvasId.replace('chart-','');
    _charts[key] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label,
          data,
          backgroundColor: color + 'cc',
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display:false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { callback: v => fmtNum(v) } },
          y: { grid: { display:false }, ticks: { font: { size: 11 } } },
        },
      },
    });
  },

  // ─── Quarterly chart ──────────────────────────────────────────────────
  drawQuarterlyChart(rows) {
    destroyChart('quarterly');
    const ctx = document.getElementById('chart-quarterly');
    if (!ctx) return;
    const labels = rows.map(r => `Q${r.q}/${r.yr}`);
    _charts['quarterly'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Doanh Thu ($)',
            data: rows.map(r => Number(r.revenue)),
            backgroundColor: 'rgba(99,102,241,0.8)',
            borderRadius: 6,
          },
          {
            label: 'Đơn Hàng',
            data: rows.map(r => Number(r.orders)),
            backgroundColor: 'rgba(6,182,212,0.6)',
            borderRadius: 6,
            type: 'line',
            yAxisID: 'y2',
            borderColor: '#06b6d4',
            pointRadius: 4,
            fill: false,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: { label: c => c.datasetIndex===0 ? ' '+fmtCurrency(c.raw) : ' '+fmtNum(c.raw)+' đơn' },
          },
        },
        scales: {
          y:  { position:'left',  ticks:{callback:v=>fmtCurrency(v)}, grid:{color:'rgba(255,255,255,.04)'} },
          y2: { position:'right', ticks:{callback:v=>fmtNum(v)}, grid:{display:false} },
          x:  { grid:{display:false} },
        },
      },
    });
  },

  // ─── Load all charts page ─────────────────────────────────────────────
  loadAll() {
    this.loadRevenueByYear();
    this.loadOrderStatus();
    this.loadOffice();
    this.loadTopProductsBar();
  },

  // ─── Download chart as PNG ────────────────────────────────────────────
  downloadChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = canvasId + '_' + new Date().toISOString().slice(0,10) + '.png';
    a.click();
    showToast('Đã tải chart PNG!', 'success');
  },
};
