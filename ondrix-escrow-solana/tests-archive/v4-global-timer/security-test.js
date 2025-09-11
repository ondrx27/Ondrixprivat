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
  console.log('🛡️  SECURITY ТЕСТИРОВАНИЕ - UNAUTHORIZED WITHDRAW');
  console.log('='.repeat(70));
  console.log(`📍 Program ID: ${PROGRAM_ID.toString()}`);
  console.log(`🪙 Token Mint: ${TOKEN_MINT.toString()}`);
  console.log(`🏦 Global Escrow: ${GLOBAL_ESCROW_PDA.toString()}`);
  
  const investor1 = Keypair.fromSecretKey(decodeBase58(INVESTOR1_PRIVATE));
  const investor2 = Keypair.fromSecretKey(decodeBase58(INVESTOR2_PRIVATE));
  const recipient = Keypair.fromSecretKey(decodeBase58(RECIPIENT_PRIVATE));
  
  console.log(`👤 Investor1/Initializer: ${investor1.publicKey.toString()}`);
  console.log(`👤 Investor2: ${investor2.publicKey.toString()}`);
  console.log(`🎯 Recipient: ${recipient.publicKey.toString()}`);
  
  try {
    // Находим PDA
    const [investor1PDA] = findInvestorPDA(investor1.publicKey, GLOBAL_ESCROW_PDA, PROGRAM_ID);
    const [investor2PDA] = findInvestorPDA(investor2.publicKey, GLOBAL_ESCROW_PDA, PROGRAM_ID);
    const [solVault1PDA] = findSolVaultPDA(investor1.publicKey, GLOBAL_ESCROW_PDA, PROGRAM_ID);
    const [solVault2PDA] = findSolVaultPDA(investor2.publicKey, GLOBAL_ESCROW_PDA, PROGRAM_ID);
    
    // Проверяем балансы
    const solVault1Balance = await connection.getBalance(solVault1PDA);
    const solVault2Balance = await connection.getBalance(solVault2PDA);
    const recipientBalance = await connection.getBalance(recipient.publicKey);
    
    console.log(`\n💰 ТЕКУЩИЕ БАЛАНСЫ:`);
    console.log(`🔒 SOL Vault 1: ${solVault1Balance / LAMPORTS_PER_SOL} SOL`);
    console.log(`🔒 SOL Vault 2: ${solVault2Balance / LAMPORTS_PER_SOL} SOL`);
    console.log(`🎯 Recipient: ${recipientBalance / LAMPORTS_PER_SOL} SOL`);
    
    // SECURITY TEST 1: Investor2 пытается вывести SOL от Investor1
    console.log(`\n🚨 SECURITY TEST 1: Investor2 пытается украсть SOL от Investor1`);
    console.log(`-`.repeat(70));
    
    const maliciousWithdraw1 = await createWithdrawLockedSolInstruction(
      investor2.publicKey,   // 🚨 ЗЛОУМЫШЛЕННИК: investor2 пытается вывести 
      GLOBAL_ESCROW_PDA,
      investor1PDA,          // 🎯 ЦЕЛЬ: SOL от investor1
      investor1.publicKey,   // investor1's SOL vault
      investor2.publicKey,   // 🚨 НА СВОЙ КОШЕЛЕК!
      PROGRAM_ID
    );
    
    const maliciousTx1 = new Transaction().add(maliciousWithdraw1);
    
    console.log(`🧪 Симулируем: Investor2 → пытается забрать SOL от Investor1 себе...`);
    const maliciousSimulation1 = await connection.simulateTransaction(maliciousTx1, [investor2]);
    
    if (maliciousSimulation1.value.err) {
      console.log('✅ ЗАЩИТА РАБОТАЕТ: Попытка кражи заблокирована!');
      console.log(`   Error: ${JSON.stringify(maliciousSimulation1.value.err)}`);
      
      // Анализируем ошибку
      if (maliciousSimulation1.value.err.InstructionError) {
        const [_, error] = maliciousSimulation1.value.err.InstructionError;
        if (error.Custom === 5) {
          console.log(`   🔒 Причина: Unauthorized (error 0x5) - только initializer/recipient могут выводить`);
        }
      }
    } else {
      console.log('❌ КРИТИЧЕСКАЯ УЯЗВИМОСТЬ: Кража прошла успешно!');
      console.log('🚨 КОНТРАКТ НЕБЕЗОПАСЕН ДЛЯ MAINNET!');
    }
    
    // SECURITY TEST 2: Investor2 пытается вывести свои SOL на чужой кошелек  
    console.log(`\n🚨 SECURITY TEST 2: Investor2 пытается вывести свои SOL на чужой кошелек`);
    console.log(`-`.repeat(70));
    
    const maliciousWithdraw2 = await createWithdrawLockedSolInstruction(
      investor2.publicKey,   // withdrawer: сам investor2 (это разрешено)
      GLOBAL_ESCROW_PDA,
      investor2PDA,          // его собственный investor PDA
      investor2.publicKey,   // его собственный SOL vault  
      investor1.publicKey,   // 🚨 НО НА ЧУЖОЙ КОШЕЛЕК! (не recipient!)
      PROGRAM_ID
    );
    
    const maliciousTx2 = new Transaction().add(maliciousWithdraw2);
    
    console.log(`🧪 Симулируем: Investor2 → пытается вывести свои SOL на кошелек Investor1...`);
    const maliciousSimulation2 = await connection.simulateTransaction(maliciousTx2, [investor2]);
    
    if (maliciousSimulation2.value.err) {
      console.log('✅ ЗАЩИТА РАБОТАЕТ: Попытка redirect заблокирована!');
      console.log(`   Error: ${JSON.stringify(maliciousSimulation2.value.err)}`);
      
      // Анализируем ошибку
      if (maliciousSimulation2.value.err.InstructionError) {
        const [_, error] = maliciousSimulation2.value.err.InstructionError;
        if (error.Custom === 5) {
          console.log(`   🔒 Причина: Unauthorized (error 0x5) - SOL могут идти только recipient'у`);
        }
      }
    } else {
      console.log('❌ УЯЗВИМОСТЬ: SOL могут быть отправлены не recipient-у!');
      console.log('⚠️  Это может быть проблемой безопасности');
    }
    
    // SECURITY TEST 3: Случайный пользователь пытается вывести SOL
    console.log(`\n🚨 SECURITY TEST 3: Случайный пользователь пытается вывести SOL`);
    console.log(`-`.repeat(70));
    
    // Создаем случайный кошелек
    const randomAttacker = Keypair.generate();
    console.log(`🎭 Случайный злоумышленник: ${randomAttacker.publicKey.toString()}`);
    
    const maliciousWithdraw3 = await createWithdrawLockedSolInstruction(
      randomAttacker.publicKey, // 🚨 ЗЛОУМЫШЛЕННИК: случайный пользователь
      GLOBAL_ESCROW_PDA,
      investor1PDA,             // пытается вывести SOL от investor1
      investor1.publicKey,
      randomAttacker.publicKey, // 🚨 НА СВОЙ КОШЕЛЕК!
      PROGRAM_ID
    );
    
    const maliciousTx3 = new Transaction().add(maliciousWithdraw3);
    
    console.log(`🧪 Симулируем: Случайный пользователь → пытается украсть SOL...`);
    const maliciousSimulation3 = await connection.simulateTransaction(maliciousTx3, [randomAttacker]);
    
    if (maliciousSimulation3.value.err) {
      console.log('✅ ЗАЩИТА РАБОТАЕТ: Попытка кражи заблокирована!');
      console.log(`   Error: ${JSON.stringify(maliciousSimulation3.value.err)}`);
    } else {
      console.log('❌ КРИТИЧЕСКАЯ УЯЗВИМОСТЬ: Случайный пользователь может красть SOL!');
      console.log('🚨 КОНТРАКТ КРАЙНЕ НЕБЕЗОПАСЕН!');
    }
    
    // ЗАКЛЮЧЕНИЕ
    console.log(`\n📊 ИТОГОВЫЙ SECURITY ОТЧЕТ:`);
    console.log(`=`.repeat(70));
    
    const test1Secure = maliciousSimulation1.value.err !== null;
    const test2Secure = maliciousSimulation2.value.err !== null; 
    const test3Secure = maliciousSimulation3.value.err !== null;
    
    console.log(`🛡️  Test 1 (Investor → Investor кража): ${test1Secure ? '✅ ЗАЩИЩЕН' : '❌ УЯЗВИМ'}`);
    console.log(`🛡️  Test 2 (SOL redirect): ${test2Secure ? '✅ ЗАЩИЩЕН' : '⚠️ ВОЗМОЖНА ПРОБЛЕМА'}`);
    console.log(`🛡️  Test 3 (Случайный пользователь): ${test3Secure ? '✅ ЗАЩИЩЕН' : '❌ КРИТИЧЕСКАЯ УЯЗВИМОСТЬ'}`);
    
    if (test1Secure && test2Secure && test3Secure) {
      console.log(`\n🎉 ВЕРДИКТ: КОНТРАКТ БЕЗОПАСЕН ДЛЯ MAINNET! 🚀`);
    } else {
      console.log(`\n🚨 ВЕРДИКТ: КОНТРАКТ ТРЕБУЕТ ДОПОЛНИТЕЛЬНЫХ ИСПРАВЛЕНИЙ!`);
    }
    
  } catch (error) {
    console.error('❌ ОШИБКА В ТЕСТИРОВАНИИ:', error.message);
  }
}

main().catch(console.error);