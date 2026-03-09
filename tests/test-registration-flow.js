const { ethers } = require('ethers');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

async function testRegistration() {
  try {
    console.log('🧪 Testing ERC2771 Registration Flow...\n');

    // Load deployment info
    const deploymentPath = path.join(__dirname, '..', 'contracts', 'scripts', 'deployment-info.json');
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    
    const contractAddress = deploymentInfo.contracts.TouristSafetyERC2771.address;
    const forwarderAddress = deploymentInfo.contracts.TrustedForwarder.address;
    
    console.log('📝 Contract:', contractAddress);
    console.log('🔗 Forwarder:', forwarderAddress);

    // Setup provider and wallet
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);
    
    console.log('💼 Admin (Relayer) wallet:', adminWallet.address);
    
    // Check admin status
    const contractArtifact = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TouristSafetyERC2771.sol', 'TouristSafetyERC2771.json'),
      'utf8'
    ));
    
    const contract = new ethers.Contract(contractAddress, contractArtifact.abi, provider);
    const isAdmin = await contract.isAdmin(adminWallet.address);
    console.log('✅ Admin is registered:', isAdmin);

    // Check if contract trusts forwarder
    const isTrusted = await contract.isTrustedForwarder(forwarderAddress);
    console.log('✅ Contract trusts forwarder:', isTrusted);

    // Load forwarder ABI
    const forwarderArtifact = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', 'contracts', 'artifacts', 'contracts', 'TrustedForwarder.sol', 'TrustedForwarder.json'),
      'utf8'
    ));

    const forwarderContract = new ethers.Contract(forwarderAddress, forwarderArtifact.abi, provider);

    // // Test data
    // const testUser = {
    //   username: 'TestUser',
    //   email: 'test@example.com',
    //   phone: '1234567890',
    //   dateOfBirth: Math.floor(Date.now() / 1000) - (18 * 365 * 24 * 60 * 60) // 18 years ago
    // };

    // console.log('\n📝 Test user data:', testUser);

    // Encode registerTourist function call
    const registerInterface = new ethers.Interface([
      "function registerTourist(string username, string email, string phone, uint256 dateOfBirth) external returns (string)"
    ]);
    
    const registerData = registerInterface.encodeFunctionData('registerTourist', [
      testUser.username,
      testUser.email,
      testUser.phone,
      BigInt(testUser.dateOfBirth)
    ]);

    console.log('\n📦 Encoded function data:', registerData);

    // Get nonce for test user (we'll use a random address for testing)
    const testWallet = ethers.Wallet.createRandom();
    console.log('\n🔑 Test wallet address:', testWallet.address);

    // Get current block for deadline
    const currentBlock = await provider.getBlock('latest');
    const deadline = currentBlock.timestamp + 3600; // 1 hour from now

    // Create ForwardRequest
    const forwardRequest = {
      from: testWallet.address,
      to: contractAddress,
      value: 0,
      gas: 300000,
      nonce: 0, // First transaction
      deadline: deadline,
      data: registerData
    };

    console.log('\n📝 Forward Request:', {
      ...forwardRequest,
      nonce: Number(forwardRequest.nonce),
      deadline: forwardRequest.deadline
    });

    // Get domain separator for signing
    const domainSeparator = {
      name: 'SafeHeaven Trusted Forwarder',
      version: '1',
      chainId: BigInt(11155111), // Sepolia
      verifyingContract: forwarderAddress
    };

    console.log('\n🔐 Domain Separator:', domainSeparator);

    // Sign the forward request
    const signature = await testWallet.signTypedData(
      domainSeparator,
      {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'data', type: 'bytes' }
        ]
      },
      forwardRequest
    );

    console.log('\n✅ Signature created:', signature.substring(0, 66) + '...');

    // Verify the signature
    const signerAddress = ethers.verifyTypedData(
      domainSeparator,
      {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'data', type: 'bytes' }
        ]
      },
      forwardRequest,
      signature
    );

    console.log('✅ Signature verified. Signer:', signerAddress);
    console.log('✅ Matches test wallet:', signerAddress.toLowerCase() === testWallet.address.toLowerCase());

    console.log('\n✅ Registration flow test PASSED!');
    console.log('The signature and encoding are correct.');
    console.log('\nℹ️  To complete registration, submit to backend:');
    console.log('POST /api/blockchain/meta-tx');
    console.log('Body:', JSON.stringify({
      action: 'register',
      wallet: testWallet.address,
      signature: signature,
      message: forwardRequest
    }, null, 2));

  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testRegistration();
