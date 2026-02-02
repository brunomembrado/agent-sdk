/**
 * Tournament Bot
 *
 * An advanced agent that continuously plays coinflip games,
 * tracks statistics, and implements a configurable strategy.
 *
 * Run with: npx tsx examples/tournament-bot.ts
 *
 * Features:
 * - Continuous play loop
 * - Win/loss tracking
 * - Configurable bet sizes
 * - Stop-loss and take-profit limits
 * - Real-time event watching
 */

import { PeetBetClient, type CoinFlipGameResult } from '../src';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Wallet
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  chain: 'baseSepolia' as const, // Use 'base' for mainnet

  // Strategy
  betAmount: '1',           // USDC per game
  maxGames: 10,             // Maximum games to play (0 = unlimited)
  cooldownMs: 5000,         // Wait between games

  // Risk management
  stopLossUSDC: 5,          // Stop if down this much
  takeProfitUSDC: 5,        // Stop if up this much
  minBalance: 2,            // Minimum balance to keep playing
};

// ============================================
// STATS TRACKING
// ============================================

interface Stats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  totalWagered: bigint;
  totalProfit: bigint;
  startingBalance: bigint;
}

const stats: Stats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  totalWagered: 0n,
  totalProfit: 0n,
  startingBalance: 0n,
};

// ============================================
// MAIN BOT
// ============================================

async function main() {
  // Validate config
  if (!CONFIG.privateKey) {
    console.error('Set AGENT_PRIVATE_KEY environment variable');
    process.exit(1);
  }

  // Create agent
  const agent = new PeetBetClient({
    chain: CONFIG.chain,
    privateKey: CONFIG.privateKey,
  });

  console.log('========================================');
  console.log('  PEETBET TOURNAMENT BOT');
  console.log('========================================');
  console.log(`Agent: ${agent.address}`);
  console.log(`Chain: ${agent.chain.name}`);
  console.log(`Bet size: ${CONFIG.betAmount} USDC`);
  console.log(`Max games: ${CONFIG.maxGames || 'unlimited'}`);
  console.log(`Stop loss: ${CONFIG.stopLossUSDC} USDC`);
  console.log(`Take profit: ${CONFIG.takeProfitUSDC} USDC`);
  console.log('----------------------------------------\n');

  // Get starting balance
  stats.startingBalance = await agent.getBalance();
  const betAmount = agent.parseTokens(CONFIG.betAmount);
  const minBalance = agent.parseTokens(CONFIG.minBalance.toString());

  console.log(`Starting balance: ${agent.formatTokens(stats.startingBalance)} USDC\n`);

  if (stats.startingBalance < betAmount) {
    console.error('Insufficient balance to start');
    process.exit(1);
  }

  // Watch for game completions (for logging)
  agent.watchCoinFlipCompletions((event) => {
    if (event.winner === agent.address) {
      console.log(`  [Event] Won room ${event.roomId}!`);
    }
  });

  // Main game loop
  while (true) {
    // Check limits
    const currentBalance = await agent.getBalance();
    const profitLoss = currentBalance - stats.startingBalance;

    // Stop loss check
    if (profitLoss < -agent.parseTokens(CONFIG.stopLossUSDC.toString())) {
      console.log('\n=== STOP LOSS TRIGGERED ===');
      break;
    }

    // Take profit check
    if (profitLoss > agent.parseTokens(CONFIG.takeProfitUSDC.toString())) {
      console.log('\n=== TAKE PROFIT TRIGGERED ===');
      break;
    }

    // Max games check
    if (CONFIG.maxGames > 0 && stats.gamesPlayed >= CONFIG.maxGames) {
      console.log('\n=== MAX GAMES REACHED ===');
      break;
    }

    // Min balance check
    if (currentBalance < minBalance) {
      console.log('\n=== MIN BALANCE REACHED ===');
      break;
    }

    // Play a game
    console.log(`\n--- Game ${stats.gamesPlayed + 1} ---`);
    console.log(`Balance: ${agent.formatTokens(currentBalance)} USDC`);
    console.log(`P/L: ${profitLoss >= 0n ? '+' : ''}${agent.formatTokens(profitLoss)} USDC`);

    try {
      const result = await playOneGame(agent, betAmount);

      // Update stats
      stats.gamesPlayed++;
      stats.totalWagered += betAmount;

      if (result.didIWin) {
        stats.wins++;
        stats.totalProfit += result.netChange;
      } else {
        stats.losses++;
        stats.totalProfit -= betAmount;
      }

      console.log(`Result: ${result.summary}`);

    } catch (error) {
      console.error('Game error:', error instanceof Error ? error.message : error);
      // Continue to next game
    }

    // Cooldown
    if (CONFIG.cooldownMs > 0) {
      await sleep(CONFIG.cooldownMs);
    }
  }

  // Final stats
  printFinalStats(agent);
}

// ============================================
// GAME LOGIC
// ============================================

async function playOneGame(
  agent: PeetBetClient,
  betAmount: bigint
): Promise<CoinFlipGameResult> {
  // Strategy: prefer joining existing rooms (faster)
  const rooms = await agent.getFilteredCoinFlipRooms([betAmount]);

  let roomId: bigint;

  if (rooms.items.length > 0) {
    // Join existing room
    roomId = rooms.items[0];
    console.log(`Joining room ${roomId}...`);
    await agent.joinCoinFlipRoom({ roomId });
  } else {
    // Create new room
    console.log('Creating room...');
    await agent.createCoinFlipRoom({ betAmount });
    const myRooms = await agent.getPlayerCoinFlipWaitingRooms();
    roomId = myRooms[0];
    console.log(`Created room ${roomId}, waiting for opponent...`);
  }

  // Wait for result
  const result = await agent.waitForCoinFlipResult(roomId, {
    timeout: 120000,
    onProgress: (status) => console.log(`  ${status}`),
  });

  return result;
}

// ============================================
// HELPERS
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printFinalStats(agent: PeetBetClient): void {
  const winRate = stats.gamesPlayed > 0
    ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1)
    : '0';

  console.log('\n========================================');
  console.log('  FINAL STATISTICS');
  console.log('========================================');
  console.log(`Games played: ${stats.gamesPlayed}`);
  console.log(`Wins: ${stats.wins}`);
  console.log(`Losses: ${stats.losses}`);
  console.log(`Win rate: ${winRate}%`);
  console.log(`Total wagered: ${agent.formatTokens(stats.totalWagered)} USDC`);
  console.log(`Net P/L: ${stats.totalProfit >= 0n ? '+' : ''}${agent.formatTokens(stats.totalProfit)} USDC`);
  console.log('========================================\n');
}

// ============================================
// RUN
// ============================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
