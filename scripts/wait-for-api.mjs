const healthUrl = process.env.PERSONAIA_API_HEALTH_URL ?? 'http://127.0.0.1:3001/api/v1/health';
const deadline = Date.now() + 60_000;

while (Date.now() < deadline) {
  const healthy = await fetch(healthUrl, { signal: AbortSignal.timeout(1_000) })
    .then((response) => response.ok)
    .catch(() => false);

  if (healthy) process.exit(0);
  await new Promise((resolve) => setTimeout(resolve, 200));
}

console.error(`A API não ficou saudável dentro de 60 segundos: ${healthUrl}`);
process.exit(1);
