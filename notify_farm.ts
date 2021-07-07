import Web3 from "web3";
import fs from "fs";
import HDWalletProviders from "@truffle/hdwallet-provider";


const config = JSON.parse(fs.readFileSync("./config/sys_config.json", "utf-8"));
const privateKey = config["mnemonic"].trim();
const factoryAddress = config["factory_address"].trim();
const api = config["infura_api"].trim();
const web3 = new Web3(new HDWalletProviders(privateKey, api));

function getAbi(buildPath: string) {
    const buildData = JSON.parse(fs.readFileSync(buildPath, "utf-8"));
    return buildData["abi"];
}

const factoryContractAbi = getAbi("./build/contracts/StakingRewardsFactory.json");

const factoryContract = new web3.eth.Contract(factoryContractAbi, factoryAddress); 

console.log("Remember to transfer reward token to your factory");

(async() => {
    const accountAddressList = await web3.eth.getAccounts();
    const accountAddress = accountAddressList[0];
    console.log("Call notifyRewardAmounts() with address " + accountAddress);
    const tx = {
        from: accountAddress,
        to: factoryAddress,
        data: factoryContract.methods.notifyRewardAmounts().encodeABI()
    };
    const signedTx = await web3.eth.signTransaction(tx, tx.from);
    console.log("Signed transaction " + JSON.stringify(signedTx));
    await web3.eth.sendSignedTransaction(signedTx.raw);
    console.log("Call notify success");
})();