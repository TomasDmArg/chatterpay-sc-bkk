import { ethers } from "hardhat";
import { PaymentProcessor, USDC } from "../typechain-types";
import * as fs from "fs";

async function main() {
  try {
    // Read deployment addresses
    const network = process.env.HARDHAT_NETWORK || "localhost";
    const deploymentPath = `./deployments/${network}.json`;
    
    if (!fs.existsSync(deploymentPath)) {
      throw new Error(`Deployment file not found: ${deploymentPath}`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const PAYMENT_PROCESSOR_ADDRESS = deployment.paymentProcessor;
    const USDC_ADDRESS = deployment.mockUSDC;

    // Get signer
    const [owner] = await ethers.getSigners();
    console.log("\nUsing account:", owner.address);

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

    // Test 1: Create a payment order
    console.log("\nTest 1: Creating payment order...");
    const orderId = ethers.keccak256(ethers.toUtf8Bytes("TEST_ORDER_1"));
    const amount = ethers.parseUnits("100", 18); // 100 USDC

    const createTx = await paymentProcessor.createPaymentOrder(
      orderId,
      USDC_ADDRESS,
      amount
    );
    await createTx.wait();
    console.log("Payment order created successfully");

    // Test 2: Check order details
    console.log("\nTest 2: Checking order details...");
    const order = await paymentProcessor.getOrder(orderId);
    console.log("Order Details:");
    console.log("- Token:", order.token);
    console.log("- Amount:", ethers.formatUnits(order.amount, 18), "USDC");
    console.log("- Paid:", order.paid);
    console.log("- Payer:", order.payer);

    // Test 3: Mint USDC to owner
    console.log("\nTest 3: Minting USDC to owner...");
    const mintTx = await usdc.mint(owner.address, amount);
    await mintTx.wait();
    const ownerBalance = await usdc.balanceOf(owner.address);
    console.log("Owner USDC Balance:", ethers.formatUnits(ownerBalance, 18));

    // Test 4: Approve USDC spending
    console.log("\nTest 4: Approving USDC spending...");
    const approveTx = await usdc.approve(PAYMENT_PROCESSOR_ADDRESS, amount);
    await approveTx.wait();
    console.log("USDC spending approved");

    // Test 5: Pay the order
    console.log("\nTest 5: Paying the order...");
    const payTx = await paymentProcessor.payOrder(orderId);
    await payTx.wait();
    console.log("Order paid successfully");

    // Test 6: Verify final state
    console.log("\nTest 6: Verifying final state...");
    const finalOrder = await paymentProcessor.getOrder(orderId);
    const finalOwnerBalance = await usdc.balanceOf(owner.address);

    console.log("Final Order State:");
    console.log("- Paid:", finalOrder.paid);
    console.log("- Payer:", finalOrder.payer);
    console.log("Final Owner USDC Balance:", ethers.formatUnits(finalOwnerBalance, 18));

    console.log("\nAll tests completed successfully!");

  } catch (error) {
    console.error("\nTest failed:", error);
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });