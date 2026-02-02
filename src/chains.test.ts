import { describe, it, expect } from "vitest";
import {
  CHAIN_CONFIGS,
  CHAIN_IDS,
  getChainConfig,
  getChainConfigById,
  getSupportedChains,
  getTestnetChains,
  getMainnetChains,
  isValidChain,
  type ChainName,
} from "./chains";

describe("chains", () => {
  describe("CHAIN_CONFIGS", () => {
    it("should have all expected chains", () => {
      expect(Object.keys(CHAIN_CONFIGS)).toEqual([
        "baseSepolia",
        "sepolia",
        "bscTestnet",
        "base",
      ]);
    });

    it("should have valid contract addresses for baseSepolia", () => {
      const config = CHAIN_CONFIGS.baseSepolia;
      expect(config.chainId).toBe(84532);
      expect(config.name).toBe("Base Sepolia");
      expect(config.shortName).toBe("baseSepolia");
      expect(config.isTestnet).toBe(true);
      expect(config.contracts.peerBetCore).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(config.contracts.coinFlipGame).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(config.contracts.diceGame).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(config.contracts.peerBetViews).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(config.contracts.token).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it("should have valid contract addresses for sepolia", () => {
      const config = CHAIN_CONFIGS.sepolia;
      expect(config.chainId).toBe(11155111);
      expect(config.isTestnet).toBe(true);
    });

    it("should have valid contract addresses for bscTestnet", () => {
      const config = CHAIN_CONFIGS.bscTestnet;
      expect(config.chainId).toBe(97);
      expect(config.isTestnet).toBe(true);
    });

    it("should have valid contract addresses for base mainnet", () => {
      const config = CHAIN_CONFIGS.base;
      expect(config.chainId).toBe(8453);
      expect(config.name).toBe("Base");
      expect(config.isTestnet).toBe(false);
    });
  });

  describe("CHAIN_IDS", () => {
    it("should have correct chain IDs", () => {
      expect(CHAIN_IDS.baseSepolia).toBe(84532);
      expect(CHAIN_IDS.sepolia).toBe(11155111);
      expect(CHAIN_IDS.bscTestnet).toBe(97);
      expect(CHAIN_IDS.base).toBe(8453);
    });
  });

  describe("getChainConfig", () => {
    it("should return config for valid chain name", () => {
      const config = getChainConfig("baseSepolia");
      expect(config.chainId).toBe(84532);
      expect(config.name).toBe("Base Sepolia");
    });

    it("should return config for all supported chains", () => {
      const chains: ChainName[] = ["baseSepolia", "sepolia", "bscTestnet", "base"];
      for (const chain of chains) {
        const config = getChainConfig(chain);
        expect(config).toBeDefined();
        expect(config.shortName).toBe(chain);
      }
    });
  });

  describe("getChainConfigById", () => {
    it("should return config for valid chain ID", () => {
      const config = getChainConfigById(84532);
      expect(config).toBeDefined();
      expect(config?.name).toBe("Base Sepolia");
    });

    it("should return undefined for invalid chain ID", () => {
      const config = getChainConfigById(999999);
      expect(config).toBeUndefined();
    });

    it("should find all chains by ID", () => {
      expect(getChainConfigById(84532)?.shortName).toBe("baseSepolia");
      expect(getChainConfigById(11155111)?.shortName).toBe("sepolia");
      expect(getChainConfigById(97)?.shortName).toBe("bscTestnet");
      expect(getChainConfigById(8453)?.shortName).toBe("base");
    });
  });

  describe("getSupportedChains", () => {
    it("should return all chain names", () => {
      const chains = getSupportedChains();
      expect(chains).toHaveLength(4);
      expect(chains).toContain("baseSepolia");
      expect(chains).toContain("sepolia");
      expect(chains).toContain("bscTestnet");
      expect(chains).toContain("base");
    });
  });

  describe("getTestnetChains", () => {
    it("should return only testnet chains", () => {
      const testnets = getTestnetChains();
      expect(testnets).toHaveLength(3);
      expect(testnets.every((c) => c.isTestnet)).toBe(true);
      expect(testnets.map((c) => c.shortName)).toContain("baseSepolia");
      expect(testnets.map((c) => c.shortName)).toContain("sepolia");
      expect(testnets.map((c) => c.shortName)).toContain("bscTestnet");
    });
  });

  describe("getMainnetChains", () => {
    it("should return only mainnet chains", () => {
      const mainnets = getMainnetChains();
      expect(mainnets).toHaveLength(1);
      expect(mainnets.every((c) => !c.isTestnet)).toBe(true);
      expect(mainnets[0].shortName).toBe("base");
    });
  });

  describe("isValidChain", () => {
    it("should return true for valid chain names", () => {
      expect(isValidChain("baseSepolia")).toBe(true);
      expect(isValidChain("sepolia")).toBe(true);
      expect(isValidChain("bscTestnet")).toBe(true);
      expect(isValidChain("base")).toBe(true);
    });

    it("should return false for invalid chain names", () => {
      expect(isValidChain("invalid")).toBe(false);
      expect(isValidChain("ethereum")).toBe(false);
      expect(isValidChain("mainnet")).toBe(false);
      expect(isValidChain("")).toBe(false);
    });
  });
});
