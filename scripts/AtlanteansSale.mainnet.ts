import { BigNumber, ContractReceipt, ContractTransaction } from 'ethers';
import { BLOCK_ONE_DAY, BLOCK_ONE_HOUR, TimeFormat } from '../utils/time';
import { formatEther, getAddress, parseEther } from 'ethers/lib/utils';
import { Atlanteans, AtlanteansSale } from '../typechained';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, upgrades } from 'hardhat';
import { MerkleTreeUtil } from '../utils/merkle';

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

  // atlanteans
  const atlanteansFactory = await ethers.getContractFactory('Atlanteans');
  const atlanteans = <Atlanteans>await upgrades.deployProxy(atlanteansFactory, [
    treasury, // treasury
    'defaultBaseURI/', // baseURI
  ]);
  await atlanteans.deployed();
  console.log('- Atlanteans erc721a deployed:', atlanteans.address);

  // sale
  const atlanteansSaleFactory = await ethers.getContractFactory(
    'AtlanteansSale'
  );
  const saleInitArgs: AtlanteansSale.InitializerArgsStruct = {
    atlanteans: atlanteans.address, // atlanteans
    treasury: treasury,
    weth: getAddress('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
    // ! might need to change
    server: getAddress('0x284677dB45770dEAf0c947538b5d02F8270c70BC'),

    // phases
    mintlistStartTime: BigNumber.from('1679504400'),
    daStartTime: BigNumber.from('1679590800'),
    publicStartTime: BigNumber.from('1679677200'),
    publicEndTime: BigNumber.from('1679763600'),
    claimsStartTime: BigNumber.from('1679677200'),
    claimsEndTime: BigNumber.from('1687626000'),

    // auction
    startPrice: parseEther('0.1420'),
    lowestPrice: parseEther('0.069'),
    dropPerStep: parseEther('0.0031'),
    daPriceCurveLength: BigNumber.from(
      TimeFormat.fromBigNumber(BLOCK_ONE_DAY) // 24 hrs
    ),
    daDropInterval: BigNumber.from(TimeFormat.fromBigNumber(BLOCK_ONE_HOUR)), // 1 hr
    mintlistPrice: parseEther('0.05'),

    maxMintlistSupply: BigNumber.from(1999),
    maxDaSupply: BigNumber.from(2540),
    maxForSale: BigNumber.from(1999).add(BigNumber.from(2540)),
    maxForClaim: BigNumber.from(1442),
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
      // TODO: Get final mintlist leaves
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
