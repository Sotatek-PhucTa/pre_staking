const FactoryContract = artifacts.require("StakingRewardsFactory");
const expect = require('chai').expect;

contract('FactoryContract', (accounts) => {
    const [creator] = accounts;
    it("should create contract successfully", async () => {
        const genesisTime = Date.now() + 10 * 60000;   //Add 10 minutes from now
        const result = await FactoryContract.new(accounts[1], genesisTime, {from: creator});
        console.log(result.address);
        expect(result.address.toString()).to.be.a('string');
    });
});