import fs from 'fs'
import config from '../config.js'
import {Biom} from 'biojs-io-biom';
import child_process from 'child_process';
import {spawn} from 'child_process';

import parse from 'csv-parse';
// import path from 'path';
import json from 'big-json';
import AdmZip from "adm-zip";




export const parseBigJson = async (file,  processFn = (progress, total, message, summary) => {},) => {
 
  const exists = await fileAtPathExists(file)
    if(!exists){
      throw `Not found: ${file}`
      }
    const {size} = await fs.promises.stat(file);
    let progress = 0;
    let nextPct = 5; // for every 5 pct parsed, update progress
  return new Promise((resolve, reject) => {
    try {
      const readStream = fs.createReadStream(file);
      const parseStream = json.createParseStream();
      
      parseStream.on('data', function(pojo) {
          processFn(size, size)
          resolve(pojo)
      });

      readStream.on('data', (buffer) => {
        progress += buffer.length;
        const progressPct = Math.round(progress/ size*100)
        if(progressPct > nextPct){
          processFn(progress, size)
          nextPct +=5 ;
        }
    })
      
      readStream.pipe(parseStream);
    } catch (error) {
      reject(error)
    }
    

  })
  
}


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

export const writeMapping = async (id, version, mapping) => {
  await fs.promises.writeFile(`${config.dataStorage}${id}/${version}/mapping.json`, JSON.stringify(mapping, null, 2));
}

export const readMapping = async (id, version) => {
  try {
    let files = await fs.promises.readdir(`${config.dataStorage}${id}/${version}`)     
     if(!!files.find(f => f === 'mapping.json')){
        let data = await fs.promises.readFile(`${config.dataStorage}${id}/${version}/mapping.json`, 'utf8') //writeFile(`${config.dataStorage}${id}/${version}/processing.json`, JSON.stringify(json, null, 2));
        return JSON.parse(data)
     } else {
        return null
     }
} catch (error) {
    console.log(error)
   return null;
}
  
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
         if(!!files.find(f => f === 'eml.json')){
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

export const readBiom = async (id, version, processFn = (progress, total, message, summary) => {},) => {
    try {
        let files = await fs.promises.readdir(`${config.dataStorage}${id}/${version}`)     
         if(!!files.find(f => f === 'data.biom.json')){
            /* let data = await fs.promises.readFile(`${config.dataStorage}${id}/${version}/data.biom.json`, 'utf8') //writeFile(`${config.dataStorage}${id}/${version}/processing.json`, JSON.stringify(json, null, 2));
            const biom = new Biom(JSON.parse(data)) */

            let data = await parseBigJson(`${config.dataStorage}${id}/${version}/data.biom.json`, processFn) //writeFile(`${config.dataStorage}${id}/${version}/processing.json`, JSON.stringify(json, null, 2));
            const biom = new Biom(data)
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

/*   export const zipDwcArchive = async (id, version) => {
    return new Promise((resolve, reject) => {
      const zip = spawn('zip', ['-r', `${config.dataStorage}${id}/${version}/archive.zip`, `*`], {
        cwd: `${config.dataStorage}${id}/${version}/archive`,
      })
      zip.on('exit', () => {
        resolve()
      })
      zip.on('error', (e) => {
        reject(e)
      })
    })
  }; */

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

export const dwcArchiveExists = async (id, version) => {
  return new Promise((resolve, reject) => {
  fs.access(`${config.dataStorage}${id}/${version}/archive.zip`, (error) => {
    if (error) {
      reject("DwC archive does not exist")
    }
    resolve()
  });
})
}

export const deleteOriginalFile = async (id, version, fileName) => {
  return new Promise((resolve, reject) => {
    fs.unlink(`${config.dataStorage}${id}/${version}/original/${fileName}`, (err) => {
      if (err) {
        reject(err);
      }
      resolve()
      console.log("Deleted File successfully.");
  });
  
})
}

export const deleteFile = async (id, version, fileName) => {
  return new Promise((resolve, reject) => {
    fs.unlink(`${config.dataStorage}${id}/${version}/${fileName}`, (err) => {
      if (err) {
        reject(err);
      }
      resolve()
      console.log("Deleted File successfully.");
  });
  
})
}

export const fileExists = async (id, version, fileName) => {
  return new Promise((resolve, reject) => {
  fs.access(`${config.dataStorage}${id}/${version}/${fileName}`, (error) => {
    if (error) {
      resolve(false)
    }
    resolve(true)
  });
})
}

export const fileAtPathExists = async (file) => {
  return new Promise((resolve, reject) => {
  fs.access(file, (error) => {
    if (error) {
      resolve(false)
    }
    resolve(true)
  });
})
}

export const wipeGeneratedFilesAndResetProccessing = async (id, version) => {
  return new Promise(async (resolve, reject) => {
    try {
      const files = ['data.biom.json', 'data.biom.h5', 'archive.zip', 'processing.json', 'archive/dna.txt', 'archive/occurrence.txt', 'archive/meta.xml'];
      for (let f of files) {
        const exists = await fileExists(id, version, f)
        if(exists){
          await deleteFile(id, version, f)
        }
        
      }
      resolve(`Cleaned directories`)
    } catch (error) {
      reject(error)
    }
    
    
  
})

}


