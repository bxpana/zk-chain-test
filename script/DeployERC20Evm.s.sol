// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MyToken.sol";

contract DeployERC20Evm is Script {
    function run() external {
        string memory privateKeyStr = vm.envString("PRIVATE_KEY");
        if (bytes(privateKeyStr).length >= 2) {
            bytes memory keyBytes = bytes(privateKeyStr);
            if (keyBytes[0] != "0" || keyBytes[1] != "x") {
                privateKeyStr = string.concat("0x", privateKeyStr);
            }
        } else {
            privateKeyStr = string.concat("0x", privateKeyStr);
        }

        uint256 deployerPrivateKey = vm.parseUint(privateKeyStr);
        vm.startBroadcast(deployerPrivateKey);

        string memory name = vm.envString("TOKEN_NAME");
        string memory symbol = vm.envString("TOKEN_SYMBOL");

        uint256 decimalsEnv = vm.envOr("TOKEN_DECIMALS", uint256(18));
        require(decimalsEnv <= type(uint8).max, "TOKEN_DECIMALS exceeds uint8");
        uint8 decimals = uint8(decimalsEnv);

        uint256 supplyTokens = vm.envOr("TOKEN_SUPPLY", uint256(100));
        uint256 initialSupply = supplyTokens * (10 ** decimals);

        new MyToken(name, symbol, decimals, initialSupply);

        vm.stopBroadcast();
    }
}
