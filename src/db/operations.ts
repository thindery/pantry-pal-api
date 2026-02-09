/**
 * Database Operations
 * High-level CRUD operations that delegate to the appropriate adapter
 */

import { getDatabase } from './index';
import { CreateItemInput, UpdateItemInput } from './adapter';
import {
  PantryItem,
  Activity,
  ActivityType,
  ActivitySource,
  ScanResult,
  UsageResult,
} from '../models/types';

// ==========================================================================
// Pantry Item Operations
// ==========================================================================

export function getAllItems(userId: string, category?: string): Promise<PantryItem[]> {
  return getDatabase().getAllItems(userId, category);
}

export function getItemById(userId: string, id: string): Promise<PantryItem | null> {
  return getDatabase().getItemById(userId, id);
}

export function getItemByName(userId: string, name: string): Promise<PantryItem | null> {
  return getDatabase().getItemByName(userId, name);
}

export function createItem(userId: string, input: CreateItemInput): Promise<PantryItem> {
  return getDatabase().createItem(userId, input);
}

export function updateItem(userId: string, id: string, input: UpdateItemInput): Promise<PantryItem | null> {
  return getDatabase().updateItem(userId, id, input);
}

export function deleteItem(userId: string, id: string): Promise<boolean> {
  return getDatabase().deleteItem(userId, id);
}

export function adjustItemQuantity(userId: string, id: string, adjustment: number): Promise<PantryItem | null> {
  return getDatabase().adjustItemQuantity(userId, id, adjustment);
}

export function getCategories(userId: string): Promise<string[]> {
  return getDatabase().getCategories(userId);
}

// ==========================================================================
// Activity Operations
// ==========================================================================

export function getActivities(
  userId: string,
  limit?: number,
  offset?: number,
  itemId?: string
): Promise<Activity[]> {
  return getDatabase().getActivities(userId, limit, offset, itemId);
}

export function getActivityCount(userId: string, itemId?: string): Promise<number> {
  return getDatabase().getActivityCount(userId, itemId);
}

export function logActivity(
  userId: string,
  itemId: string,
  type: ActivityType,
  amount: number,
  source: ActivitySource = 'MANUAL'
): Promise<Activity | null> {
  return getDatabase().logActivity(userId, itemId, type, amount, source);
}

// ==========================================================================
// Scan Receipt Operations
// ==========================================================================

export function processReceiptScan(rawData: string | ScanResult[]): ScanResult[] {
  return getDatabase().processReceiptScan(rawData);
}

// ==========================================================================
// Visual Usage Operations
// ==========================================================================

export function processVisualUsage(
  userId: string,
  detections: UsageResult[],
  source: string = 'VISUAL_USAGE'
): Promise<{ processed: UsageResult[]; activities: Activity[]; errors: string[] }> {
  return getDatabase().processVisualUsage(userId, detections, source);
}
