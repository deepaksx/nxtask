import dotenv from 'dotenv';
dotenv.config();

let db;
let isPostgres = false;

// Unified query interface
async function query(sql, params = []) {
  if (isPostgres) {
    const result = await db.query(sql, params);
    return result.rows;
  } else {
    // Convert PostgreSQL $1, $2 placeholders to SQLite ?
    let sqliteSql = sql;
    let paramIndex = 1;
    while (sqliteSql.includes(`$${paramIndex}`)) {
      sqliteSql = sqliteSql.replace(`$${paramIndex}`, '?');
      paramIndex++;
    }
    // Convert ILIKE to LIKE for SQLite (SQLite LIKE is case-insensitive for ASCII)
    sqliteSql = sqliteSql.replace(/ILIKE/gi, 'LIKE');
    // Convert CURRENT_TIMESTAMP to datetime('now') for SQLite in some contexts
    // (SQLite supports CURRENT_TIMESTAMP in DEFAULT, but we'll keep it for compatibility)

    const stmt = db.prepare(sqliteSql);

    // Determine if this is a SELECT or a modification query
    const trimmedSql = sqliteSql.trim().toUpperCase();
    if (trimmedSql.startsWith('SELECT')) {
      return stmt.all(...params);
    } else if (trimmedSql.startsWith('INSERT')) {
      const result = stmt.run(...params);
      // For INSERT RETURNING, we need to fetch the inserted row
      if (sql.toUpperCase().includes('RETURNING')) {
        const returningMatch = sql.match(/RETURNING\s+(.+)$/i);
        if (returningMatch) {
          const columns = returningMatch[1].trim();
          const tableName = sql.match(/INSERT\s+INTO\s+(\w+)/i)?.[1];
          if (tableName) {
            const fetchSql = `SELECT ${columns} FROM ${tableName} WHERE id = ?`;
            return db.prepare(fetchSql).all(result.lastInsertRowid);
          }
        }
      }
      return [{ id: result.lastInsertRowid, changes: result.changes }];
    } else {
      const result = stmt.run(...params);
      return [{ changes: result.changes }];
    }
  }
}

// Run a single query that returns one row
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Check if we should use PostgreSQL or SQLite
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgresql')) {
  // PostgreSQL for production
  isPostgres = true;
  const pg = await import('pg');
  const { Pool, types } = pg.default;

  // Configure pg to return DATE columns as strings (YYYY-MM-DD) instead of Date objects
  // OID 1082 = DATE type in PostgreSQL
  types.setTypeParser(1082, (val) => val);

  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  db.query('SELECT NOW()', (err) => {
    if (err) {
      console.error('PostgreSQL connection error:', err.message);
    } else {
      console.log('Connected to PostgreSQL database');
    }
  });
} else {
  // SQLite for local development
  const Database = (await import('better-sqlite3')).default;
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dbPath = path.join(__dirname, '..', 'database', 'nxtask.db');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  console.log('Connected to SQLite database');
}

export { isPostgres, query, queryOne };
export default db;
