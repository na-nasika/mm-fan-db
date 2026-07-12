// scripts/export-for-sheet.js
// 目的：videos-raw.json の内容を、確定用の空欄列も含めた形でCSVに変換する。
//       これをそのまま "overrides" シートにインポートすれば、
//       全件を見ながらスクロールして必要な行だけ埋められる作業台帳になる。

import fs from 'node:fs/promises';

const INPUT_FILE = 'data/videos-raw.json';
const OUTPUT_FILE = 'data/overrides-template.csv';

function formatGuestsAuto(guestsAuto) {
  if (!guestsAuto || guestsAuto.length === 0) return '';
  return guestsAuto
    .map(g => (g.members?.length > 0 ? `${g.name}（${g.members.join(', ')}）` : g.name))
    .join(', ');
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const videos = JSON.parse(await fs.readFile(INPUT_FILE, 'utf-8'));

  // 見る専用の列(_ref)と、実際に手入力する列(_confirmed等)を両方並べる
  const headers = [
    'videoId',
    'numbering_ref',   // 参照用：自動抽出されたナンバリング
    'title_ref',       // 参照用：タイトル
    'guest_auto_ref',  // 参照用：自動抽出されたゲスト候補
    'numbering_confirmed', // 手入力：ナンバリングが漏れていた場合の補完
    'guest_confirmed',     // 手入力：ゲスト名の確定値
    'category_confirmed',  // 手入力：カテゴリ
    'tags',                 // 手入力：検索用の自由記述
    'memo',                 // 手入力：備考
  ];

  const lines = [headers.join(',')];

  for (const v of videos) {
    const row = [
      v.videoId,
      v.numbering || '',
      v.title,
      formatGuestsAuto(v.guests_auto),
      '', // numbering_confirmed（空欄）
      '', // guest_confirmed（空欄）
      '', // category_confirmed（空欄）
      '', // tags（空欄）
      '', // memo（空欄）
    ];
    lines.push(row.map(csvEscape).join(','));
  }

  await fs.writeFile(OUTPUT_FILE, lines.join('\n'), 'utf-8');
  console.log(`✅ ${videos.length}件を ${OUTPUT_FILE} に書き出しました`);
}

main().catch(err => {
  console.error('エラーが発生しました:', err.message);
  process.exit(1);
});