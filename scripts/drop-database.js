const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/safehaven_sas';

async function dropDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log(`📊 Database: safehaven_sas`);
    
    // Drop the entire database
    await mongoose.connection.dropDatabase();
    console.log('✅ Database DROPPED successfully!');
    
    // Disconnect
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    
    console.log('\n📝 Next steps:');
    console.log('1. Restart backend server');
    console.log('2. Clear browser localStorage');
    console.log('3. Register a new user');
    
  } catch (error) {
    console.error('❌ Error dropping database:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  dropDatabase();
}

module.exports = dropDatabase;
