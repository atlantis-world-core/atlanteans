import { getAddress } from 'ethers/lib/utils';
import { ethers, upgrades } from 'hardhat';

async function main() {
  console.log('✨ init Mainnet upgrade script...');

  const Atlanteans = await ethers.getContractFactory('Atlanteans');
  const upgradedAtlanteans = await upgrades.upgradeProxy(
    getAddress('0x47691834cbb96ce5fbcd1c82f3804fba63460370'),
    Atlanteans
  );
  console.log('Atlanteans upgraded');

  // mintlistRefund added
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
