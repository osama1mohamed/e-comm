import { Schema, model } from "mongoose"

const productSchema = new Schema({
    name: {
        type: String,
        unique: false,
        required: true,
        lowercase: true,
        trim: true,
    },
    slug: {
        type: String,
        false: true,
        required: true,
        lowercase: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    discount: {
        type: Number,
        required: false,
        min: 0,
        max: 100,
    },
    stock: {
        type: Number,
        default: 1,
        min: 0,
    },
    colors: [
        {
            type: String,
        }
    ],
    sizes: [
        {
            type: String,
        }
    ],
    rate: {
        type: Number,
        required: false,
        min: 0,
        max: 5,
        default: 0,
    },
    mainImage: {                   
        type: Object,
        required: true
    },
    subImages: [{                     
        type: Object,
        required: true
    }],
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    subcategory: {
        type: Schema.Types.ObjectId,
        ref: "Subcategory",
        required: true,
    },
    brand: {
        type: Schema.Types.ObjectId,
        ref: "Brand",
        required: true,
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
    }

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
})

productSchema.virtual("finalPrice").get(function () {
    return this.price - (this.price * ((this.discount || 0) / 100))
})

productSchema.methods.inStock = function (quantity) {
    return this.stock < quantity ? false : true
}


export const productModel = model("Product", productSchema)