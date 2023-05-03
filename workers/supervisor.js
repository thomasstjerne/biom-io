import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import STEPS from '../enum/processingSteps.js'
import config from '../config.js'
import runningJobs from './runningJobs.js';
import { uploadedFilesAndTypes, getMimeFromPath, getFileSize, unzip } from '../validation/files.js'
import { determineFileNames, otuTableHasSamplesAsColumns, otuTableHasSequencesAsColumnHeaders } from '../validation/tsvformat.js'
import {  readTsvHeaders } from '../util/filesAndDirectories.js'

const __dirname = dirname(fileURLToPath(import.meta.url));

const workers = {
    TSV_3_FILE: 'tsvworker.js',
    XLSX: 'xlsxworker.js'
}

const prepareForProcessing = async (id, version, job) => {
    job.steps.push({ ...STEPS.validating, status: 'processing', time: Date.now() })
        runningJobs.set(id, job);

        let files = await uploadedFilesAndTypes(id, version)
        console.log("Determined files")
        if (files.format === 'ZIP') {
            console.log("Its zipped")
            job.steps.push({ ...STEPS.extractArchive, status: 'processing', time: Date.now() })
            runningJobs.set(id, { ...job });
            await unzip(id, files.files[0].name);
            job.steps[job.steps.length - 1] = { ...job.steps[job.steps.length - 1], status: 'finished' }
            files = await uploadedFilesAndTypes(id, version)

            job.files = files
            job.unzip = true;
        } else {
            job.files = files
            job.unzip = false;
        }

        if (files.format.startsWith('TSV')) {
            console.log("Its some TSV format") // is this check needed here??
            const filePaths = await determineFileNames(id, version);
            
            if (filePaths?.samples) {
                job.sampleHeaders = await readTsvHeaders(filePaths?.samples)
            }
            if (filePaths?.taxa) {
                job.taxonHeaders = await readTsvHeaders(filePaths?.taxa)
            }
        }
        job.steps[0] = { ...job.steps[0], status: 'finished' }
        // has files added
        runningJobs.set(id, { ...job });
        return job;
}

const getWorker = job => {
    if(workers[job.files.format]){
        return workers[job.files.format]
    } else {
        throw 'Unsupported format'
    }
}

/* 
This function will distribute a job to a dedicated worker and take care of messaging between the worker and the main thread

*/
export const processDataset = (id, version, job) => {

    return new Promise(async (resolve, reject) => {
        //  Unzip data if needed, determine format etc
        await prepareForProcessing(id, version, job)
        // Get the appropriate worker for the job
        const worker = getWorker(job)
        console.log("FORK "+__dirname + '/' + worker)
        const work = fork(__dirname + '/' + worker, [id, version]);
        work.on('message', (message) => {
    
            if(message?.type === 'beginStep' && !!message?.payload){
                console.log("BEGIN STEP "+message?.payload)
                
                job.steps.push({ ...STEPS[message?.payload], status: 'processing', time: Date.now() })
                runningJobs.set(id, { ...job });
            }
            if(message?.type === 'stepFinished' && message?.payload){
                const finishedJob = job.steps.find(s => s.name === message?.payload);
                finishedJob.status = 'finished'
               // job.steps[job.steps.length - 1] = { ...job.steps[job.steps.length - 1], status: 'finished' }
                if(message?.payload === 'writeBiom1'){
                    job.filesAvailable = [...job.filesAvailable, { format: 'BIOM 1.0', fileName: 'data.biom.json', size: getFileSize(`${config.dataStorage}${id}/${version}/data.biom.json`), mimeType: 'application/json' }]
    
                }
                if(message?.payload === 'writeBiom2'){
                    job.filesAvailable = [...job.filesAvailable, { format: 'BIOM 2.1', fileName: 'data.biom.h5', size: getFileSize(`${config.dataStorage}${id}/${version}/data.biom.h5`), mimeType: 'application/x-hdf5' }]
    
                }
                runningJobs.set(id, { ...job });
               
            }
            if(message?.type === 'hdf5Errors'){
                job.processingErrors = { hdf5: message?.payload }
            }
            if(message?.type === 'updateStatusOnCurrentStep' && message?.payload){
                let step = job.steps[job.steps.length - 1];
              //  console.log(job.steps)
                // step.message = message || step.message;
                if ( message?.payload?.message) {
                    step.subTask = message?.payload?.message
                }
                step.progress = message?.payload?.progress ?? step.progress;
                step.total = message?.payload?.total ?? step.total;
                if (message?.payload?.summary) {
                    job.summary = { ...job.summary, ...message?.payload?.summary }
                }
                runningJobs.set(id, { ...job });
            } 
            if(message?.type === 'finishedJobSuccesssFully'){
                resolve()
            }
            if(message?.type === 'finishedJobWithError'){
                reject(message?.payload)
            }
      
        })
    
        work.on('error', (err) => {
            console.log(err)
            reject(err)
        })
    })

}