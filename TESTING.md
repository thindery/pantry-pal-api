# Testing, Build & Deployment Guide

This guide covers how to run tests, build the project, set up ngrok for external access, and troubleshoot common issues.

---

## Table of Contents

- [Testing](#testing)
- [Building the Project](#building-the-project)
- [Running with ngrok](#running-with-ngrok)
- [Environment Variables](#environment-variables)
- [Common Troubleshooting](#common-troubleshooting)

---

## Testing

### Current Status

**⚠️ Note:** This project currently does not have automated tests configured. The test command will fail:

```bash
npm test
# Output: Error: no test specified
```

### Test Setup Roadmap

To add tests to this project, consider the following:

1. **Install testing dependencies:**
   ```bash
   npm install --save-dev jest @types/jest supertest @types/supertest ts-jest
   ```

2. **Create Jest configuration** (`jest.config.js`):
   ```javascript
   module.exports = {
     preset: 'ts-jest',
     testEnvironment: 'node',
     roots: ['<rootDir>/src'],
     testMatch: ['**/__tests__/**/*.test.ts'],
     setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
   };
   ```

3. **Update `package.json` scripts:**
   ```json
   {
     "scripts": {
       "test": "jest",
       "test:watch": "jest --watch",
       "test:coverage": "jest --coverage"
     }
   }
   ```

4. **Recommended test structure:**
   ```
   src/
   ├── __tests__/
   │   ├── setup.ts           # Test environment setup
   │   ├── items.test.ts      # Item API tests
   │   ├── activities.test.ts # Activity API tests
   │   └── scan.test.ts       # Scan endpoint tests
   ```

### Manual Testing

While automated tests are not yet available, you can manually test endpoints:

**Health Check:**
```bash
curl http://localhost:3001/health
```

**Create Item:**
```bash
curl -X POST http://localhost:3001/api/items \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item", "quantity": 5, "unit": "pieces", "category": "test"}'
```

**List Items:**
```bash
curl http://localhost:3001/api/items
```

---

## Building the Project

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- TypeScript (`npm install -g typescript`)

### Build Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Compile TypeScript:**
   ```bash
   npm run build
   ```

   This runs `tsc` and outputs compiled JavaScript to the `dist/` directory.

4. **Verify build output:**
   ```bash
   ls -la dist/
   # Should contain: server.js, db.js, routes/, models/, db/
   ```

### Production Build

For production deployment:

```bash
# Clean install (no dev dependencies)
npm ci --only=production

# Build
npm run build

# Start production server
npm start
```

### Build Troubleshooting

| Issue | Solution |
|-------|----------|
| `Cannot find module` | Run `npm install` |
| TypeScript errors | Check `tsconfig.json` settings |
| `dist/` folder missing | Ensure `tsc` compiles successfully |

---

## Running with ngrok

[ngrok](https://ngrok.com/) exposes your local server to the internet with a public URL - useful for testing webhooks, mobile apps, or sharing with teammates.

### Installation

```bash
# macOS (with Homebrew)
brew install ngrok

# Or download from https://ngrok.com/download
```

### Setup

1. **Sign up for ngrok** at https://ngrok.com and get your authtoken

2. **Configure authtoken:**
   ```bash
   ngrok config add-authtoken <your-authtoken>
   ```

### Running the API with ngrok

1. **Start your API server** (in one terminal):
   ```bash
   # With SQLite
   npm run dev:sqlite
   
   # Or with PostgreSQL
   npm run db:up
   npm run db:migrate
   npm run dev:postgres
   ```

2. **Start ngrok** (in another terminal):
   ```bash
   ngrok http 3001
   ```

3. **Get your public URL** from ngrok output:
   ```
   Forwarding: https://abc123.ngrok-free.app -> http://localhost:3001
   ```

4. **Update CORS** in your `.env`:
   ```env
   CORS_ORIGINS=https://abc123.ngrok-free.app,https://localhost:5173
   ```
   Then restart your API server.

### Using ngrok with HTTPS

If your API uses HTTPS locally (default with `USE_HTTPS=true`), use:

```bash
ngrok http https://localhost:3001
```

Or use the HTTP port:
```bash
ngrok http 3001
```

### ngrok Web Interface

View all requests at: http://localhost:4040

### Common ngrok Issues

| Issue | Solution |
|-------|----------|
| CORS errors | Add ngrok URL to `CORS_ORIGINS` |
| Webhook failures | Ensure ngrok is running and URL is current |
| Free tier limits | URLs change on restart; use paid tier for static domains |

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment mode | `development`, `production` |
| `DB_TYPE` | Database type | `sqlite` or `postgres` |

### SQLite Configuration

Used when `DB_TYPE=sqlite`:

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PATH` | SQLite database file path | `./data/pantry.db` |

### PostgreSQL Configuration

Used when `DB_TYPE=postgres`:

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `pantry_pal` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `DB_SSL` | Use SSL connection | `false` |

**Alternative:** Use `DATABASE_URL` instead of individual variables:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pantry_pal
```

### Authentication (Clerk)

Required for user authentication:

| Variable | Description |
|----------|-------------|
| `CLERK_SECRET_KEY` | Clerk secret key (starts with `sk_test_` or `sk_live_`) |

Get yours at: https://dashboard.clerk.com

### Stripe Configuration

Required for subscription/payment features:

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key (starts with `sk_test_` or `sk_live_`) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint secret |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Price ID for monthly Pro plan |
| `STRIPE_PRICE_PRO_YEARLY` | Stripe Price ID for yearly Pro plan |

Get yours at: https://dashboard.stripe.com

### CORS Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `CORS_ORIGINS` | Comma-separated allowed origins | `https://localhost:5173,https://app.example.com` |

### SSL Configuration (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_HTTPS` | Enable HTTPS | `true` |
| `SSL_CERT_PATH` | Path to SSL certificate | `./.certs/localhost+3.pem` |
| `SSL_KEY_PATH` | Path to SSL private key | `./.certs/localhost+3-key.pem` |

### Feature Flags & Limits

| Variable | Description | Default |
|----------|-------------|---------|
| `FREE_TIER_RECEIPT_SCANS` | Receipt scans for free users | `10` |
| `FREE_TIER_AI_CALLS` | AI calls for free users | `50` |
| `FREE_TIER_VOICE_SESSIONS` | Voice sessions for free users | `5` |
| `PRO_TIER_RECEIPT_SCANS` | Receipt scans for Pro users | `100` |
| `PRO_TIER_AI_CALLS` | AI calls for Pro users | `500` |
| `PRO_TIER_VOICE_SESSIONS` | Voice sessions for Pro users | `50` |

### Development Variables

| Variable | Description |
|----------|-------------|
| `SEED_USER_ID` | User ID for seeded data |

---

## Common Troubleshooting

### Database Issues

#### SQLite: `SQLITE_CANTOPEN` / Database not found
```bash
# Ensure data directory exists
mkdir -p data

# Check permissions
chmod 755 data
```

#### PostgreSQL: Connection refused
```bash
# Check if PostgreSQL is running
npm run db:up

# Verify connection settings in .env
cat .env | grep DB_

# Test connection manually
psql -h localhost -U postgres -d pantry_pal
```

#### Migration errors
```bash
# Reset database (⚠️ destroys data)
npm run db:down
npm run db:up
npm run db:migrate
npm run seed
```

### Build Issues

#### `Cannot find module '@types/...'`
```bash
# Reinstall dev dependencies
npm install
```

#### TypeScript compilation errors
```bash
# Check TypeScript version
npx tsc --version

# Run type check only
npx tsc --noEmit
```

### Runtime Issues

#### Port already in use
```bash
# Find process using port 3001
lsof -ti:3001 | xargs kill -9

# Or use a different port
PORT=3002 npm run dev
```

#### CORS errors from frontend
```bash
# Check CORS_ORIGINS includes your frontend URL
# Example for local dev with ngrok:
CORS_ORIGINS=https://abc123.ngrok-free.app,https://localhost:5173
```

#### Clerk authentication fails
1. Verify `CLERK_SECRET_KEY` is set correctly
2. Ensure key matches your environment (test vs live)
3. Check Clerk dashboard for webhook configuration

#### Stripe webhook failures
1. Verify `STRIPE_WEBHOOK_SECRET` is correct
2. When using ngrok, update webhook URL in Stripe dashboard
3. Use Stripe CLI for local webhook testing:
   ```bash
   stripe listen --forward-to localhost:3001/api/stripe/webhook
   ```

### Docker Issues

#### PostgreSQL container won't start
```bash
# Check existing containers
docker ps -a

# Remove stale containers
docker-compose down

# Start fresh
npm run db:up
```

#### Permission denied on data directory
```bash
# Fix Docker volume permissions
sudo chown -R $USER:$USER data/
```

### SSL/HTTPS Issues

#### Self-signed certificate errors
The API uses self-signed certificates for local HTTPS. When testing with curl:
```bash
curl -k https://localhost:3001/health  # Skip certificate verification
```

Or add the certificate to your system's trust store.

#### Certificate not found
```bash
# Generate new certificates (requires mkcert)
mkdir -p .certs
mkcert -install
mkcert localhost 127.0.0.1 ::1

# Move to .certs directory
mv localhost+3.pem localhost+3-key.pem .certs/
```

### ngrok Issues

#### "Account not authorized" error
```bash
# Re-authenticate
ngrok config add-authtoken <token>
```

#### Random URLs on restart (free tier)
This is expected on free tier. For static URLs:
- Upgrade to ngrok paid plan, OR
- Use webhook.site for temporary testing, OR
- Use localtunnel as alternative:
  ```bash
  npx localtunnel --port 3001
  ```

### Quick Diagnostic Commands

```bash
# Check Node version (should be 18+)
node --version

# Check all environment variables
printenv | grep -E '^(PORT|NODE_ENV|DB_|CLERK_|STRIPE_|CORS_)'

# Test API health
curl http://localhost:3001/health

# Check database connection (SQLite)
ls -la data/

# Check database connection (PostgreSQL)
docker-compose ps
```

---

## Getting Help

If you encounter issues not covered here:

1. Check the [main README](./README.md) for API documentation
2. Review server logs for error messages
3. Verify your `.env` configuration against `.env.example`
4. Open an issue on GitHub with:
   - Error message
   - Steps to reproduce
   - Environment details (Node version, OS, database type)
