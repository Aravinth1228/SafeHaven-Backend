const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/safehaven_sas';

async function clearDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Define schemas
    const profileSchema = new mongoose.Schema({
      user_id: String,
      tourist_id: String,
      username: String,
      email: String,
      phone: String,
      dob: String,
      wallet_address: String,
      status: String,
      created_at: Date,
      updated_at: Date
    });

    const alertSchema = new mongoose.Schema({
      user_id: String,
      tourist_id: String,
      username: String,
      status: String,
      lat: Number,
      lng: Number,
      zone_name: String,
      zone_level: String,
      alert_type: String,
      dismissed: Boolean,
      created_at: Date
    });

    const dangerZoneSchema = new mongoose.Schema({
      name: String,
      lat: Number,
      lng: Number,
      radius: Number,
      level: String,
      created_by: String,
      created_at: Date
    });

    const userLocationSchema = new mongoose.Schema({
      user_id: String,
      tourist_id: String,
      lat: Number,
      lng: Number,
      status: String,
      updated_at: Date
    });

    const notificationSchema = new mongoose.Schema({
      tourist_id: String,
      user_id: String,
      admin_wallet: String,
      message: String,
      notification_type: String,
      read: Boolean,
      created_at: Date
    });

    // Create models
    const Profile = mongoose.model('Profile', profileSchema);
    const Alert = mongoose.model('Alert', alertSchema);
    const DangerZone = mongoose.model('DangerZone', dangerZoneSchema);
    const UserLocation = mongoose.model('UserLocation', userLocationSchema);
    const Notification = mongoose.model('Notification', notificationSchema);

    // Clear all collections
    console.log('🗑️  Clearing all collections...');
    
    const results = await Promise.all([
      Profile.deleteMany({}),
      Alert.deleteMany({}),
      DangerZone.deleteMany({}),
      UserLocation.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    console.log('✅ Database cleared successfully!');
    console.log(`   - Profiles deleted: ${results[0].deletedCount}`);
    console.log(`   - Alerts deleted: ${results[1].deletedCount}`);
    console.log(`   - Danger zones deleted: ${results[2].deletedCount}`);
    console.log(`   - Locations deleted: ${results[3].deletedCount}`);
    console.log(`   - Notifications deleted: ${results[4].deletedCount}`);

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  clearDatabase();
}

module.exports = clearDatabase;
