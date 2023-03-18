import { NFTStorage, File } from 'nft.storage';
import { faker } from '@faker-js/faker';
import { task } from 'hardhat/config';

task('atlanteans:upload-mystery', 'Upload mystery metadata for unrevealed Atlantean characters').setAction(async () => {
  const storage = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY ?? '' });
  const metadata = {
    name: `Hidden Atlantean`,
    description: faker.lorem.paragraph(),
    image: 'https://pbs.twimg.com/profile_images/1575524871035142146/RrTowuiK_400x400.jpg',
    attributes: [],
  };

  const cid = await storage.storeDirectory([new File([JSON.stringify(metadata, null, 2)], `mystery.json`)]);
  console.log('NFT.Storage CID:', cid);
});
