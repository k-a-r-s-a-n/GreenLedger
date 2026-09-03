/**
 * GreenLedger - Smart Contract Test Suite
 * Tests ERC-1155 minting, duplicate mint protection, URI resolution, and access control.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GreenBadge ERC-1155 Contract", function () {
  let greenBadge;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const GreenBadge = await ethers.getContractFactory("GreenBadge");
    greenBadge = await GreenBadge.deploy();
    await greenBadge.waitForDeployment();
  });

  it("Should initialize with correct name and symbol", async function () {
    expect(await greenBadge.name()).to.equal("GreenLedger Achievement Badges");
    expect(await greenBadge.symbol()).to.equal("GBADGE");
  });

  it("Should allow only the owner to mint an unlocked badge", async function () {
    await expect(
      greenBadge.connect(user1).mint(user1.address, 1, 1, "0x")
    ).to.be.revertedWith("Ownable: caller is not owner");

    await greenBadge.connect(owner).mint(user1.address, 1, 1, "0x");
    expect(await greenBadge.balanceOf(user1.address, 1)).to.equal(1);
    expect(await greenBadge.hasMintedBadge(1, user1.address)).to.be.true;
  });

  it("Should prevent duplicate minting of the same badge by the same user", async function () {
    await greenBadge.connect(owner).mint(user1.address, 2, 1, "0x");
    await expect(
      greenBadge.connect(owner).mint(user1.address, 2, 1, "0x")
    ).to.be.revertedWith("Badge already minted to this account");
  });

  it("Should revert when querying URI for an invalid token ID", async function () {
    await expect(greenBadge.uri(999)).to.be.revertedWith("URI query for nonexistent token");
  });

  it("Should return IPFS metadata URI for valid token ID", async function () {
    const uri1 = await greenBadge.uri(1);
    expect(uri1).to.include("ipfs://");
  });

  it("Should allow only contract owner to update metadata URI", async function () {
    await greenBadge.connect(owner).setURI(1, "ipfs://QmUpdatedURI/1.json");
    expect(await greenBadge.uri(1)).to.equal("ipfs://QmUpdatedURI/1.json");

    await expect(
      greenBadge.connect(user1).setURI(1, "ipfs://QmAttackerURI/1.json")
    ).to.be.revertedWith("Ownable: caller is not owner");
  });
});
