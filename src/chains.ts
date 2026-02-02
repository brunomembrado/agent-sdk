/**
 * Chain Configuration for PeetBet SDK
 * Contains all supported chains and their contract addresses
 */

import type { Chain } from "viem";
import {
  baseSepolia,
  sepolia,
  bscTestnet,
  base,
} from "viem/chains";

// ═══════════════════════════════════════════════════════════════════
// CHAIN NAMES - Use these strings for easy autocomplete
// ═══════════════════════════════════════════════════════════════════

/**
 * Supported chain names for PeetBet.
 * Use these strings when creating a PeetBetClient.
 *
 * @example
 * ```typescript
 * const client = new PeetBetClient({ chain: "baseSepolia" });
 * ```
 */
export type ChainName =
  | "baseSepolia"   // Base Sepolia Testnet (recommended for testing)
  | "sepolia"       // Ethereum Sepolia Testnet
  | "bscTestnet"    // BSC Testnet
  | "base";         // Base Mainnet (production)

/**
 * Chain IDs mapped to chain names for reference
 */
export const CHAIN_IDS = {
  baseSepolia: 84532,
  sepolia: 11155111,
  bscTestnet: 97,
  base: 8453,
} as const;

// ═══════════════════════════════════════════════════════════════════
// CHAIN CONFIG TYPE
// ═══════════════════════════════════════════════════════════════════

export interface PeetBetChainConfig {
  chain: Chain;
  chainId: number;
  name: string;
  shortName: ChainName;
  isTestnet: boolean;
  contracts: {
    peerBetCore: `0x${string}`;
    coinFlipGame: `0x${string}`;
    diceGame: `0x${string}`;
    peerBetViews: `0x${string}`;
    token: `0x${string}`;
  };
  vrfWrapper: `0x${string}`;
}

// ═══════════════════════════════════════════════════════════════════
// SUPPORTED CHAINS
// ═══════════════════════════════════════════════════════════════════

export const CHAIN_CONFIGS: Record<ChainName, PeetBetChainConfig> = {
  /**
   * Base Sepolia Testnet
   * - Recommended for testing (low gas fees)
   * - Chain ID: 84532
   */
  baseSepolia: {
    chain: baseSepolia,
    chainId: 84532,
    name: "Base Sepolia",
    shortName: "baseSepolia",
    isTestnet: true,
    contracts: {
      peerBetCore: "0x43ebe246f06ac9815e2fab62592a51e6cc27f2d9",
      coinFlipGame: "0x64af3ba41f55159a1e2dab4e812b547274ea3089",
      diceGame: "0x444544a40c1cfc9849630f8bd335ec293bf4c01d",
      peerBetViews: "0xabc1cbc11e3e498665faccc6021fd6409a75d881",
      token: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
    },
    vrfWrapper: "0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed",
  },

  /**
   * Ethereum Sepolia Testnet
   * - Chain ID: 11155111
   */
  sepolia: {
    chain: sepolia,
    chainId: 11155111,
    name: "Ethereum Sepolia",
    shortName: "sepolia",
    isTestnet: true,
    contracts: {
      peerBetCore: "0x10ff96bf5caebd530d5b0db07914dec7f04751cf",
      coinFlipGame: "0xe7a07a10ab2111fcd39023332bf945972f6982c8",
      diceGame: "0xd752455d46b336e2d088837ac14c36c51a60e5fa",
      peerBetViews: "0x0a444c1dca2364077100d8baf2bcb95ff255ed87",
      token: "0xcac524bca292aaade2df8a05cc58f0a65b1b3bb9",
    },
    vrfWrapper: "0x195f15F2d49d693cE265b4fB0fdDbE15b1850Cc1",
  },

  /**
   * BSC Testnet
   * - Chain ID: 97
   */
  bscTestnet: {
    chain: bscTestnet,
    chainId: 97,
    name: "BSC Testnet",
    shortName: "bscTestnet",
    isTestnet: true,
    contracts: {
      peerBetCore: "0xbc04429d4e9a9a2069026006f4fdce4689011092",
      coinFlipGame: "0xd5889124c5ea7dfe61e89994fec18764a92bd642",
      diceGame: "0x9c3182d0f9ba5ae663ffc537daae10ac7e45c490",
      peerBetViews: "0x4182146db51a7de373655800c1757c67a00c494d",
      token: "0x64544969ed7ebf5f083679233325356ebe738930",
    },
    vrfWrapper: "0x471506e6ADED0b9811D05B8cAc8Db25eE839Ac94",
  },

  /**
   * Base Mainnet (Production)
   * - Chain ID: 8453
   * - Real money - use with caution
   */
  base: {
    chain: base,
    chainId: 8453,
    name: "Base",
    shortName: "base",
    isTestnet: false,
    contracts: {
      peerBetCore: "0xa5efef6b29f093b10f07a7598fedb9716907015d",
      coinFlipGame: "0x57d82907fe211a34cde047fc107aab2962efdf2f",
      diceGame: "0xee7359ffdeb0af5d8ccf0ef42c0ad6e2f808226c",
      peerBetViews: "0x8ca77bdf300f66e7e916482cfaacfcdb652b3f3f",
      token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    },
    vrfWrapper: "0xb0407dbe851f8318bd31404A49e658143C982F23",
  },
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get chain config by chain name
 *
 * @example
 * ```typescript
 * const config = getChainConfig("baseSepolia");
 * console.log(config.chainId); // 84532
 * ```
 */
export function getChainConfig(chain: ChainName): PeetBetChainConfig {
  return CHAIN_CONFIGS[chain];
}

/**
 * Get chain config by chain ID
 *
 * @example
 * ```typescript
 * const config = getChainConfigById(84532);
 * console.log(config?.name); // "Base Sepolia"
 * ```
 */
export function getChainConfigById(chainId: number): PeetBetChainConfig | undefined {
  return Object.values(CHAIN_CONFIGS).find((c) => c.chainId === chainId);
}

/**
 * Get all supported chain names
 *
 * @returns Array of chain names: ["baseSepolia", "sepolia", "bscTestnet", "base"]
 */
export function getSupportedChains(): ChainName[] {
  return Object.keys(CHAIN_CONFIGS) as ChainName[];
}

/**
 * Get all testnet chains
 */
export function getTestnetChains(): PeetBetChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter((c) => c.isTestnet);
}

/**
 * Get all mainnet chains
 */
export function getMainnetChains(): PeetBetChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter((c) => !c.isTestnet);
}

/**
 * Check if a chain name is valid
 */
export function isValidChain(chain: string): chain is ChainName {
  return chain in CHAIN_CONFIGS;
}
