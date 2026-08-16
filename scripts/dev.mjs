import { existsSync, readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(projectRoot, '.env');

if (!existsSync(envPath)) {
  console.error('Arquivo .env ausente. Execute: cp .env.example .env');
  process.exit(1);
}

const fileEnvironment = Object.fromEntries(readFileSync(envPath, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => {
    const separator = line.indexOf('=');
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '').trim();
    return [key, value];
  }));

const localEnvironment = { ...process.env, ...fileEnvironment };

const requiredVariables = [
  'POSTGRES_DB',
  'POSTGRES_MIGRATION_USER',
  'POSTGRES_MIGRATION_PASSWORD',
  'APP_DB_USER',
  'APP_DB_PASSWORD',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'SUPER_ADMIN_EMAIL',
  'SUPER_ADMIN_PASSWORD',
];
const invalidVariables = requiredVariables.filter((name) => {
  const value = localEnvironment[name];
  return !value || value.includes('REPLACE_') || (name === 'SUPER_ADMIN_PASSWORD' && value.length < 12);
});

if (invalidVariables.length > 0) {
  console.error(`Configure valores reais no .env: ${invalidVariables.join(', ')}`);
  process.exit(1);
}

const databasePort = localEnvironment.POSTGRES_DEV_PORT ?? '5433';
const databaseUrl = new URL('postgresql://127.0.0.1');
databaseUrl.username = localEnvironment.APP_DB_USER;
databaseUrl.password = localEnvironment.APP_DB_PASSWORD;
databaseUrl.port = databasePort;
databaseUrl.pathname = `/${localEnvironment.POSTGRES_DB}`;
databaseUrl.searchParams.set('schema', 'public');

const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const configuredOrigins = (localEnvironment.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const developmentEnvironment = {
  ...localEnvironment,
  NODE_ENV: 'development',
  PORT: '3001',
  DATABASE_URL: databaseUrl.toString(),
  CORS_ORIGINS: [...new Set([...configuredOrigins, ...localOrigins])].join(','),
  COOKIE_SECURE: 'false',
  VITE_API_PROXY_TARGET: 'http://127.0.0.1:3001',
};

const isPortOccupied = (port) => new Promise((resolve) => {
  const probe = createConnection({ host: '127.0.0.1', port });
  let completed = false;
  const finish = (occupied) => {
    if (completed) return;
    completed = true;
    probe.destroy();
    resolve(occupied);
  };
  probe.unref();
  probe.setTimeout(400);
  probe.once('connect', () => finish(true));
  probe.once('timeout', () => finish(false));
  probe.once('error', (error) => finish(error.code !== 'ECONNREFUSED'));
});

const applicationPorts = [
  { port: 3001, label: 'API' },
  { port: 5173, label: 'Frontend' },
];
const occupiedPorts = (await Promise.all(applicationPorts.map(async (entry) => ({
  ...entry,
  occupied: await isPortOccupied(entry.port),
})))).filter((entry) => entry.occupied);

if (occupiedPorts.length > 0) {
  const expectedServicesAreHealthy = occupiedPorts.length === applicationPorts.length
    && (await Promise.all([
      fetch('http://127.0.0.1:3001/api/v1/health', { signal: AbortSignal.timeout(1_500) })
        .then((response) => response.ok)
        .catch(() => false),
      fetch('http://127.0.0.1:5173/', { signal: AbortSignal.timeout(1_500) })
        .then((response) => response.ok)
        .catch(() => false),
    ])).every(Boolean);

  if (expectedServicesAreHealthy) {
    console.log('A aplicação já está em execução e saudável.');
    console.log('Frontend: http://localhost:5173');
    console.log('API: http://localhost:3001/api/v1/health');
    process.exit(0);
  }

  console.error(`A aplicação já parece estar em execução (${occupiedPorts.map(({ label, port }) => `${label} ${port}`).join(', ')}).`);
  console.error('Uma ou mais portas estão ocupadas por um processo sem saúde confirmada. Encerre o processo anterior e execute npm run dev novamente.');
  process.exit(1);
}

console.log('Preparando PostgreSQL local na porta 127.0.0.1:' + databasePort + '...');
const composeArguments = ['compose', '-f', 'compose.yml', '-f', 'compose.dev.yml'];
const runDocker = (argumentsList) => {
  const result = spawnSync('docker', [...composeArguments, ...argumentsList], {
    cwd: projectRoot,
    env: developmentEnvironment,
    stdio: 'inherit',
  });
  if (result.error?.code === 'ENOENT') {
    console.error('Docker não foi encontrado. Instale/inicie o Docker Desktop e tente novamente.');
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error('Não foi possível preparar o PostgreSQL de desenvolvimento.');
    process.exit(result.status ?? 1);
  }
};

runDocker(['up', '-d', '--wait', 'postgres']);
runDocker(['run', '--rm', '--no-deps', '--build', 'migrate']);
runDocker(['run', '--rm', '--no-deps', 'db-permissions']);

const concurrentlyExecutable = join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'concurrently.cmd' : 'concurrently',
);
const application = spawn(
  concurrentlyExecutable,
  [
    '--kill-others-on-fail',
    '-n',
    'api,web',
    '-c',
    'blue,green',
    'npm run start:dev -w @personaia/api',
    'node scripts/wait-for-api.mjs && npm run dev -w @personaia/web',
  ],
  { cwd: projectRoot, env: developmentEnvironment, stdio: 'inherit' },
);

const stop = (signal) => {
  if (!application.killed) application.kill(signal);
};
process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
application.once('error', (error) => {
  console.error(`Falha ao iniciar API e frontend: ${error.message}`);
  process.exit(1);
});
application.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
