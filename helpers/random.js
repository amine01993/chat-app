
// generate an integer between a and b
exports.int = (a, b) => {
    return Math.round(a + Math.random() * (b - a))
}