# 🔐 Guia de Configuração - Painel Admin Nolefy Design

## 📋 Índice
1. [Pré-requisitos](#pré-requisitos)
2. [Configurar Supabase](#configurar-supabase)
3. [Configurar Backend](#configurar-backend)
4. [Configurar Variáveis de Ambiente](#configurar-variáveis-de-ambiente)
5. [Deploy no Vercel](#deploy-no-vercel)
6. [Testes de Segurança](#testes-de-segurança)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 Pré-requisitos

- Conta [Supabase](https://supabase.com) (gratuita)
- Conta [Vercel](https://vercel.com) (gratuita)
- Node.js 18+ instalado
- Git configurado

---

## 🛠️ Configurar Supabase

### 1. Criar Projeto Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Clique em "New Project"
3. Preencha:
   - **Name**: `nolefy-design`
   - **Database Password**: Gere uma senha forte
   - **Region**: Selecione a mais próxima (ex: South America - São Paulo)
4. Clique em "Create new project" e aguarde 2-3 minutos

### 2. Copiar Chaves de Acesso

1. Vá para **Settings** > **API**
2. Copie:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` → `VITE_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ NUNCA coloque no frontend)

### 3. Criar Tabelas com SQL

1. Acesse **SQL Editor** no Supabase
2. Clique em "New Query"
3. Cole o conteúdo de `admin/db/schema.sql`
4. Clique em "Run" e espere a execução

### 4. Configurar Storage

1. Acesse **Storage** no Supabase
2. Clique em "Create a new bucket"
3. Nome: `uploads`
4. Marque "Public bucket" (para servir as imagens)
5. Clique em "Create bucket"

### 5. Habilitar Autenticação

1. Vá para **Authentication** > **Providers**
2. Certifique-se de que "Email" está habilitado
3. Vá para **URL Configuration**
4. Em "Redirect URLs", adicione:
   ```
   http://localhost:3000
   https://seu-dominio.com
   https://seu-dominio.vercel.app
   ```

### 6. Criar Usuário Admin

1. Acesse **Authentication** > **Users**
2. Clique em "Invite user"
3. Email: seu email
4. Marque "Auto send invite" e clique em "Send invite"
5. Após criar a conta, vá para **SQL Editor** e rode:

```sql
INSERT INTO admins (user_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'seu-email@example.com' LIMIT 1),
  'super_admin'
);
```

---

## ⚙️ Configurar Backend

### 1. Clonar e Preparar

```bash
cd admin
npm install
```

### 2. Criar `.env` (Não fazer push!)

```bash
cp .env.example .env
```

Edite `.env` com suas chaves:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
JWT_SECRET=gere-uma-chave-com-32-caracteres-aleatorios
NODE_ENV=development
VITE_APP_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 3. Testar Localmente

```bash
npm run dev
```

Você deve ver:
```
✅ Servidor iniciado em http://localhost:3000
```

### 4. Testar Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Login (substitua email e senha)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu-email@example.com","password":"sua-senha"}'
```

---

## 🔐 Configurar Variáveis de Ambiente

### `.gitignore` (proteger credenciais)

```bash
# Adicione ao .gitignore do seu projeto
.env
.env.local
.env.*.local
node_modules/
```

### Para Vercel

NÃO coloque `SUPABASE_SERVICE_ROLE_KEY` no Vercel (será visível no navegador)!

Apenas adicione:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 🚀 Deploy no Vercel

### 1. Preparar Repositório

```bash
git add .
git commit -m "Adicionar painel admin seguro"
git push origin main
```

### 2. Conectar no Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Clique em "New Project"
3. Selecione seu repositório GitHub
4. Clique em "Import"

### 3. Configurar Build

- **Framework**: `Other`
- **Root Directory**: `admin`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Output Directory**: (deixe em branco)

### 4. Adicionar Variáveis de Ambiente

Em **Environment Variables**, adicione:

```
VITE_SUPABASE_URL = https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY = seu-anon-key
```

⚠️ **NÃO ADICIONE** `SUPABASE_SERVICE_ROLE_KEY` (é apenas para o backend local)

### 5. Deploy

Clique em "Deploy" e aguarde. Seu painel estará em:
```
https://seu-projeto.vercel.app
```

---

## 🔒 Testes de Segurança

### 1. Testar RLS

Tente acessar um serviço sem autenticação:

```javascript
const { data, error } = await supabase
  .from('services')
  .select('*');

// Deve retornar erro ou dados vazio (sem publicar)
```

### 2. Testar Rate Limiting

Faça múltiplas requisições de login:

```bash
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"teste@test.com","password":"erro"}'
done
```

Na 6ª requisição, deve receber: "Muitas tentativas de login"

### 3. Testar CORS

Tente fazer requisição de outro domínio:

```javascript
fetch('http://localhost:3000/api/admin/services', {
  headers: { 'Authorization': 'Bearer token' }
}).catch(e => console.log('CORS bloqueado ✅'));
```

### 4. Testar XSS Protection

Tente inserir um serviço com HTML:

```javascript
await fetch('/api/admin/services', {
  method: 'POST',
  body: JSON.stringify({
    title: '<img src=x onerror="alert(1)">',
    description: 'test'
  })
});
// Deve sanitizar e salvar como texto
```

---

## 📊 Monitorar Logs de Auditoria

```sql
-- No Supabase SQL Editor
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20;
```

---

## ❌ Troubleshooting

### "Token inválido"
- Certifique-se de que está enviando `Authorization: Bearer <token>`
- Verifique se o token expirou (validade de 1 hora)
- Use o refresh token para gerar um novo

### "Acesso negado"
- Verifique se o usuário está na tabela `admins`
- Rode:
  ```sql
  SELECT * FROM admins WHERE user_id = 'seu-user-id';
  ```

### "CORS bloqueado"
- Atualize `ALLOWED_ORIGINS` em `.env`
- Redeploy no Vercel

### "Arquivo não faz upload"
- Verifique se o bucket `uploads` é público
- Valide o tipo de arquivo (PNG, JPG, WebP, SVG)
- Tamanho máximo: 5MB

---

## 📞 Suporte

Se tiver problemas:
1. Verifique os logs no Vercel (Settings > Function Logs)
2. Cheque os logs do Supabase (Database > Logs)
3. Rode os testes de segurança acima

---

**Parabéns! Seu painel está seguro e pronto para produção! 🎉**
