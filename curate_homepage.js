const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('shopee.db');

// 1. Move all search-polluted items to 'Busca' so they never appear on the homepage
const updated = db.prepare("UPDATE products SET category = 'Busca' WHERE category = 'Achadinhos'").run();
console.log(`Atualizados ${updated.changes} produtos para categoria 'Busca'.`);

// 2. Ensure we have top curated items in Destaques and Achadinhos VIP
const countHome = db.prepare("SELECT count(*) as c FROM products WHERE category != 'Busca'").get().c;
console.log(`Total de produtos qualificados para a vitrine principal: ${countHome}`);

// 3. Print breakdown by category for the homepage
const cats = db.prepare("SELECT category, count(*) as count FROM products WHERE category != 'Busca' GROUP BY category").all();
console.log('Categorias da vitrine principal:');
cats.forEach(c => console.log(` - ${c.category}: ${c.count} produtos`));
