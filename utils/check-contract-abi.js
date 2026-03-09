const fs = require('fs');
const path = require('path');

const contractAbiPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TouristSafetyERC2771.sol', 'TouristSafetyERC2771.json');
const artifact = JSON.parse(fs.readFileSync(contractAbiPath, 'utf8'));

console.log('Contract ABI length:', artifact.abi.length);

// Check if isTrustedForwarder is in the ABI
const hasIsTrustedForwarder = artifact.abi.some(item => 
  item.name === 'isTrustedForwarder'
);
console.log('Contract ABI has isTrustedForwarder:', hasIsTrustedForwarder);

const hasTrustedForwarder = artifact.abi.some(item => 
  item.name === 'trustedForwarder'
);
console.log('Contract ABI has trustedForwarder:', hasTrustedForwarder);

// List all functions
const functions = artifact.abi.filter(item => item.type === 'function').map(f => f.name);
console.log('Contract functions:', functions);
