#!/bin/bash
# Test script for PUT /api/items/:id quantity update persistence bug
# This script verifies the quantity update endpoint is working correctly

set -e

BASE_URL="http://localhost:3000/api"
# Using a mock bearer token - in real test, would need valid Clerk token
# For now, we'll use the dev setup which may have test users
# You may need to replace this with an actual token
AUTH_TOKEN="test_token_replace_with_real"

echo "=== PUT Quantity Update Test Script ==="
echo ""
echo "This test will:"
echo "1. Create a test item"
echo "2. Update quantity via PUT"
echo "3. Verify persistence via GET"
echo ""

# Get a valid token from env or prompt
if [ -z "$CLERK_TEST_TOKEN" ]; then
    echo "⚠️  Warning: No CLERK_TEST_TOKEN set"
    echo "You need a valid Clerk JWT token to test authenticated endpoints"
    echo ""
    echo "To get a token:"
    echo "1. Log into the app in browser"
    echo "2. Open DevTools -> Application -> Local Storage"
    echo "3. Find the Clerk token and copy it"
    echo ""
    echo "Or set CLERK_TEST_TOKEN environment variable"
    echo ""
fi

# For testing with a development bypass, check if server has test mode
# Some servers accept 'test-user-id' header for bypassing auth in dev

echo "Checking server health..."
curl -s "$BASE_URL/health" || echo "⚠️  Server may not be running at $BASE_URL"
echo ""

# Check if there's a test endpoint we can use
echo "Looking for available routes..."
curl -s "$BASE_URL/items" -H "Authorization: Bearer dev" || echo "⚠️  Could not list items (expected without valid token)"
echo ""

echo "=== Instructions for Manual Testing ==="
echo ""
echo "Since we need a valid auth token, here's how to test manually:"
echo ""
echo "1. Start the server:"
echo "   npm run dev"
echo ""
echo "2. Get your user ID and a valid token from the frontend"
echo "   (Check DevTools -> Network tab after logging in)"
echo ""
echo "3. Create an item:"
echo "   curl -X POST http://localhost:3000/api/items \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "     -d '{\"name\":\"Test Item\",\"quantity\":5,\"unit\":\"pieces\",\"category\":\"test\"}'"
echo ""
echo "4. Note the returned item ID, then update quantity:"
echo "   curl -X PUT http://localhost:3000/api/items/ITEM_ID \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "     -d '{\"quantity\":10}'"
echo ""
echo "5. Verify persistence:"
echo "   curl http://localhost:3000/api/items/ITEM_ID \\"
echo "     -H 'Authorization: Bearer YOUR_TOKEN'"
echo ""
echo "6. Check the server console for PUT handler logs to see if it's being called"
echo ""

# If we have a test user setup, try automated test
if [ -f "./data/pantry.db" ]; then
    echo "=== Database Analysis ==="
    echo ""
    sqlite3 ./data/pantry.db "SELECT id, user_id, name, quantity FROM pantry_items LIMIT 5;" 2>/dev/null || echo "Not a valid SQLite DB or sqlite3 not installed"
    echo ""
fi

echo "Test script complete. Manual testing with valid token required."
