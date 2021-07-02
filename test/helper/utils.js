async function shouldThrow(promise) {
    try {
        await promise;
        return false;
    }
    catch (err) {
        return true;
    }
}

module.exports = {
    shouldThrow,
}