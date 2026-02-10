"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const subscription_1 = require("../services/subscription");
const DB_PATH = process.env.DB_PATH || './data/pantry.db';
function initMigrationsTable(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);
}
function getAppliedMigrations(db) {
    const stmt = db.prepare('SELECT filename FROM migrations ORDER BY id');
    const rows = stmt.all();
    return rows.map((r) => r.filename);
}
function recordMigration(db, filename) {
    const stmt = db.prepare('INSERT INTO migrations (filename, applied_at) VALUES (?, ?)');
    stmt.run(filename, new Date().toISOString());
}
function runMigration(db, filepath) {
    const sql = fs_1.default.readFileSync(filepath, 'utf-8');
    db.exec(sql);
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
function runMigrations(dbPath = DB_PATH) {
    const dataDir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    const db = new better_sqlite3_1.default(dbPath);
    try {
        db.pragma('foreign_keys = ON');
        initMigrationsTable(db);
        const applied = getAppliedMigrations(db);
        const migrationsDir = path_1.default.join(__dirname, 'migrations');
        const migrationFiles = getMigrationFiles(migrationsDir);
        for (const filename of migrationFiles) {
            if (applied.includes(filename)) {
                console.log(`[MIGRATION] Skipping ${filename} (already applied)`);
                continue;
            }
            console.log(`[MIGRATION] Applying ${filename}...`);
            const filepath = path_1.default.join(migrationsDir, filename);
            runMigration(db, filepath);
            recordMigration(db, filename);
            console.log(`[MIGRATION] Applied ${filename}`);
        }
        console.log('[MIGRATION] Running TypeScript migrations...');
        (0, subscription_1.initializeSubscriptionSchema)(db);
        (0, subscription_1.migrateExistingUsersToFreeTier)();
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
if (require.main === module) {
    console.log('[MIGRATION] Starting...');
    runMigrations();
    console.log('[MIGRATION] Done');
    process.exit(0);
}
//# sourceMappingURL=migrate.js.map