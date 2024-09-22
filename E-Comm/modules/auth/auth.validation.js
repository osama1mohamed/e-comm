import joi from "joi"
import { generalField } from "../../middlewares/validation.js"

const pattern = /^01[0125][0-9]{8}$/

export const signupValidation = joi.object({
    username: generalField.string.required(),
    email: generalField.email.required(),
    password: generalField.string.required(),
    phone: generalField.string.required().regex(pattern),
    DOP: generalField.string.required(),
}).required()

export const signInValidation = joi.object({
    email: generalField.email.when('phone', {
        is: joi.exist(),
        then: joi.optional(),
        otherwise: joi.required()
    }),
    phone: generalField.string,
    password: generalField.string,
}).required()