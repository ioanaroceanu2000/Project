// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.8.0;
import "./ERC20.sol";

contract Exchange{

  constructor() public {
    owner = msg.sender;
  }

  address private owner;

  modifier onlyOwner() {
      require(msg.sender == owner, "Only owner can do function call (Exchange)");
      _;
  }

  mapping (address => Token) public tokensData;

  struct Token{
    uint price;
    string symbol;
    bool exchangeable;
  }

  function createPool(address token, uint _price, string memory _symbol) public{
    // check if given address is a token
    require(isContract(token), 'Token contract address is not a contract');
    tokensData[token].price = _price;
    tokensData[token].symbol =  _symbol;
    tokensData[token].exchangeable = true;
  }

  function switchToUnexchangable(address token) public onlyOwner{
    require(keccak256(bytes(tokensData[token].symbol)) != keccak256(bytes("")), "Pool does not exist");
    tokensData[token].exchangeable = false;
  }

  function isExchangeable(address token) public view returns (bool){
    return tokensData[token].exchangeable;
  }

  function updatePrice(address token, uint _price) public onlyOwner{
    require(keccak256(bytes(tokensData[token].symbol)) != keccak256(bytes("")), "Pool does not exist");
    tokensData[token].price = _price;
  }

  function updatePrices(address[] memory tokens, uint[] memory _prices) public onlyOwner{
    require( tokens.length == _prices.length, "arrays dopnt have the same lenght");
    for(uint i=0; i < tokens.length; i++){
      address token = tokens[i];
      require(keccak256(bytes(tokensData[token].symbol)) != keccak256(bytes("")), "Pool does not exist");
      tokensData[token].price = _prices[i];
    }
  }


  // get price of a token
  function getPrice(address token) public view returns (uint){
    require(keccak256(bytes(tokensData[token].symbol)) != keccak256(bytes("")), "Pool does not exist");
    return tokensData[token].price;
  }

  function getBalance(address token) public view returns(uint){
    // check if the pool was created
    require(keccak256(bytes(tokensData[token].symbol)) != keccak256(bytes("")), "Pool does not exist");
    uint balance = ERC20(token).balanceOf(address(this));
    return balance;
  }

  function isContract(address _addr) internal view returns (bool){
    uint32 size;
    assembly {
      size := extcodesize(_addr)
    }
    return size > 0;
  }


}
