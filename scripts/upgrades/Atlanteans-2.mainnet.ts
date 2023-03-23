import { getAddress } from 'ethers/lib/utils';
import { ethers, upgrades } from 'hardhat';

async function main() {
  console.log('✨ init Mainnet upgrade script...');

  const AtlanteansSale = await ethers.getContractFactory('AtlanteansSale');

  await upgrades.upgradeProxy(
    // https://etherscan.io/address/0x3c800c367E75ce460287CEE10DB0B2C6e7C894f3
    getAddress('0x3c800c367e75ce460287cee10db0b2c6e7c894f3'),
    AtlanteansSale
  );
  console.log('AtlanteansSale upgraded');

  // mintlistRefund added
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
