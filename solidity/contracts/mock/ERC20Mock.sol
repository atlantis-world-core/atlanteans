/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-unused-vars */
/* solhint-disable no-empty-blocks */
/* solhint-disable wonderland/non-state-vars-leading-underscore */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract ERC20Mock is ERC20 {
    constructor() ERC20('ERC20Mock', 'EM') {}

    function mintTo(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
