
import * as url from 'url';
import auth from './Auth/auth.js';
import config from '../config.js'
import _ from 'lodash'
import { getCurrentDatasetVersion, writeProcessingReport, getProcessingReport, getMetadata, readTsvHeaders, readMapping } from '../util/filesAndDirectories.js'
import { getDataset } from '../util/dataset.js';
import { uploadedFilesAndTypes, getMimeFromPath, getFileSize, unzip } from '../validation/files.js'
import { determineFileNames, otuTableHasSamplesAsColumns, otuTableHasSequencesAsColumnHeaders } from '../validation/tsvformat.js'
import { processWorkBookFromFile, readXlsxHeaders } from "../converters/excel.js"
import { writeBiom, toBiom, addReadCounts } from '../converters/biom.js';
import { writeHDF5 } from '../converters/hdf5.js'
import queue from 'async/queue.js';
const runningJobs = new Map();

const STEPS = {
    "validating": {
        "name": "validating",
        "status": "pending",
        "message": "Validating files",
        "messagePending": "Validate files"
      },
    "extractArchive": {
        "name": "extractArchive",
         "status": 'pending', 
         "message": 'Extracting archive',
         "messagePending": "Extract archive"
    },
    "convertToBiom": {
        "name": "convertToBiom",
        "status": "pending",
        "message": 'Converting to BIOM format',
        "messagePending": "Convert to BIOM format"
      },
      "addReadCounts": {
        "name": "addReadCounts",
        "status": "pending",
        "message": "Adding total read counts pr sample",
        "messagePending": "Add total read counts pr sample"
      },
      
      "writeBiom1": {
        "name": "writeBiom1",
        "status": "pending",
        "message": "Writing BIOM 1.0",
        "messagePending": "Write BIOM 1.0"
      },
      "writeBiom2": {
        "name": "writeBiom2",
        "status": "pending",
        "message": "Writing BIOM 2.1",
        "messagePending": "Write BIOM 2.1"
      }
}




const q = queue(async (options) => {
    const id = options?.id;
    let job = runningJobs.get(id);
    job.summary = {};
    try {      
        const version = await getCurrentDatasetVersion(id)
      //  let job = runningJobs.get(id);
        job.version = version;
        job.steps = job.steps.filter(j => j.status !== 'queued');
        
        job.steps.push({...STEPS.validating, status: 'processing', time: Date.now() })
        runningJobs.set(id, job);

        let files = await uploadedFilesAndTypes(id, version)
        console.log("Determined files")
        if (files.format === 'ZIP') {
            console.log("Its zipped")
            job.steps.push({...STEPS.extractArchive, status: 'processing', time: Date.now() })
            runningJobs.set(id, {...job});
            await unzip(id, files.files[0].name);
            job.steps[job.steps.length -1] = {...job.steps[job.steps.length -1], status: 'finished'}
            files = await uploadedFilesAndTypes(id, version)

            job.files = files
            job.unzip = true;
        } else {
            job.files = files
            job.unzip = false;
        }
        job.steps[0] = {...job.steps[0], status: 'finished'}

        // has files added
        runningJobs.set(id, {...job});
        
        // This function can be passed to downstream processes allowing them to report progress back to the UI (e.g. reading large streams, blasting sequences etc)
        const updateStatusOnCurrentStep = (progress, total, message, summary) => {
            let step = job.steps[job.steps.length -1];
            // step.message = message || step.message;
            if(message){
                step.subTask = message
            }
            step.progress = progress ?? step.progress;
            step.total = total ?? step.total;
            if(summary){
                job.summary = {...job.summary, ...summary}
            }
            runningJobs.set(id, {...job});
        }
        const mapping = await readMapping(id, version);
        if(!mapping){
            // should we just warn that no mapping was created? or should it throw?
            job.mapping = {samples: {}, taxa: {}};
        } else {
            job.mapping = mapping;
        }
        
        if (files.format.startsWith('TSV')) {
            console.log("Its some TSV format")
            const filePaths = await determineFileNames(id, version);
            const samplesAsColumns = await otuTableHasSamplesAsColumns(filePaths, _.get(mapping, 'samples.id', 'id'));
            let sequencesAsHeaders = false;
            if (!samplesAsColumns) {
                sequencesAsHeaders = await otuTableHasSequencesAsColumnHeaders(filePaths)
            }
            if(filePaths?.samples){
                job.sampleHeaders = await readTsvHeaders(filePaths?.samples)
              }
              if(filePaths?.taxa){
                job.taxonHeaders = await readTsvHeaders(filePaths?.taxa)
              }
            
            // Decide how to proceed based on the format / sequences as headers etc
            if (files.format === 'TSV_3_FILE') {
                console.log("Its  TSV_3_FILE format")
                job.steps.push({...STEPS.convertToBiom, status: 'processing', time: Date.now() })
                runningJobs.set(id, {...job});
                console.log("It has samples as columns? "+samplesAsColumns)
                const biom = await toBiom(filePaths.otuTable, filePaths.samples, filePaths.taxa, samplesAsColumns, updateStatusOnCurrentStep, mapping)
                job.steps[job.steps.length -1] = {...job.steps[job.steps.length -1], status: 'finished'}

                job.steps.push({...STEPS.addReadCounts, status: 'processing', time: Date.now() })      
                runningJobs.set(id, {...job});
                console.log("Adding read counts pr sample")
                await addReadCounts(biom)
                job.steps[job.steps.length -1] = {...job.steps[job.steps.length -1], status: 'finished'}

                await writeBiomFormats(biom, id, version, job, updateStatusOnCurrentStep)
            } else if(files.format === 'TSV_2_FILE'){
                // TODO 
            }

        } else if (files.format === 'XLSX') {
            console.log("Its XLSX format")
            job.steps.push({...STEPS.convertToBiom, status: 'processing', time: Date.now() })
            runningJobs.set(id, {...job});
            const biom = await processWorkBookFromFile(id, files.files[0].name, version, job.mapping)
            job.steps[job.steps.length -1] = {...job.steps[job.steps.length -1], status: 'finished'}
            job.steps.push({...STEPS.addReadCounts, status: 'processing', time: Date.now() })      
            runningJobs.set(id, {...job});
            await addReadCounts(biom)
            job.steps[job.steps.length -1] = {...job.steps[job.steps.length -1], status: 'finished'}
            await writeBiomFormats(biom, id, version, job, updateStatusOnCurrentStep)
            // callback()
            //res.json(biom)
        } else {
           //x callback(new Error('unsupported format'))
           throw 'unsupported format' 
           // res.json(files)
        }

    } catch (error) {
        console.log("There was an error")
        console.log(error)
        job.steps.push({ status: 'failed', message: error?.message, time: Date.now() })
       // throw error
        // callback(error)
    }

}, 3)


const pushJob = async (id) => {
    runningJobs.set(id, { id: id, filesAvailable:[], steps: [{ status: 'queued', time: Date.now() }] })
    try {
        q.push({ id: id }, async (error, result) => {
            if (error) {
                console.log(error);
                let job = runningJobs.get(id);
                job.steps.push({ status: 'failed', message: 'unsupported format', time: Date.now() })
                await writeProcessingReport(id, job.version, job)
                runningJobs.delete(id)

                //runningJobs.set(id, {...runningJobs.get(id), status: 'failed'} )
              //  throw error
            } else {
                let job = runningJobs.get(id);
                job.steps.push({ status: 'finished', time: Date.now() })
                await writeProcessingReport(id, job.version, job)
                runningJobs.delete(id)
            }
        })
    } catch (error) {
        console.log(error)
        throw error
    }
    

}

const writeBiomFormats = async (biom, id, version, job, updateStatusOnCurrentStep) => {
    console.log('writing biom 1.0')
    job.steps.push({...STEPS.writeBiom1, status: 'processing', time: Date.now() })
    runningJobs.set(id, {...job});
    await writeBiom(biom, `${config.dataStorage}${id}/${version}/data.biom.json`, updateStatusOnCurrentStep)
    job.steps[job.steps.length -1] = {...job.steps[job.steps.length -1], status: 'finished'}
    job.filesAvailable = [...job.filesAvailable, {format: 'BIOM 1.0', fileName: 'data.biom.json', size: getFileSize(`${config.dataStorage}${id}/${version}/data.biom.json`), mimeType: 'application/json'} ]
    console.log('writing biom 2.1')
    job.steps.push({...STEPS.writeBiom2, status: 'processing', time: Date.now() })
    runningJobs.set(id, {...job});
    const {errors} = await writeHDF5(biom, `${config.dataStorage}${id}/${version}/data.biom.h5`, updateStatusOnCurrentStep)
    job.processingErrors = {hdf5: errors || []}
    job.filesAvailable = [...job.filesAvailable, {format: 'BIOM 2.1', fileName: 'data.biom.h5', size: getFileSize(`${config.dataStorage}${id}/${version}/data.biom.h5`), mimeType: 'application/x-hdf5'} ]
    job.steps[job.steps.length -1] = {...job.steps[job.steps.length -1], status: 'finished'}
    runningJobs.set(id, {...job});
}

const addPendingSteps = job => {
    const steps_ = job.steps;
    
    //console.log(Object.keys(STEPS).filter(s =>  !job.steps.map(a => a?.name).includes(s)).map(k => STEPS[k]));
    return [...steps_, ...Object.keys(STEPS).filter(s =>  (!job.unzip ? s !== 'extractArchive' : true) && !steps_.map(a => a?.name).includes(s)).map(k => STEPS[k])]
}

export default (app) => {
    app.post("/dataset/:id/process", auth.userCanModifyDataset(), async function (req, res) {
        if (!req.params.id) {
            res.sendStatus(404);
        } else {
            try {
                if(!runningJobs.has(req.params.id)){
                    pushJob(req.params.id );
                    res.sendStatus(201)
                } else {
                    res.sendStatus(302)
                }
                
            } catch (error) {
                res.sendStatus(500)
            }

        }
    });


    app.get("/dataset/:id/process/:version?", async function (req, res) {
        
        if (!req.params.id) {
            res.sendStatus(404);
        } else {

            // this will only find jobs that are being processed -will need
            const job = runningJobs.get(req.params.id);
            
            try {
                let version = req.params?.version;
                if(!version){
                    version = await getCurrentDatasetVersion(req.params.id);
                } 
                let report = await getDataset(req.params.id, version);
                if (job) {
                    let data = {...report,...job, steps: addPendingSteps(job)};     
                    res.json(data);
                } else {     
                
                if(report){
                    res.json(report)
                } else {
                    res.sendStatus(404)
                }
            }
            } catch (error) {
                console.log(error)
                res.sendStatus(404)
            }
            

        }
    });
}