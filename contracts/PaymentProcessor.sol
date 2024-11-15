// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PaymentProcessor is ReentrancyGuard, Ownable {
    struct PaymentOrder {
        address token;
        uint256 amount;
        bool paid;
        address payer;
    }

    mapping(bytes32 => PaymentOrder) public paymentOrders;
    
    event OrderCreated(bytes32 indexed orderId, address token, uint256 amount);
    event OrderPaid(bytes32 indexed orderId, address payer, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function createPaymentOrder(
        bytes32 orderId,
        address token,
        uint256 amount
    ) external onlyOwner {
        require(paymentOrders[orderId].amount == 0, "Order already exists");
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");

        paymentOrders[orderId] = PaymentOrder({
            token: token,
            amount: amount,
            paid: false,
            payer: address(0)
        });

        emit OrderCreated(orderId, token, amount);
    }

    function payOrder(bytes32 orderId) external nonReentrant {
        PaymentOrder storage order = paymentOrders[orderId];
        
        require(order.amount > 0, "Order does not exist");
        require(!order.paid, "Order already paid");
        
        order.paid = true;
        order.payer = msg.sender;

        IERC20 token = IERC20(order.token);
        require(
            token.transferFrom(msg.sender, owner(), order.amount),
            "Transfer failed"
        );

        emit OrderPaid(orderId, msg.sender, order.amount);
    }

    function getOrder(bytes32 orderId) external view returns (
        address token,
        uint256 amount,
        bool paid,
        address payer
    ) {
        PaymentOrder memory order = paymentOrders[orderId];
        return (order.token, order.amount, order.paid, order.payer);
    }
}