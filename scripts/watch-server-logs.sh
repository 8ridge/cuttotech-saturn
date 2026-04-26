#!/bin/bash

# Script to watch server logs in real-time
# Usage: ./scripts/watch-server-logs.sh

echo "📺 Watching CutTech Server Logs..."
echo "Press Ctrl+C to stop"
echo ""

# Show logs with colors and filtering
sudo journalctl -u cuttech-server -f --no-pager | while read line; do
  # Highlight monetization-related logs
  if echo "$line" | grep -qE "monetization|offer|creator|Geo|Anti-fraud|Traffic"; then
    echo -e "\033[33m$line\033[0m"  # Yellow for monetization
  elif echo "$line" | grep -qE "ERROR|FAIL|error"; then
    echo -e "\033[31m$line\033[0m"  # Red for errors
  elif echo "$line" | grep -qE "✅|PASS|SUCCESS"; then
    echo -e "\033[32m$line\033[0m"  # Green for success
  else
    echo "$line"
  fi
done

