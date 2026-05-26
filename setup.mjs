#!/usr/bin/env node

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

function checkPrerequisite(name, command) {
  try {
    execSync(command, { stdio: 'ignore' });
  } catch {
    console.error(`Error: ${name} is required but not found.`);
    process.exit(1);
  }
}

function generateSecret() {
  return randomBytes(32).toString('hex');
}

async function main() {
  console.log('=== Rexadb Studio Setup ===\n');

  checkPrerequisite('Node.js', 'node --version');
  checkPrerequisite('npm', 'npm --version');
  checkPrerequisite('openssl', 'openssl version');

  const rl = createInterface({ input, output });

  const adminEmail = await rl.question('Admin email [admin@rexadb.local]: ') || 'admin@rexadb.local';
  const adminName = await rl.question('Admin name [Admin]: ') || 'Admin';

  let adminPassword = '';
  while (!adminPassword) {
    adminPassword = await rl.question('Admin password: ');
    if (!adminPassword) console.log('Password cannot be empty.');
  }

  const port = await rl.question('Port [3000]: ') || '3000';
  rl.close();

  const encryptionKey = generateSecret();
  const jwtSecret = generateSecret();

  const envContent = [
    '# Internal SQLite database',
    `DATABASE_URL=file:./data/rexadb.db`,
    '',
    '# Encryption key',
    `ENCRYPTION_KEY=${encryptionKey}`,
    '',
    '# Studio JWT Secret',
    `STUDIO_JWT_SECRET=${jwtSecret}`,
    '',
    '# Server',
    `PORT=${port}`,
    '',
  ].join('\n');

  console.log('\nCreating .env with generated secrets...');
  writeFileSync('.env', envContent, 'utf-8');

  console.log('Installing dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: resolve('.') });

  if (!existsSync('./data')) {
    mkdirSync('./data', { recursive: true });
  }

  console.log('Running database migrations...');
  execSync('npx drizzle-kit migrate', { stdio: 'inherit', cwd: resolve('.') });

  console.log('Seeding database and creating admin user...');
  execSync('npx tsx src/db/create-admin.ts', {
    stdio: 'inherit',
    cwd: resolve('.'),
    env: { ...process.env, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword },
  });

  console.log('\n=== Setup complete! ===');
  console.log(`  Admin email: ${adminEmail}`);
  console.log(`  Admin name:  ${adminName}`);
  console.log(`  Login at:    http://localhost:${port}`);
  console.log();

  const startRl = createInterface({ input, output });
  const answer = await startRl.question('Start dev server now? [Y/n]: ');
  startRl.close();

  if (!answer || answer.toLowerCase() === 'y') {
    console.log('Starting development server...\n');
    execSync('npm run dev', { stdio: 'inherit', cwd: resolve('.') });
  }
}

main().catch((err) => {
  console.error('\nSetup failed:', err);
  process.exit(1);
});
