import dotenv from "dotenv"
import path from "path"
import Stripe from "stripe"
import { cartModel } from './../../database/models/cart.model.js'
import { couponModel } from './../../database/models/coupon.model.js'
import { orderModel } from './../../database/models/order.model.js'
import { productModel } from './../../database/models/product.model.js'
import { messages } from './../../utils/constant/messages.js'
import { AppError } from './../../utils/error.js'

const fullPath = path.resolve("../../utils/config/.env")
dotenv.config({ path: fullPath })

export const createOrder = async (req, res, next) => {
    const { phone, street, code, paymentMethod } = req.body

    let couponExist = 0
    if (code) {
        couponExist = await couponModel.findOne({ code: code })
        if (!couponExist) {
            return next(new AppError(messages.coupon.notFound, 404))
        }
    }

    const cart = await cartModel.findOne({ user: req.authUser._id })
    if (!cart) {
        return next(new AppError(messages.cart.notFound, 400))
    }

    const products = cart.products

    let orderPrice = 0
    let finalPrice = 0
    let orderProducts = []
    for (const product of products) {
        const productExist = await productModel.findById(product.productId)
        if (!productExist) {
            return next(new AppError(messages.product.notFound, 404))
        }
        if (!productExist.inStock(product.quantity)) {
            return next(new AppError("Out Of Stock", 400))
        }
        orderPrice += productExist.finalPrice * product.quantity
        orderProducts.push({
            productId: productExist._id,
            name: productExist.name,
            price: productExist.price,
            finalPrice: productExist.finalPrice,
            quantity: product.quantity,
            discount: productExist.discount
        })
    }

    couponExist.couponType == "fixedAmount" ?
        finalPrice = (orderPrice - couponExist.discount)
        : finalPrice = orderPrice - (orderPrice * ((couponExist.discount || 0) / 100))

    const order = new orderModel({
        user: req.authUser._id,
        address: {
            phone,
            street
        },
        coupon: {
            code,
            couponId: couponExist._id,
            discount: couponExist.discount
        },
        paymentMethod,
        products: orderProducts,
        orderPrice,
        finalPrice
    })

    const createdOrder = await order.save()
    if (!createOrder) {
        return next(new AppError(messages.order.failToCreate, 500))
    }

    if (paymentMethod === "visa") {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
        const checkout = await stripe.checkout.sessions.create({
            success_url: "https://www.google.com",
            cancel_url: "https://www.facebook.com",
            payment_method_types: ["card"],
            mode: "payment",
            metadata: {
                orderId: createdOrder._id.toString()
            },
            line_items: createdOrder.products.map(product => {
                return {
                    price_data: {
                        currency: "egp",
                        product_data: {
                            name: product.name,
                            
                        },
                        unit_amount: product.price * 100
                    },
                    quantity: product.quantity
                }
            })
        })
        return res.status(201).json({ message: messages.order.successCreate, data: checkout, url: checkout.url })
    }
    res.status(201).json({ message: messages.order.successCreate, data: createdOrder })
}
