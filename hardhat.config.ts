import 'dotenv/config';
import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import { removeConsoleLog } from 'hardhat-preprocessor';
import 'hardhat-deploy';

import {
  HardhatUserConfig,
  MultiSolcUserConfig,
  NetworksUserConfig,
} from 'hardhat/types';
import * as env from './utils/env';
import 'tsconfig-paths/register';
import './tasks';

const networks: NetworksUserConfig =
  env.isHardhatCompile() || env.isHardhatClean() || env.isTesting()
    ? {}
    : {
        hardhat: {
          forking: {
            enabled: process.env.FORK ? true : false,
            url: env.getNodeUrl('ethereum'),
          },
        },
        localhost: {
          url: 'http://127.0.0.1:8545',
          accounts: env.getAccounts('localhost'),
        },
        goerli: {
          url: env.getNodeUrl('goerli'),
          accounts: env.getAccounts('ethereum'),
        },
        kovan: {
          url: env.getNodeUrl('kovan'),
          accounts: env.getAccounts('ethereum'),
        },
        ethereum: {
          url: env.getNodeUrl('ethereum'),
          accounts: env.getAccounts('ethereum'),
        },
        optimismMainnet: {
          url: env.getNodeUrl('optimismMainnet'),
          accounts: env.getAccounts('optimism'),
        },
        optimismGoerli: {
          url: env.getNodeUrl('optimismGoerli'),
          accounts: env.getAccounts('optimism'),
        },
        optimismKovan: {
          url: env.getNodeUrl('optimismKovan'),
          accounts: env.getAccounts('optimism'),
        },
        polygonMumbai: {
          url: env.getNodeUrl('polygonMumbai'),
          accounts: env.getAccounts('polygon'),
        },
      };

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  mocha: {
    timeout: process.env.MOCHA_TIMEOUT || 300000,
  },
  networks,
  solidity: {
    version: '0.8.14',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
      outputSelection: {
        '*': {
          '*': ['storageLayout'],
        },
      },
    },
    compilers: [
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: process.env.COINMARKETCAP_DEFAULT_CURRENCY ?? 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    showMethodSig: false,
    onlyCalledMethods: true,
    token: 'ETH',
    gasPriceApi:
      'https://api.etherscan.io/api?module=proxy&action=eth_gasPrice',
  },
  preprocess: {
    eachLine: removeConsoleLog((hre) => hre.network.name !== 'hardhat'),
  },
  etherscan: {
    apiKey: env.getEtherscanAPIKeys([
      'ethereum',
      'optimismGoerli',
      'polygonMumbai',
    ]),
    customChains: [
      {
        chainId: 420,
        network: 'optimismGoerli',
        urls: {
          apiURL: 'https://blockscout.com/optimism/goerli/api',
          browserURL: 'https://blockscout.com/optimism/goerli',
        },
      },
    ],
  },
  typechain: {
    outDir: 'typechained',
    target: 'ethers-v5',
  },
  paths: {
    sources: './solidity',
  },
};

if (env.isTesting()) {
  (config.solidity as MultiSolcUserConfig).compilers = (
    config.solidity as MultiSolcUserConfig
  ).compilers.map((compiler) => {
    return {
      ...compiler,
      outputSelection: {
        '*': {
          '*': ['storageLayout'],
        },
      },
    };
  });
}

export default config;
