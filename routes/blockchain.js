const express = require('express');
const router = express.Router();
const relayer = require('../blockchain/relayer');
const { Profile, Alert, DangerZone, UserLocation, Notification } = require('../models');

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
 * Blockchain Meta-Transaction Routes
 *
 * These routes handle ERC-2771 meta-transactions:
 * - Users sign messages with MetaMask
 * - Backend verifies signatures and submits transactions
 * - Admin wallet pays gas fees
 */

/**
 * GET /api/blockchain/nonce
 * Get current nonce for a wallet address
 */
router.get('/nonce', async (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet) {
      return res.status(400).json({ success: false, error: 'Wallet address required' });
    }

    const nonce = await relayer.getNonce(wallet);
    res.json({ success: true, nonce });
  } catch (error) {
    console.error('Error getting nonce:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/status
 * Check blockchain connection status
 */
router.get('/status', async (req, res) => {
  try {
    const isInitialized = relayer.isInitialized();
    const deploymentInfo = relayer.getDeploymentInfo();
    
    res.json({
      success: true,
      initialized: isInitialized,
      network: deploymentInfo?.network || 'Not configured',
      chainId: deploymentInfo?.chainId || null,
      contractAddress: deploymentInfo?.contracts?.TouristSafetyERC2771?.address || null,
      forwarderAddress: deploymentInfo?.contracts?.TrustedForwarder?.address || null,
      relayerAddress: relayer.wallet?.address || null
    });
  } catch (error) {
    console.error('Error getting blockchain status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/is-registered/:wallet
 * Check if a wallet is registered on blockchain
 */
router.get('/is-registered/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    
    if (!relayer.isInitialized()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    const isRegistered = await relayer.isRegistered(wallet);
    const touristInfo = isRegistered ? await relayer.getTourist(wallet) : null;

    res.json({
      success: true,
      isRegistered,
      tourist: touristInfo
    });
  } catch (error) {
    console.error('Error checking registration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/tourist/:wallet
 * Get tourist info from blockchain
 */
router.get('/tourist/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    
    if (!relayer.isInitialized()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    const tourist = await relayer.getTourist(wallet);
    
    if (!tourist) {
      return res.status(404).json({ success: false, error: 'Tourist not found' });
    }

    res.json({ success: true, data: tourist });
  } catch (error) {
    console.error('Error getting tourist info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/meta-tx
 * Submit a meta-transaction for processing
 *
 * Body:
 * - action: 'register' | 'updateStatus' | 'updateLocation'
 * - wallet: User's wallet address
 * - signature: EIP-712 signature (required for 'register' only)
 * - message: Signed message data
 *
 * Note: 
 * - 'register': Uses blockchain + MongoDB
 * - 'updateStatus': MongoDB only (no blockchain)
 * - 'updateLocation': MongoDB only (no blockchain)
 */
router.post('/meta-tx', async (req, res) => {
  try {
    const { action, wallet, signature, message } = req.body;

    // Validate input
    if (!action || !wallet || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: action, wallet, message'
      });
    }

    // Signature is only required for 'register' action
    if (action === 'register' && !signature) {
      return res.status(400).json({
        success: false,
        error: 'Signature required for registration'
      });
    }

    // Check if blockchain is initialized (only required for 'register' action)
    if (action === 'register' && !relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized. Please deploy contracts first.',
        blockchainEnabled: false
      });
    }

    let result;

    switch (action) {
      case 'register':
        result = await relayer.registerTourist(wallet, message, signature);

        // Also save to MongoDB for faster queries and additional data
        try {
          const { ethers } = require('ethers');
          
          // Decode the registration data to extract user info
          const registerInterface = new ethers.Interface([
            "function registerTourist(string username, string email, string phone, uint256 dateOfBirth) external returns (string)"
          ]);
          const decoded = registerInterface.decodeFunctionData('registerTourist', message.data);
          
          console.log('📝 Decoded registration data:', {
            username: decoded.username,
            email: decoded.email,
            phone: decoded.phone,
            dateOfBirth: decoded.dateOfBirth.toString()
          });

          await Profile.findOneAndUpdate(
            { wallet_address: wallet },
            {
              wallet_address: wallet,
              tourist_id: result.touristId || message.touristId,
              username: decoded.username,
              email: decoded.email,
              phone: decoded.phone,
              dob: new Date(Number(decoded.dateOfBirth) * 1000).toISOString(),
              status: 'safe',
              updated_at: new Date()
            },
            { upsert: true, new: true }
          );
          console.log('✅ MongoDB profile created/updated for:', wallet);
        } catch (dbErr) {
          console.error('⚠️ Failed to save MongoDB profile:', dbErr.message);
          // Don't fail the request if MongoDB save fails
        }
        break;

      case 'updateStatus':
        // Handle both blockchain meta-transaction AND direct MongoDB update
        try {
          // Check if this is a blockchain meta-transaction (has signature in request body)
          const isBlockchainTx = !!signature;
          
          let status;
          
          if (isBlockchainTx) {
            // Blockchain sends status as number (0=safe, 1=alert, 2=danger)
            const statusMap = {
              '0': 'safe',
              '1': 'alert',
              '2': 'danger'
            };
            // For blockchain tx, status comes from decoded data
            const { ethers } = require('ethers');
            const updateInterface = new ethers.Interface([
              "function updateStatus(uint8 status) external"
            ]);
            const decoded = updateInterface.decodeFunctionData('updateStatus', message.data);
            status = statusMap[decoded.status.toString()] || 'safe';
            console.log('📝 Blockchain status update decoded:', status);
          } else {
            // Direct MongoDB update (status as string)
            status = message.status;
          }
          
          if (!status || !['safe', 'alert', 'danger'].includes(status)) {
            return res.status(400).json({
              success: false,
              error: 'Invalid status. Must be: safe, alert, or danger'
            });
          }

          // Find profile by wallet address
          let profile = await Profile.findOne({ wallet_address: wallet });

          if (profile) {
            await Profile.findByIdAndUpdate(profile._id, {
              status: status,
              updated_at: new Date()
            });
            console.log('✅ MongoDB status updated for:', wallet, 'Status:', status);
          } else {
            // Profile doesn't exist - create it
            const newProfile = await Profile.create({
              wallet_address: wallet,
              tourist_id: message.touristId || `TID-${Date.now()}`,
              username: message.username || `User-${wallet.substring(0, 6)}`,
              email: message.email || '',
              phone: message.phone || '',
              dob: message.dateOfBirth ? new Date(Number(message.dateOfBirth) * 1000).toISOString() : null,
              status: status,
              created_at: new Date(),
              updated_at: new Date()
            });
            console.log('✅ MongoDB profile created for:', wallet, 'Status:', status);
          }

          // Create alert if status is alert/danger
          if (status === 'alert' || status === 'danger') {
            const profileData = await Profile.findOne({ wallet_address: wallet });
            await Alert.create({
              user_id: profileData?.user_id || 'unknown',
              tourist_id: profileData?.tourist_id || 'unknown',
              username: profileData?.username || `User-${wallet.substring(0, 6)}`,
              status: status,
              alert_type: 'status_change',
            });
          }

          // If blockchain transaction, execute it
          let result;
          if (isBlockchainTx) {
            result = await relayer.updateStatus(wallet, message, signature);
            console.log('✅ Blockchain status update confirmed');
          } else {
            result = { success: true, message: 'Status updated in MongoDB' };
          }
          
          return res.json({
            success: true,
            data: result,
            blockchainEnabled: isBlockchainTx
          });
        } catch (dbErr) {
          console.error('❌ Failed to update status:', dbErr.message);
          throw new Error(`Status update failed: ${dbErr.message}`);
        }
        break;

      case 'updateLocation':
        // MongoDB-only location update (no blockchain call)
        try {
          const { lat, lng, status, tourist_id, user_id, username } = message;

          if (lat === undefined || lng === undefined) {
            return res.status(400).json({
              success: false,
              error: 'Latitude and longitude are required'
            });
          }

          // Upsert location in MongoDB
          await UserLocation.findOneAndUpdate(
            { wallet_address: wallet },
            {
              wallet_address: wallet,
              user_id: user_id || `user-${Date.now()}`,
              tourist_id: tourist_id || `TID-${Date.now()}`,
              lat: Number(lat),
              lng: Number(lng),
              status: status || 'safe',
              updated_at: new Date()
            },
            { upsert: true }
          );
          console.log('✅ MongoDB location updated for:', wallet, 'Lat:', lat, 'Lng:', lng);

          // Update profile status if provided
          if (status) {
            await Profile.findOneAndUpdate(
              { wallet_address: wallet },
              { status, updated_at: new Date() }
            );
          }

          // Check if user is in danger zone (from MongoDB)
          const zones = await DangerZone.find();
          for (const zone of zones) {
            const distance = calculateDistance(Number(lat), Number(lng), zone.lat, zone.lng);

            // User entered danger zone
            if (distance <= zone.radius) {
              const existingAlert = await Alert.findOne({
                user_id,
                zone_name: zone.name,
                alert_type: 'entered_danger_zone',
                dismissed: false
              });

              if (!existingAlert) {
                await Alert.create({
                  user_id: user_id || 'unknown',
                  tourist_id: tourist_id || 'unknown',
                  username: username || `User-${wallet.substring(0, 6)}`,
                  status: 'danger',
                  alert_type: 'entered_danger_zone',
                  lat: Number(lat),
                  lng: Number(lng),
                  zone_name: zone.name,
                  zone_level: zone.level,
                });

                // Update profile status to danger
                await Profile.findOneAndUpdate(
                  { wallet_address: wallet },
                  { status: 'danger', updated_at: new Date() }
                );

                console.log('🚨 User entered danger zone:', zone.name);
              }
            }
            // User is within 200m of danger zone (proximity alert)
            else if (distance <= 200 && distance > zone.radius) {
              const existingProximityAlert = await Alert.findOne({
                user_id,
                zone_name: zone.name,
                alert_type: 'near_danger_zone',
                dismissed: false
              });

              if (!existingProximityAlert) {
                await Alert.create({
                  user_id: user_id || 'unknown',
                  tourist_id: tourist_id || 'unknown',
                  username: username || `User-${wallet.substring(0, 6)}`,
                  status: 'alert',
                  alert_type: 'near_danger_zone',
                  lat: Number(lat),
                  lng: Number(lng),
                  zone_name: zone.name,
                  zone_level: zone.level,
                });
                console.log('⚠️ User within 200m of danger zone:', zone.name);
              }
            }
          }

          result = { success: true, message: 'Location updated in MongoDB' };
        } catch (dbErr) {
          console.error('❌ Failed to update MongoDB location:', dbErr.message);
          throw new Error(`MongoDB update failed: ${dbErr.message}`);
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Invalid action: ${action}. Valid actions: register, updateStatus, updateLocation`
        });
    }

    res.json({
      success: true,
      data: result,
      blockchainEnabled: true
    });

  } catch (error) {
    console.error('Meta-transaction error:', error);
    
    // Handle specific error types
    if (error.message.includes('Invalid signature')) {
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }
    if (error.message.includes('expired')) {
      return res.status(400).json({ success: false, error: 'Signature expired. Please try again.' });
    }
    if (error.message.includes('nonce')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.message.includes('Already registered')) {
      return res.status(400).json({ success: false, error: 'Wallet already registered' });
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/register-and-sync
 * Register on blockchain and sync with MongoDB
 * This is a convenience endpoint that handles both blockchain and DB registration
 */
router.post('/register-and-sync', async (req, res) => {
  try {
    const { 
      wallet, 
      signature, 
      message,
      user_id 
    } = req.body;

    if (!relayer.isInitialized()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    // Register on blockchain
    const blockchainResult = await relayer.registerTourist(wallet, message, signature);
    
    // Also save to MongoDB for faster queries and additional data
    const profile = await Profile.findOneAndUpdate(
      { wallet_address: wallet },
      {
        wallet_address: wallet,
        tourist_id: blockchainResult.touristId || message.touristId,
        username: message.username,
        email: message.email,
        phone: message.phone,
        dob: new Date(parseInt(message.dateOfBirth) * 1000).toISOString(),
        status: 'safe',
        updated_at: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      data: {
        blockchain: blockchainResult,
        profile
      },
      blockchainEnabled: true
    });

  } catch (error) {
    console.error('Register and sync error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/deployment-info
 * Get contract deployment information
 */
router.get('/deployment-info', async (req, res) => {
  try {
    const deploymentInfo = relayer.getDeploymentInfo();

    if (!deploymentInfo) {
      return res.status(404).json({ success: false, error: 'Deployment info not found' });
    }

    res.json({ success: true, data: deploymentInfo });
  } catch (error) {
    console.error('Error getting deployment info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/danger-zone
 * Create danger zone on blockchain and sync to MongoDB
 */
router.post('/danger-zone', async (req, res) => {
  try {
    const { name, lat, lng, radius, level, created_by, signature, message } = req.body;

    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    // Create danger zone on blockchain via meta-transaction
    let blockchainResult;
    if (signature && message) {
      blockchainResult = await relayer.createDangerZone(created_by, message, signature);
    }

    // Save to MongoDB
    const zone = await DangerZone.create({ 
      name, 
      lat, 
      lng, 
      radius, 
      level, 
      created_by,
      blockchain_zone_id: blockchainResult?.zoneId,
      blockchain_tx_hash: blockchainResult?.txHash
    });

    // Check if any users are inside or near this new zone
    const users = await UserLocation.find();
    const notifications = [];
    const updatedUsers = [];

    for (const user of users) {
      const distance = calculateDistance(user.lat, user.lng, lat, lng);

      // If user is INSIDE the danger zone
      if (distance <= radius) {
        await Profile.findOneAndUpdate(
          { user_id: user.user_id },
          { status: 'danger', updated_at: new Date() }
        );

        await Alert.create({
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
      data: zone,
      blockchain: blockchainResult,
      notifications: notifications.length,
      emergencyUsers: updatedUsers.length,
      emergencyUsernames: updatedUsers
    });

  } catch (error) {
    console.error('Create danger zone error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/delete-tourist
 * Delete a tourist from blockchain (admin only)
 */
router.post('/delete-tourist', async (req, res) => {
  try {
    const { wallet_address, admin_wallet } = req.body;

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

    // Check if tourist exists on blockchain first
    try {
      const touristExists = await relayer.isRegistered(wallet_address);
      if (!touristExists) {
        console.log('⚠️ Tourist not found on blockchain, deleting from MongoDB only:', wallet_address);
        // Delete from MongoDB only
        await Profile.findOneAndDelete({ wallet_address });
        return res.json({
          success: true,
          message: 'Tourist deleted from MongoDB only (not found on blockchain)',
          blockchainDeleted: false,
          mongodbDeleted: true
        });
      }
    } catch (checkErr) {
      console.warn('⚠️ Could not check tourist registration:', checkErr.message);
      // Continue with delete attempt
    }

    // Call deleteTourist on contract using admin wallet
    try {
      const result = await relayer.deleteTourist(wallet_address);
      console.log('✅ Delete transaction confirmed:', result.txHash);

      // Delete from MongoDB as well
      await Profile.findOneAndDelete({ wallet_address });

      res.json({
        success: true,
        message: 'Tourist deleted from blockchain',
        transactionHash: result.txHash,
        blockchainDeleted: true,
        mongodbDeleted: true
      });
    } catch (deleteErr) {
      console.error('❌ Blockchain delete failed:', deleteErr.message);
      
      // If tourist not found on blockchain, delete from MongoDB only
      if (deleteErr.message.includes('Tourist not found')) {
        await Profile.findOneAndDelete({ wallet_address });
        return res.json({
          success: true,
          message: 'Tourist deleted from MongoDB only (not found on blockchain)',
          blockchainDeleted: false,
          mongodbDeleted: true
        });
      }
      
      throw deleteErr;
    }

  } catch (error) {
    console.error('Delete tourist error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
