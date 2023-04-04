import { getCurrentDatasetVersion, getMetadata, getProcessingReport, readMapping } from './filesAndDirectories.js'
import { uploadedFilesAndTypes} from '../validation/files.js'


export const getDataset = async (id, version) =>  {
    try {
        if(!version){
            version = await getCurrentDatasetVersion(id);
        } 
        console.log("getProcessingReport")
        let report = await getProcessingReport(id, version);
       
        if(!report){
            report = {id: id, version: version}
        }
        console.log("files")
        const files = await uploadedFilesAndTypes(id, version)
        if(!!files){
            report.files = files
        }
        console.log("readMapping")
        const mapping = await readMapping(id, version);
        if(!!mapping){
            report.mapping = mapping
        }
        console.log("getMetadata")
        const metadata = await getMetadata(id, version)
        if(!!metadata){
            report.metadata = metadata
        }
        console.log("report")
        return report
    } catch (error) {
        console.log(error)
        return null
    }
}