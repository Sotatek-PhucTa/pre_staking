pragma solidity>=0.6.11;

abstract contract RewardsDistributionRecipient {
    address public rewardDistributor;

    function notifyRewardAmount(address rewardToekn, uint256 reward) external virtual;

    modifier onlyRewardDitributor() {
        require(msg.sender == rewardDistributor, "Caller is not RewardDistribution contract");
        _;
    }
}