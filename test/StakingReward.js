const expect = require('chai').expect;
const { time, expectRevert } = require('@openzeppelin/test-helpers');
const { ecsign } = require("ethereumjs-util");
const { getApprovalDigest } = require("./helper/util");
const fs = require("fs");

const FactoryContract = artifacts.require("StakingRewardsFactory");
const StakingReward = artifacts.require("StakingReward");
const TestBEP20 = artifacts.require("TestBEP20");
const TestUniswapERC20 = artifacts.require("TestUniswapV2ERC20");


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
    const splitWindow = vestingPeriod / splits;


    context("Single person stake into the pool", async() => {
        beforeEach(async() => {
            const genesisTime = Number(await time.latest()) + 30 * timeConstant;

            // Create reward token and staking token
            rewardToken = await TestBEP20.new(1000000, { from: tokenCreator});
            stakingToken = await TestBEP20.new(1000000, { from: tokenCreator});

            // Create a factory instance and transfer for it 600 reward token
            factoryInstance = await FactoryContract.new(rewardToken.address, genesisTime, { from: factoryCreator});
            await rewardToken.transfer(factoryInstance.address, 600000, { from: tokenCreator});

            // Create a farm and call deploy
            await time.increase(15 * timeConstant);
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
            await time.increase((rewardDuration + vestingPeriod + splitWindow));
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
            await time.increase(rewardDuration / 2 + vestingPeriod + splitWindow);
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
            await time.increase(rewardDuration * 2 / 3 + vestingPeriod + splitWindow);
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
                const availableReward = Number(await farmInstance.availableReward(staker1, { from: staker1}));
                const oldBalance = Number(await rewardToken.balanceOf(staker1, { from: staker1}));
                try {
                    await farmInstance.getReward({ from: staker1});
                } catch {
                    console.log("Get reward error");
                }
                const newBalance = Number(await rewardToken.balanceOf(staker1, { from: staker1}));
                expect(newBalance - oldBalance).equals(availableReward);
                if (i == 0)
                    expect(newBalance - oldBalance).equals(0);
                else
                    expect(newBalance - oldBalance).equals(rewardAmount / (splits + 1));
                await time.increase(vestingPeriod / splits);
            }
        })
    });


    context("Single person stake into the pool with new released stretagy", async() => {
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
        });

        it("Stake into the farm and get all rewards", async() => {
            await stakingToken.approve(farmInstance.address, 100, { from: staker1});
            await farmInstance.stake(100, { from: staker1 });

            // Call notifyRewardAmount
            // Move time in block later than genesis
            await time.increase(20 * timeConstant);
            await factoryInstance.notifyRewardAmounts({ from: factoryCreator });

            // Move time in block to 3/4 time of vestingPeriod
            await time.increase((rewardDuration + vestingPeriod));
            await farmInstance.getReward({from: staker1});
            const timeGetReward = Number(await time.latest());

            const rewardedAmount = Number(await rewardToken.balanceOf(staker1, { from: staker1}));
            const periodFinish = Number(await farmInstance.periodFinish());
            const splitWindow = Number(await farmInstance.splitWindow());
            const calculatedAmount = rewardAmount * (Math.floor((timeGetReward - (periodFinish + splitWindow)) / splitWindow) + 1) / (splits + 1);
            expect(rewardedAmount).equals(calculatedAmount);

            // Move time in block greater than vestingPeriod
            await time.increase(splitWindow);
            await farmInstance.getReward({ from: staker1 });
            const rewardedAmount1 = Number(await rewardToken.balanceOf(staker1, { from: staker1}));
            expect(rewardedAmount1).equals(rewardAmount);
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
            for (let i of [0, 1, 2, 3, 4, 5]) {
                const availableReward = Number(await farmInstance.availableReward(staker1, { from: staker1}));
                const oldBalance = Number(await rewardToken.balanceOf(staker1, { from: staker1}));
                try {
                    await farmInstance.getReward({ from: staker1});
                } catch {
                    console.log("Error in " + i);
                }
                const newBalance = Number(await rewardToken.balanceOf(staker1, { from: staker1}));
                expect(newBalance - oldBalance).equals(availableReward);
                if (i === 0)
                    expect(newBalance - oldBalance).equals(0);
                else
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
            stakingToken = await TestUniswapERC20.new(1000000, { from: tokenCreator});

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

        it("Token is created successful", async() => {
            const balanceOfStaker = Number(await stakingToken.balanceOf(staker1, { from: staker1}));
            expect(balanceOfStaker).equals(100);
        });

        it("stakeWithPermit", async() => {
            const nonce = Number(await stakingToken.nonces(staker1));
            const deadline = Date.now() + 24 * 60 * 60 * 1000;   //add 24hours 
            const stakeAmount = 10;
            const digest = await getApprovalDigest(
                stakingToken,
                { owner: staker1, spender: farmInstance.address, value: stakeAmount},
                nonce,
                deadline
            );

            // Should be the private key of third account of ganache
            const privateKey = fs.readFileSync(__dirname + '/data/private_key', 'utf8').trim();
            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'),
                Buffer.from(privateKey.slice(2), 'hex'));
            
            await farmInstance.stakeWithPermit(stakeAmount, deadline, v, r, s, { from: staker1});
            const balanceOfStaker = Number(await farmInstance.balanceOf(staker1, { from: staker1}));
            expect(balanceOfStaker).equals(stakeAmount);
            const totalSupply = Number(await farmInstance.totalSupply({ from: staker1}));
            expect(totalSupply).equals(stakeAmount);

        });
    })

    context("Two stakers stake into the farm", async() => {
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
            await time.increase(rewardDuration + vestingPeriod + splitWindow);
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
            await time.increase(rewardDuration + vestingPeriod + splitWindow);
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
            await time.increase(rewardDuration / 2 + vestingPeriod + splitWindow + 5000);
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