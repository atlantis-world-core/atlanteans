import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { NFTStorage, File } from 'nft.storage';
import { faker } from '@faker-js/faker';
import { task } from 'hardhat/config';
import { join } from 'path';

task('atlanteans:generate-metadata', 'Generate a random fake 7,777 metadata').setAction(async () => {
  const path = join(__dirname, '..', 'metadata');
  if (!existsSync(path)) {
    mkdirSync(path);
  }

  const storage = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY ?? '' });

  const atlanteans = Array.from({ length: 7777 }).map((_, index) => {
    return {
      name: `Atlantean #${index + 1}`,
      describe: faker.lorem.paragraph(),
      image: 'https://pbs.twimg.com/profile_images/1575524871035142146/RrTowuiK_400x400.jpg',
      attributes: [],
    };
  });
  writeFileSync(join(path, '7777.json'), JSON.stringify(atlanteans, null, 2), 'utf-8');

  // storage.store()
  const cid = await storage.storeDirectory(atlanteans.map((metadata, index) => new File([JSON.stringify(metadata)], `${index}.json`)));
  console.log('NFT.Storage CID:', cid);
});
