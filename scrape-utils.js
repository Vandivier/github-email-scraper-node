const beautify = require('js-beautify').js_beautify;
const EOL = require('os').EOL;
const fs = require('fs');
const puppeteer = require('puppeteer');
const util = require('util');
const utils = require('ella-utils');

const fpReadFile = util.promisify(fs.readFile);
const fpWriteFile = util.promisify(fs.writeFile);

const sCacheFilePath = './cache.json';
const sInputFilePath = './input.csv';

let oCache = {};

let iCurrentInputRecord = 0;
let iTotalInputRecords = 0;

let oServiceThis = {
  browser: {},
};

oServiceThis.exec = async function(oConfig) {
  try {
    oServiceThis = Object.assign(oServiceThis, oConfig);
    await main();
  } catch (e) {
    console.log('error caught in exec', e);
    await fpEndProgram();
  }
};

async function main() {
  let bLoginSuccess = false;
  let sInputCsv;
  let arrsInputRows;

  try {
    oCache = JSON.parse(fs.readFileSync(sCacheFilePath, 'utf8'));
  } catch (error) {
    // ref: https://stackoverflow.com/a/31195572/3931488
    oCache = {};
  }

  sInputCsv = await fpReadFile(sInputFilePath, 'utf8');
  arrsInputRows = sInputCsv.split(EOL).filter(sLine => sLine); // drop title line and empty trailing lines

  if (process.env.SUBSAMPLE && process.env.SUBSAMPLE < arrsInputRows.length) {
    // useful while developing / testing
    arrsInputRows = arrsInputRows.slice(0, process.env.SUBSAMPLE);
  }

  oCache[oServiceThis.sUniqueKey] = oServiceThis.oTitleLine;
  arrsInputRows.shift(); // drop title row
  iTotalInputRecords = arrsInputRows.length;

  if (typeof oCache !== 'object' || !iTotalInputRecords) {
    // don't waste time or requests if there's a problem
    console.log('error obtaining cached data');
    await fpEndProgram();
  }

  console.log('early count, iTotalInputRecords = ' + iTotalInputRecords);
  oServiceThis.browser = process.env.DEBUG ? await puppeteer.launch({ headless: false }) : await puppeteer.launch();

  if (oServiceThis.fpbLogin) {
    console.log('logging in');
    const page = await oServiceThis.browser.newPage();

    try {
      bLoginSuccess = await oServiceThis.fpbLogin(page);
    } catch (err) {
      console.log('error while loggin in: ', err);
      bLoginSuccess = false;
    }

    await page.close();
    if (!bLoginSuccess) await fpEndProgram();
  }

  await utils.forEachReverseAsyncPhased(arrsInputRows, async function(_sInputRecord) {
    const arrsCells = _sInputRecord.split(',');
    const arrsInputColumnTitles = Object.keys(oServiceThis.oSourceMap) || [];

    const oRecordFromSource = arrsInputColumnTitles.reduce((oAcc, sKey) => {
      const iValueIndex = oServiceThis.oSourceMap[sKey];
      oAcc[sKey] = arrsCells[iValueIndex];
      return oAcc;
    }, {});

    return fpHandleData(oRecordFromSource);
  });

  await fpEndProgram();
}

async function fpHandleData(oInputRecord) {
  iCurrentInputRecord++;

  // make sure it's not undefined, null, or an unexpected data type
  if (typeof oInputRecord === 'object') {
    const _oInputRecord = Object.assign({}, oInputRecord); // dereference for safety, shouldn't be needed tho
    _oInputRecord.sScrapedUrl = oServiceThis.fsGetUrlToScrapeByInputRecord(_oInputRecord);

    if (fbIsValidUrlToScrape(_oInputRecord.sScrapedUrl)) {
      let oResult = await oServiceThis.fpbSkipInput(_oInputRecord);
      if (!oResult) oResult = await oServiceThis.fpScrapeInputWrapper(_oInputRecord);
      if (!oResult) {
        console.log('error: unexpectedly did not find fpHandleData.oResult for input record #' + iCurrentInputRecord);
        oResult = {};
      }
    } else {
      console.log('error: bad value for _oInputRecord.sScrapedUrl in fpHandleData for input record #' + iCurrentInputRecord);
    }
  }

  console.log('scraped input record #: ' + iCurrentInputRecord + '/' + iTotalInputRecords + EOL);
  return Promise.resolve();
}

// utility method to block certain records from getting scraped
// in theory you could just remove bad records from source,
//      but sometimes that's alot of work ;)
// defaults to skipping no records. Pass in oServiceThis.config if to overwrite
// should return a promise which resolves to an empty arr
oServiceThis.fpbSkipInput = async function() {
  return Promise.resolve(false);
};

// responsible for handling the page configuration
// provides some reasonable puppeteer defaults
// attached to exported service in case it need to be overwritten
oServiceThis.fpScrapeInputWrapper = async function(oInputRecord) {
  const page = await oServiceThis.browser.newPage();

  await page.goto(oInputRecord.sScrapedUrl, {
    timeout: 0,
  });

  await page.content();
  page.on('console', oServiceThis.fOnScraperLog); // ref: https://stackoverflow.com/a/47460782/3931488

  let oResult = oCache[oInputRecord.sScrapedUrl];
  if (!oResult) {
    oResult = await page
      .evaluate(oServiceThis.fpEvaluate, oInputRecord)
      .catch(function(error) {
        console.log('error scraping record: ', oInputRecord, error);
        return { sOutputFileErrorColumn: 'error' };
      })
      .catch(err => {
        console.log('error while evaluting', err, oInputRecord);
        return {};
      });
  }

  console.log('result: ', oResult);
  const oDereferencedResult = JSON.parse(JSON.stringify(oResult));

  await page.close();

  oCache[oInputRecord.sScrapedUrl] = oDereferencedResult;

  if (Array.isArray(oDereferencedResult.arrpoOutputRows) && oDereferencedResult.arrpoOutputRows.length) {
    // one input record produces an array of output records
    oDereferencedResult.arrpoOutputRows.forEach(oOutputRow => {
      oCache[oOutputRow[oServiceThis.sUniqueKey]] = oOutputRow;
    });
  }

  if (oDereferencedResult.oNextInputRecord && fbIsValidUrlToScrape(oDereferencedResult.oNextInputRecord.sScrapedUrl)) {
    // deceptively simple, dangerously recursive
    await fpHandleData(oDereferencedResult.oNextInputRecord);
  }

  return oDereferencedResult;
};

oServiceThis.fOnScraperLog = function(ConsoleMessage) {
  if (ConsoleMessage.type() === 'log') {
    console.log(ConsoleMessage.text() + EOL);
  } else if (ConsoleMessage.type() === 'error') {
    console.log(ConsoleMessage);
  } else {
    console.log('Unknown log message format, logged within scraper context: ', ConsoleMessage);
  }
};

// intended to be overwritten by lib user with user-specific business logic
// should return an array of output records which will be written to output.csv
// default to returning an empty array
// naming highlights the intended similarity to puppeteer's page.evaluate
oServiceThis.fpEvaluate = async function(oInputRecord) {
  return Promise.resolve([]);
};

async function fpEndProgram() {
  if (oServiceThis.browser) {
    await oServiceThis.browser.close();
  }

  await fpWriteCache();
  if (oServiceThis.bExitWhenDone) process.exit();
}

function fbIsValidUrlToScrape(s) {
  return s && typeof s === 'string' && /(http)(s)*(:\/\/)(.)*\.(\w+)/.test(s);
}

function fpWriteCache() {
  let sBeautifiedData = JSON.stringify(oCache);
  sBeautifiedData = beautify(sBeautifiedData, { indent_size: 4 });
  return fpWriteFile(sCacheFilePath, sBeautifiedData, 'utf8', err => {});
}

module.exports = oServiceThis;
