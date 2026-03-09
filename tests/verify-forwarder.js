const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function verify() {
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, 'blockchain-deployment.json'), 'utf8'));
  console.log('Deployment info:', JSON.stringify(deployment, null, 2));
  
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  console.log('\nUsing RPC:', rpcUrl);
  
  const provider = new ethers.JsonRpcProvider(rpcUrl, 11155111);
  
  const contractAddress = deployment.contracts.TouristSafetyERC2771.address;
  const forwarderAddress = deployment.contracts.TrustedForwarder.address;
  
  console.log('\nContract:', contractAddress);
  console.log('Forwarder:', forwarderAddress);
  
  // Load contract ABI
  const abiPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TouristSafetyERC2771.sol', 'TouristSafetyERC2771.json');
  const artifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  
  // Create contract instance
  const contract = new ethers.Contract(contractAddress, artifact.abi, provider);
  
  try {
    console.log('\n🔍 Calling trustedForwarder() on contract...');
    const trustedForwarder = await contract.trustedForwarder();
    console.log('✅ Contract trustedForwarder():', trustedForwarder);
    console.log('✅ Match:', trustedForwarder.toLowerCase() === forwarderAddress.toLowerCase());
    
    if (trustedForwarder.toLowerCase() !== forwarderAddress.toLowerCase()) {
      console.log('\n❌ MISMATCH! The contract was deployed with a different forwarder!');
      console.log('Expected:', forwarderAddress);
      console.log('Got:', trustedForwarder);
    }
  } catch (e) {
    console.error('❌ Error calling trustedForwarder():', e.message);
  }
  
  // Also check isTrustedForwarder directly
  try {
    console.log('\n🔍 Calling isTrustedForwarder(forwarderAddress)...');
    const isTrusted = await contract.isTrustedForwarder(forwarderAddress);
    console.log('✅ isTrustedForwarder result:', isTrusted);
  } catch (e) {
    console.error('❌ Error calling isTrustedForwarder():', e.message);
  }
  
  process.exit(0);
}

setTimeout(() => {
  console.log('Timeout - network request taking too long');
  process.exit(1);
}, 15000);

verify().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
