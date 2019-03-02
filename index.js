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

// TODO: get oInputRecord from sInputRow
scrapeUtils.exec({ fpScrapeInputRecord, fsGetUrlToScrapeByInputRecord, oSourceMap, oTitleLine, sUniqueKey });

function fsGetUrlToScrapeByInputRecord(oInputRow) {
  return 'https://github.com/search?utf8=%E2%9C%93&q=location%3A%22' + oInputRow.sLocationMatched + '%22&type=Users&ref=advsearch&l=&l=';
}

async function fpInnerScrapeRecord(oInputRow) {
  const arrpoOutputRow = [...document.querySelectorAll('.user-list-item [href*="@"]')].map($email => {
    const $user = $email.parentElement.parentElement.parentElement;

    return {
      sEmail: $email.textContent,
      sGithubUrl: $user.querySelector('a').href,
      sGithubUsername: $user.querySelector('a').text,
      sLocationMatched: oInputRow.sLocationMatched,
      sName: $user.querySelector('div.d-block').textContent,
      sScrapedUrl: oInputRow.sScrapedUrl,
    };
  });

  return Promise.resolve(arrpoOutputRow);
}

// not generalizable or temporally reliable in case of a site refactor
async function fpScrapeInputRecord(oInputRow) {
  const _page = await browser.newPage();
  let oCachedResult = oCache[oInputRow.sId];
  let oMergedRecord;
  let oScrapeResult;

  if (oCachedResult) {
    oScrapeResult = JSON.parse(JSON.stringify(oCachedResult));
  } else if (oInputRow.bUserExists !== false) {
    await _page.goto(oInputRow.sUrl, {
      timeout: 0,
    });

    await _page.content();
    _page.on('console', _fCleanLog); // ref: https://stackoverflow.com/a/47460782/3931488

    oScrapeResult = await _page
      .evaluate(_oInputRow => {
        console.log('scraping: ' + window.location.href);

        return _fpWait(500)
          .then(fpInnerScrapeRecord)
          .catch(function(err) {
            console.log('fpInnerScrapeRecord err: ', err);
            return err;
          });

        // larger time allows for slow site response
        function _fpWait(ms) {
          ms = ms || 10000;
          return new Promise(resolve => setTimeout(resolve, ms));
        }

        function _fsSafeTrim(s) {
          return s && s.replace(/[,"]/g, '').trim();
        }
      }, oInputRow)
      .catch(function(error) {
        if (error.message.includes('Execution context was destroyed')) {
          // context was destroyed by http redirect to 404 bc user doesn't exist.
          // well, that's the usual scenario. One can imagine a host of other causes too.
          return {
            bUserExists: false,
          };
        }

        console.log('unknown _page.evaluate err: ', error);

        return {
          bOtherError: true,
        };
      });

    await _page.close();
  }

  oMergedRecord = Object.assign(oInputRow, oScrapeResult);
  oCache[oInputRow.sId] = JSON.parse(JSON.stringify(oMergedRecord));
  fsRecordToCsvLine(oMergedRecord);

  if (oMergedRecord.oNextInputRow) {
    // deceptively simple, dangerously recursive
    await fpHandleData(oMergedRecord.oNextInputRow);
  }

  return Promise.resolve();

  function _fCleanLog(ConsoleMessage) {
    if (ConsoleMessage.type() === 'log') {
      console.log(ConsoleMessage.text() + EOL);
    }
    if (ConsoleMessage.type() === 'error' || ConsoleMessage.text().includes('fpInnerScrapeRecord err')) {
      console.log(ConsoleMessage);
    }
  }
}
