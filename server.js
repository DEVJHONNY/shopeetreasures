const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const shopeeApi = require('./shopee_api');
const promoBot = require('./promo_bot');
const whatsappBot = require('./whatsapp_bot');

const PORT = process.env.PORT || 4000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function checkAuth(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get();
  const currentPassword = setting ? setting.value : 'Luc@S076140';
  return token === currentPassword;
}

// Helper para formataÃ§Ã£o de contagem de vendas com alto apelo visual
function formatSales(sales) {
  const num = parseInt(sales, 10);
  if (!num || isNaN(num) || num <= 0) {
    return 'Destaque Oficial';
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1).replace('.', ',')} mil vendidos`;
  }
  return `${num} vendidos`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Upsert padronizado de produtos obtidos da Shopee Open API
function upsertShopeeProduct(item, defaultCategory = 'Achadinhos') {
  if (!item || !item.productName || !item.offerLink) return null;

  const price = parseFloat(item.priceMin || item.priceMax || 0);
  if (price <= 0) return null;

  const discountPct = parseInt(item.priceDiscountRate || 0, 10);
  let originalPrice = null;
  if (discountPct > 0 && price > 0) {
    originalPrice = price / (1 - (discountPct / 100));
  }

  const salesFormatted = formatSales(item.sales);
  const rating = parseFloat(item.ratingStar || 4.8);
  const badge = rating >= 4.8 ? 'ðŸ”¥ Top Escolha' : 'â­ Verificado';
  const shopName = item.shopName || 'Loja Verificada na Shopee';

  const existing = db.prepare('SELECT id FROM products WHERE title = ?').get(item.productName);
  if (existing) {
    db.prepare(`
      UPDATE products 
      SET price_discount = ?, price_original = ?, discount_pct = ?, sales_count = ?, rating = ?, shop_name = COALESCE(?, shop_name), affiliate_link = ?, image_url = ?
      WHERE id = ?
    `).run(
      parseFloat(price.toFixed(2)),
      originalPrice ? parseFloat(originalPrice.toFixed(2)) : null,
      discountPct,
      salesFormatted,
      rating,
      shopName,
      item.offerLink,
      item.imageUrl,
      existing.id
    );
    return existing.id;
  } else {
    const insertStmt = db.prepare(`
      INSERT INTO products (title, description, price_original, price_discount, discount_pct, category, image_url, affiliate_link, badge, sales_count, rating, shop_name, video_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = insertStmt.run(
      item.productName,
      'Produto oficial verificado e selecionado pela curadoria ShopeeTreasures com link direto para a loja oficial.',
      originalPrice ? parseFloat(originalPrice.toFixed(2)) : null,
      parseFloat(price.toFixed(2)),
      discountPct,
      defaultCategory,
      item.imageUrl,
      item.offerLink,
      badge,
      salesFormatted,
      rating,
      shopName,
      null
    );
    return info.lastInsertRowid;
  }
}

// ==========================================
// AUTO-CRON ENGINE
// ==========================================
let cronTimer = null;
let cronStatus = {
  enabled: true,
  intervalHours: 6,
  lastSync: null,
  lastCount: 0,
  nextSync: null,
  isSyncing: false
};

async function executeAutoSync() {
  if (cronStatus.isSyncing) return;
  cronStatus.isSyncing = true;
  console.log(`[Auto-Cron] SincronizaÃ§Ã£o periÃ³dica iniciada (${new Date().toLocaleString('pt-BR')})...`);

  try {
    const targets = [
      { keyword: '',                   category: 'Destaques' },
      { keyword: 'fone bluetooth',     category: 'EletrÃ´nicos' },
      { keyword: 'smartwatch',         category: 'EletrÃ´nicos' },
      { keyword: 'cabo usb',           category: 'EletrÃ´nicos' },
      { keyword: 'mouse sem fio',      category: 'EletrÃ´nicos' },
      { keyword: 'utilidades cozinha', category: 'Casa & Cozinha' },
      { keyword: 'panela eletrica',    category: 'Casa & Cozinha' },
      { keyword: 'organizador',        category: 'Casa & Cozinha' },
      { keyword: 'skincare beleza',    category: 'Beleza' },
      { keyword: 'maquiagem',          category: 'Beleza' },
      { keyword: 'perfume',            category: 'Beleza' },
      { keyword: 'camiseta masculina', category: 'Moda' },
      { keyword: 'tenis feminino',     category: 'Moda' },
      { keyword: 'mochila',            category: 'Moda' },
      { keyword: 'copo termico',       category: 'AcessÃ³rios' },
      { keyword: 'garrafa inox',       category: 'AcessÃ³rios' },
      { keyword: 'suporte celular',    category: 'AcessÃ³rios' },
      { keyword: 'massageador',        category: 'SaÃºde & Esporte' },
      { keyword: 'halteres',           category: 'SaÃºde & Esporte' },
      { keyword: 'brinquedo infantil', category: 'BebÃªs & CrianÃ§as' },
    ];

    let totalImported = 0;
    for (const t of targets) {
      try {
        const nodes = await shopeeApi.fetchTopOffers({ keyword: t.keyword, limit: 30 });
        for (const item of nodes) {
          const pid = upsertShopeeProduct(item, t.category);
          if (pid) totalImported++;
        }
      } catch (err) {
        console.error(`[Auto-Cron] Erro na categoria ${t.category}:`, err.message);
      }
    }

    cronStatus.lastSync = new Date().toISOString();
    cronStatus.lastCount = totalImported;
    cronStatus.nextSync = new Date(Date.now() + cronStatus.intervalHours * 3600 * 1000).toISOString();

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_cron_sync', ?)").run(cronStatus.lastSync);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_cron_count', ?)").run(String(totalImported));

    console.log(`[Auto-Cron] SincronizaÃ§Ã£o concluÃ­da com sucesso! ${totalImported} produtos sincronizados.`);
  } catch (err) {
    console.error('[Auto-Cron] Erro na execuÃ§Ã£o:', err);
  } finally {
    cronStatus.isSyncing = false;
  }
}

function startAutoCron(hours = 6) {
  if (cronTimer) clearInterval(cronTimer);
  cronStatus.enabled = true;
  cronStatus.intervalHours = hours;
  cronStatus.nextSync = new Date(Date.now() + hours * 3600 * 1000).toISOString();

  const ms = hours * 3600 * 1000;
  cronTimer = setInterval(executeAutoSync, ms);
}

startAutoCron(6);

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = reqUrl.pathname;

  try {
    // ==========================================
    // ROTAS PÃšBLICAS
    // ==========================================

    if (pathname === '/api/settings' && req.method === 'GET') {
      const rows = db.prepare("SELECT key, value FROM settings WHERE key != 'admin_password'").all();
      const settings = {};
      for (const row of rows) settings[row.key] = row.value;
      return sendJson(res, 200, settings);
    }

    if (pathname === '/api/settings' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'NÃ£o autorizado' });
      const body = await parseBody(req);
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      for (const [k, v] of Object.entries(body)) {
        if (k !== 'admin_password') {
          stmt.run(k, String(v));
        }
      }
      return sendJson(res, 200, { success: true });
    }

    if (pathname === '/api/categories' && req.method === 'GET') {
      const rows = db.prepare("SELECT DISTINCT category FROM products WHERE is_active = 1 AND category != 'Busca'").all();
      const categories = rows.map(r => r.category).filter(Boolean);
      return sendJson(res, 200, ['Todos', ...categories]);
    }

    // OFERTAS RELÃ‚MPAGO (FLASH SALE COM CONTAGEM REGRESSIVA)
    if (pathname === '/api/homepage/flash-sale' && req.method === 'GET') {
      const flashOffers = db.prepare(`
        SELECT * FROM products 
        WHERE is_active = 1 AND discount_pct >= 35 
        ORDER BY discount_pct DESC, rating DESC 
        LIMIT 10
      `).all();
      return sendJson(res, 200, flashOffers);
    }

    // BUSCA INTELIGENTE EM TEMPO REAL (LOCAL + SHOPEE OPEN API)
    // Suporta: ?q=... &cat=... &minPrice=... &maxPrice=... &sort=...
    if (pathname === '/api/products' && req.method === 'GET') {
      const q = (reqUrl.searchParams.get('q') || '').trim();
      const cat = reqUrl.searchParams.get('cat') || '';
      const minPrice = parseFloat(reqUrl.searchParams.get('minPrice')) || 0;
      const maxPrice = parseFloat(reqUrl.searchParams.get('maxPrice')) || 999999;
      const sort = reqUrl.searchParams.get('sort') || 'default';

      let liveProductIds = [];

      // 1. Se o usuÃ¡rio buscou por palavra-chave, consulta SEMPRE a Shopee Open API em tempo real!
      if (q) {
        try {
          const liveNodes = await shopeeApi.fetchTopOffers({ keyword: q, limit: 30 });
          for (const item of liveNodes) {
            // Salva itens pesquisados com categoria 'Busca' para nÃ£o poluir a vitrine principal
            const pid = upsertShopeeProduct(item, 'Busca');
            if (pid) liveProductIds.push(pid);
          }
        } catch (apiErr) {
          console.warn('[Live Search] Erro ao consultar Shopee API:', apiErr.message);
        }
      }

      // 2. Monta os produtos a retornar
      let products = [];
      if (q) {
        // A) Produtos trazidos diretamente da busca da Shopee API
        if (liveProductIds.length > 0) {
          const placeholders = liveProductIds.map(() => '?').join(',');
          products = db.prepare(`SELECT * FROM products WHERE id IN (${placeholders}) AND is_active = 1`).all(...liveProductIds);
        }

        // B) Busca tambÃ©m por palavras-chave na base local (split por espaÃ§os e sÃ­mbolos)
        const words = q.toLowerCase().replace(/[^a-z0-9Ã¡Ã©Ã­Ã³ÃºÃ¢ÃªÃ®Ã´Ã»Ã£ÃµÃ§]/gi, ' ').split(/\s+/).filter(w => w.length >= 2);
        if (words.length > 0) {
          let sql = 'SELECT * FROM products WHERE is_active = 1 AND (';
          sql += words.map(() => '(title LIKE ? OR description LIKE ?)').join(' OR ');
          sql += ')';
          const params = [];
          words.forEach(w => params.push(`%${w}%`, `%${w}%`));

          if (cat && cat !== 'Todos') {
            sql += ' AND category = ?';
            params.push(cat);
          }

          sql += ' ORDER BY id DESC LIMIT 50';
          const localMatches = db.prepare(sql).all(...params);
          const existingIds = new Set(products.map(p => p.id));
          for (const loc of localMatches) {
            if (!existingIds.has(loc.id)) {
              products.push(loc);
              existingIds.add(loc.id);
            }
          }
        }
      } else {
        // C) Vitrine Principal Limpa (sem poluiÃ§Ã£o de buscas anteriores)
        let query = 'SELECT * FROM products WHERE is_active = 1';
        const params = [];

        if (cat && cat !== 'Todos') {
          query += ' AND category = ?';
          params.push(cat);
        } else {
          // Na pÃ¡gina inicial geral, exibe apenas os produtos reais catalogados
          query += " AND category != 'Busca'";
        }

        if (sort === 'price_asc') {
          query += ' ORDER BY price_discount ASC';
        } else if (sort === 'price_desc') {
          query += ' ORDER BY price_discount DESC';
        } else if (sort === 'discount_desc') {
          query += ' ORDER BY discount_pct DESC';
        } else if (sort === 'sales_desc') {
          query += ' ORDER BY clicks DESC, id DESC';
        } else {
          query += " ORDER BY (CASE WHEN category = 'Destaques' OR category = 'Achadinhos VIP' THEN 1 ELSE 2 END), rating DESC, id DESC";
        }

        products = db.prepare(query).all(...params);
      }

      // Filtro de preÃ§o
      if (minPrice > 0 || maxPrice < 999999) {
        products = products.filter(p => p.price_discount >= minPrice && p.price_discount <= maxPrice);
      }

      // OrdenaÃ§Ã£o
      if (sort === 'price_asc') {
        products.sort((a, b) => a.price_discount - b.price_discount);
      } else if (sort === 'price_desc') {
        products.sort((a, b) => b.price_discount - a.price_discount);
      } else if (sort === 'discount_desc') {
        products.sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0));
      }

      return sendJson(res, 200, products);
    }

    // Detalhe de Produto Individual /api/products/:id
    const matchProductDetail = pathname.match(/^\/api\/products\/(\d+)$/);
    if (matchProductDetail && req.method === 'GET') {
      const id = matchProductDetail[1];
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(id);
      if (!product) {
        return sendJson(res, 404, { error: 'Produto nÃ£o encontrado' });
      }
      return sendJson(res, 200, product);
    }

    // Redirecionador Inteligente /r/:id (Link curto rastreado)
    const matchRedirect = pathname.match(/^\/r\/(\d+)$/);
    if (matchRedirect && req.method === 'GET') {
      const id = matchRedirect[1];
      const product = db.prepare('SELECT affiliate_link FROM products WHERE id = ?').get(id);

      if (product && product.affiliate_link) {
        db.prepare('UPDATE products SET clicks = clicks + 1 WHERE id = ?').run(id);
        res.writeHead(302, { 'Location': product.affiliate_link });
        return res.end();
      } else {
        res.writeHead(302, { 'Location': '/' });
        return res.end();
      }
    }

    const matchClick = pathname.match(/^\/api\/click\/(\d+)$/);
    if (matchClick && req.method === 'POST') {
      const id = matchClick[1];
      db.prepare('UPDATE products SET clicks = clicks + 1 WHERE id = ?').run(id);
      const product = db.prepare('SELECT affiliate_link FROM products WHERE id = ?').get(id);
      return sendJson(res, 200, { success: true, affiliate_link: product ? product.affiliate_link : null });
    }

    // ==========================================
    // ROBÃ” DE OFERTAS WHATSAPP
    // ==========================================
    if (pathname === '/api/promo/latest' && req.method === 'GET') {
      if (fs.existsSync(promoBot.OUTPUT_FILE)) {
        try {
          const data = JSON.parse(fs.readFileSync(promoBot.OUTPUT_FILE, 'utf-8'));
          return sendJson(res, 200, data);
        } catch (e) {}
      }
      try {
        const result = await promoBot.generatePromos();
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    if ((pathname === '/api/promo/generate' || pathname === '/api/admin/promo-trigger') && (req.method === 'POST' || req.method === 'GET')) {
      try {
        const result = await promoBot.generatePromos();
        return sendJson(res, 200, { success: true, ...result });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // ==========================================
    // CARREGAR MAIS PRODUTOS DIRETAMENTE DA SHOPEE API
    // ==========================================
    if (pathname === '/api/shopee/load-more' && req.method === 'GET') {
      const cat = reqUrl.searchParams.get('cat') || '';
      const q = (reqUrl.searchParams.get('q') || '').trim();
      const page = parseInt(reqUrl.searchParams.get('page')) || 1;
      const kw = q || (cat && cat !== 'Todos' ? cat : '');

      try {
        const nodes = await shopeeApi.fetchTopOffers({ keyword: kw, page, limit: 30 });
        let newItems = 0;
        const loadedIds = [];
        for (const item of nodes) {
          const pid = upsertShopeeProduct(item, cat && cat !== 'Todos' ? cat : 'Achadinhos');
          if (pid) {
            loadedIds.push(pid);
            newItems++;
          }
        }

        // Retorna todos os produtos do banco atualizados para este filtro
        let returnProducts = [];
        if (q) {
          if (loadedIds.length > 0) {
            const placeholders = loadedIds.map(() => '?').join(',');
            returnProducts = db.prepare(`SELECT * FROM products WHERE id IN (${placeholders}) AND is_active = 1`).all(...loadedIds);
          }
          const words = q.toLowerCase().replace(/[^a-z0-9Ã¡Ã©Ã­Ã³ÃºÃ¢ÃªÃ®Ã´Ã»Ã£ÃµÃ§]/gi, ' ').split(/\s+/).filter(w => w.length >= 2);
          if (words.length > 0) {
            let sql = 'SELECT * FROM products WHERE is_active = 1 AND (';
            sql += words.map(() => '(title LIKE ? OR description LIKE ?)').join(' OR ');
            sql += ') ORDER BY id DESC LIMIT 50';
            const params = [];
            words.forEach(w => params.push(`%${w}%`, `%${w}%`));
            const localMatches = db.prepare(sql).all(...params);
            const existingIds = new Set(returnProducts.map(p => p.id));
            for (const loc of localMatches) {
              if (!existingIds.has(loc.id)) {
                returnProducts.push(loc);
                existingIds.add(loc.id);
              }
            }
          }
        } else {
          let query = 'SELECT * FROM products WHERE is_active = 1';
          const params = [];
          if (cat && cat !== 'Todos') {
            query += ' AND category = ?';
            params.push(cat);
          }
          query += ' ORDER BY id DESC';
          returnProducts = db.prepare(query).all(...params);
        }

        return sendJson(res, 200, { success: true, newImported: newItems, total: returnProducts.length, products: returnProducts });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // ==========================================
    // AUTOMAÃ‡ÃƒO COM A SHOPEE OPEN API
    // ==========================================

    if (pathname === '/api/shopee/convert-link' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.url) return sendJson(res, 400, { error: 'URL da Shopee nÃ£o informada.' });

      try {
        const shortLink = await shopeeApi.generateAffiliateLink(body.url);
        return sendJson(res, 200, { success: true, shortLink });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    if (pathname === '/api/shopee/sync' && req.method === 'POST') {
      const body = await parseBody(req);
      const keyword = body.keyword || '';
      const limit = parseInt(body.limit) || 20;

      try {
        const nodes = await shopeeApi.fetchTopOffers({ keyword, limit });
        const insertStmt = db.prepare(`
          INSERT INTO products (title, description, price_original, price_discount, discount_pct, category, image_url, affiliate_link, badge, sales_count, rating, shop_name, video_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let imported = 0;
        for (const item of nodes) {
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

          insertStmt.run(
            item.productName,
            'Produto oficial verificado e selecionado pela curadoria ShopeeTreasures com link direto para a loja oficial.',
            originalPrice ? parseFloat(originalPrice.toFixed(2)) : null,
            parseFloat(price.toFixed(2)),
            discountPct,
            body.category || 'Destaques',
            item.imageUrl,
            item.offerLink,
            item.ratingStar >= 4.8 ? 'Destaque' : 'Indicado',
            salesFormatted,
            parseFloat(item.ratingStar || 4.8),
            item.shopName || 'Loja Verificada na Shopee',
            null
          );
          imported++;
        }

        return sendJson(res, 200, { success: true, imported, total: nodes.length });
      } catch (err) {
        console.error('Erro na sincronizaÃ§Ã£o Shopee:', err);
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // ==========================================
    // ROTAS DO CRON
    // ==========================================

    if (pathname === '/api/admin/cron-status' && req.method === 'GET') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'NÃ£o autorizado' });
      return sendJson(res, 200, cronStatus);
    }

    if (pathname === '/api/admin/cron-trigger' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'NÃ£o autorizado' });
      executeAutoSync();
      return sendJson(res, 200, { success: true, message: 'Auto-sync disparado em segundo plano.' });
    }

    if (pathname === '/api/admin/cron-config' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'NÃ£o autorizado' });
      const body = await parseBody(req);
      const hours = parseInt(body.intervalHours) || 6;

      if (body.enabled) {
        startAutoCron(hours);
      } else {
        if (cronTimer) clearInterval(cronTimer);
        cronStatus.enabled = false;
        cronStatus.nextSync = null;
      }
      return sendJson(res, 200, { success: true, cronStatus });
    }

    // ==========================================
    // ROTAS DO ROBÃ” AUTOMÃTICO WHATSAPP
    // ==========================================

    if (pathname === '/api/admin/whatsapp/status' && req.method === 'GET') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'NÃ£o autorizado' });
      return sendJson(res, 200, whatsappBot.getStatus());
    }

    if (pathname === '/api/admin/whatsapp/connect' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'NÃ£o autorizado' });
      whatsappBot.initWhatsApp(true);
      return sendJson(res, 200, { success: true, message: 'Iniciando conexÃ£o com WhatsApp.' });
    }

    if (pathname === '/api/admin/whatsapp/disconnect' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'NÃ£o autorizado' });
      await whatsappBot.disconnectWhatsApp();
      return sendJson(res, 200, { success: true, message: 'WhatsApp desconectado com sucesso.' });
    }

    if (pathname === '/api/admin/whatsapp/config' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'NÃ£o autorizado' });
      const body = await parseBody(req);
      const newStatus = whatsappBot.setConfig({
        autoPostEnabled: body.autoPostEnabled,
        intervalMinutes: parseInt(body.intervalMinutes) || 60
      });
      return sendJson(res, 200, { success: true, status: newStatus });
    }

    if (pathname === '/api/admin/whatsapp/send-test' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'NÃ£o autorizado' });
      try {
        const result = await whatsappBot.dispatchOffer(null, true);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }

    // Buscar produto por link (do site ou da Shopee) e gerar prévia pronta para WhatsApp
    if (pathname === '/api/admin/whatsapp/preview-product-link' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'Não autorizado' });
      try {
        const body = await parseBody(req);
        const link = (body.link || '').trim();
        if (!link) throw new Error('Por favor, informe o link do produto.');

        let product = null;

        let targetLink = link;

        // Se for link encurtado da Shopee (s.shopee.com.br ou shp.ee), segue redirecionamento para pegar URL completa
        if (targetLink.includes('s.shopee.com.br') || targetLink.includes('shp.ee')) {
          try {
            const redirectRes = await fetch(targetLink, { redirect: 'follow' });
            if (redirectRes && redirectRes.url && redirectRes.url !== targetLink) {
              targetLink = redirectRes.url;
            }
          } catch (e) {}
        }

        // 1. Tenta extrair ID numérico do produto (do site ou Shopee)
        let extractedId = null;
        const matchSite = targetLink.match(/\/produto\/(\d+)/i);
        const matchShortR = targetLink.match(/\/r\/(\d+)/i);
        const matchShopeeFormat = targetLink.match(/-i\.(\d+)\.(\d+)/i); // slug-i.SHOPID.ITEMID
        const matchDigits = targetLink.match(/^(\d{5,})$/);

        // Para URLs shopee.com.br/slug/SHOPID/ITEMID?... → pega o ÚLTIMO segmento numérico longo da path
        const pathBeforeQuery = targetLink.split('?')[0];
        const numericSegments = pathBeforeQuery.split('/').filter(s => /^\d{6,}$/.test(s));
        const matchPathId = numericSegments.length > 0 ? numericSegments[numericSegments.length - 1] : null;

        if (matchSite) extractedId = matchSite[1];
        else if (matchShortR) extractedId = matchShortR[1];
        else if (matchShopeeFormat) extractedId = matchShopeeFormat[2]; // item_id é o SEGUNDO número
        else if (matchPathId) extractedId = matchPathId;                // último segmento numérico longo
        else if (matchDigits) extractedId = matchDigits[1];

        console.log(`[PreviewLink] URL após redirect: ${targetLink}`);
        console.log(`[PreviewLink] ID extraído: ${extractedId}`);

        // 2. Procura no banco de dados local por ID
        if (extractedId) {
          product = db.prepare('SELECT * FROM products WHERE id = ?').get(extractedId);
        }

        // 3. Se não achou por ID, tenta buscar por link de afiliado caso tenha sido colado o link direto
        if (!product) {
          product = db.prepare('SELECT * FROM products WHERE affiliate_link = ? OR affiliate_link LIKE ?').get(link, `%${link.split('?')[0]}%`);
        }

        // 4. Se ainda não achou no banco local, busca na API oficial do Netlify
        if (!product && extractedId) {
          try {
            const netlifyRes = await fetch('https://shopeetreasures-vip.netlify.app/api/products');
            if (netlifyRes.ok) {
              const netlifyProducts = await netlifyRes.json();
              const found = netlifyProducts.find(p => String(p.id) === String(extractedId));
              if (found) {
                // Insere no banco local para ficar disponível também na vitrine admin!
                const newId = upsertShopeeProduct({
                  itemId: found.id,
                  productName: found.title,
                  priceMin: found.price_discount,
                  priceMax: found.price_original || found.price_discount,
                  priceDiscountRate: found.discount_pct,
                  imageUrl: found.image_url,
                  offerLink: found.affiliate_link,
                  sales: found.sales_count,
                  ratingStar: found.rating,
                  shopName: found.shop_name
                }, found.category || 'Destaques');

                product = db.prepare('SELECT * FROM products WHERE id = ?').get(newId) || {
                  id: found.id,
                  title: found.title,
                  price_discount: found.price_discount,
                  price_original: found.price_original,
                  discount_pct: found.discount_pct,
                  category: found.category || 'Destaques',
                  image_url: found.image_url,
                  affiliate_link: found.affiliate_link,
                  sales_count: found.sales_count,
                  rating: found.rating,
                  shop_name: found.shop_name
                };
              }
            }
          } catch (e) {
            console.warn('[PreviewLink] Erro ao consultar Netlify API:', e.message);
          }
        }

        // 4.5. Tenta buscar produto diretamente na Shopee Affiliate API por itemId
        if (!product && extractedId) {
          try {
            console.log(`[PreviewLink] Buscando produto por itemId ${extractedId} na Shopee API...`);
            const apiProduct = await shopeeApi.fetchProductById(extractedId);
            if (apiProduct && apiProduct.productName) {
              console.log(`[PreviewLink] Produto encontrado na Shopee API: ${apiProduct.productName}`);
              const price = parseFloat(apiProduct.priceMin || 0);
              const discount = parseInt(apiProduct.priceDiscountRate || 0, 10);
              const origPrice = discount > 0 && price > 0 ? price / (1 - discount / 100) : price;
              product = {
                id: extractedId,
                title: apiProduct.productName,
                price_discount: price,
                price_original: origPrice,
                discount_pct: discount,
                category: 'Achadinhos',
                image_url: apiProduct.imageUrl || 'https://cf.shopee.com.br/file/br-11134207-820lt-msq8pkzchmh355',
                affiliate_link: apiProduct.offerLink || link,
                sales_count: apiProduct.sales || 'Destaque Oficial',
                rating: parseFloat(apiProduct.ratingStar || 4.9),
                shop_name: apiProduct.shopName || 'Loja Shopee'
              };
            }
          } catch (e) {
            console.warn('[PreviewLink] Erro ao buscar produto por itemId na Shopee API:', e.message);
          }
        }

        // 5. Se for um link direto da Shopee e não temos no banco, gera link afiliado com dados do slug
        if (!product && (targetLink.includes('shopee.com') || targetLink.includes('shp.ee') || link.includes('s.shopee.com.br'))) {

          try {
            const affLink = await shopeeApi.generateAffiliateLink(link);

            // Apenas o formato /produto-nome-i.SHOPID.ITEMID tem o nome real no slug
            // O formato /username/SHOPID/ITEMID não tem o nome do produto na URL
            const slugMatchFormat1 = targetLink.match(/shopee\.com\.br\/([^\/\?]+)-i\.\d+\.\d+/i);

            let productTitle = extractedId ? `Produto Shopee #${extractedId}` : 'Produto Selecionado na Shopee';
            let productImg = 'https://cf.shopee.com.br/file/br-11134207-820lt-msq8pkzchmh355';
            let productShop = 'Loja Oficial Shopee';
            let productPrice = 0;
            let productDiscount = 0;
            let productOrigPrice = 0;

            if (slugMatchFormat1) {
              // Capitaliza o slug como título legível
              productTitle = decodeURIComponent(slugMatchFormat1[1])
                .replace(/-/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
                .trim();
              console.log(`[PreviewLink] Título extraído do slug: ${productTitle}`);
            }

            product = {
              id: extractedId || ('custom_' + Date.now()),
              title: productTitle,
              price_discount: productPrice,
              price_original: productOrigPrice,
              discount_pct: productDiscount,
              category: 'Achadinhos',
              image_url: productImg,
              affiliate_link: affLink || link,
              sales_count: 'Destaque Oficial',
              rating: 4.9,
              shop_name: productShop
            };
          } catch (e) {
            console.warn('[PreviewLink] Erro ao converter link Shopee:', e.message);
          }
        }


        if (!product) {
          throw new Error('Não foi possível localizar as informações do produto com o link informado. Verifique se o link está correto.');
        }

        const messageText = whatsappBot.formatProductOffer(product);
        return sendJson(res, 200, {
          success: true,
          product,
          messageText
        });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }

    // Enviar oferta específica selecionada pelo painel ou customizada por link
    if (pathname === '/api/admin/whatsapp/send-offer' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'Não autorizado' });
      try {
        const body = await parseBody(req);
        let product = null;
        if (body.productId) {
          product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(body.productId);
        }
        if (!product && body.product) {
          product = body.product;
        }
        if (!product) throw new Error('Produto não informado ou não encontrado na base de dados');

        if (body.customMessage) {
          product.customMessage = body.customMessage;
        }

        const result = await whatsappBot.dispatchOffer(product, true);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }

    // Enviar enquete interativa nativa para o grupo VIP do WhatsApp
    if (pathname === '/api/admin/whatsapp/send-poll' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'Não autorizado' });
      try {
        const body = await parseBody(req);
        const result = await whatsappBot.dispatchPoll({
          name: body.name,
          values: body.values,
          selectableCount: body.selectableCount !== undefined ? body.selectableCount : 0
        });
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }


    // ==========================================
    // ROTAS DO PAINEL ADMIN
    // ==========================================

    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const body = await parseBody(req);
      const setting = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get();
      const currentPassword = setting ? setting.value : 'Luc@S076140';

      if (body.password === currentPassword) {
        return sendJson(res, 200, { success: true, token: currentPassword });
      } else {
        return sendJson(res, 401, { success: false, error: 'Senha incorreta.' });
      }
    }

    if (pathname === '/api/admin/products' && req.method === 'GET') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'NÃ£o autorizado' });
      const products = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
      return sendJson(res, 200, products);
    }

    if (pathname === '/api/admin/products' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'NÃ£o autorizado' });
      const body = await parseBody(req);

      const { title, description, price_original, price_discount, category, image_url, affiliate_link, badge, sales_count, rating, shop_name, video_url } = body;
      if (!title || !price_discount || !image_url || !affiliate_link) {
        return sendJson(res, 400, { error: 'Preencha tÃ­tulo, preÃ§o da oferta, imagem e link de afiliado.' });
      }

      const pOriginal = parseFloat(price_original) || null;
      const pDiscount = parseFloat(price_discount);
      let discountPct = null;
      if (pOriginal && pOriginal > pDiscount) {
        discountPct = Math.round(((pOriginal - pDiscount) / pOriginal) * 100);
      }

      const stmt = db.prepare(`
        INSERT INTO products (title, description, price_original, price_discount, discount_pct, category, image_url, affiliate_link, badge, sales_count, rating, shop_name, video_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const info = stmt.run(
        title,
        description || '',
        pOriginal,
        pDiscount,
        discountPct,
        category || 'Geral',
        image_url,
        affiliate_link,
        badge || 'Indicado',
        sales_count || '1,2 mil vendidos',
        rating || 4.8,
        shop_name || 'Loja Verificada na Shopee',
        video_url || null
      );

      return sendJson(res, 200, { success: true, id: info.lastInsertRowid });
    }

    const matchDelete = pathname.match(/^\/api\/admin\/products\/(\d+)$/);
    if (matchDelete && req.method === 'DELETE') {
      if (!checkAuth(req)) return sendJson(res, 401, { error: 'NÃ£o autorizado' });
      const id = matchDelete[1];
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
      return sendJson(res, 200, { success: true });
    }

    // PÃ¡gina amigÃ¡vel de produto com metatags OpenGraph para WhatsApp / Redes Sociais
    const matchProdPage = pathname.match(/^\/produto\/(\d+)$/);
    if (matchProdPage && req.method === 'GET') {
      const prodId = matchProdPage[1];
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf-8');
        if (product) {
          const ogTags = `
    <!-- OpenGraph Tags para visualizaÃ§Ã£o no WhatsApp e Redes Sociais -->
    <meta property="og:type" content="product" />
    <meta property="og:title" content="${escapeHtml(product.title)}" />
    <meta property="og:description" content="ðŸ”¥ Por apenas R$ ${product.price_discount.toFixed(2).replace('.', ',')} na Shopee Oficial! â­ ${product.rating || '4.8'} â€¢ Loja: ${escapeHtml(product.shop_name || 'Verificada na Shopee')}" />
    <meta property="og:image" content="${product.image_url}" />
    <meta property="og:image:secure_url" content="${product.image_url}" />
    <meta property="og:image:width" content="600" />
    <meta property="og:image:height" content="600" />
    <meta property="og:url" content="${product.affiliate_link}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(product.title)}" />
    <meta name="twitter:description" content="ðŸ”¥ Por apenas R$ ${product.price_discount.toFixed(2).replace('.', ',')} na Shopee Oficial!" />
    <meta name="twitter:image" content="${product.image_url}" />
          `;
          html = html.replace('</head>', `${ogTags}\n</head>`);
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }
    }

    // PÃ¡gina VIP Landing Page (Estilo Buboflow)
    if ((pathname === '/vip' || pathname === '/grupo') && req.method === 'GET') {
      const vipPath = path.join(PUBLIC_DIR, 'vip.html');
      if (fs.existsSync(vipPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(fs.readFileSync(vipPath, 'utf-8'));
      }
    }

    // ==========================================
    // ARQUIVOS ESTÃTICOS
    // ==========================================
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 - NÃ£o encontrado');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });

  } catch (err) {
    console.error('Erro no servidor:', err);
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`Vitrine Shopee Oficial: http://localhost:${PORT}`);
  console.log(`Painel Administrativo: http://localhost:${PORT}/admin.html`);
  console.log(`Busca em Tempo Real com Shopee API: ATIVA`);
  console.log(`Auto-Cron em Segundo Plano: ATIVO`);
  console.log(`=============================================================\n`);
});

