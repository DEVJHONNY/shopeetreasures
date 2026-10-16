# Diretrizes para Agentes de IA — ShopeeTreasures

> Instruções canônicas de trabalho e arquitetura baseadas no Vibe Coding Toolkit.

## Visão Geral do Projeto
- **Produto e Escopo:** Consulte `PRODUCT.md` para entender as regras de negócio e objetivos.
- **Repositório:** `https://github.com/DEVJHONNY/shopeetreasures.git`
- **Ambiente:** Servidor Node.js local (porta 4000) integrado com banco SQLite (`shopee.db`), cliente Baileys para WhatsApp e deploy serverless na Netlify.

## Comandos Canônicos
- **Iniciar Servidor Local:** `node server.js`
- **Gerar Lote de Promoções:** `node promo_bot.js`
- **Túnel Cloudflare (quando ativo):** `cloudflared tunnel --url http://localhost:4000`
- **Verificar Status do Git:** `git status`
- **Deploy:** Commit e push na branch `main` (a Netlify atualiza automaticamente a vitrine pública).

## Regras de Execução e Preservação
1. **Preservar a Sessão do WhatsApp:** A sessão ativa do WhatsApp é armazenada em `baileys_auth_info/`. NUNCA delete ou sobrescreva essa pasta sem solicitação explícita do usuário.
2. **Preservar o Banco SQLite:** O banco `shopee.db` armazena histórico de cliques, configurações do robô e produtos cadastrados. Qualquer migração de schema deve ser compatível e idempotente.
3. **Padrão de Autenticação:** Rotas `/api/admin/*` utilizam autenticação via header `Authorization: Bearer <TOKEN>`. O token padrão configurado é `Luc@S076140`.
4. **Resolução de Links da Shopee:** Links da Shopee podem vir em múltiplos formatos (ex: `s.shopee.com.br`, `shopee.com.br/slug-i.SHOPID.ITEMID` ou `shopee.com.br/user/SHOPID/ITEMID`). A extração de ID deve sempre utilizar o último segmento numérico longo e consultar a API de Afiliados antes de adotar valores padrão.
5. **Comunicação Concisa:** Mantenha respostas e resumos claros, objetivos e em português do Brasil, sem jargões desnecessários.
6. **Integridade de Documentação:** Preserve comentários e docstrings existentes que não estejam relacionados à alteração em curso.
