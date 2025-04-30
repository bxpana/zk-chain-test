# ZKsync RPC Testing Script

This script tests various JSON-RPC API methods for ZKsync chains. It includes tests for:
- [Ethereum JSON-RPC API](https://docs.zksync.io/zksync-protocol/api/ethereum-rpc)
- [Debug JSON-RPC API](https://docs.zksync.io/zksync-protocol/api/debug-rpc)
- [ZKsync JSON-RPC API](https://docs.zksync.io/zksync-protocol/api/zks-rpc)

## Configuration

The script requires a `.env` file with the following configuration:

### RPC Configuration
- `RPC_URL`: The RPC endpoint URL

### Test Data Configuration
- `TEST_TX_HASH`: A transaction hash for testing transaction-related methods
- `TEST_ADDRESS`: An address for testing account-related methods
- `TEST_BLOCK_NUMBER`: A specific L2 block number for testing block-related methods (instead of 'latest')
- `TEST_BLOCK_HASH`: A specific L2 block hash for testing block-related methods
- `TEST_L1_BATCH_NUMBER`: A specific L1 batch number for testing batch-related methods
- `TEST_MESSAGE_INDEX`: Message index for L2 to L1 proofs
- `TEST_MESSAGE_PROOF_ADDRESS`: An address that has sent messages from L2 to L1 (required for zks_getL2ToL1MsgProof)

### Debug Configuration
- `DEBUG_TRACER_TYPE`: Tracer type for debug methods (e.g., 'callTracer', 'prestateTracer')

### Rate Limiting Configuration
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
- [ ] eth_blockNumber
- [ ] eth_getBlockByNumber
- [ ] eth_getBlockByHash
- [ ] eth_getBlockTransactionCountByNumber
- [ ] eth_getBlockTransactionCountByHash
- [ ] eth_getUncleCountByBlockNumber
- [ ] eth_getUncleCountByBlockHash
- [ ] eth_getTransactionByHash
- [ ] eth_getTransactionByBlockHashAndIndex
- [ ] eth_getTransactionByBlockNumberAndIndex
- [ ] eth_getTransactionReceipt
- [ ] eth_getBalance
- [ ] eth_getStorageAt
- [ ] eth_getTransactionCount
- [ ] eth_getCode
- [ ] eth_call
- [ ] eth_estimateGas
- [ ] eth_gasPrice
- [ ] eth_maxPriorityFeePerGas
- [ ] eth_feeHistory
- [ ] eth_getLogs
- [ ] eth_getFilterChanges
- [ ] eth_getFilterLogs
- [ ] eth_newFilter
- [ ] eth_newBlockFilter
- [ ] eth_newPendingTransactionFilter
- [ ] eth_uninstallFilter
- [ ] eth_sendRawTransaction
- [ ] eth_syncing

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