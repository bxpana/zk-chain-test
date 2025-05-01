# ZKsync Chain Testing Suite

This repository provides tools for testing and interacting with ZKsync chains, including RPC testing and contract deployment.

## Features

### 1. RPC Testing
Comprehensive testing suite for ZKsync's JSON-RPC APIs:
- [Ethereum JSON-RPC API](https://docs.zksync.io/zksync-protocol/api/ethereum-rpc)
- [Debug JSON-RPC API](https://docs.zksync.io/zksync-protocol/api/debug-rpc)
- [ZKsync JSON-RPC API](https://docs.zksync.io/zksync-protocol/api/zks-rpc)

### 2. Contract Deployment
Foundry-based contract deployment setup for ZKsync:
- ERC20 token deployment and verification
- ZKsync-specific configuration
- Environment-based parameter management

## Quick Start

1. Clone the repository
2. Copy `.env-example` to `.env` and configure:
   ```bash
   cp .env-example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Deploy an ERC20 token:
   ```bash
   npm run deploy:token
   ```
5. Run RPC tests:
   ```bash
   npm run test:rpc
   ```

## Configuration

### Environment Variables
Create a `.env` file with the following settings:

#### RPC Configuration
- `RPC_URL`: The RPC endpoint URL
- `ZKSYNC_VERIFIER_URL`: URL for contract verification
- `PRIVATE_KEY`: Private key for deployment (with or without 0x prefix)

#### Token Configuration
- `TOKEN_NAME`: Name of the token to deploy
- `TOKEN_SYMBOL`: Symbol of the token to deploy

#### Test Data
- `TEST_TX_HASH`: Transaction hash for testing
- `TEST_ADDRESS`: Address for account testing
- `TEST_BLOCK_NUMBER`: Specific L2 block number
- `TEST_BLOCK_HASH`: Specific L2 block hash
- `TEST_L1_BATCH_NUMBER`: Specific L1 batch number
- `TEST_MESSAGE_INDEX`: Message index for L2 to L1 proofs
- `TEST_MESSAGE_PROOF_ADDRESS`: Address for L2 to L1 message proofs

#### Debug Configuration
- `DEBUG_TRACER_TYPE`: Tracer type (e.g., 'callTracer', 'prestateTracer')

#### Rate Limiting
- `MAX_REQUESTS_PER_SECOND`: Maximum requests per second (default: 1000)
- `BATCH_SIZE`: Number of requests per batch (default: 10)
- `BATCH_DELAY_MS`: Delay between batches in milliseconds (default: 1000)

## Contract Deployment

### ERC20 Token Deployment
The repository includes a Foundry-based setup for deploying ERC20 tokens on ZKsync:

```bash
npm run deploy:token
```

This will:
- Deploy an ERC20 token with specified name and symbol
- Use 18 decimals and 100 tokens as initial supply
- Verify the contract on ZKsync
- Handle all ZKsync-specific configuration

## RPC Testing

### Test Categories

#### Ethereum RPC Tests
- [ ] eth_chainId
- [ ] eth_blockNumber
- [ ] eth_getBlockByNumber
- [ ] eth_getBlockByHash
- [ ] eth_getTransactionByHash
- [ ] eth_getTransactionReceipt
- [ ] eth_getBalance
- [ ] eth_call
- [ ] eth_estimateGas
- [ ] eth_getLogs
- [ ] eth_sendRawTransaction
- [ ] eth_syncing

#### Debug RPC Tests
- [ ] debug_traceBlockByNumber
- [ ] debug_traceBlockByHash
- [ ] debug_traceCall
- [ ] debug_traceTransaction

#### ZKsync RPC Tests
- [ ] zks_estimateFee
- [ ] zks_estimateGasL1ToL2
- [ ] zks_getBridgeContracts
- [ ] zks_L1ChainId
- [ ] zks_getConfirmedTokens
- [ ] zks_getAllAccountBalances
- [ ] zks_getL2ToL1MsgProof
- [ ] zks_L1BatchNumber
- [ ] zks_getBlockDetails
- [ ] zks_getTransactionDetails
- [ ] zks_getL1BatchDetails
- [ ] zks_getProtocolVersion

## Development Status

- [x] Basic setup
- [x] Environment configuration
- [x] Rate limiting implementation
- [x] ERC20 deployment setup
- [ ] Ethereum RPC tests
- [ ] Debug RPC tests
- [ ] ZKsync RPC tests
- [x] Error handling
- [x] Results logging 