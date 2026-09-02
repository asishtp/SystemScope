import json, zipfile, xml.etree.ElementTree as ET
from pathlib import Path

SOURCE = Path(r"C:\data")
TARGET = Path(r"C:\GitHub\SystemScope\src\systemscope-web\src\schema\gwdb-schema.json")
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

def rows(name):
    with zipfile.ZipFile(SOURCE / name) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            shared = ["".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])) for si in root.findall("m:si", NS)]
        root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        values = []
        for row in root.findall(".//m:sheetData/m:row", NS):
            record = []
            for cell in row.findall("m:c", NS):
                value = cell.find("m:v", NS)
                text = "" if value is None else value.text
                if cell.get("t") == "s" and text:
                    text = shared[int(text)]
                elif cell.get("t") == "inlineStr":
                    text = "".join(t.text or "" for t in cell.iter("{%s}t" % NS["m"]))
                record.append(text)
            values.append(record)
        header = values[0]
        return [dict(zip(header, r + [""] * (len(header) - len(r)))) for r in values[1:]]

tables = rows("tables.xlsx")
columns = rows("columns.xlsx")
comments = rows("table_comments.xlsx")
column_comments = rows("column_comments.xlsx")
constraints = rows("all_constraints.xlsx")
objects = rows("database_objects.xlsx")
dependencies = rows("object_dependencies.xlsx")

table_comments = {(r["OWNER"], r["TABLE_NAME"]): r["COMMENTS"] for r in comments}
column_comment_map = {(r["OWNER"], r["TABLE_NAME"], r["COLUMN_NAME"]): r["COMMENTS"] for r in column_comments}
keys = {}
constraint_table = {}
constraint_columns = {}
for r in constraints:
    constraint_table[(r["OWNER"], r["CONSTRAINT_NAME"])] = r["TABLE_NAME"]
    constraint_columns.setdefault((r["OWNER"], r["CONSTRAINT_NAME"]), {})[r["COLUMN_POSITION"]] = r["COLUMN_NAME"]
    if r["CONSTRAINT_TYPE"] in ("P", "U"):
        keys.setdefault((r["OWNER"], r["TABLE_NAME"]), {})[r["COLUMN_NAME"]] = "PK" if r["CONSTRAINT_TYPE"] == "P" else "UK"
    elif r["CONSTRAINT_TYPE"] == "R":
        table_keys = keys.setdefault((r["OWNER"], r["TABLE_NAME"]), {})
        existing = table_keys.get(r["COLUMN_NAME"], "")
        table_keys[r["COLUMN_NAME"]] = f"{existing}/FK" if existing and "FK" not in existing else (existing or "FK")

by_table = {}
for r in columns:
    precision = r["DATA_PRECISION"]
    scale = r["DATA_SCALE"]
    datatype = r["DATA_TYPE"]
    if precision:
        datatype += "(" + precision.rstrip(".0") + (("," + scale.rstrip(".0")) if scale else "") + ")"
    elif r["CHAR_LENGTH"] and datatype in ("VARCHAR2", "CHAR", "NVARCHAR2"):
        datatype += "(" + r["CHAR_LENGTH"].rstrip(".0") + ")"
    by_table.setdefault((r["OWNER"], r["TABLE_NAME"]), []).append({
        "name": r["COLUMN_NAME"], "type": datatype, "nullable": r["NULLABLE"] == "Y",
        "key": keys.get((r["OWNER"], r["TABLE_NAME"]), {}).get(r["COLUMN_NAME"], ""),
        "comment": column_comment_map.get((r["OWNER"], r["TABLE_NAME"], r["COLUMN_NAME"]), "")
    })

relations = []
seen = set()
for r in constraints:
    if r["CONSTRAINT_TYPE"] != "R" or not r["R_CONSTRAINT_NAME"]:
        continue
    target = constraint_table.get((r["R_OWNER"] or r["OWNER"], r["R_CONSTRAINT_NAME"]))
    if not target:
        continue
    key = (r["TABLE_NAME"], target, r["CONSTRAINT_NAME"])
    if key not in seen:
        seen.add(key)
        target_column = constraint_columns.get((r["R_OWNER"] or r["OWNER"], r["R_CONSTRAINT_NAME"]), {}).get(r["COLUMN_POSITION"], "")
        relations.append({"from": r["TABLE_NAME"], "to": target, "name": r["CONSTRAINT_NAME"], "column": r["COLUMN_NAME"], "targetColumn": target_column, "status": "confirmed" if r["VALIDATED"] == "VALIDATED" else "inferred"})

result_tables = []
for t in tables:
    name = t["TABLE_NAME"]
    result_tables.append({
        "owner": t["OWNER"], "name": name, "tablespace": t["TABLESPACE_NAME"], "status": t["STATUS"],
        "rows": int(float(t["ESTIMATED_ROW_COUNT"] or 0)), "lastAnalyzed": t["LAST_ANALYZED"],
        "comment": table_comments.get((t["OWNER"], name), ""), "columns": by_table.get((t["OWNER"], name), [])
    })

payload = {
    "schema": "GW", "tables": result_tables, "relationships": relations,
    "counts": {"tables": len(result_tables), "columns": len(columns), "relationships": len(relations), "objects": len(objects), "dependencies": len(dependencies)},
    "reviewFlags": ["Missing table descriptions", "Sequence extract has dependency columns", "Trigger extract has dependency columns", "Index extract has constraint columns"]
}
TARGET.parent.mkdir(parents=True, exist_ok=True)
TARGET.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
print(TARGET, len(result_tables), len(columns), len(relations))
