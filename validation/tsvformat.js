import fs from 'fs'
import config from '../config.js'
import {execSync}  from 'child_process';
import filenames from './filenames.js'
import parse from 'csv-parse';
import streamReader from '../util/streamReader.js'
import {readTsvHeaders} from '../util/filesAndDirectories.js'
const dnaSequencePattern = /[ACGTURYSWKMBDHVNacgturyswkmbdhvn]/g
const minimumLengthForASequence = 100;


export const determineFileNames = async (id, version) => {
    console.log('determineFileNames')
    try {
        const fileList = await fs.promises.readdir(`${config.dataStorage}${id}/${version}/original`)
        console.log(fileList)
        const otutable = fileList.find(f => {
            let splitted = f.split('.') // ignore file extension
            let rawFileName = splitted.slice(0,-1).join('.').replace(/[^0-9a-z]/gi, '').toLowerCase();
            return filenames.otutable.indexOf(rawFileName) > -1;
        })
        console.log(`OTU table ${otutable}`)
        const samples = fileList.find(f => {
            let splitted = f.split('.')// ignore file extension
            let rawFileName = splitted.slice(0,-1).join('.').replace(/[^0-9a-z]/gi, '').toLowerCase();
            return filenames.samples.indexOf(rawFileName) > -1;
        })

        console.log(`samples ${samples}`)
        let taxa = fileList.length === 3 ? fileList.find(f => {
            let splitted = f.split('.')// ignore file extension
            let rawFileName = splitted.slice(0,-1).join('.').replace(/[^0-9a-z]/gi, '').toLowerCase();
            return filenames.taxa.indexOf(rawFileName) > -1;
        }) : null;

        console.log(`taxa ${taxa}`)
        let result = {
            otuTable: `${config.dataStorage}${id}/${version}/original/${otutable}`,
            samples: `${config.dataStorage}${id}/${version}/original/${samples}`
        }
        if(taxa){
            result.taxa = `${config.dataStorage}${id}/${version}/original/${taxa}`
        }
        return result;
    } catch (error) {
        console.log(error)
        throw error;
    }

}

export const otuTableHasSamplesAsColumns = async files => {
    console.log("hasSamplesAsColumns")
    try {
        const samples = await streamReader.readMetaData(files.samples); // readTsvHeaders(`${config.dataStorage}${id}/${version}/original/${files.samples}`);
        const otuTableColumns = await readTsvHeaders(files.otuTable);
        const columns = new Set(otuTableColumns.slice(1));
        let sampleIdsNotInOtuTableColumns = 0;
        samples.forEach(s => {
            if(!columns.has(s.id)){
                sampleIdsNotInOtuTableColumns ++;
            }
        })
        console.log(`samples with no match in OTU table ${sampleIdsNotInOtuTableColumns}`)
        // more than 95% of the samples has a corresponding column - we could be more strict?
        const hasSamplesAsColumns = (sampleIdsNotInOtuTableColumns /  samples.length * 100 ) < 5;
        return hasSamplesAsColumns;

    } catch (error) {
        throw error;
    }
}

export const otuTableHasSequencesAsColumnHeaders = async files => {
    console.log("otuTableHasSequencesAsColumnHeaders")

    try {
        const otuTableColumns = await readTsvHeaders(files.otuTable);
        const columns = otuTableColumns.slice(1);
        console.log("Number of columns "+columns.length)
        let isSequenceHeaders = true;

        for(let i = 0; i < Math.min(columns.length, 10); i++){
            if(columns[i].length < minimumLengthForASequence || !dnaSequencePattern.test(columns[i])){
                isSequenceHeaders = false;
            }
        }
        return isSequenceHeaders;      

    } catch (error) {
        throw error;
    }
}