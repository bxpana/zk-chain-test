// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MyToken.sol";

contract DeployERC20 is Script {
    function run() external {
        // Get private key from env and ensure it has 0x prefix
        string memory privateKeyStr = vm.envString("PRIVATE_KEY");
        if (bytes(privateKeyStr)[0] != "0" || bytes(privateKeyStr)[1] != "x") {
            privateKeyStr = string.concat("0x", privateKeyStr);
        }
        uint256 deployerPrivateKey = vm.parseUint(privateKeyStr);
        vm.startBroadcast(deployerPrivateKey);

        // Token parameters
        string memory name = "MyToken";
        string memory symbol = "MTK";
        uint8 decimals = 18;
        uint256 initialSupply = 1000000 * 10 ** decimals;

        // Deploy the token
        MyToken token = new MyToken(name, symbol, decimals, initialSupply);

        vm.stopBroadcast();
    }
} 