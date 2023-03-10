/* const fs = require("fs");
const parse = require("csv-parse"); */
import fs from 'fs';
import parse from 'csv-parse';
// import streamReader from '../util/streamreader.js';

export const readOtuTable = (path,  progressFn = ()=>{}) => {
    return new Promise((resolve, reject) => {
        const parser = parse( {
            delimiter: "\t",
            columns: false,
            ltrim: true,
            rtrim: true,
            quote: null,
            from_line: 2
          })
        const records = [];
        let count = 0;
        parser.on('readable', function(){
            let record;
            while ((record = parser.read()) !== null) {
              records.push(record);
              count ++;
              if(count % 10000 === 0){
                console.log("Count "+count)
              }
            }
          });
          // Catch any error
          parser.on('error', function(err){
            console.error(err.message);
            reject(err)
          });
          // Test that the parsed records matched the expected records
          parser.on('end', function(){
            resolve(records)
          });
        const inputStream = fs.createReadStream(path);    
        inputStream.pipe(parser)
    })

}

export const readOtuTableToSparse = (path, progressFn = (progress, total, message, summary)=>{}) => {
  return new Promise((resolve, reject) => {
      const parser = parse( {
          delimiter: "\t",
          columns: false,
          ltrim: true,
          rtrim: true,
          quote: null
         // from_line: 2
        })
      const records = [];
      let colums;
      const rows = [];
      let count = 0; // this is also the row index
      parser.on('readable', function(){
          let record;
          while ((record = parser.read()) !== null) {
            if(!colums){
              colums = record.slice(1); // This is the header which gives the column order for the matrix
            } else {
              record.slice(1).forEach((element, index) => {
                if(!isNaN(Number(element)) && Number(element) > 0){
                  records.push([count, index, Number(element)])
                  
                }
              });
              // collect ordering of rows to sort metadata file
              rows.push(record[0]);
              count ++;
              if(count % 10000 === 0){
                console.log("Count "+count)
              }
              if(count % 1000 === 0){
                progressFn(count)
              }
            }       
          }
        });
        // Catch any error
        parser.on('error', function(err){
          console.error(err.message);
          reject(err)
        });
        // Test that the parsed records matched the expected records
        parser.on('end', function(){
          resolve([records, rows, colums])
        });
      const inputStream = fs.createReadStream(path);    
      inputStream.pipe(parser)
  })

}

export const readMetaData = (path,  progressFn = ()=>{}) => {
      return new Promise((resolve, reject) => {
        const parser = parse({
            delimiter: "\t",
            columns: true,
            ltrim: true,
            rtrim: true,
            quote: null,
          })
        const records = [];
        let count = 0;
        parser.on('readable', function(){
            let record;
            while ((record = parser.read()) !== null) {
              records.push(record);
              count ++;
              if(count % 1000 === 0){
                progressFn(count)
              //  console.log("Count "+count)
              }
            }
          });
          // Catch any error
          parser.on('error', function(err){
            console.error(err.message);
            reject(err)
          });
          // Test that the parsed records matched the expected records
          parser.on('end', function(){
            resolve(records)
          });
        const inputStream = fs.createReadStream(path);    
        inputStream.pipe(parser)
    })
}

export const readMetaDataAsMap = (path, idHeader = 'id', progressFn = ()=>{}) => {
    return new Promise((resolve, reject) => {
      const parser = parse({
          delimiter: "\t",
          columns: true,
          ltrim: true,
          rtrim: true,
          quote: null,
        })
      const records = new Map();
      let count = 0;
      parser.on('readable', function(){
          let record;
          while ((record = parser.read()) !== null) {
             // console.log(record)
            
            records.set(record[idHeader], record)  //.push(record);
           count++;
            if(count % 1000 === 0){
              try {
                progressFn(count)
              } catch (error) {
                console.log(error)
              }
              
              //  console.log("Count "+count)
              } 
          }
        });
        // Catch any error
        parser.on('error', function(err){
          console.error(err.message);
          reject(err)
        });
        // Test that the parsed records matched the expected records
        parser.on('end', function(){
          resolve(records)
        });
      const inputStream = fs.createReadStream(path);    
      inputStream.pipe(parser)
  })
}

export default {
  readOtuTable,
  readOtuTableToSparse,
  readMetaData,
  readMetaDataAsMap
}

/* module.exports = {
    readOtuTable,
    readOtuTableToSparse,
    readMetaData,
    readMetaDataAsMap
} */

/* const test = () => {
   // readMetaData('../input/biowide/sample.tsv')
   readOtuTable('../input/biowide/OTU_table.tsv')
}

test() */