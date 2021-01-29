// Require Web3 Module
var Web3 = require("web3");
const axios = require("axios");
require("dotenv").config({ path: "../.env" });

web3 = new Web3(
  new Web3.providers.HttpProvider(
    //  "https://mainnet.infura.io/v3/ab315748b3f2430aa4f5764a1414187e"
    "http://127.0.0.1:8545"
  )
);

// FlashLoan Contract
var FlashLoanContractABI = require("./ABIs/flashLoanContract").ABI;
var FlashLoanContractAddress = "0xCb13353a2c2b98BaEC9A5ecEA764FD2d2C63aA45";

execution();

async function execution() {
  // Contracts Instances
  var flashLoanContract = new web3.eth.Contract(
    FlashLoanContractABI,
    FlashLoanContractAddress
  );
  /* Arguments Construction */
  var loanTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  var loanAmount = web3.utils.toWei((1 * 10 ** 18).toString(), "wei");
  var loanBackAmount = web3.utils.toWei((1.001 * 10 ** 18).toString(), "wei");
  // Approval
  var ApprovalData = "";
  await axios
    .get(
      "https://api.1inch.exchange/v2.0/approve/calldata?amount=" +
        loanAmount +
        "&tokenAddress=" +
        loanTokenAddress
    )
    .then((response) => {
      ApprovalData = response.data;
    })
    .catch((error) => {});

  // 1Inch Swap
  var oneinchData = "";
  await axios
    .get(
      "https://api.1inch.exchange/v2.0/swap?fromTokenAddress=" +
        loanTokenAddress +
        "&toTokenAddress=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&amount=" +
        loanAmount +
        "&fromAddress=" +
        FlashLoanContractAddress +
        "&slippage=10&disableEstimate=true"
    )
    .then((response) => {
      oneinchData = response.data;
    })
    .catch((error) => {});

  // SwapBack
  let oneinchSwapBackData = "";
  await axios
    .get(
      "https://api.1inch.exchange/v2.0/swap?fromTokenAddress=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&toTokenAddress=" +
        loanTokenAddress +
        "&amount=" +
        loanBackAmount +
        "&fromAddress=" +
        FlashLoanContractAddress +
        "&slippage=10&disableEstimate=true"
    )
    .then((response) => {
      oneinchSwapBackData = response.data;
    })
    .catch((error) => {});

  // Operations
  var operations = [
    {
      // Approval
      callName: "Approval",
      target: ApprovalData.to,
      data: ApprovalData.data,
      value: 0,
    },
    {
      // Swap from WETH to ETH
      callName: "WETH_TO_ETH",
      target: oneinchData.tx.to,
      data: oneinchData.tx.data,
      value: oneinchData.tx.value,
    },
    {
      // oneInch Swap Back
      callName: "ETH_TO_WETH",
      target: oneinchSwapBackData.tx.to,
      data: oneinchSwapBackData.tx.data,
      value: oneinchSwapBackData.tx.value,
    },
  ];
  /* Transaction Build & Sign & Send */
  var Tx = require("ethereumjs-tx").Transaction;
  var privateKey = Buffer.from(process.env.PRIVATE_KEY, "hex");
  var fromAddress = process.env.WALLET_ADDRESS;

  txTarget = FlashLoanContractAddress;
  txdata = flashLoanContract.methods
    .letsdoit(loanTokenAddress, loanAmount, operations)
    .encodeABI();
  txvalue = web3.utils.toHex(web3.utils.toWei((0).toString(), "ether")); // Extra Money for Urgent Times ;)
  txnonce = web3.utils.toHex(await web3.eth.getTransactionCount(fromAddress));

  var rawTx = {
    nonce: txnonce,
    gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
    gasLimit: web3.utils.toHex(
      await web3.eth.estimateGas({
        from: fromAddress,
        nonce: txnonce,
        to: txTarget,
        data: txdata,
        value: txvalue,
      })
    ),
    to: txTarget,
    value: txvalue,
    data: txdata,
  };

  var tx = new Tx(rawTx);
  tx.sign(privateKey);

  var serializedTx = tx.serialize();

  web3.eth
    .sendSignedTransaction("0x" + serializedTx.toString("hex"))
    .on("receipt", console.log);
}
