#!/usr/bin/env bash
# check-ui-guardrails.sh
# Enforces the UI guardrails defined in docs/ui-guardrails.md.
# Exits 1 if any violation is found. Run via: npm run check:ui-guardrails
#
# Usage:  bash scripts/check-ui-guardrails.sh
# CI:     add `npm run check:ui-guardrails` as a step after lint.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_ROOT/app"
COMPONENTS_DIR="$REPO_ROOT/components"

# Directories containing application code (pages + feature components).
# The ui/ primitive folder is excluded from most checks because that is
# where the canonical implementations live.
APP_CODE_DIRS=("$APP_DIR" "$COMPONENTS_DIR/auction" "$COMPONENTS_DIR/bid" "$COMPONENTS_DIR/vendor" "$COMPONENTS_DIR/agent")

VIOLATIONS=0

red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

bold "=== UI Guardrails Check ==="
echo ""

# ── Helper ────────────────────────────────────────────────────────────────────

check_pattern() {
  local description="$1"
  local pattern="$2"
  shift 2
  local dirs=("$@")

  local hits
  hits=$(grep -rn --include="*.tsx" --include="*.ts" -E "$pattern" "${dirs[@]}" 2>/dev/null || true)

  if [ -n "$hits" ]; then
    red "FAIL [$description]"
    echo "$hits" | sed 's/^/       /'
    echo ""
    VIOLATIONS=$((VIOLATIONS + 1))
  else
    green "PASS [$description]"
  fi
}

# ── Check 1: Forbidden Button/Badge variants ──────────────────────────────────
# variant="primary" and variant="danger" do not exist in the canonical
# Button or Badge components. Use "default" (Button) or "destructive" (Button)
# / "danger" (Badge only).

check_pattern \
  'No variant="primary" usage' \
  'variant="primary"' \
  "${APP_CODE_DIRS[@]}"

# Note: "danger" is a valid Badge variant but NOT a valid Button variant.
# We check for it on Button specifically by looking for the full prop combo.
# A simpler proxy: flag variant="danger" in any Button import context.
# False positives on Badge are acceptable — reviewers confirm on Badge lines.
check_pattern \
  'No variant="danger" on <Button> (use "destructive")' \
  '<Button[^>]*variant="danger"' \
  "${APP_CODE_DIRS[@]}"

# ── Check 2: Raw <Input> import in app code ───────────────────────────────────
# Input is an internal primitive used only by FormInput.
# Feature code must use FormInput, Textarea, or Select instead.
#
# Allowlist: components/ui/FormInput.tsx (the one legitimate consumer)

check_pattern \
  'No direct <Input> import in app code (use FormInput)' \
  "from '@/components/ui/Input'" \
  "${APP_CODE_DIRS[@]}"

# ── Check 3: Direct dialog.tsx import outside Modal.tsx ──────────────────────
# dialog.tsx is the shadcn base dialog primitive. All feature code must go
# through Modal.tsx which wraps it. Direct imports bypass the disableBackdropClose
# and sizing contract.
#
# Allowlist: components/ui/Modal.tsx (the one legitimate consumer)

DIALOG_VIOLATIONS=$(grep -rn --include="*.tsx" --include="*.ts" \
  "from '@/components/ui/dialog'" \
  "$APP_DIR" \
  "$COMPONENTS_DIR/auction" \
  "$COMPONENTS_DIR/bid" \
  "$COMPONENTS_DIR/vendor" \
  "$COMPONENTS_DIR/agent" \
  2>/dev/null || true)

if [ -n "$DIALOG_VIOLATIONS" ]; then
  red "FAIL [No direct dialog.tsx import in feature code (use Modal)]"
  echo "$DIALOG_VIOLATIONS" | sed 's/^/       /'
  echo ""
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "PASS [No direct dialog.tsx import in feature code (use Modal)]"
fi

# ── Check 4: Stale purple rgba values ────────────────────────────────────────
# The old design system used purple accent rgba values.
# All have been replaced with blue. Any new occurrence is a regression.

check_pattern \
  'No stale purple rgba hover/focus shadows' \
  'rgba\(168,85,247|rgba\(124,92,252' \
  "${APP_CODE_DIRS[@]}" "$COMPONENTS_DIR/ui"

# ── Check 5: <button> inside <Link> anti-pattern ─────────────────────────────
# Invalid HTML: interactive element inside interactive element.
# Style the <Link> directly with inline-flex classes instead.

check_pattern \
  'No <button> nested inside <Link>' \
  '<Link[^>]*>[[:space:]]*<button' \
  "${APP_CODE_DIRS[@]}"

# ── Check 6: Hardcoded hex colors in JSX/TSX ────────────────────────────────
# Design-system tokens must be used exclusively. Hardcoded hex in className
# strings is a strong signal of a missing token.
# Excludes: globals.css (token definitions live there), and the few legitimate
# uses like `bg-[#hexXXX]` that reference design tokens by value.
# We check only className/style attributes in JSX.
#
# Allowlist:
#   BidTrendChart.tsx — chart legend swatches must use the exact same hex
#   values as the Recharts SVG stroke/fill props. These are chart-specific
#   visualization colors (#6366f1 indigo for benchmark/winner, #52525b zinc
#   for neutral). They are documented as intentional exceptions.

HARDCODED_HEX=$(grep -rn --include="*.tsx" -E \
  'className="[^"]*#[0-9a-fA-F]{3,6}[^"]*"' \
  "${APP_CODE_DIRS[@]}" 2>/dev/null \
  | grep -v "BidTrendChart.tsx" \
  || true)

if [ -n "$HARDCODED_HEX" ]; then
  red "FAIL [No hardcoded hex in className strings (use design-system tokens)]"
  echo "$HARDCODED_HEX" | sed 's/^/       /'
  echo ""
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "PASS [No hardcoded hex in className strings]"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
if [ "$VIOLATIONS" -eq 0 ]; then
  green "All guardrail checks passed. (0 violations)"
  exit 0
else
  red "$VIOLATIONS guardrail violation(s) found. Fix before merging."
  echo ""
  echo "  Reference: auction-frontend/docs/ui-guardrails.md"
  exit 1
fi
