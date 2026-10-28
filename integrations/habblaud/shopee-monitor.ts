import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tr } from '../shared/i18n';

// Local service companion. It never enters AI-agent counts, accounts or the World uplink.
export function shopeeMonitor(req: IncomingMessage,res: ServerResponse,url: URL,root: string): boolean {
  if(!url.pathname.startsWith('/api/shopee-bot/'))return false;
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.writeHead(405);res.end();return true;}
  if(url.pathname==='/api/shopee-bot/widget.js') {
    res.setHeader('Content-Type','application/javascript; charset=utf-8');
    res.end(readFileSync(join(root,'server','shopee-widget.js'),'utf8'));return true;
  }
  if(url.pathname!=='/api/shopee-bot/status'){res.writeHead(404);res.end();return true;}
  let data: Record<string,unknown>={};
  try {data=JSON.parse(readFileSync(join(root,'..','shopee-afiliados','.habblaud-bot.json'),'utf8'));}catch{}
  let alive=false;
  if(typeof data.pid==='number'&&Number.isInteger(data.pid)&&data.pid>0)try{process.kill(data.pid,0);alive=true;}catch{}
  const fresh=alive&&typeof data.updatedAt==='number'&&Date.now()-data.updatedAt<15000&&data.updatedAt<=Date.now()+1000;
  const labels:Record<string,string>={offline:tr('Bot desligado ou sem atualização'),disconnected:tr('WhatsApp desconectado'),sending:tr('Preparando ou enviando oferta'),error:tr('Falha no bot: confira o painel'),paused:tr('Envio automático pausado'),waiting:tr('Aguardando o próximo intervalo')};
  const state=fresh&&typeof data.state==='string'&&Object.hasOwn(labels,data.state)?data.state:'offline';
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify({state,label:labels[state],title:tr('Bot de Ofertas'),subtitle:tr('Serviço local · WhatsApp'),panel:tr('Abrir painel do bot'),nextLabel:tr('Próxima tentativa'),lastLabel:tr('Último envio'),intervalLabel:tr('Intervalo em minutos'),stale:tr('Sem atualização recente'),intervalMinutes:fresh&&typeof data.intervalMinutes==='number'?data.intervalMinutes:null,nextAutomaticAt:state==='waiting'&&typeof data.nextAutomaticAt==='number'?data.nextAutomaticAt:null,lastSentAt:fresh&&typeof data.lastSentAt==='number'?data.lastSentAt:null}));
  return true;
}
