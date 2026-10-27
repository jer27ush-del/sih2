// One command for a new or existing folder: creates .env, generates the client,
// creates or applies the database tables, and loads or updates the sample data.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (command) => {
  console.log(`\n> ${command}`);
  execSync(command, { cwd: serverDir, stdio: 'inherit' });
};

const envFile = path.join(serverDir, '.env');
if (!fs.existsSync(envFile)) {
  fs.copyFileSync(path.join(serverDir, '.env.example'), envFile);
  console.log('Created server/.env from .env.example. Set a real JWT_SECRET before live use.');
}

run('npx prisma generate');

const migrationsDir = path.join(serverDir, 'prisma', 'migrations');
const hasMigrations =
  fs.existsSync(migrationsDir) &&
  fs.readdirSync(migrationsDir).some((name) => fs.statSync(path.join(migrationsDir, name)).isDirectory());

// First run in a folder: create the migration from the schema. Later runs: apply what exists.
run(hasMigrations ? 'npx prisma migrate deploy' : 'npx prisma migrate dev --name init');
run('npx prisma db seed');

console.log('\nSetup complete. From the project root, start the app with: npm run dev');
