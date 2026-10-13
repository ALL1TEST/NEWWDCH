async function testArticleRoutes() {
  const routes = [
    'https://verdantt.vercel.app/complete-monstera-care-guide',
    'https://verdantt.vercel.app/blog/complete-monstera-care-guide',
    'https://verdantt.vercel.app/articles/complete-monstera-care-guide',
    'https://verdantt.vercel.app/plant-care/complete-monstera-care-guide',
    'https://verdantt.vercel.app/post/complete-monstera-care-guide',
    'https://verdantt.vercel.app/posts/complete-monstera-care-guide',
  ];

  for (const url of routes) {
    const res = await fetch(url);
    console.log(url, '-> HTTP', res.status);
  }
}

testArticleRoutes().catch(console.error);
