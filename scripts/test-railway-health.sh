#!/bin/bash

# Railway Health Check Test Script
# Tests the health endpoint after deployment

URL=${1:-"https://report-opd.up.railway.app"}
HEALTH_ENDPOINT="$URL/api/health"

echo "🏥 Testing Railway Health Check"
echo "==============================="
echo "URL: $HEALTH_ENDPOINT"
echo ""

# Test with curl
echo "📡 Testing with curl..."
if command -v curl &> /dev/null; then
    echo "Response headers:"
    curl -I "$HEALTH_ENDPOINT" 2>/dev/null || echo "❌ Failed to get headers"
    
    echo ""
    echo "Response body:"
    RESPONSE=$(curl -s "$HEALTH_ENDPOINT")
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT")
    
    echo "HTTP Status: $HTTP_CODE"
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Health check successful!"
        echo "Response: $RESPONSE"
    else
        echo "❌ Health check failed!"
        echo "Response: $RESPONSE"
        
        # Check if we're getting redirected to login
        if [[ "$RESPONSE" == *"/login"* ]]; then
            echo ""
            echo "🚨 ISSUE DETECTED: Health endpoint is redirecting to login!"
            echo "   This means the middleware is blocking health checks."
            echo "   Run: npm run validate:health"
            echo "   Fix: Update middleware.ts to exclude /api/health"
        fi
    fi
else
    echo "❌ curl not found"
fi

echo ""
echo "🔍 Additional checks:"

# Test main page
echo "Testing main page..."
MAIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
echo "Main page status: $MAIN_RESPONSE"

if [ "$MAIN_RESPONSE" = "200" ]; then
    echo "✅ Main page accessible"
else
    echo "⚠️  Main page issues (Status: $MAIN_RESPONSE)"
fi

echo ""
echo "🚀 Deployment Summary:"
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health checks passing - Railway deployment successful!"
    echo "✅ Application should be accessible to end users"
else
    echo "❌ Health checks failing - Railway will mark app as unhealthy"
    echo "❌ Users may see 'site can't be reached' errors"
    echo ""
    echo "💡 Next steps:"
    echo "1. Run: npm run validate:health"
    echo "2. Fix middleware configuration"
    echo "3. Redeploy: railway up --detach"
    echo "4. Monitor: railway logs -f"
fi