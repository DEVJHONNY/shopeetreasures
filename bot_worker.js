/**
 * ROBÔ AUTOMÁTICO WHATSAPP (RODANDO LOCAL NO SEU COMPUTADOR)
 * Dispara ofertas qualificadas automaticamente no Grupo VIP #1 da Shopee.
 */
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const shopeeApi = require('./shopee_api');

const SESSION_DIR = path.join(__dirname, 'wa_session');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// Link oficial do seu grupo WhatsApp
const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/KjHrqfJp3HuIHQiR8Zfl3L';

// Intervalo entre os disparos em minutos (ex: 60 = 1 hora)
const INTERVALO_MINUTOS = 60;

let sock = null;
let targetGroupJid = null;
const postedItemIds = new Set();

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

async function fetchNextBestOffer() {
  const keywords = ['', 'fone bluetooth', 'skincare beleza', 'utilidades cozinha', 'smartwatch', 'organizador', 'copo térmico'];
  const kw = keywords[Math.floor(Math.random() * keywords.length)];

  try {
    const nodes = await shopeeApi.fetchTopOffers({ keyword: kw, limit: 20 });
    for (const item of nodes) {
      if (!item || !item.productName || !item.offerLink) continue;
      if (postedItemIds.has(item.itemId)) continue;

      const rating = parseFloat(item.ratingStar || 0);
      const discountPct = parseInt(item.priceDiscountRate || 0, 10);
      const price = parseFloat(item.priceMin || 0);

      // Filtro rigoroso: avaliação >= 4.8 e desconto >= 30%
      if (rating >= 4.8 && discountPct >= 30 && price > 0) {
        const origPrice = price / (1 - (discountPct / 100));
        return {
          id: item.itemId,
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
    console.warn('[Shopee API] Erro ao buscar ofertas:', e.message);
  }

  // Se já postou tudo do ciclo, reinicia o histórico
  postedItemIds.clear();
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

    postedItemIds.add(offer.id);
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
