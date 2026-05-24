# Guia de deploy — GuiaControl

Você vai publicar 3 coisas em domínios diferentes:

| Componente | Plataforma | Domínio sugerido |
|------------|------------|------------------|
| Backend (API) | **Render** (Free) | `api.seudominio.com` |
| App (contador + cliente) | **Vercel** | `app.seudominio.com` |
| Landing institucional | **Vercel** | `seudominio.com` ou `landing.seudominio.com` |
| Banco | **MongoDB Atlas** (Free M0) | (interno) |

---

## 1) MongoDB Atlas (banco)

1. Crie conta em [cloud.mongodb.com](https://cloud.mongodb.com).
2. **Build a Database** → M0 Free → região mais próxima (São Paulo / Virginia).
3. **Database Access** → Add user. Salve a senha (sem caracteres especiais facilita).
4. **Network Access** → Add IP → escolha **`0.0.0.0/0` (Allow from anywhere)** (necessário pro Render acessar).
5. **Database** → Connect → Drivers → copie a connection string e troque `<password>` pela senha real.
   - Anote algo como: `mongodb+srv://user:senha@cluster.mongodb.net/?appName=GuiaControl`

---

## 2) Render (backend FastAPI)

1. Acesse [dashboard.render.com](https://dashboard.render.com), faça login com GitHub.
2. **New +** → **Web Service** → conecte o repositório `guiacontrol`.
3. Configurações:
   - **Name**: `guiacontrol-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free
4. **Environment** → adicione as variáveis:

   | Variável | Valor |
   |----------|-------|
   | `MONGO_URL` | (sua connection string do Atlas) |
   | `DB_NAME` | `guiacontrol` |
   | `AUTH_COOKIE_SECURE` | `true` |
   | `APIBRASIL_BEARER_TOKEN` | (seu token) |
   | `APIBRASIL_DEVICE_TOKEN` | (seu device) |
   | `WHATSAPP_PROVIDER` | `apibrasil` |
   | `PUBLIC_CLIENT_BASE_URL` | `https://app.SEUDOMINIO.com` |
   | `ADMIN_EMAILS` | `lucaskova95@gmail.com` |
   | `CORS_ALLOW_ORIGINS` | `https://app.SEUDOMINIO.com,https://SEUDOMINIO.com` |

5. **Create Web Service**. Aguarde o build (3-5 min).
6. Anote a URL que o Render gerou: algo como `https://guiacontrol-api.onrender.com`. Essa é a sua API.

> **Importante:** o plano Free do Render hiberna após 15 min sem requisições. A primeira requisição depois disso demora ~30s.

---

## 3) Vercel — App (frontend)

1. Acesse [vercel.com](https://vercel.com), login com GitHub.
2. **Add New** → **Project** → importe `guiacontrol`.
3. Configurações:
   - **Framework Preset**: `Other`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build:web`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. **Environment Variables**:

   | Variável | Valor |
   |----------|-------|
   | `EXPO_PUBLIC_BACKEND_URL` | `https://guiacontrol-api.onrender.com` |
   | `EXPO_PUBLIC_WEB_APP_URL` | `https://app.SEUDOMINIO.com` |
   | `EXPO_PUBLIC_ENABLE_GOOGLE_AUTH` | `false` |

5. **Deploy**. Aguarde 2-3 min.
6. Em **Settings → Domains** adicione `app.SEUDOMINIO.com` (apontando o CNAME no seu provedor de domínio).

---

## 4) Vercel — Landing

1. **Add New** → **Project** → importe `guiacontrol` de novo (mesmo repo, projeto separado).
2. Configurações:
   - **Framework Preset**: `Next.js` (auto-detect)
   - **Root Directory**: `landing`
3. (Sem variáveis obrigatórias.)
4. **Deploy**.
5. Em **Settings → Domains** aponte `seudominio.com` (ou `landing.seudominio.com`).

---

## 5) Pós-deploy — checklist

- [ ] Acesse `https://app.seudominio.com/login` e crie a conta com o e-mail listado em `ADMIN_EMAILS`.
- [ ] Verifique se o botão **"Painel admin"** aparece no header.
- [ ] Em `/admin/config` veja se aparece **API Brasil: Configurada**.
- [ ] Cadastre uma empresa e dispare um lembrete WhatsApp pra testar a integração.
- [ ] Verifique se o link `https://app.seudominio.com/cliente/<token>` funciona (no portal do cliente).

---

## 6) Domínios (opcional mas recomendado)

Se você comprou um domínio (Registro.br, GoDaddy, Hostgator):

| Subdomínio | Aponta para | Tipo |
|------------|-------------|------|
| `seudominio.com` | landing-vercel-projeto.vercel.app | CNAME (ou registro A do Vercel) |
| `app.seudominio.com` | app-vercel-projeto.vercel.app | CNAME |
| `api.seudominio.com` | guiacontrol-api.onrender.com | CNAME |

A Vercel e o Render fazem o SSL/HTTPS automaticamente em ~5 min.

---

## 7) Atualizando o código

Tudo que você commitar e der `git push origin main` vai disparar deploy automático nas três plataformas. É só trabalhar no Cursor, commitar e pronto.

```bash
git add .
git commit -m "feat: nova funcionalidade"
git push
```

---

## Problemas comuns

**"CORS error" no console** → A URL do app não está em `CORS_ALLOW_ORIGINS` no Render. Adicione e redeploy.

**"Sessão inválida" mesmo logando** → `AUTH_COOKIE_SECURE` precisa ser `true` em produção. Sem isso o navegador rejeita o cookie cross-domain.

**Backend dorme demais (Render Free)** → Configure um cron-job.org pinando `https://api.seudominio.com/api/health` a cada 10 min, ou faça upgrade para o plano Starter ($7/mês).

**Build da Vercel falha no app Expo** → Confira se o `Output Directory` é `dist` (e não `build` ou `web-build`).
