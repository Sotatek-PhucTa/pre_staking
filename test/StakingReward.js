const expect = require('chai').expect;
const { time, expectRevert } = require('@openzeppelin/test-helpers');

const FactoryContract = artifacts.require("StakingRewardsFactory");
const StakingReward = artifacts.require("StakingReward");
const TestBEP20 = artifacts.require("TestBEP20");


contract("StakingReward", async(accounts) => {
    let factoryInstance, rewardToken, stakingToken, farmInstance;
    //testing in ganache, block.timestamp return in milisecond
    const timeConstant = 1000;

    const [tokenCreator, factoryCreator, staker1, staker2] = accounts;
    const rewardAmount = 600000;
    const rewardDuration = 600 * timeConstant;
    const vestingPeriod = 1200 * timeConstant;
    const splits = 4;
    const claimable = 20;


    xcontext("Single person stake into the pool", async() => {
        beforeEach(async() => {
            const genesisTime = Number(await time.latest()) + 10 * 1000;

            // Create reward token and staking token
            rewardToken = await TestBEP20.new(1000000, { from: tokenCreator});
            stakingToken = await TestBEP20.new(1000000, { from: tokenCreator});

            // Create a factory instance and transfer for it 600 reward token
            factoryInstance = await FactoryContract.new(rewardToken.address, genesisTime, { from: factoryCreator});
            await rewardToken.transfer(factoryInstance.address, 600000, { from: tokenCreator});

            // Create a farm and call deploy
            const deployParams = [stakingToken.address, rewardAmount, rewardDuration, vestingPeriod, splits, claimable];
            await factoryInstance.deploy(...deployParams, {from: factoryCreator});
            const farmInfo = await factoryInstance.stakingRewardInfosByStakingToken(stakingToken.address);
            farmInstance = await StakingReward.at(farmInfo.stakingReward);

            // Transfer for staker 
            await stakingToken.transfer(staker1, 100, { from: tokenCreator });
        });

        it("initialization should be true", async() => {
            expect(Number(await rewardToken.balanceOf(factoryInstance.address))).equals(600000);
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

        it("Withdraw from the farm", async() => {
            await stakingToken.approve(farmInstance.address, 100, { from: staker1});
            await farmInstance.stake(100, { from: staker1 });

            await farmInstance.withdraw(40, { from: staker1});
            expect(Number(await stakingToken.balanceOf(staker1, { from: staker1}))).equals(40);
            expect(Number(await stakingToken.balanceOf(farmInstance.address, { from: staker1}))).equals(60);
            expect(Number(await farmInstance.totalSupply({ from: staker1 }))).equals(60);
            expect(Number(await farmInstance.balanceOf(staker1, { from: staker1}))).equals(60);
        })

        it("Stake into the farm and get all rewards", async() => {
            await stakingToken.approve(farmInstance.address, 100, { from: staker1});
            await farmInstance.stake(100, { from: staker1 });

            // Call notifyRewardAmount
            // Move time in block later than genesis
            await time.increase(20 * timeConstant);
            await factoryInstance.notifyRewardAmounts({ from: factoryCreator });

            // Move time in block later than periodFinsh
            await time.increase((rewardDuration + vestingPeriod));
            await farmInstance.getReward({from: staker1});

            expect(Number(await rewardToken.balanceOf(staker1, {from: staker1}))).equals(rewardAmount);
            expect(Number(await rewardToken.balanceOf(farmInstance.address, { from: staker1 }))).equals(0);
        });

        it("Stake into the farm, withdraw part of it, still get all rewards", async () => {
            await stakingToken.approve(farmInstance.address, 100, { from: staker1});
            await farmInstance.stake(100, { from: staker1 });

            // Call notifyRewardAmount
            // Move time in block later than genesis
            await time.increase(20 * timeConstant);
            await factoryInstance.notifyRewardAmounts({ from: factoryCreator });

            // Move time block in between rewardDuration
            await time.increase(rewardDuration / 2);
            await farmInstance.withdraw(50, { from: staker1});

            // Move time block greater than vesting time
            await time.increase(rewardDuration / 2 + vestingPeriod);
            await farmInstance.getReward({ from: staker1});

            expect(Number(await rewardToken.balanceOf(staker1, { from: staker1}))).equals(rewardAmount);
        });

        it("Stake into the farm and withdraw after half of time", async() => {
            await stakingToken.approve(farmInstance.address, 100, { from: staker1});
            await farmInstance.stake(100, { from: staker1 });

            // Call notifyRewardAmount
            // Move time in block later than genesis
            await time.increase(20 * timeConstant);
            await factoryInstance.notifyRewardAmounts({ from: factoryCreator });
            const notifiedTime = Number(await time.latest());


            // Move time into half of the rewardDuration
            await time.increase(rewardDuration / 3);
            await farmInstance.withdraw(100, { from: staker1});
            const withdrawTime = Number(await time.latest());

            // Move time to greater than vesting time
            await time.increase(rewardDuration * 2 / 3 + vestingPeriod);
            await farmInstance.getReward({ from: staker1 });

            const reward = Number(await rewardToken.balanceOf(staker1, { from: staker1}));
            const rewardInFarm = Number(await rewardToken.balanceOf(farmInstance.address, { from: staker1}));
            expect(reward).equals(rewardAmount * (withdrawTime - notifiedTime) / rewardDuration);
            expect(rewardInFarm).equals(rewardAmount - reward);
        });

        it("Stake into the farm and get reward each release", async() => {
            await stakingToken.approve(farmInstance.address, 100, { from: staker1});
            await farmInstance.stake(100, { from: staker1 });

            // Move time in block greater then genesis
            await time.increase(20 * timeConstant);
            await factoryInstance.notifyRewardAmounts({ from: factoryCreator });

            // Move time to periodFinish
            await time.increase(rewardDuration);
            await farmInstance.withdraw(100, { from: staker1 });
            for (let i of [0, 1, 2, 3, 4]) {
                const oldBalance = Number(await rewardToken.balanceOf(staker1, { from: staker1}));
                await farmInstance.getReward({ from: staker1});
                const newBalance = Number(await rewardToken.balanceOf(staker1, { from: staker1}));
                expect(newBalance - oldBalance).equals(rewardAmount / (splits + 1));
                await time.increase(vestingPeriod / splits);
            }
        })
    });

    context("Stake with permit", async() => {
        beforeEach(async() => {
            const genesisTime = Number(await time.latest()) + 10 * 1000;

            // Create reward token and staking token
            rewardToken = await TestBEP20.new(1000000, { from: tokenCreator});
            stakingToken = await TestBEP20.new(1000000, { from: tokenCreator});

            // Create a factory instance and transfer for it 600 reward token
            factoryInstance = await FactoryContract.new(rewardToken.address, genesisTime, { from: factoryCreator});
            await rewardToken.transfer(factoryInstance.address, rewardAmount, { from: tokenCreator});

            // Create a farm and call deploy
            const deployParams = [stakingToken.address, rewardAmount, rewardDuration, vestingPeriod, splits, claimable];
            await factoryInstance.deploy(...deployParams, {from: factoryCreator});
            const farmInfo = await factoryInstance.stakingRewardInfosByStakingToken(stakingToken.address);
            farmInstance = await StakingReward.at(farmInfo.stakingReward);

            // Transfer for staker 
            await stakingToken.transfer(staker1, 100, { from: tokenCreator });
        }); 

        it("Stake success", async() => {
            const stakeAmount = 10;

            const nonce = await stakingToken.nonces(staker1, { from: staker1 });
            console.log("Nonce of staker " + nonce);
        })
    })

    xcontext("Two stakers stake into the farm", async() => {
        beforeEach(async() => {
            const genesisTime = Number(await time.latest()) + 10 * timeConstant;

            // Create reward token and staking token
            rewardToken = await TestBEP20.new(1000000, { from: tokenCreator});
            stakingToken = await TestBEP20.new(1000000, { from: tokenCreator});

            // Create a factory instance and transfer for it 600 reward token
            factoryInstance = await FactoryContract.new(rewardToken.address, genesisTime, { from: factoryCreator});
            await rewardToken.transfer(factoryInstance.address, 600000, { from: tokenCreator});

            // Create a farm and call deploy
            const deployParams = [stakingToken.address, rewardAmount, rewardDuration, vestingPeriod, splits, claimable];
            await factoryInstance.deploy(...deployParams, {from: factoryCreator});
            const farmInfo = await factoryInstance.stakingRewardInfosByStakingToken(stakingToken.address);
            farmInstance = await StakingReward.at(farmInfo.stakingReward);

            // Transfer for staker 
            await stakingToken.transfer(staker1, 100, { from: tokenCreator });
            await stakingToken.transfer(staker2, 100, { from: tokenCreator });

            await stakingToken.approve(farmInstance.address, 100, { from: staker1 });
            await stakingToken.approve(farmInstance.address, 100, { from: staker2 });

        });
        it("Two stakers get equal reward", async() => {
            await farmInstance.stake(100, { from: staker1 });
            await farmInstance.stake(100, { from: staker2 });

            //Move time in block greater than genesis
            await time.increase(20 * timeConstant);
            await factoryInstance.notifyRewardAmounts({ from: factoryCreator });

            // Move time in block greater than vesting time
            await time.increase(rewardDuration + vestingPeriod);
            await farmInstance.getReward({ from: staker1});
            await farmInstance.getReward({ from: staker2});
            const rewardOfStaker1 = Number(await rewardToken.balanceOf(staker1, { from: staker1}));
            const rewardOfStaker2 = Number(await rewardToken.balanceOf(staker2, { from: staker2}));
            expect(rewardOfStaker1).equals(rewardOfStaker2);
            expect(rewardOfStaker1 + rewardOfStaker2).equals(rewardAmount);
        });


        it("One stake 1/3, other stake 2/3", async () => {
            await farmInstance.stake(20, { from: staker1 });
            await farmInstance.stake(40, { from: staker2 });

            // Move time in block greater than genesis
            await time.increase(20 * timeConstant);
            await factoryInstance.notifyRewardAmounts({from: factoryCreator});

            // Move time in block greater then vesting time
            await time.increase(rewardDuration + vestingPeriod);
            await farmInstance.getReward({ from: staker1 });
            await farmInstance.getReward({ from: staker2 });
            const rewardOfStaker1 = Number(await rewardToken.balanceOf(staker1, { from: staker1}));
            const rewardOfStaker2 = Number(await rewardToken.balanceOf(staker2, { from: staker2}));

            expect(rewardOfStaker1).equals(rewardAmount / 3);
            expect(rewardOfStaker2).equals(rewardAmount * 2 / 3);
        });

        it("One stake before notifyTime, and other stake in half of rewardDuration", async() => {
            await farmInstance.stake(20, { from: staker1 });

            // Move time in block greater than genesis
            await time.increase(20 * timeConstant);
            await factoryInstance.notifyRewardAmounts({from: factoryCreator});
            const notifiedTime = Number(await time.latest());

            // Move time to the half of duration
            await time.increase(rewardDuration / 2);
            await farmInstance.stake(20, { from: staker2}) ;
            const timeOfStaker2Involved = Number(await time.latest());

            // Move time greater than vesting time
            await time.increase(rewardDuration / 2 + vestingPeriod);
            await farmInstance.getReward({ from: staker1});
            await farmInstance.getReward({ from: staker2});

            const rewardOfStaker1 = Number(await rewardToken.balanceOf(staker1, { from: staker1}));
            const rewardOfStaker2 = Number(await rewardToken.balanceOf(staker2, { from: staker2}));

            const durationOnlyStaker1 = timeOfStaker2Involved - notifiedTime;
            const durationBothStaker = rewardDuration - durationOnlyStaker1;
            expect(rewardOfStaker1).equals(rewardAmount * durationOnlyStaker1 / rewardDuration
                                    + rewardAmount * durationBothStaker / 2 / rewardDuration);
            expect(rewardOfStaker2).equals(rewardAmount * durationBothStaker / 2 / rewardDuration);
        });
    })
})