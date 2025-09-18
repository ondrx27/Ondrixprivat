const { PublicKey } = require('@solana/web3.js');

// Import functions from utils
// Since it's TS, we'll just test the logic here with raw RPC calls

const { Connection } = require('@solana/web3.js');
const borsh = require('borsh');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const PROGRAM_ID = new PublicKey('CEK5xg1GjqmWgjcL9DZdDktTVDZRZFgWKLkq7pm26BP4');
const GLOBAL_ESCROW = new PublicKey('6EK4uRij3mJTywJbPJKSKNJH1S5mazxSjruUSnyMKcbr');
const TEST_INVESTOR = new PublicKey('9c9FyNTe5T9m2dkp6zbvN67sGzydS1KWzEDWm1nKSP5w');

// PDA helpers
function findInvestorPDA(investor, globalEscrow) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('investor'),
      investor.toBuffer(),
      globalEscrow.toBuffer(),
    ],
    PROGRAM_ID
  );
}

// Borsh schema for GlobalEscrow
class GlobalEscrowData {
  constructor(fields) {
    Object.assign(this, fields);
  }
  
  static schema = new Map([
    [GlobalEscrowData, {
      kind: 'struct',
      fields: [
        ['isInitialized', 'u8'],
        ['initializerPubkey', {kind: 'array', type: 'u8', len: 32}], // Array of 32 bytes
        ['tokenMintPubkey', {kind: 'array', type: 'u8', len: 32}], 
        ['recipientWallet', {kind: 'array', type: 'u8', len: 32}],
        ['totalTokensAvailable', 'u64'],
        ['tokensSold', 'u64'],
        ['totalSolDeposited', 'u64'],
        ['totalSolWithdrawn', 'u64'],
        ['lockDuration', 'i64'],
        ['bumpSeed', 'u8'],
        ['oracleProgramId', {kind: 'array', type: 'u8', len: 32}],
        ['priceFeedPubkey', {kind: 'array', type: 'u8', len: 32}],
        ['minSolInvestment', 'u64'],
        ['maxSolInvestment', 'u64'],
        ['priceStalenessThreshold', 'u64'],
        ['saleEndTimestamp', 'i64'],
      ],
    }]
  ]);
}

// Borsh schema for InvestorAccount  
class InvestorAccountData {
  constructor(fields) {
    Object.assign(this, fields);
  }
  
  static schema = new Map([
    [InvestorAccountData, {
      kind: 'struct',
      fields: [
        ['isInitialized', 'u8'],
        ['investorPubkey', {kind: 'array', type: 'u8', len: 32}], // Array of 32 bytes
        ['globalEscrowPubkey', {kind: 'array', type: 'u8', len: 32}],
        ['solDeposited', 'u64'],
        ['tokensReceived', 'u64'],
        ['depositTimestamp', 'i64'],
        ['solUsdPrice', 'u64'],
        ['status', 'u8'],
        ['bumpSeed', 'u8'],
      ],
    }]
  ]);
}

async function testDataReading() {
  console.log('🧪 Testing Solana account data reading...\n');
  
  try {
    // Test 1: Read Global Escrow data
    console.log('📋 Reading Global Escrow data...');
    const escrowAccountInfo = await connection.getAccountInfo(GLOBAL_ESCROW);
    
    if (!escrowAccountInfo || !escrowAccountInfo.data) {
      console.log('❌ Global escrow account not found');
      return;
    }
    
    console.log('✅ Global escrow account found');
    console.log('   Owner:', escrowAccountInfo.owner.toString());
    console.log('   Data length:', escrowAccountInfo.data.length);
    
    // Try to parse manually first to understand the data structure
    try {
      console.log('   Raw data (first 50 bytes):', Array.from(escrowAccountInfo.data.slice(0, 50)));
      
      // Manual parsing for debugging
      const data = escrowAccountInfo.data;
      const isInit = data[0];
      console.log('   Manual parse - isInitialized:', isInit);
      
      // Let's try a simpler approach first
      const reader = new DataView(data.buffer, data.byteOffset, data.byteLength);
      console.log('   Manual parse - first u64 at offset 97:', reader.getBigUint64(97, true)); // little endian
      
      // Manual parsing for now since Borsh schema is problematic
      const parseManually = (data) => {
        const reader = new DataView(data.buffer, data.byteOffset, data.byteLength);
        let offset = 0;
        
        const isInitialized = data[offset]; offset += 1; // u8
        offset += 32; // initializerPubkey 
        offset += 32; // tokenMintPubkey
        offset += 32; // recipientWallet
        
        const totalTokensAvailable = reader.getBigUint64(offset, true); offset += 8;
        const tokensSold = reader.getBigUint64(offset, true); offset += 8;
        const totalSolDeposited = reader.getBigUint64(offset, true); offset += 8;
        const totalSolWithdrawn = reader.getBigUint64(offset, true); offset += 8;
        const lockDuration = reader.getBigInt64(offset, true); offset += 8;
        
        return {
          isInitialized,
          totalTokensAvailable,
          tokensSold,
          totalSolDeposited, 
          totalSolWithdrawn,
          lockDuration
        };
      };
      
      const escrowData = parseManually(data);
      
      console.log('✅ Global escrow data parsed manually:');
      console.log('   Initialized:', escrowData.isInitialized === 1);
      console.log('   Total tokens:', Number(escrowData.totalTokensAvailable) / 1e9);
      console.log('   Tokens sold:', Number(escrowData.tokensSold) / 1e9);
      console.log('   SOL deposited:', Number(escrowData.totalSolDeposited) / 1e9);
      console.log('   SOL withdrawn:', Number(escrowData.totalSolWithdrawn) / 1e9);
      console.log('   Lock duration:', Number(escrowData.lockDuration), 'seconds');
    } catch (parseError) {
      console.log('❌ Failed to parse global escrow data:', parseError.message);
    }
    
    // Test 2: Read Investor PDA data
    console.log('\n👤 Reading Investor PDA data...');
    const [investorPDA] = findInvestorPDA(TEST_INVESTOR, GLOBAL_ESCROW);
    console.log('   Investor PDA:', investorPDA.toString());
    
    const investorAccountInfo = await connection.getAccountInfo(investorPDA);
    
    if (!investorAccountInfo || !investorAccountInfo.data) {
      console.log('❌ Investor account not found - no investment made yet');
      return;
    }
    
    console.log('✅ Investor account found');
    console.log('   Owner:', investorAccountInfo.owner.toString());
    console.log('   Data length:', investorAccountInfo.data.length);
    
    // Try to parse investor data
    try {
      const investorData = borsh.deserialize(
        InvestorAccountData.schema,
        InvestorAccountData,
        investorAccountInfo.data
      );
      
      console.log('✅ Investor data parsed successfully:');
      console.log('   Initialized:', investorData.isInitialized === 1);
      console.log('   SOL deposited:', Number(investorData.solDeposited) / 1e9);
      console.log('   Tokens received:', Number(investorData.tokensReceived) / 1e9);
      console.log('   Deposit timestamp:', new Date(Number(investorData.depositTimestamp) * 1000).toLocaleString());
      console.log('   SOL/USD price:', Number(investorData.solUsdPrice) / 1e8);
      console.log('   Status:', investorData.status);
      console.log('   Locked SOL amount:', Number(investorData.solDeposited) / 1e9 / 2);
    } catch (parseError) {
      console.log('❌ Failed to parse investor data:', parseError.message);
      console.log('   Raw data (first 50 bytes):', investorAccountInfo.data.slice(0, 50));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDataReading();