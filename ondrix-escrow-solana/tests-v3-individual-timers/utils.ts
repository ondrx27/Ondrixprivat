import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createMint,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from '@solana/spl-token';

export const PROGRAM_ID = new PublicKey('DeVqsy8BEgiKGmyYGiaYV79mn9C7iNnGV5FdXW4zMEhf'); // V3 deployment with all security fixes

// PDA helper functions matching Rust implementation
export function findGlobalEscrowPDA(
  initializer: PublicKey,
  tokenMint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('global_escrow'), initializer.toBuffer(), tokenMint.toBuffer()],
    programId
  );
}

export function findInvestorPDA(
  investor: PublicKey,
  globalEscrow: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('investor'), investor.toBuffer(), globalEscrow.toBuffer()],
    programId
  );
}

export function findTokenVaultPDA(
  globalEscrow: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('token_vault'), globalEscrow.toBuffer()],
    programId
  );
}

export function findSolVaultPDA(
  investor: PublicKey,
  globalEscrow: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('sol_vault'), investor.toBuffer(), globalEscrow.toBuffer()],
    programId
  );
}

export enum EscrowInstruction {
  InitializeEscrow = 0,
  DepositSol = 1,
  WithdrawLockedSol = 2,
  GetEscrowStatus = 3,
}

export class EscrowInstructionData {
  instruction: EscrowInstruction;
  tokenAmount?: bigint;
  lockDuration?: bigint;
  solAmount?: bigint;

  constructor(instruction: EscrowInstruction, params?: { tokenAmount?: bigint; lockDuration?: bigint; solAmount?: bigint }) {
    this.instruction = instruction;
    this.tokenAmount = params?.tokenAmount;
    this.lockDuration = params?.lockDuration;
    this.solAmount = params?.solAmount;
  }

  serialize(): Buffer {
    const buffers: Buffer[] = [];
    
    // Add instruction type
    buffers.push(Buffer.from([this.instruction]));
    
    if (this.instruction === EscrowInstruction.InitializeEscrow) {
      if (!this.tokenAmount || !this.lockDuration) {
        throw new Error('Token amount and lock duration required for InitializeEscrow');
      }
      
      // Add token amount (8 bytes, little endian)
      const tokenAmountBuffer = Buffer.alloc(8);
      tokenAmountBuffer.writeBigUInt64LE(this.tokenAmount);
      buffers.push(tokenAmountBuffer);
      
      // Add lock duration (8 bytes, little endian)  
      const lockDurationBuffer = Buffer.alloc(8);
      lockDurationBuffer.writeBigInt64LE(this.lockDuration);
      buffers.push(lockDurationBuffer);
    }

    if (this.instruction === EscrowInstruction.DepositSol) {
      if (!this.solAmount) {
        throw new Error('SOL amount required for DepositSol');
      }
      
      // Add SOL amount (8 bytes, little endian)
      const solAmountBuffer = Buffer.alloc(8);
      solAmountBuffer.writeBigUInt64LE(this.solAmount);
      buffers.push(solAmountBuffer);
    }
    
    return Buffer.concat(buffers);
  }
}

// Legacy function for backward compatibility
export async function findEscrowPDA(investor: PublicKey, programId: PublicKey): Promise<[PublicKey, number]> {
  // This is now findInvestorPDA, but we need a globalEscrow address
  // For compatibility, we'll throw an error suggesting the new approach
  throw new Error('Use findInvestorPDA with globalEscrow address instead');
}

export async function createInitializeEscrowInstruction(
  initializer: PublicKey,
  tokenMint: PublicKey,
  tokenSourceAccount: PublicKey,
  recipientWallet: PublicKey,
  tokenAmount: bigint,
  lockDuration: bigint,
  programId: PublicKey
): Promise<TransactionInstruction> {
  const [globalEscrowPDA] = findGlobalEscrowPDA(initializer, tokenMint, programId);
  const [tokenVaultPDA] = findTokenVaultPDA(globalEscrowPDA, programId);
  
  const data = new EscrowInstructionData(
    EscrowInstruction.InitializeEscrow,
    { tokenAmount, lockDuration }
  );

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: initializer, isSigner: true, isWritable: true },
      { pubkey: globalEscrowPDA, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: tokenVaultPDA, isSigner: false, isWritable: true },
      { pubkey: tokenSourceAccount, isSigner: false, isWritable: true },
      { pubkey: recipientWallet, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: data.serialize(),
  });
}

export async function createDepositSolInstruction(
  investor: PublicKey,
  globalEscrowAccount: PublicKey,
  tokenMint: PublicKey,
  recipientWallet: PublicKey,
  solAmount: bigint,
  programId: PublicKey
): Promise<TransactionInstruction> {
  const [investorPDA] = findInvestorPDA(investor, globalEscrowAccount, programId);
  const [solVaultPDA] = findSolVaultPDA(investor, globalEscrowAccount, programId);
  const [tokenVaultPDA] = findTokenVaultPDA(globalEscrowAccount, programId);
  
  const investorTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    investor
  );

  // Chainlink SOL/USD feed addresses for Devnet (working addresses from your contract)
  const priceFeed = new PublicKey([120, 245, 122, 225, 25, 94, 140, 73, 122, 139, 224, 84, 173, 82, 173, 244, 200, 151, 111, 132, 54, 115, 35, 9, 226, 42, 247, 6, 119, 36, 173, 150]);
  const oracleProgram = new PublicKey([241, 75, 246, 90, 213, 107, 210, 186, 113, 94, 69, 116, 44, 35, 31, 39, 214, 54, 33, 207, 91, 119, 143, 55, 193, 162, 72, 149, 29, 23, 86, 2]);

  const data = new EscrowInstructionData(
    EscrowInstruction.DepositSol,
    { solAmount }
  );

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: investor, isSigner: true, isWritable: true },
      { pubkey: globalEscrowAccount, isSigner: false, isWritable: true },
      { pubkey: investorPDA, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: tokenVaultPDA, isSigner: false, isWritable: true },
      { pubkey: investorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: recipientWallet, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: oracleProgram, isSigner: false, isWritable: false },
      { pubkey: priceFeed, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
    ],
    data: data.serialize(),
  });
}

export async function createWithdrawLockedSolInstruction(
  withdrawer: PublicKey,
  globalEscrowAccount: PublicKey,
  investorAccount: PublicKey,
  investor: PublicKey, // Need investor pubkey to find SOL vault
  recipientWallet: PublicKey, // Recipient wallet that receives the locked SOL
  programId: PublicKey
): Promise<TransactionInstruction> {
  const [solVaultPDA] = findSolVaultPDA(investor, globalEscrowAccount, programId);
  
  const data = new EscrowInstructionData(EscrowInstruction.WithdrawLockedSol);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: withdrawer, isSigner: true, isWritable: true },
      { pubkey: globalEscrowAccount, isSigner: false, isWritable: true },
      { pubkey: investorAccount, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: recipientWallet, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: data.serialize(),
  });
}

export async function createGetEscrowStatusInstruction(
  globalEscrowAccount: PublicKey,
  programId: PublicKey
): Promise<TransactionInstruction> {
  const data = new EscrowInstructionData(EscrowInstruction.GetEscrowStatus);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: globalEscrowAccount, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: data.serialize(),
  });
}

export async function createTokenMint(
  connection: Connection,
  payer: Keypair,
  mintAuthority: PublicKey,
  decimals: number = 6
): Promise<PublicKey> {
  const mint = await createMint(
    connection,
    payer,
    mintAuthority,
    null,
    decimals
  );
  
  return mint;
}

export async function fundAccount(
  connection: Connection,
  payer: Keypair,
  target: PublicKey,
  amount: number
): Promise<void> {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: target,
      lamports: amount,
    })
  );
  
  await sendAndConfirmTransaction(connection, transaction, [payer]);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}