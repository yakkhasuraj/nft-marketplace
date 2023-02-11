const { assert, expect } = require('chai');
const { network, deployments, ethers, getNamedAccounts } = require('hardhat');
const { developmentChains } = require('../helper-hardhat-config');

!developmentChains.includes(network.name)
    ? describe.skip
    : describe('Nft Marketplace Unit Tests', function () {
          let nftMarketplace, basicNFT, deployer, player;
          const PRICE = ethers.utils.parseEther('0.1');
          const TOKEN_ID = 0;

          beforeEach(async function () {
              const accounts = await ethers.getSigners();
              deployer = accounts[0];
              player = accounts[1];

              await deployments.fixture(['all']);
              nftMarketplace = await ethers.getContract('NFTMarketplace');
              basicNFT = await ethers.getContract('BasicNFT');

              await basicNFT.mintNFT();
              await basicNFT.approve(nftMarketplace.address, TOKEN_ID);
          });

          // it('lists and can be bought', async function () {
          //     await nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE);

          //     const playerConnectedNFTMarketplace =
          //         nftMarketplace.connect(player);
          //     await playerConnectedNFTMarketplace.buyItem(
          //         basicNFT.address,
          //         TOKEN_ID,
          //         { value: PRICE }
          //     );
          //     const newOwner = await basicNFT.ownerOf(TOKEN_ID);
          //     const deployerProceeds = await nftMarketplace.getProceeds(
          //         deployer.address
          //     );
          //     assert(newOwner.toString() == player.address);
          //     assert(deployerProceeds.toString() == PRICE.toString());
          // });

          describe('listItem', () => {
              it('emits an event after listing an item', async function () {
                  expect(
                      await nftMarketplace.listItem(
                          basicNFT.address,
                          TOKEN_ID,
                          PRICE
                      )
                  ).to.emit('ItemListed');
              });

              it("exclusively items that haven't been listed", async function () {
                  await nftMarketplace.listItem(
                      basicNFT.address,
                      TOKEN_ID,
                      PRICE
                  );

                  await expect(
                      nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      'NFTMarketplace_AlreadyListed'
                  );
              });

              it('exclusively allows owners to list', async function () {
                  nftMarketplace = nftMarketplace.connect(player);
                  await basicNFT.approve(player.address, TOKEN_ID);

                  await expect(
                      nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      'NFTMarketplace_NotOwner'
                  );
              });

              it('needs approvals to list item', async function () {
                  await basicNFT.approve(
                      ethers.constants.AddressZero,
                      TOKEN_ID
                  );

                  await expect(
                      nftMarketplace.listItem(basicNFT.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      'NFTMarketplace_NotApprovedForMarketplace'
                  );
              });

              it('updates listing with seller and price', async function () {
                  await nftMarketplace.listItem(
                      basicNFT.address,
                      TOKEN_ID,
                      PRICE
                  );
                  const listing = await nftMarketplace.getListing(
                      basicNFT.address,
                      TOKEN_ID
                  );

                  assert(listing.price.toString() == PRICE.toString());
                  assert(listing.seller == deployer.address);
              });
          });

          describe('buyItem', () => {
              it("reverts if the item isn't listed", async function () {
                  await expect(
                      nftMarketplace.buyItem(basicNFT.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      'NFTMarketplace_NotListed'
                  );
              });

              it("reverts if the price isn't met", async function () {
                  await nftMarketplace.listItem(
                      basicNFT.address,
                      TOKEN_ID,
                      PRICE
                  );
                  await expect(
                      nftMarketplace.buyItem(basicNFT.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      'NFTMarketplace_PriceNotMet'
                  );
              });

              it('transfers the nft to the buyer and updates internal proceeds record', async function () {
                  await nftMarketplace.listItem(
                      basicNFT.address,
                      TOKEN_ID,
                      PRICE
                  );
                  nftMarketplace = nftMarketplace.connect(player);
                  expect(
                      await nftMarketplace.buyItem(basicNFT.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  ).to.emit('ItemBought');

                  const newOwner = await basicNFT.ownerOf(TOKEN_ID);
                  const deployerProceeds = await nftMarketplace.getProceeds(
                      deployer.address
                  );

                  assert(newOwner == player.address);
                  assert(deployerProceeds.toString() == PRICE.toString());
              });
          });

          describe('cancelListing', () => {
              it('reverts if there is no listing', async function () {
                  await expect(
                      nftMarketplace.cancelListing(basicNFT.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      'NFTMarketplace_NotListed'
                  );
              });

              it('reverts if anyone but the owner tries to call', async function () {
                  await nftMarketplace.listItem(
                      basicNFT.address,
                      TOKEN_ID,
                      PRICE
                  );
                  nftMarketplace = nftMarketplace.connect(player);
                  await basicNFT.approve(player.address, TOKEN_ID);

                  await expect(
                      nftMarketplace.cancelListing(basicNFT.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      'NFTMarketplace_NotOwner'
                  );
              });

              it('emits event and removes listing', async function () {
                  await nftMarketplace.listItem(
                      basicNFT.address,
                      TOKEN_ID,
                      PRICE
                  );
                  expect(
                      await nftMarketplace.cancelListing(
                          basicNFT.address,
                          TOKEN_ID
                      )
                  ).to.emit('ItemCanceled');

                  const listing = await nftMarketplace.getListing(
                      basicNFT.address,
                      TOKEN_ID
                  );
                  assert(listing.price.toString() == '0');
              });
          });

          describe('updateListing', () => {
              it('must be owner and listed', async function () {
                  await expect(
                      nftMarketplace.updateListing(
                          basicNFT.address,
                          TOKEN_ID,
                          PRICE
                      )
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      'NFTMarketplace_NotListed'
                  );

                  await nftMarketplace.listItem(
                      basicNFT.address,
                      TOKEN_ID,
                      PRICE
                  );
                  nftMarketplace = nftMarketplace.connect(player);

                  await expect(
                      nftMarketplace.updateListing(
                          basicNFT.address,
                          TOKEN_ID,
                          PRICE
                      )
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      'NFTMarketplace_NotOwner'
                  );
              });

              it('updates the price of the item', async function () {
                  const updatedPrice = ethers.utils.parseEther('0.2');
                  await nftMarketplace.listItem(
                      basicNFT.address,
                      TOKEN_ID,
                      PRICE
                  );

                  expect(
                      await nftMarketplace.updateListing(
                          basicNFT.address,
                          TOKEN_ID,
                          updatedPrice
                      )
                  ).to.emit('ItemListed');
                  const listing = await nftMarketplace.getListing(
                      basicNFT.address,
                      TOKEN_ID
                  );
                  assert(listing.price.toString() == updatedPrice.toString());
              });
          });

          describe('withdrawProceeds', () => {
              it("doesn't allow 0 proceed withdrawals", async function () {
                  await expect(
                      nftMarketplace.withdrawProceeds()
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      'NFTMarketplace_NoProceeds'
                  );
              });

              it('withdraws proceeds', async function () {
                  await nftMarketplace.listItem(
                      basicNFT.address,
                      TOKEN_ID,
                      PRICE
                  );
                  nftMarketplace = nftMarketplace.connect(player);
                  await nftMarketplace.buyItem(basicNFT.address, TOKEN_ID, {
                      value: PRICE,
                  });
                  nftMarketplace = nftMarketplace.connect(deployer);

                  const deployerProceedsBefore =
                      await nftMarketplace.getProceeds(deployer.address);
                  const deployerBalanceBefore = await deployer.getBalance();
                  const transactionResponse =
                      await nftMarketplace.withdrawProceeds();
                  const transactionReceipt = await transactionResponse.wait(1);
                  const { gasUsed, effectiveGasPrice } = transactionReceipt;
                  const gasCost = gasUsed.mul(effectiveGasPrice);
                  const deployerBalanceAfter = await deployer.getBalance();

                  assert(
                      deployerBalanceAfter.add(gasCost).toString() ==
                          deployerProceedsBefore
                              .add(deployerBalanceBefore)
                              .toString()
                  );
              });
          });
      });
