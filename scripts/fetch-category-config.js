// scripts/fetch-category-config.js
// 目的：「カテゴリ設定」シートをCSVとして取得し、
//       [{category, parent, order}, ...] の配列として保存する
// 同じcategory名が複数行あってもOK（1つのカテゴリが複数の親を持てるようにするため）
// このデータは動画の絞り込みロジックには使わず、ドロップダウンの「見た目の並び・グループ分け」だけに使う
import fs from 'node:fs/promises';
import { csvToRecords } from './lib/csv.js';

const SPREADSHEET_ID = '1iPH2MT8_pw9uiegwtj5j7kcV4wA2jjBeiepzP4mN5Lo';
const GID = '1166342232';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;
const OUTPUT_FILE = 'data/category-config.json';

async function main() {
  console.log('スプシのカテゴリ設定シートを取得しています...');
  const res = await fetch(CSV_URL);
  if (!res.ok) {
    throw new Error(`スプシの取得に失敗しました（ステータス: ${res.status}）。ウェブへの公開設定を確認してください。`);
  }
  const csvText = await res.text();
  const records = csvToRecords(csvText);
  console.log(`データ行数: ${records.length}`);

  const rows = records
    .filter(r => r.category) // category列が空の行はスキップ
    .map(r => ({
      category: r.category,
      parent: r.parent || '', // 空欄ならメイン扱い
      order: r.order ? Number(r.order) : 0,
    }));

  console.log(`✅ ${rows.length} 件のカテゴリ設定を変換しました`);
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(rows, null, 2), 'utf-8');
  console.log(`📝 ${OUTPUT_FILE} に保存しました`);
}

main().catch(err => {
  console.error('エラーが発生しました:', err.message);
  process.exit(1);
});