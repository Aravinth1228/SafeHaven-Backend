const fs = require('fs');
const path = require('path');

const forwarderAbiPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TrustedForwarder.sol', 'TrustedForwarder.json');
const artifact = JSON.parse(fs.readFileSync(forwarderAbiPath, 'utf8'));

console.log('Forwarder ABI length:', artifact.abi.length);

// Check if isTrustedForwarder is in the ABI
const hasIsTrustedForwarder = artifact.abi.some(item => 
  item.name === 'isTrustedForwarder' || item.name === 'trustedForwarder'
);
console.log('Forwarder ABI has isTrustedForwarder or trustedForwarder:', hasIsTrustedForwarder);

// List all functions
const functions = artifact.abi.filter(item => item.type === 'function').map(f => f.name);
console.log('Forwarder functions:', functions);

// Check bytecode
console.log('Bytecode length:', artifact.bytecode.length);
