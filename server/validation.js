import {uploadedFilesAndTypes, unzip} from '../validation/files.js'
import {determineFileNames, otuTableHasSamplesAsColumns, otuTableHasSequencesAsColumnHeaders} from '../validation/tsvformat.js'
import {processWorkBookFromFile, readXlsxHeaders} from "../converters/excel.js"
import {getCurrentDatasetVersion, readTsvHeaders, getProcessingReport, getMetadata, writeProcessingReport} from '../util/filesAndDirectories.js'
//import { getCurrentDatasetVersion, writeProcessingReport, getProcessingReport, getMetadata, readTsvHeaders, readMapping } from '../util/filesAndDirectories.js'


export default (app) => {
    app.get("/validate/:id", async function (req, res) {
        if (!req.params.id) {
          res.sendStatus(404);
        } else {
            console.log(`Validating ${req.params.id}`)
            try {
                
                let version = await getCurrentDatasetVersion(req.params.id)
                let files = await uploadedFilesAndTypes(req.params.id, version)
                let processionReport = await getProcessingReport(req.params.id, version)
                let metadata = await getMetadata(req.params.id, version)

                if(!processionReport){
                  processionReport= {id: req.params.id}
                }
                if(!!metadata){
                  processionReport.metadata = metadata
                }
               // console.log(files)
                if(files.format.startsWith('TSV')){
                  const filePaths = await determineFileNames(req.params.id, version);
                  console.log(filePaths)
                  let samplesAsColumns;
                  try {
                    samplesAsColumns = await otuTableHasSamplesAsColumns(filePaths);
                  } catch (error) {
                    samplesAsColumns = false;
                    files.format = "INVALID";
                    files.invalidMessage = error

                  }
                             
                  let sequencesAsHeaders = false;
                 
                  if(!samplesAsColumns){
                    try {
                      sequencesAsHeaders = await otuTableHasSequencesAsColumnHeaders(filePaths)
                    } catch (error) {
                      sequencesAsHeaders = false;
                      files.format = "INVALID";
                      files.invalidMessage = error
                    }
                  }
                  
                  let validationReport = {files: {...files, filePaths, samplesAsColumns, sequencesAsHeaders}}
                  if(filePaths?.samples){
                    validationReport.sampleHeaders = await readTsvHeaders(filePaths?.samples)
                  }
                  if(filePaths?.taxa){
                    validationReport.taxonHeaders = await readTsvHeaders(filePaths?.taxa)
                  }
                  const report = {...processionReport, unzip: false, ...validationReport}
                  await writeProcessingReport(req.params.id,version, report)
                  res.json(report) 
                } else if(files.format === 'XLSX') {
                //  const biom = await processWorkBookFromFile(req.params.id, files.files[0].name, version)
                 // res.json(biom)

                 const headers = await readXlsxHeaders(req.params.id, files?.files[0]?.name, version)
                 console.log(headers)
                 const report = {...processionReport, ...headers, unzip: false, files:{...files, id: req.params.id}};
                 await writeProcessingReport(req.params.id,version, report)
                 res.json(report) 
                } else if(files.format === 'ZIP') {
                  await unzip(req.params.id, files.files[0].name)
                  const report = {...processionReport, unzip: true, files:{...files, id: req.params.id}}
                  await writeProcessingReport(req.params.id,version, report)
                  res.json(report) 
                } else {
                  const report = {...processionReport, unzip: false, files:{...files, id: req.params.id}}
                  await writeProcessingReport(req.params.id,version, report)
                  res.json(report) 
                } 
            } catch (error) {
                console.log(error)
                res.sendStatus(404);
            }

          
        }
      });
}