// scripts/merge-and-build.js
// 目的：videos-raw.json（自動抽出）と overrides.json（人力データ）をマージし、
//       サイトが実際に表示する最終データ（src/data/videos.json）を生成する

import fs from 'node:fs/promises';

const VIDEOS_RAW_FILE = 'data/videos-raw.json';
const OVERRIDES_FILE = 'data/overrides.json';
const OUTPUT_FILE = 'src/data/videos.json';

// 自動抽出したゲスト情報（{name, members}の配列）を、表示用の1つの文字列に変換する
// 例: [{name: "Marpril", members: ["立花鈴", "谷田透佳"]}] → "Marpril（立花鈴, 谷田透佳）"
function formatGuestsAuto(guestsAuto) {
  if (!guestsAuto || guestsAuto.length === 0) return '';

  return guestsAuto
    .map(g => {
      if (g.members && g.members.length > 0) {
        return `${g.name}（${g.members.join(', ')}）`;
      }
      return g.name;
    })
    .join(', ');
}

async function main() {
  console.log('videos-raw.json と overrides.json を読み込んでいます...');

  const videosRaw = JSON.parse(await fs.readFile(VIDEOS_RAW_FILE, 'utf-8'));
  const overrides = JSON.parse(await fs.readFile(OVERRIDES_FILE, 'utf-8'));

  console.log(`自動抽出データ: ${videosRaw.length}件`);
  console.log(`人力overridesデータ: ${Object.keys(overrides).length}件`);

  const finalVideos = [];
  let excludedNoNumbering = 0;

  for (const video of videosRaw) {
    const override = overrides[video.videoId] || {};

    // ① ナンバリング：confirmed優先、なければ自動、どちらもなければ除外
    const numbering = override.numbering_confirmed || video.numbering || null;
    if (!numbering) {
      excludedNoNumbering++;
      continue;
    }

    // ② ゲスト：confirmed優先（人力の文章そのまま）、なければ自動抽出を整形
    const guest = override.guest_confirmed || formatGuestsAuto(video.guests_auto);

    // ③ カテゴリ：confirmed優先、なければ未分類
    const category = override.category_confirmed || '未分類';

    // ④ タグ・検索用の自由記述文章
    const tags = override.tags || '';

    finalVideos.push({
      videoId: video.videoId,
      numbering,
      title: video.title,
      thumbnail: video.thumbnail,
      url: video.url,
      publishedAt: video.publishedAt,
      guest,
      category,
      tags,
    });
  }

  // ナンバリングの数字順に並び替え（文字列のままだと "10" が "2" より前に来てしまうため、数値に変換して比較）
  finalVideos.sort((a, b) => Number(a.numbering) - Number(b.numbering));

  console.log(`✅ 最終データ: ${finalVideos.length}件（ナンバリング不明で除外: ${excludedNoNumbering}件）`);

  await fs.mkdir('src/data', { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(finalVideos, null, 2), 'utf-8');
  console.log(`📝 ${OUTPUT_FILE} に保存しました`);
}

main().catch(err => {
  console.error('エラーが発生しました:', err.message);
  process.exit(1);
});