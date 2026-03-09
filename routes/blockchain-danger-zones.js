const express = require('express');
const router = express.Router();
const relayer = require('../blockchain/relayer');
const { Profile, Alert, UserLocation, Notification } = require('../models');
const { ethers } = require('ethers');

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
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

/**
 * Blockchain-Only Danger Zone Routes
 *
 * These routes manage danger zones stored ONLY on blockchain:
 * - GET /api/blockchain/danger-zones - Get all danger zones from blockchain
 * - POST /api/blockchain/danger-zones - Create danger zone on blockchain
 * - DELETE /api/blockchain/danger-zones/:index - Remove danger zone from blockchain
 * - GET /api/blockchain/danger-zones/active - Get active danger zones only
 */

/**
 * GET /api/blockchain/danger-zones
 * Get all danger zones from blockchain (ACTIVE ONLY)
 */
router.get('/', async (req, res) => {
  try {
    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    // Get ALL danger zones from blockchain (including inactive ones for proper indexing)
    const allZones = await relayer.getAllDangerZones();

    // Level enum mapping (0=Low, 1=Medium, 2=High, 3=Critical)
    const levelNames = ['Low', 'Medium', 'High', 'Critical'];

    // Filter only active zones but keep ORIGINAL blockchain index
    const formattedZones = allZones
      .map((zone, blockchainIndex) => ({
        zone,
        blockchainIndex // Store the original blockchain index
      }))
      .filter(item => item.zone.isActive) // Filter only active zones
      .map(item => ({
        id: item.zone.zoneId || `zone-${item.blockchainIndex}`,
        blockchainIndex: item.blockchainIndex, // ORIGINAL blockchain index (for delete/update)
        zoneId: item.zone.zoneId,
        name: item.zone.name,
        lat: Number(item.zone.latitude) / 1e6,
        lng: Number(item.zone.longitude) / 1e6,
        radius: Number(item.zone.radius),
        level: levelNames[parseInt(item.zone.level)] || 'Medium',
        createdBy: item.zone.createdBy,
        createdAt: new Date(Number(item.zone.createdAt) * 1000),
        isActive: true
      }));

    console.log('📊 Active danger zones:', formattedZones.length, 'Total zones on chain:', allZones.length);

    res.json({
      success: true,
      data: formattedZones,
      blockchainEnabled: true,
      count: formattedZones.length
    });

  } catch (error) {
    console.error('Error getting danger zones from blockchain:', error);
    
    // If timeout or RPC error, return empty array with warning
    if (error.message && (error.message.includes('timeout') || error.message.includes('RPC'))) {
      return res.json({
        success: true,
        data: [],
        blockchainEnabled: true,
        count: 0,
        warning: 'Blockchain RPC timeout - please try again or check your RPC connection'
      });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/danger-zones/active
 * Get only active danger zones from blockchain
 */
router.get('/active', async (req, res) => {
  try {
    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    // Get active danger zones from blockchain
    const zones = await relayer.getActiveDangerZones();

    // Level enum mapping (0=Low, 1=Medium, 2=High, 3=Critical)
    const levelNames = ['Low', 'Medium', 'High', 'Critical'];

    // Format zones for frontend
    const formattedZones = zones.map((zone, index) => ({
      id: zone.zoneId || `zone-${index}`,
      blockchainIndex: index,
      zoneId: zone.zoneId,
      name: zone.name,
      lat: Number(zone.latitude) / 1e6,
      lng: Number(zone.longitude) / 1e6,
      radius: Number(zone.radius),
      level: levelNames[parseInt(zone.level)] || 'Medium',
      createdBy: zone.createdBy,
      createdAt: new Date(Number(zone.createdAt) * 1000),
      isActive: zone.isActive
    }));

    res.json({
      success: true,
      data: formattedZones,
      blockchainEnabled: true,
      count: formattedZones.length
    });

  } catch (error) {
    console.error('Error getting active danger zones:', error);
    
    // If timeout or RPC error, return empty array with warning
    if (error.message && (error.message.includes('timeout') || error.message.includes('RPC'))) {
      return res.json({
        success: true,
        data: [],
        blockchainEnabled: true,
        count: 0,
        warning: 'Blockchain RPC timeout - please try again or check your RPC connection'
      });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/danger-zones
 * Create danger zone on blockchain (NO MongoDB storage)
 */
router.post('/', async (req, res) => {
  try {
    const { name, lat, lng, radius, level, created_by, signature, message } = req.body;

    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    // Validate input
    if (!name || lat === undefined || lng === undefined || !radius || !level) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, lat, lng, radius, level'
      });
    }

    // Convert coordinates to int256 * 1e6 format for blockchain
    const latInt = Math.round(lat * 1e6);
    const lngInt = Math.round(lng * 1e6);

    // Convert level string to enum number (Low=0, Medium=1, High=2, Critical=3)
    const levelEnum = { 'Low': 0, 'Medium': 1, 'High': 2, 'Critical': 3 }[level] || 1;

    // Create danger zone on blockchain via meta-transaction
    let blockchainResult;
    if (signature && message) {
      blockchainResult = await relayer.createDangerZone(created_by, message, signature);
    } else {
      // Direct creation (admin wallet signs)
      blockchainResult = await relayer.createDangerZoneDirect(
        created_by,
        name,
        latInt,
        lngInt,
        radius,
        levelEnum
      );
    }

    // Check if any users are inside or near this new zone (for notifications only)
    const users = await UserLocation.find();
    const notifications = [];
    const updatedUsers = [];
    const emergencyAlerts = [];

    for (const user of users) {
      const distance = calculateDistance(user.lat, user.lng, lat, lng);

      // If user is INSIDE the danger zone
      if (distance <= radius) {
        // Update profile status to DANGER
        await Profile.findOneAndUpdate(
          { user_id: user.user_id },
          { status: 'danger', updated_at: new Date() }
        );

        // Create emergency alert in MongoDB (for display purposes)
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
          blockchain_zone_id: blockchainResult?.zoneId,
          blockchain_tx_hash: blockchainResult?.txHash
        });
        emergencyAlerts.push(alert);

        // Send emergency notification
        const notification = await Notification.create({
          tourist_id: user.tourist_id,
          user_id: user.user_id,
          admin_wallet: created_by || 'admin',
          message: `🚨 EMERGENCY! You are inside danger zone "${name}". Exit immediately!`,
          notification_type: 'danger',
        });
        notifications.push(notification);
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
        id: blockchainResult?.zoneId,
        blockchainIndex: blockchainResult?.zoneIndex,
        zoneId: blockchainResult?.zoneId,
        name,
        lat,
        lng,
        radius,
        level,
        createdBy: created_by,
        isActive: true
      },
      blockchain: {
        txHash: blockchainResult?.txHash,
        blockNumber: blockchainResult?.blockNumber,
        zoneId: blockchainResult?.zoneId
      },
      notifications: notifications.length,
      emergencyUsers: updatedUsers.length,
      emergencyUsernames: updatedUsers,
      blockchainEnabled: true,
      message: 'Danger zone created on blockchain only (not stored in MongoDB)'
    });

  } catch (error) {
    console.error('Create danger zone error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/blockchain/danger-zones/:index
 * Remove danger zone from blockchain (marks as inactive)
 */
router.delete('/:index', async (req, res) => {
  try {
    const { index } = req.params;

    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    // Use relayer wallet (which should be an admin)
    const adminWallet = relayer.getRelayerAddress();

    if (!adminWallet) {
      return res.status(500).json({
        success: false,
        error: 'Relayer wallet not available'
      });
    }

    console.log('🗑️ Deleting danger zone at index:', index);
    console.log('Admin wallet (relayer):', adminWallet);

    // First check if zone exists (even if inactive)
    let zone;
    try {
      zone = await relayer.contract.dangerZones(parseInt(index));
      console.log('Zone info from contract:', {
        zoneId: zone.zoneId,
        name: zone.name,
        isActive: zone.isActive
      });
    } catch (contractErr) {
      console.error('Error fetching zone from contract:', contractErr);
      return res.status(404).json({
        success: false,
        error: `Danger zone at index ${index} does not exist`
      });
    }

    if (!zone || !zone.zoneId) {
      return res.status(404).json({
        success: false,
        error: `Danger zone at index ${index} not found`
      });
    }

    if (!zone.isActive) {
      console.log('⚠️  Zone already inactive (idempotent delete)');
      // Zone already inactive - return success anyway (idempotent delete)
      return res.json({
        success: true,
        data: {
          blockchainIndex: parseInt(index),
          removed: true,
          alreadyInactive: true
        },
        message: 'Danger zone was already removed (idempotent delete)'
      });
    }

    // Remove danger zone from blockchain
    const result = await relayer.removeDangerZone(adminWallet, parseInt(index));

    res.json({
      success: true,
      data: {
        blockchainIndex: parseInt(index),
        removed: true,
        alreadyInactive: false
      },
      blockchain: {
        txHash: result?.txHash,
        blockNumber: result?.blockNumber
      },
      blockchainEnabled: true,
      message: 'Danger zone removed from blockchain'
    });

  } catch (error) {
    console.error('Remove danger zone error:', error);
    
    // Handle "already inactive" error gracefully (idempotent delete)
    if (error.message && error.message.includes('already inactive')) {
      return res.json({
        success: true,
        data: {
          blockchainIndex: parseInt(req.params.index),
          removed: true,
          alreadyInactive: true
        },
        message: 'Danger zone was already removed (idempotent delete)'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.reason || error.shortMessage || 'Unknown blockchain error'
    });
  }
});

/**
 * PUT /api/blockchain/danger-zones/:index
 * Update danger zone on blockchain
 */
router.put('/:index', async (req, res) => {
  try {
    const { index } = req.params;
    const { name, radius, level, created_by } = req.body;

    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    // Validate input
    if (!name || !radius || !level) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, radius, level'
      });
    }

    // Use relayer wallet (which should be an admin)
    const adminWallet = relayer.getRelayerAddress();

    if (!adminWallet) {
      return res.status(500).json({
        success: false,
        error: 'Relayer wallet not available'
      });
    }

    console.log('📝 Updating danger zone at index:', index);
    console.log('Update data:', { name, radius, level });

    // Convert level string to enum number (Low=0, Medium=1, High=2, Critical=3)
    const levelEnum = { 'Low': 0, 'Medium': 1, 'High': 2, 'Critical': 3 }[level] || 1;

    // Update danger zone on blockchain
    const result = await relayer.updateDangerZone(
      adminWallet,
      parseInt(index),
      name,
      radius,
      levelEnum
    );

    // Update MongoDB if zone exists there too (for consistency)
    try {
      const { DangerZone } = require('../models');
      const zone = await DangerZone.findOne({ blockchain_zone_id: `ZONE-${parseInt(index) + 1}` });
      if (zone) {
        zone.name = name;
        zone.radius = radius;
        zone.level = level;
        await zone.save();
        console.log('✅ MongoDB zone updated');
      }
    } catch (mongoErr) {
      console.log('⚠️  MongoDB update skipped (zone may not exist in MongoDB)');
    }

    res.json({
      success: true,
      data: {
        blockchainIndex: parseInt(index),
        name,
        radius,
        level,
        updated: true
      },
      blockchain: {
        txHash: result?.txHash,
        blockNumber: result?.blockNumber
      },
      blockchainEnabled: true,
      message: 'Danger zone updated on blockchain'
    });

  } catch (error) {
    console.error('Update danger zone error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.reason || error.shortMessage || 'Unknown blockchain error'
    });
  }
});

/**
 * GET /api/blockchain/danger-zones/count
 * Get total number of danger zones
 */
router.get('/count', async (req, res) => {
  try {
    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    const count = await relayer.getDangerZoneCount();

    res.json({
      success: true,
      data: { count },
      blockchainEnabled: true
    });

  } catch (error) {
    console.error('Error getting danger zone count:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/danger-zones/:index
 * Get specific danger zone by index
 */
router.get('/:index', async (req, res) => {
  try {
    const { index } = req.params;

    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    const zone = await relayer.getDangerZoneByIndex(parseInt(index));

    if (!zone || !zone.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Danger zone not found or inactive'
      });
    }

    const formattedZone = {
      id: zone.zoneId || `zone-${index}`,
      blockchainIndex: parseInt(index),
      zoneId: zone.zoneId,
      name: zone.name,
      lat: Number(zone.latitude) / 1e6,
      lng: Number(zone.longitude) / 1e6,
      radius: Number(zone.radius),
      level: zone.level,
      createdBy: zone.createdBy,
      createdAt: new Date(Number(zone.createdAt) * 1000),
      isActive: zone.isActive
    };

    res.json({
      success: true,
      data: formattedZone,
      blockchainEnabled: true
    });

  } catch (error) {
    console.error('Error getting danger zone:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/danger-zones/delete-tourist
 * Delete a tourist from blockchain (admin only)
 */
router.post('/delete-tourist', async (req, res) => {
  try {
    const { wallet_address } = req.body;

    if (!wallet_address) {
      return res.status(400).json({ success: false, error: 'Wallet address required' });
    }

    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    console.log('🗑️ Deleting tourist from blockchain:', wallet_address);

    // Call deleteTourist on contract using relayer wallet (admin)
    const result = await relayer.deleteTourist(wallet_address);

    console.log('✅ Delete transaction confirmed:', result.txHash);

    // Delete from MongoDB as well
    await Profile.findOneAndDelete({ wallet_address });

    res.json({
      success: true,
      message: 'Tourist deleted from blockchain',
      transactionHash: result.txHash
    });

  } catch (error) {
    console.error('Delete tourist error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
