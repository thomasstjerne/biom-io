import multer from "multer";
import fs from 'fs';
import config from '../config.js'



const storage = multer.diskStorage({
  //Specify the destination directory where the file needs to be saved
  destination: function (req, file, cb) {
    let id = req?.params?.id ?? req.id;
    const dir = config.dataStorage + id + `/${req?.params?.version ?? "1"}` + "/original";
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir)
  },
  //Specify the name of the file. The date is prefixed to avoid overwriting of files.
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  },
})

const upload = multer({
  storage: storage,
})

export default upload