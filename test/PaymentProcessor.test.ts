import { expect } from "chai";
import { ethers } from "hardhat";
import { PaymentProcessor, PaymentProcessor__factory, USDC, USDC__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { parseEther } from "ethers";

describe("PaymentProcessor", function () {
  let paymentProcessor: PaymentProcessor;
  let mockToken: USDC;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let otherUser: SignerWithAddress;

  const ORDER_ID = ethers.id("ORDER_1");
  const PAYMENT_AMOUNT = parseEther("100");

  beforeEach(async function () {
    // Get signers
    [owner, user, otherUser] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const USDCFactory = await ethers.getContractFactory("USDC") as USDC__factory;
    mockToken = await USDCFactory.deploy("Mock Token", "MTK");
    
    // Deploy PaymentProcessor
    const PaymentProcessor = await ethers.getContractFactory("PaymentProcessor") as PaymentProcessor__factory;
    paymentProcessor = await PaymentProcessor.deploy();

    // Mint tokens to user and approve PaymentProcessor
    await mockToken.mint(user.address, PAYMENT_AMOUNT);
    await mockToken.connect(user).approve(await paymentProcessor.getAddress(), PAYMENT_AMOUNT);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await paymentProcessor.owner()).to.equal(owner.address);
    });
  });

  describe("Creating payment orders", function () {
    it("Should allow owner to create a payment order", async function () {
      await expect(paymentProcessor.createPaymentOrder(
        ORDER_ID,
        await mockToken.getAddress(),
        PAYMENT_AMOUNT
      ))
        .to.emit(paymentProcessor, "OrderCreated")
        .withArgs(ORDER_ID, await mockToken.getAddress(), PAYMENT_AMOUNT);

      const order = await paymentProcessor.getOrder(ORDER_ID);
      expect(order.token).to.equal(await mockToken.getAddress());
      expect(order.amount).to.equal(PAYMENT_AMOUNT);
      expect(order.paid).to.be.false;
      expect(order.payer).to.equal(ethers.ZeroAddress);
    });

    it("Should not allow non-owner to create a payment order", async function () {
      await expect(
        paymentProcessor.connect(user).createPaymentOrder(
          ORDER_ID,
          await mockToken.getAddress(),
          PAYMENT_AMOUNT
        )
      ).to.be.revertedWithCustomError(paymentProcessor, "OwnableUnauthorizedAccount");
    });

    it("Should not allow creating order with zero amount", async function () {
      await expect(
        paymentProcessor.createPaymentOrder(
          ORDER_ID,
          await mockToken.getAddress(),
          0
        )
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should not allow creating order with zero address token", async function () {
      await expect(
        paymentProcessor.createPaymentOrder(
          ORDER_ID,
          ethers.ZeroAddress,
          PAYMENT_AMOUNT
        )
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should not allow creating duplicate orders", async function () {
      await paymentProcessor.createPaymentOrder(
        ORDER_ID,
        await mockToken.getAddress(),
        PAYMENT_AMOUNT
      );

      await expect(
        paymentProcessor.createPaymentOrder(
          ORDER_ID,
          await mockToken.getAddress(),
          PAYMENT_AMOUNT
        )
      ).to.be.revertedWith("Order already exists");
    });
  });

  describe("Paying orders", function () {
    beforeEach(async function () {
      await paymentProcessor.createPaymentOrder(
        ORDER_ID,
        await mockToken.getAddress(),
        PAYMENT_AMOUNT
      );
    });

    it("Should allow user to pay an order", async function () {
      await expect(paymentProcessor.connect(user).payOrder(ORDER_ID))
        .to.emit(paymentProcessor, "OrderPaid")
        .withArgs(ORDER_ID, user.address, PAYMENT_AMOUNT);

      const order = await paymentProcessor.getOrder(ORDER_ID);
      expect(order.paid).to.be.true;
      expect(order.payer).to.equal(user.address);

      // Check token transfer
      expect(await mockToken.balanceOf(owner.address)).to.equal(PAYMENT_AMOUNT);
    });

    it("Should not allow paying non-existent order", async function () {
      const FAKE_ORDER_ID = ethers.id("FAKE_ORDER");
      await expect(
        paymentProcessor.connect(user).payOrder(FAKE_ORDER_ID)
      ).to.be.revertedWith("Order does not exist");
    });

    it("Should not allow paying already paid order", async function () {
      await paymentProcessor.connect(user).payOrder(ORDER_ID);
      
      await expect(
        paymentProcessor.connect(user).payOrder(ORDER_ID)
      ).to.be.revertedWith("Order already paid");
    });

    it("Should not allow payment without sufficient token approval", async function () {
      // Remove approval
      await mockToken.connect(user).approve(await paymentProcessor.getAddress(), 0);
      
      await expect(
        paymentProcessor.connect(user).payOrder(ORDER_ID)
      ).to.be.revertedWithCustomError(mockToken, "ERC20InsufficientAllowance");
    });

    it("Should not allow payment without sufficient token balance", async function () {
      // Create new order with amount more than user's balance
      const LARGE_ORDER_ID = ethers.keccak256(ethers.toUtf8Bytes("LARGE_ORDER"));
      const LARGE_AMOUNT = ethers.parseEther("1000");
      
      await paymentProcessor.createPaymentOrder(
        LARGE_ORDER_ID,
        await mockToken.getAddress(),
        LARGE_AMOUNT
      );
  
      // Approve the large amount first
      await mockToken.connect(user).approve(
        await paymentProcessor.getAddress(),
        LARGE_AMOUNT
      );
  
      // Now try to pay - should fail due to insufficient balance
      await expect(
        paymentProcessor.connect(user).payOrder(LARGE_ORDER_ID)
      ).to.be.revertedWithCustomError(mockToken, "ERC20InsufficientBalance");
    });
  });

  describe("View functions", function () {
    it("Should return correct order details", async function () {
      await paymentProcessor.createPaymentOrder(
        ORDER_ID,
        await mockToken.getAddress(),
        PAYMENT_AMOUNT
      );

      const order = await paymentProcessor.getOrder(ORDER_ID);
      expect(order.token).to.equal(await mockToken.getAddress());
      expect(order.amount).to.equal(PAYMENT_AMOUNT);
      expect(order.paid).to.be.false;
      expect(order.payer).to.equal(ethers.ZeroAddress);
    });

    it("Should return empty order for non-existent ID", async function () {
      const FAKE_ORDER_ID = ethers.id("FAKE_ORDER");
      const order = await paymentProcessor.getOrder(FAKE_ORDER_ID);
      
      expect(order.token).to.equal(ethers.ZeroAddress);
      expect(order.amount).to.equal(0);
      expect(order.paid).to.be.false;
      expect(order.payer).to.equal(ethers.ZeroAddress);
    });
  });
});