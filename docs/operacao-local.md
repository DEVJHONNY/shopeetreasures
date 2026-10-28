# Operação local atualizada

O servidor e o painel ficam na mesma pasta `shopee-afiliados`. Execute o atalho `iniciar-shopee.bat` na pasta antigravity e acesse http://127.0.0.1:4000/admin. Mantenha apenas uma instância do servidor.

## Primeira ativação

1. Entre com sua senha administrativa existente.
2. Escolha uma ou duas categorias com base no interesse do grupo.
3. Comece com os horários 12:00 e 19:00, limite de dois envios automáticos por dia (São Paulo).
4. Confira a conexão WhatsApp e o grupo de destino no painel.
5. Ative o agendamento somente depois dessa conferência. A instalação deixa os envios pausados.

O bot revalida o produto antes do envio, registra tentativas para não repetir um horário e evita repetir o mesmo produto em sete dias. O computador e o servidor precisam ficar ligados. Cliques não comprovam vendas; a comissão deve ser conferida no painel de afiliados Shopee.

## Habblaud

Abra `iniciar-habblaud.bat` para iniciar o escritório. O novo `iniciar-habblaud-agente.bat` confere a integração nativa e abre o escritório; substitui o simulador antigo. O código desse atalho está em `scripts/iniciar-habblaud-agente.bat`.

O Habblaud lê sessões reais do Codex automaticamente. Os hooks adicionais dependem da aprovação de confiança pelo usuário em `/hooks` no Codex; o instalador não concede essa confiança. Para remover somente os hooks do Habblaud, execute `npm run codex:uninstall` na pasta habblaud.

## Arquivos privados e recuperação

As chaves ficam em `.env`, ignorado pelo Git. Banco, sessão WhatsApp e arquivos de execução não devem ser enviados ao GitHub. Antes desta instalação foi criado um backup íntegro em `antigravity/backups`. A senha administrativa foi preservada.

Para recuperar o banco, encerre o servidor antes de substituir `shopee.db` pela cópia escolhida. Não restaure banco com o servidor ativo. A versão de código anterior continua no branch `main`; preserve arquivos locais antes de trocar branches.

O Netlify acompanha o GitHub. Instalar esta branch local não publica automaticamente a revisão em produção; a revisão #1 permanece separada até ser integrada ao branch de publicação.
