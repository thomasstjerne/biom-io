const biom = require("./biom")
const _ = require("lodash")
const util = require("../util")
const fs = require("fs");
const DEFAULT_UNIT = "DNA sequence reads";

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
    await writeMetaXml([...relevantOccTerms, occTerms.get('sampleSizeValue'), occTerms.get('sampleSizeUnit'), occTerms.get('organismQuantity'), occTerms.get('organismQuantityType'),],relevantDnaTerms)
     
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
                occStream.write(`${occurrenceId}\t${getDataForTermfromSample(c, relevantOccTerms)}\t${getDataForTermFromTaxon(row, relevantOccTerms)}\t${_.get(c, 'metadata.readCount','')}\t${DEFAULT_UNIT}\t${r}\t${DEFAULT_UNIT}\n`);
                dnaStream.write(`${occurrenceId}\t${getDataForTermfromSample(c, relevantDnaTerms)}\t${getDataForTermFromTaxon(row, relevantDnaTerms)}\n`);
            }
         })
      })
}




const test = async () => {
    const termMapping = {
        'taxa': {
            'sequence': 'DNA_sequence',
            'species': 'scientificName'
        },
        'samples': {
            'id': 'eventID',
            'site_name': 'locality',
            'marker': 'target_gene'
        } 
    }
    try {
        let biomData = await biom.toBiom(`../input/biowide/OTU_table.tsv`,`../input/biowide/sample.tsv`,`../input/biowide/taxa.tsv`);


        biomToDwc(biomData, termMapping);

       /*   console.log(biom.getDataAt("39efbae3f448393c8795c2ee920ab1041e947c37", "NV001"))
        console.log(biom.getDataAt("39efbae3f448393c8795c2ee920ab1041e947c37", "NV002"))
        console.log(biom.getDataAt("39efbae3f448393c8795c2ee920ab1041e947c37", "NV003"))
        console.log(biom.getDataAt("39efbae3f448393c8795c2ee920ab1041e947c37", "NV004")) 
       // console.log(biom.getDataRow("39efbae3f448393c8795c2ee920ab1041e947c37"))
       console.log(biom.getDataColumn('NV004').reduce((partialSum, a) => partialSum + Number(a), 0));
       console.log(biom.columns.find(c => c.id === 'NV004').metadata.readCount) */



  
    } catch (error) {
        console.log(error)
    }
}

test()