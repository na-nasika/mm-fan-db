// scripts/fetch-videos.js
// 目的：再生リストから動画のメタデータを取得し、
//       概要欄のナンバリング行・ゲスト情報を自動抽出してJSONに保存する

import 'dotenv/config'; // .envファイルの中身をprocess.envに読み込む
import fs from 'node:fs/promises';

const API_KEY = process.env.YOUTUBE_API_KEY;
const PLAYLIST_ID = 'PL0JEZAkG-ps-801q_yaOkUY9jIL180Psw';

if (!API_KEY) {
  console.error('エラー: .envファイルに YOUTUBE_API_KEY が設定されていません');
  process.exit(1);
}

// --- ① 再生リストから動画IDを全件取得する ---
async function fetchAllPlaylistItems(playlistId) {
  let videoIds = [];
  let nextPageToken = '';

  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'contentDetails');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('key', API_KEY);
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      throw new Error(`playlistItems.list エラー: ${data.error.message}`);
    }

    const ids = data.items.map(item => item.contentDetails.videoId);
    videoIds.push(...ids);
    nextPageToken = data.nextPageToken || '';

    console.log(`  取得中... 現在${videoIds.length}件`);
  } while (nextPageToken);

  return videoIds;
}

// --- ② 動画IDのリストから詳細情報を50件ずつ取得する ---
async function fetchVideoDetails(videoIds) {
  const results = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);

    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('id', chunk.join(','));
    url.searchParams.set('key', API_KEY);

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      throw new Error(`videos.list エラー: ${data.error.message}`);
    }

    results.push(...data.items);
    console.log(`  詳細取得中... ${Math.min(i + 50, videoIds.length)}/${videoIds.length}`);
  }

  return results;
}

function extractNumbering(description, title) {
  const lines = description.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const matchWithText = line.match(/^#?(\d+)[ 　]+\S/);
    if (matchWithText) return matchWithText[1];

    const matchNumberOnly = line.match(/^#(\d+)$/);
    if (matchNumberOnly) return matchNumberOnly[1];
  }

  // 概要欄で見つからなかった場合、最後の手段としてタイトル末尾の「#数字」を探す
  // 例: "【マシュマロ】お互いの第一印象は？【答えてみた①】#024"
  const titleMatch = title.trim().match(/#(\d+)$/);
  if (titleMatch) return titleMatch[1];

  return null;
}

// --- ④ 概要欄からゲスト情報を抽出する ---
function extractGuests(description) {
  const sectionMatch = description.match(/【ゲスト出演】([\s\S]*?)(【|$)/);
  if (!sectionMatch) return [];

  const block = sectionMatch[1];
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

  const guests = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('🔶')) {
      current = { name: line.replace('🔶', '').trim(), members: [] };
      guests.push(current);
    } else if (line.startsWith('↪') && current) {
      current.members.push(line.replace('↪', '').trim());
    }
  }

  return guests;
}

// --- メイン処理 ---
async function main() {
  console.log('① 再生リストから動画ID一覧を取得しています...');
  const videoIds = await fetchAllPlaylistItems(PLAYLIST_ID);
  console.log(`→ 合計 ${videoIds.length} 件の動画IDを取得しました`);

  console.log('② 各動画の詳細情報を取得しています...');
  const rawVideos = await fetchVideoDetails(videoIds);

  console.log('③ ナンバリング・ゲスト情報を抽出しています...');
  const videos = [];
  let skipped = 0;
  const skippedList = [];

  for (const item of rawVideos) {
    const title = item.snippet.title;
    const description = item.snippet.description || '';
    const numbering = extractNumbering(description, title); // nullの場合もある

    if (!numbering) {
      skipped++;
      skippedList.push({ title, description });
      // ここではcontinueせず、numbering: null のまま videos に含める
    }

    videos.push({
      videoId: item.id,
      numbering, // nullの場合もある。スプシ側のnumbering_confirmedで後から埋める
      title,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      publishedAt: item.snippet.publishedAt,
      guests_auto: extractGuests(description),
    });
  }

  console.log(`→ ${videos.length} 件を採用、${skipped} 件はナンバリングなしでスキップしました`);

  await fs.mkdir('data', { recursive: true });
  await fs.writeFile('data/videos-raw.json', JSON.stringify(videos, null, 2), 'utf-8');
  console.log('✅ data/videos-raw.json に保存しました');
  // 重複ナンバリングのチェック
  const numberCount = {};
  for (const v of videos) {
    numberCount[v.numbering] = (numberCount[v.numbering] || 0) + 1;
  }
  const duplicates = Object.entries(numberCount).filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('⚠️ 重複しているナンバリングがあります:');
    for (const [num, count] of duplicates) {
      console.log(`  番号 ${num}: ${count}件`);
    }
  } else {
    console.log('✅ ナンバリングの重複はありませんでした');
  }
  await fs.writeFile('data/skipped-debug.json', JSON.stringify(skippedList, null, 2), 'utf-8');
  console.log(`📝 data/skipped-debug.json にスキップ分の詳細を保存しました（${skippedList.length}件）`);
}

main().catch(err => {
  console.error('エラーが発生しました:', err.message);
  process.exit(1);
});