# Copilot Instructions - Cross App Backend

## Project Context
- Stack: NestJS 11 + TypeScript + MongoDB native driver (no Mongoose).
- Main goal: API for CrossFit box management, users, workouts (WOD), exercises and check-ins.
- Architecture: feature modules under src/ (auth, boxes, users, exercises, wods, checkins).
- Swagger UI is exposed by app at /api.
- Static API contract for frontend is in docs/swagger.json.

## Run And Validation
- Install: npm install
- Run API: npm run start:dev
- Build: npm run build
- Tests: npm run test and npm run test:e2e
- Lint: npm run lint

## Data And Infra
- MongoDB via Docker Compose service named mongo on port 27017.
- Default DB name: cross_app.
- Main env keys:
  - MONGO_URI (default mongodb://localhost:27017)
  - MONGO_DB_NAME (default cross_app)
  - JWT_SECRET (has insecure dev fallback, do not use in production)

## API Security Conventions
- Auth uses JWT Bearer token.
- Protected routes use JwtAuthGuard.
- Multi-box context uses required header x-box-id on contextual routes.
- BoxContextGuard validates if x-box-id belongs to authenticated user and injects user.boxId.
- Role checks use RolesGuard with roles ADMIN, COACH, ALUNO.

## Domain Rules To Preserve
- Boxes registration may create a new ADMIN or link an existing ADMIN with valid password.
- Student creation:
  - if student already exists in same box -> reject
  - if student exists in another box with role ALUNO -> link box
  - otherwise create a new student user
- Check-in only allowed within 100 meters from box coordinates.
- WOD uniqueness is by box + training date (including legacy UTC compatibility logic).
- Exercises for listing combine global exercises + box-specific exercises.

## Coding Guidelines For Agents
- Keep feature boundaries: controller -> service -> db access.
- Reuse existing interfaces and DTOs in each module before creating new types.
- Keep ValidationPipe behavior in mind: whitelist true, forbidNonWhitelisted true, transform true.
- Preserve exception semantics already used in services (BadRequestException, ConflictException, etc.).
- Prefer minimal, targeted edits; avoid refactoring unrelated modules.

## API Change Checklist
When creating or changing endpoints, ALWAYS update all affected artifacts:
1. DTO validation and Swagger decorators in controller/DTO.
2. Service logic and returned payload shape.
3. docs/swagger.json so frontend stays in sync.
4. Guards/roles/header requirements in docs and implementation.
5. Add or update tests when behavior changes.

## Frontend Integration Notes
- Login and box registration can return session payload with:
  - accessToken
  - tokenType
  - user (JWT payload fields)
- Most authenticated domain endpoints require both:
  - Authorization: Bearer <token>
  - x-box-id: <selected box id>

## Preferred Agent Behavior
- If requirements are ambiguous, inspect existing module patterns before proposing new patterns.
- Follow existing naming and folder structure conventions.
- Favor backward compatible changes in payload contracts.
- If an endpoint contract changes, explicitly mention frontend impact.
