import { ethers, network, run } from "hardhat";

async function main() {
  console.log(`Deploying to network: ${network.name}`);

  try {
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying contracts with account: ${deployer.address}`);
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} ETH\n`);

    // Deploy Mock USDC
    console.log("Deploying Mock USDC...");
    const MockUSDC = await ethers.getContractFactory("USDC");
    const mockUSDC = await MockUSDC.deploy("USD Coin", "USDC");
    await mockUSDC.waitForDeployment();
    const usdcAddress = await mockUSDC.getAddress();
    console.log(`Mock USDC deployed to: ${usdcAddress}`);

    // Wait for USDC deployment confirmations
    console.log("Waiting for USDC block confirmations...");
    const BLOCK_CONFIRMATIONS = 5;
    await mockUSDC.deploymentTransaction()?.wait(BLOCK_CONFIRMATIONS);

    // Deploy PaymentProcessor
    console.log("\nDeploying PaymentProcessor...");
    const PaymentProcessor = await ethers.getContractFactory("PaymentProcessor");
    const paymentProcessor = await PaymentProcessor.deploy();
    await paymentProcessor.waitForDeployment();
    const paymentProcessorAddress = await paymentProcessor.getAddress();
    console.log(`PaymentProcessor deployed to: ${paymentProcessorAddress}`);

    // Wait for PaymentProcessor deployment confirmations
    console.log("Waiting for PaymentProcessor block confirmations...");
    await paymentProcessor.deploymentTransaction()?.wait(BLOCK_CONFIRMATIONS);

    // Mint some initial USDC supply (optional)
    const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18); // 1 million USDC
    console.log("\nMinting initial USDC supply...");
    await mockUSDC.mint(deployer.address, INITIAL_SUPPLY);
    console.log(`Minted ${ethers.formatUnits(INITIAL_SUPPLY, 18)} USDC to ${deployer.address}`);

    // Verify contracts on Etherscan if not on localhost
    if (network.name !== "hardhat" && network.name !== "localhost") {
      console.log("\nVerifying contracts on Etherscan...");

      // Verify USDC
      try {
        console.log("Verifying Mock USDC...");
        await run("verify:verify", {
          address: usdcAddress,
          constructorArguments: ["USD Coin", "USDC"],
        });
        console.log("Mock USDC verified successfully");
      } catch (error: any) {
        if (error.message.includes("Already Verified")) {
          console.log("Mock USDC is already verified!");
        } else {
          console.error("Error verifying Mock USDC:", error);
        }
      }

      // Verify PaymentProcessor
      try {
        console.log("\nVerifying PaymentProcessor...");
        await run("verify:verify", {
          address: paymentProcessorAddress,
          constructorArguments: [],
        });
        console.log("PaymentProcessor verified successfully");
      } catch (error: any) {
        if (error.message.includes("Already Verified")) {
          console.log("PaymentProcessor is already verified!");
        } else {
          console.error("Error verifying PaymentProcessor:", error);
        }
      }
    }

    // Log deployment summary
    console.log("\nDeployment Summary");
    console.log("==================");
    console.log(`Network: ${network.name}`);
    console.log(`Mock USDC: ${usdcAddress}`);
    console.log(`PaymentProcessor: ${paymentProcessorAddress}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Initial USDC Supply: ${ethers.formatUnits(INITIAL_SUPPLY, 18)}`);

    // Save deployment addresses to a file
    const fs = require("fs");
    const deployments = {
      network: network.name,
      mockUSDC: usdcAddress,
      paymentProcessor: paymentProcessorAddress,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
    };

    const deploymentsPath = "./deployments";
    if (!fs.existsSync(deploymentsPath)) {
      fs.mkdirSync(deploymentsPath);
    }

    fs.writeFileSync(
      `${deploymentsPath}/${network.name}.json`,
      JSON.stringify(deployments, null, 2)
    );
    console.log(`\nDeployment addresses saved to ${deploymentsPath}/${network.name}.json`);

    // Log verification instructions if on testnet/mainnet
    if (network.name !== "hardhat" && network.name !== "localhost") {
      console.log("\nVerification Commands");
      console.log("====================");
      console.log(`Mock USDC:`);
      console.log(`npx hardhat verify --network ${network.name} ${usdcAddress} "USD Coin" "USDC"`);
      console.log(`\nPaymentProcessor:`);
      console.log(`npx hardhat verify --network ${network.name} ${paymentProcessorAddress}`);
    }

  } catch (error) {
    console.error("\nDeployment failed:", error);
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });