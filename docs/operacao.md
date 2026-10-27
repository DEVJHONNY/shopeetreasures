# Operação e publicação

## Fluxo GitHub → Netlify

As alterações devem ser revisadas em branch/PR. O Netlify publica a branch configurada no projeto. Não enviar arquivos diretamente para substituir a publicação gerenciada pelo GitHub.

Antes de integrar na branch de produção, conferir no Netlify as variáveis `SHOPEE_APP_ID`, `SHOPEE_SECRET` e `ADMIN_PASSWORD` com escopo de Functions. O código não usa mais credenciais fixas como alternativa. Sem configuração, a API informa indisponibilidade. Credenciais anteriormente presentes no histórico público precisam ser substituídas pelo proprietário; remover do código atual não revoga uma chave antiga.

Nenhum segredo deve ser colocado no PR, no chat, em screenshots ou no `.env.example`. Não versionar banco, sessão do WhatsApp ou arquivos de ambiente.

## Prévia

Node.js 24 é o runtime de referência. Instalar com `npm ci --ignore-scripts`, executar `npm test` e `npm run build`. Os testes usam banco temporário e dependências simuladas; não se conectam ao WhatsApp nem à Shopee.

Para a prévia local, definir `SHOPEE_SAFE_MODE=1`, uma senha fictícia em `ADMIN_PASSWORD`, um caminho separado em `SHOPEE_DB_PATH`, outro em `SHOPEE_PROMO_PATH` e uma porta disponível. Executar `node server.js`. O modo de prévia bloqueia conexão e envio do WhatsApp e usa produtos marcados EXEMPLO. Nunca ativar esse modo na publicação real.

No Deploy Preview, conferir catálogo, detalhes por URL, filtros, abertura do link de afiliado, configurações autenticadas e gravação de um clique de teste. Esse teste real de integração não é substituído pelos testes locais. Dados de preview usam um nome separado no Blobs; o host de produção esperado é `shopeetreasures-vip.netlify.app`. Um domínio próprio exige configurar `SHOPEE_PRODUCTION_HOST`.

## Dados e métricas

No Netlify, eventos de clique e configuração pública usam `@netlify/blobs`. O adaptador Lambda utiliza leituras eventuais: pode haver atraso na atualização do painel. Escritas condicionais evitam repetir o mesmo evento no mesmo produto/canal/dia. Um evento representa um clique registrado, não pessoa única, compra ou comissão; acessos automatizados ainda podem entrar na contagem. O painel consulta os últimos sete dias e declara o escopo.

No computador, SQLite mantém os dados locais e recebe tabelas adicionais para cliques e tentativas de envio. As migrações preservam produtos, contagens antigas, configurações existentes e senha. Contagens novas não importam cliques locais antigos como se fossem visitas ao site público.

As tabelas adicionais são compatíveis com uma volta do código, mas não excluir banco nem sessão. Antes de atualizar a instalação local: parar o processo pelo terminal, fazer uma cópia privada e consistente do banco e de sua sessão, atualizar o Git e testar com robô pausado. Essa cópia de dados reais não foi executada nesta revisão.

## Robô local

Escolher até três categorias, de um a quatro horários entre 08:00 e 21:00 e teto diário de um a quatro envios. Padrão: 12:00 e 19:00, teto de dois, sem categorias selecionadas. A programação exige categoria para enviar e considera até 15 minutos após cada horário. Horários perdidos não acumulam mensagens.

Cada tentativa automática reserva o horário antes de enviar. Se houver erro de rede, não há repetição automática naquele horário porque o WhatsApp pode ter recebido a mensagem. Revisar o resultado antes de qualquer envio manual. Uma trava de processo impede que `server.js` e `bot_worker.js` conectem a mesma sessão simultaneamente. Não iniciar os dois como operadores independentes.

O histórico persistente evita repetição automática de produtos por sete dias. A tela ainda mostra o histórico resumido da sessão atual. A conexão real do WhatsApp não foi exercitada nos testes.

## Atalhos fornecidos pelo proprietário

- `iniciar-shopee.bat`: executa o servidor original na pasta antigravity; pode reconectar a sessão existente. A prévia desta revisão é separada.
- `iniciar-habblaud.bat`: abre o escritório virtual na porta 4747; não participa do catálogo, checkout ou hospedagem.
- `iniciar-habblaud-agente.bat`: executa os personagens do escritório; não foi iniciado nesta revisão.
- `iniciar-terminal-gemini.bat`: abre outro agente e pode persistir uma chave no ambiente do Windows. Não é necessário para executar o site. Evitar dois agentes alterando simultaneamente os mesmos arquivos.

## Reversão e verificações pendentes

Se uma publicação apresentar regressão, restaurar o deploy anterior no Netlify e reverter o commit correspondente no GitHub. Isso reverte código, não apaga dados do Blobs. A validação com credenciais reais, o Deploy Preview e o robô conectado continuam obrigatórios antes de declarar a integração de produção concluída.

Referência técnica: [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).
