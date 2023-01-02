const _ = require("lodash")
const util = require("../util")
const fs = require("fs");
const parse = require("csv-parse");
const transform = require("stream-transform");
const {streamReader} = util;
const DEFAULT_UNIT = "DNA sequence reads";
const BASIS_OF_RECORD = "Material Sample";

const writeMetaXml = async (occCore, dnaExt ) =>  await fs.promises.writeFile("../output/archive/meta.xml", util.metaXml(occCore, dnaExt))

const biomToDwc = async (biomData, termMapping) => {
    const reverseTaxonTerms = util.objectSwap(termMapping.taxa)
    const reverseSampleTerms = util.objectSwap(termMapping.samples)
    const taxonTerm = key => _.get(termMapping, `taxa.${key}`, key);
    const sampleTerm = key =>  _.get(termMapping, `samples.${key}`, key);
    const reverseSampleTerm = key => _.get(reverseSampleTerms, `${key}`, key);
    const reverseTaxonTerm = key => _.get(reverseTaxonTerms, `${key}`, key);
    const dnaTerms = await util.dwcTerms('dna_derived_data');
    const occTerms = await util.dwcTerms('dwc_occurrence');
    const taxonHeaders = Object.keys(_.get(biomData, 'rows[0].metadata'));
    const sampleHeaders = Object.keys(_.get(biomData, 'columns[0].metadata'));
    const relevantOccTerms  = [...sampleHeaders.filter(key => occTerms.has(sampleTerm(key))).map(key => occTerms.get(sampleTerm(key))),
        ...taxonHeaders.filter(key => occTerms.has(taxonTerm(key))).map(key => occTerms.get(taxonTerm(key)))];
    const relevantDnaTerms = [...sampleHeaders.filter(key => dnaTerms.has(sampleTerm(key))).map(key => dnaTerms.get(sampleTerm(key))),
        ...taxonHeaders.filter(key => dnaTerms.has(taxonTerm(key))).map(key => dnaTerms.get(taxonTerm(key))),
      ];
    await writeMetaXml([...relevantOccTerms, occTerms.get('sampleSizeValue'), occTerms.get('sampleSizeUnit'), occTerms.get('organismQuantity'), occTerms.get('organismQuantityType'), occTerms.get('basisOfRecord'), occTerms.get('eventID')],relevantDnaTerms)
     
    const occStream = fs.createWriteStream(`../output/archive/occurrence.txt`, {
        flags: "a",
      });
    const dnaStream = fs.createWriteStream(`../output/archive/dna.txt`, {
        flags: "a",
      });
     
    const getDataForTermfromSample = (sample, terms) => terms.filter(term => !!sample.metadata[reverseSampleTerm(term.name)]).map(term => sample.metadata[reverseSampleTerm(term.name)] || "").join("\t");
    const getDataForTermFromTaxon = (taxon, terms) => terms.filter(term => !!taxon.metadata[reverseTaxonTerm(term.name)]).map(term => taxon.metadata[reverseTaxonTerm(term.name)] || "").join("\t");
      biomData.columns.forEach((c) => {
         const rowData = biomData.getDataColumn(c.id);
         rowData.forEach((r, i) => {
            if(Number(r) > 0){
                // row = taxon, column = sample 
                const row = biomData.rows[i];
                const occurrenceId = `${c.id}:${row.id}`;
                const sampleId = c.id;
                occStream.write(`${occurrenceId}\t${getDataForTermfromSample(c, relevantOccTerms)}\t${getDataForTermFromTaxon(row, relevantOccTerms)}\t${_.get(c, 'metadata.readCount','')}\t${DEFAULT_UNIT}\t${r}\t${DEFAULT_UNIT}\t${BASIS_OF_RECORD}\t${sampleId}\n`);
                dnaStream.write(`${occurrenceId}\t${getDataForTermfromSample(c, relevantDnaTerms)}\t${getDataForTermFromTaxon(row, relevantDnaTerms)}\n`);
            }
         })
      })
}


const otuTableToDWC = async (otuTableFile, sampleFile, taxaFile, termMapping) => {
    const reverseTaxonTerms = util.objectSwap(termMapping.taxa)
    const reverseSampleTerms = util.objectSwap(termMapping.samples)
    const taxonTerm = key => _.get(termMapping, `taxa.${key}`, key);
    const sampleTerm = key =>  _.get(termMapping, `samples.${key}`, key);
    const reverseSampleTerm = key => _.get(reverseSampleTerms, `${key}`, key);
    const reverseTaxonTerm = key => _.get(reverseTaxonTerms, `${key}`, key);
    const dnaTerms = await util.dwcTerms('dna_derived_data');
    const occTerms = await util.dwcTerms('dwc_occurrence');

    const samples = await streamReader.readMetaDataAsMap(sampleFile, _.get(termMapping, 'samples.id', 'id'));
    const taxa = await streamReader.readMetaDataAsMap(taxaFile, _.get(termMapping, 'taxa.id', 'id'));
    console.log(`Taxa: ${taxa.size}`)
    console.log(`Samples: ${samples.size}`)
    
    const taxonHeaders = Object.keys(taxa.entries().next().value[1]);
    console.log(taxonHeaders)
    const sampleHeaders = Object.keys(samples.entries().next().value[1]);
    console.log(sampleHeaders)
    const relevantOccTerms  = [...sampleHeaders.filter(key => occTerms.has(sampleTerm(key))).map(key => occTerms.get(sampleTerm(key))),
        ...taxonHeaders.filter(key => occTerms.has(taxonTerm(key))).map(key => occTerms.get(taxonTerm(key)))];
    const relevantDnaTerms = [...sampleHeaders.filter(key => dnaTerms.has(sampleTerm(key))).map(key => dnaTerms.get(sampleTerm(key))),
        ...taxonHeaders.filter(key => dnaTerms.has(taxonTerm(key))).map(key => dnaTerms.get(taxonTerm(key))),
      ];
    await writeMetaXml([...relevantOccTerms, occTerms.get('sampleSizeValue'), occTerms.get('sampleSizeUnit'), occTerms.get('organismQuantity'), occTerms.get('organismQuantityType'),],relevantDnaTerms)

   
    const occStream = fs.createWriteStream(`../output/archive/occurrence.txt`, {
        flags: "a",
      });
    const dnaStream = fs.createWriteStream(`../output/archive/dna.txt`, {
        flags: "a",
      });
    const getDataForTermfromSample = (sample, terms) => terms.filter(term => !!sample[reverseSampleTerm(term.name)]).map(term => sample[reverseSampleTerm(term.name)] || "").join("\t");
    const getDataForTermFromTaxon = (taxon, terms) => terms.filter(term => !!taxon[reverseTaxonTerm(term.name)]).map(term => taxon[reverseTaxonTerm(term.name)] || "").join("\t");
    let sampleIdToArrayIndex;
    let count = 0;
    const transformer = transform((record, callback) => {
        if(!sampleIdToArrayIndex){
            sampleIdToArrayIndex = record;
            callback(null, '');
        } else {
            let taxon = taxa.get(record[0])
            let occurrences = "";
            for (let index = 1; index < record.length; index++) {
                // count is not 0 or undefined
                if(!isNaN(Number(record[index])) && Number(record[index]) > 0){
                    const sample = samples.get(sampleIdToArrayIndex[index]);
                    const occurrenceId = `${sample[_.get(termMapping, 'samples.id', 'id')]}:${taxon[_.get(termMapping, 'taxa.id', 'id')]}`;
                    const sampleId = sample[_.get(termMapping, 'samples.id', 'id')];
                    occurrences += `${occurrenceId}\t${getDataForTermfromSample(sample, relevantOccTerms)}\t${getDataForTermFromTaxon(taxon, relevantOccTerms)}\t${_.get(sample, 'readCount','')}\t${DEFAULT_UNIT}\t${record[index]}\t${DEFAULT_UNIT}\t${BASIS_OF_RECORD}\t${sampleId}\n`;
                    dnaStream.write(`${occurrenceId}\t${getDataForTermfromSample(sample, relevantDnaTerms)}\t${getDataForTermFromTaxon(taxon, relevantDnaTerms)}\n`);

                }
                
            }

            callback(null, occurrences);

        }
        count ++;
        if(count % 1000 === 0){
          console.log(count + " rows read")
          
        } 
                   
      }, {
        parallel: 5
      });
    const parser = parse( {
        delimiter: "\t",
        columns: false,
        ltrim: true,
        rtrim: true,
        quote: null
      })

    const inputStream = fs.createReadStream(otuTableFile);    
    inputStream.pipe(parser).pipe(transformer).pipe(occStream)
    inputStream.on('end', function(){
        console.log("Stream finished")
        inputStream.close()
        
    })

} 

module.exports = {
    biomToDwc,
    otuTableToDWC
}