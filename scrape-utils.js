const beautify = require('js-beautify').js_beautify;
const EOL = require('os').EOL;
const fs = require('fs');
const reorder = require('csv-reorder');
const puppeteer = require('puppeteer');
const util = require('util');
const utils = require('ella-utils');

const sCacheFilePath = './cache.json';
const sOrderedOutputFilePath = './ordered-output.csv';
const sInputFilePath = './input.csv'; // TODO: use rsReadStream
const sOutputFilePath = './output.csv';

const fpReadFile = util.promisify(fs.readFile);
const fpWriteFile = util.promisify(fs.writeFile);

let oServiceThis = {
  browser: {},
};

let oCache = JSON.parse(fs.readFileSync(sCacheFilePath, 'utf8'));
//const rsReadStream = fs.createReadStream('./location-strings.txt');
const wsWriteStream = fs.createWriteStream(sOutputFilePath);

let iCurrentInputRecord = 0;
let iTotalInputRecords = 0;

oServiceThis.exec = async function(oConfig) {
  try {
    oServiceThis = Object.assign(oServiceThis, oConfig);

    oServiceThis.arrTableColumnKeys = Object.keys(oServiceThis.oTitleLine);

    await main();
  } catch (e) {
    console.log('error caught in exec', e);
    await fpEndProgram();
  }
};

async function main() {
  let sInputCsv;
  let arrsInputRows;

  fsRecordToCsvLine(oServiceThis.oTitleLine);
  sInputCsv = await fpReadFile(sInputFilePath, 'utf8');
  arrsInputRows = sInputCsv.split(EOL).filter(sLine => sLine); // drop title line and empty trailing lines

  if (process.env.SUBSAMPLE && process.env.SUBSAMPLE < arrsInputRows.length) {
    // useful while developing / testing
    arrsInputRows = arrsInputRows.slice(0, process.env.SUBSAMPLE);
  }

  arrsInputRows.shift(); // drop title row
  iTotalInputRecords = arrsInputRows.length;

  if (typeof oCache !== 'object' || !iTotalInputRecords) {
    // don't waste time or requests if there's a problem
    console.log('error obtaining oFirstNameCache');
    fpEndProgram();
  }

  console.log('early count, iTotalInputRecords = ' + iTotalInputRecords);
  oServiceThis.browser = process.env.DEBUG ? await puppeteer.launch({ headless: false }) : await puppeteer.launch();

  if (oServiceThis.fpLogin) {
    // TODO: do i need to be logged into scrape page or just scrape browser?
    console.log('logging in');
    const page = await oServiceThis.browser.newPage();
    await oServiceThis.fpLogin(page);
    await page.close();
  }

  await utils.forEachReverseAsyncPhased(arrsInputRows, async function(_sInputRecord) {
    // TODO: automatically detect title line and expand object using oTitleLine
    const arrsCells = _sInputRecord.split(',');
    const arrsInputColumnTitles = Object.keys(oServiceThis.oSourceMap) || [];

    const oRecordFromSource = arrsInputColumnTitles.reduce((oAcc, sKey) => {
      const iValueIndex = oServiceThis.oSourceMap[sKey];
      oAcc[sKey] = arrsCells[iValueIndex];
      return oAcc;
    }, {});

    return fpHandleData(oRecordFromSource);
  });

  fpEndProgram();
}

async function fpHandleData(oInputRecord) {
  iCurrentInputRecord++;

  // make sure it's not undefined, null, or an unexpected data type
  if (typeof oInputRecord === 'object') {
    const _oInputRecord = Object.assign({}, oInputRecord); // dereference for safety, shouldn't be needed tho
    _oInputRecord.sScrapedUrl = oServiceThis.fsGetUrlToScrapeByInputRecord(_oInputRecord);
    const bValidUrl =
      _oInputRecord.sScrapedUrl &&
      typeof _oInputRecord.sScrapedUrl === 'string' &&
      /(http)(s)*(:\/\/)(.)*\.(\w+)/.test(_oInputRecord.sScrapedUrl);

    if (bValidUrl) {
      // one input record produces an array of output records
      let arroResult = oCache[_oInputRecord.sScrapedUrl];
      if (!arroResult) arroResult = await oServiceThis.fpbSkipInput(_oInputRecord);
      if (!arroResult) arroResult = await oServiceThis.fpScrapeInputWrapper(_oInputRecord);
      if (!arroResult) {
        console.log('error: unexpectedly did not find fpHandleData.arroResult for input record #' + iCurrentInputRecord);
        arroResult = [];
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

  const oResult = await page.evaluate(oServiceThis.fpEvaluate, oInputRecord).catch(function(error) {
    console.log('error scraping record: ', oInputRecord, error);
    return { sOutputFileErrorColumn: 'error' };
  });

  console.log(oResult);
  const oDereferencedResult = JSON.parse(JSON.stringify(oResult));

  await page.close();

  oCache[oInputRecord.sId] = oDereferencedResult;
  fsRecordToCsvLine(oDereferencedResult);

  if (oDereferencedResult.oNextInputRecord) {
    // deceptively simple, dangerously recursive
    await fpHandleData(oMergedRecord.oNextInputRecord);
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

function fsRecordToCsvLine(oRecord) {
  utils.fsRecordToCsvLine(oRecord, oServiceThis.arrTableColumnKeys, wsWriteStream);
}

async function fpEndProgram() {
  if (oServiceThis.browser) {
    await oServiceThis.browser.close();
  }

  await fpWriteCache();
  process.exit();
}

async function fpWriteCache() {
  let sBeautifiedData = JSON.stringify(oCache);
  sBeautifiedData = beautify(sBeautifiedData, { indent_size: 4 });

  await fpWriteFile(sCacheFilePath, sBeautifiedData, 'utf8', err => {
    reorder({
      input: sOutputFilePath, // too bad input can't be sBeautifiedData
      output: sOrderedOutputFilePath,
      sort: 'Entry ID',
    })
      .then(metadata => {
        console.log('Program completed.');
      })
      .catch(error => {
        console.log('Program completed with error.', error);
      });
  });

  return Promise.resolve();
}

module.exports = oServiceThis;
