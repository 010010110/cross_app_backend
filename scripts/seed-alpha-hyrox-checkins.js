/**
 * Seed focado no box alpha:
 * - cria/atualiza a aula "Hyrox" com checkinLimit = 20
 * - cria check-ins para os usuarios vinculados ao box alpha
 *
 * Uso:
 *   node scripts/seed-alpha-hyrox-checkins.js
 *
 * Variaveis de ambiente:
 *   MONGO_URI      (padrao: mongodb://localhost:27017)
 *   MONGO_DB_NAME  (padrao: cross_app)
 */

require('dotenv/config');
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME ?? 'cross_app';

const ALPHA_CNPJ = '11111111000191';
const HYROX_CLASS_NAME = 'Hyrox';
const HYROX_START_TIME = '07:00';
const HYROX_END_TIME = '08:00';
const HYROX_CHECKIN_LIMIT = 20;

function resolveTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

async function resolveAlphaBox(db) {
  let box = await db.collection('boxes').findOne({ cnpj: ALPHA_CNPJ });

  if (!box) {
    box = await db.collection('boxes').findOne({ name: { $regex: /alpha/i } });
  }

  return box;
}

async function upsertHyroxClass(db, boxId) {
  const weekDays = [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ];

  await db.collection('classes').updateOne(
    { boxId, name: HYROX_CLASS_NAME },
    {
      $set: {
        boxId,
        name: HYROX_CLASS_NAME,
        weekDays,
        startTime: HYROX_START_TIME,
        endTime: HYROX_END_TIME,
        checkinLimit: HYROX_CHECKIN_LIMIT,
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  return db.collection('classes').findOne({ boxId, name: HYROX_CLASS_NAME });
}

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(MONGO_DB_NAME);

    const alphaBox = await resolveAlphaBox(db);

    if (!alphaBox) {
      throw new Error(
        'Box alpha nao encontrado. Rode primeiro: node scripts/seed-test-data.js',
      );
    }

    const boxId = new ObjectId(alphaBox._id);
    const hyroxClass = await upsertHyroxClass(db, boxId);

    if (!hyroxClass?._id) {
      throw new Error('Falha ao criar/atualizar a aula Hyrox.');
    }

    const usersInAlpha = await db
      .collection('users')
      .find({ boxIds: boxId })
      .project({ _id: 1, name: 1, email: 1, role: 1 })
      .toArray();

    if (usersInAlpha.length === 0) {
      console.log('Nenhum usuario encontrado no box alpha. Nada a inserir.');
      return;
    }

    const usersForCheckin = usersInAlpha.slice(0, HYROX_CHECKIN_LIMIT);
    const userIds = usersForCheckin.map((user) => user._id);

    const { start, end } = resolveTodayRange();

    await db.collection('checkins').deleteMany({
      boxId,
      classId: hyroxClass._id,
      userId: { $in: userIds },
      createdAt: { $gte: start, $lte: end },
    });

    const [boxLongitude, boxLatitude] = alphaBox.location?.coordinates ?? [];

    if (typeof boxLatitude !== 'number' || typeof boxLongitude !== 'number') {
      throw new Error('Box alpha sem coordenadas validas para criar check-ins.');
    }

    const now = new Date();
    const checkins = usersForCheckin.map((user, index) => {
      const createdAt = new Date(now);
      createdAt.setMinutes(createdAt.getMinutes() - index);

      return {
        userId: user._id,
        boxId,
        classId: hyroxClass._id,
        latitude: boxLatitude,
        longitude: boxLongitude,
        distanceFromBoxInMeters: 0,
        createdAt,
      };
    });

    if (checkins.length > 0) {
      await db.collection('checkins').insertMany(checkins);
    }

    console.log('\nSeed Hyrox Alpha concluido com sucesso.');
    console.log(`Banco: ${MONGO_DB_NAME}`);
    console.log(`Box: ${alphaBox.name} (${boxId.toHexString()})`);
    console.log(
      `Aula: ${hyroxClass.name} | limite de check-ins: ${hyroxClass.checkinLimit}`,
    );
    console.log(`Usuarios no box alpha: ${usersInAlpha.length}`);
    console.log(`Check-ins criados hoje: ${checkins.length}`);

    console.log('\nUsuarios usados no check-in:');
    usersForCheckin.forEach((user) => {
      console.log(`- ${user.name} <${user.email}> [${user.role}]`);
    });
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Erro no seed de Hyrox Alpha:', error.message);
  process.exit(1);
});
