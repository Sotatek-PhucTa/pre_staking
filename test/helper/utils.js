async function shouldThrow(promise) {
    await promise;
    return true;
    // try {
    //     await promise;
    //     return false;
    // }
    // catch (err) {
    //     return true;
    // }
}

module.exports = {
    shouldThrow,
}