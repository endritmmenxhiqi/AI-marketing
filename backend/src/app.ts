import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { config } from './config';
import router from './routes';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const authRoutes = require(path.join(config.rootDir, 'src/routes/authRoutes.js'));

export const createApp = () => {
  const app = express();

  const allowedOrigins = [config.frontendUrl, 'http://localhost:5173', 'http://localhost:5174'];
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : 0);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || config.env === 'development') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use('/storage', express.static(path.join(config.rootDir, 'storage/exports')));
  app.use('/storage/uploads', express.static(path.join(config.rootDir, 'storage/uploads')));

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
