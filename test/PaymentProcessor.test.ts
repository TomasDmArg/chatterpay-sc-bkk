import { expect } from "chai";
import { ethers } from "hardhat";
import { PaymentProcessor, PaymentProcessor__factory, USDC, USDC__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PaymentProcessor", function () {
  // Contract instances
  let paymentProcessor: PaymentProcessor;
  let mockToken: USDC;
  
  // Test accounts
  let owner: SignerWithAddress;

  // Test constants
  const ORDER_ID = ethers.id("ORDER_1");
  const HIGH_AMOUNT = ethers.parseUnits("100", 18); // 100 USDC (0.3% fee)
  const LOW_AMOUNT = ethers.parseUnits("5", 18);    // 5 USDC (0.5% fee)
  const ZERO_ADDRESS = ethers.ZeroAddress;

  // Calculate fees for test amounts
  const HIGH_FEE = (HIGH_AMOUNT * BigInt(30)) / BigInt(10000); // 0.3%
  const LOW_FEE = (LOW_AMOUNT * BigInt(50)) / BigInt(10000);   // 0.5%
  const HIGH_TOTAL = HIGH_AMOUNT + HIGH_FEE;
  const LOW_TOTAL = LOW_AMOUNT + LOW_FEE;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    // Deploy mock USDC token
    const USDCFactory = await ethers.getContractFactory("USDC") as USDC__factory;
    mockToken = await USDCFactory.deploy("USD Coin", "USDC");
    
    // Deploy PaymentProcessor
    const PaymentProcessor = await ethers.getContractFactory("PaymentProcessor") as PaymentProcessor__factory;
    paymentProcessor = await PaymentProcessor.deploy();

    // Mint initial tokens to owner (including fees)
    await mockToken.mint(owner.address, HIGH_TOTAL);
    // Approve total amount including fee
    await mockToken.approve(await paymentProcessor.getAddress(), HIGH_TOTAL);
  });

  describe("Contract Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await paymentProcessor.owner()).to.equal(owner.address);
    });

    it("Should initialize with correct fee constants", async function () {
      expect(await paymentProcessor.THRESHOLD_AMOUNT()).to.equal(ethers.parseUnits("10", 18));
      expect(await paymentProcessor.HIGH_FEE_RATE()).to.equal(50); // 0.5%
      expect(await paymentProcessor.LOW_FEE_RATE()).to.equal(30);  // 0.3%
      expect(await paymentProcessor.FEE_DENOMINATOR()).to.equal(10000);
    });
  });

  describe("Fee Calculations", function () {
    it("Should calculate 0.3% fee for amounts >= 10 USDC", async function () {
      const calculatedFee = await paymentProcessor.calculateFee(HIGH_AMOUNT);
      expect(calculatedFee).to.equal(HIGH_FEE);
    });

    it("Should calculate 0.5% fee for amounts < 10 USDC", async function () {
      const calculatedFee = await paymentProcessor.calculateFee(LOW_AMOUNT);
      expect(calculatedFee).to.equal(LOW_FEE);
    });

    it("Should calculate correct fee at exactly 10 USDC threshold", async function () {
      const thresholdAmount = ethers.parseUnits("10", 18);
      const expectedFee = (thresholdAmount * BigInt(30)) / BigInt(10000); // Should use low fee rate
      const calculatedFee = await paymentProcessor.calculateFee(thresholdAmount);
      expect(calculatedFee).to.equal(expectedFee);
    });
  });

  describe("Payment Order Creation", function () {
    it("Should create order with correct fee for high amount", async function () {
      await expect(paymentProcessor.createPaymentOrder(
        ORDER_ID,
        await mockToken.getAddress(),
        HIGH_AMOUNT
      ))
        .to.emit(paymentProcessor, "OrderCreated")
        .withArgs(ORDER_ID, await mockToken.getAddress(), HIGH_AMOUNT, HIGH_FEE);

      const order = await paymentProcessor.getOrder(ORDER_ID);
      expect(order.fee).to.equal(HIGH_FEE);
      expect(order.amount).to.equal(HIGH_TOTAL);
    });

    it("Should create order with correct fee for low amount", async function () {
      await expect(paymentProcessor.createPaymentOrder(
        ORDER_ID,
        await mockToken.getAddress(),
        LOW_AMOUNT
      ))
        .to.emit(paymentProcessor, "OrderCreated")
        .withArgs(ORDER_ID, await mockToken.getAddress(), LOW_AMOUNT, LOW_FEE);

      const order = await paymentProcessor.getOrder(ORDER_ID);
      expect(order.fee).to.equal(LOW_FEE);
      expect(order.amount).to.equal(LOW_TOTAL);
    });

    it("Should not allow non-owner to create orders", async function () {
      const [_, nonOwner] = await ethers.getSigners();
      await expect(
        paymentProcessor.connect(nonOwner).createPaymentOrder(
          ORDER_ID,
          await mockToken.getAddress(),
          HIGH_AMOUNT
        )
      ).to.be.revertedWithCustomError(paymentProcessor, "OwnableUnauthorizedAccount");
    });

    it("Should not allow zero amount orders", async function () {
      await expect(
        paymentProcessor.createPaymentOrder(
          ORDER_ID,
          await mockToken.getAddress(),
          0
        )
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should not allow invalid token address", async function () {
      await expect(
        paymentProcessor.createPaymentOrder(
          ORDER_ID,
          ZERO_ADDRESS,
          HIGH_AMOUNT
        )
      ).to.be.revertedWith("Invalid token address");
    });
  });

  describe("Payment Processing", function () {
    beforeEach(async function () {
      // Create order for each test in this block
      await paymentProcessor.createPaymentOrder(
        ORDER_ID,
        await mockToken.getAddress(),
        HIGH_AMOUNT
      );
    });

    it("Should process payment and distribute fee correctly for high amount", async function () {
      const initialOwnerBalance = await mockToken.balanceOf(owner.address);
      
      // Process payment
      await expect(paymentProcessor.payOrder(ORDER_ID))
        .to.emit(paymentProcessor, "OrderPaid")
        .withArgs(ORDER_ID, owner.address, HIGH_TOTAL, HIGH_FEE);

      // Verify balances
      const contractBalance = await mockToken.balanceOf(await paymentProcessor.getAddress());
      expect(contractBalance).to.equal(HIGH_FEE);

      const finalOwnerBalance = await mockToken.balanceOf(owner.address);
      // Owner's balance should decrease by total amount and increase by payment amount (without fee)
      expect(finalOwnerBalance).to.equal(initialOwnerBalance - HIGH_TOTAL + HIGH_AMOUNT);
    });

    it("Should prevent paying non-existent orders", async function () {
      const FAKE_ORDER_ID = ethers.id("FAKE_ORDER");
      await expect(
        paymentProcessor.payOrder(FAKE_ORDER_ID)
      ).to.be.revertedWith("Order does not exist");
    });

    it("Should prevent paying already paid orders", async function () {
      await paymentProcessor.payOrder(ORDER_ID);
      
      await expect(
        paymentProcessor.payOrder(ORDER_ID)
      ).to.be.revertedWith("Order already paid");
    });
  });

  describe("Fee Withdrawal", function () {
    beforeEach(async function () {
      // Create and pay an order to accumulate fees
      await paymentProcessor.createPaymentOrder(
        ORDER_ID,
        await mockToken.getAddress(),
        HIGH_AMOUNT
      );
    });

    it("Should allow owner to withdraw accumulated fees", async function () {
      // Pay the order first to accumulate fees
      await paymentProcessor.payOrder(ORDER_ID);
      
      // Get accumulated fees
      const contractBalance = await mockToken.balanceOf(await paymentProcessor.getAddress());
      expect(contractBalance).to.equal(HIGH_FEE);
      
      // Withdraw fees
      await expect(paymentProcessor.withdrawFees(await mockToken.getAddress()))
        .to.emit(paymentProcessor, "FeesWithdrawn")
        .withArgs(await mockToken.getAddress(), HIGH_FEE);

      // Verify contract balance is zero after withdrawal
      expect(await mockToken.balanceOf(await paymentProcessor.getAddress()))
        .to.equal(0);
    });

    it("Should prevent non-owner from withdrawing fees", async function () {
      const [_, nonOwner] = await ethers.getSigners();
      await expect(
        paymentProcessor.connect(nonOwner).withdrawFees(await mockToken.getAddress())
      ).to.be.revertedWithCustomError(paymentProcessor, "OwnableUnauthorizedAccount");
    });

    it("Should prevent withdrawal when no fees are accumulated", async function () {
      await expect(
        paymentProcessor.withdrawFees(await mockToken.getAddress())
      ).to.be.revertedWith("No fees to withdraw");
    });
  });

  describe("View Functions", function () {
    it("Should return complete order details with fee information", async function () {
      await paymentProcessor.createPaymentOrder(
        ORDER_ID,
        await mockToken.getAddress(),
        HIGH_AMOUNT
      );

      const order = await paymentProcessor.getOrder(ORDER_ID);
      
      expect(order.token).to.equal(await mockToken.getAddress());
      expect(order.amount).to.equal(HIGH_TOTAL);
      expect(order.paid).to.be.false;
      expect(order.payer).to.equal(ZERO_ADDRESS);
      expect(order.fee).to.equal(HIGH_FEE);
    });

    it("Should return empty order for non-existent ID", async function () {
      const FAKE_ORDER_ID = ethers.id("FAKE_ORDER");
      const order = await paymentProcessor.getOrder(FAKE_ORDER_ID);
      
      expect(order.token).to.equal(ZERO_ADDRESS);
      expect(order.amount).to.equal(0);
      expect(order.paid).to.be.false;
      expect(order.payer).to.equal(ZERO_ADDRESS);
      expect(order.fee).to.equal(0);
    });
  });
});