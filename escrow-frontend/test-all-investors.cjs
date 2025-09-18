const { PublicKey, Connection } = require('@solana/web3.js');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const PROGRAM_ID = new PublicKey('CEK5xg1GjqmWgjcL9DZdDktTVDZRZFgWKLkq7pm26BP4');

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

// Get all investors 
async function getAllInvestors() {
  try {
    console.log('🔍 Searching for all investor accounts...\n');
    
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { dataSize: 99 }, // InvestorAccount size: 1+32+32+8+8+8+8+1+1 = 99
      ]
    });
    
    console.log(`Found ${allAccounts.length} investor accounts:\n`);
    
    const investors = [];
    
    allAccounts.forEach((account, i) => {
      try {
        const investorData = parseInvestorData(account.account.data);
        
        if (investorData.isInitialized === 1) {
          const investor = {
            pda: account.pubkey.toString(),
            solDeposited: Number(investorData.solDeposited),
            tokensReceived: Number(investorData.tokensReceived),
            depositTimestamp: Number(investorData.depositTimestamp),
            status: investorData.status,
          };
          
          investors.push(investor);
          
          console.log(`${i + 1}. Investor PDA: ${investor.pda}`);
          console.log(`   SOL Deposited: ${investor.solDeposited / 1e9} SOL`);
          console.log(`   Tokens Received: ${investor.tokensReceived / 1e9} ODX`);
          console.log(`   Deposit Time: ${new Date(investor.depositTimestamp * 1000).toLocaleString()}`);
          console.log(`   Status: ${investor.status} ${investor.status === 1 ? '(Deposited)' : investor.status === 2 ? '(SOL Withdrawn)' : '(Unknown)'}`);
          console.log(`   Locked SOL: ${investor.solDeposited / 1e9 / 2} SOL`);
          console.log('');
        }
      } catch (parseError) {
        console.log(`   ❌ Parse error for ${account.pubkey.toString()}:`, parseError.message);
      }
    });
    
    // Summary
    console.log('📊 Summary:');
    console.log(`   Total Investors: ${investors.length}`);
    console.log(`   Total SOL Invested: ${investors.reduce((sum, inv) => sum + inv.solDeposited / 1e9, 0).toFixed(4)} SOL`);
    console.log(`   Total Tokens Distributed: ${investors.reduce((sum, inv) => sum + inv.tokensReceived / 1e9, 0).toFixed(2)} ODX`);
    
    return investors;
  } catch (error) {
    console.error('❌ Error fetching all investors:', error);
    return [];
  }
}

getAllInvestors();