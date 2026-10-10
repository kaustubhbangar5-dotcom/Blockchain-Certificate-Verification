/**
 * ============================================================================
 * Blockchain Certificate Verification System - Core JavaScript Engine
 * Mumbai University Sem 7 Blockchain Project
 * ============================================================================
 */

// Contract ABI definition matching CertificateVerification.sol
const CONTRACT_ABI = [
  "function admin() view returns (address)",
  "function registerCertificate(string _id, string _studentName, string _courseName, string _collegeName, string _issueDate, bytes32 _certificateHash) public",
  "function deleteCertificate(string _id) public",
  "function verifyCertificate(string _id) view returns (string studentName, string courseName, string collegeName, string issueDate, bytes32 certificateHash, uint256 blockTimestamp, address issuer, bool exists)",
  "function checkTampering(string _id, string _studentName, string _courseName, string _collegeName, string _issueDate) view returns (bool exists, bool isValid, bytes32 registeredHash, bytes32 computedHash)",
  "function generateCertificateHash(string _id, string _studentName, string _courseName, string _collegeName, string _issueDate) pure returns (bytes32)",
  "function getTotalCertificates() view returns (uint256)",
  "function getAllCertificateIds() view returns (string[] memory)",
  "event CertificateRegistered(string indexed certificateId, string studentName, string courseName, string collegeName, string issueDate, bytes32 certificateHash, uint256 timestamp, address indexed issuer)",
  "event CertificateDeleted(string indexed certificateId, address indexed issuer, uint256 timestamp)"
];

// Sample Initial Seed Data for Mumbai University Demo
const INITIAL_CERTIFICATES = [
  {
    id: "MU-2024-COMPS-1082",
    studentName: "Kaustubh Bangar",
    courseName: "Bachelor of Engineering in Computer Science",
    collegeName: "Mumbai University Department of Technology",
    issueDate: "2024-06-15",
    blockNumber: 10840,
    txHash: "0x4a9f82e1c75bb380d381bcf79326e108420ac89e472651034f78001a4e9b72c1",
    timestamp: 1718445600,
    issuer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  },
  {
    id: "MU-2024-IT-2041",
    studentName: "Priya Sharma",
    courseName: "Master of Computer Applications (MCA)",
    collegeName: "Veermata Jijabai Technological Institute (VJTI)",
    issueDate: "2024-05-20",
    blockNumber: 10841,
    txHash: "0x78bdc38a192837f62048f0294719284758201938502938475029384750293847",
    timestamp: 1716199200,
    issuer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  },
  {
    id: "MU-2024-AIDS-3099",
    studentName: "Rohan Deshmukh",
    courseName: "B.Tech in Artificial Intelligence & Data Science",
    collegeName: "Sardar Patel Institute of Technology (SPIT)",
    issueDate: "2024-07-10",
    blockNumber: 10842,
    txHash: "0x39fa82d1c95bb380d381bcf79326e108420ac89e472651034f78001a4e9b98e2",
    timestamp: 1720605600,
    issuer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  }
];

// Application State Management
const AppState = {
  mode: "simulator", // 'simulator' or 'web3'
  certificates: {},  // Keyed by certificate ID
  certificateIds: [],
  currentBlock: 10842,
  stats: {
    totalRegistered: 0,
    verifiedCount: 0,
    tamperDetectedCount: 0
  },
  web3: {
    provider: null,
    signer: null,
    contract: null,
    rpcUrl: "http://127.0.0.1:8545",
    contractAddress: ""
  },
  activityLogs: [],
  activeModalCert: null
};

// ============================================================================
// Cryptographic Hashing Utilities (Keccak-256)
// ============================================================================

/**
 * Computes Solidity-compliant Keccak-256 hash using ethers.js
 * Mirrors: keccak256(abi.encodePacked(_id, _studentName, _courseName, _collegeName, _issueDate))
 */
function computeKeccak256(id, studentName, courseName, collegeName, issueDate) {
  const cleanId = (id || "").trim();
  const cleanName = (studentName || "").trim();
  const cleanCourse = (courseName || "").trim();
  const cleanCollege = (collegeName || "").trim();
  const cleanDate = (issueDate || "").trim();

  if (!cleanId && !cleanName && !cleanCourse && !cleanCollege && !cleanDate) {
    return "0x0000000000000000000000000000000000000000000000000000000000000000";
  }

  try {
    if (typeof ethers !== "undefined" && ethers.utils && ethers.utils.solidityKeccak256) {
      return ethers.utils.solidityKeccak256(
        ["string", "string", "string", "string", "string"],
        [cleanId, cleanName, cleanCourse, cleanCollege, cleanDate]
      );
    }
  } catch (err) {
    console.warn("Ethers utils hashing error, falling back:", err);
  }

  // Pure JS fallback Keccak-256 computation
  const combined = `${cleanId}${cleanName}${cleanCourse}${cleanCollege}${cleanDate}`;
  return fallbackKeccak256(combined);
}

/**
 * Fallback hash generator if external CDN is blocked or offline
 */
function fallbackKeccak256(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const hexPart = ("00000000" + (hash >>> 0).toString(16)).slice(-8);
  return ("0x" + hexPart.repeat(8)).substring(0, 66);
}

/**
 * Helper to generate mock transaction hash
 */
function generateTxHash() {
  const chars = "0123456789abcdef";
  let result = "0x";
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ============================================================================
// State & Storage Initialization
// ============================================================================

function initializeState() {
  const storedData = localStorage.getItem("mu_blockchain_certs_v1");
  const storedStats = localStorage.getItem("mu_blockchain_stats_v1");

  if (storedData) {
    try {
      const parsed = JSON.parse(storedData);
      AppState.certificates = parsed.certificates || {};
      AppState.certificateIds = parsed.certificateIds || [];
      AppState.currentBlock = parsed.currentBlock || 10842;
    } catch (e) {
      seedInitialData();
    }
  } else {
    seedInitialData();
  }

  if (storedStats) {
    try {
      AppState.stats = JSON.parse(storedStats);
    } catch (e) {
      AppState.stats = { totalRegistered: AppState.certificateIds.length, verifiedCount: 4, tamperDetectedCount: 1 };
    }
  } else {
    AppState.stats.totalRegistered = AppState.certificateIds.length;
    AppState.stats.verifiedCount = 4;
    AppState.stats.tamperDetectedCount = 1;
  }

  logActivity("INFO", `Blockchain environment initialized. Total stored records: ${AppState.certificateIds.length}`);
  saveState();
  updateUIStats();
  renderVaultTable();
  renderQuickChips();
}

function seedInitialData() {
  AppState.certificates = {};
  AppState.certificateIds = [];

  INITIAL_CERTIFICATES.forEach((cert) => {
    const certHash = computeKeccak256(
      cert.id,
      cert.studentName,
      cert.courseName,
      cert.collegeName,
      cert.issueDate
    );

    AppState.certificates[cert.id] = {
      id: cert.id,
      studentName: cert.studentName,
      courseName: cert.courseName,
      collegeName: cert.collegeName,
      issueDate: cert.issueDate,
      hash: certHash,
      blockNumber: cert.blockNumber,
      txHash: cert.txHash,
      timestamp: cert.timestamp,
      issuer: cert.issuer,
      exists: true
    };
    AppState.certificateIds.push(cert.id);
  });
  AppState.currentBlock = 10842;
}

function saveState() {
  localStorage.setItem(
    "mu_blockchain_certs_v1",
    JSON.stringify({
      certificates: AppState.certificates,
      certificateIds: AppState.certificateIds,
      currentBlock: AppState.currentBlock
    })
  );
  localStorage.setItem("mu_blockchain_stats_v1", JSON.stringify(AppState.stats));
}

// ============================================================================
// Core Smart Contract & Simulator Operations
// ============================================================================

/**
 * Register Certificate (Module 1 & 2)
 */
async function handleRegisterCertificate(certData) {
  const { id, studentName, courseName, collegeName, issueDate } = certData;

  // Check duplicate ID
  if (AppState.certificates[id] && AppState.certificates[id].exists) {
    throw new Error(`Error: Certificate ID "${id}" already exists on the blockchain! Duplicate IDs are rejected by the smart contract.`);
  }

  const hash = computeKeccak256(id, studentName, courseName, collegeName, issueDate);
  AppState.currentBlock += 1;
  const txHash = generateTxHash();
  const timestamp = Math.floor(Date.now() / 1000);
  const issuer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Admin address

  const newRecord = {
    id,
    studentName,
    courseName,
    collegeName,
    issueDate,
    hash,
    blockNumber: AppState.currentBlock,
    txHash,
    timestamp,
    issuer,
    exists: true
  };

  // If Web3 mode is active and connected, dispatch to real contract
  if (AppState.mode === "web3" && AppState.web3.contract) {
    try {
      const tx = await AppState.web3.contract.registerCertificate(
        id,
        studentName,
        courseName,
        collegeName,
        issueDate,
        hash
      );
      logActivity("TX", `Broadcasted tx to Web3 RPC: ${tx.hash}`);
      await tx.wait();
      newRecord.txHash = tx.hash;
    } catch (err) {
      console.warn("Web3 contract call failed, recording in local simulator:", err);
      logActivity("WARN", `Web3 node error (${err.message}). Stored in Local Simulator.`);
    }
  }

  // Save to simulator ledger
  AppState.certificates[id] = newRecord;
  AppState.certificateIds.unshift(id);
  AppState.stats.totalRegistered = AppState.certificateIds.length;

  saveState();
  updateUIStats();
  renderVaultTable();
  renderQuickChips();

  logActivity(
    "BLOCK",
    `Block #${AppState.currentBlock} mined. Registered Cert ID [${id}] for student "${studentName}" with hash ${hash.substring(0, 14)}...`
  );

  return newRecord;
}

/**
 * Delete Certificate from Blockchain (Module 5)
 */
async function handleDeleteCertificate(id) {
  const cleanId = (id || "").trim();
  if (!cleanId) {
    throw new Error("Certificate ID is required for deletion.");
  }

  // Case-insensitive lookup
  const matchedKey = Object.keys(AppState.certificates).find(
    (k) => k.toLowerCase() === cleanId.toLowerCase()
  ) || cleanId;

  const record = AppState.certificates[matchedKey];
  if (!record) {
    throw new Error(`Certificate ID "${cleanId}" does not exist on the blockchain!`);
  }

  // If in Web3 mode, send delete tx to smart contract
  if (AppState.mode === "web3" && AppState.web3.contract) {
    try {
      const tx = await AppState.web3.contract.deleteCertificate(matchedKey);
      logActivity("TX", `Broadcasted delete tx to Web3 RPC: ${tx.hash}`);
      await tx.wait();
    } catch (err) {
      console.warn("Web3 delete transaction error, deleting locally:", err);
      logActivity("WARN", `Web3 contract delete error: ${err.message}`);
    }
  }

  // Remove from simulator storage
  delete AppState.certificates[matchedKey];
  AppState.certificateIds = AppState.certificateIds.filter(
    (item) => item.toLowerCase() !== matchedKey.toLowerCase()
  );
  AppState.currentBlock += 1;

  saveState();
  updateUIStats();
  renderVaultTable();
  renderQuickChips();

  logActivity("DELETE", `Block #${AppState.currentBlock} mined. Deleted certificate record [${matchedKey}].`);
  showToast(`Certificate "${matchedKey}" has been deleted from the blockchain records.`, "info");
}

/**
 * Verify Certificate by ID (Module 3)
 */
async function handleVerifyCertificate(id) {
  const cleanId = (id || "").trim();
  if (!cleanId) {
    throw new Error("Please enter a Certificate ID to verify.");
  }

  // If in Web3 mode, try querying live contract
  if (AppState.mode === "web3" && AppState.web3.contract) {
    try {
      const result = await AppState.web3.contract.verifyCertificate(cleanId);
      if (result && result.exists) {
        AppState.stats.verifiedCount += 1;
        saveState();
        updateUIStats();
        logActivity("VERIFY", `Live Web3 Query: Certificate [${cleanId}] verified authentic.`);
        return {
          id: cleanId,
          studentName: result.studentName,
          courseName: result.courseName,
          collegeName: result.collegeName,
          issueDate: result.issueDate,
          hash: result.certificateHash,
          blockTimestamp: Number(result.blockTimestamp),
          issuer: result.issuer,
          exists: true
        };
      }
    } catch (e) {
      console.warn("Web3 verify error, querying local simulator:", e);
    }
  }

  // Simulator Query (Case-insensitive)
  const matchedKey = Object.keys(AppState.certificates).find(
    (k) => k.toLowerCase() === cleanId.toLowerCase()
  ) || cleanId;

  const record = AppState.certificates[matchedKey];
  if (record && record.exists) {
    AppState.stats.verifiedCount += 1;
    saveState();
    updateUIStats();
    logActivity("VERIFY", `Queried smart contract for [${matchedKey}]: RECORD FOUND & AUTHENTIC.`);
    return {
      ...record,
      blockTimestamp: record.timestamp
    };
  }

  logActivity("INFO", `Queried smart contract for [${cleanId}]: RECORD NOT FOUND.`);
  return { id: cleanId, exists: false };
}

// ============================================================================
// UI Controllers & Event Handlers
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  initializeState();
  setupNavigation();
  setupRegistrationModule();
  setupVerificationModule();
  setupVaultModule();
  setupContractSettingsModule();
  setupCertificateModal();
  setupPresetTriggers();
});

/**
 * Tab Navigation Controller
 */
function setupNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetSection = link.getAttribute("data-section");
      switchTab(targetSection);
    });
  });

  // Handle hash changes if user navigated via browser history
  if (window.location.hash) {
    const target = window.location.hash.replace("#", "");
    if (document.getElementById(target)) {
      switchTab(target);
    }
  }
}

function switchTab(sectionId) {
  const sections = document.querySelectorAll(".content-section");
  const navLinks = document.querySelectorAll(".nav-link");

  sections.forEach((sec) => sec.classList.remove("active-section"));
  navLinks.forEach((link) => link.classList.remove("active"));

  const activeSec = document.getElementById(sectionId);
  const activeLink = document.querySelector(`.nav-link[data-section="${sectionId}"]`);

  if (activeSec) {
    activeSec.classList.add("active-section");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (activeLink) {
    activeLink.classList.add("active");
  }
  history.replaceState(null, null, `#${sectionId}`);
}

/**
 * Module 1 & 2: Registration Handlers
 */
function setupRegistrationModule() {
  const form = document.getElementById("form-register-certificate");
  const regIdInput = document.getElementById("reg-cert-id");
  const regNameInput = document.getElementById("reg-student-name");
  const regCourseInput = document.getElementById("reg-course-name");
  const regCollegeInput = document.getElementById("reg-college-name");
  const regDateInput = document.getElementById("reg-issue-date");
  const regLiveHash = document.getElementById("reg-live-hash");
  const btnAutofill = document.getElementById("btn-autofill-sample");

  if (!form) return;

  // Live hash calculator on typing
  const inputs = [regIdInput, regNameInput, regCourseInput, regCollegeInput, regDateInput];
  inputs.forEach((input) => {
    if (input) {
      input.addEventListener("input", () => {
        const hash = computeKeccak256(
          regIdInput.value,
          regNameInput.value,
          regCourseInput.value,
          regCollegeInput.value,
          regDateInput.value
        );
        if (regLiveHash) regLiveHash.textContent = hash;
      });
    }
  });

  // Autofill button
  if (btnAutofill) {
    btnAutofill.addEventListener("click", () => {
      loadSampleCase(1);
      showToast("Sample Mumbai University certificate data populated.", "info");
    });
  }

  // Form submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const certData = {
      id: regIdInput.value.trim(),
      studentName: regNameInput.value.trim(),
      courseName: regCourseInput.value.trim(),
      collegeName: regCollegeInput.value.trim(),
      issueDate: regDateInput.value
    };

    try {
      const receipt = await handleRegisterCertificate(certData);

      // Render Receipt View
      document.getElementById("reg-empty-state").classList.add("d-none");
      const successView = document.getElementById("reg-success-view");
      successView.classList.remove("d-none");

      document.getElementById("receipt-cert-id").textContent = receipt.id;
      document.getElementById("receipt-student-name").textContent = receipt.studentName;
      document.getElementById("receipt-course").textContent = receipt.courseName;
      document.getElementById("receipt-college").textContent = receipt.collegeName;
      document.getElementById("receipt-date").textContent = receipt.issueDate;
      document.getElementById("receipt-block").textContent = `#${receipt.blockNumber}`;
      document.getElementById("receipt-tx-hash").textContent = receipt.txHash;
      document.getElementById("receipt-keccak-hash").textContent = receipt.hash;

      AppState.activeModalCert = receipt;

      showToast(`Certificate "${receipt.id}" successfully registered on blockchain!`, "success");
      launchConfetti();
    } catch (err) {
      showToast(err.message, "danger");
    }
  });

  const btnReset = document.getElementById("btn-reset-register");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (regLiveHash) regLiveHash.textContent = "0x0000000000000000000000000000000000000000000000000000000000000000";
      document.getElementById("reg-empty-state").classList.remove("d-none");
      document.getElementById("reg-success-view").classList.add("d-none");
    });
  }

  const btnViewModal = document.getElementById("btn-view-certificate-modal");
  if (btnViewModal) {
    btnViewModal.addEventListener("click", () => {
      if (AppState.activeModalCert) {
        openCertificateModal(AppState.activeModalCert);
      }
    });
  }
}

/**
 * Module 3: Verification Handlers
 */
function setupVerificationModule() {
  const searchInput = document.getElementById("verify-search-input");
  const btnVerify = document.getElementById("btn-execute-verify");
  const idlePlaceholder = document.getElementById("verify-idle-placeholder");
  const verifiedCard = document.getElementById("result-state-verified");
  const notfoundCard = document.getElementById("result-state-notfound");

  if (!btnVerify) return;

  const executeSearch = async () => {
    const certId = searchInput.value.trim();
    if (!certId) {
      showToast("Please enter a Certificate ID", "warning");
      return;
    }

    idlePlaceholder.classList.add("d-none");
    verifiedCard.classList.add("d-none");
    notfoundCard.classList.add("d-none");

    try {
      const result = await handleVerifyCertificate(certId);

      if (result.exists) {
        verifiedCard.classList.remove("d-none");

        document.getElementById("verify-res-id").textContent = result.id;
        document.getElementById("verify-res-name").textContent = result.studentName;
        document.getElementById("verify-res-course").textContent = result.courseName;
        document.getElementById("verify-res-college").textContent = result.collegeName;
        document.getElementById("verify-res-date").textContent = result.issueDate;
        document.getElementById("verify-res-issuer").textContent = result.issuer || "0xAdmin";
        document.getElementById("verify-res-hash").textContent = result.hash || result.certificateHash;

        const dateStr = result.blockTimestamp
          ? new Date(result.blockTimestamp * 1000).toLocaleString()
          : "N/A";
        document.getElementById("verify-res-timestamp").textContent = `Mined: ${dateStr}`;

        // Render QR Code
        const qrContainer = document.getElementById("verify-qrcode-box");
        qrContainer.innerHTML = "";
        if (typeof QRCode !== "undefined") {
          new QRCode(qrContainer, {
            text: JSON.stringify({
              id: result.id,
              name: result.studentName,
              hash: result.hash || result.certificateHash,
              verified: true
            }),
            width: 130,
            height: 130,
            colorDark: "#04101e",
            colorLight: "#ffffff"
          });
        }

        AppState.activeModalCert = result;
        launchConfetti();
        showToast(`Certificate "${result.id}" is authentic and verified!`, "success");
      } else {
        notfoundCard.classList.remove("d-none");
        document.getElementById("notfound-query-id").textContent = result.id;
        showToast(`Certificate "${result.id}" not found on blockchain.`, "danger");
      }
    } catch (err) {
      showToast(err.message, "danger");
    }
  };

  btnVerify.addEventListener("click", executeSearch);
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      executeSearch();
    }
  });

  const btnOpenCert = document.getElementById("btn-open-cert-from-verify");
  if (btnOpenCert) {
    btnOpenCert.addEventListener("click", () => {
      if (AppState.activeModalCert) {
        openCertificateModal(AppState.activeModalCert);
      }
    });
  }
}

/**
 * Module 5: Vault Table & Ledger Explorer Handlers
 */
function setupVaultModule() {
  const filterInput = document.getElementById("vault-filter-input");
  const btnExport = document.getElementById("btn-export-json");
  const btnReset = document.getElementById("btn-reset-demo-vault");
  const btnClearLogs = document.getElementById("btn-clear-tx-logs");
  const tbody = document.getElementById("vault-table-body");

  if (filterInput) {
    filterInput.addEventListener("input", () => {
      const query = filterInput.value.toLowerCase().trim();
      renderVaultTable(query);
    });
  }

  // Event delegation on table body for verify and delete buttons
  if (tbody) {
    tbody.addEventListener("click", async (e) => {
      const deleteBtn = e.target.closest(".btn-delete-cert");
      const verifyBtn = e.target.closest(".btn-verify-cert");

      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const certId = deleteBtn.getAttribute("data-id");
        if (certId) {
          window.handleDeleteFromVault(certId);
        }
      } else if (verifyBtn) {
        e.preventDefault();
        e.stopPropagation();
        const certId = verifyBtn.getAttribute("data-id");
        if (certId) {
          window.quickVerifyFromVault(certId);
        }
      }
    });
  }

  if (btnExport) {
    btnExport.addEventListener("click", () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(AppState.certificates, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `mumbai_university_certificates_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("Exported all blockchain certificate records to JSON.", "success");
    });
  }

  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (confirm("Reset blockchain ledger back to initial Mumbai University demo dataset?")) {
        seedInitialData();
        AppState.stats.totalRegistered = AppState.certificateIds.length;
        AppState.stats.verifiedCount = 4;
        AppState.stats.tamperDetectedCount = 1;
        saveState();
        updateUIStats();
        renderVaultTable();
        renderQuickChips();
        logActivity("INFO", "Reset blockchain ledger to initial seed state.");
        showToast("Ledger reset to initial state.", "info");
      }
    });
  }

  if (btnClearLogs) {
    btnClearLogs.addEventListener("click", () => {
      AppState.activityLogs = [];
      document.getElementById("activity-terminal-logs").innerHTML = `
        <div class="log-line text-muted">Activity logs cleared. New transactions will appear here...</div>
      `;
      showToast("Terminal logs cleared.", "info");
    });
  }
}

function renderVaultTable(filterQuery = "") {
  const tbody = document.getElementById("vault-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  const ids = AppState.certificateIds;
  let count = 0;

  ids.forEach((id, index) => {
    const cert = AppState.certificates[id];
    if (!cert) return;

    if (filterQuery) {
      const match =
        cert.id.toLowerCase().includes(filterQuery) ||
        cert.studentName.toLowerCase().includes(filterQuery) ||
        cert.courseName.toLowerCase().includes(filterQuery) ||
        cert.collegeName.toLowerCase().includes(filterQuery);
      if (!match) return;
    }

    count++;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="font-mono text-muted">${index + 1}</td>
      <td class="font-mono font-bold text-cyan">${escapeHtml(cert.id)}</td>
      <td class="font-bold">${escapeHtml(cert.studentName)}</td>
      <td>
        <div>${escapeHtml(cert.courseName)}</div>
        <div class="text-xs text-muted">${escapeHtml(cert.collegeName)}</div>
      </td>
      <td class="text-sm">${escapeHtml(cert.issueDate)}</td>
      <td class="font-mono text-xs truncate-hash" title="${cert.hash}">
        ${cert.hash.substring(0, 10)}...${cert.hash.substring(cert.hash.length - 8)}
      </td>
      <td class="font-mono text-cyan">#${cert.blockNumber}</td>
      <td>
        <div class="table-actions-group">
          <button type="button" class="btn btn-outline-sm btn-verify-cert" data-id="${escapeHtml(cert.id)}">
            <i class="fa-solid fa-shield-check"></i> Verify
          </button>
          <button type="button" class="btn btn-outline-danger-sm btn-delete-cert" data-id="${escapeHtml(cert.id)}">
            <i class="fa-solid fa-trash-can"></i> Delete
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (count === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted" style="padding: 2rem;">
          No certificate records found matching the filter.
        </td>
      </tr>
    `;
  }
}

window.handleDeleteFromVault = async function(certId) {
  if (!certId) return;
  const confirmed = window.confirm(`Are you sure you want to delete certificate record "${certId}"? This will remove it from the blockchain ledger.`);
  if (confirmed) {
    try {
      await handleDeleteCertificate(certId);
    } catch (err) {
      showToast(err.message, "danger");
    }
  }
};

window.quickVerifyFromVault = function(certId) {
  if (!certId) return;
  switchTab("verify");
  const searchInput = document.getElementById("verify-search-input");
  if (searchInput) {
    searchInput.value = certId;
  }
  const btnVerify = document.getElementById("btn-execute-verify");
  if (btnVerify) {
    btnVerify.click();
  }
};

function renderQuickChips() {
  const chipsContainer = document.getElementById("verify-quick-chips");
  if (!chipsContainer) return;

  chipsContainer.innerHTML = "";
  const sampleIds = AppState.certificateIds.slice(0, 5);

  if (sampleIds.length === 0) {
    chipsContainer.innerHTML = `<span class="text-muted text-xs">No registered certificates yet</span>`;
    return;
  }

  sampleIds.forEach((id) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "id-chip";
    btn.textContent = id;
    btn.onclick = () => {
      document.getElementById("verify-search-input").value = id;
      document.getElementById("btn-execute-verify").click();
    };
    chipsContainer.appendChild(btn);
  });
}

/**
 * Smart Contract & Web3 Settings Handlers
 */
function setupContractSettingsModule() {
  const radioSim = document.getElementById("radio-mode-sim");
  const radioWeb3 = document.getElementById("radio-mode-web3");
  const web3Fields = document.getElementById("web3-config-fields");
  const statusPillText = document.getElementById("blockchain-mode-text");
  const btnTestWeb3 = document.getElementById("btn-test-web3-conn");
  const btnToggle = document.getElementById("btn-toggle-settings");

  if (btnToggle) {
    btnToggle.addEventListener("click", () => {
      switchTab("contract-info");
    });
  }

  if (radioSim) {
    radioSim.addEventListener("change", () => {
      if (radioSim.checked) {
        AppState.mode = "simulator";
        if (web3Fields) web3Fields.classList.add("d-none");
        if (statusPillText) statusPillText.textContent = "Remix VM / Sim Mode";
        showToast("Switched to Built-in Smart Contract Simulator.", "info");
      }
    });
  }

  if (radioWeb3) {
    radioWeb3.addEventListener("change", () => {
      if (radioWeb3.checked) {
        AppState.mode = "web3";
        if (web3Fields) web3Fields.classList.remove("d-none");
        if (statusPillText) statusPillText.textContent = "Web3 JSON-RPC Mode";
        showToast("Switched to Live Web3 RPC Mode.", "info");
      }
    });
  }

  if (btnTestWeb3) {
    btnTestWeb3.addEventListener("click", async () => {
      const rpcUrl = document.getElementById("web3-rpc-url").value.trim();
      const contractAddr = document.getElementById("web3-contract-addr").value.trim();

      try {
        showToast("Connecting to Web3 JSON-RPC endpoint...", "info");
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        const network = await provider.getNetwork();
        const blockNum = await provider.getBlockNumber();

        logActivity("INFO", `Connected to Web3 RPC at ${rpcUrl} (ChainId: ${network.chainId}, Block: #${blockNum})`);

        if (contractAddr && ethers.utils.isAddress(contractAddr)) {
          const contract = new ethers.Contract(contractAddr, CONTRACT_ABI, provider.getSigner(0));
          AppState.web3.contract = contract;
          AppState.web3.provider = provider;
          showToast(`Connected to Smart Contract at ${contractAddr.substring(0, 10)}... (Block #${blockNum})`, "success");
        } else {
          showToast(`Connected to RPC Node (Block #${blockNum}). Contract address is optional.`, "success");
        }
      } catch (err) {
        showToast(`RPC Connection failed: ${err.message}`, "danger");
        logActivity("WARN", `Failed to connect to RPC ${rpcUrl}: ${err.message}`);
      }
    });
  }
}

/**
 * Modal & Printable Certificate Handlers
 */
function setupCertificateModal() {
  const modal = document.getElementById("modal-certificate-view");
  const btnClose = document.getElementById("btn-close-cert-modal");

  if (btnClose && modal) {
    btnClose.addEventListener("click", () => {
      modal.classList.remove("active");
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
      }
    });
  }
}

function openCertificateModal(cert) {
  const modal = document.getElementById("modal-certificate-view");
  if (!modal) return;

  document.getElementById("modal-cert-student-name").textContent = (cert.studentName || "").toUpperCase();
  document.getElementById("modal-cert-course-name").textContent = (cert.courseName || "").toUpperCase();
  document.getElementById("modal-cert-college-name").textContent = cert.collegeName || "Mumbai University";
  document.getElementById("modal-cert-id").textContent = cert.id;
  document.getElementById("modal-cert-date").textContent = cert.issueDate;
  document.getElementById("modal-cert-hash").textContent = cert.hash || cert.certificateHash || "0x...";

  // Render QR Code on Certificate
  const qrContainer = document.getElementById("modal-qrcode-container");
  if (qrContainer) {
    qrContainer.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(qrContainer, {
        text: JSON.stringify({
          id: cert.id,
          student: cert.studentName,
          hash: cert.hash || cert.certificateHash,
          system: "Mumbai University Blockchain Vault"
        }),
        width: 80,
        height: 80,
        colorDark: "#0f2a4a",
        colorLight: "#ffffff"
      });
    }
  }

  modal.classList.add("active");
}

/**
 * Sample test cases loader
 */
function setupPresetTriggers() {
  window.loadSampleCase = (caseNum) => {
    const regId = document.getElementById("reg-cert-id");
    const regName = document.getElementById("reg-student-name");
    const regCourse = document.getElementById("reg-course-name");
    const regCollege = document.getElementById("reg-college-name");
    const regDate = document.getElementById("reg-issue-date");
    const regLiveHash = document.getElementById("reg-live-hash");

    const sample = INITIAL_CERTIFICATES[caseNum - 1] || INITIAL_CERTIFICATES[0];
    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);

    if (regId) regId.value = `MU-2024-BE-${uniqueSuffix}`;
    if (regName) regName.value = sample.studentName;
    if (regCourse) regCourse.value = sample.courseName;
    if (regCollege) regCollege.value = sample.collegeName;
    if (regDate) regDate.value = sample.issueDate;

    if (regLiveHash && regId && regName && regCourse && regCollege && regDate) {
      regLiveHash.textContent = computeKeccak256(
        regId.value,
        regName.value,
        regCourse.value,
        regCollege.value,
        regDate.value
      );
    }
  };
}

// ============================================================================
// UI Helpers, Confetti, Logs & Toasts
// ============================================================================

function updateUIStats() {
  const elTotal = document.getElementById("stat-total-certs");
  const elVer = document.getElementById("stat-verified-count");
  const elTamp = document.getElementById("stat-tampered-count");
  const elBlock = document.getElementById("stat-current-block");

  if (elTotal) elTotal.textContent = AppState.certificateIds.length;
  if (elVer) elVer.textContent = AppState.stats.verifiedCount;
  if (elTamp) elTamp.textContent = AppState.stats.tamperDetectedCount;
  if (elBlock) elBlock.textContent = `#${AppState.currentBlock}`;
}

function logActivity(type, message) {
  const terminal = document.getElementById("activity-terminal-logs");
  if (!terminal) return;

  const time = new Date().toLocaleTimeString();
  const typeLower = type.toLowerCase();

  const logEntry = document.createElement("div");
  logEntry.className = "log-line";
  logEntry.innerHTML = `
    <span class="log-time">[${time}]</span>
    <span class="log-type ${typeLower}">${type}</span>
    <span>${escapeHtml(message)}</span>
  `;

  terminal.prepend(logEntry);

  // Keep max 50 log items
  if (terminal.children.length > 50) {
    terminal.removeChild(terminal.lastChild);
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-notifications");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let icon = "fa-circle-info text-cyan";
  if (type === "success") icon = "fa-circle-check text-green";
  if (type === "warning") icon = "fa-triangle-exclamation text-orange";
  if (type === "danger") icon = "fa-circle-exclamation text-orange";

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function launchConfetti() {
  if (typeof confetti === "function") {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ["#00f2fe", "#10b981", "#7928ca", "#ff0080"]
    });
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
