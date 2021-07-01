pragma solidity>=0.6.11;

import "@pancakeswap/pancake-swap-lib/contracts/math/SafeMath.sol";
import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/SafeBEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/utils/ReentrancyGuard.sol";
import "./libraries/NativeMetaTransaction/NativeMetaTransaction.sol";


//Inheritance
import "./interfaces/IStakingRewards.sol";
import "./RewardsDistributionRecipient.sol";


contract StakingReward is 
    IStakingRewards,
    RewardsDistributionRecipient,
    ReentrancyGuard,
    NativeMetaTransaction
{
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    //==================== STATE VARIABLES =======================

    IBEP20 public rewardToken;
    IBEP20 public stakingToken;
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public rewardDuration;
    uint256 public vestingPeriod;
    uint256 public splits;
    uint256 public claimable;
    uint256 public splitWindow;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public totalEarnedReward;
    mapping(address => uint256) public claimedSplits;
    mapping(address => bool) public hasClaimed;
    mapping(address => uint256) public totalVestedRewardForUser;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;


    //==================== CONSTRUCTOR ====================

    constructor(
        address _rewardDistributor,
        address _rewardToken,
        address _stakingToken,
        uint256 _rewardDuration,
        uint256 _vestingPeriod,
        uint256 _splits,
        uint256 _claimable
    ) public {
        rewardToken = IBEP20(_rewardToken);
        stakingToken = IBEP20(_stakingToken);
        rewardDistributor = _rewardDistributor;
        rewardDuration = _rewardDuration;
        vestingPeriod = _vestingPeriod;
        splits = _splits;
        claimable = _claimable;
        splitWindow = _vestingPeriod.div(_splits);
        _initializeEIP712('PreStakingV1');
    }

    //==================== VIEWS ====================
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view override returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view override returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18).div(_totalSupply)
            );
    }

    function earned(address account) public view override returns (uint256) {
        return
            _balances[account].mul(rewardPerToken().sub(userRewardPerTokenPaid[account])).div(1e18)
            .add(rewards[account]);
    }

    function getRewardForDuration(address rewardToken)
        external
        view
        override
        returns (uint256)
    {
        return rewardRate.mul(rewardDuration);
    }

    //==================== MUTATIVE FUNCTIONS ==================== 

    function stakeWithPermit(
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s   
    ) external nonReentrant updateReward(_msgSender()) {
        require(amount > 0, 'Cannot stake 0');
        _totalSupply = _totalSupply.add(amount);
        _balances[_msgSender()] = _balances[_msgSender()].add(amount);

        IUniswapV2ERC20(address(stakingToken)).permit(_msgSender(), address(this), amount, deadline, v, r, s);
        stakingToken.safeTransferFrom(_msgSender(), address(this), amount);
        emit Staked(_msgSender(), amount);
    }

    function stake(uint256 amount) external override nonReentrant updateReward(_msgSender()) {
        require(amount > 0, 'Cannot stake 0');
        _totalSupply.add(amount);
        _balances[_msgSender()] = _balances[_msgSender()].add(amount);
        stakingToken.safeTransferFrom(_msgSender(), address(this), amount);
        emit Staked(_msgSender(), amount);
    }

    function withdraw(uint256 amount) external override nonReentrant updateReward(_msgSender()) {
        require(amount > 0, 'Cannot withdraw 0');
        _totalSupply = _totalSupply.sub(amount);
        _balances[_msgSender()] = _balances[_msgSender()].sub(amount);
        stakingToken.safeTransfer(_msgSender(), amount);
        emit Withdrawn(_msgSender(), amount);
    }

    function getReward() public override nonReentrant updateReward(_msgSender()) {
        require(block.timestamp >= periodFinish, 'Cannot claims token now');

        uint256 reward;
        uint256 claimedSplitsForUser = claimedSplits[_msgSender()];
        uint256 currentDate = block.timestamp;

        if (claimedSplitsForUser == 0 && !hasClaimed[_msgSender()]) {
            totalEarnedReward[_msgSender()] = rewards[_msgSender()];
            reward = reward.add(rewards[_msgSender()].mul(claimable).div(100));
            totalVestedRewardForUser[_msgSender()] = rewards[_msgSender()].sub(reward);
        }
        if (claimedSplitsForUser < splits) {
            uint256 currentSplit = (currentDate.sub(periodFinish)).div(splitWindow);
            currentSplit = currentSplit > splits ? splits: currentSplit;
            reward = reward.add(
                totalVestedRewardForUser[_msgSender()].mul(currentSplit.sub(claimedSplitsForUser)).div(splits)
            );

            if (claimedSplitsForUser != currentSplit) claimedSplits[_msgSender()] = currentSplit;
            if (reward > 0) {
                hasClaimed[_msgSender()] = true;
                rewards[_msgSender()] = reward[_msgSender()].sub(reward);
                rewardToken.safeTransfer(_msgSender(), reward);
                emit RewardPaid(_msgSender(), reward);
            }
        }
    }

    function exit() external override {
        withdraw(_balances[_msgSender()]);
        if (block.timestamp >= periodFinish) getReward();
    }

    /*===================RESTRICTED FUNCTIONS================*/

    function notifyRewardAmount(uint256 reward) external override onlyRewardDistributor updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(rewardDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover).div(rewardDuration);
        }

        uint256 balance = rewardToken.balanceOf(address(this));
        require(rewardRate <= balance.div(rewardDuration), 'Provided reward to high');

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardDuration);
        emit RewardAdded(reward);
    }

    function rescueFunds(address tokenAddress, address receiver) external onlyDistributor {
        require(tokenAddress != address(stakingToken), 'StakingRewards: rescue of staking token not allowed');
        IBEP20(tokenAddress).transfer(receiver, IBEP20(tokenAddress).balanceOf(address(this)));
    }

    /*===================EVENTS================*/

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    /*===================MODIFIERS================*/
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }
}


interface IUniswapV2ERC20 {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external; 
}