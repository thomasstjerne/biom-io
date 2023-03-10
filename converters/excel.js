import xlsx from "xlsx";
import fs from "fs";
import fileNames from "../validation/filenames.js";
import {Biom} from 'biojs-io-biom';
import config from '../config.js'

const determineFileNames = sheets => {
  console.log('determineFileNames')
  try {
      
      const otuTable = sheets.find(f => {
          
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

      console.log(`taxa ${taxa}`)
      if(!otuTable){
        throw `Could not find the otuTable in the sheets: ${sheets.map(s => s.name).toString()}`
      }
      if(!taxa){
        throw `Could not find the taxa in the sheets: ${sheets.map(s => s.name).toString()}`
      }
      if(!samples){
        throw `Could not find the taxa in the sheets: ${sheets.map(s => s.name).toString()}`
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


const getMapFromMatrix = (matrix, idHeader) => {

  const columns = matrix[0];
  const rows = matrix.slice(1);
  
  const arr = rows.map(row => {

    return columns.reduce((acc, e, idx) => {
      acc[e] = row[idx] ? row[idx] : ""
      return acc
    }, {}) 

   })

   return new Map(arr.filter(d => !!d[idHeader]).map(d => ([d[idHeader],  d])))
}

// converts an otu table with sample and taxon metada files to BIOM format
export const toBiom = async (data, idHeader = 'ID') => {

  return new Promise((resolve, reject) => {
    try {
      const {
        otuTable, 
        samples,
        taxa
    } = data;
    
      //const sampleMap = new Map(samples.data.filter(d => !!d[idHeader]).map(d => ([d[idHeader],  d])))
      const sampleMap = getMapFromMatrix(samples.data, idHeader)
      //const taxaMap = new Map(taxa.data.filter(d => !!d[idHeader]).map(d => ([d[idHeader],  d])))
      const taxaMap = getMapFromMatrix(taxa.data, idHeader, true)
      const sparseData = [];
      let columns = otuTable.data[0].slice(1);
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
        }  
      })
      console.log(`Samples in metadata: ${samples.data.length} in OTU table: ${columns.length}`)
      console.log(`Taxa in metadata: ${taxa.data.length} in OTU table: ${rows.length}`)
      // console.log(rows.map(r => ({id: r, metadata: taxaMap.get(r)})))
      const biom = new Biom({
        rows: rows.map(r => ({id: r, metadata: taxaMap.get(r)})), // taxa.map(getMetaDataRow),
        columns: columns.map(c => ({id: c, metadata: sampleMap.get(c)})),
        matrix_type: 'sparse',
        shape: [taxaMap.size, sampleMap.size],
        data: sparseData
      })
      resolve(biom)
    } catch (error) {
      reject(error)
    }
  })

}

export const processWorkBookFromFile = async (id, fileName, version) => {
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
        if(workbook.SheetNames.length !== 3){
          throw "There must be 3 sheets, otuTable, taxa and samples";
        } else {
       // const sheet = workbook.Sheets[workbook.SheetNames[0]];
      //  const data = xlsx.utils.sheet_to_json(sheet)
       // console.log(data)
//        workbook.SheetNames.map(n => ({name: n, data: xlsx.utils.sheet_to_json(workbook.Sheets[n])}))

        const data = workbook.SheetNames.map(n => ({name: n, data: xlsx.utils.sheet_to_json(workbook.Sheets[n], {header: 1})}));
        const mappedData = determineFileNames(data)
        const biom = await toBiom(mappedData)
        resolve(biom)
        }
      });
      
    } catch (error) {
      reject(error)
    }
  })

}




