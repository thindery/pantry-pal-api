import type Database from 'better-sqlite3';
import { UserSubscription, UsageLimits, UserTier } from '../models/subscription';
export { UserTier };
export declare function initializeSubscriptionSchema(db: Database.Database): void;
export declare function getOrCreateUserSubscription(userId: string): Promise<UserSubscription>;
export declare function getUserSubscription(userId: string): Promise<UserSubscription | null>;
export declare function updateUserSubscription(userId: string, updates: Partial<Omit<UserSubscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<UserSubscription | null>;
export declare function downgradeToFree(userId: string): Promise<UserSubscription | null>;
export declare function getOrCreateUsageLimits(userId: string): Promise<UsageLimits>;
export declare function incrementUsage(userId: string, type: 'receiptScans' | 'aiCalls' | 'voiceSessions'): Promise<UsageLimits>;
export declare function getUsageLimits(userId: string): Promise<UsageLimits>;
export declare function canAddItems(userId: string, currentItemCount: number): Promise<{
    allowed: boolean;
    remaining: number;
}>;
export declare function canScanReceipt(userId: string): Promise<{
    allowed: boolean;
    remaining: number;
}>;
export declare function canUseAI(userId: string): Promise<{
    allowed: boolean;
    remaining: number;
}>;
export declare function canUseVoiceAssistant(userId: string): Promise<boolean>;
export declare function hasMultiDevice(userId: string): Promise<boolean>;
export declare function hasSharedInventory(userId: string): Promise<boolean>;
export declare function getUserTierInfo(userId: string, currentItemCount: number): Promise<{
    tier: UserTier;
    limits: {
        maxItems: number;
        receiptScansPerMonth: number;
        aiCallsPerMonth: number;
        voiceAssistant: boolean;
        multiDevice: boolean;
        sharedInventory: boolean;
        maxFamilyMembers: number;
    };
    usage: {
        currentItems: number;
        receiptScansThisMonth: number;
        aiCallsThisMonth: number;
        voiceSessionsThisMonth: number;
    };
    subscription: {
        status: import("../models/subscription").SubscriptionStatus | null;
        stripeCustomerId: string;
        stripeSubscriptionId: string | null;
        subscriptionEndDate: string | null;
    } | null;
}>;
export declare function migrateExistingUsersToFreeTier(): Promise<void>;
//# sourceMappingURL=subscription.d.ts.map