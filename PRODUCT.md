# ShopeeTreasures VIP — Plataforma de Afiliados Shopee

> Especificação de produto baseada no Vibe Coding Toolkit.

## Problema e objetivo
- **Problema:** Encontrar ofertas reais e confiáveis na Shopee é difícil devido à enorme quantidade de anúncios de baixa qualidade ou com descontos falsos.
- **Objetivo:** Filtrar automaticamente apenas os melhores "achadinhos" da Shopee (avaliação mínima de 4.8 estrelas e desconto real de pelo menos 30%), distribuindo-os em uma vitrine pública rápida e em um grupo exclusivo do WhatsApp 100% automatizado com links de afiliado rastreados.

## Público e papéis
- **Membros / Compradores:** Usuários que buscam descontos verificados em Moda, Tecnologia, Casa, Beleza e Utilidades. Acessam via grupo VIP do WhatsApp ou vitrine web (`shopeetreasures-vip.netlify.app`).
- **Administrador (Lucas Rocha):** Gerencia o catálogo, controla o robô do WhatsApp, dispara ofertas manuais, cria enquetes interativas e monitora cliques e conversões pelo painel administrativo.

## Fluxos essenciais
1. **Curadoria Automática (Cron):** O sistema consulta a Shopee Open API (GraphQL), filtra produtos com nota >= 4.8 e desconto >= 30%, e atualiza a base local e o feed de promoções.
2. **Disparo no Grupo VIP:** O robô local (via Baileys) envia periodicamente ou sob demanda mensagens formatadas com foto, preço original, preço promocional, porcentagem de desconto e link oficial de afiliado.
3. **Envio Rápido por Link:** O administrador cola qualquer link da Shopee (mesmo encurtado `s.shopee.com.br`) no painel, o sistema resolve redirects, extrai o ID real do item, consulta a Shopee API e monta o card formatado para disparo com 1 clique.
4. **Engajamento Interativo (Enquetes):** Disparo de enquetes nativas do WhatsApp para coletar as preferências de categorias dos membros do grupo VIP.
5. **Vitrine Web:** Catálogo online hospedado no Netlify com busca em tempo real, filtros por categoria e ordenação por maior desconto e menor preço.

## MVP / Estado Atual
- [x] Vitrine web com 880+ produtos e busca dinâmica
- [x] Filtros por categoria e ordenação (menor preço / maior desconto)
- [x] Landing Page VIP (`/vip`) com links diretos para o grupo do WhatsApp
- [x] Painel administrativo com autenticação protegida
- [x] Robô de WhatsApp com conexão QR Code (Baileys) e reconexão automática
- [x] Disparo automático agendado (anti-spam com intervalos configuráveis)
- [x] Resolução automática de shortlinks Shopee e extração de `itemId`
- [x] Envio de enquetes nativas de categoria direto pelo painel
- [x] Encurtador oficial de links de afiliados via Shopee GraphQL API

## Stack e decisões técnicas
- **Runtime:** Node.js v24 LTS
- **Banco de Dados Local:** SQLite via módulo nativo `node:sqlite` (`shopee.db`)
- **API Externa:** Shopee Affiliate Open API (GraphQL autenticada com HMAC-SHA256)
- **WhatsApp Bot:** `@whiskeysockets/baileys` (conexão multi-device local direta via WebSocket)
- **Servidor Web Local:** HTTP nativo do Node.js (porta 4000)
- **Frontend Admin / Vitrine:** HTML5, CSS moderno e Vanilla JavaScript (sem dependência de frameworks pesados)
- **Hospedagem Pública:** Netlify (Serverless Functions para a vitrine pública)

## Critérios de aceitação e qualidade
- Todo link de produto divulgado deve conter o código oficial de afiliado do proprietário.
- Nenhuma mensagem automática pode quebrar ou travar a sessão ativa do WhatsApp.
- Os produtos selecionados pelo robô devem manter sempre nota >= 4.7 e desconto >= 25% (preferencialmente 4.8+ e 30%+).
