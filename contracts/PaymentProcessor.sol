// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PaymentProcessor
 * @dev A contract for processing payments with automatic fee calculations
 * 
 * This contract handles payment processing with two fee tiers:
 * - 0.3% fee for transactions >= 10 USD
 * - 0.5% fee for transactions < 10 USD
 *
 * Features:
 * - Create payment orders with automatic fee calculation
 * - Process payments with fee separation
 * - Withdraw accumulated fees
 * - View payment order details
 */
contract PaymentProcessor is ReentrancyGuard, Ownable {
    /**
     * @dev Payment order structure
     * @param token Address of the ERC20 token used for payment
     * @param amount Total amount including fee
     * @param paid Payment status
     * @param payer Address of the account that made the payment
     * @param fee Fee amount calculated for this order
     */
    struct PaymentOrder {
        address token;
        uint256 amount;
        bool paid;
        address payer;
        uint256 fee;
    }

    /// @dev Mapping from order ID to PaymentOrder details
    mapping(bytes32 => PaymentOrder) public paymentOrders;
    
    // Constants for fee calculations
    /// @dev Threshold amount (10 USD in wei) that determines fee rate
    uint256 public constant THRESHOLD_AMOUNT = 10 * 10**18;
    /// @dev Fee rate for amounts below threshold (0.5% = 50 basis points)
    uint256 public constant HIGH_FEE_RATE = 50;
    /// @dev Fee rate for amounts above threshold (0.3% = 30 basis points)
    uint256 public constant LOW_FEE_RATE = 30;
    /// @dev Denominator for fee calculations (10000 for basis points)
    uint256 public constant FEE_DENOMINATOR = 10000;

    // Events
    /// @dev Emitted when a new payment order is created
    event OrderCreated(
        bytes32 indexed orderId,
        address token,
        uint256 amount,
        uint256 fee
    );

    /// @dev Emitted when a payment order is paid
    event OrderPaid(
        bytes32 indexed orderId,
        address payer,
        uint256 amount,
        uint256 fee
    );

    /// @dev Emitted when fees are withdrawn
    event FeesWithdrawn(address token, uint256 amount);

    /**
     * @dev Constructor
     * Initializes the contract with the deployer as the owner
     */
    constructor() Ownable(msg.sender) {}

    /**
     * @dev Calculates the fee for a given amount
     * @param amount The base amount to calculate fee for
     * @return The calculated fee amount
     */
    function calculateFee(uint256 amount) public pure returns (uint256) {
        uint256 feeRate = amount >= THRESHOLD_AMOUNT ? LOW_FEE_RATE : HIGH_FEE_RATE;
        return (amount * feeRate) / FEE_DENOMINATOR;
    }

    /**
     * @dev Creates a new payment order
     * @param orderId Unique identifier for the order
     * @param token Address of the ERC20 token to be used for payment
     * @param amount Base amount for the order (before fees)
     * @notice Only the owner can create orders
     */
    function createPaymentOrder(
        bytes32 orderId,
        address token,
        uint256 amount
    ) external onlyOwner {
        require(paymentOrders[orderId].amount == 0, "Order already exists");
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");

        uint256 fee = calculateFee(amount);
        uint256 totalAmount = amount + fee;

        paymentOrders[orderId] = PaymentOrder({
            token: token,
            amount: totalAmount,
            paid: false,
            payer: address(0),
            fee: fee
        });

        emit OrderCreated(orderId, token, amount, fee);
    }

    /**
     * @dev Processes payment for an order
     * @param orderId The ID of the order to pay
     * @notice Requires prior approval for token transfer
     * @notice Non-reentrant to prevent potential reentrancy attacks
     */
    function payOrder(bytes32 orderId) external nonReentrant {
        PaymentOrder storage order = paymentOrders[orderId];
        
        require(order.amount > 0, "Order does not exist");
        require(!order.paid, "Order already paid");
        
        order.paid = true;
        order.payer = msg.sender;

        IERC20 token = IERC20(order.token);
        
        // Transfer full amount from payer to contract
        require(
            token.transferFrom(msg.sender, address(this), order.amount),
            "Transfer failed"
        );

        // Transfer payment amount (excluding fee) to owner
        uint256 paymentAmount = order.amount - order.fee;
        require(
            token.transfer(owner(), paymentAmount),
            "Owner transfer failed"
        );

        emit OrderPaid(orderId, msg.sender, order.amount, order.fee);
    }

    /**
     * @dev Withdraws accumulated fees for a specific token
     * @param token Address of the token to withdraw fees for
     * @notice Only owner can withdraw fees
     */
    function withdrawFees(address token) external onlyOwner {
        IERC20 tokenContract = IERC20(token);
        uint256 balance = tokenContract.balanceOf(address(this));
        require(balance > 0, "No fees to withdraw");

        require(
            tokenContract.transfer(owner(), balance),
            "Fee withdrawal failed"
        );

        emit FeesWithdrawn(token, balance);
    }

    /**
     * @dev Retrieves order details
     * @param orderId The ID of the order to query
     * @return token Address of the payment token
     * @return amount Total amount including fee
     * @return paid Payment status
     * @return payer Address of the payer
     * @return fee Fee amount
     */
    function getOrder(bytes32 orderId) external view returns (
        address token,
        uint256 amount,
        bool paid,
        address payer,
        uint256 fee
    ) {
        PaymentOrder memory order = paymentOrders[orderId];
        return (
            order.token,
            order.amount,
            order.paid,
            order.payer,
            order.fee
        );
    }
}