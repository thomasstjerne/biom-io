import { writeBiom, toBiom, addReadCounts } from '../converters/biom.js';
import { writeHDF5 } from '../converters/hdf5.js'
import config from '../config.js'
import _ from 'lodash'
import { getCurrentDatasetVersion, writeProcessingReport, wipeGeneratedFilesAndResetProccessing, readTsvHeaders, readMapping } from '../util/filesAndDirectories.js'
import { determineFileNames, otuTableHasSamplesAsColumns, otuTableHasSequencesAsColumnHeaders } from '../validation/tsvformat.js'
import {updateStatusOnCurrentStep, beginStep, stepFinished, hdf5Errors, finishedJobSuccesssFully, finishedJobWithError, writeBiomFormats} from "./util.js"




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

