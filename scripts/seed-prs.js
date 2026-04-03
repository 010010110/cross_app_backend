/**
 * Seed de PRs (results):
 * - cria PRs vinculados a WOD (com wodId)
 * - cria PRs diretos por exercicio (sem wodId)
 *
 * Uso:
 *   node scripts/seed-prs.js
 *
 * Requer que existam:
 * - usuarios ALUNO
 * - boxes
 * - exercicios (globais ou por box)
 *
 * Opcional:
 *   PRS_PER_BOX_WITH_WOD      (padrao: 3)
 *   PRS_PER_BOX_EXERCISE_ONLY (padrao: 2)
 *
 * Variaveis de ambiente:
 *   MONGO_URI      (padrao: mongodb://localhost:27017)
 *   MONGO_DB_NAME  (padrao: cross_app)
 */

require('dotenv/config');
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME ?? 'cross_app';

const PRS_PER_BOX_WITH_WOD = Number(process.env.PRS_PER_BOX_WITH_WOD ?? 3);
const PRS_PER_BOX_EXERCISE_ONLY = Number(process.env.PRS_PER_BOX_EXERCISE_ONLY ?? 2);

const SCORE_PRESETS = {
  WEIGHTLIFTING: ['80kg', '90kg', '100kg', '110kg', '120kg'],
  GYMNASTICS: ['8', '10', '12', '15', '18'],
  MONOSTRUCTURAL: ['02:10', '02:00', '01:55', '01:50', '01:45'],
  ACCESSORY: ['20', '25', '30', '35', '40'],
};

const REPS_PRESETS = ['80', '95', '110', '7+12', '9+18', '120 reps'];
const TIME_PRESETS = ['15:40', '12:34', '10:22', '08:59', '00:18:45'];

const REP_BASED_WOD_MODELS = new Set(['AMRAP', 'EMOM', 'TABATA']);
const TIME_BASED_WOD_MODELS = new Set(['FOR_TIME', 'RFT', 'CHIPPER']);
const HYBRID_WOD_MODELS = new Set(['LADDER', 'INTERVALS']);

function scoreKindFromScore(score) {
  return score.includes(':') ? 'TIME' : 'LOAD';
}

function scoreForExercise(exercise, seedIndex) {
  const preset = SCORE_PRESETS[exercise.category] ?? SCORE_PRESETS.WEIGHTLIFTING;
  return preset[seedIndex % preset.length];
}

function inferWodModelFromText(wod) {
  const content = [
    wod.title ?? '',
    ...(wod.blocks ?? []).flatMap((block) => [block.title ?? '', block.content ?? '']),
  ]
    .join(' ')
    .toUpperCase();

  if (/\bAMRAP\b/.test(content)) return 'AMRAP';
  if (/\bFOR\s*TIME\b|\bFORTIME\b/.test(content)) return 'FOR_TIME';
  if (/\bEMOM\b/.test(content)) return 'EMOM';
  if (/\bTABATA\b/.test(content)) return 'TABATA';
  if (/\bRFT\b|\bROUNDS?\s+FOR\s+TIME\b/.test(content)) return 'RFT';
  if (/\bCHIPPER\b/.test(content)) return 'CHIPPER';
  if (/\bLADDER\b/.test(content)) return 'LADDER';
  if (/\bINTERVALS?\b/.test(content)) return 'INTERVALS';

  return null;
}

function scoreForWodModel(wod, seedIndex) {
  const model = wod?.model ?? inferWodModelFromText(wod);

  if (model && REP_BASED_WOD_MODELS.has(model)) {
    return REPS_PRESETS[seedIndex % REPS_PRESETS.length];
  }

  if (model && TIME_BASED_WOD_MODELS.has(model)) {
    return TIME_PRESETS[seedIndex % TIME_PRESETS.length];
  }

  if (model && HYBRID_WOD_MODELS.has(model)) {
    const hybridPool = [...REPS_PRESETS, ...TIME_PRESETS];
    return hybridPool[seedIndex % hybridPool.length];
  }

  // Fallback para WODs antigos sem modelo detectavel.
  return TIME_PRESETS[seedIndex % TIME_PRESETS.length];
}

function createdAtForSeed(offsetDays, offsetMinutes) {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);
  date.setHours(6, 0, 0, 0);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  return date;
}

function objectIdToKey(value) {
  if (!value) return 'none';
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === 'string') return value;
  return String(value);
}

async function loadExercisesForBox(db, boxId) {
  return db
    .collection('exercises')
    .find({
      $or: [{ isGlobal: true }, { boxId: new ObjectId(boxId) }],
    })
    .toArray();
}

async function seedPrsForStudentInBox(db, student, boxId, options) {
  const exercises = await loadExercisesForBox(db, boxId);

  const wods = await db
    .collection('wods')
    .find({ boxId: new ObjectId(boxId) })
    .sort({ date: -1 })
    .limit(Math.max(options.withWod, 1))
    .toArray();

  let inserted = 0;
  let skipped = 0;
  let indexCursor = 0;

  for (let i = 0; i < options.withWod; i++) {
    const wod = wods[i % Math.max(wods.length, 1)] ?? null;

    if (!wod) {
      skipped++;
      continue;
    }

    const score = scoreForWodModel(wod, i + 1);
    const scoreKind = scoreKindFromScore(score);

    const query = {
      userId: student._id,
      boxId: new ObjectId(boxId),
      wodId: wod._id,
      wodTitle: wod.title,
      score,
      isNewPR: true,
    };

    const result = await db.collection('results').updateOne(
      query,
      {
        $setOnInsert: {
          ...query,
          wodModel: wod.model,
          scoreKind,
          createdAt: createdAtForSeed(i + 1, indexCursor * 7),
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) inserted++;
    indexCursor++;
  }

  for (let i = 0; i < options.exerciseOnly; i++) {
    if (exercises.length === 0) {
      skipped++;
      continue;
    }

    const exercise = exercises[(i + options.withWod) % exercises.length];
    const score = scoreForExercise(exercise, i + options.withWod + 1);
    const scoreKind = scoreKindFromScore(score);

    const query = {
      userId: student._id,
      boxId: new ObjectId(boxId),
      exerciseId: exercise._id,
      score,
      isNewPR: true,
      wodId: { $exists: false },
    };

    const result = await db.collection('results').updateOne(
      query,
      {
        $setOnInsert: {
          userId: student._id,
          boxId: new ObjectId(boxId),
          exerciseId: exercise._id,
          score,
          scoreKind,
          isNewPR: true,
          createdAt: createdAtForSeed(i + options.withWod + 1, indexCursor * 7),
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) inserted++;
    indexCursor++;
  }

  return { inserted, skipped, reason: null };
}

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(MONGO_DB_NAME);

    const students = await db.collection('users').find({ role: 'ALUNO' }).toArray();
    if (students.length === 0) {
      console.error('Nenhum usuario ALUNO encontrado. Rode seed-test-data primeiro.');
      process.exit(1);
    }

    const boxes = await db.collection('boxes').find({}, { projection: { _id: 1 } }).toArray();
    const existingBoxIds = new Set(boxes.map((box) => objectIdToKey(box._id)));

    let totalInserted = 0;
    let totalSkipped = 0;
    let processedStudents = 0;

    for (const student of students) {
      const studentBoxIds = (student.boxIds ?? [])
        .map((id) => objectIdToKey(id))
        .filter((id) => existingBoxIds.has(id));

      if (studentBoxIds.length === 0) {
        continue;
      }

      for (const boxId of studentBoxIds) {
        const summary = await seedPrsForStudentInBox(db, student, boxId, {
          withWod: Math.max(0, PRS_PER_BOX_WITH_WOD),
          exerciseOnly: Math.max(0, PRS_PER_BOX_EXERCISE_ONLY),
        });

        totalInserted += summary.inserted;
        totalSkipped += summary.skipped;
      }

      processedStudents++;
    }

    console.log('\nSeed de PRs concluido com sucesso.');
    console.log(`Banco: ${MONGO_DB_NAME}`);
    console.log(`Alunos processados : ${processedStudents}`);
    console.log(`PRs inseridos      : ${totalInserted}`);
    console.log(`PRs ignorados      : ${totalSkipped}`);
    console.log(`Com WOD por box    : ${Math.max(0, PRS_PER_BOX_WITH_WOD)}`);
    console.log(`Sem WOD por box    : ${Math.max(0, PRS_PER_BOX_EXERCISE_ONLY)}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Erro no seed de PRs:', error);
  process.exit(1);
});
