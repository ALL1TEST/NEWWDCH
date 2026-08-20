#!/bin/bash
# Test script for editor verification
set -e
cd /home/z/my-project

echo "=== Starting dev server ==="
pkill -f "next" 2>/dev/null
sleep 2
rm -f dev.log
/usr/local/bin/bun run dev > dev.log 2>&1 &
SRV=$!
for i in $(seq 1 40); do
  sleep 1
  if curl -s -m 2 http://localhost:3000/ >/dev/null 2>&1; then break; fi
done

echo "=== Opening browser ==="
agent-browser close --all 2>/dev/null
agent-browser open http://localhost:3000/ 2>&1 | tail -1
agent-browser wait --load networkidle 2>&1 | tail -1
agent-browser wait 3000 2>&1
agent-browser snapshot -i -c 2>&1 | head -12

echo "=== Click Admin quick-login @e1 ==="
agent-browser click "@e1" 2>&1 | tail -1
sleep 2
agent-browser snapshot -i -c 2>&1 | head -12

echo "=== Click Sign in @e6 ==="
agent-browser click "@e6" 2>&1 | tail -1
agent-browser wait --load networkidle 2>&1 | tail -1
agent-browser wait 4000 2>&1
agent-browser get url 2>&1

echo "=== Snapshot dashboard ==="
agent-browser snapshot -i -c 2>&1 | head -30

echo "=== Click Content sidebar @e22 ==="
agent-browser click "@e22" 2>&1 | tail -1
sleep 1
agent-browser snapshot -i -c 2>&1 | grep -E "Articles|Create" | head -5

echo "=== Click Articles link @e37 ==="
agent-browser click "@e37" 2>&1 | tail -1
agent-browser wait --text "Create New" 2>&1 | tail -1
sleep 2

echo "=== Snapshot Articles page ==="
agent-browser snapshot -i -c 2>&1 | head -50

echo "=== Click Create New button ==="
agent-browser find text "Create New" click 2>&1 | tail -1
agent-browser wait --text "New Article" 2>&1 | tail -1
sleep 3

echo "=== Snapshot editor page ==="
agent-browser snapshot -i -c 2>&1 | head -100

echo "=== Test editor: type text into title ==="
agent-browser find placeholder "Enter article title..." fill "Editor Test Article" 2>&1 | tail -1
sleep 1

echo "=== Type text in editor (ProseMirror) ==="
agent-browser click ".editor-content p" 2>&1 | tail -1
sleep 1
agent-browser keyboard type "This is a test paragraph to verify the editor works correctly." 2>&1 | tail -1
sleep 1

echo "=== Test undo ==="
# Press Ctrl+Z to undo
agent-browser press Control+z 2>&1 | tail -1
sleep 1
agent-browser get text ".editor-content" 2>&1 | head -5

echo "=== Snapshot toolbar ==="
agent-browser snapshot -i -c 2>&1 | grep -E "Bold|Italic|Underline|Bullet|Numbered|Table|Emoji|Insert|Align|Comment" | head -20

echo "=== Test bullet list ==="
agent-browser find text "Bullet" click 2>&1 | tail -1
sleep 1
agent-browser snapshot -i -c 2>&1 | grep -E "Default|Circle|Square" | head -5

echo "=== Test emoji search ==="
agent-browser find text "Emoji" click 2>&1 | tail -1
sleep 1
agent-browser snapshot -i -c 2>&1 | grep -iE "search|emoji" | head -5
agent-browser fill "input[placeholder*='Search']" "smile" 2>&1 | tail -1
sleep 1
agent-browser snapshot -i -c 2>&1 | grep -E "😀|😁" | head -3

echo "=== Test font size dropdown ==="
agent-browser press Escape 2>&1 | tail -1
sleep 1
agent-browser find text "Size" click 2>&1 | tail -1
sleep 1
agent-browser snapshot -i -c 2>&1 | grep -E "8px|12px|16px|24px|48px|96px" | head -8

echo "=== Test Insert dropdown ==="
agent-browser press Escape 2>&1 | tail -1
sleep 1
agent-browser find text "Insert" click 2>&1 | tail -1
sleep 1
agent-browser snapshot -i -c 2>&1 | grep -E "Keyboard|Superscript|Subscript" | head -5

echo "=== Save Draft ==="
agent-browser find text "Save Draft" click 2>&1 | tail -1
sleep 3

echo "=== Snapshot result ==="
agent-browser snapshot -i -c 2>&1 | head -40

echo "=== Dev log tail ==="
tail -25 /home/z/my-project/dev.log

echo "=== Done ==="
kill $SRV 2>/dev/null
pkill -f next 2>/dev/null
