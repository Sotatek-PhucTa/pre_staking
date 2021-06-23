pragma solidity>=0.6.11;

abstract contract RewardsDistributionRecipient {
    address public rewardsDistribution;

    function notifyRewardAmount(address rewardToekn, uint256 reward) external virtual;

    modifier onlyRewardDitribution() {
        require(msg.sender == rewardsDistribution, "Caller is not RewardDistribution contract");
        _;
    }
}