import util from "../util/index.js";
import requiredDwcterms from "../enum/requiredDwcterms.js";
import defaultValueterms from "../enum/defaultValueterms.js";
export default  (app) => {

    app.get("/terms/dwc", async (req, res) => {

        try {
            const dnaTemMap = await util.dwcTerms('dna_derived_data')
        const occTemMap = await util.dwcTerms('dwc_occurrence')

        res.json({...Object.fromEntries(occTemMap), ...Object.fromEntries(dnaTemMap)})
        } catch (error) {
            res.sendStatus(500)
        }     
        
    })

    app.get("/terms/required", async (req, res) => {

        try {
        
        res.json(requiredDwcterms)
        } catch (error) {
            res.sendStatus(500)
        }     
        
    })


    app.get("/terms/defaultvalue", async (req, res) => {

        try {
        
        res.json(defaultValueterms)
        } catch (error) {
            res.sendStatus(500)
        }     
        
    })

}