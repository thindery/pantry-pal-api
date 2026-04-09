"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllItems = getAllItems;
exports.getItemById = getItemById;
exports.getItemByName = getItemByName;
exports.createItem = createItem;
exports.updateItem = updateItem;
exports.deleteItem = deleteItem;
exports.adjustItemQuantity = adjustItemQuantity;
exports.getCategories = getCategories;
exports.getActivities = getActivities;
exports.getActivityCount = getActivityCount;
exports.logActivity = logActivity;
exports.processReceiptScan = processReceiptScan;
exports.processVisualUsage = processVisualUsage;
exports.createSession = createSession;
exports.getSessionById = getSessionById;
exports.getUserSessions = getUserSessions;
exports.getSessionCount = getSessionCount;
exports.addSessionItem = addSessionItem;
exports.removeSessionItem = removeSessionItem;
exports.completeSession = completeSession;
exports.updateSessionReceipt = updateSessionReceipt;
exports.cancelSession = cancelSession;
exports.getSessionSummary = getSessionSummary;
exports.addSessionToInventory = addSessionToInventory;
const index_1 = require("./index");
function getAllItems(userId, category) {
    return (0, index_1.getDatabase)().getAllItems(userId, category);
}
function getItemById(userId, id) {
    return (0, index_1.getDatabase)().getItemById(userId, id);
}
function getItemByName(userId, name) {
    return (0, index_1.getDatabase)().getItemByName(userId, name);
}
function createItem(userId, input) {
    return (0, index_1.getDatabase)().createItem(userId, input);
}
function updateItem(userId, id, input) {
    return (0, index_1.getDatabase)().updateItem(userId, id, input);
}
function deleteItem(userId, id) {
    return (0, index_1.getDatabase)().deleteItem(userId, id);
}
function adjustItemQuantity(userId, id, adjustment) {
    return (0, index_1.getDatabase)().adjustItemQuantity(userId, id, adjustment);
}
function getCategories(userId) {
    return (0, index_1.getDatabase)().getCategories(userId);
}
function getActivities(userId, limit, offset, itemId) {
    return (0, index_1.getDatabase)().getActivities(userId, limit, offset, itemId);
}
function getActivityCount(userId, itemId) {
    return (0, index_1.getDatabase)().getActivityCount(userId, itemId);
}
function logActivity(userId, itemId, type, amount, source = 'MANUAL') {
    return (0, index_1.getDatabase)().logActivity(userId, itemId, type, amount, source);
}
function processReceiptScan(rawData) {
    return (0, index_1.getDatabase)().processReceiptScan(rawData);
}
function processVisualUsage(userId, detections, source = 'VISUAL_USAGE') {
    return (0, index_1.getDatabase)().processVisualUsage(userId, detections, source);
}
function createSession(userId, input) {
    return (0, index_1.getDatabase)().createSession(userId, input);
}
function getSessionById(userId, sessionId) {
    return (0, index_1.getDatabase)().getSessionById(userId, sessionId);
}
function getUserSessions(userId, limit, offset, status) {
    return (0, index_1.getDatabase)().getUserSessions(userId, limit, offset, status);
}
function getSessionCount(userId, status) {
    return (0, index_1.getDatabase)().getSessionCount(userId, status);
}
function addSessionItem(userId, sessionId, input) {
    return (0, index_1.getDatabase)().addSessionItem(userId, sessionId, input);
}
function removeSessionItem(userId, sessionId, itemId) {
    return (0, index_1.getDatabase)().removeSessionItem(userId, sessionId, itemId);
}
function completeSession(userId, sessionId, input) {
    return (0, index_1.getDatabase)().completeSession(userId, sessionId, input);
}
function updateSessionReceipt(userId, sessionId, receiptUrl) {
    return (0, index_1.getDatabase)().updateSessionReceipt(userId, sessionId, receiptUrl);
}
function cancelSession(userId, sessionId) {
    return (0, index_1.getDatabase)().cancelSession(userId, sessionId);
}
function getSessionSummary(userId) {
    return (0, index_1.getDatabase)().getSessionSummary(userId);
}
function addSessionToInventory(userId, sessionId) {
    return (0, index_1.getDatabase)().addSessionToInventory(userId, sessionId);
}
//# sourceMappingURL=operations.js.map