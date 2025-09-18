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

// Manual parsing function
function parseInvestorData(data) {
  const reader = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;
  
  const isInitialized = data[offset]; offset += 1; // u8
  const investorPubkey = data.slice(offset, offset + 32); offset += 32; // investorPubkey 
  const globalEscrowPubkey = data.slice(offset, offset + 32); offset += 32; // globalEscrowPubkey
  
  const solDeposited = reader.getBigUint64(offset, true); offset += 8;
  const tokensReceived = reader.getBigUint64(offset, true); offset += 8;
  const depositTimestamp = reader.getBigInt64(offset, true); offset += 8;
  
  return {
    isInitialized,
    investorPubkey: new PublicKey(investorPubkey),
    globalEscrowPubkey: new PublicKey(globalEscrowPubkey),
    solDeposited,
    tokensReceived,
    depositTimestamp,
  };
}

async function reversePDALookup() {
  console.log('🔍 Finding original investor wallets from PDAs...\n');
  
  const knownPDAs = [
    '3mBTbtiPzXJZqaW5tWcfb9BJ3vS5mgJxGsgMhc6Ye5Y1',
    '72B5RbHQXzfAfXad3PNHNkKNftb5u4VM2SCsH9bNFg9K'
  ];
  
  for (const pdaStr of knownPDAs) {
    try {
      console.log(`📋 PDA: ${pdaStr}`);
      
      const pda = new PublicKey(pdaStr);
      const accountInfo = await connection.getAccountInfo(pda);
      
      if (!accountInfo) {
        console.log('   ❌ Account not found');
        continue;
      }
      
      // Parse the account data to get the original investor pubkey
      const investorData = parseInvestorData(accountInfo.data);
      const originalInvestor = investorData.investorPubkey;
      
      console.log(`   👤 Original Investor Wallet: ${originalInvestor.toString()}`);
      console.log(`   💰 SOL Deposited: ${Number(investorData.solDeposited) / 1e9} SOL`);
      console.log(`   🪙 Tokens Received: ${Number(investorData.tokensReceived) / 1e9} ODX`);
      console.log(`   📅 Deposit Time: ${new Date(Number(investorData.depositTimestamp) * 1000).toLocaleString()}`);
      
      // Verify PDA calculation
      const [calculatedPDA] = findInvestorPDA(originalInvestor, GLOBAL_ESCROW);
      const isValid = calculatedPDA.equals(pda);
      console.log(`   ✅ PDA Verification: ${isValid ? 'CORRECT' : 'INCORRECT'}`);
      
      if (!isValid) {
        console.log(`   Expected: ${calculatedPDA.toString()}`);
        console.log(`   Actual:   ${pda.toString()}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error processing PDA ${pdaStr}:`, error.message);
    }
    
    console.log('');
  }
}

reversePDALookup();