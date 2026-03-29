require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

const startServer = async () => {
  try {
    // Shtojmë opsionin dbName për t'u siguruar që të dhënat shkojnë te ai_marketing_db
    await mongoose.connect(MONGODB_URI, {
      dbName: 'ai_marketing_db'
    });
    
    console.log('✅ MongoDB connected to: ai_marketing_db');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
};

startServer();