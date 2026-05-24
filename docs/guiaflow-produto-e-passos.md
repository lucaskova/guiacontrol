# GuiaFlow — produto e passos (rascunho para continuar)

Documento de alinhamento: **o que o sistema resolve**, **para quem**, **loop ideal** e **ideias de próximo passo** técnico/UX.

---

## Frase única (posicionamento)

**O contador só alimenta o sistema com as guias; o sistema lembra o cliente no WhatsApp e deixa claro o que está pago ou em aberto — sem o contador virar lembrete humano e sem o cliente depender da memória.**

Frase curta para landing / pitch:

> **GuiaFlow: o contador cadastra as guias, o sistema cobra e organiza no WhatsApp — o cliente sempre sabe o que falta pagar.**

---

## Problema que queremos resolver

1. **Contador** sobe/atualiza guias e não quer **retrabalho** manual: ficar perguntando se pagou, reenviar guia, atualizar planilha, processo chato em vários clientes.
2. **Cliente (PME)** muitas vezes **não lembra** se pagou ou não, perde guia no e-mail/WhatsApp e gera ida e volta com o escritório.

**Intuito do sistema:** contador **cadastra as guias**; o sistema **avisa pelo WhatsApp** no timing certo; o cliente tem **uma fonte da verdade** (pendente / pago / vencido + valores e referências).

---

## Dor do contador (o que o produto reduz)

- Cobrança e pergunta constante no WhatsApp pessoal.
- Planilha + lembrete na cabeça para cada vencimento de cada cliente.
- Retrabalho quando muda status da guia ou precisa “atualizar na mão” em vários lugares.

**Papel do sistema:** depois que a guia entra (OCR, cadastro manual ou importação futura), **notificações padronizadas** assumem o “cobrar lembrete”; o contador entra em **exceções** (comprovante estranho, contestação).

---

## Dor do cliente (o que o produto reduz)

- Dúvida: “será que paguei essa DARF?” / “quando vence de novo?”.
- Guia perdida (e-mail, grupo, print solto).

**Papel do sistema:** lista com **status claro**, **valor**, **código/PIX** quando aplicável, e **mensagens** (ex.: D-7, D-3, dia do vencimento; opcional “ainda em aberto” no dia seguinte).

---

## Loop ideal do produto (passo a passo)

1. **Contador** cadastra empresa (cliente) e **sobe as guias** (ou importa no futuro).
2. **Motor de notificações** (WhatsApp como canal principal no Brasil) envia mensagens com **link curto** para o cliente ver **só aquela empresa**.
3. **Cliente** abre o link → vê **o que falta pagar** e **o que já está pago** (e quando).
4. Ao pagar: cliente pode **responder no fluxo** ou **anexar comprovante**; o contador **confirma em um gesto** (“marcar paga”) — automação total pode vir depois com regras de confiança.

Objetivo: contador **não vira lembrete humano**; cliente **não depende só da memória**.

---

## Próximos passos sugeridos (para trabalhar depois)

### Produto / UX

- Fluxos separados **contador** vs **cliente** (permissões e telas mínimas).
- **WhatsApp:** templates, cadência (quantas mensagens, em quais dias), **opt-out**, tom das mensagens.
- Decisão: **“marcar paga”** só pelo contador vs cliente marcar + contador validar.

### Técnico (quando for implementar)

- **Jobs agendados** (cron ou worker) para notificar por **data de vencimento**.
- Evitar **duplicidade** de mensagens; amarrar notificação a `user_id` / empresa / guia no banco (ex.: Mongo, conforme stack do GuiaFlow).
- Portal/link do cliente alinhado ao modelo acima (se mantiver link na mensagem).

### Contexto de projeto (histórico da conversa)

- Projeto GuiaFlow em desenvolvimento com stack tipo **Mongo + FastAPI + sessão** e app **Expo**; envio de WhatsApp usa **APIBrasil** (`APIBRASIL_BEARER_TOKEN`, `APIBRASIL_DEVICE_TOKEN`, opcional `APIBRASIL_GATEWAY_URL`).

---

## Checklist rápido para o MVP

- [x] Contador: login, empresa, CRUD de guias (tipo, valor, vencimento, status). *(já existia no repo)*
- [x] Cliente: link mágico ou portal mínimo com lista e status. *(implementado: `GET /api/public/cliente/{portal_token}` + tela `/cliente/[token]`; token em `empresas.portal_token`; copiar/regenerar em Editar empresa)*
- [x] WhatsApp: disparo por vencimento (D-7, D-3, D-0, pós-vencimento) via **APIBrasil** + job manual e cron opcional.
- [x] “Marcar paga” pelo contador + registro de data. *(já existia)*
- [ ] Opt-out / não incomodar (LGPD e boa prática).

---

## Implementação recente (portal)

- **Backend:** `portal_token` na empresa (novo cadastro + preenchimento lazy na listagem/detalhe); `POST /api/empresas/{id}/regenerar-portal-token`; `GET /api/public/cliente/{portal_token}`; índice único parcial em `portal_token`.
- **Frontend:** rota `app/cliente/[token].tsx`; seção “Link do cliente” em `editar-empresa.tsx`; `EXPO_PUBLIC_WEB_APP_URL` no `.env` para montar URL completa ao copiar.

---

*Última atualização: portal do cliente + doc versionada no repositório.*
