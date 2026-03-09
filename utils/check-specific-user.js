const { ethers } = require('ethers');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

async function checkSpecificUser() {
  try {
    console.log('🔍 Checking specific user registration...\n');

    // Load deployment info
    const deploymentPath = path.join(__dirname, '..', 'contracts', 'scripts', 'deployment-info.json');
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    
    const contractAddress = deploymentInfo.contracts.TouristSafetyERC2771.address;
    console.log('📝 Contract:', contractAddress);

    // Setup provider
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Load contract ABI
    const abiPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TouristSafetyERC2771.sol', 'TouristSafetyERC2771.json');
    const contractArtifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    
    // Create contract instance
    const contract = new ethers.Contract(contractAddress, contractArtifact.abi, provider);

    // Ask for wallet address
    const walletAddress = process.argv[2];
    if (!walletAddress) {
      console.log('Usage: node check-specific-user.js <wallet-address>');
      console.log('\nExample: node check-specific-user.js 0x23006cfcFec2159273d5e5017a83c3D3eE1607EC');
      return;
    }

    console.log('🔍 Checking wallet:', walletAddress);

    // Check if registered
    const isRegistered = await contract.isRegistered(walletAddress);
    console.log('\n✅ Is registered:', isRegistered);

    if (isRegistered) {
      const tourist = await contract.getTourist(walletAddress);
      console.log('\n📋 User Details:');
      console.log('Tourist ID:', tourist.touristId);
      console.log('Username:', tourist.username);
      console.log('Email:', tourist.email);
      console.log('Phone:', tourist.phone);
      console.log('Date of Birth:', new Date(Number(tourist.dateOfBirth) * 1000).toISOString());
      console.log('Status:', ['Safe', 'Alert', 'Danger'][tourist.status]);
      console.log('Active:', tourist.isActive);
      console.log('Last Latitude:', Number(tourist.lastLatitude) / 1e6);
      console.log('Last Longitude:', Number(tourist.lastLongitude) / 1e6);
    } else {
      console.log('\n❌ User NOT registered on blockchain');
      console.log('Please complete the registration process.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSpecificUser();
