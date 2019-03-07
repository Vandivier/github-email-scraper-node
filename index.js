// ref: https://github.com/Vandivier/data-science-practice/blob/master/js/udacity-study/legacy-puppeteer/reboot.js

const utils = require('ella-utils');

const arrScrapeFunctions = require('./sort-options');
const scrapeUtils = require('./scrape-utils');
const CREDS = require('./creds'); // ref: https://github.com/emadehsan/thal

const oSourceMap = {
  // TODO: don't explicitly pass oSourceMap and just read from input.csv
  sLocationMatched: 0,
};

const oTitleLine = {
  sEmail: 'Email Address',
  sGithubUrl: 'Github URL',
  sGithubUsername: 'Github Username',
  sLocationMatched: 'Location',
  sName: 'Name',
  sScrapedUrl: 'Scraped Url',
};

sUniqueKey = 'sEmail';

fpEvaluate = async oInputRecord => {
  let oResult = {};

  console.log('scraping: ' + window.location.href);
  await new Promise(resolve => setTimeout(resolve, 500)); // let dynamic content load
  await new Promise(resolve => setTimeout(resolve, Math.ceil((Math.random() * 10 + 2) * 1000))); // Throttling. Pause randomly between 2 and 12 seconds.

  try {
    oResult = fInnerScrapeRecord(oInputRecord);
  } catch (err) {
    console.log('fpInnerScrapeRecord err: ', err);
    oResult = { err };
  }

  return oResult;

  function fInnerScrapeRecord(oInputRecord) {
    const arrpoOutputRows = [...document.body.querySelectorAll('.user-list-item [href*="@"]')].map($email => {
      const $user = $email.parentElement && $email.parentElement.parentElement && $email.parentElement.parentElement.parentElement;

      if (!$email || !$user) {
        return {};
      }

      return {
        sEmail: $email.textContent,
        sGithubUrl: $user.querySelector('a').href,
        sGithubUsername: $user.querySelector('a').text,
        sLocationMatched: oInputRecord.sLocationMatched,
        sName: $user.querySelector('div.d-block') && $user.querySelector('div.d-block').textContent,
        sScrapedUrl: oInputRecord.sScrapedUrl,
      };
    });

    return {
      arrpoOutputRows,
      oNextInputRecord: {
        sLocationMatched: oInputRecord.sLocationMatched,
        sScrapedUrl: document.querySelector('.next_page').href,
      },
    };
  }
};

// ref: https://github.com/emadehsan/thal
// TODO: login and logout routines are similar so some logic could be extracted to a function
fpbLogin = async page => {
  let bLogoutResolved = false;
  let bLoginResolved = false;
  const USERNAME_SELECTOR = '#login_field';
  const PASSWORD_SELECTOR = '#password';
  const BUTTON_SELECTOR = 'input[type=submit][name=commit]';
  const BUTTON_LOGOUT_SELECTOR = 'input[value="Sign out"]';

  await page.goto('https://github.com/login');
  let sSignedInText = await page.evaluate(
    () => document.querySelector('#user-links') && document.querySelector('#user-links').textContent.trim()
  );
  let bLoginConfirmed = sSignedInText && sSignedInText.includes('Signed in as ' + CREDS.username);

  if (bLoginConfirmed) {
    console.log('already logged in');
  } else {
    await page.click(USERNAME_SELECTOR);
    await page.keyboard.type(CREDS.username);
    await page.click(PASSWORD_SELECTOR);
    await page.keyboard.type(CREDS.password);

    const pLoginNavigation = page.waitForNavigation().then(() => {
      !bLoginResolved && console.log('confirmed logged in');
    });

    const pLoginTimeout = new Promise(resolve => {
      setTimeout(() => {
        !bLoginResolved && console.log('log in confirmation is taking a while, eagerly checking login status...');
        resolve();
      }, 5000);
    });

    await page.click(BUTTON_SELECTOR);
    console.log('log in form found, filled, and submitted');
    await Promise.race([pLoginNavigation, pLoginTimeout]);
    bLoginResolved = true;
    await page.waitFor(2 * 1000); // give it some extra time bc idk to be safe i guess

    sSignedInText = await page.evaluate(
      () => document.querySelector('#user-links') && document.querySelector('#user-links').textContent.trim()
    );
    bLoginConfirmed = sSignedInText && sSignedInText.includes('Signed in as ' + CREDS.username);

    if (bLoginConfirmed) {
      console.log('login succeeded. proceeding to scrape.');
      return Promise.resolve(true);
    } else {
      console.log('login failed. terminating process');
      return Promise.resolve(false);
    }
  }
};

async function main() {
  const iScrapeFunctions = arrScrapeFunctions.length;

  if (process.env.DEBUG) {
    debugger;
  }

  await utils.forEachReverseAsyncPhased(arrScrapeFunctions, async function(fScrapeFunction, i) {
    // fsGetUrlToScrapeMostRecentlyJoined is perhaps most fruitful gathering method
    console.log(
      'Scraping happens in reverse, so lower means more nearly finished. Now scraping scrape function #' +
        (i + 1) +
        ' of ' +
        iScrapeFunctions
    );

    return scrapeUtils.exec({
      fpEvaluate,
      fpbLogin,
      fsGetUrlToScrapeByInputRecord: fScrapeFunction,
      oSourceMap,
      oTitleLine,
      sUniqueKey,
    });
  });
}

main();
