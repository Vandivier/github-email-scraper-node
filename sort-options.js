module.exports = [
  function fsGetUrlToScrapeBestMatch(oInputRecord) {
    // sScrapedUrl will be already provided if it's coming recursively
    return (
      oInputRecord.sScrapedUrl ||
      (oInputRecord.sLocationMatched &&
        'https://github.com/search?utf8=%E2%9C%93&q=location%3A%22' + oInputRecord.sLocationMatched + '%22&type=Users&ref=advsearch&l=&l=')
    );
  },
  function fsGetUrlToScrapeFewestFollowers(oInputRecord) {
    // sScrapedUrl will be already provided if it's coming recursively
    return (
      oInputRecord.sScrapedUrl ||
      (oInputRecord.sLocationMatched &&
        'https://github.com/search?l=&o=asc&q=location%3A%22' + oInputRecord.sLocationMatched + '%22&s=followers&type=Users')
    );
  },
  function fsGetUrlToScrapeLeastRecentlyJoined(oInputRecord) {
    // sScrapedUrl will be already provided if it's coming recursively
    return (
      oInputRecord.sScrapedUrl ||
      (oInputRecord.sLocationMatched &&
        'https://github.com/search?l=&o=asc&q=location%3A%22' + oInputRecord.sLocationMatched + '%22&s=joined&type=Users')
    );
  },
  function fsGetUrlToScrapeLeastRepositories(oInputRecord) {
    // sScrapedUrl will be already provided if it's coming recursively
    return (
      oInputRecord.sScrapedUrl ||
      (oInputRecord.sLocationMatched &&
        'https://github.com/search?l=&o=asc&q=location%3A%22' + oInputRecord.sLocationMatched + '%22&s=repositories&type=Users')
    );
  },
  function fsGetUrlToScrapeMostFollowers(oInputRecord) {
    // sScrapedUrl will be already provided if it's coming recursively
    return (
      oInputRecord.sScrapedUrl ||
      (oInputRecord.sLocationMatched &&
        'https://github.com/search?l=&o=desc&q=location%3A%22' + oInputRecord.sLocationMatched + '%22&s=followers&type=Users')
    );
  },
  function fsGetUrlToScrapeMostRecentlyJoined(oInputRecord) {
    // sScrapedUrl will be already provided if it's coming recursively
    return (
      oInputRecord.sScrapedUrl ||
      (oInputRecord.sLocationMatched &&
        'https://github.com/search?l=&o=desc&q=location%3A%22' + oInputRecord.sLocationMatched + '%22&s=joined&type=Users')
    );
  },
  function fsGetUrlToScrapeMostRepositories(oInputRecord) {
    // sScrapedUrl will be already provided if it's coming recursively
    return (
      oInputRecord.sScrapedUrl ||
      (oInputRecord.sLocationMatched &&
        'https://github.com/search?l=&o=desc&q=location%3A%22' + oInputRecord.sLocationMatched + '%22&s=repositories&type=Users')
    );
  },
];
