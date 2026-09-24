/**
 * GreenLedger - Smart Contract Test Suite
 * Tests ERC-1155 self-claim minting, duplicate mint protection, URI
 * resolution, access control, ERC-165 detection, and transfers.
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

  it("Should advertise ERC-165 and ERC-1155 interface support", async function () {
    expect(await greenBadge.supportsInterface("0x01ffc9a7")).to.be.true; // ERC-165
    expect(await greenBadge.supportsInterface("0xd9b67a26")).to.be.true; // ERC-1155
    expect(await greenBadge.supportsInterface("0xffffffff")).to.be.false;
  });

  it("Should allow any user to self-claim their own badge exactly once", async function () {
    await greenBadge.connect(user1).mint(user1.address, 1, 1, "0x");
    expect(await greenBadge.balanceOf(user1.address, 1)).to.equal(1);
    expect(await greenBadge.hasMintedBadge(1, user1.address)).to.be.true;

    await expect(
      greenBadge.connect(user1).mint(user1.address, 1, 1, "0x")
    ).to.be.revertedWith("Badge already minted to this account");
  });

  it("Should allow the owner to mint on behalf of any account", async function () {
    await greenBadge.connect(owner).mint(user1.address, 2, 1, "0x");
    expect(await greenBadge.balanceOf(user1.address, 2)).to.equal(1);
  });

  it("Should reject minting on behalf of another account by non-owners", async function () {
    await expect(
      greenBadge.connect(user1).mint(user2.address, 1, 1, "0x")
    ).to.be.revertedWith("Only the recipient or owner may mint");
  });

  it("Should prevent duplicate minting of the same badge by the same user", async function () {
    await greenBadge.connect(owner).mint(user1.address, 2, 1, "0x");
    await expect(
      greenBadge.connect(owner).mint(user1.address, 2, 1, "0x")
    ).to.be.revertedWith("Badge already minted to this account");
  });

  it("Should reject invalid badge IDs and non-unit amounts", async function () {
    await expect(
      greenBadge.connect(user1).mint(user1.address, 999, 1, "0x")
    ).to.be.revertedWith("Badge ID does not exist");
    await expect(
      greenBadge.connect(user1).mint(user1.address, 1, 2, "0x")
    ).to.be.revertedWith("Badges are unique non-fungible achievements");
  });

  it("Should support batch balance queries", async function () {
    await greenBadge.connect(user1).mint(user1.address, 1, 1, "0x");
    await greenBadge.connect(user1).mint(user1.address, 3, 1, "0x");
    const balances = await greenBadge.balanceOfBatch(
      [user1.address, user1.address, user2.address],
      [1, 3, 1]
    );
    expect(balances.map(Number)).to.deep.equal([1, 1, 0]);
  });

  it("Should transfer badges with owner-or-operator approval", async function () {
    await greenBadge.connect(user1).mint(user1.address, 1, 1, "0x");

    // Unapproved third party cannot move the badge.
    await expect(
      greenBadge.connect(user2).safeTransferFrom(user1.address, user2.address, 1, 1, "0x")
    ).to.be.revertedWith("Caller is not token owner or approved");

    // Owner transfer works.
    await greenBadge.connect(user1).safeTransferFrom(user1.address, user2.address, 1, 1, "0x");
    expect(await greenBadge.balanceOf(user2.address, 1)).to.equal(1);

    // Operator approval flow works for batch transfers.
    await greenBadge.connect(user2).mint(user2.address, 2, 1, "0x");
    await greenBadge.connect(user2).setApprovalForAll(user1.address, true);
    expect(await greenBadge.isApprovedForAll(user2.address, user1.address)).to.be.true;
    await greenBadge
      .connect(user1)
      .safeBatchTransferFrom(user2.address, user1.address, [1, 2], [1, 1], "0x");
    expect(await greenBadge.balanceOf(user1.address, 1)).to.equal(1);
    expect(await greenBadge.balanceOf(user1.address, 2)).to.equal(1);
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
