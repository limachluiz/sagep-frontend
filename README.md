# SAGEP Frontend

Base inicial do frontend do SAGEP em Angular, Tailwind CSS e integração com a API real do backend.

## Requisitos

- Node.js 20+
- npm
- Backend do SAGEP rodando localmente em `http://localhost:3000`

## Instalação

```bash
npm install
```

## Como rodar

```bash
npm start
```

Aplicação local:

- Frontend: `http://localhost:4200`
- API esperada: `http://localhost:3000/api`

## Ambiente

Os environments atuais usam:

```ts
apiUrl: 'http://localhost:3000/api'
```

Arquivos:

- [src/environments/environment.ts](/home/luiz/Documentos/sagep-frontend/src/environments/environment.ts)
- [src/environments/environment.development.ts](/home/luiz/Documentos/sagep-frontend/src/environments/environment.development.ts)

## Módulos implementados nesta etapa

- autenticação com login, logout, refresh token e carregamento de sessão via `/auth/me`
- interceptor HTTP com Bearer token e tentativa de refresh em `401`
- guards de autenticação e permissão
- layout autenticado com sidebar, cabeçalho, logout e navegação por perfil/permissão
- dashboard operacional consumindo `GET /dashboard/operational`
- listagem de projetos consumindo `GET /projects`
- detalhe de projeto consumindo:
  - `GET /projects/:id/details`
  - `GET /projects/:id/timeline`
  - `GET /projects/:id/next-action`

## Rotas disponíveis

- `/login`
- `/dashboard`
- `/projects`
- `/projects/:id`

## Como testar

1. Suba o backend e confirme que `http://localhost:3000/api/health` responde.
2. Rode o frontend com `npm start`.
3. Acesse `http://localhost:4200/login`.
4. Use uma credencial seeded do backend, por exemplo:
   - `admin@sagep.com` / `123456`
   - `gestor@sagep.com` / `123456`
   - `projetista@sagep.com` / `123456`
   - `consulta@sagep.com` / `123456`
5. Após login:
   - o app redireciona para `/dashboard`
   - o dashboard consulta `/dashboard/operational`
   - a tela de projetos consulta `/projects`
   - o detalhe consulta `/projects/:id/details`, `/timeline` e `/next-action`

## Referências usadas do backend

- `README.md`
- `docs/API.md`
- `docs/FLUXO_DOCUMENTAL.md`
- `docs/PERMISSOES.md`
- `docs/DASHBOARD.md`
- `docs/SALDO_ATA.md`
- `docs/FRONTEND_MAP.md`

## Próximos passos recomendados

- expandir paginação, filtros e ordenação de projetos
- criar fallback visual por permissão insuficiente
- evoluir dashboard com seletores de período e visões operacional/executiva/geral
- implementar módulos de estimativas, DIEx, OS, ATAs e saldo da ATA
- adicionar testes de serviço, guard e fluxo de autenticação
