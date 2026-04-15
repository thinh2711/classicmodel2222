import os
import mysql.connector
from mysql.connector import pooling, errors
from backend.config import Config

_pool = None

# Common Unix socket paths on Linux (MySQL / MariaDB)
_SOCKET_CANDIDATES = [
    "/var/run/mysqld/mysqld.sock",
    "/tmp/mysql.sock",
    "/run/mysqld/mysqld.sock",
    "/var/lib/mysql/mysql.sock",
]


def _detect_socket() -> str | None:
    """Return first existing MySQL Unix socket path, or None."""
    if Config.DB_SOCKET:
        return Config.DB_SOCKET
    for path in _SOCKET_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


def _make_pool_kwargs() -> dict:
    """Build connection pool kwargs, preferring Unix socket on Linux."""
    base = dict(
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=Config.DB_NAME,
        charset="utf8mb4",
        autocommit=True,
    )
    # If host is 'localhost', try Unix socket first (avoids TCP refusal on Linux)
    if Config.DB_HOST == "localhost":
        sock = _detect_socket()
        if sock:
            base["unix_socket"] = sock
            return base
    # Otherwise use TCP
    base["host"] = Config.DB_HOST
    base["port"] = Config.DB_PORT
    return base


def get_pool():
    global _pool
    if _pool is None:
        kwargs = _make_pool_kwargs()
        _pool = pooling.MySQLConnectionPool(
            pool_name="classicmodels_pool",
            pool_size=5,
            **kwargs,
        )
    return _pool


def query(sql: str, params: tuple = (), fetch_one: bool = False):
    """Execute a SELECT and return list of dicts (or single dict)."""
    pool = get_pool()
    conn = pool.get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(sql, params)
        result = cursor.fetchone() if fetch_one else cursor.fetchall()
        return result
    finally:
        cursor.close()
        conn.close()
