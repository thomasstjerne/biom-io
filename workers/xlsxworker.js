import { writeBiom, toBiom, addReadCounts } from '../converters/biom.js';
import { processWorkBookFromFile, readXlsxHeaders } from "../converters/excel.js"
import { uploadedFilesAndTypes, getMimeFromPath, getFileSize, unzip } from '../validation/files.js'

import _ from 'lodash'
import { getCurrentDatasetVersion, writeProcessingReport, wipeGeneratedFilesAndResetProccessing, readTsvHeaders, readMapping } from '../util/filesAndDirectories.js'
import {updateStatusOnCurrentStep, beginStep, stepFinished, hdf5Errors, finishedJobSuccesssFully, finishedJobWithError, writeBiomFormats} from "./util.js"



const processDataset = async (id, version) => {
    try {
        console.log("Processing dataset "+id + " version "+version)
    const mapping = await readMapping(id, version);
    const  files = await uploadedFilesAndTypes(id, version)

   /*  if (filePaths?.samples) {
        job.sampleHeaders = await readTsvHeaders(filePaths?.samples)
    }
    if (filePaths?.taxa) {
        job.taxonHeaders = await readTsvHeaders(filePaths?.taxa)
    } */
    beginStep('convertToBiom')
   // const biom = await toBiom(filePaths.otuTable, filePaths.samples, filePaths.taxa, samplesAsColumns,  updateStatusOnCurrentStep , mapping, id)
   const biom = await processWorkBookFromFile(id, files.files[0].name, version, mapping, updateStatusOnCurrentStep)

    stepFinished('convertToBiom');
    beginStep('addReadCounts')
    await addReadCounts(biom, updateStatusOnCurrentStep)
    stepFinished('addReadCounts')
    await writeBiomFormats(biom, id, version)
    finishedJobSuccesssFully('success')
    } catch (error) {
        console.log(error)
        finishedJobWithError(error)   
    }
    
}




const id = process.argv[2]
const version = process.argv[3]

processDataset(id, version)


