const { network } = require('hardhat');
const { developmentChains } = require('../helper-hardhat-config');
const { verify } = require('../utils/verify');

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const args = [];
    const waitConfirmations = developmentChains.includes(network.name) ? 1 : 6;

    const basicNFT = await deploy('BasicNFT', {
        from: deployer,
        args,
        log: true,
        waitConfirmations,
    });

    if (!developmentChains.includes(network.name) && ETHERSCAN_API_KEY) {
        await verify(basicNFT.address, args);
    }
};

module.exports.tags = ['all', 'basicNFT'];
