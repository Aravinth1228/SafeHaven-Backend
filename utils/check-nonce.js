const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function checkNonce() {
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, 'blockchain-deployment.json'), 'utf8'));
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  
  const provider = new ethers.JsonRpcProvider(rpcUrl, 11155111);
  const forwarderAddress = deployment.contracts.TrustedForwarder.address;
  
  // Load forwarder ABI
  const forwarderAbiPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TrustedForwarder.sol', 'TrustedForwarder.json');
  const artifact = JSON.parse(fs.readFileSync(forwarderAbiPath, 'utf8'));
  
  const forwarder = new ethers.Contract(forwarderAddress, artifact.abi, provider);
  
  // Check nonce for the user
  const userAddress = '0x23006cfcFec2159273d5e5017a83c3D3eE1607EC';
  const nonce = await forwarder.nonces(userAddress);
  
  console.log('Forwarder:', forwarderAddress);
  console.log('User:', userAddress);
  console.log('On-chain nonce:', nonce.toString());
}

checkNonce().catch(console.error);
