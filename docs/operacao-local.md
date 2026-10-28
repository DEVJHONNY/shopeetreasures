# Bot por intervalo e personagem no Habblaud

Execute `iniciar-shopee.bat` em antigravity. O atalho abre o painel se o servidor já estiver ligado e inicia uma instância se estiver desligado. Painel: http://127.0.0.1:4000/admin. Use sua senha existente.

## Envio automático

O modo por intervalo envia uma oferta a cada 15 minutos, enquanto o servidor estiver ligado, o WhatsApp conectado e houver uma oferta adequada. Ele não usa os antigos horários de 12h/19h nem o limite de dois envios por dia. O painel permite pausar ou alterar o intervalo (mínimo de 15 minutos).

Ativar ou salvar a programação inicia a espera de um intervalo completo. Desligar e religar não acumula mensagens atrasadas. Tentativas registradas no banco impedem duplicar um intervalo; uma falha ambígua de rede não provoca um reenvio imediato. O mesmo produto é evitado por sete dias na seleção automática.

Categorias são opcionais neste modo: sem seleção, o bot pesquisa todas as categorias disponíveis. Quando há categorias selecionadas, a busca respeita esse filtro. Preço, disponibilidade e link são revalidados antes de enviar.

## Personagem local no Habblaud

O Bot de Ofertas aparece em um cartão com personagem dentro do escritório: conectado/aguardando, preparando ou enviando oferta, pausado, desconectado ou com falha. O estado vem do processo real do bot, atualizado a cada três segundos, e é marcado como indisponível quando deixa de atualizar. O personagem não se passa por Claude/Codex, não recebe mensagens e não entra nas métricas de agentes de IA nem no Habblaud World.

Configure `SHOPEE_HABBLAUD_MONITOR=1` no `.env` local. O arquivo `.habblaud-bot.json` contém apenas estado operacional e horários; não contém senha, QR Code, telefone, convite ou identificador do grupo. Ele é ignorado pelo Git.

A extensão do Habblaud está versionada em `integrations/habblaud`. Instalação na pasta irmã: `python integrations/habblaud/install.py`; depois execute `npm run build` no Habblaud e reinicie o escritório. O instalador não altera permissões, sessões de IA nem o código do World.

As chaves ficam no `.env`, e banco e sessão WhatsApp permanecem privados. A produção Netlify só muda quando a revisão do GitHub for integrada à branch de publicação.
