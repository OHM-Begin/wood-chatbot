/**
 * Google Apps Script: ระบบตรวจรับไม้และเบิกตัดไม้ (Wood Inventory & Cutting System)
 * Version: 2.0 (Smart Active Container + Wood Cutting Tab + Gemini AI Integration)
 */

const SHEET_PACKING_LIST = "Packing List";
const SHEET_WOOD_CUTTING = "ตัดไม้";

const CURRENT_PL_NO = "PL- 25/ASN/TM/VII/26";
const CURRENT_CONTAINER = "BEAU 5231653/ID48136AA";
const CURRENT_DATE = "2026-07-01";

// ข้อมูล Master Data สำหรับสร้างตารางครั้งแรก (ถ้าต้องการ)
const MASTER_PACKING_LIST = [
  { item: "8163986", bdl: "1", dim: "16 x 254 x 524 MM", qty: 250, vol: 0.532 },
  { item: "8156594", bdl: "1", dim: "16 x 162 x 644 MM", qty: 250, vol: 0.417 },
  { item: "8156623", bdl: "2", dim: "16 x 162 x 872 MM", qty: 438, vol: 0.990 },
  { item: "8156623", bdl: "3", dim: "16 x 162 x 872 MM", qty: 232, vol: 0.524 },
  { item: "8156614", bdl: "4", dim: "16 x 162 x 796 MM", qty: 438, vol: 0.904 },
  { item: "8156614", bdl: "5", dim: "16 x 162 x 796 MM", qty: 312, vol: 0.644 },
  { item: "8156604", bdl: "6", dim: "16 x 162 x 720 MM", qty: 438, vol: 0.817 },
  { item: "8156604", bdl: "7", dim: "16 x 162 x 720 MM", qty: 312, vol: 0.582 },
  { item: "8156585", bdl: "8", dim: "16 x 162 x 568 MM", qty: 750, vol: 1.104 },
  { item: "8156521", bdl: "9", dim: "16 x 162 x 524 MM", qty: 876, vol: 1.190 },
  { item: "8156521", bdl: "10", dim: "16 x 162 x 524 MM", qty: 876, vol: 1.190 },
  { item: "8156521", bdl: "11", dim: "16 x 162 x 524 MM", qty: 876, vol: 1.190 },
  { item: "8156521", bdl: "12", dim: "16 x 162 x 524 MM", qty: 876, vol: 1.190 },
  { item: "8156521", bdl: "13", dim: "16 x 162 x 524 MM", qty: 856, vol: 1.163 },
  { item: "8156578", bdl: "14", dim: "16 x 162 x 491 MM", qty: 320, vol: 0.407 },
  { item: "8156374", bdl: "15", dim: "16 x 162 x 474 MM", qty: 404, vol: 0.496 },
  { item: "8156374", bdl: "15", dim: "16 x 162 x 474 MM", qty: 876, vol: 1.076 },
  { item: "8156666", bdl: "16", dim: "16 x 86 x 872 MM", qty: 320, vol: 0.384 },
  { item: "8156663", bdl: "16", dim: "16 x 86 x 796 MM", qty: 480, vol: 0.526 },
  { item: "8156544", bdl: "17", dim: "16 x 86 x 822 MM", qty: 320, vol: 0.362 },
  { item: "8156535", bdl: "17", dim: "16 x 86 x 746 MM", qty: 480, vol: 0.493 },
  { item: "8156659", bdl: "18", dim: "16 x 86 x 720 MM", qty: 960, vol: 0.951 },
  { item: "8156646", bdl: "19", dim: "16 x 86 x 568 MM", qty: 520, vol: 0.406 },
  { item: "8156643", bdl: "19", dim: "16 x 86 x 491 MM", qty: 640, vol: 0.432 },
  { item: "8156575", bdl: "20", dim: "16 x 86 x 524 MM", qty: 1608, vol: 1.159 },
  { item: "8156575", bdl: "21", dim: "16 x 86 x 524 MM", qty: 1608, vol: 1.159 },
  { item: "8156575", bdl: "22", dim: "16 x 86 x 524 MM", qty: 1264, vol: 0.911 },
  { item: "8156565", bdl: "23", dim: "16 x 86 x 474 MM", qty: 1608, vol: 1.049 },
  { item: "8156565", bdl: "24", dim: "16 x 86 x 474 MM", qty: 1592, vol: 1.038 },
  { item: "6601644", bdl: "25", dim: "15 x 279.4 x 520.7 MM", qty: 528, vol: 1.152 },
  { item: "6601644", bdl: "26", dim: "15 x 279.4 x 520.7 MM", qty: 528, vol: 1.152 },
  { item: "6601644", bdl: "27", dim: "15 x 279.4 x 520.7 MM", qty: 144, vol: 0.314 },
  { item: "6601640", bdl: "27", dim: "15 x 228.6 x 673.1 MM", qty: 520, vol: 1.200 },
  { item: "6601637", bdl: "28", dim: "15 x 228.6 x 520.7 MM", qty: 664, vol: 1.186 },
  { item: "6601637", bdl: "29", dim: "15 x 228.6 x 520.7 MM", qty: 664, vol: 1.186 },
  { item: "6601637", bdl: "30", dim: "15 x 228.6 x 520.7 MM", qty: 242, vol: 0.432 },
  { item: "6601636", bdl: "30", dim: "15 x 228.6 x 444.5 MM", qty: 386, vol: 0.588 },
  { item: "6601636", bdl: "31", dim: "15 x 228.6 x 444.5 MM", qty: 664, vol: 1.012 },
  { item: "8843617", bdl: "32", dim: "15 x 228.6 x 431.8 MM", qty: 295, vol: 0.437 },
  { item: "6601608", bdl: "32", dim: "15 x 101.6 x 520.7 MM", qty: 1100, vol: 0.873 },
  { item: "6601628", bdl: "33", dim: "15 x 177.8 x 673.1 MM", qty: 315, vol: 0.565 },
  { item: "6601612", bdl: "33", dim: "15 x 101.6 x 647.7 MM", qty: 570, vol: 0.563 },
  { item: "6601609", bdl: "33", dim: "15 x 101.6 x 566.7 MM", qty: 570, vol: 0.492 },
  { item: "6601625", bdl: "34", dim: "15 x 177.8 x 520.7 MM", qty: 864, vol: 1.200 },
  { item: "6601625", bdl: "35", dim: "15 x 177.8 x 520.7 MM", qty: 816, vol: 1.133 },
  { item: "6601608", bdl: "36", dim: "15 x 101.6 x 520.7 MM", qty: 1500, vol: 1.190 },
  { item: "6601608", bdl: "37", dim: "15 x 101.6 x 520.7 MM", qty: 1500, vol: 1.190 },
  { item: "6601608", bdl: "38", dim: "15 x 101.6 x 520.7 MM", qty: 1500, vol: 1.190 }
];

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🪵 ระบบ Packing List & ตัดไม้")
    .addItem("➕ สร้างแท็บ 'ตัดไม้' (ถ้ายังไม่มี)", "ensureCuttingSheetExists")
    .addItem("🔄 รีเซ็ตยอดรับเข้าทั้งหมด (เฉพาะชีต Packing List)", "resetReceivedQuantities")
    .addToUi();
}

/**
 * สร้างแท็บ "ตัดไม้" อัตโนมัติ โดยไม่กระทบข้อมูลเดิม
 */
function ensureCuttingSheetExists() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let cutSheet = ss.getSheetByName(SHEET_WOOD_CUTTING);
  if (!cutSheet) {
    cutSheet = ss.insertSheet(SHEET_WOOD_CUTTING);
    const headers = [
      "ลำดับ",
      "วัน-เวลาที่ตัด (Timestamp)",
      "เลขที่ PL (Packing No.)",
      "เลขตู้ (Container No.)",
      "No. Item (Part Number)",
      "No. BDL (มัดที่)",
      "ขนาด / Description (MM)",
      "จำนวนที่ตัดออก (PCS)",
      "ยอดรับเข้าคลัง (PCS)",
      "คงเหลือพร้อมใช้ในคลัง (PCS)",
      "ผู้เบิก / หมายเหตุ"
    ];
    cutSheet.appendRow(headers);
    cutSheet.getRange(1, 1, 1, headers.length)
            .setFontWeight("bold")
            .setBackground("#b91c1c")
            .setFontColor("#ffffff")
            .setHorizontalAlignment("center");
    cutSheet.setFrozenRows(1);
    cutSheet.autoResizeColumns(1, headers.length);
  }
  return cutSheet;
}

/**
 * คำนวณหายอดตัดไม้สะสมแยกตาม (PL + Container + Item + Bdl)
 */
function getCutQuantitiesMap(cutSheet) {
  const cutMap = {};
  if (!cutSheet) return cutMap;
  const data = cutSheet.getDataRange().getValues();
  if (data.length < 2) return cutMap;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const pl = String(row[2] || "").trim().toLowerCase();
    const ctn = String(row[3] || "").trim().toLowerCase();
    const item = String(row[4] || "").trim().toLowerCase();
    const bdl = String(row[5] || "").trim().toLowerCase();
    const cutQty = Number(row[7]) || 0;

    const key = `${pl}|${ctn}|${item}|${bdl}`;
    cutMap[key] = (cutMap[key] || 0) + cutQty;

    // เก็บ fallback key แบบสั้นด้วย
    const shortKey = `${item}|${bdl}`;
    cutMap[shortKey] = (cutMap[shortKey] || 0) + cutQty;
  }
  return cutMap;
}

/**
 * ค้นหาตู้ล่าสุด (Active Container) ที่กำลังเปิดรับอยู่
 */
function findActiveContainerInfo(data, colPl, colCtn, colExp, colRec) {
  let latestCtn = "";
  let latestPl = "";
  
  for (let i = data.length - 1; i >= 1; i--) {
    const ctn = String(data[i][colCtn] || "").trim();
    const pl = String(data[i][colPl] || "").trim();
    if (ctn && !latestCtn) {
      latestCtn = ctn;
      latestPl = pl;
      break;
    }
  }
  return { activeContainer: latestCtn, activePl: latestPl };
}

/**
 * Main Webhook Handler
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let plSheet = ss.getSheetByName(SHEET_PACKING_LIST);
    
    if (!plSheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: `ไม่พบแท็บ ${SHEET_PACKING_LIST}` })).setMimeType(ContentService.MimeType.JSON);
    }

    let cutSheet = ensureCuttingSheetExists();
    const cutMap = getCutQuantitiesMap(cutSheet);

    const data = plSheet.getDataRange().getValues();
    if (data.length < 2) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ตาราง Packing List ว่างเปล่า" })).setMimeType(ContentService.MimeType.JSON);
    }

    const headers = data[0].map(h => String(h).toLowerCase());
    let colDate = headers.findIndex(h => h.includes("date") || h.includes("วัน"));
    let colPl = headers.findIndex(h => h.includes("pl") || h.includes("packing no"));
    let colCtn = headers.findIndex(h => h.includes("container") || h.includes("ตู้"));
    let colItem = headers.findIndex(h => h.includes("item") || h.includes("part"));
    let colBdl = headers.findIndex(h => h.includes("bdl") || h.includes("มัด"));
    let colDim = headers.findIndex(h => h.includes("ขนาด") || h.includes("dim") || h.includes("desc"));
    let colExp = headers.findIndex(h => h.includes("ยอดตาม pl") || h.includes("ตาม pl") || h.includes("quantity"));
    let colRec = headers.findIndex(h => h.includes("รับเข้าแล้ว") || h.includes("รับแล้ว"));
    let colBal = headers.findIndex(h => h.includes("คงเหลือ"));
    let colStatus = headers.findIndex(h => h.includes("สถานะ"));
    let colUpdated = headers.findIndex(h => h.includes("อัปเดต") || h.includes("update"));

    if (colPl === -1) colPl = 2;
    if (colCtn === -1) colCtn = 3;
    if (colItem === -1) colItem = 4;
    if (colBdl === -1) colBdl = 5;
    if (colDim === -1) colDim = 6;
    if (colExp === -1) colExp = 7;
    if (colRec === -1) colRec = 9;
    if (colBal === -1) colBal = 10;
    if (colStatus === -1) colStatus = 11;
    if (colUpdated === -1) colUpdated = 12;

    const activeInfo = findActiveContainerInfo(data, colPl, colCtn, colExp, colRec);
    const targetCtnFilter = String(payload.container || activeInfo.activeContainer || "").trim().toLowerCase();
    const action = payload.action;

    // ==========================================
    // 1. สรุปยอดรวม (Summary)
    // ==========================================
    if (action === "summary") {
      let totalExpected = 0;
      let totalReceived = 0;
      let totalCut = 0;
      let completedCount = 0;
      let pendingCount = 0;
      let excessCount = 0;
      let targetContainerName = "";

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const ctn = String(row[colCtn] || "").trim().toLowerCase();
        const pl = String(row[colPl] || "").trim().toLowerCase();
        const item = String(row[colItem] || "").trim().toLowerCase();
        const bdl = String(row[colBdl] || "").trim().toLowerCase();

        if (!targetCtnFilter || ctn.includes(targetCtnFilter) || targetCtnFilter.includes(ctn)) {
          if (!targetContainerName) targetContainerName = row[colCtn];
          const exp = Number(row[colExp]) || 0;
          const rec = Number(row[colRec]) || 0;
          const cut = cutMap[`${pl}|${ctn}|${item}|${bdl}`] || cutMap[`${item}|${bdl}`] || 0;

          totalExpected += exp;
          totalReceived += rec;
          totalCut += cut;

          if (rec > exp) excessCount++;
          else if (rec === exp && exp > 0) completedCount++;
          else pendingCount++;
        }
      }

      const availableInWarehouse = totalReceived - totalCut;

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        container: targetContainerName || activeInfo.activeContainer,
        plNo: activeInfo.activePl,
        totalExpected: totalExpected,
        totalReceived: totalReceived,
        totalBalance: totalExpected - totalReceived,
        totalCut: totalCut,
        availableStock: availableInWarehouse,
        completedCount: completedCount,
        pendingCount: pendingCount,
        excessCount: excessCount,
        percent: totalExpected > 0 ? ((totalReceived / totalExpected) * 100).toFixed(1) : "0.0"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 2. ค้นหา (Search)
    // ==========================================
    if (action === "search") {
      let query = String(payload.query || "").trim().toLowerCase();
      let cleanQuery = query.replace(/^มัด\s*/, "").replace(/^bdl\s*/, "").trim();
      const results = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const pl = String(row[colPl] || "").trim().toLowerCase();
        const ctn = String(row[colCtn] || "").trim().toLowerCase();
        const itemNo = String(row[colItem] || "").trim().toLowerCase();
        const bdlNo = String(row[colBdl] || "").trim().toLowerCase();

        const matchQuery = (itemNo.includes(query) || bdlNo === query || bdlNo === cleanQuery || 
                            query === `มัด ${bdlNo}` || query === `bdl ${bdlNo}` || query === `มัด${bdlNo}`);

        if (matchQuery) {
          const exp = Number(row[colExp]) || 0;
          const rec = Number(row[colRec]) || 0;
          const bal = exp - rec;
          const cut = cutMap[`${pl}|${ctn}|${itemNo}|${bdlNo}`] || cutMap[`${itemNo}|${bdlNo}`] || 0;
          const avail = rec - cut;

          results.push({
            rowIdx: i + 1,
            plNo: row[colPl],
            container: row[colCtn],
            item: row[colItem],
            bdl: row[colBdl],
            dim: String(row[colDim]),
            expQty: exp,
            recQty: rec,
            balQty: bal,
            cutQty: cut,
            availStock: avail,
            status: String(row[colStatus])
          });
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success", results: results })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 3. บันทึกตรวจรับเข้า (Receive)
    // ==========================================
    if (action === "receive") {
      let query = String(payload.query || "").trim().toLowerCase();
      let cleanQuery = query.replace(/^มัด\s*/, "").replace(/^bdl\s*/, "").trim();
      const addQty = Number(payload.quantity) || 0;
      const tz = Session.getScriptTimeZone() || "Asia/Bangkok";
      const nowStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");

      const matchedCandidates = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const pl = String(row[colPl] || "").trim().toLowerCase();
        const ctn = String(row[colCtn] || "").trim().toLowerCase();
        const itemNo = String(row[colItem] || "").trim().toLowerCase();
        const bdlNo = String(row[colBdl] || "").trim().toLowerCase();

        const matchCtn = (!targetCtnFilter || ctn.includes(targetCtnFilter) || targetCtnFilter.includes(ctn));
        const matchItem = (itemNo === query || bdlNo === query || bdlNo === cleanQuery || 
                           query === `มัด ${bdlNo}` || query === `bdl ${bdlNo}` || query === `มัด${bdlNo}`);

        if (matchCtn && matchItem) {
          matchedCandidates.push({
            rowIdx: i + 1,
            plNo: row[colPl],
            container: row[colCtn],
            item: row[colItem],
            bdl: row[colBdl],
            dim: row[colDim],
            expQty: Number(row[colExp]),
            currentRec: Number(row[colRec])
          });
        }
      }

      if (matchedCandidates.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: `ไม่พบ Part หรือ มัดที่: ${payload.query} ในตู้ ${activeInfo.activeContainer}` })).setMimeType(ContentService.MimeType.JSON);
      }

      let targetItem = matchedCandidates[0];
      for (const cand of matchedCandidates) {
        if (cand.expQty === addQty && cand.currentRec < cand.expQty) {
          targetItem = cand;
          break;
        }
      }

      const newRecQty = targetItem.currentRec + addQty;
      plSheet.getRange(targetItem.rowIdx, colRec + 1).setValue(newRecQty);
      if (colUpdated !== -1) {
        plSheet.getRange(targetItem.rowIdx, colUpdated + 1).setValue(nowStr);
      }

      const bal = targetItem.expQty - newRecQty;
      let statusText = "";
      if (newRecQty > targetItem.expQty) {
        statusText = `⚠️ รับเกิน (${Math.abs(bal)} ชิ้น)`;
      } else if (newRecQty === targetItem.expQty) {
        statusText = "✅ ครบถ้วน";
      } else if (newRecQty > 0) {
        statusText = "🟡 รับบางส่วน";
      } else {
        statusText = "⏳ ยังไม่รับ";
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        plNo: targetItem.plNo,
        container: targetItem.container,
        item: targetItem.item,
        bdl: targetItem.bdl,
        dim: targetItem.dim,
        expQty: targetItem.expQty,
        addedQty: addQty,
        totalRecQty: newRecQty,
        balQty: bal,
        statusText: statusText
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 4. บันทึกตัดไม้ออก (Cut / Issue)
    // ==========================================
    if (action === "cut") {
      let query = String(payload.query || "").trim().toLowerCase();
      let cleanQuery = query.replace(/^มัด\s*/, "").replace(/^bdl\s*/, "").trim();
      const cutQty = Number(payload.quantity) || 0;
      const note = String(payload.note || "เบิกตัดไม้").trim();
      const tz = Session.getScriptTimeZone() || "Asia/Bangkok";
      const nowStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");

      if (cutQty <= 0) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "จำนวนที่ตัดต้องมากกว่า 0" })).setMimeType(ContentService.MimeType.JSON);
      }

      // ฟังก์ชันแปลงข้อความให้เปรียบเทียบง่าย (ตัดช่องว่างและขีดออก)
      const normalize = (s) => String(s || "").toLowerCase().replace(/[\s\-_]/g, "");
      const targetInvoiceClean = payload.invoice ? normalize(payload.invoice) : "";

      const matched = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const pl = String(row[colPl] || "").trim();
        const ctn = String(row[colCtn] || "").trim();
        const itemNo = String(row[colItem] || "").trim();
        const bdlNo = String(row[colBdl] || "").trim();

        // ตรวจสอบ Invoice / Container แบบยืดหยุ่น (เช่น PL-25, PL25, BEAU)
        const plClean = normalize(pl);
        const ctnClean = normalize(ctn);
        const matchInvoice = !targetInvoiceClean || plClean.includes(targetInvoiceClean) || ctnClean.includes(targetInvoiceClean);
        
        const matchItem = (itemNo.toLowerCase() === query || bdlNo.toLowerCase() === query || bdlNo.toLowerCase() === cleanQuery ||
                           query === `มัด ${bdlNo.toLowerCase()}` || query === `มัด${bdlNo.toLowerCase()}`);

        if (matchInvoice && matchItem) {
          const rec = Number(row[colRec]) || 0;
          const currentCut = cutMap[`${pl.toLowerCase()}|${ctn.toLowerCase()}|${itemNo.toLowerCase()}|${bdlNo.toLowerCase()}`] || cutMap[`${itemNo.toLowerCase()}|${bdlNo.toLowerCase()}`] || 0;
          const avail = rec - currentCut;

          matched.push({
            plNo: pl,
            container: ctn,
            item: itemNo,
            bdl: bdlNo,
            dim: row[colDim],
            recQty: rec,
            currentCut: currentCut,
            availStock: avail
          });
        }
      }

      if (matched.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: `ไม่พบรายการ ${payload.query} ในระบบ` })).setMimeType(ContentService.MimeType.JSON);
      }

      // คำนวณสต็อกพร้อมใช้รวมของรายการที่เข้าข่ายทั้งหมด
      const totalAvailableStock = matched.reduce((sum, m) => sum + (m.availStock > 0 ? m.availStock : 0), 0);
      
      // รองรับคำสั่ง "ตัดหมด / ตัดทั้งหมด"
      let actualCutQty = (payload.cutAll || cutQty === 0) ? totalAvailableStock : cutQty;
      if (actualCutQty <= 0) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: `ไม่มีไม้พร้อมใช้ในคลังสำหรับ ${payload.query}` })).setMimeType(ContentService.MimeType.JSON);
      }

      if (actualCutQty > totalAvailableStock) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: `⚠️ ไม้ในคลังไม่พอ! ${payload.query} มีพร้อมใช้ทั้งหมดเพียง ${totalAvailableStock} ชิ้น (สั่งตัด ${actualCutQty} ชิ้น)`
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // ========================================================
      // ตัดแบบ FIFO (First-In First-Out) ไล่ตัดจากมัดแรกที่มีของ
      // ========================================================
      let remainingToCut = actualCutQty;
      const deductions = [];
      let nextRowNo = cutSheet.getLastRow();

      for (const cand of matched) {
        if (cand.availStock <= 0) continue;
        if (remainingToCut <= 0) break;

        const deductFromThis = Math.min(cand.availStock, remainingToCut);
        const newAvail = cand.availStock - deductFromThis;
        remainingToCut -= deductFromThis;
        nextRowNo++;

        // บันทึกลงแท็บ "ตัดไม้"
        cutSheet.appendRow([
          nextRowNo - 1,
          nowStr,
          cand.plNo,
          cand.container,
          cand.item,
          cand.bdl,
          cand.dim,
          deductFromThis,
          cand.recQty,
          newAvail,
          note
        ]);

        deductions.push({
          plNo: cand.plNo,
          item: cand.item,
          bdl: cand.bdl,
          dim: cand.dim,
          cutQty: deductFromThis,
          recQty: cand.recQty,
          newAvail: newAvail
        });
      }

      const isMultiBundle = deductions.length > 1;
      const firstTarget = deductions[0];

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        isFifo: isMultiBundle,
        totalCutQty: actualCutQty,
        totalPartRemaining: totalAvailableStock - actualCutQty,
        deductions: deductions,
        item: firstTarget.item,
        bdl: firstTarget.bdl,
        dim: firstTarget.dim,
        plNo: firstTarget.plNo,
        cutQty: firstTarget.cutQty,
        recQty: firstTarget.recQty,
        availStock: firstTarget.newAvail,
        note: note
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 5. รายการค้างรับ (Pending List)
    // ==========================================
    if (action === "pending_list") {
      const pendingItems = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const ctn = String(row[colCtn] || "").trim().toLowerCase();
        if (!targetCtnFilter || ctn.includes(targetCtnFilter) || targetCtnFilter.includes(ctn)) {
          const exp = Number(row[colExp]) || 0;
          const rec = Number(row[colRec]) || 0;
          const bal = exp - rec;
          if (bal > 0) {
            pendingItems.push({
              item: row[colItem],
              bdl: row[colBdl],
              dim: String(row[colDim]),
              expQty: exp,
              recQty: rec,
              balQty: bal
            });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        container: activeInfo.activeContainer,
        pendingCount: pendingItems.length,
        items: pendingItems
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 6. ดึงข้อมูลสรุปสถานะสดทั้งหมด (สำหรับ Gemini AI วิเคราะห์)
    // ==========================================
    if (action === "get_all_status") {
      const allRows = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const pl = String(row[colPl] || "").trim();
        const ctn = String(row[colCtn] || "").trim();
        const itemNo = String(row[colItem] || "").trim();
        const bdlNo = String(row[colBdl] || "").trim();
        const exp = Number(row[colExp]) || 0;
        const rec = Number(row[colRec]) || 0;
        const bal = exp - rec;
        const cut = cutMap[`${pl.toLowerCase()}|${ctn.toLowerCase()}|${itemNo.toLowerCase()}|${bdlNo.toLowerCase()}`] || cutMap[`${itemNo.toLowerCase()}|${bdlNo.toLowerCase()}`] || 0;
        const avail = rec - cut;

        allRows.push({
          plNo: pl,
          container: ctn,
          item: itemNo,
          bdl: bdlNo,
          dim: String(row[colDim]),
          expQty: exp,
          recQty: rec,
          balQty: bal,
          cutQty: cut,
          availStock: avail,
          status: String(row[colStatus])
        });
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        activeContainer: activeInfo.activeContainer,
        activePl: activeInfo.activePl,
        totalItemsCount: allRows.length,
        rows: allRows
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ไม่พบ Action ที่ระบุ" })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function resetReceivedQuantities() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PACKING_LIST);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    for (let r = 2; r <= lastRow; r++) {
      sheet.getRange(r, 10).setValue(0);
      sheet.getRange(r, 13).setValue("-");
    }
    SpreadsheetApp.getUi().alert("🔄 รีเซ็ตยอดรับเข้าทั้งหมดเป็น 0 เรียบร้อยแล้ว!");
  }
}
