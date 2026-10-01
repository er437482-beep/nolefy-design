# Nolefy Design — produção

## Estrutura

- `index.html`: site público estático.
- `api/index.js`: API serverless da Vercel; é o único lugar que usa `SUPABASE_SERVICE_ROLE_KEY`.
- `admin/public/admin.html`: painel administrativo servido em `/admin`.
- `supabase/schema.sql`: tabelas, índices, RLS e Storage.
- `vercel.json`: rewrites e headers de produção.

## Configuração local

1. Instale Node.js 18+ e Vercel CLI:

```bash
npm install
npx vercel login
```

2. Crie um projeto no Supabase e execute **todo** `supabase/schema.sql` no SQL Editor.

3. Crie o primeiro usuário em Authentication > Users. Depois execute, substituindo o e-mail:

```sql
insert into public.admins(user_id, role)
select id, 'super_admin' from auth.users where email = 'seu-email@exemplo.com'
on conflict (user_id) do update set role = 'super_admin';
```

4. Crie `.env.local` a partir de `.env.example`. Nunca faça commit desse arquivo. A `VITE_SUPABASE_ANON_KEY` pode ser pública; a `SUPABASE_SERVICE_ROLE_KEY` é exclusivamente server-side.

5. Rode:

```bash
npm run check
npx vercel dev
```

Abra `http://localhost:3000` e `http://localhost:3000/admin`.

## Vercel

Importe o repositório na Vercel com a raiz do projeto na raiz do repositório. Em Settings > Environment Variables, configure:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `ALLOWED_ORIGINS` com o domínio final, por exemplo `https://nolefy-design.vercel.app`
- `UPLOAD_BUCKET=site-assets`
- `MAX_UPLOAD_SIZE=5242880`
- `RATE_LIMIT_WINDOW_MS=900000`
- `RATE_LIMIT_MAX=60`
- `AUTH_RATE_LIMIT_MAX=10`

Faça redeploy depois de alterar variáveis. O painel fica em `/admin`; o site público consulta `/api/public/site`.

## Como o site recebe alterações

O painel grava nas tabelas `site_content`, `site_services`, `site_portfolio` e `site_contact`. A página pública pode consultar `/api/public/site` com `fetch` e renderizar somente com `textContent`/atributos seguros. O endpoint público usa cache curto; depois de salvar, a alteração aparece no próximo revalidate.

## Segurança operacional

- Não coloque `SUPABASE_SERVICE_ROLE_KEY` em arquivos `VITE_*`, HTML ou JavaScript público.
- Use HTTPS em produção e restrinja `ALLOWED_ORIGINS` ao domínio real.
- Ative confirmação de e-mail e MFA para o administrador no Supabase.
- Faça `npm audit` e mantenha dependências atualizadas.
- O servidor não aceita HTML em campos textuais; o frontend deve usar `textContent`, não `innerHTML` com dados do banco.
