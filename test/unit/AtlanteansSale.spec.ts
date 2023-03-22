import {
  BLOCK_ONE_DAY,
  BLOCK_ONE_HOUR,
  BLOCK_ONE_MINUTE,
  BLOCK_ONE_MONTH,
  TimeFormat,
  TimeUtil,
} from '../../utils/time';
import {
  Atlanteans,
  AtlanteansSale,
  AtlanteansSale__factory,
  Atlanteans__factory,
  ERC20Mock,
} from '../../typechained';
import {
  BytesLike,
  formatEther,
  getAddress,
  isAddress,
  parseEther,
} from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, upgrades } from 'hardhat';
import {
  BigNumber,
  BigNumberish,
  constants,
  Contract,
  ContractReceipt,
  ContractTransaction,
  Wallet,
} from 'ethers';
import { expect } from 'chai';
import { MerkleTreeUtil } from '../../utils/merkle';
import MerkleTree from 'merkletreejs';
import { MockContract, smock } from '@defi-wonderland/smock';

describe('Spec: AtlanteansSale', () => {
  let tx: ContractTransaction;
  let rc: ContractReceipt;

  // contracts
  let atlanteansSale: AtlanteansSale;
  let atlanteans: Atlanteans;
  let weth: ERC20Mock;

  let mockAtlanteansSale: MockContract<AtlanteansSale>;
  let mockAtlanteans: MockContract<Atlanteans>;

  // vars
  // let lastPrice: BigNumber;
  let mintlistPrice: BigNumber;
  let lastPrice: BigNumber;
  let maxDaSupply: BigNumber;
  let maxForClaim: BigNumber;
  let maxForSale: BigNumber;
  let currentDaPrice: BigNumber;

  // args
  let numAtlanteans: BigNumberish;

  // signers
  let admin: SignerWithAddress;
  let server: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;
  let whitelistedUser: SignerWithAddress;
  let publicUser: SignerWithAddress;
  let foundingAtlanteanUser: SignerWithAddress;
  let treasury: Wallet;

  // merkle
  let mintlistMerkleTree: MerkleTree;
  let mintlistMerkleRoot: string;

  // utils
  let now: number;

  let snapshotScrollHolders: Record<string, BigNumberish>;

  const numberToTimestamp = (value: number) => TimeFormat.fromBigNumber(value);
  const evmIncreaseTime = async (timestamp: number) => {
    await ethers.provider.send('evm_increaseTime', [
      numberToTimestamp(timestamp),
    ]);
    await ethers.provider.send('evm_mine', []);
  };

  const evmDecreaseTime = async (timestamp: number) => {
    await ethers.provider.send('evm_increaseTime', [
      -numberToTimestamp(timestamp),
    ]);
    await ethers.provider.send('evm_mine', []);
  };

  const getTreasuryBalance = async (contract: Contract) =>
    await ethers.provider.getBalance(contract.address);

  const calculateTxFee = (rc: ContractReceipt) =>
    rc.gasUsed.mul(rc.effectiveGasPrice);

  beforeEach(async () => {
    const now = await TimeUtil.now(ethers.provider);

    [
      admin,
      user,
      whitelistedUser,
      foundingAtlanteanUser,
      publicUser,
      server,
      user2,
      user3,
      user4,
      user5,
    ] = await ethers.getSigners();
    treasury = Wallet.createRandom();

    // for claimSummon
    snapshotScrollHolders = {
      [getAddress(user.address)]: '32',
      [getAddress(user2.address)]: '24',
      [getAddress(user3.address)]: '12',
      [getAddress(user4.address)]: '5',
      [getAddress(user5.address)]: '1',
    };

    // atlanteans
    const Atlanteans = await ethers.getContractFactory('Atlanteans');
    atlanteans = <Atlanteans>await upgrades.deployProxy(Atlanteans, [
      treasury.address, // treasuryAddr
      'defaultBaseURI/', // baseURI
      // 'defaultBaseURI/', // mysteryURI
    ]);
    await atlanteans.deployed();

    // mock atlanteans
    const mockAtlanteansFactory = await smock.mock<Atlanteans__factory>(
      'Atlanteans',
      admin
    );
    mockAtlanteans = await mockAtlanteansFactory.deploy();
    await mockAtlanteans.initialize(
      treasury.address, // treasuryAddr
      'defaultBaseURI/' // baseURI
      // 'defaultBaseURI/' // mysteryURI
    );

    // mock wrapped ether
    const wethFactory = await ethers.getContractFactory('ERC20Mock');
    weth = <ERC20Mock>await wethFactory.deploy();

    tx = await weth.connect(user).mintTo(user.address, parseEther('10000'));
    await tx.wait();

    // sale
    const factory = await ethers.getContractFactory('AtlanteansSale');
    const claimsStartTime = now + BLOCK_ONE_DAY * 3;
    const publicStartTime = now + BLOCK_ONE_DAY * 3;
    const saleInitArgs: AtlanteansSale.InitializerArgsStruct = {
      atlanteans: atlanteans.address, // atlanteans
      treasury: treasury.address,
      weth: weth.address,
      server: server.address,

      // phases
      mintlistStartTime: TimeFormat.fromBigNumber(now + BLOCK_ONE_DAY), // _mintlistStartTime
      daStartTime: TimeFormat.fromBigNumber(now + BLOCK_ONE_DAY * 2), // _daStartTime
      publicStartTime: TimeFormat.fromBigNumber(publicStartTime),
      publicEndTime: TimeFormat.fromBigNumber(publicStartTime + BLOCK_ONE_DAY),
      claimsStartTime: TimeFormat.fromBigNumber(claimsStartTime),
      claimsEndTime: TimeFormat.fromBigNumber(
        claimsStartTime + BLOCK_ONE_MONTH * 3
      ),
      // selfRefundsStartTime: claimsStartTime,

      // auction
      startPrice: parseEther('0.1420'),
      lowestPrice: parseEther('0.069'),
      dropPerStep: parseEther('0.0031'),
      daPriceCurveLength: BigNumber.from(
        TimeFormat.fromBigNumber(BLOCK_ONE_DAY) // 24 hrs
      ),
      daDropInterval: BigNumber.from(
        TimeFormat.fromBigNumber(BLOCK_ONE_HOUR * 1)
      ),
      // lastPrice: parseEther('2.5'),
      mintlistPrice: parseEther('0.05'),

      maxMintlistSupply: BigNumber.from(1999),
      maxDaSupply: BigNumber.from(2540),
      maxForSale: BigNumber.from(1999).add(BigNumber.from(2540)),
      maxForClaim: BigNumber.from(1442),
      maxTreasurySupply: BigNumber.from(469),
    };
    atlanteansSale = <AtlanteansSale>(
      await upgrades.deployProxy(factory, [saleInitArgs])
    );
    await atlanteansSale.deployed();

    // mock sale
    const mockAtlanteansSaleFactory = await smock.mock<AtlanteansSale__factory>(
      'AtlanteansSale',
      admin
    );
    mockAtlanteansSale = await mockAtlanteansSaleFactory.deploy();
    await mockAtlanteansSale.connect(admin).initialize({
      ...saleInitArgs,
      atlanteans: mockAtlanteans.address,
    });

    await atlanteans.connect(admin).addMinter(atlanteansSale.address);
    await mockAtlanteans.connect(admin).addMinter(mockAtlanteansSale.address);

    // merkle tree
    mintlistMerkleTree = MerkleTreeUtil.createMerkleTree(
      MerkleTreeUtil.sanitizeLeaves([
        admin.address,
        user.address,
        whitelistedUser.address,
      ])
    );
    mintlistMerkleRoot = MerkleTreeUtil.createMerkleRoot(mintlistMerkleTree);
    await mockAtlanteansSale
      .connect(admin)
      .setMintlist1MerkleRoot(mintlistMerkleRoot);
    await atlanteansSale
      .connect(admin)
      .setMintlist1MerkleRoot(mintlistMerkleRoot);

    // vars
    [mintlistPrice, lastPrice, maxDaSupply, maxForSale, maxForClaim] =
      await Promise.all([
        atlanteansSale.mintlistPrice(),
        atlanteansSale.lastPrice(),
        mockAtlanteansSale.maxDaSupply(),
        mockAtlanteansSale.maxForSale(),
        mockAtlanteansSale.maxForClaim(),
      ]);

    // args
    numAtlanteans = '1';
  });

  describe('> currentDaPrice', () => {
    beforeEach(async () => {
      await evmIncreaseTime(BLOCK_ONE_DAY * 2);
    });

    it('should get latest daPrice after 10 minutes', async () => {
      await evmIncreaseTime(BLOCK_ONE_MINUTE * 10);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 10 minutes:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 1 hour', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 1);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 1 hour:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 2 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 2);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 2 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 3 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 3);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 3 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 4 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 4);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 4 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 5 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 5);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 5 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 6 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 6);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 6 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 7 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 7);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 7 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 8 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 8);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 8 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 9 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 9);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 9 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 10 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 10);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 10 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 11 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 11);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 11 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 12 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 12);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 12 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 13 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 13);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 13 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 14 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 14);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 14 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 15 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 15);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 15 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 16 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 16);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 16 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 17 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 17);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 17 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 18 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 18);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 18 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 19 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 19);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 19 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 20 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 20);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 20 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 21 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 21);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 21 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 22 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 22);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 22 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 23 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 23);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 23 hours:',
        formatEther(currentDaPrice)
      );
    });

    it('should get latest daPrice after 24 hours', async () => {
      await evmIncreaseTime(BLOCK_ONE_HOUR * 24);

      const currentDaPrice = await atlanteansSale.currentDaPrice();
      console.log(
        '\nThe current DA price after 24 hours:',
        formatEther(currentDaPrice)
      );
    });
  });

  describe('> mintlistPrice', () => {
    it('should be 0.055 $ETH', async () => {
      expect(parseEther('0.05')).to.be.eq(mintlistPrice);
    });
  });

  describe('> daStarted', () => {
    it('should return false when the auction phase has not started', async () => {
      expect(await atlanteansSale.daStarted()).to.be.eq(false);
    });

    it('should return true when auction phase has started', async () => {
      await evmIncreaseTime(BLOCK_ONE_DAY * 2);

      expect(await atlanteansSale.daStarted()).to.be.eq(true);
    });
  });

  describe('> mintlistStarted', () => {
    it('should return false when mintlist phase has not started yet', async () => {
      expect(await atlanteansSale.mintlistStarted()).to.be.eq(false);
    });

    it('should return true when current time fits mintlist schedule', async () => {
      await evmIncreaseTime(BLOCK_ONE_DAY * BLOCK_ONE_HOUR);

      expect(await atlanteansSale.mintlistStarted()).to.be.eq(true);
    });
  });

  describe('> publicStarted', () => {
    it('should return false when public phase has not started yet', async () => {
      expect(await atlanteansSale.publicStarted()).to.be.eq(false);
    });

    it('should return true when current time fits public phase schedule', async () => {
      await evmIncreaseTime(BLOCK_ONE_DAY * 3);

      expect(await atlanteansSale.publicStarted()).to.be.eq(true);
    });
  });

  describe('> publicEnded', () => {
    it('should return false when public phase has not ended yet', async () => {
      await evmIncreaseTime(BLOCK_ONE_DAY * 3);
      expect(await atlanteansSale.publicEnded()).to.be.eq(false);
    });

    it('should return true when public phase has ended', async () => {
      await evmIncreaseTime(BLOCK_ONE_DAY * 3 + BLOCK_ONE_DAY);

      expect(await atlanteansSale.publicEnded()).to.be.eq(true);
    });
  });

  describe('> claimsStarted', () => {
    it('should return true when public phase have ended', async () => {
      await evmIncreaseTime(BLOCK_ONE_DAY * 3);

      expect(await atlanteansSale.claimsStarted()).to.be.eq(true);
    });
  });

  describe('> remainingForSale', () => {
    it('should get the remaining auction supply before auction started', async () => {
      // sold from mintlist
      await mockAtlanteansSale.setVariable('numSold', BigNumber.from(1999));

      const remainingForSale = await mockAtlanteansSale.remainingForSale();
      console.log('remainingForSale', remainingForSale);

      expect('2540').to.be.eq(remainingForSale);
    });

    it('should bla bla', async () => {
      await evmIncreaseTime(BLOCK_ONE_DAY * 2);
      const maxMintlistSupply = BigNumber.from(1999);
      const maxDaSupply = BigNumber.from(2540);

      await mockAtlanteansSale.setVariable(
        'maxMintlistSupply',
        maxMintlistSupply
      );
      await mockAtlanteansSale.setVariable('maxDaSupply', maxDaSupply);
      await mockAtlanteansSale.setVariable(
        'numMintlistSold',
        maxMintlistSupply
      );
      await mockAtlanteansSale.setVariable('numSold', maxMintlistSupply);

      const daStarted = await mockAtlanteansSale.daStarted();
      console.log('bla bla: daStarted', daStarted);

      const remainingForSale = await mockAtlanteansSale.remainingForSale();
      console.log('bla bla: remainingForSale', remainingForSale.toNumber());
    });

    it('should get the remaining auction supply after auction started with remaining supply from mintlist', async () => {
      await evmIncreaseTime(BLOCK_ONE_DAY * 2);

      const daStarted = await atlanteansSale.daStarted();
      console.log('daStarted', daStarted);
      console.log(6538 - 4539);

      const remainingForSale = await atlanteansSale.remainingForSale();
      console.log('remainingForSale', remainingForSale);

      expect('4539').to.be.eq(remainingForSale);
    });

    it('should get mock', async () => {
      const numAtlanteans = BigNumber.from('2');

      await evmIncreaseTime(BLOCK_ONE_DAY * 2);

      await mockAtlanteansSale.setVariable('numSold', '4538');

      const [remainingForSale, numSold] = await Promise.all([
        mockAtlanteansSale.remainingForSale(),
        mockAtlanteansSale.numSold(),
      ]);

      console.log('remainingForSale', remainingForSale);
      console.log(
        'numAtlanteans.lt(remainingForSale)',
        numAtlanteans.lte(remainingForSale)
      );
    });
  });

  describe('> bidSummon', () => {
    beforeEach(async () => {
      await evmIncreaseTime(BLOCK_ONE_DAY * 2);

      [currentDaPrice] = await Promise.all([atlanteansSale.currentDaPrice()]);
    });

    it('should mint when given with exact $ETH', async () => {
      numAtlanteans = '3';

      let userBalance = await user.getBalance();

      tx = await atlanteansSale
        .connect(user)
        ['bidSummon(uint256)'](numAtlanteans, {
          value: parseEther(formatEther(currentDaPrice)).mul(numAtlanteans),
        });
      rc = await tx.wait();
      const fee = calculateTxFee(rc);

      const treasuryBalance = await getTreasuryBalance(atlanteansSale);

      expect(await atlanteans.balanceOf(user.address)).to.be.eq('3');
      expect(await user.getBalance()).to.be.eq(
        userBalance
          .sub(parseEther(formatEther(currentDaPrice)).mul(numAtlanteans))
          .sub(fee)
      );
      expect(treasuryBalance).to.be.greaterThanOrEqual(
        parseEther(formatEther(currentDaPrice)).mul(numAtlanteans)
      );
    });

    it('should mint and updates lastPrice', async () => {
      // setup
      await evmIncreaseTime(BLOCK_ONE_HOUR * 12);
      currentDaPrice = await atlanteansSale.currentDaPrice();
      numAtlanteans = '3';
      let userBalance = await user.getBalance();
      console.log('currentDaPrice', formatEther(currentDaPrice));

      // action
      tx = await atlanteansSale
        .connect(user)
        ['bidSummon(uint256)'](numAtlanteans, {
          value: parseEther(formatEther(currentDaPrice)).mul(numAtlanteans),
        });
      rc = await tx.wait();
      lastPrice = await atlanteansSale.lastPrice();
      console.log('lastPrice', formatEther(lastPrice));

      // assert
      const fee = calculateTxFee(rc);
      const treasuryBalance = await getTreasuryBalance(atlanteansSale);
      expect(await atlanteans.balanceOf(user.address)).to.be.eq(numAtlanteans);
      expect(await user.getBalance()).to.be.eq(
        userBalance
          .sub(parseEther(formatEther(currentDaPrice)).mul(numAtlanteans))
          .sub(fee)
      );
      expect(treasuryBalance).to.be.greaterThanOrEqual(
        parseEther(formatEther(currentDaPrice)).mul(numAtlanteans)
      );
      expect(lastPrice).to.be.eq(currentDaPrice);
    });

    it('should mint when given with exact ERC20', async () => {
      numAtlanteans = '3';
      const amount = currentDaPrice.mul(numAtlanteans);

      tx = await weth
        .connect(user)
        .mintTo(user.address, currentDaPrice.mul(numAtlanteans).mul(2));
      await tx.wait();

      tx = await weth.connect(user).approve(atlanteansSale.address, amount);
      await tx.wait();

      tx = await atlanteansSale
        .connect(user)
        ['bidSummon(uint256,uint256)'](numAtlanteans, amount);
      rc = await tx.wait();

      expect(await atlanteans.balanceOf(user.address)).to.be.eq('3');
      expect(
        await weth.balanceOf(atlanteansSale.address)
      ).to.be.greaterThanOrEqual(amount);
    });

    it('should revert when given incorrect $ETH', async () => {
      numAtlanteans = '1';

      await expect(
        atlanteansSale.connect(user)['bidSummon(uint256)'](numAtlanteans, {
          value: parseEther(formatEther(currentDaPrice)).mul(3),
        })
      ).to.be.revertedWith('AtlanteansSale: Ether value incorrect');

      const treasuryBalance = await getTreasuryBalance(atlanteansSale);

      expect(await atlanteans.balanceOf(user.address)).to.be.eq('0');
      expect(treasuryBalance).to.be.greaterThanOrEqual(
        parseEther('0').mul(numAtlanteans)
      );
    });

    it('should revert when not enough $ETH is sent', async () => {
      numAtlanteans = '3';

      await expect(
        atlanteansSale.connect(user)['bidSummon(uint256)'](numAtlanteans, {
          value: parseEther(formatEther(currentDaPrice)),
        })
      ).to.be.revertedWith('AtlanteansSale: Ether value incorrect');

      expect(await atlanteans.balanceOf(user.address)).to.be.eq('0');
      expect(
        await getTreasuryBalance(atlanteansSale)
      ).to.be.not.greaterThanOrEqual(
        parseEther(formatEther(currentDaPrice)).mul(numAtlanteans)
      );
    });

    it('should revert when auction phase is already over', async () => {
      numAtlanteans = '3';

      await evmIncreaseTime(BLOCK_ONE_DAY * 2);
      currentDaPrice = await atlanteansSale.currentDaPrice();

      await expect(
        atlanteansSale.connect(user)['bidSummon(uint256)'](numAtlanteans, {
          value: parseEther(formatEther(currentDaPrice)).mul(numAtlanteans),
        })
      ).to.be.revertedWith('AtlanteansSale: Auction phase over');
    });

    it('should revert when auction has not started yet', async () => {
      numAtlanteans = '3';

      await evmDecreaseTime(BLOCK_ONE_DAY * 3);
      currentDaPrice = await atlanteansSale.currentDaPrice();

      await expect(
        atlanteansSale.connect(user)['bidSummon(uint256)'](numAtlanteans, {
          value: parseEther(formatEther(currentDaPrice)).mul(numAtlanteans),
        })
      ).to.be.revertedWith('AtlanteansSale: Auction not started');
    });

    it('should revert when the auction sells out', async () => {
      numAtlanteans = '3';
      currentDaPrice = await mockAtlanteansSale.currentDaPrice();

      await mockAtlanteansSale.setVariable('numSold', '5008');
      await expect(
        mockAtlanteansSale.connect(user)['bidSummon(uint256)'](numAtlanteans, {
          value: parseEther(formatEther(currentDaPrice)).mul(numAtlanteans),
        })
      ).to.be.revertedWith('AtlanteansSale: Auction sold out');
    });

    it('should revert when the requested quantity to purchase goes beyond the max auction supply', async () => {
      numAtlanteans = '3';
      currentDaPrice = await mockAtlanteansSale.currentDaPrice();

      await mockAtlanteansSale.setVariable('numSold', '4538');
      await expect(
        mockAtlanteansSale.connect(user)['bidSummon(uint256)'](numAtlanteans, {
          value: parseEther(formatEther(currentDaPrice)).mul(numAtlanteans),
        })
      ).to.be.revertedWith('AtlanteansSale: Not enough remaining');
    });

    it('should revert when mint quantity requested is beyond 19', async () => {
      numAtlanteans = (await mockAtlanteans.MAX_QUANTITY_PER_TX()).add('1');
      currentDaPrice = await mockAtlanteansSale.currentDaPrice();

      await expect(
        mockAtlanteansSale.connect(user)['bidSummon(uint256)'](numAtlanteans, {
          value: parseEther(formatEther(currentDaPrice)).mul(numAtlanteans),
        })
      ).to.be.revertedWith(
        'AtlanteansSale: You can summon no more than 19 atlanteans at a time'
      );
    });

    it('should revert when contract is paused', async () => {
      numAtlanteans = '1';
      currentDaPrice = await mockAtlanteansSale.currentDaPrice();

      await mockAtlanteansSale.connect(admin).pause();

      await expect(
        mockAtlanteansSale.connect(user)['bidSummon(uint256)'](numAtlanteans, {
          value: parseEther(formatEther(currentDaPrice)).mul(numAtlanteans),
        })
      ).to.be.revertedWith('Pausable: paused');
    });
  });

  describe('> publicSummon', () => {
    beforeEach(async () => {
      await evmIncreaseTime(BLOCK_ONE_DAY * 3);
    });

    it('should mint when given exact $ETH', async () => {
      // setup
      numAtlanteans = '3';

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(user)
          ['publicSummon(uint256)'](numAtlanteans, {
            value: lastPrice.mul(numAtlanteans),
          })
      ).to.be.not.reverted;
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq(
        numAtlanteans
      );
    });

    it('should mint when given exact $ETH lastPrice', async () => {
      // setup
      numAtlanteans = '3';
      lastPrice = parseEther('0.09');
      await mockAtlanteansSale.setVariable('lastPrice', lastPrice);

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(user)
          ['publicSummon(uint256)'](numAtlanteans, {
            value: lastPrice.mul(numAtlanteans),
          })
      ).to.be.not.reverted;
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq(
        numAtlanteans
      );
    });

    it('should mint when given exact $WETH', async () => {
      // setup
      numAtlanteans = '3';
      const amount = lastPrice.mul(numAtlanteans);
      tx = await weth.connect(user).approve(mockAtlanteansSale.address, amount);
      await tx.wait();

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(user)
          ['publicSummon(uint256,uint256)'](numAtlanteans, amount)
      ).to.be.not.reverted;
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq(
        numAtlanteans
      );
    });

    it('should revert when $ETH supplied is not incorrect', async () => {
      // setup
      numAtlanteans = '3';

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(user)
          ['publicSummon(uint256)'](numAtlanteans, {
            value: lastPrice.mul('2'),
          })
      ).to.be.revertedWith('AtlanteansSale: Ether value sent is incorrect');
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq('0');
    });

    it('should revert when sale already sells out', async () => {
      // setup
      numAtlanteans = '1';
      await mockAtlanteansSale.setVariable('numSold', maxForSale);

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(user)
          ['publicSummon(uint256)'](numAtlanteans, {
            value: lastPrice.mul(numAtlanteans),
          })
      ).to.be.revertedWith('AtlanteansSale: Sold out');
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq('0');
    });

    it('should revert when there is only 1 item remaining', async () => {
      // setup
      numAtlanteans = '2';
      await mockAtlanteansSale.setVariable('numSold', maxForSale.sub(1));

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(user)
          ['publicSummon(uint256)'](numAtlanteans, {
            value: lastPrice.mul(numAtlanteans),
          })
      ).to.be.revertedWith('AtlanteansSale: Not enough remaining');
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq('0');
    });

    it('should revert when numAtlanteans is greater than 19', async () => {
      // setup
      numAtlanteans = '20';

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(user)
          ['publicSummon(uint256)'](numAtlanteans, {
            value: lastPrice.mul(numAtlanteans),
          })
      ).to.be.revertedWith(
        'AtlanteansSale: You can summon no more than 19 Atlanteans at a time'
      );
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq('0');
    });

    it('should revert when public phase have already ended', async () => {
      // setup
      numAtlanteans = '1';
      await evmIncreaseTime(BLOCK_ONE_DAY);

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(user)
          ['publicSummon(uint256)'](numAtlanteans, {
            value: lastPrice.mul(numAtlanteans),
          })
      ).to.be.revertedWith('AtlanteansSale: Public sale has ended');
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq('0');
    });

    it('should mint when there is a left over supply from mintlist', async () => {
      // setup
      let [maxMintlistSupply] = await Promise.all([
        mockAtlanteansSale.maxMintlistSupply(),
      ]);
      await mockAtlanteansSale.setVariable(
        'numMintlistSold',
        maxMintlistSupply.sub(1)
      );
      await mockAtlanteansSale.setVariable(
        'numSold',
        BigNumber.from(2540).add(maxMintlistSupply.sub(1))
      );
      await mockAtlanteansSale.setVariable('lastPrice', parseEther('0.069'));

      await expect(
        mockAtlanteansSale.connect(user)['publicSummon(uint256)']('1', {
          value: parseEther('0.069'),
        })
      ).to.be.not.reverted;
      await expect(
        mockAtlanteansSale.connect(user)['publicSummon(uint256)']('1', {
          value: parseEther('0.069'),
        })
      ).to.be.revertedWith('AtlanteansSale: Sold out');
    });
  });

  describe('> mintlistSummon', () => {
    let userMerkleProof: BytesLike[];

    beforeEach(async () => {
      await evmIncreaseTime(BLOCK_ONE_DAY);

      userMerkleProof = MerkleTreeUtil.createMerkleProof(
        mintlistMerkleTree,
        user.address
      );
    });

    it('should mint when given valid merkle proof and valid $ETH', async () => {
      numAtlanteans = '2';
      mintlistPrice = await atlanteansSale.mintlistPrice();

      await expect(
        atlanteansSale
          .connect(user)
          ['mintlistSummon(bytes32[],uint256)'](
            userMerkleProof,
            numAtlanteans,
            {
              value: mintlistPrice.mul(numAtlanteans),
            }
          )
      ).to.be.not.reverted;
      expect(await atlanteans.balanceOf(user.address)).to.be.eq(numAtlanteans);
      expect(await getTreasuryBalance(atlanteansSale)).to.be.eq(
        mintlistPrice.mul(numAtlanteans)
      );
    });

    it('should mint when given valid merkle proof and valid wrapped $ETH', async () => {
      numAtlanteans = '2';
      mintlistPrice = await atlanteansSale.mintlistPrice();

      tx = await weth
        .connect(user)
        .mintTo(user.address, mintlistPrice.mul(numAtlanteans).mul(5));
      rc = await tx.wait();
      tx = await weth
        .connect(user)
        .approve(atlanteansSale.address, mintlistPrice.mul(numAtlanteans));
      rc = await tx.wait();

      tx = await atlanteansSale
        .connect(user)
        ['mintlistSummon(bytes32[],uint256,uint256)'](
          userMerkleProof,
          numAtlanteans,
          mintlistPrice.mul(numAtlanteans)
        );
      await tx.wait();

      expect(await atlanteans.balanceOf(user.address)).to.be.eq(numAtlanteans);
      expect(await weth.balanceOf(atlanteansSale.address)).to.be.eq(
        mintlistPrice.mul(numAtlanteans)
      );
    });

    it('should revert when user have already minted twice (2)', async () => {
      await mockAtlanteansSale.setVariable('mintlistMinted', {
        [user.address]: BigNumber.from(2),
      });

      await expect(
        mockAtlanteansSale
          .connect(user)
          ['mintlistSummon(bytes32[],uint256)'](
            userMerkleProof,
            numAtlanteans,
            {
              value: mintlistPrice.mul(numAtlanteans),
            }
          )
      ).to.be.revertedWith('AtlanteansSale: Already minted twice');
      expect(await atlanteans.balanceOf(user.address)).to.be.eq('0');
      expect(await getTreasuryBalance(atlanteansSale)).to.be.eq('0');
    });

    it('should revert when sale have sold out', async () => {
      await mockAtlanteansSale.setVariable('numSold', maxForSale);

      await expect(
        mockAtlanteansSale
          .connect(user)
          ['mintlistSummon(bytes32[],uint256)'](
            userMerkleProof,
            numAtlanteans,
            {
              value: mintlistPrice.mul(numAtlanteans),
            }
          )
      ).to.be.revertedWith('AtlanteansSale: Sold out');
      expect(await atlanteans.balanceOf(user.address)).to.be.eq('0');
      expect(await getTreasuryBalance(atlanteansSale)).to.be.eq('0');
    });

    it('should revert when mintlist phase has not started yet', async () => {
      await evmDecreaseTime(BLOCK_ONE_DAY);

      await expect(
        atlanteansSale
          .connect(user)
          ['mintlistSummon(bytes32[],uint256)'](
            userMerkleProof,
            numAtlanteans,
            {
              value: mintlistPrice.mul(numAtlanteans),
            }
          )
      ).to.be.revertedWith('AtlanteansSale: Mintlist phase not started');
      expect(await atlanteans.balanceOf(user.address)).to.be.eq('0');
      expect(await getTreasuryBalance(atlanteansSale)).to.be.eq('0');
    });

    it('should revert when the $ETH value sent is incorrect', async () => {
      await expect(
        atlanteansSale
          .connect(user)
          ['mintlistSummon(bytes32[],uint256)'](
            userMerkleProof,
            numAtlanteans,
            {
              value: parseEther(formatEther(mintlistPrice)).div(2),
            }
          )
      ).to.be.revertedWith('AtlanteansSale: Ether value incorrect');
      expect(await atlanteans.balanceOf(user.address)).to.be.eq('0');
      expect(await getTreasuryBalance(atlanteansSale)).to.be.eq('0');
    });

    it('should revert when the merkle proof is invalid', async () => {
      numAtlanteans = '2';
      await expect(
        atlanteansSale
          .connect(user)
          ['mintlistSummon(bytes32[],uint256)']([], numAtlanteans, {
            value: mintlistPrice.mul(numAtlanteans),
          })
      ).to.be.revertedWith('AtlanteansSale: Invalid proof');
      expect(await atlanteans.balanceOf(user.address)).to.be.eq('0');
      expect(await getTreasuryBalance(atlanteansSale)).to.be.eq('0');
    });
  });

  describe('> claimSummon', () => {
    let quantity: BigNumberish;
    let scrollsAmount: BigNumberish;

    async function generateSignature(
      recipient: string,
      quantity: BigNumberish,
      remainingClaimable: BigNumberish
    ) {
      if (!isAddress(recipient)) return constants.HashZero;
      const hash = ethers.utils.solidityKeccak256(
        [
          'address', // recipient
          'uint256', // scrollsAmount
          'uint256', // quantity
          'uint256', // remainingClaimable
        ],
        [
          recipient,
          snapshotScrollHolders[recipient],
          quantity,
          remainingClaimable,
        ]
      );
      const signature = await server.signMessage(ethers.utils.arrayify(hash));
      return signature;
    }

    async function getRemainingClaimable(
      contract: AtlanteansSale | MockContract<AtlanteansSale>,
      recipient: string
    ) {
      const faRegistered = await contract.faRegistered(recipient);
      const remainingClaimable = await contract.faToRemainingClaim(recipient);

      return !faRegistered
        ? BigNumber.from(snapshotScrollHolders[recipient])
        : remainingClaimable;
    }

    beforeEach(async () => {
      quantity = '1';
      await evmIncreaseTime(BLOCK_ONE_DAY * 4);
    });

    it('should mint when given encoded arguments', async () => {
      // setup
      const remainingClaimable = await getRemainingClaimable(
        mockAtlanteansSale,
        user.address
      );
      const signature = await generateSignature(
        user.address,
        quantity,
        remainingClaimable
      );

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(user)
          .claimSummon(signature, snapshotScrollHolders[user.address], quantity)
      ).to.be.not.reverted;
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq('1');
      expect(await mockAtlanteansSale.numClaimed()).to.be.eq('1');
    });

    it('should mint when there is a remaining claimable characters', async () => {
      // setup
      quantity = '20';
      await mockAtlanteansSale.setVariable('faToRemainingClaim', {
        [user.address]: '20',
      });
      let remainingClaimable = await getRemainingClaimable(
        mockAtlanteansSale,
        user.address
      );
      let signature = await generateSignature(
        user.address,
        quantity,
        remainingClaimable
      );
      console.log('signature #1', signature);

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(user)
          .claimSummon(signature, snapshotScrollHolders[user.address], quantity)
      ).to.be.not.reverted;
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq(quantity);
      expect(await mockAtlanteansSale.numClaimed()).to.be.eq(quantity);

      // generate new signature
      remainingClaimable = await getRemainingClaimable(
        mockAtlanteansSale,
        user.address
      );
      signature = await generateSignature(
        user.address,
        quantity,
        remainingClaimable
      );
      console.log('signature #2', signature);

      await expect(
        mockAtlanteansSale
          .connect(user)
          .claimSummon(signature, snapshotScrollHolders[user.address], quantity)
      ).to.be.revertedWith('AtlanteansSale: Not enough remaining for claim.');
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq(quantity);
      expect(await mockAtlanteansSale.numClaimed()).to.be.eq(quantity);
    });

    it('should revert when the max allocation for free claiming runs out', async () => {
      // setup
      let remainingClaimable = await getRemainingClaimable(
        mockAtlanteansSale,
        user.address
      );
      let signature = await generateSignature(
        user.address,
        quantity,
        remainingClaimable
      );
      await mockAtlanteansSale.setVariable('numClaimed', maxForClaim);

      await expect(
        mockAtlanteansSale
          .connect(user)
          .claimSummon(signature, snapshotScrollHolders[user.address], quantity)
      ).to.be.revertedWith('AtlanteansSale: No more claims');
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq('0');
      expect(await mockAtlanteansSale.numClaimed()).to.be.eq(maxForClaim);
    });

    it('should revert when the free claiming phase has not started yet', async () => {
      // setup
      let remainingClaimable = await getRemainingClaimable(
        mockAtlanteansSale,
        user.address
      );
      let signature = await generateSignature(
        user.address,
        quantity,
        remainingClaimable
      );
      await evmDecreaseTime(BLOCK_ONE_DAY * 4);

      await expect(
        mockAtlanteansSale
          .connect(user)
          .claimSummon(signature, snapshotScrollHolders[user.address], quantity)
      ).to.be.revertedWith('AtlanteansSale: Claim phase not started');
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq('0');
      expect(await mockAtlanteansSale.numClaimed()).to.be.eq('0');
    });

    it('should revert when caller has already claimed all remaining', async () => {
      // setup
      await mockAtlanteansSale.setVariable('faRegistered', {
        [user.address]: true,
      });
      await mockAtlanteansSale.setVariable('faToRemainingClaim', {
        [user.address]: '0',
      });
      let remainingClaimable = await getRemainingClaimable(
        mockAtlanteansSale,
        user.address
      );
      let signature = await generateSignature(
        user.address,
        quantity,
        remainingClaimable
      );

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(user)
          .claimSummon(signature, snapshotScrollHolders[user.address], quantity)
      ).to.be.revertedWith('AtlanteansSale: Not enough remaining for claim.');
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq('0');
    });

    it('should revert when signature is invalid', async () => {
      // setup
      const invalidSignature = await user.signMessage('whatever message');

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(user)
          .claimSummon(
            invalidSignature,
            snapshotScrollHolders[user.address],
            quantity
          )
      ).to.be.revertedWith('AtlanteansSale: Invalid signature.');
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq('0');
      expect(await mockAtlanteansSale.numClaimed()).to.be.eq('0');
    });

    it('should revert when encodedArgs is not correct structure', async () => {
      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(user)
          .claimSummon(
            ethers.utils.defaultAbiCoder.encode(
              ['bytes', 'uint256'],
              ['0x', quantity]
            ),
            snapshotScrollHolders[user.address],
            quantity
          )
      ).to.be.revertedWith('ECDSA: invalid signature length');
      expect(await mockAtlanteans.balanceOf(user.address)).to.be.eq('0');
      expect(await mockAtlanteansSale.numClaimed()).to.be.eq('0');
    });
  });

  describe('> teamSummon', () => {
    it('should mint 32', async () => {
      // setup
      numAtlanteans = '5000';

      // action & assert
      await expect(
        atlanteansSale.connect(admin).teamSummon(user.address, numAtlanteans)
      ).to.be.not.reverted;
      expect(await atlanteans.balanceOf(user.address)).to.be.eq(numAtlanteans);
    });

    it('should mint when caller is owner', async () => {
      // setup
      numAtlanteans = '19';

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(admin)
          .teamSummon(user.address, numAtlanteans)
      ).to.be.not.reverted;
    });

    it('should not revert when numAtlanteans exceeds 19', async () => {
      // setup
      numAtlanteans = '20';

      // action & assert
      await expect(
        mockAtlanteansSale
          .connect(admin)
          .teamSummon(user.address, numAtlanteans)
      ).to.be.not.revertedWith('Atlanteans: Can only mint max of 19');
    });

    it('should revert when caller is not owner', async () => {
      // setup
      numAtlanteans = '20';

      // action & assert
      await expect(
        mockAtlanteansSale.connect(user).teamSummon(user.address, numAtlanteans)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('> refundOwed', () => {
    it('should get the correct refundOwed amount', async () => {
      const totalDaAmountPaid = [
        parseEther('0.142'),
        parseEther('0.132'),
        parseEther('0.122'),
        parseEther('0.112'),
        parseEther('0.102'),

        parseEther('0.092'),
        parseEther('0.082'),
        parseEther('0.072'),
        parseEther('0.069'),
      ].reduce((a, b) => a.add(b));
      console.log('totalDaAmountPaid', formatEther(totalDaAmountPaid));

      await mockAtlanteansSale.setVariable('lastPrice', parseEther('0.069'));
      await mockAtlanteansSale.setVariable('daNumMinted', {
        [user.address]: BigNumber.from('9'),
      });
      await mockAtlanteansSale.setVariable('daAmountPaid', {
        [user.address]: parseEther('0.925'),
      });
      await mockAtlanteansSale.setVariable('daAmountRefunded', {
        [user.address]: parseEther('0'),
      });

      const refundOwed = await mockAtlanteansSale.refundOwed(user.address);
      console.log('refundOwed', formatEther(refundOwed));
    });
  });

  describe('> selfRefund', () => {
    it('should get refund when it sells out at 0.122 $ETH', async () => {
      // constants
      const quantity = 1;

      // mock
      await mockAtlanteansSale.setVariable(
        'selfRefundsStartTime',
        numberToTimestamp(BLOCK_ONE_DAY * 3)
      );
      await mockAtlanteansSale.setVariable('daNumMinted', {
        [user.address]: BigNumber.from(quantity),
      });
      await mockAtlanteansSale.setVariable('daAmountPaid', {
        [user.address]: parseEther('0.142').mul(quantity),
      });
      await mockAtlanteansSale.setVariable('lastPrice', parseEther('0.122'));
      await mockAtlanteansSale.setVariable('daAmountRefunded', {
        [user.address]: parseEther('0'),
      });
      // await evmIncreaseTime(BLOCK_ONE_DAY * 3);

      // before action query
      let [
        selfRefundsStartTime,
        selfRefundsStarted,
        lastPrice,
        userDaNumMinted,
        userDaAmountRefunded,
        userRefundOwed,
      ] = await Promise.all([
        mockAtlanteansSale.selfRefundsStartTime(),
        mockAtlanteansSale.selfRefundsStarted(),
        mockAtlanteansSale.lastPrice(),
        mockAtlanteansSale.daNumMinted(user.address),
        mockAtlanteansSale.daAmountRefunded(user.address),
        mockAtlanteansSale.refundOwed(user.address),
      ]);
      console.log('1) before action', {
        selfRefundsStartTime,
        selfRefundsStarted,
        userDaNumMinted,
        lastPrice: formatEther(lastPrice),
        userDaAmountRefunded: formatEther(userDaAmountRefunded),
        userRefundOwed: formatEther(userRefundOwed),
      });

      await user.sendTransaction({
        value: parseEther('999'),
        to: mockAtlanteansSale.address,
        gasLimit: 1_000_000,
      });
      let userBal = await user.getBalance();
      console.log('userBal before action', formatEther(userBal));
      console.log(
        'userBal + add userRefundOwed',
        formatEther(userBal.add(userRefundOwed))
      );

      // action
      mockAtlanteansSale = mockAtlanteansSale.connect(user);
      tx = await mockAtlanteansSale.selfRefund({
        gasLimit: 1_000_000,
      });
      rc = await tx.wait();

      // after action query
      [
        selfRefundsStartTime,
        selfRefundsStarted,
        lastPrice,
        userDaNumMinted,
        userDaAmountRefunded,
        userRefundOwed,
      ] = await Promise.all([
        mockAtlanteansSale.selfRefundsStartTime(),
        mockAtlanteansSale.selfRefundsStarted(),
        mockAtlanteansSale.lastPrice(),
        mockAtlanteansSale.daNumMinted(user.address),
        mockAtlanteansSale.daAmountRefunded(user.address),
        mockAtlanteansSale.refundOwed(user.address),
      ]);
      console.log('2) after action', {
        selfRefundsStartTime,
        selfRefundsStarted,
        userDaNumMinted,
        lastPrice: formatEther(lastPrice),
        userDaAmountRefunded: formatEther(userDaAmountRefunded),
        userRefundOwed: formatEther(userRefundOwed),
      });

      userBal = await user.getBalance();
      console.log('userBal after action', formatEther(userBal));
    });

    it('should get refund when it sells out at 0.0069 $ETH', async () => {
      // constants
      const quantity = 5;

      // mock
      await mockAtlanteansSale.setVariable(
        'selfRefundsStartTime',
        numberToTimestamp(BLOCK_ONE_DAY * 3)
      );
      await mockAtlanteansSale.setVariable('daNumMinted', {
        [user.address]: BigNumber.from(quantity),
      });
      await mockAtlanteansSale.setVariable('daAmountPaid', {
        [user.address]: parseEther('0.142').mul(quantity),
      });
      await mockAtlanteansSale.setVariable('lastPrice', parseEther('0.0069'));
      await mockAtlanteansSale.setVariable('daAmountRefunded', {
        [user.address]: parseEther('0'),
      });
      // await evmIncreaseTime(BLOCK_ONE_DAY * 3);

      // before action query
      let [
        selfRefundsStartTime,
        selfRefundsStarted,
        lastPrice,
        userDaNumMinted,
        userDaAmountRefunded,
        userRefundOwed,
      ] = await Promise.all([
        mockAtlanteansSale.selfRefundsStartTime(),
        mockAtlanteansSale.selfRefundsStarted(),
        mockAtlanteansSale.lastPrice(),
        mockAtlanteansSale.daNumMinted(user.address),
        mockAtlanteansSale.daAmountRefunded(user.address),
        mockAtlanteansSale.refundOwed(user.address),
      ]);
      console.log('1) before action', {
        selfRefundsStartTime,
        selfRefundsStarted,
        userDaNumMinted,
        lastPrice: formatEther(lastPrice),
        userDaAmountRefunded: formatEther(userDaAmountRefunded),
        userRefundOwed: formatEther(userRefundOwed),
      });

      await user.sendTransaction({
        value: parseEther('999.5'),
        to: mockAtlanteansSale.address,
        gasLimit: 1_000_000,
      });
      let userBal = await user.getBalance();
      console.log('userBal before action', formatEther(userBal));
      console.log(
        'userBal + add userRefundOwed',
        formatEther(userBal.add(userRefundOwed))
      );

      // action
      mockAtlanteansSale = mockAtlanteansSale.connect(user);
      tx = await mockAtlanteansSale.selfRefund({
        gasLimit: 1_000_000,
      });
      rc = await tx.wait();

      // after action query
      [
        selfRefundsStartTime,
        selfRefundsStarted,
        lastPrice,
        userDaNumMinted,
        userDaAmountRefunded,
        userRefundOwed,
      ] = await Promise.all([
        mockAtlanteansSale.selfRefundsStartTime(),
        mockAtlanteansSale.selfRefundsStarted(),
        mockAtlanteansSale.lastPrice(),
        mockAtlanteansSale.daNumMinted(user.address),
        mockAtlanteansSale.daAmountRefunded(user.address),
        mockAtlanteansSale.refundOwed(user.address),
      ]);
      console.log('2) after action', {
        selfRefundsStartTime,
        selfRefundsStarted,
        userDaNumMinted,
        lastPrice: formatEther(lastPrice),
        userDaAmountRefunded: formatEther(userDaAmountRefunded),
        userRefundOwed: formatEther(userRefundOwed),
      });

      userBal = await user.getBalance();
      console.log('userBal after action', formatEther(userBal));
    });
  });

  describe('> issueRefunds', () => {
    it('should issue refunds to minters', async () => {
      // empty balances
      const bal = parseEther('998');
      const to = mockAtlanteansSale.address;

      await user.sendTransaction({
        to,
        value: bal,
      });
      await user2.sendTransaction({
        to,
        value: bal,
      });
      await user3.sendTransaction({
        to,
        value: bal,
      });
      await user4.sendTransaction({
        to,
        value: bal,
      });
      await user5.sendTransaction({
        to,
        value: bal,
      });

      // mocking
      await mockAtlanteansSale.setVariable('daMinters', [
        user.address,
        user2.address,
        user3.address,
        user4.address,
        user5.address,
      ]);
      await mockAtlanteansSale.setVariable('daNumMinted', {
        [user.address]: BigNumber.from('1'),
        [user2.address]: BigNumber.from('1'),
        [user3.address]: BigNumber.from('1'),
        [user4.address]: BigNumber.from('1'),
        [user5.address]: BigNumber.from('1'),
      });
      await mockAtlanteansSale.setVariable('daAmountRefunded', {
        [user.address]: BigNumber.from('0'),
        [user2.address]: BigNumber.from('0'),
        [user3.address]: BigNumber.from('0'),
        [user4.address]: BigNumber.from('0'),
        [user5.address]: BigNumber.from('0'),
      });
      const amountPaid = parseEther('0.142');
      await mockAtlanteansSale.setVariable('daAmountPaid', {
        [user.address]: amountPaid,
        [user2.address]: amountPaid,
        [user3.address]: amountPaid,
        [user4.address]: amountPaid,
        [user5.address]: amountPaid,
      });
      await mockAtlanteansSale.setVariable('lastPrice', parseEther('0.0069'));

      // before action query
      let [userBal, user2Bal, user3Bal, user4Bal, user5Bal] = await Promise.all(
        [
          user.getBalance(),
          user2.getBalance(),
          user3.getBalance(),
          user4.getBalance(),
          user5.getBalance(),
        ]
      );
      console.log('issueRefunds | before action query', {
        userBal: formatEther(userBal),
        user2Bal: formatEther(user2Bal),
        user3Bal: formatEther(user3Bal),
        user4Bal: formatEther(user4Bal),
        user5Bal: formatEther(user5Bal),
      });

      // action
      await expect(mockAtlanteansSale.connect(admin).issueRefunds('0', '4')).to
        .be.not.reverted;

      // after action query
      [userBal, user2Bal, user3Bal, user4Bal, user5Bal] = await Promise.all([
        user.getBalance(),
        user2.getBalance(),
        user3.getBalance(),
        user4.getBalance(),
        user5.getBalance(),
      ]);
      console.log('issueRefunds | after action query', {
        userBal: formatEther(userBal),
        user2Bal: formatEther(user2Bal),
        user3Bal: formatEther(user3Bal),
        user4Bal: formatEther(user4Bal),
        user5Bal: formatEther(user5Bal),
      });
    });
  });

  describe('> refundAddress', () => {
    it('should refund to user that have refundOwed amount', async () => {
      // empty balances
      const bal = parseEther('998');
      const to = mockAtlanteansSale.address;

      await user.sendTransaction({
        to,
        value: bal,
      });
      await user2.sendTransaction({
        to,
        value: bal,
      });
      await user3.sendTransaction({
        to,
        value: bal,
      });
      await user4.sendTransaction({
        to,
        value: bal,
      });
      await user5.sendTransaction({
        to,
        value: bal,
      });

      // mocking
      await mockAtlanteansSale.setVariable('daNumMinted', {
        [user.address]: BigNumber.from('1'),
        [user2.address]: BigNumber.from('1'),
        [user3.address]: BigNumber.from('1'),
        [user4.address]: BigNumber.from('1'),
        [user5.address]: BigNumber.from('1'),
      });
      await mockAtlanteansSale.setVariable('daAmountRefunded', {
        [user.address]: BigNumber.from('0'),
        [user2.address]: BigNumber.from('0'),
        [user3.address]: BigNumber.from('0'),
        [user4.address]: BigNumber.from('0'),
        [user5.address]: BigNumber.from('0'),
      });
      const amountPaid = parseEther('0.142');
      await mockAtlanteansSale.setVariable('daAmountPaid', {
        [user.address]: amountPaid,
        [user2.address]: amountPaid,
        [user3.address]: amountPaid,
        [user4.address]: amountPaid,
        [user5.address]: amountPaid,
      });
      await mockAtlanteansSale.setVariable('lastPrice', parseEther('0.0069'));

      // before action query
      let [userBal, user2Bal, user3Bal, user4Bal, user5Bal] = await Promise.all(
        [
          user.getBalance(),
          user2.getBalance(),
          user3.getBalance(),
          user4.getBalance(),
          user5.getBalance(),
        ]
      );
      console.log('refundAddress | before action query', {
        userBal: formatEther(userBal),
        user2Bal: formatEther(user2Bal),
        user3Bal: formatEther(user3Bal),
        user4Bal: formatEther(user4Bal),
        user5Bal: formatEther(user5Bal),
      });

      // action
      await expect(
        mockAtlanteansSale.connect(admin).refundAddress(user.address)
      ).to.be.not.reverted;
      await expect(
        mockAtlanteansSale.connect(user2).refundAddress(user2.address)
      ).to.be.reverted;

      // after action query
      [userBal, user2Bal, user3Bal, user4Bal, user5Bal] = await Promise.all([
        user.getBalance(),
        user2.getBalance(),
        user3.getBalance(),
        user4.getBalance(),
        user5.getBalance(),
      ]);
      console.log('refundAddress | after action query', {
        userBal: formatEther(userBal),
        user2Bal: formatEther(user2Bal),
        user3Bal: formatEther(user3Bal),
        user4Bal: formatEther(user4Bal),
        user5Bal: formatEther(user5Bal),
      });
    });
  });

  describe('> withdrawAll', () => {
    it('should withdraw all $ETH and all $WETH to treasury', async () => {
      // setup
      const bal = parseEther('999');
      const to = mockAtlanteansSale.address;
      await user.sendTransaction({
        to,
        value: bal,
      });
      tx = await weth.mintTo(mockAtlanteansSale.address, bal);
      rc = await tx.wait();

      // query
      let saleBal = await mockAtlanteansSale.provider.getBalance(
        mockAtlanteansSale.address
      );

      // action & assert
      expect(await weth.balanceOf(mockAtlanteansSale.address)).to.be.eq(bal);
      await expect(mockAtlanteansSale.connect(admin).withdrawAll()).to.be.not
        .reverted;
      expect(
        await mockAtlanteansSale.provider.getBalance(treasury.address)
      ).to.be.eq(saleBal);
      expect(await weth.balanceOf(mockAtlanteansSale.address)).to.be.eq(
        parseEther('0')
      );
      expect(await weth.balanceOf(treasury.address)).to.be.eq(bal);
    });
  });

  describe('> playground', () => {
    it('should sum total supply', async () => {
      const supply = {
        maxMintlistSupply: BigNumber.from(1999),
        maxDaSupply: BigNumber.from(2540),
        maxForSale: BigNumber.from(4539),
        maxForClaim: BigNumber.from(1442),
        maxTreasurySupply: BigNumber.from(469),
      };
      const sum = supply.maxForSale
        .add(supply.maxForClaim)
        .add(supply.maxTreasurySupply);
      console.log('sum', sum);

      expect(supply.maxForSale).to.be.eq(
        supply.maxDaSupply.add(supply.maxMintlistSupply)
      );
      expect(sum).to.be.eq(BigNumber.from(6450));
    });

    it('timestamp', async () => {
      const now = await TimeUtil.now(ethers.provider);
      console.log(now);
      console.log(new Date(now));
      console.log(Math.abs(now / 1000));
      console.log(Math.abs(now / 1000) * 1000);
      console.log(new Date(Math.abs(now / 1000) * 1000));

      console.log('march 23rd gmt', 1679504400);
      console.log('march 23rd gmt', new Date(1679504400));

      const daStartTime = await mockAtlanteansSale.daStartTime();
      console.log(daStartTime.toNumber());
      console.log(new Date(daStartTime.toNumber()));
    });

    it('should calculate remaining for sale', async () => {
      let [numSold, maxForSale] = await Promise.all([
        mockAtlanteansSale.numSold(),
        mockAtlanteansSale.maxForSale(),
      ]);
      console.log({ numSold, maxForSale });

      await mockAtlanteansSale.setVariable('numSold', maxForSale.sub(50));

      [numSold, maxForSale] = await Promise.all([
        mockAtlanteansSale.numSold(),
        mockAtlanteansSale.maxForSale(),
      ]);
      console.log({ numSold, maxForSale });
      console.log('maxForSale.sub(numSold)', maxForSale.sub(numSold));
    });

    it('should get merkle root', async () => {
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
      console.log('mintlistMerkleRoot', mintlistMerkleRoot);
    });
  });
});
