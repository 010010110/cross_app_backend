const { MongoClient } = require('mongodb');

// URL de conexão padrão do MongoDB local (rodando no Docker)
const uri = 'mongodb://localhost:27017';
// Substitua pelo nome exato do seu banco de dados
const dbName = 'cross_app'; 

const exercisesData = [
  // LPO
  { name: "Snatch", category: "LPO", metric: "WEIGHT", isGlobal: true, boxId: null },
  { name: "Clean and Jerk", category: "LPO", metric: "WEIGHT", isGlobal: true, boxId: null },
  { name: "Deadlift", category: "LPO", metric: "WEIGHT", isGlobal: true, boxId: null },
  { name: "Back Squat", category: "LPO", metric: "WEIGHT", isGlobal: true, boxId: null },
  { name: "Front Squat", category: "LPO", metric: "WEIGHT", isGlobal: true, boxId: null },
  { name: "Overhead Squat", category: "LPO", metric: "WEIGHT", isGlobal: true, boxId: null },
  { name: "Thruster", category: "LPO", metric: "WEIGHT", isGlobal: true, boxId: null },
  { name: "Strict Press", category: "LPO", metric: "WEIGHT", isGlobal: true, boxId: null },

  // GINÁSTICOS
  { name: "Pull-up", category: "GYMNASTICS", metric: "REPS", isGlobal: true, boxId: null },
  { name: "Chest-to-Bar Pull-up (C2B)", category: "GYMNASTICS", metric: "REPS", isGlobal: true, boxId: null },
  { name: "Muscle-up (Ring)", category: "GYMNASTICS", metric: "REPS", isGlobal: true, boxId: null },
  { name: "Muscle-up (Bar)", category: "GYMNASTICS", metric: "REPS", isGlobal: true, boxId: null },
  { name: "Toes-to-Bar (T2B)", category: "GYMNASTICS", metric: "REPS", isGlobal: true, boxId: null },
  { name: "Handstand Push-up (HSPU)", category: "GYMNASTICS", metric: "REPS", isGlobal: true, boxId: null },
  { name: "Handstand Walk (HSW)", category: "GYMNASTICS", metric: "DISTANCE", isGlobal: true, boxId: null },
  { name: "Burpee", category: "GYMNASTICS", metric: "REPS", isGlobal: true, boxId: null },
  { name: "Box Jump", category: "GYMNASTICS", metric: "REPS", isGlobal: true, boxId: null },
  { name: "Wall Ball", category: "GYMNASTICS", metric: "REPS", isGlobal: true, boxId: null },

  // CARDIO
  { name: "Double Under (DU)", category: "CARDIO", metric: "REPS", isGlobal: true, boxId: null },
  { name: "Rowing", category: "CARDIO", metric: "CALORIES", isGlobal: true, boxId: null },
  { name: "Assault Bike / Echo Bike", category: "CARDIO", metric: "CALORIES", isGlobal: true, boxId: null },
  { name: "SkiErg", category: "CARDIO", metric: "CALORIES", isGlobal: true, boxId: null },
  { name: "Running", category: "CARDIO", metric: "DISTANCE", isGlobal: true, boxId: null }
];

async function runSeed() {
  const client = new MongoClient(uri);

  try {
    console.log('⏳ Conectando ao MongoDB no Docker...');
    await client.connect();
    console.log('✅ Conectado com sucesso!');

    const db = client.db(dbName);
    const collection = db.collection('exercises');

    // Limpa a coleção antes de inserir para evitar duplicatas se você rodar o script 2x
    console.log('🧹 Limpando exercícios antigos (se houver)...');
    await collection.deleteMany({ isGlobal: true });

    console.log(`📥 Inserindo ${exercisesData.length} exercícios base...`);
    const result = await collection.insertMany(exercisesData);

    console.log(`🚀 Sucesso! ${result.insertedCount} exercícios foram cadastrados no banco.`);

  } catch (error) {
    console.error('❌ Erro ao executar o seed:', error);
  } finally {
    // É crucial fechar a conexão no final
    await client.close();
    console.log('🔌 Conexão encerrada.');
  }
}

runSeed();