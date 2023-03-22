import { BigNumber, ContractReceipt, ContractTransaction } from 'ethers';
import { BLOCK_ONE_DAY, BLOCK_ONE_HOUR, TimeFormat } from '../utils/time';
import { formatEther, getAddress, parseEther } from 'ethers/lib/utils';
import { Atlanteans, AtlanteansSale } from '../typechained';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, upgrades } from 'hardhat';

async function main() {
  console.log('✨ init Mainnet deploy script...');

  let deployer: SignerWithAddress;
  let tx: ContractTransaction;
  let rc: ContractReceipt;

  [deployer] = await ethers.getSigners();
  console.log('- deployer address', deployer.address);

  const treasury = getAddress('0xb47D2de67F68F17Ca9eE2D84394880B652B96Abb');
  const deployerBal = await deployer.getBalance();
  console.log('- deployer balance', formatEther(deployerBal));


  // sale
  const atlanteansSaleFactory = await ethers.getContractFactory(
    'AtlanteansSale'
  );

  const atlanteansSale = <AtlanteansSale>(
    await upgrades.upgradeProxy("0x3c800c367e75ce460287cee10db0b2c6e7c894f3",atlanteansSaleFactory)
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
