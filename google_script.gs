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
    .addItem("📥 นำเข้าข้อมูลตู้ PL-28 (37 มัด)", "importPL28Directly")
    .addItem("➕ สร้างแท็บ 'ตัดไม้' (ถ้ายังไม่มี)", "ensureCuttingSheetExists")
    .addItem("🔄 รีเซ็ตยอดรับเข้าทั้งหมด (เฉพาะชีต Packing List)", "resetReceivedQuantities")
    .addToUi();
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
  dash.getRange("B5:C5").merge().setFormula("=SUM('Packing List'!J2:J) - SUM('ตัดไม้'!H2:H)").setBackground("#ecfdf5").setFontColor("#065f46").setFontSize(20).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setNumberFormat("#,##0");
  dash.getRange("B6:C6").merge().setValue("พร้อมนำไปผลิต/ตัดใช้งาน").setBackground("#ecfdf5").setFontColor("#047857").setFontSize(9).setHorizontalAlignment("center");

  // Card 2: D4:E6 (ยอดตาม PL ทั้งหมด)
  dash.getRange("D4:E4").merge().setValue("📦 ยอดตาม Packing List (PCS)").setBackground("#1d4ed8").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  dash.getRange("D5:E5").merge().setFormula("=SUM('Packing List'!H2:H)").setBackground("#eff6ff").setFontColor("#1e40af").setFontSize(20).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setNumberFormat("#,##0");
  dash.getRange("D6:E6").merge().setFormula('="ปริมาตรรวม: " & TEXT(SUM(\'Packing List\'!I2:I), "#,##0.00") & " M³"').setBackground("#eff6ff").setFontColor("#1d4ed8").setFontSize(9).setHorizontalAlignment("center");

  // Card 3: F4:G6 (รับเข้าคลังแล้ว)
  dash.getRange("F4:G4").merge().setValue("📥 รับเข้าคลังแล้ว (PCS)").setBackground("#0d9488").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  dash.getRange("F5:G5").merge().setFormula("=SUM('Packing List'!J2:J)").setBackground("#f0fdfa").setFontColor("#115e59").setFontSize(20).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setNumberFormat("#,##0");
  dash.getRange("F6:G6").merge().setFormula('="คิดเป็น: " & TEXT(IF(SUM(\'Packing List\'!H2:H)>0, SUM(\'Packing List\'!J2:J)/SUM(\'Packing List\'!H2:H), 0), "0.0%") & " ของตู้"').setBackground("#f0fdfa").setFontColor("#0f766e").setFontSize(9).setHorizontalAlignment("center");

  // Card 4: H4:I6 (ค้างรับเข้าตู้)
  dash.getRange("H4:I4").merge().setValue("⏳ ยอดค้างรับเข้าตู้ (PCS)").setBackground("#d97706").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  dash.getRange("H5:I5").merge().setFormula("=SUM('Packing List'!H2:H) - SUM('Packing List'!J2:J)").setBackground("#fffbeb").setFontColor("#92400e").setFontSize(20).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setNumberFormat("#,##0");
  dash.getRange("H6:I6").merge().setFormula('="สถานะ: " & IF(H5=0, "✅ รับครบแล้ว", "รอรับอีก " & TEXT(H5, "#,##0") & " ชิ้น")').setBackground("#fffbeb").setFontColor("#b45309").setFontSize(9).setHorizontalAlignment("center");

  // Card 5: J4:K6 (ตัดไม้ออกสะสม)
  dash.getRange("J4:K4").merge().setValue("✂️ ยอดตัดไม้ออกสะสม (PCS)").setBackground("#e11d48").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  dash.getRange("J5:K5").merge().setFormula("=SUM('ตัดไม้'!H2:H)").setBackground("#fff1f2").setFontColor("#9f1239").setFontSize(20).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setNumberFormat("#,##0");
  dash.getRange("J6:K6").merge().setFormula('="จำนวนครั้งที่เบิก: " & TEXT(COUNTA(\'ตัดไม้\'!A2:A), "#,##0") & " ครั้ง"').setBackground("#fff1f2").setFontColor("#be123c").setFontSize(9).setHorizontalAlignment("center");

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
    dash.getRange(`E${r}`).setFormula(`=IF(ISBLANK(B${r}), "", SUMIFS('Packing List'!H:H, 'Packing List'!C:C, B${r}))`).setNumberFormat("#,##0").setHorizontalAlignment("right");
    dash.getRange(`F${r}`).setFormula(`=IF(ISBLANK(B${r}), "", SUMIFS('Packing List'!I:I, 'Packing List'!C:C, B${r}))`).setNumberFormat("#,##0.00").setHorizontalAlignment("right");
    dash.getRange(`G${r}`).setFormula(`=IF(ISBLANK(B${r}), "", SUMIFS('Packing List'!J:J, 'Packing List'!C:C, B${r}))`).setNumberFormat("#,##0").setHorizontalAlignment("right");
    dash.getRange(`H${r}`).setFormula(`=IF(ISBLANK(B${r}), "", E${r}-G${r})`).setNumberFormat("#,##0").setHorizontalAlignment("right");
    dash.getRange(`I${r}`).setFormula(`=IF(ISBLANK(B${r}), "", SUMIFS('ตัดไม้'!H:H, 'ตัดไม้'!C:C, B${r}))`).setNumberFormat("#,##0").setHorizontalAlignment("right");
    dash.getRange(`J${r}`).setFormula(`=IF(ISBLANK(B${r}), "", G${r}-I${r})`).setNumberFormat("#,##0").setFontWeight("bold").setFontColor("#059669").setHorizontalAlignment("right");
    dash.getRange(`K${r}`).setFormula(`=IF(ISBLANK(B${r}), "", IF(J${r}=0, "⚪ ตัดหมดเกลี้ยง (ปิดงบ)", IF(H${r}=0, "🟢 รับครบ (กำลังตัดใช้)", "🟡 กำลังรับเข้า & ตัดใช้")))`).setHorizontalAlignment("center").setFontWeight("bold");
    dash.getRange(`A${r}:K${r}`).setBackground(r % 2 === 0 ? "#f8fafc" : "#ffffff");
    dash.setRowHeight(r, 25);
  }

  dash.setRowHeight(15, 15); // Spacer

  // 4. Section 2: อายุวัตถุดิบ & การจัดกลุ่มความเร่งด่วน (Aging Analysis)
  dash.getRange("A16:E16").merge().setValue("⏳ 2. วิเคราะห์อายุไม้ในคลัง (AGING & SLOW-MOVING)").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold").setFontSize(11);
  dash.getRange("G16:K16").merge().setValue("🌲 3. สรุปปริมาตรแยกตามขนาด (DIMENSION & VOLUME)").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold").setFontSize(11);
  dash.setRowHeight(16, 28);

  const agingHeaders = ["ช่วงอายุไม้", "เกณฑ์วัน", "จำนวนมัด", "สต็อกคงเหลือ (PCS)", "สถานะการจัดการ"];
  dash.getRange(17, 1, 1, agingHeaders.length).setValues([agingHeaders]).setBackground("#475569").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");

  dash.getRange("A18:E18").setValues([["🟢 ไม้ล็อตใหม่ (Fresh)", "< 30 วัน", "=COUNTIFS('Packing List'!B2:B, \">=\" & (TODAY()-30), 'Packing List'!J2:J, \">0\")", "=SUMIFS('Packing List'!J2:J, 'Packing List'!B2:B, \">=\" & (TODAY()-30)) - SUM('ตัดไม้'!H2:H)", "ใช้งานได้ตามปกติ"]]).setBackground("#f0fdf4").setFontColor("#166534");
  dash.getRange("A19:E19").setValues([["🟡 ไม้คลังปานกลาง (Medium)", "31 - 60 วัน", "=COUNTIFS('Packing List'!B2:B, \">=\" & (TODAY()-60), 'Packing List'!B2:B, \"<\" & (TODAY()-30), 'Packing List'!J2:J, \">0\")", "=SUMIFS('Packing List'!J2:J, 'Packing List'!B2:B, \">=\" & (TODAY()-60), 'Packing List'!B2:B, \"<\" & (TODAY()-30))", "ควรเร่งนำไปตัดตามคิว FIFO"]]).setBackground("#fffbeb").setFontColor("#854d0e");
  dash.getRange("A20:E20").setValues([["🔴 ไม้ค้างนาน (Slow-Moving)", "> 60 วัน", "=COUNTIFS('Packing List'!B2:B, \"<\" & (TODAY()-60), 'Packing List'!J2:J, \">0\")", "=SUMIFS('Packing List'!J2:J, 'Packing List'!B2:B, \"<\" & (TODAY()-60))", "⚠️ ตรวจสอบสภาพไม้/เร่งระบาย"]]).setBackground("#fef2f2").setFontColor("#991b1b");
  
  dash.getRange("C18:D20").setNumberFormat("#,##0").setHorizontalAlignment("right");
  dash.getRange("A18:B20").setHorizontalAlignment("center");
  dash.getRange("E18:E20").setHorizontalAlignment("left");

  // Dimension & Volume Summary (G17:K21)
  const dimHeaders = ["ขนาดความหนา", "ประเภทการใช้งาน", "จำนวนมัดรวม", "ปริมาตรตามตู้ (M³)", "สัดส่วน %"];
  dash.getRange(17, 7, 1, dimHeaders.length).setValues([dimHeaders]).setBackground("#475569").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");

  dash.getRange("G18:K18").setValues([["หนา 17 MM", "ไม้หน้ากว้าง (ตู้ PL-28)", "=COUNTIF('Packing List'!G2:G, \"17 x*\")", "=SUMIF('Packing List'!G2:G, \"17 x*\", 'Packing List'!I2:I)", "=I18/SUM('Packing List'!I2:I)"]]).setBackground("#f8fafc");
  dash.getRange("G19:K19").setValues([["หนา 16 MM", "ไม้โครงสร้าง (ตู้ PL-25)", "=COUNTIF('Packing List'!G2:G, \"16 x*\")", "=SUMIF('Packing List'!G2:G, \"16 x*\", 'Packing List'!I2:I)", "=I19/SUM('Packing List'!I2:I)"]]).setBackground("#f8fafc");
  dash.getRange("G20:K20").setValues([["หนา 15 MM", "ไม้ระแนง/งานประกอบ", "=COUNTIF('Packing List'!G2:G, \"15 x*\")", "=SUMIF('Packing List'!G2:G, \"15 x*\", 'Packing List'!I2:I)", "=I20/SUM('Packing List'!I2:I)"]]).setBackground("#f8fafc");
  dash.getRange("G21:K21").setValues([["รวมทั้งหมด", "ทุกขนาด", "=COUNTA('Packing List'!F2:F)", "=SUM('Packing List'!I2:I)", "100.0%"]]).setBackground("#e2e8f0").setFontWeight("bold");

  dash.getRange("I18:I21").setNumberFormat("#,##0.00").setHorizontalAlignment("right");
  dash.getRange("K18:K21").setNumberFormat("0.0%").setHorizontalAlignment("right");
  dash.getRange("G18:H21").setHorizontalAlignment("left");
  dash.getRange("H18:H21").setHorizontalAlignment("center");

  dash.setRowHeight(17, 26);
  dash.setRowHeight(18, 24);
  dash.setRowHeight(19, 24);
  dash.setRowHeight(20, 24);
  dash.setRowHeight(21, 24);
  dash.setRowHeight(22, 15); // Spacer

  // 5. Section 3: ประวัติการตัดไม้ล่าสุด (Recent Cutting Log)
  dash.getRange("A23:K23").merge().setValue("✂️ 4. รายการตัดไม้ล่าสุด (LATEST WOOD CUTTING TRANSACTIONS)").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold").setFontSize(11);
  dash.setRowHeight(23, 28);

  const cutHeaders = ["ลำดับ", "วัน-เวลาที่ตัด", "เลขที่ PL", "เลขตู้", "Part Number", "มัดที่", "ขนาด (MM)", "ตัดออก (PCS)", "คงเหลือพร้อมใช้", "ผู้เบิก / หมายเหตุ", "สถานะ"];
  dash.getRange(24, 1, 1, cutHeaders.length).setValues([cutHeaders]).setBackground("#334155").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  dash.setRowHeight(24, 26);

  // Link up to 5 latest rows from 'ตัดไม้'
  for (let r = 1; r <= 5; r++) {
    const rowIdx = 24 + r;
    dash.getRange(`A${rowIdx}`).setFormula(`=IF(ISBLANK('ตัดไม้'!A${r+1}), "", 'ตัดไม้'!A${r+1})`).setHorizontalAlignment("center");
    dash.getRange(`B${rowIdx}`).setFormula(`=IF(ISBLANK('ตัดไม้'!B${r+1}), "", 'ตัดไม้'!B${r+1})`).setHorizontalAlignment("center");
    dash.getRange(`C${rowIdx}`).setFormula(`=IF(ISBLANK('ตัดไม้'!C${r+1}), "", 'ตัดไม้'!C${r+1})`).setHorizontalAlignment("left");
    dash.getRange(`D${rowIdx}`).setFormula(`=IF(ISBLANK('ตัดไม้'!D${r+1}), "", 'ตัดไม้'!D${r+1})`).setHorizontalAlignment("left");
    dash.getRange(`E${rowIdx}`).setFormula(`=IF(ISBLANK('ตัดไม้'!E${r+1}), "", 'ตัดไม้'!E${r+1})`).setHorizontalAlignment("center").setFontWeight("bold");
    dash.getRange(`F${rowIdx}`).setFormula(`=IF(ISBLANK('ตัดไม้'!F${r+1}), "", 'ตัดไม้'!F${r+1})`).setHorizontalAlignment("center");
    dash.getRange(`G${rowIdx}`).setFormula(`=IF(ISBLANK('ตัดไม้'!G${r+1}), "", 'ตัดไม้'!G${r+1})`).setHorizontalAlignment("left");
    dash.getRange(`H${rowIdx}`).setFormula(`=IF(ISBLANK('ตัดไม้'!H${r+1}), "", 'ตัดไม้'!H${r+1})`).setHorizontalAlignment("right").setFontColor("#e11d48").setFontWeight("bold").setNumberFormat("#,##0");
    dash.getRange(`I${rowIdx}`).setFormula(`=IF(ISBLANK('ตัดไม้'!J${r+1}), "", 'ตัดไม้'!J${r+1})`).setHorizontalAlignment("right").setFontColor("#059669").setFontWeight("bold").setNumberFormat("#,##0");
    dash.getRange(`J${rowIdx}`).setFormula(`=IF(ISBLANK('ตัดไม้'!K${r+1}), "", 'ตัดไม้'!K${r+1})`).setHorizontalAlignment("left");
    dash.getRange(`K${rowIdx}`).setFormula(`=IF(ISBLANK('ตัดไม้'!A${r+1}), "", "✂️ ตัดสำเร็จ")`).setHorizontalAlignment("center");
    dash.getRange(`A${rowIdx}:K${rowIdx}`).setBackground(r % 2 === 0 ? "#f8fafc" : "#ffffff");
    dash.setRowHeight(rowIdx, 24);
  }

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
      let targetPlName = "";

      const normalize = (s) => String(s || "").toLowerCase().replace(/[\s\-_]/g, "");
      const targetInvoiceClean = payload.invoice ? normalize(payload.invoice) : (payload.container ? normalize(payload.container) : "");

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const ctn = String(row[colCtn] || "").trim();
        const pl = String(row[colPl] || "").trim();
        const item = String(row[colItem] || "").trim();
        const bdl = String(row[colBdl] || "").trim();

        const plClean = normalize(pl);
        const ctnClean = normalize(ctn);

        const matchInvoice = targetInvoiceClean
          ? (plClean.includes(targetInvoiceClean) || ctnClean.includes(targetInvoiceClean))
          : (pl === activeInfo.activePl || ctn === activeInfo.activeContainer);

        if (matchInvoice) {
          if (!targetContainerName) {
            targetContainerName = ctn;
            targetPlName = pl;
          }
          const exp = Number(row[colExp]) || 0;
          const rec = Number(row[colRec]) || 0;
          const cut = cutMap[`${pl.toLowerCase()}|${ctn.toLowerCase()}|${item.toLowerCase()}|${bdl.toLowerCase()}`] || cutMap[`${item.toLowerCase()}|${bdl.toLowerCase()}`] || 0;

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
        plNo: targetPlName || activeInfo.activePl,
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
      const normalize = (s) => String(s || "").toLowerCase().replace(/[\s\-_]/g, "");
      const targetInvoiceClean = payload.invoice ? normalize(payload.invoice) : "";
      const results = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const pl = String(row[colPl] || "").trim();
        const ctn = String(row[colCtn] || "").trim();
        const itemNo = String(row[colItem] || "").trim().toLowerCase();
        const bdlNo = String(row[colBdl] || "").trim().toLowerCase();

        const plClean = normalize(pl);
        const ctnClean = normalize(ctn);
        const matchInvoice = !targetInvoiceClean || plClean.includes(targetInvoiceClean) || ctnClean.includes(targetInvoiceClean);

        const matchQuery = (itemNo.includes(query) || bdlNo === query || bdlNo === cleanQuery || 
                            query === `มัด ${bdlNo}` || query === `bdl ${bdlNo}` || query === `มัด${bdlNo}`);

        if (matchInvoice && matchQuery) {
          const exp = Number(row[colExp]) || 0;
          const rec = Number(row[colRec]) || 0;
          const bal = exp - rec;
          const cut = cutMap[`${pl.toLowerCase()}|${ctn.toLowerCase()}|${itemNo}|${bdlNo}`] || cutMap[`${itemNo}|${bdlNo}`] || 0;
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

      const normalize = (s) => String(s || "").toLowerCase().replace(/[\s\-_]/g, "");
      const targetInvoiceClean = payload.invoice ? normalize(payload.invoice) : (payload.container ? normalize(payload.container) : "");

      const matchedCandidates = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const pl = String(row[colPl] || "").trim();
        const ctn = String(row[colCtn] || "").trim();
        const itemNo = String(row[colItem] || "").trim().toLowerCase();
        const bdlNo = String(row[colBdl] || "").trim().toLowerCase();

        const plClean = normalize(pl);
        const ctnClean = normalize(ctn);

        // ถ้าผู้ใช้ระบุ Invoice เช่น "PL25" -> กรองเฉพาะตู้ PL-25
        // ถ้าผู้ใช้ไม่ระบุ Invoice -> ยึดตู้ Active ปัจจุบัน
        const matchInvoice = targetInvoiceClean 
          ? (plClean.includes(targetInvoiceClean) || ctnClean.includes(targetInvoiceClean))
          : (pl === activeInfo.activePl || ctn === activeInfo.activeContainer);

        const matchItem = (itemNo === query || bdlNo === query || bdlNo === cleanQuery || 
                           query === `มัด ${bdlNo}` || query === `bdl ${bdlNo}` || query === `มัด${bdlNo}`);

        if (matchInvoice && matchItem) {
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
          ? (plClean.includes(targetInvoiceClean) || ctnClean.includes(targetInvoiceClean))
          : (pl === activeInfo.activePl || ctn === activeInfo.activeContainer);

        if (matchInvoice) {
          if (!targetContainerName) {
            targetContainerName = ctn;
            targetPlName = pl;
          }
          const exp = Number(row[colExp]) || 0;
          const rec = Number(row[colRec]) || 0;
          const bal = exp - rec;
          if (bal > 0) {
            pendingItems.push({
              plNo: pl,
              container: ctn,
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
