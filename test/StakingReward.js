const expect = require('chai').expect;
const { time, expectRevert } = require('@openzeppelin/test-helpers');

const FactoryContract = artifacts.require("StakingRewardsFactory");
const StakingReward = artifacts.require("StakingReward");
const TestBEP20 = artifacts.require("TestBEP20");


contract("StakingReward", async(accounts) => {
    let factoryInstance, rewardToken, stakingToken, farmInstance;
    const [tokenCreator, factoryCreator, staker1, staker2] = accounts;
    const rewardAmount = 600;
    const rewardDuration = 600;
    const vestingPeriod = 1200;
    const splits = 4;
    const claimable = 20;

    context("Single person stake into the pool", async() => {
        beforeEach(async() => {
            const genesisTime = await time.latest() + 10 * 1000;

            // Create reward token and staking token
            rewardToken = await TestBEP20.new(1000000, { from: tokenCreator});
            stakingToken = await TestBEP20.new(1000000, { from: tokenCreator});

            // Create a factory instance and transfer for it 600 reward token
            factoryInstance = await FactoryContract.new(rewardToken, genesisTime, { from: factoryCreator});
            await rewardToken.transfer(factoryInstance.address, 600, { from: tokenCreator});

            // Create a farm and call deploy
            const deployParams = [stakingToken.address, rewardAmount, rewardDuration, vestingPeriod, splits, claimable];
            await factoryInstance.deploy(...deployParams, {from: factoryCreator});
            const farmInfo = await factoryInstance.stakingRewardInfosByStakingToken(stakingToken.address);
            farmInstance = await StakingReward.at(farmInfo.stakingReward);
        });

        it("initialization should be true", async() => {
        })
    });
})