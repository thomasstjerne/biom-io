import util, {streamReader} from '../util/index.js'
import fs from 'fs';
import {Biom} from 'biojs-io-biom';
import _ from 'lodash'
const getMetaDataRow = row => {
    if(!row?.id){
       // console.log(row)
    }
    try {
        return {id: row.id, metadata: row}
    } catch (error) {
       // console.log(row)
    }
    
    }
const getReadCount = (biom, column) => biom.getDataColumn(column).reduce((partialSum, a) => partialSum + Number(a), 0);

// Calculate total reads in sample and set in metadata
export const addReadCounts = async biom => {
    return new Promise((resolve, reject) => {
        try {
            const readCounts = biom.columns.map(c => getReadCount(biom, c.id));
            biom.addMetadata({dimension: 'columns', attribute: 'readCount', values: readCounts}) 
            resolve(biom) 
        } catch (error) {
            reject(error)
        }
    })
}

const getColumnIdTerm = (samplesAsColumns, termMapping) => {
    console.log("samplesAsColumns "+samplesAsColumns)
    console.log(`Term ${_.get(termMapping, 'samples.id')}`)
    return samplesAsColumns ? _.get(termMapping, 'samples.id', 'id') :_.get(termMapping, 'taxa.id', 'id')
}

// converts an otu table with sample and taxon metada files to BIOM format
export const toBiom = async (otuTableFile, sampleFile, taxaFile, samplesAsColumns = true, processFn = (progress, total, message, summary) => {}, termMapping = { taxa: {}, samples: {}}) => {

  processFn(0, 0, 'reading sample file')
  const samples = await streamReader.readMetaDataAsMap(sampleFile, /* undefined, */ processFn, termMapping.samples)
   processFn(0, 0, 'reading taxon file', {sampleCount: samples.size});
  const taxa = await streamReader.readMetaDataAsMap(taxaFile, /* undefined, */ processFn, termMapping.taxa)
  console.log(`Taxa: ${taxa.size} samples: ${samples.size}`)  
  processFn(0, taxa.size, 'reading OTU table', {taxonCount: taxa.size});
  const columnIdTerm = getColumnIdTerm(samplesAsColumns, termMapping)
  console.log("Column ID term: "+columnIdTerm)
  const [otuTable, rows, columns] = await streamReader.readOtuTableToSparse(otuTableFile, processFn, columnIdTerm);
  const biom = new Biom({
    rows: rows.map(r => getMetaDataRow(samplesAsColumns ? taxa.get(r) : samples.get(r))), 
    columns: columns.map(c => getMetaDataRow(samplesAsColumns ? samples.get(c) : taxa.get(c))),
    matrix_type: 'sparse',
    shape: samplesAsColumns ? [taxa.size, samples.size] : [samples.size, taxa.size],
    data: otuTable
  })

  if(!samplesAsColumns){
    // We can read taxa as columns, but we will flip the matrix and always store samples as columns (samples will alwas have a smaller cardinality)
    biom.transpose()
  }
 return biom;
}

const writeBigArraysInChunksToStream = (stream, arr, chunkSize) => {
    const startArray = "[\n", endArray = "\n]";
    stream.write(startArray)
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        stream.write(chunk.map(s => JSON.stringify(s)).join(','));
        if(i+chunkSize < arr.length){
            stream.write(',')
        } else {
            stream.write(endArray)
        }
    }
    
}

export const writeBiom = async (biom, path) => {
    const startJson = "{\n", endJson = "\n}";
    return new Promise((resolve, reject)=>{
        try {
            const biomStream = fs.createWriteStream(path, {
                flags: "a",
              });
              biomStream.write(startJson);
              console.log(Object.keys(biom))
              const keys = Object.keys(biom);
              keys.filter(k => !['_rows','_columns','_data'].includes(k)).forEach(k => {
                biomStream.write(`"${k.slice(1)}": ${JSON.stringify(biom[k])},\n`)
              })
              biomStream.write(`"columns":`);
              writeBigArraysInChunksToStream(biomStream, biom._columns, 100)
              biomStream.write(`,"rows":`);
              writeBigArraysInChunksToStream(biomStream, biom._rows, 100);
              biomStream.write(`,"data":`);
              writeBigArraysInChunksToStream(biomStream, biom._data, 1000)
              biomStream.write(endJson);
              resolve()
              //biomStream.write(JSON.stringify(biom, null, 2)) 
             
        } catch (error) {
            reject(error)
        }
        
    })
     
}

export default {
    toBiom,
    addReadCounts,
    writeBiom
} 