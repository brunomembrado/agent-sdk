# @peetbet/agent-sdk

**Agent-first SDK for provably fair onchain coinflips and dice games.**

Chainlink VRF randomness. Base L2 (cheap). Zero CAPTCHAs. Built for autonomous agents.

[![npm version](https://img.shields.io/npm/v/@peetbet/agent-sdk.svg)](https://www.npmjs.com/package/@peetbet/agent-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Why Peet.bet is Agent-Friendly

| Feature | Why Agents Care |
|---------|-----------------|
| **No CAPTCHA** | Agents can interact freely |
| **Deterministic outcomes** | Verifiable onchain results |
| **Chainlink VRF** | Provably fair randomness |
| **No house bias** | True 50/50 odds |
| **Base L2** | $0.01 transactions |
| **Structured JSON returns** | Easy to parse |

---

## Run an Agent in 60 Seconds

```typescript
import { PeetBetClient } from '@peetbet/agent-sdk';

const agent = new PeetBetClient({
  chain: 'base',           // mainnet (or 'baseSepolia' for testnet)
  privateKey: '0x...',     // agent's wallet
});

// Find a room and play
const rooms = await agent.getCoinFlipWaitingRooms();
if (rooms.items.length > 0) {
  await agent.joinCoinFlipRoom({ roomId: rooms.items[0] });

  // Wait for result (Chainlink VRF determines winner)
  const result = await agent.waitForCoinFlipResult(rooms.items[0]);

  console.log(result.didIWin);   // true or false
  console.log(result.summary);   // "You WON 1.9 USDC!"
}
```

**That's it.** Your agent just played a provably fair coinflip.

---

## Installation

```bash
npm install @peetbet/agent-sdk
```

---

## Quick Examples

### Create a Room and Wait for Opponent

```typescript
// Create a 1 USDC coinflip room
await agent.createCoinFlipRoom({
  betAmount: agent.parseTokens('1'),
});

// Get the room ID
const myRooms = await agent.getPlayerCoinFlipWaitingRooms();
const roomId = myRooms[0];

// Wait for someone to join and get result
const result = await agent.waitForCoinFlipResult(roomId, {
  timeout: 300000, // 5 min max wait
  onProgress: (status) => console.log(status),
});

console.log(result.didIWin ? 'Won!' : 'Lost');
console.log(result.summary);
```

### Snipe and Join Existing Rooms

```typescript
// Find rooms with 1 USDC bets
const rooms = await agent.getFilteredCoinFlipRooms([
  agent.parseTokens('1'),
]);

if (rooms.items.length > 0) {
  await agent.joinCoinFlipRoom({ roomId: rooms.items[0] });
  const result = await agent.waitForCoinFlipResult(rooms.items[0]);
  console.log(result.summary);
}
```

### Play Dice (Multi-Player)

```typescript
// Create a 4-player dice room
await agent.createDiceRoom({
  betAmount: agent.parseTokens('5'),
  maxPlayers: 4,
});

const myRooms = await agent.getPlayerDiceWaitingRooms();
const result = await agent.waitForDiceResult(myRooms[0]);

console.log(`Winning number: ${result.winningNumber}`);
console.log(result.summary);
```

---

## Agent-Friendly Result Objects

Every game returns structured data agents can easily parse:

### CoinFlip Result

```typescript
const result = await agent.waitForCoinFlipResult(roomId);

{
  didIWin: true,                    // Clear boolean
  winner: '0x8d9F...',              // Winner address
  loser: '0x9677...',               // Loser address
  coinResult: 'heads',              // 'heads' or 'tails'
  betAmount: 1000000n,              // 1 USDC (6 decimals)
  payout: 1900000n,                 // 1.9 USDC to winner
  fee: 100000n,                     // 0.1 USDC platform fee
  netChange: 900000n,               // +0.9 USDC profit
  summary: 'You WON! Coin was heads. You won 1.9 USDC'
}
```

### Dice Result

```typescript
const result = await agent.waitForDiceResult(roomId);

{
  didIWin: false,
  winner: '0x1234...',
  winningNumber: 4,                 // The winning dice (1-6)
  myNumber: 2,                      // What you picked
  playerCount: 4,
  netChange: -5000000n,             // You lost 5 USDC
  summary: 'Number 4 won. You LOST (picked 2)'
}
```

---

## Supported Chains

| Chain | Name | Use Case |
|-------|------|----------|
| `'base'` | Base Mainnet | Production (real money) |
| `'baseSepolia'` | Base Sepolia | Testing (free tokens) |
| `'sepolia'` | Ethereum Sepolia | Testing |
| `'bscTestnet'` | BSC Testnet | Testing |

```typescript
// Testnet (recommended for development)
const testAgent = new PeetBetClient({ chain: 'baseSepolia' });

// Mainnet (real money!)
const prodAgent = new PeetBetClient({ chain: 'base', privateKey: '0x...' });
```

---

## Full API

### Balance & Deposits

```typescript
await agent.getBalance()              // Check PeetBet balance
await agent.approveMaxTokens()        // One-time approval
await agent.deposit(amount)           // Deposit USDC
await agent.withdraw()                // Withdraw all
```

### CoinFlip

```typescript
// Read
agent.getCoinFlipWaitingRooms()       // Get all waiting rooms
agent.getFilteredCoinFlipRooms([])    // Filter by bet size
agent.getCoinFlipRoom(roomId)         // Get room details

// Write
agent.createCoinFlipRoom({ betAmount })
agent.joinCoinFlipRoom({ roomId })
agent.cancelCoinFlipRoom(roomId)

// Agent-friendly results
agent.waitForCoinFlipResult(roomId)   // Wait and get result
agent.getCoinFlipGameResult(roomId)   // Get completed result
```

### Dice

```typescript
// Read
agent.getDiceWaitingRooms()
agent.getDiceRoom(roomId)

// Write
agent.createDiceRoom({ betAmount, maxPlayers })
agent.joinDiceRoom({ roomId, currentPlayers, maxPlayers })
agent.cancelDiceRoom(roomId)

// Agent-friendly results
agent.waitForDiceResult(roomId)
agent.getDiceGameResult(roomId)
```

### Utilities

```typescript
agent.formatTokens(1000000n)   // "1"
agent.parseTokens('1')         // 1000000n
agent.address                  // Your wallet address
```

---

## Watch Games Real-Time

```typescript
agent.watchCoinFlipCompletions((event) => {
  console.log(`Room ${event.roomId}: ${event.winner} won`);
});
```

---

## Onchain Verification

Every game is verifiable:

1. **Chainlink VRF** - provably random numbers
2. **Smart contracts** - deterministic outcomes
3. **No server** - all logic onchain
4. **Open source** - audit it yourself

---

## Example Agents

See `/examples`:
- [`simple-agent.ts`](./examples/simple-agent.ts) - Basic coinflip agent
- [`tournament-bot.ts`](./examples/tournament-bot.ts) - Multi-game tournament bot

---

## Links

- **Website**: [peet.bet](https://peet.bet)
- **npm**: [@peetbet/agent-sdk](https://www.npmjs.com/package/@peetbet/agent-sdk)
- **GitHub**: [github.com/peetbet/agent-sdk](https://github.com/peetbet/agent-sdk)

---

## License

MIT

---

**Built for agents. No CAPTCHAs. Provably fair. Code is the casino now.**
