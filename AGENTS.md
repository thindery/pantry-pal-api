# PantryPal API - AGENTS.md

## Project Overview

**PantryPal API** is the backend service for the PantryPal inventory tracking system. This repo contains the REST API, database layer, authentication, and business logic. It serves the `pantry-pal` frontend React app.

## Tech Stack

### Core Technologies
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Language**: TypeScript 5.x
- **Databases**: PostgreSQL (production) / SQLite (local dev via better-sqlite3)
- **Authentication**: Clerk (@clerk/clerk-sdk-node)
- **Payments**: Stripe (subscription management)
- **Validation**: Zod (runtime request validation)
- **Security**: Helmet (security headers), CORS
- **UUID Generation**: uuid

### What This Repo Does NOT Do
- ❌ UI rendering (handled by `pantry-pal` frontend)
- ❌ Client-side state management
- ❌ Barcode scanning (camera access is frontend)
- ❌ Image preprocessing

### Development Tools
- **Testing**: Jest + Supertest
- **Build**: TypeScript compiler (tsc)
- **Dev Server**: ts-node-dev (auto-reload)
- **Database**: Docker Compose for PostgreSQL

## Project Structure

```
pantry-pal-api/
├── src/
│   ├── server.ts              # Express server setup
│   ├── db.ts                  # Database connection & operations (legacy)
│   ├── db/
│   │   ├── index.ts           # Database adapter factory
│   │   ├── sqlite.ts          # SQLite implementation
│   │   ├── postgres.ts        # PostgreSQL implementation
│   │   ├── adapter.ts         # Common database interface
│   │   ├── migrate.ts         # Migration runner
│   │   ├── seed.ts            # Database seeding
│   │   └── admin.ts           # Admin operations
│   ├── models/
│   │   ├── types.ts           # TypeScript interfaces
│   │   ├── validation.ts      # Zod schemas
│   │   └── subscription.ts    # Subscription types
│   ├── routes/
│   │   ├── items.ts           # Item CRUD endpoints
│   │   ├── activities.ts      # Activity logging
│   │   ├── scan.ts            # Visual usage detection
│   │   ├── receipts.ts        # Receipt OCR processing
│   │   ├── barcode.ts         # Barcode product lookup
│   │   ├── subscription.ts    # Tier & subscription management
│   │   ├── webhook.ts         # Stripe webhooks
│   │   ├── admin.ts           # Admin dashboard API
│   │   ├── clientErrors.ts    # Client error reporting
│   │   └── errors.ts          # Error handling
│   ├── services/
│   │   ├── stripe.ts          # Stripe integration
│   │   ├── subscription.ts    # Tier checking logic
│   │   └── receiptOcr.ts      # Tesseract OCR service
│   ├── middleware/
│   │   ├── auth.ts            # Clerk JWT verification
│   │   └── tierCheck.ts       # Subscription tier enforcement
│   └── sentry.ts              # Sentry error tracking
├── dist/                      # Compiled output
├── data/                      # SQLite database (dev only)
├── scripts/                   # Utility scripts
├── tests/                     # Jest test files
├── package.json
├── tsconfig.json
├── docker-compose.yml         # PostgreSQL container
├── .env.example               # Environment template
├── railway.toml              # Railway deployment config
└── API.md                    # Full API documentation
```

## Environment Variables

Required environment variables:

```bash
# Server
PORT=3001
NODE_ENV=development|production
USE_HTTPS=true

# Database Type: 'sqlite' or 'postgres'
DB_TYPE=postgres

# SQLite Configuration (when DB_TYPE=sqlite)
DB_PATH=./data/pantry.db

# PostgreSQL Configuration (when DB_TYPE=postgres)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pantry_pal
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

# CORS (comma-separated origins)
CORS_ORIGINS=https://localhost:5173,https://app.pantrypal.dev

# Authentication (Clerk)
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# Stripe (for subscriptions)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Key Features

### Inventory Management
- Full CRUD operations for pantry items
- User-scoped data (multi-tenant via Clerk user IDs)
- Category filtering

### Activity Ledger
- Immutable activity logging (ADD, REMOVE, ADJUST)
- Sources: MANUAL, RECEIPT_SCAN, VISUAL_USAGE
- Pagination for large histories

### Receipt Processing
- Tesseract.js OCR for receipt text extraction
- Structured data extraction
- Automatic item creation from receipts

### Barcode Lookup
- Product lookup via external APIs
- Local caching for performance
- Manual product linking

### Subscription System
- Stripe integration for payments
- Tier enforcement (Free, Pro, Family)
- Usage tracking (scans, items, voice sessions)
- Webhook handling for subscription events

### Authentication
- Clerk JWT verification on all protected routes
- User ID extraction from tokens
- Multi-device support

## Database Schema

### Core Tables

```sql
-- Items (user-scoped)
items (id, name, quantity, unit, category, lastUpdated, user_id)

-- Activity Ledger (immutable log)
activities (id, itemId, itemName, type, amount, timestamp, source, user_id)

-- Subscriptions (Stripe integration)
user_subscriptions (id, user_id, tier, stripe_customer_id, 
                    stripe_subscription_id, status, current_period_end)

-- Usage Tracking (monthly limits)
usage_limits (id, user_id, month, receipt_scans, ai_calls, voice_sessions)

-- Barcode Cache (product lookups)
barcode_cache (barcode, name, brand, category, nutrition, created_at)

-- Client Errors (error tracking)
client_errors (id, user_id, error_data, stack, user_agent, created_at)
```

## API Endpoints

### Items
- `GET /api/items` - List all items (optionally filter by category)
- `GET /api/items/:id` - Get specific item
- `POST /api/items` - Create item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item
- `GET /api/items/categories` - Get unique categories

### Activities
- `GET /api/activities` - List activities (paginated)
- `POST /api/activities` - Log activity
- `GET /api/activities/count` - Get activity count

### Receipts
- `POST /api/receipts/scan` - Scan receipt (OCR)
- `POST /api/receipts/import` - Scan and auto-import items

### Barcodes
- `GET /api/products/barcode/:code` - Lookup product by barcode
- `POST /api/products/barcode` - Add manual barcode mapping

### Visual Usage
- `POST /api/visual-usage` - Log usage from visual detection
- `GET /api/visual-usage/supported-items` - List supported items

### Subscriptions
- `GET /api/subscription/tier` - Get user's tier info
- `POST /api/subscription/checkout` - Create Stripe checkout
- `POST /api/subscription/portal` - Create customer portal
- `GET /api/subscription/prices` - Get available price IDs

### Admin
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/users` - List users
- `POST /api/admin/users/:id/tier` - Update user tier

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook handler

## Common Tasks

### Running Tests
```bash
npm test          # Run Jest
npm run test:watch  # Watch mode
npm run test:coverage
```

### Database Operations
```bash
# Start PostgreSQL (Docker)
npm run db:up

# Run migrations
npm run db:migrate

# Seed with sample data
npm run seed

# Stop PostgreSQL
npm run db:down
```

### Development
```bash
# SQLite (default, no Docker needed)
npm run dev
# or
npm run dev:sqlite

# PostgreSQL (requires Docker)
npm run dev:postgres
```

### Production Build
```bash
npm run build     # Compile TypeScript to dist/
npm start         # Run compiled server
```

## Architecture Notes

- **Dual Database**: SQLite for local dev, PostgreSQL for production
- **Database Adapter**: Abstracted via `src/db/adapter.ts`
- **Authentication**: Clerk middleware on all routes (except health checks)
- **Tier Enforcement**: `tierCheck.ts` middleware for gated features
- **Stripe Webhooks**: Signature verification required
- **CORS**: Restricted to configured origins
- **Security**: Helmet headers, no CORS for production

## Deployment

### Railway (Primary)
Configured via `railway.toml`:
- PostgreSQL provided by Railway
- Migrations run on deploy
- Environment variables set in Railway dashboard

### Manual Deploy
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link
railway login
railway link

# Deploy
railway up
```

## Related Documentation

- `README.md` - Quick start and overview
- `TESTING.md` - Testing, build, deployment guide
- `API.md` - Complete API reference
- `API_ENDPOINTS.md` - Endpoint summary
- `DEPLOY.md` - Deployment guide
- `DEPLOY-CHECKLIST.md` - Pre-deployment checklist
- `pantry-pal/AGENTS.md` - Frontend documentation

## Testing with Frontend

When running locally:
1. Start backend: `npm run dev` (port 3001)
2. Start frontend: `npm run dev` (port 5173)
3. Ensure `VITE_API_URL=http://localhost:3001` in frontend `.env.local`
4. Both must use HTTPS for camera access
