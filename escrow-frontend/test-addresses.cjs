const { PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');

const PROGRAM_ID = new PublicKey('CEK5xg1GjqmWgjcL9DZdDktTVDZRZFgWKLkq7pm26BP4');
const GLOBAL_ESCROW = new PublicKey('6EK4uRij3mJTywJbPJKSKNJH1S5mazxSjruUSnyMKcbr');
const TOKEN_MINT = new PublicKey('7yRkyoCdgJ8W1gejxZuHd6BVaSaxYgE7oXtn6jy2yTtU');

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

function findSolVaultPDA(investor, globalEscrow) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('sol_vault'),
      investor.toBuffer(),
      globalEscrow.toBuffer(),
    ],
    PROGRAM_ID
  );
}

async function testAddressesForWallet(walletAddress) {
  console.log(`🔍 Testing addresses for wallet: ${walletAddress}\n`);
  
  try {
    const wallet = new PublicKey(walletAddress);
    
    // Calculate addresses
    const [investorPDA] = findInvestorPDA(wallet, GLOBAL_ESCROW);
    const [solVaultPDA] = findSolVaultPDA(wallet, GLOBAL_ESCROW);
    const tokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, wallet);
    
    console.log('📋 Generated Addresses:');
    console.log('');
    
    console.log('🏦 Investment Data Account (PDA):');
    console.log(`   Address: ${investorPDA.toString()}`);
    console.log(`   Solscan: https://solscan.io/account/${investorPDA.toString()}?cluster=devnet`);
    console.log('   Contains: investment history, token balance, lock status');
    console.log('');
    
    console.log('🔒 Locked SOL Vault (PDA):');
    console.log(`   Address: ${solVaultPDA.toString()}`);
    console.log(`   Solscan: https://solscan.io/account/${solVaultPDA.toString()}?cluster=devnet`);
    console.log('   Contains: time-locked SOL (50% of investment)');
    console.log('');
    
    console.log('🪙 ODX Token Account (ATA):');
    console.log(`   Address: ${tokenAccount.toString()}`);
    console.log(`   Solscan: https://solscan.io/account/${tokenAccount.toString()}?cluster=devnet`);
    console.log('   Contains: ODX token balance');
    console.log('');
    
    return {
      investorPDA: investorPDA.toString(),
      solVaultPDA: solVaultPDA.toString(),
      tokenAccount: tokenAccount.toString(),
    };
    
  } catch (error) {
    console.error('❌ Error calculating addresses:', error.message);
    return null;
  }
}

async function testKnownInvestors() {
  console.log('🧪 Testing address generation for known investors...\n');
  
  const knownInvestors = [
    'EJ6bPvsTXfzk1WS9eXKDQ3KL5x9a2wy15XPxL48FdeAc', // Has 0.2 SOL investment
    'DZJy7sWk8pgt5VZnaP7PWtwEHjzg84j3kr5cGKwTJ67G', // Has 0.1 SOL investment
  ];
  
  for (const investor of knownInvestors) {
    await testAddressesForWallet(investor);
    console.log('=' .repeat(80));
    console.log('');
  }
  
  // Test with a random wallet (no investment)
  console.log('🆕 Testing with random wallet (no investment expected):');
  const randomWallet = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'; // Random wallet
  await testAddressesForWallet(randomWallet);
}

testKnownInvestors();