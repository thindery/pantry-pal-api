# Pantry-Pal API Persistence Bug Investigation Report

## Issue Summary
When adding items via POST /api/items, the API returns success with item data, but upon refreshing the page, the data doesn't appear.

## Investigation Steps Performed

### 1. Database Layer Analysis
- **File**: `src/db/sqlite.ts`
- **Finding**: The core database operations use `better-sqlite3` which is synchronous
- **Insert Logic**: `createItem()` uses `stmt.run()` to execute INSERT statements
- **Result Check**: Original code did NOT check if `changes > 0` after INSERT

**Code Flow:**
```
POST /api/items -> createItem() -> stmt.run() -> Return constructed object
```

### 2. Database Connection Analysis
- **Configuration**: Uses `./data/pantry.db` relative path
- **WAL Mode**: Enabled (`PRAGMA journal_mode = WAL`)
- **Singleton Pattern**: Adapter is cached, should use single connection
- **Migration Flow**: Migrations run first with separate connection, then adapter creates its own

### 3. Testing Performed
#### Test 1: Direct Database Test
- Created items via `db.createItem()`
- Verified persistence with `db.getAllItems()`
- **Result**: ✓ Items persisted correctly
- **Logs**: `changes=1, lastInsertRowid=49` confirmed INSERT succeeded

#### Test 2: Database State Verification
- Direct SQLite query: `SELECT COUNT(*) FROM pantry_items` = 48 items
- Items exist for users: `legacy_user_001` (41 items), `user_39C4ic5ciXRxrOPwO5dnCJuCy7i` (7 items)
- WAL checkpointed successfully
- **Result**: ✓ Data is persisted in the database file

### 4. Middleware Analysis
- **Auth Middleware**: `requireAuth` extracts `userId` from Clerk JWT token
- **Route Protection**: All item routes use `router.use(requireAuth)`
- **Consistency**: POST and GET both use `req.userId` from the same source

### 5. Pre-existing Issues Discovered
- **TypeScript Errors**: `src/middleware/tierCheck.ts` has 16 async/await errors
  - `getOrCreateUserSubscription()` returns Promise but not awaited
  - This could cause race conditions in subscription checks
- **Note**: These errors are NOT in the persistence code path

## Current State

### Changes Made
1. Added debug logging to `createItem()`:
   - Logs: `changes` count and `lastInsertRowid`
   - Throws error if `changes === 0`

2. Added debug logging to `getAllItems()`:
   - Logs: `userId`, `category`, and `rows.length`

3. Committed and pushed to: `193bc6b`

### Database Verification
```
Total items in database: 48
Users with data: legacy_user_001 (41 items), user_39C4ic5ciXRxrOPwO5dnCJuCy7i (7 items)
File location: /Users/thindery/projects/pantry-pal-api/data/pantry.db
WAL mode: Enabled (pantry.db-wal exists)
```

## Root Cause Analysis - Likely Suspects

### Hypothesis 1: Client-Side Caching (Most Likely)
The frontend might be:
- Caching the item list and not invalidating after POST
- Displaying the created item from the POST response but not fetching fresh data
- Refreshing clears the state and the GET returns stale/cached data

**Evidence**: 
- Server-side persistence works (verified by direct DB query)
- Bug only appears "after refreshing the page"

### Hypothesis 2: Auth Token Inconsistency
If the Clerk token changes between POST and GET:
- POST stores with userId A
- GET queries with userId B (different user)
- Items appear to "disappear" because they're under a different user

**Evidence**:
- Both handlers depend on `req.userId`
- No cross-user visibility (correct)
- If token refresh happens, userId could change

### Hypothesis 3: WAL Mode Read Issue (Less Likely)
In WAL mode, if a reader connection has a long-running transaction:
- It might read from an old snapshot
- New writes in WAL aren't visible until checkpoint

**Evidence**:
- WAL file was 193KB before checkpoint
- After checkpoint, all 48 items visible
- This could explain intermittent disappearances

## Recommended Next Steps

### Immediate (Server-Side)
1. **Monitor Logs**: Run the server and observe the new debug logs during item creation:
   ```
   [DB] createItem: inserted id=xxx, changes=1, lastInsertRowid=49
   [DB] getAllItems: userId=xxx, category=all, found=N items
   ```

2. **Force WAL Checkpoint**: Add periodic or post-write checkpoint to ensure data is written to main DB:
   ```typescript
   db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
   ```

### Frontend Investigation Needed
The bug is likely in the frontend or in how the API is being called:

1. **Verify POST Response**: Confirm the POST returns 201 with the item data
2. **Check User ID Consistency**: Log the userId from the auth token on both POST and GET
3. **Clear Client Cache**: Ensure the frontend fetches fresh data after creating an item
4. **Network Tab**: Check if GET request after refresh returns the expected items

### Additional Server-Side Fix Idea
Add a verification read after create to ensure the item was actually stored:
```typescript
async createItem(...) {
  // ... insert ...
  // Verify by reading back
  const verified = await this.getItemById(userId, id);
  if (!verified) {
    throw new Error('Item creation verification failed');
  }
  return verified;  // Return verified data from DB, not constructed object
}
```

## Conclusion

**Current Status**: Database persistence layer is working correctly. The bug appears to be either:
1. Frontend/client-side caching issue (most likely)
2. Auth token/userId inconsistency between requests
3. WAL mode snapshot isolation

**Next Action**: Frontend developer should verify the userId is consistent between POST and GET requests, and check if client-side caching is preventing fresh data from being displayed.

**Commit**: `193bc6b` adds diagnostic logging to help identify the issue during actual API usage.
