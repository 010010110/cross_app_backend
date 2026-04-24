# Arquitetura Técnica — Cross App Backend

**Versão:** 1.0  
**Data:** Abril 2026  
**Público:** Time de desenvolvimento, QA, DevOps e arquitetos  
**Objetivo:** Documentar a organização técnica, fluxos de requisição, segurança e infraestrutura do backend.

---

## Resumo Executivo

O **Cross App Backend** é uma API REST modular construída com **NestJS 11** sobre **TypeScript**, usando **MongoDB** (driver nativo) como banco de dados. A arquitetura organiza 12 módulos de feature independentes com camadas claras: controlador → serviço → acesso a dados. Segurança é garantida via **JWT Bearer** tokens e contexto multi-box validado por headers HTTP. O banco é hospedado localmente via Docker Compose para desenvolvimento e oferece índices de geolocalização para validação de check-in.

---

## 1. Stack Tecnológico

| Componente | Versão | Propósito |
|------------|--------|----------|
| **NestJS** | 11.x | Framework HTTP estruturado com IoC |
| **TypeScript** | 5.x | Linguagem com tipagem forte |
| **MongoDB** | latest | Base de dados NoSQL com suporte a GeoJSON |
| **Express** | (via NestJS) | Motor HTTP subjacente |
| **class-validator** | 0.14+ | Validação de DTOs em request/response |
| **class-transformer** | 0.5+ | Transformação de POJOs e tipos |
| **JWT** | @nestjs/jwt | Geração e validação de tokens |
| **Swagger/OpenAPI** | @nestjs/swagger | Documentação interativa em `/api` |
| **Docker Compose** | 1.29+ | Orquestração local de serviços |

---

## 2. Arquitetura Modular

### 2.1 Estrutura de Módulos

A aplicação é organizada em **12 módulos de feature** mais um módulo de configuração:

```
src/
├── app.module.ts              (módulo raiz, agrega todos)
├── auth/                      (autenticação e login)
├── boxes/                     (gestão de boxes e localização)
├── users/                     (cadastro e matrícula de usuários)
├── exercises/                 (biblioteca de exercícios)
├── wods/                      (WOD diário por box)
├── classes/                   (grade de aulas recorrentes)
├── checkins/                  (registro de presença com geofencing)
├── results/                   (resultados de treinos)
├── feed/                      (mural/feed social)
├── rewards/                   (gamificação: streaks, XP, marcos)
├── admin-reports/             (relatórios de gestão)
├── common/                    (guards, decorators, enums, interfaces compartilhadas)
└── database/                  (configuração do MongoDB)
```

### 2.2 Padrão de Feature

Cada módulo segue a estrutura:

```
feature/
├── feature.controller.ts      (endpoints HTTP + Swagger)
├── feature.service.ts         (lógica de negócio)
├── feature.module.ts          (configuração do módulo)
├── dto/                       (Data Transfer Objects para validação)
├── interfaces/                (contratos TypeScript)
└── feature.service.spec.ts    (testes unitários opcionais)
```

**Exemplo:** `src/wods/wods.controller.ts` → `src/wods/wods.service.ts` → MongoDB collection `wods`.

### 2.3 Fluxo de Requisição

```
1. HTTP Request (POST /wods, GET /wods/today, etc.)
     ↓
2. NestJS Router → WodsController.create() ou .findToday()
     ↓
3. Guards aplicados em sequência:
     - JwtAuthGuard: valida Bearer token e extrai JWT Payload
     - BoxContextGuard: valida header x-box-id, injeta user.boxId
     - RolesGuard: verifica se role (ADMIN/COACH/ALUNO) é permitida
     ↓
4. ValidationPipe: transforma e valida DTO contra class-validator rules
     ↓
5. WodsService.createForBox() ou .findTodayByBox()
     ↓
6. Acesso ao MongoDB via db.collection('wods').insertOne() ou .findOne()
     ↓
7. Response serializada (JSON) + status HTTP
```

---

## 3. Autenticação e Autorização

### 3.1 JWT Bearer Token

**Geração:** via `/auth/login` (endpoint public).  
**Formato:** Bearer token em header `Authorization: Bearer <token>`.  
**Payload:** contém `sub` (user ID), `email`, `boxIds[]`, `boxId` (contexto), `role`.

### 3.2 Guards de Segurança

| Guard | Arquivo | Função | Injeção |
|-------|---------|--------|---------|
| **JwtAuthGuard** | `src/common/guards/jwt-auth.guard.ts` | Valida Bearer token; extrai JWT Payload | `request.user: JwtPayload` |
| **BoxContextGuard** | `src/common/guards/box-context.guard.ts` | Valida header `x-box-id` pertence ao usuário; injeta contexto | `request.user.boxId` |
| **RolesGuard** | `src/common/guards/roles.guard.ts` | Verifica se role está autorizada via decorator `@Roles()` | Bloqueia se não autorizado |

### 3.3 Exemplo de Proteção

```typescript
@Post()
@UseGuards(JwtAuthGuard, BoxContextGuard)        // autenticação + contexto
@UseGuards(RolesGuard)                            // autorização por role
@Roles(UserRole.ADMIN)                            // apenas ADMIN pode criar
async create(@Req() request: AuthenticatedRequest, @Body() dto: CreateWodDto) {
  return this.wodsService.createForBox(request.user.boxId!, dto);
}
```

**Requerimentos HTTP:**
- `Authorization: Bearer <jwt_token>` (obrigatório)
- `x-box-id: <objectid>` (obrigatório em rotas contextuais)

---

## 4. Modelo de Dados

### 4.1 Coleções Principais

#### **users**
```javascript
{
  _id: ObjectId,
  boxIds: [ObjectId, ...],              // boxes aos quais pertence
  name: String,
  email: String,
  passwordHash: String,                 // bcrypt
  role: 'ADMIN' | 'COACH' | 'ALUNO',
  contactPhone?: String,
  whatsapp?: String,
  address?: String,
  socialInstagram?: String,
  socialFacebook?: String,
  createdAt: Date
}
```

#### **boxes**
```javascript
{
  _id: ObjectId,
  parentBoxId?: ObjectId,               // para franquias
  name: String,
  cnpj: String,
  location: {
    type: 'Point',
    coordinates: [longitude, latitude]  // GeoJSON para geofencing
  },
  geofenceRadius: Number,               // em metros (típico: 100)
  contactPhone: String,
  contactEmail: String,
  contactWhatsapp: String,
  contactInstagram: String,
  contactWebsite: String,
  address: String,
  createdAt: Date
}
```

#### **wods**
```javascript
{
  _id: ObjectId,
  boxId: ObjectId,
  date: Date,                           // início do dia em timezone local
  title: String,
  model: 'AMRAP' | 'FOR_TIME' | 'EMOM' | 'TABATA' | 'RFT' | 'CHIPPER' | 'LADDER' | 'INTERVALS',
  blocks: [
    {
      type: 'WARMUP' | 'STRENGTH' | 'WOD' | 'COOLDOWN',
      title: String,
      content: String
    }
  ],
  createdAt: Date
}
```

**Unicidade:** um WOD por `(boxId, data)`. Validação dupla contra registros legados em UTC (ver `src/wods/wods.service.ts`).

#### **classes**
```javascript
{
  _id: ObjectId,
  boxId: ObjectId,
  name: String,
  weekDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY', ...],  // dias recorrentes
  startTime: '07:00',                   // HH:mm
  endTime: '08:00',
  checkinLimit?: Number,                // limite por aula no dia
  createdAt: Date
}
```

#### **checkins**
```javascript
{
  _id: ObjectId,
  boxId: ObjectId,
  userId: ObjectId,
  classId: ObjectId,
  activityDate: Date,
  status: 'COMPLETED' | 'MISSED',
  location: {
    latitude: Number,
    longitude: Number
  },
  distanceFromBoxInMeters: Number,      // validação geofencing
  createdAt: Date
}
```

**Validação:** distância ≤ `geofenceRadius` do box (padrão 100m).

#### **results**
```javascript
{
  _id: ObjectId,
  boxId: ObjectId,
  userId: ObjectId,
  checkinId: ObjectId,
  wodId: ObjectId,
  scoreKind: 'TIME' | 'LOAD' | 'UNKNOWN',
  score: String | Number,
  isNewPR: Boolean,
  createdAt: Date
}
```

#### **feed / posts**
```javascript
{
  _id: ObjectId,
  boxId: ObjectId,
  userId: ObjectId,
  checkinId?: ObjectId,
  resultId?: ObjectId,
  source: 'CHECKIN' | 'MANUAL' | 'PR',
  content: String,
  likes: Number,
  createdAt: Date
}
```

#### **rewards / user_streaks**
```javascript
{
  _id: ObjectId,
  boxId: ObjectId,
  userId: ObjectId,
  currentStreak: Number,
  longestStreak: Number,
  xp: Number,
  frozenDays: Number,
  milestonesBadges: {
    reached_7: Boolean,
    reached_15: Boolean,
    reached_30: Boolean,
    reached_45: Boolean,
    reached_60: Boolean,
    reached_100: Boolean
  },
  state: 'ACTIVE' | 'BROKEN',
  lastActivityDate: Date,
  createdAt: Date
}
```

### 4.2 Índices Críticos

| Collection | Índice | Razão |
|------------|--------|-------|
| **wods** | `{ boxId, date }` | Garantir unicidade e busca por box/data |
| **boxes** | `{ "location": "2dsphere" }` | Geofencing e busca por proximidade |
| **checkins** | `{ boxId, userId, activityDate }` | Histórico de presença |
| **classes** | `{ boxId, weekDays }` | Listagem por dia da semana |
| **users** | `{ email }` | Busca por email (login) |

---

## 5. Validação e Transformação

### 5.1 ValidationPipe Global

Configurada em `src/main.ts`:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // remove campos não documentados
    forbidNonWhitelisted: true,   // retorna erro 400 se houver extras
    transform: true               // transforma tipos via class-transformer
  })
);
```

### 5.2 Exemplo de DTO

```typescript
// src/wods/dto/create-wod.dto.ts
export class CreateWodDto {
  @IsDateString()
  date: string;                   // '2026-03-31'

  @IsString()
  @Length(2, 120)
  title: string;

  @IsOptional()
  @IsEnum(WodModel)
  model?: WodModel;               // auto-inferido se omitido

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateWodBlockDto)
  blocks: CreateWodBlockDto[];
}
```

**Erros retornam status 400** com lista de violações.

---

## 6. Tratamento de Erros

NestJS usa **exceções HTTP** padronizadas:

| Exception | Status | Uso |
|-----------|--------|-----|
| `BadRequestException` | 400 | Validação, entrada inválida |
| `UnauthorizedException` | 401 | JWT inválido, expirado |
| `ForbiddenException` | 403 | Role não autorizada |
| `NotFoundException` | 404 | Recurso não encontrado |
| `ConflictException` | 409 | Violação de unicidade (ex: WOD já existe) |
| `InternalServerErrorException` | 500 | Erro inesperado |

Exemplo de regra de negócio com erro:

```typescript
// src/wods/wods.service.ts
const existing = await this.db.collection('wods').findOne({ boxId, date });
if (existing) {
  throw new ConflictException(
    'Ja existe um WOD cadastrado para esta data neste box'
  );
}
```

---

## 7. Fluxos Técnicos Críticos

### 7.1 Autenticação (Login)

```
POST /auth/login { email, password }
  ↓
UserService.validatePassword()
  ↓
JWT.sign({ sub, email, boxIds, role })
  ↓
200 OK { accessToken, tokenType: 'Bearer', user: {...} }
```

### 7.2 Criação de WOD (com contexto multi-box)

```
POST /wods
Headers: Authorization: Bearer <token>, x-box-id: <id>
Body: { date, title, model?, blocks }
  ↓
JwtAuthGuard: valida token → request.user
  ↓
BoxContextGuard: valida x-box-id ∈ request.user.boxIds → request.user.boxId
  ↓
RolesGuard + @Roles(ADMIN): rejeita se role ≠ ADMIN
  ↓
ValidationPipe: valida CreateWodDto
  ↓
WodsService.createForBox(boxId, dto)
  ├─ parseIsoDateAsLocalStart(dto.date) → Date
  ├─ Check: existe WOD para este (boxId, date)? → 409 Conflict
  ├─ Insert em wods collection
  └─ Retorna ObjectId
  ↓
201 Created { wodId, boxId }
```

### 7.3 Check-in com Geofencing

```
POST /checkins
Headers: Authorization, x-box-id
Body: { classId, location: { latitude, longitude } }
  ↓
Valida JwtAuthGuard, BoxContextGuard
  ↓
CheckinsService.create(boxId, userId, dto)
  ├─ Busca box.location.coordinates
  ├─ Calcula distância (Haversine)
  ├─ Distância > geofenceRadius? → 403 Forbidden
  └─ Insert em checkins
  ↓
201 Created { checkinId }
```

---

## 8. Integração com MongoDB

### 8.1 Conexão

**Variável de ambiente:**
```bash
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=cross_app
```

**Inicialização em `src/database/database.module.ts`:**
```typescript
providers: [
  {
    provide: MONGO_CLIENT,
    useFactory: async () => {
      const client = new MongoClient(process.env.MONGO_URI);
      await client.connect();
      return client.db(process.env.MONGO_DB_NAME);
    }
  }
]
```

### 8.2 Acesso em Serviços

```typescript
constructor(@Inject(MONGO_CLIENT) private readonly db: Db) {}

// Busca
const wod = await this.db.collection<Wod>('wods').findOne({
  boxId: new ObjectId(boxId),
  date: { $gte: start, $lte: end }
});

// Insert
const result = await this.db.collection<Wod>('wods').insertOne(wod);

// Update
await this.db.collection<User>('users').updateOne(
  { _id: userId },
  { $push: { boxIds: newBoxId } }
);
```

---

## 9. Execução Local

### 9.1 Setup

```bash
# 1. Clonar repo e instalar dependências
git clone <repo>
cd cross-app-backend
npm install

# 2. Iniciar MongoDB via Docker Compose
docker-compose up -d mongo

# 3. (Opcional) Seed de dados de teste
npm run seed:test-data

# 4. Iniciar servidor em modo desenvolvimento
npm run start:dev
```

**Resultado esperado:**
```
[Nest] 12:34:56 LOG [Bootstrap] NestApplication successfully started +123ms
```

### 9.2 Acessar Endpoints

- **Swagger UI:** http://localhost:3000/api
- **Health check:** `GET http://localhost:3000`

### 9.3 Variáveis de Ambiente Padrão (Desenvolvimento)

```bash
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=cross_app
JWT_SECRET=dev_secret_key_do_not_use_in_production
PORT=3000
NODE_ENV=development
```

---

## 10. Build e Deployment

### 10.1 Build para Produção

```bash
npm run build
```

Gera pasta `dist/` com código compilado.

### 10.2 Variáveis de Ambiente em Produção

```bash
MONGO_URI=mongodb+srv://<user>:<pwd>@<cluster>/
MONGO_DB_NAME=cross_app_prod
JWT_SECRET=<gerar_chave_criptografica_segura>
PORT=3000
NODE_ENV=production
```

### 10.3 Testes

```bash
# Testes unitários
npm run test

# Testes end-to-end
npm run test:e2e

# Coverage
npm run test:cov
```

---

## 11. Conformidade Técnica

### 11.1 Linting

```bash
npm run lint
npm run lint:fix
```

Usa **ESLint** com configuração em `eslint.config.mjs`.

### 11.2 Swagger e Documentação

- **Contrato estático:** `docs/swagger.json` (sincronizar após mudanças)
- **UI interativa:** GET `/api` enquanto servidor está rodando
- **Decorators usados:**
  - `@ApiTags('ModuleName')`
  - `@ApiOperation({ summary, description })`
  - `@ApiResponse({ status, description })`
  - `@ApiBearerAuth()`
  - `@ApiHeader({ name, description, required })`

---

## 12. Observabilidade e Debugging

### 12.1 Logs

NestJS log por padrão em `src/main.ts`:
```typescript
const app = await NestFactory.create(AppModule);
// Logs automáticos de rota, guard, pipe
```

### 12.2 Debugging com VSCode

Criar `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "NestJS Debug",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:debug"],
      "console": "integratedTerminal"
    }
  ]
}
```

---

## 13. Responsabilidades de Manutenção

| Aspecto | Responsável | Cadência |
|--------|-------------|----------|
| **Swagger / Contrato API** | Tech Lead + Devs | Ao alterar endpoints |
| **Segurança (Guards, JWT)** | Security team | Quinzenal |
| **Schema de dados** | DBA + Devs | Ao adicionar coleção |
| **Índices e performance** | DBA | Mensal ou por demanda |
| **Testes e cobertura** | QA + Devs | Contínuo |
| **Logs em produção** | DevOps | Diário |

---

## 14. Referências de Arquivos

- **Módulo raiz:** `src/app.module.ts`
- **Guards:** `src/common/guards/*.guard.ts`
- **Enums:** `src/common/enums/*.enum.ts`
- **Interfaces:** `src/common/interfaces/*.interface.ts`
- **Conexão DB:** `src/database/database.module.ts`
- **Configuração NestJS:** `nest-cli.json`
- **Contrato API:** `docs/swagger.json`

---

## Próximas Leituras

- Para entender fluxos de negócio e regras do domínio, veja `docs/FEATURES_PRODUTO.md`
- Para detalhes de um módulo específico, veja o serviço correspondente em `src/<modulo>/`
