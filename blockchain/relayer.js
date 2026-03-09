const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Use the updated ABI from frontend (includes deleteTourist function)
const TOURIST_SAFETY_ABI = [
  {"inputs":[{"internalType":"address","name":"trustedForwarder","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"admin","type":"address"},{"indexed":false,"internalType":"address","name":"addedBy","type":"address"}],"name":"AdminAdded","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"admin","type":"address"},{"indexed":false,"internalType":"address","name":"removedBy","type":"address"}],"name":"AdminRemoved","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"alertId","type":"string"},{"indexed":false,"internalType":"address","name":"dismissedBy","type":"address"}],"name":"AlertDismissed","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"zoneId","type":"string"},{"indexed":false,"internalType":"string","name":"name","type":"string"},{"indexed":false,"internalType":"int256","name":"latitude","type":"int256"},{"indexed":false,"internalType":"int256","name":"longitude","type":"int256"},{"indexed":false,"internalType":"uint256","name":"radius","type":"uint256"},{"indexed":false,"internalType":"enum TouristSafetyERC2771.ZoneLevel","name":"level","type":"uint8"},{"indexed":false,"internalType":"address","name":"createdBy","type":"address"}],"name":"DangerZoneCreated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"zoneId","type":"string"},{"indexed":false,"internalType":"address","name":"removedBy","type":"address"}],"name":"DangerZoneRemoved","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"zoneId","type":"string"},{"indexed":false,"internalType":"string","name":"name","type":"string"},{"indexed":false,"internalType":"uint256","name":"radius","type":"uint256"},{"indexed":false,"internalType":"enum TouristSafetyERC2771.ZoneLevel","name":"level","type":"uint8"}],"name":"DangerZoneUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"alertId","type":"string"},{"indexed":true,"internalType":"address","name":"tourist","type":"address"},{"indexed":false,"internalType":"string","name":"touristId","type":"string"},{"indexed":false,"internalType":"enum TouristSafetyERC2771.SafetyStatus","name":"status","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"EmergencyAlertCreated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"tourist","type":"address"},{"indexed":false,"internalType":"string","name":"touristId","type":"string"},{"indexed":false,"internalType":"int256","name":"latitude","type":"int256"},{"indexed":false,"internalType":"int256","name":"longitude","type":"int256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"LocationUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"tourist","type":"address"},{"indexed":false,"internalType":"string","name":"touristId","type":"string"},{"indexed":false,"internalType":"enum TouristSafetyERC2771.SafetyStatus","name":"oldStatus","type":"uint8"},{"indexed":false,"internalType":"enum TouristSafetyERC2771.SafetyStatus","name":"newStatus","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"StatusUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"wallet","type":"address"},{"indexed":false,"internalType":"string","name":"touristId","type":"string"},{"indexed":false,"internalType":"string","name":"username","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TouristRegistered","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"tourist","type":"address"},{"indexed":false,"internalType":"string","name":"touristId","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TouristDeleted","type":"event"},
  {"inputs":[{"internalType":"address","name":"_admin","type":"address"}],"name":"addAdmin","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"admins","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"alertCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"alerts","outputs":[{"internalType":"string","name":"alertId","type":"string"},{"internalType":"address","name":"tourist","type":"address"},{"internalType":"string","name":"touristId","type":"string"},{"internalType":"enum TouristSafetyERC2771.SafetyStatus","name":"status","type":"uint8"},{"internalType":"int256","name":"latitude","type":"int256"},{"internalType":"int256","name":"longitude","type":"int256"},{"internalType":"string","name":"zoneName","type":"string"},{"internalType":"enum TouristSafetyERC2771.ZoneLevel","name":"zoneLevel","type":"uint8"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"bool","name":"isDismissed","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"string","name":"_name","type":"string"},{"internalType":"int256","name":"_latitude","type":"int256"},{"internalType":"int256","name":"_longitude","type":"int256"},{"internalType":"uint256","name":"_radius","type":"uint256"},{"internalType":"enum TouristSafetyERC2771.ZoneLevel","name":"_level","type":"uint8"}],"name":"createDangerZone","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"dangerZones","outputs":[{"internalType":"string","name":"zoneId","type":"string"},{"internalType":"string","name":"name","type":"string"},{"internalType":"int256","name":"latitude","type":"int256"},{"internalType":"int256","name":"longitude","type":"int256"},{"internalType":"uint256","name":"radius","type":"uint256"},{"internalType":"enum TouristSafetyERC2771.ZoneLevel","name":"level","type":"uint8"},{"internalType":"address","name":"createdBy","type":"address"},{"internalType":"uint256","name":"createdAt","type":"uint256"},{"internalType":"bool","name":"isActive","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"_tourist","type":"address"}],"name":"deleteTourist","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_alertIndex","type":"uint256"}],"name":"dismissAlert","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"getAllDangerZones","outputs":[{"components":[{"internalType":"string","name":"zoneId","type":"string"},{"internalType":"string","name":"name","type":"string"},{"internalType":"int256","name":"latitude","type":"int256"},{"internalType":"int256","name":"longitude","type":"int256"},{"internalType":"uint256","name":"radius","type":"uint256"},{"internalType":"enum TouristSafetyERC2771.ZoneLevel","name":"level","type":"uint8"},{"internalType":"address","name":"createdBy","type":"address"},{"internalType":"uint256","name":"createdAt","type":"uint256"},{"internalType":"bool","name":"isActive","type":"bool"}],"internalType":"struct TouristSafetyERC2771.DangerZone[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"getActiveDangerZones","outputs":[{"components":[{"internalType":"string","name":"zoneId","type":"string"},{"internalType":"string","name":"name","type":"string"},{"internalType":"int256","name":"latitude","type":"int256"},{"internalType":"int256","name":"longitude","type":"int256"},{"internalType":"uint256","name":"radius","type":"uint256"},{"internalType":"enum TouristSafetyERC2771.ZoneLevel","name":"level","type":"uint8"},{"internalType":"address","name":"createdBy","type":"address"},{"internalType":"uint256","name":"createdAt","type":"uint256"},{"internalType":"bool","name":"isActive","type":"bool"}],"internalType":"struct TouristSafetyERC2771.DangerZone[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"getAllAlerts","outputs":[{"components":[{"internalType":"string","name":"alertId","type":"string"},{"internalType":"address","name":"tourist","type":"address"},{"internalType":"string","name":"touristId","type":"string"},{"internalType":"enum TouristSafetyERC2771.SafetyStatus","name":"status","type":"uint8"},{"internalType":"int256","name":"latitude","type":"int256"},{"internalType":"int256","name":"longitude","type":"int256"},{"internalType":"string","name":"zoneName","type":"string"},{"internalType":"enum TouristSafetyERC2771.ZoneLevel","name":"zoneLevel","type":"uint8"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"bool","name":"isDismissed","type":"bool"}],"internalType":"struct TouristSafetyERC2771.EmergencyAlert[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"getActiveAlerts","outputs":[{"components":[{"internalType":"string","name":"alertId","type":"string"},{"internalType":"address","name":"tourist","type":"address"},{"internalType":"string","name":"touristId","type":"string"},{"internalType":"enum TouristSafetyERC2771.SafetyStatus","name":"status","type":"uint8"},{"internalType":"int256","name":"latitude","type":"int256"},{"internalType":"int256","name":"longitude","type":"int256"},{"internalType":"string","name":"zoneName","type":"string"},{"internalType":"enum TouristSafetyERC2771.ZoneLevel","name":"zoneLevel","type":"uint8"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"bool","name":"isDismissed","type":"bool"}],"internalType":"struct TouristSafetyERC2771.EmergencyAlert[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"_wallet","type":"address"}],"name":"getTourist","outputs":[{"components":[{"internalType":"string","name":"touristId","type":"string"},{"internalType":"string","name":"username","type":"string"},{"internalType":"string","name":"email","type":"string"},{"internalType":"string","name":"phone","type":"string"},{"internalType":"uint256","name":"dateOfBirth","type":"uint256"},{"internalType":"enum TouristSafetyERC2771.SafetyStatus","name":"status","type":"uint8"},{"internalType":"uint256","name":"registeredAt","type":"uint256"},{"internalType":"bool","name":"isActive","type":"bool"},{"internalType":"int256","name":"lastLatitude","type":"int256"},{"internalType":"int256","name":"lastLongitude","type":"int256"},{"internalType":"uint256","name":"lastLocationUpdate","type":"uint256"}],"internalType":"struct TouristSafetyERC2771.Tourist","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"string","name":"_touristId","type":"string"}],"name":"getTouristById","outputs":[{"components":[{"internalType":"string","name":"touristId","type":"string"},{"internalType":"string","name":"username","type":"string"},{"internalType":"string","name":"email","type":"string"},{"internalType":"string","name":"phone","type":"string"},{"internalType":"uint256","name":"dateOfBirth","type":"uint256"},{"internalType":"enum TouristSafetyERC2771.SafetyStatus","name":"status","type":"uint8"},{"internalType":"uint256","name":"registeredAt","type":"uint256"},{"internalType":"bool","name":"isActive","type":"bool"},{"internalType":"int256","name":"lastLatitude","type":"int256"},{"internalType":"int256","name":"lastLongitude","type":"int256"},{"internalType":"uint256","name":"lastLocationUpdate","type":"uint256"}],"internalType":"struct TouristSafetyERC2771.Tourist","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isAdmin","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"_wallet","type":"address"}],"name":"isRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"forwarder","type":"address"}],"name":"isTrustedForwarder","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"components":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"gas","type":"uint256"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint48","name":"deadline","type":"uint48"},{"internalType":"bytes","name":"data","type":"bytes"}],"internalType":"struct ERC2771Forwarder.ForwardRequest","name":"req","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"registerTouristMeta","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"string","name":"_username","type":"string"},{"internalType":"string","name":"_email","type":"string"},{"internalType":"string","name":"_phone","type":"string"},{"internalType":"uint256","name":"_dateOfBirth","type":"uint256"}],"name":"registerTourist","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"tourists","outputs":[{"internalType":"string","name":"touristId","type":"string"},{"internalType":"string","name":"username","type":"string"},{"internalType":"string","name":"email","type":"string"},{"internalType":"string","name":"phone","type":"string"},{"internalType":"uint256","name":"dateOfBirth","type":"uint256"},{"internalType":"enum TouristSafetyERC2771.SafetyStatus","name":"status","type":"uint8"},{"internalType":"uint256","name":"registeredAt","type":"uint256"},{"internalType":"bool","name":"isActive","type":"bool"},{"internalType":"int256","name":"lastLatitude","type":"int256"},{"internalType":"int256","name":"lastLongitude","type":"int256"},{"internalType":"uint256","name":"lastLocationUpdate","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"trustedForwarder","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"components":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"gas","type":"uint256"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint48","name":"deadline","type":"uint48"},{"internalType":"bytes","name":"data","type":"bytes"}],"internalType":"struct ERC2771Forwarder.ForwardRequest","name":"req","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"updateLocationMeta","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"int256","name":"_latitude","type":"int256"},{"internalType":"int256","name":"_longitude","type":"int256"}],"name":"updateLocation","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"components":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"gas","type":"uint256"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint48","name":"deadline","type":"uint48"},{"internalType":"bytes","name":"data","type":"bytes"}],"internalType":"struct ERC2771Forwarder.ForwardRequest","name":"req","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"updateStatusMeta","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"enum TouristSafetyERC2771.SafetyStatus","name":"_status","type":"uint8"}],"name":"updateStatus","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"components":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"gas","type":"uint256"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint48","name":"deadline","type":"uint48"},{"internalType":"bytes","name":"data","type":"bytes"}],"internalType":"struct ERC2771Forwarder.ForwardRequest","name":"req","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"verify","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"string","name":"_zoneId","type":"string"},{"internalType":"string","name":"_name","type":"string"},{"internalType":"uint256","name":"_radius","type":"uint256"},{"internalType":"enum TouristSafetyERC2771.ZoneLevel","name":"_level","type":"uint8"}],"name":"updateDangerZone","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_zoneIndex","type":"uint256"}],"name":"removeDangerZone","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

/**
 * Blockchain Relayer Service
 * 
 * This service handles ERC-2771 meta-transactions:
 * 1. Verifies user signatures
 * 2. Submits transactions to the blockchain using admin wallet (pays gas)
 * 3. Tracks nonces for each user
 */
class BlockchainRelayer {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.forwarderContract = null;
    this.deploymentInfo = null;
    this.contractAddress = null;
    this.forwarderAddress = null;
    this.nonces = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const deploymentPath = path.join(__dirname, '..', 'blockchain-deployment.json');
      if (!fs.existsSync(deploymentPath)) {
        console.log('⚠️  Blockchain deployment info not found. Run contract deployment first.');
        return;
      }

      this.deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      console.log('📄 Loaded deployment info:', this.deploymentInfo.network);

      let rpcUrl;
      if (this.deploymentInfo.network === 'localhost' || this.deploymentInfo.network === 'hardhat') {
        rpcUrl = 'http://127.0.0.1:8545';
      } else if (this.deploymentInfo.network === 'sepolia') {
        rpcUrl = process.env.SEPOLIA_RPC_URL ||
                 'https://ethereum-sepolia-rpc.publicnode.com' ||
                 'https://sepolia.drpc.org' ||
                 'https://rpc.sepolia.org' ||
                 `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
      } else if (this.deploymentInfo.network === 'mainnet') {
        rpcUrl = process.env.MAINNET_RPC_URL ||
                 'https://ethereum-rpc.publicnode.com' ||
                 'https://eth.llamarpc.com' ||
                 `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
      }

      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
      if (!adminPrivateKey) {
        throw new Error('ADMIN_PRIVATE_KEY not set in environment');
      }
      this.wallet = new ethers.Wallet(adminPrivateKey, this.provider);
      console.log('✅ Relayer wallet:', this.wallet.address);

      // Use the hardcoded ABI (includes deleteTourist function)
      this.contractAddress = this.deploymentInfo.contracts.TouristSafetyERC2771.address;
      this.contract = new ethers.Contract(this.contractAddress, TOURIST_SAFETY_ABI, this.wallet);
      console.log('✅ Contract loaded:', this.contractAddress);

      const forwarderAbiPath = path.join(__dirname, '..', '..', 'contracts', 'artifacts', 'contracts', 'TrustedForwarder.sol', 'TrustedForwarder.json');
      console.log('🔍 Looking for forwarder ABI at:', forwarderAbiPath);
      console.log('🔍 Forwarder ABI exists:', fs.existsSync(forwarderAbiPath));

      if (fs.existsSync(forwarderAbiPath)) {
        const forwarderArtifact = JSON.parse(fs.readFileSync(forwarderAbiPath, 'utf8'));
        this.forwarderAddress = this.deploymentInfo.contracts.TrustedForwarder.address;
        this.forwarderContract = new ethers.Contract(this.forwarderAddress, forwarderArtifact.abi, this.wallet);
        console.log('✅ Forwarder contract loaded:', this.forwarderAddress);
      } else {
        console.error('❌ Forwarder ABI not found at:', forwarderAbiPath);
      }

      const noncesPath = path.join(__dirname, 'nonces.json');
      if (fs.existsSync(noncesPath)) {
        const savedNonces = JSON.parse(fs.readFileSync(noncesPath, 'utf8'));
        Object.entries(savedNonces).forEach(([address, nonce]) => {
          this.nonces.set(address.toLowerCase(), nonce);
        });
      }

      this.initialized = true;
      console.log('✅ Blockchain Relayer initialized');
      console.log('📝 Contract:', this.contractAddress);
      console.log('🔗 Forwarder:', this.forwarderAddress);

    } catch (error) {
      console.error('❌ Failed to initialize blockchain relayer:', error.message);
      this.initialized = false;
    }
  }

  async getNonce(walletAddress) {
    if (!this.forwarderContract) {
      const normalizedAddress = walletAddress.toLowerCase();
      if (!this.nonces.has(normalizedAddress)) {
        this.nonces.set(normalizedAddress, 0);
      }
      return this.nonces.get(normalizedAddress);
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const onChainNonce = await this.forwarderContract.nonces(normalizedAddress);
    const nonceNum = Number(onChainNonce);
    console.log(`🔢 getNonce for ${normalizedAddress}: on-chain=${nonceNum}`);
    return nonceNum;
  }

  getLocalNonce(walletAddress) {
    const normalizedAddress = walletAddress.toLowerCase();
    if (!this.nonces.has(normalizedAddress)) {
      this.nonces.set(normalizedAddress, 0);
    }
    return this.nonces.get(normalizedAddress);
  }

  incrementNonce(walletAddress) {
    const normalizedAddress = walletAddress.toLowerCase();
    const currentNonce = this.getLocalNonce(normalizedAddress);
    this.nonces.set(normalizedAddress, currentNonce + 1);
    this.saveNonces();
    return this.nonces.get(normalizedAddress);
  }

  saveNonces() {
    try {
      const noncesPath = path.join(__dirname, 'nonces.json');
      const noncesObj = {};
      this.nonces.forEach((nonce, address) => {
        noncesObj[address] = nonce;
      });
      fs.writeFileSync(noncesPath, JSON.stringify(noncesObj, null, 2));
    } catch (error) {
      console.error('Failed to save nonces:', error);
    }
  }

  /**
   * Get EIP-712 domain separator
   * IMPORTANT: OpenZeppelin ERC2771Forwarder uses hardcoded name "ERC2771Forwarder"
   */
  getDomainSeparator() {
    return {
      name: 'ERC2771Forwarder',
      version: '1',
      chainId: this.deploymentInfo.chainId,  // Number from JSON
      verifyingContract: this.deploymentInfo.contracts.TrustedForwarder.address
    };
  }

  /**
   * Build correctly typed ForwardRequest for EIP-712 verification
   * CRITICAL: uint256 fields must be BigInt, uint48 (deadline) must be Number
   */
  buildTypedForwardRequest(forwardRequest) {
    return {
      from: forwardRequest.from,
      to: forwardRequest.to,
      value: BigInt(forwardRequest.value || '0'),
      gas: BigInt(forwardRequest.gas || '300000'),
      nonce: BigInt(forwardRequest.nonce),
      deadline: Number(forwardRequest.deadline),  // uint48 = Number
      data: forwardRequest.data
    };
  }

  /**
   * EIP-712 ForwardRequest type definition
   */
  getForwardRequestTypes() {
    return {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint48" },
        { name: "data", type: "bytes" }
      ]
    };
  }

  async registerTourist(walletAddress, forwardRequest, signature) {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    console.log('📝 Register tourist request:', {
      wallet: walletAddress,
      from: forwardRequest.from,
      to: forwardRequest.to,
      nonce: forwardRequest.nonce,
      deadline: forwardRequest.deadline
    });

    // Check if wallet is already registered on-chain
    const isRegistered = await this.isRegistered(walletAddress);
    if (isRegistered) {
      console.log('⚠️ Wallet already registered:', walletAddress);
      const touristInfo = await this.getTourist(walletAddress);
      throw new Error(`Already registered with Tourist ID: ${touristInfo?.touristId || 'N/A'}`);
    }

    // Check deadline
    const deadline = BigInt(forwardRequest.deadline);
    const currentBlock = await this.provider.getBlock('latest');
    console.log('⏰ Checking deadline:', {
      deadline: Number(deadline),
      currentBlock: currentBlock.timestamp,
      expired: deadline < currentBlock.timestamp
    });

    if (deadline < currentBlock.timestamp) {
      throw new Error('Signature expired');
    }

    // Check nonce
    const expectedNonce = await this.getNonce(walletAddress);
    console.log('🔢 Checking nonce:', {
      expected: expectedNonce,
      received: Number(forwardRequest.nonce)
    });

    const localNonce = this.getLocalNonce(walletAddress);
    if (localNonce > expectedNonce) {
      console.log('⚠️ Local nonce ahead of on-chain, resetting:', { local: localNonce, onChain: expectedNonce });
      this.nonces.set(walletAddress.toLowerCase(), expectedNonce);
    }

    if (BigInt(forwardRequest.nonce) !== BigInt(expectedNonce)) {
      throw new Error(`Invalid nonce. Expected ${expectedNonce}, got ${forwardRequest.nonce}`);
    }

    try {
      console.log('📦 Forward request data:', forwardRequest.data);
      console.log('📝 Forwarder contract object:', this.forwarderContract ? 'exists' : 'NULL/UNDEFINED');
      console.log('📝 Forwarder address:', this.forwarderAddress);
      console.log('📝 Contract address:', this.contractAddress);
      console.log('💰 Relayer balance:', await this.provider.getBalance(this.wallet.address));

      if (!this.forwarderContract) {
        throw new Error('Forwarder contract not loaded! Check initialization.');
      }

      // Double-check registration
      console.log('🔍 Checking if wallet is already registered on-chain...');
      const isAlreadyRegistered = await this.isRegistered(forwardRequest.from);
      if (isAlreadyRegistered) {
        console.log('⚠️ Wallet already registered:', forwardRequest.from);
        const touristInfo = await this.getTourist(forwardRequest.from);
        throw new Error(`Wallet already registered with Tourist ID: ${touristInfo?.touristId || 'N/A'}. Please login instead.`);
      }
      console.log('✅ Wallet is not registered, proceeding with registration');

      // ✅ FIXED: Verify signature with correctly typed message
      console.log('🔐 Verifying signature...');
      const domain = this.getDomainSeparator();
      const types = this.getForwardRequestTypes();

      // CRITICAL: Reconstruct with proper JS types matching EIP-712 encoding
      // uint256 fields → BigInt, uint48 (deadline) → Number
      const typedMessage = this.buildTypedForwardRequest(forwardRequest);

      console.log('🌐 Domain:', JSON.stringify(domain));
      console.log('📋 Typed message for verification:', {
        from: typedMessage.from,
        to: typedMessage.to,
        value: typedMessage.value.toString(),
        gas: typedMessage.gas.toString(),
        nonce: typedMessage.nonce.toString(),
        deadline: typedMessage.deadline,
        data: typedMessage.data?.substring(0, 20) + '...'
      });
      
      // DEBUG: Log chainId being used
      console.log('🔐 Backend chainId:', domain.chainId);
      console.log('🔐 Forwarder address:', domain.verifyingContract);

      const recoveredSigner = ethers.verifyTypedData(domain, types, typedMessage, signature);
      console.log('🔐 Recovered signer:', recoveredSigner);
      console.log('🔐 Expected signer:', forwardRequest.from);
      
      // DEBUG: Check if chainId matches
      console.log('🔐 Signature chainId should match backend chainId:', domain.chainId);

      if (recoveredSigner.toLowerCase() !== forwardRequest.from.toLowerCase()) {
        console.error('❌ SIGNATURE MISMATCH! This is usually caused by chainId mismatch.');
        console.error('Frontend might be signing with different chainId than backend.');
        throw new Error(`Invalid signature: recovered ${recoveredSigner}, expected ${forwardRequest.from}. Check chainId!`);
      }
      console.log('✅ Signature verified successfully');

      // Verify the target contract trusts the forwarder
      try {
        console.log('🔐 Checking if target trusts forwarder...');
        const isTrusted = await this.contract.isTrustedForwarder(this.forwarderAddress);
        console.log('🔐 Target contract trusts forwarder:', isTrusted);
        if (!isTrusted) {
          throw new Error(`Target contract ${this.contractAddress} does not trust forwarder ${this.forwarderAddress}`);
        }
      } catch (trustErr) {
        console.error('❌ Trust verification failed:', trustErr.message);
        throw trustErr;
      }

      // ✅ FIXED: Execute request with correct types for ethers v6
      const request = {
        from: forwardRequest.from,
        to: forwardRequest.to,
        value: BigInt(forwardRequest.value || '0'),
        gas: BigInt(forwardRequest.gas || '300000'),
        nonce: BigInt(expectedNonce),
        deadline: Number(deadline),
        data: forwardRequest.data,
        signature: signature
      };

      console.log('🔐 Executing forward request...');
      console.log('📤 Executing forwarder transaction...');

      // Gas estimation
      try {
        const gasEstimate = await this.forwarderContract.execute.estimateGas(request);
        console.log('⛽ Gas estimate:', gasEstimate.toString());
      } catch (gasErr) {
        console.error('❌ Gas estimation failed:', gasErr.message);

        let helpfulMessage = 'Transaction would revert. ';
        if (forwardRequest.data?.startsWith('0x959ed9d2')) {
          const isReg = await this.isRegistered(forwardRequest.from);
          if (isReg) helpfulMessage = 'Wallet already registered on blockchain. ';
        }

        console.error(helpfulMessage);
        throw new Error(helpfulMessage + gasErr.message);
      }

      const tx = await this.forwarderContract.execute(request);
      console.log('📝 Transaction sent:', tx.hash);

      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt.hash, 'Block:', receipt.blockNumber);

      this.incrementNonce(walletAddress);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        touristId: this.extractTouristIdFromReceipt(receipt)
      };

    } catch (error) {
      console.error('❌ Transaction failed:', error);
      console.error('Error details:', {
        reason: error.reason,
        code: error.code,
        error: error.error
      });
      throw new Error(`Transaction failed: ${error.reason || error.message}`);
    }
  }

  async updateStatus(walletAddress, forwardRequest, signature) {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    console.log('📝 Update status request:', {
      wallet: walletAddress,
      from: forwardRequest.from,
      nonce: forwardRequest.nonce,
      deadline: forwardRequest.deadline
    });

    const isRegistered = await this.isRegistered(walletAddress);
    if (!isRegistered) {
      throw new Error('User not registered on blockchain. Please register first.');
    }
    console.log('✅ User is registered:', walletAddress);

    const deadline = BigInt(forwardRequest.deadline);
    const currentBlock = await this.provider.getBlock('latest');
    if (deadline < currentBlock.timestamp) {
      throw new Error('Signature expired');
    }

    const expectedNonce = await this.getNonce(walletAddress);
    const localNonce = this.getLocalNonce(walletAddress);
    if (localNonce > expectedNonce) {
      this.nonces.set(walletAddress.toLowerCase(), expectedNonce);
    }

    if (BigInt(forwardRequest.nonce) !== BigInt(expectedNonce)) {
      throw new Error(`Invalid nonce. Expected ${expectedNonce}, got ${forwardRequest.nonce}`);
    }

    try {
      // ✅ FIXED: Correct types for ethers v6
      const request = {
        from: forwardRequest.from,
        to: forwardRequest.to,
        value: BigInt(forwardRequest.value || '0'),
        gas: BigInt(forwardRequest.gas || '150000'),
        nonce: BigInt(expectedNonce),
        deadline: Number(deadline),
        data: forwardRequest.data,
        signature: signature
      };

      console.log('📤 Executing update status via forwarder...');

      try {
        const gasEstimate = await this.forwarderContract.execute.estimateGas(request);
        console.log('⛽ Gas estimate:', gasEstimate.toString());
      } catch (gasErr) {
        console.error('❌ Gas estimation failed:', gasErr.message);
        throw gasErr;
      }

      const tx = await this.forwarderContract.execute(request);
      console.log('📝 Update status tx:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt.hash);

      this.incrementNonce(walletAddress);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error('❌ Update status transaction failed:', error);
      throw new Error(`Transaction failed: ${error.reason || error.message}`);
    }
  }

  async updateLocation(walletAddress, forwardRequest, signature) {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    const deadline = BigInt(forwardRequest.deadline);
    const currentBlock = await this.provider.getBlock('latest');
    if (deadline < currentBlock.timestamp) {
      throw new Error('Signature expired');
    }

    const expectedNonce = await this.getNonce(walletAddress);
    const localNonce = this.getLocalNonce(walletAddress);
    if (localNonce > expectedNonce) {
      this.nonces.set(walletAddress.toLowerCase(), expectedNonce);
    }

    if (BigInt(forwardRequest.nonce) !== BigInt(expectedNonce)) {
      throw new Error(`Invalid nonce. Expected ${expectedNonce}, got ${forwardRequest.nonce}`);
    }

    try {
      // ✅ FIXED: Correct types for ethers v6
      const request = {
        from: forwardRequest.from,
        to: forwardRequest.to,
        value: BigInt(forwardRequest.value || '0'),
        gas: BigInt(forwardRequest.gas || '100000'),
        nonce: BigInt(expectedNonce),
        deadline: Number(deadline),
        data: forwardRequest.data,
        signature: signature
      };

      const tx = await this.forwarderContract.execute(request);
      console.log('📝 Update location tx:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt.hash);

      this.incrementNonce(walletAddress);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error('Transaction failed:', error);
      throw new Error(`Transaction failed: ${error.reason || error.message}`);
    }
  }

  async isRegistered(walletAddress) {
    if (!this.initialized) throw new Error('Blockchain relayer not initialized');
    try {
      return await this.contract.isRegistered(walletAddress);
    } catch (error) {
      console.error('Error checking registration:', error);
      return false;
    }
  }

  async getTourist(walletAddress) {
    if (!this.initialized) throw new Error('Blockchain relayer not initialized');
    try {
      const tourist = await this.contract.getTourist(walletAddress);
      if (!tourist.isActive) return null;
      return {
        touristId: tourist.touristId,
        username: tourist.username,
        email: tourist.email,
        phone: tourist.phone,
        dateOfBirth: tourist.dateOfBirth.toString(),
        status: Number(tourist.status),
        registeredAt: tourist.registeredAt.toString(),
        isActive: tourist.isActive,
        lastLatitude: tourist.lastLatitude.toString(),
        lastLongitude: tourist.lastLongitude.toString(),
        lastLocationUpdate: tourist.lastLocationUpdate.toString()
      };
    } catch (error) {
      console.error('Error getting tourist info:', error);
      return null;
    }
  }

  extractTouristIdFromReceipt(receipt) {
    try {
      const contractInterface = this.contract.interface;
      for (const log of receipt.logs) {
        try {
          const parsed = contractInterface.parseLog(log);
          if (parsed && parsed.name === 'TouristRegistered') {
            return parsed.args.touristId;
          }
        } catch { continue; }
      }
    } catch (error) {
      console.error('Error extracting tourist ID:', error);
    }
    return null;
  }

  getDeploymentInfo() {
    return this.deploymentInfo;
  }

  isInitialized() {
    return this.initialized;
  }

  async createDangerZone(adminAddress, forwardRequest, signature) {
    if (!this.initialized) throw new Error('Blockchain relayer not initialized');

    const deadline = BigInt(forwardRequest.deadline);
    const currentBlock = await this.provider.getBlock('latest');
    if (deadline < currentBlock.timestamp) throw new Error('Signature expired');

    const expectedNonce = await this.getNonce(adminAddress);
    if (BigInt(forwardRequest.nonce) !== BigInt(expectedNonce)) {
      throw new Error(`Invalid nonce. Expected ${expectedNonce}, got ${forwardRequest.nonce}`);
    }

    try {
      // ✅ FIXED: Correct types
      const request = {
        from: forwardRequest.from,
        to: forwardRequest.to,
        value: BigInt(forwardRequest.value || '0'),
        gas: BigInt(forwardRequest.gas || '300000'),
        nonce: BigInt(expectedNonce),
        deadline: Number(deadline),
        data: forwardRequest.data,
        signature: signature
      };

      console.log('📤 Creating danger zone on blockchain...');
      const tx = await this.forwarderContract.execute(request);
      console.log('📝 Danger zone tx:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Danger zone transaction confirmed:', receipt.hash);

      this.incrementNonce(adminAddress);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        zoneId: this.extractZoneIdFromReceipt(receipt)
      };
    } catch (error) {
      console.error('Danger zone transaction failed:', error);
      throw new Error(`Transaction failed: ${error.reason || error.message}`);
    }
  }

  extractZoneIdFromReceipt(receipt) {
    try {
      const contractInterface = this.contract.interface;
      for (const log of receipt.logs) {
        try {
          const parsed = contractInterface.parseLog(log);
          if (parsed && parsed.name === 'DangerZoneCreated') {
            return parsed.args.zoneId;
          }
        } catch { continue; }
      }
    } catch (error) {
      console.error('Error extracting zone ID:', error);
    }
    return null;
  }

  async getAllDangerZones() {
    if (!this.initialized) throw new Error('Blockchain relayer not initialized');
    try {
      // Add timeout handling for slow RPC connections
      const zones = await Promise.race([
        this.contract.getAllDangerZones(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Blockchain RPC timeout (30s)')), 30000)
        )
      ]);
      return zones.map(zone => ({
        zoneId: zone.zoneId,
        name: zone.name,
        latitude: zone.latitude.toString(),
        longitude: zone.longitude.toString(),
        radius: zone.radius.toString(),
        level: zone.level.toString(),
        createdBy: zone.createdBy,
        createdAt: zone.createdAt.toString(),
        isActive: zone.isActive
      }));
    } catch (error) {
      console.error('Error getting all danger zones:', error);
      throw error;
    }
  }

  async getActiveDangerZones() {
    if (!this.initialized) throw new Error('Blockchain relayer not initialized');
    try {
      // Add timeout handling for slow RPC connections
      const zones = await Promise.race([
        this.contract.getActiveDangerZones(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Blockchain RPC timeout (30s)')), 30000)
        )
      ]);
      return zones.map(zone => ({
        zoneId: zone.zoneId,
        name: zone.name,
        latitude: zone.latitude.toString(),
        longitude: zone.longitude.toString(),
        radius: zone.radius.toString(),
        level: zone.level.toString(),
        createdBy: zone.createdBy,
        createdAt: zone.createdAt.toString(),
        isActive: zone.isActive
      }));
    } catch (error) {
      console.error('Error getting active danger zones:', error);
      throw error;
    }
  }

  async getDangerZoneCount() {
    if (!this.initialized) throw new Error('Blockchain relayer not initialized');
    try {
      const zones = await this.contract.getAllDangerZones();
      return zones.length;
    } catch (error) {
      console.error('Error getting danger zone count:', error);
      throw error;
    }
  }

  async getDangerZoneByIndex(index) {
    if (!this.initialized) throw new Error('Blockchain relayer not initialized');
    try {
      const zone = await this.contract.dangerZones(index);
      if (!zone.isActive) return null;
      return {
        zoneId: zone.zoneId,
        name: zone.name,
        latitude: zone.latitude.toString(),
        longitude: zone.longitude.toString(),
        radius: zone.radius.toString(),
        level: zone.level.toString(),
        createdBy: zone.createdBy,
        createdAt: zone.createdAt.toString(),
        isActive: zone.isActive
      };
    } catch (error) {
      console.error('Error getting danger zone by index:', error);
      return null;
    }
  }

  async createDangerZoneDirect(adminAddress, name, latitude, longitude, radius, level) {
    if (!this.initialized) throw new Error('Blockchain relayer not initialized');
    try {
      console.log('📤 Creating danger zone directly on blockchain...');
      const tx = await this.contract.createDangerZone(name, latitude, longitude, radius, level);
      console.log('📝 Danger zone tx:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Danger zone transaction confirmed:', receipt.hash);
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        zoneId: this.extractZoneIdFromReceipt(receipt),
        zoneIndex: receipt.logs.length
      };
    } catch (error) {
      console.error('Danger zone direct creation failed:', error);
      throw new Error(`Transaction failed: ${error.reason || error.message}`);
    }
  }

  async updateDangerZone(adminAddress, zoneIndex, name, radius, level) {
    if (!this.initialized) throw new Error('Blockchain relayer not initialized');
    try {
      const tx = await this.contract.updateDangerZone(zoneIndex, name, radius, level);
      const receipt = await tx.wait();
      console.log('✅ Danger zone update confirmed:', receipt.hash);
      return { success: true, txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (error) {
      console.error('Danger zone update failed:', error);
      throw new Error(`Transaction failed: ${error.reason || error.message}`);
    }
  }

  async deleteTourist(walletAddress) {
    if (!this.initialized) throw new Error('Blockchain relayer not initialized');
    
    console.log('🗑️ Deleting tourist from blockchain:', walletAddress);
    
    try {
      // Check if tourist exists
      const isRegistered = await this.isRegistered(walletAddress);
      if (!isRegistered) {
        throw new Error('Tourist not found on blockchain');
      }
      
      // Call deleteTourist function on contract (admin only)
      const tx = await this.contract.deleteTourist(walletAddress);
      console.log('📝 Delete tourist tx:', tx.hash || tx);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait ? tx.wait() : tx;
      console.log('✅ Tourist deleted from blockchain:', receipt.hash || receipt.transactionHash || receipt);
      
      return {
        success: true,
        txHash: receipt.hash || receipt.transactionHash || receipt,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Delete tourist failed:', error);
      if (error.reason) throw new Error(`Contract reverted: ${error.reason}`);
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  getRelayerAddress() {
    return this.wallet ? this.wallet.address : null;
  }

  async removeDangerZone(adminAddress, zoneIndex) {
    if (!this.initialized) throw new Error('Blockchain relayer not initialized');
    try {
      console.log('📤 Removing danger zone from blockchain (index:', zoneIndex, ')');

      try {
        const zone = await this.contract.dangerZones(zoneIndex);
        if (!zone.isActive) throw new Error(`Zone at index ${zoneIndex} is already inactive`);
      } catch (checkErr) {
        if (checkErr.code === 'CALL_EXCEPTION' || checkErr.reason === 'execution reverted') {
          throw new Error(`Invalid zone index: ${zoneIndex}. Zone may not exist.`);
        }
        throw checkErr;
      }

      const tx = await this.contract.removeDangerZone(zoneIndex);
      const receipt = await tx.wait();
      console.log('✅ Danger zone removal confirmed:', receipt.hash);
      return { success: true, txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (error) {
      console.error('Danger zone removal failed:', error);
      if (error.reason) throw new Error(`Contract reverted: ${error.reason}`);
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }
}

const relayer = new BlockchainRelayer();
module.exports = relayer;