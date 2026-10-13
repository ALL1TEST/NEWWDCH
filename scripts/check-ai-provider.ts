import { db } from '../src/lib/db';
import { resolveAiProviderForUser } from '../src/lib/ai/platform-ai';

async function main() {
  const providers = await db.aiProvider.findMany();
  console.log('=== AI PROVIDERS ===');
  for (const p of providers) {
    console.log({
      id: p.id,
      name: p.name,
      kind: p.kind,
      isActive: p.isActive,
      isDefault: p.isDefault,
      baseUrl: p.baseUrl,
      apiKeyEncrypted: p.apiKeyEncrypted ? '[SET]' : null,
      createdById: p.createdById,
    });
  }

  const kok = await db.automation.findFirst({ where: { name: 'kok' } });
  console.log('\nkok user ID:', kok?.createdById);
  const resolved = await resolveAiProviderForUser(kok?.createdById, 'TEXT');
  console.log('Resolved provider for kok:', resolved);
}

main().catch(console.error).finally(() => process.exit(0));
