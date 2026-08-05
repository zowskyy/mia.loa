use once_cell::sync::Lazy;
use rusqlite::Connection;
use std::sync::Mutex;

static DB: Lazy<Mutex<Option<Connection>>> = Lazy::new(|| Mutex::new(None));

pub fn init(path: &str) -> Result<(), String> {
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS kv_store (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS app_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT DEFAULT (datetime('now')),
            data TEXT NOT NULL
        );
        ",
    )
    .map_err(|e| e.to_string())?;
    *DB.lock().map_err(|e| e.to_string())? = Some(conn);
    Ok(())
}

pub fn get(key: &str) -> Result<Option<String>, String> {
    let guard = DB.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not initialized")?;
    let mut stmt = conn
        .prepare("SELECT value FROM kv_store WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    match stmt.query_row([key], |row| row.get(0)) {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn set(key: &str, value: &str) -> Result<(), String> {
    let guard = DB.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not initialized")?;
    conn.execute(
        "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?1, ?2)",
        [key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
