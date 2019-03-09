const beautify = require('js-beautify').js_beautify;
const reorder = require('csv-reorder');

const arrsCsvs = [];
const arroCaches = [];

const sOrderedOutputFilePath = './ordered-output.csv';
const sOutputFilePath = './output.csv';

const fpReadFile = util.promisify(fs.readFile);
const fpWriteFile = util.promisify(fs.writeFile);
const wsWriteStream = fs.createWriteStream(sOutputFilePath);

const oOptions = {
  mergeFiles: false,
  mergeDuplicates: false,
  uniquifyDuplicates: false,
  sUniqueKey: '',
};

async function fpWriteCache() {
  let sBeautifiedData = JSON.stringify(oCache);
  sBeautifiedData = beautify(sBeautifiedData, { indent_size: 4 });

  await fpWriteFile(sCacheFilePath, sBeautifiedData, 'utf8', err => {});

  return Promise.resolve();
}

function fsRecordToCsvLine(oRecord) {
  utils.fsRecordToCsvLine(oRecord, oServiceThis.arrTableColumnKeys, wsWriteStream);
}

function fpOrderCsv() {
  // TODO: can I return reorder?
  reorder({
    input: sOutputFilePath, // too bad input can't be sBeautifiedData
    output: sOrderedOutputFilePath,
    sort: oServiceThis.oTitleLine[oServiceThis.sUniqueKey],
  })
    .then(metadata => {
      console.log('fpWriteCache completed succesfully.');
    })
    .catch(error => {
      console.log('Error during fpWriteCache.', error);
    });

  return Promise.resolve();
}

async function main() {
  fParseOptions();
  try {
    arroCaches = arrsCsvs.map(async sFile => await fpReadFile(sFile + '.json', 'utf8'));
  } catch (e) {
    console.error('Error reading one of the files you specified. Are you sure you ran that command correctly?', e);
    process.exit();
  }

  debugger;

  if (oOptions.mergeFiles) fMergeCaches();
}

// yargs === overengineering
function fParseOptions() {
  function _fCleanValue(s) {
    return s && s.trim().replace(/[^\w]/g, '');
  }

  process.argv.slice(2).forEach(s => {
    if (s.toLowerCase().includes('uniquekey')) {
      oOptions.sUniqueKey = _fCleanValue(s.split('=')[1]);
    } else if (s.includes('--')) {
      oOptions[_fCleanValue(s)] = true;
    } else {
      arrsCsvs.push(s);
    }
  });

  if (Object.entries(oOptions).find((sKey, sVal) => sVal)) {
    // if any merge option exists, set merge to true as a safety measure
    oOptions.mergeFiles = true;
  }

  if (oOptions.mergeFiles && !oOptions.sUniqueKey) {
    console.error(
      'cache merge option(s) observed, but no unique key to merge on the basis of was provided. Pass --UniqueKey=MyUniqueKeyName.'
    );
    process.exit();
  }

  if (!arrsCsvs.length) arrsCsvs.push('cache');

  debugger;
}

function fMergeCaches() {
  const oMergedCache = arroCaches.reduce((oMergedCacheAcc, oCurrentCache, i) => {
    return Object.keys(oCurrentCache).reduce((oCurrentCacheAcc, sOriginalRecordKey, ii) => {
      const oCurrentRecord = oCurrentCache[sOriginalRecordKey];
      const sNewRecordKey = oOptions.uniquifyDuplicates ? sOriginalRecordKey + '-' + i + '-' + ii : sOriginalRecordKey;
      const oExistingRecord = oCurrentCacheAcc[sNewRecordKey];

      if (oExistingRecord) {
        if (oOptions.mergeDuplicates) {
          // existing column values survive; only overwrite unpopulated columns
          oCurrentCacheAcc[sRecordKey] = Object.assign({}, oNew, oExisting);
        }
        // else do nothing; the existing record survives and current record is dropped
      } else {
        oCurrentCacheAcc[sRecordKey] = Object.assign({}, oCurrentRecord);
      }

      return oCurrentCacheAcc;
    }, oMergedCacheAcc);
  }, {});

  arroCaches.splice(arroCaches.length); // clear without reassigning
  arroCaches.push(oMergedCache);
}

main();
