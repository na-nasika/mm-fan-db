// scripts/lib/csv.js
// 目的：スプシの「ウェブに公開」CSVをパースする共通処理
// （fetch-overrides.js / fetch-category-config.js の両方から使う）

// シンプルなCSVパーサー
// 注意：セルの中に「カンマ」や「改行」が含まれる場合、ダブルクォートで囲まれている前提で対応する
export function parseCsv(csvText) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && nextChar === '\n') continue;
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }
  return rows;
}

// CSVテキスト → ヘッダーをキーにしたオブジェクトの配列 に変換する共通処理
export function csvToRecords(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1);
  return dataRows.map(row => {
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = (row[idx] || '').trim();
    });
    return record;
  });
}