import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "@nomicfoundation/hardhat-verify";
import { configVariable } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

// Build networks object conditionally
const networks: any = {
  hardhatMainnet: {
    type: "edr-simulated",
    chainType: "l1",
  },
  hardhatOp: {
    type: "edr-simulated",
    chainType: "op",
  },
};

// Only add BSC networks if private keys exist
if (process.env.BSC_PRIVATE_KEY) {
  networks.bsc = {
    type: "http",
    chainType: "l1",
    url: "https://bsc-dataseed1.binance.org/",
    accounts: [process.env.BSC_PRIVATE_KEY],
    gasPrice: 5000000000,
  };
}

if (process.env.BSC_TESTNET_PRIVATE_KEY) {
  networks.bscTestnet = {
    type: "http",
    chainType: "l1",
    url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
    accounts: [process.env.BSC_TESTNET_PRIVATE_KEY],
    gasPrice: 10000000000,
  };
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true, // Enable IR-based code generator to fix "stack too deep"
        },
      },
    ],
  },
  networks,
  etherscan: {
    apiKey: {
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
    },
  },
} as any;

export default config;
