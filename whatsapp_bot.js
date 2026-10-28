const { formatOffer, normalizeOffer } = require('./lib/offers');
const { validateConfig, dueSlot, clockParts, KEYWORDS, CATEGORIES, ZONE } = require('./lib/schedule');
const crypto = require('node:crypto');
const SAFE_MODE = process.env.SHOPEE_SAFE_MODE === '1';
let dispatchInFlight = false, lastAutoAttempt = 0, lockOwned = false;
let publishMonitor = () => {};
let makeWASocket, useMultiFileAuthState, DisconnectReason, pino, QRCode;


const path = require('path');
const fs = require('fs');
const db = require('./db.js');

const SESSION_DIR = path.join(__dirname, 'wa_session');
if (!SAFE_MODE && !fs.existsSync(SESSION_DIR)) {
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
  targetGroupJid = null;
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

  targetGroupJid = null;
  return null;
}

// Start or reconnect Baileys socket
async function initWhatsApp(forceNew = false) {
  if (SAFE_MODE) { lastError = 'Prévia isolada: WhatsApp desabilitado.'; return; }
  if (!lockOwned) {
    const lockPath = path.join(__dirname, 'whatsapp.lockfile');
    try { fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' }); }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const owner = Number(fs.readFileSync(lockPath, 'utf8'));
      if (!Number.isInteger(owner) || owner < 1) { lastError='Arquivo de controle inválido. Revise o processo antes de conectar.'; return; }
      try { process.kill(owner, 0); lastError='Outro processo já controla o WhatsApp.'; return; }
      catch (err) { if (err.code !== 'ESRCH') { lastError='Não foi possível confirmar o processo ativo.'; return; } }
      fs.unlinkSync(lockPath); fs.writeFileSync(lockPath, String(process.pid), { flag:'wx' });
    }
    lockOwned = true;
    process.once('exit', () => { try { if (fs.readFileSync(lockPath,'utf8') === String(process.pid)) fs.unlinkSync(lockPath); } catch {} });
  }
  ({ default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys'));
  pino = require('pino'); QRCode = require('qrcode');
  if (forceNew && sock) { sock.ev?.removeAllListeners?.(); sock.end?.(); sock=null; }

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
        const savedLink = getBotSetting('whatsapp_link', '');
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
            // Preserva os arquivos da sessão para revisão pelo proprietário.
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
    // O logout não remove os arquivos da sessão.
  } catch (e) {}

  return { success: true };
}

// Format single product into WhatsApp promotional copy
function formatProductOffer(product) { return formatOffer(product); }

// Dispatch an offer to WhatsApp
function campaignConfig() {
  return validateConfig({mode:getBotSetting('wa_schedule_mode','slots'),intervalMinutes:Number(getBotSetting('wa_auto_post_interval_min','15')),anchor:Math.max(Number(getBotSetting('wa_interval_anchor','0')),lastPostTimestamp),slots: JSON.parse(getBotSetting('wa_slots','["12:00","19:00"]')), categories: JSON.parse(getBotSetting('wa_categories','[]')), maxDaily: Number(getBotSetting('wa_max_daily','2'))});
}
async function dispatchOffer(specificProduct = null, isManual = false, scheduled = null) {
  if (SAFE_MODE) throw new Error('Prévia isolada: nenhum envio é permitido.');
  if (dispatchInFlight) throw new Error('Já existe um envio em andamento.');
  if (connectionStatus !== 'connected' || !sock) throw new Error('WhatsApp desconectado.');
  dispatchInFlight = true;
  lastError=null;publishMonitor();
  let attemptId = null;
  try {
    if (!targetGroupJid) await resolveGroupJid(getBotSetting('whatsapp_link',''));
    if (!targetGroupJid) throw new Error('Confira o convite do grupo. Nenhum grupo é escolhido pelo nome.');
    const config = campaignConfig();
    const api = require('./shopee_api');
    let product = specificProduct;
    if (!product) {
      if (config.mode!=='interval'&&!config.categories.length) throw new Error('Escolha as categorias antes de gerar o envio.');
      const fresh = await require('./promo_bot').generatePromos({keywords:(config.categories.length?config.categories:CATEGORIES).flatMap(c=>KEYWORDS[c]),targetCount:15});
      const recent = new Set(db.prepare('SELECT source_key FROM dispatch_history WHERE created_at > ?').all(Date.now()-7*86400000).map(r=>r.source_key));
      product = fresh.products.find(p=>!recent.has('item:'+String(p.itemId)));
      if (!product) throw new Error('Não há oferta nova adequada. O envio será pulado.');
    } else {
      let itemId = product.itemId || product.source_item_id;
      if (!itemId && product.id) itemId = db.prepare('SELECT source_item_id FROM products WHERE id = ?').get(product.id)?.source_item_id;
      if (!itemId) throw new Error('Atualize esse produto pela busca antes de enviar; falta o ID original.');
      product = await api.fetchProductById(itemId);
      if (!product) throw new Error('Oferta indisponível na Shopee.');
    }
    const normalized = normalizeOffer(product), messageText = formatOffer(product);
    const sourceKey = 'item:'+String(product.itemId || normalized.source_item_id);
    const day = clockParts().day, slot = scheduled?.slot || 'manual-'+crypto.randomUUID();
    if (scheduled) {
      const due = dueSlot(config, db.prepare('SELECT day_key,slot,kind,created_at FROM dispatch_history WHERE created_at>=?').all(Date.now()-172800000));
      if (!due || due.slot !== scheduled.slot) throw new Error('Horário já atendido ou fora da janela.');
    }
    const record = db.prepare('INSERT OR IGNORE INTO dispatch_history(source_key,title,day_key,slot,kind,status,created_at) VALUES(?,?,?,?,?,?,?)').run(sourceKey,normalized.title,day,slot,scheduled?'automatic':'manual','pending',Date.now());
    if (!record.changes) throw new Error('Este horário já foi reservado.');
    attemptId = record.lastInsertRowid;
    // Um único envio. Erro de rede não provoca um segundo envio potencialmente duplicado.
    const imageUrl=normalized.image_url;
    await sock.sendMessage(targetGroupJid, imageUrl?.startsWith('https://') ? {image:{url:imageUrl},caption:messageText} : {text:messageText});
    db.prepare("UPDATE dispatch_history SET status='sent' WHERE id=?").run(attemptId);
    lastPostTimestamp=Date.now();setBotSetting('wa_last_post_timestamp',lastPostTimestamp);
    const entry={id:Date.now(),title:normalized.title,price:normalized.price_discount,timestamp:new Date().toISOString(),type:scheduled?'automatic':'manual',status:'success'};
    dispatchedLog.unshift(entry);if(dispatchedLog.length>50)dispatchedLog.pop();
    return {success:true,product:entry};
  } catch(error) {
    lastError=error.message;
    if(attemptId) db.prepare("UPDATE dispatch_history SET status='failed' WHERE id=?").run(attemptId);
    throw error;
  } finally { dispatchInFlight=false;publishMonitor(); }
}

// Enviar enquete interativa nativa do WhatsApp no grupo VIP
async function dispatchPoll({ name, values, selectableCount = 0 } = {}) {
  if (SAFE_MODE) throw new Error('Prévia isolada: enquetes desabilitadas.');
  if (connectionStatus !== 'connected' || !sock) {
    throw new Error('WhatsApp não está conectado. Conecte pelo painel admin primeiro.');
  }

  if (!targetGroupJid) {
    const savedLink = getBotSetting('whatsapp_link', '');
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
  if (SAFE_MODE) return;
  if(autoPostIntervalTimer) clearInterval(autoPostIntervalTimer);
  autoPostIntervalTimer=setInterval(async()=>{
    if(!isAutoPostEnabled||connectionStatus!=='connected'||dispatchInFlight||Date.now()-lastAutoAttempt<120000)return;
    try {
      const config=campaignConfig(),day=clockParts().day;
      const due=dueSlot(config,db.prepare('SELECT day_key,slot,kind,created_at FROM dispatch_history WHERE created_at>=?').all(Date.now()-172800000));
      if(!due)return;
      lastAutoAttempt=Date.now();
      await dispatchOffer(null,false,due);
    } catch(error) {
      lastError=error.message;
      if(campaignConfig().mode==='interval')setBotSetting('wa_interval_anchor',Date.now());
      publishMonitor();console.warn('[Agendamento]',error.message);
    }
  },30000);
}

// Todas as opções são validadas antes da gravação.
function setConfig(input) {
  const cfg=validateConfig({...campaignConfig(),...input});
  if(input.autoPostEnabled===true&&cfg.mode!=='interval'&&!cfg.categories.length)throw new Error('Escolha ao menos uma categoria.');
  db.exec('BEGIN');
  try {
    setBotSetting('wa_schedule_mode',cfg.mode);
    setBotSetting('wa_auto_post_interval_min',cfg.intervalMinutes);
    if(input.autoPostEnabled===true||input.intervalMinutes!==undefined||input.mode!==undefined)setBotSetting('wa_interval_anchor',Date.now());
    setBotSetting('wa_slots',JSON.stringify(cfg.slots));
    setBotSetting('wa_categories',JSON.stringify(cfg.categories));
    setBotSetting('wa_max_daily',cfg.maxDaily);
    if(typeof input.autoPostEnabled==='boolean')setBotSetting('wa_auto_post_enabled',input.autoPostEnabled?'1':'0');
    db.exec('COMMIT');
  } catch(error) {db.exec('ROLLBACK');throw error;}
  if(typeof input.autoPostEnabled==='boolean')isAutoPostEnabled=input.autoPostEnabled;
  return getStatus();
}

// Get full status object for admin API
function getStatus() {
  return {
    ...campaignConfig(),
    timezone: ZONE,
    safeMode: SAFE_MODE,
    needsCategories: campaignConfig().mode!=='interval'&&!campaignConfig().categories.length,
    status: SAFE_MODE ? 'safe_preview' : connectionStatus,
    qrCode: currentQrCodeDataUrl,
    user: connectedUser,
    targetGroupJid: targetGroupJid,
    isAutoPostEnabled: isAutoPostEnabled,
    intervalMinutes: campaignConfig().intervalMinutes,
    nextAutomaticAt: isAutoPostEnabled&&campaignConfig().mode==='interval' ? Math.max(campaignConfig().anchor,Number(db.prepare("SELECT MAX(created_at) AS at FROM dispatch_history WHERE kind='automatic'").get()?.at)||0)+campaignConfig().intervalMinutes*60000 : null,
    dispatchInFlight,
    lastPostTimestamp: lastPostTimestamp,
    lastError: lastError,
    dispatchedLog: dispatchedLog.slice(0, 15)
  };
}

// Local monitor publishes only operational state, never QR, credentials or group identifiers.
if(!SAFE_MODE&&process.env.SHOPEE_HABBLAUD_MONITOR==='1') {
  publishMonitor=require('./lib/bot-monitor').startMonitor(()=>getStatus(),path.join(__dirname,'.habblaud-bot.json'));
}

// Auto-start WhatsApp connection if saved session exists
if (!SAFE_MODE && fs.existsSync(SESSION_DIR) && fs.readdirSync(SESSION_DIR).length > 0) {
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
