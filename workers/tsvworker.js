import { writeBiom, toBiom, addReadCounts } from '../converters/biom.js';
import { writeHDF5 } from '../converters/hdf5.js'
import config from '../config.js'
import _ from 'lodash'
import { getCurrentDatasetVersion, writeProcessingReport, wipeGeneratedFilesAndResetProccessing, readTsvHeaders, readMapping } from '../util/filesAndDirectories.js'
import { determineFileNames, otuTableHasSamplesAsColumns, otuTableHasSequencesAsColumnHeaders } from '../validation/tsvformat.js'
import {updateStatusOnCurrentStep, beginStep, stepFinished, hdf5Errors, finishedJobSuccesssFully, finishedJobWithError, writeBiomFormats} from "./util.js"



/* const updateStatusOnCurrentStep = (progress, total, message, summary) => {
    if (typeof process?.send === 'function') {
        try {
           // process.send('updateStatusOnCurrentStep')

             process.send({
                type: 'updateStatusOnCurrentStep',
                payload: {
                    progress,
                    total,
                    message,
                    summary
                }
    
            }
                
            ) 
        } catch (error) {
            console.log(error)
        }
        
    }
}

const beginStep = (step) => {
    if (typeof process?.send === 'function') {
       // process.send('beginStep')
         process.send({
            type: 'beginStep',
            payload: step

        }
            
        ) 
    }
}

const stepFinished = (step) => {
    if (typeof process?.send === 'function') {
        // process.send('stepFinished')
         process.send({
            type: 'stepFinished',
            payload: step

        }
            
        ) 
    }
}

const hdf5Errors = errors => {

    if (typeof process?.send === 'function') {
        // process.send('stepFinished')
         process.send({
            type: 'hdf5Errors',
            payload: errors

        }
            
        ) 
    }
}

const finishedJobSuccesssFully = (status) => {
    if (typeof process?.send === 'function') {
        // process.send('stepFinished')
         process.send({
            type: 'finishedJobSuccesssFully',
            payload: status

        }
            
        ) 
    }
}

const finishedJobWithError = (error) => {
    if (typeof process?.send === 'function') {
        // process.send('stepFinished')
         process.send({
            type: 'finishedJobWithError',
            payload: error

        }
            
        ) 
    }
}

const writeBiomFormats = async (biom, id, version) => {
    console.log('writing biom 1.0')
    beginStep('writeBiom1')
    
    await writeBiom(biom, `${config.dataStorage}${id}/${version}/data.biom.json`, updateStatusOnCurrentStep)
    stepFinished('writeBiom1')
    console.log('writing biom 2.1')
    beginStep('writeBiom2')
   
    const { errors } = await writeHDF5(biom, `${config.dataStorage}${id}/${version}/data.biom.h5`, updateStatusOnCurrentStep)
    hdf5Errors(errors || [])
  //  job.processingErrors = { hdf5: errors || [] }
    stepFinished('writeBiom2')
   
} */


const processDataset = async (id, version) => {
    try {
        console.log("Processing dataset "+id + " version "+version)
    const mapping = await readMapping(id, version);
    const filePaths = await determineFileNames(id, version);
    const samplesAsColumns = await otuTableHasSamplesAsColumns(filePaths, _.get(mapping, 'samples.id', 'id'));
    let sequencesAsHeaders = false;
    if (!samplesAsColumns) {
        sequencesAsHeaders = await otuTableHasSequencesAsColumnHeaders(filePaths)
    }
   /*  if (filePaths?.samples) {
        job.sampleHeaders = await readTsvHeaders(filePaths?.samples)
    }
    if (filePaths?.taxa) {
        job.taxonHeaders = await readTsvHeaders(filePaths?.taxa)
    } */
    beginStep('convertToBiom')
    const biom = await toBiom(filePaths.otuTable, filePaths.samples, filePaths.taxa, samplesAsColumns,  updateStatusOnCurrentStep , mapping, id)
    stepFinished('convertToBiom');
    beginStep('addReadCounts')
    await addReadCounts(biom, updateStatusOnCurrentStep)
    stepFinished('addReadCounts')
    await writeBiomFormats(biom, id, version)
    finishedJobSuccesssFully('success')
    } catch (error) {
        finishedJobWithError(error)   
    }
    
}




const id = process.argv[2]
const version = process.argv[3]

processDataset(id, version)

