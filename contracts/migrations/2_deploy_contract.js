const contractBNU = artifacts.require('BNUToken')
const contractAvt = artifacts.require('AvatarArtStaking')

module.exports = function (deployer) {
  const APR_MULTIPLIER = 1000;
  const APR = 100 * APR_MULTIPLIER;
  deployer.deploy(contractBNU)
    .then(() => {
      return deployer.deploy(contractAvt, contractBNU.address, APR)
    })
};