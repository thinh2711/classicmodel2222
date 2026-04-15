/* ══════════════════════════════════════════════════════════════════════════
   reports.js — Monthly report, quarterly, PDF/CSV export
   ══════════════════════════════════════════════════════════════════════════ */

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const Reports = {
  _data: [],

  async load() {
    const year = document.getElementById('report-year')?.value || '';
    try {
      showToast('Đang tải báo cáo...', 'info');
      const [monthly, quarterly] = await Promise.all([
        fetchJSON(`${API}/stats/monthly-report${year ? '?year='+year : ''}`),
        fetchJSON(`${API}/stats/quarterly`),
      ]);
      this._data = monthly;
      this._renderSummary(monthly);
      this._renderTable(monthly);
      Charts.drawQuarterlyChart(quarterly.filter(r => !year || String(r.yr) === year));
      showToast('Báo cáo đã tải!', 'success');
    } catch(e) {
      showToast('Lỗi tải báo cáo: ' + e.message, 'error');
    }
  },

  _renderSummary(rows) {
    if (!rows.length) return;
    const totRev  = rows.reduce((s,r) => s + Number(r.revenue), 0);
    const totCost = rows.reduce((s,r) => s + Number(r.cost), 0);
    const totProf = rows.reduce((s,r) => s + Number(r.profit), 0);
    const totOrd  = rows.reduce((s,r) => s + Number(r.orders), 0);
    const avgMgn  = totRev ? (totProf / totRev * 100).toFixed(1) : 0;
    const bestMo  = rows.reduce((best, r) => Number(r.revenue) > Number(best.revenue) ? r : best, rows[0]);

    document.getElementById('report-summary').innerHTML = `
      <div class="report-stat-card">
        <div class="label">Tổng Doanh Thu</div>
        <div class="value">${fmtCurrency(totRev)}</div>
        <div class="sub">Doanh thu thuần</div>
      </div>
      <div class="report-stat-card">
        <div class="label">Tổng Chi Phí</div>
        <div class="value">${fmtCurrency(totCost)}</div>
        <div class="sub">Giá vốn hàng bán</div>
      </div>
      <div class="report-stat-card">
        <div class="label">Tổng Lợi Nhuận</div>
        <div class="value" style="color:var(--green)">${fmtCurrency(totProf)}</div>
        <div class="sub">Biên LN: ${avgMgn}%</div>
      </div>
      <div class="report-stat-card">
        <div class="label">Tổng Đơn Hàng</div>
        <div class="value">${fmtNum(totOrd)}</div>
        <div class="sub">Tháng tốt nhất: T${bestMo.mo}/${bestMo.yr}</div>
      </div>
    `;
  },

  _renderTable(rows) {
    const tbody = document.getElementById('tbody-monthly');
    tbody.innerHTML = rows.map(r => {
      const g = r.growth;
      const gHtml = g === null
        ? '<span class="growth-null">—</span>'
        : `<span class="${g >= 0 ? 'growth-up' : 'growth-down'}">${g >= 0 ? '▲' : '▼'} ${Math.abs(g)}%</span>`;
      return `<tr>
        <td><strong>T${String(r.mo).padStart(2,'0')}/${r.yr}</strong></td>
        <td class="num">${fmtCurrency(r.revenue)}</td>
        <td class="num">${fmtCurrency(r.cost)}</td>
        <td class="num" style="color:var(--green)">${fmtCurrency(r.profit)}</td>
        <td class="num">${r.margin_pct ?? 0}%</td>
        <td class="num">${gHtml}</td>
        <td class="num">${fmtNum(r.orders)}</td>
        <td class="num">${fmtNum(r.customers)}</td>
        <td class="num">${fmtNum(r.qty)}</td>
      </tr>`;
    }).join('');
  },

  exportCSV() {
    exportTableToCSV('tbl-monthly', 'monthly-report');
  },

  exportPDF() {
    window.print();
    showToast('Đã mở hộp thoại in PDF!', 'info');
  },
};
