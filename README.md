![](https://img.shields.io/badge/Solidity-informational?style=flat&logo=solidity&logoColor=white&color=6aa6f8)
![](https://img.shields.io/badge/Hardhat-informational?style=flat&logo=hardhat&logoColor=white&color=6aa6f8)
![](https://img.shields.io/badge/Typescript-informational?style=flat&logo=typescript&logoColor=white&color=6aa6f8)
![](https://img.shields.io/badge/Ethers.js-informational?style=flat&logo=ethereum&logoColor=white&color=6aa6f8)
![](https://img.shields.io/badge/OpenZeppelin-informational?style=flat&logo=openzeppelin&logoColor=white&color=6aa6f8)

# QR Code Payments solution for WhatsApp. Smart Contracts Repo.

This repository contains the smart contracts for a QR payment processing system designed for ChatterPay, a WhatsApp wallet that handles ERC20 token payments with order tracking capabilities.

## Features

- Create payment orders with specific ERC20 tokens and amounts
- Process payments from users to fulfill orders
- Track payment status and payer information
- Built with security in mind using OpenZeppelin contracts
- Comprehensive test coverage
- Deployment scripts for local and testnet environments

## Smart Contracts

- **PaymentProcessor.sol**: Main contract handling payment orders and processing
- **USDC.sol**: Mock USDC token for testing purposes

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.1.21 or later)
- [Node.js](https://nodejs.org/) (v18 or later)

### Installation
```bash
bun install
```

### Configuration

Create a `.env` file in the root directory with the following variables:

```bash
SEPOLIA_RPC_URL=your_sepolia_rpc_url
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```


### Compile Contracts
```bash
bun run compile
```

### Run unit tests
```bash
bun run test
```

### Run coverage report
```bash
bun run coverage
```

### Deploy to network
Locally deploy:
```bash
bun run deploy:local
```

Deploy on Ethereum Sepolia (testnet):
```bash
bun run deploy:sepolia
```
## Project Structure

- `contracts/`: Smart contract source files
- `scripts/`: Deployment and testing scripts
- `test/`: Test files
- `deployments/`: Deployment artifacts and addresses
- `typechain-types/`: Generated TypeScript types for contracts

## Testing

The test suite includes comprehensive tests for:

- Contract deployment
- Payment order creation
- Order payment processing
- Access control
- Error handling
- Edge cases

## Security

- Uses OpenZeppelin's battle-tested contracts
- Implements reentrancy protection
- Access control via Ownable pattern
- Comprehensive error handling

## License

MIT