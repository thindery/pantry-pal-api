import Database from 'better-sqlite3';
import { UserSubscription, UsageLimits, UserTier } from '../models/subscription';
export { UserTier };
export declare function initializeSubscriptionSchema(db: Database.Database): void;
export declare function getOrCreateUserSubscription(userId: string): UserSubscription;
export declare function getUserSubscription(userId: string): UserSubscription | null;
export declare function updateUserSubscription(userId: string, updates: Partial<Omit<UserSubscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): UserSubscription | null;
export declare function downgradeToFree(userId: string): UserSubscription | null;
export declare function getOrCreateUsageLimits(userId: string): UsageLimits;
export declare function incrementUsage(userId: string, type: 'receiptScans' | 'aiCalls' | 'voiceSessions'): UsageLimits;
export declare function getUsageLimits(userId: string): UsageLimits;
export declare function canAddItems(userId: string, currentItemCount: number): {
    allowed: boolean;
    remaining: number;
};
export declare function canScanReceipt(userId: string): {
    allowed: boolean;
    remaining: number;
};
export declare function canUseAI(userId: string): {
    allowed: boolean;
    remaining: number;
};
export declare function canUseVoiceAssistant(userId: string): boolean;
export declare function hasMultiDevice(userId: string): boolean;
export declare function hasSharedInventory(userId: string): boolean;
export declare function getUserTierInfo(userId: string, currentItemCount: number): {
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
};
export declare function migrateExistingUsersToFreeTier(): void;
//# sourceMappingURL=subscription.d.ts.map