pragma solidity ^0.5.7;
pragma experimental ABIEncoderV2;

import "../token/ERC20/IERC20.sol";


contract DirectCall {
    struct callStruct {
        string callName;
        address target;
        bytes data;
        uint256 value;
    }

    function directCall(callStruct memory data)
        internal
        returns (bool status, bytes memory result)
    {
        require(address(this).balance >= data.value, "Insufficient Balance");

        (status, result) = data.target.call.value(data.value)(data.data);
        
        require(status, string(abi.encodePacked("Call Failed For ", data.callName)));
    }
}
