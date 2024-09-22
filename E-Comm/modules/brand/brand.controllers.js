import slugify from 'slugify'
import { AppError, messages, cloudinary, ApiFeature } from '../../utils/index.js'
import { brandModel, productModel, reviewModel } from '../../database/index.js'


export const addBrand = async (req, res, next) => {
    let { name } = req.body
    name = name.trim().toLowerCase()

    if (!req.file) {
        return next(new AppError(messages.file.required, 400))
    }
    const existedBrand = await brandModel.findOne({ name: name })
    if (existedBrand) {
        return next(new AppError(messages.brand.alreadyExist, 409))
    }

    const slug = slugify(name)
    const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, { folder: "e-commerce/brands" })
    if (!secure_url || !public_id) {
        return next(new AppError(messages.file.failToUpload, 500))
    }

    const brand = new brandModel({
        name,
        slug,
        logo: { secure_url: secure_url, public_id: public_id },
        createdBy: req.authUser._id,
    })

    const createdBrand = await brand.save()
    if (!createdBrand) {
        await cloudinary.uploader.destroy(public_id).catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })
        return next(new AppError(messages.brand.failToCreate, 500))
    }

    res.status(201).json({
        status: 'success',
        message: messages.brand.successCreate,
        data: createdBrand
    })

}

export const getBrands = async (req, res, next) => {

    const apiFeature = new ApiFeature(brandModel.find(), req.query)
        .pagination()

    const brands = await apiFeature.mongooseQuery

    if (!brands) {
        next(new AppError(messages.brand.failToGetAll, 500))
    }
    res.status(200).json({
        status: 'success',
        message: messages.brand.successFindAll,
        data: brands,
    })

}

export const updateBrand = async (req, res, next) => {
    let { name } = req.body
    const { brandId } = req.params

    name && name.trim().toLowerCase()

    const existedBrand = await brandModel.findById(brandId)
    if (!existedBrand) {
        return next(new AppError(messages.brand.notFound, 404))
    }

    const isNameExist = await brandModel.findOne({ name: name, _id: { $ne: brandId } })
    if (isNameExist) {
        return next(new AppError(messages.brand.alreadyExist, 409))
    }

    if (req.file) {
        await cloudinary.uploader.destroy(existedBrand.logo.public_id).catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })
        const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, { folder: "e-commerce/brands" })
        if (!secure_url || !public_id) {
            return next(new AppError(messages.file.failToUpload, 500))
        }
        existedBrand.logo = { secure_url: secure_url, public_id: public_id }
    }

    if (name) {
        existedBrand.name = name
        existedBrand.slug = slugify(name)
    }

    existedBrand.updatedBy = req.authUser._id

    const updatedBrand = await existedBrand.save()
    if (!updatedBrand) {
        req.file && await cloudinary.uploader.destroy(public_id) 
            .catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })

        return next(new AppError(messages.brand.failToUpdate, 500))
    }

    res.status(200).json({
        status: 'success',
        message: messages.brand.successUpdate,
        data: updatedBrand
    })

}

export const getOneBrand = async (req, res, next) => {
    const { brandId } = req.params
    const brand = await brandModel.findById(brandId)
    if (!brand) {
        return next(new AppError(messages.brand.notFound, 404))
    }
    res.status(200).json({
        status: 'success',
        message: messages.brand.successFindOne,
        data: brand
    })
}

export const deleteBrand = async (req, res, next) => {
    const { brandId } = req.params

    const existedBrand = await brandModel.findById(brandId).populate([
        { path: 'products', select: "mainImage subImages" } 
    ])
    if (!existedBrand) {
        return next(new AppError(messages.brand.notFound, 404))
    }

    const productIds = []
    const CloudPaths = []

    for (const product of existedBrand.products) {
        productIds.push(product._id)
        CloudPaths.push(product.mainImage.public_id)
        for (const subImage of product.subImages) {
            CloudPaths.push(subImage.public_id)
        }
    }

    await productModel.deleteMany({ _id: { $in: productIds } }).catch((err) => {
        return next(new AppError(messages.product.failToDelete, 500))
    })
    await reviewModel.deleteMany({ product: { $in: productIds } }).catch((err) => {
        return next(new AppError(messages.review.failToDelete, 500))
    })

    await cloudinary.uploader.destroy(existedBrand.logo.public_id).catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })
    await cloudinary.api.delete_resources(CloudPaths, (error, result) => {
        if (error) {
            return next(new AppError(messages.files.failToDelete, 500))
        }
    })
    await existedBrand.deleteOne().catch((err) => {
        return next(new AppError(messages.brand.failToDelete, 500))
    })

    res.status(200).json({
        status: 'success',
        message: messages.brand.successDelete,
    })
}