const FactoryContract = artifacts.require("StakingRewardsFactory");
const fs = require("fs");

//Add 5 minutes and take value in second
const genesisTime = Math.floor((Date.now() + 5 * 60 * 1000) / 1000);  
//Buni address in kovan
const rewardToken = JSON.parse(fs.readFileSync("../config/sys_config.json", "utf8"))["reward_kovan"];
module.exports = function(deployer) {
    deployer.deploy(FactoryContract, rewardToken, genesisTime);
}