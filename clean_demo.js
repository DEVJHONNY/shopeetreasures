const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'shopee.db'));

const totalBefore = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
console.log('Total de produtos antes:', totalBefore);

// List demo products to inspect what will be removed
const demoList = db.prepare(`
  SELECT id, title, image_url, affiliate_link 
  FROM products 
  WHERE image_url LIKE '%unsplash%' 
     OR affiliate_link = 'https://shopee.com.br/' 
     OR video_url LIKE '%commondatastorage%'
`).all();

console.log(`Encontrados ${demoList.length} produtos demo:`);
demoList.forEach(p => console.log(` - ID ${p.id}: ${p.title} (${p.affiliate_link})`));

// Delete demo products
const deleteStmt = db.prepare(`
  DELETE FROM products 
  WHERE image_url LIKE '%unsplash%' 
     OR affiliate_link = 'https://shopee.com.br/' 
     OR video_url LIKE '%commondatastorage%'
`);
deleteStmt.run();

const totalAfter = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
console.log('Total de produtos após remoção de demos:', totalAfter);

// Also let's check sales_count distribution of remaining products
const sampleReal = db.prepare('SELECT id, title, price_discount, sales_count, rating, shop_name, affiliate_link FROM products LIMIT 5').all();
console.log('\nAmostra de produtos reais restantes:');
sampleReal.forEach(p => console.log(JSON.stringify(p, null, 2)));
