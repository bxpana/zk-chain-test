# ZKsync RPC Testing Script

This script tests various JSON-RPC API methods for ZKsync chains. It includes tests for:
- Ethereum JSON-RPC API
- Debug JSON-RPC API
- ZKsync JSON-RPC API

## Configuration

The script requires a `.env` file with the following configuration:
- `RPC_URL`: The RPC endpoint URL
- `TEST_TX_HASH`: A transaction hash for testing transaction-related methods
- `TEST_ADDRESS`: An address for testing account-related methods
- `MAX_REQUESTS_PER_SECOND`: Maximum requests per second (default: 1000)
- `BATCH_SIZE`: Number of requests per batch (default: 10)
- `BATCH_DELAY_MS`: Delay between batches in milliseconds (default: 1000)

## Rate Limiting

The script implements rate limiting to stay within ZKsync's limits:
- Maximum 1000 requests per second
- Requests are batched and executed with appropriate delays

## Test Categories

### Ethereum RPC Tests
- [ ] eth_chainId
- [ ] eth_call
- [ ] eth_estimateGas
- [ ] eth_gasPrice
- [ ] eth_getBalance
- [ ] eth_getBlockByNumber
- [ ] eth_getBlockByHash
- [ ] eth_getTransactionByHash
- [ ] eth_getTransactionReceipt

### Debug RPC Tests
- [ ] debug_traceBlockByNumber
- [ ] debug_traceBlockByHash
- [ ] debug_traceCall
- [ ] debug_traceTransaction

### ZKsync RPC Tests
- [ ] zks_getL1BatchDetails
- [ ] zks_getL1BatchBlockRange
- [ ] zks_getBlockDetails
- [ ] zks_getTransactionDetails
- [ ] zks_getAllAccountBalances
- [ ] zks_getBridgeContracts
- [ ] zks_getTestnetPaymaster
- [ ] zks_getMainContract
- [ ] zks_L1ChainId
- [ ] zks_getConfirmedTokens
- [ ] zks_getL2ToL1LogProof
- [ ] zks_getL2ToL1MsgProof

## Usage

1. Copy `.env-example` to `.env` and fill in the required values
2. Install dependencies: `npm install`
3. Run the script: `node index.js`

## Progress Tracking

- [x] Basic setup
- [x] Environment configuration
- [x] Rate limiting implementation
- [ ] Ethereum RPC tests
- [ ] Debug RPC tests
- [ ] ZKsync RPC tests
- [x] Error handling
- [x] Results logging 