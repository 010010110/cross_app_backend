/**
 * Seed de gamificacao para o usuario seed.aluno.a3@crossapp.test:
 * - check-ins (historico recente em dois boxes)
 * - streak e XP (reward_streaks)
 * - milestones (reward_milestones)
 * - ledger de XP (reward_xp_ledger)
 * - PRs/resultados e posts (manual + PR_AUTO)
 *
 * Uso:
 *   node scripts/seed-gamification-a3.js
 *
 * Requer:
 *   - seed-test-data executado (usuario, boxes, classes e wods)
 *
 * Variaveis de ambiente:
 *   MONGO_URI      (padrao: mongodb://localhost:27017)
 *   MONGO_DB_NAME  (padrao: cross_app)
 */

require('dotenv/config');
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME ?? 'cross_app';
const TARGET_EMAIL = 'seed.aluno.a3@crossapp.test';

const REQUIRED_EXERCISES = [
  { name: 'Deadlift', category: 'WEIGHTLIFTING' },
  { name: 'Row 500m', category: 'MONOSTRUCTURAL' },
  { name: 'Back Squat', category: 'WEIGHTLIFTING' },
];

function normalizeDayStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildDateFromToday(daysAgo, hour, minute) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function nearBoxCoordinates(box, latDelta = 0.00012, lngDelta = 0.00012) {
  const [lng, lat] = box.location.coordinates;
  return {
    latitude: lat + latDelta,
    longitude: lng + lngDelta,
  };
}

async function ensureExercises(db) {
  const exerciseMap = new Map();

  for (const exerciseSeed of REQUIRED_EXERCISES) {
    const existing = await db.collection('exercises').findOne({
      name: exerciseSeed.name,
      isGlobal: true,
    });

    if (existing) {
      exerciseMap.set(exerciseSeed.name, existing);
      continue;
    }

    const insert = await db.collection('exercises').insertOne({
      name: exerciseSeed.name,
      category: exerciseSeed.category,
      isGlobal: true,
      createdAt: new Date(),
    });

    exerciseMap.set(exerciseSeed.name, {
      _id: insert.insertedId,
      ...exerciseSeed,
      isGlobal: true,
      createdAt: new Date(),
    });
  }

  return exerciseMap;
}

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(MONGO_DB_NAME);

    const user = await db.collection('users').findOne({ email: TARGET_EMAIL, role: 'ALUNO' });
    if (!user) {
      console.error(`Usuario ${TARGET_EMAIL} nao encontrado. Execute seed-test-data primeiro.`);
      process.exit(1);
    }

    const boxIds = (user.boxIds ?? []).filter((id) => id instanceof ObjectId);
    if (boxIds.length === 0) {
      console.error(`Usuario ${TARGET_EMAIL} nao possui boxIds.`);
      process.exit(1);
    }

    const boxes = await db.collection('boxes').find({ _id: { $in: boxIds } }).toArray();
    if (boxes.length === 0) {
      console.error('Nenhum box valido encontrado para o aluno A3.');
      process.exit(1);
    }

    const boxMap = new Map(boxes.map((box) => [box.name, box]));
    const alpha = boxMap.get('Cross Alpha') ?? boxes[0];
    const bravo = boxMap.get('Cross Bravo') ?? boxes.find((b) => !b._id.equals(alpha._id)) ?? boxes[0];

    const classes = await db
      .collection('classes')
      .find({ boxId: { $in: [alpha._id, bravo._id] } })
      .sort({ startTime: 1 })
      .toArray();

    const alphaClass = classes.find((cls) => cls.boxId.equals(alpha._id));
    const bravoClass = classes.find((cls) => cls.boxId.equals(bravo._id));

    if (!alphaClass || !bravoClass) {
      console.error('Classes dos boxes alpha/bravo nao encontradas. Execute seed-test-data primeiro.');
      process.exit(1);
    }

    const alphaWod = await db
      .collection('wods')
      .find({ boxId: alpha._id })
      .sort({ date: -1 })
      .limit(1)
      .next();

    const bravoWod = await db
      .collection('wods')
      .find({ boxId: bravo._id })
      .sort({ date: -1 })
      .limit(1)
      .next();

    if (!alphaWod || !bravoWod) {
      console.error('WODs dos boxes alpha/bravo nao encontrados. Execute seed-test-data primeiro.');
      process.exit(1);
    }

    const exerciseMap = await ensureExercises(db);
    const deadlift = exerciseMap.get('Deadlift');
    const row500 = exerciseMap.get('Row 500m');
    const backSquat = exerciseMap.get('Back Squat');

    if (!deadlift || !row500 || !backSquat) {
      console.error('Falha ao carregar exercicios obrigatorios para o seed.');
      process.exit(1);
    }

    await db.collection('posts').deleteMany({ userId: user._id });
    await db.collection('results').deleteMany({ userId: user._id });
    await db.collection('checkins').deleteMany({ userId: user._id });
    await db.collection('reward_streaks').deleteMany({ userId: user._id });
    await db.collection('reward_milestones').deleteMany({ userId: user._id });
    await db.collection('reward_xp_ledger').deleteMany({ userId: user._id });

    const checkinSeeds = [
      { key: 'alpha-d12', box: alpha, classDoc: alphaClass, daysAgo: 12, hour: 6, minute: 8 },
      { key: 'alpha-d11', box: alpha, classDoc: alphaClass, daysAgo: 11, hour: 6, minute: 5 },
      { key: 'alpha-d10', box: alpha, classDoc: alphaClass, daysAgo: 10, hour: 6, minute: 6 },
      { key: 'alpha-d9', box: alpha, classDoc: alphaClass, daysAgo: 9, hour: 6, minute: 7 },
      { key: 'alpha-d8', box: alpha, classDoc: alphaClass, daysAgo: 8, hour: 6, minute: 3 },
      { key: 'alpha-d7', box: alpha, classDoc: alphaClass, daysAgo: 7, hour: 6, minute: 4 },
      { key: 'alpha-d6', box: alpha, classDoc: alphaClass, daysAgo: 6, hour: 6, minute: 5 },
      { key: 'alpha-d5', box: alpha, classDoc: alphaClass, daysAgo: 5, hour: 6, minute: 9 },
      { key: 'alpha-d4', box: alpha, classDoc: alphaClass, daysAgo: 4, hour: 6, minute: 2 },
      { key: 'alpha-d3', box: alpha, classDoc: alphaClass, daysAgo: 3, hour: 6, minute: 5 },
      { key: 'alpha-d2', box: alpha, classDoc: alphaClass, daysAgo: 2, hour: 6, minute: 7 },
      { key: 'alpha-d1', box: alpha, classDoc: alphaClass, daysAgo: 1, hour: 6, minute: 6 },
      { key: 'alpha-d0', box: alpha, classDoc: alphaClass, daysAgo: 0, hour: 6, minute: 4 },
      { key: 'bravo-d4', box: bravo, classDoc: bravoClass, daysAgo: 4, hour: 18, minute: 10 },
      { key: 'bravo-d2', box: bravo, classDoc: bravoClass, daysAgo: 2, hour: 18, minute: 12 },
      { key: 'bravo-d1', box: bravo, classDoc: bravoClass, daysAgo: 1, hour: 18, minute: 8 },
      { key: 'bravo-d0', box: bravo, classDoc: bravoClass, daysAgo: 0, hour: 18, minute: 6 },
    ];

    const checkinIdsByKey = new Map();

    for (const seed of checkinSeeds) {
      const createdAt = buildDateFromToday(seed.daysAgo, seed.hour, seed.minute);
      const coords = nearBoxCoordinates(seed.box);

      const inserted = await db.collection('checkins').insertOne({
        userId: user._id,
        boxId: seed.box._id,
        classId: seed.classDoc._id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        distanceFromBoxInMeters: 22.7,
        createdAt,
      });

      checkinIdsByKey.set(seed.key, inserted.insertedId);
    }

    const alphaStreak = {
      userId: user._id,
      boxId: alpha._id,
      currentStreak: 13,
      longestStreak: 13,
      lastActivityDate: normalizeDayStart(new Date()),
      availableFreezes: 1,
      totalXp: 180,
      createdAt: buildDateFromToday(20, 7, 0),
      updatedAt: new Date(),
    };

    const bravoStreak = {
      userId: user._id,
      boxId: bravo._id,
      currentStreak: 4,
      longestStreak: 6,
      lastActivityDate: normalizeDayStart(new Date()),
      availableFreezes: 0,
      totalXp: 40,
      createdAt: buildDateFromToday(12, 19, 0),
      updatedAt: new Date(),
    };

    await db.collection('reward_streaks').insertMany([alphaStreak, bravoStreak]);

    const milestone7Date = buildDateFromToday(6, 7, 30);
    await db.collection('reward_milestones').insertOne({
      userId: user._id,
      boxId: alpha._id,
      streakDays: 7,
      rewardXp: 50,
      rewardFreeze: 1,
      unlockedAt: milestone7Date,
    });

    const alphaDailyLedger = [];
    for (let day = 12; day >= 0; day--) {
      alphaDailyLedger.push({
        userId: user._id,
        boxId: alpha._id,
        type: 'CHECKIN_DAILY',
        points: 10,
        createdAt: buildDateFromToday(day, 6, 20),
        metadata: { streakDays: 13 - day },
      });
    }

    const bravoDailyLedger = [];
    const bravoDays = [4, 2, 1, 0];
    for (let index = 0; index < bravoDays.length; index++) {
      bravoDailyLedger.push({
        userId: user._id,
        boxId: bravo._id,
        type: 'CHECKIN_DAILY',
        points: 10,
        createdAt: buildDateFromToday(bravoDays[index], 18, 20),
        metadata: { streakDays: index + 1 },
      });
    }

    const milestoneLedger = {
      userId: user._id,
      boxId: alpha._id,
      type: 'STREAK_MILESTONE',
      points: 50,
      createdAt: milestone7Date,
      metadata: {
        streakDays: 7,
        rewardFreeze: 1,
      },
    };

    await db.collection('reward_xp_ledger').insertMany([...alphaDailyLedger, ...bravoDailyLedger, milestoneLedger]);

    const resultDeadlift = await db.collection('results').insertOne({
      userId: user._id,
      boxId: alpha._id,
      exerciseId: deadlift._id,
      wodId: alphaWod._id,
      wodTitle: alphaWod.title,
      wodModel: alphaWod.model ?? null,
      score: '140kg',
      scoreKind: 'LOAD',
      isNewPR: true,
      createdAt: buildDateFromToday(1, 7, 10),
    });

    const resultRow = await db.collection('results').insertOne({
      userId: user._id,
      boxId: bravo._id,
      exerciseId: row500._id,
      wodId: bravoWod._id,
      wodTitle: bravoWod.title,
      wodModel: bravoWod.model ?? null,
      score: '01:49',
      scoreKind: 'TIME',
      isNewPR: true,
      createdAt: buildDateFromToday(0, 19, 0),
    });

    await db.collection('results').insertOne({
      userId: user._id,
      boxId: alpha._id,
      exerciseId: backSquat._id,
      wodId: alphaWod._id,
      wodTitle: alphaWod.title,
      wodModel: alphaWod.model ?? null,
      score: '120kg',
      scoreKind: 'LOAD',
      isNewPR: false,
      createdAt: buildDateFromToday(0, 7, 12),
    });

    await db.collection('posts').insertMany([
      {
        userId: user._id,
        boxId: alpha._id,
        checkinId: checkinIdsByKey.get('alpha-d2'),
        text: 'Consistencia e o segredo. Semana forte e foco total.',
        source: 'MANUAL',
        createdAt: buildDateFromToday(2, 6, 35),
      },
      {
        userId: user._id,
        boxId: alpha._id,
        checkinId: checkinIdsByKey.get('alpha-d1'),
        resultId: resultDeadlift.insertedId,
        text: 'Novo PR no Deadlift: 140kg',
        source: 'PR_AUTO',
        createdAt: buildDateFromToday(1, 7, 11),
      },
      {
        userId: user._id,
        boxId: bravo._id,
        checkinId: checkinIdsByKey.get('bravo-d0'),
        resultId: resultRow.insertedId,
        text: 'Novo PR no Row 500m: 01:49',
        source: 'PR_AUTO',
        createdAt: buildDateFromToday(0, 19, 1),
      },
    ]);

    console.log('\nSeed de gamificacao do aluno A3 concluido com sucesso.');
    console.log(`Banco: ${MONGO_DB_NAME}`);
    console.log(`Usuario: ${TARGET_EMAIL}`);
    console.log(`Checkins criados       : ${checkinSeeds.length}`);
    console.log('Streaks criadas        : 2 (alpha e bravo)');
    console.log('Milestones criadas     : 1 (7 dias em alpha)');
    console.log(`Lancamentos XP         : ${alphaDailyLedger.length + bravoDailyLedger.length + 1}`);
    console.log('Resultados criados     : 3 (2 PRs + 1 normal)');
    console.log('Posts criados          : 3 (1 manual + 2 PR_AUTO)');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Erro no seed de gamificacao do aluno A3:', error);
  process.exit(1);
});
