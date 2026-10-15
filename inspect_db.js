const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('shopee.db');

const rows = db.prepare("SELECT id, title, category, rating, discount_pct, sales_count FROM products WHERE category = 'Achadinhos' LIMIT 15").all();
console.log('--- Achadinhos (Search items) ---');
rows.forEach(r => console.log(r.id, '|', r.title.slice(0, 45), '| rating:', r.rating, '| desc:', r.discount_pct + '%', '| sales:', r.sales_count));

const realRows = db.prepare("SELECT id, title, category, rating, discount_pct FROM products WHERE category != 'Achadinhos' LIMIT 10").all();
console.log('\n--- Real Category items ---');
realRows.forEach(r => console.log(r.id, '|', r.category, '|', r.title.slice(0, 40), '| rating:', r.rating));
