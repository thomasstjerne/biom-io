export default {
    sample: {
        required: {
            'id': {
                description: "The sample id corresponding to the column header in the OTU table",
                synonyms: []
            },
            'eventDate': {
                description: "The date when the sample was collected from its environment",
                synonyms: ['date']
            }, 
            'decimalLatitude': {
                description: "The latitude of the sample",
                synonyms: ['latitude', 'lat']
            } , 
            'decimalLongitude': {
                description: "The longitude of the sample",
                synonyms: ['longitude', 'lng', 'lon', 'long']
            } , 
            
        },
        recommended: {

        }
        
    },
    taxon: {
        required: {
            'id': {
                description: "The OTU id corresponding to the row identifier in the OTU table"
            },
            'DNA_sequence': {
                description: "The DNA sequence"
            },
            'target_gene': {
                description: "The marker / target gene. Eaxmples: ITS, 16S, 12S, COI",
                synonyms: ['marker']
            } , 
             
        }
    },
    recommended: {
        'kingdom': {
            description: ""
        },
        'phylum': {
            description: ""
        },
        'class': {
            description: ""
        },
        'order': {
            description: ""
        },
        'family': {
            description: ""
        },
        'genus': {
            description: ""
        },
        'scientificName': {
            description: "This could be the species name (binomial) if the match identity is good. If the species is unknown, use the closest know higher taxon regardless of rank."
        },
        'otu_db': {
            description: "Database used for classification. Strongly recommended if identifictations of OTUs are provided.",
            synonyms: ['reflib']
        } ,
            
    }
    
}