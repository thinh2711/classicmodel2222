from flask import Blueprint, jsonify, request
from backend.db import query

pivot_bp = Blueprint("pivot", __name__)

ALLOWED_ROWS = {
    "productLine": "p.productLine",
    "country":     "c.country",
    "status":      "o.status",
    "year":        "YEAR(o.orderDate)",
    "quarter":     "CONCAT(YEAR(o.orderDate),' Q',QUARTER(o.orderDate))",
    "month":       "DATE_FORMAT(o.orderDate,'%Y-%m')",
    "employee":    "CONCAT(e.firstName,' ',e.lastName)",
    "office":      "o2.city",
}

ALLOWED_VALUES = {
    "revenue": "ROUND(SUM(od.quantityOrdered * od.priceEach), 2)",
    "orders":  "COUNT(DISTINCT o.orderNumber)",
    "qty":     "SUM(od.quantityOrdered)",
}


@pivot_bp.route("/data")
def pivot_data():
    """
    Trả về dữ liệu phẳng (flat) cho pivot table.
    Query params:
        row   : productLine | country | status | year | quarter | month | employee | office
        col   : (same options — optional second grouping)
        value : revenue | orders | qty
        year  : lọc theo năm (optional)
    """
    row_dim   = request.args.get("row",   "productLine")
    col_dim   = request.args.get("col",   "year")
    value_dim = request.args.get("value", "revenue")
    year      = request.args.get("year",  "")

    if row_dim   not in ALLOWED_ROWS:    row_dim   = "productLine"
    if col_dim   not in ALLOWED_ROWS:    col_dim   = "year"
    if value_dim not in ALLOWED_VALUES:  value_dim = "revenue"

    row_expr   = ALLOWED_ROWS[row_dim]
    col_expr   = ALLOWED_ROWS[col_dim]
    value_expr = ALLOWED_VALUES[value_dim]

    year_filter = ""
    params = []
    if year:
        year_filter = "AND YEAR(o.orderDate) = %s"
        params.append(int(year))

    rows = query(
        f"""
        SELECT
            {row_expr} AS row_dim,
            {col_expr} AS col_dim,
            {value_expr} AS val
        FROM orders o
        JOIN customers    c   ON o.customerNumber = c.customerNumber
        JOIN orderdetails od  ON o.orderNumber = od.orderNumber
        JOIN products     p   ON od.productCode = p.productCode
        LEFT JOIN employees e  ON c.salesRepEmployeeNumber = e.employeeNumber
        LEFT JOIN offices   o2 ON e.officeCode = o2.officeCode
        WHERE o.status NOT IN ('Cancelled') {year_filter}
        GROUP BY row_dim, col_dim
        ORDER BY row_dim, col_dim
        """,
        tuple(params)
    )

    return jsonify({
        "rowDim": row_dim,
        "colDim": col_dim,
        "valueDim": value_dim,
        "data": rows,
    })
