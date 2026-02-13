"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdapter = getAdapter;
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
const sqlite_1 = require("./sqlite");
const postgres_1 = require("./postgres");
const DB_TYPE = process.env.DB_TYPE || 'sqlite';
function getAdapter() {
    if (DB_TYPE === 'postgres') {
        return new postgres_1.PostgresAdapter();
    }
    return new sqlite_1.SQLiteAdapter();
}
let adapter = null;
function getDatabase() {
    if (!adapter) {
        adapter = getAdapter();
        adapter.initialize();
    }
    return adapter;
}
function closeDatabase() {
    if (adapter) {
        adapter.close();
        adapter = null;
    }
}
//# sourceMappingURL=index.js.map