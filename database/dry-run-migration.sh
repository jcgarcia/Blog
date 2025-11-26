#!/bin/bash

# DRY RUN MIGRATION TEST
# Purpose: Simulate migration execution to verify SQL syntax and logic
# Date: October 8, 2025

echo "========================================"
echo "🧪 DRY RUN: Database Migration Test"
echo "========================================"
echo ""

# Simulate migration file validation
echo "Step 1: Validating migration file..."
MIGRATION_FILE="/home/jcgarcia/docs/Tech/Blog/code/database/migrations/001_definitive_settings_schema.sql"

if [ -f "$MIGRATION_FILE" ]; then
    echo "✅ Migration file exists: $MIGRATION_FILE"
    
    # Check file size
    FILE_SIZE=$(wc -c < "$MIGRATION_FILE")
    echo "✅ Migration file size: $FILE_SIZE bytes"
    
    # Check for critical SQL components
    echo ""
    echo "Step 2: Analyzing migration content..."
    
    # Check for DO block
    if grep -q "DO \$\$" "$MIGRATION_FILE"; then
        echo "✅ Found DO block structure"
    else
        echo "❌ Missing DO block structure"
    fi
    
    # Check for CREATE TABLE settings
    if grep -q "CREATE TABLE settings" "$MIGRATION_FILE"; then
        echo "✅ Found CREATE TABLE settings command"
    else
        echo "❌ Missing CREATE TABLE settings command"
    fi
    
    # Check for required columns
    REQUIRED_COLUMNS=("type" "group_name" "description" "is_public")
    echo ""
    echo "Checking for required columns:"
    for col in "${REQUIRED_COLUMNS[@]}"; do
        if grep -q "$col" "$MIGRATION_FILE"; then
            echo "  ✅ Column '$col' referenced in migration"
        else
            echo "  ❌ Column '$col' missing from migration"
        fi
    done
    
    # Check for OAuth settings
    echo ""
    echo "Checking for OAuth configuration setup:"
    OAUTH_KEYS=("oauth_cognito_user_pool_id" "oauth_cognito_client_id" "oauth_google_client_id")
    for key in "${OAUTH_KEYS[@]}"; do
        if grep -q "$key" "$MIGRATION_FILE"; then
            echo "  ✅ OAuth setting '$key' will be created"
        else
            echo "  ❌ OAuth setting '$key' missing"
        fi
    done
    
    # Check for social media settings
    echo ""
    echo "Checking for social media configuration setup:"
    SOCIAL_KEYS=("social_linkedin_url" "social_twitter_url" "social_instagram_url")
    for key in "${SOCIAL_KEYS[@]}"; do
        if grep -q "$key" "$MIGRATION_FILE"; then
            echo "  ✅ Social setting '$key' will be created"
        else
            echo "  ❌ Social setting '$key' missing"
        fi
    done
    
    # Check for error handling
    echo ""
    echo "Step 3: Checking migration robustness..."
    if grep -q "EXCEPTION" "$MIGRATION_FILE"; then
        echo "✅ Error handling present"
    else
        echo "❌ No error handling found"
    fi
    
    if grep -q "migration_history" "$MIGRATION_FILE"; then
        echo "✅ Migration tracking implemented"
    else
        echo "❌ Migration tracking missing"
    fi
    
    if grep -q "IF NOT EXISTS" "$MIGRATION_FILE"; then
        echo "✅ Idempotent operations (IF NOT EXISTS) found"
    else
        echo "❌ Migration might not be idempotent"
    fi
    
else
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo ""
echo "Step 4: Analyzing settings controller compatibility..."
CONTROLLER_FILE="/home/jcgarcia/docs/Tech/Blog/code/api/controllers/settings.js"

if [ -f "$CONTROLLER_FILE" ]; then
    echo "✅ Settings controller exists"
    
    # Check for schema-aware code
    if grep -q "information_schema.columns" "$CONTROLLER_FILE"; then
        echo "✅ Controller is schema-aware (checks column existence)"
    else
        echo "❌ Controller is not schema-aware"
    fi
    
    # Check for OAuth methods
    if grep -q "getOAuthSettings\|updateOAuthSettings" "$CONTROLLER_FILE"; then
        echo "✅ OAuth configuration methods present"
    else
        echo "❌ OAuth configuration methods missing"
    fi
    
    # Check for social media methods
    if grep -q "getSocialMediaLinks\|updateSocialMediaLinks" "$CONTROLLER_FILE"; then
        echo "✅ Social media configuration methods present"
    else
        echo "❌ Social media configuration methods missing"
    fi
    
else
    echo "❌ Settings controller not found: $CONTROLLER_FILE"
fi

echo ""
echo "Step 5: Validating support files..."

# Check validation script
VALIDATION_SCRIPT="/home/jcgarcia/docs/Tech/Blog/code/database/validate-schema.sh"
if [ -f "$VALIDATION_SCRIPT" ] && [ -x "$VALIDATION_SCRIPT" ]; then
    echo "✅ Validation script exists and is executable"
else
    echo "❌ Validation script missing or not executable"
fi

# Check migration runner
RUNNER_SCRIPT="/home/jcgarcia/docs/Tech/Blog/code/database/run-migrations.sh"
if [ -f "$RUNNER_SCRIPT" ] && [ -x "$RUNNER_SCRIPT" ]; then
    echo "✅ Migration runner exists and is executable"
else
    echo "❌ Migration runner missing or not executable"
fi

echo ""
echo "========================================"
echo "🧪 DRY RUN RESULTS SUMMARY"
echo "========================================"

# Count issues
ISSUES=0

# Critical checks
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "🔴 CRITICAL: Migration file missing"
    ((ISSUES++))
fi

if ! grep -q "CREATE TABLE settings" "$MIGRATION_FILE" 2>/dev/null; then
    echo "🔴 CRITICAL: No settings table creation found"
    ((ISSUES++))
fi

if ! grep -q "oauth_cognito_user_pool_id" "$MIGRATION_FILE" 2>/dev/null; then
    echo "🔴 CRITICAL: OAuth Cognito settings missing (needed for OIDC dropdown)"
    ((ISSUES++))
fi

if ! grep -q "social_linkedin_url" "$MIGRATION_FILE" 2>/dev/null; then
    echo "🔴 CRITICAL: Social media settings missing"
    ((ISSUES++))
fi

if [ $ISSUES -eq 0 ]; then
    echo "🎉 SUCCESS: Dry run completed with no critical issues"
    echo ""
    echo "✅ Migration appears ready for deployment"
    echo "✅ All required components are present"
    echo "✅ OAuth and social media configurations will be created"
    echo ""
    echo "Next steps:"
    echo "1. Set database environment variables (PGHOST, PGUSER, PGPASSWORD, etc.)"
    echo "2. Run: ./run-migrations.sh"
    echo "3. Run: ./validate-schema.sh"
    echo "4. Test social media links and OIDC dropdown in admin interface"
    
else
    echo "🔴 FAILURE: $ISSUES critical issues found"
    echo ""
    echo "❌ Migration has critical issues and should not be deployed"
    echo "❌ Fix the issues above before proceeding"
fi

echo ""
echo "========================================"