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

const oServiceThis = {};

let oCache = JSON.parse(fs.readFileSync(sCacheFilePath, 'utf8'));
//const rsReadStream = fs.createReadStream('./location-strings.txt');
const wsWriteStream = fs.createWriteStream(sOutputFilePath);

let browser;
let iCurrentInputRecord = 0;
let iTotalInputRecords = 0;

async function exec(oConfig) {
  oServiceThis = Object.assign(oServiceThis, oConfig);

  oServiceThis.arrTableColumnKeys = Object.keys(oServiceThis.oTitleLine);

  // fpScrapeInputRecordOuter, oRecordFromSource, sUniqueKey;

  await main();
}

async function main() {
  let sInputCsv;
  let arrsInputRows;

  fsRecordToCsvLine(oServiceThis.oTitleLine);
  await utils.fpWait(5000); // only needed to give debugger time to attach
  sInputCsv = await fpReadFile(sInputFilePath, 'utf8');
  arrsInputRows = sInputCsv.split(EOL).filter(sLine => sLine); // drop title line and empty trailing lines

  /** for testing only, shorten rows **/
  //arrsInputRows = arrsInputRows.slice(0, 5);
  arrsInputRows.shift();
  iTotalInputRecords = arrsInputRows.length;

  if (typeof oCache !== 'object' || !iTotalInputRecords) {
    // don't waste time or requests if there's a problem
    console.log('error obtaining oFirstNameCache');
    fpEndProgram();
  }

  console.log('early count, iTotalInputRecords = ' + iTotalInputRecords);
  browser = await puppeteer.launch();

  await utils.forEachReverseAsyncPhased(arrsInputRows, async function(_sInputRecord, i) {
    // TODO: automatically detect title line and expand object using oTitleLine
    const arrsCells = _sInputRecord.split(',');

    const oRecordFromSource = Object(oServiceThis.oSourceMap).keys.reduce((oAcc, sKey) => {
      const iValueIndex = oServiceThis.oSourceMap[sKey];
      oAcc[sKey] = arrsCells[iValueIndex];
      return oAcc;
    }, {});

    return fpHandleData(oRecordFromSource, i); // WIP
  });

  fpEndProgram();
}

async function fpHandleData(oInputRecord, i) {
  const oRecord = JSON.parse(JSON.stringify(oMinimalRecord)); // dereference for safety, shouldn't be needed tho

  oRecord.sScrapedUrl = oServiceThis.fsGetUrlToScrapeByInputRecord(oRecord);
  await fpScrapeInputRecord(oRecord);

  iCurrentInputRecord++;
  console.log('scraped input record #: ' + iCurrentInputRecord + '/' + iTotalInputRecords + EOL);

  return Promise.resolve();
}

function fsRecordToCsvLine(oRecord) {
  utils.fsRecordToCsvLine(oRecord, oServiceThis.arrTableColumnKeys, wsWriteStream);
}

async function fpEndProgram() {
  await browser.close();
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
