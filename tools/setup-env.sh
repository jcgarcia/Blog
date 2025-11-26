#!/bin/bash

# Blog Publishing Environment Variables
export BLOG_API_URL="https://bapi.ingasti.com/api"
export BLOG_API_KEY="your-secure-api-key-here"  # Replace with your actual API key
export BLOG_USER_ID="1"

# For local development (uncomment if testing locally)
# export BLOG_API_URL="http://localhost:5000/api"

echo "Environment variables set for blog publishing"
echo "API URL: $BLOG_API_URL"
echo "Remember to update BLOG_API_KEY with your actual API key"
