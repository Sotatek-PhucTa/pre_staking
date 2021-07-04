const { utils } = require("ethers");
const PERMIT_TYPEHASH = utils.keccak256(
    utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
);

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
    const DOMAIN_SEPARATOR = getDomainSeparator(name, token.address);
    console.log("PERMIT_TYPEHASH " + PERMIT_TYPEHASH);
    return utils.keccak256(
        utils.solidityPack(
            ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
            [
              '0x19',
              '0x01',
              DOMAIN_SEPARATOR,
              utils.keccak256(
                utils.defaultAbiCoder.encode(
                  ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                  [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
                //   ['bytes32', 'address', 'address', 'uint256', 'uint256'],
                //   [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce]
                )
              ),
            ]
        )
    )
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
                1337,
                tokenAddress
            ]
        )
    )
}
module.exports = {
    shouldThrow,
    getApprovalDigest,
}