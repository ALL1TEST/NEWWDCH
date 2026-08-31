#!/bin/bash
# End-to-end test for the Plans & Pricing system overhaul
set -e

echo "=== E2E: Plans & Pricing System Test ==="

# 1. Login as platform admin (OWNER) and save state
agent-browser open http://localhost:3000/ 2>&1 | tail -3
agent-browser wait --load networkidle 2>&1 | tail -2

# Take a snapshot to find login form
agent-browser snapshot -i 2>&1 | head -80
