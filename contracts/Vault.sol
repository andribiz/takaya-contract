// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract Vault is Ownable {
    uint256 constant BASIS_POINTS_DIVISOR = 1000;
    uint256 public fee = 20; // 0.02 = 2%

    struct Locker {
        uint256 playersCount;
        uint256 totalBalance;
        uint256 state;
        address winner;
        address token;
        mapping(address => bool) players;
    }
    mapping(address => bool) public tokens;
    mapping(address => Locker) public lockers;
    uint256 public totalLocker;
    mapping(address => uint256) public balancesLock;
    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => uint256) public balancesFee;

    function calculateFee(uint256 _amount) public view returns (uint256) {
        return (_amount * fee) / BASIS_POINTS_DIVISOR;
    }

    function setFee(uint256 _fee) external onlyOwner {
        fee = _fee;
    }

    function create(address _id, address _token, uint256 _amount) external {
        require(tokens[_token], "Token: Not valid Token");
        Locker storage locker = lockers[_id];
        require(locker.playersCount == 0, "Locker: ID Already Exists");
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        balancesLock[_token] += _amount;
        locker.playersCount = 1;
        locker.totalBalance = _amount;
        locker.token = _token;
        locker.players[msg.sender] = true;
        totalLocker += 1;

        //TODO: Emit Event
    }

    function addTokens(address[] memory _tokens) external onlyOwner {
        for (uint256 i = 0; i < _tokens.length; i++) {
            tokens[_tokens[i]] = true;
        }
    }

    function withdraw(address _to, address _token, uint256 _amount) external {
        require(
            balances[msg.sender][_token] >= _amount,
            "Withdrawal: Not Enough Balance"
        );
        balances[msg.sender][_token] -= _amount;
        IERC20(_token).transfer(_to, _amount);
    }

    function withdrawLocker(address _id, address _to) external {
        Locker storage locker = lockers[_id];
        require(locker.playersCount > 1, "Locker: Invalid ID Locker");
        require(
            locker.players[msg.sender],
            "Withdrawal Locker: Invalid Owner Address"
        );
        require(locker.state == 0, "Locker: Invalid State Locker");

        uint256 amount = locker.totalBalance / locker.playersCount;
        require(
            locker.totalBalance >= amount,
            "Withdrawal Locker: Not Enough Balance"
        );
        locker.totalBalance -= amount;
        locker.playersCount -= 1;
        locker.players[msg.sender] = false;
        balancesLock[locker.token] -= amount;
        IERC20(locker.token).transfer(_to, amount);
    }

    function depositLocker(address _id, uint256 _amount) external {
        Locker storage locker = lockers[_id];
        require(locker.playersCount != 0, "Locker: Invalid ID Locker");

        require(locker.state == 0, "Locker: Closed");
        uint256 amount = locker.totalBalance / locker.playersCount;
        require(amount == _amount, "Locker: Invalid Different Amount");
        require(
            locker.players[msg.sender] == false,
            "Locker: Already Deposited"
        );

        IERC20(locker.token).transferFrom(msg.sender, address(this), _amount);
        balancesLock[locker.token] += _amount;
        locker.players[msg.sender] = true;
        locker.totalBalance += _amount;
        locker.playersCount += 1;
    }

    function closeLocker(address _id) external onlyOwner {
        Locker storage locker = lockers[_id];
        require(locker.playersCount > 1, "Locker: Invalid ID Locker");
        require(locker.state == 0, "Locker: Invalid State Locker");
        locker.state = 1;
    }

    function setWinner(address _id, address _winner) external onlyOwner {
        Locker storage locker = lockers[_id];
        require(locker.playersCount != 0, "Locker: Invalid ID Locker");
        require(locker.state == 1, "Locker: Invalid State");
        require(locker.players[_winner], "Locker: Player Not Found");

        locker.winner = _winner;
        locker.state = 2;
        balancesLock[locker.token] -= locker.totalBalance;
        uint256 amountFee = calculateFee(locker.totalBalance);
        balances[locker.winner][locker.token] +=
            locker.totalBalance -
            amountFee;
        balancesFee[locker.token] += amountFee;
    }

    function withdrawFee(
        address _to,
        address _token,
        uint256 _amount
    ) external onlyOwner {
        require(
            balancesFee[_token] >= _amount,
            "Withdrawal: Not Enough Balance"
        );

        balancesFee[_token] -= _amount;
        IERC20(_token).transfer(_to, _amount);
    }
}
