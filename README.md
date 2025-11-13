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
| `npm run deploy:token:evm` | Runs `forge script script/DeployERC20Evm.s.sol` against `L2_RPC_URL`. Reads token metadata plus optional `TOKEN_DECIMALS`/`TOKEN_SUPPLY`. Uses Foundry’s account or `PRIVATE_KEY` (see script). |
| `npm run deploy:counter` | Uses `forge create` to deploy `Counter.sol` with the configured `--account` alias (recommended for hardware or keystore-backed flows). |

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
| RPC test fixtures | `TEST_TX_HASH`, `TEST_ADDRESS`, `TEST_BLOCK_NUMBER`, `TEST_BLOCK_HASH`, `TEST_L1_BATCH_NUMBER`, `TEST_MESSAGE_INDEX`, `TEST_MESSAGE_PROOF_ADDRESS` |
| Debug / throttling | `DEBUG_TRACER_TYPE`, `MAX_REQUESTS_PER_SECOND`, `BATCH_SIZE`, `BATCH_DELAY_MS` |

All variables above appear in `.env-example` with comments describing expected formats. Scripts that rely on `PRIVATE_KEY` add a `0x` prefix automatically if you omit it.

## Deployment Flow Details

- `script/DeployERC20.s.sol` is tuned for ZKsync Era: it pins decimals to 18, mints `100 * 10 ** 18`, broadcasts with `PRIVATE_KEY`, and verifies through `forge script ... --zksync --verify`.
- `script/DeployERC20Evm.s.sol` targets standard EVM RPC endpoints and supports user-configurable `TOKEN_DECIMALS`/`TOKEN_SUPPLY`. The script normalizes the private key, calculates the scaled supply, then deploys `MyToken`.
- `npm run deploy:counter` wraps `forge create` so you can quickly validate your signer configuration before attempting bigger deployments.

## RPC Coverage Snapshot

`index.js` currently exercises:

- **Ethereum JSON-RPC:** `eth_accounts`, `eth_blockNumber`, `eth_call`, `eth_chainId`, `eth_estimateGas`, `eth_feeHistory`, `eth_gasPrice`, `eth_getBalance`, `eth_getBlockByHash`, `eth_getBlockByNumber`, `eth_getBlockReceipts`, `eth_getBlockTransactionCountByHash`, `eth_getBlockTransactionCountByNumber`, `eth_getCode`, `eth_getFilterChanges`, `eth_getFilterLogs`, `eth_getLogs`, `eth_getStorageAt`, `eth_getTransactionByBlockHashAndIndex`, `eth_getTransactionByHash`, `eth_getTransactionCount`, `eth_getTransactionReceipt`, `eth_newBlockFilter`, `eth_newFilter`, `eth_newPendingTransactionFilter`, `eth_protocolVersion`, `eth_syncing`. Calls that require an unlocked signer / WS transport (`eth_sendRawTransaction`, `eth_sendTransaction`, `eth_subscribe`) are skipped intentionally.
- **Debug JSON-RPC:** hooks are wired for `debug_traceBlockByNumber`, `debug_traceBlockByHash`, `debug_traceCall`, `debug_traceTransaction` (controlled via the same `.env` inputs).
- **ZKsync JSON-RPC:** `zks_estimateFee`, `zks_estimateGasL1ToL2`, `zks_getBridgeContracts`, `zks_L1ChainId`, `zks_getConfirmedTokens`, `zks_getAllAccountBalances`, `zks_getL2ToL1MsgProof`, `zks_L1BatchNumber`, `zks_getBlockDetails`, `zks_getTransactionDetails`, `zks_getL1BatchDetails`, `zks_getProtocolVersion`.

Each run writes a pass/fail summary to `logs/test_results.log` and any failures with payloads to `logs/errors.log`, making it easy to diff regressions between networks.

## Dependencies

- **Node.js**: `axios`, `dotenv`, `cross-env` (installed via `npm install`)
- **Foundry**: `OpenZeppelin/openzeppelin-contracts`, `foundry-rs/forge-std` (installed automatically through the `postinstall` hook)

Ensure Foundry is installed globally (`foundryup`) before running the deployment scripts.
