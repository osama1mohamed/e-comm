import { Types } from 'mongoose'
import slugify from 'slugify'
import { AppError, messages, cloudinary, deleteFile, ApiFeature } from '../../utils/index.js'
import { categoryModel, productModel, reviewModel, subcategoryModel } from '../../database/index.js'

export const addCategory = async (req, res, next) => {
    let { name } = req.body
    name = name.trim().toLowerCase()
    if (!req.file) {
        return next(new AppError(messages.file.required, 400))

    }
    const existedCategory = await categoryModel.findOne({ name: name })
    if (existedCategory) {
        return next(new AppError(messages.category.alreadyExist, 409))
    }

    const slug = slugify(name)
    const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, { folder: "e-commerce/categories" })
    if (!secure_url || !public_id) {
        return next(new AppError(messages.file.failToUpload, 500))
    }
    const category = new categoryModel({
        name,
        slug,
        image: { secure_url: secure_url, public_id: public_id },
        createdBy: req.authUser._id
    })

    const createdCategory = await category.save()
    if (!createdCategory) {
        await cloudinary.uploader.destroy(public_id).catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })
        return next(new AppError(messages.category.failToCreate, 500))
    }

    res.status(201).json({
        status: 'success',
        message: messages.category.successCreate,
        data: createdCategory
    })

}

export const getCategories = async (req, res, next) => {

    const apiFeature = new ApiFeature(categoryModel.aggregate([
        {
            $match: {}
        },
        {
            $lookup: {
                from: 'subcategories',
                localField: '_id',
                foreignField: 'category',
                as: 'subcategories'
            }
        }
    ]), req.query)
        .pagination()

    const categories = await apiFeature.mongooseQuery

    if (!categories) {
        next(new AppError(messages.category.failToGetAll, 500))
    }
    res.status(200).json({
        status: 'success',
        message: messages.category.successFindAll,
        data: categories,
    })

}

export const updateCategory = async (req, res, next) => {
    let { name } = req.body
    const { categoryId } = req.params

    name && name.trim().toLowerCase()
    const existedCategory = await categoryModel.findById(categoryId)
    if (!existedCategory) {
        return next(new AppError(messages.category.notFound, 404))
    }
    const isNameExist = await categoryModel.findOne({ name: name, _id: { $ne: categoryId } })
    if (isNameExist) {
        return next(new AppError(messages.category.alreadyExist, 409))
    }

    if (req.file) {
        await cloudinary.uploader.destroy(existedCategory.image.public_id).catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })
        const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, { folder: "e-commerce/categories" })
        if (!secure_url || !public_id) {
            return next(new AppError(messages.file.failToUpload, 500))
        }
        existedCategory.image = { secure_url: secure_url, public_id: public_id }
    }

    if (name) {
        existedCategory.name = name
        existedCategory.slug = slugify(name)
    }

    existedCategory.updatedBy = req.authUser._id

    const updatedCategory = await existedCategory.save()
    if (!updatedCategory) {
        req.file && await cloudinary.uploader.destroy(public_id) 
            .catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })

        return next(new AppError(messages.category.failToUpdate, 500))
    }

    res.status(200).json({
        status: 'success',
        message: messages.category.successUpdate,
        data: updatedCategory
    })

}

export const getOneCategory = async (req, res, next) => {
    const { categoryId } = req.params
    const category = await categoryModel.aggregate([
        {
            $match: { _id: new Types.ObjectId(categoryId) }
        },
        {
            $lookup: {
                from: 'subcategories',
                localField: '_id',
                foreignField: 'category',
                as: 'subcategories'
            }
        }
    ])
    if (!category) {
        return next(new AppError(messages.category.notFound, 404))
    }
    res.status(200).json({
        status: 'success',
        message: messages.category.successFindOne,
        data: category
    })
}

export const deleteCategory = async (req, res, next) => {
    const { categoryId } = req.params

    const existedCategory = await categoryModel.findById(categoryId).populate([
        { path: 'subcategories', select: 'image' },
        { path: 'products', select: "mainImage subImages" } 
    ])
    if (!existedCategory) {
        return next(new AppError(messages.category.notFound, 404))
    }

    const subcategoryIds = []
    const productIds = []
    const FS_ImagePaths = [] 
    const CloudPaths = [] 

    for (const subcategory of existedCategory.subcategories) {
        subcategoryIds.push(subcategory._id)
        FS_ImagePaths.push(subcategory.image.public_id) 
    }

    for (const product of existedCategory.products) {
        productIds.push(product._id)
        CloudPaths.push(product.mainImage.public_id) 
        for (const subImage of product.subImages) {
            CloudPaths.push(subImage.public_id)  
        }
    }

    await subcategoryModel.deleteMany({ _id: { $in: subcategoryIds } }).catch((err) => {
        return next(new AppError(messages.subcategory.failToDelete, 500))
    })
    await productModel.deleteMany({ _id: { $in: productIds } }).catch((err) => {
        return next(new AppError(messages.product.failToDelete, 500))
    })
    await reviewModel.deleteMany({ product: { $in: productIds } }).catch((err) => {
        return next(new AppError(messages.review.failToDelete, 500))
    })
    FS_ImagePaths.push(existedCategory.image.public_id)
    await cloudinary.api.delete_resources(FS_ImagePaths).catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })
    if (CloudPaths.length > 0) {
        await cloudinary.api.delete_resources(CloudPaths, (error, result) => {
            if (error) {
                return next(new AppError(messages.files.failToDelete, 500))
            }
        })
    }
    await existedCategory.deleteOne().catch((err) => {
        return next(new AppError(messages.category.failToDelete, 500))
    })

    res.status(200).json({
        status: 'success',
        message: messages.category.successDelete,
    })
}
