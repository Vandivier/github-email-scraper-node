// ref: https://github.com/Vandivier/data-science-practice/blob/master/js/udacity-study/legacy-puppeteer/reboot.js
// TODO: extract this into a library. Most of it is boilerplate.
const EOL = require('os').EOL;

const scrapeUtils = require('./scrape-utils');

const oSourceMap = {
  // TODO: don't explicitly pass oSourceMap and just read from input.csv
  sLocationMatched: 0,
};

const oTitleLine = {
  sEmail: 'Email Address',
  sGithubUrl: 'Entry ID',
  sGithubUsername: 'Entry ID',
  sLocationMatched: 'Location',
  sName: 'Name',
  sScrapedUrl: 'Scraped Url',
};

sUniqueKey = 'sEmail';

function fsGetUrlToScrapeByInputRecord(oInputRecord) {
  return (
    oInputRecord.sLocationMatched &&
    'https://github.com/search?utf8=%E2%9C%93&q=location%3A%22' + oInputRecord.sLocationMatched + '%22&type=Users&ref=advsearch&l=&l='
  );
}

fEvaluate = async oInputRecord => {
  console.log('scraping: ' + window.location.href);
  await new Promise(resolve => setTimeout(resolve, 500));
  return fpInnerScrapeRecord(oInputRecord).catch(function(err) {
    console.log('fpInnerScrapeRecord err: ', err);
    return err;
  });

  async function fpInnerScrapeRecord(oInputRecord) {
    const arrpoOutputRow = [...document.querySelectorAll('.user-list-item [href*="@"]')].map($email => {
      const $user = $email.parentElement.parentElement.parentElement;

      return {
        sEmail: $email.textContent,
        sGithubUrl: $user.querySelector('a').href,
        sGithubUsername: $user.querySelector('a').text,
        sLocationMatched: oInputRecord.sLocationMatched,
        sName: $user.querySelector('div.d-block').textContent,
        sScrapedUrl: oInputRecord.sScrapedUrl,
      };
    });

    return Promise.resolve(arrpoOutputRow);
  }
};

async function main() {
  if (process.env.DEBUG) {
    debugger;
  }
  scrapeUtils.exec({ fEvaluate, fsGetUrlToScrapeByInputRecord, oSourceMap, oTitleLine, sUniqueKey });
}

main();
