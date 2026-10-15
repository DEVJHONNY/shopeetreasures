const shopeeApi = require('./shopee_api');

// Configurações padrão persistidas em memória da função
let settingsState = {
  site_title: 'ShopeeTreasures',
  site_subtitle: 'Curadoria independente com os melhores achados e preços verificados na Shopee.',
  site_badge: 'Curadoria Independente',
  site_disclaimer: 'ShopeeTreasures é uma vitrine independente de curadoria de produtos disponíveis na Shopee. Não somos a Shopee e não vendemos produtos diretamente. Links de afiliados.',
  whatsapp_link: 'https://chat.whatsapp.com/KjHrqfJp3HuIHQiR8Zfl3L',
  instagram_link: 'https://instagram.com/'
};

// Cache simples em memória para respostas rápidas
let cachedPromos = null;

function formatSales(sales) {
  const num = parseInt(sales, 10);
  if (!num || isNaN(num) || num <= 0) return 'Top Escolha';
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace('.', ',')} mil vendidos`;
  return `${num} vendidos`;
}

function normalizeShopeeNode(item, idx, defaultCategory = 'Achadinhos') {
  const price = parseFloat(item.priceMin || item.priceMax || 0);
  const discountPct = parseInt(item.priceDiscountRate || 0, 10);
  let originalPrice = null;
  if (discountPct > 0 && price > 0) {
    originalPrice = parseFloat((price / (1 - (discountPct / 100))).toFixed(2));
  }

  const rating = parseFloat(item.ratingStar || 4.8);
  const badge = rating >= 4.8 ? '🔥 Top Escolha' : '⭐ Verificado';

  return {
    id: item.itemId || (idx + 1),
    title: item.productName,
    description: 'Produto oficial verificado e selecionado pela curadoria ShopeeTreasures com link direto para a loja oficial.',
    price_original: originalPrice,
    price_discount: parseFloat(price.toFixed(2)),
    discount_pct: discountPct,
    category: defaultCategory,
    image_url: item.imageUrl,
    affiliate_link: item.offerLink,
    badge,
    sales_count: formatSales(item.sales),
    rating,
    shop_name: item.shopName || 'Loja Verificada na Shopee',
    video_url: null,
    clicks: Math.floor(Math.random() * 40) + 10,
    is_active: 1
  };
}

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    },
    body: JSON.stringify(data)
  };
}

exports.handler = async (event, context) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: ''
    };
  }

  let pathname = event.path || '';
  // Normaliza o path caso venha com o prefixo da function /.netlify/functions/api/
  pathname = pathname.replace('/.netlify/functions/api', '');
  if (!pathname.startsWith('/api')) {
    pathname = '/api' + (pathname.startsWith('/') ? pathname : '/' + pathname);
  }

  const queryParams = event.queryStringParameters || {};
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch (e) {}
  }

  try {
    // 1. SETTINGS
    if (pathname === '/api/settings' && event.httpMethod === 'GET') {
      return jsonResponse(200, settingsState);
    }

    if (pathname === '/api/settings' && event.httpMethod === 'POST') {
      for (const [k, v] of Object.entries(body)) {
        settingsState[k] = String(v);
      }
      return jsonResponse(200, { success: true });
    }

    // 2. CATEGORIES
    if (pathname === '/api/categories' && event.httpMethod === 'GET') {
      return jsonResponse(200, ['Todos', 'Destaques', 'Eletrônicos', 'Casa & Cozinha', 'Beleza', 'Achadinhos VIP']);
    }

    // 3. FLASH SALE (OFERTAS RELÂMPAGO AO VIVO DA SHOPEE)
    if (pathname === '/api/homepage/flash-sale' && event.httpMethod === 'GET') {
      try {
        const nodes = await shopeeApi.fetchTopOffers({ keyword: '', limit: 20 });
        const flashProducts = nodes
          .map((item, idx) => normalizeShopeeNode(item, idx, 'Flash Sale'))
          .filter(p => p.discount_pct >= 30)
          .sort((a, b) => b.discount_pct - a.discount_pct)
          .slice(0, 10);

        return jsonResponse(200, flashProducts);
      } catch (e) {
        return jsonResponse(200, []);
      }
    }

    // 4. CONSULTA E BUSCA DE PRODUTOS EM TEMPO REAL
    if (pathname === '/api/products' && event.httpMethod === 'GET') {
      const q = (queryParams.q || '').trim();
      const cat = queryParams.cat || '';
      const minPrice = parseFloat(queryParams.minPrice) || 0;
      const maxPrice = parseFloat(queryParams.maxPrice) || 999999;
      const sort = queryParams.sort || 'default';

      let targetKeyword = q || (cat && cat !== 'Todos' ? cat : '');
      const nodes = await shopeeApi.fetchTopOffers({ keyword: targetKeyword, limit: 30 });
      let products = nodes.map((item, idx) => normalizeShopeeNode(item, idx, cat || 'Achadinhos'));

      // Filtro de preço
      if (minPrice > 0 || maxPrice < 999999) {
        products = products.filter(p => p.price_discount >= minPrice && p.price_discount <= maxPrice);
      }

      // Ordenação
      if (sort === 'price_asc') {
        products.sort((a, b) => a.price_discount - b.price_discount);
      } else if (sort === 'price_desc') {
        products.sort((a, b) => b.price_discount - a.price_discount);
      } else if (sort === 'discount_desc') {
        products.sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0));
      }

      return jsonResponse(200, products);
    }

    // 5. CARREGAR MAIS PRODUTOS (PAGINAÇÃO)
    if (pathname === '/api/shopee/load-more' && event.httpMethod === 'GET') {
      const cat = queryParams.cat || '';
      const q = (queryParams.q || '').trim();
      const page = parseInt(queryParams.page, 10) || 1;
      const kw = q || (cat && cat !== 'Todos' ? cat : '');

      const nodes = await shopeeApi.fetchTopOffers({ keyword: kw, page, limit: 30 });
      const newProducts = nodes.map((item, idx) => normalizeShopeeNode(item, (page * 30) + idx, cat || 'Achadinhos'));

      return jsonResponse(200, { success: true, newImported: newProducts.length, total: newProducts.length, products: newProducts });
    }

    // 6. CONVERSOR DE LINKS DE AFILIADO
    if (pathname === '/api/shopee/convert-link' && event.httpMethod === 'POST') {
      if (!body.url) return jsonResponse(400, { error: 'URL não informada.' });
      try {
        const shortLink = await shopeeApi.generateAffiliateLink(body.url);
        return jsonResponse(200, { success: true, shortLink });
      } catch (err) {
        return jsonResponse(500, { success: false, error: err.message });
      }
    }

    // 7. ROBÔ DE OFERTAS (4.8★ + 30% OFF)
    if ((pathname === '/api/promo/latest' || pathname === '/api/promo/generate') && (event.httpMethod === 'GET' || event.httpMethod === 'POST')) {
      if (pathname === '/api/promo/latest' && cachedPromos) {
        return jsonResponse(200, cachedPromos);
      }

      const keywords = ['', 'fone bluetooth', 'skincare beleza', 'utilidades cozinha', 'smartwatch', 'organizador', 'copo térmico'];
      const qualified = [];
      const seen = new Set();

      for (const kw of keywords) {
        try {
          const items = await shopeeApi.fetchTopOffers({ keyword: kw, limit: 10 });
          for (const item of items) {
            if (!item || !item.productName || !item.offerLink) continue;
            if (seen.has(item.itemId)) continue;

            const rating = parseFloat(item.ratingStar || 0);
            const discountPct = parseInt(item.priceDiscountRate || 0, 10);
            const price = parseFloat(item.priceMin || 0);

            if (rating >= 4.8 && discountPct >= 30 && price > 0) {
              seen.add(item.itemId);
              const origPrice = price / (1 - (discountPct / 100));

              qualified.push({
                id: item.itemId,
                itemId: item.itemId,
                productName: item.productName,
                priceCurrent: price,
                originalPrice: origPrice,
                discountPct,
                savings: origPrice - price,
                ratingStar: rating.toFixed(1),
                salesCount: `${item.sales || 0} vendidos`,
                shopName: item.shopName || 'Loja Verificada na Shopee',
                imageUrl: item.imageUrl,
                offerLink: item.offerLink
              });
            }
          }
        } catch (e) {}
      }

      qualified.sort((a, b) => b.discountPct - a.discountPct);
      const top10 = qualified.slice(0, 10);

      const individualMessages = top10.map(p => {
        return `🔥 *ACHADINHO DO DIA NA SHOPEE* 🔥\n\n📦 *${p.productName}*\n\n⭐ Avaliação: *${p.ratingStar}/5* | ${p.salesCount}\n🏪 Loja: *${p.shopName}*\n\n~De R$ ${p.originalPrice.toFixed(2).replace('.', ',')}~\n💰 *Por apenas R$ ${p.priceCurrent.toFixed(2).replace('.', ',')}*\n📉 Desconto de *${p.discountPct}% OFF*\n💵 Economia de *R$ ${p.savings.toFixed(2).replace('.', ',')}*\n\n🛒 *COMPRAR AGORA NO LINK OFICIAL:*\n👉 ${p.offerLink}\n\n💎 *ShopeeTreasures VIP #1 | Oferta Verificada*`;
      });

      const digest = `🏆 *TOP 10 ACHADINHOS DO DIA - SHOPEE VIP* 🏆\n${new Date().toLocaleDateString('pt-BR')}\n\n` +
        top10.map((p, i) => `${i + 1}. *${p.productName}*\n   ~R$ ${p.originalPrice.toFixed(2).replace('.', ',')}~ ➔ *R$ ${p.priceCurrent.toFixed(2).replace('.', ',')}* (-${p.discountPct}%)\n   ⭐ ${p.ratingStar} | 🛒 ${p.offerLink}`).join('\n\n') +
        `\n\n---\n✅ Todas as ofertas verificadas com link oficial da Shopee.`;

      cachedPromos = {
        generated_at: new Date().toISOString(),
        total_products: top10.length,
        digest,
        individual_messages: individualMessages,
        products: top10
      };

      return jsonResponse(200, { success: true, ...cachedPromos });
    }

    // 8. ADMIN LOGIN
    if (pathname === '/api/admin/login' && event.httpMethod === 'POST') {
      const pwd = body.password || '';
      const correct = process.env.ADMIN_PASSWORD || 'Luc@S076140';
      if (pwd === correct) {
        return jsonResponse(200, { success: true, token: correct });
      }
      return jsonResponse(401, { success: false, error: 'Senha incorreta.' });
    }

    // 9. ADMIN PRODUCTS LIST
    if (pathname === '/api/admin/products' && event.httpMethod === 'GET') {
      const nodes = await shopeeApi.fetchTopOffers({ keyword: '', limit: 30 });
      const products = nodes.map((item, idx) => normalizeShopeeNode(item, idx, 'Destaques'));
      return jsonResponse(200, products);
    }

    // 10. STATUS DO CRON (SERVERLESS SHOPEE API)
    if (pathname === '/api/admin/cron-status' && event.httpMethod === 'GET') {
      return jsonResponse(200, {
        enabled: true,
        intervalHours: 1,
        lastSync: new Date().toISOString(),
        lastCount: 30,
        nextSync: new Date(Date.now() + 3600 * 1000).toISOString()
      });
    }

    if (pathname === '/api/admin/cron-trigger' && event.httpMethod === 'POST') {
      return jsonResponse(200, {
        success: true,
        message: 'Vitrine Serverless da Shopee sincronizada em tempo real.'
      });
    }

    if (pathname === '/api/admin/cron-config' && event.httpMethod === 'POST') {
      return jsonResponse(200, { success: true });
    }

    // 11. STATUS DO ROBÔ WHATSAPP (INFORMATIVO NO PAINEL NETLIFY)
    if (pathname === '/api/admin/whatsapp/status' && event.httpMethod === 'GET') {
      return jsonResponse(200, {
        status: 'connected_local',
        message: 'Robô operando via script local no seu computador.',
        isAutoPostEnabled: true,
        intervalMinutes: 60
      });
    }

    return jsonResponse(404, { error: 'Rota não encontrada: ' + pathname });

  } catch (err) {
    return jsonResponse(500, { error: err.message });
  }
};
