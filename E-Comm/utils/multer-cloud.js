import multer from "multer"
import { AppError } from "./error.js"

const cloudinaryUpload = (folder) => {
    const storage = multer.diskStorage({})

    function fileFilter(req, file, cb) {
        if (file.mimetype.startsWith('image')) {
            cb(null, true)
        }
        else {
            cb(null, false)
            cb(new AppError('Accepts Images Only'))
        }
    }

    return multer({ storage: storage, fileFilter: fileFilter })
}

export default cloudinaryUpload