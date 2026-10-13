# Plano — Módulo Traction (EOS) no CRM

> Status (2026-10-13): **implementado.** Módulos `modules/traction/` (EOS: Scorecard, Rocks, Issues/IDS, L10 ao vivo com agenda fixa e lembretes, V/TO, Accountability Chart, People Analyzer, processos) e `modules/team/` (pessoas do time, com ou sem login — todo dono aponta para uma pessoa). Telas: Traction (`/traction/*`), EOS (`/eos/vision`, `/eos/people`, `/eos/process`), aba Team em Contacts, Portfolio em `/admin/portfolio`. Migrations 0023–0027. Ainda **não feito**: template de scorecard padrão do portfólio, Organizational Checkup salvo, integração com o FieldRoutes.
>
> Ponto de partida: a planilha EOS da Grounded Pest Control (V/TO, Leadership L10, Scorecard Q1-26) e o playbook do Tanner que já está publicado no portal (`components/portal/operating-playbook.tsx`).

## 1. O problema

O Tanner aplica o mesmo sistema operacional em **toda empresa que compra**. O playbook do portal define:

- **EOS / Traction** como sistema operacional. **Organizational Checkup** de 20 pontos no início, repetido no mês 12 para medir a evolução (a ferramenta já existe em `/portal/tools`, mas não salva nada).
- **L10 semanal conduzida pelo operador.** *"Tanner will never attend L10s."*
- **Weekly Update:** um Loom resumindo o scorecard e os principais issues.
- **Revisão financeira mensal** do portfólio inteiro.

Hoje cada empresa faz isso numa planilha própria (como a da Grounded). Com várias empresas, o Tanner não tem visão consolidada e cada planilha diverge da outra.

## 2. A ideia em uma frase

**Cada empresa adquirida vira um workspace e todo workspace ganha o mesmo módulo Traction** (Scorecard, Rocks, Issues, To-Dos, V/TO e uma tela de reunião L10). O super admin, ou seja o Tanner, ganha uma **visão de portfólio** que lê os números de todas as empresas sem precisar entrar em nenhuma reunião.

Isso encaixa no modelo multi-tenant que já existe: o `TENANCY.md` foi desenhado justamente para "o dono do grupo ver tudo consolidado".

```
Portfólio (Tanner / super admin)
 ├─ Grounded Pest Control  → Scorecard · Rocks · Issues · To-Dos · V/TO · L10
 ├─ Empresa B              → (mesma estrutura)
 └─ Empresa C              → (mesma estrutura)
```

## 3. As peças

### 3.1 Scorecard (a peça mais importante)

5 a 15 números, cada um com dono e meta, preenchidos toda semana (ou mês). Verde se bateu a meta, vermelho se não bateu.

| Tabela | Campos principais |
|---|---|
| `scorecard_measurables` | `tenant_id`, `name`, `owner_user_id`, `goal_value`, `goal_operator` (`>=`, `<=`, `=`), `unit` (`currency`, `number`, `percent`), `cadence` (`weekly`, `monthly`), `sort_order`, `source` (`manual`, ou `fieldroutes:active_customers` no futuro), `archived_at` |
| `scorecard_entries` | `tenant_id`, `measurable_id`, `period_start` (date), `value` (numeric), `note`. `UNIQUE (measurable_id, period_start)` |

- Verde e vermelho, total e média do trimestre são **calculados no Service**, nunca gravados.
- Tela: uma grade igual à planilha (linhas = métricas, colunas = semanas ou meses do trimestre), com edição inline na célula. Célula vermelha → um clique "Drop to Issues" cria um Issue já ligado à métrica.
- **Scorecard padrão do portfólio:** um template com as métricas que o Tanner quer de *toda* empresa (receita, P&L, clientes novos, clientes ativos, AR em atraso…). Criar um workspace aplica o template. Assim os números ficam comparáveis na visão de portfólio. Cada empresa pode acrescentar as suas, como "Call backs" no caso da Grounded.

Exemplo da Grounded:

| Métrica | Meta | Mai | Jun | Jul | Ago | Set |
|---|---|---|---|---|---|---|
| Receita mensal (FieldRoutes) | ≥ $13.500 | 14.682 🟢 | 19.050 🟢 | 22.766 🟢 | 27.914 🟢 | |
| P&L mensal | | 14.926 | 22.991 | 17.241 | 22.478 | |
| Clientes ativos | | 301 | 340 | 378 | 396 | 421 |

### 3.2 Rocks

Prioridades de 90 dias, de 3 a 7 por pessoa e por trimestre.

`rocks`: `tenant_id`, `quarter` (`2026-Q3`), `title`, `owner_user_id`, `due_date`, `status` (`on_track`, `off_track`, `complete`, `dropped`), `success_criteria`, `is_company_rock`.

- A Rock Review da L10 é só "on track / off track" por Rock. Off track vira um Issue com um clique.
- No fim do trimestre: as Rocks não concluídas são marcadas como `dropped` ou levadas para o trimestre seguinte, com histórico preservado.
- Rocks podem ter marcos (milestones) usando os **Activities** que já existem (`activities.rock_id`, um novo FK composto).

### 3.3 Issues (IDS)

`issues`: `tenant_id`, `title`, `raised_by_user_id`, `owner_user_id`, `list` (`short_term` = L10, `long_term` = V/TO), `status` (`open`, `solved`, `dropped`), `rank`, `solution`, `solved_at`, mais as origens opcionais (`measurable_id`, `rock_id`).

- Na L10: escolher o top 3, resolver um por vez. "Resolver" normalmente gera um To-Do.

### 3.4 To-Dos → reaproveita **Activities**

Os To-Dos da L10 são compromissos de 7 dias com dono. É exatamente o que um Activity do tipo `task` já é (dono, prazo, concluído). **Não precisa de tabela nova**, só de:

- uma marca opcional `activities.issue_id` (de qual Issue o To-Do nasceu);
- um filtro "To-Dos da L10" na tela de Activities;
- a métrica da L10 "% de To-Dos concluídos na semana", calculada no Service.

> Por isso o script `scripts/seed-grounded.ts` já importa os To-Dos da Grounded como Activities: é o único item da planilha que encaixa 100% hoje.

### 3.5 V/TO

Documento estratégico, um por workspace: core values, core focus (propósito e nicho), 10-year target, estratégia de marketing (target market, 3 uniques, proven process, garantia), 3-year picture, 1-year plan.

`vto`: `tenant_id` (único), `content` (jsonb validado por Zod, com uma seção por bloco), `updated_at`, `updated_by_user_id`. Opcional: `vto_snapshots` a cada trimestre, para ver como a visão mudou.

O V/TO conversa com o resto: as metas do 1-Year Plan e do 3-Year Picture podem apontar para métricas do Scorecard ("Receita $600K" ↔ métrica de receita), e as Rocks do trimestre aparecem na seção Rocks do V/TO.

### 3.6 Reunião L10 (a tela que junta tudo)

Uma tela `/w/[workspace]/traction/l10` em modo reunião, seguindo a agenda da planilha, com timer por seção:

| Seção | Tempo | Mostra |
|---|---|---|
| Segue | 5 min | boas notícias |
| Scorecard | 5 min | semana atual, vermelhos destacados → Issue |
| Rock Review | 5 min | on/off track → Issue |
| Headlines | 5 min | clientes e funcionários (texto livre → Issue) |
| To-Do List | 5 min | To-Dos da semana: feito / não feito |
| IDS | 60 min | top 3 Issues → resolver → gera To-Do |
| Conclude | 5 min | recap dos novos To-Dos e nota de 1 a 10 de cada participante |

`l10_meetings`: `tenant_id`, `held_at`, `ratings` (jsonb por participante), `todo_completion_pct`, `issues_solved`, `headlines`, `notes`.

**Ao concluir a reunião**, o CRM gera o **resumo semanal** (scorecard, Rocks off-track, issues resolvidos, nota média) e manda por e-mail ao Tanner via Resend, que já está no projeto. Isso cobre o "Weekly Update" do playbook sem depender só do Loom.

### 3.7 Organizational Checkup

A ferramenta de 20 pontos já existe em `components/portal/eos-checkup.tsx`, só que não salva. Plano: levar a mesma ferramenta para dentro do workspace e salvar em `eos_checkups` (`tenant_id`, `taken_at`, `answers` jsonb, `score`). A tela mostra o início, o mês 12 e o delta por item, exatamente o que o playbook pede.

### 3.8 Visão de portfólio (Tanner)

Página fora de um workspace (ex.: `/admin/portfolio`), restrita ao super admin, com uma linha por empresa:

| Empresa | Scorecard (vermelhos) | Rocks on track | Última L10 (nota) | To-Dos concluídos | Issues abertos | Checkup |
|---|---|---|---|---|---|---|

**Atenção à segurança:** o RLS só deixa ver um tenant por transação. A visão de portfólio deve **percorrer os workspaces e chamar o Service de cada um dentro do seu próprio `withTenant`**. Nunca uma query única que atravesse tenants. É mais lento, mas mantém a regra de isolamento intacta. Com poucas empresas, o custo é irrelevante.

## 4. Como fica no código (segue a arquitetura atual)

```
modules/
├── scorecard/   scorecard.schema.ts · .repository.ts · .service.ts · .actions.ts · .types.ts
├── rocks/
├── issues/
├── vto/
├── l10/         (reuniões + geração do resumo semanal)
└── activities/  (já existe: ganha issue_id / rock_id)

app/(hub)/w/[workspace]/traction/
├── page.tsx               ← visão geral (resumo de tudo)
├── scorecard/page.tsx
├── rocks/page.tsx
├── issues/page.tsx
├── vto/page.tsx
└── l10/page.tsx           ← modo reunião
```

Checklist obrigatório de cada tabela nova (já é regra do projeto):

- `tenant_id` + `tenantIsolationPolicy()` + `unique(tenant_id, id)` + FKs compostos;
- `GRANT ... TO app_tenant` numa migration escrita à mão;
- incluir a tabela em `TENANT_DATA_TABLES` (para apagar o workspace inteiro);
- cada página nova com entrada e tour em `components/layout/page-help.ts` (regra 13);
- migration aplicada só via `scripts/migrate-explicit.ts`, primeiro em dev e depois em prod **antes** do deploy.

## 5. Fases sugeridas

| Fase | Entrega | Por que nessa ordem |
|---|---|---|
| **1. Scorecard** | métricas, lançamentos, grade verde/vermelho, template do portfólio | Maior valor imediato: substitui a planilha e é o que o Tanner olha toda semana |
| **2. Rocks + Issues** | quadros trimestrais, Issues com "drop from" Scorecard/Rock, To-Dos ligados a Issues | Completa as listas que a L10 usa |
| **3. Reunião L10** | modo reunião com timer, notas, resumo semanal por e-mail | Depende das fases 1 e 2 |
| **4. V/TO + Checkup** | documento V/TO, checkup salvo com delta início → mês 12 | Muda pouco (trimestral/anual), pode vir depois |
| **5. Portfólio + integrações** | `/admin/portfolio`; puxar métricas do FieldRoutes via API | Só faz sentido com 2+ empresas e com o básico rodando |

## 6. Mapa da planilha da Grounded → CRM

| Na planilha | Vai para | Hoje? |
|---|---|---|
| To-Do List (L10) | Activities | ✅ importado pelo `scripts/seed-grounded.ts` |
| Bullseye Mgmt / Nick Stratton, Sharisa | Organizations / Contacts | ✅ importado |
| Rocks (Get 3rd Truck, 500 customers…) | `rocks` | ⏳ fase 2 |
| 60 Min IDS (Home Inspectors is a channel…) | `issues` | ⏳ fase 2 |
| Scorecard (receita, P&L, clientes ativos…) | `scorecard_*` | ⏳ fase 1 |
| V/TO (10-Year Target $20M, 1-Year Plan $600K…) | `vto` | ⏳ fase 4 |
| Dashboard do FieldRoutes | continua no FieldRoutes; no futuro alimenta o Scorecard via API | ⏳ fase 5 |

## 7. Decisões em aberto

1. **Quem precisa de conta?** Todo dono de Rock, métrica ou To-Do precisa ser membro do workspace para aparecer como responsável. Recomendação: convidar o time de liderança de cada empresa (na Grounded: Jay, Rex, Kody e Grafton). A alternativa, donos "só por nome" sem login, adiciona um conceito novo (assentos do Accountability Chart) e só vale a pena se muita gente nunca for logar.
2. **Semanal ou mensal?** O EOS manda scorecard semanal, mas a planilha da Grounded é mensal. O modelo suporta os dois por métrica (`cadence`). Falta o Tanner definir o padrão do portfólio.
3. **Papel do Tanner:** ele é o super admin, ou precisa de um papel de plataforma novo, tipo `portfolio_viewer`, que lê tudo mas não administra? Hoje só existe `super_admin`.
4. **FieldRoutes:** a Grounded tem acesso à API? Só vale integrar se for automatizar mais de 2 ou 3 métricas.
5. **Template do scorecard padrão:** quais métricas o Tanner exige de toda empresa?
