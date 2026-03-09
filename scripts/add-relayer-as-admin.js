const { ethers } = require('ethers');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

async function addRelayerAsAdmin() {
  try {
    console.log('🚀 Adding relayer as admin to contract...\n');

    // Load deployment info
    const deploymentPath = path.join(__dirname, '..', 'contracts', 'scripts', 'deployment-info.json');
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    
    const contractAddress = deploymentInfo.contracts.TouristSafetyERC2771.address;
    const forwarderAddress = deploymentInfo.contracts.TrustedForwarder.address;
    
    console.log('📝 Contract:', contractAddress);
    console.log('🔗 Forwarder:', forwarderAddress);

    // Setup provider and wallet
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    const wallet = new ethers.Wallet(adminPrivateKey, provider);
    
    console.log('💼 Admin wallet:', wallet.address);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'ETH\n');

    // Load contract ABI
    const abiPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TouristSafetyERC2771.sol', 'TouristSafetyERC2771.json');
    const contractArtifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    
    // Create contract instance
    const contract = new ethers.Contract(contractAddress, contractArtifact.abi, wallet);

    // Check if relayer is already an admin
    const isRelayerAdmin = await contract.isAdmin(wallet.address);
    console.log('✅ Is relayer already an admin?', isRelayerAdmin);

    if (isRelayerAdmin) {
      console.log('\n✅ Relayer is already an admin! No action needed.');
      return;
    }

    // Add relayer as admin
    console.log('\n📝 Adding relayer as admin...');
    const tx = await contract.addAdmin(wallet.address);
    console.log('⏳ Transaction sent:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed:', receipt.hash);
    console.log('✅ Relayer is now an admin!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addRelayerAsAdmin();
