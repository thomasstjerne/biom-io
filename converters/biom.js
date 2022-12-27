const fs = require("fs");
const parse = require("csv-parse/lib/sync");
const _ = require('lodash');
const streamReader = require('../util').streamReader;
const Biom = require('biojs-io-biom').Biom;

const parserOptions = {
    delimiter: "\t",
    columns: true,
    ltrim: true,
    rtrim: true,
    quote: null,
  }; 

const getMetaDataRow = row => ({id: row.id, metadata: row})
const getReadCount = (biom, column) => biom.getDataColumn(column).reduce((partialSum, a) => partialSum + Number(a), 0);

const toBiom = async (otuTableFile, sampleFile, taxaFile) => {

/*const sampleData = await fs.promises.readFile(sampleFile);
const samples = parse(sampleData, parserOptions);
const taxadata = await fs.promises.readFile(taxaFile);
const taxa = parse(taxadata, parserOptions);
const otuTableData = await fs.promises.readFile(otuTableFile);
const otuTable = parse(otuTableData, {
    delimiter: "\t",
    columns: false,
    ltrim: true,
    rtrim: true,
    quote: null,
    from_line: 2
  }); */
  const samples = await streamReader.readMetaData(sampleFile)
  const taxa = await streamReader.readMetaData(taxaFile)
  const otuTable = await streamReader.readOtuTable(otuTableFile)

console.log(`Taxa: ${taxa.length} samples: ${samples.length}`)  
const biom = new Biom({
    id: "Table ID",
    rows: taxa.map(getMetaDataRow),
    columns: samples.map(getMetaDataRow),
    matrix_type: 'sparse',
    data: Biom.dense2sparse(otuTable.map(row => row.slice(1)))
})
// Calculate total reads in sample and set in metadata
const readCounts = biom.columns.map(c => getReadCount(biom, c.id));
biom.addMetadata({dimension: 'columns', attribute: 'readCount', values: readCounts})
return biom;
}


const test = async () => {
    try {
        let biom = await toBiom(`../input/biowide/OTU_table.tsv`,`../input/biowide/sample.tsv`,`../input/biowide/taxa.tsv`);

         console.log(biom.getDataAt("39efbae3f448393c8795c2ee920ab1041e947c37", "NV001"))
        console.log(biom.getDataAt("39efbae3f448393c8795c2ee920ab1041e947c37", "NV002"))
        console.log(biom.getDataAt("39efbae3f448393c8795c2ee920ab1041e947c37", "NV003"))
        console.log(biom.getDataAt("39efbae3f448393c8795c2ee920ab1041e947c37", "NV004")) 
       // console.log(biom.getDataRow("39efbae3f448393c8795c2ee920ab1041e947c37"))
       console.log(biom.getDataColumn('NV004').reduce((partialSum, a) => partialSum + Number(a), 0));
       console.log(biom.columns.find(c => c.id === 'NV004').metadata.readCount)



  
    } catch (error) {
        console.log(error)
    }
}

//test()

module.exports = {
    toBiom
}