from flask import Blueprint, jsonify, request
from backend.db import query as db_query
import re, json

chatbot_bp = Blueprint("chatbot", __name__)

# ---------------------------------------------------------------------------
# Intent → SQL template mapping (rule-based, Vietnamese + English)
# ---------------------------------------------------------------------------
INTENTS = [
    # ── Doanh thu ──────────────────────────────────────────────────────────
    {
        "patterns": [r"doanh thu", r"revenue", r"oanh thu"],
        "slots": {
            "year":    r"năm\s*(\d{4})|year\s*(\d{4})|(\d{4})",
            "month":   r"tháng\s*(\d{1,2})|month\s*(\d{1,2})",
            "quarter": r"quý\s*([1-4])|q([1-4])",
        },
        "handler": "revenue",
    },
    # ── Top khách hàng ─────────────────────────────────────────────────────
    {
        "patterns": [r"top.*khách hàng", r"khách hàng.*nhiều nhất",
                     r"best.*customer", r"top.*customer"],
        "handler": "top_customers",
    },
    # ── Top sản phẩm ───────────────────────────────────────────────────────
    {
        "patterns": [r"top.*sản phẩm", r"sản phẩm.*bán chạy",
                     r"best.*product", r"top.*product"],
        "handler": "top_products",
    },
    # ── Đơn hàng ───────────────────────────────────────────────────────────
    {
        "patterns": [r"đơn hàng", r"số đơn", r"orders?"],
        "slots": {
            "year":    r"năm\s*(\d{4})|year\s*(\d{4})|(\d{4})",
            "month":   r"tháng\s*(\d{1,2})|month\s*(\d{1,2})",
            "country": r"(?:ở|tại|at|in)\s+([A-Za-zÀ-ỹ ]+)",
        },
        "handler": "orders",
    },
    # ── Khách hàng theo quốc gia ───────────────────────────────────────────
    {
        "patterns": [r"khách hàng.*ở|customer.*in|khách.*pháp|khách.*mỹ|khách.*(?:usa|france|germany|uk)"],
        "slots": {
            "country": r"(?:ở|tại|at|in)\s+([A-Za-zÀ-ỹ ]+)",
        },
        "handler": "customers_by_country",
    },
    # ── Tồn kho ────────────────────────────────────────────────────────────
    {
        "patterns": [r"tồn kho", r"stock", r"inventory"],
        "handler": "stock",
    },
    # ── Lợi nhuận / thanh toán ─────────────────────────────────────────────
    {
        "patterns": [r"thanh toán", r"payment"],
        "handler": "payments",
    },
]


def extract_slot(text: str, pattern: str):
    m = re.search(pattern, text, re.IGNORECASE)
    if not m:
        return None
    return next((g for g in m.groups() if g), None)


def match_intent(text: str):
    tl = text.lower()
    for intent in INTENTS:
        if any(re.search(p, tl) for p in intent["patterns"]):
            slots = {}
            for slot, pat in intent.get("slots", {}).items():
                val = extract_slot(tl, pat)
                if val:
                    slots[slot] = val.strip()
            return intent["handler"], slots
    return None, {}


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------

def handle_revenue(slots):
    clauses, params = ["o.status NOT IN ('Cancelled')"], []
    if "year" in slots:
        clauses.append("YEAR(o.orderDate) = %s")
        params.append(int(slots["year"]))
    if "month" in slots:
        clauses.append("MONTH(o.orderDate) = %s")
        params.append(int(slots["month"]))
    if "quarter" in slots:
        clauses.append("QUARTER(o.orderDate) = %s")
        params.append(int(slots["quarter"]))

    where = "WHERE " + " AND ".join(clauses)
    row = db_query(
        f"""
        SELECT
            ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue,
            COUNT(DISTINCT o.orderNumber) AS orders
        FROM orders o
        JOIN orderdetails od ON o.orderNumber = od.orderNumber
        {where}
        """,
        tuple(params), fetch_one=True
    )
    rev = float(row["revenue"] or 0)
    ords = row["orders"]

    period = []
    if "year"    in slots: period.append(f"năm {slots['year']}")
    if "quarter" in slots: period.append(f"quý {slots['quarter']}")
    if "month"   in slots: period.append(f"tháng {slots['month']}")
    period_str = ", ".join(period) or "tất cả thời gian"

    sql = f"SELECT SUM(quantityOrdered*priceEach) FROM orderdetails JOIN orders USING(orderNumber) {where}"
    return (
        f"💰 Doanh thu **{period_str}**: **${rev:,.2f}** từ **{ords}** đơn hàng.",
        sql, [row]
    )


def handle_top_customers(slots):
    rows = db_query(
        """
        SELECT c.customerName, c.country,
               ROUND(SUM(od.quantityOrdered*od.priceEach),2) AS revenue,
               COUNT(DISTINCT o.orderNumber) AS orders
        FROM customers c
        JOIN orders o ON c.customerNumber=o.customerNumber
        JOIN orderdetails od ON o.orderNumber=od.orderNumber
        WHERE o.status NOT IN ('Cancelled')
        GROUP BY c.customerNumber
        ORDER BY revenue DESC LIMIT 5
        """
    )
    lines = [f"{i+1}. **{r['customerName']}** ({r['country']}) — ${float(r['revenue']):,.2f}" for i, r in enumerate(rows)]
    text = "🏆 Top 5 khách hàng doanh thu cao nhất:\n" + "\n".join(lines)
    sql = "SELECT customerName, SUM(quantityOrdered*priceEach) AS revenue FROM customers JOIN orders USING(customerNumber) JOIN orderdetails USING(orderNumber) GROUP BY customerNumber ORDER BY revenue DESC LIMIT 5"
    return text, sql, rows


def handle_top_products(slots):
    rows = db_query(
        """
        SELECT p.productName, p.productLine,
               ROUND(SUM(od.quantityOrdered*od.priceEach),2) AS revenue,
               SUM(od.quantityOrdered) AS qty
        FROM orderdetails od
        JOIN products p ON od.productCode=p.productCode
        JOIN orders o ON od.orderNumber=o.orderNumber
        WHERE o.status NOT IN ('Cancelled')
        GROUP BY p.productCode
        ORDER BY revenue DESC LIMIT 5
        """
    )
    lines = [f"{i+1}. **{r['productName']}** ({r['productLine']}) — ${float(r['revenue']):,.2f}" for i, r in enumerate(rows)]
    text = "🏎️ Top 5 sản phẩm bán chạy nhất:\n" + "\n".join(lines)
    sql = "SELECT productName, SUM(quantityOrdered*priceEach) AS revenue FROM products JOIN orderdetails USING(productCode) JOIN orders USING(orderNumber) GROUP BY productCode ORDER BY revenue DESC LIMIT 5"
    return text, sql, rows


def handle_orders(slots):
    clauses, params = ["o.status NOT IN ('Cancelled')"], []
    if "year" in slots:
        clauses.append("YEAR(o.orderDate)=%s"); params.append(int(slots["year"]))
    if "month" in slots:
        clauses.append("MONTH(o.orderDate)=%s"); params.append(int(slots["month"]))
    if "country" in slots:
        clauses.append("c.country LIKE %s"); params.append(f"%{slots['country']}%")

    where = "WHERE " + " AND ".join(clauses)
    row = db_query(
        f"SELECT COUNT(DISTINCT o.orderNumber) AS cnt FROM orders o JOIN customers c ON o.customerNumber=c.customerNumber {where}",
        tuple(params), fetch_one=True
    )
    cnt = row["cnt"]
    period = []
    if "year" in slots: period.append(f"năm {slots['year']}")
    if "month" in slots: period.append(f"tháng {slots['month']}")
    if "country" in slots: period.append(f"quốc gia '{slots['country']}'")
    period_str = ", ".join(period) or "tất cả"
    sql = f"SELECT COUNT(*) FROM orders JOIN customers USING(customerNumber) {where}"
    return f"📦 Số đơn hàng ({period_str}): **{cnt}** đơn.", sql, [row]


def handle_customers_by_country(slots):
    country = slots.get("country", "")
    rows = db_query(
        "SELECT customerName, city, country FROM customers WHERE country LIKE %s ORDER BY customerName LIMIT 20",
        (f"%{country}%",)
    )
    text = f"👥 Khách hàng ở '{country}': **{len(rows)}** khách" + (f" — {', '.join(r['customerName'] for r in rows[:5])}..." if rows else ".")
    sql = f"SELECT customerName, city, country FROM customers WHERE country LIKE '%{country}%'"
    return text, sql, rows


def handle_stock(slots):
    rows = db_query(
        """
        SELECT productName, productLine, quantityInStock, buyPrice, MSRP
        FROM products ORDER BY quantityInStock DESC LIMIT 10
        """
    )
    lines = [f"- **{r['productName']}**: {r['quantityInStock']} units" for r in rows[:5]]
    text = "📦 Top 5 sản phẩm tồn kho cao nhất:\n" + "\n".join(lines)
    sql = "SELECT productName, quantityInStock FROM products ORDER BY quantityInStock DESC LIMIT 10"
    return text, sql, rows


def handle_payments(slots):
    row = db_query(
        "SELECT ROUND(SUM(amount),2) AS total, COUNT(*) AS cnt FROM payments",
        fetch_one=True
    )
    total = float(row["total"] or 0)
    text = f"💳 Tổng thanh toán: **${total:,.2f}** từ {row['cnt']} giao dịch."
    sql = "SELECT SUM(amount) AS total, COUNT(*) AS cnt FROM payments"
    return text, sql, [row]


HANDLERS = {
    "revenue":              handle_revenue,
    "top_customers":        handle_top_customers,
    "top_products":         handle_top_products,
    "orders":               handle_orders,
    "customers_by_country": handle_customers_by_country,
    "stock":                handle_stock,
    "payments":             handle_payments,
}

HELP_TEXT = """Tôi có thể trả lời các câu hỏi về dữ liệu **ClassicModels**. Ví dụ:
- "Doanh thu tháng 3 năm 2004?"
- "Top 5 khách hàng mua nhiều nhất?"
- "Sản phẩm nào bán chạy nhất?"
- "Số đơn hàng năm 2003?"
- "Khách hàng ở Pháp?"
- "Tồn kho hiện tại?"
- "Tổng thanh toán là bao nhiêu?"
"""


@chatbot_bp.route("/query", methods=["POST"])
def chat():
    data = request.get_json(force=True)
    user_msg = (data.get("message") or "").strip()

    if not user_msg:
        return jsonify({"reply": "Vui lòng nhập câu hỏi.", "sql": "", "rows": []})

    if re.search(r"help|giúp|hướng dẫn|xin chào|hello|hi\b", user_msg, re.I):
        return jsonify({"reply": HELP_TEXT, "sql": "", "rows": []})

    handler_key, slots = match_intent(user_msg)
    if handler_key and handler_key in HANDLERS:
        try:
            reply, sql, rows = HANDLERS[handler_key](slots)
            # Convert Decimal → float for JSON
            clean = [{k: (float(v) if hasattr(v, "__float__") and not isinstance(v, (int, str, type(None))) else v)
                      for k, v in r.items()} for r in rows]
            return jsonify({"reply": reply, "sql": sql, "rows": clean})
        except Exception as exc:
            return jsonify({"reply": f"⚠️ Lỗi truy vấn: {exc}", "sql": "", "rows": []})

    return jsonify({
        "reply": f'Xin lỗi, tôi chưa hiểu câu hỏi: *"{user_msg}"*.\n\n' + HELP_TEXT,
        "sql": "",
        "rows": [],
    })
