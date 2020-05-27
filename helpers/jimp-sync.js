const Jimp = require('jimp')

exports.readAsync = async (buffer) => {
    return new Promise( (resolve, reject) => {
        Jimp.read(buffer)
            .then(image => {
                resolve(image)
            })
            .catch(err => {
                reject(err)
            });
    })
}
