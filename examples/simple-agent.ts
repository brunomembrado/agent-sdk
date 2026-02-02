/**
 * Simple Coinflip Agent
 *
 * A minimal example showing how to build an autonomous agent
 * that plays coinflip on Peet.bet.
 *
 * Run with: npx tsx examples/simple-agent.ts
 *
 * Requirements:
 * - Private key with Base Sepolia ETH for gas
 * - USDC deposited in PeetBet
 */

import { PeetBetClient } from '../src';

// Configuration
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
const CHAIN = 'baseSepolia' as const; // Use 'base' for mainnet
const BET_AMOUNT = 1; // 1 USDC (simple number - SDK handles conversion)

async function main() {
  // Validate environment
  if (!PRIVATE_KEY) {
    console.error('Set AGENT_PRIVATE_KEY environment variable');
    process.exit(1);
  }

  // Create agent
  const agent = new PeetBetClient({
    chain: CHAIN,
    privateKey: PRIVATE_KEY,
  });

  console.log(`Agent Address: ${agent.address}`);
  console.log(`Chain: ${agent.chain.name}`);
  console.log('---');

  // Check balance
  const balance = await agent.getBalance();
  const betAmountUnits = agent.parseTokens(BET_AMOUNT.toString());

  console.log(`Balance: ${agent.formatTokens(balance)} USDC`);

  if (balance < betAmountUnits) {
    console.error(`Insufficient balance. Need at least ${BET_AMOUNT} USDC`);
    process.exit(1);
  }

  // Strategy: Join existing room if available, otherwise create one
  console.log('\nLooking for rooms to join...');

  const rooms = await agent.getFilteredCoinFlipRooms([betAmountUnits]);

  if (rooms.items.length > 0) {
    // Join first available room
    const roomId = rooms.items[0];
    const room = await agent.getCoinFlipRoom(roomId);

    console.log(`Found room ${roomId}`);
    console.log(`  Creator: ${room.playerA.slice(0, 10)}...`);
    console.log(`  Bet: ${agent.formatTokens(room.betAmount)} USDC`);
    console.log('\nJoining room...');

    await agent.joinCoinFlipRoom({ roomId });

    console.log('Joined! Waiting for VRF result...\n');

    // Wait for game result
    const result = await agent.waitForCoinFlipResult(roomId, {
      timeout: 120000,
      onProgress: (status) => console.log(`  ${status}`),
    });

    // Display result
    console.log('\n=== GAME RESULT ===');
    console.log(result.summary);
    console.log(`  Net change: ${result.netChange >= 0n ? '+' : ''}${agent.formatTokens(result.netChange)} USDC`);

  } else {
    // Create a new room
    console.log('No rooms found. Creating one...');

    await agent.createCoinFlipRoom({ betAmount: BET_AMOUNT });

    const myRooms = await agent.getPlayerCoinFlipWaitingRooms();
    const roomId = myRooms[0];

    console.log(`Created room ${roomId}`);
    console.log('Waiting for opponent...\n');

    // Wait for opponent and result
    const result = await agent.waitForCoinFlipResult(roomId, {
      timeout: 300000, // 5 minutes
      onProgress: (status) => console.log(`  ${status}`),
    });

    // Display result
    console.log('\n=== GAME RESULT ===');
    console.log(result.summary);
    console.log(`  Net change: ${result.netChange >= 0n ? '+' : ''}${agent.formatTokens(result.netChange)} USDC`);
  }

  // Final balance
  const finalBalance = await agent.getBalance();
  console.log(`\nFinal balance: ${agent.formatTokens(finalBalance)} USDC`);
}

main().catch(console.error);
