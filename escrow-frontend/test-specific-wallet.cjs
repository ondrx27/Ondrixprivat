const { PublicKey, Connection } = require('@solana/web3.js');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const PROGRAM_ID = new PublicKey('CEK5xg1GjqmWgjcL9DZdDktTVDZRZFgWKLkq7pm26BP4');
const GLOBAL_ESCROW = new PublicKey('6EK4uRij3mJTywJbPJKSKNJH1S5mazxSjruUSnyMKcbr');

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

// Manual parsing function for InvestorAccount data
function parseInvestorData(data) {
  const reader = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;
  
  const isInitialized = data[offset]; offset += 1; // u8
  offset += 32; // investorPubkey
  offset += 32; // globalEscrowPubkey
  
  const solDeposited = reader.getBigUint64(offset, true); offset += 8;
  const tokensReceived = reader.getBigUint64(offset, true); offset += 8;
  const depositTimestamp = reader.getBigInt64(offset, true); offset += 8;
  offset += 8; // solUsdPrice
  const status = data[offset]; offset += 1; // u8 status
  
  return {
    isInitialized,
    solDeposited,
    tokensReceived,
    depositTimestamp,
    status
  };
}

async function testSpecificWallets() {
  console.log('🧪 Testing specific wallet investor data...\n');
  
  // Test different wallet addresses
  const testWallets = [
    '9c9FyNTe5T9m2dkp6zbvN67sGzydS1KWzEDWm1nKSP5w', // Original test wallet
    'EJ6bPvsTXfzk1WS9eXKDQ3KL5x9a2wy15XPxL48FdeAc', // Recipient wallet
    // Add more if you know other addresses that might have invested
  ];
  
  for (const walletStr of testWallets) {
    try {
      console.log(`👤 Testing wallet: ${walletStr}`);
      const wallet = new PublicKey(walletStr);
      
      // Find investor PDA
      const [investorPDA] = findInvestorPDA(wallet, GLOBAL_ESCROW);
      console.log(`   PDA: ${investorPDA.toString()}`);
      
      // Check if account exists
      const accountInfo = await connection.getAccountInfo(investorPDA);
      
      if (!accountInfo || !accountInfo.data) {
        console.log('   ❌ No investment data found\n');
        continue;
      }
      
      console.log('   ✅ Investment account found!');
      console.log('   Owner:', accountInfo.owner.toString());
      console.log('   Data length:', accountInfo.data.length);
      
      // Parse data
      try {
        const investorData = parseInvestorData(accountInfo.data);
        
        console.log('   📊 Investment details:');
        console.log('     Initialized:', investorData.isInitialized === 1);
        console.log('     SOL deposited:', Number(investorData.solDeposited) / 1e9);
        console.log('     Tokens received:', Number(investorData.tokensReceived) / 1e9);
        console.log('     Deposit time:', new Date(Number(investorData.depositTimestamp) * 1000).toLocaleString());
        console.log('     Status:', investorData.status);
        console.log('     Locked SOL:', Number(investorData.solDeposited) / 1e9 / 2);
        
      } catch (parseError) {
        console.log('   ❌ Failed to parse investor data:', parseError.message);
        console.log('   Raw data (first 20 bytes):', Array.from(accountInfo.data.slice(0, 20)));
      }
      
    } catch (error) {
      console.log(`   ❌ Error testing wallet ${walletStr}:`, error.message);
    }
    
    console.log(''); // Empty line
  }
  
  // Also list all PDA accounts owned by our program to see what investors exist
  console.log('🔍 Searching for all investor accounts...');
  try {
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { dataSize: 99 }, // InvestorAccount size: 1+32+32+8+8+8+8+1+1 = 99
      ]
    });
    
    console.log(`Found ${allAccounts.length} investor accounts:`);
    
    allAccounts.forEach((account, i) => {
      console.log(`${i + 1}. ${account.pubkey.toString()}`);
      try {
        const data = parseInvestorData(account.account.data);
        console.log(`   SOL: ${Number(data.solDeposited) / 1e9}, Tokens: ${Number(data.tokensReceived) / 1e9}`);
      } catch (e) {
        console.log('   Parse error:', e.message);
      }
    });
    
  } catch (error) {
    console.log('❌ Failed to get program accounts:', error.message);
  }
}

testSpecificWallets();