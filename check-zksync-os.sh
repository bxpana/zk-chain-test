#!/usr/bin/env bash
#
# check-zksync-os.sh <l2-rpc-url> [l1-rpc-url]
#
# Health check for a ZKsync OS chain, mainnet or testnet. Nothing is sent to a real network.
#   1. Discovers the chain's L1 contracts and picks RPC fixtures from a batched block.
#   2. Runs the zksync-os RPC suite (index.js) against the real L2 RPC.
#   3. Dry-runs the matching deposit (ETH or custom base token) on a local anvil fork of L1.
#
# The L1 is found automatically (public mainnet or Sepolia RPC, whichever knows the chain).
# Pass l1-rpc-url to use your own. Set FORK_PORT to change the anvil port (default 8580).

set -euo pipefail
cd "$(dirname "$0")"

L2="${1:?usage: $0 <l2-rpc-url> [l1-rpc-url]}"
L1="${2:-}"
ETH_TOKEN=0x0000000000000000000000000000000000000001
ZERO=0x0000000000000000000000000000000000000000
DEV=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # anvil's first dev account, unlocked on forks

# ZKsync OS does not implement these, so their failures are expected. The filter methods fail
# intermittently on multi-node public RPCs because each node keeps filters in its own memory.
EXPECTED="eth_coinbase eth_blobBaseFee eth_getProof eth_createAccessList debug_getRawTransactions debug_getRawHeader debug_getRawBlock debug_getRawReceipts debug_getRawTransaction debug_getBadBlocks"
FLAKY="eth_getFilterChanges eth_getFilterLogs"

# --- 1. discovery ------------------------------------------------------------
CLIENT=$(cast rpc web3_clientVersion -r "$L2" | tr -d '"')
[[ "$CLIENT" == zksync-os* ]] || { echo "ABORT: $CLIENT is not a ZKsync OS node, use npm run rpc:eravm"; exit 1; }
CHAIN_ID=$(cast chain-id -r "$L2")
BRIDGEHUB=$(cast rpc zks_getBridgehubContract -r "$L2" | tr -d '"')

if [ -z "$L1" ]; then
  for u in https://ethereum-rpc.publicnode.com https://ethereum-sepolia-rpc.publicnode.com; do
    d=$(cast call "$BRIDGEHUB" "getZKChain(uint256)(address)" "$CHAIN_ID" -r "$u" 2>/dev/null || true)
    if [ -n "$d" ] && [ "$d" != "$ZERO" ]; then L1=$u; break; fi
  done
  [ -n "$L1" ] || { echo "ABORT: no public L1 knows chain $CHAIN_ID at Bridgehub $BRIDGEHUB, pass l1-rpc-url"; exit 1; }
fi

DIAMOND=$(cast call "$BRIDGEHUB" "getZKChain(uint256)(address)" "$CHAIN_ID" -r "$L1")
BASE_TOKEN=$(cast call "$BRIDGEHUB" "baseToken(uint256)(address)" "$CHAIN_ID" -r "$L1")
NTV=$(cast call "$(cast call "$BRIDGEHUB" "assetRouter()(address)" -r "$L1")" "nativeTokenVault()(address)" -r "$L1")
PROTOCOL=$(cast call "$DIAMOND" "getSemverProtocolVersion()(uint32,uint32,uint32)" -r "$L1" | paste -sd. -)

# Fixtures: newest block with a transaction inside a sealed batch, searching back up to 5 batches.
BATCH=$(cast rpc zks_batchNumber -r "$L2")
for ((b=BATCH; b>BATCH-5 && b>0; b--)); do
  range=$(cast rpc zks_getBatchByNumber "$b" -r "$L2" | jq -r '"\(.block_range.start) \(.block_range.end)"')
  read -r start end <<< "$range"
  for ((n=end; n>=start; n--)); do
    TX=$(cast rpc eth_getBlockByNumber "$(cast to-hex "$n")" false -r "$L2" | jq -r '.transactions[0] // empty')
    [ -n "$TX" ] && break 2
  done
done
[ -n "${TX:-}" ] || { echo "ABORT: no transactions in the last 5 batches"; exit 1; }
BLOCK_HASH=$(cast rpc eth_getBlockByNumber "$(cast to-hex "$n")" false -r "$L2" | jq -r .hash)
FROM=$(cast tx "$TX" from -r "$L2")

echo "=============================================================="
echo " Chain:       $CHAIN_ID   protocol $PROTOCOL   $CLIENT"
echo " L1:          chain $(cast chain-id -r "$L1")   Bridgehub $BRIDGEHUB"
echo " Diamond:     $DIAMOND"
echo " Base token:  $([ "$BASE_TOKEN" = "$ETH_TOKEN" ] && echo ETH || echo "$BASE_TOKEN ($(cast call "$BASE_TOKEN" "symbol()(string)" -r "$L1" | tr -d '"'))")"
echo " Fixtures:    batch $b, block $n, tx $TX"
echo "=============================================================="

# --- 2. RPC suite against the real L2 ----------------------------------------
echo
echo "-- RPC suite (node index.js zksync-os) --"
OUT=$(RPC_URL="$L2" TEST_TX_HASH="$TX" TEST_ADDRESS="$FROM" TEST_BLOCK_NUMBER="$n" TEST_BLOCK_HASH="$BLOCK_HASH" \
  TEST_L1_BATCH_NUMBER="$b" TEST_MESSAGE_INDEX=0 TEST_MESSAGE_PROOF_ADDRESS="$FROM" DEBUG_TRACER_TYPE=callTracer \
  MAX_REQUESTS_PER_SECOND=20 BATCH_SIZE=10 BATCH_DELAY_MS=300 node index.js zksync-os 2>&1)
echo "$OUT" | grep -E '^(Total tests|Successful|Failed):' | sed 's/^/   /'
unexpected=0
while read -r line; do
  m=$(echo "$line" | sed -E 's/^✗ ([a-zA-Z0-9_]+).*/\1/')
  if [[ " $EXPECTED " == *" $m "* ]]; then tag="expected, not implemented in ZKsync OS"
  elif [[ " $FLAKY " == *" $m "* ]]; then tag="expected on multi-node RPCs (filters are per node)"
  elif [[ "$line" == *"(SKIPPED)"* ]]; then tag="skipped, no data"
  elif [[ "$line" == *"L2->L1 logs in the transaction"* ]]; then tag="fixture tx has no L2->L1 logs"
  else tag="UNEXPECTED"; unexpected=$((unexpected+1)); fi
  echo "   $line  [$tag]"
done < <(echo "$OUT" | grep '^✗')
echo "   unexpected failures: $unexpected   (full log: logs/test_results.log)"

# --- 3. deposit dry run on an L1 fork ----------------------------------------
PORT="${FORK_PORT:-8580}"
! lsof -ti "tcp:$PORT" >/dev/null || { echo "ABORT: port $PORT busy, set FORK_PORT"; exit 1; }
anvil --fork-url "$L1" --port "$PORT" --silent & ANVIL_PID=$!
trap 'kill $ANVIL_PID 2>/dev/null' EXIT
FORK="http://127.0.0.1:$PORT"
until cast chain-id -r "$FORK" >/dev/null 2>&1; do sleep 1; done

echo
echo "-- deposit dry run on L1 fork (mirrors npm run deposit / deposit-cbt, 1 token) --"
AMOUNT_WEI=$(cast to-wei 1)
REQUEST="($CHAIN_ID,$AMOUNT_WEI,$DEV,50,0x,300000,800,[],$DEV)"
SIG="requestL2TransactionDirect((uint256,uint256,address,uint256,bytes,uint256,uint256,bytes[],address))"
BEFORE=$(cast call "$DIAMOND" "getTotalPriorityTxs()(uint256)" -r "$FORK")
if [ "$BASE_TOKEN" = "$ETH_TOKEN" ]; then
  cast send "$BRIDGEHUB" "$SIG" "$REQUEST" --value "$AMOUNT_WEI" --unlocked --from "$DEV" -r "$FORK" >/dev/null
else
  cast rpc anvil_dealERC20 "$DEV" "$BASE_TOKEN" "$(cast to-hex "$AMOUNT_WEI")" -r "$FORK" >/dev/null
  cast send "$BASE_TOKEN" "approve(address,uint256)" "$NTV" "$AMOUNT_WEI" --unlocked --from "$DEV" -r "$FORK" >/dev/null
  cast send "$BRIDGEHUB" "$SIG" "$REQUEST" --value 0 --unlocked --from "$DEV" -r "$FORK" >/dev/null
fi
AFTER=$(cast call "$DIAMOND" "getTotalPriorityTxs()(uint256)" -r "$FORK")
if [ "$((AFTER - BEFORE))" -eq 1 ]; then
  echo "   PASS: priority tx queued on the diamond ($BEFORE -> $AFTER)"
else
  echo "   FAIL: priority tx count $BEFORE -> $AFTER"
  unexpected=$((unexpected+1))
fi

echo
echo "Not covered: L2 execution of the deposit and withdrawals (need a real network, use testnet)."
[ "$unexpected" -eq 0 ]
