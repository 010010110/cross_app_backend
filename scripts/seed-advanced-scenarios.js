#!/usr/bin/env node
/**
 * Complemento de massa para cenarios avancados ja implementados:
 * - checkinLimit em turmas selecionadas
 * - vinculos coach-turma (coach_class_assignments)
 * - check-ins deterministas para relatorios/gym-rats
 * - check-ins para validar delete (permitido e bloqueado por janela de 1h)
 *
 * Uso:
 *   node scripts/seed-advanced-scenarios.js
 *
 * Requer:
 *   - seed-test-data executado
 *
 * Variaveis de ambiente:
 *   MONGO_URI      (padrao: mongodb://localhost:27017)
 *   MONGO_DB_NAME  (padrao: cross_app)
 */

require('dotenv/config');
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME ?? 'cross_app';

const EMAILS = {
  adminAlpha: 'seed.admin.alpha@crossapp.test',
  coachAlpha: 'seed.coach.alpha@crossapp.test',
  alunoA1: 'seed.aluno.a1@crossapp.test',
  alunoA2: 'seed.aluno.a2@crossapp.test',
  alunoA3: 'seed.aluno.a3@crossapp.test',
  coachBravo: 'seed.coach.bravo@crossapp.test',
  alunoB1: 'seed.aluno.b1@crossapp.test',
  alunoB2: 'seed.aluno.b2@crossapp.test',
};

function daysFromNow(offsetDays, hours, minutes) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function nearBox(box, latDelta = 0.00008, lngDelta = 0.00008) {
  const [lng, lat] = box.location.coordinates;
  return {
    latitude: lat + latDelta,
    longitude: lng + lngDelta,
  };
}

async function upsertCoachAssignment(db, payload) {
  const existing = await db.collection('coach_class_assignments').findOne({
    boxId: payload.boxId,
    coachId: payload.coachId,
    classId: payload.classId,
    active: true,
  });

  if (existing) {
    return false;
  }

  await db.collection('coach_class_assignments').insertOne({
    boxId: payload.boxId,
    coachId: payload.coachId,
    classId: payload.classId,
    active: true,
    assignedAt: new Date(),
    createdBy: payload.createdBy,
  });

  return true;
}

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(MONGO_DB_NAME);

    const [alphaBox, bravoBox] = await Promise.all([
      db.collection('boxes').findOne({ name: 'Cross Alpha' }),
      db.collection('boxes').findOne({ name: 'Cross Bravo' }),
    ]);

    if (!alphaBox || !bravoBox) {
      throw new Error('Boxes base nao encontrados. Execute seed-test-data primeiro.');
    }

    const users = await db
      .collection('users')
      .find({ email: { $in: Object.values(EMAILS) } })
      .toArray();

    const userByEmail = new Map(users.map((u) => [u.email, u]));

    for (const key of Object.values(EMAILS)) {
      if (!userByEmail.has(key)) {
        throw new Error(`Usuario seed nao encontrado: ${key}`);
      }
    }

    const alphaClasses = await db
      .collection('classes')
      .find({ boxId: alphaBox._id })
      .toArray();
    const bravoClasses = await db
      .collection('classes')
      .find({ boxId: bravoBox._id })
      .toArray();

    const alphaByName = new Map(alphaClasses.map((c) => [c.name, c]));
    const bravoByName = new Map(bravoClasses.map((c) => [c.name, c]));

    const alpha06 = alphaByName.get('Turma 06h');
    const alpha19 = alphaByName.get('Turma 19h');
    const bravo18 = bravoByName.get('Turma 18h');

    if (!alpha06 || !alpha19 || !bravo18) {
      throw new Error('Turmas esperadas nao encontradas. Verifique seed-test-data.');
    }

    // checkinLimit: cenarios de capacidade para validacao funcional
    await db.collection('classes').updateOne({ _id: alpha06._id }, { $set: { checkinLimit: 2 } });
    await db.collection('classes').updateOne({ _id: alpha19._id }, { $set: { checkinLimit: 20 } });
    await db.collection('classes').updateOne({ _id: bravo18._id }, { $set: { checkinLimit: 3 } });

    // Vinculos coach-turma para filtros de relatorio
    const assignments = [
      {
        boxId: alphaBox._id,
        coachId: userByEmail.get(EMAILS.coachAlpha)._id,
        classId: alpha06._id,
        createdBy: userByEmail.get(EMAILS.adminAlpha)._id,
      },
      {
        boxId: alphaBox._id,
        coachId: userByEmail.get(EMAILS.coachAlpha)._id,
        classId: alpha19._id,
        createdBy: userByEmail.get(EMAILS.adminAlpha)._id,
      },
      {
        boxId: bravoBox._id,
        coachId: userByEmail.get(EMAILS.coachBravo)._id,
        classId: bravo18._id,
        createdBy: userByEmail.get(EMAILS.adminAlpha)._id,
      },
    ];

    let createdAssignments = 0;
    for (const assignment of assignments) {
      const created = await upsertCoachAssignment(db, assignment);
      if (created) createdAssignments += 1;
    }

    // Check-ins deterministas (limite, relatorios, gym-rats e delete)
    const alphaCoords = nearBox(alphaBox);
    const bravoCoords = nearBox(bravoBox);

    const checkins = [
      // Capacidade alpha06 (limit 2) no dia atual
      {
        userId: userByEmail.get(EMAILS.alunoA1)._id,
        boxId: alphaBox._id,
        classId: alpha06._id,
        latitude: alphaCoords.latitude,
        longitude: alphaCoords.longitude,
        distanceFromBoxInMeters: 12.5,
        createdAt: daysFromNow(0, 6, 5),
      },
      {
        userId: userByEmail.get(EMAILS.alunoA2)._id,
        boxId: alphaBox._id,
        classId: alpha06._id,
        latitude: alphaCoords.latitude,
        longitude: alphaCoords.longitude,
        distanceFromBoxInMeters: 14.2,
        createdAt: daysFromNow(0, 6, 12),
      },
      // Frequencia alpha para ranking/gym-rats
      {
        userId: userByEmail.get(EMAILS.alunoA1)._id,
        boxId: alphaBox._id,
        classId: alpha19._id,
        latitude: alphaCoords.latitude,
        longitude: alphaCoords.longitude,
        distanceFromBoxInMeters: 9.7,
        createdAt: daysFromNow(-1, 19, 4),
      },
      {
        userId: userByEmail.get(EMAILS.alunoA1)._id,
        boxId: alphaBox._id,
        classId: alpha19._id,
        latitude: alphaCoords.latitude,
        longitude: alphaCoords.longitude,
        distanceFromBoxInMeters: 11.1,
        createdAt: daysFromNow(-2, 19, 8),
      },
      {
        userId: userByEmail.get(EMAILS.alunoA3)._id,
        boxId: alphaBox._id,
        classId: alpha19._id,
        latitude: alphaCoords.latitude,
        longitude: alphaCoords.longitude,
        distanceFromBoxInMeters: 15.4,
        createdAt: daysFromNow(-1, 19, 10),
      },
      // Frequencia bravo
      {
        userId: userByEmail.get(EMAILS.alunoB1)._id,
        boxId: bravoBox._id,
        classId: bravo18._id,
        latitude: bravoCoords.latitude,
        longitude: bravoCoords.longitude,
        distanceFromBoxInMeters: 10.3,
        createdAt: daysFromNow(-1, 18, 3),
      },
      {
        userId: userByEmail.get(EMAILS.alunoB2)._id,
        boxId: bravoBox._id,
        classId: bravo18._id,
        latitude: bravoCoords.latitude,
        longitude: bravoCoords.longitude,
        distanceFromBoxInMeters: 13.8,
        createdAt: daysFromNow(-3, 18, 9),
      },
      // Delete permitido (check-in futuro)
      {
        userId: userByEmail.get(EMAILS.alunoA1)._id,
        boxId: alphaBox._id,
        classId: alpha19._id,
        latitude: alphaCoords.latitude,
        longitude: alphaCoords.longitude,
        distanceFromBoxInMeters: 8.9,
        createdAt: daysFromNow(2, 19, 0),
      },
      // Delete bloqueado (check-in passado)
      {
        userId: userByEmail.get(EMAILS.alunoA1)._id,
        boxId: alphaBox._id,
        classId: alpha06._id,
        latitude: alphaCoords.latitude,
        longitude: alphaCoords.longitude,
        distanceFromBoxInMeters: 8.3,
        createdAt: daysFromNow(-2, 6, 0),
      },
    ];

    let insertedCheckins = 0;
    for (const doc of checkins) {
      const existing = await db.collection('checkins').findOne({
        userId: doc.userId,
        boxId: doc.boxId,
        classId: doc.classId,
        createdAt: doc.createdAt,
      });

      if (!existing) {
        await db.collection('checkins').insertOne(doc);
        insertedCheckins += 1;
      }
    }

    console.log('Seed de cenarios avancados concluido com sucesso.');
    console.log(`Banco: ${MONGO_DB_NAME}`);
    console.log(`Vinculos coach-turma criados: ${createdAssignments}`);
    console.log(`Check-ins deterministas inseridos: ${insertedCheckins}`);
    console.log('checkinLimit aplicado em: Alpha 06h (2), Alpha 19h (20), Bravo 18h (3).');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Erro no seed de cenarios avancados:', error);
  process.exit(1);
});
