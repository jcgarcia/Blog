#!/bin/bash

echo "🔍 Database Connection Cleanup & Monitoring"
echo "=========================================="

# Check for running Node.js processes
echo "📡 Checking for running Node.js processes..."
NODE_PROCESSES=$(ps aux | grep -E "node.*blog|node.*test-api|node.*api" | grep -v grep)
if [ -n "$NODE_PROCESSES" ]; then
    echo "⚠️  Found running Node.js processes:"
    echo "$NODE_PROCESSES"
    echo ""
    echo "🛑 To stop them, run:"
    echo "   pkill -f 'node.*blog'"
    echo "   pkill -f 'node.*test-api'"
else
    echo "✅ No blog-related Node.js processes running"
fi

echo ""

# Check for open ports
echo "🌐 Checking for open ports (5000, 5001, 3000)..."
OPEN_PORTS=$(lsof -i :5000,5001,3000 2>/dev/null | grep LISTEN || echo "No ports listening")
echo "$OPEN_PORTS"

echo ""

# Check Docker containers
echo "🐳 Checking for Docker containers..."
DOCKER_CONTAINERS=$(docker ps | grep -E "(blog|bedtime)" || echo "No blog-related containers running")
echo "$DOCKER_CONTAINERS"

echo ""

# Cleanup connections
echo "🧹 Running database connection cleanup..."
node cleanup-db-connections.js

echo ""
echo "✅ Cleanup complete! Check your Aiven console to verify connections are closed."
echo "💡 To prevent future idle connections:"
echo "   - Always use Ctrl+C to stop servers gracefully"
echo "   - Use the updated db.js with shorter timeouts"
echo "   - Run this script periodically: ./cleanup-all-connections.sh"
