const $ = (selector, root = document) => root.querySelector(selector);
const ASSETS = '/public/assets/';
const FIGMA = 'https://www.figma.com/design/kIbEI0tqwTMeqot5cqOBYG';
const STORAGE_KEY = 'light-up.warm-living.v1';
const defaults = () => ({
  name: '희진', email: 'hello@example.com', house: '희진의 집', room: '거실',
  lampName: '거실 펜던트', lightOn: true, climateOn: true, brightness: 64,
  kelvin: 2700, temperature: 24, connected: true,
  notifications: { connection: true, routine: true, news: false },
  routines: [
    { id: 'morning', name: '기분 좋은 아침', time: '07:00', repeat: '평일', enabled: true, brightness: 80 },
    { id: 'evening', name: '편안한 귀가', time: '18:30', repeat: '매일', enabled: true, brightness: 64 },
    { id: 'sleep', name: '취침 준비', time: '23:00', repeat: '매일', enabled: false, brightness: 0 }
  ]
});
function loadState() {
  const base = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return base;
    const state = { ...base, ...saved, notifications: { ...base.notifications, ...saved.notifications } };
    state.brightness = clamp(Number(state.brightness) || 0, 0, 100);
    state.temperature = clamp(Number(state.temperature) || 24, 16, 30);
    if (!Array.isArray(state.routines)) state.routines = base.routines;
    if (!['거실', '주방', '침실'].includes(state.room)) state.room = '거실';
    return state;
  } catch { return base; }
}
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
let state = loadState();
let current = '';
let navigation = [];
let formMemory = {};
let routineDraft = null;
let lastSaved = null;
let timer;
let toastTimer;
let busy = false;
let dialogReturn = 'signup';
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const e = escapeHTML;
const routes = {
 welcome: ['웰컴', '집이 나를 반기는 순간', ''],
 onboardingLight: ['조명 온보딩', '빛으로 완성하는 취향', '밝기부터 색온도까지, 내 마음에 맞게.'],
 onboardingClimate: ['온도 온보딩', '늘 쾌적한 우리 집', '공간의 온도와 하루의 루틴을 함께 관리해요.'],
 login: ['로그인', '다시 만나 반가워요', '이메일로 나만의 집에 접속하세요.'],
 signup: ['회원가입', '처음 오셨군요!', '이메일로 간편하게 가입하세요.'],
 reset: ['비밀번호 재설정', '비밀번호 재설정', '가입한 이메일로 재설정 안내를 보내드려요.'],
 resetSent: ['메일 안내', '메일을 확인해 주세요', '비밀번호 재설정 안내를 확인해 주세요.'],
 loginError: ['로그인 오류', '로그인을 확인해 주세요', '입력한 정보를 다시 확인해 주세요.'],
 permissions: ['권한 안내', '연결을 준비할게요', '기기를 찾고 중요한 소식을 전하기 위한 권한이에요.'],
 emptyHome: ['빈 홈', '나만의 집을 시작해요', '아직 연결된 기기가 없어요.'],
 addDevice: ['기기 검색', '주변 기기를 찾았어요', '전원이 켜진 기기와 가까이 있어 주세요.'],
 wifi: ['Wi-Fi 연결', '집의 Wi-Fi에 연결', '기기가 사용할 2.4GHz 네트워크를 선택하세요.'],
 connected: ['연결 완료', '연결이 완료됐어요', '첫 번째 빛이 당신의 집에 도착했어요.'],
 home: ['홈 대시보드', '좋은 저녁이에요, 희진님', '집 안의 편안함을 한눈에 확인하세요.'],
 rooms: ['공간 관리', '공간별로 관리해요', '연결된 기기를 공간에 맞춰 정리하세요.'],
 light: ['조명 조절', '나만의 빛을 만들어요', '거실 펜던트 · 연결됨'],
 lightOff: ['조명 꺼짐', '조명이 꺼져 있어요', '거실 펜던트 · 연결됨'],
 lightWarm: ['조명 적용', '따뜻한 저녁을 준비했어요', '거실 펜던트 · 설정이 적용됐어요.'],
 climate: ['온도 조절', '공간에 맞는 온도', '거실 · 현재 22°C · 습도 45%'],
 climate25: ['온도 올리기 완료', '목표 온도를 변경했어요', '거실 · 현재 22°C · 습도 45%'],
 routines: ['예약 목록', '하루를 자동으로', '빛과 온도가 생활 리듬을 따라가요.'],
 editRoutine: ['예약 만들기', '아침 예약 만들기', '반복되는 하루를 더 편하게.'],
 saved: ['예약 저장 완료', '예약을 저장했어요', '매일의 시작이 조금 더 편안해질 거예요.'],
 settings: ['설정', '나의 light-up', '우리 집과 계정을 관리하세요.'],
 notifications: ['알림 설정', '필요한 소식만 받을게요', '원하는 알림을 선택해 주세요.'],
 offline: ['기기 오프라인', '기기와 연결이 끊겼어요', '침실 무드등 · 마지막 연결 10분 전'],
 scanFailed: ['연결 실패', '연결을 다시 확인해요', '잠시 후 다시 시도해 주세요.'],
 account: ['계정 관리', '계정 관리', '프로필과 사용 중인 집을 확인하세요.'],
 terms: ['이용약관', '이용약관 안내', '서비스 이용 전 확인해 주세요.'],
 privacy: ['개인정보 안내', '개인정보 처리 안내', '어떤 정보가 필요한지 투명하게 안내해요.'],
 climate23: ['온도 내리기 완료', '목표 온도를 변경했어요', '거실 · 현재 22°C · 습도 45%']
};
const routeKeys = Object.keys(routes);
const screen = $('#app-screen');
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { toast('현재 브라우저에서는 새로고침 후 설정이 유지되지 않아요.'); }
}
function toast(message) {
  clearTimeout(toastTimer);
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('visible');
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2400);
}
function go(route, { replace = false } = {}) {
  if (!routes[route]) route = 'welcome';
  captureForm();
  clearTimeout(timer);
  busy = false;
  if (route === 'terms' || route === 'privacy') dialogReturn = current || 'signup';
  if (route === 'editRoutine' && current !== 'editRoutine' && !routineDraft) routineDraft = { id: '', name: '기분 좋은 아침', time: '07:00', repeat: '평일', brightness: 80, enabled: true };
  if (current && current !== route && !replace) navigation.push(current);
  if (current !== route) {
    history[replace ? 'replaceState' : 'pushState']({ route }, '', '/#/' + route);
  }
  current = route;
  render();
}
function back() {
  if (current === 'terms' || current === 'privacy') { navigation.pop(); return go(dialogReturn, { replace: true }); }
  go(navigation.pop() || 'home', { replace: true });
}
function captureForm() {
  const form = $('form', screen);
  if (!form) return;
  const data = Object.fromEntries(new FormData(form));
  // Passwords never enter browser persistence or form-memory state.
  delete data.password; delete data.wifiPassword;
  formMemory[current] = data;
}
function at(y, content, cls = '') { return '<section class="positioned ' + cls + '" style="--y:' + y + 'px">' + content + '</section>'; }
function btn(label, route, secondary = false, extra = '') {
  return '<button type="button" class="btn' + (secondary ? ' secondary' : '') + '" ' + (route ? 'data-route="' + route + '"' : '') + ' ' + extra + '>' + e(label) + '</button>';
}
function link(label, route, extra = '') { return '<button type="button" class="text-button" ' + (route ? 'data-route="' + route + '"' : '') + ' ' + extra + '>' + e(label) + '</button>'; }
function field(label, name, value, type = 'text', extra = '') {
  return '<label class="field"><span>' + e(label) + '</span><input name="' + name + '" type="' + type + '" value="' + e(value) + '" ' + extra + '></label>';
}
function chips(items, value, action = 'room') {
  return '<div class="chips" role="group" aria-label="' + (action === 'kelvin' ? '색온도' : action === 'repeat' ? '반복 요일' : '공간 선택') + '">' + items.map(item => '<button type="button" class="chip' + (String(value) === String(item) ? ' selected' : '') + '" aria-pressed="' + (String(value) === String(item)) + '" data-action="' + action + '" data-value="' + e(item) + '">' + e(item) + (action === 'kelvin' ? 'K' : '') + '</button>').join('') + '</div>';
}
function toggle(name, on, label) {
  return '<button type="button" class="switch" role="switch" aria-checked="' + !!on + '" aria-label="' + e(label) + '" data-action="toggle" data-key="' + e(name) + '"><img src="' + ASSETS + (on ? 'fb5f6.svg' : 'fd60c.svg') + '" width="48" height="28" alt=""></button>';
}
function card(title, subtitle, target = '', switchKey = '', on = true, offline = false) {
  const content = '<strong>' + e(title) + '</strong><small' + (offline ? ' class="error-text"' : '') + '>' + e(subtitle) + '</small>';
  return '<article class="device-card">' + (target ? '<button class="card-main" type="button" data-route="' + target + '">' + content + '</button>' : '<div class="card-main">' + content + '</div>') +
    (switchKey ? toggle(switchKey, on, title + ' ' + (on ? '끄기' : '켜기')) : '<img class="switch-indicator" src="' + ASSETS + (offline ? 'a003a.svg' : on ? 'fb5f6.svg' : 'fd60c.svg') + '" width="48" height="28" alt="' + (offline ? '오프라인' : on ? '활성' : '비활성') + '">') + '</article>';
}
function nav(active) {
  return '<nav class="bottom-nav" aria-label="앱 내비게이션">' + [['home', '홈'], ['rooms', '공간'], ['routines', '예약'], ['settings', '설정']].map(([key, label]) => '<button type="button" data-route="' + key + '"' + (active === key ? ' aria-current="page"' : '') + '>' + label + '</button>').join('') + '</nav>';
}
function lamp(y, off = false) {
  const kelvin = [2700, 4000, 6500].includes(Number(state.kelvin)) ? state.kelvin : 2700;
  const intensity = clamp(Number(state.brightness) || 0, 0, 100) / 100;
  const base = off ? '' : '<img class="lamp-base" src="' + ASSETS + 'lamp-unlit.svg" width="270" height="245" alt="?? ??? ??">';
  return '<div class="lamp-slot' + (off ? ' off' : '') + '" style="--y:' + y + 'px;--lamp-intensity:' + intensity + '">' + base + '<img class="lamp-art" src="' + ASSETS + (off ? '30ead.svg' : 'lamp-' + kelvin + '.svg') + '" width="' + (off ? 240 : 270) + '" height="' + (off ? 220 : 245) + '" alt="' + (off ? '?? ??? ??' : '') + '"></div>';
}
function statusArt(symbol, y = 239, error = false) {
  return '<div class="status-art' + (error ? ' error' : '') + '" style="--y:' + y + 'px"><img src="' + ASSETS + '7b4de.svg" width="148" height="148" alt=""><span class="display">' + e(symbol) + '</span></div>';
}
function notice(text) { return '<p class="caption center">' + e(text) + '</p>'; }
function submit(label) { return '<button type="submit" class="btn" data-submit>' + e(label) + '</button>'; }
function formStart(id, y) { return '<form id="' + id + '" class="positioned" style="--y:' + y + 'px" novalidate>'; }
function formError() { return '<p class="form-error" role="alert" id="form-error"></p>'; }
function header() {
  if (current === 'welcome') return '';
  let title = routes[current][1];
  let sub = routes[current][2];
  if (current === 'home') title = '좋은 저녁이에요, ' + state.name + '님';
  if (['light', 'lightOff', 'lightWarm'].includes(current)) sub = state.lampName + (current === 'lightWarm' ? ' · 설정이 적용됐어요.' : ' · 연결됨');
  if (['climate', 'climate25', 'climate23'].includes(current)) sub = state.room + ' · 현재 22°C · 습도 45%';
  const backButton = current === 'home' ? '<button type="button" class="add-button" data-route="addDevice" aria-label="기기 추가">＋</button>' : '<button type="button" class="back-button" data-action="back" aria-label="뒤로 가기">‹</button>';
  return backButton + '<header class="page-heading"><h2 tabindex="-1">' + e(title) + '</h2><p>' + e(sub) + '</p></header>';
}
function roomChips() { return chips(['거실', '주방', '침실'], state.room); }
function template() {
  const memo = formMemory[current] || {};
  switch (current) {
    case 'welcome': return at(64, '<p class="brand-display">light-up</p><p class="caption" style="margin:5px 0 0 5px">일상에 따뜻함을 더하다</p>') + lamp(179) + at(430, '<h2 class="section-title">집이 나를 반기는 순간</h2>') + at(477, '<p class="body-copy">빛과 온도를 하나로 연결해<br>당신만의 편안한 공간을 만드세요.</p>') + at(565, btn('시작하기', 'onboardingLight') + btn('이미 계정이 있어요', 'login', true), 'stack');
    case 'onboardingLight': return lamp(219) + at(464, chips([2700, 4000, 6500], state.kelvin, 'kelvin')) + at(546, '<p class="caption">01 / 02</p>') + at(584, btn('다음', 'onboardingClimate')) + at(646, link('건너뛰기', 'login'));
    case 'onboardingClimate': return statusArt('24°', 262) + at(466, notice('귀가 시간에 맞춰, 미리 편안하게.')) + at(546, '<p class="caption">02 / 02</p>') + at(584, btn('로그인하고 시작', 'login')) + at(646, link('먼저 둘러보기', 'home'));
    case 'login':
    case 'loginError': return formStart('login-form', 210) + '<div class="stack" style="--gap:16px">' + field('이메일', 'email', memo.email || state.email, 'email', 'required autocomplete="email"') + field('비밀번호', 'password', '', 'password', 'required minlength="8" autocomplete="current-password" placeholder="8자 이상 입력해 주세요"') + '</div><div style="margin-top:10px">' + (current === 'loginError' ? '<p class="form-error" role="alert">이메일 또는 비밀번호를 다시 확인해 주세요.</p>' : link('비밀번호를 잊으셨나요?', 'reset', 'style="margin-left:auto;margin-right:0"')) + '</div><div style="margin-top:28px">' + formError() + submit(current === 'loginError' ? '다시 로그인' : '로그인') + '</div></form>' + at(529, btn(current === 'loginError' ? '비밀번호 재설정' : '새 계정 만들기', current === 'loginError' ? 'reset' : 'signup', true)) + at(601, link('로그인 오류 예시 보기', 'loginError')) + at(653, notice('데모: 이메일 형식 + 8자 이상 비밀번호'));
    case 'signup': return formStart('signup-form', 196) + '<div class="stack" style="--gap:9px">' + field('이름', 'name', memo.name || state.name, 'text', 'required maxlength="8" autocomplete="given-name"') + field('이메일', 'email', memo.email || state.email, 'email', 'required autocomplete="email"') + field('비밀번호 · 8자 이상', 'password', '', 'password', 'required minlength="8" autocomplete="new-password" placeholder="8자 이상 입력해 주세요"') + '</div><label class="agreement" style="margin-top:27px"><input name="agree" type="checkbox" required ' + (memo.agree ? 'checked' : '') + '><span>[필수] 이용약관 및 개인정보 동의</span></label><div class="inline">' + link('이용약관 보기', 'terms') + link('개인정보 보기', 'privacy') + '</div>' + formError() + '<div style="margin-top:42px">' + submit('동의하고 가입하기') + '</div></form>' + at(660, notice('체험 시안에서는 예시 정보로 진행합니다.'));
    case 'reset': return formStart('reset-form', 236) + field('이메일', 'email', memo.email || state.email, 'email', 'required autocomplete="email"') + formError() + '<div style="margin-top:25px">' + submit('재설정 메일 안내 보기') + '</div></form>' + at(462, '<p class="caption">이 데모에서는 실제 메일을 보내지 않습니다.<br>메일 안내 화면으로 이동합니다.</p>');
    case 'resetSent': return statusArt('✓') + at(432, '<p class="body-copy center" style="color:var(--light-color-text)">' + e(formMemory.reset?.email || state.email) + '</p>') + at(477, '<p class="body-copy center">받은 메일의 링크에서 비밀번호를 변경한 뒤<br>다시 로그인해 주세요.</p>') + at(550, notice('프로토타입 안내 화면 · 실제 발송 없음')) + at(590, btn('로그인으로 돌아가기', 'login'));
    case 'permissions': return at(221, card('주변 기기 · 연결에 필요', '블루투스로 가까운 조명을 찾습니다.', '', 'permission', true)) + at(328, card('알림 · 선택', '예약 실행과 연결 상태를 알려드려요.', '', 'news', state.notifications.news)) + at(450, '<p class="caption">알림은 나중에 설정에서 변경할 수 있어요.<br>데모에서는 실제 권한을 요청하지 않습니다.</p>') + at(579, btn('계속하기', 'emptyHome')) + at(642, link('알림 없이 계속', 'emptyHome'));
    case 'emptyHome': return statusArt('', 219) + '<img src="' + ASSETS + '6e0e8.svg" width="118" height="118" style="position:absolute;left:110px;top:234px" alt="">' + lamp(194) + at(437, '<h3 class="section-title" style="font-size:21px">첫 번째 빛을 연결해 볼까요?</h3>') + at(488, '<p class="body-copy">전원을 켠 스마트 조명을 가까이 두고<br>기기 추가를 눌러 주세요.</p>') + at(579, btn('첫 기기 추가', 'addDevice')) + at(641, link('샘플 홈 둘러보기', 'home'));
    case 'addDevice': return at(190, notice('1 기기 선택  —  2 Wi-Fi  —  3 완료')) + statusArt('⌁', 228) + at(430, card('Light Pendant 01', '스마트 조명 · 연결 가능', 'wifi')) + at(553, btn('이 기기 연결', 'wifi')) + at(627, link('기기가 보이지 않아요', 'scanFailed'));
    case 'wifi': return at(190, notice('1 기기 선택  —  2 Wi-Fi  —  3 완료')) + formStart('wifi-form', 236) + '<div class="stack" style="--gap:23px">' + field('네트워크', 'network', memo.network || 'Light_Home_2.4G', 'text', 'required') + field('Wi-Fi 비밀번호', 'wifiPassword', '', 'password', 'required minlength="8" placeholder="8자 이상 입력해 주세요" autocomplete="off"') + '</div><p class="caption" style="margin-top:32px">휴대폰과 기기를 같은 네트워크에 연결해 주세요.<br>데모이므로 실제 Wi-Fi에 연결하지 않습니다.</p><div style="margin-top:92px">' + formError() + submit('연결하기') + '</div></form>' + at(643, link('연결 실패 예시 보기', 'scanFailed'));
    case 'connected': return statusArt('✓', 209) + formStart('connected-form', 408) + field('기기 이름', 'lampName', memo.lampName || state.lampName, 'text', 'required maxlength="16"') + '<div style="margin-top:21px">' + roomChips() + '</div><div style="margin-top:23px">' + formError() + submit(state.room + '에 추가하고 시작') + '</div></form>';
    case 'home': return at(192, roomChips()) + at(249, '<button class="scene-card" type="button" data-action="evening"><small>EVENING SCENE</small><strong>편안한 저녁</strong></button>', 'stack') + at(350, card(state.lampName, state.lightOn ? '밝기 ' + state.brightness + '% · ' + (state.kelvin === 2700 ? '따뜻한 화이트' : state.kelvin + 'K') : '꺼짐', 'light', 'lightOn', state.lightOn)) + at(457, card(state.room + ' 온도', '현재 22°C / 목표 ' + state.temperature + '°C', 'climate', 'climateOn', state.climateOn)) + at(568, link('내일 ' + e(state.routines[0]?.time || '07:00') + ' · 아침 조명 예약  ›', 'routines', 'style="margin-left:0"')) + nav('home');
    case 'rooms': return at(192, roomChips()) + at(256, card(state.lampName, '조명 · ' + (state.lightOn ? '켜짐' : '꺼짐'), 'light', 'lightOn', state.lightOn)) + at(360, card(state.room + ' 온도 조절기', '온도 · 자동 모드', 'climate', 'climateOn', state.climateOn)) + at(464, card('침실 무드등', '연결 끊김 · 다시 연결', 'offline', '', false, true)) + at(570, btn('새 기기 추가', 'addDevice', true)) + nav('rooms');
    case 'light':
    case 'lightWarm': return lamp(169) + at(384, '<p class="display center"><output id="brightness-value">' + state.brightness + '</output>%</p>') + at(458, notice('밝기')) + at(481, '<label class="range-wrap"><span class="visually-hidden">조명 밝기</span><input aria-label="조명 밝기" class="brightness-range" id="brightness" type="range" min="0" max="100" value="' + state.brightness + '" style="--brightness:' + state.brightness + '%"></label>') + at(548, chips([2700, 4000, 6500], state.kelvin, 'kelvin')) + at(624, btn('조명 끄기', '', true, 'data-action="power"'));
    case 'lightOff': return lamp(169, true) + at(401, '<p class="display center" style="color:var(--light-color-muted)">OFF</p>') + at(482, notice('마지막 설정: 밝기 ' + state.brightness + '% · ' + state.kelvin + 'K')) + at(583, btn('조명 켜기', '', false, 'data-action="power"'));
    case 'climate': return statusArt(state.temperature + '°', 210) + at(389, '<p class="body-copy center">목표 <output id="target-temp">' + state.temperature + '</output>°C · 자동 모드</p>') + at(463, '<div class="temp-actions">' + btn('−', '', true, 'data-action="temperature" data-delta="-1" aria-label="목표 온도 내리기" ' + (state.temperature <= 16 ? 'disabled' : '')) + btn('+', '', false, 'data-action="temperature" data-delta="1" aria-label="목표 온도 올리기" ' + (state.temperature >= 30 ? 'disabled' : '')) + '</div>') + at(542, card('예약 시간', '15:00 → 22:00 · 매일', 'editRoutine'));
    case 'climate25':
    case 'climate23': return statusArt('✓', 210) + at(389, '<p class="display center">' + state.temperature + '°</p>') + at(467, notice('자동 모드 · 설정이 적용됐어요.')) + at(547, btn('예약 설정하기', 'editRoutine')) + at(611, btn('온도 조절로 돌아가기', 'climate', true));
    case 'routines': return at(216, '<div class="stack scroll-region">' + (state.routines.length ? state.routines.map(r => card(r.name, r.time + ' · ' + r.repeat + ' · 조명 ' + r.brightness + '%', '', 'routine:' + r.id, r.enabled).replace('<div class="card-main">', '<button type="button" class="card-main" data-action="edit-routine" data-id="' + e(r.id) + '">').replace('</small></div>', '</small></button>')).join('') : '<p class="body-copy">아직 예약이 없어요. 첫 예약을 만들어 보세요.</p>') + '</div>') + at(548, btn('새 예약 만들기', '', false, 'data-action="new-routine"')) + nav('routines');
    case 'editRoutine': {
      const draft = routineDraft || { name: '기분 좋은 아침', time: '07:00', repeat: '평일', brightness: 80 };
      return formStart('routine-form', 194) + '<div class="stack" style="--gap:10px">' + field('예약 이름', 'routineName', memo.routineName || draft.name, 'text', 'required maxlength="16"') + field('실행 시간', 'routineTime', memo.routineTime || draft.time, 'time', 'required') + '</div><div style="margin-top:25px">' + chips(['평일', '매일', '주말'], draft.repeat, 'repeat') + '</div><div style="margin-top:24px">' + card(state.lampName, '전원 켜기 · 밝기 ' + draft.brightness + '% · 2700K') + '</div><div style="margin-top:23px">' + formError() + submit('예약 저장') + '</div></form>' + at(659, notice('설정한 시간에 기기가 온라인이어야 실행돼요.'));
    }
    case 'saved': return statusArt('✓', 225) + at(432, '<h3 class="section-title center">' + e((lastSaved?.repeat || '평일') + ' ' + (lastSaved?.time || '07:00')) + '</h3>') + at(481, notice(state.lampName + ' · 밝기 ' + (lastSaved?.brightness || 80) + '% · 따뜻한 화이트')) + at(580, btn('예약 목록으로', 'routines'));
    case 'settings': return at(210, card(state.name + '님의 계정', state.email, 'account')) + at(328, '<div class="settings-list">' + [['알림 설정', 'notifications'], ['기기 및 연결 관리', 'rooms'], ['이용약관', 'terms'], ['개인정보 처리방침', 'privacy'], ['로그아웃', 'login']].map(([label, target]) => '<button type="button" class="settings-row" ' + (label === '로그아웃' ? 'data-action="logout"' : 'data-route="' + target + '"') + '><span>' + label + '</span><span>›</span></button>').join('') + '</div>') + nav('settings');
    case 'notifications': return at(222, card('기기 연결 상태', '오프라인 또는 재연결 시 알림', '', 'connection', state.notifications.connection)) + at(326, card('예약 실행 결과', '예약 성공·실패를 알려드려요.', '', 'routine', state.notifications.routine)) + at(430, card('새로운 소식', '업데이트와 서비스 안내', '', 'news', state.notifications.news)) + at(579, btn('설정 저장', '', false, 'data-action="save-notifications"')) + at(659, notice('선택 사항은 이 브라우저에 저장됩니다.'));
    case 'offline': return statusArt('!', 223, true) + at(432, '<h3 class="section-title" style="font-size:21px">전원과 Wi-Fi를 확인해 주세요.</h3>') + at(480, '<p class="body-copy">기기 전원을 다시 켜고 같은 네트워크에<br>연결되어 있는지 확인해 주세요.</p>') + at(568, btn('다시 연결', 'addDevice')) + at(630, btn('공간으로 돌아가기', 'rooms', true));
    case 'scanFailed': return statusArt('!', 214, true) + at(426, '<h3 class="section-title" style="font-size:22px">기기가 검색되지 않나요?</h3>') + at(475, '<p class="body-copy">1. 기기 전원이 켜져 있는지 확인<br>2. 블루투스 접근 권한 허용<br>3. 휴대폰과 기기 사이 1m 이내 유지</p>') + at(588, btn('다시 찾기', 'addDevice'));
    case 'account': return formStart('account-form', 215) + '<div class="stack" style="--gap:16px">' + field('이름', 'name', memo.name || state.name, 'text', 'required maxlength="8" autocomplete="given-name"') + field('이메일', 'email', memo.email || state.email, 'email', 'required autocomplete="email"') + field('우리 집 이름', 'house', memo.house || state.house, 'text', 'required maxlength="20"') + '</div><div style="margin-top:87px">' + formError() + submit('변경사항 저장') + '</div></form>' + at(644, link('비밀번호 변경', 'reset'));
    case 'terms': return at(213, '<article class="legal-copy"><h3>light-up 서비스 이용 안내</h3><p>스마트 기기의 연결과 제어, 예약 기능을 제공합니다. 연결 상태와 기기 환경에 따라 실행 결과가 달라질 수 있습니다.</p><p>계정과 연결 기기는 사용자가 관리하며, 서비스 이용 및 해지 기준은 정식 출시 시 확정된 이용약관으로 안내합니다.</p></article>') + at(564, notice('※ 기획 시안용 요약이며 정식 약관이 아닙니다.')) + at(609, btn('확인했어요', '', false, 'data-action="back"'));
    case 'privacy': return at(213, '<article class="legal-copy"><h3>수집 목적과 선택 권한</h3><p>계정: 이름·이메일로 사용자 구분<br>기기: 연결 상태·공간·제어 설정 관리<br>알림: 예약 및 기기 상태 전달 (선택)</p><p>데모에서는 기기·알림·예약 설정을 이 브라우저에 저장합니다. 비밀번호는 저장하지 않으며 서버에 전송하지 않습니다.</p></article>') + at(564, notice('※ 기획 시안용 요약이며 정식 정책이 아닙니다.')) + at(609, btn('확인했어요', '', false, 'data-action="back"'));
    default: return '';
  }
}
function render() {
  const route = routes[current];
  screen.innerHTML = '<div class="screen-view" data-screen="' + current + '"><div class="statusbar" aria-hidden="true"><span>9:41</span><span>••• ▰</span></div>' + header() + template() + '<div class="home-indicator" aria-hidden="true"></div></div>';
  $('#screen-picker').value = current;
  $('#screen-number').textContent = String(routeKeys.indexOf(current) + 1).padStart(2, '0');
  $('#screen-label').textContent = route[0];
  $('#screen-description').textContent = route[1] || '집이 나를 반기는 순간';
  document.title = route[0] + ' · light-up Warm Living';
  const group = ['welcome', 'onboardingLight', 'onboardingClimate', 'login', 'signup', 'permissions', 'emptyHome', 'addDevice', 'wifi', 'connected'].includes(current) ? 'welcome' : ['routines', 'editRoutine', 'saved'].includes(current) ? 'routines' : 'home';
  document.querySelectorAll('.journey').forEach(b => b.classList.toggle('active', b.dataset.route === group));
}
document.addEventListener('click', event => {
  const el = event.target.closest('[data-route], [data-action]');
  if (!el || el.disabled || busy) return;
  if (el.dataset.route) {
    if (el.dataset.route === 'light' && !state.lightOn) go('lightOff');
    else go(el.dataset.route);
    return;
  }
  const action = el.dataset.action;
  if (action === 'back') return back();
  if (action === 'room') { captureForm(); state.room = el.dataset.value; saveState(); render(); return; }
  if (action === 'kelvin') { state.kelvin = Number(el.dataset.value); saveState(); render(); toast('색온도 ' + state.kelvin + 'K로 변경했어요.'); return; }
  if (action === 'repeat') { captureForm(); if (!routineDraft) routineDraft = { name: '기분 좋은 아침', time: '07:00', brightness: 80 }; routineDraft.repeat = el.dataset.value; render(); return; }
  if (action === 'toggle') {
    const key = el.dataset.key;
    if (key === 'permission') return toast('기기 연결 권한은 실제 앱에서 요청합니다.');
    if (key.startsWith('routine:')) { const r = state.routines.find(r => r.id === key.slice(8)); if (r) r.enabled = !r.enabled; }
    else if (key in state.notifications) state.notifications[key] = !state.notifications[key];
    else if (key === 'lightOn' || key === 'climateOn') state[key] = !state[key];
    saveState(); render(); return;
  }
  if (action === 'power') { state.lightOn = !state.lightOn; saveState(); go(state.lightOn ? 'light' : 'lightOff'); return; }
  if (action === 'temperature') { state.temperature = clamp(state.temperature + Number(el.dataset.delta), 16, 30); saveState(); render(); toast('목표 온도 ' + state.temperature + '°C로 변경했어요.'); return; }
  if (action === 'evening') { state.lightOn = true; state.brightness = 80; state.kelvin = 2700; saveState(); go('lightWarm'); toast('편안한 저녁 장면을 적용했어요.'); return; }
  if (action === 'new-routine') { routineDraft = { id: '', name: '기분 좋은 아침', time: '07:00', repeat: '평일', brightness: 80, enabled: true }; delete formMemory.editRoutine; go('editRoutine'); return; }
  if (action === 'edit-routine') { const r = state.routines.find(r => r.id === el.dataset.id); if (r) { routineDraft = { ...r }; delete formMemory.editRoutine; go('editRoutine'); } return; }
  if (action === 'save-notifications') { saveState(); go('settings'); toast('알림 설정을 저장했어요.'); return; }
  if (action === 'logout') { go('login'); toast('데모 홈에서 나왔어요.'); }
});
screen.addEventListener('input', event => {
  if (event.target.id !== 'brightness') return;
  state.brightness = Number(event.target.value);
  $('#brightness-value').textContent = state.brightness;
  event.target.style.setProperty('--brightness', state.brightness + '%');
  screen.querySelectorAll('.lamp-slot:not(.off)').forEach(lamp => {
    lamp.style.setProperty('--lamp-intensity', String(state.brightness / 100));
  });
  saveState();
});
screen.addEventListener('submit', event => {
  event.preventDefault();
  if (busy) return;
  const form = event.target;
  const invalid = [...form.elements].find(el => el.willValidate && (!el.checkValidity() || (el.required && ['text', 'email'].includes(el.type) && !el.value.trim())));
  if (invalid) {
    $('#form-error', form).textContent = invalid.name === 'agree' ? '필수 약관에 동의해 주세요.' : invalid.validity.tooShort || invalid.type === 'password' ? '비밀번호를 8자 이상 입력해 주세요.' : invalid.type === 'email' ? '올바른 이메일 주소를 입력해 주세요.' : '입력 항목을 확인해 주세요.';
    invalid.setAttribute('aria-invalid', 'true');
    invalid.focus();
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  if (form.id === 'login-form') { state.email = data.email; saveState(); go('home'); return; }
  if (form.id === 'signup-form') { state.name = data.name.trim(); state.email = data.email; state.connected = false; saveState(); go('permissions'); return; }
  if (form.id === 'reset-form') { captureForm(); go('resetSent'); return; }
  if (form.id === 'wifi-form') {
    busy = true;
    const button = $('[data-submit]', form);
    button.textContent = '기기 연결 중…';
    button.disabled = true;
    timer = setTimeout(() => { busy = false; go('connected'); toast('데모 기기를 연결했어요.'); }, 650);
    return;
  }
  if (form.id === 'connected-form') { state.lampName = data.lampName.trim(); state.connected = true; saveState(); go('home'); return; }
  if (form.id === 'account-form') { state.name = data.name.trim(); state.email = data.email; state.house = data.house.trim(); saveState(); go('settings'); toast('계정 정보를 저장했어요.'); return; }
  if (form.id === 'routine-form') {
    const draft = routineDraft || { repeat: '평일', brightness: 80, enabled: true };
    const routine = { ...draft, name: data.routineName.trim(), time: data.routineTime, id: draft.id || 'routine-' + Date.now() };
    const index = state.routines.findIndex(r => r.id === routine.id);
    if (index >= 0) state.routines[index] = routine; else state.routines.push(routine);
    lastSaved = { ...routine }; routineDraft = null; delete formMemory.editRoutine; saveState(); go('saved');
  }
});
$('#screen-picker').innerHTML = routeKeys.map((key, i) => '<option value="' + key + '">' + String(i + 1).padStart(2, '0') + '  ' + routes[key][0] + '</option>').join('');
$('#screen-picker').addEventListener('change', event => {
  const route = event.target.value;
  if (route === 'lightOff') state.lightOn = false;
  if (route === 'light' || route === 'lightWarm') state.lightOn = true;
  if (route === 'lightWarm') { state.brightness = 80; state.kelvin = 2700; }
  if (route === 'climate25') state.temperature = 25;
  if (route === 'climate23') state.temperature = 23;
  saveState(); go(route);
});
$('#reset-demo').addEventListener('click', () => {
  state = defaults(); formMemory = {}; routineDraft = null; lastSaved = null; navigation = [];
  saveState(); go('welcome', { replace: true }); toast('처음 상태로 되돌렸어요.');
});
window.addEventListener('popstate', () => {
  captureForm();
  const route = routeFromURL();
  current = route;
  render();
});
function resizeMockup() {
  const mobile = innerWidth <= 700;
  const availableHeight = mobile ? Math.max(540, innerHeight - 240) : Math.max(480, innerHeight - 280);
  const scale = Math.min(1, availableHeight / 736, (innerWidth - 36) / 356);
  document.documentElement.style.setProperty('--phone-scale', String(Math.max(.65, scale)));
}
window.addEventListener('resize', resizeMockup);
resizeMockup();
function routeFromURL() {
  const hash = location.hash.replace(/^#\//, '');
  const path = decodeURIComponent(location.pathname).replace(/^\/+|\/+$/g, '');
  return routes[hash] ? hash : routes[path] ? path : 'welcome';
}
const initialRoute = routeFromURL();
go(routes[initialRoute] ? initialRoute : 'welcome', { replace: true });
