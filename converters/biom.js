const _ = require('lodash');
const streamReader = require('../util').streamReader;
const Biom = require('biojs-io-biom').Biom;


const getMetaDataRow = row => ({id: row.id, metadata: row})
const getReadCount = (biom, column) => biom.getDataColumn(column).reduce((partialSum, a) => partialSum + Number(a), 0);

// Calculate total reads in sample and set in metadata
const addReadCounts = async biom => {
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
const toBiom = async (otuTableFile, sampleFile, taxaFile) => {

  const samples = await streamReader.readMetaDataAsMap(sampleFile)
  const taxa = await streamReader.readMetaDataAsMap(taxaFile)
  console.log(`Taxa: ${taxa.size} samples: ${samples.size}`)  
  const [otuTable, rows, columns] = await streamReader.readOtuTableToSparse(otuTableFile);
const biom = new Biom({
    rows: rows.map(r => getMetaDataRow(taxa.get(r))), // taxa.map(getMetaDataRow),
    columns: columns.map(c => getMetaDataRow(samples.get(c))),
    matrix_type: 'sparse',
    shape: [taxa.size, samples.size],
    data: otuTable
})

return biom;
}


module.exports = {
    toBiom,
    addReadCounts
}