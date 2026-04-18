import mongoose from 'mongoose';
import { config } from './config';

export const connectDatabase = async (retryCount = 0): Promise<void> => {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('MongoDB Connected successfully.');
  } catch (error: any) {
    const maxRetries = 5;
    if (retryCount < maxRetries) {
      console.warn(`Database connection failed (${error.message}). Retrying in 5s... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDatabase(retryCount + 1);
    }
    console.error('Max database connection retries reached. Exiting...');
    process.exit(1);
  }
};
