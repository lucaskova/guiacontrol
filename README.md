# GuiaControl

Plataforma SaaS de automação fiscal para contadores: OCR em lote de guias (DAS, DARF, ICMS, ISS), portal do cliente com magic link, lembretes via WhatsApp e painel administrativo.

## Estrutura

```
.
├── backend/      # FastAPI + MongoDB (deploy: Render)
├── frontend/     # App Expo / React Native Web (deploy: Vercel)
└── landing/      # Site institucional Next.js (deploy: Vercel)
```

## Stack

| Camada | Tech |
|--------|------|
| Backend | FastAPI, Motor (MongoDB async), bcrypt, OpenCV, PyMuPDF, zxing-cpp |
| App | Expo Router (React Native Web), Zustand, Axios, PWA |
| Landing | Next.js 15 (App Router), Tailwind, Framer Motion |
| Banco | MongoDB Atlas |
| WhatsApp | API Brasil |

## Desenvolvimento local

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate     # Windows
pip install -r requirements.txt
copy .env.example .env     # edite com suas credenciais
uvicorn server:app --reload --port 8000
```

### Frontend (app)

```bash
cd frontend
npm install
copy .env.example .env     # aponte EXPO_PUBLIC_BACKEND_URL para http://localhost:8000
npm run web
```

### Landing

```bash
cd landing
npm install
npm run dev
```

## Deploy em produção

Veja [`DEPLOY.md`](./DEPLOY.md) para o guia completo (Vercel + Render + MongoDB Atlas).

## Painel admin

- Acesse `/admin` no app após login.
- E-mails autorizados ficam em `ADMIN_EMAILS` no `.env` do backend (separados por vírgula).
- Recursos: métricas de SaaS, gerenciamento de contadores, impersonate, logs WhatsApp, configuração global.
