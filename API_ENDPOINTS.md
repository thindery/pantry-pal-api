# Pantry Pal API - Quick Reference Guide

> Pocket reference for all API endpoints. Detailed docs in [API.md](./API.md)

---

## Authentication

```http
Authorization: Bearer <clerk_jwt_token>
```

All endpoints require auth except `GET /api/receipts/health`

---

## Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/items?category={cat}` | List all items |
| GET | `/api/items/:id` | Get single item |
| POST | `/api/items` | Create item |
| PUT | `/api/items/:id` | Update item |
| DELETE | `/api/items/:id` | Delete item |
| GET | `/api/items/categories` | List categories |

### Create/Update Item Body
```json
{
  "name": "Apple",
  "quantity": 5,
  "unit": "pieces",
  "category": "produce",
  "barcode": "012345678901"  // optional
}
```

---

## Receipt Scanning

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/receipts/scan` | Scan receipt image |
| GET | `/api/receipts/health` | OCR health check (no auth) |

### Scan Request
```json
{
  "image": "base64EncodedImageString..."
}
```

### Scan Response
```json
{
  "items": [
    {
      "name": "Milk",
      "quantity": 1,
      "unit": "gallon",
      "category": "dairy",
      "price": 3.99,
      "confidence": 92
    }
  ],
  "store": "Walmart",
  "total": 15.47,
  "confidence": 90
}
```

---

## Admin Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard?period=7d` | Dashboard metrics (7d/30d/90d) |
| GET | `/api/admin/transactions?limit=10&cursor=xxx` | Transaction history |
| GET | `/api/admin/alerts` | Failed payment alerts |

### Dashboard Response Highlights
```json
{
  "users": { "total": 1234, "growth": 15.5 },
  "products": { "total": 5678, "byCategory": {...} },
  "revenue": { "lifetime": 4567800, "momGrowth": 23.4 },
  "logins": { "dau": 450 },
  "failedPayments": { "count": 5, "recent": [...] }
}
```

---

## Activities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activities?itemId=xxx&limit=20` | Activity history |
| POST | `/api/activities` | Log activity |

### Log Activity Body
```json
{
  "itemId": "uuid",
  "type": "ADD|REMOVE|ADJUST",
  "amount": 5,
  "source": "MANUAL|RECEIPT_SCAN|VISUAL_USAGE"
}
```

---

## Barcode Lookup

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/barcode/:barcode` | Look up product info |

---

## Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscription` | Get subscription status |
| POST | `/api/subscription/checkout` | Create checkout session |
| POST | `/api/subscription/cancel` | Cancel subscription |
| POST | `/api/subscription/reactivate` | Reactivate subscription |

### Checkout Request
```json
{
  "tier": "pro|family",
  "interval": "month|year"
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |

---

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {...}
  },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

---

## Common Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| UNAUTHORIZED | 401 | Invalid/missing token |
| VALIDATION_ERROR | 400 | Request validation failed |
| NOT_FOUND | 404 | Resource not found |
| INTERNAL_ERROR | 500 | Server error |
| OCR_ERROR | 500 | Receipt scan failed |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| General | 100/min |
| Receipt scan | 10/min |
| Barcode | 30/min |

---

## Base URLs

```
Dev:  http://localhost:3000/api
Prod: https://api.pantrypal.dev/api
```

---

## Quick cURL Examples

### Create Item
```bash
curl -X POST http://localhost:3000/api/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Apple","quantity":5,"unit":"pieces","category":"produce"}'
```

### Scan Receipt
```bash
curl -X POST http://localhost:3000/api/receipts/scan \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"image":"base64encoded..."}'
```

### Get Dashboard
```bash
curl "http://localhost:3000/api/admin/dashboard?period=7d" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
