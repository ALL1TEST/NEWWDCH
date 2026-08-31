#!/bin/bash
# Dev-server supervisor — keeps `bun run dev` (port 3000) alive.
# The sandbox occasionally reaps/OOM-kills the next-server process;
# this loop detects the death and restarts it automatically.
cd /home/z/my-project
while true; do
  if curl -s -o /dev/null --connect-timeout 1 --max-time 3 http://localhost:3000/; then
    # Server healthy — poll again later.
    sleep 5
  else
    echo "[$(date '+%H:%M:%S')] dev server down — restarting" >> /home/z/my-project/.zscripts/dev-supervisor.log
    bun run dev > /dev/null 2>&1 &
    DEVPID=$!
    # Give it up to 60s to come up (first compile can be slow).
    for _ in $(seq 1 30); do
      if curl -s -o /dev/null --connect-timeout 1 --max-time 3 http://localhost:3000/; then
        break
      fi
      sleep 2
    done
    wait $DEVPID
    sleep 2
  fi
done
