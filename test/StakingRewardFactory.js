const expect = require('chai').expect;
const utils = require('./helper/utils');
const { time, expectRevert } = require('@openzeppelin/test-helpers');

const FactoryContract = artifacts.require("StakingRewardsFactory");
const StakingReward = artifacts.require("StakingReward");
const TestBEP20 = artifacts.require("TestBEP20");

contract('FactoryContract', (accounts) => {
    xcontext("#About constructor", async() => {
        const [creator, simulateRewardToken] = accounts;
        it("should create contract successfully", async () => {
            const genesisTime = Number(await time.latest()) + 10 * 60 * 1000  //Add 10 minutes from now and ourtimezone;
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
            const genesisTime = Number(await time.latest()) - 10 * 60 * 1000;   // Sub 10 minute from now
            const result = await utils.shouldThrow(FactoryContract.new(simulateRewardToken, genesisTime, {from: creator}));
            expect(result).equals(true);
        })
    });

    xcontext("#Create a single Farm", async() => {
        const [creator, simulateRewardToken, simulateStakingToken, creator1] = accounts;
        let factoryInstance;
        const rewardAmount = 600;
        const rewardDuration = 600;
        const vestingPeriod = 1200;
        const splits = 4;
        const claimable = 20;
        const deployParams = [simulateStakingToken, rewardAmount, rewardDuration, vestingPeriod, splits, claimable];
        beforeEach(async() => {
            const genesisTime = Number(await time.latest()) + 10 * 1000 //Add 10 second from now
            factoryInstance = await FactoryContract.new(simulateRewardToken, genesisTime, {from: creator});
        });

        it("should deploy success", async() => {
            const result = await utils.shouldThrow(factoryInstance.deploy(...deployParams, {from: creator}));
            expect(result).equals(false);
        });

        it("should deploy with correct param", async() => {
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

        it("should not deploy contract with same Staking token", async() => {
            await factoryInstance.deploy(...deployParams, { from: creator });
            const result = await utils.shouldThrow(factoryInstance.deploy(...deployParams, { from: creator}));
            expect(result).equals(true);
        });

        it("should not deploy when sender is not owner", async() => {
            // suppose a random address be sender
            const result = await utils.shouldThrow(factoryInstance.deploy(...deployParams, { from: creator1}));
            expect(result).equals(true);
        })
    });
    
    xcontext("#Create two farm", async () => {
        const [creator, simulateRewardToken, simulateStakingToken, simulateStakingToken1] = accounts;
        const rewardAmount = 600;
        const rewardDuration = 600;
        const vestingPeriod = 1200;
        const splits = 4;
        const claimable = 20;
        const deployParams = [simulateStakingToken, rewardAmount, rewardDuration, vestingPeriod, splits, claimable];
        const deployParams1 = [simulateStakingToken1, rewardAmount, rewardDuration, vestingPeriod, splits, claimable];

        it("Should create two farm", async() => {
            const genesisTime = Number(await time.latest()) + 10 * 1000;   // Add 10 second from now
            const factoryInstance = await FactoryContract.new(simulateRewardToken, genesisTime, { from: creator});
            await factoryInstance.deploy(...deployParams, {from: creator});
            await factoryInstance.deploy(...deployParams1, {from: creator});

            expect(await factoryInstance.stakingTokens(0)).equals(simulateStakingToken); expect(await factoryInstance.stakingTokens(1)).equals(simulateStakingToken1); })
    })        

    it("#Deploy an BEP20 token", async() => {
        const [creator, receiver] = accounts;
        const token1 = await TestBEP20.new(1000, {from: creator});
        expect(await token1.getOwner()).equals(creator);
        await token1.transfer(receiver, 400, { from: creator});
        expect(Number(await token1.balanceOf(creator, {from: creator}))).equals(600);
        expect(Number(await token1.balanceOf(receiver, {from: creator}))).equals(400);

    })
    context("#Deploy and call notifyRewardsAmount", async() => {
        let rewardTokenInstance, factoryInstance;
        const [rewardTokenCreator, factoryCreator, simulateStakingToken] = accounts;
        const rewardAmount = 600;
        const rewardDuration = 600;
        const vestingPeriod = 1200;
        const splits = 4;
        const claimable = 20;

        beforeEach(async() => {
            rewardTokenInstance = await TestBEP20.new(1000, {from: rewardTokenCreator});
            await rewardTokenInstance.transfer(factoryCreator, 600, { from: rewardTokenCreator});
            // const genesisTime = Number(await time.latest() + 1 * 1000);  //Add 10 miliseconds
            const genesisTime = Number(await time.latest()) + 10 * 1000;  //Add 10 seconds
            factoryInstance = await FactoryContract.new(rewardTokenInstance.address, genesisTime, {from: factoryCreator});
            await rewardTokenInstance.transfer(factoryInstance.address, 600, {from: factoryCreator})
        });

        it("Should not deploy by others than owner", async() => {
            const deployParams = [simulateStakingToken, rewardAmount, rewardDuration, vestingPeriod, splits, claimable];
            const result = await utils.shouldThrow(factoryInstance.deploy(...deployParams, {from: rewardTokenCreator}));
            expect(result).equals(true);
        });

        it("Should not deploy by others than owner 2", async() => {
            const deployParams = [simulateStakingToken, rewardAmount, rewardDuration, vestingPeriod, splits, claimable];
            await expectRevert(factoryInstance.deploy(...deployParams, {from: rewardTokenCreator}), "Ownable kk");
        });

        xit("Call notifyRewardAmounts() success", async() => {
            const deployParams = [simulateStakingToken, rewardAmount, rewardDuration, vestingPeriod, splits, claimable];
            await factoryInstance.deploy(...deployParams, {from: factoryCreator});
            const farmInfo = await factoryInstance.stakingRewardInfosByStakingToken(simulateStakingToken);
            const farmAddress = farmInfo.stakingReward;

            // Before call notifyRewardAmounts(), balance of farmAddress is 0
            const balanceFarmBeforeCall = Number(await rewardTokenInstance.balanceOf(farmAddress));
            expect(balanceFarmBeforeCall).equals(0);

            // After call notifyRewardAmounts(), balance of farmAddress is equal to rewardAmount
            await time.increase(30 * 1000);   //Add 30 seconds
            await factoryInstance.notifyRewardAmounts({from: factoryCreator});
            const balanceFarmAfterCall = Number(await rewardTokenInstance.balanceOf(farmAddress));
            expect(balanceFarmAfterCall).equals(rewardAmount);

            // After call notifyRewardAmountts(), rewardAmount for farmInstance should be 0
            const rewardInfoAfterCalled = Number((await factoryInstance.stakingRewardInfosByStakingToken(simulateStakingToken)).rewardAmount);
            expect(rewardInfoAfterCalled).equals(0);
        });

        xit("Should call notifyRewardAmounts(stakingToken) success", async() => {
            const deployParams = [simulateStakingToken, rewardAmount, rewardDuration, vestingPeriod, splits, claimable];
            await factoryInstance.deploy(...deployParams, {from: factoryCreator});
            const farmInfo = await factoryInstance.stakingRewardInfosByStakingToken(simulateStakingToken);
            const farmAddress = farmInfo.stakingReward;

            // Before call notifyRewardAmounts(), balance of farmAddress is 0
            const balanceFarmBeforeCall = Number(await rewardTokenInstance.balanceOf(farmAddress));
            expect(balanceFarmBeforeCall).equals(0);

            // After call notifyRewardAmounts(), balance of farmAddress is equal to rewardAmount
            await time.increase(30 * 1000);   //Add 30 seconds
            await factoryInstance.notifyRewardAmount(simulateStakingToken, {from: factoryCreator});
            const balanceFarmAfterCall = Number(await rewardTokenInstance.balanceOf(farmAddress));
            expect(balanceFarmAfterCall).equals(rewardAmount);

            // After call notifyRewardAmountts(), rewardAmount for farmInstance should be 0
            const rewardInfoAfterCalled = Number((await factoryInstance.stakingRewardInfosByStakingToken(simulateStakingToken)).rewardAmount);
            expect(rewardInfoAfterCalled).equals(0);
        });

        it("Should call notifyRewardAmount failed", async() => {
            //rewardAmount > currentBalance in factoryContract
            const deployParams = [simulateStakingToken, rewardAmount + 1, rewardDuration, vestingPeriod, splits, claimable];
            await factoryInstance.deploy(...deployParams, {from: factoryCreator});
            const farmInfo = await factoryInstance.stakingRewardInfosByStakingToken(simulateStakingToken);
            const farmAddress = farmInfo.stakingReward;

            await time.increase(30 * 1000);     //Add 30 seconds
            const result = await utils.shouldThrow(factoryInstance.notifyRewardAmounts({from: factoryCreator}));
        });
    });
});