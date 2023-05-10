import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/93e13de1e69349009df3d745be82b17b",
      accounts:
        process.env.RINKEBY_PRIVATE_KEY !== undefined
          ? [process.env.RINKEBY_PRIVATE_KEY]
          : [],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts:
        process.env.LOCALHOST_PRIVATE_KEY !== undefined
          ? [process.env.LOCALHOST_PRIVATE_KEY]
          : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
