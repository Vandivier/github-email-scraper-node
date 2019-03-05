const mBestMatch = require('./sort-options/best-match');
const mFewestFollowers = require('./sort-options/fewest-followers');
const mLeastRepositories = require('./sort-options/least-repositories');
const mLeastRecentlyJoined = require('./sort-options/least-recently-joined');
const mMostFollowers = require('./sort-options/most-followers');
const mMostRecentlyJoined = require('./sort-options/most-recently-joined');
const mMostRepositories = require('./sort-options/most-repositories');

async function main() {
  await mBestMatch();

  if (!process.env.DEBUG) {
    await mFewestFollowers();
    await mLeastRepositories();
    await mLeastRecentlyJoined();
    await mMostFollowers();
    await mMostRecentlyJoined();
    await mMostRepositories();
  }
}

main();
