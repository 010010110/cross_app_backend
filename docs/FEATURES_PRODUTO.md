# Features e Modelo de Negócio — Cross App Backend

**Versão:** 1.0  
**Data:** Abril 2026  
**Público:** Product Managers, Stakeholders, Leads de Negócio e Time de Desenvolvimento  
**Objetivo:** Documentar visão de produto, jornadas de usuário, regras de negócio críticas e impacto em métricas.

---

## Resumo Executivo

O **Cross App** é uma plataforma de gestão para boxes de CrossFit que centraliza operações (agendamento, check-in, resultados) e engaja alunos via gamificação (streaks, XP, rankings). Suporta escalabilidade multi-box (franquias) com contextos independentes de usuários, classes e WODs. O modelo de receita é baseado em assinatura por box com funcionalidades premium (relatórios avançados, integração com sistemas de pagamento).

---

## 1. Proposta de Valor

### 1.1 Problema Resolvido

**Para Proprietários/Administradores:**
- Falta de ferramenta centralizada para gerenciar múltiplos boxes
- Dificuldade em rastrear frequência e engajamento de alunos
- Processo manual de planejamento e comunicação de WOD

**Para Coaches:**
- Falta de visibilidade sobre desempenho e evolução de alunos
- Dificuldade em identificar PRs (Personal Records) e marcos
- Ausência de ferramenta para analisar adherência a programas

**Para Alunos:**
- Falta de gamificação para manter motivação
- Ausência de histórico de resultados e PRs
- Pouca conexão social dentro do box

### 1.2 Solução Oferecida

1. **Plataforma centralizada** para gestão de caixas, aulas, WODs e alunos
2. **Gamificação** via streaks (dias consecutivos), XP e milestones
3. **Check-in geolocalizado** com validação de presença no box
4. **Feed social** para celebrar conquistas e PRs
5. **Relatórios de engajamento** para coaches e admins
6. **Multi-box support** para redes de franquias

---

## 2. Usuários e Personas

### 2.1 Roles de Acesso

| Role | Descrição | Permissões Chave |
|------|-----------|------------------|
| **ADMIN** | Proprietário ou gestor do box | Criar/editar WODs, classes, promover coaches, ver relatórios completos |
| **COACH** | Instrutor de aulas | Ver alunos inscritos, acompanhar resultados, registrar PRs |
| **ALUNO** | Integrante do box | Check-in em aulas, visualizar WOD, registrar resultados, ver feed |

### 2.2 Personas Detalhadas

#### **Persona 1: Bruno (ADMIN/Proprietário)**
- Idade: 35 anos, dono de 2 boxes
- Objetivo: escalar negócio sem aumentar overhead administrativo
- Necessidades:
  - Visão única de alunos, frequência e engajamento em ambos os boxes
  - Integração de dados para análise de performance de coaches
  - Automatização de check-ins para reduzir fraudes

#### **Persona 2: Marina (COACH)**
- Idade: 28 anos, coach experiente
- Objetivo: entender evolução dos alunos e identificar oportunidades de mentoring
- Necessidades:
  - Histórico de PRs por aluno
  - Alertas de alunos com baixa frequência
  - Ferramenta para registrar feedback qualitativo

#### **Persona 3: João (ALUNO)**
- Idade: 26 anos, atleta recreacional
- Objetivo: motivar-se com gamificação e competir amigavelmente
- Necessidades:
  - Visualizar streak de dias consecutivos
  - Ver PRs pessoais e marcos alcançados
  - Comparar-se com colgas via ranking

---

## 3. Jornadas de Usuário

### 3.1 Jornada: Onboarding (ADMIN criando um novo box)

```
1. Registro de Box
   ├─ ADMIN fornece: nome, CNPJ, endereço, localização (GPS)
   ├─ Sistema: cria documento Box com geofenceRadius padrão (100m)
   └─ Resultado: Box ID gerado, ADMIN recebe token JWT

2. Cadastro de Primeira Aula Recorrente
   ├─ ADMIN define: nome (ex: "Turma das 7h"), dias da semana, horário
   ├─ Sistema: valida horário (fim > início)
   └─ Resultado: Grade de aulas criada

3. Criação do WOD Inaugural
   ├─ ADMIN entra no app, seleciona seu box (x-box-id header)
   ├─ Publica WOD: title, model (AMRAP/FOR_TIME), blocos (WARMUP, STRENGTH, WOD, COOLDOWN)
   ├─ Sistema: valida unicidade por (box, data)
   └─ Resultado: WOD visível para alunos inscritos

4. Convite de Coaches
   ├─ ADMIN busca por email → sistema acha ou cria novo usuário COACH
   ├─ Vincula COACH ao mesmo box
   └─ COACH passa a ver alunos e aulas nesse box
```

### 3.2 Jornada: Matrícula de Aluno

```
1. Aluno Solicita Inscrição
   ├─ Frontend envia: aluno email, box ID
   └─ Sistema valida:
      - Aluno não existe em NENHUM box? → criar novo usuário ALUNO
      - Aluno existe em OUTRO box com role ALUNO? → adicionar novo boxId
      - Aluno existe NESTE box? → erro 409 Conflict (já inscrito)

2. Confirmação
   ├─ Aluno recebe confirmação por email/SMS
   └─ Pode fazer login e acessar o box
```

### 3.3 Jornada: Check-in + Resultado

```
1. Aluno Abre App na Box
   ├─ Vê lista de aulas de hoje (classes com weekDay = hoje)
   ├─ Seleciona uma aula → vê hora de início/fim
   └─ Clica em "Check-in"

2. Validação de Geofencing
   ├─ App captura GPS (latitude, longitude)
   ├─ Servidor calcula distância até box.location
   ├─ Distância > 100m? → erro 403 "Fora da caixa"
   └─ Distância ≤ 100m? → check-in aceito

3. Resultado após Treino
   ├─ Aluno registra: scoreKind (TIME/LOAD/REPS), score (ex: "12:34")
   ├─ Sistema: auto-detecta se é novo PR comparando com histórico
   └─ Se PR: publica automaticamente no feed + notifica aluno + incrementa XP

4. Gamificação
   ├─ Streak aumenta em 1 dia
   ├─ XP é adicionado (base + bonus se PR)
   └─ Se streak atinge 7, 15, 30, 45, 60 ou 100 dias → badge de milestone
```

### 3.4 Jornada: Feed Social (Aluno Visualizando)

```
1. Aluno Abre Feed do Box
   ├─ Vê posts recentes: check-ins, PRs, marcos alcançados
   ├─ Posts vêm de: seu box apenas (isolamento por context)
   └─ Ordenados por data decrescente

2. Interação
   ├─ Aluno clica "Like" em PR de colega
   └─ Sistema incrementa contador de likes no post

3. Narrativa Social
   └─ "João completou 30 dias de streak! 🎉"
   └─ "Marina atingiu novo PR: Fran em 9:45"
```

---

## 4. Regras de Negócio Críticas

### 4.1 WOD e Agenda

| Regra | Descrição | Rationale |
|-------|-----------|-----------|
| **Unicidade de WOD** | Um WOD por (box, data). Tentativa de criar 2º WOD mesmo dia → erro 409 | Evita confusão de múltiplos treinos no dia |
| **Compatibilidade legada UTC** | Sistema busca WODs tanto em timezone local quanto em UTC (para migração) | Suporta transição de dados históricos |
| **Aulas recorrentes** | Classes definem dias da semana fixos (ex: MONDAY, WEDNESDAY, FRIDAY) | Simplifica gestão; não há conceito de "aula única" |
| **Classes + WOD composto** | GET /classes/today retorna aulas do dia E o WOD do dia | UI exibe agenda + treino centralizado |

### 4.2 Check-in e Geofencing

| Regra | Descrição | Rationale |
|-------|-----------|-----------|
| **Geofencing 100m** | Check-in válido apenas se distância ≤ 100m do box | Previne fraudes; aluno genuinamente está no local |
| **Cálculo de distância** | Haversine usando (box.location.coordinates, checkin.location) | Precisão em geodesia; padrão da indústria |
| **Um check-in diario por usuario (global)** | Um aluno pode fazer apenas 1 check-in por dia, independentemente da aula | Evita duplicação de presenca e inflacao de streak/XP |

### 4.3 Gamificação e Streaks

| Regra | Descrição | Rationale |
|-------|-----------|-----------|
| **Streak = dias consecutivos** | +1 streak se check-in realizado em dia. Quebra se nenhum check-in em 1 dia | Incentiva frequência consistente |
| **Freeze tokens** | ALUNO pode "congelar" streak x vezes/mês em caso de lesão | Flexibilidade sem perder motivação |
| **Milestones** | Badges em 7, 15, 30, 45, 60, 100 dias de streak | Gamificação clássica; recompensas em intervalos psicologicamente relevantes |
| **XP progressivo** | Base = 10 XP/check-in; +50 XP bonus se é novo PR | Incentiva execução de treinos com qualidade (PRs) |
| **Isolamento por box** | Streaks/ranking são por box, não globais | Fair play; boxes de tamanho diferente competem internamente |

### 4.4 Matrícula de Aluno (Multi-box)

| Regra | Descrição | Rationale |
|-------|-----------|-----------|
| **Usuário novo** | Se email não existe em BD → criar novo usuário ALUNO com 1 boxId | Simplifica onboarding |
| **Usuário existente outro box** | Se email existe em outro box com role ALUNO → adicionar boxId (multi-box linking) | Suporta alunos que frequentam múltiplos boxes |
| **Rejeição: mesmo box** | Se aluno já está neste box → erro 409 Conflict | Evita inscrição duplicada |
| **Upgrade: ALUNO → COACH/ADMIN** | Possível? Análise de regra. Tipicamente: novo cadastro com role diferente | Separação de contextos e permissões |

### 4.5 Personal Records (PRs)

| Regra | Descrição | Rationale |
|-------|-----------|-----------|
| **Detecção automática** | Sistema compara scoreKind/score atual vs melhor histórico (min TIME, max LOAD) | Celebração automática; feedback imediato |
| **Publicação em Feed** | PR novo = post automático no feed do box | Recognição social; incentiva esforço |
| **Bonus XP** | +50 XP em addition ao XP base se é PR | Reforço comportamental |

---

## 5. Módulos de Feature e Impacto

### 5.1 Mapa de Módulos

```
cross-app
├─ Auth (autenticação)
│  └─ Impact: permite acesso seguro, isola contextos por JWT
│
├─ Boxes (gestão de localização e franquias)
│  ├─ Cadastro de novo box
│  ├─ Suporte a filiais (parentBoxId)
│  └─ Impact: foundation para multi-box scaling
│
├─ Users (cadastro e matrícula)
│  ├─ Multi-box linking
│  ├─ Validações de duplicação
│  └─ Impact: suporta alunos em múltiplos boxes; reduz churn
│
├─ Classes (grade recorrente de aulas)
│  ├─ Dias da semana
│  ├─ Horários
│  ├─ Limite de check-ins/dia
│  └─ Impact: automação de agendamento; reduce admin overhead
│
├─ WODs (treino diário)
│  ├─ Blocos (warmup, strength, WOD, cooldown)
│  ├─ Modelo de treino (AMRAP, FOR_TIME, etc)
│  └─ Impact: centraliza comunicação de treino; visibilidade para alunos
│
├─ Checkins (presença com geofencing)
│  ├─ Validação de localização
│  ├─ Histórico por aluno
│  └─ Impact: anti-fraude; dados de frequência; base para gamificação
│
├─ Results (scores e PRs)
│  ├─ Registro de resultados
│  ├─ Detecção de PR
│  └─ Impact: rastreamento de progresso; feedback de performance
│
├─ Feed (mural social)
│  ├─ Posts de check-ins, PRs, marcos
│  ├─ Likes/interação
│  └─ Impact: comunidade; reconhecimento social; retenção
│
├─ Rewards (gamificação)
│  ├─ Streaks
│  ├─ XP, milestones, badges
│  ├─ Freeze tokens
│  └─ Impact: alta retenção; engajamento diário; LTV aumenta 40-60%
│
├─ Exercises (biblioteca compartilhada)
│  ├─ Global + box-specific
│  └─ Impact: consistência; facilita WOD planning
│
└─ Admin Reports (insights)
   ├─ Attendance trends
   ├─ Coach assignments
   └─ Impact: data-driven decisions; suporte a scaling
```

### 5.2 Impacto em KPIs

| KPI | Métrica | Target | Responsável |
|-----|---------|--------|-------------|
| **DAU (Daily Active Users)** | Alunos que fazem check-in/dia | +5% MoM | Gamification team |
| **Engagement (Streak Avg)** | Dias de streak médios | 20 dias | Rewards module |
| **Retention (D30)** | % alunos ativos dia 30 | 65%+ | Product |
| **CAC (Cost to Acquire Box)** | $$ por nova box | <$2000 | Sales |
| **Churn (Monthly)** | % boxes que cancelam | <3% | Support/Product |
| **Feature Adoption** | % boxes usando Feed | >70% | Product |
| **Check-in Accuracy** | % check-ins dentro 100m | 98%+ | Geofencing team |

---

## 6. Fluxos de Negócio Detalhados

### 6.1 Fluxo: Planejamento Semanal de WOD

```
1. Coach prepara programação
   - Faz download do padrão de WOD (ex: template AMRAP)

2. Admin publica WOD via app
   - INPUT: date, title, blocks (warmup, strength, wod, cooldown)
   - VALIDATION: não existe WOD nesta data?
   - OUTPUT: WOD salvo, visível para alunos em 2 min

3. Alunos veem WOD
   - GET /wods/today → retorna treino do dia
   - Veem blocos, horário, modelo (AMRAP, FOR_TIME, etc)

4. Após treino
   - Aluno registra resultado (time, load, reps)
   - Sistema detecta PR automaticamente
   - Se PR: publica no feed + +50 XP + notificação
```

### 6.2 Fluxo: Check-in com Engajamento

```
1. Aluno chega ao box
   - Abre app, seleciona aula (ex: "Turma das 7h")
   - Clica "Check-in"

2. Validação de GPS
   - App envia: latitude, longitude
   - Servidor calcula: distância Haversine
   - Se distância > 100m: erro → aluno não está no box, check-in negado
   - Se distância ≤ 100m: check-in aceito

3. Treino
   - Aluno vê WOD do dia
   - Treina junto com colegas

4. Resultado
   - Aluno registra tempo/score
   - Sistema compara com PRs históricos
   - Se novo PR: 
     ├─ Post automático: "João atingiu novo PR em Fran: 9:45"
     ├─ Aluno recebe +50 XP
     └─ Colgas veem no feed e podem dar "Like"

5. Streak
   - Check-in conta para streak diário
   - Se hoje é 30º dia: aluno recebe badge "30 dias!"
   - Se streakMilestone atingido: notificação motivacional
```

### 6.3 Fluxo: Análise de Engajamento (Admin)

```
1. Admin acessa relatório
   - GET /admin/reports → últimos 30 dias de attendance

2. Insights oferecidos
   - Alunos com streak > 30 dias
   - Alunos com 0 check-ins na última semana (at-risk)
   - Classes com melhor attendance

3. Ação
   - Admin nota aluno "João" com streak quebrado
   - Envia mensagem motivacional via SMS/WhatsApp
   - João volta para reavivar streak
```

---

## 7. Estratégia de Retenção e Monetização

### 7.1 Retenção (Tácita)

| Tática | Mecanismo | Impacto |
|--------|-----------|--------|
| **Streaks** | Aluno não quer perder dias consecutivos | Força hábito; +5-10% DAU |
| **Feed Social** | Competição amigável; reconhecimento | +3-5% retention d30 |
| **Milestones** | Badges em 7, 30, 60, 100 dias | +15-20% de alunos atingem >7 dias |
| **PR Celebration** | Automático; motivante | +10% de submissions de resultados |
| **Challenges** (futuro) | Box vs Box, tema mensal | +20% engajamento especial |

### 7.2 Monetização (Proposta)

| Modelo | Tier | Preço/mês | Features |
|--------|------|-----------|----------|
| **Free** | Starter | $0 | Admin, coaches, até 20 alunos, WOD básico |
| **Pro** | Growth | $99 | +100 alunos, gamificação completa, relatórios |
| **Enterprise** | Scale | $299+ | Multi-box franquias, SSO, suporte dedicado |

---

## 8. Roadmap de Features (Próximas Fases)

### Fase 2 (Q2 2026)

- [ ] **Challenges mensais** (ex: "100 wallballs", box compete)
- [ ] **Integração com wearables** (Apple Watch, Garmin)
- [ ] **Notificações push** (lembrete de check-in, PR aviso)

### Fase 3 (Q3 2026)

- [ ] **Marketplace de coaches** (coaches freelance)
- [ ] **Integração com sistemas de pagamento** (cobrança dentro do app)
- [ ] **API pública** (parceiros integrarem dados)

### Fase 4 (Q4 2026)

- [ ] **Análise preditiva** (machine learning para prever churn)
- [ ] **Mobile app nativo** (iOS/Android otimizado)
- [ ] **Live leaderboards** (ranking real-time)

---

## 9. Regras de Acesso por Role

### 9.1 Matriz de Permissões

| Operação | ADMIN | COACH | ALUNO |
|----------|-------|-------|-------|
| Criar WOD | ✅ | ❌ | ❌ |
| Ver WOD de hoje | ✅ | ✅ | ✅ |
| Cadastrar class | ✅ | ❌ | ❌ |
| Fazer check-in | ❌ | ✅ (próprio) | ✅ |
| Ver resultados de aluno | ✅ | ✅ (alunos da aula) | ✅ (próprio) |
| Ver feed | ✅ | ✅ | ✅ |
| Registrar PR | ❌ | ✅ (alunos) | ✅ (próprio) |
| Acessar relatórios | ✅ | ✅ (básico) | ❌ |
| Gerenciar coaches | ✅ | ❌ | ❌ |
| Mudar de box (x-box-id) | ✅ (seus boxes) | ✅ (seus boxes) | ✅ (seus boxes) |

### 9.2 Proteção de Contexto

- Todos os endpoints contextuais exigem header `x-box-id` válido
- Usuário só pode acessar boxes em que está inscrito (verificado via `request.user.boxIds`)
- Violação → erro 403 Forbidden

---

## 10. Sucesso e Métricas de Validação

### 10.1 Métricas de Curto Prazo (1 mês)

- [ ] 10+ boxes adotando plataforma
- [ ] DAU inicial: 50+ alunos/dia
- [ ] Avg streak >= 7 dias
- [ ] Taxa de check-in com sucesso > 95%

### 10.2 Métricas de Médio Prazo (3 meses)

- [ ] 50+ boxes
- [ ] DAU: 500+ alunos/dia
- [ ] Retention D30: >= 60%
- [ ] 40%+ de alunos com streak > 15 dias

### 10.3 Métricas de Longo Prazo (12 meses)

- [ ] 200+ boxes
- [ ] DAU: 3000+ alunos/dia
- [ ] Retention D30: >= 70%
- [ ] NPS >= 50 (alunos) e >= 60 (admins/coaches)
- [ ] Revenue: $30k+/mês (MRR)

---

## 11. Glossário de Domínio

| Termo | Definição | Exemplo |
|-------|-----------|---------|
| **Box** | Uma unidade física (academia de CrossFit) | "Box Fit Vila Mariana" em São Paulo |
| **WOD** | Workout of the Day; treino diário com blocos | Title: "Helen", Model: FOR_TIME, Blocks: [warmup, strength, wod, cooldown] |
| **Class** | Aula recorrente em dias específicos e horários | "Turma das 7h" (SEG, QUA, SEX, 07:00-08:00) |
| **Check-in** | Registro de presença do aluno na aula, validado por GPS | João faz check-in em "Turma das 7h" às 07:05, GPS: -23.5555, -46.6333 |
| **PR (Personal Record)** | Melhor resultado pessoal em um exercício/WOD | "Fran em 9:45" (novo melhor tempo de João) |
| **Streak** | Dias consecutivos com check-in | João tem streak de 30 dias (30 dias seguidos com check-in) |
| **Geofencing** | Validação de localização (aluno dentro 100m do box) | Latitude/longitude do aluno ≤ 100m da localização do box |
| **XP (Experience Points)** | Pontos de gamificação; 10 base + 50 bonus se PR | João ganhou 60 XP (10 base + 50 bonus PR) |
| **Milestone/Badge** | Prêmio visual por atingir streak | João desbloqueou badge "30 dias" ao atingir 30 dias de streak |
| **Feed** | Mural social mostrando atividades do box | Post: "Marina atingiu novo PR: Fran em 9:15" |
| **Multi-box** | Aluno pode estar inscrito em 2+ boxes | João frequenta Box A (SEG-SEX) e Box B (FDS) |

---

## 12. Próximas Leituras

- Para entender a implementação técnica desses features, veja `docs/ARQUITETURA_TECNICA.md`
- Para detalhes de um serviço específico (ex: cálculo de streaks), consulte `src/rewards/rewards.service.ts`
- Para endpoints disponíveis, acesse Swagger em `/api` durante execução ou `docs/swagger.json`

---

## 13. Contato e Feedback

**Product Owner:** [Nome]  
**Tech Lead:** [Nome]  
**Data de última atualização:** Abril 2026  
**Próxima revisão:** Junho 2026

Sugestões ou correções? Abra uma issue ou contacte o time de produto.
