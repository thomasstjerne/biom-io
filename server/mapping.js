
import * as url from 'url';
import fs from 'fs';
import {writeMapping, getCurrentDatasetVersion} from '../util/filesAndDirectories.js'


const saveMapping = async function (req, res) {
    if (!req.params.id) {
      res.sendStatus(400);
    } else {
        try {
            let version = req?.query?.version;
            if(!version){
                version = await getCurrentDatasetVersion(req.params.id)
            } 
            await writeMapping(req.params.id, version, req.body)
            
           // console.log(eml)
            res.send(req.body) 
        } catch (error) {
            console.log(error)
            res.sendStatus(500)
        }
    }
  };

export default  (app) => {
    app.put("/dataset/:id/mapping", saveMapping);
    app.post("/dataset/:id/mapping", saveMapping);

}