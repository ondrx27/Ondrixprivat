import { ContractAddresses, NetworkInfo } from '../types';

export const CONTRACTS: ContractAddresses = {
  solana: {
    programId: "3HKy5EE7wqUTa7K2dCzAPrwUAbUFS2wrKGAvuWqjvTS6", // Updated Solana program with global timing + rent-exempt safety
    globalEscrow: "14C88oJ8ry14j437iMZ6gEFNfAeAZ7vhHq6q6749j6en", // Updated Global Escrow with initialization timestamp
    tokenMint: "FVDEgYKQa3vk9PMTK9YbeNnN31encknQiK8PoYUpq4US", // Updated Token mint address
  },
  bnb: {
    escrow: "0x5510F4394B597fB0c2c81D7Aa3d696e1c03DD59E", // FIXED: Contract with correct totalUnlocked calculation
    token: "0xaF2ee38881200df039189360DB7C554dE34Aeded", // FIXED: Mock ODX token for testing
    priceFeed: "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526", // BSC Testnet Chainlink BNB/USD
  }
};

export const NETWORKS: { solana: NetworkInfo; bnb: NetworkInfo } = {
  solana: {
    name: "Solana Devnet",
    chainId: "devnet",
    rpcUrl: "https://api.devnet.solana.com",
    blockExplorer: "https://explorer.solana.com",
    currency: {
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
    },
  },
  bnb: {
    name: "BSC Testnet",
    chainId: 97,
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    blockExplorer: "https://testnet.bscscan.com",
    currency: {
      name: "Test BNB",
      symbol: "tBNB",
      decimals: 18,
    },
  },
};

// Contract ABIs for SECURE version with enhanced functions
export const ESCROW_ABI = [
  // View functions
  "function getEscrowStatus() view returns (bool isInitialized, uint256 totalTokensAvailable, uint256 tokensSold, uint256 totalBnbDeposited, uint256 totalBnbWithdrawn, uint256 lockDuration)",
  "function getInvestorInfo(address investor) view returns (bool isInitialized, uint256 bnbDeposited, uint256 tokensReceived, uint256 depositTimestamp, uint256 firstDepositPrice, uint256 weightedAveragePrice, uint8 status, uint256 lockedBnbAmount)",
  "function isUnlockTime(address investor) view returns (bool)",
  "function getLockedBnbAmount(address investor) view returns (uint256)",
  "function calculateTokensForBnb(uint256 bnbAmount, uint256 bnbUsdPrice) view returns (uint256)",
  "function getPendingWithdrawal(address user) view returns (uint256)",
  "function emergencyStop() view returns (bool)",
  "function getChainlinkPrice() view returns (uint256 price, uint256 timestamp)",
  "function getInitializationTimestamp() view returns (uint256)",
  
  // NEW: Transparency functions for lock status
  "function totalDeposited() view returns (uint256)",
  "function totalUnlocked() view returns (uint256)", 
  "function totalLocked() view returns (uint256)",
  "function nextUnlockTime(address investor) view returns (uint256)",
  "function getInvestorLockStatus(address investor) view returns (uint256 totalInvested, uint256 immediateAmount, uint256 lockedAmount, uint256 unlockTime, bool isUnlocked, uint256 timeRemaining)",
  
  // Write functions
  "function depositBnb() payable",
  "function withdrawLockedBnb(address investor)",
  "function withdrawPendingBnb()",
  "function activateEmergencyStop()",
  "function deactivateEmergencyStop()",
  
  // Events
  "event BnbDeposited(address indexed investor, uint256 bnbAmount, uint256 tokensReceived, uint256 bnbPrice)",
  "event LockedBnbWithdrawn(address indexed investor, uint256 bnbAmount, address indexed recipientWallet)",
  "event WithdrawalQueued(address indexed recipient, uint256 amount)",
  "event EmergencyStopActivated()",
  "event EmergencyStopDeactivated()"
];

export const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

export const PRICE_FEED_ABI = [
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)"
];

// Constants
export const TOKEN_PRICE_USD = 0.1; // $0.10 per token
export const TOTAL_TOKEN_SUPPLY = 10000; // 10,000 tokens total supply (updated for secure contract)
export const MINIMUM_INVESTMENT_BNB = "0.001"; // 0.001 BNB minimum
export const MAXIMUM_INVESTMENT_BNB = "10"; // 10 BNB maximum
export const MINIMUM_INVESTMENT_SOL = "0.001"; // 0.001 SOL minimum  
export const MAXIMUM_INVESTMENT_SOL = "10"; // 10 SOL maximum

// Reown/WalletConnect configuration
export const REOWN_PROJECT_ID = process.env.VITE_REOWN_PROJECT_ID || '7b95bde23a23c6cb1bf4df1329c53791'

// Update intervals (in milliseconds)
export const UPDATE_INTERVALS = {
  ESCROW_DATA: 10000, // 10 seconds
  PRICE_DATA: 30000,  // 30 seconds
  INVESTOR_DATA: 5000, // 5 seconds
  UNLOCK_TIMER: 1000,  // 1 second
};
