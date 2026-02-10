import { Request, Response, NextFunction } from 'express';
import { TIER_LIMITS, UserTier } from '../models/subscription';
declare global {
    namespace Express {
        interface Request {
            userTier?: UserTier;
            tierInfo?: {
                tier: UserTier;
                limits: typeof TIER_LIMITS.free;
            };
        }
    }
}
export declare function requireTier(minimumTier: UserTier): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function checkItemLimit(req: Request, res: Response, next: NextFunction): void;
export declare function trackReceiptScan(req: Request, res: Response, next: NextFunction): void;
export declare function checkVoiceAssistantAccess(req: Request, res: Response, next: NextFunction): void;
export declare function trackVoiceSession(userId: string): void;
//# sourceMappingURL=tierCheck.d.ts.map