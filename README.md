# Atlanteans Collection

## Coverage

`npx hardhat coverage`

## Links

- **Website** : https://atlantis.world
- **Twitter** : https://twitter.com/atlantis0x
- **Discord** : https://discord.gg/atlantisworld

## Contact us 📝

Atlanteans! If you have any questions, please contact us!

#### Carlo Miguel

- **Twitter** : https://twitter.com/carlomigueldy

#### Rachit

- **Twitter** : https://twitter.com/RacSri25

# Introduction

Atlanteans is an ERC721A token. It will be minted in four phases:

Phase 1: Allowlist sale for mintlist merkletree, 2 per account at 0.05 ETH

Phase 2: True, last-price dutch auction phase (with refunds above lowest bid)

Phase 3: If any remain, there will be a public phase at dutch auction lastPrice

Phase 4: Free claim for Founding Atlanteans claimslist, 1 scroll = 1 atlantean

Details below.

## Core Contracts

There are two main contracts:

| Name                 | LOC | Purpose             |
| -------------------- | --- | ------------------- |
| `Atlanteans.sol`     | 82  | The ERC721A token   |
| `AtlanteansSale.sol` | 321 | The minter contract |

### Phases

#### Phase 1: Mintlist Phase

The first phase of the Atlanteans sale will be for mintlist wallets only.

The mintlist phase will begin on Wednesday March 22nd at 10am PST.

There will be approximately 2,000 Atlanteans available in this phase.

Everyone on the mintlist will have 24 hours to mint two Atlanteans.

The price of the Atlanteans will be 0.05 $ETH.

#### Phase 2: Last-price Dutch Auction Phase

The sceond phase of Atlanteans will be a true, last-price Dutch Auction. Everyone pays the same price.

The auction will begin on Thursday March 23rd at 10am PST.

There will be approximately 2,540 Atlanteans available in this phase.

The mint will start at 0.1420 ETH and drop by 0.0031 ETH every 1 hour until it reaches 0.069 ETH.

When this phase ends, refunds will be sent for whatever was paid above the final price.

That is, the final Atlantean sold sets the price for everyone.

#### Phase 3: Public Phase

The third phase of the sale will be a public sale for all remaining Atlanteans that were not sold in the mintlist sale, if any.

The third phase begins Friday March 24th at 10am PST.

The price will be the price of the last Atlantean sold during the Dutch auction.

Reveal will happen at the end of the Public Phase.

#### Phase 4: Claimslist Phase

After the Dutch Auction Phase, accounts on the claimslist will be able to mint Atlanteans the same amount of Scrolls held on the snapshot taken on March 17 per account.

The claimlist phase lasts for 3 months.

#### Supply Breakdown

- **Total Supply: 6789**

Sales:

- Phase 1 Holders & Allowlist (`mintlistSummon`): ~2,000
- Phase 2 Dutch Auction (`bidSummon`): 2,540
- Phase 3 Public sale (`publicSummon`): Remaining, if any

Claims:

- Founding Atlanteans (`claimSummon`): ~1,781

> Numbers marked with ~ are approximate.

# Architecture

## `AtlanteansSale.sol`

The minter allows minting via 5 different functions:

- `mintlistSummon` - buying in Phase 1 Mintlist Phase
- `bidSummon` - buying via the Phase 2 Dutch Auction
- `publicSummon` - buying in the Phase 3 Public Phase
- `claimSummon` - claim during Phase 4 Claimslist phase
- `teamSummon` - mint anytime

Here's a timeline of when the various methods can be called:

    Timeline:

    mintlistSummon  : |------------|
    bidSummon       :              |------------|
    publicSummon    :                           |------------|
    claimSummon     :                           |------------|-----------|------------|
    teamSummon      : |---------------------------------------------------------------|

### Configuration

The Dutch Auction needs to be configured with the proper phase times. Typically this will be done using `setPhaseTimes` & on contract deployment.

## Ownership & Governance

Some functions of the protocol require admin rights (`onlyOwner`). The keys for this owner contract are controlled by Atlantis World Core team.

## Dutch Auction Pricing

The pricing starts at 0.1420 ETH and ends at 0.069 and descends by 0.0031 every 1 hour. All of those parameters are configurable (but unlikely to be changed).

However, they are configurable because if the site goes down (e.g. DDOS) we want to be able to pause the contract and change the timings such that we don't miss out on mints at a higher price because of the site being down.

## Dutch Auction Refunds

The plan is for the _owner_ to call `issueRefunds` after Phase 2 or Phase 3. We realize this will cost 10-20 ETH, but it feels safer than allowing self-refunds.

Currently the owner has the ability to withdraw all funds at any time. This should not break anything regarding the mint, but it presents a centralization risk to the minters in the case a refund is owed them.

That said, we'll configure a self-refund timer as a sort of protection for minters that if we aren't able to call `issueRefunds` for whatever reason, they can call themselves after the mint is complete.

# Areas of Concern

- mintlistSummon, bidSummon, publicSummon - These three functions have the other version that accepts WETH as payment method, is this already the ideal implementation or is there a much better implementation?
- claimSummon - We have a product requirement that, 1 Scroll NFT (Polygon Mainnet) = 1 Atlantean NFT (Mainnet) so will need to ensure that an account can claim not more than how much scrolls they hold. Is the implementation handled well in terms of security? Is there any chance any user could exploit this?

Here is the basis for these smart contracts: https://github.com/code-423n4/2022-05-runes, that were audited: https://code4rena.com/reports/2022-05-runes/

# Development & Testing

## Setup

- Install Node > 12
- Install Yarn
- `yarn install`

## Commands

- Compile
  `yarn compile`

- Run tests
  `yarn hardhat test test/unit/AtlanteansSale.spec.ts`

- Generate test coverage
  `yarn test:coverage`

- Generate a gas report
  `yarn test:gas`

See the `package.json` for a few other commands.

# License

MIT
