
module.exports = (cloudinary) => {
    cloudinary.config(process.env.CLOUDINARY_URL);
}