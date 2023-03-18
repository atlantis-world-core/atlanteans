import { Atlanteans, AtlanteansSale } from '../typechained';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { ethers, upgrades } from 'hardhat';
import {
  ContractTransaction,
  ContractReceipt,
  BigNumber,
  Wallet,
} from 'ethers';
import {
  BLOCK_ONE_DAY,
  BLOCK_ONE_HOUR,
  BLOCK_ONE_MINUTE,
  TimeFormat,
  TimeUtil,
} from '../utils/time';

async function main() {
  console.log('\n\n⚡ tesnet deployment start ⚡');

  let tx: ContractTransaction;
  let rc: ContractReceipt;

  const now = await TimeUtil.now(ethers.provider);

  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  const treasuryAddr = Wallet.createRandom().address;

  // log info
  console.log('deployer addr:', deployerAddr);
  console.log('treasury addr:', treasuryAddr);
  console.log('deployer eth:', formatEther(await deployer.getBalance()));

  // atlanteans erc721a
  const AtlanteansFactory = await ethers.getContractFactory('Atlanteans');
  const atlanteans = <Atlanteans>await upgrades.deployProxy(AtlanteansFactory, [
    treasuryAddr, // treasuryAddr
    'defaultBaseURI/', // baseURI
    'defaultBaseURI/', // mysteryURI
  ]);
  await atlanteans.deployed();
  console.log('Atlanteans deployed at:', atlanteans.address);

  // sale
  const AtlanteansSaleFactory = await ethers.getContractFactory(
    'AtlanteansSale'
  );
  const atlanteansSale = <AtlanteansSale>await upgrades.deployProxy(
    AtlanteansSaleFactory,
    [
      {
        atlanteans: atlanteans.address,
        treasury: treasuryAddr,
        daStartTime: TimeFormat.fromBigNumber(now + BLOCK_ONE_MINUTE),
        mintlistStartTime: TimeFormat.fromBigNumber(
          now + BLOCK_ONE_MINUTE * 20
        ),
        publicStartTime: TimeFormat.fromBigNumber(now + BLOCK_ONE_MINUTE * 40),
        claimsStartTime: TimeFormat.fromBigNumber(now + BLOCK_ONE_MINUTE * 60),
        selfRefundsStartTime: TimeFormat.fromBigNumber(now + BLOCK_ONE_DAY),

        startPrice: parseEther('0.19'),
        lowestPrice: parseEther('0.09'),
        dropPerStep: parseEther('0.01'),
        daPriceCurveLength: BigNumber.from(
          TimeFormat.fromBigNumber(BLOCK_ONE_HOUR * 11)
        ),
        daDropInterval: BigNumber.from(
          TimeFormat.fromBigNumber(BLOCK_ONE_HOUR * 1)
        ),
        finalPrice: parseEther('2.5'),

        maxDaSupply: BigNumber.from(2_999),
        maxForSale: BigNumber.from(5_008),
        maxForClaim: BigNumber.from(1_781),
      } as AtlanteansSale.InitializerArgsStruct,
    ]
  );
  await atlanteansSale.deployed();
  console.log('AtlanteansSale deployed at:', atlanteansSale.address);

  // add minter
  await atlanteans.addMinter(atlanteansSale.address);

  const MERKLE_ROOT =
    '0x77e700f03437c8e81143fabca89ab927d28d5207bf6ed00aa9b4d8ed5cdd6f7c';

  tx = await atlanteansSale.setMintlist1MerkleRoot(MERKLE_ROOT);
  rc = await tx.wait();

  tx = await atlanteansSale.setMintlist2MerkleRoot(MERKLE_ROOT);
  rc = await tx.wait();

  tx = await atlanteansSale.setClaimlistMerkleRoot(MERKLE_ROOT);
  rc = await tx.wait();

  console.log('verify the contracts!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
