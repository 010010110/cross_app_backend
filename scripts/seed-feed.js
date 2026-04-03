/**
 * Seed do feed:
 * - checkins para alunos nos ultimos dias
 * - posts manuais vinculados aos checkins
 * - resultados (PR) com auto-post no feed
 *
 * Uso:
 *   node scripts/seed-feed.js
 *
 * Requer que seed-test-data.js tenha sido executado antes.
 *
 * Variaveis de ambiente:
 *   MONGO_URI      (padrao: mongodb://localhost:27017)
 *   MONGO_DB_NAME  (padrao: cross_app)
 */

require('dotenv/config');
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME ?? 'cross_app';

const MANUAL_TEXTS = [
  'Treino pesado hoje, mas valeu cada rep!',
  'Novo dia, nova oportunidade de superar os limites.',
  'WOD arrasador! Mal consigo levantar os bracos haha',
  'Consistencia e o segredo. Dia {day} de treino consecutivo!',
  'Foco total hoje. Resultado aparece na balanca da vida.',
  'Aquela sensacao pos-treino nao tem preco.',
  'Hoje o AMRAP me venceu, mas amanha eu vou mais forte.',
  'Dupla de amigos no box hoje. Parceria e motivacao!',
  'Primeira vez batendo esse peso. Muito feliz com a evolucao!',
  'Treino da tarde com a galera da turma das 18h. Top demais!',
  'Deu vontade de largar tudo no meio, mas concluiu. Orgulho!',
  'Minha turma favorita. Energia contagiante todo dia!',
  'Wall balls me consumiram hoje, mas entrei no tempo.',
  'Sexta-feira e treino matinal. Melhor forma de comecar o fim de semana.',
  'Aquecimento já me deixou no limite hoje haha. WOD foi acima do esperado.',
];

const PR_AUTO_TEXTS = [
  'Novo PR! {exercise} com {score}. To na missao!',
  'PR novo no {exercise}! {score} no marcador. Evoluindo!',
  'Bati meu recorde pessoal no {exercise}: {score}. Trabalho duro pagando!',
  '{score} no {exercise}. Superou meu melhor de todos os tempos!',
  'Novo recorde: {exercise} - {score}. Nao para!',
];

const EXERCISES_SEED = [
  { name: 'Back Squat', category: 'WEIGHTLIFTING', scores: ['80kg', '90kg', '100kg', '110kg', '120kg'] },
  { name: 'Deadlift', category: 'WEIGHTLIFTING', scores: ['100kg', '120kg', '140kg', '150kg', '160kg'] },
  { name: 'Clean & Jerk', category: 'WEIGHTLIFTING', scores: ['60kg', '70kg', '80kg', '90kg', '95kg'] },
  { name: 'Snatch', category: 'WEIGHTLIFTING', scores: ['50kg', '60kg', '65kg', '70kg', '75kg'] },
  { name: 'Pull-up', category: 'GYMNASTICS', scores: ['5', '8', '10', '12', '15'] },
  { name: 'Handstand Push-up', category: 'GYMNASTICS', scores: ['3', '5', '7', '10', '12'] },
  { name: 'Row 500m', category: 'MONOSTRUCTURAL', scores: ['02:10', '02:00', '01:55', '01:50', '01:45'] },
  { name: 'Run 400m', category: 'MONOSTRUCTURAL', scores: ['02:20', '02:10', '02:00', '01:55', '01:50'] },
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 4) + 6, Math.floor(Math.random() * 60), 0, 0);
  return d;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickText(texts, replacements = {}) {
  let text = pick(texts);
  for (const [key, value] of Object.entries(replacements)) {
    text = text.replace(`{${key}}`, value);
  }
  return text;
}

function coordsNear(boxCoordinates) {
  const [lng, lat] = boxCoordinates;
  const offsetLat = (Math.random() - 0.5) * 0.0005;
  const offsetLng = (Math.random() - 0.5) * 0.0005;
  return { latitude: lat + offsetLat, longitude: lng + offsetLng };
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function upsertGlobalExercises(db) {
  const exerciseMap = new Map();

  for (const ex of EXERCISES_SEED) {
    const existing = await db.collection('exercises').findOne({ name: ex.name, isGlobal: true });
    if (existing) {
      exerciseMap.set(ex.name, existing);
    } else {
      const result = await db.collection('exercises').insertOne({
        name: ex.name,
        category: ex.category,
        isGlobal: true,
        createdAt: new Date(),
      });
      exerciseMap.set(ex.name, { _id: result.insertedId, ...ex });
    }
  }

  return exerciseMap;
}

async function seedFeed(db, boxMap, userMap, classMap, wodMap, exerciseMap) {
  let totalCheckins = 0;
  let totalPosts = 0;
  let totalResults = 0;

  // Alunos para seed: pegar usuarios com role ALUNO
  const alunos = [...userMap.values()].filter((u) => u.role === 'ALUNO');

  for (const aluno of alunos) {
    // Para cada box do aluno
    for (const boxId of aluno.boxIds) {
      const boxIdStr = boxId.toString();
      const box = boxMap.get(boxIdStr);
      if (!box) continue;

      const classes = classMap.get(boxIdStr) ?? [];
      if (classes.length === 0) continue;

      // Criar checkins para os ultimos 14 dias (nem todo dia — probabilidade 70%)
      for (let dayOffset = 14; dayOffset >= 0; dayOffset--) {
        if (Math.random() > 0.7) continue;

        const checkinDate = daysAgo(dayOffset);
        const classForDay = pick(classes);
        const coords = coordsNear(box.location.coordinates);
        const distance = haversineMeters(
          coords.latitude,
          coords.longitude,
          box.location.coordinates[1],
          box.location.coordinates[0],
        );

        const checkin = {
          userId: aluno._id,
          boxId,
          classId: classForDay._id,
          latitude: coords.latitude,
          longitude: coords.longitude,
          distanceFromBoxInMeters: Math.round(distance * 10) / 10,
          createdAt: checkinDate,
        };

        const checkinResult = await db.collection('checkins').insertOne(checkin);
        const checkinId = checkinResult.insertedId;
        totalCheckins++;

        // Post manual com probabilidade 60%
        if (Math.random() < 0.6) {
          await db.collection('posts').insertOne({
            userId: aluno._id,
            boxId,
            checkinId,
            text: pickText(MANUAL_TEXTS, { day: 14 - dayOffset + 1 }),
            source: 'MANUAL',
            createdAt: new Date(checkinDate.getTime() + 5 * 60 * 1000),
          });
          totalPosts++;
        }

        // Resultado de PR com probabilidade 40%
        if (Math.random() < 0.4) {
          const wods = wodMap.get(boxIdStr) ?? [];
          const wod = wods.length > 0 ? pick(wods) : null;

          const exerciseEntry = pick(EXERCISES_SEED);
          const exercise = exerciseMap.get(exerciseEntry.name);
          const score = pick(exerciseEntry.scores);
          const isLoad = /kg$/.test(score) || /^\d+$/.test(score);
          const scoreKind = isLoad ? 'LOAD' : 'TIME';

          const resultDoc = {
            userId: aluno._id,
            boxId,
            ...(wod && { wodId: wod._id }),
            exerciseId: exercise._id,
            score,
            scoreKind,
            isNewPR: true,
            createdAt: new Date(checkinDate.getTime() + 30 * 60 * 1000),
          };

          const resultInsert = await db.collection('results').insertOne(resultDoc);
          totalResults++;

          // Auto-post de PR: apenas se ainda nao tem post nesse checkin
          const existingPost = await db.collection('posts').findOne({ checkinId });
          if (!existingPost) {
            await db.collection('posts').insertOne({
              userId: aluno._id,
              boxId,
              checkinId,
              resultId: resultInsert.insertedId,
              text: pickText(PR_AUTO_TEXTS, { exercise: exerciseEntry.name, score }),
              source: 'PR_AUTO',
              createdAt: new Date(checkinDate.getTime() + 31 * 60 * 1000),
            });
            totalPosts++;
          }
        }
      }
    }
  }

  return { totalCheckins, totalPosts, totalResults };
}

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(MONGO_DB_NAME);

    // Carregar boxes
    const boxes = await db.collection('boxes').find({}).toArray();
    if (boxes.length === 0) {
      console.error('Nenhum box encontrado. Execute seed-test-data.js primeiro.');
      process.exit(1);
    }
    const boxMap = new Map(boxes.map((b) => [b._id.toString(), b]));

    // Carregar apenas usuarios seed para manter consistencia com seed-test-data
    const users = await db
      .collection('users')
      .find({ email: { $regex: '^seed\\.', $options: 'i' } })
      .toArray();
    if (users.length === 0) {
      console.error('Nenhum usuario seed encontrado. Execute seed-test-data.js primeiro.');
      process.exit(1);
    }
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    // Carregar classes por box
    const classes = await db.collection('classes').find({}).toArray();
    const classMap = new Map();
    for (const cls of classes) {
      const key = cls.boxId.toString();
      if (!classMap.has(key)) classMap.set(key, []);
      classMap.get(key).push(cls);
    }

    // Carregar WODs por box
    const wods = await db.collection('wods').find({}).toArray();
    const wodMap = new Map();
    for (const wod of wods) {
      const key = wod.boxId.toString();
      if (!wodMap.has(key)) wodMap.set(key, []);
      wodMap.get(key).push(wod);
    }

    // Exercicios globais
    const exerciseMap = await upsertGlobalExercises(db);

    // Limpar dados de feed e checkins anteriores (seed idempotente)
    await db.collection('checkins').deleteMany({});
    await db.collection('posts').deleteMany({});
    await db.collection('results').deleteMany({});
    console.log('Colecoes checkins, posts e results limpas.');

    const { totalCheckins, totalPosts, totalResults } = await seedFeed(
      db,
      boxMap,
      userMap,
      classMap,
      wodMap,
      exerciseMap,
    );

    console.log('\nSeed do feed concluido com sucesso.');
    console.log(`Banco: ${MONGO_DB_NAME}`);
    console.log(`Checkins criados : ${totalCheckins}`);
    console.log(`Posts criados    : ${totalPosts}`);
    console.log(`Resultados (PR)  : ${totalResults}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Erro no seed do feed:', error);
  process.exit(1);
});
