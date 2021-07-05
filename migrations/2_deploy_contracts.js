const FactoryContract = artifacts.require("StakingRewardsFactory");

//Add 5 minutes and take value in second
const genesisTime = Math.floor((Date.now() + 5 * 60 * 1000) / 1000);  
//Buni address in kovan
const rewardToken = "0xc3737a066fae30614db8e01c264331fca852b4ae";
module.exports = function(deployer) {
    deployer.deploy(FactoryContract, rewardToken, genesisTime);
}