
export default {
    "TSV_3_FILE": {
         "name": "3 file TSV format",
         "description": "3 tab-delimited files: ASV Table, metadata for samples, metadata for taxa/ASVs (including the sequence)"
    },
    "TSV_2_FILE": {
        "name": "2 file TSV format",
        "description": "2 tab-delimited files: ASV Table with taxa as rows + a sample metadata file. Metadata about the taxa (including the sequence) are given in columns before or after sample IDs."
    },
    "XLSX": {
        "name": "xlsx format",
        "description": "xlsx workbook with 3 sheets: ASV Table, metadata for samples, metadata for taxa/ASVs (including the sequence)"
    },
    "BIOM_1": {
        "name": "BIOM 1.0 format",
        "description": "A BIOM 1.0 file in JSON format. Must include metadata for both rows and columns, including the sequences for taxa/ASVs"
    },
    "BIOM_2_1": {
        "name": "BIOM 2.1 format",
        "description": "A BIOM 2.1 file in HDF5 format. Must include metadata for both rows and columns, including the sequences for taxa/ASVs"
    },
    "INVALID": {
        "name": "Invalid format",
        "description": "The supplied files can not be processed."
    }
    
 }