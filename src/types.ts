/**
 * PeetBet SDK Types
 *
 * All TypeScript types used by the PeetBet SDK.
 * These types provide autocomplete and type safety for your agent.
 */

import type { Hash, TransactionReceipt } from "viem";
import type { ChainName } from "./chains";

// ═══════════════════════════════════════════════════════════════════
// CLIENT OPTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for creating a PeetBetClient.
 *
 * @example
 * ```typescript
 * // Read-only client (no private key)
 * const reader = new PeetBetClient({ chain: "baseSepolia" });
 *
 * // Full client with wallet
 * const client = new PeetBetClient({
 *   chain: "baseSepolia",
 *   privateKey: "0x...",
 * });
 * ```
 */
export interface PeetBetClientOptions {
  /**
   * Chain to connect to.
   * Use autocomplete to see available chains:
   * - "baseSepolia" - Base Sepolia Testnet (recommended for testing)
   * - "sepolia" - Ethereum Sepolia Testnet
   * - "bscTestnet" - BSC Testnet
   * - "base" - Base Mainnet (production)
   */
  chain: ChainName;

  /**
   * Private key for signing transactions.
   * Required for write operations (create room, join room, etc.)
   * Optional for read-only operations.
   *
   * @example "0x1234567890abcdef..."
   */
  privateKey?: `0x${string}`;

  /**
   * Custom RPC URL (optional).
   * Uses default public RPC if not provided.
   *
   * @example "https://base-sepolia.g.alchemy.com/v2/your-api-key"
   */
  rpcUrl?: string;
}

// ═══════════════════════════════════════════════════════════════════
// ROOM TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * CoinFlip room data returned from the contract.
 *
 * @example
 * ```typescript
 * const room = await client.getCoinFlipRoom(1n);
 * console.log(room.betAmount);  // 1000000n (1 USDC)
 * console.log(room.playerA);    // "0x..."
 * console.log(room.isActive);   // true/false
 * ```
 */
export interface CoinFlipRoom {
  /** Unique room ID */
  id: bigint;
  /** Sequential room number (1, 2, 3...) */
  roomNumber: bigint;
  /** Unix timestamp when room was created */
  createdAt: bigint;
  /** Address of room creator */
  playerA: `0x${string}`;
  /** Address of opponent (zero address if waiting) */
  playerB: `0x${string}`;
  /** Bet amount in token units (6 decimals for USDC) */
  betAmount: bigint;
  /** Whether the room is still active */
  isActive: boolean;
  /** Address of winner (zero address if not completed) */
  winner: `0x${string}`;
  /** Whether this is a house game (vs the house) */
  isHouseGame: boolean;
  /** Whether this is a private/challenge room */
  isChallenge: boolean;
  /** Unix timestamp when game completed */
  completedAt: bigint;
  /** Random word from Chainlink VRF */
  randomWord: bigint;
  /** VRF request ID */
  vrfRequestId: bigint;
  /** House edge in basis points (100 = 1%) */
  houseEdgeBps: number;
}

/**
 * Dice room data returned from the contract.
 *
 * @example
 * ```typescript
 * const room = await client.getDiceRoom(1n);
 * console.log(room.maxPlayers);      // 4
 * console.log(room.currentPlayers);  // 2
 * console.log(room.hasStarted);      // false
 * ```
 */
export interface DiceRoom {
  /** Unique room ID */
  id: bigint;
  /** Sequential room number */
  roomNumber: bigint;
  /** Address of room creator */
  creator: `0x${string}`;
  /** Bet amount in token units */
  betAmount: bigint;
  /** Maximum number of players (2-1000) */
  maxPlayers: number;
  /** Current number of players in room */
  currentPlayers: number;
  /** Whether the room is still active */
  isActive: boolean;
  /** Whether the game has started (VRF requested) */
  hasStarted: boolean;
  /** Winning dice number (1-6, 0 if not completed) */
  winningNumber: number;
  /** Address of winner */
  winner: `0x${string}`;
  /** Unix timestamp when room was created */
  createdAt: bigint;
  /** Unix timestamp when game completed */
  completedAt: bigint;
  /** Whether this is a private room */
  isPrivate: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// TRANSACTION TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Result of a write transaction.
 *
 * @example
 * ```typescript
 * const { hash, receipt } = await client.createCoinFlipRoom({ betAmount: 1000000n });
 * console.log(hash);                 // "0x..."
 * console.log(receipt.status);       // "success"
 * console.log(receipt.blockNumber);  // 12345n
 * ```
 */
export interface TransactionResult {
  /** Transaction hash */
  hash: Hash;
  /** Transaction receipt with confirmation details */
  receipt: TransactionReceipt;
}

/**
 * VRF (Chainlink randomness) cost estimate.
 * Used internally when joining rooms.
 */
export interface VrfCostEstimate {
  /** Total cost in wei to pay for VRF */
  cost: bigint;
  /** Max fee per gas */
  maxFeePerGas: bigint;
  /** Max priority fee per gas */
  maxPriorityFeePerGas: bigint;
}

// ═══════════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Event emitted when a game completes.
 *
 * @example
 * ```typescript
 * client.watchCoinFlipCompletions((event) => {
 *   console.log(`Room ${event.roomId} won by ${event.winner}`);
 *   console.log(`Payout: ${event.payout}`);
 * });
 * ```
 */
export interface GameCompletedEvent {
  /** Room ID */
  roomId: bigint;
  /** Winner's address */
  winner: `0x${string}`;
  /** Payout amount to winner */
  payout: bigint;
  /** Fee taken */
  fee: bigint;
  /** Unix timestamp */
  timestamp: bigint;
}

/** Event when a room is created */
export interface RoomCreatedEvent {
  roomId: bigint;
  creator: `0x${string}`;
  betAmount: bigint;
  timestamp: bigint;
}

/** Event when a player joins a room */
export interface PlayerJoinedEvent {
  roomId: bigint;
  player: `0x${string}`;
  timestamp: bigint;
}

/** Event when a room is cancelled */
export interface RoomCancelledEvent {
  roomId: bigint;
  cancelledBy: `0x${string}`;
  timestamp: bigint;
}

/** Event when tokens are deposited */
export interface DepositEvent {
  user: `0x${string}`;
  amount: bigint;
}

/** Event when tokens are withdrawn */
export interface WithdrawEvent {
  user: `0x${string}`;
  amount: bigint;
}

// ═══════════════════════════════════════════════════════════════════
// OPERATION OPTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for creating a CoinFlip room.
 *
 * @example
 * ```typescript
 * // Public room anyone can join
 * await client.createCoinFlipRoom({ betAmount: 1000000n });
 *
 * // Private room (challenge)
 * await client.createCoinFlipRoom({ betAmount: 1000000n, isPrivate: true });
 * ```
 */
export interface CreateRoomOptions {
  /**
   * Bet amount in token units (6 decimals).
   * Use `client.parseTokens("1")` to convert from string.
   *
   * @example 1000000n // 1 USDC
   */
  betAmount: bigint;

  /**
   * Create as private/challenge room.
   * Private rooms require sharing the room ID to join.
   * @default false
   */
  isPrivate?: boolean;
}

/**
 * Options for creating a Dice room.
 *
 * @example
 * ```typescript
 * // 4-player dice game
 * await client.createDiceRoom({
 *   betAmount: 1000000n,
 *   maxPlayers: 4,
 * });
 * ```
 */
export interface CreateDiceRoomOptions {
  /**
   * Bet amount in token units (6 decimals).
   * @example 1000000n // 1 USDC
   */
  betAmount: bigint;

  /**
   * Maximum number of players (2-1000).
   * Game starts when room is full OR creator starts early.
   */
  maxPlayers: number;

  /**
   * Create as private room.
   * @default false
   */
  isPrivate?: boolean;
}

/**
 * Options for joining a CoinFlip room.
 */
export interface JoinRoomOptions {
  /**
   * Room ID to join.
   * Get room IDs from `getCoinFlipWaitingRooms()`.
   */
  roomId: bigint;
}

/**
 * Options for joining a Dice room.
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
export interface JoinDiceRoomOptions {
  /** Room ID to join */
  roomId: bigint;

  /**
   * Current number of players in the room.
   * Needed to calculate if VRF fee is required.
   * Get from `getDiceRoom(roomId).currentPlayers`.
   */
  currentPlayers: number;

  /**
   * Max players in the room.
   * Needed to calculate if VRF fee is required.
   * Get from `getDiceRoom(roomId).maxPlayers`.
   */
  maxPlayers: number;
}

// ═══════════════════════════════════════════════════════════════════
// PAGINATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Pagination options for list queries.
 *
 * @example
 * ```typescript
 * // Get first 10 rooms
 * const page1 = await client.getCoinFlipWaitingRooms({ limit: 10n });
 *
 * // Get next 10 rooms
 * const page2 = await client.getCoinFlipWaitingRooms({ offset: 10n, limit: 10n });
 * ```
 */
export interface PaginationOptions {
  /** Number of items to skip (default: 0) */
  offset?: bigint;
  /** Maximum items to return (default: 100, max: 100) */
  limit?: bigint;
}

/**
 * Paginated result with items and total count.
 */
export interface PaginatedResult<T> {
  /** Array of items for this page */
  items: T[];
  /** Total count of all items (not just this page) */
  total: bigint;
}

// ═══════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════

/**
 * Platform-wide statistics.
 */
export interface PlatformStats {
  totalRoomsCreated: bigint;
  totalGamesPlayed: bigint;
  totalDeposits: bigint;
}

/**
 * Player-specific statistics.
 */
export interface PlayerStats {
  /** Current balance in PeetBet (deposited tokens) */
  balance: bigint;
  /** Total amount ever deposited (for analytics) */
  depositBasis: bigint;
}

/**
 * Platform security/operational status.
 */
export interface SecurityStatus {
  /** Whether the casino is accepting bets */
  casinoEnabled: boolean;
  /** Whether house games are enabled */
  houseGamblingEnabled: boolean;
  /** Whether auto-cleanup of stale rooms is enabled */
  autoCleanupEnabled: boolean;
  /** Whether the casino is permanently shutdown */
  casinoShutdown: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// AGENT-FRIENDLY GAME RESULTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Clear, structured result of a CoinFlip game.
 * Designed for AI agents to easily understand the outcome.
 *
 * @example
 * ```typescript
 * const result = await client.waitForCoinFlipResult(roomId);
 *
 * if (result.didIWin) {
 *   console.log(`I won! Payout: ${result.payout} USDC`);
 * } else {
 *   console.log(`I lost. Winner was: ${result.winner}`);
 * }
 *
 * console.log(result.summary); // "You WON 1.9 USDC (bet 1 USDC)"
 * ```
 */
export interface CoinFlipGameResult {
  /** Room ID */
  roomId: bigint;

  /** Did the calling wallet win? */
  didIWin: boolean;

  /** Winner's address */
  winner: `0x${string}`;

  /** Loser's address */
  loser: `0x${string}`;

  /** Address of player A (room creator) */
  playerA: `0x${string}`;

  /** Address of player B (room joiner) */
  playerB: `0x${string}`;

  /** Bet amount each player put in */
  betAmount: bigint;

  /** Total payout to winner (bet * 2 minus fees) */
  payout: bigint;

  /** Fee taken by the platform */
  fee: bigint;

  /** Net change for the calling wallet (positive if won, negative if lost) */
  netChange: bigint;

  /** Random word from Chainlink VRF (determines winner) */
  randomWord: bigint;

  /** Which side won based on coin flip (0 = heads/playerA, 1 = tails/playerB) */
  coinResult: "heads" | "tails";

  /** Human-readable summary of the result */
  summary: string;

  /** Unix timestamp when game completed */
  completedAt: bigint;

  /** Whether the game was a house game */
  isHouseGame: boolean;
}

/**
 * Clear, structured result of a Dice game.
 *
 * @example
 * ```typescript
 * const result = await client.waitForDiceResult(roomId);
 *
 * console.log(`Winning number: ${result.winningNumber}`);
 * console.log(`My number was: ${result.myNumber}`);
 * console.log(result.summary); // "Number 4 won! You lost (picked 2)"
 * ```
 */
export interface DiceGameResult {
  /** Room ID */
  roomId: bigint;

  /** Did the calling wallet win? */
  didIWin: boolean;

  /** Winner's address */
  winner: `0x${string}`;

  /** Winning dice number (1-6) */
  winningNumber: number;

  /** The number the calling wallet picked (1-6, 0 if not a player) */
  myNumber: number;

  /** Total number of players in the game */
  playerCount: number;

  /** All players in the game */
  players: `0x${string}`[];

  /** Bet amount each player put in */
  betAmount: bigint;

  /** Total payout to winner */
  payout: bigint;

  /** Fee taken */
  fee: bigint;

  /** Net change for the calling wallet */
  netChange: bigint;

  /** Random word from Chainlink VRF */
  randomWord: bigint;

  /** Human-readable summary */
  summary: string;

  /** Timestamp when game completed */
  completedAt: bigint;
}

/**
 * Options for waiting for a game result.
 */
export interface WaitForResultOptions {
  /**
   * Maximum time to wait in milliseconds.
   * @default 120000 (2 minutes)
   */
  timeout?: number;

  /**
   * How often to poll for results in milliseconds.
   * @default 2000 (2 seconds)
   */
  pollInterval?: number;

  /**
   * Callback for progress updates while waiting.
   * @example
   * ```typescript
   * await client.waitForCoinFlipResult(roomId, {
   *   onProgress: (status) => console.log(status),
   * });
   * // "Waiting for opponent to join..." or "Waiting for VRF result..."
   * ```
   */
  onProgress?: (status: string) => void;
}
