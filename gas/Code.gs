/**
 * 課程練習作業查詢 API（獨立 Apps Script Web App）
 * 資料來源：line-notebook-ocr 寫入的「辨識結果」分頁。
 * 只回傳學號完全相符的列，且只回傳白名單欄位；姓名遮罩、不回傳原始全文與圖片連結。
 */
var SPREADSHEET_ID = '1RDZU3DyBfN_Y9j_xec6kH0GrAZY2CkoaTfzvvmFX5eA';
var RESULT_SHEET = '辨識結果';
var NOTICE_SHEET = '說明';

// 回傳欄位：[輸出鍵, 試算表標頭]
var FIELDS = [
  ['batch', '記事本名稱'],
  ['tool', '工具名稱'],
  ['topic', '練習主題'],
  ['group', '組別'],
  ['dept', '系所'],
  ['name', '姓名'],
  ['qty', '練習數量'],
  ['date', '產出日期'],
  ['loggedAt', '辨識時間']
];

function doGet(e) {
  var p = (e && e.parameter) || {};
  var out;
  try {
    out = p.action === 'notice' ? getNotice_() : lookup_(p.sid);
  } catch (err) {
    out = { ok: false, error: '查詢失敗：' + err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeSid_(s) {
  return String(s == null ? '' : s)
    .replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

function maskName_(name) {
  var s = String(name || '').trim();
  if (s.length <= 1) return s;
  if (s.length === 2) return s.charAt(0) + '*';
  return s.charAt(0) + new Array(s.length - 1).join('*') + s.charAt(s.length - 1);
}

function cellText_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy/MM/dd HH:mm:ss').replace(/ 00:00:00$/, '');
  return String(v == null ? '' : v).trim();
}

// 讀「辨識結果」精簡成 [學號, 白名單欄位…]，快取 CACHE_SECONDS 秒，減少 openById 次數
var CACHE_SECONDS = 300;

function loadTable_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('table');
  if (hit) return JSON.parse(hit);

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(RESULT_SHEET);
  if (!sh) throw new Error('找不到「' + RESULT_SHEET + '」分頁');
  var values = sh.getDataRange().getValues();
  var header = values[0].map(function (h) { return String(h).trim(); });
  var sidCol = header.indexOf('學號');
  if (sidCol < 0) throw new Error('表頭找不到「學號」欄位');
  var cols = FIELDS.map(function (f) { return header.indexOf(f[1]); });
  var tz = ss.getSpreadsheetTimeZone();

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var sid = normalizeSid_(values[r][sidCol]);
    if (!sid) continue;
    rows.push([sid].concat(cols.map(function (c) { return c < 0 ? '' : cellText_(values[r][c], tz); })));
  }
  var json = JSON.stringify(rows);
  if (json.length < 95000) cache.put('table', json, CACHE_SECONDS); // CacheService 單筆上限 100KB
  return rows;
}

function lookup_(rawSid) {
  var sid = normalizeSid_(rawSid);
  if (!/^[A-Z0-9]{6,12}$/.test(sid)) return { ok: false, error: '請輸入正確的學號（6～12 碼英數字）' };

  var records = loadTable_().filter(function (row) { return row[0] === sid; }).map(function (row) {
    var rec = {};
    FIELDS.forEach(function (f, i) { rec[f[0]] = row[i + 1]; });
    rec.name = maskName_(rec.name);
    return rec;
  });
  records.sort(function (a, b) {
    return (b.date + b.loggedAt).localeCompare(a.date + a.loggedAt);
  });

  var byTool = {};
  var totalQty = 0;
  records.forEach(function (x) {
    var key = x.tool || '（未辨識工具）';
    byTool[key] = (byTool[key] || 0) + 1;
    totalQty += parseInt(x.qty, 10) || 0;
  });
  var out = { ok: true, sid: sid, count: records.length, totalQty: totalQty, byTool: byTool, records: records };
  if (!records.length) out.notice = getNotice_().lines; // 查無資料時一併附上規範，前端不必再打一次
  return out;
}

function getNotice_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('notice');
  if (hit) return { ok: true, lines: JSON.parse(hit) };
  var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(NOTICE_SHEET);
  if (!sh) return { ok: true, lines: [] };
  var lines = [];
  sh.getRange(1, 1, sh.getLastRow() || 1, 1).getValues().forEach(function (row) {
    var t = String(row[0] || '').trim();
    if (t && lines[lines.length - 1] !== t) lines.push(t); // 合併儲存格會重複讀到同一段
  });
  cache.put('notice', JSON.stringify(lines), CACHE_SECONDS);
  return { ok: true, lines: lines };
}

// 在編輯器手動執行一次以完成 OAuth 授權
function testLookup() {
  Logger.log(JSON.stringify(lookup_('412221107')));
  Logger.log(JSON.stringify(getNotice_()));
}
