# PsiCompany — Backend + Banco de Dados integrados

Este pacote contém:

```
psicompany/
├── database/
│   └── schema.sql        # schema PostgreSQL (pacientes, psicólogos, consultas, auditoria)
├── backend/               # API Node.js + Express
│   ├── src/
│   │   ├── db/pool.js
│   │   ├── middleware/auth.js
│   │   ├── routes/{auth,pacientes,psicologos,consultas}.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
└── frontend/
    └── index.html         # o mesmo app React, agora consumindo a API de verdade
```

## O que mudou em relação ao schema original

O SQL que você enviou não tinha campo de senha nem tabela de consultas — sem isso
não dá para ter login nem agendamento. Adicionei:

- `senha_hash` em `pacientes` e `psicologos` (hash com bcrypt, nunca a senha em texto puro).
- `email` em `psicologos` (para poder logar) e campos opcionais `especialidade`/`bio` (usados no card do dashboard).
- Tabela `consultas` (paciente_id, psicologo_id, data_hora, status, observações) com sua própria
  tabela de histórico/auditoria e triggers, seguindo o mesmo padrão que já existia para
  pacientes e psicólogos.

## 1. Banco de dados

```bash
psql -U seu_usuario -f database/schema.sql
```

## 2. Backend

```bash
cd backend
cp .env.example .env
# edite o .env com sua DATABASE_URL e um JWT_SECRET forte
npm install
npm start        # ou "npm run dev" com nodemon
```

A API sobe em `http://localhost:3000/api` (configurável via `PORT`).

### Endpoints principais

| Método | Rota                              | Auth        | Descrição |
|--------|-----------------------------------|-------------|-----------|
| POST   | /api/auth/registro/paciente       | -           | Cadastra paciente |
| POST   | /api/auth/registro/psicologo      | -           | Cadastra psicólogo |
| POST   | /api/auth/login                   | -           | `{ email, senha, papel }` → token JWT |
| GET    | /api/psicologos                   | -           | Lista pública de psicólogos |
| GET    | /api/psicologos/me                | psicólogo   | Perfil próprio |
| PUT    | /api/psicologos/me                | psicólogo   | Atualiza perfil próprio |
| GET    | /api/pacientes/me                 | paciente    | Perfil próprio |
| GET    | /api/pacientes                    | psicólogo   | Pacientes com quem já teve consulta |
| POST   | /api/consultas                    | paciente    | Agenda consulta com um psicólogo |
| GET    | /api/consultas/minhas             | qualquer    | Lista consultas do usuário logado |
| PATCH  | /api/consultas/:id/status         | qualquer    | Paciente só cancela; psicólogo confirma/conclui/cancela |

Todas as rotas autenticadas esperam `Authorization: Bearer <token>`.

## 3. Frontend

`frontend/index.html` é o mesmo app, mas agora:

- A tela de cadastro grava de verdade no banco (via `/api/auth/registro/...`) e ganhou
  campos que faltavam no formulário original mas são obrigatórios no banco: **data de
  nascimento**, **senha** e (para psicólogo) **número do CRP**.
- Há um alternador "Já tem conta? Entrar" para logar com email/senha.
- O dashboard busca psicólogos/pacientes reais e lista as consultas do usuário logado,
  com botão "Agendar" (paciente) e "Confirmar/Concluir/Cancelar" (psicólogo).
- Chat e chamada de vídeo (WebRTC/PeerJS) continuam funcionando como antes — só passaram
  a usar o `id` real vindo do banco em vez do mock.

Basta abrir o `index.html` num servidor estático (ex.: extensão Live Server do VS Code)
com o backend rodando. Se o backend estiver em outro endereço, defina antes de carregar o
app:

```html
<script>window.PSICOMPANY_API_BASE = 'https://seu-backend.com/api';</script>
```

## Observações de segurança

- Senhas nunca são armazenadas em texto puro (bcrypt, 12 rounds).
- Tokens JWT expiram (`JWT_EXPIRES_IN`, padrão 8h).
- Validação de entrada com `express-validator` em todas as rotas que recebem dados do usuário.
- CORS restrito à origem definida em `FRONTEND_ORIGIN` (ajuste para produção).
