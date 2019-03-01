// ref: https://github.com/Vandivier/data-science-practice/blob/master/js/udacity-study/legacy-puppeteer/reboot.js
// TODO: extract this into a library. Most of it is boilerplate.
const EOL = require('os').EOL;

const scrapeUtils = require('./scrape-utils');

const oTitleLine = {
  sEmail: 'Email Address',
  sGithubUrl: 'Entry ID',
  sGithubUsername: 'Entry ID',
  sLocationMatched: 'Location',
  sName: 'Name',
  sScrapedUrl: 'Scraped Url',
  sUserName: 'Username',
};

function fsGetUrlToScrapeByInputRecord(oInputRow) {
  return 'https://github.com/search?utf8=%E2%9C%93&q=location%3A%22' + oInputRow.sLocationMatched + '%22&type=Users&ref=advsearch&l=&l=';
}

function fsGetOutputRowId(oOutputRow) {
  return sGithubUrl;
}

async function fpScrapeInputRecordInner() {
  let arr$Affiliations = $('#affiliation-body a[name=subaffil]');
  let sarrAffiliations = '';
  let _oResult = {
    sName: $('h1[class*="user--name"]').html(),
    sEmail: $('.emaillabel')
      .parent()
      .find('td span')
      .text(),
    sUserName: '', //sUsername
    iEducationCount: $('div[class*="educations--section"] div[class*="_education--education"]').length,
    sLinkedInUrl: $('a[title="LINKEDIN"]').attr('href'),
    sResumeUrl: $('a[title="Resume"]').attr('href'),
    bUserExists: $('[class*=profile-container]').length > 0,
    bProfileIsPrivate: $('[class*="toast--message"]').html() === 'Profile is private',
    bTooManyRequestsError: _fsSafeTrim($('[class*="toast--message"]').html()) === 'Too many requests',
    bOtherError: false,
    bPresentlyEmployed: $('div[class*="works--section"] div[class*="_work--work"] span[class*="_work--present"]').length > 0,
    sProfileLastUpdate: $('div[class*="profile--updated"]')
      .text()
      .split(': ')[1],
    iTriesRemaining: '', //oResponse.triesRemaining
  };

  arr$Affiliations &&
    arr$Affiliations.each(function(arr, el) {
      let sTrimmed = _fsSafeTrim(el.innerText.replace(/\s/g, ' '));
      _oResult.sarrAffiliations += '~' + sTrimmed;
    });

  return Promise.resolve(_oResult);
}

// TODO: get oInputRecord from sInputRow
scrapeUtils.exec({ oTitleLine, fsGetUrlToScrapeByInputRecord, fsGetOutputRowId });

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
      .evaluate(_iCurrentInputRecord => {
        //const script = document.createElement('script') // inject jQuery
        //script.src = 'https://code.jquery.com/jquery-3.3.1.js'; // inject jQuery
        //document.getElementsByTagName('head')[0].appendChild(script); // inject jQuery
        console.log('scraping: ' + window.location.href);

        // toast message will disappear if you wait too long
        return _fpWait(1000)
          .then(fpScrapeInputRecordInner)
          .catch(function(err) {
            console.log('fpScrapeInputRecord err: ', err);
            return err;
          });

        // larger time allows for slow site response
        // some times of day when it's responding fast u can get away
        // with smaller ms; suggested default of 12.5s
        function _fpWait(ms) {
          ms = ms || 10000;
          return new Promise(resolve => setTimeout(resolve, ms));
        }

        function _fsSafeTrim(s) {
          return s && s.replace(/[,"]/g, '').trim();
        }
      })
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
    if (ConsoleMessage.type() === 'error' || ConsoleMessage.text().includes('fpScrapeInputRecord err')) {
      console.log(ConsoleMessage);
    }
  }
}
