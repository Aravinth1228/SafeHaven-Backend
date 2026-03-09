const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app); // Create HTTP server
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/safehaven';

// Socket.IO Setup - Real-time location tracking
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store connected clients
const connectedClients = new Map();

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  // Join admin room for real-time updates
  socket.on('join-admin', () => {
    socket.join('admin-room');
    console.log('📊 Admin joined real-time updates');
  });

  // Join user room (for receiving their own updates)
  socket.on('join-user', (touristId) => {
    socket.join(`user-${touristId}`);
    console.log(`👤 User ${touristId} joined their room`);
  });

  // Handle location update from user via Socket.IO
  socket.on('location-update', async (locationData) => {
    const { user_id, tourist_id, lat, lng, username, status } = locationData;

    console.log('📡 Socket.IO location update received:', {
      user_id,
      tourist_id,
      lat: lat?.toFixed(6),
      lng: lng?.toFixed(6),
      username,
      status,
    });

    // Update location in database
    try {
      let location = await UserLocation.findOne({ user_id });
      if (location) {
        location.lat = lat;
        location.lng = lng;
        if (status) location.status = status;
        location.updated_at = new Date();
        await location.save();
      } else {
        location = await UserLocation.create({
          user_id,
          tourist_id,
          lat,
          lng,
          username: username || 'Unknown',
          status: status || 'safe',
          updated_at: new Date()
        });
      }

      // Update profile status if provided
      if (status) {
        await Profile.findOneAndUpdate(
          { user_id },
          { status, updated_at: new Date() }
        );
      }

      // Broadcast to all admins in admin-room
      io.to('admin-room').emit('location-update', {
        user_id,
        tourist_id,
        lat,
        lng,
        username: username || 'Unknown',
        status: status || 'safe',
        updated_at: new Date().toISOString()
      });

      // Also emit back to the user
      io.to(`user-${tourist_id}`).emit('my-location-update', {
        user_id,
        tourist_id,
        lat,
        lng,
        username: username || 'Unknown',
        status: status || 'safe',
        updated_at: new Date().toISOString()
      });

      console.log('📡 Broadcasted location to admin-room and user room');
    } catch (error) {
      console.error('❌ Error processing Socket.IO location update:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Export io for use in routes
module.exports.io = io;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Initialize Blockchain Relayer
const relayer = require('./blockchain/relayer');
relayer.initialize().then(() => {
  console.log('✅ Blockchain Relayer initialized');
}).catch(err => {
  console.log('⚠️  Blockchain Relayer not initialized (contracts may not be deployed yet)');
});

// Import blockchain routes
const blockchainRoutes = require('./routes/blockchain');
const blockchainDangerZonesRoutes = require('./routes/blockchain-danger-zones');
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/blockchain/danger-zones', blockchainDangerZonesRoutes);

// Import models
const { Profile, Alert, DangerZone, UserLocation, Notification } = require('./models');

// Helper: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Generate Tourist ID
function generateTouristId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TID-${timestamp}-${random}`;
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await Profile.find().sort({ created_at: -1 });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user by ID
app.get('/api/users/:userId', async (req, res) => {
  try {
    const user = await Profile.findOne({ user_id: req.params.userId });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user status
app.patch('/api/users/:userId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const userId = req.params.userId;

    // Try to find by tourist_id first (most reliable)
    let user = await Profile.findOne({
      tourist_id: { $regex: new RegExp(`^${userId}$`, 'i') }
    });

    // If not found, try searching by user_id
    if (!user) {
      user = await Profile.findOne({ user_id: userId });
    }

    // If still not found, try searching by wallet address (case-insensitive)
    if (!user) {
      user = await Profile.findOne({
        wallet_address: { $regex: new RegExp(`^${userId}$`, 'i') }
      });
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Update only the status field (avoid validation errors)
    const updatedUser = await Profile.findByIdAndUpdate(
      user._id,
      {
        status: status,
        updated_at: new Date()
      },
      { new: true, runValidators: false }
    );

    // Create alert if status is alert/danger
    if (status === 'alert' || status === 'danger') {
      await Alert.create({
        user_id: updatedUser.user_id,
        tourist_id: updatedUser.tourist_id,
        username: updatedUser.username,
        status: status,
        alert_type: 'status_change',
      });
    }

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all danger zones - MongoDB First (Blockchain Optional)
app.get('/api/danger-zones', async (req, res) => {
  try {
    // Get danger zones from MongoDB first (primary source)
    const mongoZones = await DangerZone.find().sort({ created_at: -1 });
    
    console.log('📊 Loaded danger zones from MongoDB:', mongoZones.length);

    res.json({
      success: true,
      data: mongoZones.map(zone => ({
        id: zone._id,
        name: zone.name,
        lat: zone.lat,
        lng: zone.lng,
        radius: zone.radius,
        level: zone.level,
        created_by: zone.created_by,
        blockchain_zone_id: zone.blockchain_zone_id,
        blockchain_tx_hash: zone.blockchain_tx_hash,
        created_at: zone.created_at,
        isActive: true
      })),
      blockchainEnabled: relayer.isInitialized(),
      count: mongoZones.length,
      source: 'mongodb'
    });
  } catch (error) {
    console.error('Error getting danger zones:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create danger zone - MongoDB First (Blockchain Optional)
app.post('/api/danger-zones', async (req, res) => {
  try {
    const { name, lat, lng, radius, level, created_by } = req.body;

    // Validate input
    if (!name || lat === undefined || lng === undefined || !radius || !level) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, lat, lng, radius, level'
      });
    }

    // Step 1: Create danger zone in MongoDB (ALWAYS)
    const dangerZone = await DangerZone.create({
      name,
      lat,
      lng,
      radius,
      level,
      created_by: created_by || 'admin',
      blockchain_zone_id: null,
      blockchain_tx_hash: null
    });

    console.log('✅ Danger zone created in MongoDB:', dangerZone._id);

    // Step 2: Try to create on blockchain (OPTIONAL - don't fail if it errors)
    let blockchainResult = null;
    let blockchainEnabled = false;

    if (relayer.isInitialized()) {
      try {
        // Convert coordinates to int256 * 1e6 format for blockchain
        const latInt = Math.round(lat * 1e6);
        const lngInt = Math.round(lng * 1e6);

        // Convert level string to enum number (Low=0, Medium=1, High=2, Critical=3)
        const levelEnum = { 'Low': 0, 'Medium': 1, 'High': 2, 'Critical': 3 }[level] || 1;

        // Create danger zone on blockchain
        blockchainResult = await relayer.createDangerZoneDirect(
          created_by || process.env.ADMIN_WALLET,
          name,
          latInt,
          lngInt,
          radius,
          levelEnum
        );

        // Update MongoDB with blockchain info
        await DangerZone.findByIdAndUpdate(dangerZone._id, {
          blockchain_zone_id: blockchainResult?.zoneId,
          blockchain_tx_hash: blockchainResult?.txHash
        });

        blockchainEnabled = true;
        console.log('✅ Danger zone also created on blockchain:', blockchainResult?.txHash);
      } catch (blockchainErr) {
        console.warn('⚠️ Blockchain creation failed (zone still created in MongoDB):', blockchainErr.message);
        // Don't fail - MongoDB creation succeeded
      }
    } else {
      console.log('⚠️ Blockchain not initialized - zone created in MongoDB only');
    }

    // Step 3: Check if any users are inside or near this new zone (for notifications)
    const users = await UserLocation.find();
    const notifications = [];
    const updatedUsers = [];

    for (const user of users) {
      const distance = calculateDistance(user.lat, user.lng, lat, lng);

      // If user is INSIDE the danger zone
      if (distance <= radius) {
        // Update profile status to DANGER
        await Profile.findOneAndUpdate(
          { user_id: user.user_id },
          { status: 'danger', updated_at: new Date() }
        );

        // Create emergency alert in MongoDB
        const alert = await Alert.create({
          user_id: user.user_id,
          tourist_id: user.tourist_id,
          username: user.username || 'Unknown',
          status: 'danger',
          alert_type: 'entered_danger_zone',
          lat: user.lat,
          lng: user.lng,
          zone_name: name,
          zone_level: level,
        });
        updatedUsers.push(user.username);

        console.log(`🚨 EMERGENCY: User ${user.username} is INSIDE ${name} - Status set to DANGER`);
      }
      // If user is within 500m but outside zone
      else if (distance <= 500) {
        const notification = await Notification.create({
          tourist_id: user.tourist_id,
          user_id: user.user_id,
          admin_wallet: created_by || 'admin',
          message: `⚠️ New danger zone "${name}" created ${Math.round(distance)}m from your location. Stay away!`,
          notification_type: 'warning',
        });
        notifications.push(notification);

        console.log(`⚠️ User ${user.username} is within 500m of ${name}`);
      }
    }

    res.json({
      success: true,
      data: {
        id: dangerZone._id,
        name,
        lat,
        lng,
        radius,
        level,
        created_by: created_by || 'admin',
        isActive: true
      },
      blockchain: blockchainResult ? {
        txHash: blockchainResult.txHash,
        blockNumber: blockchainResult.blockNumber,
        zoneId: blockchainResult.zoneId
      } : null,
      blockchainEnabled,
      notifications: notifications.length,
      emergencyUsers: updatedUsers.length,
      emergencyUsernames: updatedUsers,
      message: blockchainEnabled 
        ? 'Danger zone created in MongoDB + Blockchain' 
        : 'Danger zone created in MongoDB only (blockchain not available)'
    });
  } catch (error) {
    console.error('Create danger zone error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete danger zone - MongoDB First (Blockchain Optional)
app.delete('/api/danger-zones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Deleting danger zone from MongoDB:', id);

    // Delete from MongoDB first (ALWAYS)
    const mongoResult = await DangerZone.findByIdAndDelete(id);
    
    if (!mongoResult) {
      return res.status(404).json({ success: false, error: 'Danger zone not found in MongoDB' });
    }

    console.log('✅ Danger zone deleted from MongoDB:', id);

    // Try to delete from blockchain (OPTIONAL)
    let blockchainDeleted = false;
    let blockchainResult = null;

    if (relayer.isInitialized() && mongoResult.blockchain_zone_id) {
      try {
        // Extract blockchain index from zone ID
        const blockchainIndex = parseInt(mongoResult.blockchain_zone_id.replace('ZONE-', ''));
        
        if (!isNaN(blockchainIndex)) {
          blockchainResult = await relayer.removeDangerZone(process.env.ADMIN_WALLET, blockchainIndex);
          blockchainDeleted = true;
          console.log('✅ Danger zone also deleted from blockchain:', blockchainResult?.txHash);
        }
      } catch (blockchainErr) {
        console.warn('⚠️ Blockchain deletion failed (zone already deleted from MongoDB):', blockchainErr.message);
        // Don't fail - MongoDB deletion succeeded
      }
    }

    res.json({
      success: true,
      message: 'Danger zone deleted',
      mongodbDeleted: true,
      blockchainDeleted,
      blockchain: blockchainResult ? {
        txHash: blockchainResult.txHash,
        blockNumber: blockchainResult.blockNumber
      } : null
    });
  } catch (error) {
    console.error('Delete danger zone error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all active alerts
app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await Alert.find({ dismissed: false }).sort({ created_at: -1 });
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Dismiss alert
app.patch('/api/alerts/:alertId/dismiss', async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.alertId,
      { dismissed: true },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user location
app.post('/api/locations', async (req, res) => {
  try {
    const { user_id, tourist_id, lat, lng, username, status } = req.body;

    console.log('📍 Location update received:', {
      user_id,
      tourist_id,
      lat,
      lng,
      username: username || 'NOT_PROVIDED',
      status
    });

    console.log('📍 Processing location:', lat.toFixed(6), lng.toFixed(6));

    // Upsert location
    let location = await UserLocation.findOne({ user_id });
    if (location) {
      location.lat = lat;
      location.lng = lng;
      if (status) location.status = status;
      location.updated_at = new Date();
      await location.save();
    } else {
      location = await UserLocation.create({
        user_id,
        tourist_id,
        lat,
        lng,
        username: username || 'Unknown',
        status: status || 'safe'
      });
    }

    // Update profile status ONLY if explicitly provided from frontend
    // Don't auto-change status based on danger zones - let frontend handle it
    if (status) {
      await Profile.findOneAndUpdate(
        { user_id },
        { status, updated_at: new Date() }
      );
    }

    // 🚀 EMIT REAL-TIME LOCATION UPDATE VIA SOCKET.IO
    const locationData = {
      user_id,
      tourist_id,
      lat,
      lng,
      username: username || 'Unknown',
      status: status || 'safe',
      updated_at: new Date().toISOString()
    };

    // Emit to all admins in admin-room
    io.to('admin-room').emit('location-update', locationData);
    console.log('📡 Emitted location update to admin-room:', locationData.username);

    // Emit to the user themselves
    io.to(`user-${tourist_id}`).emit('my-location-update', locationData);

    // Fetch danger zones from blockchain via API
    let zones = [];
    try {
      const blockchainResponse = await fetch('http://localhost:3000/api/blockchain/danger-zones', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const blockchainData = await blockchainResponse.json();
      if (blockchainData.success) {
        zones = blockchainData.data || [];
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch danger zones from blockchain:', error.message);
    }

    // Track if user is in any danger zone or near any zone
    let isInAnyDangerZone = false;
    let isNearAnyDangerZone = false;

    // Check if user is in danger zone OR nearby (within 200m)
    for (const zone of zones) {
      const distance = calculateDistance(lat, lng, zone.lat, zone.lng);

      // User entered danger zone (INSIDE the radius)
      if (distance <= zone.radius) {
        isInAnyDangerZone = true;

        // Check if alert already exists for this zone entry
        const existingAlert = await Alert.findOne({
          user_id,
          zone_name: zone.name,
          alert_type: 'entered_danger_zone',
          dismissed: false
        });

        if (!existingAlert) {
          // Create alert ONLY (don't auto-change status)
          await Alert.create({
            user_id,
            tourist_id,
            username: username || 'Unknown',
            status: status || 'safe',  // Use current status, don't force danger
            alert_type: 'entered_danger_zone',
            lat,
            lng,
            zone_name: zone.name,
            zone_level: zone.level,
          });

          console.log(`🚨 ALERT CREATED: User ${username || 'Unknown'} entered ${zone.name} - Alert created (status not auto-changed)`);
        }
      }
      // User is within 200m of danger zone (proximity alert - OUTSIDE but close)
      else if (distance <= 200 && distance > zone.radius) {
        isNearAnyDangerZone = true;

        const existingProximityAlert = await Alert.findOne({
          user_id,
          zone_name: zone.name,
          alert_type: 'near_danger_zone',
          dismissed: false
        });

        if (!existingProximityAlert) {
          // Create proximity alert ONLY (don't auto-change status)
          await Alert.create({
            user_id,
            tourist_id,
            username: username || 'Unknown',
            status: status || 'safe',  // Use current status, don't force alert
            alert_type: 'near_danger_zone',
            lat,
            lng,
            zone_name: zone.name,
            zone_level: zone.level,
          });

          console.log(`⚠️ PROXIMITY ALERT: User ${username || 'Unknown'} is within 200m of ${zone.name} - Alert created (status not auto-changed)`);
        }
      }
    }

    // Don't auto-reset status to safe - let frontend handle it based on user action
    // Status should only change when user manually changes it or explicitly sends new status

    res.json({ success: true, data: location });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Register new user/tourist profile
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, phone, dob, wallet_address, tourist_id, user_id, password, lat, lng } = req.body;

    // Check if wallet address already exists
    const existingWallet = await Profile.findOne({ wallet_address });
    if (existingWallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address already registered'
      });
    }

    // Check if username already exists
    const existingUsername = await Profile.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });

    // If username exists but with different wallet, update the wallet address
    if (existingUsername) {
      console.log('⚠️ Username exists, updating wallet address for:', existingUsername.username);

      // Update the existing user's wallet address and other details
      const updatedProfile = await Profile.findOneAndUpdate(
        { _id: existingUsername._id },
        {
          wallet_address,
          email: email || existingUsername.email,
          phone: phone || existingUsername.phone,
          dob: dob || existingUsername.dob,
          password: password || existingUsername.password,
          updated_at: new Date()
        },
        { new: true }
      );

      return res.json({
        success: true,
        data: updatedProfile,
        message: 'Existing user updated with new wallet address'
      });
    }

    // Check if tourist_id already exists
    const existingTourist = await Profile.findOne({ tourist_id });
    if (existingTourist) {
      return res.status(400).json({
        success: false,
        error: 'Tourist ID already exists. Please try again.'
      });
    }

    const finalTouristId = tourist_id || generateTouristId();
    const finalUserId = user_id || new mongoose.Types.ObjectId().toString();

    const profile = await Profile.create({
      user_id: finalUserId,
      tourist_id: finalTouristId,
      username,
      email,
      phone,
      dob,
      password,  // Save password for login
      wallet_address,
      status: 'safe',
    });

    // 📍 Store initial location if provided
    if (lat !== undefined && lng !== undefined) {
      await UserLocation.create({
        user_id: finalUserId,
        tourist_id: finalTouristId,
        lat,
        lng,
        username,
        status: 'safe',
        updated_at: new Date()
      });

      console.log('📍 Initial location stored for user:', username, { lat, lng });

      // 🚀 Emit initial location via Socket.IO to admins
      const locationData = {
        user_id: finalUserId,
        tourist_id: finalTouristId,
        lat,
        lng,
        username: username || 'Unknown',
        status: 'safe',
        updated_at: new Date().toISOString()
      };

      // Emit to all admins in admin-room
      io.to('admin-room').emit('location-update', locationData);
      console.log('📡 Emitted initial location to admin-room:', username);
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// User login with username and password
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Find user by username (case-insensitive)
    const user = await Profile.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    // Check password
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user.toObject();
    res.json({ 
      success: true, 
      data: userWithoutPassword,
      message: 'Login successful'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete user from MongoDB (profile, alerts, locations, notifications)
app.delete('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('🗑️ Deleting user from MongoDB:', userId);

    // Delete user profile
    const profileResult = await Profile.deleteOne({ user_id: userId });
    console.log('✅ Profile deleted:', profileResult.deletedCount);

    // Delete all user's alerts
    const alertsResult = await Alert.deleteMany({ user_id: userId });
    console.log('✅ Alerts deleted:', alertsResult.deletedCount);

    // Delete user's location
    const locationsResult = await UserLocation.deleteOne({ user_id: userId });
    console.log('✅ Location deleted:', locationsResult.deletedCount ? 1 : 0);

    // Delete user's notifications
    const profile = await Profile.findOne({ user_id: userId });
    let notificationsResult = { deletedCount: 0 };
    if (profile) {
      notificationsResult = await Notification.deleteMany({ tourist_id: profile.tourist_id });
      console.log('✅ Notifications deleted:', notificationsResult.deletedCount);
    }

    res.json({
      success: true,
      message: 'User deleted from MongoDB',
      deleted: {
        profile: profileResult.deletedCount,
        alerts: alertsResult.deletedCount,
        locations: locationsResult.deletedCount ? 1 : 0,
        notifications: notificationsResult.deletedCount,
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analytics endpoint
app.get('/api/analytics', async (req, res) => {
  try {
    const profiles = await Profile.find();
    const alerts = await Alert.find({ dismissed: false });

    const stats = {
      total_users: profiles.length,
      safe_users: profiles.filter(p => p.status === 'safe').length,
      alert_users: profiles.filter(p => p.status === 'alert').length,
      danger_users: profiles.filter(p => p.status === 'danger').length,
      active_alerts: alerts.length,
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete test users permanently
app.delete('/api/users/delete-test-users', async (req, res) => {
  try {
    const { confirm } = req.query;
    
    if (confirm !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Add ?confirm=true to proceed'
      });
    }

    // Test user patterns
    const testPatterns = [
      'test',
      'demo',
      'fake',
      'dummy',
      'temp',
      'temporary',
      'sample',
      'example',
    ];

    // Find all test users
    const testUsers = await Profile.find({
      $or: [
        { username: { $regex: 'test|demo|fake|dummy|temp|sample|example', $options: 'i' } },
        { email: { $regex: 'test|demo|fake|dummy|temp|sample|example', $options: 'i' } },
        { tourist_id: { $regex: 'test|demo|fake|dummy|temp|sample|example', $options: 'i' } }
      ]
    });

    const deletedCount = testUsers.length;
    
    if (deletedCount === 0) {
      return res.json({
        success: true,
        message: 'No test users found',
        deleted: 0
      });
    }

    // Delete test users from MongoDB
    const result = await Profile.deleteMany({
      _id: { $in: testUsers.map(u => u._id) }
    });

    // Also delete their locations, alerts, and notifications
    await UserLocation.deleteMany({ 
      user_id: { $in: testUsers.map(u => u.user_id) } 
    });
    await Alert.deleteMany({ 
      user_id: { $in: testUsers.map(u => u.user_id) } 
    });
    await Notification.deleteMany({ 
      tourist_id: { $in: testUsers.map(u => u.tourist_id) } 
    });

    console.log(`🗑️ Permanently deleted ${deletedCount} test users`);

    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} test users`,
      deleted: deletedCount,
      details: result
    });
  } catch (error) {
    console.error('Error deleting test users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Notifications
app.post('/api/notifications', async (req, res) => {
  try {
    const { tourist_id, user_id, admin_wallet, message, notification_type } = req.body;
    const notification = await Notification.create({
      tourist_id,
      user_id,
      admin_wallet,
      message,
      notification_type: notification_type || 'warning',
    });
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/notifications/:touristId', async (req, res) => {
  try {
    const notifications = await Notification.find({ tourist_id: req.params.touristId })
      .sort({ created_at: -1 });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all locations
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await UserLocation.find().sort({ updated_at: -1 });
    
    // Merge with Profile data to get correct username and status
    const locationsWithProfiles = await Promise.all(
      locations.map(async (loc) => {
        const profile = await Profile.findOne({ user_id: loc.user_id });
        return {
          ...loc.toObject(),
          username: loc.username || profile?.username || 'Unknown',
          status: profile?.status || loc.status || 'safe'
        };
      })
    );
    
    res.json({ success: true, data: locationsWithProfiles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete location by ID (admin only)
app.delete('/api/locations/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    await UserLocation.findByIdAndDelete(locationId);
    res.json({ success: true, message: 'Location deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all database collections (for testing)
app.post('/api/clear-db', async (req, res) => {
  try {
    const results = await Promise.all([
      Profile.deleteMany({}),
      Alert.deleteMany({}),
      DangerZone.deleteMany({}),
      UserLocation.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    res.json({
      success: true,
      message: 'Database cleared',
      deleted: {
        profiles: results[0].deletedCount,
        alerts: results[1].deletedCount,
        dangerZones: results[2].deletedCount,
        locations: results[3].deletedCount,
        notifications: results[4].deletedCount,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all locations only
app.post('/api/clear-locations', async (req, res) => {
  try {
    const result = await UserLocation.deleteMany({});
    res.json({
      success: true,
      message: 'All locations cleared',
      deleted: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Drop entire database (for testing)
app.post('/api/drop-db', async (req, res) => {
  try {
    await mongoose.connection.dropDatabase();
    res.json({
      success: true,
      message: 'Database dropped successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server with Socket.IO
server.listen(PORT, () => {
  console.log(`🚀 SafeHaven API Server running on http://localhost:${PORT}`);
  console.log(`📊 MongoDB Database: safehaven_sas`);
  console.log(`🔗 Connection: ${MONGODB_URI}`);
  console.log(`🔌 Socket.IO ready for real-time updates`);

  // Log blockchain status
  if (relayer.isInitialized()) {
    const deploymentInfo = relayer.getDeploymentInfo();
    console.log(`⛓️  Blockchain: ${deploymentInfo.network} (Chain ID: ${deploymentInfo.chainId})`);
    console.log(`📝 Contract: ${relayer.contractAddress}`);
    console.log(`🔐 Forwarder: ${relayer.forwarderAddress}`);
    console.log(`💼 Relayer: ${relayer.wallet.address}`);
  } else {
    console.log('⚠️  Blockchain: Not configured (run contract deployment)');
  }
});
