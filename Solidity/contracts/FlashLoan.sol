pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

// DyDx
import "./dydx/DydxFlashloanBase.sol";
import "./dydx/ICallee.sol";

// ERC20
import "./token/ERC20/IERC20.sol";

// Utils
import "./utils/DirectCall.sol";
import "./access/Ownable.sol";

contract FlashLoan is ICallee, DydxFlashloanBase, DirectCall, Ownable {
    struct LoanData {
        address token;
        uint256 repayAmount;
        callStruct[] postLoanActions;
    }

    address SoloAddress = 0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e;

  /*  function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = byte(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
}*/


    // This is the function that will be called postLoan
    // i.e. Encode the logic to handle your flashloaned funds here
    function callFunction(
        address sender,
        Account.Info memory account,
        bytes memory data
    ) public {
        require(msg.sender == SoloAddress, "Unauthorized Access!");

        LoanData memory myLoanData = abi.decode(data, (LoanData));

        // Note that you can ignore the line below
        // if your dydx account (this contract in this case)
        // has deposited at least ~2 Wei of assets into the account
        // to balance out the collaterization ratio
        uint256 balOfLoanedToken = IERC20(myLoanData.token).balanceOf(
            address(this)
        );
        require(balOfLoanedToken > 0, "Taking Loan Failed!");

        //// Logic
        for (uint256 i = 0; i < myLoanData.postLoanActions.length; i++) {
            // Call Functions
            directCall(myLoanData.postLoanActions[i]);
        }
        
        balOfLoanedToken = IERC20(myLoanData.token).balanceOf(
            address(this)
        );
        require(
            balOfLoanedToken >= myLoanData.repayAmount,
            "Not enough funds to repay dydx loan!"
        );
    }

    function initiateFlashLoan(
        address _Loantoken,
        uint256 _amount,
        callStruct[] memory postLoanActions
    ) private {
        ISoloMargin solo = ISoloMargin(SoloAddress);

        // Get marketId from token address
        uint256 marketId =
            _getMarketIdFromTokenAddress(SoloAddress, _Loantoken);

        // Calculate repay amount (_amount + (2 wei))
        uint256 repayAmount = _getRepaymentAmountInternal(_amount);

        // Approve transfer
        // Solo
        IERC20(_Loantoken).approve(SoloAddress, repayAmount);

        // 1. Withdraw $
        // 2. Call callFunction(...)
        // 3. Deposit back $
        Actions.ActionArgs[] memory operations = new Actions.ActionArgs[](3);

        operations[0] = _getWithdrawAction(marketId, _amount);
        operations[1] = _getCallAction(
            // Encode LoanData for callFunction
            abi.encode(
                LoanData({
                    token: _Loantoken,
                    repayAmount: repayAmount,
                    postLoanActions: postLoanActions
                })
            )
        );
        operations[2] = _getDepositAction(marketId, repayAmount);

        Account.Info[] memory accountInfos = new Account.Info[](1);
        accountInfos[0] = _getAccountInfo();

        solo.operate(accountInfos, operations);
    }

    function letsdoit(
        address _LoanToken,
        uint256 _LoanAmount,
        callStruct[] memory postLoanActions
    ) public onlyOwner {
        initiateFlashLoan(_LoanToken, _LoanAmount, postLoanActions);
    }

    function changeOwner(address newOwner) external onlyOwner {
        _transferOwnership(newOwner);
    }

    function withdraweth(uint256 _Amount) external onlyOwner {
        msg.sender.transfer(_Amount);
    }

    function withdrawerc(address _Token, uint256 _Amount) external onlyOwner {
        IERC20(_Token).transfer(msg.sender, _Amount);
    }
}
