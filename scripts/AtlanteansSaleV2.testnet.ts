import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, ContractReceipt, ContractTransaction } from 'ethers';
import { formatEther, getAddress, parseEther } from 'ethers/lib/utils';
import { ethers, upgrades } from 'hardhat';
import { Atlanteans, AtlanteansSale, ERC20Mock } from '../typechained';
import { MerkleTreeUtil } from '../utils/merkle';
import { BLOCK_ONE_MINUTE, TimeFormat, TimeUtil } from '../utils/time';

async function main() {
  console.log('✨ init testnet deploy script...');

  let deployer: SignerWithAddress;
  let tx: ContractTransaction;
  let rc: ContractReceipt;
  const now = await TimeUtil.now(ethers.provider);

  [deployer] = await ethers.getSigners();
  console.log('- deployer address', deployer.address);

  const treasury = deployer;
  const deployerBal = await deployer.getBalance();
  console.log('- deployer balance', formatEther(deployerBal));

  // atlanteans
  const atlanteansFactory = await ethers.getContractFactory('Atlanteans');
  const atlanteans = <Atlanteans>await upgrades.deployProxy(atlanteansFactory, [
    treasury.address, // treasury
    'defaultBaseURI/', // baseURI
  ]);
  await atlanteans.deployed();
  console.log('- Atlanteans erc721a deployed:', atlanteans.address);

  // mock wrapped ether
  const wethFactory = await ethers.getContractFactory('ERC20Mock');
  const weth = <ERC20Mock>await wethFactory.deploy();
  console.log('WETH deployed:', weth.address);

  tx = await weth.mintTo(deployer.address, parseEther('10000'));
  rc = await tx.wait();

  // sale
  const atlanteansSaleFactory = await ethers.getContractFactory(
    'AtlanteansSale'
  );
  // const claimsStartTime = now + BLOCK_ONE_DAY * 4;
  // const publicStartTime = now + BLOCK_ONE_DAY * 3;
  const saleInitArgs: AtlanteansSale.InitializerArgsStruct = {
    atlanteans: atlanteans.address, // atlanteans
    treasury: treasury.address,
    weth: weth.address,
    server: getAddress('0x284677dB45770dEAf0c947538b5d02F8270c70BC'),

    // phases
    mintlistStartTime: TimeFormat.fromBigNumber(now + BLOCK_ONE_MINUTE * 5), // _mintlistStartTime
    daStartTime: TimeFormat.fromBigNumber(now + BLOCK_ONE_MINUTE * 15), // _daStartTime
    publicStartTime: TimeFormat.fromBigNumber(now + BLOCK_ONE_MINUTE * 50),
    publicEndTime: TimeFormat.fromBigNumber(now + BLOCK_ONE_MINUTE * 60),
    claimsStartTime: TimeFormat.fromBigNumber(now + BLOCK_ONE_MINUTE * 50),
    claimsEndTime: TimeFormat.fromBigNumber(now + BLOCK_ONE_MINUTE * 60),
    // selfRefundsStartTime: claimsStartTime,

    // auction
    startPrice: parseEther('0.1420'),
    lowestPrice: parseEther('0.069'),
    dropPerStep: parseEther('0.0031'),
    daPriceCurveLength: BigNumber.from(
      TimeFormat.fromBigNumber(BLOCK_ONE_MINUTE * 24) // 24 minutes
      // TimeFormat.fromBigNumber(BLOCK_ONE_DAY) // 24 hrs
    ),
    daDropInterval: BigNumber.from(
      TimeFormat.fromBigNumber(BLOCK_ONE_MINUTE)
      // TimeFormat.fromBigNumber(BLOCK_ONE_HOUR * 1)
    ),
    // finalPrice: parseEther('2.5'),
    mintlistPrice: parseEther('0.05'),

    // maxMintlistSupply: BigNumber.from(2),
    maxMintlistSupply: BigNumber.from(1999),
    // maxDaSupply: BigNumber.from(30),
    maxDaSupply: BigNumber.from(2540),
    // maxForSale: BigNumber.from(32),
    maxForSale: BigNumber.from(4539),
    // maxForClaim: BigNumber.from(2),
    maxForClaim: BigNumber.from(1781),
    maxTreasurySupply: BigNumber.from(469),
  };
  const atlanteansSale = <AtlanteansSale>(
    await upgrades.deployProxy(atlanteansSaleFactory, [saleInitArgs])
  );
  await atlanteansSale.deployed();
  console.log('- AtlanteansSale deployed:', atlanteansSale.address);

  tx = await atlanteans.addMinter(atlanteansSale.address);
  rc = await tx.wait();

  /**
   * merkle trees
   */

  // mintlist
  const mintlistMerkleTree = MerkleTreeUtil.createMerkleTree(
    MerkleTreeUtil.sanitizeLeaves([
      '0x284677dB45770dEAf0c947538b5d02F8270c70BC', // matches deployer.address
      '0xb1d7dad6baef98df97bd2d3fb7540c08886e0299', // max
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
      '0x69dc230b06a15796e3f42baf706e0e55d4d5eaa1', // rev
      '0x9E569855F7CF13E9418Db5F0dE0D82DBB99a79Af', // cj
      '0xf8dc099064d9DaB079243B9F73bC77390e708b8a', // mike
      '0x9fF26d7e160A52064b328E38793e3569acbcaE99', // elisa
    ])
  );
  const mintlistMerkleRoot =
    MerkleTreeUtil.createMerkleRoot(mintlistMerkleTree);
  tx = await atlanteansSale.setMintlist1MerkleRoot(mintlistMerkleRoot);
  rc = await tx.wait();
  console.log('- mintlistMerkleRoot', mintlistMerkleRoot);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
