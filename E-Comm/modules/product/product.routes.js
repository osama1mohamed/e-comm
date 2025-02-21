import { Router } from "express"
import { isValid } from "../../middlewares/validation.js"
import { isAuthenticated } from "../../middlewares/authentication.js"
import { isAuthorized } from "../../middlewares/authorization.js"
import { catchAsyncError, cloudinaryUpload } from '../../utils/index.js'
import { addProduct, deleteProduct, getOneProduct, getProducts, updateProduct } from "./product.controllers.js"
import { addProductSchema, findOneAndDeleteProductSchema, updateProductSchema } from "./product.validation.js"

const productRouter = Router()

productRouter.route('/')
    .post(
        [
            isAuthenticated(),
            isAuthorized(["admin"]),
            cloudinaryUpload("product").fields([{ name: "mainImage", maxCount: 1 }, { name: "subImages", maxCount: 10 }]),
            isValid(addProductSchema)
        ],
        catchAsyncError(addProduct)) 
    .get(catchAsyncError(getProducts))

productRouter.route('/:productId')
    .put(
        [
            isAuthenticated(),
            isAuthorized(["admin"]),
            cloudinaryUpload("product").fields([{ name: "mainImage", maxCount: 1 }, { name: "subImages", maxCount: 10 }]),
            isValid(updateProductSchema)
        ],
        catchAsyncError(updateProduct))
    .get(isValid(findOneAndDeleteProductSchema), catchAsyncError(getOneProduct))
    .delete(
        [
            isAuthenticated(),
            isAuthorized(["admin"]),
            isValid(findOneAndDeleteProductSchema)
        ],
        deleteProduct)
export default productRouter