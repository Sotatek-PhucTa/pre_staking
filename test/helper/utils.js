import { utils } from "ethers";

async function shouldThrow(promise) {
    try {
        await promise;
        return false;
    }
    catch (err) {
        return true;
    }
}

async function getApprovalDigest(token, approve, nonce, deadline) {
    const name = await token.name();
}

function getDomainSeparator(name, tokenAddress) {
    return utils.keccak256(
        utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [
                utils.keccak256(
                  utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                ),
                utils.keccak256(utils.toUtf8Bytes(name)),
                utils.keccak256(utils.toUtf8Bytes('1')),
                1,
                tokenAddress,
            ]
        )
    )
}
module.exports = {
    shouldThrow,
}