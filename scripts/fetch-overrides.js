// scripts/fetch-overrides.js
// 目的：スプシのoverridesシートをCSVとして取得し、
//       videoIdをキーにしたオブジェクト形式に変換して保存する

import fs from 'node:fs/promises';

// スプシの「ウェブに公開」で得られるCSVエクスポート用URL
const SPREADSHEET_ID = '1iPH2MT8_pw9uiegwtj5j7kcV4wA2jjBeiepzP4mN5Lo';
const GID = '0';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

const OUTPUT_FILE = 'data/overrides.json';

// シンプルなCSVパーサー
// 注意：セルの中に「カンマ」や「改行」が含まれる場合、ダブルクォートで囲まれている前提で対応する
// （tags列などで長い文章＋カンマを書く可能性があるため、これは重要）
function parseCsv(csvText) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"'; // エスケープされた "" は普通の " として扱う
        i++; // 2文字分読んだので1つ余分に進める
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
        // \r\n の場合、\r の直後の \n は無視する
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

  // 最後の行（末尾に改行がない場合）を拾う
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

async function main() {
  console.log('スプシのoverridesシートを取得しています...');

  const res = await fetch(CSV_URL);
  if (!res.ok) {
    throw new Error(`スプシの取得に失敗しました（ステータス: ${res.status}）。ウェブへの公開設定を確認してください。`);
  }

  const csvText = await res.text();
  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    throw new Error('CSVが空でした。シートに1行目のヘッダーとデータがあるか確認してください。');
  }

  const headers = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1);

  console.log(`ヘッダー: ${headers.join(', ')}`);
  console.log(`データ行数: ${dataRows.length}`);

  // videoIdをキーにしたオブジェクトに変換する
  const overrides = {};

  for (const row of dataRows) {
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = (row[idx] || '').trim();
    });

    if (!record.videoId) continue; // videoIdが空の行（空行など）はスキップ

    overrides[record.videoId] = record;
  }

  console.log(`✅ ${Object.keys(overrides).length} 件のoverridesデータを変換しました`);

  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(overrides, null, 2), 'utf-8');
  console.log(`📝 ${OUTPUT_FILE} に保存しました`);
}

main().catch(err => {
  console.error('エラーが発生しました:', err.message);
  process.exit(1);
});