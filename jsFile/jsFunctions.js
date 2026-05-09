/* =========================================================
   SMART QR CODE READER AND DATA ANALYZER
   EXTERNAL JAVASCRIPT FILE
========================================================= */

let scanHistory = [];
let videoStream = null;
let scanTimer = null;

try {
  scanHistory = JSON.parse(localStorage.getItem("scanHistory")) || [];
} catch (error) {
  scanHistory = [];
}

function toggleMenu() {
  const menu = document.getElementById("mainMenu");

  if (menu) {
    menu.classList.toggle("open");
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";

  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("smartQRTheme", newTheme);
}

function loadTheme() {
  const savedTheme = localStorage.getItem("smartQRTheme");

  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  }
}

function showMessage(id, message) {
  const element = document.getElementById(id);

  if (element) {
    element.innerHTML = message;
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, function(match) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[match];
  });
}

function saveHistoryToStorage() {
  localStorage.setItem("scanHistory", JSON.stringify(scanHistory));
}

function analyzeQRData(rawValue) {
  const value = String(rawValue || "").trim();
  let category = "Plain Text";
  let risk = "Low";
  let suggestion = "The data appears to be simple text.";

  if (/^https?:\/\//i.test(value)) {
    category = "Website URL";
    suggestion = "Open only when the website source is trusted.";

    if (!/^https:\/\//i.test(value) || value.length > 90 || /login|verify|password|bank|free|gift|offer|claim/i.test(value)) {
      risk = "Medium";
      suggestion = "This URL may require careful checking before opening.";
    }
  } else if (/^mailto:/i.test(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    category = "Email Address";
    suggestion = "Verify the sender or receiver before sharing sensitive information.";
  } else if (/^tel:/i.test(value) || /^\+?\d{8,15}$/.test(value)) {
    category = "Phone Number";
    suggestion = "This QR code contains phone/contact information.";
  } else if (/BEGIN:VCARD/i.test(value) || /MECARD:/i.test(value)) {
    category = "Contact Card";
    suggestion = "Review contact details before saving them.";
  } else if (/WIFI:/i.test(value)) {
    category = "WiFi Network";
    risk = "Medium";
    suggestion = "Connect only to networks that belong to trusted sources.";
  } else if (/^[0-9]{8,14}$/.test(value)) {
    category = "Product Code";
    suggestion = "This looks like a barcode, EAN, UPC, or product identifier.";
  } else if (/upi:|bitcoin:|ethereum:|wallet|payment|iban/i.test(value)) {
    category = "Payment or Wallet Data";
    risk = "High";
    suggestion = "Check payment details carefully before proceeding.";
  } else if (value.length > 120) {
    category = "Long Text/Data";
    suggestion = "Large QR data should be reviewed before use.";
  }

  return {
    value: value,
    category: category,
    length: value.length,
    risk: risk,
    suggestion: suggestion,
    date: new Date().toLocaleString()
  };
}

function saveScanRecord(record) {
  if (!record.value) {
    return;
  }

  scanHistory.unshift(record);
  scanHistory = scanHistory.slice(0, 50);
  saveHistoryToStorage();
}

function processDetectedQR(value, targetId) {
  const record = analyzeQRData(value);

  if (!record.value) {
    showMessage(targetId, "<strong>No QR data found.</strong>");
    return;
  }

  saveScanRecord(record);
  displayAnalysis(record, targetId);
  renderHistory();
  renderAnalytics();
  renderDashboard();
}

function displayAnalysis(record, targetId) {
  const riskText = record.risk === "High" ? "High ⚠️" : record.risk === "Medium" ? "Medium ⚠️" : "Low ✅";

  const html = `
    <h3>Analysis Result</h3>
    <p><strong>Category:</strong> ${record.category}</p>
    <p><strong>Risk Level:</strong> ${riskText}</p>
    <p><strong>Data Length:</strong> ${record.length} characters</p>
    <p><strong>Suggestion:</strong> ${record.suggestion}</p>
    <p><strong>Detected Data:</strong><br>${escapeHTML(record.value)}</p>
  `;

  showMessage(targetId, html);
}

function analyzeManualInput() {
  const input = document.getElementById("manualQRData");

  if (!input) {
    return;
  }

  if (!input.value.trim()) {
    showMessage("analysisResult", "<strong>No data found.</strong> Please enter QR text first.");
    return;
  }

  processDetectedQR(input.value, "analysisResult");
}

async function startScanner() {
  const video = document.getElementById("qrVideo");

  if (!video) {
    return;
  }

  if (!("mediaDevices" in navigator)) {
    showMessage("scannerResult", "Camera access is not supported in this browser.");
    return;
  }

  if (!("BarcodeDetector" in window)) {
    showMessage("scannerResult", "Camera can open, but this browser does not support direct QR detection. Please use the Upload QR Image option.");
    return;
  }

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = videoStream;
    await video.play();

    const detector = new BarcodeDetector({ formats: ["qr_code"] });

    showMessage("scannerResult", "Camera started. Place a QR code clearly in front of the camera.");

    scanTimer = setInterval(async function() {
      try {
        const codes = await detector.detect(video);

        if (codes.length > 0) {
          processDetectedQR(codes[0].rawValue, "scannerResult");
          stopScanner();
        }
      } catch (error) {
        showMessage("scannerResult", "Scanning is active. Keep the QR code steady and clearly visible.");
      }
    }, 700);
  } catch (error) {
    showMessage("scannerResult", "Camera permission denied or unavailable. Please use the Upload QR Image option.");
  }
}

function stopScanner() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }

  if (videoStream) {
    videoStream.getTracks().forEach(function(track) {
      track.stop();
    });
    videoStream = null;
  }

  const video = document.getElementById("qrVideo");

  if (video) {
    video.pause();
    video.srcObject = null;
  }
}

async function scanUploadedImage() {
  const input = document.getElementById("qrImageInput");
  const preview = document.getElementById("imagePreview");

  if (!input || !input.files || input.files.length === 0) {
    showMessage("imageResult", "Please select a QR code image first.");
    return;
  }

  const file = input.files[0];

  if (!file.type.startsWith("image/")) {
    showMessage("imageResult", "Please upload a valid image file.");
    return;
  }

  const imageURL = URL.createObjectURL(file);
  const image = new Image();

  image.onload = async function() {
    if (preview) {
      preview.innerHTML = "";
      const previewImage = image.cloneNode();
      previewImage.alt = "Uploaded QR preview";
      preview.appendChild(previewImage);
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let decodedValue = "";

    if (typeof jsQR === "function") {
      try {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth"
        });

        if (code && code.data) {
          decodedValue = code.data;
        }
      } catch (error) {
        decodedValue = "";
      }
    }

    if (!decodedValue && "BarcodeDetector" in window) {
      try {
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        const codes = await detector.detect(image);

        if (codes.length > 0) {
          decodedValue = codes[0].rawValue;
        }
      } catch (error) {
        decodedValue = "";
      }
    }

    if (decodedValue) {
      processDetectedQR(decodedValue, "imageResult");
    } else {
      showMessage(
        "imageResult",
        "No QR data was decoded. Please try a sharper image, crop only the QR area, or use Chrome/Edge with internet enabled so the jsQR decoder can load."
      );
    }

    URL.revokeObjectURL(imageURL);
  };

  image.onerror = function() {
    showMessage("imageResult", "The selected image could not be loaded.");
    URL.revokeObjectURL(imageURL);
  };

  image.src = imageURL;
}

function demoScan(value) {
  const input = document.getElementById("manualQRData");

  if (input) {
    input.value = value;
  }

  analyzeManualInput();
}

function renderHistory() {
  const body = document.getElementById("historyBody");

  if (!body) {
    return;
  }

  if (scanHistory.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="table-empty">No scan history available.</td></tr>`;
    return;
  }

  body.innerHTML = scanHistory.map(function(item, index) {
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHTML(item.category)}</td>
        <td>${escapeHTML(item.risk)}</td>
        <td>${escapeHTML(item.value).slice(0, 90)}</td>
        <td>${escapeHTML(item.date)}</td>
      </tr>
    `;
  }).join("");
}

function clearHistory() {
  scanHistory = [];
  localStorage.removeItem("scanHistory");
  renderHistory();
  renderAnalytics();
  renderDashboard();
  showMessage("historyNotice", "Scan history has been cleared.");
}

function renderAnalytics() {
  const body = document.getElementById("analyticsBody");
  const summary = document.getElementById("analyticsSummary");
  const totalBox = document.getElementById("totalScansBox");
  const categoryBox = document.getElementById("categoryBox");
  const riskBox = document.getElementById("riskBox");

  const counts = getCategoryCounts();
  const mediumHigh = getMediumHighRiskCount();

  if (summary) {
    summary.innerHTML = `
      <strong>Total Scans:</strong> ${scanHistory.length}
      &nbsp; | &nbsp;
      <strong>Categories Found:</strong> ${Object.keys(counts).length}
      &nbsp; | &nbsp;
      <strong>Medium/High Risk:</strong> ${mediumHigh}
    `;
  }

  if (totalBox) {
    totalBox.textContent = scanHistory.length;
  }

  if (categoryBox) {
    categoryBox.textContent = Object.keys(counts).length;
  }

  if (riskBox) {
    riskBox.textContent = mediumHigh;
  }

  if (body) {
    const rows = Object.keys(counts).map(function(category) {
      const total = counts[category];
      const percent = scanHistory.length ? Math.round((total / scanHistory.length) * 100) : 0;

      return `<tr><td>${escapeHTML(category)}</td><td>${total}</td><td>${percent}%</td></tr>`;
    }).join("");

    body.innerHTML = rows || `<tr><td colspan="3" class="table-empty">No analytics data available.</td></tr>`;
  }
}

/* =========================================================
   DASHBOARD FUNCTIONS
========================================================= */
function getCategoryCounts() {
  const counts = {};

  scanHistory.forEach(function(item) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  });

  return counts;
}

function getMediumHighRiskCount() {
  return scanHistory.filter(function(item) {
    return item.risk === "Medium" || item.risk === "High";
  }).length;
}

function renderDashboard() {
  const totalBox = document.getElementById("dashboardTotalScans");
  const categoriesBox = document.getElementById("dashboardCategories");
  const riskBox = document.getElementById("dashboardRiskCount");
  const latestBox = document.getElementById("dashboardLatestType");
  const recentBody = document.getElementById("dashboardRecentBody");

  const counts = getCategoryCounts();

  if (totalBox) {
    totalBox.textContent = scanHistory.length;
  }

  if (categoriesBox) {
    categoriesBox.textContent = Object.keys(counts).length;
  }

  if (riskBox) {
    riskBox.textContent = getMediumHighRiskCount();
  }

  if (latestBox) {
    latestBox.textContent = scanHistory.length ? scanHistory[0].category : "None";
  }

  if (recentBody) {
    if (scanHistory.length === 0) {
      recentBody.innerHTML = `<tr><td colspan="5" class="table-empty">No recent records available.</td></tr>`;
    } else {
      recentBody.innerHTML = scanHistory.slice(0, 5).map(function(item, index) {
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHTML(item.category)}</td>
            <td>${escapeHTML(item.risk)}</td>
            <td>${escapeHTML(item.value).slice(0, 80)}</td>
            <td>${escapeHTML(item.date)}</td>
          </tr>
        `;
      }).join("");
    }
  }

  renderDashboardChart();
  populateDashboardRecordSelect();
  showCurrentUser();
}

function renderDashboardChart() {
  const chart = document.getElementById("dashboardChart");

  if (!chart) {
    return;
  }

  const counts = getCategoryCounts();
  const categories = Object.keys(counts);

  if (categories.length === 0) {
    chart.innerHTML = `<p class="table-empty">No data available for graph. Add or scan QR records first.</p>`;
    return;
  }

  const maxValue = Math.max.apply(null, categories.map(function(category) {
    return counts[category];
  }));

  chart.innerHTML = categories.map(function(category) {
    const total = counts[category];
    const width = Math.max(12, Math.round((total / maxValue) * 100));

    return `
      <div class="bar-item">
        <div class="bar-label">
          <span>${escapeHTML(category)}</span>
          <span>${total} record(s)</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${width}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function populateDashboardRecordSelect() {
  const select = document.getElementById("dashboardRecordSelect");

  if (!select) {
    return;
  }

  const selectedValue = select.value;
  let options = `<option value="">No record selected</option>`;

  scanHistory.forEach(function(item, index) {
    const label = `${index + 1}. ${item.category} - ${item.value.slice(0, 38)}`;
    options += `<option value="${index}">${escapeHTML(label)}</option>`;
  });

  select.innerHTML = options;

  if (selectedValue && scanHistory[selectedValue]) {
    select.value = selectedValue;
  }
}

function loadSelectedRecordForEdit() {
  const select = document.getElementById("dashboardRecordSelect");
  const input = document.getElementById("dashboardRecordValue");

  if (!select || !input) {
    return;
  }

  const index = select.value;

  if (index === "") {
    input.value = "";
    return;
  }

  input.value = scanHistory[index] ? scanHistory[index].value : "";
}

function insertDashboardRecord() {
  const input = document.getElementById("dashboardRecordValue");

  if (!input || !input.value.trim()) {
    showMessage("dashboardNotice", "Please enter QR data before inserting a new record.");
    return;
  }

  const record = analyzeQRData(input.value);
  saveScanRecord(record);
  input.value = "";
  renderHistory();
  renderAnalytics();
  renderDashboard();
  showMessage("dashboardNotice", "New QR record has been inserted successfully.");
}

function updateDashboardRecord() {
  const select = document.getElementById("dashboardRecordSelect");
  const input = document.getElementById("dashboardRecordValue");

  if (!select || !input || select.value === "") {
    showMessage("dashboardNotice", "Please select a record before updating.");
    return;
  }

  if (!input.value.trim()) {
    showMessage("dashboardNotice", "Please enter updated QR data.");
    return;
  }

  const index = Number(select.value);
  scanHistory[index] = analyzeQRData(input.value);
  saveHistoryToStorage();
  renderHistory();
  renderAnalytics();
  renderDashboard();
  showMessage("dashboardNotice", "Selected QR record has been updated successfully.");
}

function deleteDashboardRecord() {
  const select = document.getElementById("dashboardRecordSelect");
  const input = document.getElementById("dashboardRecordValue");

  if (!select || select.value === "") {
    showMessage("dashboardNotice", "Please select a record before deleting.");
    return;
  }

  const index = Number(select.value);
  scanHistory.splice(index, 1);
  saveHistoryToStorage();

  if (input) {
    input.value = "";
  }

  renderHistory();
  renderAnalytics();
  renderDashboard();
  showMessage("dashboardNotice", "Selected QR record has been deleted successfully.");
}

/* =========================================================
   LOGIN AND REGISTER FUNCTIONS
========================================================= */
function getRegisteredUsers() {
  try {
    return JSON.parse(localStorage.getItem("smartQRUsers")) || [];
  } catch (error) {
    return [];
  }
}

function saveRegisteredUsers(users) {
  localStorage.setItem("smartQRUsers", JSON.stringify(users));
}

function registerUser(event) {
  event.preventDefault();

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim().toLowerCase();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (!name || !email || !password || !confirmPassword) {
    showMessage("registerMessage", "Please complete all fields.");
    return;
  }

  if (password.length < 4) {
    showMessage("registerMessage", "Password should contain at least 4 characters for this demo.");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("registerMessage", "Password and confirm password do not match.");
    return;
  }

  const users = getRegisteredUsers();
  const existingUser = users.find(function(user) {
    return user.email === email;
  });

  if (existingUser) {
    showMessage("registerMessage", "This email is already registered. Please login instead.");
    return;
  }

  users.push({ name: name, email: email, password: password });
  saveRegisteredUsers(users);
  localStorage.setItem("smartQRCurrentUser", JSON.stringify({ name: name, email: email }));

  showMessage("registerMessage", "Account created successfully. Redirecting to dashboard...");

  setTimeout(function() {
    window.location.href = "dashboard.html";
  }, 900);
}

function loginUser(event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const users = getRegisteredUsers();

  const matchedUser = users.find(function(user) {
    return user.email === email && user.password === password;
  });

  if (!matchedUser) {
    showMessage("loginMessage", "Invalid email or password. Please register first or check your details.");
    return;
  }

  localStorage.setItem("smartQRCurrentUser", JSON.stringify({ name: matchedUser.name, email: matchedUser.email }));
  showMessage("loginMessage", "Login successful. Redirecting to dashboard...");

  setTimeout(function() {
    window.location.href = "dashboard.html";
  }, 700);
}

function showCurrentUser() {
  const nameBox = document.getElementById("dashboardUserName");
  const emailBox = document.getElementById("dashboardUserEmail");

  if (!nameBox || !emailBox) {
    return;
  }

  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("smartQRCurrentUser"));
  } catch (error) {
    user = null;
  }

  if (user && user.name) {
    nameBox.textContent = user.name;
    emailBox.textContent = user.email;
  } else {
    nameBox.textContent = "Guest User";
    emailBox.textContent = "Login is optional for demo testing.";
  }
}

/* =========================================================
   PAGE LOAD
========================================================= */
document.addEventListener("DOMContentLoaded", function() {
  loadTheme();
  renderHistory();
  renderAnalytics();
  renderDashboard();
});
