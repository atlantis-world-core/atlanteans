import { BigNumber, ContractReceipt, ContractTransaction } from 'ethers';
import { BLOCK_ONE_DAY, BLOCK_ONE_HOUR, TimeFormat } from '../utils/time';
import { formatEther, getAddress, parseEther } from 'ethers/lib/utils';
import { Atlanteans, AtlanteansSale } from '../typechained';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, upgrades } from 'hardhat';

async function main() {
  console.log('✨ init testnet upgrade script...');

  let deployer: SignerWithAddress;

  [deployer] = await ethers.getSigners();
  console.log('- deployer address', deployer.address);

  const deployerBal = await deployer.getBalance();
  console.log('- deployer balance', formatEther(deployerBal));

  // sale
  const atlanteansSaleFactory = await ethers.getContractFactory(
    'AtlanteansSale'
  );

  const atlanteansSale = <AtlanteansSale>(
    await upgrades.upgradeProxy(
      '0x6cD551658B37B9131FE5758FcC03C884954F23b7',
      atlanteansSaleFactory
    )
  );
  await atlanteansSale.deployed();
  console.log('- AtlanteansSale upgraded:', atlanteansSale.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
