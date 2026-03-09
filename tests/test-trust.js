const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testTrust() {
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, 'blockchain-deployment.json'), 'utf8'));
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  
  const provider = new ethers.JsonRpcProvider(rpcUrl, 11155111);
  const contractAddress = deployment.contracts.TouristSafetyERC2771.address;
  const forwarderAddress = deployment.contracts.TrustedForwarder.address;
  
  // Load contract ABI
  const abiPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TouristSafetyERC2771.sol', 'TouristSafetyERC2771.json');
  const artifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  
  const contract = new ethers.Contract(contractAddress, artifact.abi, provider);
  
  console.log('Contract:', contractAddress);
  console.log('Forwarder:', forwarderAddress);
  
  // Test trustedForwarder()
  const tf = await contract.trustedForwarder();
  console.log('trustedForwarder():', tf);
  console.log('Match:', tf.toLowerCase() === forwarderAddress.toLowerCase());
  
  // Test isTrustedForwarder(forwarder)
  const isTrusted = await contract.isTrustedForwarder(forwarderAddress);
  console.log('isTrustedForwarder(forwarder):', isTrusted);
  
  // Also try calling it with the exact address format
  const isTrusted2 = await contract.isTrustedForwarder(tf);
  console.log('isTrustedForwarder(trustedForwarder()):', isTrusted2);
}

testTrust().catch(console.error);
