import util from "../util/index.js";
import license from "../enum/license.js";
import format from "../enum/format.js";
export default  (app) => {

    app.get("/enum/license", async (req, res) => {

        try {
        res.json(license)
        } catch (error) {
            res.sendStatus(500)
        }     
        
    })

    app.get("/enum/format", async (req, res) => {

        try {
        
        res.json(format)
        } catch (error) {
            res.sendStatus(500)
        }     
        
    })

}