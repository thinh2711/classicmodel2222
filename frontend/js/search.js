/* ══════════════════════════════════════════════════════════════════════════
   search.js — Multi-dimensional search with pagination
   ══════════════════════════════════════════════════════════════════════════ */

const Search = {
  ordPage: 1,

  init() {
    this._loadCountries();
    this._loadProductLines();
    this.searchOrders();
    this.searchCustomers();
    this.searchProducts();
  },

  switchTab(tab, btn) {
    document.querySelectorAll('.search-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.search-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`panel-${tab}`)?.classList.add('active');
  },

  async _loadCountries() {
    try {
      const rows = await fetchJSON(`${API}/search/countries`);
      ['ord-country','cust-country'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        rows.forEach(r => {
          const country = typeof r === 'object' ? r.country : r;
          const o = document.createElement('option');
          o.value = country; o.textContent = country;
          sel.appendChild(o);
        });
      });
    } catch {}
  },

  async _loadProductLines() {
    try {
      const rows = await fetchJSON(`${API}/search/product-lines`);
      ['ord-productline','prod-line'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        rows.forEach(r => {
          const pl = typeof r === 'object' ? r.productLine : r;
          const o = document.createElement('option');
          o.value = pl; o.textContent = pl;
          sel.appendChild(o);
        });
      });
    } catch {}
  },

  async searchOrders(page = 1) {
    this.ordPage = page;
    const params = new URLSearchParams({
      page,
      per_page: 15,
      date_from:   document.getElementById('ord-date-from')?.value  || '',
      date_to:     document.getElementById('ord-date-to')?.value    || '',
      customer:    document.getElementById('ord-customer')?.value   || '',
      country:     document.getElementById('ord-country')?.value    || '',
      product:     document.getElementById('ord-product')?.value    || '',
      product_line:document.getElementById('ord-productline')?.value || '',
      status:      document.getElementById('ord-status')?.value     || '',
    });
    try {
      const d = await fetchJSON(`${API}/search/orders?${params}`);
      document.getElementById('ord-result-info').textContent =
        `Tìm thấy ${fmtNum(d.total)} đơn hàng · Trang ${d.page}/${d.pages}`;
      const tbody = document.getElementById('tbody-orders');
      tbody.innerHTML = (d.data || []).map(r => `
        <tr>
          <td><strong>${r.orderNumber}</strong></td>
          <td>${r.orderDate || '—'}</td>
          <td>${r.customerName || '—'}</td>
          <td>${r.country || '—'}</td>
          <td class="num">${fmtCurrency(r.revenue || 0)}</td>
          <td><span class="status-badge status-${(r.status||'').replace(' ','-')}">${r.status || '—'}</span></td>
          <td>${r.shippedDate || '—'}</td>
        </tr>`).join('');
      this._renderPagination('ord-pagination', d.page, d.pages, p => this.searchOrders(p));
    } catch(e) {
      showToast('Lỗi tìm đơn hàng: ' + e.message, 'error');
    }
  },

  async searchCustomers() {
    const params = new URLSearchParams({
      q:       document.getElementById('cust-q')?.value       || '',
      country: document.getElementById('cust-country')?.value || '',
      per_page: 30,
    });
    try {
      const d = await fetchJSON(`${API}/search/customers?${params}`);
      const data = Array.isArray(d) ? d : (d.data || []);
      const tbody = document.getElementById('tbody-customers');
      tbody.innerHTML = data.map((r,i) => `
        <tr>
          <td class="rank">${i+1}</td>
          <td><strong>${r.customerName}</strong></td>
          <td>${r.contactFirstName || ''} ${r.contactLastName || ''}</td>
          <td>${r.country}</td>
          <td class="num">$${Number(r.creditLimit||0).toLocaleString()}</td>
          <td class="num">${fmtCurrency(r.revenue || 0)}</td>
          <td class="num">${fmtNum(r.orders || 0)}</td>
        </tr>`).join('');
    } catch(e) { console.warn('search customers:', e); }
  },

  async searchProducts() {
    const params = new URLSearchParams({
      q:    document.getElementById('prod-q')?.value    || '',
      line: document.getElementById('prod-line')?.value || '',
      per_page: 30,
    });
    try {
      const d = await fetchJSON(`${API}/search/products?${params}`);
      const data = Array.isArray(d) ? d : (d.data || []);
      const tbody = document.getElementById('tbody-products');
      tbody.innerHTML = data.map(r => {
        const stockColor = r.quantityInStock < 500 ? 'var(--red)'
          : r.quantityInStock < 1500 ? 'var(--yellow)' : 'var(--green)';
        return `<tr>
          <td><code>${r.productCode}</code></td>
          <td><strong>${r.productName}</strong></td>
          <td><span class="status-badge" style="background:var(--accent-glow);color:var(--accent2)">${r.productLine}</span></td>
          <td class="num">$${Number(r.buyPrice||0).toFixed(2)}</td>
          <td class="num">$${Number(r.MSRP||0).toFixed(2)}</td>
          <td class="num" style="color:${stockColor}">${fmtNum(r.quantityInStock)}</td>
          <td class="num">${fmtNum(r.soldTotal || 0)}</td>
          <td class="num">${fmtCurrency(r.revenue || 0)}</td>
        </tr>`;
      }).join('');
    } catch(e) { console.warn('search products:', e); }
  },

  clearOrders() {
    ['ord-date-from','ord-date-to','ord-customer','ord-product'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    ['ord-country','ord-productline','ord-status'].forEach(id => {
      const el = document.getElementById(id); if (el) el.selectedIndex = 0;
    });
    this.searchOrders();
  },

  clearCustomers() {
    document.getElementById('cust-q').value = '';
    document.getElementById('cust-country').selectedIndex = 0;
    this.searchCustomers();
  },

  clearProducts() {
    document.getElementById('prod-q').value = '';
    document.getElementById('prod-line').selectedIndex = 0;
    this.searchProducts();
  },

  _renderPagination(containerId, page, pages, callback) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    if (pages <= 1) return;
    const add = (label, p, active = false, disabled = false) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      if (active) btn.classList.add('active');
      if (!disabled) btn.addEventListener('click', () => callback(p));
      else btn.disabled = true;
      el.appendChild(btn);
    };
    add('‹ Trước', page - 1, false, page <= 1);
    const start = Math.max(1, page - 2), end = Math.min(pages, start + 4);
    for (let p = start; p <= end; p++) add(p, p, p === page);
    add('Sau ›', page + 1, false, page >= pages);
  },
};

// Flatpickr date pickers
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.datepicker').forEach(el => {
    flatpickr(el, { dateFormat: 'Y-m-d', locale: { firstDayOfWeek: 1 } });
  });
});
