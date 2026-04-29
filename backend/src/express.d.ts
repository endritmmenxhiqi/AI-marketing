declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        iat?: number;
        exp?: number;
      };
    }
  }
}

export {};
