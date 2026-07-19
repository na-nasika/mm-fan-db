// scripts/merge-and-build.js
// 目的：videos-raw.json（自動抽出）と overrides.json（人力データ）をマージし、
//       カテゴリ設定（category-config.json）を使ってカテゴリツリーを組み立てて、
//       サイトが実際に表示する最終データ（src/data/videos.json）を生成する
import fs from 'node:fs/promises';

const VIDEOS_RAW_FILE = 'data/videos-raw.json';
const OVERRIDES_FILE = 'data/overrides.json';
const CATEGORY_CONFIG_FILE = 'data/category-config.json';
const OUTPUT_FILE = 'src/data/videos.json';

function formatGuestsAuto(guestsAuto) {
  if (!guestsAuto || guestsAuto.length === 0) return '';
  return guestsAuto.join(', ');
}

// 動画に実際に使われているカテゴリ一覧と、カテゴリ設定（行の配列）を突き合わせて
// 「メイン→サブ」のツリー構造と「未分類」を組み立てる
// ポイント：1つのカテゴリが複数の行（＝複数の親）を持てる
function buildCategoryTree(usedCategories, categoryConfigRows) {
  // parentが空欄の行＝メインカテゴリの候補
  const mainOrderMap = new Map(); // category名 → order（重複行があれば一番小さいorderを採用）
  for (const row of categoryConfigRows) {
    if (row.parent) continue;
    if (!mainOrderMap.has(row.category) || row.order < mainOrderMap.get(row.category)) {
      mainOrderMap.set(row.category, row.order);
    }
  }
  const mainNames = [...mainOrderMap.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);

  const tree = mainNames
    .map(mainName => {
      // このメインを親に持つ行を集める（同じサブが複数回出てくることはない前提だが、念のため重複除去）
      const subOrderMap = new Map();
      for (const row of categoryConfigRows) {
        if (row.parent !== mainName) continue;
        if (!subOrderMap.has(row.category) || row.order < subOrderMap.get(row.category)) {
          subOrderMap.set(row.category, row.order);
        }
      }
      const subs = [...subOrderMap.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([name]) => name)
        .filter(name => usedCategories.has(name)); // 実際に動画に付いているものだけ表示
      return { main: mainName, subs };
    })
    .filter(group => group.subs.length > 0); // 中身が空のメインは表示しない

  // 「サブとして」どこかに登録されているカテゴリ名の集合（複数の親を持つ場合も1つにまとまる）
  const configuredSubNames = new Set(
    categoryConfigRows.filter(row => row.parent).map(row => row.category)
  );
  const configuredMainNames = new Set(mainNames);

  // 動画には使われているが、メインにもサブにも登録されていないカテゴリ＝未分類
  const uncategorized = [...usedCategories]
    .filter(name => !configuredSubNames.has(name) && !configuredMainNames.has(name))
    .sort();

  return { tree, uncategorized };
}

async function main() {
  console.log('videos-raw.json / overrides.json / category-config.json を読み込んでいます...');
  const videosRaw = JSON.parse(await fs.readFile(VIDEOS_RAW_FILE, 'utf-8'));
  const overrides = JSON.parse(await fs.readFile(OVERRIDES_FILE, 'utf-8'));

  // category-config.jsonがまだ無い場合（初回移行時）にエラーで落ちないようにフォールバック
  let categoryConfigRows = [];
  try {
    categoryConfigRows = JSON.parse(await fs.readFile(CATEGORY_CONFIG_FILE, 'utf-8'));
  } catch {
    console.log('⚠️ category-config.json が見つからないため、階層なし（全て未分類）として扱います');
  }

  console.log(`自動抽出データ: ${videosRaw.length}件`);
  console.log(`人力overridesデータ: ${Object.keys(overrides).length}件`);

  const finalVideos = [];
  let excludedNoNumbering = 0;
  let excludedManually = 0;

  for (const video of videosRaw) {
    const override = overrides[video.videoId] || {};

    if (override.exclude?.toUpperCase() === 'TRUE') {
      excludedManually++;
      continue;
    }

    const numbering = override.numbering_confirmed || video.numbering || null;
    if (!numbering) {
      excludedNoNumbering++;
      continue;
    }

    const guest = override.guest_confirmed || formatGuestsAuto(video.guests_auto);

    const categoryRaw = override.category_confirmed || '未分類';
    const categories = categoryRaw
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    const tags = override.tags || '';

    finalVideos.push({
      videoId: video.videoId,
      numbering,
      title: video.title,
      thumbnail: video.thumbnail,
      url: video.url,
      publishedAt: video.publishedAt,
      guest,
      categories,
      tags,
    });
  }

  finalVideos.sort((a, b) => Number(a.numbering) - Number(b.numbering));

  // 実際に動画に使われている全カテゴリを集める
  const usedCategories = new Set(finalVideos.flatMap(v => v.categories));
  const categoryTree = buildCategoryTree(usedCategories, categoryConfigRows);
  console.log(`✅ 最終データ: ${finalVideos.length}件（ナンバリング不明で除外: ${excludedNoNumbering}件、手動除外: ${excludedManually}件）`);
  console.log(`✅ カテゴリツリー: メイン${categoryTree.tree.length}件、未分類${categoryTree.uncategorized.length}件`);

  await fs.mkdir('src/data', { recursive: true });
  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify({ videos: finalVideos, categoryTree }, null, 2),
    'utf-8'
  );
  console.log(`📝 ${OUTPUT_FILE} に保存しました`);
}

main().catch(err => {
  console.error('エラーが発生しました:', err.message);
  process.exit(1);
});