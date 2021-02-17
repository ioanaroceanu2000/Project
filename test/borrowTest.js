const Web3 = require("web3");
const solc = require("solc");
const fs = require("fs")
const BigNumber = require('bignumber.js');
const Tx = require('ethereumjs-tx').Transaction;
const InterestVariables = artifacts.require("InterestVariables");
const LiquidityPool = artifacts.require("LiquidityPool");
const Exchange = artifacts.require("Exchange");
const Token = artifacts.require("Token");
const web3  = new Web3("http://localhost:7545");


contract('LiquidityPool', () => {
  let contractInstance = null;
  let exchangeInstance = null;
  let accounts = null;
  let add = null;
  let tokenInstance = null;
  let tokenInstanceDai = null;
  let addDai = null;
  let tokenInstanceWBTC = null;
  let addWBTC = null;
  let tokenInstanceUNI = null;
  let addUNI = null;
  let ivarInstance = null;
  const ivar_address = web3.utils.toChecksumAddress('0x3Ce98c9524C753C4894bDa3c34a638D79bC00F45');
  const privateKeyAcc1 = 'db0da07daf7017dbd997ccb953c2b372b4f319c87bc11c4598b749fb33a5871d';
  const privateKeyAcc3 = 'b29053acd1c83362a25eb41fc70eaa4332b99a607048116444086a8dbcd8a9c2';
  const privateKeyAcc0 = 'b914330cc23191e0965fdbd02c08b3341ca07b8e231852240b46dc8da0d11ab4';
  // do this before running the tests
  before(async () => {
    // NOW LIQUIDITY POOL HAS A CONSTRUCTOR ARGUMENT
    exchangeInstance = await Exchange.deployed();
    contractInstance = await LiquidityPool.deployed(ivar_address, exchangeInstance.address);
    ivarInstance = await InterestVariables.deployed();
    accounts = await web3.eth.getAccounts();
    console.log(contractInstance.address);
    console.log(exchangeInstance.address);
    //create token
    const contractToken = await depolyToken('Weth', 'Weth');
    add = contractToken[0];
    const abi = contractToken[1];
    tokenInstance = new web3.eth.Contract(abi,add);
    await contractInstance.createToken('Weth',add,50, 70, 1, 7, 200, 2,490);
    //var syl = await contractInstance.tokensData(add);

    // deploy new token DAI
    var contractToken2 = await depolyToken('Dai', 'Dai');
    addDai = contractToken2[0];
    const abiDai = contractToken2[1];
    tokenInstanceDai = new web3.eth.Contract(abiDai,addDai);
    await contractInstance.createToken('Dai',addDai,50, 70, 1, 7, 200, 2,1);

    // deploy new token WBTC
    var contractToken3 = await depolyToken('WBTC', 'WBTC');
    addWBTC = contractToken3[0];
    const abiWBTC = contractToken3[1];
    tokenInstanceWBTC = new web3.eth.Contract(abiWBTC,addWBTC);

    // deploy new token UNI
    var contractToken4 = await depolyToken('UNI', 'UNI');
    addUNI = contractToken4[0];
    const abiUNI = contractToken4[1];
    tokenInstanceUNI = new web3.eth.Contract(abiUNI,addUNI);
    await contractInstance.createToken('UNI',addUNI,50, 70, 1, 7, 200, 2,22);

    // put tokens on exchange
    await exchangeInstance.createPool(add, 490, 'Weth');
    await exchangeInstance.createPool(addDai, 1, 'Dai');
    await exchangeInstance.createPool(addUNI, 22, 'UNI');

  });


  it('should give an error when depositing collateral in unsupported/unexchangable token', async () => {
    //send tokens to adresses
    await giveTokenTo(accounts[1], accounts[0], tokenInstanceUNI, 10000);
    await giveTokenTo(accounts[1], accounts[0], tokenInstanceWBTC, 10000);
    //give allowence to smart contract
    await givePermissionToContract(accounts[1], privateKeyAcc1, contractInstance.address, 5000, tokenInstanceUNI,addUNI);
    await givePermissionToContract(accounts[1], privateKeyAcc1, contractInstance.address, 5000, tokenInstanceWBTC,addWBTC);
    //deposit from an address to contract

    //make token unexchangable
    await exchangeInstance.switchToUnexchangable(addUNI);


    await contractInstance.depositCollateral(accounts[1], 20000, addUNI);


    var errUnsup = false;
    try{
      await contractInstance.depositCollateral(accounts[1], 20000, addWBTC);
    }catch(err){
      console.log(err);
      errUnsup = true;
    }

    var blc = await contractInstance.usersBalance(accounts[1]);
    var balance;
    await tokenInstanceUNI.methods.balanceOf(contractInstance.address).call().then(res =>{ balance = res; });

    // 20000 + 2000(swapped last time)
    assert.equal(blc.collateralAmount, 0, "collateral amount incorrect");
    assert.equal(balance, 0, "reserves balance incorrect in UNI");
    assert.equal(errUnsup, true, "no unsupported error given");
  });

  it('should give an error when trying to deposit in another token', async () => {
    //send tokens to adresses
    await giveTokenTo(accounts[1], accounts[0], tokenInstance, 10000);
    await giveTokenTo(accounts[1], accounts[0], tokenInstanceDai, 10000);
    //give allowence to smart contract
    await givePermissionToContract(accounts[1], privateKeyAcc1, contractInstance.address, 5000, tokenInstance,add);
    await givePermissionToContract(accounts[1], privateKeyAcc1, contractInstance.address, 5000, tokenInstanceDai,addDai);

    //deposit from an address to contract WETH
    await contractInstance.depositCollateral(accounts[1], 2000, add);

    var erroAnotherToken = false;
    try{
      await contractInstance.depositCollateral(accounts[1], 2000, addDai);
    }catch(err){
      console.log(err);
      erroAnotherToken = true;
    }

    var blc = await contractInstance.usersBalance(accounts[1]);
    var balance;
    await tokenInstance.methods.balanceOf(contractInstance.address).call().then(res =>{ balance = res; });

    assert.equal(blc.collateralAmount, 2000, "collateral amount incorrect");
    assert.equal(blc.tokenCollateralised, add, "collateral token incorrect");
    assert.equal(balance, 2000, "reserves balance incorrect in WETH");
    assert.equal(erroAnotherToken, true, "no already has a collateral error given");
  });

  it('should accept deposit collateral in the same token', async () => {

    //deposit from an address to contract WETH
    await contractInstance.depositCollateral(accounts[1], 2000, add);

    var blc = await contractInstance.usersBalance(accounts[1]);
    var balance;
    await tokenInstance.methods.balanceOf(contractInstance.address).call().then(res =>{ balance = res; });

    assert.equal(blc.collateralAmount, 4000, "collateral amount incorrect");
    assert.equal(blc.tokenCollateralised, add, "collateral token incorrect");
    assert.equal(balance, 4000, "reserves balance incorrect in WETH");
  });

  it('should give error when borrow when supply < demand', async () => {

    var error = false;
    try{
      await contractInstance.borrow(accounts[1], 500, addDai);
    }catch(err){
      console.log(err);
      error = true;
    }

    var blc = await contractInstance.usersBalance(accounts[1]);

    var balance; // account1 has 1000 Dai from before
    await tokenInstanceDai.methods.balanceOf(accounts[1]).call().then(res =>{ balance = res; });
    // 20000 + 2000(swapped last time)
    assert.equal(blc.borrowedAmount, 0, "borrowed amount incorrect");
    assert.equal(balance, 10000, "reserves balance incorrect");
    assert.equal(error, true, "no supply < demand error given");
  });

  it('should give an error when borrowing in unsupported/unexchangable token', async () => {

    await contractInstance.borrow(accounts[1], 500, addUNI); //unexchangable

    var errUnsup = false;
    try{
      await contractInstance.borrow(accounts[1], 2, addWBTC); // unsupported
    }catch(err){
      console.log(err);
      errUnsup = true;
    }

    var blc = await contractInstance.usersBalance(accounts[1]);
    var balance;
    await tokenInstanceUNI.methods.balanceOf(accounts[1]).call().then(res =>{ balance = res; });

    // 20000 + 2000(swapped last time)
    assert.equal(blc.borrowedAmount, 0, "collateral amount incorrect");
    assert.equal(balance, 10000, "account balance incorrect in UNI"); // account1 has it from the beggining
    assert.equal(errUnsup, true, "no unsupported error given");
  });

  it('should give error when borrowing more than collateral factor', async () => {

    // account0 deposits 2 100 000 DAI in order not to get the supply<demand error
    await givePermissionToContract(accounts[0], privateKeyAcc0, contractInstance.address, 2100000, tokenInstanceDai,addDai);
    await contractInstance.deposit(accounts[0], 2100000, addDai);

    var error = false;
    try{
      await contractInstance.borrow(accounts[1], 2000000, addDai);
    }catch(err){
      console.log(err);
      error = true;
    }

    var blc = await contractInstance.usersBalance(accounts[1]);

    var balance; // account1 has 1000 Dai from before
    await tokenInstanceDai.methods.balanceOf(accounts[1]).call().then(res =>{ balance = res; });
    // 20000 + 2000(swapped last time)
    assert.equal(blc.borrowedAmount, 0, "borrowed amount incorrect");
    assert.equal(balance, 10000, "reserves balance incorrect");
    assert.equal(error, true, "no <more than collateral factor> error given");
  });

  it('should accept borrowing in the same token but not over the collateral factor', async () => {

    await contractInstance.borrow(accounts[1], 1000000, addDai); // borrow 1 000 000 DAI
    await contractInstance.borrow(accounts[1], 300000, addDai); // borrow again 300 000 DAI

    var error = false;
    try{
      await contractInstance.borrow(accounts[1], 100000, addDai); // borrow again over the collateral factor
    }catch(err){
      console.log(err);
      error = true;
    }

    var blc = await contractInstance.usersBalance(accounts[1]);

    var balance; // account1 has 1000 Dai from before
    await tokenInstanceDai.methods.balanceOf(accounts[1]).call().then(res =>{ balance = res; });
    // 20000 + 2000(swapped last time)
    assert.equal(blc.borrowedAmount.toNumber(), 1300000, "borrowed amount incorrect");
    assert.equal(balance.toString(), '1310000', "account1 balance incorrect");
    assert.equal(error, true, "no <more than collateral factor> error given");
  });

});

// deploy the code for a token and return its address
async function depolyToken(name, symbol){
  // get the abi and bytecode after compilation of Token
  var content = JSON.parse(fs.readFileSync("build/contracts/Token.json"));
  var abi = content['abi'];
  var bytecode = content['bytecode'];
  //create contract and depoly
  var TokenInit = new web3.eth.Contract(abi);
  var TokenTx = TokenInit.deploy({data: bytecode, arguments: [name, symbol]});
  // send transaction from the 1st account
  var accounts = await web3.eth.getAccounts();
  var instance = await TokenTx.send({from: accounts[0], gas: 5000000});

  return [instance.options.address, abi];
}

// give token from owner to another account
async function giveTokenTo(account, owner, tokenInstance, amount){
  //send tokens to adresses
  let value = web3.utils.toHex(amount);
  await tokenInstance.methods.transfer(account, value).send({from: owner}).on('transactionHash', function(hash){
      //console.log(hash);
    });
  var balance;
  await tokenInstance.methods.balanceOf(account).call().then(res =>{ balance = res; });
}

// give permission to contract to retreive tokens
async function givePermissionToContract(account, privateKey, contractAddress, amount, tokenInstance, tokenAddress){
  var nonce = await web3.eth.getTransactionCount(account);
  const rawTx = {
    nonce: nonce,
    from: account,
    to: tokenAddress,
    gasLimit: web3.utils.toHex(200000),
    data: tokenInstance.methods.approve(contractAddress, amount).encodeABI()
  };
  // private key of the second account
  var privateKey = new Buffer(privateKey, 'hex');
  var tx = new Tx(rawTx);
  tx.sign(privateKey);
  var serializedTx = tx.serialize();
  web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).on('receipt', console.log);
}