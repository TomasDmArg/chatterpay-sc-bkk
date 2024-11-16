import { ethers } from "hardhat";
import { PaymentProcessor, USDC } from "../typechain-types";
import * as fs from "fs";

/**
 * Test script for executing transactions on deployed contracts
 * Tests payment processing with fee calculations
 */
async function main() {
  try {
    // Read deployment addresses
    const network = process.env.HARDHAT_NETWORK || "localhost";
    const deploymentPath = `./deployments/${network}.json`;
    
    if (!fs.existsSync(deploymentPath)) {
      throw new Error(`Deployment file not found: ${deploymentPath}`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    
    // Get contract addresses
    const PAYMENT_PROCESSOR_ADDRESS = deployment.paymentProcessor;
    const USDC_ADDRESS = deployment.mockUSDC;

    // Get signer (same account acts as owner and user)
    const [signer] = await ethers.getSigners();
    console.log("\nUsing account:", signer.address);
    
    // Get contract instances
    const paymentProcessor = await ethers.getContractAt(
      "PaymentProcessor",
      PAYMENT_PROCESSOR_ADDRESS
    ) as PaymentProcessor;

    const usdc = await ethers.getContractAt(
      "USDC",
      USDC_ADDRESS
    ) as USDC;

    console.log("\nContract Addresses:");
    console.log("PaymentProcessor:", PAYMENT_PROCESSOR_ADDRESS);
    console.log("USDC:", USDC_ADDRESS);

    // Test Cases for Different Fee Scenarios
    await testHighAmountPayment(paymentProcessor, usdc, signer.address);
    await testLowAmountPayment(paymentProcessor, usdc, signer.address);
    await testFeeWithdrawal(paymentProcessor, usdc, signer.address);

    console.log("\nAll tests completed successfully!");

  } catch (error) {
    console.error("\nTest failed:", error);
    process.exitCode = 1;
  }
}

/**
 * Tests payment processing for amount > 10 USD (0.3% fee)
 */
async function testHighAmountPayment(
  paymentProcessor: PaymentProcessor,
  usdc: USDC,
  signerAddress: string
) {
  console.log("\nTesting High Amount Payment (>10 USD, 0.3% fee)");
  console.log("===============================================");

  // Create payment order for 100 USDC
  const highOrderId = ethers.keccak256(ethers.toUtf8Bytes("HIGH_AMOUNT_ORDER"));
  const highAmount = ethers.parseUnits("100", 18);

  console.log("\n1. Creating payment order...");
  const createTx = await paymentProcessor.createPaymentOrder(
    highOrderId,
    await usdc.getAddress(),
    highAmount
  );
  await createTx.wait();
  
  // Get order details
  const order = await paymentProcessor.getOrder(highOrderId);
  console.log("Order created with fee:", ethers.formatUnits(order.fee, 18), "USDC");
  console.log("Total amount (including fee):", ethers.formatUnits(order.amount, 18), "USDC");

  // Approve USDC spending
  console.log("\n2. Approving USDC spending...");
  const approveTx = await usdc.approve(
    await paymentProcessor.getAddress(),
    order.amount
  );
  await approveTx.wait();

  // Pay the order
  console.log("\n3. Paying the order...");
  const payTx = await paymentProcessor.payOrder(highOrderId);
  await payTx.wait();

  // Verify final state
  const finalOrder = await paymentProcessor.getOrder(highOrderId);
  console.log("\nFinal Order State:");
  console.log("- Paid:", finalOrder.paid);
  console.log("- Payer:", finalOrder.payer);
  console.log("- Fee:", ethers.formatUnits(finalOrder.fee, 18), "USDC");
}

/**
 * Tests payment processing for amount < 10 USD (0.5% fee)
 */
async function testLowAmountPayment(
  paymentProcessor: PaymentProcessor,
  usdc: USDC,
  signerAddress: string
) {
  console.log("\nTesting Low Amount Payment (<10 USD, 0.5% fee)");
  console.log("=============================================");

  // Create payment order for 5 USDC
  const lowOrderId = ethers.keccak256(ethers.toUtf8Bytes("LOW_AMOUNT_ORDER"));
  const lowAmount = ethers.parseUnits("5", 18);

  console.log("\n1. Creating payment order...");
  const createTx = await paymentProcessor.createPaymentOrder(
    lowOrderId,
    await usdc.getAddress(),
    lowAmount
  );
  await createTx.wait();

  // Get order details
  const order = await paymentProcessor.getOrder(lowOrderId);
  console.log("Order created with fee:", ethers.formatUnits(order.fee, 18), "USDC");
  console.log("Total amount (including fee):", ethers.formatUnits(order.amount, 18), "USDC");

  // Approve USDC spending
  console.log("\n2. Approving USDC spending...");
  const approveTx = await usdc.approve(
    await paymentProcessor.getAddress(),
    order.amount
  );
  await approveTx.wait();

  // Pay the order
  console.log("\n3. Paying the order...");
  const payTx = await paymentProcessor.payOrder(lowOrderId);
  await payTx.wait();

  // Verify final state
  const finalOrder = await paymentProcessor.getOrder(lowOrderId);
  console.log("\nFinal Order State:");
  console.log("- Paid:", finalOrder.paid);
  console.log("- Payer:", finalOrder.payer);
  console.log("- Fee:", ethers.formatUnits(finalOrder.fee, 18), "USDC");
}

/**
 * Tests fee withdrawal functionality
 */
async function testFeeWithdrawal(
  paymentProcessor: PaymentProcessor,
  usdc: USDC,
  signerAddress: string
) {
  console.log("\nTesting Fee Withdrawal");
  console.log("=====================");

  // Get initial balances
  const initialContractBalance = await usdc.balanceOf(await paymentProcessor.getAddress());
  console.log("Initial contract balance (fees):", ethers.formatUnits(initialContractBalance, 18), "USDC");

  // Withdraw fees if there are any
  if (initialContractBalance > BigInt(0)) {
    console.log("\n1. Withdrawing fees...");
    const withdrawTx = await paymentProcessor.withdrawFees(await usdc.getAddress());
    await withdrawTx.wait();

    // Verify final balance
    const finalContractBalance = await usdc.balanceOf(await paymentProcessor.getAddress());
    const finalSignerBalance = await usdc.balanceOf(signerAddress);

    console.log("\nFinal Balances:");
    console.log("- Contract:", ethers.formatUnits(finalContractBalance, 18), "USDC");
    console.log("- Owner:", ethers.formatUnits(finalSignerBalance, 18), "USDC");
  } else {
    console.log("No fees to withdraw");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });