pragma solidity=0.6.11;

import "@pancakeswap/pancake-swap-lib/contracts/math/SafeMath.sol";
import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/SafeBEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/utils/ReentrancyGuard.sol";
import "./libraries/NativeMetaTransaction/NativeMetaTransaction.sol";


//Inheritance
import "./interfaces/IStakingRewards.sol";
import "./interfaces/IUniswapV2ERC20.sol";
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

    IBEP20 immutable public rewardToken;
    IBEP20 immutable public stakingToken;
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 immutable public rewardDuration;
    uint256 immutable vestingPeriod;
    uint256 immutable public splits;
    uint256 immutable public claimable;
    uint256 immutable public splitWindow;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public remainRewardedStaker;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public totalEarnedReward;
    mapping(address => uint256) public claimedSplits;
    mapping(address => bool) public hasClaimed;
    mapping(address => uint256) public totalVestedRewardForUser;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

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


    //==================== CONSTRUCTOR ====================

    /**
     * @notice constructor to construct a StakingReward
     * @dev _rewardDistributor  it is StakingRewardFactory contract in this case
     * @dev _rewardToken  token we want to reward for user
     * @dev _stakingToken  LP token we want everyone to stake
     * @dev _rewardDuration  Duration (in seconds) we want people to stake
     * @dev _vestingPeriod  period time (in seconds)  we release the reward
     * @dev _splits number of times we release the reward 
     * @dev _claimable percentage of reward we can get in each realease
     */
    constructor(
        address _rewardDistributor,
        address _rewardToken,
        address _stakingToken,
        uint256 _rewardDuration,
        uint256 _vestingPeriod,
        uint256 _splits,
        uint256 _claimable
    ) public {
        require(_rewardDistributor != address(0), "Zero rewardDistributor");
        require(_rewardToken != address(0), "Zero rewardToken");
        require(_stakingToken != address(0), "Zero stakingToken");
        require(_claimable.mul(_splits.add(1)) == 100, "Incorrect argument");

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
    /**
     * @return number of total LP token have been staked
     */
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @return number of LP token a particular account staked
     */
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    /**
     * @return the lasttime reward info has updated
     */
    function lastTimeRewardApplicable() public view override returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    /**
     *@return number of reward for each LP token in each second
     */
    function rewardPerToken() public view override returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18).div(_totalSupply)
            );
    }

    /**
     * the reward staker can earned in this time
     */
    function earned(address account) public view override returns (uint256) {
        return
            _balances[account].mul(rewardPerToken().sub(userRewardPerTokenPaid[account])).div(1e18)
            .add(rewards[account]);
    }

    function getRewardForDuration()
        external
        view
        override
        returns (uint256)
    {
        return rewardRate.mul(rewardDuration);
    }

    function availableReward(address account) external view override returns (uint256) {
        uint256 rewardedTime = periodFinish.add(splitWindow);
        if (block.timestamp < rewardedTime) 
            return 0;
        
        uint256 totalReward;
        if (totalEarnedReward[account] != 0) 
            totalReward = totalEarnedReward[account];
        else
            totalReward = earned(account);
        
        uint256 currentSplit = (block.timestamp).sub(rewardedTime).div(splitWindow).add(1);
        if (currentSplit > splits.add(1))
            currentSplit = splits.add(1);

        uint256 claimedSplit = claimedSplits[account];
        if (hasClaimed[account])
            claimedSplit = claimedSplit.add(1);

        return currentSplit.sub(claimedSplit).mul(claimable).mul(totalReward).div(100);
    } 
    //==================== MUTATIVE FUNCTIONS ==================== 

    /**
     * @notice Stake into the farm using off-chain message
     * @dev amount Amount of LP token
     * @dev expired time of off-chain meesage
     * @dev v part of signature
     * @dev r part of signature
     * @dev s part of signature
     */
    function stakeWithPermit(
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s   
    ) external nonReentrant updateReward(_msgSender()) {
        require(amount > 0, 'cant stake 0');
        if (_balances[_msgSender()] == 0)
            remainRewardedStaker = remainRewardedStaker.add(1);

        _totalSupply = _totalSupply.add(amount);
        _balances[_msgSender()] = _balances[_msgSender()].add(amount);

        IUniswapV2ERC20(address(stakingToken)).permit(_msgSender(), address(this), amount, deadline, v, r, s);
        stakingToken.safeTransferFrom(_msgSender(), address(this), amount);
        emit Staked(_msgSender(), amount);
    }

    /**
     * @notice Stake into the farm using on-chain message
     * @dev Staker must approve for contract for taking amount of LP token
     * @param amount Amount of LP token 
     */
    function stake(uint256 amount) external override nonReentrant updateReward(_msgSender()) {
        require(amount > 0, 'cant stake 0');
        if (_balances[_msgSender()] == 0)
            remainRewardedStaker = remainRewardedStaker.add(1);

        _totalSupply = _totalSupply.add(amount);
        _balances[_msgSender()] = _balances[_msgSender()].add(amount);
        stakingToken.safeTransferFrom(_msgSender(), address(this), amount);
        emit Staked(_msgSender(), amount);
    }

    /**
     * @notice Withdraw LP token out of the farm
     * @param amount Amount of LP token that we want to withdraw
     */
    function withdraw(uint256 amount) public override nonReentrant updateReward(_msgSender()) {
        require(amount > 0, 'cant withdraw 0');
        _totalSupply = _totalSupply.sub(amount);
        _balances[_msgSender()] = _balances[_msgSender()].sub(amount);
        stakingToken.safeTransfer(_msgSender(), amount);
        emit Withdrawn(_msgSender(), amount);
    }

    /**
     * @notice staker get reward out of the farm, can get part of the reward in each release
     */
    function getReward() public override nonReentrant updateReward(_msgSender()) {
        uint256 rewardedTime = periodFinish.add(splitWindow);
        require(block.timestamp >= rewardedTime, 'Cant claims now');

        uint256 reward;
        uint256 claimedSplitsForUser = claimedSplits[_msgSender()];
        uint256 currentDate = block.timestamp;

        if (claimedSplitsForUser == 0 && !hasClaimed[_msgSender()]) {
            totalEarnedReward[_msgSender()] = rewards[_msgSender()];
            reward = reward.add(rewards[_msgSender()].mul(claimable).div(100));
            totalVestedRewardForUser[_msgSender()] = rewards[_msgSender()].sub(reward);
        }
        if (claimedSplitsForUser < splits) {
            uint256 currentSplit = (currentDate.sub(rewardedTime)).div(splitWindow);
            currentSplit = currentSplit > splits ? splits: currentSplit;
            reward = reward.add(
                totalVestedRewardForUser[_msgSender()].mul(currentSplit.sub(claimedSplitsForUser)).div(splits)
            );

            if (claimedSplitsForUser != currentSplit) {
                claimedSplits[_msgSender()] = currentSplit;
            }
            if (reward > 0) {
                hasClaimed[_msgSender()] = true;
                rewards[_msgSender()] = rewards[_msgSender()].sub(reward);
                rewardToken.safeTransfer(_msgSender(), reward);
                emit RewardPaid(_msgSender(), reward);
            }

            if (claimedSplits[_msgSender()] == splits)
                remainRewardedStaker = remainRewardedStaker.sub(1);
        }
    }

    /**
     * @notice Staker exit the farm: Withdraw all LP token and get available reward amount
     */
    function exit() external override {
        withdraw(_balances[_msgSender()]);
        if (block.timestamp >= periodFinish.add(splitWindow)) getReward();
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

    function rescueFunds(address tokenAddress, address receiver) external onlyRewardDistributor {
        require(remainRewardedStaker == 0, "Cant rescue now");
        require(tokenAddress != address(stakingToken), 'cant rescue stakingToken');
        IBEP20(tokenAddress).transfer(receiver, IBEP20(tokenAddress).balanceOf(address(this)));
    }
}

