import slugify from 'slugify'
import { AppError, messages, cloudinary, deleteFile, ApiFeature } from '../../utils/index.js' 
import { categoryModel, productModel, reviewModel, subcategoryModel } from '../../database/index.js'

export const addSubcategory = async (req, res, next) => {
    // get data from req
    let { name, category } = req.body
    name = name.trim().toLowerCase()

    // check if image is uploaded
    if (!req.file) {
        return next(new AppError(messages.file.required, 400))

    }
    // check existing category
    const existedCategory = await categoryModel.findById(category)
    if (!existedCategory) {
        return next(new AppError(messages.category.notFound, 404))
    }

    const isNameExist = await subcategoryModel.findOne({ name: name, category: category })
    if (isNameExist) {
        return next(new AppError(messages.subcategory.alreadyExist, 409))
    }

    // prepare data
    const slug = slugify(name)
    const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, { folder: "e-commerce/subcategories" })
    if (!secure_url || !public_id) {
        return next(new AppError(messages.file.failToUpload, 500))
    }
    const subcategory = new subcategoryModel({
        name,
        slug,
        category,
        image: { secure_url: secure_url, public_id: public_id },
        createdBy: req.authUser._id
    })

    // add to database
    const createdSubcategory = await subcategory.save()
    if (!createdSubcategory) {
        // deleteFile(req.file.path)
        await cloudinary.uploader.destroy(public_id).catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })
        return next(new AppError(messages.category.failToCreate, 500))
    }

    // send res
    res.status(201).json({
        status: 'success',
        message: messages.subcategory.successCreate,
        data: createdSubcategory
    })

}

export const getSubcategories = async (req, res, next) => {

    const apiFeature = new ApiFeature(subcategoryModel.find().populate('category'), req.query)
        .pagination()

    const subcategories = await apiFeature.mongooseQuery

    if (!subcategories) {
        next(new AppError(messages.subcategory.failToGetAll, 500))
    }
    res.status(200).json({
        status: 'success',
        message: messages.subcategory.successFindAll,
        data: subcategories,
    })

}

export const updateSubcategory = async (req, res, next) => {
    let { name, category } = req.body
    const { subcategoryId } = req.params

    name && name.trim().toLowerCase()
    if (category) {
        const existedCategory = await categoryModel.findById(category)
        if (!existedCategory) {
            return next(new AppError(messages.category.notFound, 404))
        }
    }
    const existedSubcategory = await subcategoryModel.findById(subcategoryId)
    if (!existedSubcategory) {
        return next(new AppError(messages.subcategory.notFound, 404))
    }
    const isNameExist = await subcategoryModel.findOne({ name: name, _id: { $ne: subcategoryId } })
    if (isNameExist) {
        return next(new AppError(messages.subcategory.alreadyExist, 409))
    }

    if (req.file) {
        await cloudinary.uploader.destroy(existedSubcategory.image.public_id).catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })
        const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, { folder: "e-commerce/subcategories" })
        if (!secure_url || !public_id) {
            return next(new AppError(messages.file.failToUpload, 500))
        }
        existedSubcategory.image = { secure_url: secure_url, public_id: public_id }
    }

    if (name) {
        existedSubcategory.name = name
        existedSubcategory.slug = slugify(name)
    }

    existedSubcategory.updatedBy = req.authUser._id

    const updatedSubcategory = await existedSubcategory.save()
    if (!updatedSubcategory) {
        req.file && await cloudinary.uploader.destroy(public_id)
            .catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })

        return next(new AppError(messages.subcategory.failToUpdate, 500))
    }

    res.status(200).json({
        status: 'success',
        message: messages.subcategory.successUpdate,
        data: updatedSubcategory
    })

}

export const getOneSubcategory = async (req, res, next) => {
    const { subcategoryId } = req.params
    const subcategory = await subcategoryModel.findById(subcategoryId).populate('category')
    if (!subcategory) {
        return next(new AppError(messages.category.notFound, 404))
    }
    res.status(200).json({
        status: 'success',
        message: messages.subcategory.successFindOne,
        data: subcategory
    })
}

export const deleteSubcategory = async (req, res, next) => {
    const { subcategoryId } = req.params

    const existedSubcategory = await subcategoryModel.findById(subcategoryId).populate([
        { path: 'products', select: "mainImage subImages" } 
    ])
    if (!existedSubcategory) {
        return next(new AppError(messages.subcategory.notFound, 404))
    }

    const productIds = []
    const CloudPaths = []

    for (const product of existedSubcategory.products) {
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
    await cloudinary.uploader.destroy(existedSubcategory.image.public_id).catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })

    if (CloudPaths.length > 0) {
        await cloudinary.api.delete_resources(CloudPaths, (error, result) => {
            if (error) {
                return next(new AppError(messages.files.failToDelete, 500))
            }
        })
    }
    await existedSubcategory.deleteOne().catch((err) => {
        return next(new AppError(messages.subcategory.failToDelete, 500))
    })
    res.status(200).json({
        status: 'success',
        message: messages.subcategory.successDelete,
    })
}
