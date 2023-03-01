import fs from 'fs'
import config from '../config.js'
import {Biom} from 'biojs-io-biom';
import child_process from 'child_process';
import parse from 'csv-parse';


export const getCurrentDatasetVersion = async id => {
    try {
        let versionList = await fs.promises.readdir(`${config.dataStorage}${id}`)
        return  Math.max(...versionList.filter(v => !isNaN(v)))
    } catch (error) {
        console.log(error)
        throw "not found"
    }
    
}

export const writeProcessingReport = async (id, version, json) => {
    await fs.promises.writeFile(`${config.dataStorage}${id}/${version}/processing.json`, JSON.stringify(json, null, 2));
}

export const getProcessingReport = async (id, version) => {
    try {
        let data = await fs.promises.readFile(`${config.dataStorage}${id}/${version}/processing.json`, 'utf8') //writeFile(`${config.dataStorage}${id}/${version}/processing.json`, JSON.stringify(json, null, 2));
        return JSON.parse(data)
    } catch (error) {
        return null
    }
}

export const writeEmlJson = async (id, version, eml) => {
    await fs.promises.writeFile(`${config.dataStorage}${id}/${version}/eml.json`, JSON.stringify(eml, null, 2));
}

export const writeEmlXml = async (id, version, xml) => {
if (!fs.existsSync(`${config.dataStorage}${id}/${version}/archive`)) {
    await fs.promises.mkdir(`${config.dataStorage}${id}/${version}/archive`)
    }
    await fs.promises.writeFile(`${config.dataStorage}${id}/${version}/archive/eml.xml`, xml);
}

export const hasMetadata = async (id, version) => {
    try {
        if(!fs.existsSync(`${config.dataStorage}${id}/${version}/archive`)){
            return false
        }
        let files = await fs.promises.readdir(`${config.dataStorage}${id}/${version}/archive`)     
        return !!files.find(f => f === 'eml.xml')
    } catch (error) {
        console.log(error)
       return false;
    }
    
}

export const getMetadata = async (id, version) => {
    try {
        let files = await fs.promises.readdir(`${config.dataStorage}${id}/${version}`)     
         if(!!files.find(f => f === 'eml.json') && !!files.find(f => f === 'eml.xml')){
            let data = await fs.promises.readFile(`${config.dataStorage}${id}/${version}/eml.json`, 'utf8') //writeFile(`${config.dataStorage}${id}/${version}/processing.json`, JSON.stringify(json, null, 2));
            return JSON.parse(data)
         } else {
            return null
         }
    } catch (error) {
        console.log(error)
       return null;
    }
    
}

export const readBiom = async (id, version) => {
    try {
        let files = await fs.promises.readdir(`${config.dataStorage}${id}/${version}`)     
         if(!!files.find(f => f === 'data.biom.json')){
           // Todo use JSONstream as the data could be large
            let data = await fs.promises.readFile(`${config.dataStorage}${id}/${version}/data.biom.json`, 'utf8') //writeFile(`${config.dataStorage}${id}/${version}/processing.json`, JSON.stringify(json, null, 2));
            const biom = new Biom(JSON.parse(data))
            return biom;
         } else {
            return null
         }
    } catch (error) {
        throw error;
    }
    
}


export const zipDwcArchive = (id, version) => {
    return new Promise((resolve, reject) => {
      child_process.exec(
        `zip -r ${config.dataStorage}${id}/${version}/archive.zip *`,
        {
          cwd: `${config.dataStorage}${id}/${version}/archive`,
        },
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  };

  export const rsyncToPublicAccess = (id, version) => {
    return new Promise((resolve, reject) => {
      child_process.exec(
        `rsync -chavzP ${config.dataStorage}${id}/${version}/archive.zip ${config.rsyncDirectory}/${id}.zip`,
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  };

  export const readTsvHeaders = async (path, delimiter) => {
    return new Promise((resolve, reject) => {
        const parser = parse( {
            delimiter: delimiter || "\t",
            columns: false,
            ltrim: true,
            rtrim: true,
            quote: null,
            to_line: 1
          })
          let headers;
          parser.on('readable', function(){
            let line;
            while ((line = parser.read()) !== null) {
              headers = line;
            }
          });
          // Catch any error
          parser.on('error', function(err){
            console.error(err.message);
            reject(err)
          });
          // Test that the parsed records matched the expected records
          parser.on('end', function(){
            resolve(headers)
          });
        const inputStream = fs.createReadStream(path);    
        inputStream.pipe(parser)
    })
};


