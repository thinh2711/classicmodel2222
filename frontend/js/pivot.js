/* ══════════════════════════════════════════════════════════════════════════
   pivot.js — Pivot table with heatmap
   ══════════════════════════════════════════════════════════════════════════ */

const Pivot = (() => {
  let _data = null;

  function init() {
    // Year selector already populated by App.initYearSelects
  }

  async function load() {
    const row  = document.getElementById("pivot-row").value;
    const col  = document.getElementById("pivot-col").value;
    const val  = document.getElementById("pivot-val").value;
    const year = document.getElementById("pivot-year").value;

    if (row === col) {
      showToast("⚠️ Hàng và Cột không thể giống nhau!", "error");
      return;
    }

    const loading = document.getElementById("pivot-loading");
    const wrap    = document.getElementById("pivot-table-wrap");
    if (loading) loading.style.display = "flex";
    wrap.innerHTML = "";

    try {
      const qs = new URLSearchParams({ row, col, value: val });
      if (year) qs.append("year", year);
      _data = await fetchJSON(`${API}/pivot/data?${qs}`);
      render(_data);
    } catch (err) {
      showToast("⚠️ Lỗi tải pivot: " + err.message, "error");
    } finally {
      if (loading) loading.style.display = "none";
    }
  }

  // Heatmap colors
  const HEAT_COLORS = [
    'rgba(99,102,241,0.08)',
    'rgba(99,102,241,0.2)',
    'rgba(99,102,241,0.38)',
    'rgba(99,102,241,0.58)',
    'rgba(99,102,241,0.78)',
  ];

  function heatStyle(v, maxV) {
    if (!v || !maxV) return '';
    const idx = Math.min(4, Math.floor((v / maxV) * 5));
    return `background:${HEAT_COLORS[idx]};`;
  }

  function fmtCell(v, dim) {
    if (!v) return '—';
    if (dim === 'revenue') return '$' + Intl.NumberFormat('en').format(Math.round(v));
    return Intl.NumberFormat('en').format(Math.round(v));
  }

  function render(result) {
    const { data, valueDim } = result;
    const wrap = document.getElementById("pivot-table-wrap");

    if (!data || data.length === 0) {
      wrap.innerHTML = `<p style="color:var(--text-muted);padding:40px;text-align:center">Không có dữ liệu</p>`;
      return;
    }

    const rowKeys = [...new Set(data.map(d => String(d.row_dim)))].sort();
    const colKeys = [...new Set(data.map(d => String(d.col_dim)))].sort();

    const matrix = {};
    rowKeys.forEach(r => { matrix[r] = {}; colKeys.forEach(c => { matrix[r][c] = 0; }); });
    data.forEach(d => { matrix[String(d.row_dim)][String(d.col_dim)] = parseFloat(d.val) || 0; });

    const rowTotals = {};
    rowKeys.forEach(r => { rowTotals[r] = colKeys.reduce((s,c) => s + matrix[r][c], 0); });
    const colTotals = {};
    colKeys.forEach(c => { colTotals[c] = rowKeys.reduce((s,r) => s + matrix[r][c], 0); });
    const grandTotal = Object.values(rowTotals).reduce((a,b) => a+b, 0);

    const allVals = data.map(d => parseFloat(d.val)||0);
    const maxVal  = Math.max(...allVals, 1);

    let html = `<table class="pivot-table">
      <thead><tr>
        <th style="min-width:130px">${result.rowDim || 'Row'} \\ ${result.colDim || 'Col'}</th>
        ${colKeys.map(c => `<th>${c}</th>`).join('')}
        <th class="total">Tổng Hàng</th>
      </tr></thead><tbody>`;

    rowKeys.forEach(r => {
      html += `<tr><th class="row-header">${r}</th>`;
      colKeys.forEach(c => {
        const v = matrix[r][c];
        html += `<td class="cell-value" style="${heatStyle(v, maxVal)}">${fmtCell(v, valueDim)}</td>`;
      });
      html += `<td class="total cell-value">${fmtCell(rowTotals[r], valueDim)}</td></tr>`;
    });

    html += `</tbody><tfoot><tr>
      <td class="row-header total">Tổng Cột</td>
      ${colKeys.map(c => `<td class="total cell-value">${fmtCell(colTotals[c], valueDim)}</td>`).join('')}
      <td class="total cell-value">${fmtCell(grandTotal, valueDim)}</td>
    </tr></tfoot></table>`;

    wrap.innerHTML = html;
    showToast(`Pivot: ${rowKeys.length} hàng × ${colKeys.length} cột`, 'success');
  }

  function exportCSV() {
    if (!_data || !_data.data || !_data.data.length) {
      showToast("Chưa có dữ liệu!", "error"); return;
    }
    const rows   = _data.data;
    const csv    = ['row_dim,col_dim,value',
      ...rows.map(r => `"${r.row_dim}","${r.col_dim}",${r.val}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pivot_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    showToast('Xuất CSV thành công!', 'success');
  }

  return { init, load, exportCSV };
})();
