const FlashLoan = artifacts.require("FlashLoan");

module.exports = async function (deployer) {
  Contract = deployer.deploy(FlashLoan);
  /*Accounts = await web3.eth.getAccounts();

  web3.eth.sendTransaction({
    to: Contract.address,
    from: Accounts[0],
    value: web3.utils.toWei("10", "ether"),
  });*/
};
