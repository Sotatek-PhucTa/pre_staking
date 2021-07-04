pragma solidity>=0.6.11;

import "@uniswap/v2-core/contracts/UniswapV2ERC20.sol";

contract TestUniswapV2ERC20 is UniswapV2ERC20 {
    constructor(uint256 amount) public UniswapV2ERC20() {
        _mint(msg.sender, amount);
    }
}