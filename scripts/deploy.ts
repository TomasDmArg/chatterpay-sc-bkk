import { ethers, network, run } from "hardhat";

/**
 * Main deployment script for the PaymentProcessor system
 * This script handles:
 * 1. Mock USDC deployment
 * 2. PaymentProcessor deployment
 * 3. Initial USDC minting
 * 4. Contract verification
 * 5. Deployment address saving
 */
async function main() {
  console.log(`Deploying to network: ${network.name}`);

  try {
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying contracts with account: ${deployer.address}`);
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} ETH\n`);

    // Deploy Mock USDC with 18 decimals
    console.log("Deploying Mock USDC...");
    const MockUSDC = await ethers.getContractFactory("USDC");
    const mockUSDC = await MockUSDC.deploy(
      "USD Coin", // name
      "USDC"      // symbol
    );
    await mockUSDC.waitForDeployment();
    const usdcAddress = await mockUSDC.getAddress();
    console.log(`Mock USDC deployed to: ${usdcAddress}`);

    // Wait for deployment confirmations
    const BLOCK_CONFIRMATIONS = 5;
    console.log(`Waiting for ${BLOCK_CONFIRMATIONS} block confirmations...`);
    await mockUSDC.deploymentTransaction()?.wait(BLOCK_CONFIRMATIONS);

    // Deploy PaymentProcessor with fee functionality
    console.log("\nDeploying PaymentProcessor...");
    const PaymentProcessor = await ethers.getContractFactory("PaymentProcessor");
    const paymentProcessor = await PaymentProcessor.deploy();
    await paymentProcessor.waitForDeployment();
    const paymentProcessorAddress = await paymentProcessor.getAddress();
    console.log(`PaymentProcessor deployed to: ${paymentProcessorAddress}`);

    // Wait for PaymentProcessor deployment confirmations
    await paymentProcessor.deploymentTransaction()?.wait(BLOCK_CONFIRMATIONS);

    // Mint initial USDC supply for testing
    const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18); // 1 million USDC
    console.log("\nMinting initial USDC supply...");
    await mockUSDC.mint(deployer.address, INITIAL_SUPPLY);
    console.log(`Minted ${ethers.formatUnits(INITIAL_SUPPLY, 18)} USDC to ${deployer.address}`);

    // Verify contracts on Etherscan for non-local networks
    if (network.name !== "hardhat" && network.name !== "localhost") {
      await verifyContracts(usdcAddress, paymentProcessorAddress);
    }

    // Save deployment information
    await saveDeploymentInfo(
      network.name,
      usdcAddress,
      paymentProcessorAddress,
      deployer.address,
      INITIAL_SUPPLY
    );

    // Log deployment summary
    logDeploymentSummary(
      network.name,
      usdcAddress,
      paymentProcessorAddress,
      deployer.address,
      INITIAL_SUPPLY
    );

  } catch (error) {
    console.error("\nDeployment failed:", error);
    process.exitCode = 1;
  }
}

/**
 * Verifies contract source code on Etherscan
 */
async function verifyContracts(usdcAddress: string, paymentProcessorAddress: string) {
  console.log("\nVerifying contracts on Etherscan...");

  try {
    console.log("Verifying Mock USDC...");
    await run("verify:verify", {
      address: usdcAddress,
      constructorArguments: ["USD Coin", "USDC"],
    });
    console.log("Mock USDC verified successfully");
  } catch (error: any) {
    handleVerificationError("Mock USDC", error);
  }

  try {
    console.log("\nVerifying PaymentProcessor...");
    await run("verify:verify", {
      address: paymentProcessorAddress,
      constructorArguments: [],
    });
    console.log("PaymentProcessor verified successfully");
  } catch (error: any) {
    handleVerificationError("PaymentProcessor", error);
  }
}

/**
 * Handles contract verification errors
 */
function handleVerificationError(contractName: string, error: any) {
  if (error.message.includes("Already Verified")) {
    console.log(`${contractName} is already verified!`);
  } else {
    console.error(`Error verifying ${contractName}:`, error);
  }
}

/**
 * Saves deployment information to a JSON file
 */
async function saveDeploymentInfo(
  networkName: string,
  usdcAddress: string,
  paymentProcessorAddress: string,
  deployerAddress: string,
  initialSupply: bigint
) {
  const fs = require("fs");
  const deployments = {
    network: networkName,
    mockUSDC: usdcAddress,
    paymentProcessor: paymentProcessorAddress,
    deployer: deployerAddress,
    initialSupply: initialSupply.toString(),
    timestamp: new Date().toISOString(),
  };

  const deploymentsPath = "./deployments";
  if (!fs.existsSync(deploymentsPath)) {
    fs.mkdirSync(deploymentsPath);
  }

  fs.writeFileSync(
    `${deploymentsPath}/${networkName}.json`,
    JSON.stringify(deployments, null, 2)
  );
  console.log(`\nDeployment addresses saved to ${deploymentsPath}/${networkName}.json`);
}

/**
 * Logs deployment summary including verification commands
 */
function logDeploymentSummary(
  networkName: string,
  usdcAddress: string,
  paymentProcessorAddress: string,
  deployerAddress: string,
  initialSupply: bigint
) {
  console.log("\nDeployment Summary");
  console.log("==================");
  console.log(`Network: ${networkName}`);
  console.log(`Mock USDC: ${usdcAddress}`);
  console.log(`PaymentProcessor: ${paymentProcessorAddress}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Initial USDC Supply: ${ethers.formatUnits(initialSupply, 18)}`);

  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log("\nVerification Commands");
    console.log("====================");
    console.log(`Mock USDC:`);
    console.log(`npx hardhat verify --network ${networkName} ${usdcAddress} "USD Coin" "USDC"`);
    console.log(`\nPaymentProcessor:`);
    console.log(`npx hardhat verify --network ${networkName} ${paymentProcessorAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });