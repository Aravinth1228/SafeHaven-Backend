const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function debugTrust() {
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, 'blockchain-deployment.json'), 'utf8'));
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  
  const provider = new ethers.JsonRpcProvider(rpcUrl, 11155111);
  const forwarderAddress = deployment.contracts.TrustedForwarder.address;
  const contractAddress = deployment.contracts.TouristSafetyERC2771.address;
  
  // Load ABIs
  const forwarderAbiPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TrustedForwarder.sol', 'TrustedForwarder.json');
  const contractAbiPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TouristSafetyERC2771.sol', 'TouristSafetyERC2771.json');
  
  const forwarderArtifact = JSON.parse(fs.readFileSync(forwarderAbiPath, 'utf8'));
  const contractArtifact = JSON.parse(fs.readFileSync(contractAbiPath, 'utf8'));
  
  const forwarder = new ethers.Contract(forwarderAddress, forwarderArtifact.abi, provider);
  const contract = new ethers.Contract(contractAddress, contractArtifact.abi, provider);
  
  console.log('Forwarder:', forwarderAddress);
  console.log('Contract:', contractAddress);
  
  // 1. Check trustedForwarder() on contract
  const tf = await contract.trustedForwarder();
  console.log('\n1. contract.trustedForwarder():', tf);
  console.log('   Match:', tf.toLowerCase() === forwarderAddress.toLowerCase());
  
  // 2. Check isTrustedForwarder(forwarder) on contract
  const isTrusted = await contract.isTrustedForwarder(forwarderAddress);
  console.log('\n2. contract.isTrustedForwarder(forwarder):', isTrusted);
  
  // 3. Check isTrustedForwarder with the returned trustedForwarder
  const isTrusted2 = await contract.isTrustedForwarder(tf);
  console.log('\n3. contract.isTrustedForwarder(trustedForwarder()):', isTrusted2);
  
  // 4. Manually encode the call and use eth_call
  const interface = new ethers.Interface(['function isTrustedForwarder(address) view returns (bool)']);
  const data = interface.encodeFunctionData('isTrustedForwarder', [forwarderAddress]);
  
  const result = await provider.call({
    to: contractAddress,
    data: data
  });
  
  console.log('\n4. eth_call result:', result);
  console.log('   Decoded:', interface.decodeFunctionResult('isTrustedForwarder', result)[0]);
  
  // 5. Check forwarder's view of the target
  console.log('\n5. Checking forwarder internals...');
  
  // Get the EIP712 domain separator from the forwarder
  try {
    const domain = await forwarder.eip712Domain();
    console.log('   Forwarder domain:', domain);
  } catch (e) {
    console.error('   eip712Domain() error:', e.message);
  }
}

debugTrust().catch(console.error);
