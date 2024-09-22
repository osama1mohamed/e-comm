import slugify from 'slugify';
import { AppError, messages, cloudinary, ApiFeature } from '../../utils/index.js';
import { categoryModel, productModel, subcategoryModel, brandModel, reviewModel } from '../../database/index.js';

export const addProduct = async (req, res, next) => {
    let { name, description, price, discount, stock, colors, sizes, rate, category, subcategory, brand } = req.body
    name = name.trim().toLowerCase()
    description = description.trim()

    if (!req.files) {
        return next(new AppError(messages.files.required, 400))
    }

    const existedBrand = await brandModel.findById(brand)
    if (!existedBrand) {
        return next(new AppError(messages.brand.notFound, 404))
    }

    const existedSubcategory = await subcategoryModel.findById(subcategory)
    if (!existedSubcategory) {
        return next(new AppError(messages.subcategory.notFound, 404))
    }

    const existedCategory = await categoryModel.findById(category)
    if (!existedCategory) {
        return next(new AppError(messages.category.notFound, 404))
    }
    const { secure_url, public_id } = await cloudinary.uploader.upload(req.files.mainImage[0].path, { folder: "e-commerce/products/mainImages" })
    if (!secure_url || !public_id) {
        return next(new AppError(messages.files.failToUpload, 500))
    }
    const subImagesArray = []
    for (const file of req.files.subImages) {
        const { secure_url, public_id } = await cloudinary.uploader.upload(file.path, { folder: "e-commerce/products/subImages" })
        if (!secure_url || !public_id) {
            return next(new AppError(messages.files.failToUpload, 500))
        }
        subImagesArray.push({ secure_url, public_id })
    }

    const slug = slugify(name)

    const product = new productModel({
        name, slug, description,
        price,
        discount: discount || 0, stock: stock || 1,
        rate: rate || 0,
        colors: JSON.parse(colors), sizes: JSON.parse(sizes),
        category, subcategory, brand,
        mainImage: { secure_url: secure_url, public_id: public_id },
        subImages: subImagesArray,
        createdBy: req.authUser._id
    })

    const createdProduct = await product.save()
    if (!createdProduct) {
        return next(new AppError(messages.product.failToCreate, 500))
    }

    res.status(201).json({
        status: 'success',
        message: messages.product.successCreate,
        data: createdProduct
    })

}

export const getProducts = async (req, res, next) => {

    const apiFeature = new ApiFeature(productModel.find().lean(), req.query)
        .pagination().sort().select().filter()

    const products = await apiFeature.mongooseQuery

    if (!products) {
        next(new AppError(messages.product.failToGetAll, 500))
    }
    res.status(200).json({
        status: 'success',
        message: messages.product.successFindAll,
        data: products,
        
    })
}

export const updateProduct = async (req, res, next) => {
    let { name, description, price, discount, stock, colors, sizes, rate, category, subcategory, brand } = req.body
    const { productId } = req.params

    name && name.trim().toLowerCase()

    if (category) {
        const existedCategory = await categoryModel.findById(category)
        if (!existedCategory) {
            return next(new AppError(messages.category.notFound, 404))
        }
    }

    if (subcategory) {
        const existedSubcategory = await subcategoryModel.findById(subcategory)
        if (!existedSubcategory) {
            return next(new AppError(messages.subcategory.notFound, 404))
        }
    }

    if (brand) {
        const existedBrand = await brandModel.findById(brandId)
        if (!existedBrand) {
            return next(new AppError(messages.brand.notFound, 404))
        }
    }

    const existedProduct = await productModel
        .findById(productId)
    if (!existedProduct) {
        return next(new AppError(messages.product.notFound, 404))
    }

    if (req.files.mainImage) {
        await cloudinary.uploader.destroy(existedProduct.mainImage.public_id).catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })
        const { secure_url, public_id } = await cloudinary.uploader.upload(req.files.mainImage[0].path, { folder: "e-commerce/products/mainImages" })
        if (!secure_url || !public_id) {
            return next(new AppError(messages.file.failToUpload, 500))
        }
        existedProduct.mainImage = { secure_url: secure_url, public_id: public_id }
    }

    if (req.files.subImages) {
        const publicIdsForSubImages = existedProduct.subImages.map((image) => image.public_id)
        await cloudinary.api.delete_resources(publicIdsForSubImages, (err, result) => {
            if (err) {
                return next(new AppError(messages.files.failToDelete, 500))
            }
        })
        const subImagesArray = []
        for (const file of req.files.subImages) {
            const { secure_url, public_id } = await cloudinary.uploader.upload(file.path, { folder: "e-commerce/products/subImages" })
            if (!secure_url || !public_id) {
                await cloudinary.uploader.destroy(existedProduct.mainImage.public_id).catch((err) => { next(new AppError(messages.file.failToDelete, 500)) })
                return next(new AppError(messages.files.failToUpload, 500))
            }
            subImagesArray.push({ secure_url, public_id })
        }
        existedProduct.subImages = subImagesArray
    }

    name && (existedProduct.name = name)
    existedProduct.slug = slugify(name)
    description && (existedProduct.description = description)
    price && (existedProduct.price = price)
    discount && (existedProduct.discount = discount)
    stock && (existedProduct.stock = stock)
    colors && (existedProduct.colors = JSON.parse(colors))
    sizes && (existedProduct.sizes = JSON.parse(sizes))
    rate && (existedProduct.rate = rate)
    category && (existedProduct.category = category)
    subcategory && (existedProduct.subcategory = subcategory)
    brand && (existedProduct.brand = brand)
    existedProduct.updatedBy = req.authUser._id

    const updatedProduct = await existedProduct.save()
    if (!updatedProduct) {
        return next(new AppError(messages.product.failToUpdate, 500))
    }

    res.status(200).json({
        status: 'success',
        message: messages.product.successUpdate,
        data: updatedProduct
    })

}

export const getOneProduct = async (req, res, next) => {
    const { productId } = req.params
    const product = await productModel.findById(productId)
    if (!product) {
        return next(new AppError(messages.product.notFound, 404))
    }
    res.status(200).json({
        status: 'success',
        message: messages.product.successFindOne,
        data: product
    })
}

export const deleteProduct = async (req, res, next) => {
    const { productId } = req.params

    const existedProduct = await productModel.findById(productId)
    if (!existedProduct) {
        return next(new AppError(messages.product.notFound, 404))
    }

    const CloudPaths = [existedProduct.mainImage.public_id] 

    for (const image of existedProduct.subImages) {
        CloudPaths.push(image.public_id) 
    }

    await cloudinary.api.delete_resources(CloudPaths, (error, result) => {
        if (error) {
            return next(new AppError(messages.files.failToDelete, 500))
        }
    })
    await existedProduct.deleteOne().catch((err) => {
        return next(new AppError(messages.product.failToDelete, 500))
    })

    await reviewModel.deleteMany({ product: productId }).catch((err) => {
        return next(new AppError(messages.review.failToDelete, 500))
    })

    res.status(200).json({
        status: 'success',
        message: messages.product.successDelete,
    })
}