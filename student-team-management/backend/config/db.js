// backend/config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Add connection options to prevent timeout issues
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Increase the timeout to 30 seconds
      socketTimeoutMS: 45000, // Increase socket timeout
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1); // Exit with failure
  }
};

module.exports = connectDB;
