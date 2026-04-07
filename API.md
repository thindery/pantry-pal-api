# Pantry Pal API Documentation

Complete API reference for the Pantry Tracker backend.

## Base URL

```
Development: http://localhost:3000/api
Production: https://api.pantrypal.dev/api
```

## Authentication

All endpoints except health checks require authentication via Clerk JWT token.

**Header:** `Authorization: Bearer <clerk_jwt_token>`

The API uses Clerk for authentication. Include your Clerk session token in the Authorization header.

### Auth Errors

| Status | Code | Description |
|--------|------|-------------|
| 401 | UNAUTHORIZED | Missing or invalid token |
| 401 | UNAUTHORIZED | Token expired |

---

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

---

## Items Endpoints

### GET /api/items

Get all pantry items for the authenticated user.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| category | string | No | Filter by category |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Apple",
      "quantity": 5,
      "unit": "pieces",
      "category": "produce",
      "lastUpdated": "2024-01-15T10:30:00Z",
      "userId": "user_xxx"
    }
  ],
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

---

### GET /api/items/:id

Get a specific item by ID.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Item UUID |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Apple",
    "quantity": 5,
    "unit": "pieces",
    "category": "produce",
    "lastUpdated": "2024-01-15T10:30:00Z",
    "userId": "user_xxx"
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid UUID format |
| 404 | NOT_FOUND | Item not found |

---

### POST /api/items

Create a new pantry item.

**Request Body:**

```json
{
  "name": "Apple",
  "quantity": 5,
  "unit": "pieces",
  "category": "produce",
  "barcode": "012345678901"  // optional
}
```

**Validation Rules:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | Yes | 1-100 characters |
| quantity | number | Yes | 0-999999, non-negative |
| unit | string | Yes | 1-20 characters |
| category | string | Yes | 1-50 characters |
| barcode | string | No | max 50 characters |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Apple",
    "quantity": 5,
    "unit": "pieces",
    "category": "produce",
    "lastUpdated": "2024-01-15T10:30:00Z",
    "userId": "user_xxx"
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid request data |
| 500 | INTERNAL_ERROR | Database error |

---

### PUT /api/items/:id

Update an existing item.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Item UUID |

**Request Body:**

```json
{
  "name": "Red Apple",      // optional
  "quantity": 10,            // optional
  "unit": "lbs",             // optional
  "category": "produce"      // optional
}
```

**Note:** At least one field must be provided for update.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Red Apple",
    "quantity": 10,
    "unit": "lbs",
    "category": "produce",
    "lastUpdated": "2024-01-15T10:35:00Z",
    "userId": "user_xxx"
  },
  "meta": { "timestamp": "2024-01-15T10:35:00Z" }
}
```

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid UUID or data |
| 404 | NOT_FOUND | Item not found |

---

### DELETE /api/items/:id

Delete an item from the pantry.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Item UUID |

**Response:**

```json
{
  "success": true,
  "data": { "deleted": true },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid UUID format |
| 404 | NOT_FOUND | Item not found |

---

### GET /api/items/categories

Get all unique categories for the user.

**Response:**

```json
{
  "success": true,
  "data": ["produce", "dairy", "pantry", "meat"],
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

---

## Receipt Scanning Endpoints

### POST /api/receipts/scan

Scan a receipt image using Tesseract.js OCR to extract items.

**Request Body:**

```json
{
  "image": "iVBORw0KGgoAAAANSUhEUgAA..."  // base64 encoded image
}
```

**Validation Rules:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| image | string | Yes | Base64 encoded receipt image |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "name": "Milk",
        "quantity": 1,
        "unit": "gallon",
        "category": "dairy",
        "price": 3.99,
        "confidence": 92
      },
      {
        "name": "Bananas",
        "quantity": 6,
        "unit": "units",
        "category": "produce",
        "price": 1.29,
        "confidence": 88
      }
    ],
    "store": "Walmart",
    "total": 15.47,
    "confidence": 90
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "ocrEngine": "tesseract.js",
    "processingTimeMs": 2450,
    "rawLength": 456
  }
}
```

**Auto-detected Categories:**
- `produce` - Fruits, vegetables
- `dairy` - Milk, cheese, eggs
- `meat` - Chicken, beef, pork
- `frozen` - Frozen foods, ice cream
- `beverages` - Water, soda, juice
- `pantry` - Pasta, rice, bread
- `snacks` - Chips, crackers, candy
- `other` - Default fallback

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Missing or invalid image |
| 500 | OCR_ERROR | OCR processing failed |

---

### GET /api/receipts/health

Health check for the receipt scanning service.

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "ocrEngine": "tesseract.js",
    "supportedLanguages": ["eng"]
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

**Note:** This endpoint does not require authentication.

---

## Admin Endpoints

**Note:** All admin endpoints require authentication and should be restricted to admin users at the middleware/application level.

### GET /api/admin/dashboard

Get comprehensive dashboard metrics for admin reporting.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| period | string | No | 7d | Time period: `7d`, `30d`, or `90d` |

**Response:**

```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1234,
      "growth": 15.5,
      "sparkline": [10, 12, 15, 14, 18, 20, 22]
    },
    "products": {
      "total": 5678,
      "byCategory": {
        "produce": 1200,
        "dairy": 800,
        "pantry": 2100,
        "meat": 500,
        "frozen": 350,
        "beverages": 400,
        "snacks": 328
      }
    },
    "revenue": {
      "lifetime": 4567800,
      "momGrowth": 23.4,
      "trend": [50000, 55000, 60000, 58000, 65000, 70000, 75000]
    },
    "logins": {
      "dau": 450,
      "sparkline": [400, 420, 415, 432, 445, 450, 460]
    },
    "transactions": [
      {
        "id": "txn_xxx",
        "userId": "user_xxx",
        "amountCents": 999,
        "currency": "usd",
        "status": "succeeded",
        "tier": "pro",
        "billingInterval": "month",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "failedPayments": {
      "count": 5,
      "recent": [
        {
          "id": "txn_failed",
          "userId": "user_xxx",
          "amountCents": 999,
          "failureCode": "card_declined",
          "failureMessage": "Your card was declined",
          "createdAt": "2024-01-14T15:30:00Z"
        }
      ]
    }
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

**Metrics Description:**

| Field | Type | Description |
|-------|------|-------------|
| users.total | number | Total registered users |
| users.growth | number | Percentage growth vs previous period |
| users.sparkline | number[] | Daily new user counts |
| products.total | number | Total items across all users |
| products.byCategory | object | Item counts by category |
| revenue.lifetime | number | Total revenue in cents |
| revenue.momGrowth | number | Month-over-month growth % |
| revenue.trend | number[] | Daily revenue for period |
| logins.dau | number | Daily active users |
| logins.sparkline | number[] | Daily unique login counts |
| transactions | array | Recent transactions (max 10) |
| failedPayments.count | number | Failed payments in last 7 days |
| failedPayments.recent | array | Recent failed payments (max 10) |

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 500 | INTERNAL_ERROR | Database error |

---

### GET /api/admin/transactions

Get paginated transaction history.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | number | No | 10 | Items per page (max 100) |
| cursor | string | No | - | Pagination cursor for next page |

**Response:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "txn_xxx",
        "userId": "user_xxx",
        "stripeCustomerId": "cus_xxx",
        "stripeSubscriptionId": "sub_xxx",
        "stripeInvoiceId": "in_xxx",
        "amountCents": 999,
        "currency": "usd",
        "status": "succeeded",
        "tier": "pro",
        "billingInterval": "month",
        "failureCode": null,
        "failureMessage": null,
        "createdAt": "2024-01-15T10:30:00Z",
        "stripeEventId": "evt_xxx"
      }
    ],
    "nextCursor": "2024-01-10T10:30:00Z"
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

**Transaction Status Values:**
- `succeeded` - Payment successful
- `failed` - Payment failed
- `pending` - Payment processing
- `refunded` - Payment refunded

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 500 | INTERNAL_ERROR | Database error |

---

### GET /api/admin/alerts

Get failed payment alerts and system warnings.

**Response:**

```json
{
  "success": true,
  "data": {
    "count": 5,
    "recent": [
      {
        "id": "txn_failed",
        "userId": "user_xxx",
        "amountCents": 999,
        "failureCode": "card_declined",
        "failureMessage": "Your card was declined",
        "createdAt": "2024-01-14T15:30:00Z"
      }
    ]
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

**Common Failure Codes:**

| Code | Description |
|------|-------------|
| card_declined | Card was declined by issuer |
| insufficient_funds | Card has insufficient funds |
| expired_card | Card has expired |
| incorrect_cvc | CVC verification failed |
| processing_error | Generic processing error |

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 500 | INTERNAL_ERROR | Database error |

---

## Activities Endpoints

### GET /api/activities

Get activity history for the authenticated user.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| itemId | UUID | No | Filter by specific item |
| limit | number | No | Max items to return (default: 20) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "itemId": "550e8400-e29b-41d4-a716-446655440001",
      "itemName": "Apple",
      "type": "ADD",
      "amount": 5,
      "timestamp": "2024-01-15T10:30:00Z",
      "source": "RECEIPT_SCAN",
      "userId": "user_xxx"
    }
  ],
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

---

### POST /api/activities

Log a new activity.

**Request Body:**

```json
{
  "itemId": "550e8400-e29b-41d4-a716-446655440001",
  "type": "ADD",
  "amount": 5,
  "source": "MANUAL"
}
```

**Activity Types:**
- `ADD` - Added items to pantry
- `REMOVE` - Removed items from pantry  
- `ADJUST` - Adjusted item quantity

**Activity Sources:**
- `MANUAL` - User manually logged
- `RECEIPT_SCAN` - Added via receipt scanning
- `VISUAL_USAGE` - Detected via vision system

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "itemId": "550e8400-e29b-41d4-a716-446655440001",
    "itemName": "Apple",
    "type": "ADD",
    "amount": 5,
    "timestamp": "2024-01-15T10:30:00Z",
    "source": "MANUAL",
    "userId": "user_xxx"
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

---

## Barcode Endpoints

### GET /api/barcode/:barcode

Look up product information by barcode (UPC/EAN).

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| barcode | string | Yes | Barcode number |

**Response (Cached):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "cached": true,
    "product": {
      "barcode": "012345678901",
      "name": "Organic Apples",
      "brand": "Nature's Best",
      "category": "produce",
      "imageUrl": "https://...",
      "ingredients": "Apples",
      "nutrition": { "calories": 95, "sugar": 19 },
      "source": "openfoodfacts",
      "infoLastSynced": "2024-01-15T10:30:00Z"
    }
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

**Response (Not Found):**

```json
{
  "success": true,
  "data": {
    "success": false,
    "cached": false,
    "error": "Product not found"
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

---

## Subscription Endpoints

### GET /api/subscription

Get current user's subscription status.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "sub_xxx",
    "userId": "user_xxx",
    "tier": "pro",
    "status": "active",
    "currentPeriodStart": "2024-01-01T00:00:00Z",
    "currentPeriodEnd": "2024-02-01T00:00:00Z",
    "cancelAtPeriodEnd": false,
    "stripeCustomerId": "cus_xxx",
    "stripeSubscriptionId": "sub_xxx",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

**Tier Levels:**
- `free` - Limited features
- `pro` - Full features
- `family` - Multiple users

---

### POST /api/subscription/checkout

Create a Stripe checkout session for subscription upgrade.

**Request Body:**

```json
{
  "tier": "pro",
  "interval": "month"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://checkout.stripe.com/..."
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

---

### POST /api/subscription/cancel

Cancel the current subscription at period end.

**Response:**

```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_xxx",
      "status": "active",
      "cancelAtPeriodEnd": true
    },
    "message": "Subscription will cancel at period end"
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

---

### POST /api/subscription/reactivate

Reactivate a subscription scheduled for cancellation.

**Response:**

```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_xxx",
      "status": "active",
      "cancelAtPeriodEnd": false
    },
    "message": "Subscription has been reactivated"
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

---

## Error Codes Reference

| Code | Description | HTTP Status |
|------|-------------|-------------|
| UNAUTHORIZED | Authentication required or invalid token | 401 |
| VALIDATION_ERROR | Request validation failed | 400 |
| NOT_FOUND | Resource not found | 404 |
| INTERNAL_ERROR | Internal server error | 500 |
| OCR_ERROR | Receipt scanning failed | 500 |
| STRIPE_ERROR | Payment processing error | 500 |
| RATE_LIMITED | Too many requests | 429 |
| FORBIDDEN | Insufficient permissions | 403 |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| General API | 100 requests/minute |
| Receipt Scanning | 10 requests/minute |
| Barcode Lookup | 30 requests/minute |

---

## Pagination

For paginated endpoints, use cursor-based pagination:

1. Make initial request without cursor
2. Check `nextCursor` in response data
3. Include cursor in next request: `?cursor=<nextCursor>`

---

## Changelog

### 2024-01-15
- Added receipt scanning endpoints
- Added admin dashboard endpoints
- Added OCR service documentation

### 2024-01-10
- Initial API documentation
- Items CRUD endpoints
- Activity tracking
- Subscription management
