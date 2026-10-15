const shopeeApi = require('./shopee_api');
const db = require('./db');

async function syncAll() {
  console.log('[SyncAll] Iniciando sincronização em massa da Shopee API...');

  const categories = [
    { cat: 'Destaques', kw: '', pages: [1, 2] },
    { cat: 'Eletrônicos', kw: 'fone bluetooth smartwatch', pages: [1, 2] },
    { cat: 'Casa & Cozinha', kw: 'utilidades cozinha triturador copo termico', pages: [1, 2] },
    { cat: 'Beleza', kw: 'skincare maquiagem escova secadora', pages: [1, 2] },
    { cat: 'Decoração', kw: 'luminaria led astronauta decoracao quarto', pages: [1] },
    { cat: 'Esportes', kw: 'garrafa motivacional academia fitness', pages: [1] },
    { cat: 'Moda', kw: 'mochila tenis meia bolsa', pages: [1] },
    { cat: 'Automotivo', kw: 'suporte celular carro ferramentas', pages: [1] }
  ];

  const insertStmt = db.prepare(`
    INSERT INTO products (title, description, price_original, price_discount, discount_pct, category, image_url, affiliate_link, badge, sales_count, rating, shop_name, video_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalNew = 0;

  for (const c of categories) {
    for (const page of c.pages) {
      try {
        console.log(`[SyncAll] Buscando categoria "${c.cat}" (página ${page})...`);
        const nodes = await shopeeApi.fetchTopOffers({ keyword: c.kw, page, limit: 30 });
        for (const item of nodes) {
          if (!item || !item.productName || !item.offerLink) continue;

          const exists = db.prepare('SELECT id FROM products WHERE title = ?').get(item.productName);
          if (exists) continue;

          const price = parseFloat(item.priceMin || item.priceMax || 0);
          const discountPct = item.priceDiscountRate || 0;
          let originalPrice = null;
          if (discountPct > 0 && price > 0) {
            originalPrice = price / (1 - (discountPct / 100));
          }

          let salesFormatted = `${item.sales || 0} vendidos`;
          if (item.sales >= 1000) {
            salesFormatted = `${(item.sales / 1000).toFixed(1).replace('.', ',')} mil vendidos`;
          }

          const rating = parseFloat(item.ratingStar || 4.8);
          const badge = rating >= 4.8 ? (discountPct >= 50 ? 'Super Oferta' : 'Destaque') : 'Indicado';

          insertStmt.run(
            item.productName,
            `Produto oficial verificado com avaliação ${rating.toFixed(1)} e ${discountPct}% de desconto na Shopee.`,
            originalPrice ? parseFloat(originalPrice.toFixed(2)) : null,
            parseFloat(price.toFixed(2)),
            discountPct,
            c.cat,
            item.imageUrl,
            item.offerLink,
            badge,
            salesFormatted,
            rating,
            item.shopName || 'Loja Verificada na Shopee',
            null
          );
          totalNew++;
        }
      } catch (err) {
        console.warn(`[SyncAll] Erro em ${c.cat} p.${page}:`, err.message);
      }
    }
  }

  const count = db.prepare('SELECT COUNT(*) as total FROM products WHERE is_active = 1').get().total;
  console.log(`[SyncAll] Concluído! ${totalNew} novos produtos adicionados. Total no banco: ${count}`);
}

syncAll().catch(console.error);
