
import * as url from 'url';
import fs from 'fs';
import config from '../config.js'
import _ from 'lodash'
import { getCurrentDatasetVersion, writeProcessingReport, getProcessingReport, getMetadata, readTsvHeaders, readMapping } from '../util/filesAndDirectories.js'
import { uploadedFilesAndTypes, unzip } from '../validation/files.js'
import { determineFileNames, otuTableHasSamplesAsColumns, otuTableHasSequencesAsColumnHeaders } from '../validation/tsvformat.js'
import { processWorkBookFromFile } from "../converters/excel.js"
import { writeBiom, toBiom, addReadCounts } from '../converters/biom.js';
import { writeHDF5 } from '../converters/hdf5.js'
import queue from 'async/queue.js';
const runningJobs = new Map();


const q = queue(async (options) => {
    const id = options?.id;
    let job = runningJobs.get(id);
    job.summary = {};
    try {      
        const version = await getCurrentDatasetVersion(id)
      //  let job = runningJobs.get(id);
        job.version = version;
        job.steps = job.steps.filter(j => j.status !== 'queued');

        job.steps.push({ status: 'processing', message: 'validating files', time: Date.now() })
        runningJobs.set(id, job);

        let files = await uploadedFilesAndTypes(id, version)
        console.log("Determined files")
        if (files.format === 'ZIP') {
            console.log("Its zipped")
            job.steps.push({ status: 'processing', message: 'extracting archive', time: Date.now() })
            runningJobs.set(id, {...job});
            await unzip(id, files.files[0].name);
            files = await uploadedFilesAndTypes(id, version)
            job.files = files
        } else {
            job.files = files
        }
        // has files added
        runningJobs.set(id, {...job});
        
        // This function can be passed to downstream processes allowing them to report progress back to the UI (e.g. reading large streams, blasting sequences etc)
        const updateStatusOnCurrentStep = (progress, total, message, summary) => {
            let step = job.steps[job.steps.length -1];
            step.message = message || step.message;
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
                job.steps.push({ status: 'processing', message: 'Converting to biom format', time: Date.now() })
                runningJobs.set(id, {...job});
                console.log("It has samples as columns? "+samplesAsColumns)
                const biom = await toBiom(filePaths.otuTable, filePaths.samples, filePaths.taxa, samplesAsColumns, updateStatusOnCurrentStep, mapping)
                job.steps.push({ status: 'processing', message: 'Adding total read counts pr sample', time: Date.now() })      
                runningJobs.set(id, {...job});
                addReadCounts(biom)
                
                await writeBiomFormats(biom, id, version, job)
            } else if(files.format === 'TSV_2_FILE'){
                // TODO 
            }

        } else if (files.format === 'XLSX') {
            console.log("Its XLSX format")
            job.steps.push({ status: 'processing', message: 'Converting to biom format', time: Date.now() })
            runningJobs.set(id, {...job});
            const biom = await processWorkBookFromFile(id, files.files[0].name, version, mapping)
            job.steps.push({ status: 'processing', message: 'Adding total read counts pr sample', time: Date.now() })      
            runningJobs.set(id, {...job});
            addReadCounts(biom)
            await writeBiomFormats(biom, id, version, job)
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
       // throw error
        // callback(error)
    }

}, 3)


const pushJob = async (id) => {
    runningJobs.set(id, { id: id, steps: [{ status: 'queued', time: Date.now() }] })
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

const writeBiomFormats = async (biom, id, version, job) => {
    console.log('writing biom 1.0')
    job.steps.push({ status: 'processing', message: 'writing biom 1.0', time: Date.now() })
    runningJobs.set(id, {...job});
    await writeBiom(biom, `${config.dataStorage}${id}/${version}/data.biom.json`)
    console.log('writing biom 2.1')
    job.steps.push({ status: 'processing', message: 'writing biom 2.1', time: Date.now() })
    runningJobs.set(id, {...job});
    await writeHDF5(biom, `${config.dataStorage}${id}/${version}/data.biom.h5`)
}

export default (app) => {
    app.post("/dataset/:id/process", async function (req, res) {
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
                const metadata = await getMetadata(req.params.id, version)
                if (job) {
                    let data = {...job};
                    if(!!metadata){
                        data.metadata = metadata
                    }
                    res.json(data);
                } else {     
                let report = await getProcessingReport(req.params.id, version);
                if(report){
                    if(!!metadata){
                        report.metadata = metadata
                    }
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