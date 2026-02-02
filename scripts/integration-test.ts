/**
 * Integration Test for PeetBet SDK
 *
 * This script tests the SDK against real deployed contracts on testnets.
 * Run with: npx tsx scripts/integration-test.ts
 */

import { PeetBetClient, getSupportedChains, getChainConfig } from "../src";

// ANSI colors for output
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const blue = (s: string) => `\x1b[34m${s}\x1b[0m`;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`  ${green("✓")} ${name} ${yellow(`(${duration}ms)`)}`);
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMsg, duration });
    console.log(`  ${red("✗")} ${name}`);
    console.log(`    ${red(errorMsg)}`);
  }
}

async function runIntegrationTests() {
  console.log("\n" + blue("═".repeat(60)));
  console.log(blue("  PeetBet SDK Integration Tests"));
  console.log(blue("═".repeat(60)) + "\n");

  // Test each supported chain
  for (const chainName of getSupportedChains()) {
    const config = getChainConfig(chainName);

    // Skip mainnet for automated tests (don't want to accidentally spend real money)
    if (!config.isTestnet) {
      console.log(yellow(`⏭  Skipping ${chainName} (mainnet) for safety\n`));
      continue;
    }

    console.log(blue(`\n📡 Testing ${config.name} (${chainName})`));
    console.log(blue(`   Chain ID: ${config.chainId}`));
    console.log(blue("-".repeat(40)));

    const client = new PeetBetClient({ chain: chainName });

    // ═══════════════════════════════════════════════════════════════
    // CLIENT SETUP TESTS
    // ═══════════════════════════════════════════════════════════════

    await test("Client created with correct chain", async () => {
      if (client.chain.chainId !== config.chainId) {
        throw new Error(`Expected chainId ${config.chainId}, got ${client.chain.chainId}`);
      }
    });

    await test("Client has contract addresses", async () => {
      if (!client.contracts.peerBetCore.startsWith("0x")) {
        throw new Error("Invalid peerBetCore address");
      }
      if (!client.contracts.coinFlipGame.startsWith("0x")) {
        throw new Error("Invalid coinFlipGame address");
      }
      if (!client.contracts.diceGame.startsWith("0x")) {
        throw new Error("Invalid diceGame address");
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // PLATFORM INFO TESTS (Read from blockchain)
    // ═══════════════════════════════════════════════════════════════

    await test("getAllowedBetSizes returns array", async () => {
      const betSizes = await client.getAllowedBetSizes();
      if (!Array.isArray(betSizes)) {
        throw new Error("Expected array of bet sizes");
      }
      if (betSizes.length === 0) {
        throw new Error("Expected at least one bet size");
      }
      console.log(`    → Found ${betSizes.length} bet sizes: ${betSizes.map(b => client.formatTokens(b)).join(", ")} USDC`);
    });

    await test("getSecurityStatus returns valid status", async () => {
      const status = await client.getSecurityStatus();
      if (typeof status.casinoEnabled !== "boolean") {
        throw new Error("casinoEnabled should be boolean");
      }
      if (typeof status.casinoShutdown !== "boolean") {
        throw new Error("casinoShutdown should be boolean");
      }
      console.log(`    → Casino enabled: ${status.casinoEnabled}, Shutdown: ${status.casinoShutdown}`);
    });

    // ═══════════════════════════════════════════════════════════════
    // COINFLIP TESTS
    // ═══════════════════════════════════════════════════════════════

    await test("isCoinFlipActive returns boolean", async () => {
      const active = await client.isCoinFlipActive();
      if (typeof active !== "boolean") {
        throw new Error("Expected boolean");
      }
      console.log(`    → CoinFlip active: ${active}`);
    });

    await test("getCoinFlipTotalGames returns bigint", async () => {
      const total = await client.getCoinFlipTotalGames();
      if (typeof total !== "bigint") {
        throw new Error("Expected bigint");
      }
      console.log(`    → Total CoinFlip games: ${total}`);
    });

    await test("getCoinFlipTotalRooms returns bigint", async () => {
      const total = await client.getCoinFlipTotalRooms();
      if (typeof total !== "bigint") {
        throw new Error("Expected bigint");
      }
      console.log(`    → Total CoinFlip rooms: ${total}`);
    });

    await test("getCoinFlipWaitingRooms returns paginated result", async () => {
      const result = await client.getCoinFlipWaitingRooms({ limit: 10n });
      if (!Array.isArray(result.items)) {
        throw new Error("Expected items array");
      }
      if (typeof result.total !== "bigint") {
        throw new Error("Expected total as bigint");
      }
      console.log(`    → ${result.total} waiting rooms (showing ${result.items.length})`);
    });

    // Test getting room details if there are any waiting rooms
    await test("getCoinFlipRoom returns room details (if rooms exist)", async () => {
      const rooms = await client.getCoinFlipWaitingRooms({ limit: 1n });
      if (rooms.items.length > 0) {
        const room = await client.getCoinFlipRoom(rooms.items[0]);
        if (typeof room.id !== "bigint") throw new Error("Room id should be bigint");
        if (typeof room.betAmount !== "bigint") throw new Error("betAmount should be bigint");
        if (typeof room.isActive !== "boolean") throw new Error("isActive should be boolean");
        console.log(`    → Room ${room.id}: ${client.formatTokens(room.betAmount)} USDC, active: ${room.isActive}`);
      } else {
        console.log(`    → No waiting rooms to test (skipped room details)`);
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // DICE TESTS
    // ═══════════════════════════════════════════════════════════════

    await test("isDiceActive returns boolean", async () => {
      const active = await client.isDiceActive();
      if (typeof active !== "boolean") {
        throw new Error("Expected boolean");
      }
      console.log(`    → Dice active: ${active}`);
    });

    await test("getDiceTotalGames returns bigint", async () => {
      const total = await client.getDiceTotalGames();
      if (typeof total !== "bigint") {
        throw new Error("Expected bigint");
      }
      console.log(`    → Total Dice games: ${total}`);
    });

    await test("getDiceWaitingRooms returns paginated result", async () => {
      const result = await client.getDiceWaitingRooms({ limit: 10n });
      if (!Array.isArray(result.items)) {
        throw new Error("Expected items array");
      }
      if (typeof result.total !== "bigint") {
        throw new Error("Expected total as bigint");
      }
      console.log(`    → ${result.total} waiting rooms (showing ${result.items.length})`);
    });

    // Test getting dice room details if there are any waiting rooms
    await test("getDiceRoom returns room details (if rooms exist)", async () => {
      const rooms = await client.getDiceWaitingRooms({ limit: 1n });
      if (rooms.items.length > 0) {
        const room = await client.getDiceRoom(rooms.items[0]);
        if (typeof room.id !== "bigint") throw new Error("Room id should be bigint");
        if (typeof room.maxPlayers !== "number") throw new Error("maxPlayers should be number");
        if (typeof room.currentPlayers !== "number") throw new Error("currentPlayers should be number");
        console.log(`    → Room ${room.id}: ${room.currentPlayers}/${room.maxPlayers} players, ${client.formatTokens(room.betAmount)} USDC`);
      } else {
        console.log(`    → No waiting rooms to test (skipped room details)`);
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // VRF COST ESTIMATION
    // ═══════════════════════════════════════════════════════════════

    await test("estimateVrfCost returns cost estimate", async () => {
      const estimate = await client.estimateVrfCost();
      if (typeof estimate.cost !== "bigint") {
        throw new Error("Expected cost as bigint");
      }
      if (estimate.cost <= 0n) {
        throw new Error("VRF cost should be positive");
      }
      // Convert to readable format (wei to ETH/BNB)
      const costInEth = Number(estimate.cost) / 1e18;
      console.log(`    → VRF cost: ~${costInEth.toFixed(6)} ETH/BNB`);
    });

    // ═══════════════════════════════════════════════════════════════
    // UTILITY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    await test("formatTokens and parseTokens are inverse operations", async () => {
      const testAmounts = ["1", "10", "100.5", "0.123456"];
      for (const amount of testAmounts) {
        const parsed = client.parseTokens(amount);
        const formatted = client.formatTokens(parsed);
        if (formatted !== amount) {
          throw new Error(`Round-trip failed: ${amount} -> ${parsed} -> ${formatted}`);
        }
      }
    });

    console.log("");
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

  console.log(`\n  Total: ${results.length} tests`);
  console.log(`  ${green(`Passed: ${passed}`)}`);
  if (failed > 0) {
    console.log(`  ${red(`Failed: ${failed}`)}`);
  }
  console.log(`  Duration: ${yellow(`${totalDuration}ms`)}\n`);

  if (failed > 0) {
    console.log(red("\nFailed tests:"));
    for (const result of results.filter((r) => !r.passed)) {
      console.log(`  ${red("✗")} ${result.name}`);
      console.log(`    ${red(result.error || "Unknown error")}`);
    }
    console.log("");
    process.exit(1);
  } else {
    console.log(green("\n✓ All integration tests passed!\n"));
    console.log("The SDK is working correctly with real blockchain contracts.\n");
    process.exit(0);
  }
}

// Run tests
runIntegrationTests().catch((error) => {
  console.error(red("\nFatal error:"), error);
  process.exit(1);
});
