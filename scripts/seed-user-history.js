/**
 * Seed de histórico completo para um usuário específico:
 *  - WODs FOR_TIME / RFT / CHIPPER criados em datas livres dos boxes do usuário
 *  - Um resultado de WOD para cada WOD dos boxes (AMRAP já existentes + novos)
 *  - Progressão realista de PRs em 5 exercícios (mostrando evolução ao longo do tempo)
 *
 * Uso:
 *   node scripts/seed-user-history.js
 *
 * Variáveis de ambiente:
 *   MONGO_URI      (padrão: mongodb://localhost:27017)
 *   MONGO_DB_NAME  (padrão: cross_app)
 *   TARGET_USER_ID (padrão: 69eb56d518cbe50e76370a03)
 */

require('dotenv/config');
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME ?? 'cross_app';
const TARGET_USER_ID = process.env.TARGET_USER_ID ?? '69eb56d518cbe50e76370a03';

// ---------------------------------------------------------------------------
// Inferência de modelo de WOD (espelhada do results.service.ts)
// ---------------------------------------------------------------------------
function inferWodModel(wod) {
  if (wod.model) return wod.model;

  const text = [
    wod.title ?? '',
    ...(wod.blocks ?? []).flatMap((b) => [b.title ?? '', b.content ?? '']),
  ]
    .join(' ')
    .toUpperCase();

  if (/\bAMRAP\b/.test(text)) return 'AMRAP';
  if (/\bFOR\s*TIME\b|\bFORTIME\b/.test(text)) return 'FOR_TIME';
  if (/\bEMOM\b/.test(text)) return 'EMOM';
  if (/\bTABATA\b/.test(text)) return 'TABATA';
  if (/\bRFT\b|\bROUNDS?\s+FOR\s+TIME\b/.test(text)) return 'RFT';
  if (/\bCHIPPER\b/.test(text)) return 'CHIPPER';
  if (/\bLADDER\b/.test(text)) return 'LADDER';
  if (/\bINTERVALS?\b/.test(text)) return 'INTERVALS';

  return null;
}

function scoreKindFromScore(score) {
  return score.includes(':') ? 'TIME' : 'LOAD';
}

// Devolve um Date subtraindo `days` dias e `hours` horas do momento atual
function daysAgo(days, hours = 8) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hours, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Definição de scores por modelo — crescente para mostrar progresso
// ---------------------------------------------------------------------------
const WOD_SCORE_PROGRESSION_AMRAP = [
  '78',    // mais antigo
  '82',
  '85',
  '88',
  '7+12',  // ~91 reps
  '7+15',
  '8+3',
  '9+0',   // mais recente ~ melhor
];

const WOD_SCORE_PROGRESSION_FOR_TIME = [
  '18:45',
  '17:30',
  '16:22',
  '15:10',
  '14:45',
  '13:58',
  '13:20',
  '12:34',
];

// ---------------------------------------------------------------------------
// WODs FOR_TIME / RFT / CHIPPER a serem criados em datas livres dos boxes
// ---------------------------------------------------------------------------
const TIME_WOD_TEMPLATES = [
  {
    dateStr: '2026-03-25',
    titleSuffix: 'Fran',
    model: 'FOR_TIME',
    blocks: [
      { type: 'WARMUP', title: 'Warm-up',    content: '400m run, 20 air squats, 10 push-ups, 10 ring rows' },
      { type: 'SKILL',  title: 'Skill',      content: 'Kipping pull-up technique — 3 sets of 5' },
      { type: 'WOD',    title: 'Main — Fran', content: 'For Time: 21-15-9 Thrusters (43kg) + Pull-ups' },
    ],
  },
  {
    dateStr: '2026-03-26',
    titleSuffix: 'Helen',
    model: 'RFT',
    blocks: [
      { type: 'WARMUP', title: 'Warm-up',     content: '3 rounds: 400m row, 10 KB swings, 10 box jumps' },
      { type: 'WOD',    title: 'Main — Helen', content: '3 Rounds for Time: 400m Run + 21 KB Swings (24kg) + 12 Pull-ups' },
    ],
  },
  {
    dateStr: '2026-03-28',
    titleSuffix: 'Chipper',
    model: 'CHIPPER',
    blocks: [
      { type: 'WARMUP', title: 'Warm-up',       content: '2 rounds: 30 single unders, 10 air squats, 10 sit-ups, 200m run' },
      { type: 'WOD',    title: 'Main — Chipper', content: 'Chipper For Time: 50 Wall Balls + 40 Pull-ups + 30 Box Jumps + 20 Thrusters (43kg) + 10 Burpee Box Jump Overs' },
    ],
  },
  {
    dateStr: '2026-03-30',
    titleSuffix: 'DL + HSPU',
    model: 'FOR_TIME',
    blocks: [
      { type: 'WARMUP', title: 'Warm-up',       content: '400m run, 10 Romanian deadlifts (empty bar), 10 pike push-ups' },
      { type: 'SKILL',  title: 'Skill',          content: 'Handstand hold — 5 x 30s against wall' },
      { type: 'WOD',    title: 'Main — DL+HSPU', content: 'For Time: 21-15-9 Deadlifts (100kg) + Handstand Push-ups' },
    ],
  },
  {
    dateStr: '2026-04-01',
    titleSuffix: 'Row + Swing + Pull',
    model: 'RFT',
    blocks: [
      { type: 'WARMUP', title: 'Warm-up',    content: '5 min easy row, 10 KB halos, 10 band pull-aparts' },
      { type: 'WOD',    title: 'Main — RFT', content: '5 Rounds for Time: 500m Row + 15 KB Swings (32kg) + 10 Pull-ups' },
    ],
  },
];

function wodScoreForModel(model, index) {
  const REP_BASED = new Set(['AMRAP', 'EMOM', 'TABATA']);
  const TIME_BASED = new Set(['FOR_TIME', 'RFT', 'CHIPPER']);

  if (model && REP_BASED.has(model)) {
    return WOD_SCORE_PROGRESSION_AMRAP[index % WOD_SCORE_PROGRESSION_AMRAP.length];
  }
  if (model && TIME_BASED.has(model)) {
    return WOD_SCORE_PROGRESSION_FOR_TIME[index % WOD_SCORE_PROGRESSION_FOR_TIME.length];
  }
  // LADDER / INTERVALS / null — híbrido ou desconhecido, usa reps como fallback
  return WOD_SCORE_PROGRESSION_AMRAP[index % WOD_SCORE_PROGRESSION_AMRAP.length];
}

// ---------------------------------------------------------------------------
// Progressão de PRs por exercício (cada entrada = sesssão cronológica)
// ---------------------------------------------------------------------------
const PR_PROGRESSIONS = [
  {
    name: 'Deadlift',
    entries: [
      { score: '80kg',  daysBack: 90 },
      { score: '90kg',  daysBack: 75 },
      { score: '100kg', daysBack: 60 },
      { score: '110kg', daysBack: 45 },
      { score: '115kg', daysBack: 30 },
      { score: '120kg', daysBack: 15 },
      { score: '125kg', daysBack: 5  },
    ],
  },
  {
    name: 'Clean and Jerk',
    entries: [
      { score: '55kg', daysBack: 80 },
      { score: '60kg', daysBack: 65 },
      { score: '65kg', daysBack: 50 },
      { score: '70kg', daysBack: 35 },
      { score: '72kg', daysBack: 20 },
      { score: '75kg', daysBack: 7  },
    ],
  },
  {
    name: 'Front Squat',
    entries: [
      { score: '70kg',  daysBack: 85 },
      { score: '80kg',  daysBack: 68 },
      { score: '90kg',  daysBack: 52 },
      { score: '100kg', daysBack: 36 },
      { score: '105kg', daysBack: 18 },
      { score: '110kg', daysBack: 6  },
    ],
  },
  {
    name: 'Row 500m',
    entries: [
      { score: '02:15', daysBack: 70 },
      { score: '02:05', daysBack: 56 },
      { score: '02:00', daysBack: 42 },
      { score: '01:55', daysBack: 28 },
      { score: '01:52', daysBack: 14 },
      { score: '01:48', daysBack: 4  },
    ],
  },
  {
    name: 'Back Squat',
    entries: [
      { score: '90kg',  daysBack: 88 },
      { score: '100kg', daysBack: 72 },
      { score: '110kg', daysBack: 55 },
      { score: '120kg', daysBack: 38 },
      { score: '125kg', daysBack: 22 },
      { score: '130kg', daysBack: 9  },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(MONGO_DB_NAME);

  // 1. Carregar usuário
  let user;
  try {
    user = await db.collection('users').findOne({ _id: new ObjectId(TARGET_USER_ID) });
  } catch {
    console.error('TARGET_USER_ID inválido:', TARGET_USER_ID);
    process.exit(1);
  }

  if (!user) {
    console.error('Usuário não encontrado:', TARGET_USER_ID);
    process.exit(1);
  }

  const userBoxObjectIds = (user.boxIds ?? []).map((id) => new ObjectId(id.toString()));

  if (userBoxObjectIds.length === 0) {
    console.error('Usuário não possui boxIds vinculados.');
    process.exit(1);
  }

  console.log(`\nUsuário: ${user.name} (${user._id})`);
  console.log(`Boxes vinculados: ${userBoxObjectIds.map((id) => id.toHexString()).join(', ')}`);

  // 2. Criar WODs FOR_TIME / RFT / CHIPPER em datas livres para cada box
  const userBoxDocs = await db
    .collection('boxes')
    .find({ _id: { $in: userBoxObjectIds } })
    .project({ _id: 1, name: 1 })
    .toArray();
  const boxById = new Map(userBoxDocs.map((b) => [b._id.toString(), b]));

  let timeWodsCreated = 0;

  for (const tmpl of TIME_WOD_TEMPLATES) {
    const [y, m, d] = tmpl.dateStr.split('-').map(Number);
    const dateLocal = new Date(y, m - 1, d, 0, 0, 0, 0);

    for (const boxId of userBoxObjectIds) {
      const boxName = boxById.get(boxId.toString())?.name ?? `Box ${boxId.toString().slice(-4)}`;
      const title = `${boxName} — ${tmpl.titleSuffix}`;

      const r = await db.collection('wods').updateOne(
        { boxId, date: dateLocal },
        {
          $setOnInsert: {
            boxId,
            date: dateLocal,
            title,
            model: tmpl.model,
            blocks: tmpl.blocks,
            createdAt: new Date(y, m - 1, d, 12, 0, 0, 0),
          },
        },
        { upsert: true },
      );

      if (r.upsertedCount > 0) timeWodsCreated++;
    }
  }

  console.log(`WODs de tempo criados: ${timeWodsCreated} novos`);

  // 3. Carregar TODOS os WODs dos boxes do usuário, ordenados por data
  const wods = await db
    .collection('wods')
    .find({ boxId: { $in: userBoxObjectIds } })
    .sort({ date: 1 })
    .toArray();

  console.log(`WODs totais para os boxes do usuário: ${wods.length}`);

  // 4. Inserir resultado de WOD para cada WOD (upsert por userId+wodId)
  //    O scoreKind é determinado pelo modelo efetivo de cada WOD
  let wodInserted = 0;
  let wodSkipped = 0;

  for (let i = 0; i < wods.length; i++) {
    const wod = wods[i];
    const effectiveModel = inferWodModel(wod);
    const score = wodScoreForModel(effectiveModel, i);
    const scoreKind = scoreKindFromScore(score);

    const filter = {
      userId: user._id,
      wodId: wod._id,
    };

    // Data do resultado = dia do WOD, ~9h (mesma data faz sentido semântico)
    const resultDate = new Date(
      wod.date.getFullYear(),
      wod.date.getMonth(),
      wod.date.getDate(),
      9 + (i % 3), 0, 0, 0,
    );

    const doc = {
      userId: user._id,
      boxId: wod.boxId,
      wodId: wod._id,
      wodModel: effectiveModel ?? undefined,
      wodTitle: wod.title,
      score,
      scoreKind,
      createdAt: resultDate,
    };

    const r = await db.collection('results').updateOne(
      filter,
      { $setOnInsert: doc },
      { upsert: true },
    );

    if (r.upsertedCount > 0) wodInserted++;
    else wodSkipped++;
  }

  // 5. Carregar exercícios para mapeamento nome → ObjectId
  const allExercises = await db.collection('exercises').find({}).toArray();
  const exerciseByName = new Map(allExercises.map((e) => [e.name, e]));

  // Usar primeiro boxId do usuário como contexto de PR
  const prBoxId = userBoxObjectIds[0];

  // 6. Inserir progressão de PRs (upsert por userId+exerciseId+score)
  let prInserted = 0;
  let prSkipped = 0;
  let prExerciseNotFound = 0;

  for (const progression of PR_PROGRESSIONS) {
    const exercise = exerciseByName.get(progression.name);
    if (!exercise) {
      console.warn(`  [AVISO] Exercício não encontrado: "${progression.name}"`);
      prExerciseNotFound++;
      continue;
    }

    for (const entry of progression.entries) {
      const scoreKind = scoreKindFromScore(entry.score);

      const filter = {
        userId: user._id,
        exerciseId: exercise._id,
        score: entry.score,
        isNewPR: true,
      };

      const doc = {
        userId: user._id,
        boxId: prBoxId,
        exerciseId: exercise._id,
        score: entry.score,
        scoreKind,
        isNewPR: true,
        createdAt: daysAgo(entry.daysBack),
      };

      const r = await db.collection('results').updateOne(
        filter,
        { $setOnInsert: doc },
        { upsert: true },
      );

      if (r.upsertedCount > 0) prInserted++;
      else prSkipped++;
    }
  }

  // 7. Resumo
  console.log('\n─────────────────────────────────────────');
  console.log('Seed de histórico do usuário concluído.');
  console.log(`Banco             : ${MONGO_DB_NAME}`);
  console.log(`Usuário           : ${user.name} (${TARGET_USER_ID})`);
  console.log(`WODs de tempo     : ${timeWodsCreated} novos WODs criados (FOR_TIME/RFT/CHIPPER)`);
  console.log(`WOD results       : ${wodInserted} inseridos, ${wodSkipped} já existiam`);
  console.log(`PRs inseridos     : ${prInserted} inseridos, ${prSkipped} já existiam`);
  if (prExerciseNotFound > 0) {
    console.log(`Exercícios s/ match: ${prExerciseNotFound} (verifique os nomes nas progressões)`);
  }
  console.log('─────────────────────────────────────────\n');

  await client.close();
}

main().catch((err) => {
  console.error('Erro no seed de histórico:', err);
  process.exit(1);
});
