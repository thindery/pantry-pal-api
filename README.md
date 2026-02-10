# Pantry Tracker API

A production-ready pantry inventory management backend API built with Node.js, Express, TypeScript, and PostgreSQL/SQLite dual-database support. Features include receipt scanning integration, visual usage detection, user authentication, subscription management, and a complete RESTful API for inventory management.

## Features

- **Complete CRUD Operations**: Manage pantry items with full REST API
- **Activity Logging**: Track additions, removals, and adjustments with audit trail
- **Receipt Scanning**: Parse shopping receipts and auto-import items
- **Visual Usage Detection**: AI-powered consumption tracking
- **TypeScript**: Full type safety across the codebase
- **SQLite**: Fast, embedded database with WAL mode
- **Zod Validation**: Runtime request validation
- **Production-Ready**: Security headers, CORS, graceful shutdown handlers

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL (production) / SQLite (local dev via better-sqlite3)
- **Authentication**: Clerk
- **Payments**: Stripe
- **Validation**: Zod
- **Security**: Helmet, CORS
- **UUID Generation**: uuid

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Docker (optional, for local PostgreSQL)

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Local PostgreSQL Development (Recommended)

```bash
# Start PostgreSQL in Docker
npm run db:up

# Run migrations
npm run db:migrate

# Start development server
npm run dev:postgres
```

The API will be available at `http://localhost:3001`

### Local SQLite Development

```bash
# Start development server with SQLite (no Docker required)
npm run dev:sqlite

# Or simply (SQLite is default)
npm run dev
```

### Production Build

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Database Seeding

```bash
# Seed with sample data
npm run seed
```

### Production Build

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Database Seeding

```bash
# Seed database with sample data
npm run seed
```

## API Documentation

### Base URL

```
http://localhost:3000/api
```

### Response Format

All responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Item with ID xyz not found"
  },
  "meta": { ... }
}
```

## Endpoints

### Pantry Items

#### List All Items
```http
GET /api/items
```

Query Parameters:
- `category` (optional): Filter by category

#### Get Single Item
```http
GET /api/items/:id
```

#### Create Item
```http
POST /api/items
```

Request Body:
```json
{
  "name": "Organic Bananas",
  "quantity": 6,
  "unit": "pieces",
  "category": "produce"
}
```

#### Update Item
```http
PUT /api/items/:id
```

Request Body (only changed fields required):
```json
{
  "quantity": 8
}
```

#### Delete Item
```http
DELETE /api/items/:id
```

#### Get Categories
```http
GET /api/items/categories
```

### Activities

#### List Activities
```http
GET /api/activities
```

Query Parameters:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `itemId` (optional): Filter by specific item

#### Log Activity
```http
POST /api/activities
```

Request Body:
```json
{
  "itemId": "uuid-here",
  "type": "ADD",
  "amount": 5,
  "source": "MANUAL"
}
```

Activity Types: `ADD`, `REMOVE`, `ADJUST`  
Sources: `MANUAL`, `RECEIPT_SCAN`, `VISUAL_USAGE`

### Scan & Detection

#### Scan Receipt
```http
POST /api/scan-receipt
```

Request Body (structured):
```json
{
  "scanData": [
    { "name": "Milk", "quantity": 1, "unit": "gallon", "category": "dairy" }
  ]
}
```

Request Body (raw text):
```json
{
  "scanData": "Milk $3.99\nBread $2.49\nEggs $4.99"
}
```

#### Scan & Import Receipt
```http
POST /api/scan-receipt/import
```

Automatically creates items (if new) and logs ADD activities.

#### Visual Usage Detection
```http
POST /api/visual-usage
```

Request Body:
```json
{
  "detections": [
    { "name": "eggs", "quantityUsed": 2 }
  ],
  "detectionSource": "camera-kitchen"
}
```

#### Get Supported Visual Detection Items
```http
GET /api/visual-usage/supported-items
```

## Data Models

### PantryItem
```typescript
{
  id: string;           // UUID
  name: string;         // Display name
  quantity: number;     // Current stock amount
  unit: string;         // Measurement unit
  category: string;     // Organization category
  lastUpdated: string;  // ISO 8601 timestamp
}
```

### Activity
```typescript
{
  id: string;           // UUID
  itemId: string;       // Reference to item
  itemName: string;     // Denormalized name
  type: 'ADD' | 'REMOVE' | 'ADJUST';
  amount: number;       // Quantity changed
  timestamp: string;    // ISO 8601 timestamp
  source: 'MANUAL' | 'RECEIPT_SCAN' | 'VISUAL_USAGE';
}
```

## Database Switching Guide

The API supports both **SQLite** (local development) and **PostgreSQL** (production and local Docker).

### Switching Databases

Set the `DB_TYPE` environment variable:

```bash
# Use SQLite (default, no Docker required)
DB_TYPE=sqlite npm run dev

# Use PostgreSQL (requires Docker postgres or external DB)
DB_TYPE=postgres npm run db:up
DB_TYPE=postgres npm run db:migrate
DB_TYPE=postgres npm run dev
```

Or use the convenience scripts:
- `npm run dev:sqlite` - Run with SQLite
- `npm run dev:postgres` - Run with PostgreSQL

### Database Docker Commands

```bash
# Start PostgreSQL container
npm run db:up

# Stop PostgreSQL container
npm run db:down

# Run migrations
npm run db:migrate
```

## Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development
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

# CORS (comma-separated origins in production)
CORS_ORIGINS=https://localhost:5173

# Authentication (Clerk)
CLERK_SECRET_KEY=sk_test_...

# Stripe (for subscriptions)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

See `.env.example` for the complete list of environment variables.

## Deployment

### Railway Deployment

This API is configured for easy deployment on [Railway](https://railway.app/).

#### Steps:

1. **Create a Railway project** and add your GitHub repository
2. **Add a PostgreSQL database** from the Railway dashboard
3. **Configure environment variables** in Railway:
   - `DB_TYPE=postgres` (Railway sets DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD automatically)
   - `CLERK_SECRET_KEY` - Your Clerk secret key
   - `STRIPE_SECRET_KEY` - Your Stripe secret key
   - `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook secret
   - `CORS_ORIGINS` - Your production frontend URL
4. **Migrations run automatically** on deploy via the `db:migrate` script

#### Manual Deploy:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway link

# Deploy
railway up
```

### Other Platforms

The API can be deployed to any Node.js hosting platform that supports:
- Node.js 18+
- PostgreSQL database
- Environment variable configuration

## Testing

### Health Check
```bash
curl http://localhost:3000/health
```

### Create Item
```bash
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item", "quantity": 5, "unit": "pieces", "category": "test"}'
```

### Log Activity
```bash
curl -X POST http://localhost:3000/api/activities \
  -H "Content-Type: application/json" \
  -d '{"itemId": "<item-uuid>", "type": "ADD", "amount": 3}'
```

## Project Structure

```
pantry-tracker/
├── src/
│   ├── db.ts              # Database connection & operations
│   ├── models/
│   │   ├── types.ts       # TypeScript interfaces
│   │   └── validation.ts  # Zod validation schemas
│   ├── routes/
│   │   ├── items.ts       # Item CRUD endpoints
│   │   ├── activities.ts  # Activity logging endpoints
│   │   └── scan.ts        # Scan & detection endpoints
│   ├── db/
│   │   └── seed.ts        # Database seeding script
│   └── server.ts          # Express server setup
├── dist/                  # Compiled output
├── data/                  # SQLite database
├── package.json
├── tsconfig.json
└── .env.example
```

## Production Considerations

1. **Database**: The SQLite database is stored at `DB_PATH`. Back up this file regularly.
2. **CORS**: Set `CORS_ORIGINS` to your frontend domains in production.
3. **Port**: Use a reverse proxy (nginx) in production rather than exposing port 3000.
4. **Security**: Helmet adds security headers; review configuration for your use case.
5. **Backup**: The `data/` folder contains your SQLite database - back it up!
6. **PostgreSQL**: In production, use managed PostgreSQL (Railway, Supabase, AWS RDS, etc.).

## License

MIT