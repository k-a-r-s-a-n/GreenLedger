// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GreenBadge (ERC-1155 Multi-Token Standard)
 * @dev Verifiable achievement badges earned via hardware energy optimization on GreenLedger.
 * Targeted for Ethereum Sepolia Testnet deployment.
 *
 * Minting model: any user may self-claim each badge exactly once by calling
 * mint() with their own address as the recipient. The contract owner may
 * additionally mint on behalf of any account (e.g. backend-relayed rewards).
 * One badge per (token id, account) is enforced on-chain via hasMintedBadge.
 *
 * This is a minimal but complete ERC-1155 implementation (ERC-165 interface
 * detection, approvals, single/batch transfers with receiver checks) scoped
 * for a Sepolia testnet with zero monetary value.
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

interface IERC1155Receiver {
    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4);

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external returns (bytes4);
}

contract GreenBadge is Ownable {
    string public name = "GreenLedger Achievement Badges";
    string public symbol = "GBADGE";

    // ERC-165 interface identifiers.
    bytes4 private constant _INTERFACE_ID_ERC165 = 0x01ffc9a7;
    bytes4 private constant _INTERFACE_ID_ERC1155 = 0xd9b67a26;

    // ERC-1155 receiver magic values.
    bytes4 private constant _ERC1155_RECEIVED = 0xf23a6e61;
    bytes4 private constant _ERC1155_BATCH_RECEIVED = 0xbc197c81;

    // Mapping from token ID to account balances
    mapping(uint256 => mapping(address => uint256)) private _balances;
    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;
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
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event BadgeMinted(address indexed recipient, uint256 indexed badgeId, string badgeName);
    event URI(string value, uint256 indexed id);

    constructor() Ownable(msg.sender) {
        // Initialize default metadata URIs for Sepolia Testnet.
        // NOTE: placeholder CIDs — replace with published IPFS metadata before
        // production use so wallets can render badge art and attributes.
        _tokenURIs[BADGE_FIRST_OPTIMIZATION] = "ipfs://QmFirstOptBadge/metadata.json";
        _tokenURIs[BADGE_POWER_SAVER] = "ipfs://QmPowerSaverBadge/metadata.json";
        _tokenURIs[BADGE_CARBON_CUTTER] = "ipfs://QmCarbonCutterBadge/metadata.json";
        _tokenURIs[BADGE_EFFICIENCY_MASTER] = "ipfs://QmEfficiencyMasterBadge/metadata.json";
        _tokenURIs[BADGE_GREEN_GUARDIAN] = "ipfs://QmGreenGuardianBadge/metadata.json";
    }

    /**
     * @dev ERC-165 interface detection — lets wallets and explorers recognize
     * this contract as ERC-1155.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == _INTERFACE_ID_ERC165 || interfaceId == _INTERFACE_ID_ERC1155;
    }

    /**
     * @dev Mint a badge. Either the recipient themselves (self-claim from the
     * GreenLedger marketplace) or the contract owner (relayed rewards) may call.
     */
    function mint(address account, uint256 id, uint256 amount, bytes memory data) public {
        require(account != address(0), "Invalid recipient");
        require(id >= 1 && id <= 5, "Badge ID does not exist");
        require(amount == 1, "Badges are unique non-fungible achievements");
        require(
            _msgSender() == account || _msgSender() == owner(),
            "Only the recipient or owner may mint"
        );
        require(!hasMintedBadge[id][account], "Badge already minted to this account");

        hasMintedBadge[id][account] = true;
        _balances[id][account] += 1;

        emit TransferSingle(_msgSender(), address(0), account, id, 1);
        emit BadgeMinted(account, id, getBadgeName(id));

        _doSafeTransferAcceptanceCheck(_msgSender(), address(0), account, id, 1, data);
    }

    function balanceOf(address account, uint256 id) public view returns (uint256) {
        require(account != address(0), "Query for zero address");
        return _balances[id][account];
    }

    function balanceOfBatch(
        address[] memory accounts,
        uint256[] memory ids
    ) public view returns (uint256[] memory) {
        require(accounts.length == ids.length, "Accounts and ids length mismatch");
        uint256[] memory batchBalances = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; ++i) {
            require(accounts[i] != address(0), "Query for zero address");
            batchBalances[i] = _balances[ids[i]][accounts[i]];
        }
        return batchBalances;
    }

    function setApprovalForAll(address operator, bool approved) public {
        require(operator != _msgSender(), "Setting approval status for self");
        _operatorApprovals[_msgSender()][operator] = approved;
        emit ApprovalForAll(_msgSender(), operator, approved);
    }

    function isApprovedForAll(address account, address operator) public view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public {
        require(to != address(0), "Transfer to zero address");
        require(
            from == _msgSender() || isApprovedForAll(from, _msgSender()),
            "Caller is not token owner or approved"
        );
        uint256 fromBalance = _balances[id][from];
        require(fromBalance >= amount, "Insufficient balance for transfer");
        unchecked {
            _balances[id][from] = fromBalance - amount;
        }
        _balances[id][to] += amount;

        emit TransferSingle(_msgSender(), from, to, id, amount);
        _doSafeTransferAcceptanceCheck(_msgSender(), from, to, id, amount, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public {
        require(to != address(0), "Transfer to zero address");
        require(ids.length == amounts.length, "Ids and amounts length mismatch");
        require(
            from == _msgSender() || isApprovedForAll(from, _msgSender()),
            "Caller is not token owner or approved"
        );
        for (uint256 i = 0; i < ids.length; ++i) {
            uint256 id = ids[i];
            uint256 amount = amounts[i];
            uint256 fromBalance = _balances[id][from];
            require(fromBalance >= amount, "Insufficient balance for transfer");
            unchecked {
                _balances[id][from] = fromBalance - amount;
            }
            _balances[id][to] += amount;
        }

        emit TransferBatch(_msgSender(), from, to, ids, amounts);
        _doSafeBatchTransferAcceptanceCheck(_msgSender(), from, to, ids, amounts, data);
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

    function _doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) private {
        if (to.code.length > 0) {
            try IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, data) returns (
                bytes4 response
            ) {
                require(response == _ERC1155_RECEIVED, "ERC1155 receiver rejected tokens");
            } catch {
                revert("Transfer to non-ERC1155Receiver implementer");
            }
        }
    }

    function _doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) private {
        if (to.code.length > 0) {
            try
                IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data)
            returns (bytes4 response) {
                require(response == _ERC1155_BATCH_RECEIVED, "ERC1155 receiver rejected tokens");
            } catch {
                revert("Transfer to non-ERC1155Receiver implementer");
            }
        }
    }
}
