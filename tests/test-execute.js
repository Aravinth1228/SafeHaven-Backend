const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testExecute() {
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, 'blockchain-deployment.json'), 'utf8'));
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  
  const provider = new ethers.JsonRpcProvider(rpcUrl, 11155111);
  const forwarderAddress = deployment.contracts.TrustedForwarder.address;
  const contractAddress = deployment.contracts.TouristSafetyERC2771.address;
  
  // Load forwarder ABI
  const forwarderAbiPath = path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TrustedForwarder.sol', 'TrustedForwarder.json');
  const artifact = JSON.parse(fs.readFileSync(forwarderAbiPath, 'utf8'));
  
  // Create a wallet for the relayer
  const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  const forwarder = new ethers.Contract(forwarderAddress, artifact.abi, wallet);
  
  console.log('Forwarder:', forwarderAddress);
  console.log('Relayer:', wallet.address);
  
  // Create a test request (this will have an invalid signature, but we can see the error)
  const userAddress = '0x23006cfcFec2159273d5e5017a83c3D3eE1607EC';
  const registerInterface = new ethers.Interface([
    "function registerTourist(string username, string email, string phone, uint256 dateOfBirth) external returns (string)"
  ]);
  const registerData = registerInterface.encodeFunctionData('registerTourist', [
    'test', 'test@test.com', '1234567890', BigInt(Math.floor(Date.now() / 1000))
  ]);
  
  const request = {
    from: userAddress,
    to: contractAddress,
    value: 0n,
    gas: 300000n,
    nonce: 1n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    data: registerData,
    signature: '0x' + '00'.repeat(65)  // Invalid signature
  };
  
  console.log('Request:', {
    ...request,
    nonce: request.nonce.toString(),
    deadline: request.deadline.toString()
  });
  
  // Try to estimate gas (this should fail with invalid signature)
  try {
    const gasEstimate = await forwarder.execute.estimateGas(request);
    console.log('Gas estimate:', gasEstimate.toString());
  } catch (e) {
    console.error('EstimateGas error:', e.message);
    console.error('Error code:', e.code);
    console.error('Error data:', e.data);
    console.error('Short message:', e.shortMessage);
    
    // Try to decode the error
    if (e.data) {
      const errorSelector = e.data.slice(0, 10);
      console.log('Error selector:', errorSelector);
    }
  }
}

testExecute().catch(console.error);
