// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GreenBadge (ERC-1155 Multi-Token Standard)
 * @dev Verifiable achievement badges earned via hardware energy optimization on GreenLedger.
 * Targeted for Ethereum Sepolia Testnet deployment.
 */

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
}

abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Ownable: new owner is zero address");
        _owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not owner");
        _;
    }
}

contract GreenBadge is Ownable {
    string public name = "GreenLedger Achievement Badges";
    string public symbol = "GBADGE";
    
    // Mapping from token ID to account balances
    mapping(uint256 => mapping(address => uint256)) private _balances;
    // Mapping from token ID to custom metadata URI
    mapping(uint256 => string) private _tokenURIs;
    // Mapping to track if a user has claimed a specific badge ID
    mapping(uint256 => mapping(address => bool)) public hasMintedBadge;

    // Token IDs
    uint256 public constant BADGE_FIRST_OPTIMIZATION = 1;
    uint256 public constant BADGE_POWER_SAVER = 2;
    uint256 public constant BADGE_CARBON_CUTTER = 3;
    uint256 public constant BADGE_EFFICIENCY_MASTER = 4;
    uint256 public constant BADGE_GREEN_GUARDIAN = 5;

    // Events
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event BadgeMinted(address indexed recipient, uint256 indexed badgeId, string badgeName);
    event URI(string value, uint256 indexed id);

    constructor() Ownable(msg.sender) {
        // Initialize default metadata URIs for Sepolia Testnet
        _tokenURIs[BADGE_FIRST_OPTIMIZATION] = "ipfs://QmFirstOptBadge/metadata.json";
        _tokenURIs[BADGE_POWER_SAVER] = "ipfs://QmPowerSaverBadge/metadata.json";
        _tokenURIs[BADGE_CARBON_CUTTER] = "ipfs://QmCarbonCutterBadge/metadata.json";
        _tokenURIs[BADGE_EFFICIENCY_MASTER] = "ipfs://QmEfficiencyMasterBadge/metadata.json";
        _tokenURIs[BADGE_GREEN_GUARDIAN] = "ipfs://QmGreenGuardianBadge/metadata.json";
    }

    /**
     * @dev Mint badge to recipient. On testnet, users can claim their unlocked badge.
     */
    function mint(address account, uint256 id, uint256 amount, bytes memory data) public onlyOwner {
        require(account != address(0), "Invalid recipient");
        require(id >= 1 && id <= 5, "Badge ID does not exist");
        require(amount == 1, "Badges are unique non-fungible achievements");
        require(!hasMintedBadge[id][account], "Badge already minted to this account");

        hasMintedBadge[id][account] = true;
        _balances[id][account] += 1;

        emit TransferSingle(msg.sender, address(0), account, id, 1);
        emit BadgeMinted(account, id, getBadgeName(id));
    }

    function balanceOf(address account, uint256 id) public view returns (uint256) {
        require(account != address(0), "Query for zero address");
        return _balances[id][account];
    }

    function uri(uint256 id) public view returns (string memory) {
        require(id >= 1 && id <= 5, "URI query for nonexistent token");
        return _tokenURIs[id];
    }

    function setURI(uint256 id, string memory newUri) public onlyOwner {
        require(id >= 1 && id <= 5, "Nonexistent token");
        _tokenURIs[id] = newUri;
        emit URI(newUri, id);
    }

    function getBadgeName(uint256 id) public pure returns (string memory) {
        if (id == BADGE_FIRST_OPTIMIZATION) return "First Optimization";
        if (id == BADGE_POWER_SAVER) return "Power Saver";
        if (id == BADGE_CARBON_CUTTER) return "Carbon Cutter";
        if (id == BADGE_EFFICIENCY_MASTER) return "Efficiency Master";
        if (id == BADGE_GREEN_GUARDIAN) return "Green Guardian";
        return "Unknown Badge";
    }
}
