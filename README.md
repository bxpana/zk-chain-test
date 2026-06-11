# ZKsync Chain Testing Suite

This repository bundles two workflows:
- a Node.js runner (`npm run rpc`) that hits Ethereum/ZKsync RPC endpoints with reproducible payloads, logging results under `logs/`
- Foundry scripts for deploying example contracts (ERC20 + Counter) to L2 chains or general EVM testnets

Both pieces share the same `.env` configuration so you can reuse RPC endpoints, deployer credentials, and token metadata.

## Contracts

| Contract | Path | Notes |
| --- | --- | --- |
| `MyToken` | `src/MyToken.sol` | Thin wrapper around OpenZeppelin ERC20. Constructor accepts `name`, `symbol`, `decimals`, and `initialSupply`. The deploy scripts calculate `initialSupply` as `TOKEN_SUPPLY * 10 ** TOKEN_DECIMALS` and mint it to the broadcaster. |
| `Counter` | `src/Counter.sol` | Simple increment/decrement utility used as a smoke-test deployment target. |

## Available npm Scripts

| Command | Description |
| --- | --- |
| `npm run rpc` | Loads `.env` and executes `index.js`, which exercises the RPC suites and writes structured logs to `logs/test_results.log` and `logs/errors.log`. |
| `npm run deploy:token:zk` | Runs `forge script script/DeployERC20.s.sol` with ZKsync’s `--zksync` pipeline, broadcasts the deployment, and submits verification using `VERIFIER_URL`. Requires `PRIVATE_KEY`. |
| `npm run deploy:token:evm` | Runs `forge script script/DeployERC20Evm.s.sol` against `L2_RPC_URL` with `--skip-simulation`. Reads token metadata plus optional `TOKEN_DECIMALS`/`TOKEN_SUPPLY`. Signs with the `ACCOUNT` keystore alias and verifies through the custom verifier at `VERIFICATION_URL`. |
| `npm run deploy:counter` | Uses `forge create` to deploy `Counter.sol` with the configured `--account` alias (recommended for hardware or keystore-backed flows). |
| `npm run deposit` | Use when your chain's base token is ETH. Deposits ETH from L1 to L2 via the Bridgehub's `requestL2TransactionDirect`, sending `AMOUNT` as the transaction value. Requires `CHAIN_ID`, `TO_ADDRESS`, `AMOUNT`, `BRIDGEHUB_ADDRESS`, `L1_RPC_URL`, and `ACCOUNT`. |
| `npm run deposit-cbt` | Use when your chain has a custom base token (CBT). First approves `L1_NTV` to spend `AMOUNT` of the ERC20 at `L1_CBT_ADDRESS`, then calls the Bridgehub with `--value 0` so the token is pulled from the vault instead of sent as ETH. |

> Note: set `AMOUNT` in `.env` as whole tokens (e.g. `AMOUNT=1` or `AMOUNT=2.5`). The deposit scripts convert it to 18 decimals automatically with `cast to-wei`, so you no longer need to write out the full wei value.

> Tip: import your signer with `forge account import <alias>` and set `ACCOUNT=<alias>` in `.env` so both `deploy:token:evm` and `deploy:counter` share the same keystore entry.

## Quick Start

1. Clone & configure the project.
2. Copy `.env-example` → `.env`, then fill in RPC URLs, credentials, and token settings:
   ```bash
   cp .env-example .env
   ```
3. Install dependencies (installs Node + Foundry packages):
   ```bash
   npm install
   ```
4. (Optional) Import your Foundry account and export `ACCOUNT`:
   ```bash
   forge account import my-deployer
   export ACCOUNT=my-deployer
   ```
5. Deploy a token:
   - ZKsync Era: `npm run deploy:token:zk`
   - Generic EVM (uses `L2_RPC_URL`): `npm run deploy:token:evm`
6. Deploy the `Counter` contract for smoke testing:
   ```bash
   npm run deploy:counter
   ```
7. Exercise RPC suites:
   ```bash
   npm run rpc
   ```

## Environment Variables

| Category | Keys |
| --- | --- |
| RPC endpoints | `L2_RPC_URL`, `L1_RPC_URL` |
| Verification | `VERIFIER_URL`, `VERIFICATION_URL`, `ZKSYNC_VERIFIER_URL` |
| Credentials | `PRIVATE_KEY` (0x or raw hex), `ACCOUNT` (Foundry keystore alias) |
| Token metadata | `TOKEN_NAME`, `TOKEN_SYMBOL`, `TOKEN_DECIMALS` (default 18), `TOKEN_SUPPLY` (default 100 whole tokens) |
| Deposits | `CHAIN_ID`, `TO_ADDRESS`, `AMOUNT` (whole tokens, auto-converted to 18 decimals), `BRIDGEHUB_ADDRESS`, `L1_CBT_ADDRESS`, `L1_NTV` |
| RPC test fixtures | `TEST_TX_HASH`, `TEST_ADDRESS`, `TEST_BLOCK_NUMBER`, `TEST_BLOCK_HASH`, `TEST_L1_BATCH_NUMBER`, `TEST_MESSAGE_INDEX`, `TEST_MESSAGE_PROOF_ADDRESS` |
| Debug / throttling | `DEBUG_TRACER_TYPE`, `MAX_REQUESTS_PER_SECOND`, `BATCH_SIZE`, `BATCH_DELAY_MS` |

All variables above appear in `.env-example` with comments describing expected formats. Scripts that rely on `PRIVATE_KEY` add a `0x` prefix automatically if you omit it.

## Deployment Flow Details

- `script/DeployERC20.s.sol` is tuned for ZKsync Era: it pins decimals to 18, mints `100 * 10 ** 18`, broadcasts with `PRIVATE_KEY`, and verifies through `forge script ... --zksync --verify`.
- `script/DeployERC20Evm.s.sol` targets standard EVM RPC endpoints and supports user-configurable `TOKEN_DECIMALS`/`TOKEN_SUPPLY`. The signer is resolved by forge CLI flags (`--account $ACCOUNT`), then the script calculates the scaled supply and deploys `MyToken`.
- `npm run deposit` and `npm run deposit-cbt` send L1 -> L2 deposits through the Bridgehub, but they are not interchangeable: `deposit` is for chains whose base token is ETH (the amount rides along as msg.value), while `deposit-cbt` is for chains with a custom base token (an ERC20 approval to the Native Token Vault followed by a zero-value Bridgehub call). In both cases `AMOUNT` is converted from whole tokens to 18 decimals with `cast to-wei` before the transactions are sent.
- `npm run deploy:counter` wraps `forge create` so you can quickly validate your signer configuration before attempting bigger deployments.

## RPC Coverage Snapshot

`index.js` currently exercises:

- **Ethereum JSON-RPC:** `web3_clientVersion`, `eth_accounts`, `eth_blockNumber`, `eth_blobBaseFee`, `eth_call`, `eth_chainId`, `eth_coinbase`, `eth_createAccessList`, `eth_estimateGas`, `eth_feeHistory`, `eth_gasPrice`, `eth_getBalance`, `eth_getBlockByHash`, `eth_getBlockByNumber`, `eth_getBlockReceipts`, `eth_getBlockTransactionCountByHash`, `eth_getBlockTransactionCountByNumber`, `eth_getCode`, `eth_getFilterChanges`, `eth_getFilterLogs`, `eth_getLogs`, `eth_getProof`, `eth_getStorageAt`, `eth_getTransactionByBlockHashAndIndex`, `eth_getTransactionByBlockNumberAndIndex`, `eth_getTransactionByHash`, `eth_getTransactionCount`, `eth_getTransactionReceipt`, `eth_getUncleCountByBlockHash`, `eth_getUncleCountByBlockNumber`, `eth_maxPriorityFeePerGas`, `eth_newBlockFilter`, `eth_newFilter`, `eth_newPendingTransactionFilter`, `eth_protocolVersion`, `eth_simulateV1`, `eth_syncing`. Methods that require an unlocked signer or WS transport (`eth_sign`, `eth_signTransaction`, `eth_sendRawTransaction`, `eth_sendTransaction`, `eth_subscribe`) are logged as skipped so gaps remain visible.
- **Debug JSON-RPC:** `debug_traceBlockByHash`, `debug_traceBlockByNumber`, `debug_traceCall`, `debug_traceTransaction`, `debug_getRawTransactions`, `debug_getRawHeader`, `debug_getRawBlock`, `debug_getRawTransaction`, `debug_getRawReceipts`, `debug_getBadBlocks`.
- **ZKsync JSON-RPC:** `zks_estimateFee`, `zks_estimateGasL1ToL2`, `zks_getBridgeContracts`, `zks_L1ChainId`, `zks_getConfirmedTokens`, `zks_getAllAccountBalances`, `zks_getL2ToL1MsgProof`, `zks_L1BatchNumber`, `zks_getBlockDetails`, `zks_getTransactionDetails`, `zks_getL1BatchDetails`, `zks_getProtocolVersion`.

Each run writes a pass/fail summary to `logs/test_results.log` and any failures with payloads to `logs/errors.log`, making it easy to diff regressions between networks.

## Dependencies

- **Node.js**: `axios`, `dotenv`, `cross-env` (installed via `npm install`)
- **Foundry**: `OpenZeppelin/openzeppelin-contracts`, `foundry-rs/forge-std` (installed automatically through the `postinstall` hook)

Ensure Foundry is installed globally (`foundryup`) before running the deployment scripts.
