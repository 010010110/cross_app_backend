/**
 * Seed de dados para testes:
 * - boxes
 * - usuarios (ADMIN, COACH, ALUNO)
 * - aulas (classes)
 * - WODs diarios
 *
 * Uso:
 *   node scripts/seed-test-data.js
 *
 * Variaveis de ambiente:
 *   MONGO_URI      (padrao: mongodb://localhost:27017)
 *   MONGO_DB_NAME  (padrao: cross_app)
 *   SEED_PASSWORD  (padrao: Teste@123)
 */

require('dotenv/config');
const { MongoClient } = require('mongodb');
const { hashSync } = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME ?? 'cross_app';
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'Teste@123';

const BOXES = [
  {
    key: 'alpha',
    name: 'Cross Alpha',
    cnpj: '11111111000191',
    coordinates: [-46.65284, -23.56447],
    geofenceRadius: 120,
    contactPhone: '+551130001001',
    contactEmail: 'contato.alpha@crossapp.test',
    contactWhatsapp: '+5511999991001',
    contactInstagram: '@crossalpha',
    contactWebsite: 'https://crossalpha.com.br',
    address: 'Av. Paulista, 1000 - Bela Vista, Sao Paulo/SP - 01310-100',
  },
  {
    key: 'bravo',
    name: 'Cross Bravo',
    cnpj: '22222222000191',
    coordinates: [-43.1729, -22.9068],
    geofenceRadius: 150,
    contactPhone: '+552130001002',
    contactEmail: 'contato.bravo@crossapp.test',
    contactWhatsapp: '+5521999991002',
    contactInstagram: '@crossbravo',
    contactWebsite: 'https://crossbravo.com.br',
    address: 'Rua das Laranjeiras, 250 - Laranjeiras, Rio de Janeiro/RJ - 22240-003',
  },
  {
    key: 'londrina-central',
    name: 'Cross Londrina Central',
    cnpj: '33333333000191',
    coordinates: [-51.157066, -23.315792],
    geofenceRadius: 120,
    contactPhone: '+554330001003',
    contactEmail: 'contato.londrina.central@crossapp.test',
    contactWhatsapp: '+5543999991003',
    contactInstagram: '@crosslondrinacentral',
    contactWebsite: 'https://crosslondrinacentral.com.br',
    address: 'Av. Higienopolis, 800 - Centro, Londrina/PR - 86020-080',
  },
  {
    key: 'londrina-igapo',
    name: 'Cross Londrina Igapo',
    cnpj: '44444444000191',
    coordinates: [-51.16325, -23.31085],
    geofenceRadius: 120,
    contactPhone: '+554330001004',
    contactEmail: 'contato.londrina.igapo@crossapp.test',
    contactWhatsapp: '+5543999991004',
    contactInstagram: '@crosslondrinaigapo',
    contactWebsite: 'https://crosslondrinaigapo.com.br',
    address: 'Rua Bento Munhoz da Rocha, 120 - Igapo, Londrina/PR - 86015-010',
  },
  {
    key: 'londrina-gleba',
    name: 'Cross Londrina Gleba',
    cnpj: '55555555000191',
    coordinates: [-51.1499, -23.3221],
    geofenceRadius: 120,
    contactPhone: '+554330001005',
    contactEmail: 'contato.londrina.gleba@crossapp.test',
    contactWhatsapp: '+5543999991005',
    contactInstagram: '@crosslondrinagleba',
    contactWebsite: 'https://crosslondrinagleba.com.br',
    address: 'Rua Paranagua, 980 - Gleba Palhano, Londrina/PR - 86050-120',
  },
  {
    key: 'londrina-zona-sul',
    name: 'Cross Londrina Zona Sul',
    cnpj: '66666666000191',
    coordinates: [-51.1546, -23.3302],
    geofenceRadius: 130,
    contactPhone: '+554330001006',
    contactEmail: 'contato.londrina.zonasul@crossapp.test',
    contactWhatsapp: '+5543999991006',
    contactInstagram: '@crosslondrinazonasul',
    contactWebsite: 'https://crosslondrinazonasul.com.br',
    address: 'Av. Madre Leonia Milito, 1500 - Aurora, Londrina/PR - 86047-000',
  },
];

const USERS = [
  {
    name: 'Admin Alpha',
    email: 'seed.admin.alpha@crossapp.test',
    role: 'ADMIN',
    boxes: ['alpha'],
    contactPhone: '+5511900010001',
    whatsapp: '+5511900010001',
    address: 'Av. Paulista, 1000 - Bela Vista, Sao Paulo/SP - 01310-100',
    socialInstagram: '@adminalphafit',
  },
  {
    name: 'Coach Alpha',
    email: 'seed.coach.alpha@crossapp.test',
    role: 'COACH',
    boxes: ['alpha'],
    contactPhone: '+5511900010002',
    whatsapp: '+5511900010002',
    address: 'Rua Augusta, 500 - Consolacao, Sao Paulo/SP - 01304-000',
    socialInstagram: '@coachalphafit',
  },
  {
    name: 'Aluno A1',
    email: 'seed.aluno.a1@crossapp.test',
    role: 'ALUNO',
    boxes: ['alpha'],
    contactPhone: '+5511900010003',
    whatsapp: '+5511900010003',
    address: 'Rua Oscar Freire, 300 - Jardins, Sao Paulo/SP - 01426-001',
    socialInstagram: '@alunoa1fit',
    socialFacebook: 'https://facebook.com/aluno.a1',
  },
  {
    name: 'Aluno A2',
    email: 'seed.aluno.a2@crossapp.test',
    role: 'ALUNO',
    boxes: ['alpha'],
    contactPhone: '+5511900010004',
    whatsapp: '+5511900010004',
    address: 'Al. Santos, 800 - Jardim Paulista, Sao Paulo/SP - 01419-001',
    socialInstagram: '@alunoa2fit',
  },
  {
    name: 'Aluno A3',
    email: 'seed.aluno.a3@crossapp.test',
    role: 'ALUNO',
    boxes: ['alpha', 'bravo'],
    contactPhone: '+5511900010005',
    whatsapp: '+5511900010005',
    address: 'Rua Haddock Lobo, 150 - Cerqueira Cesar, Sao Paulo/SP - 01414-001',
    socialInstagram: '@alunoa3fit',
    socialFacebook: 'https://facebook.com/aluno.a3',
  },
  {
    name: 'Admin Bravo',
    email: 'seed.admin.bravo@crossapp.test',
    role: 'ADMIN',
    boxes: ['bravo'],
    contactPhone: '+5521900010006',
    whatsapp: '+5521900010006',
    address: 'Rua das Laranjeiras, 250 - Laranjeiras, Rio de Janeiro/RJ - 22240-003',
    socialInstagram: '@adminbravofit',
  },
  {
    name: 'Coach Bravo',
    email: 'seed.coach.bravo@crossapp.test',
    role: 'COACH',
    boxes: ['bravo'],
    contactPhone: '+5521900010007',
    whatsapp: '+5521900010007',
    address: 'Av. Atlantica, 1000 - Copacabana, Rio de Janeiro/RJ - 22010-000',
    socialInstagram: '@coachbravofit',
  },
  {
    name: 'Aluno B1',
    email: 'seed.aluno.b1@crossapp.test',
    role: 'ALUNO',
    boxes: ['bravo', 'alpha'],
    contactPhone: '+5521900010008',
    whatsapp: '+5521900010008',
    address: 'Rua Visconde de Piraja, 400 - Ipanema, Rio de Janeiro/RJ - 22410-002',
    socialInstagram: '@alunob1fit',
    socialFacebook: 'https://facebook.com/aluno.b1',
  },
  {
    name: 'Aluno B2',
    email: 'seed.aluno.b2@crossapp.test',
    role: 'ALUNO',
    boxes: ['bravo'],
    contactPhone: '+5521900010009',
    whatsapp: '+5521900010009',
    address: 'Av. Nossa Senhora de Copacabana, 600 - Copacabana, Rio de Janeiro/RJ - 22050-001',
    socialInstagram: '@alunob2fit',
  },
];

const CLASSES = [
  {
    boxKey: 'alpha',
    name: 'Turma 06h',
    weekDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    startTime: '06:00',
    endTime: '07:00',
  },
  {
    boxKey: 'alpha',
    name: 'Turma 07h',
    weekDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    startTime: '07:00',
    endTime: '08:00',
  },
  {
    boxKey: 'alpha',
    name: 'Turma 12h',
    weekDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    startTime: '12:00',
    endTime: '13:00',
  },
  {
    boxKey: 'alpha',
    name: 'Turma 19h',
    weekDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    startTime: '19:00',
    endTime: '20:00',
  },
  {
    boxKey: 'alpha',
    name: 'Turma Sabado 09h',
    weekDays: ['SATURDAY'],
    startTime: '09:00',
    endTime: '10:00',
  },
  {
    boxKey: 'bravo',
    name: 'Turma 05h30',
    weekDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    startTime: '05:30',
    endTime: '06:30',
  },
  {
    boxKey: 'bravo',
    name: 'Turma 06h30',
    weekDays: ['TUESDAY', 'THURSDAY', 'SATURDAY'],
    startTime: '06:30',
    endTime: '07:30',
  },
  {
    boxKey: 'bravo',
    name: 'Turma 10h',
    weekDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    startTime: '10:00',
    endTime: '11:00',
  },
  {
    boxKey: 'bravo',
    name: 'Turma 17h',
    weekDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    startTime: '17:00',
    endTime: '18:00',
  },
  {
    boxKey: 'bravo',
    name: 'Turma 18h',
    weekDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    startTime: '18:00',
    endTime: '19:00',
  },
  {
    boxKey: 'bravo',
    name: 'Turma Domingo 08h',
    weekDays: ['SUNDAY'],
    startTime: '08:00',
    endTime: '09:00',
  },
];

function startOfDayWithOffset(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toIsoDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLegacyUtcMidnight(isoDay) {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

function buildWod(titlePrefix, date, boxId) {
  const isoDay = toIsoDay(date);

  return {
    boxId,
    date,
    title: `${titlePrefix} ${isoDay}`,
    blocks: [
      {
        type: 'WARMUP',
        title: 'Warm-up',
        content: '3 rounds: 10 air squats, 10 sit-ups, 200m run',
      },
      {
        type: 'SKILL',
        title: 'Skill',
        content: 'EMOM 10: 3 power cleans + 5 pull-ups',
      },
      {
        type: 'WOD',
        title: 'Main',
        content: 'AMRAP 12: 12 wall balls, 10 burpees, 8 deadlifts',
      },
    ],
    createdAt: new Date(),
  };
}

async function upsertBoxes(db) {
  const boxMap = new Map();

  for (const box of BOXES) {
    await db.collection('boxes').updateOne(
      { cnpj: box.cnpj },
      {
        $set: {
          name: box.name,
          cnpj: box.cnpj,
          location: {
            type: 'Point',
            coordinates: box.coordinates,
          },
          geofenceRadius: box.geofenceRadius,
          contactPhone: box.contactPhone,
          contactEmail: box.contactEmail,
          contactWhatsapp: box.contactWhatsapp,
          contactInstagram: box.contactInstagram,
          contactWebsite: box.contactWebsite,
          address: box.address,
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    const savedBox = await db.collection('boxes').findOne({ cnpj: box.cnpj });
    boxMap.set(box.key, savedBox._id);
  }

  return boxMap;
}

async function upsertUsers(db, boxMap) {
  const passwordHash = hashSync(SEED_PASSWORD, 10);

  for (const user of USERS) {
    const boxIds = user.boxes.map((boxKey) => boxMap.get(boxKey)).filter(Boolean);

    await db.collection('users').updateOne(
      { email: user.email.toLowerCase() },
      {
        $set: {
          name: user.name,
          email: user.email.toLowerCase(),
          passwordHash,
          role: user.role,
          contactPhone: user.contactPhone,
          whatsapp: user.whatsapp,
          address: user.address,
          ...(user.socialInstagram && { socialInstagram: user.socialInstagram }),
          ...(user.socialFacebook && { socialFacebook: user.socialFacebook }),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
        $addToSet: {
          boxIds: { $each: boxIds },
        },
      },
      { upsert: true },
    );
  }
}

async function seedClasses(db, boxMap) {
  for (const box of BOXES) {
    const boxId = boxMap.get(box.key);
    const classesForBox = CLASSES.filter((entry) => entry.boxKey === box.key);

    await db.collection('classes').deleteMany({
      boxId,
      name: { $in: classesForBox.map((entry) => entry.name) },
    });

    if (classesForBox.length > 0) {
      await db.collection('classes').insertMany(
        classesForBox.map((entry) => ({
          boxId,
          name: entry.name,
          weekDays: entry.weekDays,
          startTime: entry.startTime,
          endTime: entry.endTime,
          createdAt: new Date(),
        })),
      );
    }
  }
}

async function seedWods(db, boxMap) {
  const dayOffsets = [-1, 0, 1, 2];

  for (const box of BOXES) {
    const boxId = boxMap.get(box.key);
    const localDates = dayOffsets.map((offset) => startOfDayWithOffset(offset));
    const legacyDates = localDates.map((date) => toLegacyUtcMidnight(toIsoDay(date)));

    await db.collection('wods').deleteMany({
      boxId,
      $or: [{ date: { $in: localDates } }, { date: { $in: legacyDates } }],
    });

    const docs = localDates.map((date) => buildWod(`${box.name} WOD`, date, boxId));

    if (docs.length > 0) {
      await db.collection('wods').insertMany(docs);
    }
  }
}

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(MONGO_DB_NAME);

    const boxMap = await upsertBoxes(db);
    await upsertUsers(db, boxMap);
    await seedClasses(db, boxMap);
    await seedWods(db, boxMap);

    console.log('\nSeed concluido com sucesso.');
    console.log(`Banco: ${MONGO_DB_NAME}`);
    console.log(`Senha padrao dos usuarios seed: ${SEED_PASSWORD}`);
    console.log('\nLogins para teste:');
    console.log('- ADMIN alpha: seed.admin.alpha@crossapp.test');
    console.log('- COACH alpha: seed.coach.alpha@crossapp.test');
    console.log('- ALUNO alpha: seed.aluno.a1@crossapp.test');
    console.log('- ADMIN bravo: seed.admin.bravo@crossapp.test');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Erro no seed:', error);
  process.exit(1);
});
