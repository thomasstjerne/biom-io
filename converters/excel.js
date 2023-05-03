import xlsx from "xlsx";
import fs from "fs";
import fileNames from "../validation/filenames.js";
import {Biom} from 'biojs-io-biom';
import config from '../config.js'
import util from "../util/index.js"


const extractTaxaFromOTUtable = (otuTable, samples, termMapping ) => {
  
try {
  const notSamplIdHeaderIndices = getTaxonHeaderIndicesFromOtuTable(otuTable, samples, termMapping )
  const taxonData = otuTable?.data.map(d => d.filter((val, idx) => notSamplIdHeaderIndices.includes(idx)))
  const otuTableData = otuTable?.data.map(d => d.filter((val, idx) => idx === 0 || !notSamplIdHeaderIndices.includes(idx)))
 
  return {
    otuTable : {
      name: "otuTable",
      data: otuTableData
    },
    taxa : {
      name: 'taxa',
      data: taxonData
    }
  }
} catch (error) {
  console.log(error)
}
  

}

const getTaxonHeaderIndicesFromOtuTable = (otuTable, samples, termMapping ) => {
  let sampleId = termMapping?.samples?.id;
  
  const sampleHeaders = samples?.data[0];
  if(!sampleId){
   sampleId = sampleHeaders.find(e => !!e && ['id', 'sampleid'].includes(e.toLowerCase()) )
  }
  if(!sampleId){
    throw "No sample id in sample file"
  }
  const sampleIdIndex = sampleHeaders.indexOf(sampleId);
  // Create a Set if sample IDs:
  const sampleIdSet = new Set(samples?.data.slice(1).map(s => s[sampleIdIndex]))
  const otuTableHeaders = otuTable?.data[0];

  // Find all headers that are not a sample id
  const notSamplIdHeaderIndices = otuTableHeaders.reduce((acc, curr, idx) => {
      if(!sampleIdSet.has(curr)){
        acc.push(idx)
      }
      return acc
  }, [])

  return notSamplIdHeaderIndices;

}

const determineFileNames = (sheets, termMapping) => {
  console.log('determineFileNames')
  try {
      
      let otuTable = sheets.find(f => {
          
          let rawFileName = f.name.replace(/[^0-9a-z]/gi, '').toLowerCase();
          return fileNames.otutable.indexOf(rawFileName) > -1;
      })
      console.log(`OTU table ${otuTable}`)
      const samples = sheets.find(f => {
        let rawFileName = f.name.replace(/[^0-9a-z]/gi, '').toLowerCase();
        return fileNames.samples.indexOf(rawFileName) > -1;
      })

      console.log(`samples ${samples}`)
      let taxa = sheets.find(f => {
        let rawFileName = f.name.replace(/[^0-9a-z]/gi, '').toLowerCase();
        return fileNames.taxa.indexOf(rawFileName) > -1;
      });
      console.log((samples?.name))
      //console.log(`taxa ${taxa}`)
      if(!otuTable){
        throw `Could not find the otuTable in the sheets: ${sheets.map(s => s.name).toString()}`
      }
      if(!taxa){

        // Try to get get taxon data and a filtered otu table (i.e. 2 file format)
        try {
          const processed  = extractTaxaFromOTUtable(otuTable, samples, termMapping)
          otuTable = processed?.otuTable;
          taxa = processed?.taxa

        } catch (error) {
          // console.log(error)
          throw `Could not find the taxa in the sheets: ${sheets.map(s => s.name).toString()}`

        }
      }
      if(!samples){
        throw `Could not find the samples in the sheets: ${sheets.map(s => s.name).toString()}`
      }
     

      return {
          otuTable, 
          samples,
          taxa
      }
      
  } catch (error) {
      console.log(error)
      throw error;
  }

}



const getMapFromMatrix = (matrix, mapping, test) => {

  const reverseMapping = util.objectSwap(mapping)

const mapRecord = record => {
  // return record;
 return Object.keys(record).reduce((acc, key) => {
      if(reverseMapping[key]){
        acc[reverseMapping[key]] = record[key]
      } else {
        acc[key] = record[key]
      }
    return acc;
  }, {})
}

  const columns = matrix[0];
  if(test){
    "Taxon columns "+columns
  }
  const rows = matrix.slice(1);
  
  const arr = rows.map(row => {

    return columns.reduce((acc, e, idx) => {
      acc[e] = row[idx] ? row[idx] : ""
      return acc
    }, {}) 

   }).map(mapRecord)

   return new Map(arr.filter(d => !!d.id).map(d => ([d.id,  d])))
}

// converts an otu table with sample and taxon metada files to BIOM format
export const toBiom = async (data, termMapping, processFn = (progress, total, message, summary) => {}) => {

  return new Promise((resolve, reject) => {
    try {
      const {
        otuTable, 
        samples,
        taxa
    } = data;
      const sampleMap = getMapFromMatrix(samples.data,  termMapping.samples)
      const taxaMap = getMapFromMatrix(taxa.data, termMapping.taxa, true)
      const sparseData = [];
      let columns = otuTable.data[0].slice(1);
      processFn(columns.length, columns.length, 'Reading OTU table from spreadsheet', {sampleCount: columns.length});

      let rows = [];
      console.log(otuTable.data.length)

      otuTable.data.slice(1).forEach((row, rowIndex) => {
        if(!!row[0]){
          row.slice(1).forEach((val, index) => {
            if(!isNaN(Number(val)) && Number(val) > 0){
              sparseData.push([rowIndex, index, Number(val)])
            }
          })
          rows.push(row[0])
          if((rowIndex +1 % 100) === 0){
            processFn(rowIndex, rows.length, 'Reading OTU table  from spreadsheet', {taxonCount: rows.length});

          }
        }  
      })
      processFn(rows.length, rows.length, 'Reading OTU table  from spreadsheet', {taxonCount: rows.length});

      console.log(`Samples in metadata: ${samples.data.length} in OTU table: ${columns.length}`)
      console.log(`Taxa in metadata: ${taxa.data.length} in OTU table: ${rows.length}`)
      const biom = new Biom({
        rows: rows.map(r => ({id: r, metadata: taxaMap.get(r)})), 
        columns: columns.map(c => ({id: c, metadata: sampleMap.get(c)})),
        matrix_type: 'sparse',
        shape: [rows.length, columns.length], //[taxaMap.size, sampleMap.size],
        data: sparseData
      })
      resolve(biom)
    } catch (error) {
      console.log(error)
      reject(error)
    }
  })

}

export const processWorkBookFromFile = async (id, fileName, version, termMapping, processFn = (progress, total, message, summary) => {}) => {
  return new Promise((resolve, reject) => {
    try {
      const stream = fs.createReadStream(`${config.dataStorage}${id}/${version}/original/${fileName}`);

      const buffers = [];
      stream.on("data", function (data) { buffers.push(data); });
      stream.on('error', (error) => {
        reject(error)
      })
      stream.on("end", async () => {
        const buffer = Buffer.concat(buffers);
        const workbook = xlsx.read(buffer, {cellDates: true});

        console.log(workbook.SheetNames)
        if(workbook.SheetNames.length < 2){
          throw "There must be minimum 2 sheets, otuTable and samples";
        } else {
       // const sheet = workbook.Sheets[workbook.SheetNames[0]];
      //  const data = xlsx.utils.sheet_to_json(sheet)
       // console.log(data)
//        workbook.SheetNames.map(n => ({name: n, data: xlsx.utils.sheet_to_json(workbook.Sheets[n])}))

        const data = workbook.SheetNames.map(n => ({name: n, data: xlsx.utils.sheet_to_json(workbook.Sheets[n], {header: 1})}));
        const mappedData = determineFileNames(data, termMapping)
        const biom = await toBiom(mappedData, termMapping, processFn)
        resolve(biom)
        }
      });
      
    } catch (error) {
      reject(error)
    }
  })

}

export const readXlsxHeaders = async (id, fileName, version) => {
  return new Promise((resolve, reject) => {
    try {
      const stream = fs.createReadStream(`${config.dataStorage}${id}/${version}/original/${fileName}`);

      const buffers = [];
      stream.on("data", function (data) { buffers.push(data); });
      stream.on('error', (error) => {
        reject(error)
      })
      stream.on("end", async () => {
        const buffer = Buffer.concat(buffers);
        const workbook = xlsx.read(buffer, {cellDates: true});

        console.log(workbook.SheetNames)
        if(workbook.SheetNames.length < 2){
          throw "There must be minimum 2 sheets, otuTable and samples";
        } else {

        const data = workbook.SheetNames.map(n => ({name: n, data: xlsx.utils.sheet_to_json(workbook.Sheets[n], {header: 1})}));
        const {taxa, samples} = determineFileNames(data)

        let result = {
          sampleHeaders: samples?.data?.[0],
          taxonHeaders: taxa?.data?.[0]
        }
        resolve(result)
        }
      });
      
    } catch (error) {
      reject(error)
    }
  })
}




