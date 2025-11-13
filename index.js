require('dotenv').config();
const axios = require('axios');
const { promisify } = require('util');
const sleep = promisify(setTimeout);
const fs = require('fs').promises;
const path = require('path');

class ZKSyncRPCTester {
    constructor() {
        // Validate required environment variables
        if (!process.env.RPC_URL) {
            throw new Error('RPC_URL is required in .env file');
        }
        if (!process.env.TEST_TX_HASH) {
            throw new Error('TEST_TX_HASH is required in .env file');
        }
        if (!process.env.TEST_ADDRESS) {
            throw new Error('TEST_ADDRESS is required in .env file');
        }
        if (!process.env.TEST_L1_BATCH_NUMBER) {
            throw new Error('TEST_L1_BATCH_NUMBER is required in .env file');
        }

        this.rpcUrl = process.env.RPC_URL;
        this.testTxHash = process.env.TEST_TX_HASH;
        this.testAddress = process.env.TEST_ADDRESS;
        this.testL1BatchNumber = parseInt(process.env.TEST_L1_BATCH_NUMBER);
        this.testMessageIndex = parseInt(process.env.TEST_MESSAGE_INDEX || '0');
        this.testMessageProofAddress = process.env.TEST_MESSAGE_PROOF_ADDRESS || null;
        this.debugTracerType = process.env.DEBUG_TRACER_TYPE || 'callTracer';
        this.maxRequestsPerSecond = parseInt(process.env.MAX_REQUESTS_PER_SECOND || '1000');
        this.batchSize = parseInt(process.env.BATCH_SIZE || '10');
        this.batchDelayMs = parseInt(process.env.BATCH_DELAY_MS || '1000');
        this.requestQueue = [];
        this.results = [];
        this.logFile = path.join(__dirname, 'logs', 'test_results.log');
        this.errorFile = path.join(__dirname, 'logs', 'errors.log');
    }

    async validateEnvironment() {
        const missingFields = [];
        const invalidFields = [];

        // Check for missing required fields
        if (!process.env.RPC_URL) missingFields.push('RPC_URL');
        if (!process.env.TEST_TX_HASH) missingFields.push('TEST_TX_HASH');
        if (!process.env.TEST_ADDRESS) missingFields.push('TEST_ADDRESS');
        if (!process.env.TEST_L1_BATCH_NUMBER) missingFields.push('TEST_L1_BATCH_NUMBER');

        // Check for invalid formats
        if (process.env.TEST_TX_HASH && !process.env.TEST_TX_HASH.startsWith('0x')) {
            invalidFields.push('TEST_TX_HASH (must start with 0x)');
        }
        if (process.env.TEST_ADDRESS && !process.env.TEST_ADDRESS.startsWith('0x')) {
            invalidFields.push('TEST_ADDRESS (must start with 0x)');
        }
        if (process.env.TEST_L1_BATCH_NUMBER && isNaN(parseInt(process.env.TEST_L1_BATCH_NUMBER))) {
            invalidFields.push('TEST_L1_BATCH_NUMBER (must be a number)');
        }

        // Check for fields needed by specific RPC methods
        const messageProofMethods = ['zks_getL2ToL1MsgProof', 'zks_getL2ToL1LogProof'];
        if (messageProofMethods.some(method => this.requestQueue.some(req => req.method === method))) {
            if (!process.env.TEST_MESSAGE_PROOF_ADDRESS) {
                missingFields.push('TEST_MESSAGE_PROOF_ADDRESS (required for L2 to L1 message proofs)');
            }
        }

        if (missingFields.length > 0 || invalidFields.length > 0) {
            let errorMessage = 'Environment validation failed:\n';
            
            if (missingFields.length > 0) {
                errorMessage += '\nMissing required fields:\n';
                missingFields.forEach(field => {
                    errorMessage += `- ${field}\n`;
                });
            }

            if (invalidFields.length > 0) {
                errorMessage += '\nInvalid field formats:\n';
                invalidFields.forEach(field => {
                    errorMessage += `- ${field}\n`;
                });
            }

            errorMessage += '\nPlease update your .env file with the required values.';
            throw new Error(errorMessage);
        }
    }

    async fetchLatestBlockInfo() {
        try {
            // First get the latest block number
            const blockNumberResponse = await this.makeRPCRequest('eth_blockNumber', []);
            if (!blockNumberResponse.success) {
                throw new Error(`Failed to fetch latest block number: ${blockNumberResponse.error}`);
            }

            const latestBlockNumber = blockNumberResponse.result;
            console.log(`Latest block number: ${latestBlockNumber}`);

            // Then get the block details
            const blockDetailsResponse = await this.makeRPCRequest('eth_getBlockByNumber', [latestBlockNumber, false]);
            if (!blockDetailsResponse.success) {
                throw new Error(`Failed to fetch block details: ${blockDetailsResponse.error}`);
            }

            const blockHash = blockDetailsResponse.result.hash;
            console.log(`Latest block hash: ${blockHash}`);

            return {
                blockNumber: latestBlockNumber,
                blockHash: blockHash
            };
        } catch (error) {
            console.error('Error fetching latest block info:', error.message);
            throw error;
        }
    }

    async validateBlockNumber(blockNumber) {
        if (!blockNumber) {
            throw new Error('Block number is required');
        }

        const num = parseInt(blockNumber);
        if (isNaN(num)) {
            throw new Error(`Invalid block number format: "${blockNumber}". Must be a number.`);
        }

        if (num < 0) {
            throw new Error(`Invalid block number: ${num}. Must be a positive integer.`);
        }

        return `0x${num.toString(16)}`;
    }

    async validateBlockHash(blockHash) {
        if (!blockHash) {
            throw new Error('Block hash is required');
        }

        if (!blockHash.startsWith('0x')) {
            throw new Error(`Invalid block hash format: "${blockHash}". Must start with "0x".`);
        }

        const hashWithoutPrefix = blockHash.slice(2);
        if (hashWithoutPrefix.length !== 64) {
            throw new Error(`Invalid block hash length: ${hashWithoutPrefix.length} characters. Must be 64 characters (32 bytes) after "0x" prefix.`);
        }

        if (!/^[0-9a-fA-F]+$/.test(hashWithoutPrefix)) {
            throw new Error(`Invalid block hash characters: "${blockHash}". Must contain only hexadecimal characters.`);
        }

        return blockHash;
    }

    async makeRPCRequest(method, params = []) {
        const request = {
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params
        };

        try {
            const startTime = Date.now();
            const response = await axios.post(this.rpcUrl, request);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Check for JSON-RPC error in response
            if (response.data.error) {
                return {
                    method,
                    success: false,
                    error: response.data.error.message,
                    errorCode: response.data.error.code,
                    errorDetails: response.data.error,
                    duration: `${duration}ms`,
                    timestamp: new Date().toISOString()
                };
            }

            // Check if result is null
            if (response.data.result === null) {
                return {
                    method,
                    success: false,
                    error: 'Test skipped - No data available',
                    errorCode: 'SKIPPED',
                    errorDetails: 'The RPC method returned null, indicating no data was available for this test',
                    duration: `${duration}ms`,
                    timestamp: new Date().toISOString()
                };
            }

            return {
                method,
                success: true,
                result: response.data.result,
                duration: `${duration}ms`,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                method,
                success: false,
                error: error.message,
                errorCode: error.response?.data?.error?.code || 'HTTP_ERROR',
                errorDetails: error.response?.data || 'No additional error details',
                timestamp: new Date().toISOString()
            };
        }
    }

    async logResult(result) {
        try {
            let logEntry = `[${result.timestamp}] ${result.method} - ${result.success ? 'Success' : result.errorCode === 'SKIPPED' ? 'Skipped' : 'Failed'} (${result.duration})\n`;
            if (result.success) {
                logEntry += `Result: ${JSON.stringify(result.result, null, 2)}\n`;
            } else if (result.errorCode === 'SKIPPED') {
                logEntry += `Reason: ${result.error}\n`;
            } else {
                logEntry += `Error Code: ${result.errorCode}\nError: ${result.error}\n`;
            }
            await fs.appendFile(this.logFile, logEntry);
        } catch (error) {
            console.error(`Failed to log result for ${result.method}:`, error.message);
        }
    }

    async logError(error) {
        try {
            const errorEntry = `[${error.timestamp}] ${error.method} - Error Code: ${error.errorCode}\nError: ${error.error}\nDetails: ${JSON.stringify(error.errorDetails)}\n`;
            await fs.appendFile(this.errorFile, errorEntry);
        } catch (logError) {
            console.error(`Failed to log error for ${error.method}:`, logError.message);
        }
    }

    async processQueue() {
        let batchNumber = 1;
        while (this.requestQueue.length > 0) {
            try {
                const batch = this.requestQueue.splice(0, this.batchSize);
                console.log(`\nProcessing batch ${batchNumber} (${batch.length} requests)...`);
                
                const batchResults = await Promise.allSettled(batch.map(req => this.makeRPCRequest(req.method, req.params)));
                const processedResults = batchResults.map(result => 
                    result.status === 'fulfilled' ? result.value : {
                        method: result.reason.method,
                        success: false,
                        error: result.reason.error,
                        errorCode: result.reason.errorCode || 'UNKNOWN_ERROR',
                        errorDetails: result.reason.errorDetails,
                        timestamp: new Date().toISOString()
                    }
                );
                
                // Log each result
                for (const result of processedResults) {
                    try {
                        await this.logResult(result);
                        if (!result.success) {
                            await this.logError(result);
                        }
                    } catch (error) {
                        console.error(`Failed to process result for ${result.method}:`, error.message);
                    }
                }
                
                this.results.push(...processedResults);
                
                // Print batch summary
                const successCount = processedResults.filter(r => r.success).length;
                const errorCount = processedResults.filter(r => !r.success).length;
                console.log(`Batch ${batchNumber} complete: ${successCount} successful, ${errorCount} failed`);
                
                // Print detailed results for this batch
                console.log('\nBatch Results:');
                console.log('--------------');
                processedResults.forEach(result => {
                    if (result.success) {
                        console.log(`✓ ${result.method} - Success (${result.duration})`);
                    } else {
                        console.log(`✗ ${result.method} - Failed (${result.errorCode}): ${result.error}`);
                    }
                });
                
                if (this.requestQueue.length > 0) {
                    console.log(`\nWaiting ${this.batchDelayMs}ms before next batch...`);
                    await sleep(this.batchDelayMs);
                }
                batchNumber++;
            } catch (error) {
                console.error(`Error processing batch ${batchNumber}:`, error.message);
                // Continue with next batch
                batchNumber++;
            }
        }
    }

    async recordDirectResult(result) {
        try {
            await this.logResult(result);
            if (!result.success && result.errorCode !== 'SKIPPED') {
                await this.logError(result);
            }
        } catch (error) {
            console.error(`Failed to record result for ${result.method}:`, error.message);
        }
        this.results.push(result);
    }

    async recordSkippedTest(method, reason) {
        const result = {
            method,
            success: false,
            error: reason,
            errorCode: 'SKIPPED',
            errorDetails: reason,
            duration: '0ms',
            timestamp: new Date().toISOString()
        };

        try {
            await this.logResult(result);
        } catch (error) {
            console.error(`Failed to log skipped test for ${method}:`, error.message);
        }

        this.results.push(result);
    }

    getLatestSuccessfulResult(method) {
        for (let i = this.results.length - 1; i >= 0; i--) {
            const result = this.results[i];
            if (result.method === method && result.success) {
                return result;
            }
        }
        return null;
    }

    async runEthereumRpcTests(latestBlockNumberHex, latestBlockHash) {
        let testBlockNumberHex = latestBlockNumberHex;
        if (process.env.TEST_BLOCK_NUMBER) {
            try {
                testBlockNumberHex = await this.validateBlockNumber(process.env.TEST_BLOCK_NUMBER);
            } catch (error) {
                console.warn(`Invalid TEST_BLOCK_NUMBER: ${error.message}. Falling back to latest block.`);
                testBlockNumberHex = latestBlockNumberHex;
            }
        }

        let testBlockHash = latestBlockHash;
        if (process.env.TEST_BLOCK_HASH) {
            try {
                testBlockHash = await this.validateBlockHash(process.env.TEST_BLOCK_HASH);
            } catch (error) {
                console.warn(`Invalid TEST_BLOCK_HASH: ${error.message}. Falling back to latest block hash.`);
                testBlockHash = latestBlockHash;
            }
        }

        // Core Ethereum RPC methods
        this.requestQueue.push(
            { method: 'eth_chainId', params: [] },
            { method: 'eth_protocolVersion', params: [] },
            { method: 'eth_accounts', params: [] },
            { method: 'eth_gasPrice', params: [] },
            { method: 'eth_feeHistory', params: ['0x5', 'latest', [10, 50, 90]] },
            { method: 'eth_blockNumber', params: [] },
            { method: 'eth_getBalance', params: [this.testAddress, 'latest'] },
            { method: 'eth_getTransactionCount', params: [this.testAddress, 'latest'] },
            { method: 'eth_getCode', params: [this.testAddress, 'latest'] },
            { method: 'eth_getStorageAt', params: [this.testAddress, '0x0', 'latest'] },
            { method: 'eth_call', params: [{ to: this.testAddress, data: '0x' }, 'latest'] },
            { method: 'eth_estimateGas', params: [{ from: this.testAddress, to: this.testAddress, value: '0x0', data: '0x' }] },
            { method: 'eth_getBlockByNumber', params: [testBlockNumberHex, true] },
            { method: 'eth_getBlockByHash', params: [testBlockHash, true] },
            { method: 'eth_getBlockReceipts', params: [testBlockHash] },
            { method: 'eth_getBlockTransactionCountByNumber', params: [testBlockNumberHex] },
            { method: 'eth_getBlockTransactionCountByHash', params: [testBlockHash] },
            { method: 'eth_getTransactionByHash', params: [this.testTxHash] },
            { method: 'eth_getTransactionReceipt', params: [this.testTxHash] }
        );

        await this.processQueue();
        this.requestQueue = [];

        const latestReceipt = this.getLatestSuccessfulResult('eth_getTransactionReceipt');
        const txBlockHash = latestReceipt?.result?.blockHash || testBlockHash;
        const txIndex = latestReceipt?.result?.transactionIndex || '0x0';
        const txBlockNumber = latestReceipt?.result?.blockNumber || testBlockNumberHex;

        const receiptFirstLogAddress = latestReceipt?.result?.logs && latestReceipt.result.logs.length > 0
            ? latestReceipt.result.logs[0].address
            : undefined;

        const logsFilter = {
            fromBlock: txBlockNumber || testBlockNumberHex,
            toBlock: txBlockNumber || testBlockNumberHex
        };
        if (receiptFirstLogAddress) {
            logsFilter.address = receiptFirstLogAddress;
        }

        this.requestQueue.push(
            { method: 'eth_getTransactionByBlockHashAndIndex', params: [txBlockHash, txIndex] },
            { method: 'eth_getLogs', params: [logsFilter] }
        );

        await this.processQueue();
        this.requestQueue = [];

        // Filter-based methods
        try {
            const newFilterResponse = await this.makeRPCRequest('eth_newFilter', [{ fromBlock: txBlockNumber || testBlockNumberHex, toBlock: txBlockNumber || testBlockNumberHex }]);
            await this.recordDirectResult(newFilterResponse);

            if (newFilterResponse.success) {
                const filterId = newFilterResponse.result;

                this.requestQueue.push(
                    { method: 'eth_getFilterChanges', params: [filterId] },
                    { method: 'eth_getFilterLogs', params: [filterId] }
                );

                await this.processQueue();
                this.requestQueue = [];

                const uninstallFilterResponse = await this.makeRPCRequest('eth_uninstallFilter', [filterId]);
                await this.recordDirectResult(uninstallFilterResponse);
            }
        } catch (error) {
            console.error('Error during filter tests:', error.message);
        }

        try {
            const newBlockFilterResponse = await this.makeRPCRequest('eth_newBlockFilter', []);
            await this.recordDirectResult(newBlockFilterResponse);
            if (newBlockFilterResponse.success) {
                const blockFilterId = newBlockFilterResponse.result;
                const uninstallBlockFilterResponse = await this.makeRPCRequest('eth_uninstallFilter', [blockFilterId]);
                await this.recordDirectResult(uninstallBlockFilterResponse);
            }
        } catch (error) {
            console.error('Error during block filter tests:', error.message);
        }

        try {
            const newPendingTxFilterResponse = await this.makeRPCRequest('eth_newPendingTransactionFilter', []);
            await this.recordDirectResult(newPendingTxFilterResponse);
            if (newPendingTxFilterResponse.success) {
                const pendingTxFilterId = newPendingTxFilterResponse.result;
                const uninstallPendingFilterResponse = await this.makeRPCRequest('eth_uninstallFilter', [pendingTxFilterId]);
                await this.recordDirectResult(uninstallPendingFilterResponse);
            }
        } catch (error) {
            console.error('Error during pending transaction filter tests:', error.message);
        }

        // Methods requiring additional infrastructure - mark as skipped
        await this.recordSkippedTest('eth_sendTransaction', 'eth_sendTransaction requires an unlocked account on the target node');
        await this.recordSkippedTest('eth_sendRawTransaction', 'eth_sendRawTransaction requires a signed transaction payload');
        await this.recordSkippedTest('eth_subscribe', 'eth_subscribe is only available over WebSocket connections');

        // Remaining standalone methods
        this.requestQueue.push(
            { method: 'eth_syncing', params: [] }
        );

        await this.processQueue();
        this.requestQueue = [];
    }

    async fetchL2ToL1MessageSenders() {
        try {
            // First get the latest L1 batch number
            const latestBatchResponse = await this.makeRPCRequest('zks_L1BatchNumber', []);
            if (!latestBatchResponse.success) {
                console.warn('Failed to fetch latest L1 batch number:', latestBatchResponse.error);
                return new Map();
            }

            const latestBatchNumber = latestBatchResponse.result;
            console.log(`Latest L1 batch number: ${latestBatchNumber}`);

            // Get a few recent batches to find message senders
            const batchNumbers = Array.from({ length: 5 }, (_, i) => latestBatchNumber - i);
            const messageSenders = new Map();

            for (const batchNumber of batchNumbers) {
                try {
                    const batchDetailsResponse = await this.makeRPCRequest('zks_getL1BatchDetails', [batchNumber]);
                    if (batchDetailsResponse.success && batchDetailsResponse.result) {
                        const batchDetails = batchDetailsResponse.result;
                        if (batchDetails.l2ToL1Messages && batchDetails.l2ToL1Messages.length > 0) {
                            batchDetails.l2ToL1Messages.forEach(msg => {
                                if (msg.sender) {
                                    if (!messageSenders.has(msg.sender)) {
                                        messageSenders.set(msg.sender, {
                                            batchNumbers: new Set(),
                                            messageCount: 0
                                        });
                                    }
                                    messageSenders.get(msg.sender).batchNumbers.add(batchNumber);
                                    messageSenders.get(msg.sender).messageCount++;
                                }
                            });
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to fetch details for batch ${batchNumber}:`, error.message);
                }
            }

            if (messageSenders.size === 0) {
                console.warn('No L2 to L1 message senders found in recent batches');
                return new Map();
            }

            console.log(`Found ${messageSenders.size} addresses that have sent L2 to L1 messages`);
            return messageSenders;
        } catch (error) {
            console.warn('Error fetching L2 to L1 message senders:', error.message);
            return new Map();
        }
    }

    async suggestValidAddresses() {
        try {
            const messageSenders = await this.fetchL2ToL1MessageSenders();
            if (messageSenders.size === 0) {
                console.log('\nNo L2 to L1 message senders found in recent batches.');
                console.log('You can try:');
                console.log('1. Using a different RPC endpoint');
                console.log('2. Checking the chain explorer for recent L2 to L1 messages');
                console.log('3. Waiting for new L2 to L1 messages to be sent');
                return [];
            }

            const suggestions = Array.from(messageSenders.entries())
                .map(([address, data]) => ({
                    address,
                    batchNumbers: Array.from(data.batchNumbers),
                    messageCount: data.messageCount
                }))
                .sort((a, b) => b.messageCount - a.messageCount)
                .slice(0, 5);

            console.log('\nSuggested addresses for L2 to L1 message proofs:');
            console.log('--------------------------------------------');
            suggestions.forEach((suggestion, index) => {
                console.log(`\n${index + 1}. Address: ${suggestion.address}`);
                console.log(`   Messages sent: ${suggestion.messageCount}`);
                console.log(`   Recent batches: ${suggestion.batchNumbers.join(', ')}`);
            });
            console.log('\nTo use one of these addresses, add it to your .env file:');
            console.log('TEST_MESSAGE_PROOF_ADDRESS=<address>');
            console.log('TEST_L1_BATCH_NUMBER=<batch_number>');

            return suggestions;
        } catch (error) {
            console.warn('Error suggesting valid addresses:', error.message);
            return [];
        }
    }

    async validateMessageProofAddress(address) {
        if (!address) {
            const suggestions = await this.suggestValidAddresses();
            if (suggestions.length === 0) {
                return null;
            }
            throw new Error('Message proof address is required. See suggestions above.');
        }

        if (!address.startsWith('0x')) {
            throw new Error(`Invalid address format: "${address}". Must start with "0x".`);
        }

        const addressWithoutPrefix = address.slice(2);
        if (addressWithoutPrefix.length !== 40) {
            throw new Error(`Invalid address length: ${addressWithoutPrefix.length} characters. Must be 40 characters (20 bytes) after "0x" prefix.`);
        }

        if (!/^[0-9a-fA-F]+$/.test(addressWithoutPrefix)) {
            throw new Error(`Invalid address characters: "${address}". Must contain only hexadecimal characters.`);
        }

        // Check if the address has sent any L2 to L1 messages
        try {
            const messageSenders = await this.fetchL2ToL1MessageSenders();
            const normalizedAddress = address.toLowerCase();
            
            if (!messageSenders.has(normalizedAddress)) {
                const suggestions = await this.suggestValidAddresses();
                if (suggestions.length === 0) {
                    return null;
                }
                throw new Error(`Address ${address} has not sent any L2 to L1 messages in recent batches. See suggestions above.`);
            }

            const senderData = messageSenders.get(normalizedAddress);
            console.log(`
Address ${address} has sent ${senderData.messageCount} L2 to L1 messages
Recent batches: ${Array.from(senderData.batchNumbers).join(', ')}
            `);
            
            return address;
        } catch (error) {
            console.warn('Error validating message proof address:', error.message);
            return null;
        }
    }

    // Helper function to convert hex string to decimal number
    hexToDecimal(hexString) {
        if (!hexString) return null;
        if (hexString.startsWith('0x')) {
            return parseInt(hexString, 16);
        }
        return parseInt(hexString, 16);
    }

    // Helper function to ensure block number is in correct format
    async validateAndFormatBlockNumber(blockNumber) {
        if (!blockNumber) return null;
        if (typeof blockNumber === 'string' && blockNumber.startsWith('0x')) {
            return this.hexToDecimal(blockNumber);
        }
        return parseInt(blockNumber);
    }

    async runTests() {
        console.log('Starting ZKsync RPC tests...');
        console.log(`RPC URL: ${this.rpcUrl}`);
        console.log(`Test Transaction Hash: ${this.testTxHash}`);
        console.log(`Test Address: ${this.testAddress}`);
        console.log(`Test L1 Batch Number: ${this.testL1BatchNumber}`);
        console.log(`Rate limit: ${this.maxRequestsPerSecond} requests/second`);
        console.log(`Batch size: ${this.batchSize}`);
        console.log(`Batch delay: ${this.batchDelayMs}ms\n`);

        // Validate environment before running tests
        try {
            await this.validateEnvironment();
        } catch (error) {
            console.error(error.message);
            process.exit(1);
        }

        // Initialize log files
        try {
            await fs.writeFile(this.logFile, '');
            await fs.writeFile(this.errorFile, '');
            console.log(`Log files initialized at:\n- ${this.logFile}\n- ${this.errorFile}\n`);
        } catch (error) {
            console.error('Failed to initialize log files:', error.message);
            throw error;
        }

        const latestBlockInfo = await this.fetchLatestBlockInfo();
        const latestBlockNumberHex = latestBlockInfo.blockNumber;
        const latestBlockHash = latestBlockInfo.blockHash;
        const latestBlockNumber = this.hexToDecimal(latestBlockNumberHex);

        await this.runEthereumRpcTests(latestBlockNumberHex, latestBlockHash);

        // First batch of independent RPC calls
        this.requestQueue.push(
            { method: 'zks_estimateFee', params: [{ from: this.testAddress, to: this.testAddress, data: '0x' }] },
            { method: 'zks_estimateGasL1ToL2', params: [{ from: this.testAddress, to: this.testAddress, data: '0x' }] },
            { method: 'zks_getBridgehubContract', params: [] },
            { method: 'zks_getMainContract', params: [] },
            { method: 'zks_getTestnetPaymaster', params: [] },
            { method: 'zks_getBridgeContracts', params: [] },
            { method: 'zks_L1ChainId', params: [] },
            { method: 'zks_getBaseTokenL1Address', params: [] },
            { method: 'zks_getConfirmedTokens', params: [0, 100] },
            { method: 'zks_getAllAccountBalances', params: [this.testAddress] },
            { method: 'zks_L1BatchNumber', params: [] }
        );

        await this.processQueue();
        this.requestQueue = [];

        // Get the latest L1 batch number from the previous results
        const l1BatchNumberResult = this.results.find(r => r.method === 'zks_L1BatchNumber' && r.success);
        const latestL1BatchNumber = l1BatchNumberResult ? this.hexToDecimal(l1BatchNumberResult.result) : null;

        // Second batch using data from first batch
        this.requestQueue.push(
            { method: 'zks_getL2ToL1MsgProof', params: [latestBlockNumber, this.testMessageIndex, this.testMessageProofAddress] },
            { method: 'zks_getL2ToL1LogProof', params: [this.testTxHash, 0] },
            { method: 'zks_getBlockDetails', params: [latestBlockNumber] }
        );

        await this.processQueue();
        this.requestQueue = [];

        // Get block details from the previous results
        const blockDetailsResult = this.results.find(r => r.method === 'zks_getBlockDetails' && r.success);
        const blockDetails = blockDetailsResult ? blockDetailsResult.result : null;
        const l1BatchNumber = blockDetails ? blockDetails.l1BatchNumber : this.testL1BatchNumber;

        // Third batch using data from previous results
        this.requestQueue.push(
            { method: 'zks_getTransactionDetails', params: [this.testTxHash] },
            { method: 'zks_getRawBlockTransactions', params: [latestBlockNumber] },
            { method: 'zks_getL1BatchDetails', params: [this.testL1BatchNumber] },
            { method: 'zks_getBytecodeByHash', params: [this.testTxHash] },
            { method: 'zks_getL1BatchBlockRange', params: [this.testL1BatchNumber] },
            { method: 'zks_getL1GasPrice', params: [] }
        );

        await this.processQueue();
        this.requestQueue = [];

        // Final batch
        this.requestQueue.push(
            { method: 'zks_getFeeParams', params: [] },
            { method: 'zks_getProtocolVersion', params: [] },
            { method: 'zks_getProof', params: [this.testAddress, ['0x0000000000000000000000000000000000000000000000000000000000000000'], l1BatchNumber] }
        );

        await this.processQueue();
        this.requestQueue = [];
        await this.printResults();
    }

    async printResults() {
        const successCount = this.results.filter(r => r.success).length;
        const errorCount = this.results.filter(r => !r.success).length;
        
        console.log('\nTest Summary:');
        console.log('=============');
        console.log(`Total tests: ${this.results.length}`);
        console.log(`Successful: ${successCount}`);
        console.log(`Failed: ${errorCount}`);
        console.log(`Success rate: ${((successCount / this.results.length) * 100).toFixed(2)}%`);
        
        if (errorCount > 0) {
            console.log('\nFailed Tests:');
            console.log('=============');
            this.results
                .filter(r => !r.success)
                .forEach(result => {
                    console.log(`\nMethod: ${result.method}`);
                    console.log('Error:', result.error);
                    console.log('Details:', JSON.stringify(result.errorDetails, null, 2));
                });
        }

        console.log(`\nDetailed results have been logged to ${this.logFile}`);
        console.log(`Errors have been logged to ${this.errorFile}`);
    }
}

// Run the tests
const tester = new ZKSyncRPCTester();
tester.runTests().catch(async (error) => {
    console.error('Fatal error:', error);
    await fs.appendFile(tester.errorFile, `[${new Date().toISOString()}] Fatal error: ${error.message}\n`);
});
