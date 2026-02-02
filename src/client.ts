/**
 * PeetBet SDK Client
 *
 * The main client for interacting with PeetBet smart contracts.
 * Use this to read room data, create/join games, and manage your balance.
 *
 * @example
 * ```typescript
 * import { PeetBetClient } from '@peetbet/sdk';
 *
 * // Create a read-only client
 * const reader = new PeetBetClient({ chain: "baseSepolia" });
 *
 * // Create a client with wallet for transactions
 * const client = new PeetBetClient({
 *   chain: "baseSepolia",
 *   privateKey: process.env.PRIVATE_KEY as `0x${string}`,
 * });
 *
 * // Get waiting rooms and join one
 * const rooms = await client.getCoinFlipWaitingRooms();
 * if (rooms.items.length > 0) {
 *   await client.joinCoinFlipRoom({ roomId: rooms.items[0] });
 * }
 * ```
 *
 * @packageDocumentation
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  type PublicClient,
  type WalletClient,
  type Hash,
  type Log,
  type WatchEventReturnType,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getChainConfig, type PeetBetChainConfig } from "./chains";
import {
  peerBetCoreAbi,
  coinFlipGameAbi,
  diceGameAbi,
  erc20Abi,
} from "./abi";
import type {
  PeetBetClientOptions,
  CoinFlipRoom,
  DiceRoom,
  TransactionResult,
  VrfCostEstimate,
  CreateRoomOptions,
  CreateDiceRoomOptions,
  JoinRoomOptions,
  JoinDiceRoomOptions,
  PaginationOptions,
  PaginatedResult,
  PlayerStats,
  SecurityStatus,
  GameCompletedEvent,
  CoinFlipGameResult,
  DiceGameResult,
  WaitForResultOptions,
} from "./types";

// VRF Wrapper ABI (minimal - just what we need for VRF v2.5 Direct Funding)
const vrfWrapperAbi = [
  {
    inputs: [
      { internalType: "uint32", name: "_callbackGasLimit", type: "uint32" },
      { internalType: "uint32", name: "_numWords", type: "uint32" },
      { internalType: "uint256", name: "_requestGasPriceWei", type: "uint256" },
    ],
    name: "estimateRequestPriceNative",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ═══════════════════════════════════════════════════════════════════
// PEETBET CLIENT
// ═══════════════════════════════════════════════════════════════════

/**
 * PeetBet SDK Client
 *
 * The main entry point for interacting with PeetBet.
 * Supports both read-only mode and full transaction mode.
 *
 * @example
 * ```typescript
 * // Read-only (no privateKey needed)
 * const reader = new PeetBetClient({ chain: "baseSepolia" });
 * const rooms = await reader.getCoinFlipWaitingRooms();
 *
 * // With wallet for transactions
 * const client = new PeetBetClient({
 *   chain: "baseSepolia",
 *   privateKey: "0x...",
 * });
 * await client.createCoinFlipRoom({ betAmount: 1000000n });
 * ```
 */
export class PeetBetClient {
  private publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private account: ReturnType<typeof privateKeyToAccount> | null = null;
  private chainConfig: PeetBetChainConfig;

  /**
   * Create a new PeetBet client.
   *
   * @param options - Configuration options
   * @param options.chain - Chain to connect to: "baseSepolia" | "sepolia" | "bscTestnet" | "base"
   * @param options.privateKey - Private key for transactions (optional for read-only)
   * @param options.rpcUrl - Custom RPC URL (optional)
   *
   * @example
   * ```typescript
   * // Testnet (recommended for development)
   * const client = new PeetBetClient({ chain: "baseSepolia" });
   *
   * // With wallet
   * const client = new PeetBetClient({
   *   chain: "baseSepolia",
   *   privateKey: "0x...",
   * });
   *
   * // Mainnet (real money!)
   * const client = new PeetBetClient({
   *   chain: "base",
   *   privateKey: "0x...",
   * });
   * ```
   */
  constructor(options: PeetBetClientOptions) {
    const config = getChainConfig(options.chain);
    this.chainConfig = config;

    // Create public client for reads
    this.publicClient = createPublicClient({
      chain: config.chain,
      transport: http(options.rpcUrl),
    });

    // Create wallet client if private key provided
    if (options.privateKey) {
      this.account = privateKeyToAccount(options.privateKey);
      this.walletClient = createWalletClient({
        account: this.account,
        chain: config.chain,
        transport: http(options.rpcUrl),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get the connected wallet address.
   * Returns null if no private key was provided.
   *
   * @example
   * ```typescript
   * console.log(client.address); // "0x1234..."
   * ```
   */
  get address(): `0x${string}` | null {
    return this.account?.address ?? null;
  }

  /**
   * Get the current chain configuration.
   *
   * @example
   * ```typescript
   * console.log(client.chain.name);     // "Base Sepolia"
   * console.log(client.chain.chainId);  // 84532
   * ```
   */
  get chain(): PeetBetChainConfig {
    return this.chainConfig;
  }

  /**
   * Get the contract addresses for the current chain.
   *
   * @example
   * ```typescript
   * console.log(client.contracts.coinFlipGame); // "0x..."
   * console.log(client.contracts.token);        // "0x..." (USDC)
   * ```
   */
  get contracts() {
    return this.chainConfig.contracts;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BALANCE & DEPOSITS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get a user's PeetBet balance (deposited tokens).
   * This is the balance available for betting.
   *
   * @param address - Address to check (defaults to connected wallet)
   * @returns Balance in token units (6 decimals for USDC)
   *
   * @example
   * ```typescript
   * const balance = await client.getBalance();
   * console.log(client.formatTokens(balance)); // "10.5"
   * ```
   */
  async getBalance(address?: `0x${string}`): Promise<bigint> {
    const target = address ?? this.account?.address;
    if (!target) throw new Error("No address provided");

    return this.publicClient.readContract({
      address: this.contracts.peerBetCore,
      abi: peerBetCoreAbi,
      functionName: "balances",
      args: [target],
    }) as Promise<bigint>;
  }

  /**
   * Get a user's wallet token balance (USDC in wallet, not deposited).
   *
   * @param address - Address to check (defaults to connected wallet)
   * @returns Token balance in wallet
   *
   * @example
   * ```typescript
   * const walletBalance = await client.getTokenBalance();
   * console.log(client.formatTokens(walletBalance)); // "100"
   * ```
   */
  async getTokenBalance(address?: `0x${string}`): Promise<bigint> {
    const target = address ?? this.account?.address;
    if (!target) throw new Error("No address provided");

    return this.publicClient.readContract({
      address: this.contracts.token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [target],
    }) as Promise<bigint>;
  }

  /**
   * Get the token allowance for depositing into PeetBet.
   * You need to approve tokens before depositing.
   *
   * @param address - Address to check (defaults to connected wallet)
   * @returns Approved amount
   *
   * @example
   * ```typescript
   * const allowance = await client.getTokenAllowance();
   * if (allowance < depositAmount) {
   *   await client.approveTokens(depositAmount);
   * }
   * ```
   */
  async getTokenAllowance(address?: `0x${string}`): Promise<bigint> {
    const target = address ?? this.account?.address;
    if (!target) throw new Error("No address provided");

    return this.publicClient.readContract({
      address: this.contracts.token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [target, this.contracts.peerBetCore],
    }) as Promise<bigint>;
  }

  /**
   * Approve tokens for depositing into PeetBet.
   * Required before calling `deposit()`.
   *
   * @param amount - Amount to approve
   * @returns Transaction result
   *
   * @example
   * ```typescript
   * // Approve specific amount
   * await client.approveTokens(client.parseTokens("100"));
   *
   * // Or approve unlimited (recommended)
   * await client.approveMaxTokens();
   * ```
   */
  async approveTokens(amount: bigint): Promise<TransactionResult> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.contracts.token,
      abi: erc20Abi,
      functionName: "approve",
      args: [this.contracts.peerBetCore, amount],
      account: this.account!,
      chain: this.chainConfig.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
  }

  /**
   * Approve unlimited tokens for depositing.
   * This is convenient so you don't need to approve before each deposit.
   *
   * @returns Transaction result
   *
   * @example
   * ```typescript
   * await client.approveMaxTokens();
   * // Now you can deposit any amount
   * await client.deposit(client.parseTokens("10"));
   * ```
   */
  async approveMaxTokens(): Promise<TransactionResult> {
    const maxUint256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    return this.approveTokens(maxUint256);
  }

  /**
   * Deposit tokens into PeetBet.
   * Requires prior approval via `approveTokens()` or `approveMaxTokens()`.
   *
   * @param amount - Amount to deposit (6 decimals)
   * @returns Transaction result
   *
   * @example
   * ```typescript
   * // Deposit 10 USDC
   * await client.deposit(client.parseTokens("10"));
   * ```
   */
  async deposit(amount: bigint): Promise<TransactionResult> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.contracts.peerBetCore,
      abi: peerBetCoreAbi,
      functionName: "deposit",
      args: [amount],
      account: this.account!,
      chain: this.chainConfig.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
  }

  /**
   * Withdraw all tokens from PeetBet back to your wallet.
   *
   * @returns Transaction result
   *
   * @example
   * ```typescript
   * await client.withdraw();
   * console.log("All funds withdrawn!");
   * ```
   */
  async withdraw(): Promise<TransactionResult> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.contracts.peerBetCore,
      abi: peerBetCoreAbi,
      functionName: "withdraw",
      args: [],
      account: this.account!,
      chain: this.chainConfig.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
  }

  /**
   * Get player statistics including balance and deposit history.
   *
   * @param address - Address to check (defaults to connected wallet)
   * @returns Player stats object
   *
   * @example
   * ```typescript
   * const stats = await client.getPlayerStats();
   * console.log("Balance:", client.formatTokens(stats.balance));
   * ```
   */
  async getPlayerStats(address?: `0x${string}`): Promise<PlayerStats> {
    const target = address ?? this.account?.address;
    if (!target) throw new Error("No address provided");

    const [balance, depositBasis] = await Promise.all([
      this.getBalance(target),
      this.publicClient.readContract({
        address: this.contracts.peerBetCore,
        abi: peerBetCoreAbi,
        functionName: "depositBasis",
        args: [target],
      }) as Promise<bigint>,
    ]);

    return { balance, depositBasis };
  }

  // ═══════════════════════════════════════════════════════════════════
  // PLATFORM INFO
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get allowed bet sizes for the platform.
   * These are the only valid bet amounts you can use.
   *
   * @returns Array of allowed bet amounts
   *
   * @example
   * ```typescript
   * const betSizes = await client.getAllowedBetSizes();
   * // [1000000n, 5000000n, 10000000n] = [1, 5, 10] USDC
   * ```
   */
  async getAllowedBetSizes(): Promise<bigint[]> {
    return this.publicClient.readContract({
      address: this.contracts.peerBetCore,
      abi: peerBetCoreAbi,
      functionName: "getAllowedBetSizes",
    }) as Promise<bigint[]>;
  }

  /**
   * Get bet sizes available for house games.
   *
   * @returns Array of house bet amounts
   */
  async getHouseBetSizes(): Promise<bigint[]> {
    return this.publicClient.readContract({
      address: this.contracts.peerBetCore,
      abi: peerBetCoreAbi,
      functionName: "getHouseBetSizes",
    }) as Promise<bigint[]>;
  }

  /**
   * Get the platform's operational status.
   * Check this before creating/joining games.
   *
   * @returns Security status object
   *
   * @example
   * ```typescript
   * const status = await client.getSecurityStatus();
   * if (!status.casinoEnabled) {
   *   console.log("Casino is currently disabled");
   * }
   * ```
   */
  async getSecurityStatus(): Promise<SecurityStatus> {
    const result = await this.publicClient.readContract({
      address: this.contracts.peerBetCore,
      abi: peerBetCoreAbi,
      functionName: "getSecurityStatus",
    }) as [boolean, boolean, boolean, boolean];

    return {
      casinoEnabled: result[0],
      houseGamblingEnabled: result[1],
      autoCleanupEnabled: result[2],
      casinoShutdown: result[3],
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // COINFLIP - READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get all CoinFlip rooms waiting for an opponent.
   * These rooms can be joined immediately.
   *
   * @param options - Pagination options
   * @returns Paginated list of room IDs
   *
   * @example
   * ```typescript
   * const { items, total } = await client.getCoinFlipWaitingRooms();
   * console.log(`${total} rooms waiting`);
   *
   * for (const roomId of items) {
   *   const room = await client.getCoinFlipRoom(roomId);
   *   console.log(`Room ${roomId}: ${client.formatTokens(room.betAmount)} USDC`);
   * }
   * ```
   */
  async getCoinFlipWaitingRooms(
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<bigint>> {
    const offset = options.offset ?? 0n;
    const limit = options.limit ?? 100n;

    const result = await this.publicClient.readContract({
      address: this.contracts.coinFlipGame,
      abi: coinFlipGameAbi,
      functionName: "getActiveWaitingRooms",
      args: [offset, limit],
    }) as unknown as [bigint[], bigint];

    return {
      items: result[0],
      total: result[1],
    };
  }

  /**
   * Get CoinFlip rooms filtered by specific bet amounts.
   * Useful for finding rooms that match your budget.
   *
   * @param betAmounts - Array of bet amounts to filter by
   * @param options - Pagination options
   * @returns Filtered room IDs
   *
   * @example
   * ```typescript
   * // Find rooms with 1 USDC or 5 USDC bets
   * const rooms = await client.getFilteredCoinFlipRooms([
   *   client.parseTokens("1"),
   *   client.parseTokens("5"),
   * ]);
   * ```
   */
  async getFilteredCoinFlipRooms(
    betAmounts: bigint[],
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<bigint>> {
    const offset = options.offset ?? 0n;
    const limit = options.limit ?? 100n;

    const result = await this.publicClient.readContract({
      address: this.contracts.coinFlipGame,
      abi: coinFlipGameAbi,
      functionName: "getWaitingRoomsFiltered",
      args: [offset, limit, betAmounts],
    }) as unknown as [bigint[], bigint];

    return {
      items: result[0],
      total: result[1],
    };
  }

  /**
   * Get detailed information about a CoinFlip room.
   *
   * @param roomId - Room ID to query
   * @returns Room details
   *
   * @example
   * ```typescript
   * const room = await client.getCoinFlipRoom(1n);
   * console.log("Creator:", room.playerA);
   * console.log("Bet:", client.formatTokens(room.betAmount));
   * console.log("Status:", room.isActive ? "active" : "completed");
   * if (room.winner !== "0x0000...") {
   *   console.log("Winner:", room.winner);
   * }
   * ```
   */
  async getCoinFlipRoom(roomId: bigint): Promise<CoinFlipRoom> {
    const result = await this.publicClient.readContract({
      address: this.contracts.coinFlipGame,
      abi: coinFlipGameAbi,
      functionName: "getRoom",
      args: [roomId],
    });

    // Viem returns struct as object with named properties
    const room = result as {
      id: bigint;
      roomNumber: bigint;
      createdAt: bigint;
      playerA: `0x${string}`;
      playerB: `0x${string}`;
      betAmount: bigint;
      isActive: boolean;
      winner: `0x${string}`;
      isHouseGame: boolean;
      isChallenge: boolean;
      completedAt: bigint;
      randomWord: bigint;
      vrfRequestId: bigint;
      houseEdgeBps: number;
    };

    return {
      id: room.id,
      roomNumber: room.roomNumber,
      createdAt: room.createdAt,
      playerA: room.playerA,
      playerB: room.playerB,
      betAmount: room.betAmount,
      isActive: room.isActive,
      winner: room.winner,
      isHouseGame: room.isHouseGame,
      isChallenge: room.isChallenge,
      completedAt: room.completedAt,
      randomWord: room.randomWord,
      vrfRequestId: room.vrfRequestId,
      houseEdgeBps: room.houseEdgeBps,
    };
  }

  /**
   * Get CoinFlip rooms created by a specific player that are waiting.
   *
   * @param address - Player address (defaults to connected wallet)
   * @returns Array of room IDs
   *
   * @example
   * ```typescript
   * const myRooms = await client.getPlayerCoinFlipWaitingRooms();
   * console.log(`I have ${myRooms.length} rooms waiting for opponents`);
   * ```
   */
  async getPlayerCoinFlipWaitingRooms(
    address?: `0x${string}`
  ): Promise<bigint[]> {
    const target = address ?? this.account?.address;
    if (!target) throw new Error("No address provided");

    return this.publicClient.readContract({
      address: this.contracts.coinFlipGame,
      abi: coinFlipGameAbi,
      functionName: "getPlayerWaitingRooms",
      args: [target],
    }) as Promise<bigint[]>;
  }

  /**
   * Get total number of CoinFlip games ever played.
   *
   * @returns Total games count
   */
  async getCoinFlipTotalGames(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contracts.coinFlipGame,
      abi: coinFlipGameAbi,
      functionName: "totalGamesPlayed",
    }) as Promise<bigint>;
  }

  /**
   * Get total number of CoinFlip rooms ever created.
   *
   * @returns Total rooms count
   */
  async getCoinFlipTotalRooms(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contracts.coinFlipGame,
      abi: coinFlipGameAbi,
      functionName: "totalRoomsCreated",
    }) as Promise<bigint>;
  }

  /**
   * Check if the CoinFlip game is currently active.
   *
   * @returns true if game is accepting bets
   */
  async isCoinFlipActive(): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.contracts.coinFlipGame,
      abi: coinFlipGameAbi,
      functionName: "gameActive",
    }) as Promise<boolean>;
  }

  // ═══════════════════════════════════════════════════════════════════
  // COINFLIP - WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a new CoinFlip room.
   * Your bet will be locked until someone joins or you cancel.
   *
   * @param options - Room creation options
   * @returns Transaction result
   *
   * @example
   * ```typescript
   * // Create a public 1 USDC room
   * const { hash } = await client.createCoinFlipRoom({
   *   betAmount: client.parseTokens("1"),
   * });
   * console.log("Room created! TX:", hash);
   *
   * // Create a private room (share ID with friend)
   * await client.createCoinFlipRoom({
   *   betAmount: client.parseTokens("5"),
   *   isPrivate: true,
   * });
   * ```
   */
  async createCoinFlipRoom(options: CreateRoomOptions): Promise<TransactionResult> {
    this.requireWallet();

    const functionName = options.isPrivate ? "createChallengeRoom" : "createRoom";

    const hash = await this.walletClient!.writeContract({
      address: this.contracts.coinFlipGame,
      abi: coinFlipGameAbi,
      functionName,
      args: [options.betAmount],
      account: this.account!,
      chain: this.chainConfig.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
  }

  /**
   * Join an existing CoinFlip room.
   * This triggers the coin flip - winner determined by Chainlink VRF.
   * Note: You pay a small VRF fee in ETH for randomness.
   *
   * @param options - Join options with room ID
   * @returns Transaction result
   *
   * @example
   * ```typescript
   * // Get available rooms and join the first one
   * const rooms = await client.getCoinFlipWaitingRooms();
   * if (rooms.items.length > 0) {
   *   const { hash } = await client.joinCoinFlipRoom({
   *     roomId: rooms.items[0],
   *   });
   *   console.log("Joined! TX:", hash);
   *   console.log("Waiting for VRF result...");
   * }
   * ```
   */
  async joinCoinFlipRoom(options: JoinRoomOptions): Promise<TransactionResult> {
    this.requireWallet();

    // Get VRF cost estimate
    const vrfCost = await this.estimateVrfCost();

    const hash = await this.walletClient!.writeContract({
      address: this.contracts.coinFlipGame,
      abi: coinFlipGameAbi,
      functionName: "joinRoom",
      args: [options.roomId],
      value: vrfCost.cost,
      maxFeePerGas: vrfCost.maxFeePerGas,
      maxPriorityFeePerGas: vrfCost.maxPriorityFeePerGas,
      gas: 1_200_000n,
      account: this.account!,
      chain: this.chainConfig.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
  }

  /**
   * Cancel a CoinFlip room you created.
   * Only works if no one has joined yet.
   * Your bet will be refunded.
   *
   * @param roomId - Room ID to cancel
   * @returns Transaction result
   *
   * @example
   * ```typescript
   * // Cancel my waiting rooms
   * const myRooms = await client.getPlayerCoinFlipWaitingRooms();
   * for (const roomId of myRooms) {
   *   await client.cancelCoinFlipRoom(roomId);
   *   console.log(`Cancelled room ${roomId}`);
   * }
   * ```
   */
  async cancelCoinFlipRoom(roomId: bigint): Promise<TransactionResult> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.contracts.coinFlipGame,
      abi: coinFlipGameAbi,
      functionName: "cancelRoom",
      args: [roomId],
      account: this.account!,
      chain: this.chainConfig.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
  }

  // ═══════════════════════════════════════════════════════════════════
  // DICE - READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get all Dice rooms that are waiting for players.
   *
   * @param options - Pagination options
   * @returns Paginated list of room IDs
   *
   * @example
   * ```typescript
   * const { items, total } = await client.getDiceWaitingRooms();
   * for (const roomId of items) {
   *   const room = await client.getDiceRoom(roomId);
   *   console.log(`Room ${roomId}: ${room.currentPlayers}/${room.maxPlayers} players`);
   * }
   * ```
   */
  async getDiceWaitingRooms(
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<bigint>> {
    const offset = options.offset ?? 0n;
    const limit = options.limit ?? 100n;

    const result = await this.publicClient.readContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "getActiveRooms",
      args: [offset, limit],
    }) as unknown as [bigint[], bigint];

    return {
      items: result[0],
      total: result[1],
    };
  }

  /**
   * Get Dice rooms filtered by specific bet amounts.
   *
   * @param betAmounts - Array of bet amounts to filter by
   * @param options - Pagination options
   * @returns Filtered room IDs
   */
  async getFilteredDiceRooms(
    betAmounts: bigint[],
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<bigint>> {
    const offset = options.offset ?? 0n;
    const limit = options.limit ?? 100n;

    const result = await this.publicClient.readContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "getWaitingRoomsFiltered",
      args: [offset, limit, betAmounts],
    }) as unknown as [bigint[], bigint];

    return {
      items: result[0],
      total: result[1],
    };
  }

  /**
   * Get detailed information about a Dice room.
   *
   * @param roomId - Room ID to query
   * @returns Room details
   *
   * @example
   * ```typescript
   * const room = await client.getDiceRoom(1n);
   * console.log(`${room.currentPlayers}/${room.maxPlayers} players`);
   * console.log("Bet:", client.formatTokens(room.betAmount));
   * if (room.hasStarted) {
   *   console.log("Game in progress, waiting for VRF...");
   * }
   * ```
   */
  async getDiceRoom(roomId: bigint): Promise<DiceRoom> {
    const result = await this.publicClient.readContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "getRoom",
      args: [roomId],
    });

    // Viem returns struct as object with named properties
    const room = result as {
      id: bigint;
      roomNumber: bigint;
      creator: `0x${string}`;
      betAmount: bigint;
      maxPlayers: number;
      currentPlayers: number;
      isActive: boolean;
      hasStarted: boolean;
      winningNumber: number;
      winner: `0x${string}`;
      createdAt: bigint;
      completedAt: bigint;
      isPrivate: boolean;
    };

    return {
      id: room.id,
      roomNumber: room.roomNumber,
      creator: room.creator,
      betAmount: room.betAmount,
      maxPlayers: Number(room.maxPlayers),
      currentPlayers: Number(room.currentPlayers),
      isActive: room.isActive,
      hasStarted: room.hasStarted,
      winningNumber: Number(room.winningNumber),
      winner: room.winner,
      createdAt: room.createdAt,
      completedAt: room.completedAt,
      isPrivate: room.isPrivate,
    };
  }

  /**
   * Get all players in a Dice room.
   *
   * @param roomId - Room ID
   * @returns Array of player addresses
   */
  async getDiceRoomPlayers(roomId: bigint): Promise<`0x${string}`[]> {
    return this.publicClient.readContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "getRoomPlayers",
      args: [roomId],
    }) as Promise<`0x${string}`[]>;
  }

  /**
   * Get a player's chosen dice number in a room.
   *
   * @param roomId - Room ID
   * @param player - Player address (defaults to connected wallet)
   * @returns Dice number (1-6)
   */
  async getPlayerDiceNumber(
    roomId: bigint,
    player?: `0x${string}`
  ): Promise<number> {
    const target = player ?? this.account?.address;
    if (!target) throw new Error("No address provided");

    const result = await this.publicClient.readContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "getPlayerNumber",
      args: [roomId, target],
    }) as unknown as bigint;

    return Number(result);
  }

  /**
   * Check if a player is in a specific Dice room.
   *
   * @param roomId - Room ID
   * @param player - Player address (defaults to connected wallet)
   * @returns true if player is in the room
   */
  async isPlayerInDiceRoom(
    roomId: bigint,
    player?: `0x${string}`
  ): Promise<boolean> {
    const target = player ?? this.account?.address;
    if (!target) throw new Error("No address provided");

    return this.publicClient.readContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "isPlayerInRoom",
      args: [roomId, target],
    }) as Promise<boolean>;
  }

  /**
   * Get Dice rooms created by a player that are still waiting.
   *
   * @param address - Player address (defaults to connected wallet)
   * @returns Array of room IDs
   */
  async getPlayerDiceWaitingRooms(address?: `0x${string}`): Promise<bigint[]> {
    const target = address ?? this.account?.address;
    if (!target) throw new Error("No address provided");

    return this.publicClient.readContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "getPlayerWaitingRooms",
      args: [target],
    }) as Promise<bigint[]>;
  }

  /**
   * Get total number of Dice games ever played.
   */
  async getDiceTotalGames(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "totalGamesPlayed",
    }) as Promise<bigint>;
  }

  /**
   * Get total number of Dice rooms ever created.
   */
  async getDiceTotalRooms(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "totalRoomsCreated",
    }) as Promise<bigint>;
  }

  /**
   * Check if the Dice game is currently active.
   */
  async isDiceActive(): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "gameActive",
    }) as Promise<boolean>;
  }

  // ═══════════════════════════════════════════════════════════════════
  // DICE - WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a new Dice room.
   * Players join and choose a number 1-6. Winner chosen by VRF.
   *
   * @param options - Room creation options
   * @returns Transaction result
   *
   * @example
   * ```typescript
   * // Create a 4-player dice game
   * const { hash } = await client.createDiceRoom({
   *   betAmount: client.parseTokens("1"),
   *   maxPlayers: 4,
   * });
   * ```
   */
  async createDiceRoom(options: CreateDiceRoomOptions): Promise<TransactionResult> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "createRoom",
      args: [options.betAmount, options.maxPlayers, options.isPrivate ?? false],
      account: this.account!,
      chain: this.chainConfig.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
  }

  /**
   * Join a Dice room.
   * If you're the last player, you pay the VRF fee and game starts.
   *
   * @param options - Join options (requires room info for VRF calculation)
   * @returns Transaction result
   *
   * @example
   * ```typescript
   * const room = await client.getDiceRoom(roomId);
   * await client.joinDiceRoom({
   *   roomId: room.id,
   *   currentPlayers: room.currentPlayers,
   *   maxPlayers: room.maxPlayers,
   * });
   * ```
   */
  async joinDiceRoom(options: JoinDiceRoomOptions): Promise<TransactionResult> {
    this.requireWallet();

    const isLastPlayer = options.currentPlayers + 1 === options.maxPlayers;

    let hash: Hash;

    if (isLastPlayer) {
      const vrfCost = await this.estimateVrfCost();
      hash = await this.walletClient!.writeContract({
        address: this.contracts.diceGame,
        abi: diceGameAbi,
        functionName: "joinRoom",
        args: [options.roomId],
        account: this.account!,
        chain: this.chainConfig.chain,
        value: vrfCost.cost,
        maxFeePerGas: vrfCost.maxFeePerGas,
        maxPriorityFeePerGas: vrfCost.maxPriorityFeePerGas,
        gas: 1_200_000n,
      });
    } else {
      hash = await this.walletClient!.writeContract({
        address: this.contracts.diceGame,
        abi: diceGameAbi,
        functionName: "joinRoom",
        args: [options.roomId],
        account: this.account!,
        chain: this.chainConfig.chain,
        gas: 300_000n,
      });
    }

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
  }

  /**
   * Leave a Dice room before the game starts.
   * Your bet will be refunded.
   *
   * @param roomId - Room ID to leave
   * @returns Transaction result
   */
  async leaveDiceRoom(roomId: bigint): Promise<TransactionResult> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "leaveRoom",
      args: [roomId],
      account: this.account!,
      chain: this.chainConfig.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
  }

  /**
   * Cancel a Dice room you created.
   * Only works if you're the creator and game hasn't started.
   *
   * @param roomId - Room ID to cancel
   * @returns Transaction result
   */
  async cancelDiceRoom(roomId: bigint): Promise<TransactionResult> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "cancelRoom",
      args: [roomId],
      account: this.account!,
      chain: this.chainConfig.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
  }

  /**
   * Start a Dice game early (before room is full).
   * Only the room creator can do this, and needs at least 2 players.
   * You pay the VRF fee.
   *
   * @param roomId - Room ID to start
   * @returns Transaction result
   *
   * @example
   * ```typescript
   * // Start game early with current players
   * const room = await client.getDiceRoom(roomId);
   * if (room.currentPlayers >= 2 && room.creator === client.address) {
   *   await client.startDiceGame(roomId);
   * }
   * ```
   */
  async startDiceGame(roomId: bigint): Promise<TransactionResult> {
    this.requireWallet();

    const vrfCost = await this.estimateVrfCost();

    const hash = await this.walletClient!.writeContract({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      functionName: "startGame",
      args: [roomId],
      value: vrfCost.cost,
      maxFeePerGas: vrfCost.maxFeePerGas,
      maxPriorityFeePerGas: vrfCost.maxPriorityFeePerGas,
      gas: 1_200_000n,
      account: this.account!,
      chain: this.chainConfig.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
  }

  // ═══════════════════════════════════════════════════════════════════
  // EVENT WATCHING
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Watch for CoinFlip game completions in real-time.
   * Returns an unwatch function to stop listening.
   *
   * @param callback - Function called when a game completes
   * @returns Unwatch function
   *
   * @example
   * ```typescript
   * const unwatch = client.watchCoinFlipCompletions((event) => {
   *   console.log(`Room ${event.roomId} completed!`);
   *   console.log(`Winner: ${event.winner}`);
   *   console.log(`Payout: ${client.formatTokens(event.payout)}`);
   *
   *   if (event.winner === client.address) {
   *     console.log("WE WON!");
   *   }
   * });
   *
   * // Stop watching later
   * unwatch();
   * ```
   */
  watchCoinFlipCompletions(
    callback: (event: GameCompletedEvent) => void
  ): WatchEventReturnType {
    return this.publicClient.watchContractEvent({
      address: this.contracts.coinFlipGame,
      abi: coinFlipGameAbi,
      eventName: "GameCompleted",
      onLogs: (logs: Log[]) => {
        for (const log of logs) {
          const args = (log as unknown as { args: { roomId: bigint; winner: `0x${string}`; payout: bigint; fee: bigint; timestamp: bigint } }).args;
          callback({
            roomId: args.roomId,
            winner: args.winner,
            payout: args.payout,
            fee: args.fee,
            timestamp: args.timestamp,
          });
        }
      },
    });
  }

  /**
   * Watch for Dice game completions in real-time.
   *
   * @param callback - Function called when a game completes
   * @returns Unwatch function
   */
  watchDiceCompletions(
    callback: (event: GameCompletedEvent) => void
  ): WatchEventReturnType {
    return this.publicClient.watchContractEvent({
      address: this.contracts.diceGame,
      abi: diceGameAbi,
      eventName: "GameCompleted",
      onLogs: (logs: Log[]) => {
        for (const log of logs) {
          const args = (log as unknown as { args: { roomId: bigint; winner: `0x${string}`; payout: bigint; fee: bigint; timestamp: bigint } }).args;
          callback({
            roomId: args.roomId,
            winner: args.winner,
            payout: args.payout,
            fee: args.fee,
            timestamp: args.timestamp,
          });
        }
      },
    });
  }

  /**
   * Watch for deposits to an account in real-time.
   *
   * @param callback - Function called when deposit occurs
   * @param address - Address to watch (defaults to connected wallet)
   * @returns Unwatch function
   */
  watchDeposits(
    callback: (amount: bigint) => void,
    address?: `0x${string}`
  ): WatchEventReturnType {
    const target = address ?? this.account?.address;
    if (!target) throw new Error("No address provided");

    return this.publicClient.watchContractEvent({
      address: this.contracts.peerBetCore,
      abi: peerBetCoreAbi,
      eventName: "Deposit",
      args: { user: target },
      onLogs: (logs: Log[]) => {
        for (const log of logs) {
          const args = (log as unknown as { args: { amount: bigint } }).args;
          callback(args.amount);
        }
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // AGENT-FRIENDLY GAME RESULTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get a clear, structured result for a completed CoinFlip game.
   * Use this to understand who won, how much, and all game details.
   *
   * @param roomId - Room ID to get results for
   * @param playerAddress - Address to check win/loss against (defaults to connected wallet)
   * @returns Structured game result with clear win/loss information
   * @throws Error if game is not completed yet
   *
   * @example
   * ```typescript
   * const result = await client.getCoinFlipGameResult(roomId);
   *
   * console.log(result.didIWin);  // true or false
   * console.log(result.winner);   // "0x..."
   * console.log(result.payout);   // 1900000n (1.9 USDC)
   * console.log(result.summary);  // "You WON 1.9 USDC (bet 1 USDC)"
   * ```
   */
  async getCoinFlipGameResult(
    roomId: bigint,
    playerAddress?: `0x${string}`
  ): Promise<CoinFlipGameResult> {
    const room = await this.getCoinFlipRoom(roomId);
    const player = playerAddress ?? this.account?.address;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

    if (room.isActive) {
      throw new Error("Game is not completed yet. Use waitForCoinFlipResult() to wait for completion.");
    }

    if (room.winner === ZERO_ADDRESS) {
      throw new Error("Game was cancelled or not completed.");
    }

    // Determine winner and loser
    const winner = room.winner;
    const loser = winner === room.playerA ? room.playerB : room.playerA;

    // Calculate payout (bet * 2 minus fees)
    const totalPot = room.betAmount * 2n;
    const feeBps = BigInt(room.houseEdgeBps);
    const fee = (totalPot * feeBps) / 10000n;
    const payout = totalPot - fee;

    // Determine if calling player won
    const didIWin = player ? winner.toLowerCase() === player.toLowerCase() : false;

    // Calculate net change for calling player
    let netChange = 0n;
    if (player) {
      const isPlayer = player.toLowerCase() === room.playerA.toLowerCase() ||
                       player.toLowerCase() === room.playerB.toLowerCase();
      if (isPlayer) {
        netChange = didIWin ? (payout - room.betAmount) : -room.betAmount;
      }
    }

    // Determine coin result (player A wins on even, player B on odd)
    const coinResult: "heads" | "tails" = room.randomWord % 2n === 0n ? "heads" : "tails";

    // Generate human-readable summary
    const payoutFormatted = this.formatTokens(payout);
    const netFormatted = this.formatTokens(netChange < 0n ? -netChange : netChange);

    let summary: string;
    if (!player) {
      summary = `Coin landed ${coinResult}. Winner: ${winner.slice(0, 10)}... won ${payoutFormatted} USDC`;
    } else if (didIWin) {
      summary = `🎉 You WON! Coin was ${coinResult}. You won ${payoutFormatted} USDC (profit: +${netFormatted} USDC)`;
    } else {
      const wasInGame = player.toLowerCase() === room.playerA.toLowerCase() ||
                        player.toLowerCase() === room.playerB.toLowerCase();
      if (wasInGame) {
        summary = `❌ You LOST. Coin was ${coinResult}. Lost ${netFormatted} USDC to ${winner.slice(0, 10)}...`;
      } else {
        summary = `Coin landed ${coinResult}. Winner: ${winner.slice(0, 10)}... won ${payoutFormatted} USDC`;
      }
    }

    return {
      roomId: room.id,
      didIWin,
      winner,
      loser,
      playerA: room.playerA,
      playerB: room.playerB,
      betAmount: room.betAmount,
      payout,
      fee,
      netChange,
      randomWord: room.randomWord,
      coinResult,
      summary,
      completedAt: room.completedAt,
      isHouseGame: room.isHouseGame,
    };
  }

  /**
   * Wait for a CoinFlip game to complete and return the result.
   * Use this after creating or joining a room to know the outcome.
   *
   * @param roomId - Room ID to wait for
   * @param options - Waiting options (timeout, poll interval, progress callback)
   * @returns Structured game result when complete
   * @throws Error if timeout exceeded
   *
   * @example
   * ```typescript
   * // Create room and wait for result
   * const { hash } = await client.createCoinFlipRoom({ betAmount: 1000000n });
   * const myRooms = await client.getPlayerCoinFlipWaitingRooms();
   * const roomId = myRooms[0];
   *
   * console.log("Waiting for opponent and game result...");
   * const result = await client.waitForCoinFlipResult(roomId, {
   *   timeout: 300000, // 5 minutes max
   *   onProgress: (status) => console.log(status),
   * });
   *
   * if (result.didIWin) {
   *   console.log(`Victory! Won ${client.formatTokens(result.payout)} USDC`);
   * } else {
   *   console.log(`Defeat. Lost ${client.formatTokens(result.betAmount)} USDC`);
   * }
   * ```
   */
  async waitForCoinFlipResult(
    roomId: bigint,
    options: WaitForResultOptions = {}
  ): Promise<CoinFlipGameResult> {
    const timeout = options.timeout ?? 120000; // 2 minutes default
    const pollInterval = options.pollInterval ?? 2000; // 2 seconds default
    const onProgress = options.onProgress;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const room = await this.getCoinFlipRoom(roomId);

      // Check if game completed
      if (!room.isActive && room.winner !== ZERO_ADDRESS) {
        return this.getCoinFlipGameResult(roomId);
      }

      // Check if room was cancelled
      if (!room.isActive && room.winner === ZERO_ADDRESS && room.playerB === ZERO_ADDRESS) {
        throw new Error("Room was cancelled before game started.");
      }

      // Report progress
      if (onProgress) {
        if (room.playerB === ZERO_ADDRESS) {
          onProgress("Waiting for opponent to join...");
        } else {
          onProgress("Opponent joined! Waiting for VRF result...");
        }
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Timeout waiting for game result after ${timeout / 1000} seconds`);
  }

  /**
   * Get a clear, structured result for a completed Dice game.
   *
   * @param roomId - Room ID to get results for
   * @param playerAddress - Address to check win/loss against
   * @returns Structured game result
   *
   * @example
   * ```typescript
   * const result = await client.getDiceGameResult(roomId);
   * console.log(`Winning number: ${result.winningNumber}`);
   * console.log(`My number: ${result.myNumber}`);
   * console.log(result.summary); // "Number 4 won! You lost (picked 2)"
   * ```
   */
  async getDiceGameResult(
    roomId: bigint,
    playerAddress?: `0x${string}`
  ): Promise<DiceGameResult> {
    const room = await this.getDiceRoom(roomId);
    const players = await this.getDiceRoomPlayers(roomId);
    const player = playerAddress ?? this.account?.address;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

    if (room.isActive || room.winner === ZERO_ADDRESS) {
      throw new Error("Game is not completed yet. Use waitForDiceResult() to wait.");
    }

    // Get player's chosen number if they're in the game
    let myNumber = 0;
    if (player) {
      const isInGame = players.some(p => p.toLowerCase() === player.toLowerCase());
      if (isInGame) {
        myNumber = await this.getPlayerDiceNumber(roomId, player);
      }
    }

    // Calculate payout
    const totalPot = room.betAmount * BigInt(room.currentPlayers);
    // Assume 5% fee for dice (TODO: get from contract)
    const fee = (totalPot * 500n) / 10000n;
    const payout = totalPot - fee;

    // Determine if calling player won
    const didIWin = player ? room.winner.toLowerCase() === player.toLowerCase() : false;

    // Calculate net change
    let netChange = 0n;
    if (player) {
      const isInGame = players.some(p => p.toLowerCase() === player.toLowerCase());
      if (isInGame) {
        netChange = didIWin ? (payout - room.betAmount) : -room.betAmount;
      }
    }

    // Generate summary
    const payoutFormatted = this.formatTokens(payout);
    let summary: string;

    if (!player) {
      summary = `Number ${room.winningNumber} won! Winner: ${room.winner.slice(0, 10)}... won ${payoutFormatted} USDC`;
    } else if (didIWin) {
      summary = `🎉 Number ${room.winningNumber} won! You WON ${payoutFormatted} USDC!`;
    } else {
      const isInGame = players.some(p => p.toLowerCase() === player.toLowerCase());
      if (isInGame) {
        summary = `❌ Number ${room.winningNumber} won. You LOST (picked ${myNumber})`;
      } else {
        summary = `Number ${room.winningNumber} won! Winner: ${room.winner.slice(0, 10)}...`;
      }
    }

    return {
      roomId: room.id,
      didIWin,
      winner: room.winner,
      winningNumber: room.winningNumber,
      myNumber,
      playerCount: room.currentPlayers,
      players,
      betAmount: room.betAmount,
      payout,
      fee,
      netChange,
      randomWord: 0n, // Dice doesn't store random word in room struct
      summary,
      completedAt: room.completedAt,
    };
  }

  /**
   * Wait for a Dice game to complete and return the result.
   *
   * @param roomId - Room ID to wait for
   * @param options - Waiting options
   * @returns Structured game result when complete
   *
   * @example
   * ```typescript
   * const result = await client.waitForDiceResult(roomId, {
   *   timeout: 120000,
   *   onProgress: (status) => console.log(status),
   * });
   * console.log(result.summary);
   * ```
   */
  async waitForDiceResult(
    roomId: bigint,
    options: WaitForResultOptions = {}
  ): Promise<DiceGameResult> {
    const timeout = options.timeout ?? 120000;
    const pollInterval = options.pollInterval ?? 2000;
    const onProgress = options.onProgress;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const room = await this.getDiceRoom(roomId);

      // Check if game completed
      if (!room.isActive && room.winner !== ZERO_ADDRESS) {
        return this.getDiceGameResult(roomId);
      }

      // Report progress
      if (onProgress) {
        if (!room.hasStarted) {
          onProgress(`Waiting for players (${room.currentPlayers}/${room.maxPlayers})...`);
        } else {
          onProgress("Game started! Waiting for VRF result...");
        }
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Timeout waiting for dice result after ${timeout / 1000} seconds`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // VRF HELPERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Estimate the VRF (randomness) cost for joining a room.
   * The SDK handles this automatically, but you can call it manually.
   *
   * @returns VRF cost estimate with gas prices
   *
   * @example
   * ```typescript
   * const cost = await client.estimateVrfCost();
   * console.log(`VRF will cost ~${cost.cost} wei`);
   * ```
   */
  async estimateVrfCost(): Promise<VrfCostEstimate> {
    // Get callback gas limit from contract
    const callbackGasLimit = await this.publicClient.readContract({
      address: this.contracts.peerBetCore,
      abi: peerBetCoreAbi,
      functionName: "vrfCallbackGasLimit",
    }) as number;

    // Get current gas prices
    let maxFeePerGas: bigint;
    let maxPriorityFeePerGas: bigint;

    try {
      const feeData = await this.publicClient.estimateFeesPerGas();
      maxFeePerGas = feeData.maxFeePerGas ?? 0n;
      maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 1500000000n; // 1.5 gwei default
    } catch {
      // Fallback if estimateFeesPerGas fails
      const gasPrice = await this.publicClient.getGasPrice();
      maxPriorityFeePerGas = 1500000000n; // 1.5 gwei
      maxFeePerGas = gasPrice > maxPriorityFeePerGas ? gasPrice : maxPriorityFeePerGas;
    }

    // Ensure maxFeePerGas >= maxPriorityFeePerGas (EIP-1559 requirement)
    let safeMaxFeePerGas = maxFeePerGas > maxPriorityFeePerGas ? maxFeePerGas : maxPriorityFeePerGas;

    // Apply 40% buffer to account for gas price volatility
    safeMaxFeePerGas = (safeMaxFeePerGas * 140n) / 100n;

    const vrfWrapper = this.chainConfig.vrfWrapper;

    // Call VRF wrapper with all 3 required arguments
    const baseCost = await this.publicClient.readContract({
      address: vrfWrapper,
      abi: vrfWrapperAbi,
      functionName: "estimateRequestPriceNative",
      args: [callbackGasLimit, 1, safeMaxFeePerGas], // gasLimit, numWords (always 1), gasPriceWei
    }) as bigint;

    return {
      cost: baseCost,
      maxFeePerGas: safeMaxFeePerGas,
      maxPriorityFeePerGas,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Format a token amount for display.
   * Converts from raw units (6 decimals) to human-readable string.
   *
   * @param amount - Amount in raw units
   * @param decimals - Token decimals (default: 6 for USDC)
   * @returns Formatted string
   *
   * @example
   * ```typescript
   * client.formatTokens(1000000n);  // "1"
   * client.formatTokens(1500000n);  // "1.5"
   * client.formatTokens(100n);      // "0.0001"
   * ```
   */
  formatTokens(amount: bigint, decimals = 6): string {
    return formatUnits(amount, decimals);
  }

  /**
   * Parse a token amount from a string.
   * Converts from human-readable to raw units (6 decimals).
   *
   * @param amount - Human-readable amount
   * @param decimals - Token decimals (default: 6 for USDC)
   * @returns Amount in raw units
   *
   * @example
   * ```typescript
   * client.parseTokens("1");    // 1000000n
   * client.parseTokens("1.5");  // 1500000n
   * client.parseTokens("0.01"); // 10000n
   * ```
   */
  parseTokens(amount: string, decimals = 6): bigint {
    return parseUnits(amount, decimals);
  }

  /**
   * Wait for a transaction to be confirmed.
   *
   * @param hash - Transaction hash
   * @returns Transaction receipt
   */
  async waitForTransaction(hash: Hash) {
    return this.publicClient.waitForTransactionReceipt({ hash });
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private requireWallet(): void {
    if (!this.walletClient || !this.account) {
      throw new Error("Wallet not configured. Provide privateKey in options.");
    }
  }
}
