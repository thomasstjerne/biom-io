const fs = require("fs");
const parse = require("csv-parse");
const transform = require("stream-transform");

const readOtuTable = (path) => {
    return new Promise((resolve, reject) => {
        const parser = parse( {
            delimiter: "\t",
            columns: false,
            ltrim: true,
            rtrim: true,
            quote: null,
            from_line: 2
          })
        const records = [];
        parser.on('readable', function(){
            let record;
            while ((record = parser.read()) !== null) {
              records.push(record);
            }
          });
          // Catch any error
          parser.on('error', function(err){
            console.error(err.message);
            reject(err)
          });
          // Test that the parsed records matched the expected records
          parser.on('end', function(){
            resolve(records)
          });
        const inputStream = fs.createReadStream(path);    
        inputStream.pipe(parser)
    })

}

const readMetaData = (path) => {
    
      return new Promise((resolve, reject) => {
        const parser = parse({
            delimiter: "\t",
            columns: true,
            ltrim: true,
            rtrim: true,
            quote: null,
          })
        const records = [];
        parser.on('readable', function(){
            let record;
            while ((record = parser.read()) !== null) {
              records.push(record);
            }
          });
          // Catch any error
          parser.on('error', function(err){
            console.error(err.message);
            reject(err)
          });
          // Test that the parsed records matched the expected records
          parser.on('end', function(){
            resolve(records)
          });
        const inputStream = fs.createReadStream(path);    
        inputStream.pipe(parser)
    })
}

module.exports = {
    readOtuTable,
    readMetaData
}

/* const test = () => {
   // readMetaData('../input/biowide/sample.tsv')
   readOtuTable('../input/biowide/OTU_table.tsv')
}

test() */