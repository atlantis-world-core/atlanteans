import { getAddress } from 'ethers/lib/utils';
import { run, ethers, upgrades } from 'hardhat';
import { Atlanteans } from '../typechained';
import { BLOCK_ONE_DAY, TimeFormat, TimeUtil } from '../utils/time';

async function main() {
  const now = await TimeUtil.now(ethers.provider);
  const signerAddr = getAddress('0x284677dB45770dEAf0c947538b5d02F8270c70BC');
  const treasuryAddr = signerAddr;
  const BASE_URI = 'https://bafybeigqpsielyqxicsnkkc6c3mjvf7madwptznqghtwew7wyzv7fidsae.ipfs.nftstorage.link/';
  const MYSTERY_URI = 'https://bafybeiciil5uvn3tzzdh7v6xnkp5lg7gjd23bhzdzpl5yste7hrkxhhuve.ipfs.nftstorage.link/mystery.json';

  const initializerArgs = [
    signerAddr,
    treasuryAddr,
    BASE_URI,
    MYSTERY_URI,
    {
      start: TimeFormat.fromBigNumber(now),
      end: TimeFormat.fromBigNumber(now + BLOCK_ONE_DAY),
    } as Atlanteans.TimeRangeStruct, // time limit
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
