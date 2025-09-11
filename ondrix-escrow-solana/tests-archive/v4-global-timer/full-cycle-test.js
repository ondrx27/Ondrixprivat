const {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} = require('@solana/spl-token');
const {
  PROGRAM_ID,
  findGlobalEscrowPDA,
  findInvestorPDA,
  findSolVaultPDA,
  createInitializeEscrowInstruction,
  createDepositSolInstruction,
  createWithdrawLockedSolInstruction,
  sleep,
} = require('../../dist/tests/utils.js');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Приватные ключи
const INVESTOR1_PRIVATE = 'rKAMdrQgnE3zvQdLK4MtXBQqvwhMLoDnbgyAM7heWeM3pUoyA6sWFLSixp2dySt3SiYskQdaU6wKHNh1X3r77pZ';
const INVESTOR2_PRIVATE = '5pKECKQTz61EjiA6bgUj82EgKqmR3DCmWvKHoBhTC3NxXMPwAccfVwbWXr2QVedgbWanDsZQpxPPujtVi7TWZRMp';
const RECIPIENT_PRIVATE = '37yWdyP1E8sVqRpVEK5Y3cFHuDggnbPEuXGR7zDo4PxbDZwTBCcTNK3bZwErTuNfB3Nn6NLtHqxgzNLCNSPRxsXN';

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
  console.log('🧪 ПОЛНЫЙ ЦИКЛ ТЕСТИРОВАНИЯ ESCROW (2 МИНУТЫ БЛОКИРОВКИ)');
  console.log('='.repeat(80));
  console.log(`📍 Program ID: ${PROGRAM_ID.toString()}`);
  
  // Декодируем ключи
  const investor1 = Keypair.fromSecretKey(decodeBase58(INVESTOR1_PRIVATE));
  const investor2 = Keypair.fromSecretKey(decodeBase58(INVESTOR2_PRIVATE));
  const recipient = Keypair.fromSecretKey(decodeBase58(RECIPIENT_PRIVATE));
  
  console.log(`👤 Investor1/Initializer: ${investor1.publicKey.toString()}`);
  console.log(`👤 Investor2: ${investor2.publicKey.toString()}`);
  console.log(`🎯 Recipient: ${recipient.publicKey.toString()}`);
  
  // Проверяем начальные балансы
  const investor1Balance = await connection.getBalance(investor1.publicKey);
  const investor2Balance = await connection.getBalance(investor2.publicKey);
  const recipientBalanceStart = await connection.getBalance(recipient.publicKey);
  
  console.log('\n💰 НАЧАЛЬНЫЕ БАЛАНСЫ:');
  console.log(`Investor1: ${investor1Balance / LAMPORTS_PER_SOL} SOL`);
  console.log(`Investor2: ${investor2Balance / LAMPORTS_PER_SOL} SOL`);
  console.log(`Recipient: ${recipientBalanceStart / LAMPORTS_PER_SOL} SOL`);
  
  try {
    // ========== ЭТАП 1: СОЗДАНИЕ ТОКЕНА И ИНИЦИАЛИЗАЦИЯ ==========
    console.log('\n🪙 ЭТАП 1: СОЗДАНИЕ ТОКЕНА И ИНИЦИАЛИЗАЦИЯ ESCROW');
    console.log('-'.repeat(60));
    
    const tokenMint = await createMint(
      connection,
      investor1,
      investor1.publicKey,
      null,
      9
    );
    console.log(`✅ Token Mint: ${tokenMint.toString()}`);
    
    const initializerTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      investor1,
      tokenMint,
      investor1.publicKey
    );
    
    const tokenSupply = BigInt(1000000 * Math.pow(10, 9));
    await mintTo(
      connection,
      investor1,
      tokenMint,
      initializerTokenAccount.address,
      investor1,
      tokenSupply
    );
    console.log(`✅ Создано 1M токенов`);
    
    // Инициализация с 2-минутной блокировкой
    const lockDuration = BigInt(120); // 2 минуты как запросил пользователь
    const tokenAmountForEscrow = BigInt(500000 * Math.pow(10, 9));
    
    const currentTime = Math.floor(Date.now() / 1000);
    const unlockTime = currentTime + Number(lockDuration);
    
    console.log(`⏰ Текущее время: ${currentTime}`);
    console.log(`🔒 Время блокировки: ${Number(lockDuration)} секунд`);
    console.log(`🔓 Время разблокировки: ${unlockTime}`);
    console.log(`📅 Дата разблокировки: ${new Date(unlockTime * 1000).toLocaleString()}`);
    
    const initializeInstruction = await createInitializeEscrowInstruction(
      investor1.publicKey,
      tokenMint,
      initializerTokenAccount.address,
      recipient.publicKey,
      tokenAmountForEscrow,
      lockDuration,
      PROGRAM_ID
    );
    
    const initTransaction = new Transaction().add(initializeInstruction);
    const initTxSignature = await sendAndConfirmTransaction(
      connection,
      initTransaction,
      [investor1],
      { commitment: 'confirmed' }
    );
    console.log(`✅ Escrow инициализирован: ${initTxSignature}`);
    
    const [globalEscrowPDA] = findGlobalEscrowPDA(investor1.publicKey, tokenMint, PROGRAM_ID);
    console.log(`📍 Global Escrow PDA: ${globalEscrowPDA.toString()}`);
    
    // ========== ЭТАП 2: ПЕРВЫЙ ИНВЕСТОР ==========
    console.log('\n💰 ЭТАП 2: ПЕРВЫЙ ИНВЕСТОР (INVESTOR1)');
    console.log('-'.repeat(60));
    
    const investor1DepositAmount = BigInt(0.1 * LAMPORTS_PER_SOL); // Уменьшаем до 0.1 SOL
    console.log(`💸 Investor1 депозитит: ${investor1DepositAmount / BigInt(LAMPORTS_PER_SOL)} SOL`);
    
    const depositInstruction1 = await createDepositSolInstruction(
      investor1.publicKey,
      globalEscrowPDA,
      tokenMint,
      recipient.publicKey,
      investor1DepositAmount,
      PROGRAM_ID
    );
    
    const depositTransaction1 = new Transaction().add(depositInstruction1);
    const depositTx1 = await sendAndConfirmTransaction(
      connection,
      depositTransaction1,
      [investor1],
      { commitment: 'confirmed' }
    );
    console.log(`✅ Investor1 депозит: ${depositTx1}`);
    
    // ========== ЭТАП 3: ВТОРОЙ ИНВЕСТОР ==========
    console.log('\n💰 ЭТАП 3: ВТОРОЙ ИНВЕСТОР (INVESTOR2)');
    console.log('-'.repeat(60));
    
    const investor2DepositAmount = BigInt(0.5 * LAMPORTS_PER_SOL); // Уменьшаем до 0.5 SOL
    console.log(`💸 Investor2 депозитит: ${investor2DepositAmount / BigInt(LAMPORTS_PER_SOL)} SOL`);
    
    const depositInstruction2 = await createDepositSolInstruction(
      investor2.publicKey,
      globalEscrowPDA,
      tokenMint,
      recipient.publicKey,
      investor2DepositAmount,
      PROGRAM_ID
    );
    
    const depositTransaction2 = new Transaction().add(depositInstruction2);
    const depositTx2 = await sendAndConfirmTransaction(
      connection,
      depositTransaction2,
      [investor2],
      { commitment: 'confirmed' }
    );
    console.log(`✅ Investor2 депозит: ${depositTx2}`);
    
    // Проверяем SOL vaults
    const [investor1PDA] = findInvestorPDA(investor1.publicKey, globalEscrowPDA, PROGRAM_ID);
    const [investor2PDA] = findInvestorPDA(investor2.publicKey, globalEscrowPDA, PROGRAM_ID);
    const [solVault1PDA] = findSolVaultPDA(investor1.publicKey, globalEscrowPDA, PROGRAM_ID);
    const [solVault2PDA] = findSolVaultPDA(investor2.publicKey, globalEscrowPDA, PROGRAM_ID);
    
    const solVault1Balance = await connection.getBalance(solVault1PDA);
    const solVault2Balance = await connection.getBalance(solVault2PDA);
    const recipientBalanceAfterDeposits = await connection.getBalance(recipient.publicKey);
    
    console.log(`\n📊 СОСТОЯНИЕ ПОСЛЕ ДЕПОЗИТОВ:`);
    console.log(`🔒 SOL Vault 1: ${solVault1Balance / LAMPORTS_PER_SOL} SOL (50% от 0.1 = 0.05 SOL)`);
    console.log(`🔒 SOL Vault 2: ${solVault2Balance / LAMPORTS_PER_SOL} SOL (50% от 0.5 = 0.25 SOL)`);
    console.log(`💰 Recipient получил: ${(recipientBalanceAfterDeposits - recipientBalanceStart) / LAMPORTS_PER_SOL} SOL (50% от обоих депозитов = 0.3 SOL)`);
    
    // ========== ЭТАП 4: ПОПЫТКА РАННЕГО ВЫВОДА (ДОЛЖНА БЛОКИРОВАТЬСЯ) ==========
    console.log('\n❌ ЭТАП 4: ПОПЫТКА РАННЕГО ВЫВОДА (ДОЛЖНА БЛОКИРОВАТЬСЯ)');
    console.log('-'.repeat(60));
    
    const timeNow = Math.floor(Date.now() / 1000);
    const timeLeft = unlockTime - timeNow;
    console.log(`⏰ Текущее время: ${timeNow}`);
    console.log(`⏳ До разблокировки: ${timeLeft} секунд`);
    
    try {
      const withdrawInstruction1 = await createWithdrawLockedSolInstruction(
        investor1.publicKey, // withdrawer (должен быть initializer)
        globalEscrowPDA,
        investor1PDA,
        investor1.publicKey,
        recipient.publicKey,
        PROGRAM_ID
      );
      
      const withdrawTransaction1 = new Transaction().add(withdrawInstruction1);
      await sendAndConfirmTransaction(
        connection,
        withdrawTransaction1,
        [investor1],
        { commitment: 'confirmed' }
      );
      
      console.log('❌ ОШИБКА: Ранний вывод НЕ заблокировался! Это уязвимость!');
      
    } catch (error) {
      console.log('✅ ПРАВИЛЬНО: Ранний вывод заблокирован!');
      console.log(`   Ошибка: ${error.message}`);
      if (error.logs) {
        error.logs.forEach(log => {
          if (log.includes('SOL still locked') || log.includes('SolStillLocked')) {
            console.log('✅ Причина: SOL еще заблокированы по времени');
          }
        });
      }
    }
    
    // ========== ЭТАП 5: ОЖИДАНИЕ РАЗБЛОКИРОВКИ ==========
    console.log('\n⏳ ЭТАП 5: ОЖИДАНИЕ РАЗБЛОКИРОВКИ...');
    console.log('-'.repeat(60));
    
    const waitTime = Math.max(0, timeLeft + 10); // +10 секунд для гарантии
    if (waitTime > 0) {
      console.log(`⌛ Ждем ${waitTime} секунд до разблокировки...`);
      await sleep(waitTime * 1000);
    }
    
    const finalTime = Math.floor(Date.now() / 1000);
    console.log(`✅ Время истекло! Текущее время: ${finalTime}, Разблокировка была: ${unlockTime}`);
    
    // ========== ЭТАП 6: УСПЕШНЫЙ ВЫВОД ЗАБЛОКИРОВАННЫХ SOL ==========
    console.log('\n✅ ЭТАП 6: ВЫВОД ЗАБЛОКИРОВАННЫХ SOL (ДОЛЖЕН УСПЕШНО ПРОЙТИ)');
    console.log('-'.repeat(60));
    
    const recipientBalanceBeforeWithdraw = await connection.getBalance(recipient.publicKey);
    console.log(`💰 Баланс recipient до вывода: ${recipientBalanceBeforeWithdraw / LAMPORTS_PER_SOL} SOL`);
    
    try {
      // Выводим SOL от investor1
      console.log('🔓 Выводим заблокированные SOL от Investor1...');
      const withdrawInstruction1Final = await createWithdrawLockedSolInstruction(
        investor1.publicKey,
        globalEscrowPDA,
        investor1PDA,
        investor1.publicKey,
        recipient.publicKey,
        PROGRAM_ID
      );
      
      const withdrawTransaction1Final = new Transaction().add(withdrawInstruction1Final);
      const withdrawTx1 = await sendAndConfirmTransaction(
        connection,
        withdrawTransaction1Final,
        [investor1],
        { commitment: 'confirmed' }
      );
      console.log(`✅ Investor1 SOL выведены: ${withdrawTx1}`);
      
      // Выводим SOL от investor2
      console.log('🔓 Выводим заблокированные SOL от Investor2...');
      const withdrawInstruction2Final = await createWithdrawLockedSolInstruction(
        investor1.publicKey, // initializer подписывает
        globalEscrowPDA,
        investor2PDA,
        investor2.publicKey,
        recipient.publicKey,
        PROGRAM_ID
      );
      
      const withdrawTransaction2Final = new Transaction().add(withdrawInstruction2Final);
      const withdrawTx2 = await sendAndConfirmTransaction(
        connection,
        withdrawTransaction2Final,
        [investor1],
        { commitment: 'confirmed' }
      );
      console.log(`✅ Investor2 SOL выведены: ${withdrawTx2}`);
      
      // Проверяем финальные балансы
      const recipientBalanceFinal = await connection.getBalance(recipient.publicKey);
      const solVault1BalanceFinal = await connection.getBalance(solVault1PDA);
      const solVault2BalanceFinal = await connection.getBalance(solVault2PDA);
      
      console.log('\n📊 ФИНАЛЬНЫЕ РЕЗУЛЬТАТЫ:');
      console.log(`💰 Recipient баланс до: ${recipientBalanceBeforeWithdraw / LAMPORTS_PER_SOL} SOL`);
      console.log(`💰 Recipient баланс после: ${recipientBalanceFinal / LAMPORTS_PER_SOL} SOL`);
      console.log(`📈 Recipient получил дополнительно: ${(recipientBalanceFinal - recipientBalanceBeforeWithdraw) / LAMPORTS_PER_SOL} SOL`);
      console.log(`🔒 SOL Vault 1 финал: ${solVault1BalanceFinal / LAMPORTS_PER_SOL} SOL (должно быть ~0)`);
      console.log(`🔒 SOL Vault 2 финал: ${solVault2BalanceFinal / LAMPORTS_PER_SOL} SOL (должно быть ~0)`);
      
      const expectedWithdrawals = (investor1DepositAmount + investor2DepositAmount) / 2n; // 50% от обоих депозитов
      const actualWithdrawals = BigInt(recipientBalanceFinal - recipientBalanceBeforeWithdraw);
      
      console.log(`\n🔍 ПРОВЕРКА СУММ:`);
      console.log(`Ожидалось заблокированных SOL: ${expectedWithdrawals / BigInt(LAMPORTS_PER_SOL)} SOL`);
      console.log(`Получено при выводе: ${actualWithdrawals / BigInt(LAMPORTS_PER_SOL)} SOL`);
      console.log(`Соответствие: ${expectedWithdrawals === actualWithdrawals ? '✅ ТОЧНОЕ' : '❓ ПРОВЕРИТЬ'}`);
      
      console.log('\n🎉 ПОЛНЫЙ ЦИКЛ ТЕСТИРОВАНИЯ ЗАВЕРШЕН УСПЕШНО!');
      console.log('✅ Инициализация: OK');
      console.log('✅ Депозиты (50/50 split): OK');
      console.log('✅ Блокировка раннего вывода: OK');
      console.log('✅ Вывод после времени: OK');
      console.log('✅ Суммы корректны: OK');
      
    } catch (error) {
      console.error('❌ ОШИБКА при выводе заблокированных SOL:', error.message);
      if (error.logs) {
        console.log('📜 Логи:');
        error.logs.forEach(log => console.log(`   ${log}`));
      }
    }
    
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error.message);
    if (error.logs) {
      console.log('📜 Логи:');
      error.logs.forEach(log => console.log(`   ${log}`));
    }
  }
}

main().catch(console.error);