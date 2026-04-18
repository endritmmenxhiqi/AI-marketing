import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { config } from './config';
import router from './routes';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const authRoutes = require(path.join(config.rootDir, 'src/routes/authRoutes.js'));

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: config.frontendUrl
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use('/storage', express.static(path.join(config.rootDir, 'storage/exports')));
  app.use('/storage/uploads', express.static(path.join(config.rootDir, 'storage/uploads')));
  app.use('/storage/work', express.static(config.workingDir));

  app.get('/', (_req, res) => {
    res.json({
      name: 'AI Marketing Studio MVP API',
      status: 'ok',
      health: `${config.appUrl}/api/health`,
      frontend: config.frontendUrl
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', router);

  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error.statusCode || 500;
    res.status(status).json({
      message: error.message || 'Unexpected server error.'
    });
  });

  return app;
};
