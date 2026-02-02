/**
 * # PeetBet SDK
 *
 * A Node.js SDK for AI agents and bots to interact with PeetBet -
 * the decentralized peer-to-peer betting platform.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { PeetBetClient } from '@peetbet/sdk';
 *
 * // Create a client (type "base" and autocomplete will show options!)
 * const client = new PeetBetClient({
 *   chain: "baseSepolia",  // "baseSepolia" | "sepolia" | "bscTestnet" | "base"
 *   privateKey: "0x...",   // Optional for read-only
 * });
 *
 * // Get waiting rooms
 * const rooms = await client.getCoinFlipWaitingRooms();
 *
 * // Join a room
 * if (rooms.items.length > 0) {
 *   await client.joinCoinFlipRoom({ roomId: rooms.items[0] });
 * }
 *
 * // Watch for results
 * client.watchCoinFlipCompletions((event) => {
 *   console.log(`Winner: ${event.winner}`);
 * });
 * ```
 *
 * ## Available Chains
 *
 * | Chain | Name | Description |
 * |-------|------|-------------|
 * | `"baseSepolia"` | Base Sepolia | Testnet - recommended for development |
 * | `"sepolia"` | Ethereum Sepolia | Testnet |
 * | `"bscTestnet"` | BSC Testnet | Testnet |
 * | `"base"` | Base Mainnet | Production - real money! |
 *
 * @packageDocumentation
 */

// Main client - the main entry point
export { PeetBetClient } from "./client";

// Chain configuration - for selecting chains
export {
  CHAIN_CONFIGS,
  CHAIN_IDS,
  getChainConfig,
  getChainConfigById,
  getSupportedChains,
  getTestnetChains,
  getMainnetChains,
  isValidChain,
  type ChainName,
  type PeetBetChainConfig,
} from "./chains";

// Types - for TypeScript users
export type {
  // Client options
  PeetBetClientOptions,

  // Room types
  CoinFlipRoom,
  DiceRoom,

  // Transaction types
  TransactionResult,
  VrfCostEstimate,

  // Event types
  GameCompletedEvent,
  RoomCreatedEvent,
  PlayerJoinedEvent,
  RoomCancelledEvent,
  DepositEvent,
  WithdrawEvent,

  // Operation options
  CreateRoomOptions,
  CreateDiceRoomOptions,
  JoinRoomOptions,
  JoinDiceRoomOptions,

  // Pagination
  PaginationOptions,
  PaginatedResult,

  // Stats
  PlatformStats,
  PlayerStats,
  SecurityStatus,

  // Agent-friendly game results
  CoinFlipGameResult,
  DiceGameResult,
  WaitForResultOptions,
} from "./types";

// ABIs - for advanced usage (direct contract calls)
export {
  peerBetCoreAbi,
  coinFlipGameAbi,
  diceGameAbi,
  erc20Abi,
  peerBetViewsAbi,
} from "./abi";
