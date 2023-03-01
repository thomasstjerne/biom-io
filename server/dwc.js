
import * as url from 'url';
import fs from 'fs';
import { getProcessingReport, writeProcessingReport, getMetadata, getCurrentDatasetVersion, readBiom, zipDwcArchive, rsyncToPublicAccess} from '../util/filesAndDirectories.js'
import {registerDatasetInGBIF} from '../util/gbifRegistry.js'
import { biomToDwc } from '../converters/dwc.js';
import config from '../config.js'
import queue from 'async/queue.js';
const runningJobs = new Map();


 const q = queue(async (options) => {
    const {id, version} = options;
    console.log("Options "+ JSON.stringify(options) )
    let job = runningJobs.get(id);
    job.summary = {};
    try {
        job.version = version;
        job.steps = job.steps.filter(j => j.status !== 'queued');

        job.steps.push({ status: 'processing', message: 'Reading Biom', time: Date.now() })
        runningJobs.set(id, job);
        console.log("Read Biom")

        const biom = await readBiom(id, version)
        job.steps.push({ status: 'processing', message: 'Writing Darwin Core', time: Date.now() })
        runningJobs.set(id, job);
        console.log("Write Dwc")
        await biomToDwc(biom, undefined, `${config.dataStorage}${id}/${version}`)
        console.log("Dwc written")
        job.steps.push({ status: 'processing', message: 'Zipping files', time: Date.now() })
        runningJobs.set(id, job);
        await zipDwcArchive(id, version)
        console.log("Archive zipped")
        job.steps.push({ status: 'processing', message: 'Copying archive to public URI', time: Date.now() })
        runningJobs.set(id, job);
        console.log("Archive copied to public access url")
        await rsyncToPublicAccess(id, version)
        job.steps.push({ status: 'processing', message: 'Registering dataset in GBIF', time: Date.now() })
        runningJobs.set(id, job);
        const gbifDatasetKey = await registerDatasetInGBIF(id, config.gbifUsername, config.gbifPassword)
        job.gbifDatasetKey = gbifDatasetKey;
        runningJobs.set(id, job);
        console.log("Dataset registered in GBIF, crawl triggered")
    } catch (error) {
        console.log(error)
        
       throw error
    }

}, 3)

const pushJob = async (id, version) => {
    runningJobs.set(id, { id: id, version, steps: [{ status: 'queued', time: Date.now() }] })
    try {
       
        q.push({ id: id, version }, async (error, result) => {
            if (error) {
                console.log(error);
                let job = runningJobs.get(id);
                job.steps.push({ status: 'failed', message: error?.message, time: Date.now() })
                runningJobs.delete(id)
                //runningJobs.set(id, {...runningJobs.get(id), status: 'failed'} )
               // throw error
            } else {
                let job = runningJobs.get(id);
                job.steps.push({ status: 'finished', time: Date.now() })
                let report = await getProcessingReport(id, version);
                report.dwc = job;
                await writeProcessingReport(id, version, report)
                runningJobs.delete(id)
            }
        })
    } catch (error) {
        console.log(error)
        throw error
    }
} 

const processDwc = async function (req, res) {

    console.log("processDwc")
    if (!req.params.id) {
      res.sendStatus(400);
    } else {
        try {
            let version = req?.query?.version;
            if(!version){
                version = await getCurrentDatasetVersion(req.params.id)
            } 
            console.log("Version "+version)
           
                if(!runningJobs.has(req.params.id, version)){
                    console.log("Push job")
                    pushJob(req.params.id, version );
                    res.sendStatus(201)
                } else {
                    res.sendStatus(302)
                }
                
           
           
           // console.log(eml)
           // res.sendStatus(201)
        } catch (error) {
            console.log(error)
            res.sendStatus(500)
        }
    }
  };


export default  (app) => {
    app.post("/dataset/:id/dwc", processDwc);

    app.get("/dataset/:id/dwc/:version?", async (req, res) => {
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
                    /* let data = {...job};
                    if(!!metadata){
                        data.metadata = metadata
                    } */
                    res.json({dwc: job});
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
    })



}