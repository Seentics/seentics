import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const web = path.join(root, 'web');
const project = `seentics-recording-e2e-${randomUUID().slice(0, 8)}`;
const artifacts = path.join(web, 'test-results', project);
await mkdir(artifacts, { recursive: true });

// Reserve distinct loopback ports, then release just before Compose claims them.
const reservations = await Promise.all(Array.from({ length: 3 }, () => new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server));
})));
const [webPort, storagePort, fixturePort] = reservations.map(s => s.address().port);
const env = {
  ...process.env,
  E2E_WEB_PORT: String(webPort),
  E2E_STORAGE_PORT: String(storagePort), E2E_FIXTURE_PORT: String(fixturePort),
  E2E_BASE_URL: `http://127.0.0.1:${webPort}`,
  E2E_FIXTURE_URL: `http://127.0.0.1:${fixturePort}`,
};
const compose = ['compose', '--project-name', project, '--file', path.join(root, 'web/e2e/recording/compose.yml')];
let activeChild;
let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  interrupted = true;
  activeChild?.kill('SIGTERM');
});

function run(command, args, { capture = false, cwd = root } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    activeChild = child;
    let output = '';
    if (capture) {
      child.stdout.on('data', data => { output += data; });
      child.stderr.on('data', data => { output += data; });
    }
    child.once('error', reject);
    child.once('close', code => {
      activeChild = undefined;
      resolve({ code: code ?? 1, output });
    });
  });
}

let started = false;
const builtImages = [];
try {
  const docker = await run('docker', ['info'], { capture: true });
  if (docker.code !== 0) throw new Error('Docker is unavailable. Start Docker Desktop and retry.\n' + docker.output);
  await Promise.all(reservations.map(s => new Promise(resolve => s.close(resolve))));
  // Build the dashboard once from this checkout. A caller may set E2E_WEB_IMAGE
  // to reuse an already-built image while diagnosing a Docker registry outage.
  if (!env.E2E_WEB_IMAGE) {
    const build = await run('docker', [
      'build', '--target', 'web', '--tag', `seentics-recording-e2e-web:${project}`,
      '--file', path.join(root, 'web/e2e/recording/Dockerfile'), root,
    ]);
    if (build.code !== 0) throw new Error('Dashboard image failed to build.');
    env.E2E_WEB_IMAGE = `seentics-recording-e2e-web:${project}`;
    builtImages.push(env.E2E_WEB_IMAGE);
  }
  if (!env.E2E_CORE_IMAGE) {
    const build = await run('docker', [
      'build', '--target', 'core', '--tag', `seentics-recording-e2e-core:${project}`,
      '--file', path.join(root, 'web/e2e/recording/Dockerfile'), root,
    ]);
    if (build.code !== 0) throw new Error('Core image failed to build.');
    env.E2E_CORE_IMAGE = `seentics-recording-e2e-core:${project}`;
    builtImages.push(env.E2E_CORE_IMAGE);
  }
  console.log(`Starting isolated stack ${project}. Dashboard: ${env.E2E_BASE_URL}`);
  started = true;
  const up = await run('docker', [...compose, 'up', '--detach', '--wait', '--wait-timeout', '300']);
  if (up.code !== 0 || interrupted) throw new Error('Recording test stack failed to start. See Docker logs in ' + artifacts);
  const result = await run(process.execPath, [
    path.join(web, 'node_modules/@playwright/test/cli.js'), 'test',
    '--config', 'e2e/recording/playwright.config.ts', ...process.argv.slice(2),
  ], { cwd: web });
  process.exitCode = result.code;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const server of reservations) if (server.listening) server.close();
  if (started) {
    const logs = await run('docker', [...compose, 'logs', '--no-color'], { capture: true });
    await writeFile(path.join(artifacts, 'docker.log'), logs.output);
    // Only this UUID-named test project's disposable resources are removed.
    const down = await run('docker', [...compose, 'down', '--volumes', '--remove-orphans']);
    if (down.code !== 0) process.exitCode = 1;
    // These tags are created only by this invocation. Never prune shared Docker
    // caches or images supplied through E2E_WEB_IMAGE/E2E_CORE_IMAGE.
    for (const image of builtImages) await run('docker', ['image', 'rm', image]);
    console.log(`Docker logs: ${artifacts}/docker.log`);
  }
}
