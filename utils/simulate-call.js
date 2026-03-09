const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function simulateStaticcall() {
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, 'blockchain-deployment.json'), 'utf8'));
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  
  const provider = new ethers.JsonRpcProvider(rpcUrl, 11155111);
  const forwarderAddress = deployment.contracts.TrustedForwarder.address;
  const contractAddress = deployment.contracts.TouristSafetyERC2771.address;
  
  console.log('Forwarder:', forwarderAddress);
  console.log('Contract:', contractAddress);
  
  // The forwarder calls isTrustedForwarder(address) with the forwarder's address
  // Function selector: keccak256("isTrustedForwarder(address)")[:4]
  const interface = new ethers.Interface(['function isTrustedForwarder(address) view returns (bool)']);
  const callData = interface.encodeFunctionData('isTrustedForwarder', [forwarderAddress]);
  
  console.log('Call data:', callData);
  
  // Simulate the staticcall exactly as the forwarder would make it
  const result = await provider.call({
    to: contractAddress,
    data: callData,
    from: forwarderAddress  // The call comes from the forwarder
  });
  
  console.log('Result:', result);
  console.log('Decoded:', interface.decodeFunctionResult('isTrustedForwarder', result)[0]);
  
  // Also try without specifying 'from'
  const result2 = await provider.call({
    to: contractAddress,
    data: callData
  });
  
  console.log('Result (no from):', result2);
}

simulateStaticcall().catch(console.error);
