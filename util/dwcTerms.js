const fs = require('fs');
const parseString = require('xml2js').parseString;
const _ = require('lodash')
const getTerms = async (schema) => {

  const fileList = await fs.promises.readdir(`../schemas`);
  const xmlFile = fileList.find((file) => file.startsWith(schema));
  const xml = await fs.promises.readFile(`../schemas/${xmlFile}`);
  return new Promise((resolve, reject) => {
    parseString(xml, { trim: true }, (error, data) => {
        if (error) {
          console.log("Error parsing XML");
          console.log(error);
          reject(error);
        } else {
          
          const fields = _.get(data,'extension.property', [])
          resolve(new Map(fields.map(f => [_.get(f, '$.name'), _.get(f, '$')])))
          //console.log(data.extension.property[0].$)
        }
      });
  })
  
//  console.log(xmlFile)
}

module.exports = getTerms;
//getTerms('dwc_occurrence').then(json => console.log(json))