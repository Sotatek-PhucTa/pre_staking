pragma solidity=0.6.11;

import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/IBEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/access/Ownable.sol";

import "./StakingReward.sol";

contract StakingRewardsFactory is Ownable {

    //===================STATE VARIABLES====================

    //Address of token that reward to stakers
    address immutable public rewardToken;
    uint256 immutable public stakingRewardGenesis;

    //the staking tokens for which this factory deployed
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
        require(_stakingRewardGenesis >= block.timestamp, 'genesis too soon');
        require(_rewardToken != address(0), "zero rewardToken");

        rewardToken = _rewardToken;
        stakingRewardGenesis = _stakingRewardGenesis;
    }

    //===================PERMISSIONED FUNCTIONS====================
    /**
     * @notice Deploy a StakingReward Contract for a particular stakingToken
     * @param stakingToken Token that stakers stake into the farm
     * @param rewardAmount Amount of StakingRewardFactory contract token left for StakingReward contract
     * @param rewardDuration Time for staker to stake and earn rewardToken
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
    ) external onlyOwner {
        StakingRewardInfo storage info = stakingRewardInfosByStakingToken[stakingToken];
        require(info.stakingReward == address(0), 'already deployed');

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
     * @notice Call notifyRewardAmount for all stakingToken that already deployed by this factory
     */
    function notifyRewardAmounts() external {
        require(stakingTokens.length > 0, 'not deploy');
        for (uint256 i = 0; i < stakingTokens.length; i++) {
            notifyRewardAmount(stakingTokens[i]);
        }
    }

    /**
     * @notice Notify reward amount for a StakingReward corresponding with stakingToken
     * transfer info.rewardAmount to StakingReward
     */
    function notifyRewardAmount(address stakingToken) public {
        require(block.timestamp >= stakingRewardGenesis, 'not ready');
        
        StakingRewardInfo storage info = stakingRewardInfosByStakingToken[stakingToken];
        require(info.stakingReward != address(0), 'not deployed');

        if (info.rewardAmount > 0) {
            uint256 rewardAmount = info.rewardAmount;
            info.rewardAmount = 0;
            require(IBEP20(rewardToken).transfer(info.stakingReward, rewardAmount),
            'transfer failed');
            StakingReward(info.stakingReward).notifyRewardAmount(rewardAmount);
        }
    }

    /**
     * @notice Rescue leftover fund from pool that has been deployed
     * @param stakingToken stakingToken in the pool that we want to rescue fund
     * @param tokenAddress address of the token we want to rescue
     */
    function rescueFunds(address stakingToken, address tokenAddress) external onlyOwner {
        require(stakingToken != address(0), "Zero stakingToken");
        require(tokenAddress != address(0), "Zero tokenAddress");
        StakingRewardInfo storage info = stakingRewardInfosByStakingToken[stakingToken];
        require(info.stakingReward != address(0), 'not deployed'); 
        StakingReward(info.stakingReward).rescueFunds(tokenAddress, msg.sender);
    }

    /**
     * @notice Rescue leftover fund from this factory
     * @param tokenAddress address of the token we want to rescue
     */
    function rescueFactoryFunds(address tokenAddress) external onlyOwner {
        require(tokenAddress != address(0), "Zero tokenAddress");
        IBEP20 token = IBEP20(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, 'No balance');
        token.transfer(msg.sender, balance);
    }
}
