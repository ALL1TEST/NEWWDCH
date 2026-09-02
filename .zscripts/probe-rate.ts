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
    console.log(`call ${i}: SUCCESS ${(Date.now()-t0)/1000}s -> ${(c.choices[0]?.message?.content ?? '').slice(0, 20)}`);
    return true;
  } catch (e: any) {
    console.log(`call ${i}: FAIL ${(Date.now()-t0)/1000}s -> ${e.message.slice(0, 60)}`);
    return false;
  }
}
async function main() {
  const zai = await ZAI.create();
  // 8 calls, 3s apart
  for (let i = 1; i <= 8; i++) {
    await one(zai, i);
    if (i < 8) await new Promise(r => setTimeout(r, 3000));
  }
}
main();
