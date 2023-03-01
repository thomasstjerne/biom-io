import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* const fs = require('fs');
const parseString = require('xml2js').parseString;
const _ = require('lodash') */
import fs from 'fs';
import _ from 'lodash';
import {parseString} from 'xml2js'


const getTerms = async (schema) => {

  try {
  const fileList = await fs.promises.readdir(`${__dirname}/../schemas`);
  const xmlFile = fileList.find((file) => file.startsWith(schema));
  const xml = await fs.promises.readFile(`${__dirname}/../schemas/${xmlFile}`);
  return new Promise((resolve, reject) => {
    parseString(xml, { trim: true }, (error, data) => {
        if (error) {
          console.log("Error parsing XML");
          console.log(error);
          console.log("ERROR in getTERMS "+__dirname)
          reject(error);
        } else {
          
          const fields = _.get(data,'extension.property', [])
          resolve(new Map(fields.map(f => [_.get(f, '$.name'), _.get(f, '$')])))
          //console.log(data.extension.property[0].$)
        }
      });
  })
  } catch (error) {
    console.log("ERROR in getTERMS "+__dirname)
    console.log(error)
  }
  
  
//  console.log(xmlFile)
}

// module.exports = getTerms;
export default getTerms;
//getTerms('dwc_occurrence').then(json => console.log(json))