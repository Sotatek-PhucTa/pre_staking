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
            const genesisTime = Number(await time.latest()) + 10 * 1000;

            // Create reward token and staking token
            rewardToken = await TestBEP20.new(1000000, { from: tokenCreator});
            stakingToken = await TestBEP20.new(1000000, { from: tokenCreator});

            // Create a factory instance and transfer for it 600 reward token
            factoryInstance = await FactoryContract.new(rewardToken.address, genesisTime, { from: factoryCreator});
            await rewardToken.transfer(factoryInstance.address, 600, { from: tokenCreator});

            // Create a farm and call deploy
            const deployParams = [stakingToken.address, rewardAmount, rewardDuration, vestingPeriod, splits, claimable];
            await factoryInstance.deploy(...deployParams, {from: factoryCreator});
            const farmInfo = await factoryInstance.stakingRewardInfosByStakingToken(stakingToken.address);
            farmInstance = await StakingReward.at(farmInfo.stakingReward);

            // Transfer for staker 
            await stakingToken.transfer(staker1, 100, { from: tokenCreator });
        });

        it("initialization should be true", async() => {
            expect(Number(await rewardToken.balanceOf(factoryInstance.address))).equals(600);
            const balanceOfStaker = Number(await stakingToken.balanceOf(staker1, { from: staker1}));
            expect(balanceOfStaker).equals(100);
        });

        it("Stake into the farm", async() => {
            const balanceBeforeStake = Number(await stakingToken.balanceOf(staker1, {from: staker1}));
            expect(balanceBeforeStake).equals(100);

            await stakingToken.approve(farmInstance.address, 100, { from: staker1});
            await farmInstance.stake(100, { from: staker1 });
            // await farmInstance.stake(100, { from: staker1 });
            const balanceAfterStake = Number(await stakingToken.balanceOf(staker1));
            expect(balanceAfterStake).equals(0);

            const balanceInFarm = Number(await farmInstance.balanceOf(staker1, { from: staker1}));
            expect(balanceInFarm).equals(100);

            const totalSupply = Number(await farmInstance.totalSupply({ from: staker1 }));
            expect(totalSupply).equals(100);
        });
    });
})