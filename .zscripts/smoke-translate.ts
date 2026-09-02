import ZAI from 'z-ai-web-dev-sdk';

async function main() {
  const zai = await ZAI.create();
  const pairs = {
    'dashboard.totalVisitors': 'Total Visitors',
    'dashboard.healthScore': 'Health Score',
    'dashboard.siteNetwork': 'Site Network',
    'common.saveChanges': 'Save Changes',
    'ai.providersTitle': 'AI Providers',
  };
  const system = `You are a professional software localizer for a CMS admin dashboard UI. Translate EVERY value into Hindi. Return ONLY a valid JSON object with the EXACT SAME KEYS — no markdown, no code fences, no commentary. Keep translations concise and natural for UI.`;
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: system },
      { role: 'user', content: `Translate every value to Hindi and return ONLY the JSON object:\n${JSON.stringify(pairs)}` },
    ],
    thinking: { type: 'disabled' },
  });
  const text = (completion.choices[0]?.message?.content ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  console.log('RAW:', text.slice(0, 300));
  const parsed = JSON.parse(text);
  console.log('PARSED OK:', JSON.stringify(parsed, null, 2));
}
main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
