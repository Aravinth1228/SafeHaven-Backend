const { ethers } = require('ethers');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

async function checkUserRegistration() {
  try {
    console.log('🔍 Checking user registration on blockchain...\n');

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
    
    // Create contract instance (read-only first)
    const contract = new ethers.Contract(contractAddress, contractArtifact.abi, provider);

    // Check if contract trusts forwarder
    console.log('\n🔐 Checking contract configuration...');
    const isTrusted = await contract.isTrustedForwarder(deploymentInfo.contracts.TrustedForwarder.address);
    console.log('Contract trusts forwarder:', isTrusted);

    // Setup admin wallet to call admin functions
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);
    console.log('💼 Admin wallet:', adminWallet.address);

    // Check if admin is registered
    const isAdmin = await contract.isAdmin(adminWallet.address);
    console.log('Admin is registered:', isAdmin);

    // Create contract instance with admin wallet
    const adminContract = contract.connect(adminWallet);

    // Get all tourists
    console.log('\n📊 Getting all tourists from blockchain...');
    const allTourists = await adminContract.getAllTourists();
    console.log('Total tourists on blockchain:', allTourists.length);

    if (allTourists.length === 0) {
      console.log('\n❌ NO USERS FOUND ON BLOCKCHAIN!');
      console.log('Registration is NOT storing data on contract.');
    } else {
      console.log('\n✅ Users found on blockchain:');
      allTourists.forEach((tourist, index) => {
        console.log(`\n--- User ${index + 1} ---`);
        console.log('Tourist ID:', tourist.touristId);
        console.log('Username:', tourist.username);
        console.log('Email:', tourist.email);
        console.log('Phone:', tourist.phone);
        console.log('Date of Birth:', new Date(Number(tourist.dateOfBirth) * 1000).toISOString());
        console.log('Status:', ['Safe', 'Alert', 'Danger'][tourist.status]);
        console.log('Active:', tourist.isActive);
      });
    }

    // Get tourist count
    const count = await contract.getTouristCount();
    console.log('\n📊 Tourist count from contract:', Number(count));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkUserRegistration();
