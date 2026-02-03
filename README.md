# Pantry Tracker API

A production-ready pantry inventory management backend API built with Node.js, Express, TypeScript, and SQLite (via better-sqlite3). Features include receipt scanning integration, visual usage detection, and a complete RESTful API for inventory management.

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
- **Database**: SQLite (better-sqlite3)
- **Validation**: Zod
- **Security**: Helmet, CORS
- **UUID Generation**: uuid

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Development

```bash
# Start development server with hot reload
npm run dev
```

The API will be available at `http://localhost:3000`

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

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_PATH=./data/pantry.db

# CORS (comma-separated origins in production)
CORS_ORIGINS=
```

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
5. **Backup**: The `data/` folder contains your database - back it up!

## License

MIT