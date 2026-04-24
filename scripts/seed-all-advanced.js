#!/usr/bin/env node
/**
 * Orquestrador de massa completa apos reset.
 *
 * Ordem:
 * 1) seed-exercise
 * 2) seed-test-data
 * 3) seed-feed
 * 4) seed-prs
 * 5) seed-gamification-a3
 * 6) seed-user-history
 * 7) seed-advanced-scenarios
 *
 * Uso:
 *   node scripts/seed-all-advanced.js
 */

const path = require('path');
const { spawnSync } = require('child_process');

const scripts = [
  'seed-exercise.js',
  'seed-test-data.js',
  'seed-feed.js',
  'seed-prs.js',
  'seed-gamification-a3.js',
  'seed-user-history.js',
  'seed-advanced-scenarios.js',
];

function run(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  console.log(`\n[seed-all-advanced] executando ${scriptName}...`);

  const result = spawnSync('node', [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Falha ao executar ${scriptName} (exit code ${result.status ?? 'unknown'})`);
  }
}

function main() {
  console.log('[seed-all-advanced] iniciando carga completa de massa...');

  for (const scriptName of scripts) {
    run(scriptName);
  }

  console.log('\n[seed-all-advanced] massa completa gerada com sucesso.');
}

try {
  main();
} catch (error) {
  console.error('[seed-all-advanced] erro:', error.message);
  process.exit(1);
}
