import ZAI from 'z-ai-web-dev-sdk';
async function one(zai: any, i: number) {
  const t0 = Date.now();
  try {
    const c = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: 'Reply with the single word OK.' },
        { role: 'user', content: 'OK?' },
      ],
      thinking: { type: 'disabled' },
    });
    console.log(`call ${i}: SUCCESS ${(Date.now()-t0)/1000}s`);
    return true;
  } catch (e: any) {
    console.log(`call ${i}: FAIL ${(Date.now()-t0)/1000}s -> ${e.message.slice(0, 50)}`);
    return false;
  }
}
async function main() {
  const zai = await ZAI.create();
  // burst of 12 concurrent
  const res = await Promise.all(Array.from({ length: 12 }, (_, i) => one(zai, i + 1)));
  const ok = res.filter(Boolean).length;
  console.log(`concurrent burst 12: ${ok} ok`);
  await new Promise(r => setTimeout(r, 5000));
  const res2 = await Promise.all(Array.from({ length: 12 }, (_, i) => one(zai, i + 1)));
  console.log(`second burst 12: ${res2.filter(Boolean).length} ok`);
}
main();
