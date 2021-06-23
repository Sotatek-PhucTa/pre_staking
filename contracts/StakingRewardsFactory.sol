pragma solidity >=0.6.11;

import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/IBEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/access/Ownable.sol";

import "./StakingRewards.sol";

contract StakingRewardsFactory is Ownable {
    //immutables
    uint256 public stakingRewardsGenesis;

    // the staking tokens for which the rewards contract has been deployed
    address[] public stakingTokens;

    // info about rewards for a particular staking token
    struct StakingRewardsInfo {
        address stakingRewards;
        address[] poolRewardToken;
        uint256[] poolRewardAmount;
    }

    mapping(address => StakingRewardsInfo) public stakingRewardsInfoByStakingToken;

    constructor(uint256 _stakingRewardsGenesis) public Ownable() {
        require(_stakingRewardsGenesis >= block.timestamp,
        "StakingRewardsFactory::constructor: genesis too soon");
        stakingRewardsGenesis = _stakingRewardsGenesis;
    }

    ////permisioned functions

    // deploy a staking reward contract for the staking token, and store the reward amount
    // the reward will be distributed to the staking reward contract no sooner than the genesis    
    function deploy(
        address stakingToken,
        address[] memory rewardTokens,
        uint256[] memory rewardAmounts
    ) public onlyOwner() {
        StakingRewardsInfo storage info = 
            stakingRewardsInfoByStakingToken[stakingToken];
        require(info.stakingRewards == address(0),
        "StakingRewardsFactory::deploy: already deployed");
        info.stakingRewards = address(
            new StakingRewards(address(this), rewardTokens, stakingToken)
        );

        for (uint8 i = 0; i < rewardTokens.length; i++) {
            require(rewardAmounts[i] > 0,
            "StakingRewardsFactory::addRewardToken: reward amount should be greater than 0");
            info.poolRewardToken.push(rewardTokens[i]);
            info.poolRewardAmount.push(rewardAmount[i]);
        }
        stakingTokens.push(stakingToken);
    }

    function rescueFunds(address stakingToken, address tokenAddress) 
        public onlyOwner
    {
        StakingRewardsInfo storage info = stakingRewardsInfoByStakingToken[stakingToken];
        require(info.stakingRewards != address(0),
        "StakingRewardsFactory::notifyRewardAmount: not deployed");
        StakingRewards(info.stakingRewards).rescueFunds(tokenAddress, msg.sender);
    }

    // Rescue leftover funds from factory
    function rescueFactoryFunds(address tokenAddress) public onlyOwner {
        IBEP20 token = IBEP20(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No balance for given token address");
        token.transfer(msg.sender, balance);
    }


    //// permisionless functions
    function notifyRewardAmounts() public {
        require(stakingTokens.length > 0,
        "StakingRewardsFactory::notifyRewardsAmount: called before any deploys");
        for (uint256 i = 0; i < stakingTokens.length; i++) {
            notifyRewardAmounts(stakingTokens[i]);
        }
    }

    // notify reward amount for an individual staking token
    // this is a fallback in case the notifyRewardsAmounts costs too much gas to call for other contracts
    function notifyRewardAmounts(address stakingToken) public {
        require(block.timestamp >= stakingRewardsGenesis,
        "StakingRewardsFactory::notifyRewardAmount: not ready");
        StakingRewardsInfo storage info = stakingRewardsInfoByStakingToken[stakingToken];
        require(
            info.stakingRewards != address(0),
            "StakingRewardsFactory::notifyRewardAmount: not deployed"
        );
        for (uint256 i = 0; i < info.poolRewardToken.length; i++) {
            uint256 rewardAmount = info.poolRewardAmount[i];
            if (rewardAmount > 0) {
                info.poolRewardAmount[i] = 0;
                require(IBEP20(info.poolRewardToken[i]).transfer(info.stakingRewards, rewardAmount),
                "StakingRewardsFactory::notifyRewardAmount: transfer failed");
                StakingRewards(info.stakingRewards).notifyRewardAmount(info.poolRewardToken[i], rewardAmout);
            }
        }
    }

    function stakingRewardsInfo(address stakingToken) 
    public view returns (address, address[] memory, uint256[] memory) {
        StakingRewardsInfo storage info = 
            stakingRewardsInfoByStakingToken[stakingToken];
            return (
                info.stakingRewards,
                info.poolRewardToken,
                info.poolRewardAmount
            );
    }
}