# Central de Indicadores — demonstração

Aplicação demonstrativa isolada. Não usar dados reais ou credenciais da empresa.

## Arquitetura
- Interface: `public/index.html`
- API: Cloudflare Worker em `worker.js`
- Banco compartilhado: Cloudflare D1, tabela definida em `schema.sql`

## Publicação
1. Criar banco D1 gratuito e executar `schema.sql` no console SQL.
2. Substituir `PREENCHER_COM_ID_DO_D1` em `wrangler.toml` pelo ID real do banco.
3. Publicar o projeto com Wrangler/Cloudflare.
4. Testar `/api/health` e cadastros antes de compartilhar o link.

Não colocar senhas, credenciais nem arquivos de produção neste repositório.
