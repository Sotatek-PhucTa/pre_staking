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

        xit("initialization should be true", async() => {
            expect(Number(await rewardToken.balanceOf(factoryInstance.address))).equals(600);
            const balanceOfStaker = Number(await stakingToken.balanceOf(staker1, { from: staker1}));
            expect(balanceOfStaker).equals(100);
        });

        xit("Stake into the farm", async() => {
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

        xit("Withdraw from the farm", async() => {
            await stakingToken.approve(farmInstance.address, 100, { from: staker1});
            await farmInstance.stake(100, { from: staker1 });

            await farmInstance.withdraw(40, { from: staker1});
            expect(Number(await stakingToken.balanceOf(staker1, { from: staker1}))).equals(40);
            expect(Number(await stakingToken.balanceOf(farmInstance.address, { from: staker1}))).equals(60);
            expect(Number(await farmInstance.totalSupply({ from: staker1 }))).equals(60);
            expect(Number(await farmInstance.balanceOf(staker1, { from: staker1}))).equals(60);
        })

        xit("Stake into the farm and get all rewards", async() => {
            await stakingToken.approve(farmInstance.address, 100, { from: staker1});
            await farmInstance.stake(100, { from: staker1 });

            // Call notifyRewardAmount
            // Move time in block later than genesis
            await time.increase(20 * 1000);
            await factoryInstance.notifyRewardAmounts({ from: factoryCreator });

            // Move time in block later than periodFinsh
            await time.increase(rewardDuration * 1000);
            await farmInstance.getReward({from: staker1});

            expect(Number(await rewardToken.balanceOf(staker1, {from: staker1}))).equals(rewardAmount);
            expect(Number(await rewardToken.balanceOf(farmInstance.address, { from: staker1 }))).equals(0);
        });

        it("Stake into the farm and withdraw after half of time", async() => {
            await stakingToken.approve(farmInstance.address, 100, { from: staker1});
            await farmInstance.stake(100, { from: staker1 });

            // Call notifyRewardAmount
            // Move time in block later than genesis
            console.log("before time " + await time.latest());
            await time.increase(20 * 1000);
            // console.log("after time " + await time.latest())
            await factoryInstance.notifyRewardAmounts({ from: factoryCreator });
            console.log("Period finish " + Number(await farmInstance.periodFinish({ from: factoryCreator})));

            // Move time into half of the rewardDuration
            await time.increase(rewardDuration / 2 * 1000);
            console.log("Time when withdraw " +  Number(await time.latest()));
            await farmInstance.withdraw(100, { from: staker1});
            // expect(Number(await farmInstance.balanceOf(staker1))).equals(0);

            // Move time to greater then rewardDuration
            await time.increase(rewardDuration / 2 * 1000);
            await farmInstance.getReward({ from: staker1 });

            const reward = Number(await rewardToken.balanceOf(staker1, { from: staker1}));
            // console.log(Number(reward));
        })
    });
})