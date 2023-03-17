import {uploadedFilesAndTypes, unzip} from '../validation/files.js'
import {determineFileNames, otuTableHasSamplesAsColumns, otuTableHasSequencesAsColumnHeaders} from '../validation/tsvformat.js'
import {processWorkBookFromFile} from "../converters/excel.js"
import {getCurrentDatasetVersion, readTsvHeaders} from '../util/filesAndDirectories.js'


export default (app) => {
    app.get("/validate/:id", async function (req, res) {
        if (!req.params.id) {
          res.sendStatus(404);
        } else {
            console.log(`Validating ${req.params.id}`)
            try {
                let version = await getCurrentDatasetVersion(req.params.id)
                let files = await uploadedFilesAndTypes(req.params.id, version)
                if(files.format.startsWith('TSV')){
                  const filePaths = await determineFileNames(req.params.id, version);
                  const samplesAsColumns = await otuTableHasSamplesAsColumns(filePaths);
                  let sequencesAsHeaders = false;
                  if(!samplesAsColumns){
                      sequencesAsHeaders = await otuTableHasSequencesAsColumnHeaders(filePaths)
                  }
                  
                  let result = {...files, filePaths, samplesAsColumns, sequencesAsHeaders}
                  if(filePaths?.samples){
                    result.sampleHeaders = await readTsvHeaders(filePaths?.samples)
                  }
                  if(filePaths?.taxa){
                    result.taxonHeaders = await readTsvHeaders(filePaths?.taxa)
                  }
                  res.json({...result, id: req.params.id}) 
                } else if(files.format === 'XLSX') {
                //  const biom = await processWorkBookFromFile(req.params.id, files.files[0].name, version)
                 // res.json(biom)
                 res.json({...files, id: req.params.id}) 
                } else if(files.format === 'ZIP') {
                  await unzip(req.params.id, files.files[0].name)
                  res.json({...files, id: req.params.id})
                } else {
                  res.json({...files, id: req.params.id})
                } 
            } catch (error) {
                console.log(error)
                res.sendStatus(404);
            }

          
        }
      });
}