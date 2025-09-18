// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../OndrixEscrow.sol";

/**
 * @title TestOndrixEscrow
 * @dev Test version that allows any price feed address for testing
 */
contract TestOndrixEscrow is OndrixEscrow {
    /**
     * @dev Override to allow any price feed for testing
     */
    function _validatePriceFeedAddress(address _priceFeed) internal virtual override {
        // In test version, allow any price feed address
        require(_priceFeed != address(0), "Price feed cannot be zero address");
    }
}