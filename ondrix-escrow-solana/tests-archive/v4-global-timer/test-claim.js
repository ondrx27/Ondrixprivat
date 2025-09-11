const {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
  PROGRAM_ID,
  findGlobalEscrowPDA,
  findInvestorPDA,
  findSolVaultPDA,
  createWithdrawLockedSolInstruction,
} = require('../../dist/tests/utils.js');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Приватные ключи
const INVESTOR1_PRIVATE = 'rKAMdrQgnE3zvQdLK4MtXBQqvwhMLoDnbgyAM7heWeM3pUoyA6sWFLSixp2dySt3SiYskQdaU6wKHNh1X3r77pZ';
const INVESTOR2_PRIVATE = '5pKECKQTz61EjiA6bgUj82EgKqmR3DCmWvKHoBhTC3NxXMPwAccfVwbWXr2QVedgbWanDsZQpxPPujtVi7TWZRMp';
const RECIPIENT_PRIVATE = '37yWdyP1E8sVqRpVEK5Y3cFHuDggnbPEuXGR7zDo4PxbDZwTBCcTNK3bZwErTuNfB3Nn6NLtHqxgzNLCNSPRxsXN';

// Данные из последнего теста
const TOKEN_MINT = new PublicKey('3iL82t5vRoddSWqadejp1BkMLAt4eX4RQgywFQi15tMC');
const GLOBAL_ESCROW_PDA = new PublicKey('GkxG4WyoSG3Ux9DtMrCdhwMgZ1dRTXX2DE18YrMicsig');
const UNLOCK_TIME = 1757609110; // Время разблокировки из теста

// Функция декодирования base58
function decodeBase58(encoded) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const BASE = 58;
  
  let num = 0n;
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid character in base58 string');
    num = num * BigInt(BASE) + BigInt(index);
  }
  
  let hex = num.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  
  return new Uint8Array(bytes);
}

async function main() {
  console.log('🔓 ТЕСТ КЛАЙМА ЗАБЛОКИРОВАННЫХ SOL');
  console.log('='.repeat(60));
  console.log(`📍 Program ID: ${PROGRAM_ID.toString()}`);
  console.log(`🪙 Token Mint: ${TOKEN_MINT.toString()}`);
  console.log(`🏦 Global Escrow: ${GLOBAL_ESCROW_PDA.toString()}`);
  
  const investor1 = Keypair.fromSecretKey(decodeBase58(INVESTOR1_PRIVATE));
  const investor2 = Keypair.fromSecretKey(decodeBase58(INVESTOR2_PRIVATE));
  const recipient = Keypair.fromSecretKey(decodeBase58(RECIPIENT_PRIVATE));
  
  console.log(`👤 Investor1: ${investor1.publicKey.toString()}`);
  console.log(`👤 Investor2: ${investor2.publicKey.toString()}`);
  console.log(`🎯 Recipient: ${recipient.publicKey.toString()}`);
  
  try {
    // Проверяем текущее время
    const currentTime = Math.floor(Date.now() / 1000);
    console.log(`\n⏰ Текущее время: ${currentTime}`);
    console.log(`🔓 Время разблокировки: ${UNLOCK_TIME}`);
    console.log(`⏳ Статус: ${currentTime >= UNLOCK_TIME ? '✅ РАЗБЛОКИРОВАНО' : '❌ ЕЩЕ ЗАБЛОКИРОВАНО'}`);
    
    if (currentTime < UNLOCK_TIME) {
      const waitTime = UNLOCK_TIME - currentTime;
      console.log(`⌛ Осталось ждать: ${waitTime} секунд`);
      console.log('❌ Рано для клайма, попробуйте позже');
      return;
    }
    
    // Проверяем балансы до клайма
    const [solVault1PDA] = findSolVaultPDA(investor1.publicKey, GLOBAL_ESCROW_PDA, PROGRAM_ID);
    const [solVault2PDA] = findSolVaultPDA(investor2.publicKey, GLOBAL_ESCROW_PDA, PROGRAM_ID);
    const [investor1PDA] = findInvestorPDA(investor1.publicKey, GLOBAL_ESCROW_PDA, PROGRAM_ID);
    const [investor2PDA] = findInvestorPDA(investor2.publicKey, GLOBAL_ESCROW_PDA, PROGRAM_ID);
    
    const solVault1Balance = await connection.getBalance(solVault1PDA);
    const solVault2Balance = await connection.getBalance(solVault2PDA);
    const recipientBalanceBefore = await connection.getBalance(recipient.publicKey);
    
    console.log(`\n💰 БАЛАНСЫ ДО КЛАЙМА:`);
    console.log(`🔒 SOL Vault 1: ${solVault1Balance / LAMPORTS_PER_SOL} SOL`);
    console.log(`🔒 SOL Vault 2: ${solVault2Balance / LAMPORTS_PER_SOL} SOL`);
    console.log(`🎯 Recipient: ${recipientBalanceBefore / LAMPORTS_PER_SOL} SOL`);
    
    // Проверим аккаунты вольтов
    const solVault1Info = await connection.getAccountInfo(solVault1PDA);
    const solVault2Info = await connection.getAccountInfo(solVault2PDA);
    console.log(`\n🔍 SOL VAULT 1 INFO:`);
    console.log(`   Exists: ${solVault1Info ? 'YES' : 'NO'}`);
    if (solVault1Info) {
      console.log(`   Owner: ${solVault1Info.owner.toString()}`);
      console.log(`   Executable: ${solVault1Info.executable}`);
      console.log(`   Data length: ${solVault1Info.data.length}`);
    }
    console.log(`\n🔍 SOL VAULT 2 INFO:`);
    console.log(`   Exists: ${solVault2Info ? 'YES' : 'NO'}`);
    if (solVault2Info) {
      console.log(`   Owner: ${solVault2Info.owner.toString()}`);
      console.log(`   Executable: ${solVault2Info.executable}`);
      console.log(`   Data length: ${solVault2Info.data.length}`);
    }
    
    // Клаймим SOL от investor1 (пробуем через initializer)
    console.log(`\n🔓 КЛАЙМ SOL ОТ INVESTOR1...`);
    const withdrawInstruction1 = await createWithdrawLockedSolInstruction(
      investor1.publicKey,   // withdrawer (пробуем initializer!)
      GLOBAL_ESCROW_PDA,     // globalEscrowAccount
      investor1PDA,          // investorAccount (PDA investor'а)
      investor1.publicKey,   // investor (для поиска SOL vault)
      recipient.publicKey,   // recipientWallet (кому отправляем)
      PROGRAM_ID
    );
    
    const withdrawTx1 = new Transaction().add(withdrawInstruction1);
    
    // Симулируем сначала
    console.log('🧪 Симулируем клайм от Investor1 (вызывает initializer)...');
    const simulation1 = await connection.simulateTransaction(withdrawTx1, [investor1]);
    
    if (simulation1.value.err) {
      console.log('❌ Симуляция клайма Investor1 провалилась:');
      console.log('Error:', simulation1.value.err);
      console.log('Logs:');
      simulation1.value.logs?.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log}`);
      });
    } else {
      console.log('✅ Симуляция прошла, выполняем клайм...');
      const signature1 = await sendAndConfirmTransaction(
        connection,
        withdrawTx1,
        [investor1],
        { commitment: 'confirmed' }
      );
      console.log(`✅ Investor1 SOL claimed: ${signature1}`);
    }
    
    // Клайм SOL от investor2 (Теперь тоже через recipient!)
    console.log(`\n🔓 КЛАЙМ SOL ОТ INVESTOR2...`);
    const withdrawInstruction2 = await createWithdrawLockedSolInstruction(
      recipient.publicKey,   // withdrawer (recipient может клаймить все)
      GLOBAL_ESCROW_PDA,     // globalEscrowAccount
      investor2PDA,          // investorAccount (PDA investor'а)
      investor2.publicKey,   // investor (для поиска SOL vault)
      recipient.publicKey,   // recipientWallet (кому отправляем)
      PROGRAM_ID
    );
    
    const withdrawTx2 = new Transaction().add(withdrawInstruction2);
    
    // Симулируем сначала
    console.log('🧪 Симулируем клайм от Investor2 (вызывает recipient)...');
    const simulation2 = await connection.simulateTransaction(withdrawTx2, [recipient]);
    
    if (simulation2.value.err) {
      console.log('❌ Симуляция клайма Investor2 провалилась:');
      console.log('Error:', simulation2.value.err);
      console.log('Logs:');
      simulation2.value.logs?.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log}`);
      });
    } else {
      console.log('✅ Симуляция прошла, выполняем клайм...');
      const signature2 = await sendAndConfirmTransaction(
        connection,
        withdrawTx2,
        [recipient],
        { commitment: 'confirmed' }
      );
      console.log(`✅ Investor2 SOL claimed: ${signature2}`);
    }
    
    // Проверяем итоговые балансы
    const solVault1BalanceFinal = await connection.getBalance(solVault1PDA);
    const solVault2BalanceFinal = await connection.getBalance(solVault2PDA);
    const recipientBalanceAfter = await connection.getBalance(recipient.publicKey);
    
    console.log(`\n💰 БАЛАНСЫ ПОСЛЕ КЛАЙМА:`);
    console.log(`🔒 SOL Vault 1: ${solVault1BalanceFinal / LAMPORTS_PER_SOL} SOL`);
    console.log(`🔒 SOL Vault 2: ${solVault2BalanceFinal / LAMPORTS_PER_SOL} SOL`);
    console.log(`🎯 Recipient: ${recipientBalanceAfter / LAMPORTS_PER_SOL} SOL`);
    
    const totalClaimed = (recipientBalanceAfter - recipientBalanceBefore) / LAMPORTS_PER_SOL;
    console.log(`\n📈 ИТОГО CLAIMED: ${totalClaimed} SOL`);
    
    if (solVault1BalanceFinal <= 5000 && solVault2BalanceFinal <= 5000) { // Учитываем rent
      console.log('✅ SUCCESS: Все заблокированные SOL успешно claimed!');
    } else {
      console.log('⚠️  WARNING: В vaults остались SOL');
    }
    
  } catch (error) {
    console.error('❌ ОШИБКА:', error.message);
    if (error.logs) {
      console.log('\n📜 Логи:');
      error.logs.forEach(log => console.log(`   ${log}`));
    }
  }
}

main().catch(console.error);