pragma solidity >=0.6.11;

import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/IBEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/access/Ownable.sol";

import "./StakingRewards.sol";

contract StakingRewardsFactory is Ownable {

    //===================STATE VARIABLES====================

    //Address of token that reward to stakers
    address public rewardToken;
    uint256 public stakingRewardGenesis;

    //the staking tokens for which the rewards contract has been deployed
    address[] public stakingTokens;

    //info about rewards for a particular staking token
    struct StakingRewardInfo {
        address stakingReward;   //Address of StakingReward Contract after deployed
        uint256 rewardAmount;   //The amount of Reward Token left in the StakingReward
        uint256 rewardDuration;  //Time for staker to stake and earn token
        uint256 vestingPeriod;   //Time period for get RewardToken
        uint256 claimable;       //Percentage of amount can get in first split in vestingPeriod;
    }

    mapping(address => StakingRewardInfo) public stakingRewardInfosByStakingToken;

    constructor(address _rewardToken, uint256 _stakingRewardGenesis) public Ownable() {
        require(_stakingRewardGenesis >= block.timestamp, 'StakingRewardFactory::constructor: genesis too soon');

        rewardToken = _rewardToken;
        stakingRewardGenesis = _stakingRewardGenesis;
    }

    //===================PERMISSIONED FUNCTIONS====================
    /**
     * @dev Deploy a StakingReward Contract for a particular stakingToken
     * @param stakingToken Token that stakers stake into the farm
     * @param rewardAmount Amount of StakingRewardFactory contract token left for StakingReward contract
     * @param rewardDuraton Time for staker to stake and earn rewardToken
     * @param vestingPeriod Time for staker get reward after rewardDuration
     * @param splits Number of times the reward will be released
     * @param claimable Percentage of amount of total vested reward that a staker can get each time the reward was released
     */
    function deploy(
        address stakingToken,
        uint256 rewardAmount,
        uint256 rewardDuration,
        uint256 vestingPeriod,
        uint256 splits,
        uint256 claimable
    ) public onlyOwner {
        StakingRewardInfo storage info = stakingRewardInfosByStakingToken[stakingToken];
        require(info.stakingReward == address(0), 'StakingRewardFactory::deploy: already deployed');

        info.stakingReward = address(
            new StakingReward(
                address(this),        //rewardDistributioner
                rewardToken,
                stakingToken,
                rewardDuration,
                vestingPeriod,
                splits,
                claimable
            )
        );
        info.rewardAmount = rewardAmount;
        info.rewardDuration = rewardDuration;
        info.vestingPeriod = vestingPeriod;
        info.claimable = claimable;
        stakingTokens.push(stakingToken);
    }

    //========================PERMISIONLESS FUNCTIONS============================
    /**
     * @dev Call notifyRewardAmount for all stakingToken that already deployed by this factory
     */
    function notifyRewardAmounts() public {
        require(stakingTokens.length > 0, 'StakingRewardFactory::notifyRewardAmount: no deployed');
        for (uint256 i = 0; i < stakingTokens.length; i++) {
            notifyRewardAmount(stakingTokens[i]);
        }
    }

    /**
     * @dev Notify reward amount for a StakingReward corresponding with stakingToken
     * transfer info.rewardAmount to StakingReward
     */
    function notifyRewardAmount(address stakingToken) public {
        require(block.timestamp >= stakingRewardGenesis, 'StakingRewardFactory::notifyRewardAmount: not ready');
        
        StakingRewardInfo storage info = stakingRewardInfosByStakingToken[stakingToken];
        require(info.stakingReward != address(0), 'StakingRewardFactory::notifyRewardAmount: not deployed');

        if (info.rewardAmount > 0) {
            uint256 rewardAmount = info.rewardAmount;
            info.rewardAmount = 0;
            require(IBEP20(rewardToken).transfer(info.stakingReward, rewardAmount),
            'StakingRewardFactory::notifyRewardAmount: transfer failed');
            StakingReward(info.stakingReward).notifyRewardAmount(rewardAmount);
        }
    }

    /**
     * @dev Rescue leftover fund from pool
     * @param stakingToken stakingToken in the pool that we want to rescue fund
     * @param tokenAddress address of the token we want to rescue
     */
    function rescueFunds(address stakingToken, address tokenAddress) public onlyOwner {
        StakingRewardInfo storage info = stakingRewardInfosByStakingToken[stakingToken];
        require(info.stakingReward != address(0), 'StakingRewardFactory::notifyRewardAmount: not deployed'); 
        StakingReward(info.stakingReward).rescueFunds(tokenAddress, msg.sender);
    }

    /**
     * @dev Rescue leftover fund from this factory
     * @param tokenAddress address of the token we want to rescue
     */
    function rescueFactoryFunds(address tokenAddress) public onlyOwner {
        IBEP20 token = IBEP20(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, 'No balance for given token address');
        token.transfer(msg.sender, balance);
    }
}

