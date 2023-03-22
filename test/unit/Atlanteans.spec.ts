import { ContractReceipt, ContractTransaction, Wallet } from 'ethers';
import { Atlanteans, Atlanteans__factory } from '../../typechained';
import { MockContract, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';

describe('Spec: Atlanteans', () => {
  // contracts
  let atlanteans: Atlanteans;
  let mockAtlanteans: MockContract<Atlanteans>;

  // signers
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let treasury: Wallet;

  beforeEach(async () => {
    [admin, user] = await ethers.getSigners();
    treasury = Wallet.createRandom();

    // atlanteans
    const Atlanteans = await ethers.getContractFactory('Atlanteans');
    atlanteans = <Atlanteans>await upgrades.deployProxy(Atlanteans, [
      treasury.address, // treasuryAddr
      'defaultBaseURI/', // baseURI
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
    );
  });

  describe('> revealCharacters', () => {
    it('should set reveal to true', async () => {
      await expect(mockAtlanteans.mintTo(user.address, '1')).to.be.not.reverted;

      // before reveal should render mystery URI
      expect(await mockAtlanteans.reveal()).to.be.eq(false);
      expect(await mockAtlanteans.tokenURI('1')).to.be.eq('defaultBaseURI/');
      expect(await mockAtlanteans.baseURI()).to.be.eq('defaultBaseURI/');

      // character reveal
      await expect(
        mockAtlanteans.connect(admin).revealCharacters('ipfs://watosi/')
      ).to.be.not.reverted;
      expect(await mockAtlanteans.reveal()).to.be.eq(true);

      expect(await mockAtlanteans.tokenURI('1')).to.be.eq(
        'ipfs://watosi/1.json'
      );
    });
  });
});
