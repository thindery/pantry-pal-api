"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrationsSQLite = runMigrationsSQLite;
exports.runMigrationsPostgres = runMigrationsPostgres;
exports.runMigrations = runMigrations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const pg_1 = require("pg");
const DB_TYPE = process.env.DB_TYPE || 'sqlite';
const DB_PATH = process.env.DB_PATH || './data/pantry.db';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'pantry_pal';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_SSL = process.env.DB_SSL === 'true';
function initMigrationsTableSQLite(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);
}
function getAppliedMigrationsSQLite(db) {
    const stmt = db.prepare('SELECT filename FROM migrations ORDER BY id');
    const rows = stmt.all();
    return rows.map((r) => r.filename);
}
function recordMigrationSQLite(db, filename) {
    const stmt = db.prepare('INSERT INTO migrations (filename, applied_at) VALUES (?, ?)');
    stmt.run(filename, new Date().toISOString());
}
function runMigrationSQLite(db, filepath) {
    const sql = fs_1.default.readFileSync(filepath, 'utf-8');
    db.exec(sql);
}
async function getAppliedMigrationsPostgres(pool) {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
    const result = await pool.query('SELECT filename FROM migrations ORDER BY id');
    return result.rows.map((r) => r.filename);
}
async function recordMigrationPostgres(pool, filename) {
    await pool.query('INSERT INTO migrations (filename, applied_at) VALUES ($1, $2)', [filename, new Date().toISOString()]);
}
async function runMigrationPostgres(pool, filepath) {
    const sql = fs_1.default.readFileSync(filepath, 'utf-8');
    await pool.query(sql);
}
function getMigrationFiles(migrationsDir) {
    if (!fs_1.default.existsSync(migrationsDir)) {
        return [];
    }
    return fs_1.default
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
}
async function runMigrationsSQLite(dbPath = DB_PATH) {
    const dataDir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    const db = new better_sqlite3_1.default(dbPath);
    try {
        db.pragma('foreign_keys = ON');
        initMigrationsTableSQLite(db);
        const applied = getAppliedMigrationsSQLite(db);
        const migrationsDir = path_1.default.join(__dirname, 'migrations');
        const migrationFiles = getMigrationFiles(migrationsDir);
        for (const filename of migrationFiles) {
            if (applied.includes(filename)) {
                console.log(`[MIGRATION] Skipping ${filename} (already applied)`);
                continue;
            }
            console.log(`[MIGRATION] Applying ${filename}...`);
            const filepath = path_1.default.join(migrationsDir, filename);
            runMigrationSQLite(db, filepath);
            recordMigrationSQLite(db, filename);
            console.log(`[MIGRATION] Applied ${filename}`);
        }
        console.log('[MIGRATION] All migrations completed successfully');
    }
    catch (error) {
        console.error('[MIGRATION] Migration failed:', error);
        throw error;
    }
    finally {
        db.close();
    }
}
async function runMigrationsPostgres() {
    const pool = new pg_1.Pool({
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASSWORD,
        ssl: DB_SSL ? { rejectUnauthorized: false } : false,
    });
    try {
        const applied = await getAppliedMigrationsPostgres(pool);
        const migrationsDir = path_1.default.join(__dirname, 'migrations');
        const migrationFiles = getMigrationFiles(migrationsDir);
        for (const filename of migrationFiles) {
            if (applied.includes(filename)) {
                console.log(`[MIGRATION] Skipping ${filename} (already applied)`);
                continue;
            }
            console.log(`[MIGRATION] Applying ${filename}...`);
            const filepath = path_1.default.join(migrationsDir, filename);
            await runMigrationPostgres(pool, filepath);
            await recordMigrationPostgres(pool, filename);
            console.log(`[MIGRATION] Applied ${filename}`);
        }
        console.log('[MIGRATION] All migrations completed successfully');
    }
    catch (error) {
        console.error('[MIGRATION] Migration failed:', error);
        throw error;
    }
    finally {
        await pool.end();
    }
}
function runMigrations(dbPath) {
    if (DB_TYPE === 'postgres') {
        return runMigrationsPostgres();
    }
    return runMigrationsSQLite(dbPath || DB_PATH);
}
if (require.main === module) {
    console.log('[MIGRATION] Starting...');
    const result = runMigrations();
    if (result instanceof Promise) {
        result
            .then(() => {
            console.log('[MIGRATION] Done');
            process.exit(0);
        })
            .catch((err) => {
            console.error('[MIGRATION] Failed:', err);
            process.exit(1);
        });
    }
    else {
        console.log('[MIGRATION] Done');
        process.exit(0);
    }
}
//# sourceMappingURL=migrate.js.map