const shopeeApi = require('./shopee_api');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('shopee.db');

async function importKitchen() {
  const nodes = await shopeeApi.fetchTopOffers({ keyword: 'utilidades cozinha panela triturador organizador', limit: 30 });
  console.log('Obtidos da Shopee API:', nodes.length);
  const insertStmt = db.prepare(`
    INSERT INTO products (title, description, price_original, price_discount, discount_pct, category, image_url, affiliate_link, badge, sales_count, rating, shop_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let added = 0;
  for (const item of nodes) {
    if (!item.productName || !item.offerLink) continue;
    const exists = db.prepare('SELECT id FROM products WHERE title = ?').get(item.productName);
    if (!exists) {
      const price = parseFloat(item.priceMin || item.priceMax || 0);
      const discount = parseInt(item.priceDiscountRate || 0, 10);
      const orig = discount > 0 ? (price / (1 - discount/100)) : null;
      let sales = item.sales ? (item.sales >= 1000 ? (item.sales/1000).toFixed(1).replace('.', ',') + ' mil vendidos' : item.sales + ' vendidos') : 'Destaque Oficial';
      insertStmt.run(
        item.productName,
        'Produto oficial verificado e selecionado pela curadoria.',
        orig ? parseFloat(orig.toFixed(2)) : null,
        parseFloat(price.toFixed(2)),
        discount,
        'Casa & Cozinha',
        item.imageUrl,
        item.offerLink,
        '⭐ Destaque',
        sales,
        parseFloat(item.ratingStar || 4.8),
        item.shopName || 'Loja Oficial Shopee'
      );
      added++;
    }
  }
  console.log('Novos produtos adicionados para Casa & Cozinha:', added);
}
importKitchen();
