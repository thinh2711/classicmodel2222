/* ══════════════════════════════════════════════════════════════════════════
   chatbot.js — AI chatbot UI
   ══════════════════════════════════════════════════════════════════════════ */

const Chatbot = {
  _msgs: [],

  send() {
    const input = document.getElementById('chat-input');
    const text  = input.value.trim();
    if (!text) return;
    input.value = '';
    this.addMsg('user', text);
    this._ask(text);
  },

  quickAsk(btn) {
    const text = btn.textContent.trim();
    document.getElementById('chat-input').value = text;
    this.send();
  },

  addMsg(role, content, sql = null, rows = null) {
    const wrap = document.getElementById('chat-messages');
    const div  = document.createElement('div');
    div.className = `msg ${role}`;

    const time = new Date().toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'});

    let html = `<div class="msg-bubble">`;
    if (role === 'bot') {
      html += (typeof marked !== 'undefined' ? marked.parse(content) : content);
    } else {
      html += `<span>${this._esc(content)}</span>`;
    }
    html += `<div class="msg-time">${time}</div>`;
    html += `</div>`;

    if (rows && rows.length) {
      const keys = Object.keys(rows[0]);
      html += `<div class="msg-result-table"><table>
        <thead><tr>${keys.map(k => `<th>${k}</th>`).join('')}</tr></thead>
        <tbody>${rows.slice(0,10).map(r =>
          `<tr>${keys.map(k => `<td>${r[k] ?? '—'}</td>`).join('')}</tr>`
        ).join('')}</tbody>
      </table></div>`;
      if (rows.length > 10) html += `<div style="font-size:11px;color:var(--text-muted);padding:4px 12px">...và ${rows.length-10} dòng nữa</div>`;
    }

    div.innerHTML = html;

    if (sql && role === 'bot') {
      const btn = document.createElement('button');
      btn.className = 'btn-sm'; btn.style.cssText = 'margin:6px 0 0;font-size:11px;';
      btn.textContent = '📋 Xem SQL';
      btn.onclick = () => {
        const v = document.getElementById('sql-viewer');
        document.getElementById('sql-content').textContent = sql;
        v.style.display = v.style.display === 'none' ? 'block' : 'none';
      };
      div.querySelector('.msg-bubble').appendChild(btn);
    }

    wrap.appendChild(div);
    wrap.scrollTop = wrap.scrollHeight;
  },

  _showTyping() {
    const wrap = document.getElementById('chat-messages');
    const div  = document.createElement('div');
    div.className = 'msg bot'; div.id = 'typing-indicator';
    div.innerHTML = `<div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
    wrap.appendChild(div);
    wrap.scrollTop = wrap.scrollHeight;
  },

  _removeTyping() {
    document.getElementById('typing-indicator')?.remove();
  },

  async _ask(text) {
    const btn = document.getElementById('btn-send');
    btn.disabled = true;
    this._showTyping();
    try {
      const d = await fetchJSON.post(`${API}/chatbot/query`, { message: text });
      this._removeTyping();
      this.addMsg('bot', d.reply || 'Không có phản hồi.', d.sql || null, d.rows || null);
    } catch(e) {
      this._removeTyping();
      this.addMsg('bot', '❌ Lỗi kết nối server. Hãy kiểm tra lại.');
    } finally {
      btn.disabled = false;
      document.getElementById('chat-input').focus();
    }
  },

  clear() {
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('sql-viewer').style.display = 'none';
    this.addMsg('bot', '👋 Xin chào! Tôi là **ClassicBot AI**.\n\nTôi có thể giúp bạn phân tích dữ liệu ClassicModels. Hãy hỏi tôi bằng tiếng Việt hoặc English!\n\n**Ví dụ:**\n- Doanh thu năm 2004?\n- Top 5 khách hàng mua nhiều nhất?\n- Sản phẩm bán chạy nhất?');
  },

  _esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
};

// Override fetchJSON for POST support
fetchJSON.post = async (url, body) => {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

// Greeting on load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => Chatbot.clear(), 200);
});
