/* ══════════════════════════════════════════════════════════════════════════
   alerts.js — Product & Customer Alert Center
   ══════════════════════════════════════════════════════════════════════════ */

const Alerts = {
  _data: null,

  async load() {
    try {
      showToast('Đang phân tích cảnh báo...', 'info');
      const d = await fetchJSON(`${API}/stats/alerts`);
      this._data = d;
      this._renderSummaryBar(d.summary);
      this._renderProductAlerts(d.product_alerts);
      this._renderCustomerAlerts(d.customer_alerts);
      this._updateNavBadge(d.summary.total_product_alerts + d.summary.total_customer_alerts);
      showToast(`Tìm thấy ${d.summary.total_product_alerts + d.summary.total_customer_alerts} cảnh báo`, 'info');
    } catch(e) {
      showToast('Lỗi tải cảnh báo: ' + e.message, 'error');
    }
  },

  _updateNavBadge(total) {
    const badge = document.getElementById('nav-alert-badge');
    if (!badge) return;
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-block' : 'none';
  },

  _renderSummaryBar(s) {
    const el = document.getElementById('alert-summary-bar');
    if (!el) return;
    const stats = [
      { icon: '🔴', label: 'Tồn Kho Cạn', value: s.critical_stock_count,   cls: 'danger'  },
      { icon: '🟡', label: 'Tồn Kho Thấp', value: s.low_stock_count,        cls: 'warning' },
      { icon: '💤', label: 'Không Bán Được', value: s.no_recent_sales_count, cls: 'info'    },
      { icon: '📉', label: 'Biên LN Thấp',  value: s.low_margin_count,      cls: 'info'    },
      { icon: '💸', label: 'Nợ Cao',         value: s.overdue_payment_count, cls: 'danger'  },
      { icon: '😴', label: 'KH Không HĐ',   value: s.inactive_customers_count, cls: 'warning' },
      { icon: '⚡', label: 'Gần Hạn Mức',   value: s.near_credit_limit_count,  cls: 'warning' },
      { icon: '⚠️', label: 'Đơn Tranh Chấp', value: s.disputed_orders_count,   cls: 'danger'  },
    ];
    el.innerHTML = stats.map(s => `
      <div class="alert-stat ${s.cls}">
        <div class="alert-stat-icon">${s.icon}</div>
        <div class="alert-stat-value">${s.value}</div>
        <div class="alert-stat-label">${s.label}</div>
      </div>`).join('');

    // Update section counts
    const pa = document.getElementById('product-alert-count');
    const ca = document.getElementById('customer-alert-count');
    if (pa) pa.textContent = (s.critical_stock_count + s.low_stock_count + s.no_recent_sales_count + s.low_margin_count) + ' cảnh báo';
    if (ca) ca.textContent = (s.overdue_payment_count + s.inactive_customers_count + s.near_credit_limit_count + s.disputed_orders_count) + ' cảnh báo';
  },

  _renderProductAlerts(pa) {
    // Critical stock
    this._setCount('cnt-critical-stock', pa.critical_stock.length);
    document.getElementById('tbody-critical-stock').innerHTML = pa.critical_stock.map(r => `
      <tr>
        <td><strong style="color:var(--red)">${r.productName}</strong></td>
        <td>${r.productLine}</td>
        <td class="num" style="color:var(--red);font-weight:800">${fmtNum(r.quantityInStock)}</td>
        <td class="num">$${Number(r.buyPrice).toFixed(2)}</td>
        <td class="num">$${Number(r.MSRP).toFixed(2)}</td>
        <td class="num">${fmtNum(r.soldTotal)}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="empty-row">Không có dữ liệu</td></tr>';

    // Low stock
    this._setCount('cnt-low-stock', pa.low_stock.length);
    document.getElementById('tbody-low-stock-alert').innerHTML = pa.low_stock.map(r => `
      <tr>
        <td><strong style="color:var(--yellow)">${r.productName}</strong></td>
        <td>${r.productLine}</td>
        <td class="num" style="color:var(--yellow);font-weight:700">${fmtNum(r.quantityInStock)}</td>
        <td class="num">$${Number(r.MSRP).toFixed(2)}</td>
        <td class="num">${fmtNum(r.soldTotal)}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="empty-row">Không có dữ liệu</td></tr>';

    // No recent sales
    this._setCount('cnt-no-recent', pa.no_recent_sales.length);
    document.getElementById('tbody-no-recent').innerHTML = pa.no_recent_sales.map(r => {
      const days = r.daysSinceSale ?? 'N/A';
      const color = days > 365 ? 'var(--red)' : days > 180 ? 'var(--yellow)' : 'var(--text-muted)';
      return `<tr>
        <td><strong>${r.productName}</strong></td>
        <td>${r.productLine}</td>
        <td class="num">${fmtNum(r.quantityInStock)}</td>
        <td>${r.lastOrderDate || '—'}</td>
        <td class="num" style="color:${color};font-weight:700">${days === 'N/A' ? '∞' : days + ' ngày'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" class="empty-row">Không có dữ liệu</td></tr>';

    // Low margin
    this._setCount('cnt-low-margin', pa.low_margin.length);
    document.getElementById('tbody-low-margin').innerHTML = pa.low_margin.map(r => {
      const m = Number(r.marginPct);
      const color = m < 0 ? 'var(--red)' : m < 10 ? 'var(--orange)' : 'var(--yellow)';
      return `<tr>
        <td><strong>${r.productName}</strong></td>
        <td>${r.productLine}</td>
        <td class="num">$${Number(r.buyPrice).toFixed(2)}</td>
        <td class="num">$${Number(r.avgSellPrice).toFixed(2)}</td>
        <td class="num" style="color:${color};font-weight:800">${m}%</td>
        <td class="num">${fmtNum(r.soldTotal)}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="empty-row">Không có dữ liệu</td></tr>';
  },

  _renderCustomerAlerts(ca) {
    // Overdue payment
    this._setCount('cnt-overdue', ca.overdue_payment.length);
    document.getElementById('tbody-overdue').innerHTML = ca.overdue_payment.map(r => {
      const outstanding = Number(r.outstanding);
      const outColor = outstanding > 50000 ? 'var(--red)' : outstanding > 25000 ? 'var(--orange)' : 'var(--yellow)';
      return `<tr>
        <td><strong>${r.customerName}</strong><br><small style="color:var(--text-muted)">${r.phone||''}</small></td>
        <td>${r.country}</td>
        <td class="num">${fmtCurrency(r.totalRevenue)}</td>
        <td class="num">${fmtCurrency(r.paid)}</td>
        <td class="num" style="color:${outColor};font-weight:800">${fmtCurrency(outstanding)}</td>
        <td class="num">$${Number(r.creditLimit).toLocaleString()}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="empty-row">Không có dữ liệu</td></tr>';

    // Inactive customers
    this._setCount('cnt-inactive', ca.inactive_customers.length);
    document.getElementById('tbody-inactive').innerHTML = ca.inactive_customers.map(r => {
      const days = Number(r.inactiveDays);
      const color = days > 1000 ? 'var(--red)' : days > 730 ? 'var(--orange)' : 'var(--yellow)';
      return `<tr>
        <td><strong>${r.customerName}</strong></td>
        <td>${r.country}</td>
        <td>${r.lastOrderDate || '—'}</td>
        <td class="num" style="color:${color};font-weight:700">${fmtNum(days)} ngày</td>
        <td class="num">${fmtNum(r.totalOrders)}</td>
        <td class="num">${fmtCurrency(r.totalRevenue)}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="empty-row">Không có dữ liệu</td></tr>';

    // Near credit limit
    this._setCount('cnt-credit', ca.near_credit_limit.length);
    document.getElementById('tbody-credit').innerHTML = ca.near_credit_limit.map(r => {
      const pct = Number(r.creditUsedPct);
      const fillColor = pct > 100 ? 'var(--red)' : pct > 90 ? 'var(--orange)' : 'var(--yellow)';
      return `<tr>
        <td><strong>${r.customerName}</strong></td>
        <td>${r.country}</td>
        <td class="num">$${Number(r.creditLimit).toLocaleString()}</td>
        <td class="num" style="color:${fillColor};font-weight:700">${fmtCurrency(r.outstanding)}</td>
        <td>
          <div class="credit-bar-wrap">
            <div style="font-size:11px;font-weight:700;color:${fillColor};margin-bottom:3px">${pct}%</div>
            <div class="credit-bar">
              <div class="credit-fill" style="width:${Math.min(pct,100)}%;background:${fillColor}"></div>
            </div>
          </div>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" class="empty-row">Không có dữ liệu</td></tr>';

    // Disputed orders
    this._setCount('cnt-disputed', ca.disputed_orders.length);
    const statusColors = { 'Disputed':'var(--red)', 'On Hold':'var(--yellow)', 'In Process':'var(--cyan)' };
    document.getElementById('tbody-disputed').innerHTML = ca.disputed_orders.map(r => {
      const sColor = statusColors[r.status] || 'var(--text-muted)';
      const ageColor = r.ageDays > 60 ? 'var(--red)' : r.ageDays > 30 ? 'var(--orange)' : 'var(--yellow)';
      return `<tr>
        <td><strong>${r.orderNumber}</strong></td>
        <td>${r.customerName}<br><small style="color:var(--text-muted)">${r.phone||''}</small></td>
        <td>${r.country}</td>
        <td><span class="status-badge" style="background:${sColor}22;color:${sColor}">${r.status}</span></td>
        <td class="num">${fmtCurrency(r.orderValue)}</td>
        <td>${r.orderDate}</td>
        <td class="num" style="color:${ageColor};font-weight:700">${r.ageDays} ngày</td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" class="empty-row">Không có dữ liệu</td></tr>';
  },

  _setCount(id, n) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = n;
      if (n === 0) el.style.opacity = '0.35';
    }
  },
};

// Add empty row style via JS if not in CSS
const style = document.createElement('style');
style.textContent = '.empty-row { text-align:center; color:var(--text-dim); padding:20px; font-size:12px; }';
document.head.appendChild(style);
