const fs = require('fs');

// We can extract articles array from data.ts or parse it
const dataCode = fs.readFileSync('C:/Users/ABDELLAH AIT-SI/Desktop/Verdant/src/lib/data.ts', 'utf8');

// match articles
const titles = [...dataCode.matchAll(/title:\s*"([^"]+)"/g)].map(m => m[1]);
const slugs = [...dataCode.matchAll(/slug:\s*"([^"]+)"/g)].map(m => m[1]);

console.log('Titles found:', titles);
console.log('Slugs found:', slugs);
