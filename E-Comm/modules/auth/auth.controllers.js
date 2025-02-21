import bcrypt from "bcrypt"
import dotenv from 'dotenv'
import path from 'path'
import { cartModel, userModel } from "../../database/index.js"
import { AppError, cloudinary, generateToken, messages, sendEmail, verifyToken } from "../../utils/index.js"


const fullPath = path.resolve("../../utils/config/.env")
dotenv.config({ path: fullPath })

export const signup = async (req, res, next) => {
    const { username, email, password, phone, DOP } = req.body

    const userExist = await userModel.findOne({ $or: [{ email }, { phone }] })
    if (userExist) {
        return next(new AppError(messages.user.alreadyExist, 409))
    }
    const hashedPassword = await bcrypt.hash(password, 7)
    const user = new userModel({
        username,
        email,
        password: hashedPassword,
        phone,
        DOP
    })

    const token = generateToken({ payload: { email }, secretKey: process.env.CONFIRM_EMAIL_SECRET })

    await sendEmail({
        to: email, subject: "verify your account",
        html: `<p>to verify your account click <a href="${req.protocol}://${req.headers.host}/api/auth/verify?token=${token}">link</a></p>`
    })

    const createdUser = await user.save()
    if (!createdUser) {
        return next(new AppError(messages.user.failToCreate, 500))
    }

    res.status(201).json({
        status: 'success',
        message: messages.user.successCreate,
        data: createdUser
    })
}

export const verifyAccount = async (req, res, next) => {
    const { token } = req.query

    const payload = verifyToken({ token, secretKey: process.env.CONFIRM_EMAIL_SECRET })
    if (!payload) {
        return next(new AppError(messages.token.invalid, 400))
    }

    const user = await userModel.findOneAndUpdate({ email: payload.email, status: "pending" }, { status: "verified" })
    if (!user) {
        return next(new AppError(messages.user.notFound, 404))
    }

    await cartModel.create({ user: user._id })
        .catch((err) => {
            next(new AppError("fail to create cart", 500))
        })

    res.status(200).json({
        status: 'success',
        message: messages.user.successVerify
    })
}

export const signIn = async (req, res, next) => {
    const { email, phone, password } = req.body

    const userExist = await userModel.findOne({ $or: [{ email }, { phone }], status: "verified" })
    if (!userExist) {
        return next(new AppError('invalid credentials', 401))
    }

    const isMatch = await bcrypt.compare(password, userExist.password)
    if (!isMatch) {
        return next(new AppError('invalid credentials', 401))
    }

    const token = generateToken({ payload: { _id: userExist._id, email: userExist.email, phone: userExist.phone, role: userExist.role }, secretKey: process.env.ACCESS_TOKEN_SECRET })

    res.status(200).json({
        status: 'success',
        message: 'login success',
        data: { token }
    })
}

export const changeImage = async (req, res, next) => {

    if (!req.file) {
        return next(new AppError(messages.file.required, 400))
    }
    const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, { folder: "e-commerce/users" })
    if (!secure_url || !public_id) {
        return next(new AppError(messages.file.failToUpload, 500))
    }

    const updatedUser = await userModel.findOneAndUpdate({ email: req.authUser.email }, { image: { secure_url, public_id } })
    if (!updatedUser) {
        await cloudinary.uploader.destroy(public_id)
        return next(new AppError(messages.user.failToUpdate, 500))
    }

    res.status(200).json({
        status: 'success',
        message: messages.user.successUpdate,
        data: updatedUser
    })
}