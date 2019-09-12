// sleep for n miliseconds
function msleep(n) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n)
}

// sleep for n seconds
function sleep(n) {
    msleep(n * 1000)
}

exports.sleep = sleep
exports.msleep = msleep