declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        iat?: number;
        exp?: number;
      };
      rawBody?: Buffer;
      creditUsage?: {
        consumed: true;
        source: 'wallet';
        outputMode: 'video' | 'image';
        state: {
          role: 'user' | 'premium';
          subscriptionStatus: 'free' | 'active' | 'cancelled';
          credits: number;
          totalGenerations: number;
        };
      };
    }
  }
}

export {};
