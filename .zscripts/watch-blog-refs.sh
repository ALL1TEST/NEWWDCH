#!/bin/bash
# Watches for the 3 blog reference screenshots to arrive in upload/
END=$((SECONDS+43200))
while [ $SECONDS -lt $END ]; do
  for f in b21707ae-20dd-4ca0-8f90-d23ba99a198a.png c7d99016-b5a8-46c2-9fad-cdbf7dc693fe.png 55c43501-8483-4e30-8589-b0c005a67807.png; do
    if [ -f "/home/z/my-project/upload/$f" ] && [ ! -f "/home/z/my-project/.zscripts/seen-$f" ]; then
      touch "/home/z/my-project/.zscripts/seen-$f"
      echo "$(date) ARRIVED: $f" >> /home/z/my-project/.zscripts/blog-refs-watcher.log
    fi
  done
  sleep 10
done
