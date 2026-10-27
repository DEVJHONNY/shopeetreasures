// Compartilha o mesmo agendador e a trava de processo do painel local.
require('./lib/env');
const bot = require('./whatsapp_bot');
if (process.env.SHOPEE_SAFE_MODE !== '1') bot.initWhatsApp();
