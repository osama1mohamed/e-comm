import { cartModel } from '../../database/index.js'
import { AppError, messages } from '../../utils/index.js'
import { productModel } from './../../database/models/product.model.js'

export const addToCart = async (req, res, next) => {
    const { productId, quantity } = req.body

    const productExist = await productModel.findById(productId)
    if (!productExist) {
        return next(new AppError(messages.product.notFound, 404))
    }

    if (!productExist.inStock(quantity)) {  
        return next(new AppError("Out of Stock", 400))
    }

    let data = ""
    const productInCart = await cartModel.findOneAndUpdate({ user: req.authUser._id, 'products.productId': productId }, { "products.$.quantity": quantity }, { new: true })
    let message = messages.cart.successUpdate
    data = productInCart

    if (!productInCart) {
        const cart = await cartModel.findOneAndUpdate({ user: req.authUser._id }, { $push: { products: { productId, quantity } } }, { new: true })
        message = "product added to cart"
        data = cart
    }

    return res.status(200).json({ message, data })
}