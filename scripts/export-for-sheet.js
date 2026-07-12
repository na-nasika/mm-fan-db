// scripts/export-for-sheet.js
// 目的：videos-raw.json の内容を、確定用の空欄列も含めた形でCSVに変換する。
//       これをそのまま "overrides" シートにインポートすれば、
//       全件を見ながらスクロールして必要な行だけ埋められる作業台帳になる。

import fs from 'node:fs/promises';

const INPUT_FILE = 'data/videos-raw.json';
const OUTPUT_FILE = 'data/overrides-template.csv';

function formatGuestsAuto(guestsAuto) {
  if (!guestsAuto || guestsAuto.length === 0) return '';
  return guestsAuto.join(', '); // 個人名だけのシンプルな配列になったので、そのまま繋げるだけでOK
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
    'numbering_ref',
    'title_ref',
    'guest_auto_ref',
    'numbering_confirmed',
    'guest_confirmed',
    'category_confirmed',
    'tags',
    'exclude', // TRUE と書くと、その動画をサイトから除外する
    'memo',
  ];

  const lines = [headers.join(',')];

  for (const v of videos) {
    const row = [
      v.videoId,
      v.numbering || '',
      v.title,
      formatGuestsAuto(v.guests_auto),
      '', // numbering_confirmed
      '', // guest_confirmed
      '', // category_confirmed
      '', // tags
      '', // exclude ← この行を追加
      '', // memo
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