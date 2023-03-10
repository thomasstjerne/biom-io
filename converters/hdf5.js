import {Biom} from 'biojs-io-biom';
import fs from 'fs'
import _ from 'lodash'
let h5wasm;
const generatedByString = "GBIF eDNA Tool";


const init = async () => {
    h5wasm = await import("h5wasm");
}

init();

const getIndptr = (sparseMatrix, idx, size) => {
    // idx 0 for rows, 1 for columns
    let index = sparseMatrix[0][idx];
    let indptr = [index];
    for(let i = 1; i < sparseMatrix.length; i ++){
        if(sparseMatrix[i][idx] > index){
            indptr.push(i)
            index = sparseMatrix[i][idx];
        }
    }
    if(indptr.length <= size){
        indptr.push(sparseMatrix.length)
    }
    return indptr;
}


const getTypeAndValues = (arr, attr) => {
    let length = -1;
    let type;
    let shape = [arr.length]
    if(_.isArray( _.get(arr[0], attr))){
        shape.push(_.get(arr[0], attr).length)
    }
    
    const values = arr.map(elm => {
        const data = _.get(elm, attr)
        if(_.isArray(data)){
            // haven´t figured out how to create array datatypes in h5wasm so far
            type = "S";
            let str = data.toString()
            if(str.length > length){
                length = str.length;
            }
        } else if(typeof data === 'string'){
            type = 'S';
            if(data.length > length){
                length = data.length;
            }
        } else if(type !== 'S' && typeof data === 'number'){
            type = 'f'
        } else {
            // console.log('H5 type guesser '+attr+ ' '+ typeof data)
            if(_.isUndefined(data) ){
                type = 'S';
                length = 1;
            }
        }
        return _.isUndefined(data) ? "" : data;
    })
        
    
    return {
        type: type === 'S' ? type+length : type,
        values,
        shape
    }
}

export const writeHDF5 = async (biom, hdf5file) => {
   // const jsonString = await fs.promises.readFile(file, {encoding: 'utf-8'})
   
  // const biom = await Biom.parse(jsonString, {});
  // console.log(biom.shape);
   // const h5wasm = await import("h5wasm");
    await h5wasm.ready;
    let columnOrientedSparseMatrix = [...biom.data].sort((a,b) => {
    return a[1] - b[1]
})

try {
    let f = new h5wasm.File(hdf5file, "w");

    /**
     * 
     * id                   : <string or null> a field that can be used to id a table (or null)
     *   type                 : <string> Table type (a controlled vocabulary)
                       Acceptable values:
                        "OTU table"
                        "Pathway table"
                        "Function table"
                        "Ortholog table"
                        "Gene table"
                        "Metabolite table"
                        "Taxon table"
     * format-url           : <url> A string with a static URL providing format details
     * format-version       : <tuple> The version of the current biom format, major and minor
     * generated-by         : <string> Package and revision that built the table
     * creation-date        : <datetime> Date the table was built (ISO 8601 format)
     * shape                : <list of ints>, the number of rows and number of columns in data
     * nnz                  : <int> The number of non-zero elements in the table
     */

    f.get("/").create_attribute('id', biom.id || "No Table ID", null, 'S')
    f.get("/").create_attribute('type', biom.type || "OTU table", null, 'S')
    f.get("/").create_attribute('format-url', biom["format-url"] || "https://biom-format.org/documentation/format_versions/biom-2.1.html", null, 'S')
     f.get("/").create_attribute('format-version', [2,1], [2], 'i')
     f.get("/").create_attribute('generated-by', generatedByString, null, 'S')
     f.get("/").create_attribute('creation-date', new Date().toISOString(), null, 'S')
     f.get("/").create_attribute('shape', biom.shape || [biom.rows.length, biom.columns.length], [2], 'i')
     f.get("/").create_attribute('nnz', biom.nnz || biom.data.length, null, 'i')

    f.create_group('observation'); // The HDF5 group that contains observation specific information and an observation oriented view of the data
    f.create_group('observation/matrix'); //  The HDF5 group that contains matrix data oriented for observation-wise operations (e.g., in compressed sparse row format)
    f.create_group('observation/metadata'); // The HDF5 group that contains observation specific metadata information
    f.create_group('observation/group-metadata');  // The HDF5 group that contains observation specific group metadata information (e.g., phylogenetic tree)
    f.create_group('sample') // The HDF5 group that contains sample specific information and a sample oriented data oriented view of the data
    f.create_group('sample/matrix') // The HDF5 group that contains sample specific information and a sample oriented data oriented view of the data
    f.create_group('sample/metadata') // The HDF5 group that contains matrix data oriented for sample-wise operations (e.g., in compressed sparse column format)
    f.create_group('sample/group-metadata') // The HDF5 group that contains sample specific metadata information
    
    const rowIds = getTypeAndValues(biom.rows, 'id')
   // console.log(rowIds)
    f.get("observation").create_dataset("ids", rowIds.values, rowIds.shape, rowIds.type); //  <string> or <variable length string> A (N,) dataset of the observation IDs, where N is the total number of IDs
    f.get("observation/matrix").create_dataset("data", biom.data.map((d) => d[2]), null, 'f' ); // <float64> A (nnz,) dataset containing the actual matrix data
    f.get("observation/matrix").create_dataset("indices", biom.data.map((d) => d[1]), null, 'i' ); // <int32> A (nnz,) dataset containing the column indices (e.g., maps into samples/ids)
    f.get("observation/matrix").create_dataset("indptr", getIndptr(biom.data, 0, biom.rows.length), null, 'i'); // <int32> A (M+1,) dataset containing the compressed row offsets
    const sampleIds = getTypeAndValues(biom.columns, 'id')
   // console.log(sampleIds)
    f.get("sample").create_dataset("ids", sampleIds.values, sampleIds.shape, sampleIds.type); //  <string> or <variable length string> A (N,) dataset of the observation IDs, where N is the total number of IDs
    f.get("sample/matrix").create_dataset("data",  columnOrientedSparseMatrix.map((d) => d[2]), null, 'f'); // <float64> A (nnz,) dataset containing the actual matrix data
    f.get("sample/matrix").create_dataset("indices",  columnOrientedSparseMatrix.map((d) => d[0]), null, 'i'); // <int32> A (nnz,) dataset containing the row indices (e.g., maps into observation/ids)
    f.get("sample/matrix").create_dataset("indptr", getIndptr(columnOrientedSparseMatrix, 1, biom.columns.length), null, 'i'); // <int32> A (M+1,) dataset containing the compressed row offsets
    
    try {
        Object.keys(biom.columns[0].metadata).forEach(key => {
            const data = getTypeAndValues(biom.columns, `metadata.${key}`);
            f.get('sample/metadata').create_dataset(key,data.values, data.shape, data.type)
        })       
    } catch (error) {
        console.log(error)
    }
   try {
        Object.keys(biom.rows[0].metadata).forEach(key => {
            const data = getTypeAndValues(biom.rows, `metadata.${key}`);
            f.get('observation/metadata').create_dataset(key, data.values, null, data.type)
        }) 

    } catch (error) {
        console.log(error)   
    } 
    
    f.close()

} catch (error) {
     console.log(error)
}
    
}

// returns a Biom object
export const readHDF5 = async (hdf5file) => {
   // const h5wasm = await import("h5wasm");
    await h5wasm.ready;
    
    let f = new h5wasm.File(hdf5file/* "rich_sparse_otu_table_hdf5.biom" */, "r");
    console.log(f.keys())
    const data = f.get("observation/matrix/data").to_array();
    const indices = f.get("observation/matrix/indices").to_array();
    const indptr = f.get("observation/matrix/indptr").to_array();
    const sampleIds = f.get("sample/ids").to_array()
    const observationIds = f.get("observation/ids").to_array()
    
    // console.log(f.get("observation/matrix/data").dtype)
    // console.log(f.get("observation/matrix/indices").to_array())
    // console.log(f.get("observation/matrix/indptr").to_array())
    // console.log(f.get("sample/metadata").keys())
    
    let sampleMetaData = {};
    f.get("sample/metadata").keys().forEach(key => {
        sampleMetaData[key] = f.get(`sample/metadata/${key}`).to_array()
    });
    
    let observationMetaData = {};
    f.get("observation/metadata").keys().forEach(key => {
        observationMetaData[key] = f.get(`observation/metadata/${key}`).to_array()
    });
    // console.log( f.get(`observation/metadata/taxonomy`).dtype)
    let indptrIdx = 0;
    let numRows = indptr[indptrIdx +1] - indptr[indptrIdx];
    const sparseMatrix = data.map((d, idx) => {
        let res = [indptrIdx ,indices[idx], d];
        numRows --;
        if(numRows === 0 ){
            indptrIdx++
            numRows = indptr[indptrIdx +1] - indptr[indptrIdx];
        }
        return res;
    })
    
    const rows = observationIds.map((id, idx) => ({id, metadata: Object.keys(observationMetaData).reduce((acc, curr) => {
       // console.log(curr)
        acc[curr] = observationMetaData[curr][idx]
        return acc;
    },{})}))
    
    const columns = sampleIds.map((id, idx) => ({id, metadata: Object.keys(sampleMetaData).reduce((acc, curr) => {
       // console.log(curr)
        acc[curr] = sampleMetaData[curr][idx];
        return acc;
    },{})}))
    try {
        const id = _.get(f.get("/"), 'attrs["id"].value')
        console.log(id) 
    } catch (error) {
        console.log(id)   
    }
    
    //console.log(JSON.stringify(sparseMatrix, null, 2))
     try {
        const id = _.get(f.get("/"), 'attrs["id"].value', 'No Table ID')
        const format = _.get(f.get("/"), 'attrs["format"].value', "Biological Observation Matrix 1.0.0")
        const format_url = _.get(f.get("/"), 'attrs["format_url"].value', 'http://biom-format.org/documentation/format_versions/biom-1.0.html')
        const type = _.get(f.get("/"), 'attrs["type"].value', "OTU table")
        const date =  new Date().toISOString();
        const generated_by = generatedByString;
        const biom = new Biom({
            id,
            format,
            format_url,
            type,
            date,
            generated_by,
            rows,
            columns,
            matrix_type: 'sparse',
            shape: [observationIds.length, sampleIds.length],
            data: sparseMatrix
          })
        
          return biom
         // console.log(JSON.stringify(biom, null, 2)) 
    } catch (error) {
        console.log(error)
    } 
      
    }

