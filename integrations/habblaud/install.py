"""Install the local service companion in the sibling Habblaud checkout. No secrets or World changes."""
from pathlib import Path
import json, sys
source=Path(__file__).resolve().parent
root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else source.parents[2]/'habblaud'
if not (root/'server/index.ts').exists() or not (root/'client/index.html').exists():
    raise SystemExit('Pasta Habblaud inválida.')
for name in ['shopee-monitor.ts','shopee-widget.js']:
    (root/'server'/name).write_text((source/name).read_text(encoding='utf8'),encoding='utf8')
p=root/'server/index.ts';text=p.read_text(encoding='utf8')
if "from './shopee-monitor'" not in text:
    text="import { shopeeMonitor } from './shopee-monitor';\n"+text
    marker='    if (guard(req, res)) return;\n    if (!api(req, res, url))'
    if text.count(marker)!=1:raise SystemExit('Rota local não reconhecida; confira a versão do Habblaud.')
    text=text.replace(marker,'    if (guard(req, res)) return;\n    if (shopeeMonitor(req, res, url, config.rootDir)) return;\n    if (!api(req, res, url))')
    p.write_text(text,encoding='utf8')
p=root/'client/index.html';text=p.read_text(encoding='utf8')
if '/api/shopee-bot/widget.js' not in text:
    p.write_text(text.replace('</body>','<script defer src="/api/shopee-bot/widget.js"></script>\n</body>'),encoding='utf8')
translations={
'Bot desligado ou sem atualização':['Bot offline or not updating','Bot apagado o sin actualización','Bot arrêté ou sans mise à jour'],
'WhatsApp desconectado':['WhatsApp disconnected','WhatsApp desconectado','WhatsApp déconnecté'],
'Preparando ou enviando oferta':['Preparing or sending an offer','Preparando o enviando una oferta','Préparation ou envoi d’une offre'],
'Falha no bot: confira o painel':['Bot error: check the dashboard','Error del bot: consulta el panel','Erreur du bot : consultez le tableau de bord'],
'Envio automático pausado':['Automatic sending paused','Envío automático pausado','Envoi automatique en pause'],
'Aguardando o próximo intervalo':['Waiting for the next interval','Esperando el próximo intervalo','En attente du prochain intervalle'],
'Bot de Ofertas':['Offers Bot','Bot de Ofertas','Bot des offres'],
'Serviço local · WhatsApp':['Local service · WhatsApp','Servicio local · WhatsApp','Service local · WhatsApp'],
'Abrir painel do bot':['Open bot dashboard','Abrir panel del bot','Ouvrir le tableau de bord du bot'],
'Próxima tentativa':['Next attempt','Próximo intento','Prochaine tentative'],
'Último envio':['Last sent','Último envío','Dernier envoi'],
'Intervalo em minutos':['Interval in minutes','Intervalo en minutos','Intervalle en minutes'],
'Sem atualização recente':['No recent update','Sin actualización reciente','Aucune mise à jour récente']}
for i,lang in enumerate(['en','es','fr']):
    p=root/'shared/locales'/f'{lang}.ts';text=p.read_text(encoding='utf8')
    missing={k:v[i] for k,v in translations.items() if json.dumps(k,ensure_ascii=False)+':' not in text}
    if missing:
        insert='\n  // Local Shopee bot companion\n'+''.join('  '+json.dumps(k,ensure_ascii=False)+': '+json.dumps(v,ensure_ascii=False)+',\n' for k,v in missing.items())
        at=text.index('{',text.index('export const'))+1
        p.write_text(text[:at]+insert+text[at:],encoding='utf8')
p=root/'CHANGELOG.md';text=p.read_text(encoding='utf8')
note='- Personagem local Bot de Ofertas mostra conexão, intervalo e envios reais do WhatsApp, sem entrar nas métricas de agentes de IA ou no Habblaud World.'
if note not in text:p.write_text(text.replace('## [Não lançado]','## [Não lançado]\n\n'+note),encoding='utf8')
print('Monitor local instalado. Execute npm run build na pasta Habblaud antes de reiniciar o escritório.')
