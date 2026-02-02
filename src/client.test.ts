import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { PeetBetClient } from "./client";
import { CHAIN_CONFIGS } from "./chains";

// Mock viem
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: vi.fn(),
      waitForTransactionReceipt: vi.fn(),
      watchContractEvent: vi.fn(),
      estimateFeesPerGas: vi.fn().mockResolvedValue({
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 1000000n,
      }),
    })),
    createWalletClient: vi.fn(() => ({
      writeContract: vi.fn(),
    })),
  };
});

vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn((_key: string) => ({
    address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
  })),
}));

describe("PeetBetClient", () => {
  describe("constructor", () => {
    it("should create a read-only client without private key", () => {
      const client = new PeetBetClient({ chain: "baseSepolia" });

      expect(client.address).toBeNull();
      expect(client.chain.chainId).toBe(84532);
      expect(client.chain.name).toBe("Base Sepolia");
    });

    it("should create a full client with private key", () => {
      const client = new PeetBetClient({
        chain: "baseSepolia",
        privateKey: "0x1234567890123456789012345678901234567890123456789012345678901234",
      });

      expect(client.address).toBe("0x1234567890123456789012345678901234567890");
    });

    it("should support all chain names", () => {
      const chains = ["baseSepolia", "sepolia", "bscTestnet", "base"] as const;

      for (const chain of chains) {
        const client = new PeetBetClient({ chain });
        expect(client.chain.shortName).toBe(chain);
        expect(client.chain.chainId).toBe(CHAIN_CONFIGS[chain].chainId);
      }
    });

    it("should correctly identify testnet vs mainnet", () => {
      const testnetClient = new PeetBetClient({ chain: "baseSepolia" });
      expect(testnetClient.chain.isTestnet).toBe(true);

      const mainnetClient = new PeetBetClient({ chain: "base" });
      expect(mainnetClient.chain.isTestnet).toBe(false);
    });
  });

  describe("getters", () => {
    it("should return chain config", () => {
      const client = new PeetBetClient({ chain: "baseSepolia" });

      expect(client.chain).toEqual(CHAIN_CONFIGS.baseSepolia);
    });

    it("should return contract addresses", () => {
      const client = new PeetBetClient({ chain: "baseSepolia" });

      expect(client.contracts).toEqual(CHAIN_CONFIGS.baseSepolia.contracts);
      expect(client.contracts.peerBetCore).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(client.contracts.coinFlipGame).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(client.contracts.diceGame).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(client.contracts.token).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe("formatTokens", () => {
    let client: PeetBetClient;

    beforeEach(() => {
      client = new PeetBetClient({ chain: "baseSepolia" });
    });

    it("should format whole numbers", () => {
      expect(client.formatTokens(1000000n)).toBe("1");
      expect(client.formatTokens(10000000n)).toBe("10");
      expect(client.formatTokens(100000000n)).toBe("100");
    });

    it("should format decimal numbers", () => {
      expect(client.formatTokens(1500000n)).toBe("1.5");
      expect(client.formatTokens(1250000n)).toBe("1.25");
      expect(client.formatTokens(100n)).toBe("0.0001");
    });

    it("should format zero", () => {
      expect(client.formatTokens(0n)).toBe("0");
    });

    it("should support custom decimals", () => {
      expect(client.formatTokens(1000000000000000000n, 18)).toBe("1");
    });
  });

  describe("parseTokens", () => {
    let client: PeetBetClient;

    beforeEach(() => {
      client = new PeetBetClient({ chain: "baseSepolia" });
    });

    it("should parse whole numbers", () => {
      expect(client.parseTokens("1")).toBe(1000000n);
      expect(client.parseTokens("10")).toBe(10000000n);
      expect(client.parseTokens("100")).toBe(100000000n);
    });

    it("should parse decimal numbers", () => {
      expect(client.parseTokens("1.5")).toBe(1500000n);
      expect(client.parseTokens("1.25")).toBe(1250000n);
      expect(client.parseTokens("0.0001")).toBe(100n);
    });

    it("should parse zero", () => {
      expect(client.parseTokens("0")).toBe(0n);
    });

    it("should support custom decimals", () => {
      expect(client.parseTokens("1", 18)).toBe(1000000000000000000n);
    });
  });

  describe("wallet-required methods", () => {
    it("should throw when calling write methods without wallet", async () => {
      const client = new PeetBetClient({ chain: "baseSepolia" });

      await expect(client.deposit(1000000n)).rejects.toThrow(
        "Wallet not configured"
      );
      await expect(client.withdraw()).rejects.toThrow("Wallet not configured");
      await expect(client.approveTokens(1000000n)).rejects.toThrow(
        "Wallet not configured"
      );
      await expect(
        client.createCoinFlipRoom({ betAmount: 1 })
      ).rejects.toThrow("Wallet not configured");
      await expect(client.joinCoinFlipRoom({ roomId: 1n })).rejects.toThrow(
        "Wallet not configured"
      );
      await expect(client.cancelCoinFlipRoom(1n)).rejects.toThrow(
        "Wallet not configured"
      );
      await expect(
        client.createDiceRoom({ betAmount: 1, maxPlayers: 4 })
      ).rejects.toThrow("Wallet not configured");
      await expect(
        client.joinDiceRoom({ roomId: 1n, currentPlayers: 1, maxPlayers: 4 })
      ).rejects.toThrow("Wallet not configured");
      await expect(client.leaveDiceRoom(1n)).rejects.toThrow(
        "Wallet not configured"
      );
      await expect(client.cancelDiceRoom(1n)).rejects.toThrow(
        "Wallet not configured"
      );
      await expect(client.startDiceGame(1n)).rejects.toThrow(
        "Wallet not configured"
      );
    });
  });

  describe("address-required methods", () => {
    it("should throw when calling address methods without address", async () => {
      const client = new PeetBetClient({ chain: "baseSepolia" });

      await expect(client.getBalance()).rejects.toThrow("No address provided");
      await expect(client.getTokenBalance()).rejects.toThrow(
        "No address provided"
      );
      await expect(client.getTokenAllowance()).rejects.toThrow(
        "No address provided"
      );
      await expect(client.getPlayerStats()).rejects.toThrow(
        "No address provided"
      );
      await expect(client.getPlayerCoinFlipWaitingRooms()).rejects.toThrow(
        "No address provided"
      );
      await expect(client.getPlayerDiceWaitingRooms()).rejects.toThrow(
        "No address provided"
      );
    });

    it("should accept explicit address parameter", async () => {
      const client = new PeetBetClient({ chain: "baseSepolia" });
      const testAddress = "0xabcdef0123456789abcdef0123456789abcdef01" as `0x${string}`;

      // These should not throw "No address provided" but may fail at mock level
      // The important thing is they accept the address parameter
      try {
        await client.getBalance(testAddress);
      } catch (e) {
        // Mock not set up, but at least didn't throw "No address provided"
        expect((e as Error).message).not.toContain("No address provided");
      }
    });
  });

  describe("read operations with mocked responses", () => {
    let client: PeetBetClient;
    let mockReadContract: Mock;

    beforeEach(async () => {
      const viem = await import("viem");
      mockReadContract = vi.fn();

      (viem.createPublicClient as Mock).mockReturnValue({
        readContract: mockReadContract,
        watchContractEvent: vi.fn(),
        waitForTransactionReceipt: vi.fn(),
        estimateFeesPerGas: vi.fn().mockResolvedValue({
          maxFeePerGas: 1000000000n,
          maxPriorityFeePerGas: 1000000n,
        }),
      });

      client = new PeetBetClient({
        chain: "baseSepolia",
        privateKey:
          "0x1234567890123456789012345678901234567890123456789012345678901234",
      });
    });

    it("should get balance", async () => {
      mockReadContract.mockResolvedValueOnce(5000000n);

      const balance = await client.getBalance();
      expect(balance).toBe(5000000n);
    });

    it("should get allowed bet sizes", async () => {
      mockReadContract.mockResolvedValueOnce([1000000n, 5000000n, 10000000n]);

      const betSizes = await client.getAllowedBetSizes();
      expect(betSizes).toEqual([1000000n, 5000000n, 10000000n]);
    });

    it("should get security status", async () => {
      mockReadContract.mockResolvedValueOnce([true, true, false, false]);

      const status = await client.getSecurityStatus();
      expect(status).toEqual({
        casinoEnabled: true,
        houseGamblingEnabled: true,
        autoCleanupEnabled: false,
        casinoShutdown: false,
      });
    });

    it("should get CoinFlip waiting rooms", async () => {
      mockReadContract.mockResolvedValueOnce([[1n, 2n, 3n], 3n]);

      const result = await client.getCoinFlipWaitingRooms();
      expect(result.items).toEqual([1n, 2n, 3n]);
      expect(result.total).toBe(3n);
    });

    it("should get CoinFlip room details", async () => {
      mockReadContract.mockResolvedValueOnce({
        id: 1n,
        roomNumber: 1n,
        createdAt: 1704067200n,
        playerA: "0x1111111111111111111111111111111111111111",
        playerB: "0x0000000000000000000000000000000000000000",
        betAmount: 1000000n,
        isActive: true,
        winner: "0x0000000000000000000000000000000000000000",
        isHouseGame: false,
        isChallenge: false,
        completedAt: 0n,
        randomWord: 0n,
        vrfRequestId: 0n,
        houseEdgeBps: 100,
      });

      const room = await client.getCoinFlipRoom(1n);
      expect(room.id).toBe(1n);
      expect(room.betAmount).toBe(1000000n);
      expect(room.isActive).toBe(true);
      expect(room.playerA).toBe("0x1111111111111111111111111111111111111111");
    });

    it("should get Dice waiting rooms", async () => {
      mockReadContract.mockResolvedValueOnce([[1n, 2n], 2n]);

      const result = await client.getDiceWaitingRooms();
      expect(result.items).toEqual([1n, 2n]);
      expect(result.total).toBe(2n);
    });

    it("should get Dice room details", async () => {
      mockReadContract.mockResolvedValueOnce({
        id: 1n,
        roomNumber: 1n,
        creator: "0x1111111111111111111111111111111111111111",
        betAmount: 1000000n,
        maxPlayers: 4,
        currentPlayers: 2,
        isActive: true,
        hasStarted: false,
        winningNumber: 0,
        winner: "0x0000000000000000000000000000000000000000",
        createdAt: 1704067200n,
        completedAt: 0n,
        isPrivate: false,
      });

      const room = await client.getDiceRoom(1n);
      expect(room.id).toBe(1n);
      expect(room.maxPlayers).toBe(4);
      expect(room.currentPlayers).toBe(2);
      expect(room.isActive).toBe(true);
    });

    it("should get CoinFlip stats", async () => {
      mockReadContract
        .mockResolvedValueOnce(100n) // totalGamesPlayed
        .mockResolvedValueOnce(150n); // totalRoomsCreated

      const totalGames = await client.getCoinFlipTotalGames();
      const totalRooms = await client.getCoinFlipTotalRooms();

      expect(totalGames).toBe(100n);
      expect(totalRooms).toBe(150n);
    });

    it("should get game active status", async () => {
      mockReadContract
        .mockResolvedValueOnce(true) // CoinFlip active
        .mockResolvedValueOnce(false); // Dice active

      expect(await client.isCoinFlipActive()).toBe(true);
      expect(await client.isDiceActive()).toBe(false);
    });

    it("should support pagination options", async () => {
      mockReadContract.mockResolvedValueOnce([[1n, 2n], 10n]);

      const result = await client.getCoinFlipWaitingRooms({
        offset: 5n,
        limit: 10n,
      });

      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          args: [5n, 10n],
        })
      );
      expect(result.total).toBe(10n);
    });
  });

  describe("token formatting edge cases", () => {
    let client: PeetBetClient;

    beforeEach(() => {
      client = new PeetBetClient({ chain: "baseSepolia" });
    });

    it("should handle very large amounts", () => {
      const largeAmount = 1000000000000n; // 1 million USDC
      expect(client.formatTokens(largeAmount)).toBe("1000000");
    });

    it("should handle very small amounts", () => {
      expect(client.formatTokens(1n)).toBe("0.000001");
    });

    it("should round-trip parse and format", () => {
      const amounts = ["1", "10", "100.5", "0.123456"];
      for (const amount of amounts) {
        const parsed = client.parseTokens(amount);
        const formatted = client.formatTokens(parsed);
        expect(formatted).toBe(amount);
      }
    });
  });

  describe("chain configurations", () => {
    it("should have correct contracts for baseSepolia", () => {
      const client = new PeetBetClient({ chain: "baseSepolia" });
      expect(client.contracts.peerBetCore).toBe(
        "0x43ebe246f06ac9815e2fab62592a51e6cc27f2d9"
      );
    });

    it("should have correct contracts for sepolia", () => {
      const client = new PeetBetClient({ chain: "sepolia" });
      expect(client.contracts.peerBetCore).toBe(
        "0x10ff96bf5caebd530d5b0db07914dec7f04751cf"
      );
    });

    it("should have correct contracts for bscTestnet", () => {
      const client = new PeetBetClient({ chain: "bscTestnet" });
      expect(client.contracts.peerBetCore).toBe(
        "0xbc04429d4e9a9a2069026006f4fdce4689011092"
      );
    });

    it("should have correct contracts for base mainnet", () => {
      const client = new PeetBetClient({ chain: "base" });
      expect(client.contracts.peerBetCore).toBe(
        "0xa5efef6b29f093b10f07a7598fedb9716907015d"
      );
    });
  });
});
