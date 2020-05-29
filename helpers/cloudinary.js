
const cloudinary = require('cloudinary').v2

require('../config/cloudinary')(cloudinary)

module.exports = {
    async upload(image) {
        return await cloudinary.uploader.upload(image)
    },
    async destroy(public_id) {
        return await cloudinary.uploader.destroy(public_id)
    },
    picture(public_id) {
        if(public_id == null)
            return null
        return cloudinary.url(public_id, {
            secure: true,
            fetch_format: "auto", 
            quality: "auto"
        })
    },
    chatPicture(public_id) {
        if(public_id == null)
            return null
        return cloudinary.url(public_id, {
            secure: true,
            fetch_format: "auto", 
            quality: "auto",
            width: 100, height: 100
        })
    },
    file(public_id) {
        if(public_id == null)
            return null
        return cloudinary.url(public_id, {
            secure: true,
        })
    },
    attachmentPicture(public_id) {
        if(public_id == null)
            return null
        return cloudinary.url(public_id, {
            secure: true,
            fetch_format: "auto", 
            quality: "auto",
            height: 120,
        })
    },
    url(public_id, type, preview) {
        if(/^image/i.test(type)) {
            return preview ? this.attachmentPicture(public_id) : this.picture(public_id)
        }
        else {
            return this.file(public_id)
        }
    }
}