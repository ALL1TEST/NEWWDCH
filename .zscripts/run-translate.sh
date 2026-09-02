#!/bin/bash
# Resilient wrapper — restarts the translator until all batches are done.
cd /home/z/my-project
for round in $(seq 1 300); do
  if [ -f .zscripts/i18n-progress/ALL_DONE ]; then
    echo "[wrapper] ALL_DONE marker found — exiting" >> .zscripts/translate.log
    break
  fi
  echo "[wrapper] round $round starting $(date +%H:%M:%S)" >> .zscripts/translate.log
  MAX_BATCHES=10 bun --smol run .zscripts/translate-locales.ts >> .zscripts/translate.log 2>&1
  rc=$?
  echo "[wrapper] round $round exited rc=$rc" >> .zscripts/translate.log
  sleep 2
done
