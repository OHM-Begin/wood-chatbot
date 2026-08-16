import pandas as pd

data = [
  {"item": "S4S 17x100x520", "bdl": "1", "dim": "17 x 100 x 520 MM", "qty": 1266, "vol": 1.119},
  {"item": "S4S 17x100x520", "bdl": "2", "dim": "17 x 100 x 520 MM", "qty": 1266, "vol": 1.119},
  {"item": "S4S 17x100x520", "bdl": "3", "dim": "17 x 100 x 520 MM", "qty": 1266, "vol": 1.119},
  {"item": "S4S 17x100x520", "bdl": "4", "dim": "17 x 100 x 520 MM", "qty": 1266, "vol": 1.119},
  {"item": "S4S 17x100x520", "bdl": "5", "dim": "17 x 100 x 520 MM", "qty": 1266, "vol": 1.119},
  {"item": "S4S 17x100x520", "bdl": "6", "dim": "17 x 100 x 520 MM", "qty": 1266, "vol": 1.119},
  {"item": "S4S 17x100x520", "bdl": "7", "dim": "17 x 100 x 520 MM", "qty": 1266, "vol": 1.119},
  {"item": "S4S 17x100x520", "bdl": "8", "dim": "17 x 100 x 520 MM", "qty": 1266, "vol": 1.119},
  {"item": "S4S 17x100x520", "bdl": "9", "dim": "17 x 100 x 520 MM", "qty": 1266, "vol": 1.119},
  {"item": "S4S 17x100x520", "bdl": "10", "dim": "17 x 100 x 520 MM", "qty": 1266, "vol": 1.119},
  {"item": "S4S 17x100x470", "bdl": "11", "dim": "17 x 100 x 470 MM", "qty": 1266, "vol": 1.012},
  {"item": "S4S 17x100x470", "bdl": "12", "dim": "17 x 100 x 470 MM", "qty": 1266, "vol": 1.012},
  {"item": "S4S 17x100x470", "bdl": "13", "dim": "17 x 100 x 470 MM", "qty": 1266, "vol": 1.012},
  {"item": "S4S 17x100x470", "bdl": "14", "dim": "17 x 100 x 470 MM", "qty": 1266, "vol": 1.012},
  {"item": "S4S 17x100x470", "bdl": "15", "dim": "17 x 100 x 470 MM", "qty": 1266, "vol": 1.012},
  {"item": "S4S 17x100x470", "bdl": "16", "dim": "17 x 100 x 470 MM", "qty": 1266, "vol": 1.012},
  {"item": "S4S 17x100x470", "bdl": "17", "dim": "17 x 100 x 470 MM", "qty": 1266, "vol": 1.012},
  {"item": "S4S 17x100x470", "bdl": "18", "dim": "17 x 100 x 470 MM", "qty": 1266, "vol": 1.012},
  {"item": "S4S 17x100x470", "bdl": "19", "dim": "17 x 100 x 470 MM", "qty": 1266, "vol": 1.012},
  {"item": "S4S 17x100x470", "bdl": "20", "dim": "17 x 100 x 470 MM", "qty": 1266, "vol": 1.012},
  {"item": "S4S 17x100x470", "bdl": "21", "dim": "17 x 100 x 470 MM", "qty": 1266, "vol": 1.012},
  {"item": "S4S 17x98x520", "bdl": "22", "dim": "17 x 98 x 520 MM", "qty": 1320, "vol": 1.144},
  {"item": "S4S 17x98x470", "bdl": "23", "dim": "17 x 98 x 470 MM", "qty": 1320, "vol": 1.034},
  {"item": "S4S 17x83x520", "bdl": "24", "dim": "17 x 83 x 520 MM", "qty": 1560, "vol": 1.145},
  {"item": "S4S 17x83x520", "bdl": "25", "dim": "17 x 83 x 520 MM", "qty": 1560, "vol": 1.145},
  {"item": "S4S 17x83x520", "bdl": "26", "dim": "17 x 83 x 520 MM", "qty": 1560, "vol": 1.145},
  {"item": "S4S 17x83x520", "bdl": "27", "dim": "17 x 83 x 520 MM", "qty": 1560, "vol": 1.145},
  {"item": "S4S 17x83x520", "bdl": "28", "dim": "17 x 83 x 520 MM", "qty": 1560, "vol": 1.145},
  {"item": "S4S 17x83x470", "bdl": "29", "dim": "17 x 83 x 470 MM", "qty": 1560, "vol": 1.035},
  {"item": "S4S 17x83x470", "bdl": "30", "dim": "17 x 83 x 470 MM", "qty": 1560, "vol": 1.035},
  {"item": "S4S 17x83x470", "bdl": "31", "dim": "17 x 83 x 470 MM", "qty": 1560, "vol": 1.035},
  {"item": "S4S 17x83x470", "bdl": "32", "dim": "17 x 83 x 470 MM", "qty": 1560, "vol": 1.035},
  {"item": "S4S 17x78x520", "bdl": "33", "dim": "17 x 78 x 520 MM", "qty": 1644, "vol": 1.134},
  {"item": "S4S 17x78x520", "bdl": "34", "dim": "17 x 78 x 520 MM", "qty": 1644, "vol": 1.134},
  {"item": "S4S 17x78x520", "bdl": "35", "dim": "17 x 78 x 520 MM", "qty": 1644, "vol": 1.134},
  {"item": "S4S 17x78x520", "bdl": "36", "dim": "17 x 78 x 520 MM", "qty": 1644, "vol": 1.134},
  {"item": "S4S 17x78x470", "bdl": "37", "dim": "17 x 78 x 470 MM", "qty": 1644, "vol": 1.025}
]

rows = []
for i, d in enumerate(data, 1):
    rows.append({
        "ลำดับ": i,
        "วันที่เอกสาร (Date)": "2026-07-21",
        "เลขที่ PL (Packing No.)": "PL-28/ASN/TM/VII/26",
        "เลขตู้ (Container No.)": "TRHU 5939460/ID49590AA",
        "No. Item (Part Number)": d["item"],
        "No. BDL (มัดที่)": d["bdl"],
        "ขนาด / Description (MM)": d["dim"],
        "ยอดตาม PL (PCS)": d["qty"],
        "ปริมาตร (M3)": d["vol"],
        "ยอดรับเข้าแล้ว (PCS)": 0,
        "ยอดคงเหลือ (PCS)": d["qty"],
        "สถานะการตรวจรับ": "⏳ ยังไม่รับ",
        "อัปเดตล่าสุด": "-"
    })

df = pd.DataFrame(rows)
df.to_excel("Data Invoice/PL28_Packing_List.xlsx", index=False)
df.to_csv("Data Invoice/PL28_Packing_List.csv", index=False, encoding="utf-8-sig")
print(f"SUCCESS: Created Data Invoice/PL28_Packing_List.xlsx with {len(df)} rows")
print(f"Total Quantity: {df['ยอดตาม PL (PCS)'].sum():,} PCS")
print(f"Total Volume: {df['ปริมาตร (M3)'].sum():.3f} M3")
