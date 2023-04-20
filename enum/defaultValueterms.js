export default [
    {
        name: 'otu_db',
        description: "Database used for classification. Strongly recommended if identifictations of OTUs are provided.",
        defaultRequired: false,
        biomGroup: 'observation'
    },
    {
        name: 'target_gene',
        description: "The marker / target gene. Examples: ITS, 16S, 12S, COI",
        defaultRequired: true,
        vocabulary: ["COI", "ITS", "ITS1", "ITS2", "16S", "18S", "23S", "5S"],
        biomGroup: 'observation'
    }   

]