import { db } from '../src/lib/db';
import { decrypt } from '../src/lib/encryption';

async function main() {
  const site = await db.site.findFirst({ where: { slug: 'verdant', status: 'ACTIVE' } });
  const cfg = JSON.parse(site!.config!);
  const token = await decrypt(cfg.connection.encryptedCredentials);

  const payload = {
    title: "Succulent Care 101: The Definitive Beginner Handbook",
    slug: "succulent-care-beginner-handbook",
    canonicalUrl: "https://verdantt.vercel.app/blog/succulent-care-beginner-handbook",
    canonical: "https://verdantt.vercel.app/blog/succulent-care-beginner-handbook",
    metadata: {
      canonical: "https://verdantt.vercel.app/blog/succulent-care-beginner-handbook",
      canonicalUrl: "https://verdantt.vercel.app/blog/succulent-care-beginner-handbook"
    },
    seo: {
      canonicalUrl: "https://verdantt.vercel.app/blog/succulent-care-beginner-handbook",
      canonical: "https://verdantt.vercel.app/blog/succulent-care-beginner-handbook"
    }
  };

  const res = await fetch(cfg.connection.apiBaseUrl + '/articles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  console.log('Returned data keys:', Object.keys(json.data || {}));
  console.log('Full returned data:', JSON.stringify(json.data, null, 2));
}

main().catch(console.error);
