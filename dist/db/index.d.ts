import { DatabaseAdapter } from './adapter';
export declare function getAdapter(): DatabaseAdapter;
export declare function getDatabase(): DatabaseAdapter;
export declare function closeDatabase(): void;
export type { DatabaseAdapter } from './adapter';
export type { PantryItem, Activity, ActivityType, ActivitySource, ScanResult, UsageResult, } from '../models/types';
export type { CreateItemInput, UpdateItemInput, CreateSessionInput, } from './adapter';
export type { ShoppingSession, ShoppingSessionWithItems, SessionItem, ShoppingSessionStatus, } from '../models/shoppingSession';
//# sourceMappingURL=index.d.ts.map