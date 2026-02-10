"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEATURE_COMPARISON = exports.TIER_PRICING = exports.TIER_LIMITS = void 0;
exports.TIER_LIMITS = {
    free: {
        maxItems: 50,
        receiptScansPerMonth: 5,
        aiCallsPerMonth: 0,
        voiceAssistant: false,
        multiDevice: false,
        sharedInventory: false,
        maxFamilyMembers: 1,
    },
    pro: {
        maxItems: Infinity,
        receiptScansPerMonth: Infinity,
        aiCallsPerMonth: Infinity,
        voiceAssistant: true,
        multiDevice: true,
        sharedInventory: false,
        maxFamilyMembers: 1,
    },
    family: {
        maxItems: Infinity,
        receiptScansPerMonth: Infinity,
        aiCallsPerMonth: Infinity,
        voiceAssistant: true,
        multiDevice: true,
        sharedInventory: true,
        maxFamilyMembers: 5,
    },
};
exports.TIER_PRICING = {
    pro: {
        monthly: 499,
        yearly: 3999,
        monthlyDisplay: '$4.99',
        yearlyDisplay: '$39.99',
    },
    family: {
        monthly: 799,
        yearly: 5999,
        monthlyDisplay: '$7.99',
        yearlyDisplay: '$59.99',
    },
};
exports.FEATURE_COMPARISON = [
    { feature: 'Pantry Items', free: '50 max', pro: 'Unlimited', family: 'Unlimited' },
    { feature: 'AI Receipt Scanning', free: '5/month', pro: 'Unlimited', family: 'Unlimited' },
    { feature: 'Voice Assistant', free: '—', pro: '✓', family: '✓' },
    { feature: 'Cloud Sync', free: '1 device', pro: 'Multi-device', family: 'Multi-device' },
    { feature: 'Household Sharing', free: '—', pro: '—', family: 'Up to 5 members' },
    { feature: 'Advanced Analytics', free: '—', pro: '✓', family: '✓' },
    { feature: 'Low Stock Alerts', free: 'Basic', pro: 'Push notifications', family: 'Push notifications' },
    { feature: 'CSV Export', free: '—', pro: '✓', family: '✓' },
    { feature: 'Priority Support', free: '—', pro: '✓', family: '✓' },
];
//# sourceMappingURL=subscription.js.map