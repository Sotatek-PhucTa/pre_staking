const { utils } = require("ethers");
const { ecsign } = require("ethereumjs-util");
const PERMIT_TYPEHASH = "0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9";
const  fs  = require("fs");
const chainid = 97;
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
                chainid,
                tokenAddress
            ]
        )
    );
}
function getApprovalDigest(token, approve, nonce, deadline) {
    const name = token.name;
    const DOMAIN_SEPARATOR = getDomainSeparator(name, token.address);
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

const staker1 = "0x828371E228154511DdfC505Ad8a954Bcf59572a9";
const farmInstance = {
    address: "0x547c97d8B4B263570d934C55225B3be73fed5Df9"
}
const stakeAmount = 1;
const token = {
    name: "Uniswap V2",
    address: "0xfb5bed7C85fa5f60CE4CDE94ef6C9D0E62dAE7F6"
}
const deadline = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
const nonce = 0;
const privateKey = fs.readFileSync(__dirname + '/data/private_key', 'utf8');

const digest = getApprovalDigest(
    token,
    { owner: staker1, spender: farmInstance.address, value: stakeAmount},
    nonce,
    deadline
);
const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'),
Buffer.from(privateKey.slice(2), 'hex'));

function pp(x) {
    let res = "0x";
    for (let i = 0; i < 32; i++) {
        let g = x[i].toString(16);
        if (g.length < 2) g = '0' + g;
        res += g;
    }
    return res;
}
console.log("v " + v);
console.log("r " + pp(r));
console.log("s " +  pp(s));
console.log("amount " + stakeAmount);
console.log("deadline " + deadline);

// console.log(JSON.stringify(s));
