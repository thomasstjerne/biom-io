import {uploadedFilesAndTypes, unzip} from './files.js'
import {determineFileNames, otuTableHasSamplesAsColumns, otuTableHasSequencesAsColumnHeaders} from './tsvformat.js'
import {processWorkBookFromFile} from "../converters/excel.js"
import {getCurrentDatasetVersion} from '../util/filesAndDirectories.js'


export default (app) => {
    app.get("/validate/:id", async function (req, res) {
        if (!req.params.id) {
          res.sendStatus(404);
        } else {
          let version = await getCurrentDatasetVersion(req.params.id)
          let files = await uploadedFilesAndTypes(req.params.id, version)
          if(files.format.startsWith('TSV')){
            const filePaths = await determineFileNames(req.params.id, version);
            const samplesAsColumns = await otuTableHasSamplesAsColumns(filePaths);
            let sequencesAsHeaders = false;
            if(!samplesAsColumns){
                sequencesAsHeaders = await otuTableHasSequencesAsColumnHeaders(filePaths)
            }
            res.json({...files, filePaths, samplesAsColumns, sequencesAsHeaders}) 
          } else if(files.format === 'XLSX') {
            const biom = await processWorkBookFromFile(req.params.id, files.files[0].name)
            res.json(biom)
          } else if(files.format === 'ZIP') {
            await unzip(req.params.id, files.files[0].name)
            res.json(files)
          } else {
            res.json(files)
          }
          
        }
      });
}