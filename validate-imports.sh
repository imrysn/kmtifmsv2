#!/bin/bash

# Component Import Validation Script
# Checks that no files are importing from old duplicate component locations

echo "🔍 Validating component imports..."
echo ""

ERRORS=0

# Check for old FileIcon imports
echo "Checking for old FileIcon imports..."
if grep -r "from '../shared/FileIcon'" client/src/components/user/ 2>/dev/null; then
    echo "❌ Found old FileIcon imports in user components"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No old FileIcon imports in user components"
fi

if grep -r "from '../shared/FileIcon'" client/src/components/teamleader/ 2>/dev/null; then
    echo "❌ Found old FileIcon imports in teamleader components"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No old FileIcon imports in teamleader components"
fi

echo ""

# Check for old AlertMessage imports
echo "Checking for old AlertMessage imports..."
if grep -r "from './AlertMessage'" client/src/components/user/ 2>/dev/null; then
    echo "❌ Found old AlertMessage imports in user components"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No old AlertMessage imports in user components"
fi

if grep -r "from './AlertMessage'" client/src/components/admin/ 2>/dev/null; then
    echo "❌ Found old AlertMessage imports in admin components"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No old AlertMessage imports in admin components"
fi

if grep -r "from './AlertMessage'" client/src/components/teamleader/ 2>/dev/null; then
    echo "❌ Found old AlertMessage imports in teamleader components"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No old AlertMessage imports in teamleader components"
fi

echo ""

# Check for old ToastNotification imports
echo "Checking for old ToastNotification imports..."
if grep -r "from './ToastNotification'" client/src/components/user/ 2>/dev/null; then
    echo "❌ Found old ToastNotification imports in user components"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No old ToastNotification imports in user components"
fi

if grep -r "from './ToastNotification'" client/src/components/admin/ 2>/dev/null; then
    echo "❌ Found old ToastNotification imports in admin components"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No old ToastNotification imports in admin components"
fi

echo ""
echo "═══════════════════════════════════════════════════"

if [ $ERRORS -eq 0 ]; then
    echo "✅ ALL IMPORTS VALIDATED SUCCESSFULLY"
    echo "   All components are using shared/ imports"
    echo "   Ready to test!"
else
    echo "❌ FOUND $ERRORS IMPORT ISSUE(S)"
    echo "   Fix the imports listed above before testing"
    exit 1
fi

echo "═══════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Stop your dev server (Ctrl+C)"
echo "2. Restart dev server: npm start"
echo "3. Hard refresh browser: Ctrl+Shift+R"
echo "4. Test all user dashboard tabs"
echo ""
