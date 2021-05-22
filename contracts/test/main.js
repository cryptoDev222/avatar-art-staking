const contractBNU = artifacts.require('BNUToken')
const contractAvt = artifacts.require('AvatarArtStaking')
const { time } = require("@openzeppelin/test-helpers");

let token,stakeContract;
contract('contract stake', (accounts) => {

  const owner = accounts[0];
  const balOwner = 10000;
  const user1 = accounts[1];
  const balUser1 = 10000;
  const user2 = accounts[2];
  const balUser2 = 20000;

  const APR_MULTIPLIER = 1000;
  const APR = 100 * APR_MULTIPLIER;
  const DAY_ONE_YEAR = 365;
  const HOUR_ONE_DAY = 24;

  beforeEach(async () => {
    token = await contractBNU.new({ from: owner });
    stakeContract = await contractAvt.new(token.address, APR, { from: owner });

    // set balance for owner
    await token.mint(owner, balOwner, { from: owner });
    await token.mint(user1, balUser1, { from: owner });
    await token.mint(user2, balUser2, { from: owner });

    await token.mint(stakeContract.address, 2000, { from: owner });
  })

  it('check balance init earch user', async () => {
    const resBalOwner = await token.balanceOf(owner);
    assert.strictEqual(resBalOwner.toNumber(), balOwner);
    const resBal1 = await token.balanceOf(user1);
    assert.strictEqual(resBal1.toNumber(), balUser1);
    const resBal2 = await token.balanceOf(user2);
    assert.strictEqual(resBal2.toNumber(), balUser2);
  });

  it('user staking, check total stake and interest', async () => {
    //user1 stake
    const amountStake1 = 5000;
    await token.approve(stakeContract.address, amountStake1, { from: user1 });
    await stakeContract.stake(amountStake1, { from: user1 });
    const resultAmount = await stakeContract.getUserStakedAmount(user1);
    assert.strictEqual(resultAmount.toNumber(), amountStake1);
    // user2 stake the first
    const amountStake2 = 10000;
    await token.approve(stakeContract.address, amountStake2, { from: user2 });
    await stakeContract.stake(amountStake2, { from: user2 });
    const resultAmount2 = await stakeContract.getUserStakedAmount(user2);
    assert.strictEqual(resultAmount2.toNumber(), amountStake2);

    const totalStaked = await stakeContract.getTotalStaked();
    assert.strictEqual(totalStaked.toNumber(), amountStake1 + amountStake2);
    // checking for interest
    const timeInterest = 5;
    await time.increase(time.duration.hours(timeInterest))
    const timePendding = await stakeContract.getUserRewardPendingTime(user2);
    assert.strictEqual(timePendding.toNumber()/60/60, timeInterest);
    const interestExpect = (amountStake2*APR/APR_MULTIPLIER/100)/DAY_ONE_YEAR/HOUR_ONE_DAY*timeInterest;
    const interest = await stakeContract.getUserEarnedAmount(user2);
    assert.strictEqual(interest.toNumber(), parseInt(interestExpect));

    // user2 stake the second
    const amountStake2R2 = 5000;
    await token.approve(stakeContract.address, amountStake2R2, { from: user2 });
    await stakeContract.stake(amountStake2R2, { from: user2 });
    const totalStakeUser2 = await stakeContract.getUserStakedAmount(user2);
    assert.strictEqual(totalStakeUser2.toNumber(), amountStake2R2+amountStake2);
    const timeCal = await stakeContract.getUserRewardPendingTime(user2);
    // reset time reward pendding
    assert.strictEqual(timeCal.toNumber(), 0);
  });

  it('tesing for nft stage and withdraw', async () => {
    // create sage for 5 days starting from now.
    const timeStage = 5;
    const from = Math.floor(Date.now() / 1000);
    const to = Math.floor(new Date().setDate(new Date().getDate()+ timeStage)/ 1000)
    await stakeContract.createNftStage(from, to, {from: owner});
    const listStage = await stakeContract.getNftStages();
    assert.strictEqual(+listStage[0].startTime, from);

    //user stake 5000
    const stakeRound1 = 5000;
    await token.approve(stakeContract.address, stakeRound1, { from: user1 });
    await stakeContract.stake(stakeRound1, { from: user1 });
    const stakeRound2 = 5000;
    await token.approve(stakeContract.address, stakeRound2, { from: user1 });
    await stakeContract.stake(stakeRound2, { from: user1 });

    // get ticket user to now
    const nftTicket = await stakeContract.getUserNftTicket(user1, 0, false);
    assert.strictEqual(nftTicket.toNumber() , stakeRound1+stakeRound2);
    // get ticket user to end stage
    const nftTicketEnd = await stakeContract.getUserNftTicket(user1, 0, true);
    assert.strictEqual(nftTicketEnd.toNumber(), (stakeRound1+stakeRound2)*(timeStage+1));

    // withdraw 1000 bnu after 5 hours when lock, only withdraw interest
    const timeInterest = 5;
    const amounWithdraw = 1000;
    await time.increase(time.duration.hours(timeInterest))
    const interest = await stakeContract.getUserEarnedAmount(user1);
    await stakeContract.withdraw(amounWithdraw, {from: user1});
    const balUser1 = await token.balanceOf(user1);
    assert.strictEqual(balUser1.toNumber(), interest.toNumber());
    // reset interest
    const interestAfterWd = await stakeContract.getUserEarnedAmount(user1);
    assert.strictEqual(0, interestAfterWd.toNumber());

    // admin set stage to allow withdraw
    await stakeContract.setNftStage(0, true, true, { from: owner });
    await stakeContract.withdraw(amounWithdraw, {from: user1});
    const balAfter = await token.balanceOf(user1);
    assert.strictEqual(balAfter.toNumber(), +amounWithdraw + +balUser1);
    
  });
})
