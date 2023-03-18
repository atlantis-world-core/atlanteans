import { run, ethers, upgrades } from 'hardhat';
import { Atlanteans } from '../typechained';
import { BLOCK_ONE_DAY, TimeFormat, TimeUtil } from '../utils/time';

// TODO: It requires Design Pod to complete all characters and Web3 Pod to prepare metadata, then uploading it to IPFS and get CID to make it as baseURI
// TODO: Get treasury address from Crazy Pod, all Ether gets sent here
// TODO: Might remove some positional arguments based on Crazy Pod's decisions
async function main() {
  run('compile');

  const now = await TimeUtil.now(ethers.provider);
  const initializerArgs = [
    '0x2A12Ba8dceBb7e3912037370020FDF2dD7C90AF6', // signerAddr
    '0x2A12Ba8dceBb7e3912037370020FDF2dD7C90AF6', // treasuryAddr
    'defaultBaseURI/', // baseURI
    {
      start: TimeFormat.fromBigNumber(now),
      end: TimeFormat.fromBigNumber(now + BLOCK_ONE_DAY * 220),
    } as Atlanteans.TimeRangeStruct, // minting with signature time limit
  ];

  const Atlanteans = await ethers.getContractFactory('Atlanteans');
  const atlanteans = <Atlanteans>await upgrades.deployProxy(Atlanteans, initializerArgs);
  await atlanteans.deployed();

  console.log('Atlanteans deployed to:', atlanteans.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
