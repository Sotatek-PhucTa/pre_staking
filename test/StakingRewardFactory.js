const FactoryContract = artifacts.require("StakingRewardsFactory");
const expect = require('chai').expect;

contract('FactoryContract', (accounts) => {

    context("#About constructor", async() => {
        const [creator, simulateRewardToken] = accounts;
        const timezoneOffset = new Date().getTimezoneOffset();    //in minutes
        it("should create contract successfully", async () => {
            const genesisTime = Date.now() + 10 * 60000 + timezoneOffset * 60000;   //Add 10 minutes from now and ourtimezone;
            const factoryInstance = await FactoryContract.new(simulateRewardToken, genesisTime, {from: creator});

            // Instance should be success
            expect(factoryInstance).not.equals(undefined);

            const factoryGenesis = await factoryInstance.stakingRewardGenesis();
            const factoryStakingReward = await factoryInstance.rewardToken();

            // State variables should be correct
            expect(Number(factoryGenesis)).equals(genesisTime);
            expect(factoryStakingReward).equals(simulateRewardToken);
        });

        it("should not create a contract", async() => {
            const genesisTime = Date.now() - 10 * 60000 + timezoneOffset * 60000;   // Sub 10 minute from now
            const factoryInstance = await FactoryContract.new(simulateRewardToken, genesisTime, { from: creator});
            const factoryGenesis = await factoryInstance.stakingRewardGenesis();
            console.log(Number(factoryGenesis));
            console.log(factoryInstance.address);
        })
        
    });
});