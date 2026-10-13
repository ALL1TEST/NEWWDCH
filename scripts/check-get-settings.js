async function check() {
  const res = await fetch('http://localhost:3000/api/settings?category=DISCUSSION');
  const json = await res.json();
  console.log('GET /api/settings?category=DISCUSSION response:');
  console.log(json.data?.enable_comments);
}
check().catch(console.error);
