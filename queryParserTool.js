import React, { useState } from "react";
import Papa from "papaparse";

function colLetterToIndex(letter) {
  letter = letter.toUpperCase();
  let sum = 0;
  for (let i = 0; i < letter.length; i++) {
    sum *= 26;
    sum += letter.charCodeAt(i) - 64;
  }
  return sum - 1;
}

function parseQueryString(qs) {
  const params = new URLSearchParams(qs);
  const result = {};
  for (const [k, v] of params.entries()) {
    result[k.toLowerCase()] = v;
  }
  return result;
}

function processRows(data, colLetter, separateItems) {
  const colIndex = colLetterToIndex(colLetter);
  if (colIndex >= data[0].length) throw new Error("Invalid column letter.");

  const parsedRows = [];
  const allKeys = new Set();

  for (let i = 1; i < data.length; i++) {
    try {
      const row = data[i];
      const rawQs = String(row[colIndex]);
      const parsed = parseQueryString(rawQs);

      // Collect itemX patterns
      const itemData = {};
      let maxIndex = 0;
      for (const key in parsed) {
        const match = key.match(/(item|amt|qty|dcnt)(\d+)/);
        if (match) {
          const [, prefix, idxStr] = match;
          const idx = parseInt(idxStr, 10);
          maxIndex = Math.max(maxIndex, idx);
          if (!itemData[idx]) itemData[idx] = {};
          itemData[idx][prefix] = parsed[key];
        }
      }

      const combined = {};
      // Non-item fields
      for (const k in parsed) {
        if (!/(item|amt|qty|dcnt)\d+/.test(k)) {
          combined[k.toLowerCase()] = parsed[k];
        }
      }

      // Handle item data
      if (separateItems) {
        const itemSku = [];
        const itemUnitPrice = [];
        const itemQuantity = [];
        const itemDiscount = [];
        for (let j = 1; j <= maxIndex; j++) {
          itemSku.push(itemData[j]?.item || "");
          itemUnitPrice.push(itemData[j]?.amt || "");
          itemQuantity.push(itemData[j]?.qty || "");
          itemDiscount.push(itemData[j]?.dcnt || "");
        }
        combined["itemSku"] = itemSku.join(";");
        combined["itemUnitPrice"] = itemUnitPrice.join(";");
        combined["itemQuantity"] = itemQuantity.join(";");
        if (itemDiscount.some(Boolean)) {
          combined["itemDiscount"] = itemDiscount.join(";");
        }
      } else {
        const itemsCombined = [];
        for (let j = 1; j <= maxIndex; j++) {
          itemsCombined.push(
            itemData[j]?.item || "",
            itemData[j]?.amt || "",
            itemData[j]?.qty || "",
            itemData[j]?.dcnt || ""
          );
        }
        combined["items"] = itemsCombined.join(";");
      }

      parsedRows.push(combined);
      Object.keys(combined).forEach((k) => allKeys.add(k));
    } catch (e) {
      // skip row on error
      continue;
    }
  }

  // Order columns alphabetically
  const finalKeys = Array.from(allKeys).sort((a, b) => a.localeCompare(b));
  const output = [finalKeys];
  parsedRows.forEach((row) => {
    output.push(finalKeys.map((k) => row[k] || ""));
  });
  return output;
}

export default function QueryParserTool() {
  const [colLetter, setColLetter] = useState("");
  const [separateItems, setSeparateItems] = useState(false);
  const [log, setLog] = useState("");
  const [csvData, setCsvData] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLog("Reading file...");
    Papa.parse(file, {
      complete: (results) => {
        setCsvData(results.data);
        setLog("File loaded.");
      },
      error: () => setLog("Failed to read file."),
    });
  };

  const handleProcess = () => {
    if (!csvData) {
      setLog("No file loaded.");
      return;
    }
    if (!colLetter.match(/^[A-Za-z]+$/)) {
      setLog("Please enter a valid column letter.");
      return;
    }
    try {
      setLog("Processing...");
      const output = processRows(csvData, colLetter, separateItems);
      const csv = Papa.unparse(output);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "parsed_output.csv";
      a.click();
      setLog("✅ Done! File downloaded.");
    } catch (e) {
      setLog("Error: " + e.message);
    }
  };

  return (
    <div className="container">
      <p style ={{ marginBottom: '5rem' }}>
        This tool allows you to upload a CSV file containing query strings, specify which column to parse, and automatically extract and organise the query parameters. It supports separating item-related data into dedicated columns. After processing, you can download a clean, structured CSV ready for further use.
      </p>
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFile}
        className="fileInput"
        />
      <div style={{ margin: "1rem 0" }}>
        <label>
          Column letter:{" "}
          <input
            value={colLetter}
            onChange={(e) => setColLetter(e.target.value)}
            style={{ width: 40, textTransform: "uppercase" }}
          />
        </label>
      </div>
      <div className="separateItemsCheckbox">
        <label>
          <input
            type="checkbox"
            checked={separateItems}
            onChange={(e) => setSeparateItems(e.target.checked)}
          />
          {" "}Separate item data (itemSku, itemUnitPrice, itemQuantity, itemDiscount)
        </label>
      </div>
      <button onClick={handleProcess} style={{ marginTop: "1rem" }} className="runButton">
        Run & Download
      </button>

      
      <p>{log}</p>
    </div>
  );
}