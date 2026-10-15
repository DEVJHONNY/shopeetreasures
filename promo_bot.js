const fs = require('fs');
const path = require('path');
const shopeeApi = require('./shopee_api');
const db = require('./db');

const OUTPUT_FILE = path.join(__dirname, 'promo_output.json');

/**
 * Formata número para moeda brasileira (R$ 00,00)
 */
function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) return '0,00';
  return Number(val).toFixed(2).replace('.', ',');
}

/**
 * Busca ofertas de alto desconto e avaliação 4.8+ na Shopee API
 */
async function fetchPromoOffers({
  minRating = 4.8,
  minDiscount = 30,
  targetCount = 15,
  keywords = null
} = {}) {
  // Pool amplo de keywords para sempre trazer novidades
  const allKeywords = [
    '', 'fone bluetooth', 'relogio smartwatch', 'luminaria led',
    'utilidades cozinha', 'maquiagem beleza', 'copo termico', 'organizador',
    'carregador portatil', 'cabo usb tipo c', 'mochila masculina',
    'caixa de som bluetooth', 'protetor solar', 'escova alisadora',
    'aspirador portatil', 'camera seguranca', 'pelicula celular',
    'ring light', 'massageador eletrico', 'kit skincare',
    'perfume masculino', 'tenis casual', 'relogio feminino',
    'suporte celular', 'panela eletrica', 'kit ferramentas',
    'pelúcia', 'brinquedo infantil', 'garrafa termica',
    'mouse gamer', 'teclado mecanico', 'webcam', 'hub usb',
    'ventilador portatil', 'umidificador', 'purificador ar'
  ];

  // Se nenhuma keyword foi passada, seleciona um subset aleatório para variar os resultados
  if (!keywords) {
    const shuffled = [...allKeywords].sort(() => Math.random() - 0.5);
    keywords = shuffled.slice(0, 12);
    // Sempre inclui a busca geral vazia para pegar destaques
    if (!keywords.includes('')) keywords.unshift('');
  }

  const seenIds = new Set();
  const seenNames = new Set();
  const qualifiedOffers = [];

  // Usa uma página aleatória (1-3) para pegar resultados diferentes a cada execução
  const randomPage = Math.floor(Math.random() * 3) + 1;

  for (const kw of keywords) {
    try {
      const nodes = await shopeeApi.fetchTopOffers({ keyword: kw, limit: 30, page: randomPage });
      for (const item of nodes) {
        if (!item || !item.productName || !item.offerLink) continue;
        if (seenIds.has(item.itemId) || seenNames.has(item.productName)) continue;

        const rating = parseFloat(item.ratingStar || 0);
        const discount = parseInt(item.priceDiscountRate || 0, 10);
        const priceCurrent = parseFloat(item.priceMin || item.priceMax || 0);

        // Filtro estrito: Avaliação >= 4.8 e Desconto >= 30%
        if (rating >= minRating && discount >= minDiscount && priceCurrent > 0) {
          seenIds.add(item.itemId);
          seenNames.add(item.productName);

          const originalPrice = discount > 0 ? (priceCurrent / (1 - (discount / 100))) : priceCurrent;
          const savings = originalPrice - priceCurrent;

          let salesFormatted = `${item.sales || 0} vendidos`;
          if (item.sales >= 1000) {
            salesFormatted = `${(item.sales / 1000).toFixed(1).replace('.', ',')} mil vendidos`;
          }

          qualifiedOffers.push({
            itemId: item.itemId,
            productName: item.productName,
            shopName: item.shopName || 'Loja Verificada na Shopee',
            priceCurrent,
            originalPrice,
            savings,
            discountPct: discount,
            ratingStar: rating.toFixed(1),
            salesCount: salesFormatted,
            imageUrl: item.imageUrl,
            offerLink: item.offerLink
          });
        }
      }

      if (qualifiedOffers.length >= targetCount * 2) break;
    } catch (err) {
      console.warn(`[PromoBot] Aviso na busca por "${kw}":`, err.message);
    }
  }

  // Ordena por maior desconto (%) e por economia bruta
  qualifiedOffers.sort((a, b) => {
    if (b.discountPct !== a.discountPct) return b.discountPct - a.discountPct;
    return b.savings - a.savings;
  });

  return qualifiedOffers.slice(0, targetCount);
}

/**
 * Formata mensagem individual otimizada para WhatsApp
 */
function formatWhatsAppMessage(prod) {
  const priceDe = formatCurrency(prod.originalPrice);
  const pricePor = formatCurrency(prod.priceCurrent);
  const economia = formatCurrency(prod.savings);

  const lines = [
    `🔥 *ACHADINHO IMPERDÍVEL NA SHOPEE* 🔥`,
    ``,
    `📦 *${prod.productName}*`,
    ``,
    `⭐ Avaliação: *${prod.ratingStar}* / 5.0 (${prod.salesCount})`,
    `🏪 Loja: *${prod.shopName}*`
  ];

  if (priceDe) {
    lines.push(`❌ De: ~R$ ${priceDe}~`);
  }
  lines.push(`✅ *Por apenas: R$ ${pricePor}*`);
  if (prod.discountPct) {
    lines.push(`💥 *Desconto: ${prod.discountPct}% OFF*`);
  }
  if (prod.savings > 0) {
    lines.push(`💰 *Economia de: R$ ${economia}*`);
  }

  lines.push(
    ``,
    `🛒 *COMPRE NO LINK OFICIAL COM DESCONTO:*`,
    `👉 ${prod.offerLink}`,
    ``,
    `💎 *Shopee Oficial | Oferta Verificada*`
  );

  return lines.join('\n');
}

/**
 * Formata mensagem resumo (Digest) com o TOP 10 de achadinhos
 */
function formatDigestMessage(products) {
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const topList = products.slice(0, 10);

  const lines = [
    `🏆 *TOP ${topList.length} ACHADINHOS DA SHOPEE (${dataHoje})* 🏆`,
    `_Curadoria Oficial ShopeeTreasures (Avaliação 4.8+ e Descontos até 80%)_`,
    ``
  ];

  topList.forEach((prod, idx) => {
    const num = idx + 1;
    const pricePor = formatCurrency(prod.priceCurrent);
    const priceDe = formatCurrency(prod.originalPrice);
    lines.push(
      `${num}️⃣ *${prod.productName}*`,
      `   ❌ ~R$ ${priceDe}~ ➔ ✅ *R$ ${pricePor}* (-${prod.discountPct}% OFF)`,
      `   ⭐ ${prod.ratingStar} | 🛒 *Link:* ${prod.offerLink}`,
      ``
    );
  });

  lines.push(
    `──────────────────`,
    `✅ *Todas as ofertas verificadas com links oficiais e garantia Shopee.*`,
    `📲 Entre no nosso grupo VIP para receber alertas em tempo real:`,
    `👉 https://chat.whatsapp.com/`
  );

  return lines.join('\n');
}

/**
 * Executa o robô completo, salva no arquivo e retorna o resultado
 */
async function generatePromos(options = {}) {
  console.log('[PromoBot] Iniciando busca por ofertas com avaliação 4.8+ e desconto 30%+...');
  const products = await fetchPromoOffers(options);

  console.log(`[PromoBot] Encontradas ${products.length} ofertas qualificadas.`);

  const individualMessages = products.map(formatWhatsAppMessage);
  const digest = formatDigestMessage(products);

  const result = {
    generated_at: new Date().toISOString(),
    total_products: products.length,
    digest,
    individual_messages: individualMessages,
    products
  };

  // Sincroniza com o banco de dados (preenche p.id antes de gravar o JSON)

  try {
    const insertStmt = db.prepare(`
      INSERT INTO products (title, description, price_original, price_discount, discount_pct, category, image_url, affiliate_link, badge, sales_count, rating, shop_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let importedToDb = 0;
    for (const p of products) {
      const exists = db.prepare('SELECT id FROM products WHERE title = ?').get(p.productName);
      if (!exists) {
        const info = insertStmt.run(
          p.productName,
          `Achadinho verificado com avaliação ${p.ratingStar} e desconto de ${p.discountPct}% na Shopee.`,
          parseFloat(p.originalPrice.toFixed(2)),
          parseFloat(p.priceCurrent.toFixed(2)),
          p.discountPct,
          'Achadinhos VIP',
          p.imageUrl,
          p.offerLink,
          '4.8+ VIP',
          p.salesCount,
          parseFloat(p.ratingStar),
          p.shopName
        );
        p.id = info.lastInsertRowid;
        importedToDb++;
      } else {
        // Atualiza preço e link se já existe
        db.prepare('UPDATE products SET price_discount = ?, affiliate_link = ?, image_url = ? WHERE id = ?').run(
          parseFloat(p.priceCurrent.toFixed(2)), p.offerLink, p.imageUrl, exists.id
        );
        p.id = exists.id;
      }
    }
    console.log(`[PromoBot] ${importedToDb} novos achadinhos adicionados à vitrine do site.`);
  } catch (dbErr) {
    console.warn('[PromoBot] Erro ao sincronizar com banco:', dbErr.message);
  }

  // Re-grava o JSON com os IDs do banco já preenchidos
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`[PromoBot] Resultados salvos em: ${OUTPUT_FILE}`);

  return result;
}

// Execução direta via CLI
if (require.main === module) {
  generatePromos().then(res => {
    console.log('\n======================================================');
    console.log('EXEMPLO DE MENSAGEM INDIVIDUAL PARA WHATSAPP:');
    console.log('======================================================\n');
    if (res.individual_messages.length > 0) {
      console.log(res.individual_messages[0]);
    }

    console.log('\n======================================================');
    console.log('RESUMO (DIGEST) DO GRUPO VIP:');
    console.log('======================================================\n');
    console.log(res.digest);
    console.log('======================================================\n');
  }).catch(err => {
    console.error('[PromoBot] Falha na execução:', err);
    process.exit(1);
  });
}

module.exports = {
  fetchPromoOffers,
  formatWhatsAppMessage,
  formatDigestMessage,
  generatePromos,
  OUTPUT_FILE
};
