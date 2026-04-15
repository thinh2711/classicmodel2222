import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # ── MySQL Database ──────────────────────────────────────────────────────
    DB_HOST     = os.getenv("DB_HOST",     "localhost")
    DB_PORT     = int(os.getenv("DB_PORT", "3306"))
    DB_USER     = os.getenv("DB_USER",     "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME     = os.getenv("DB_NAME",     "classicmodels")
    # Optional: override unix socket path (e.g. /var/run/mysqld/mysqld.sock)
    DB_SOCKET   = os.getenv("DB_SOCKET",   "")

    # ── SQLAlchemy URI ──────────────────────────────────────────────────────
    # Uses PyMySQL driver (pure Python, no native libraries needed)
    if DB_SOCKET:
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@/{DB_NAME}"
            f"?unix_socket={DB_SOCKET}"
        )
    else:
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
            f"?charset=utf8mb4"
        )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 10,
    }

    # ── Flask ───────────────────────────────────────────────────────────────
    SECRET_KEY = os.getenv("SECRET_KEY", "classicmodels-secret-2024")
    DEBUG      = os.getenv("DEBUG", "true").lower() == "true"
    PORT       = int(os.getenv("PORT", "5000"))

    # ── Optional AI ─────────────────────────────────────────────────────────
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
