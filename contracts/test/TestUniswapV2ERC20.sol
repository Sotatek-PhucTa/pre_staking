pragma solidity>=0.6.11;

import "./ERC20Permit.sol";

contract TestUniswapV2ERC20 is ERC20Permit {
    constructor(uint256 amount) public ERC20Permit("ERC20Permit", "EP", "1") {
        _mint(msg.sender, amount);
    }
}