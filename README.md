# SAGEP Frontend

Frontend do SAGEP em Angular e Tailwind CSS, integrado à API real do backend.

SAGEP significa Sistema de Apoio à Gestão de Projetos. O estado atual cobre autenticação, dashboard, projetos, estimativas e fluxo validado até Nota de Empenho. A próxima ação do projeto validado é Emitir Ordem de Serviço, mas esse módulo ainda não foi implementado no frontend.

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

- [src/environments/environment.ts](src/environments/environment.ts)
- [src/environments/environment.development.ts](src/environments/environment.development.ts)

## Módulos implementados

- autenticação com login, logout, refresh token e carregamento de sessão via `/auth/me`
- interceptor HTTP com Bearer token e tentativa de refresh em `401`
- guards de autenticação e permissão
- layout autenticado com sidebar por seções, topbar, breadcrumb, logout e navegação por perfil/permissão
- dashboard operacional consumindo `GET /dashboard/operational`
- listagem e detalhe de projetos consumindo:
  - `GET /projects`
  - `GET /projects/:id/details`
  - `GET /projects/:id/timeline`
  - `GET /projects/:id/next-action`
- listagem, criação e detalhe de estimativas
- telas placeholder para módulos em construção: DIEx, Ordens de Serviço, ATAs, Itens da ATA, Saldo da ATA, Relatórios, Auditoria, Usuários e OMs

## Rotas disponíveis

- `/login`
- `/dashboard`
- `/projects`
- `/projects/:id`
- `/estimates`
- `/estimates/new`
- `/estimates/:id`
- `/diex`
- `/ordens-servico`
- `/atas`
- `/itens-ata`
- `/saldo-ata`
- `/relatorios`
- `/auditoria`
- `/usuarios`
- `/oms`

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
   - estimativas podem ser listadas, criadas e consultadas conforme permissões do backend

## Estado do fluxo

- Auth, dashboard, projetos e estimativas estão funcionais.
- O fluxo foi validado até Nota de Empenho.
- A próxima ação esperada pelo backend, após Nota de Empenho, é Emitir Ordem de Serviço.
- Ordem de Serviço permanece em construção nesta etapa.

## Validação

```bash
npm run build
```

## Referências usadas do backend

- `README.md`
- `docs/API.md`
- `docs/FLUXO_DOCUMENTAL.md`
- `docs/PERMISSOES.md`
- `docs/DASHBOARD.md`
- `docs/SALDO_ATA.md`
- `docs/FRONTEND_MAP.md`

## Próximos passos recomendados

- implementar a tela e o fluxo de Ordem de Serviço quando o backend e a regra de workflow forem priorizados
- expandir paginação, filtros e ordenação de projetos e estimativas
- criar fallback visual por permissão insuficiente nas rotas em construção
- evoluir dashboard com seletores de período e visões operacional/executiva/geral
- adicionar testes de serviço, guard e fluxo de autenticação
