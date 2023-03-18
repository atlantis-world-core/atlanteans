import { getAddress } from 'ethers/lib/utils';
import { ethers, upgrades } from 'hardhat';
import { AtlanteanAnalytics } from '../typechained';

async function main() {
  const initializerArgs = [
    getAddress('0x284677dB45770dEAf0c947538b5d02F8270c70BC'), // signerAddr
  ];
  const factory = await ethers.getContractFactory('AtlanteanAnalytics');
  const contract = <AtlanteanAnalytics>await upgrades.deployProxy(factory, initializerArgs);
  await contract.deployed();

  console.log('AtlanteanAnalytics deployed to:', contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
