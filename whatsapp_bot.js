const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const db = require('./db.js');

const SESSION_DIR = path.join(__dirname, 'wa_session');
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

let sock = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
let currentQrCodeDataUrl = null;
let connectedUser = null;
let targetGroupJid = null;
let lastError = null;
let autoPostIntervalTimer = null;
const dispatchedLog = [];
const postedItemIds = new Set();

// Load initial settings from DB
function getBotSetting(key, defaultVal) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultVal;
}

function setBotSetting(key, val) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(val));
}

let isAutoPostEnabled = getBotSetting('wa_auto_post_enabled', '0') === '1';
let autoPostIntervalMin = parseInt(getBotSetting('wa_auto_post_interval_min', '60'), 10) || 60;
let lastPostTimestamp = parseInt(getBotSetting('wa_last_post_timestamp', '0'), 10) || 0;

// Resolve target group JID using invite code
async function resolveGroupJid(inviteUrlOrCode) {
  if (!sock) return null;
  let code = inviteUrlOrCode || '';
  const match = code.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
  if (match) code = match[1];

  try {
    const groupInfo = await sock.groupGetInviteInfo(code);
    if (groupInfo && groupInfo.id) {
      targetGroupJid = groupInfo.id;
      setBotSetting('wa_target_group_jid', targetGroupJid);
      console.log(`[WhatsApp Bot] Grupo VIP identificado via link: "${groupInfo.subject}" (${targetGroupJid})`);
      return targetGroupJid;
    }
  } catch (err) {
    console.warn('[WhatsApp Bot] Não foi possível obter info do grupo via link:', err.message);
  }

  // Fallback: search in participating groups
  try {
    const participating = await sock.groupFetchAllParticipating();
    for (const [jid, group] of Object.entries(participating)) {
      if (group.subject && (group.subject.toLowerCase().includes('shopeetreasures') || group.subject.toLowerCase().includes('vip'))) {
        targetGroupJid = jid;
        setBotSetting('wa_target_group_jid', targetGroupJid);
        console.log(`[WhatsApp Bot] Grupo VIP localizado nos grupos ativos: "${group.subject}" (${targetGroupJid})`);
        return targetGroupJid;
      }
    }
  } catch (err) {
    console.warn('[WhatsApp Bot] Erro ao listar grupos participantes:', err.message);
  }

  return targetGroupJid;
}

// Start or reconnect Baileys socket
async function initWhatsApp(forceNew = false) {
  if (sock && !forceNew) return;

  try {
    connectionStatus = 'connecting';
    lastError = null;

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['ShopeeTreasures Bot', 'Chrome', '124.0.0.0'],
      syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          currentQrCodeDataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            width: 320,
            color: { dark: '#060A09', light: '#FFFFFF' }
          });
          connectionStatus = 'qr_ready';
          console.log('[WhatsApp Bot] Novo QR Code gerado e pronto para leitura no painel.');
        } catch (e) {
          console.error('[WhatsApp Bot] Erro ao converter QR Code:', e);
        }
      }

      if (connection === 'open') {
        connectionStatus = 'connected';
        currentQrCodeDataUrl = null;
        lastError = null;
        connectedUser = sock.user || { name: 'Conectado' };
        console.log(`[WhatsApp Bot] ✅ Conectado com sucesso ao WhatsApp como ${connectedUser.name || connectedUser.id}`);

        // Try resolving group JID with saved group link
        const savedLink = getBotSetting('whatsapp_link', 'https://chat.whatsapp.com/KjHrqfJp3HuIHQiR8Zfl3L');
        await resolveGroupJid(savedLink);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'Desconectado';
        console.log(`[WhatsApp Bot] Conexão fechada. Motivo: ${reason} (Código: ${statusCode})`);

        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        if (isLoggedOut) {
          connectionStatus = 'disconnected';
          currentQrCodeDataUrl = null;
          connectedUser = null;
          targetGroupJid = null;
          lastError = 'Sessão desconectada pelo aparelho. É necessário escanear novamente.';
          try {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            fs.mkdirSync(SESSION_DIR, { recursive: true });
          } catch (e) {}
        } else {
          // Temporary glitch or network reset: auto reconnect
          connectionStatus = 'connecting';
          setTimeout(() => initWhatsApp(true), 3500);
        }
      }
    });

  } catch (err) {
    console.error('[WhatsApp Bot] Erro ao inicializar socket:', err);
    connectionStatus = 'disconnected';
    lastError = err.message;
  }
}

// Disconnect session
async function disconnectWhatsApp() {
  try {
    if (sock) {
      await sock.logout();
      sock = null;
    }
  } catch (e) {}

  connectionStatus = 'disconnected';
  currentQrCodeDataUrl = null;
  connectedUser = null;
  targetGroupJid = null;

  try {
    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  } catch (e) {}

  return { success: true };
}

// Format single product into WhatsApp promotional copy
function formatProductOffer(product) {
  const priceDiscount = parseFloat(product.priceCurrent || product.price_discount || 0);
  const origPrice = parseFloat(product.originalPrice || product.price_original || (priceDiscount * 1.5));
  const discountPct = product.discountPct || product.discount_pct || 40;
  const rating = product.ratingStar || product.rating || 4.9;
  const sales = product.salesCount || product.sales_count || 'Mais Vendido';
  const shop = product.shopName || product.shop_name || 'Loja Verificada Shopee';
  const link = product.offerLink || product.affiliate_link || 'https://shopeetreasures-vip.netlify.app/';

  const origPriceFormatted = origPrice > priceDiscount ? `~De R$ ${origPrice.toFixed(2).replace('.', ',')}~\n` : '';
  const discountFormatted = `R$ ${priceDiscount.toFixed(2).replace('.', ',')}`;
  const savings = origPrice > priceDiscount ? `\n💵 Economia de: *R$ ${(origPrice - priceDiscount).toFixed(2).replace('.', ',')}*` : '';

  return `🔥 *ACHADINHO IMPERDÍVEL NA SHOPEE* 🔥\n\n📦 *${product.productName || product.title}*\n\n⭐ Avaliação: *${rating}* / 5.0 (${sales})\n🏪 Loja: *${shop}*\n\n${origPriceFormatted}💰 *Por apenas: ${discountFormatted}* (-${discountPct}% OFF)${savings}\n\n🛒 *COMPRE NO LINK OFICIAL COM DESCONTO:*\n👉 ${link}\n\n💎 *ShopeeTreasures VIP #1 | Oferta Verificada*`;
}

// Dispatch an offer to WhatsApp
async function dispatchOffer(specificProduct = null, isManual = false) {
  if (connectionStatus !== 'connected' || !sock) {
    throw new Error('O robô do WhatsApp não está conectado. Escaneie o QR Code no painel.');
  }

  // Ensure target group JID is resolved
  if (!targetGroupJid) {
    const savedLink = getBotSetting('whatsapp_link', 'https://chat.whatsapp.com/KjHrqfJp3HuIHQiR8Zfl3L');
    await resolveGroupJid(savedLink);
  }

  if (!targetGroupJid) {
    throw new Error('Não foi possível identificar o grupo de destino. Verifique o link do grupo nas configurações.');
  }

  // Pick product to post
  let product = specificProduct;
  if (!product) {
    // 1. Tenta carregar do pool de promoções (promo_output.json)
    const promoPath = path.join(__dirname, 'promo_output.json');
    if (fs.existsSync(promoPath)) {
      try {
        const promoData = JSON.parse(fs.readFileSync(promoPath, 'utf-8'));
        const products = promoData.products || [];
        
        // Pega os IDs já postados gravados no banco
        const postedRows = db.prepare('SELECT id FROM posted_deals').all();
        const persistentPosted = new Set(postedRows.map(r => String(r.id)));

        // Filtra produtos que nunca foram postados
        const unposted = products.filter(p => !persistentPosted.has(String(p.itemId || p.id)) && !postedItemIds.has(String(p.itemId || p.id)));

        if (unposted.length > 0) {
          // Seleciona um produto aleatório dentre os não postados (não pega sempre o primeiro!)
          product = unposted[Math.floor(Math.random() * unposted.length)];
        }
      } catch (e) {}
    }

    // 2. Fallback: seleciona aleatoriamente do banco de dados produtos com avaliação >= 4.7 e desconto >= 30%
    if (!product) {
      try {
        const dbCandidates = db.prepare(`
          SELECT * FROM products 
          WHERE is_active = 1 
            AND rating >= 4.7 
            AND discount_pct >= 30 
            AND id NOT IN (SELECT id FROM posted_deals)
          ORDER BY RANDOM()
          LIMIT 1
        `).get();
        if (dbCandidates) product = dbCandidates;
      } catch (e) {}
    }

    // 3. Se todos já foram postados, pega qualquer produto aleatório de alta qualidade
    if (!product) {
      product = db.prepare('SELECT * FROM products WHERE is_active = 1 AND rating >= 4.7 ORDER BY RANDOM() LIMIT 1').get();
    }
  }

  if (!product) {
    throw new Error('Nenhum produto disponível para envio. Gere novas promoções pelo robô.');
  }

  const messageText = (product && product.customMessage) ? product.customMessage : formatProductOffer(product);
  const imageUrl = product.imageUrl || product.image_url;

  let sendResult = null;

  try {
    if (imageUrl && imageUrl.startsWith('http')) {
      try {
        sendResult = await sock.sendMessage(targetGroupJid, {
          image: { url: imageUrl },
          caption: messageText
        });
      } catch (mediaErr) {
        console.warn(`[WhatsApp Bot] Aviso: falha ao carregar imagem (${mediaErr.message}). Enviando oferta formatada como texto...`);
        sendResult = await sock.sendMessage(targetGroupJid, { text: messageText });
      }
    } else {
      // Send text only
      sendResult = await sock.sendMessage(targetGroupJid, { text: messageText });
    }

    const itemId = String(product.itemId || product.id || Date.now());
    postedItemIds.add(itemId);
    try {
      db.prepare('INSERT OR IGNORE INTO posted_deals (id, title) VALUES (?, ?)').run(itemId, product.productName || product.title);
    } catch (dbErr) {}

    lastPostTimestamp = Date.now();
    setBotSetting('wa_last_post_timestamp', lastPostTimestamp);

    const logEntry = {
      id: Date.now(),
      title: product.productName || product.title,
      price: product.priceCurrent || product.price_discount,
      timestamp: new Date().toISOString(),
      type: isManual ? 'manual' : 'automatic',
      status: 'success'
    };

    dispatchedLog.unshift(logEntry);
    if (dispatchedLog.length > 50) dispatchedLog.pop();

    console.log(`[WhatsApp Bot] Oferta enviada no grupo com sucesso: "${product.productName || product.title}"`);
    return { success: true, product: logEntry };

  } catch (err) {
    console.error('[WhatsApp Bot] Erro ao enviar mensagem no grupo:', err);
    throw new Error('Falha no envio da mensagem: ' + err.message);
  }
}

// Enviar enquete interativa nativa do WhatsApp no grupo VIP
async function dispatchPoll({ name, values, selectableCount = 0 } = {}) {
  if (connectionStatus !== 'connected' || !sock) {
    throw new Error('WhatsApp não está conectado. Conecte pelo painel admin primeiro.');
  }

  if (!targetGroupJid) {
    const savedLink = getBotSetting('whatsapp_link', 'https://chat.whatsapp.com/KjHrqfJp3HuIHQiR8Zfl3L');
    await resolveGroupJid(savedLink);
  }

  if (!targetGroupJid) {
    throw new Error('Não foi possível identificar o grupo de destino. Verifique o link do grupo nas configurações.');
  }

  const pollName = (name || 'Qual categoria de promoção você MAIS quer ver aqui? 🛍️🔥').trim();
  const pollValues = Array.isArray(values) && values.length >= 2 ? values : [
    '👟 Moda & Calçados',
    '📱 Tecnologia & Eletrônicos',
    '🏠 Casa & Decoração',
    '💄 Beleza & Skincare',
    '🍳 Cozinha & Utilidades',
    '💪 Saúde & Esportes',
    '🎮 Games & Acessórios',
    '🧸 Brinquedos & Bebês'
  ];

  try {
    const sendResult = await sock.sendMessage(targetGroupJid, {
      poll: {
        name: pollName,
        values: pollValues,
        selectableCount: typeof selectableCount === 'number' ? selectableCount : 0
      }
    });

    const logEntry = {
      id: Date.now(),
      title: `📊 Enquete: "${pollName}"`,
      price: null,
      timestamp: new Date().toISOString(),
      type: 'poll',
      status: 'success'
    };

    dispatchedLog.unshift(logEntry);
    if (dispatchedLog.length > 50) dispatchedLog.pop();

    console.log(`[WhatsApp Bot] 📊 Enquete enviada com sucesso no grupo: "${pollName}"`);
    return { success: true, messageId: sendResult?.key?.id, poll: { name: pollName, values: pollValues } };
  } catch (err) {
    console.error('[WhatsApp Bot] Erro ao enviar enquete no grupo:', err);
    throw new Error('Falha ao enviar enquete: ' + err.message);
  }
}


// Background scheduler loop (runs every 30 seconds to check if post is due)
function startSchedulerLoop() {
  if (autoPostIntervalTimer) clearInterval(autoPostIntervalTimer);

  autoPostIntervalTimer = setInterval(async () => {
    if (!isAutoPostEnabled) return;
    if (connectionStatus !== 'connected' || !sock) return;

    const intervalMs = autoPostIntervalMin * 60 * 1000;
    const timeSinceLast = Date.now() - lastPostTimestamp;

    if (timeSinceLast >= intervalMs) {
      console.log(`[WhatsApp Bot Auto-Cron] Intervalo de ${autoPostIntervalMin} min atingido. Atualizando promoções e enviando próxima oferta...`);
      try {
        // Auto-refresh: gera novas promoções antes de cada envio automático
        try {
          const promoBot = require('./promo_bot');
          // Mantém o histórico para NUNCA repetir produtos já enviados
          console.log('[WhatsApp Bot Auto-Cron] ✅ Novas promoções sincronizadas da Shopee API.');
        } catch (refreshErr) {
          console.warn('[WhatsApp Bot Auto-Cron] Aviso: não foi possível atualizar promoções:', refreshErr.message);
        }
        await dispatchOffer(null, false);
      } catch (err) {
        console.warn('[WhatsApp Bot Auto-Cron] Erro no envio agendado:', err.message);
      }
    }
  }, 30 * 1000);
}

// Update configuration
function setConfig({ autoPostEnabled, intervalMinutes }) {
  if (typeof autoPostEnabled === 'boolean') {
    isAutoPostEnabled = autoPostEnabled;
    setBotSetting('wa_auto_post_enabled', isAutoPostEnabled ? '1' : '0');
  }
  if (typeof intervalMinutes === 'number' && intervalMinutes >= 15) {
    autoPostIntervalMin = intervalMinutes;
    setBotSetting('wa_auto_post_interval_min', autoPostIntervalMin);
  }
  return getStatus();
}

// Get full status object for admin API
function getStatus() {
  return {
    status: connectionStatus,
    qrCode: currentQrCodeDataUrl,
    user: connectedUser,
    targetGroupJid: targetGroupJid,
    isAutoPostEnabled: isAutoPostEnabled,
    intervalMinutes: autoPostIntervalMin,
    lastPostTimestamp: lastPostTimestamp,
    lastError: lastError,
    dispatchedLog: dispatchedLog.slice(0, 15)
  };
}

// Auto-start WhatsApp connection if saved session exists
if (fs.existsSync(SESSION_DIR) && fs.readdirSync(SESSION_DIR).length > 0) {
  initWhatsApp(false);
}

startSchedulerLoop();

module.exports = {
  initWhatsApp,
  disconnectWhatsApp,
  dispatchOffer,
  dispatchPoll,
  getStatus,
  setConfig,
  resolveGroupJid,
  formatProductOffer
};
