
import {deleteFile, getCurrentDatasetVersion} from '../util/filesAndDirectories.js'


const deleteUploadedFile = async function (req, res) {
    if (!req.params.id || !req.params.filename) {
      res.sendStatus(400);
    } else {
        try {
            let version = req?.query?.version;
            if(!version){
                version = await getCurrentDatasetVersion(req.params.id)
            } 
            await deleteFile(req.params.id, version, req.params.filename)
            res.sendStatus(200) 
        } catch (error) {
            console.log(error)
            res.sendStatus(500)
        }
    }
  };

export default  (app) => {
    app.delete("/dataset/:id/file/:filename", deleteUploadedFile);

}