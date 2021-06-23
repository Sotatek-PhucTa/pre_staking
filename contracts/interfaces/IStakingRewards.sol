pragma solidity>=0.6.11;

interface IStakingRewards {
    //Views
    function lastTimeRewardApplicable() external view returns (uint256);

    function rewardPerToken(address rewardToken) external view returns (uint256);

    function earned(address account, address rewardToken) external view returns (uint256);

    function getRewardForDuration(address rewardToken) external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    //Mutative
    function stake(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function getReward(uint256 amount) external;

    function exit() external;
}