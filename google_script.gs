const SHEET_PACKING_LIST = "Packing List";
const SHEET_WOOD_CUTTING = "ตัดไม้";
const SHEET_DASHBOARD = "📊 Dashboard";

const CURRENT_PL_NO = "PL- 25/ASN/TM/VII/26";
const CURRENT_CONTAINER = "BEAU 5231653/ID48136AA";
const CURRENT_DATE = "2026-07-01";

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🪵 ระบบ Packing List & ตัดไม้")
    .addItem("📊 สร้าง/อัปเดตหน้า Dashboard", "buildDashboardSheet")
    .addItem("📐 อัปเกรดแยกมิติ (หนา/กว้าง/ยาว/คิวบิก) ทั้ง 2 ชีต", "upgradeAllSheetsToDimensions")
    .addItem("📥 นำเข้าข้อมูลตู้ PL-28 (37 มัด)", "importPL28Directly")
    .addItem("➕ สร้างแท็บ 'ตัดไม้' (ถ้ายังไม่มี)", "ensureCuttingSheetExists")
    .addItem("🔄 รีเซ็ตยอดรับเข้าทั้งหมด (เฉพาะชีต Packing List)", "resetReceivedQuantities")
    .addToUi();
}

/**
 * ฟังก์ชันผู้ช่วย: แยกขนาดข้อความ (เช่น "16 x 254 x 524 MM") เป็นตัวเลข { thick, width, length }
 */
function parseDimensionNumbers(dimStr) {
  if (!dimStr) return { thick: 0, width: 0, length: 0 };
  const clean = String(dimStr).replace(/MM/i, "").trim();
  const parts = clean.split(/x|\*/i).map(s => parseFloat(s.trim()) || 0);
  return {
    thick: parts[0] || 0,
    width: parts[1] || 0,
    length: parts[2] || 0
  };
}

/**
 * ฟังก์ชันผู้ช่วย: จับคู่ชื่อเอกสาร/Invoice แบบยืดหยุ่น (รองรับ TM001 -> TM202608-001, PL25 -> PL-25)
 */
function matchInvoiceFlexible(docStr, ctnStr, targetInvoiceClean) {
  if (!targetInvoiceClean) return true;
  const docClean = String(docStr || "").toLowerCase().replace(/[\s\-_]/g, "");
  const ctnClean = String(ctnStr || "").toLowerCase().replace(/[\s\-_]/g, "");
  if (docClean.includes(targetInvoiceClean) || ctnClean.includes(targetInvoiceClean)) return true;

  // รองรับ TM001, TM1, TM01 -> TM202608-001
  if (targetInvoiceClean.startsWith("tm")) {
    const numPart = targetInvoiceClean.replace("tm", "").replace(/^0+/, "");
    if (numPart && docClean.startsWith("tm")) {
      const docNum = docClean.replace("tm", "").replace(/^2026[0-9]{2}/, "").replace(/^0+/, "");
      if (docNum === numPart || docClean.endsWith(numPart) || docClean.endsWith(numPart.padStart(3, "0"))) {
        return true;
      }
    }
  }

  // รองรับ PL25, PL28 -> PL-25, PL-28
  if (targetInvoiceClean.startsWith("pl")) {
    const numPart = targetInvoiceClean.replace("pl", "").replace(/^0+/, "");
    if (numPart && docClean.includes(numPart)) return true;
  }

  return false;
}

/**
 * ฟังก์ชันผู้ช่วย: จับคู่รายการไม้แบบยืดหยุ่น (รองรับ มัด, Part Number, และ ขนาด หนาxกว้างxยาว)
 */
function matchItemFlexible(itemNo, bdlNo, dimStr, query, cleanQuery) {
  if (!query) return false;
  const qClean = String(query || "").toLowerCase().replace(/[\s\-_]/g, "");
  const itemClean = String(itemNo || "").toLowerCase().replace(/[\s\-_]/g, "");
  const dimClean = String(dimStr || "").toLowerCase().replace(/[\s\-_]/g, "").replace(/mm/g, "");
  const bdlClean = String(bdlNo || "").toLowerCase().replace(/[\s\-_]/g, "");

  // 1. ตรงตามเลขมัด
  if (bdlClean && (bdlClean === cleanQuery || bdlClean === qClean || query === `มัด ${bdlNo}` || query === `มัด${bdlNo}`)) {
    return true;
  }

  // 2. ตรงตามรหัส Part หรือมี Part เป็นส่วนหนึ่ง (เช่น 786, 789, 8156521)
  if (itemClean.includes(qClean) || String(itemNo).toLowerCase() === query) {
    return true;
  }

  // 3. ตรงตามขนาดมิติไม้ (เช่น 16x1200x900 หรือ 16x1200 หรือ 15.88x50.8)
  if (dimClean.includes(qClean) || qClean.includes(dimClean)) {
    return true;
  }

  // 4. แยกเทียบหนา x กว้าง x ยาว
  const qDims = parseDimensionNumbers(query);
  const rowDims = parseDimensionNumbers(dimStr);
  if (qDims.thick > 0 && qDims.thick === rowDims.thick) {
    if (qDims.width > 0 && qDims.width === rowDims.width) {
      if (qDims.length === 0 || qDims.length === rowDims.length) {
        return true;
      }
    }
  }

  return false;
}

/**
 * อัปเกรดโครงสร้างชีต Packing List (19 คอลัมน์) และ ตัดไม้ (15 คอลัมน์) แยกมิติ หนา, กว้าง, ยาว, และคิวบิก M³ อัตโนมัติ
 */
function upgradeAllSheetsToDimensions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const plSheet = ss.getSheetByName(SHEET_PACKING_LIST);
  if (!plSheet) {
    SpreadsheetApp.getUi().alert(`❌ ไม่พบแท็บ "${SHEET_PACKING_LIST}" ใน Google Sheet`);
    return;
  }

  // ========================================================
  // 1. อัปเกรดชีต "Packing List" (19 คอลัมน์)
  // ========================================================
  const plData = plSheet.getDataRange().getValues();
  const plHeadersOriginal = plData[0].map(h => String(h).toLowerCase());

  // ตรวจสอบตำแหน่งคอลัมน์เดิม
  let oldColPl = plHeadersOriginal.findIndex(h => h.includes("pl") || h.includes("packing no"));
  let oldColCtn = plHeadersOriginal.findIndex(h => h.includes("container") || h.includes("ตู้"));
  let oldColItem = plHeadersOriginal.findIndex(h => h.includes("item") || h.includes("part"));
  let oldColBdl = plHeadersOriginal.findIndex(h => h.includes("bdl") || h.includes("มัด"));
  let oldColDim = plHeadersOriginal.findIndex(h => h.includes("ขนาด") || h.includes("dim") || h.includes("desc"));
  let oldColExp = plHeadersOriginal.findIndex(h => h.includes("ยอดตาม pl") || h.includes("ตาม pl") || h.includes("quantity"));
  let oldColRec = plHeadersOriginal.findIndex(h => h.includes("รับเข้าแล้ว") || h.includes("รับแล้ว"));
  let oldColDate = plHeadersOriginal.findIndex(h => h.includes("date") || h.includes("วัน"));

  if (oldColPl === -1) oldColPl = 2;
  if (oldColCtn === -1) oldColCtn = 3;
  if (oldColItem === -1) oldColItem = 4;
  if (oldColBdl === -1) oldColBdl = 5;
  if (oldColDim === -1) oldColDim = 6;
  if (oldColExp === -1) oldColExp = 7;
  if (oldColRec === -1) oldColRec = 9;
  if (oldColDate === -1) oldColDate = 1;

  const newPlHeaders = [
    "ลำดับ", "วันที่", "เลขที่ PL (Packing No.)", "เลขตู้ (Container No.)", 
    "No. Item (Part Number)", "No. BDL (มัดที่)", "หนา (T - MM)", "กว้าง (W - MM)", 
    "ยาว (L - MM)", "ขนาดรวม / Description (MM)", "ยอดตาม PL (PCS)", "ปริมาตรตามตู้ (M³)", 
    "ยอดรับเข้าแล้ว (PCS)", "ยอดค้างรับในตู้ (PCS)", "สถานะวงจรไม้ (Lifecycle)", "อัปเดตล่าสุด", 
    "ยอดตัดสะสม (PCS)", "คงเหลือพร้อมใช้จริง (PCS)", "ปริมาตรพร้อมใช้จริง (M³)"
  ];

  const extractedPlRows = [];
  for (let r = 1; r < plData.length; r++) {
    const row = plData[r];
    if (!row[oldColPl] && !row[oldColItem]) continue;

    const dimStr = String(row[oldColDim] || "").trim();
    const dims = parseDimensionNumbers(dimStr);
    const exp = Number(row[oldColExp]) || 0;
    const rec = Number(row[oldColRec]) || 0;
    const dateVal = row[oldColDate] ? (row[oldColDate] instanceof Date ? Utilities.formatDate(row[oldColDate], "Asia/Bangkok", "yyyy-MM-dd") : String(row[oldColDate])) : "-";

    extractedPlRows.push({
      idx: r,
      date: dateVal,
      pl: String(row[oldColPl]).trim(),
      ctn: String(row[oldColCtn]).trim(),
      item: String(row[oldColItem]).trim(),
      bdl: String(row[oldColBdl]).trim(),
      thick: dims.thick,
      width: dims.width,
      length: dims.length,
      exp: exp,
      rec: rec
    });
  }

  plSheet.clear();
  plSheet.getRange(1, 1, 1, newPlHeaders.length).setValues([newPlHeaders])
         .setBackground("#0f172a").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  plSheet.setRowHeight(1, 36);

  // ตกแต่งแถบสีหัวตารางแยกตามกลุ่ม
  plSheet.getRange("G1:I1").setBackground("#1e3a8a").setFontColor("#ffffff"); // มิติไม้ (น้ำเงินเข้ม)
  plSheet.getRange("Q1:S1").setBackground("#065f46").setFontColor("#ffffff"); // สต็อกพร้อมใช้จริง (เขียวเข้ม)

  if (extractedPlRows.length > 0) {
    const numRows = extractedPlRows.length;
    const values = [];
    const formulas = [];

    for (let i = 0; i < numRows; i++) {
      const it = extractedPlRows[i];
      const r = i + 2;
      values.push([
        it.idx,
        it.date,
        it.pl,
        it.ctn,
        it.item,
        it.bdl,
        it.thick,
        it.width,
        it.length,
        "", // J: ขนาดรวม (Formula)
        it.exp,
        "", // L: ปริมาตรตู้ M3 (Formula)
        it.rec,
        "", // N: ยอดค้างรับ (Formula)
        "", // O: สถานะวงจรไม้ (Formula)
        "-", // P: อัปเดตล่าสุด
        "", // Q: ยอดตัดสะสม (Formula)
        "", // R: คงเหลือพร้อมใช้จริง (Formula)
        ""  // S: ปริมาตรคงเหลือ M3 (Formula)
      ]);
    }

    plSheet.getRange(2, 1, numRows, newPlHeaders.length).setValues(values);

    // ใส่สูตรคณิตศาสตร์และเงื่อนไขแบบ Dynamic
    const fJ = [], fL = [], fN = [], fO = [], fQ = [], fR = [], fS = [];
    for (let i = 0; i < numRows; i++) {
      const r = i + 2;
      fJ.push([`=IF(ISBLANK(G${r}), "", G${r} & " x " & H${r} & " x " & I${r} & " MM")`]);
      fL.push([`=IF(OR(ISBLANK(G${r}), ISBLANK(K${r})), "", ROUND((G${r} * H${r} * I${r} * K${r}) / 1000000000, 3))`]);
      fN.push([`=IF(ISBLANK(C${r}), "", MAX(0, K${r}-M${r}))`]);
      fO.push([`=IF(ISBLANK(C${r}), "", IF(M${r}=0, "⏳ ยังไม่รับ", IF(R${r}=0, "⚪ ตัดหมดแล้ว", IF(Q${r}>0, "🪵 กำลังตัดใช้", IF(M${r}=K${r}, "🟢 รับครบพร้อมใช้", IF(M${r}>K${r}, "⚠️ รับเกิน", "🟡 รับบางส่วน"))))))`]);
      fQ.push([`=IF(ISBLANK(C${r}), "", IF(OR(ISBLANK(F${r}), F${r}="-", F${r}=""), SUMIFS('ตัดไม้'!$K:$K, 'ตัดไม้'!$C:$C, C${r}, 'ตัดไม้'!$E:$E, E${r}), SUMIFS('ตัดไม้'!$K:$K, 'ตัดไม้'!$C:$C, C${r}, 'ตัดไม้'!$E:$E, E${r}, 'ตัดไม้'!$F:$F, F${r})))`]);
      fR.push([`=IF(ISBLANK(C${r}), "", MAX(0, M${r}-Q${r}))`]);
      fS.push([`=IF(OR(ISBLANK(G${r}), ISBLANK(R${r})), "", ROUND((G${r} * H${r} * I${r} * R${r}) / 1000000000, 3))`]);
    }

    plSheet.getRange(2, 10, numRows, 1).setFormulas(fJ).setHorizontalAlignment("left");
    plSheet.getRange(2, 12, numRows, 1).setFormulas(fL).setHorizontalAlignment("right").setNumberFormat("#,##0.000");
    plSheet.getRange(2, 14, numRows, 1).setFormulas(fN).setHorizontalAlignment("right").setNumberFormat("#,##0");
    plSheet.getRange(2, 15, numRows, 1).setFormulas(fO).setHorizontalAlignment("center").setFontWeight("bold");
    plSheet.getRange(2, 17, numRows, 1).setFormulas(fQ).setHorizontalAlignment("right").setNumberFormat("#,##0").setFontColor("#e11d48").setFontWeight("bold");
    plSheet.getRange(2, 18, numRows, 1).setFormulas(fR).setHorizontalAlignment("right").setNumberFormat("#,##0").setFontColor("#059669").setFontWeight("bold");
    plSheet.getRange(2, 19, numRows, 1).setFormulas(fS).setHorizontalAlignment("right").setNumberFormat("#,##0.000").setFontColor("#047857").setFontWeight("bold");

    // กำหนดการจัดวางและฟอร์แมตตัวเลข
    plSheet.getRange(2, 1, numRows, 1).setHorizontalAlignment("center");
    plSheet.getRange(2, 2, numRows, 1).setHorizontalAlignment("center");
    plSheet.getRange(2, 5, numRows, 2).setHorizontalAlignment("center");
    plSheet.getRange(2, 7, numRows, 3).setHorizontalAlignment("right").setNumberFormat("#,##0.#");
    plSheet.getRange(2, 11, numRows, 1).setHorizontalAlignment("right").setNumberFormat("#,##0");
    plSheet.getRange(2, 13, numRows, 1).setHorizontalAlignment("right").setNumberFormat("#,##0");
  }

  // ปรับขนาดคอลัมน์ Packing List
  plSheet.setColumnWidth(1, 45);   // ลำดับ
  plSheet.setColumnWidth(2, 95);   // วันที่
  plSheet.setColumnWidth(3, 160);  // PL
  plSheet.setColumnWidth(4, 180);  // Container
  plSheet.setColumnWidth(5, 110);  // Part
  plSheet.setColumnWidth(6, 65);   // มัด
  plSheet.setColumnWidth(7, 75);   // หนา
  plSheet.setColumnWidth(8, 80);   // กว้าง
  plSheet.setColumnWidth(9, 80);   // ยาว
  plSheet.setColumnWidth(10, 160); // ขนาดรวม
  plSheet.setColumnWidth(11, 110); // ยอด PL
  plSheet.setColumnWidth(12, 115); // ปริมาตรตู้ M3
  plSheet.setColumnWidth(13, 110); // รับแล้ว
  plSheet.setColumnWidth(14, 110); // ค้างรับ
  plSheet.setColumnWidth(15, 155); // สถานะวงจรไม้
  plSheet.setColumnWidth(16, 140); // อัปเดตล่าสุด
  plSheet.setColumnWidth(17, 120); // ตัดสะสม
  plSheet.setColumnWidth(18, 140); // คงเหลือจริง
  plSheet.setColumnWidth(19, 135); // ปริมาตรคงเหลือจริง M3

  plSheet.setFrozenRows(1);
  plSheet.setFrozenColumns(6);

  // ========================================================
  // 2. อัปเกรดชีต "ตัดไม้" (15 คอลัมน์)
  // ========================================================
  let cutSheet = ss.getSheetByName(SHEET_WOOD_CUTTING);
  if (cutSheet) {
    const cutData = cutSheet.getDataRange().getValues();
    const cutHeaders = [
      "ลำดับ", "วัน-เวลาที่ตัด (Timestamp)", "เลขที่ PL (Packing No.)", "เลขตู้ (Container No.)", 
      "No. Item (Part Number)", "No. BDL (มัดที่)", "หนา (T - MM)", "กว้าง (W - MM)", 
      "ยาว (L - MM)", "ขนาดรวม (MM)", "🔻 จำนวนที่ตัดออก (PCS)", "📦 ปริมาตรตัดออก (M³)", 
      "🪵 คงเหลือพร้อมใช้ในคลัง (PCS)", "📐 ปริมาตรคงเหลือในคลัง (M³)", "ผู้เบิก / หมายเหตุ"
    ];

    const extractedCutRows = [];
    for (let r = 1; r < cutData.length; r++) {
      const row = cutData[r];
      if (!row[0] && !row[1]) continue;

      let dimStr = String(row[6] || "").trim(); // Col G ในแบบเดิม
      let cutQty = Number(row[7]) || 0;
      let availQty = Number(row[9]) || 0;
      let note = String(row[10] || "-").trim();

      // ถ้าเป็นชีตที่เคยมีหลายคอลัมน์แล้ว
      if (cutData[0].length >= 14) {
        dimStr = String(row[9] || "").trim();
        cutQty = Number(row[10]) || 0;
        availQty = Number(row[12]) || 0;
        note = String(row[14] || "-").trim();
      }

      const dims = parseDimensionNumbers(dimStr);
      const cutVol = Math.round((dims.thick * dims.width * dims.length * cutQty) / 1000000) / 1000;
      const availVol = Math.round((dims.thick * dims.width * dims.length * availQty) / 1000000) / 1000;

      extractedCutRows.push([
        r,
        row[1] instanceof Date ? Utilities.formatDate(row[1], "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss") : String(row[1]),
        String(row[2]).trim(),
        String(row[3]).trim(),
        String(row[4]).trim(),
        String(row[5]).trim(),
        dims.thick,
        dims.width,
        dims.length,
        dimStr,
        cutQty,
        cutVol,
        availQty,
        availVol,
        note
      ]);
    }

    cutSheet.clear();
    cutSheet.getRange(1, 1, 1, cutHeaders.length).setValues([cutHeaders])
            .setBackground("#881337").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
    cutSheet.setRowHeight(1, 35);

    if (extractedCutRows.length > 0) {
      cutSheet.getRange(2, 1, extractedCutRows.length, cutHeaders.length).setValues(extractedCutRows);
      
      cutSheet.getRange(2, 1, extractedCutRows.length, 1).setHorizontalAlignment("center");
      cutSheet.getRange(2, 2, extractedCutRows.length, 1).setHorizontalAlignment("center");
      cutSheet.getRange(2, 5, extractedCutRows.length, 2).setHorizontalAlignment("center");
      cutSheet.getRange(2, 7, extractedCutRows.length, 3).setHorizontalAlignment("right").setNumberFormat("#,##0.#");
      cutSheet.getRange(2, 11, extractedCutRows.length, 1).setHorizontalAlignment("right").setFontColor("#e11d48").setFontWeight("bold").setNumberFormat("#,##0");
      cutSheet.getRange(2, 12, extractedCutRows.length, 1).setHorizontalAlignment("right").setFontColor("#be123c").setFontWeight("bold").setNumberFormat("#,##0.000");
      cutSheet.getRange(2, 13, extractedCutRows.length, 1).setHorizontalAlignment("right").setFontColor("#059669").setFontWeight("bold").setNumberFormat("#,##0");
      cutSheet.getRange(2, 14, extractedCutRows.length, 1).setHorizontalAlignment("right").setFontColor("#047857").setFontWeight("bold").setNumberFormat("#,##0.000");
    }

    cutSheet.setFrozenRows(1);
    cutSheet.autoResizeColumns(1, cutHeaders.length);
  }

  // ========================================================
  // 3. อัปเดตแดชบอร์ดให้ตรงกับโครงสร้างใหม่
  // ========================================================
  buildDashboardSheet();

  SpreadsheetApp.getUi().alert("✅ อัปเกรดแยกมิติ (หนา / กว้าง / ยาว / คิวบิก M³) สำเร็จสมบูรณ์แบบทั้ง 2 ชีตแล้วครับ!\n• คำนวณปริมาตรคิวบิกอัตโนมัติ 100%\n• อัปเดตหน้า Dashboard เรียบร้อยแล้ว!");
}

/**
 * สร้างแท็บ "ตัดไม้" อัตโนมัติ โดยไม่กระทบข้อมูลเดิม (15 คอลัมน์)
 */
function ensureCuttingSheetExists() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let cutSheet = ss.getSheetByName(SHEET_WOOD_CUTTING);
  if (!cutSheet) {
    cutSheet = ss.insertSheet(SHEET_WOOD_CUTTING);
    const headers = [
      "ลำดับ", "วัน-เวลาที่ตัด (Timestamp)", "เลขที่ PL (Packing No.)", "เลขตู้ (Container No.)", 
      "No. Item (Part Number)", "No. BDL (มัดที่)", "หนา (T - MM)", "กว้าง (W - MM)", 
      "ยาว (L - MM)", "ขนาดรวม (MM)", "🔻 จำนวนที่ตัดออก (PCS)", "📦 ปริมาตรตัดออก (M³)", 
      "🪵 คงเหลือพร้อมใช้ในคลัง (PCS)", "📐 ปริมาตรคงเหลือในคลัง (M³)", "ผู้เบิก / หมายเหตุ"
    ];
    cutSheet.appendRow(headers);
    cutSheet.getRange(1, 1, 1, headers.length)
            .setFontWeight("bold")
            .setBackground("#881337")
            .setFontColor("#ffffff")
            .setHorizontalAlignment("center");
    cutSheet.setFrozenRows(1);
    cutSheet.autoResizeColumns(1, headers.length);
  }
  return cutSheet;
}

/**
 * สร้างหน้า Dashboard สรุปภาพรวมคลังไม้ระดับบริหารและปฏิบัติการ
 */
function buildDashboardSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dash = ss.getSheetByName(SHEET_DASHBOARD);
  if (!dash) {
    dash = ss.insertSheet(SHEET_DASHBOARD, 0); // แทรกเป็นแท็บแรกสุด
  }
  
  dash.setTabColor("#059669"); // สีเขียวมรกต
  dash.clear();
  dash.setHiddenGridlines(false);
  
  // 1. Header Banner (A1:K2)
  dash.getRange("A1:K1").merge()
      .setValue("🪵 DASHBOARD สรุปภาพรวมคลังไม้ & การตัดไม้ (WOOD INVENTORY & CUTTING ANALYTICS)")
      .setFontSize(15)
      .setFontWeight("bold")
      .setFontColor("#ffffff")
      .setBackground("#0f172a")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
  dash.setRowHeight(1, 45);

  dash.getRange("A2:K2").merge()
      .setValue('="📊 ข้อมูลเชื่อมต่อระบบอัตโนมัติแบบ Real-time | อัปเดตล่าสุด: " & TEXT(NOW(), "yyyy-MM-dd HH:mm:ss")')
      .setFontSize(10)
      .setFontColor("#94a3b8")
      .setBackground("#1e293b")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
  dash.setRowHeight(2, 25);
  dash.setRowHeight(3, 15); // Spacer

  // 2. KPI Summary Cards (Row 4 to Row 6)
  // Card 1: B4:C6 (ไม้พร้อมใช้ในคลัง)
  dash.getRange("B4:C4").merge().setValue("🪵 ไม้พร้อมใช้ในคลัง (PCS)").setBackground("#059669").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  dash.getRange("B5:C5").merge().setFormula("=SUM('Packing List'!M2:M) - SUM('ตัดไม้'!K2:K)").setBackground("#ecfdf5").setFontColor("#065f46").setFontSize(20).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setNumberFormat("#,##0");
  dash.getRange("B6:C6").merge().setFormula('="ปริมาตรพร้อมใช้: " & TEXT(SUM(\'Packing List\'!S2:S), "#,##0.00") & " M³"').setBackground("#ecfdf5").setFontColor("#047857").setFontSize(9).setHorizontalAlignment("center");

  // Card 2: D4:E6 (ยอดตาม PL ทั้งหมด)
  dash.getRange("D4:E4").merge().setValue("📦 ยอดตาม Packing List (PCS)").setBackground("#1d4ed8").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  dash.getRange("D5:E5").merge().setFormula("=SUM('Packing List'!K2:K)").setBackground("#eff6ff").setFontColor("#1e40af").setFontSize(20).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setNumberFormat("#,##0");
  dash.getRange("D6:E6").merge().setFormula('="ปริมาตรรวม: " & TEXT(SUM(\'Packing List\'!L2:L), "#,##0.00") & " M³"').setBackground("#eff6ff").setFontColor("#1d4ed8").setFontSize(9).setHorizontalAlignment("center");

  // Card 3: F4:G6 (รับเข้าคลังแล้ว)
  dash.getRange("F4:G4").merge().setValue("📥 รับเข้าคลังแล้ว (PCS)").setBackground("#0d9488").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  dash.getRange("F5:G5").merge().setFormula("=SUM('Packing List'!M2:M)").setBackground("#f0fdfa").setFontColor("#115e59").setFontSize(20).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setNumberFormat("#,##0");
  dash.getRange("F6:G6").merge().setFormula('="คิดเป็น: " & TEXT(IF(SUM(\'Packing List\'!K2:K)>0, SUM(\'Packing List\'!M2:M)/SUM(\'Packing List\'!K2:K), 0), "0.0%") & " ของตู้"').setBackground("#f0fdfa").setFontColor("#0f766e").setFontSize(9).setHorizontalAlignment("center");

  // Card 4: H4:I6 (ค้างรับเข้าตู้)
  dash.getRange("H4:I4").merge().setValue("⏳ ยอดค้างรับเข้าตู้ (PCS)").setBackground("#d97706").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  dash.getRange("H5:I5").merge().setFormula("=SUM('Packing List'!K2:K) - SUM('Packing List'!M2:M)").setBackground("#fffbeb").setFontColor("#92400e").setFontSize(20).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setNumberFormat("#,##0");
  dash.getRange("H6:I6").merge().setFormula('="สถานะ: " & IF(H5=0, "✅ รับครบแล้ว", "รอรับอีก " & TEXT(H5, "#,##0") & " ชิ้น")').setBackground("#fffbeb").setFontColor("#b45309").setFontSize(9).setHorizontalAlignment("center");

  // Card 5: J4:K6 (ตัดไม้ออกสะสม)
  dash.getRange("J4:K4").merge().setValue("✂️ ยอดตัดไม้ออกสะสม (PCS)").setBackground("#e11d48").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  dash.getRange("J5:K5").merge().setFormula("=SUM('ตัดไม้'!K2:K)").setBackground("#fff1f2").setFontColor("#9f1239").setFontSize(20).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setNumberFormat("#,##0");
  dash.getRange("J6:K6").merge().setFormula('="ปริมาตรที่ตัด: " & TEXT(SUM(\'ตัดไม้\'!L2:L), "#,##0.00") & " M³"').setBackground("#fff1f2").setFontColor("#be123c").setFontSize(9).setHorizontalAlignment("center");

  dash.setRowHeight(4, 25);
  dash.setRowHeight(5, 40);
  dash.setRowHeight(6, 22);
  dash.setRowHeight(7, 15); // Spacer

  // 3. Section 1: ตารางสถานะรายตู้ / Invoice Lifecycle
  dash.getRange("A8:K8").merge().setValue("📋 1. สรุปสถานะตามรอบตู้ / INVOICE LIFECYCLE SUMMARY").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold").setFontSize(11);
  dash.setRowHeight(8, 28);

  const invHeaders = [
    "ลำดับ", "เลขที่ PL / Invoice", "เลขตู้ (Container No.)", "วันที่เอกสาร", 
    "ยอดตาม PL (PCS)", "ปริมาตร (M³)", "รับเข้าแล้ว (PCS)", "ค้างรับ (PCS)", 
    "ตัดออก (PCS)", "คงเหลือพร้อมใช้ (PCS)", "สถานะตู้"
  ];
  dash.getRange(9, 1, 1, invHeaders.length).setValues([invHeaders]).setBackground("#334155").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  dash.setRowHeight(9, 26);

  // Row 10 to 14: Dynamic Formula rows for Invoices (รองรับหลาย Invoice อัตโนมัติ)
  dash.getRange("B10").setFormula("=UNIQUE(FILTER('Packing List'!C2:C, 'Packing List'!C2:C<>\"\"))").setFontWeight("bold").setHorizontalAlignment("left");
  
  for (let r = 10; r <= 14; r++) {
    dash.getRange(`A${r}`).setFormula(`=IF(ISBLANK(B${r}), "", ${r - 9})`).setHorizontalAlignment("center");
    dash.getRange(`C${r}`).setFormula(`=IF(ISBLANK(B${r}), "", XLOOKUP(B${r}, 'Packing List'!C:C, 'Packing List'!D:D, "-"))`).setHorizontalAlignment("left");
    dash.getRange(`D${r}`).setFormula(`=IF(ISBLANK(B${r}), "", TEXT(XLOOKUP(B${r}, 'Packing List'!C:C, 'Packing List'!B:B, "-"), "yyyy-MM-dd"))`).setHorizontalAlignment("center");
    dash.getRange(`E${r}`).setFormula(`=IF(ISBLANK(B${r}), "", SUMIFS('Packing List'!K:K, 'Packing List'!C:C, B${r}))`).setNumberFormat("#,##0").setHorizontalAlignment("right");
    dash.getRange(`F${r}`).setFormula(`=IF(ISBLANK(B${r}), "", SUMIFS('Packing List'!L:L, 'Packing List'!C:C, B${r}))`).setNumberFormat("#,##0.00").setHorizontalAlignment("right");
    dash.getRange(`G${r}`).setFormula(`=IF(ISBLANK(B${r}), "", SUMIFS('Packing List'!M:M, 'Packing List'!C:C, B${r}))`).setNumberFormat("#,##0").setHorizontalAlignment("right");
    dash.getRange(`H${r}`).setFormula(`=IF(ISBLANK(B${r}), "", E${r}-G${r})`).setNumberFormat("#,##0").setHorizontalAlignment("right");
    dash.getRange(`I${r}`).setFormula(`=IF(ISBLANK(B${r}), "", SUMIFS('ตัดไม้'!K:K, 'ตัดไม้'!C:C, B${r}))`).setNumberFormat("#,##0").setHorizontalAlignment("right");
    dash.getRange(`J${r}`).setFormula(`=IF(ISBLANK(B${r}), "", G${r}-I${r})`).setNumberFormat("#,##0").setFontWeight("bold").setFontColor("#059669").setHorizontalAlignment("right");
    dash.getRange(`K${r}`).setFormula(`=IF(ISBLANK(B${r}), "", IF(J${r}=0, "⚪ ตัดหมดเกลี้ยง (ปิดงบ)", IF(H${r}=0, "🟢 รับครบ (กำลังตัดใช้)", "🟡 กำลังรับเข้า & ตัดใช้")))`).setHorizontalAlignment("center").setFontWeight("bold");
    dash.getRange(`A${r}:K${r}`).setBackground(r % 2 === 0 ? "#f8fafc" : "#ffffff");
    dash.setRowHeight(r, 25);
  }

  dash.setRowHeight(15, 15); // Spacer

  // 4. Section 2 & 3: อายุวัตถุดิบ & สรุปตามความยาวไม้ (Length & Volume)
  dash.getRange("A16:E16").merge().setValue("⏳ 2. วิเคราะห์อายุไม้ในคลัง (AGING & SLOW-MOVING)").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold").setFontSize(11);
  dash.getRange("G16:K16").merge().setValue("📏 3. สรุปปริมาตรแยกตามความยาว (LENGTH & VOLUME SUMMARY)").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold").setFontSize(11);
  dash.setRowHeight(16, 28);

  const agingHeaders = ["ช่วงอายุไม้", "เกณฑ์วัน", "จำนวนมัด", "สต็อกคงเหลือ (PCS)", "สถานะการจัดการ"];
  dash.getRange(17, 1, 1, agingHeaders.length).setValues([agingHeaders]).setBackground("#475569").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");

  dash.getRange("A18:E18").setValues([["🟢 ไม้ล็อตใหม่ (Fresh)", "< 30 วัน", "=COUNTIFS('Packing List'!B2:B, \">=\" & (TODAY()-30), 'Packing List'!M2:M, \">0\")", "=SUMIFS('Packing List'!M2:M, 'Packing List'!B2:B, \">=\" & (TODAY()-30)) - SUM('ตัดไม้'!K2:K)", "ใช้งานได้ตามปกติ"]]).setBackground("#f0fdf4").setFontColor("#166534");
  dash.getRange("A19:E19").setValues([["🟡 ไม้คลังปานกลาง (Medium)", "31 - 60 วัน", "=COUNTIFS('Packing List'!B2:B, \">=\" & (TODAY()-60), 'Packing List'!B2:B, \"<\" & (TODAY()-30), 'Packing List'!M2:M, \">0\")", "=SUMIFS('Packing List'!M2:M, 'Packing List'!B2:B, \">=\" & (TODAY()-60), 'Packing List'!B2:B, \"<\" & (TODAY()-30))", "ควรเร่งนำไปตัดตามคิว FIFO"]]).setBackground("#fffbeb").setFontColor("#854d0e");
  dash.getRange("A20:E20").setValues([["🔴 ไม้ค้างนาน (Slow-Moving)", "> 60 วัน", "=COUNTIFS('Packing List'!B2:B, \"<\" & (TODAY()-60), 'Packing List'!M2:M, \">0\")", "=SUMIFS('Packing List'!M2:M, 'Packing List'!B2:B, \"<\" & (TODAY()-60))", "⚠️ ตรวจสอบสภาพไม้/เร่งระบาย"]]).setBackground("#fef2f2").setFontColor("#991b1b");
  
  dash.getRange("C18:D20").setNumberFormat("#,##0").setHorizontalAlignment("right");
  dash.getRange("A18:B20").setHorizontalAlignment("center");
  dash.getRange("E18:E20").setHorizontalAlignment("left");

  // Section 3: Length & Volume Summary (G17:K21)
  const lenHeaders = ["กลุ่มความยาวไม้", "ช่วงขนาด (MM)", "จำนวนมัดรวม", "ปริมาตรตามตู้ (M³)", "สัดส่วน %"];
  dash.getRange(17, 7, 1, lenHeaders.length).setValues([lenHeaders]).setBackground("#475569").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");

  dash.getRange("G18:K18").setValues([["ความยาวมาตรฐาน", "500 - 600 MM", "=COUNTIFS('Packing List'!I2:I, \">=500\", 'Packing List'!I2:I, \"<=600\")", "=SUMIFS('Packing List'!L2:L, 'Packing List'!I2:I, \">=500\", 'Packing List'!I2:I, \"<=600\")", "=J18/J21"]]).setBackground("#f8fafc");
  dash.getRange("G19:K19").setValues([["ความยาวสั้น", "< 500 MM", "=COUNTIFS('Packing List'!I2:I, \"<500\", 'Packing List'!I2:I, \">0\")", "=SUMIFS('Packing List'!L2:L, 'Packing List'!I2:I, \"<500\", 'Packing List'!I2:I, \">0\")", "=J19/J21"]]).setBackground("#f8fafc");
  dash.getRange("G20:K20").setValues([["ความยาวพิเศษ (ไม้ยาว)", "> 600 MM", "=I21-I18-I19", "=J21-J18-J19", "=J20/J21"]]).setBackground("#f8fafc");
  dash.getRange("G21:K21").setValues([["รวมทั้งหมด", "ทุกความยาว", "=COUNTA('Packing List'!F2:F)", "=SUM('Packing List'!L2:L)", "100.0%"]]).setBackground("#e2e8f0").setFontWeight("bold");

  dash.getRange("I18:I21").setNumberFormat("#,##0").setHorizontalAlignment("right");
  dash.getRange("J18:J21").setNumberFormat("#,##0.00").setHorizontalAlignment("right");
  dash.getRange("K18:K21").setNumberFormat("0.0%").setHorizontalAlignment("right");
  dash.getRange("G18:H21").setHorizontalAlignment("left");
  dash.getRange("H18:H21").setHorizontalAlignment("center");

  dash.setRowHeight(17, 26);
  dash.setRowHeight(18, 24);
  dash.setRowHeight(19, 24);
  dash.setRowHeight(20, 24);
  dash.setRowHeight(21, 24);
  dash.setRowHeight(22, 15); // Spacer

  // 5. Section 4: วิเคราะห์ความเร็วการใช้ไม้ & อัตราการตัด (CUTTING VELOCITY & BURN RATE ANALYTICS)
  dash.getRange("A23:E23").merge().setValue("⚡ 4.1 ความเร็วการตัดไม้ตามช่วงเวลา (CUTTING VELOCITY)").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold").setFontSize(11);
  dash.getRange("G23:K23").merge().setValue("🔥 4.2 อัตราการใช้ไม้ & สต็อกคงเหลือ (BURN RATE & DAYS OF INVENTORY)").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold").setFontSize(11);
  dash.setRowHeight(23, 28);

  const velHeaders = ["ช่วงเวลาการตัดไม้", "เกณฑ์การวัด", "จำนวนครั้งที่เบิก", "ยอดตัดสะสม (PCS)", "สถานะอัตราการใช้"];
  dash.getRange(24, 1, 1, velHeaders.length).setValues([velHeaders]).setBackground("#334155").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");

  dash.getRange("A25:E25").setValues([["⚡ ตัดสะสมวันนี้ (Today)", "วันนี้", "=COUNTIF('ตัดไม้'!B2:B, \"*\" & TEXT(TODAY(), \"yyyy-MM-dd\") & \"*\")", "=SUMIF('ตัดไม้'!B2:B, \"*\" & TEXT(TODAY(), \"yyyy-MM-dd\") & \"*\", 'ตัดไม้'!K2:K)", "อัตราตัดรายวัน"]]).setBackground("#f8fafc");
  dash.getRange("A26:E26").setValues([["📅 ตัดสะสม 7 วันล่าสุด", "ย้อนหลัง 7 วัน", "=COUNTIFS('ตัดไม้'!B2:B, \">=\" & TEXT(TODAY()-7, \"yyyy-MM-dd\"))", "=SUMIFS('ตัดไม้'!K2:K, 'ตัดไม้'!B2:B, \">=\" & TEXT(TODAY()-7, \"yyyy-MM-dd\"))", "ยอดเฉลี่ยสัปดาห์"]]).setBackground("#f8fafc");
  dash.getRange("A27:E27").setValues([["📊 ตัดสะสม 30 วันล่าสุด", "ย้อนหลัง 30 วัน", "=COUNTIFS('ตัดไม้'!B2:B, \">=\" & TEXT(TODAY()-30, \"yyyy-MM-dd\"))", "=SUMIFS('ตัดไม้'!K2:K, 'ตัดไม้'!B2:B, \">=\" & TEXT(TODAY()-30, \"yyyy-MM-dd\"))", "ยอดเฉลี่ยรายเดือน"]]).setBackground("#f8fafc");
  dash.getRange("A28:E28").setValues([["📈 ตัดสะสมรวมทั้งหมด", "ตั้งแต่เปิดระบบ", "=COUNTA('ตัดไม้'!A2:A)", "=SUM('ตัดไม้'!K2:K)", "ตัดรวมทั้งสิ้น"]]).setBackground("#e2e8f0").setFontWeight("bold");

  dash.getRange("C25:D28").setNumberFormat("#,##0").setHorizontalAlignment("right");
  dash.getRange("A25:B28").setHorizontalAlignment("left");
  dash.getRange("E25:E28").setHorizontalAlignment("center");

  // Section 4.2: Burn Rate & Days of Inventory
  const burnHeaders = ["ดัชนีชี้วัดความเร็ว (KPI)", "ค่าตัวเลข", "หน่วยนับ", "เกณฑ์ประเมินสถานะ", "ข้อแนะนำการจัดซื้อ"];
  dash.getRange(24, 7, 1, burnHeaders.length).setValues([burnHeaders]).setBackground("#334155").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");

  dash.getRange("G25:K25").setValues([["🔥 อัตราตัดเฉลี่ยต่อวัน (Avg Daily)", "=IFERROR(ROUND(SUM('ตัดไม้'!K2:K)/MAX(1, COUNTA(UNIQUE(FILTER(LEFT('ตัดไม้'!B2:B, 10), 'ตัดไม้'!B2:B<>\"\")))), 0), 0)", "PCS / วัน", "กำลังผลิตปกติ", "ใช้คำนวณรอบตู้ถัดไป"]]).setBackground("#f8fafc");
  dash.getRange("G26:K26").setValues([["🪵 สต็อกไม้พร้อมใช้ในคลังตอนนี้", "=SUM('Packing List'!M2:M) - SUM('ตัดไม้'!K2:K)", "PCS", "ไม้พร้อมเบิกทันที", "พร้อมจ่ายงานฝ่ายผลิต"]]).setBackground("#f8fafc");
  dash.getRange("G27:K27").setValues([["⏱️ ประมาณการวันที่สต็อกจะพอใช้", "=IF(H25>0, ROUND(H26/H25, 0), \"พร้อมใช้ต่อเนื่อง\")", "วัน", "🟢 สต็อกปลอดภัย", "สั่งตู้ถัดไปล่วงหน้า 30 วัน"]]).setBackground("#f0fdf4").setFontColor("#166534").setFontWeight("bold");
  dash.getRange("G28:K28").setValues([["🎯 สัดส่วนการตัดเทียบกับไม้ที่รับ", "=IF(SUM('Packing List'!M2:M)>0, SUM('ตัดไม้'!K2:K)/SUM('Packing List'!M2:M), 0)", "%", "ความคืบหน้าตัดไม้", "อัตราการระบายไม้ในคลัง"]]).setBackground("#e2e8f0").setFontWeight("bold");

  dash.getRange("H25:H26").setNumberFormat("#,##0").setHorizontalAlignment("right").setFontWeight("bold");
  dash.getRange("H27").setHorizontalAlignment("right").setFontWeight("bold");
  dash.getRange("H28").setNumberFormat("0.0%").setHorizontalAlignment("right").setFontWeight("bold");
  dash.getRange("I25:J28").setHorizontalAlignment("center");
  dash.getRange("G25:G28").setHorizontalAlignment("left");
  dash.getRange("K25:K28").setHorizontalAlignment("left");

  dash.setRowHeight(24, 26);
  dash.setRowHeight(25, 24);
  dash.setRowHeight(26, 24);
  dash.setRowHeight(27, 24);
  dash.setRowHeight(28, 24);

  // Adjust Column Widths
  dash.setColumnWidth(1, 50);  // ลำดับ
  dash.setColumnWidth(2, 170); // PL
  dash.setColumnWidth(3, 190); // Container
  dash.setColumnWidth(4, 110); // Date
  dash.setColumnWidth(5, 120); // Part / Qty
  dash.setColumnWidth(6, 70);  // BDL
  dash.setColumnWidth(7, 180); // Dim
  dash.setColumnWidth(8, 120); // Cut Qty
  dash.setColumnWidth(9, 130); // Avail
  dash.setColumnWidth(10, 180); // Note
  dash.setColumnWidth(11, 140); // Status

  return dash;
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

  const headers = data[0].map(h => String(h).toLowerCase());
  let colCutQty = headers.findIndex(h => h.includes("จำนวนที่ตัด") || h.includes("ตัดออก") || h.includes("cut"));
  if (colCutQty === -1) colCutQty = (data[0].length >= 14) ? 10 : 7;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const pl = String(row[2] || "").trim().toLowerCase();
    const ctn = String(row[3] || "").trim().toLowerCase();
    const item = String(row[4] || "").trim().toLowerCase();
    const bdl = String(row[5] || "").trim().toLowerCase();
    const cutQty = Number(row[colCutQty]) || 0;

    const key = `${pl}|${ctn}|${item}|${bdl}`;
    cutMap[key] = (cutMap[key] || 0) + cutQty;

    // เก็บ fallback key สำหรับไม้ที่ไม่มีมัด
    const noBdlKey = `${pl}|${item}`;
    cutMap[noBdlKey] = (cutMap[noBdlKey] || 0) + cutQty;

    // เก็บ fallback key แบบสั้นด้วย
    const shortKey = `${item}|${bdl}`;
    cutMap[shortKey] = (cutMap[shortKey] || 0) + cutQty;

    const itemOnlyKey = `${item}`;
    cutMap[itemOnlyKey] = (cutMap[itemOnlyKey] || 0) + cutQty;
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
    let colThick = headers.findIndex(h => h.includes("หนา") || h.includes("thick"));
    let colWidth = headers.findIndex(h => h.includes("กว้าง") || h.includes("width"));
    let colLength = headers.findIndex(h => h.includes("ยาว") || h.includes("length"));
    let colDim = headers.findIndex(h => h.includes("ขนาด") || h.includes("dim") || h.includes("desc"));
    let colExp = headers.findIndex(h => h.includes("ยอดตาม pl") || h.includes("ตาม pl") || h.includes("quantity"));
    let colVolExp = headers.findIndex(h => h.includes("ปริมาตรตามตู้") || h.includes("vol"));
    let colRec = headers.findIndex(h => h.includes("รับเข้าแล้ว") || h.includes("รับแล้ว"));
    let colBal = headers.findIndex(h => h.includes("ค้างรับ") || h.includes("คงเหลือในตู้") || h.includes("bal"));
    let colStatus = headers.findIndex(h => h.includes("สถานะ"));
    let colUpdated = headers.findIndex(h => h.includes("อัปเดต") || h.includes("update"));
    let colCut = headers.findIndex(h => h.includes("ตัดสะสม") || h.includes("ตัดแล้ว"));
    let colAvail = headers.findIndex(h => h.includes("คงเหลือพร้อมใช้") || h.includes("พร้อมใช้จริง"));
    let colVolAvail = headers.findIndex(h => h.includes("ปริมาตรพร้อมใช้"));

    if (colPl === -1) colPl = 2;
    if (colCtn === -1) colCtn = 3;
    if (colItem === -1) colItem = 4;
    if (colBdl === -1) colBdl = 5;
    if (colDim === -1) colDim = 9; // Col J in 19-col, or Col G in 15-col
    if (colExp === -1) colExp = 10;
    if (colRec === -1) colRec = 12;
    if (colBal === -1) colBal = 13;
    if (colStatus === -1) colStatus = 14;

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
      let totalVolume = 0;
      let totalAvailVolume = 0;
      let completedCount = 0;
      let pendingCount = 0;
      let excessCount = 0;
      let targetContainerName = "";
      let targetPlName = "";

      const normalize = (s) => String(s || "").toLowerCase().replace(/[\s\-_]/g, "");
      const targetInvoiceClean = payload.invoice ? normalize(payload.invoice) : (payload.container ? normalize(payload.container) : "");

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const ctn = String(row[colCtn] || "").trim();
        const pl = String(row[colPl] || "").trim();
        const item = String(row[colItem] || "").trim();
        const bdl = String(row[colBdl] || "").trim();

        const matchInvoice = targetInvoiceClean
          ? matchInvoiceFlexible(pl, ctn, targetInvoiceClean)
          : (pl === activeInfo.activePl || ctn === activeInfo.activeContainer);

        if (matchInvoice) {
          if (!targetContainerName) {
            targetContainerName = ctn || "คลังในประเทศ";
            targetPlName = pl;
          }
          const exp = Number(row[colExp]) || 0;
          const rec = Number(row[colRec]) || 0;
          const cut = cutMap[`${pl.toLowerCase()}|${ctn.toLowerCase()}|${item.toLowerCase()}|${bdl.toLowerCase()}`] || cutMap[`${item.toLowerCase()}|${bdl.toLowerCase()}`] || 0;

          totalExpected += exp;
          totalReceived += rec;
          totalCut += cut;

          const dimStr = String(row[colDim] || "");
          const dims = parseDimensionNumbers(dimStr);
          const vol = (dims.thick * dims.width * dims.length * exp) / 1000000000;
          const availVol = (dims.thick * dims.width * dims.length * Math.max(0, rec - cut)) / 1000000000;
          totalVolume += vol;
          totalAvailVolume += availVol;

          if (rec > exp) excessCount++;
          else if (rec === exp && exp > 0) completedCount++;
          else pendingCount++;
        }
      }

      const availableInWarehouse = totalReceived - totalCut;

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        container: targetContainerName || activeInfo.activeContainer || "คลังในประเทศ",
        plNo: targetPlName || activeInfo.activePl,
        totalExpected: totalExpected,
        totalReceived: totalReceived,
        totalBalance: totalExpected - totalReceived,
        totalCut: totalCut,
        availableStock: availableInWarehouse,
        totalVolumeM3: Math.round(totalVolume * 1000) / 1000,
        availVolumeM3: Math.round(totalAvailVolume * 1000) / 1000,
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
      const normalize = (s) => String(s || "").toLowerCase().replace(/[\s\-_]/g, "");
      const targetInvoiceClean = payload.invoice ? normalize(payload.invoice) : "";
      const results = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const pl = String(row[colPl] || "").trim();
        const ctn = String(row[colCtn] || "").trim();
        const itemNo = String(row[colItem] || "").trim();
        const bdlNo = String(row[colBdl] || "").trim();
        const dimStr = String(row[colDim] || "");

        const matchInvoice = !targetInvoiceClean || matchInvoiceFlexible(pl, ctn, targetInvoiceClean);
        const matchQuery = matchItemFlexible(itemNo, bdlNo, dimStr, query, cleanQuery);

        if (matchInvoice && matchQuery) {
          const exp = Number(row[colExp]) || 0;
          const rec = Number(row[colRec]) || 0;
          const bal = exp - rec;
          const cut = cutMap[`${pl.toLowerCase()}|${ctn.toLowerCase()}|${itemNo.toLowerCase()}|${bdlNo.toLowerCase()}`] || cutMap[`${itemNo.toLowerCase()}|${bdlNo.toLowerCase()}`] || 0;
          const avail = rec - cut;

          results.push({
            rowIdx: i + 1,
            plNo: row[colPl],
            container: row[colCtn] || "-",
            item: row[colItem],
            bdl: row[colBdl] || "-",
            dim: dimStr,
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

      const normalize = (s) => String(s || "").toLowerCase().replace(/[\s\-_]/g, "");
      const targetInvoiceClean = payload.invoice ? normalize(payload.invoice) : (payload.container ? normalize(payload.container) : "");

      const matchedCandidates = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const pl = String(row[colPl] || "").trim();
        const ctn = String(row[colCtn] || "").trim();
        const itemNo = String(row[colItem] || "").trim();
        const bdlNo = String(row[colBdl] || "").trim();
        const dimStr = String(row[colDim] || "");

        const matchInvoice = targetInvoiceClean 
          ? matchInvoiceFlexible(pl, ctn, targetInvoiceClean)
          : (pl === activeInfo.activePl || ctn === activeInfo.activeContainer);

        const matchItem = matchItemFlexible(itemNo, bdlNo, dimStr, query, cleanQuery);

        if (matchInvoice && matchItem) {
          matchedCandidates.push({
            rowIdx: i + 1,
            plNo: row[colPl],
            container: row[colCtn] || "-",
            item: row[colItem],
            bdl: row[colBdl] || "-",
            dim: dimStr,
            expQty: Number(row[colExp]),
            currentRec: Number(row[colRec])
          });
        }
      }

      if (matchedCandidates.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: `ไม่พบรายการ: ${payload.query} ในเอกสารที่ระบุ` })).setMimeType(ContentService.MimeType.JSON);
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

      const normalize = (s) => String(s || "").toLowerCase().replace(/[\s\-_]/g, "");
      const targetInvoiceClean = payload.invoice ? normalize(payload.invoice) : "";

      const matched = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const pl = String(row[colPl] || "").trim();
        const ctn = String(row[colCtn] || "").trim();
        const itemNo = String(row[colItem] || "").trim();
        const bdlNo = String(row[colBdl] || "").trim();
        const dimStr = String(row[colDim] || "");

        const matchInvoice = !targetInvoiceClean || matchInvoiceFlexible(pl, ctn, targetInvoiceClean);
        const matchItem = matchItemFlexible(itemNo, bdlNo, dimStr, query, cleanQuery);

        if (matchInvoice && matchItem) {
          const rec = Number(row[colRec]) || 0;
          const currentCut = cutMap[`${pl.toLowerCase()}|${ctn.toLowerCase()}|${itemNo.toLowerCase()}|${bdlNo.toLowerCase()}`] || cutMap[`${itemNo.toLowerCase()}|${bdlNo.toLowerCase()}`] || 0;
          const avail = rec - currentCut;

          matched.push({
            plNo: pl,
            container: ctn || "-",
            item: itemNo,
            bdl: bdlNo || "-",
            dim: dimStr,
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

        const dims = parseDimensionNumbers(cand.dim);
        const thick = dims.thick;
        const width = dims.width;
        const length = dims.length;
        const cutVol = Math.round((thick * width * length * deductFromThis) / 1000000) / 1000;
        const availVol = Math.round((thick * width * length * newAvail) / 1000000) / 1000;

        // บันทึกลงแท็บ "ตัดไม้" (15 คอลัมน์)
        cutSheet.appendRow([
          nextRowNo - 1,
          nowStr,
          cand.plNo,
          cand.container,
          cand.item,
          cand.bdl,
          thick,
          width,
          length,
          cand.dim,
          deductFromThis,
          cutVol,
          newAvail,
          availVol,
          note
        ]);

        deductions.push({
          plNo: cand.plNo,
          item: cand.item,
          bdl: cand.bdl,
          dim: cand.dim,
          thick: thick,
          width: width,
          length: length,
          cutQty: deductFromThis,
          cutVol: cutVol,
          recQty: cand.recQty,
          newAvail: newAvail,
          availVol: availVol
        });
      }

      const isMultiBundle = deductions.length > 1;
      const firstTarget = deductions[0];
      const totalCutVol = deductions.reduce((s, d) => s + d.cutVol, 0);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        isFifo: isMultiBundle,
        totalCutQty: actualCutQty,
        totalCutVolM3: Math.round(totalCutVol * 1000) / 1000,
        totalPartRemaining: totalAvailableStock - actualCutQty,
        deductions: deductions,
        item: firstTarget.item,
        bdl: firstTarget.bdl,
        dim: firstTarget.dim,
        thick: firstTarget.thick,
        width: firstTarget.width,
        length: firstTarget.length,
        plNo: firstTarget.plNo,
        cutQty: firstTarget.cutQty,
        cutVol: firstTarget.cutVol,
        recQty: firstTarget.recQty,
        availStock: firstTarget.newAvail,
        availVol: firstTarget.availVol,
        note: note
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 5. รายการค้างรับ (Pending List)
    // ==========================================
    if (action === "pending_list") {
      const normalize = (s) => String(s || "").toLowerCase().replace(/[\s\-_]/g, "");
      const targetInvoiceClean = payload.invoice ? normalize(payload.invoice) : (payload.container ? normalize(payload.container) : "");
      let targetContainerName = "";
      let targetPlName = "";
      const pendingItems = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const ctn = String(row[colCtn] || "").trim();
        const pl = String(row[colPl] || "").trim();
        const plClean = normalize(pl);
        const ctnClean = normalize(ctn);

        const matchInvoice = targetInvoiceClean
          ? matchInvoiceFlexible(pl, ctn, targetInvoiceClean)
          : (pl === activeInfo.activePl || ctn === activeInfo.activeContainer);

        if (matchInvoice) {
          if (!targetContainerName) {
            targetContainerName = ctn || "คลังในประเทศ";
            targetPlName = pl;
          }
          const exp = Number(row[colExp]) || 0;
          const rec = Number(row[colRec]) || 0;
          const bal = exp - rec;
          if (bal > 0) {
            pendingItems.push({
              plNo: pl,
              container: ctn || "-",
              item: row[colItem],
              bdl: row[colBdl] || "-",
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
        container: targetContainerName || activeInfo.activeContainer,
        plNo: targetPlName || activeInfo.activePl,
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

        const dimStr = String(row[colDim] || "");
        const dims = parseDimensionNumbers(dimStr);
        const volExp = (dims.thick * dims.width * dims.length * exp) / 1000000000;
        const volAvail = (dims.thick * dims.width * dims.length * Math.max(0, avail)) / 1000000000;

        allRows.push({
          plNo: pl,
          container: ctn,
          item: itemNo,
          bdl: bdlNo,
          thick: dims.thick,
          width: dims.width,
          length: dims.length,
          dim: dimStr,
          expQty: exp,
          recQty: rec,
          balQty: bal,
          cutQty: cut,
          availStock: avail,
          volExpM3: Math.round(volExp * 1000) / 1000,
          volAvailM3: Math.round(volAvail * 1000) / 1000,
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

    if (action === "create_dashboard") {
      buildDashboardSheet();
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "สร้าง/อัปเดตหน้า Dashboard เรียบร้อยแล้ว!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "import_packing_list") {
      const newRows = payload.rows || [];
      if (newRows.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ไม่มีข้อมูล rows ที่จะนำเข้า" })).setMimeType(ContentService.MimeType.JSON);
      }
      
      const lastRow = sheetPL.getLastRow();
      let startIdx = lastRow >= 2 ? Number(sheetPL.getRange(lastRow, 1).getValue()) || 0 : 0;
      
      const appendValues = newRows.map((r, i) => [
        startIdx + i + 1,
        r.date || "2026-07-21",
        r.plNo || "PL-28/ASN/TM/VII/26",
        r.container || "TRHU 5939460/ID49590AA",
        r.item,
        r.bdl,
        r.dim,
        Number(r.qty) || 0,
        Number(r.vol) || 0,
        0,
        Number(r.qty) || 0,
        "⏳ ยังไม่รับ",
        "-"
      ]);
      
      sheetPL.getRange(lastRow + 1, 1, appendValues.length, appendValues[0].length).setValues(appendValues);
      buildDashboardSheet();
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: `นำเข้าข้อมูล Packing List สำเร็จ ${appendValues.length} รายการ และอัปเดตหน้า Dashboard เรียบร้อยแล้ว!`,
        importedCount: appendValues.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ไม่พบ Action ที่ระบุ" })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * นำเข้าข้อมูลตู้ PL-28 (37 มัด) เข้าสู่ Packing List โดยตรง
 */
function importPL28Directly() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetPL = ss.getSheetByName(SHEET_PACKING_LIST);
  if (!sheetPL) return;

  const PL28_DATA = [
    { item: "S4S 17x100x520", bdl: "1", dim: "17 x 100 x 520 MM", qty: 1266, vol: 1.119 },
    { item: "S4S 17x100x520", bdl: "2", dim: "17 x 100 x 520 MM", qty: 1266, vol: 1.119 },
    { item: "S4S 17x100x520", bdl: "3", dim: "17 x 100 x 520 MM", qty: 1266, vol: 1.119 },
    { item: "S4S 17x100x520", bdl: "4", dim: "17 x 100 x 520 MM", qty: 1266, vol: 1.119 },
    { item: "S4S 17x100x520", bdl: "5", dim: "17 x 100 x 520 MM", qty: 1266, vol: 1.119 },
    { item: "S4S 17x100x520", bdl: "6", dim: "17 x 100 x 520 MM", qty: 1266, vol: 1.119 },
    { item: "S4S 17x100x520", bdl: "7", dim: "17 x 100 x 520 MM", qty: 1266, vol: 1.119 },
    { item: "S4S 17x100x520", bdl: "8", dim: "17 x 100 x 520 MM", qty: 1266, vol: 1.119 },
    { item: "S4S 17x100x520", bdl: "9", dim: "17 x 100 x 520 MM", qty: 1266, vol: 1.119 },
    { item: "S4S 17x100x520", bdl: "10", dim: "17 x 100 x 520 MM", qty: 1266, vol: 1.119 },
    { item: "S4S 17x100x470", bdl: "11", dim: "17 x 100 x 470 MM", qty: 1266, vol: 1.012 },
    { item: "S4S 17x100x470", bdl: "12", dim: "17 x 100 x 470 MM", qty: 1266, vol: 1.012 },
    { item: "S4S 17x100x470", bdl: "13", dim: "17 x 100 x 470 MM", qty: 1266, vol: 1.012 },
    { item: "S4S 17x100x470", bdl: "14", dim: "17 x 100 x 470 MM", qty: 1266, vol: 1.012 },
    { item: "S4S 17x100x470", bdl: "15", dim: "17 x 100 x 470 MM", qty: 1266, vol: 1.012 },
    { item: "S4S 17x100x470", bdl: "16", dim: "17 x 100 x 470 MM", qty: 1266, vol: 1.012 },
    { item: "S4S 17x100x470", bdl: "17", dim: "17 x 100 x 470 MM", qty: 1266, vol: 1.012 },
    { item: "S4S 17x100x470", bdl: "18", dim: "17 x 100 x 470 MM", qty: 1266, vol: 1.012 },
    { item: "S4S 17x100x470", bdl: "19", dim: "17 x 100 x 470 MM", qty: 1266, vol: 1.012 },
    { item: "S4S 17x100x470", bdl: "20", dim: "17 x 100 x 470 MM", qty: 1266, vol: 1.012 },
    { item: "S4S 17x100x470", bdl: "21", dim: "17 x 100 x 470 MM", qty: 1266, vol: 1.012 },
    { item: "S4S 17x98x520", bdl: "22", dim: "17 x 98 x 520 MM", qty: 1320, vol: 1.144 },
    { item: "S4S 17x98x470", bdl: "23", dim: "17 x 98 x 470 MM", qty: 1320, vol: 1.034 },
    { item: "S4S 17x83x520", bdl: "24", dim: "17 x 83 x 520 MM", qty: 1560, vol: 1.145 },
    { item: "S4S 17x83x520", bdl: "25", dim: "17 x 83 x 520 MM", qty: 1560, vol: 1.145 },
    { item: "S4S 17x83x520", bdl: "26", dim: "17 x 83 x 520 MM", qty: 1560, vol: 1.145 },
    { item: "S4S 17x83x520", bdl: "27", dim: "17 x 83 x 520 MM", qty: 1560, vol: 1.145 },
    { item: "S4S 17x83x520", bdl: "28", dim: "17 x 83 x 520 MM", qty: 1560, vol: 1.145 },
    { item: "S4S 17x83x470", bdl: "29", dim: "17 x 83 x 470 MM", qty: 1560, vol: 1.035 },
    { item: "S4S 17x83x470", bdl: "30", dim: "17 x 83 x 470 MM", qty: 1560, vol: 1.035 },
    { item: "S4S 17x83x470", bdl: "31", dim: "17 x 83 x 470 MM", qty: 1560, vol: 1.035 },
    { item: "S4S 17x83x470", bdl: "32", dim: "17 x 83 x 470 MM", qty: 1560, vol: 1.035 },
    { item: "S4S 17x78x520", bdl: "33", dim: "17 x 78 x 520 MM", qty: 1644, vol: 1.134 },
    { item: "S4S 17x78x520", bdl: "34", dim: "17 x 78 x 520 MM", qty: 1644, vol: 1.134 },
    { item: "S4S 17x78x520", bdl: "35", dim: "17 x 78 x 520 MM", qty: 1644, vol: 1.134 },
    { item: "S4S 17x78x520", bdl: "36", dim: "17 x 78 x 520 MM", qty: 1644, vol: 1.134 },
    { item: "S4S 17x78x470", bdl: "37", dim: "17 x 78 x 470 MM", qty: 1644, vol: 1.025 }
  ];

  const lastRow = sheetPL.getLastRow();
  let startIdx = lastRow >= 2 ? Number(sheetPL.getRange(lastRow, 1).getValue()) || 0 : 0;

  const appendValues = PL28_DATA.map((r, i) => [
    startIdx + i + 1,
    "2026-07-21",
    "PL-28/ASN/TM/VII/26",
    "TRHU 5939460/ID49590AA",
    r.item,
    r.bdl,
    r.dim,
    r.qty,
    r.vol,
    0,
    r.qty,
    "⏳ ยังไม่รับ",
    "-"
  ]);

  sheetPL.getRange(lastRow + 1, 1, appendValues.length, appendValues[0].length).setValues(appendValues);
  buildDashboardSheet();
  SpreadsheetApp.getUi().alert(`✅ นำเข้าข้อมูลตู้ PL-28 สำเร็จ ${appendValues.length} มัด (${appendValues.reduce((s, r) => s + r[7], 0).toLocaleString()} ชิ้น) เรียบร้อยแล้ว!`);
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
