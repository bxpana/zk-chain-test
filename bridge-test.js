const puppeteer = require('puppeteer');
require('dotenv').config();

class BridgeTester {
    constructor() {
        this.bridgeUrl = 'https://portal.wonderchain.org/bridge/';
        this.testAmount = '0.001'; // Small test amount in ETH
    }

    async setup() {
        // Get the path to Vivaldi browser
        const vivaldiPath = process.platform === 'darwin' 
            ? '/Applications/Vivaldi.app/Contents/MacOS/Vivaldi'
            : process.platform === 'win32'
                ? 'C:\\Program Files\\Vivaldi\\Application\\vivaldi.exe'
                : '/usr/bin/vivaldi';

        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized'],
            executablePath: vivaldiPath,
            // Use existing MetaMask extension from Vivaldi profile
            userDataDir: process.platform === 'darwin'
                ? `${process.env.HOME}/Library/Application Support/Vivaldi/Default`
                : process.platform === 'win32'
                    ? `${process.env.LOCALAPPDATA}\\Vivaldi\\User Data\\Default`
                    : `${process.env.HOME}/.config/vivaldi/Default`
        });
        this.page = await this.browser.newPage();
    }

    async connectWallet() {
        try {
            console.log('Connecting wallet...');
            await this.page.goto(this.bridgeUrl);
            
            // Wait for the connect wallet button and click it
            await this.page.waitForSelector('button[data-testid="connect-wallet-button"]');
            await this.page.click('button[data-testid="connect-wallet-button"]');
            
            // Wait for MetaMask popup and approve connection
            const pages = await this.browser.pages();
            const metamaskPage = pages[pages.length - 1];
            await metamaskPage.waitForSelector('button[data-testid="page-container-footer-next"]');
            await metamaskPage.click('button[data-testid="page-container-footer-next"]');
            
            console.log('Wallet connected successfully');
        } catch (error) {
            console.error('Error connecting wallet:', error);
            throw error;
        }
    }

    async testDeposit() {
        try {
            console.log('Testing deposit...');
            
            // Select ETH as the token
            await this.page.waitForSelector('select[data-testid="token-select"]');
            await this.page.select('select[data-testid="token-select"]', 'ETH');
            
            // Enter amount
            await this.page.waitForSelector('input[data-testid="amount-input"]');
            await this.page.type('input[data-testid="amount-input"]', this.testAmount);
            
            // Click deposit button
            await this.page.waitForSelector('button[data-testid="deposit-button"]');
            await this.page.click('button[data-testid="deposit-button"]');
            
            // Wait for MetaMask popup and confirm transaction
            const pages = await this.browser.pages();
            const metamaskPage = pages[pages.length - 1];
            await metamaskPage.waitForSelector('button[data-testid="page-container-footer-next"]');
            await metamaskPage.click('button[data-testid="page-container-footer-next"]');
            
            console.log('Deposit initiated successfully');
        } catch (error) {
            console.error('Error during deposit:', error);
            throw error;
        }
    }

    async testWithdrawal() {
        try {
            console.log('Testing withdrawal...');
            
            // Switch to withdrawal tab
            await this.page.waitForSelector('button[data-testid="withdrawal-tab"]');
            await this.page.click('button[data-testid="withdrawal-tab"]');
            
            // Select ETH as the token
            await this.page.waitForSelector('select[data-testid="token-select"]');
            await this.page.select('select[data-testid="token-select"]', 'ETH');
            
            // Enter amount
            await this.page.waitForSelector('input[data-testid="amount-input"]');
            await this.page.type('input[data-testid="amount-input"]', this.testAmount);
            
            // Click withdraw button
            await this.page.waitForSelector('button[data-testid="withdraw-button"]');
            await this.page.click('button[data-testid="withdraw-button"]');
            
            // Wait for MetaMask popup and confirm transaction
            const pages = await this.browser.pages();
            const metamaskPage = pages[pages.length - 1];
            await metamaskPage.waitForSelector('button[data-testid="page-container-footer-next"]');
            await metamaskPage.click('button[data-testid="page-container-footer-next"]');
            
            console.log('Withdrawal initiated successfully');
        } catch (error) {
            console.error('Error during withdrawal:', error);
            throw error;
        }
    }

    async runTests() {
        try {
            await this.setup();
            await this.connectWallet();
            await this.testDeposit();
            await this.testWithdrawal();
        } catch (error) {
            console.error('Test failed:', error);
        } finally {
            await this.browser.close();
        }
    }
}

// Run the tests
const tester = new BridgeTester();
tester.runTests().catch(console.error); 