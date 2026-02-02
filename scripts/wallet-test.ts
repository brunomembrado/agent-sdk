/**
 * Wallet Integration Test for PeetBet SDK
 *
 * This script tests WRITE operations with real wallets on Base Sepolia.
 * It performs actual blockchain transactions including a REAL GAME between two wallets.
 *
 * Run with: npx tsx scripts/wallet-test.ts
 *
 * Requirements:
 * - .env file with TEST_MNEMONIC and HOUSE_WALLET_MNEMONIC
 * - Both wallets must have Base Sepolia ETH for gas
 * - Both wallets must have USDC deposited in PeetBet
 */

import { config } from "dotenv";
import { mnemonicToAccount } from "viem/accounts";
import { PeetBetClient } from "../src";

// Load environment variables
config();

// ANSI colors
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const blue = (s: string) => `\x1b[34m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const magenta = (s: string) => `\x1b[35m${s}\x1b[0m`;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
  txHash?: string;
}

const results: TestResult[] = [];

async function test(
  name: string,
  fn: () => Promise<string | void>
): Promise<void> {
  const start = Date.now();
  try {
    const txHash = await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration, txHash: txHash || undefined });
    console.log(`  ${green("✓")} ${name} ${yellow(`(${duration}ms)`)}`);
    if (txHash) {
      console.log(`    ${cyan(`TX: ${txHash}`)}`);
    }
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMsg, duration });
    console.log(`  ${red("✗")} ${name}`);
    console.log(`    ${red(errorMsg.slice(0, 200))}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runWalletTests() {
  console.log("\n" + blue("═".repeat(60)));
  console.log(blue("  PeetBet SDK Wallet Integration Tests"));
  console.log(blue("  Chain: Base Sepolia (testnet)"));
  console.log(blue("  Mode: Two-Wallet Real Game Test"));
  console.log(blue("═".repeat(60)) + "\n");

  // Get mnemonics from env
  const mnemonic1 = process.env.TEST_MNEMONIC;
  const mnemonic2 = process.env.HOUSE_WALLET_MNEMONIC;

  if (!mnemonic1) {
    console.error(red("ERROR: TEST_MNEMONIC not found in .env file"));
    process.exit(1);
  }

  if (!mnemonic2) {
    console.error(red("ERROR: HOUSE_WALLET_MNEMONIC not found in .env file"));
    console.log(yellow("\nAdd HOUSE_WALLET_MNEMONIC to .env for two-wallet tests\n"));
  }

  // Derive private keys from mnemonics
  const account1 = mnemonicToAccount(mnemonic1);
  const privateKey1 = `0x${Buffer.from(account1.getHdKey().privateKey!).toString("hex")}` as `0x${string}`;

  let privateKey2: `0x${string}` | undefined;
  let account2: ReturnType<typeof mnemonicToAccount> | undefined;

  if (mnemonic2) {
    account2 = mnemonicToAccount(mnemonic2);
    privateKey2 = `0x${Buffer.from(account2.getHdKey().privateKey!).toString("hex")}` as `0x${string}`;
  }

  console.log(blue(`Wallet 1 (Creator): ${account1.address}`));
  if (account2) {
    console.log(blue(`Wallet 2 (Joiner):  ${account2.address}`));
  }
  console.log(blue("-".repeat(60)) + "\n");

  // Create clients
  const client1 = new PeetBetClient({
    chain: "baseSepolia",
    privateKey: privateKey1,
  });

  let client2: PeetBetClient | undefined;
  if (privateKey2) {
    client2 = new PeetBetClient({
      chain: "baseSepolia",
      privateKey: privateKey2,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // WALLET 1 SETUP
  // ═══════════════════════════════════════════════════════════════

  console.log(blue("📋 Wallet 1 Setup"));
  console.log(blue("-".repeat(40)));

  let wallet1Balance = 0n;
  await test("Check Wallet 1 PeetBet balance", async () => {
    wallet1Balance = await client1.getBalance();
    console.log(`    → Balance: ${client1.formatTokens(wallet1Balance)} USDC`);
  });

  // ═══════════════════════════════════════════════════════════════
  // WALLET 2 SETUP (if available)
  // ═══════════════════════════════════════════════════════════════

  let wallet2Balance = 0n;
  if (client2) {
    console.log("\n" + blue("📋 Wallet 2 Setup"));
    console.log(blue("-".repeat(40)));

    await test("Check Wallet 2 PeetBet balance", async () => {
      wallet2Balance = await client2!.getBalance();
      console.log(`    → Balance: ${client2!.formatTokens(wallet2Balance)} USDC`);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PLATFORM STATUS
  // ═══════════════════════════════════════════════════════════════

  console.log("\n" + blue("🎰 Platform Status"));
  console.log(blue("-".repeat(40)));

  let casinoEnabled = false;
  await test("Get platform status", async () => {
    const status = await client1.getSecurityStatus();
    casinoEnabled = status.casinoEnabled;
    console.log(`    → Casino Enabled: ${status.casinoEnabled}`);
  });

  const betSizes = await client1.getAllowedBetSizes();
  const smallestBet = betSizes[0];
  console.log(`    → Smallest bet: ${client1.formatTokens(smallestBet)} USDC`);

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: CREATE AND CANCEL ROOM
  // ═══════════════════════════════════════════════════════════════

  if (casinoEnabled && wallet1Balance >= smallestBet) {
    console.log("\n" + blue("🪙 Test 1: Create and Cancel Room"));
    console.log(blue("-".repeat(40)));

    // Clean up any existing rooms first
    const existingRooms = await client1.getPlayerCoinFlipWaitingRooms();
    if (existingRooms.length > 0) {
      console.log(yellow(`    Cleaning up ${existingRooms.length} existing room(s)...`));
      for (const roomId of existingRooms) {
        try {
          await client1.cancelCoinFlipRoom(roomId);
          console.log(`    → Cancelled room ${roomId}`);
        } catch (e) {
          console.log(yellow(`    → Could not cancel room ${roomId}`));
        }
      }
      await sleep(2000);
    }

    let testRoom1Id: bigint | null = null;

    await test("Create CoinFlip room (1 USDC)", async () => {
      const { hash } = await client1.createCoinFlipRoom({
        betAmount: smallestBet,
      });
      await sleep(1000);
      const myRooms = await client1.getPlayerCoinFlipWaitingRooms();
      if (myRooms.length > 0) {
        testRoom1Id = myRooms[0];
        console.log(`    → Room ID: ${testRoom1Id}`);
      }
      return hash;
    });

    if (testRoom1Id) {
      await test("Get room details", async () => {
        const room = await client1.getCoinFlipRoom(testRoom1Id!);
        console.log(`    → Creator: ${room.playerA.slice(0, 10)}...`);
        console.log(`    → Bet: ${client1.formatTokens(room.betAmount)} USDC`);
        console.log(`    → Active: ${room.isActive}`);
      });

      await test("Cancel room (refund)", async () => {
        const { hash } = await client1.cancelCoinFlipRoom(testRoom1Id!);
        return hash;
      });

      await sleep(2000);

      await test("Verify room cancelled", async () => {
        const myRooms = await client1.getPlayerCoinFlipWaitingRooms();
        if (myRooms.includes(testRoom1Id!)) {
          throw new Error("Room still exists");
        }
        console.log(`    → Room successfully cancelled`);
      });
    }
  } else {
    console.log(yellow("\n⏭ Skipping Test 1 (insufficient balance or casino disabled)"));
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: TWO-WALLET REAL GAME
  // ═══════════════════════════════════════════════════════════════

  // Refresh balances
  wallet1Balance = await client1.getBalance();
  if (client2) {
    wallet2Balance = await client2.getBalance();
  }

  const canPlayGame = client2 &&
                      casinoEnabled &&
                      wallet1Balance >= smallestBet &&
                      wallet2Balance >= smallestBet;

  if (canPlayGame) {
    console.log("\n" + magenta("═".repeat(60)));
    console.log(magenta("  🎲 Test 2: REAL GAME Between Two Wallets"));
    console.log(magenta("═".repeat(60)));

    console.log(`\n  Wallet 1 balance: ${client1.formatTokens(wallet1Balance)} USDC`);
    console.log(`  Wallet 2 balance: ${client2!.formatTokens(wallet2Balance)} USDC`);
    console.log(`  Bet amount: ${client1.formatTokens(smallestBet)} USDC\n`);

    let gameRoomId: bigint | null = null;

    // Wallet 1 creates room
    await test("[Wallet 1] Create CoinFlip room", async () => {
      const { hash } = await client1.createCoinFlipRoom({
        betAmount: smallestBet,
      });
      await sleep(1000);
      const myRooms = await client1.getPlayerCoinFlipWaitingRooms();
      if (myRooms.length > 0) {
        gameRoomId = myRooms[0];
        console.log(`    → Room ID: ${gameRoomId}`);
      }
      return hash;
    });

    if (gameRoomId) {
      // Verify room exists
      await test("[Wallet 1] Verify room is waiting", async () => {
        const room = await client1.getCoinFlipRoom(gameRoomId!);
        console.log(`    → Creator: ${room.playerA.slice(0, 10)}...`);
        console.log(`    → Bet: ${client1.formatTokens(room.betAmount)} USDC`);
        if (room.playerB !== "0x0000000000000000000000000000000000000000") {
          throw new Error("Room already has opponent");
        }
        console.log(`    → Waiting for opponent...`);
      });

      // Wallet 2 joins room - THIS TRIGGERS THE REAL GAME!
      console.log("\n" + magenta("  🎰 JOINING ROOM - REAL COINFLIP STARTING!"));
      console.log(magenta("  This will use Chainlink VRF for randomness...\n"));

      await test("[Wallet 2] Join room (triggers VRF)", async () => {
        const { hash } = await client2!.joinCoinFlipRoom({ roomId: gameRoomId! });
        console.log(`    → VRF request sent!`);
        return hash;
      });

      // Wait for VRF callback using new agent-friendly method
      console.log(yellow("\n  ⏳ Waiting for Chainlink VRF callback (up to 120s)...\n"));

      const startWait = Date.now();
      let gameResult;

      try {
        // Use the new waitForCoinFlipResult method - much cleaner for agents!
        gameResult = await client1.waitForCoinFlipResult(gameRoomId!, {
          timeout: 120000, // 2 minutes
          pollInterval: 2000,
          onProgress: (status) => {
            process.stdout.write(`  ${status}\r`);
          },
        });

        const waitDuration = Date.now() - startWait;
        console.log(green(`\n  ✓ Game completed after ${Math.round(waitDuration / 1000)} seconds!`));

        // Display agent-friendly result
        console.log("\n" + magenta("═".repeat(60)));
        console.log(magenta("  🎉 AGENT-FRIENDLY GAME RESULT"));
        console.log(magenta("═".repeat(60)));

        console.log("\n" + cyan("  📊 Structured Result (what agents see):"));
        console.log(`    • didIWin: ${gameResult.didIWin}`);
        console.log(`    • winner: ${gameResult.winner.slice(0, 10)}...`);
        console.log(`    • loser: ${gameResult.loser.slice(0, 10)}...`);
        console.log(`    • coinResult: ${gameResult.coinResult}`);
        console.log(`    • betAmount: ${client1.formatTokens(gameResult.betAmount)} USDC`);
        console.log(`    • payout: ${client1.formatTokens(gameResult.payout)} USDC`);
        console.log(`    • fee: ${client1.formatTokens(gameResult.fee)} USDC`);
        console.log(`    • netChange: ${gameResult.netChange >= 0n ? '+' : ''}${client1.formatTokens(gameResult.netChange)} USDC`);

        console.log("\n" + cyan("  💬 Human-Readable Summary:"));
        console.log(`    ${gameResult.summary}`);

        // Also get result from Wallet 2's perspective
        const gameResult2 = await client2!.getCoinFlipGameResult(gameRoomId!);
        console.log("\n" + cyan("  👤 Wallet 2's Perspective:"));
        console.log(`    ${gameResult2.summary}`);

        // Check final balances
        const finalBalance1 = await client1.getBalance();
        const finalBalance2 = await client2!.getBalance();

        console.log("\n" + cyan("  💰 Final Balances:"));
        console.log(`    Wallet 1: ${client1.formatTokens(wallet1Balance)} → ${client1.formatTokens(finalBalance1)} USDC`);
        console.log(`    Wallet 2: ${client2!.formatTokens(wallet2Balance)} → ${client2!.formatTokens(finalBalance2)} USDC`);

        results.push({ name: "Agent-friendly result retrieved", passed: true, duration: waitDuration });

      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.log(red(`\n  ✗ ${errorMsg}`));
        console.log(yellow("    VRF callback may still be pending. Check room status later."));
        results.push({ name: "Agent-friendly result retrieved", passed: false, error: errorMsg, duration: 120000 });
      }
    }
  } else if (!client2) {
    console.log(yellow("\n⏭ Skipping two-wallet game test (HOUSE_WALLET_MNEMONIC not set)"));
  } else if (!casinoEnabled) {
    console.log(yellow("\n⏭ Skipping two-wallet game test (casino disabled)"));
  } else {
    console.log(yellow(`\n⏭ Skipping two-wallet game test (need ${client1.formatTokens(smallestBet)} USDC in both wallets)`));
    console.log(`    Wallet 1: ${client1.formatTokens(wallet1Balance)} USDC`);
    console.log(`    Wallet 2: ${client2!.formatTokens(wallet2Balance)} USDC`);
  }

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════

  console.log("\n" + blue("═".repeat(60)));
  console.log(blue("  Test Summary"));
  console.log(blue("═".repeat(60)));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const txCount = results.filter((r) => r.txHash).length;

  console.log(`\n  Total: ${results.length} tests`);
  console.log(`  ${green(`Passed: ${passed}`)}`);
  if (failed > 0) {
    console.log(`  ${red(`Failed: ${failed}`)}`);
  }
  console.log(`  Transactions: ${cyan(`${txCount}`)}`);
  console.log(`  Duration: ${yellow(`${(totalDuration / 1000).toFixed(1)}s`)}\n`);

  if (failed > 0) {
    console.log(red("\nFailed tests:"));
    for (const result of results.filter((r) => !r.passed)) {
      console.log(`  ${red("✗")} ${result.name}`);
      console.log(`    ${red(result.error || "Unknown error")}`);
    }
    process.exit(1);
  } else {
    console.log(green("\n✓ All wallet tests passed!\n"));
    process.exit(0);
  }
}

// Run tests
runWalletTests().catch((error) => {
  console.error(red("\nFatal error:"), error);
  process.exit(1);
});
