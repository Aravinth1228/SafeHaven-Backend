const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function verifyDomain() {
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, 'blockchain-deployment.json'), 'utf8'));
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  
  const provider = new ethers.JsonRpcProvider(rpcUrl, 11155111);
  const forwarderAddress = deployment.contracts.TrustedForwarder.address;
  
  // Load forwarder ABI
  const forwarderAbiPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TrustedForwarder.sol', 'TrustedForwarder.json');
  const artifact = JSON.parse(fs.readFileSync(forwarderAbiPath, 'utf8'));
  
  const forwarder = new ethers.Contract(forwarderAddress, artifact.abi, provider);
  
  // Get the EIP712 domain from the contract
  const domain = await forwarder.eip712Domain();
  console.log('On-chain EIP712 Domain:');
  console.log('  Name:', domain.name);
  console.log('  Version:', domain.version);
  console.log('  Chain ID:', domain.chainId.toString());
  console.log('  Verifying Contract:', domain.verifyingContract);
  
  // Expected domain for signing
  console.log('\nExpected domain for signing:');
  console.log('  Name: SafeHeaven Trusted Forwarder');
  console.log('  Version: 1');
  console.log('  Chain ID: 11155111');
  console.log('  Verifying Contract:', forwarderAddress);
  
  // Check match
  const nameMatch = domain.name === 'SafeHeaven Trusted Forwarder';
  const versionMatch = domain.version === '1';
  const chainIdMatch = domain.chainId.toString() === '11155111';
  const addressMatch = domain.verifyingContract.toLowerCase() === forwarderAddress.toLowerCase();
  
  console.log('\nDomain verification:');
  console.log('  Name match:', nameMatch);
  console.log('  Version match:', versionMatch);
  console.log('  Chain ID match:', chainIdMatch);
  console.log('  Address match:', addressMatch);
  console.log('  All match:', nameMatch && versionMatch && chainIdMatch && addressMatch);
}

verifyDomain().catch(console.error);
