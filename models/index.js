const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  tourist_id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  email: String,
  phone: String,
  dob: String,
  password: { type: String, required: true },  // Password for login
  wallet_address: String,
  status: { type: String, enum: ['safe', 'alert', 'danger'], default: 'safe' },
  blockchain_registered: { type: Boolean, default: false },
  blockchain_tx_hash: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Virtual for id
profileSchema.virtual('id').get(function() {
  return this._id.toHexString();
});
profileSchema.set('toJSON', { virtuals: true });
profileSchema.set('toObject', { virtuals: true });

const alertSchema = new mongoose.Schema({
  user_id: String,
  tourist_id: String,
  username: String,
  status: String,
  lat: Number,
  lng: Number,
  zone_name: String,
  zone_level: String,
  alert_type: { type: String, default: 'status_change' },
  dismissed: { type: Boolean, default: false },
  blockchain_logged: { type: Boolean, default: false },
  blockchain_tx_hash: String,
  created_at: { type: Date, default: Date.now }
});

// Virtual for id
alertSchema.virtual('id').get(function() {
  return this._id.toHexString();
});
alertSchema.set('toJSON', { virtuals: true });
alertSchema.set('toObject', { virtuals: true });

const dangerZoneSchema = new mongoose.Schema({
  name: String,
  lat: Number,
  lng: Number,
  radius: Number,
  level: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  created_by: String,
  blockchain_zone_id: String,
  blockchain_tx_hash: String,
  created_at: { type: Date, default: Date.now }
});

// Virtual for id (to match frontend expectations)
dangerZoneSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Ensure virtuals are included in JSON responses
dangerZoneSchema.set('toJSON', { virtuals: true });
dangerZoneSchema.set('toObject', { virtuals: true });

const userLocationSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  tourist_id: { type: String, required: true },
  username: String,
  lat: Number,
  lng: Number,
  status: { type: String, enum: ['safe', 'alert', 'danger'], default: 'safe' },
  updated_at: { type: Date, default: Date.now }
});

const notificationSchema = new mongoose.Schema({
  tourist_id: String,
  user_id: String,
  admin_wallet: String,
  message: String,
  notification_type: { type: String, default: 'warning' },
  read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const Profile = mongoose.model('Profile', profileSchema);
const Alert = mongoose.model('Alert', alertSchema);
const DangerZone = mongoose.model('DangerZone', dangerZoneSchema);
const UserLocation = mongoose.model('UserLocation', userLocationSchema);
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = {
  Profile,
  Alert,
  DangerZone,
  UserLocation,
  Notification
};
