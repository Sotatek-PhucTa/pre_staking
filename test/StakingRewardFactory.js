const FactoryContract = artifacts.require("StakingRewardsFactory");
const expect = require('chai').expect;
const utils = require('./helper/utils');
const { time } = require('@openzeppelin/test-helpers');

contract('FactoryContract', (accounts) => {

    const [creator, simulateRewardToken, simulateStakingToken] = accounts;
    xcontext("#About constructor", async() => {
        it("should create contract successfully", async () => {
            const genesisTime = Number(await time.latest()) + 10 * 60 * 000   //Add 10 minutes from now and ourtimezone;
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
            const genesisTime = Number(await time.latest()) - 10 * 60000;   // Sub 10 minute from now
            const result = await utils.shouldThrow(FactoryContract.new(simulateRewardToken, genesisTime, {from: creator}));
            expect(result).equals(true);
        })
    });

    context("#Create a single Farm", async() => {
        let factoryInstance;
        const rewardAmount = 600;
        const rewardDuration = 600;
        const vestingPeriod = 1200;
        const splits = 4;
        const claimable = 20;
        const deployParams = [simulateStakingToken, rewardAmount, rewardDuration, vestingPeriod, splits, claimable];
        beforeEach(async() => {
            const genesisTime = Number(await time.latest()) + 10 * 1000  //Add 10 second from now
            factoryInstance = await FactoryContract.new(simulateRewardToken, genesisTime, {from: creator});
        });

        xit("should deploy success", async() => {
            const result = await utils.shouldThrow(factoryInstance.deploy(...deployParams, {from: creator}));
            expect(result).equals(false);
        });

        xit("should deploy with correct param", async() => {
            const result = await factoryInstance.deploy(...deployParams, {from: creator});
            // Transaction should be success
            expect(result.receipt.status).equal(true);

            // StakingToken should be added
            expect(await factoryInstance.stakingTokens(0)).equals(simulateStakingToken);

            const farmIntanceInfo = await factoryInstance.stakingRewardInfosByStakingToken(simulateStakingToken);
            expect(Number(farmIntanceInfo.rewardAmount)).equals(rewardAmount);
            expect(Number(farmIntanceInfo.rewardDuration)).equals(rewardDuration);
            expect(Number(farmIntanceInfo.vestingPeriod)).equals(vestingPeriod);
            expect(Number(farmIntanceInfo.claimable)).equals(claimable);
        });

        it("error when deploy contract with same Staking token", async() => {
            await factoryInstance.deploy(...deployParams, { from: creator });
            const result = await utils.shouldThrow(factoryInstance.deploy(...deployParams, { from: creator}));
            expect(result).equals(true);
        });
    });

});