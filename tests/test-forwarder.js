const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testForwarder() {
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, 'blockchain-deployment.json'), 'utf8'));
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  
  const provider = new ethers.JsonRpcProvider(rpcUrl, 11155111);
  const forwarderAddress = deployment.contracts.TrustedForwarder.address;
  const contractAddress = deployment.contracts.TouristSafetyERC2771.address;
  
  // Load forwarder ABI
  const forwarderAbiPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TrustedForwarder.sol', 'TrustedForwarder.json');
  const artifact = JSON.parse(fs.readFileSync(forwarderAbiPath, 'utf8'));
  
  const forwarder = new ethers.Contract(forwarderAddress, artifact.abi, provider);
  
  console.log('Forwarder:', forwarderAddress);
  console.log('Target:', contractAddress);
  
  // Try calling verify function (which calls _isTrustedByTarget internally)
  // We need to construct a minimal request
  const request = {
    from: '0x0000000000000000000000000000000000000000',
    to: contractAddress,
    value: 0,
    gas: 100000,
    nonce: 0,
    deadline: Math.floor(Date.now() / 1000) + 3600,
    data: '0x',
    signature: '0x'
  };
  
  try {
    const isValid = await forwarder.verify(request);
    console.log('verify() result:', isValid);
  } catch (e) {
    console.error('verify() error:', e.message);
    // This might fail due to invalid signature, but we can see if it's a trust issue
  }
  
  // Also check the forwarder's owner
  try {
    const owner = await forwarder.owner();
    console.log('Forwarder owner:', owner);
  } catch (e) {
    console.error('owner() error:', e.message);
  }
}

testForwarder().catch(console.error);
