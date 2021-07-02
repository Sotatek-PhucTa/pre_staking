const FactoryContract = artifacts.require("StakingRewardsFactory");
const expect = require('chai').expect;
const utils = require('./helper/utils');

contract('FactoryContract', (accounts) => {

    context("#About constructor", async() => {
        const [creator, simulateRewardToken] = accounts;
        const timezoneOffset = new Date().getTimezoneOffset() * 60000;
        xit("should create contract successfully", async () => {
            const genesisTime = Date.now() + 10 * 60000;   //Add 10 minutes from now and ourtimezone;
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
            const genesisTime = Date.now() - 7 * 24 * 60 *  60000;   // Sub 10 minute from now
            console.log(genesisTime);
            const factoryInstance = await FactoryContract.new(simulateRewardToken, genesisTime, {from: creator});
            // const factoryInstance = await FactoryContract.new(simulateRewardToken, genesisTime, {from: creator});
            const gt = await factoryInstance.stakingRewardGenesis();
            console.log(Number(gt));
            console.log(factoryInstance.address);
        })
    });

    xcontext("#Create a single Farm", async() => {
        const [creator, simulateRewardToken, simulateStakingToken] = accounts;
        const timezoneOffset = new Date().getTimezoneOffset() * 60000;
        let factoryInsance;
        const rewardAmount = 600;
        const rewardDuration = 600;
        const vestingPeriod = 1200;
        const splits = 4;
        const clamable = 20;
        const deployParams = [simulateStakingToken, rewardAmount, rewardDuration, vestingPeriod, splits, clamable];
        beforeEach(async() => {
            const genesisTime = Date.now() + timezoneOffset * 5 * 1000; // add 5ms from now
            factoryInstance = await FactoryContract.new(simulateRewardToken, genesisTime, {from: creator});
        });

        it("should deploy success", async() => {
            const farmInstance = await factoryInsance.deploy(...deployParams);

        }) 
    })
});