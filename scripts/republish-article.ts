import { publishArticleToConnectedSite } from '../src/lib/connection/site-publisher';

async function main() {
  console.log('Triggering publishArticleToConnectedSite for cmuc02x0r004rk9tgstnztju9...');
  const res = await publishArticleToConnectedSite('cmuc02x0r004rk9tgstnztju9');
  console.log('Publish result:', JSON.stringify(res, null, 2));
}

main().catch(console.error);
