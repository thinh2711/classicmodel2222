from flask import Blueprint, jsonify, request
from backend.db import query

stats_bp = Blueprint("stats", __name__)


def _safe_float(v):
    return float(v) if v is not None else 0.0


@stats_bp.route("/overview")
def overview():
    """KPIs tổng quan + so sánh tháng trước (MoM)."""
    revenue  = query("SELECT ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS total FROM orderdetails od JOIN orders o ON od.orderNumber = o.orderNumber WHERE o.status NOT IN ('Cancelled')", fetch_one=True)
    orders   = query("SELECT COUNT(*) AS total FROM orders WHERE status NOT IN ('Cancelled')", fetch_one=True)
    customers= query("SELECT COUNT(*) AS total FROM customers", fetch_one=True)
    products = query("SELECT COUNT(*) AS total FROM products",  fetch_one=True)
    payments = query("SELECT ROUND(SUM(amount), 2) AS total FROM payments", fetch_one=True)

    mom = query("""
        SELECT YEAR(o.orderDate) AS yr, MONTH(o.orderDate) AS mo,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue,
               COUNT(DISTINCT o.orderNumber) AS orders
        FROM orders o JOIN orderdetails od ON o.orderNumber = od.orderNumber
        WHERE o.status NOT IN ('Cancelled')
        GROUP BY yr, mo ORDER BY yr DESC, mo DESC LIMIT 2
    """)
    mom_revenue_pct = mom_orders_pct = 0
    if len(mom) >= 2:
        r0, r1 = _safe_float(mom[0]["revenue"]), _safe_float(mom[1]["revenue"])
        o0, o1 = mom[0]["orders"], mom[1]["orders"]
        mom_revenue_pct = round((r0 - r1) / r1 * 100, 1) if r1 else 0
        mom_orders_pct  = round((o0 - o1) / o1 * 100, 1) if o1 else 0

    return jsonify({
        "revenue":         _safe_float(revenue["total"]),
        "orders":          orders["total"],
        "customers":       customers["total"],
        "products":        products["total"],
        "payments":        _safe_float(payments["total"]),
        "mom_revenue_pct": mom_revenue_pct,
        "mom_orders_pct":  mom_orders_pct,
    })


@stats_bp.route("/revenue")
def revenue_over_time():
    year = request.args.get("year", "")
    params = []
    year_filter = ""
    if year:
        year_filter = "AND YEAR(o.orderDate) = %s"
        params.append(int(year))
    rows = query(f"""
        SELECT YEAR(o.orderDate) AS yr, MONTH(o.orderDate) AS mo,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue,
               COUNT(DISTINCT o.orderNumber) AS orders
        FROM orders o JOIN orderdetails od ON o.orderNumber = od.orderNumber
        WHERE o.status NOT IN ('Cancelled') {year_filter}
        GROUP BY yr, mo ORDER BY yr, mo
    """, tuple(params))
    return jsonify(rows)


@stats_bp.route("/revenue-by-year")
def revenue_by_year():
    rows = query("""
        SELECT YEAR(o.orderDate) AS yr,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue,
               COUNT(DISTINCT o.orderNumber) AS orders
        FROM orders o JOIN orderdetails od ON o.orderNumber = od.orderNumber
        WHERE o.status NOT IN ('Cancelled')
        GROUP BY yr ORDER BY yr
    """)
    return jsonify(rows)


@stats_bp.route("/by-productline")
def by_productline():
    rows = query("""
        SELECT p.productLine,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue,
               SUM(od.quantityOrdered) AS qty,
               ROUND(AVG(od.priceEach), 2) AS avgPrice
        FROM orderdetails od
        JOIN products p ON od.productCode = p.productCode
        JOIN orders   o ON od.orderNumber = o.orderNumber
        WHERE o.status NOT IN ('Cancelled')
        GROUP BY p.productLine ORDER BY revenue DESC
    """)
    return jsonify(rows)


@stats_bp.route("/top-products")
def top_products():
    limit = int(request.args.get("limit", 10))
    rows = query("""
        SELECT p.productCode, p.productName, p.productLine,
               p.buyPrice,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue,
               SUM(od.quantityOrdered) AS qty,
               ROUND(AVG(od.priceEach) - p.buyPrice, 2) AS profitPerUnit
        FROM orderdetails od
        JOIN products p ON od.productCode = p.productCode
        JOIN orders   o ON od.orderNumber = o.orderNumber
        WHERE o.status NOT IN ('Cancelled')
        GROUP BY p.productCode, p.productName, p.productLine, p.buyPrice
        ORDER BY revenue DESC LIMIT %s
    """, (limit,))
    return jsonify(rows)


@stats_bp.route("/top-customers")
def top_customers():
    limit = int(request.args.get("limit", 10))
    rows = query("""
        SELECT c.customerNumber, c.customerName, c.country,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue,
               COUNT(DISTINCT o.orderNumber) AS orders,
               ROUND(COALESCE((SELECT SUM(amount) FROM payments WHERE customerNumber=c.customerNumber),0),2) AS paid
        FROM customers c
        JOIN orders       o  ON c.customerNumber = o.customerNumber
        JOIN orderdetails od ON o.orderNumber = od.orderNumber
        WHERE o.status NOT IN ('Cancelled')
        GROUP BY c.customerNumber, c.customerName, c.country
        ORDER BY revenue DESC LIMIT %s
    """, (limit,))
    return jsonify(rows)


@stats_bp.route("/by-office")
def by_office():
    rows = query("""
        SELECT o2.city, o2.country,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue,
               COUNT(DISTINCT o.orderNumber) AS orders,
               COUNT(DISTINCT c.customerNumber) AS customers
        FROM offices o2
        JOIN employees e  ON e.officeCode = o2.officeCode
        JOIN customers c  ON c.salesRepEmployeeNumber = e.employeeNumber
        JOIN orders    o  ON o.customerNumber = c.customerNumber
        JOIN orderdetails od ON od.orderNumber = o.orderNumber
        WHERE o.status NOT IN ('Cancelled')
        GROUP BY o2.officeCode, o2.city, o2.country ORDER BY revenue DESC
    """)
    return jsonify(rows)


@stats_bp.route("/order-status")
def order_status():
    rows = query("SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status ORDER BY cnt DESC")
    return jsonify(rows)


@stats_bp.route("/years")
def available_years():
    rows = query("SELECT DISTINCT YEAR(orderDate) AS yr FROM orders ORDER BY yr")
    return jsonify([r["yr"] for r in rows])


@stats_bp.route("/employees")
def employees():
    limit = int(request.args.get("limit", 10))
    rows = query("""
        SELECT e.employeeNumber,
               CONCAT(e.firstName, ' ', e.lastName) AS name,
               e.jobTitle, o2.city AS office,
               COUNT(DISTINCT c.customerNumber) AS customers,
               COUNT(DISTINCT ord.orderNumber)  AS orders,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue
        FROM employees e
        JOIN offices   o2  ON e.officeCode = o2.officeCode
        LEFT JOIN customers    c   ON c.salesRepEmployeeNumber = e.employeeNumber
        LEFT JOIN orders       ord ON ord.customerNumber = c.customerNumber AND ord.status NOT IN ('Cancelled')
        LEFT JOIN orderdetails od  ON od.orderNumber = ord.orderNumber
        WHERE e.jobTitle LIKE '%%Sales Rep%%'
        GROUP BY e.employeeNumber, name, e.jobTitle, o2.city
        ORDER BY revenue DESC LIMIT %s
    """, (limit,))
    return jsonify(rows)


@stats_bp.route("/low-stock")
def low_stock():
    threshold = int(request.args.get("threshold", 2000))
    rows = query("""
        SELECT p.productCode, p.productName, p.productLine,
               p.quantityInStock, p.buyPrice, p.MSRP,
               COALESCE(SUM(od.quantityOrdered), 0) AS soldTotal
        FROM products p
        LEFT JOIN orderdetails od ON p.productCode = od.productCode
        LEFT JOIN orders o ON od.orderNumber = o.orderNumber AND o.status NOT IN ('Cancelled')
        GROUP BY p.productCode, p.productName, p.productLine, p.quantityInStock, p.buyPrice, p.MSRP
        HAVING p.quantityInStock < %s
        ORDER BY p.quantityInStock ASC LIMIT 20
    """, (threshold,))
    return jsonify(rows)


@stats_bp.route("/quarterly")
def quarterly():
    rows = query("""
        SELECT YEAR(o.orderDate) AS yr, QUARTER(o.orderDate) AS q,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue,
               COUNT(DISTINCT o.orderNumber) AS orders,
               COUNT(DISTINCT o.customerNumber) AS customers
        FROM orders o JOIN orderdetails od ON o.orderNumber = od.orderNumber
        WHERE o.status NOT IN ('Cancelled')
        GROUP BY yr, q ORDER BY yr, q
    """)
    return jsonify(rows)


@stats_bp.route("/monthly-report")
def monthly_report():
    year = request.args.get("year", "")
    params = []
    year_filter = ""
    if year:
        year_filter = "AND YEAR(o.orderDate) = %s"
        params.append(int(year))
    rows = query(f"""
        SELECT YEAR(o.orderDate) AS yr, MONTH(o.orderDate) AS mo,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue,
               ROUND(SUM(od.quantityOrdered * p.buyPrice), 2)   AS cost,
               ROUND(SUM(od.quantityOrdered*(od.priceEach - p.buyPrice)), 2) AS profit,
               COUNT(DISTINCT o.orderNumber) AS orders,
               COUNT(DISTINCT o.customerNumber) AS customers,
               SUM(od.quantityOrdered) AS qty
        FROM orders o
        JOIN orderdetails od ON o.orderNumber = od.orderNumber
        JOIN products p      ON od.productCode = p.productCode
        WHERE o.status NOT IN ('Cancelled') {year_filter}
        GROUP BY yr, mo ORDER BY yr, mo
    """, tuple(params))

    for i, r in enumerate(rows):
        prev = rows[i - 1] if i > 0 else None
        rev_f = _safe_float(r["revenue"])
        if prev and _safe_float(prev["revenue"]) > 0:
            r["growth"] = round((rev_f - _safe_float(prev["revenue"])) / _safe_float(prev["revenue"]) * 100, 1)
        else:
            r["growth"] = None
        r["margin_pct"] = round(_safe_float(r["profit"]) / rev_f * 100, 1) if rev_f else 0

    return jsonify(rows)


@stats_bp.route("/rfm")
def rfm():
    rows = query("""
        SELECT c.customerNumber, c.customerName, c.country,
               DATEDIFF(CURDATE(), MAX(o.orderDate)) AS recency_days,
               COUNT(DISTINCT o.orderNumber)          AS frequency,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS monetary
        FROM customers c
        JOIN orders       o  ON c.customerNumber = o.customerNumber
        JOIN orderdetails od ON o.orderNumber = od.orderNumber
        WHERE o.status NOT IN ('Cancelled')
        GROUP BY c.customerNumber, c.customerName, c.country
        ORDER BY monetary DESC LIMIT 50
    """)
    return jsonify(rows)


# ─── Comprehensive Alerts ──────────────────────────────────────────────────────
@stats_bp.route("/alerts")
def alerts():
    """Trả về tất cả cảnh báo về sản phẩm và khách hàng."""

    # 1. Tồn kho cạn kiệt (< 500)
    critical_stock = query("""
        SELECT p.productCode, p.productName, p.productLine,
               p.quantityInStock, p.buyPrice, p.MSRP,
               COALESCE(SUM(od.quantityOrdered), 0) AS soldTotal
        FROM products p
        LEFT JOIN orderdetails od ON p.productCode = od.productCode
        LEFT JOIN orders o ON od.orderNumber = o.orderNumber
            AND o.status NOT IN ('Cancelled')
        GROUP BY p.productCode, p.productName, p.productLine,
                 p.quantityInStock, p.buyPrice, p.MSRP
        HAVING p.quantityInStock < 500
        ORDER BY p.quantityInStock ASC LIMIT 15
    """)

    # 2. Tồn kho thấp (500–1500)
    low_stock = query("""
        SELECT p.productCode, p.productName, p.productLine,
               p.quantityInStock, p.MSRP,
               COALESCE(SUM(od.quantityOrdered), 0) AS soldTotal
        FROM products p
        LEFT JOIN orderdetails od ON p.productCode = od.productCode
        LEFT JOIN orders o ON od.orderNumber = o.orderNumber
            AND o.status NOT IN ('Cancelled')
        GROUP BY p.productCode, p.productName, p.productLine,
                 p.quantityInStock, p.MSRP
        HAVING p.quantityInStock BETWEEN 500 AND 1500
        ORDER BY p.quantityInStock ASC LIMIT 15
    """)

    # 3. Không có đơn trong 90 ngày
    no_recent_sales = query("""
        SELECT p.productCode, p.productName, p.productLine,
               p.quantityInStock, p.buyPrice,
               MAX(o.orderDate) AS lastOrderDate,
               DATEDIFF(CURDATE(), MAX(o.orderDate)) AS daysSinceSale
        FROM products p
        LEFT JOIN orderdetails od ON p.productCode = od.productCode
        LEFT JOIN orders o ON od.orderNumber = o.orderNumber
            AND o.status NOT IN ('Cancelled')
        GROUP BY p.productCode, p.productName, p.productLine,
                 p.quantityInStock, p.buyPrice
        HAVING daysSinceSale > 90 OR daysSinceSale IS NULL
        ORDER BY daysSinceSale DESC LIMIT 15
    """)

    # 4. Biên lợi nhuận thấp (< 20%)
    low_margin = query("""
        SELECT p.productCode, p.productName, p.productLine,
               p.buyPrice, p.MSRP,
               ROUND(AVG(od.priceEach), 2) AS avgSellPrice,
               ROUND((AVG(od.priceEach) - p.buyPrice) / AVG(od.priceEach) * 100, 1) AS marginPct,
               SUM(od.quantityOrdered) AS soldTotal
        FROM products p
        JOIN orderdetails od ON p.productCode = od.productCode
        JOIN orders o ON od.orderNumber = o.orderNumber
            AND o.status NOT IN ('Cancelled')
        GROUP BY p.productCode, p.productName, p.productLine, p.buyPrice, p.MSRP
        HAVING marginPct < 20 AND soldTotal > 0
        ORDER BY marginPct ASC LIMIT 15
    """)

    # 5. Khách hàng nợ > 10000
    overdue_payment = query("""
        SELECT c.customerNumber, c.customerName, c.country, c.phone,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS totalRevenue,
               ROUND(COALESCE((SELECT SUM(amount) FROM payments p2
                               WHERE p2.customerNumber = c.customerNumber), 0), 2) AS paid,
               ROUND(SUM(od.quantityOrdered * od.priceEach) -
                     COALESCE((SELECT SUM(amount) FROM payments p2
                               WHERE p2.customerNumber = c.customerNumber), 0), 2) AS outstanding,
               c.creditLimit,
               MAX(o.orderDate) AS lastOrderDate
        FROM customers c
        JOIN orders o ON c.customerNumber = o.customerNumber
            AND o.status NOT IN ('Cancelled')
        JOIN orderdetails od ON o.orderNumber = od.orderNumber
        GROUP BY c.customerNumber, c.customerName, c.country, c.phone, c.creditLimit
        HAVING outstanding > 10000
        ORDER BY outstanding DESC LIMIT 15
    """)

    # 6. Khách hàng không hoạt động > 365 ngày
    inactive_customers = query("""
        SELECT c.customerNumber, c.customerName, c.country, c.phone,
               MAX(o.orderDate) AS lastOrderDate,
               DATEDIFF(CURDATE(), MAX(o.orderDate)) AS inactiveDays,
               COUNT(DISTINCT o.orderNumber) AS totalOrders,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS totalRevenue
        FROM customers c
        JOIN orders o ON c.customerNumber = o.customerNumber
        JOIN orderdetails od ON o.orderNumber = od.orderNumber
        GROUP BY c.customerNumber, c.customerName, c.country, c.phone
        HAVING inactiveDays > 365
        ORDER BY inactiveDays DESC LIMIT 15
    """)

    # 7. Gần đạt hạn mức tín dụng (> 80%)
    near_credit_limit = query("""
        SELECT c.customerNumber, c.customerName, c.country, c.creditLimit,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS totalRevenue,
               ROUND(COALESCE((SELECT SUM(amount) FROM payments p2
                               WHERE p2.customerNumber = c.customerNumber), 0), 2) AS paid,
               ROUND(SUM(od.quantityOrdered * od.priceEach) -
                     COALESCE((SELECT SUM(amount) FROM payments p2
                               WHERE p2.customerNumber = c.customerNumber), 0), 2) AS outstanding,
               ROUND((SUM(od.quantityOrdered * od.priceEach) -
                      COALESCE((SELECT SUM(amount) FROM payments p2
                                WHERE p2.customerNumber = c.customerNumber), 0))
                     / NULLIF(c.creditLimit, 0) * 100, 1) AS creditUsedPct
        FROM customers c
        JOIN orders o ON c.customerNumber = o.customerNumber
            AND o.status NOT IN ('Cancelled')
        JOIN orderdetails od ON o.orderNumber = od.orderNumber
        GROUP BY c.customerNumber, c.customerName, c.country, c.creditLimit
        HAVING creditUsedPct > 80 AND c.creditLimit > 0
        ORDER BY creditUsedPct DESC LIMIT 15
    """)

    # 8. Đơn tranh chấp / chờ xử lý
    disputed_orders = query("""
        SELECT o.orderNumber, o.orderDate, o.status,
               c.customerName, c.country, c.phone,
               ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS orderValue,
               DATEDIFF(CURDATE(), o.orderDate) AS ageDays
        FROM orders o
        JOIN customers c ON o.customerNumber = c.customerNumber
        JOIN orderdetails od ON o.orderNumber = od.orderNumber
        WHERE o.status IN ('Disputed', 'On Hold', 'In Process')
        GROUP BY o.orderNumber, o.orderDate, o.status,
                 c.customerName, c.country, c.phone
        ORDER BY ageDays DESC LIMIT 20
    """)

    summary = {
        "critical_stock_count":     len(critical_stock),
        "low_stock_count":          len(low_stock),
        "no_recent_sales_count":    len(no_recent_sales),
        "low_margin_count":         len(low_margin),
        "overdue_payment_count":    len(overdue_payment),
        "inactive_customers_count": len(inactive_customers),
        "near_credit_limit_count":  len(near_credit_limit),
        "disputed_orders_count":    len(disputed_orders),
        "total_product_alerts":     len(critical_stock) + len(low_stock) + len(no_recent_sales) + len(low_margin),
        "total_customer_alerts":    len(overdue_payment) + len(inactive_customers) + len(near_credit_limit) + len(disputed_orders),
    }

    return jsonify({
        "summary": summary,
        "product_alerts": {
            "critical_stock":  critical_stock,
            "low_stock":       low_stock,
            "no_recent_sales": no_recent_sales,
            "low_margin":      low_margin,
        },
        "customer_alerts": {
            "overdue_payment":     overdue_payment,
            "inactive_customers":  inactive_customers,
            "near_credit_limit":   near_credit_limit,
            "disputed_orders":     disputed_orders,
        },
    })
