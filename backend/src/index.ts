import { createServer, type Server } from 'node:http';
import { open, readFile, rm, type FileHandle } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDatabase } from './db';
import { config, requiredAtBoot } from './config';
import { ensureDir } from './utils/files';
import { createApp } from './app';
import { closeRedisConnections, ensureRedisConnection } from './queue';

const SERVER_LOCK_PATH = path.join(config.rootDir, 'storage', '.backend-server.lock');
const MAX_PORT_ATTEMPTS = 20;

type ServerLockPayload = {
  pid: number;
  port: number | null;
  appUrl: string;
  startedAt: string;
};

let server: Server | null = null;
let serverLockHandle: FileHandle | null = null;
let shuttingDown = false;
let bootPromise: Promise<void> | null = null;

const logBootWarnings = () => {
  requiredAtBoot.forEach((key) => {
    if (!process.env[key]) {
      console.warn(`Missing required environment variable: ${key}`);
    }
  });
};

const isPortInUseError = (error: unknown): error is NodeJS.ErrnoException =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as NodeJS.ErrnoException).code === 'EADDRINUSE';

const isProcessRunning = (pid: number) => {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    return error?.code !== 'ESRCH';
  }
};

const buildUrlWithPort = (input: string, port: number) => {
  try {
    const url = new URL(input);
    url.port = String(port);
    return url.toString().replace(/\/$/, '');
  } catch {
    return `http://localhost:${port}`;
  }
};

const updateRuntimeUrls = (port: number) => {
  config.port = port;
  config.appUrl = buildUrlWithPort(config.appUrl, port);
  config.backendUrl = buildUrlWithPort(config.backendUrl, port);
};

const readExistingLock = async () => {
  try {
    const raw = await readFile(SERVER_LOCK_PATH, 'utf8');
    if (!raw.trim()) {
      return null;
    }
    return JSON.parse(raw) as ServerLockPayload;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    if (error instanceof SyntaxError) {
      console.warn('Corrupt lock file detected, ignoring.');
      return null;
    }

    throw error;
  }
};

const writeServerLock = async (port: number | null) => {
  if (!serverLockHandle) {
    return;
  }

  const payload: ServerLockPayload = {
    pid: process.pid,
    port,
    appUrl: port ? buildUrlWithPort(config.appUrl, port) : config.appUrl,
    startedAt: new Date().toISOString(),
  };

  await serverLockHandle.truncate(0);
  await serverLockHandle.writeFile(JSON.stringify(payload, null, 2), 'utf8');
  await serverLockHandle.sync();
};

const acquireServerLock = async () => {
  while (!serverLockHandle) {
    try {
      serverLockHandle = await open(SERVER_LOCK_PATH, 'wx');
      await writeServerLock(null);
      return true;
    } catch (error: any) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }

      const existingLock = await readExistingLock();
      if (existingLock?.pid && existingLock.pid !== process.pid && isProcessRunning(existingLock.pid)) {
        console.error(
          `Another backend instance is already running (PID ${existingLock.pid}) on port ${existingLock.port ?? 'unknown'}.`
        );
        return false;
      }

      await rm(SERVER_LOCK_PATH, { force: true });
    }
  }

  return true;
};

const releaseServerLock = async () => {
  const currentHandle = serverLockHandle;
  serverLockHandle = null;

  await currentHandle?.close().catch(() => undefined);
  await rm(SERVER_LOCK_PATH, { force: true }).catch(() => undefined);
};

const closeServer = async () => {
  if (!server) {
    return;
  }

  const currentServer = server;
  server = null;

  await new Promise<void>((resolve, reject) => {
    currentServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const cleanupResources = async () => {
  await Promise.allSettled([
    closeServer(),
    mongoose.connection.readyState !== 0 ? mongoose.disconnect() : Promise.resolve(),
    config.queueMode === 'bullmq' ? closeRedisConnections() : Promise.resolve(),
    releaseServerLock(),
  ]);
};

const listenOnAvailablePort = async (httpServer: Server, startPort: number) => {
  let port = startPort;

  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const handleListening = () => {
          httpServer.off('error', handleError);
          resolve();
        };

        const handleError = (error: NodeJS.ErrnoException) => {
          httpServer.off('listening', handleListening);
          reject(error);
        };

        httpServer.once('listening', handleListening);
        httpServer.once('error', handleError);
        httpServer.listen(port, '127.0.0.1');
      });

      return port;
    } catch (error) {
      if (!isPortInUseError(error)) {
        throw error;
      }

      console.warn(`Port ${port} is already in use. Trying port ${port + 1}...`);
      port += 1;
    }
  }

  throw new Error(`Unable to find an available port after ${MAX_PORT_ATTEMPTS} attempts starting from ${startPort}.`);
};

const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`Received ${signal}. Shutting down backend gracefully...`);
  await cleanupResources();
  process.exit(0);
};

const registerProcessHandlers = () => {
  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
};

const boot = async () => {
  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = (async () => {
    logBootWarnings();

    const lockAcquired = await acquireServerLock();
    if (!lockAcquired) {
      process.exitCode = 1;
      return;
    }

    await Promise.all([
      ensureDir(config.uploadsDir),
      ensureDir(config.workingDir),
      ensureDir(config.cacheDir),
      ensureDir(config.outputDir),
    ]);

    if (config.queueMode === 'bullmq') {
      await ensureRedisConnection();
    }

    await connectDatabase();

    const app = createApp();
    server = createServer(app);

    const activePort = await listenOnAvailablePort(server, config.port);
    updateRuntimeUrls(activePort);
    await writeServerLock(activePort);

    console.log(`AI Marketing Studio backend listening on ${config.appUrl}`);
  })();

  try {
    await bootPromise;
  } catch (error) {
    console.error('Backend startup failed:', error);
    await cleanupResources();
    process.exit(1);
  } finally {
    bootPromise = null;
  }
};

registerProcessHandlers();
void boot();
