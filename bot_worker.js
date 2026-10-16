/**
 * ROBÔ AUTOMÁTICO WHATSAPP (RODANDO LOCAL NO SEU COMPUTADOR)
 * Dispara ofertas qualificadas automaticamente no Grupo VIP #1 da Shopee.
 */
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const shopeeApi = require('./shopee_api');

const SESSION_DIR = path.join(__dirname, 'wa_session');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// Link oficial do seu grupo WhatsApp
const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/KjHrqfJp3HuIHQiR8Zfl3L';

// Intervalo entre os disparos em minutos (15 minutos conforme solicitado)
const INTERVALO_MINUTOS = 15;

let sock = null;
let targetGroupJid = null;

async function resolveGroupJid(codeOrUrl) {
  if (!sock) return null;
  let code = codeOrUrl;
  const match = code.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
  if (match) code = match[1];

  try {
    const groupInfo = await sock.groupGetInviteInfo(code);
    if (groupInfo && groupInfo.id) {
      targetGroupJid = groupInfo.id;
      console.log(`[WhatsApp] Grupo VIP identificado via link: "${groupInfo.subject}" (${targetGroupJid})`);
      return targetGroupJid;
    }
  } catch (err) {}

  // Fallback: grupos onde o bot já participa
  try {
    const groups = await sock.groupFetchAllParticipating();
    for (const [jid, group] of Object.entries(groups)) {
      if (group.subject && (group.subject.toLowerCase().includes('shopee') || group.subject.toLowerCase().includes('vip'))) {
        targetGroupJid = jid;
        console.log(`[WhatsApp] Grupo VIP encontrado nos ativos: "${group.subject}" (${targetGroupJid})`);
        return targetGroupJid;
      }
    }
  } catch (err) {}

  return targetGroupJid;
}

// Arquivo de persistência local para não repetir produtos mesmo reiniciando o robô
const POSTED_HISTORY_FILE = path.join(__dirname, 'posted_deals.json');

function loadPostedHistory() {
  try {
    if (fs.existsSync(POSTED_HISTORY_FILE)) {
      const raw = fs.readFileSync(POSTED_HISTORY_FILE, 'utf8').trim();
      if (!raw) return new Set();
      const ids = JSON.parse(raw);
      const set = new Set(ids.map(String));
      console.log(`[Histórico] ${set.size} ofertas já enviadas carregadas do disco.`);
      return set;
    }
  } catch (e) {
    console.warn('[Histórico] Erro ao carregar histórico, começando do zero:', e.message);
  }
  // Cria o arquivo vazio se não existir
  fs.writeFileSync(POSTED_HISTORY_FILE, '[]');
  console.log('[Histórico] Arquivo posted_deals.json criado.');
  return new Set();
}

function savePostedHistory(id) {
  try {
    postedItemIds.add(String(id));
    const arr = Array.from(postedItemIds).slice(-500); // mantém os últimos 500
    fs.writeFileSync(POSTED_HISTORY_FILE, JSON.stringify(arr, null, 2));
    console.log(`[Histórico] ID "${id}" salvo. Total no histórico: ${arr.length}`);
  } catch (e) {
    console.error('[Histórico] Erro ao salvar histórico:', e.message);
  }
}

/**
 * Gera um ID único estável para o produto.
 * Usa itemId quando disponível; caso contrário usa hash do nome+preço.
 */
function getProductId(item) {
  if (item.itemId && String(item.itemId) !== 'undefined' && String(item.itemId) !== '0') {
    return String(item.itemId);
  }
  // Fallback: hash do nome + preço para garantir unicidade
  const raw = `${item.productName || ''}__${item.priceMin || ''}`;
  return 'hash_' + crypto.createHash('md5').update(raw).digest('hex').slice(0, 12);
}

const postedItemIds = loadPostedHistory();

const DIVERSE_KEYWORDS = [
  '', 'fone bluetooth', 'skincare beleza', 'utilidades cozinha', 'smartwatch',
  'organizador', 'copo térmico', 'luminária led', 'ferramentas', 'massageador',
  'perfume', 'cabo usb c', 'suporte celular', 'mochila impermeavel', 'relogio masculino',
  'panela eletrica', 'garrafa inox', 'mouse sem fio', 'decoracao casa', 'fone lenovo'
];

async function fetchNextBestOffer() {
  // Embaralha as keywords para não consultar sempre as mesmas
  const shuffledKeywords = [...DIVERSE_KEYWORDS].sort(() => Math.random() - 0.5);

  for (const kw of shuffledKeywords.slice(0, 4)) {
    // Escolhe uma página aleatória entre 1 e 3 para variar os achadinhos
    const randomPage = Math.floor(Math.random() * 3) + 1;

    try {
      const nodes = await shopeeApi.fetchTopOffers({ keyword: kw, page: randomPage, limit: 30 });
      // Embaralha os resultados obtidos da Shopee para seleção aleatória
      const candidates = nodes.sort(() => Math.random() - 0.5);

      for (const item of candidates) {
        if (!item || !item.productName || !item.offerLink) continue;
        const itemIdStr = getProductId(item);
        if (postedItemIds.has(itemIdStr)) {
          // console.log(`[Histórico] Pulando produto já enviado: "${item.productName}" (ID: ${itemIdStr})`);
          continue;
        }

        const rating = parseFloat(item.ratingStar || 0);
        const discountPct = parseInt(item.priceDiscountRate || 0, 10);
        const price = parseFloat(item.priceMin || 0);

        // Filtro: avaliação >= 4.8 e desconto >= 30%
        if (rating >= 4.8 && discountPct >= 30 && price > 0) {
          const origPrice = price / (1 - (discountPct / 100));
          return {
            id: itemIdStr,
            title: item.productName,
            priceCurrent: price,
            originalPrice: origPrice,
            discountPct,
            savings: origPrice - price,
            ratingStar: rating.toFixed(1),
            salesCount: `${item.sales || 0} vendidos`,
            shopName: item.shopName || 'Loja Verificada na Shopee',
            imageUrl: item.imageUrl,
            offerLink: item.offerLink
          };
        }
      }
    } catch (e) {
      console.warn(`[Shopee API] Aviso na busca (${kw}):`, e.message);
    }
  }

  // Se por acaso já postou tudo do pool recente, limpa metade do histórico antigo para rodar ofertas novas
  if (postedItemIds.size > 200) {
    const list = Array.from(postedItemIds).slice(-100);
    postedItemIds.clear();
    list.forEach(id => postedItemIds.add(id));
  }
  return null;
}

function formatCopy(product) {
  const origPrice = product.originalPrice > product.priceCurrent
    ? `~De R$ ${product.originalPrice.toFixed(2).replace('.', ',')}~\n`
    : '';

  return `🔥 *ACHADINHO DO DIA NA SHOPEE* 🔥\n\n📦 *${product.title}*\n\n⭐ Avaliação: *${product.ratingStar}/5* | ${product.salesCount}\n🏪 Loja: *${product.shopName}*\n\n${origPrice}💰 *Por apenas R$ ${product.priceCurrent.toFixed(2).replace('.', ',')}*\n📉 Desconto de *${product.discountPct}% OFF*\n💵 Economia de *R$ ${product.savings.toFixed(2).replace('.', ',')}*\n\n🛒 *COMPRAR NO LINK OFICIAL COM DESCONTO:*\n👉 ${product.offerLink}\n\n💎 *ShopeeTreasures VIP #1 | Oferta Verificada*`;
}

async function dispatchNextOffer() {
  if (!sock || !targetGroupJid) {
    console.warn('[WhatsApp] Bot ainda não conectado ou grupo não identificado.');
    return;
  }

  const offer = await fetchNextBestOffer();
  if (!offer) {
    console.log('[WhatsApp] Nenhuma oferta nova qualificada no momento.');
    return;
  }

  const messageText = formatCopy(offer);

  try {
    if (offer.imageUrl && offer.imageUrl.startsWith('http')) {
      await sock.sendMessage(targetGroupJid, {
        image: { url: offer.imageUrl },
        caption: messageText
      });
    } else {
      await sock.sendMessage(targetGroupJid, { text: messageText });
    }

    savePostedHistory(offer.id);
    console.log(`[WhatsApp] ✅ Oferta disparada com sucesso no grupo: "${offer.title}" (R$ ${offer.priceCurrent.toFixed(2).replace('.', ',')})`);
  } catch (err) {
    console.error('[WhatsApp] Erro no envio:', err.message);
  }
}

async function startBot() {
  console.log('\n======================================================');
  console.log('🤖 INICIANDO ROBÔ AUTOMÁTICO WHATSAPP (LOCAL)');
  console.log('======================================================\n');

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['ShopeeTreasures Bot', 'Chrome', '124.0.0.0'],
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 Escaneie o QR Code acima no WhatsApp (Aparelhos Conectados):\n');
    }

    if (connection === 'open') {
      console.log('\n✅ ROBÔ CONECTADO AO WHATSAPP COM SUCESSO!');
      await resolveGroupJid(WHATSAPP_GROUP_LINK);

      console.log(`⏱️ Agendamento ativo: disparando ofertas a cada ${INTERVALO_MINUTOS} minutos.`);
      
      // Primeiro disparo após 5 segundos
      setTimeout(() => dispatchNextOffer(), 5000);

      // Loop contínuo
      setInterval(() => {
        dispatchNextOffer();
      }, INTERVALO_MINUTOS * 60 * 1000);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      if (isLoggedOut) {
        console.log('❌ Sessão desconectada. Apagando credenciais antigas...');
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        startBot();
      } else {
        console.log('🔄 Reconectando ao WhatsApp...');
        setTimeout(startBot, 4000);
      }
    }
  });
}

startBot();
