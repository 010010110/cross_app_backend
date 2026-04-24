#!/usr/bin/env node
/**
 * Reset de banco para ambiente de desenvolvimento.
 *
 * Limpa colecoes do dominio e recria indices essenciais.
 *
 * Uso:
 *   node scripts/reset-db.js
 *
 * Variaveis de ambiente:
 *   MONGO_URI      (padrao: mongodb://localhost:27017)
 *   MONGO_DB_NAME  (padrao: cross_app)
 */

require('dotenv/config');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME ?? 'cross_app';

const COLLECTIONS_TO_CLEAR = [
  'users',
  'boxes',
  'classes',
  'wods',
  'checkins',
  'results',
  'posts',
  'reward_streaks',
  'reward_milestones',
  'reward_xp_ledger',
  'coach_class_assignments',
  'exercises',
  'enrollment_tokens',
];

async function ensureIndexes(db) {
  await db.collection('boxes').createIndex({ location: '2dsphere' });
  await db.collection('checkins').createIndex({ boxId: 1, classId: 1, createdAt: -1 });
  await db.collection('checkins').createIndex({ userId: 1, boxId: 1, createdAt: -1 });
  await db.collection('results').createIndex({ userId: 1, boxId: 1, createdAt: -1 });
  await db.collection('results').createIndex({ boxId: 1, createdAt: -1 });
  await db.collection('reward_xp_ledger').createIndex({ boxId: 1, userId: 1, createdAt: -1 });
  await db.collection('reward_streaks').createIndex({ boxId: 1, userId: 1 }, { unique: true });
  await db
    .collection('coach_class_assignments')
    .createIndex({ boxId: 1, coachId: 1, classId: 1, active: 1 });
}

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(MONGO_DB_NAME);

    for (const collectionName of COLLECTIONS_TO_CLEAR) {
      await db.collection(collectionName).deleteMany({});
    }

    await ensureIndexes(db);

    console.log('Reset concluido com sucesso.');
    console.log(`Banco: ${MONGO_DB_NAME}`);
    console.log(`Colecoes limpas: ${COLLECTIONS_TO_CLEAR.length}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Erro ao resetar banco:', error);
  process.exit(1);
});
