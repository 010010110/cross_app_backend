/**
 * Script de seed: cria um Box e um usuário ADMIN vinculado a ele.
 *
 * Uso:
 *   node scripts/seed-admin.js
 *
 * Variáveis de ambiente (usa .env se existir):
 *   MONGO_URI      - padrão: mongodb://localhost:27017
 *   MONGO_DB_NAME  - padrão: cross_app
 *   ADMIN_NAME     - padrão: Admin Master
 *   ADMIN_EMAIL    - padrão: admin@crossapp.com
 *   ADMIN_PASSWORD - padrão: Admin@12345
 */

require('dotenv/config');
const { MongoClient, ObjectId } = require('mongodb');
const { hashSync } = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME ?? 'cross_app';

const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Admin Master';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin@crossapp.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@12345';

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log(`✔ Conectado ao MongoDB: ${MONGO_URI}/${MONGO_DB_NAME}\n`);

    const db = client.db(MONGO_DB_NAME);

    // ── 1. Verifica se o usuário já existe ──────────────────────────────────
    const existingUser = await db.collection('users').findOne({ email: ADMIN_EMAIL });

    if (existingUser) {
      console.log(`⚠ Usuário com email "${ADMIN_EMAIL}" já existe. Nenhuma alteração feita.`);
      return;
    }

    // ── 2. Cria o Box vinculado ao admin ────────────────────────────────────
    const boxResult = await db.collection('boxes').insertOne({
      name: 'Box Principal',
      cnpj: '00000000000000',
      location: {
        type: 'Point',
        coordinates: [-46.65284, -23.56447],
      },
      geofenceRadius: 100,
      createdAt: new Date(),
    });

    const boxId = boxResult.insertedId;
    console.log(`✔ Box criado: ${boxId.toHexString()}`);

    // ── 3. Cria o usuário ADMIN ─────────────────────────────────────────────
    const passwordHash = hashSync(ADMIN_PASSWORD, 10);

    const userResult = await db.collection('users').insertOne({
      boxIds: [boxId],
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'ADMIN',
      createdAt: new Date(),
    });

    const userId = userResult.insertedId;

    // ── 4. Resumo ───────────────────────────────────────────────────────────
    console.log(`✔ Usuário ADMIN criado com sucesso!\n`);
    console.log('─────────────────────────────────────────');
    console.log(`  userId : ${userId.toHexString()}`);
    console.log(`  boxId  : ${boxId.toHexString()}`);
    console.log(`  nome   : ${ADMIN_NAME}`);
    console.log(`  email  : ${ADMIN_EMAIL}`);
    console.log(`  senha  : ${ADMIN_PASSWORD}`);
    console.log(`  role   : ADMIN`);
    console.log('─────────────────────────────────────────');
    console.log('\nUse essas credenciais em POST /auth/login para obter o JWT.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('✖ Erro ao executar seed:', err);
  process.exit(1);
});
