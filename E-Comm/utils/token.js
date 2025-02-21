import jwt from "jsonwebtoken"

export const generateToken = ({ payload, secretKey }) => {
    try {
        return jwt.sign(payload, secretKey)
    } catch (error) {
        console.error("Error generating token:", error)
        throw error
    }
}

export const verifyToken = ({ token, secretKey }) => {
    try {
        return jwt.verify(token, secretKey)
    } catch (err) {
        return { error: err.message }
    }
}
