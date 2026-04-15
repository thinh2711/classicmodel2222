# ClassicModels Analytics Dashboard

> Website phân tích dữ liệu toàn diện cho cơ sở dữ liệu **ClassicModels**

## 🚀 Chạy nhanh

```bash
cd "classicmodels-dashboard"
chmod +x run.sh && ./run.sh
```

Sau đó mở trình duyệt: **http://localhost:5000**

---

## 📋 Yêu cầu

- Python 3.8+
- MySQL với database `classicmodels` đã được import
- Các package: `flask`, `flask-cors`, `mysql-connector-python`, `python-dotenv`

## ⚙️ Cấu hình

Tạo file `.env` trong thư mục gốc (tùy chọn):

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=classicmodels
PORT=5000
```

## 🎯 Tính năng

| Tính năng | Mô tả |
|-----------|-------|
| 📊 **Dashboard** | KPIs tổng quan: doanh thu, đơn hàng, khách hàng, sản phẩm |
| 📈 **Biểu Đồ** | Line/Bar/Pie/Doughnut charts tương tác với Chart.js |
| 🔄 **Pivot Table** | Kéo thả rows/columns, heatmap, export CSV |
| 🔍 **Tìm Kiếm** | Tìm theo thời gian / khách hàng / mặt hàng với phân trang |
| 🤖 **Chatbot AI** | Hỏi bằng tiếng Việt, tự generate SQL, hiển thị kết quả |

## 📁 Cấu trúc

```
classicmodels-dashboard/
├── backend/
│   ├── app.py              # Flask app
│   ├── config.py           # Cấu hình DB
│   ├── db.py               # Kết nối MySQL
│   └── routes/
│       ├── stats.py        # API thống kê
│       ├── search.py       # API tìm kiếm
│       ├── pivot.py        # API pivot
│       └── chatbot.py      # API chatbot
├── frontend/
│   ├── index.html
│   ├── css/main.css
│   └── js/
│       ├── app.js          # Router
│       ├── charts.js       # Biểu đồ
│       ├── pivot.js        # Pivot table
│       ├── search.js       # Tìm kiếm
│       └── chatbot.js      # Chatbot UI
├── requirements.txt
└── run.sh
```

## 💬 Chatbot — Câu hỏi mẫu

- `Doanh thu tháng 3 năm 2004?`
- `Top 5 khách hàng mua nhiều nhất?`
- `Sản phẩm nào bán chạy nhất?`
- `Số đơn hàng năm 2003?`
- `Khách hàng ở France?`
- `Tồn kho hiện tại?`
- `Tổng thanh toán là bao nhiêu?`
