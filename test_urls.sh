#!/bin/bash

# Test script to verify URLs are correct in API responses
# Usage: ./test_urls.sh

echo "======================================"
echo "Testing API URL Generation"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get server URL from environment or use default
if [ -f .env ]; then
    source .env
    echo "Using configuration from .env"
else
    PUBLIC_URL="http://localhost:8000"
    echo "No .env found, using localhost"
fi

echo "Expected PUBLIC_URL: $PUBLIC_URL"
echo ""

# Test 1: Health Check
echo "Test 1: Health Check"
echo "-----------------------------------"
RESPONSE=$(curl -s http://localhost:8000/health)
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Test 2: List Videos (check URL format)
echo "Test 2: List Videos"
echo "-----------------------------------"
RESPONSE=$(curl -s http://localhost:8000/api/v1/videos/list)
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

# Check if URLs contain correct base URL
if echo "$RESPONSE" | grep -q "localhost" && [ "$PUBLIC_URL" != *"localhost"* ]; then
    echo -e "${RED}❌ FAIL: Found localhost in response but PUBLIC_URL is $PUBLIC_URL${NC}"
    exit 1
elif echo "$RESPONSE" | grep -q "$PUBLIC_URL"; then
    echo -e "${GREEN}✅ PASS: URLs contain correct PUBLIC_URL${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Could not verify URL (may be empty response)${NC}"
fi
echo ""

# Test 3: Domain Restriction Status
echo "Test 3: Domain Restriction Status"
echo "-----------------------------------"
if [ -f .env ]; then
    RESTRICTION=$(grep ENABLE_DOMAIN_RESTRICTION .env | cut -d'=' -f2)
    ALLOWED=$(grep ALLOWED_DOMAINS .env | cut -d'=' -f2)
    echo "Domain Restriction: $RESTRICTION"
    echo "Allowed Domains: $ALLOWED"
else
    echo "No .env file - Domain restriction is OFF (default)"
fi
echo ""

# Test 4: Test with curl (should work as no origin/referer)
echo "Test 4: Direct API Access Test"
echo "-----------------------------------"
echo "Testing if curl can access API (should work even with domain restriction)"
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:8000/)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ PASS: Direct access works (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}❌ FAIL: Direct access failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
    exit 1
fi
echo ""

# Summary
echo "======================================"
echo "Summary"
echo "======================================"
echo "Configuration:"
echo "  - PUBLIC_URL: $PUBLIC_URL"
echo "  - Expected URL pattern in responses: ${PUBLIC_URL}/storage/*, ${PUBLIC_URL}/api/*"
echo ""
echo "Next steps:"
echo "1. Deploy to VPS: git push origin deploy"
echo "2. On VPS: cp production.env .env && pm2 restart kocao"
echo "3. Test on VPS: curl http://36.50.54.74:8000/api/v1/videos/list"
echo "4. Verify URLs contain http://36.50.54.74:8000 (NOT localhost)"
echo ""
echo -e "${GREEN}✅ Local tests completed!${NC}"

