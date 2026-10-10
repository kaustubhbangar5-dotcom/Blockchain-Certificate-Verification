// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CertificateVerification
 * @dev Smart Contract for registering, verifying, and deleting academic certificates on the blockchain.
 * Developed for Mumbai University Sem 7 Blockchain Project.
 */
contract CertificateVerification {
    
    // Address of the institution / admin authorized to register certificates
    address public admin;

    // Certificate structure to store metadata and cryptographic hash
    struct Certificate {
        string certificateId;
        string studentName;
        string courseName;
        string collegeName;
        string issueDate;
        bytes32 certificateHash; // Keccak-256 hash of certificate details
        uint256 blockTimestamp;
        address issuer;
        bool exists;
    }

    // Mapping from Certificate ID to Certificate Record
    mapping(string => Certificate) private certificates;

    // Array to keep track of all registered Certificate IDs for enumeration/auditing
    string[] private certificateIds;

    // Events for transparent blockchain logging
    event CertificateRegistered(
        string indexed certificateId,
        string studentName,
        string courseName,
        string collegeName,
        string issueDate,
        bytes32 certificateHash,
        uint256 timestamp,
        address indexed issuer
    );

    event CertificateDeleted(
        string indexed certificateId,
        address indexed issuer,
        uint256 timestamp
    );

    // Modifier to restrict access to admin if desired (optional for demo)
    modifier onlyAdmin() {
        require(msg.sender == admin, "Error: Caller is not the authorized admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /**
     * @dev Generates the Keccak-256 hash from certificate attributes.
     * Can be called off-chain or on-chain to generate unique fingerprint.
     */
    function generateCertificateHash(
        string memory _id,
        string memory _studentName,
        string memory _courseName,
        string memory _collegeName,
        string memory _issueDate
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                _id,
                _studentName,
                _courseName,
                _collegeName,
                _issueDate
            )
        );
    }

    /**
     * @dev Registers a new certificate on the blockchain.
     * Prevents duplicate Certificate IDs.
     */
    function registerCertificate(
        string memory _id,
        string memory _studentName,
        string memory _courseName,
        string memory _collegeName,
        string memory _issueDate,
        bytes32 _certificateHash
    ) public {
        require(bytes(_id).length > 0, "Error: Certificate ID cannot be empty");
        require(bytes(_studentName).length > 0, "Error: Student Name cannot be empty");
        require(!certificates[_id].exists, "Error: Certificate ID already exists on the blockchain!");

        // If hash was not supplied by caller, compute it on-chain
        bytes32 finalHash = _certificateHash;
        if (finalHash == bytes32(0)) {
            finalHash = generateCertificateHash(_id, _studentName, _courseName, _collegeName, _issueDate);
        }

        // Store the certificate record
        certificates[_id] = Certificate({
            certificateId: _id,
            studentName: _studentName,
            courseName: _courseName,
            collegeName: _collegeName,
            issueDate: _issueDate,
            certificateHash: finalHash,
            blockTimestamp: block.timestamp,
            issuer: msg.sender,
            exists: true
        });

        certificateIds.push(_id);

        emit CertificateRegistered(
            _id,
            _studentName,
            _courseName,
            _collegeName,
            _issueDate,
            finalHash,
            block.timestamp,
            msg.sender
        );
    }

    /**
     * @dev Deletes/revokes a registered certificate from the blockchain.
     */
    function deleteCertificate(string memory _id) public {
        require(bytes(_id).length > 0, "Error: Certificate ID cannot be empty");
        require(certificates[_id].exists, "Error: Certificate ID does not exist on the blockchain!");

        // Remove from mapping
        delete certificates[_id];

        // Remove from certificateIds array
        for (uint256 i = 0; i < certificateIds.length; i++) {
            if (keccak256(bytes(certificateIds[i])) == keccak256(bytes(_id))) {
                certificateIds[i] = certificateIds[certificateIds.length - 1];
                certificateIds.pop();
                break;
            }
        }

        emit CertificateDeleted(_id, msg.sender, block.timestamp);
    }

    /**
     * @dev Retrieves the complete certificate record by Certificate ID.
     */
    function verifyCertificate(string memory _id)
        public
        view
        returns (
            string memory studentName,
            string memory courseName,
            string memory collegeName,
            string memory issueDate,
            bytes32 certificateHash,
            uint256 blockTimestamp,
            address issuer,
            bool exists
        )
    {
        Certificate memory cert = certificates[_id];
        if (!cert.exists) {
            return ("", "", "", "", bytes32(0), 0, address(0), false);
        }
        return (
            cert.studentName,
            cert.courseName,
            cert.collegeName,
            cert.issueDate,
            cert.certificateHash,
            cert.blockTimestamp,
            cert.issuer,
            cert.exists
        );
    }

    /**
     * @dev Checks if certificate details match the registered blockchain hash (Tamper Detection).
     * @return exists Whether the certificate ID exists on-chain
     * @return isValid True if computed hash matches on-chain hash, False if tampered
     * @return registeredHash The original hash stored on the blockchain
     * @return computedHash The hash calculated from the test details
     */
    function checkTampering(
        string memory _id,
        string memory _studentName,
        string memory _courseName,
        string memory _collegeName,
        string memory _issueDate
    )
        public
        view
        returns (
            bool exists,
            bool isValid,
            bytes32 registeredHash,
            bytes32 computedHash
        )
    {
        Certificate memory cert = certificates[_id];
        if (!cert.exists) {
            return (false, false, bytes32(0), bytes32(0));
        }

        bytes32 calculated = generateCertificateHash(_id, _studentName, _courseName, _collegeName, _issueDate);
        bool valid = (cert.certificateHash == calculated);

        return (true, valid, cert.certificateHash, calculated);
    }

    /**
     * @dev Returns the total number of registered certificates.
     */
    function getTotalCertificates() public view returns (uint256) {
        return certificateIds.length;
    }

    /**
     * @dev Returns an array of all registered Certificate IDs.
     */
    function getAllCertificateIds() public view returns (string[] memory) {
        return certificateIds;
    }
}
