from flask import Blueprint, jsonify, request
from backend.db import query

search_bp = Blueprint("search", __name__)


def _date_filter(date_from, date_to, col="o.orderDate"):
    clauses, params = [], []
    if date_from:
        clauses.append(f"{col} >= %s")
        params.append(date_from)
    if date_to:
        clauses.append(f"{col} <= %s")
        params.append(date_to)
    return clauses, params


@search_bp.route("/orders")
def search_orders():
    """
    Tìm kiếm đơn hàng theo:
    - thời gian  : date_from, date_to
    - khách hàng : customer_name, country
    - mặt hàng   : product_name, product_line
    - trạng thái : status
    """
    date_from    = request.args.get("date_from", "")
    date_to      = request.args.get("date_to", "")
    customer_kw  = request.args.get("customer", "").strip()
    country      = request.args.get("country", "").strip()
    product_kw   = request.args.get("product", "").strip()
    product_line = request.args.get("product_line", "").strip()
    status       = request.args.get("status", "").strip()
    page         = int(request.args.get("page", 1))
    per_page     = int(request.args.get("per_page", 20))
    offset       = (page - 1) * per_page

    clauses, params = _date_filter(date_from, date_to)

    if customer_kw:
        clauses.append("c.customerName LIKE %s")
        params.append(f"%{customer_kw}%")
    if country:
        clauses.append("c.country = %s")
        params.append(country)
    if product_kw:
        clauses.append("p.productName LIKE %s")
        params.append(f"%{product_kw}%")
    if product_line:
        clauses.append("p.productLine = %s")
        params.append(product_line)
    if status:
        clauses.append("o.status = %s")
        params.append(status)

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""

    count_row = query(
        f"""
        SELECT COUNT(DISTINCT o.orderNumber) AS cnt
        FROM orders o
        JOIN customers   c  ON o.customerNumber = c.customerNumber
        JOIN orderdetails od ON o.orderNumber = od.orderNumber
        JOIN products     p  ON od.productCode = p.productCode
        {where}
        """,
        tuple(params),
        fetch_one=True,
    )
    total = count_row["cnt"]

    rows = query(
        f"""
        SELECT
            o.orderNumber,
            DATE_FORMAT(o.orderDate, '%Y-%m-%d')     AS orderDate,
            DATE_FORMAT(o.requiredDate, '%Y-%m-%d')  AS requiredDate,
            DATE_FORMAT(o.shippedDate, '%Y-%m-%d')   AS shippedDate,
            o.status,
            c.customerName,
            c.country,
            ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue
        FROM orders o
        JOIN customers    c  ON o.customerNumber = c.customerNumber
        JOIN orderdetails od ON o.orderNumber = od.orderNumber
        JOIN products     p  ON od.productCode = p.productCode
        {where}
        GROUP BY o.orderNumber, o.orderDate, o.requiredDate, o.shippedDate,
                 o.status, c.customerName, c.country
        ORDER BY o.orderDate DESC
        LIMIT %s OFFSET %s
        """,
        tuple(params) + (per_page, offset),
    )

    import math
    pages = max(1, math.ceil(total / per_page))
    return jsonify({"total": total, "page": page, "pages": pages, "per_page": per_page, "data": rows})


@search_bp.route("/customers")
def search_customers():
    kw      = request.args.get("q", "").strip()
    country = request.args.get("country", "").strip()
    clauses, params = [], []
    if kw:
        clauses.append("(c.customerName LIKE %s OR c.contactFirstName LIKE %s OR c.contactLastName LIKE %s)")
        params += [f"%{kw}%", f"%{kw}%", f"%{kw}%"]
    if country:
        clauses.append("c.country = %s")
        params.append(country)

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = query(
        f"""
        SELECT
            c.customerNumber,
            c.customerName,
            CONCAT(c.contactFirstName,' ',c.contactLastName) AS contact,
            c.phone,
            c.city,
            c.country,
            c.creditLimit,
            COUNT(DISTINCT o.orderNumber) AS orders,
            ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue
        FROM customers c
        LEFT JOIN orders      o  ON c.customerNumber = o.customerNumber AND o.status NOT IN ('Cancelled')
        LEFT JOIN orderdetails od ON o.orderNumber = od.orderNumber
        {where}
        GROUP BY c.customerNumber, c.customerName, c.contactFirstName, c.contactLastName, c.phone, c.city, c.country, c.creditLimit
        ORDER BY revenue DESC
        LIMIT 100
        """,
        tuple(params)
    )
    return jsonify({"data": rows, "total": len(rows), "page": 1, "pages": 1})


@search_bp.route("/products")
def search_products():
    kw   = request.args.get("q", "").strip()
    line = request.args.get("line", "").strip()
    clauses, params = [], []
    if kw:
        clauses.append("(p.productName LIKE %s OR p.productDescription LIKE %s)")
        params += [f"%{kw}%", f"%{kw}%"]
    if line:
        clauses.append("p.productLine = %s")
        params.append(line)

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = query(
        f"""
        SELECT
            p.productCode,
            p.productName,
            p.productLine,
            p.productScale,
            p.productVendor,
            p.quantityInStock,
            p.buyPrice,
            p.MSRP,
            ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue,
            COALESCE(SUM(od.quantityOrdered), 0) AS soldTotal
        FROM products p
        LEFT JOIN orderdetails od ON p.productCode = od.productCode
        LEFT JOIN orders o ON od.orderNumber = o.orderNumber AND o.status NOT IN ('Cancelled')
        {where}
        GROUP BY p.productCode
        ORDER BY revenue DESC
        LIMIT 200
        """,
        tuple(params)
    )
    return jsonify({"data": rows, "total": len(rows)})


@search_bp.route("/countries")
def list_countries():
    rows = query("SELECT DISTINCT country FROM customers ORDER BY country")
    return jsonify([{"country": r["country"]} for r in rows])


@search_bp.route("/product-lines")
def list_product_lines():
    rows = query("SELECT productLine FROM productlines ORDER BY productLine")
    return jsonify([{"productLine": r["productLine"]} for r in rows])
