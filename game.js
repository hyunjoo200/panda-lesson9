/* 중국어 탐험대 · 9차시 「판다의 야시장 먹방」 (game.js)
   고치지 않아도 됩니다. 문제와 가게는 game-data.js에서 바꿔요. */
(() => {
'use strict';
const D = window.GAME_DATA;
const $ = s => document.querySelector(s);
const Net = window.PandaNet || { enabled:false, push(){}, studentStart(){ return Promise.resolve(null); }, watchBoard(cb){ cb(null); return () => {}; }, onStatus(fn){ fn('off'); }, status(){ return 'off'; }, flush(){}, uid(){ return null; } };
const STORE_KEY = D.saveKey || 'panda-lesson9', PREF_KEY = 'panda-stage1-prefs';
const FOODS = D.foods;
const SOUNDS = D.audio.sounds;
/* 음식 이름 · "我想吃○○。" · "我想喝○○。" 소리를 자동으로 만들어요 */
Object.keys(FOODS).forEach(id => {
  const f = FOODS[id];
  if (!SOUNDS[id]) SOUNDS[id] = { text: f.text, pinyin: f.pinyin };
  const v = f.drink ? ['he', '喝', 'hē'] : ['chi', '吃', 'chī'];
  const sid = `${v[0]}_${id}`;
  if (!SOUNDS[sid]) SOUNDS[sid] = { text: `我想${v[1]}${f.text}。`, pinyin: `Wǒ xiǎng ${v[2]} ${f.pinyin}.` };
});
Object.keys(SOUNDS).forEach(id => { if (!SOUNDS[id].file) SOUNDS[id].file = `audio/${id}.mp3`; });
const IMG = id => (window.FOOD_IMAGES && window.FOOD_IMAGES[id]) || `img/${id}.jpg`;
const STALLS = D.stalls;
const HOME = D.home;
const STOPS = [...STALLS, { ...HOME, id: 'home', home: true }];
const ZONES = STOPS.map(s => ({ id: s.id, name: s.name }));
const MISSIONS = STOPS.map((s, i) => ({ ...s.mission, zone: i }));
D.zones = STOPS.map(s => ({ id: s.id, name: s.name, missions: [s.mission] }));   // 선생님 화면용
const ALL = MISSIONS;
const QUESTION_COUNT = MISSIONS.length;
const FOOD_IDS = Object.keys(FOODS).filter(id => id !== 'zhajiangmian_cn');

/* ================= 저장 (이 기기 + 온라인) ================= */
const store = {
  load(){ try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch(e){ return null; } },
  save(s){ try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); return true; } catch(e){ return false; } }
};
let prefs = { bgm:45, sfx:70, voice:100, mute:false };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch(e){}
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch(e){} };
const emptyRec = () => ({ first:null, firstCorrect:null, tries:0, wrongs:[], points:0, done:false, doneAt:null, choice:null });
function newState(name){
  const results = {}; ALL.forEach(m => results[m.id] = emptyRec());
  return { name, tag:String(Math.floor(1000 + Math.random()*9000)), startedAt:Date.now(), learn:0, starPts:0,
           pos:0, eaten:[], tasted:[], results, finished:false, finishedAt:null };
}
let S = null;
const doneCount = () => MISSIONS.filter(m => S.results[m.id].done).length;
const belly = () => S ? S.eaten.length : 0;
function summary(){
  const res = {};
  ALL.forEach(m => { const r = S.results[m.id]; res[m.id] = { first: r.first, firstCorrect: r.firstCorrect, tries: r.tries, wrongs: (r.wrongs || []).slice(0, 12), points: r.points, done: r.done, choice: r.choice || null }; });
  const firstCorrect = MISSIONS.filter(m => S.results[m.id].firstCorrect === true).length;
  const picks = MISSIONS.filter(m => S.results[m.id].choice).map(m => FOODS[S.results[m.id].choice].text).join(', ');
  return { name: S.name, tag: S.tag, lesson: D.lessonId || 'lesson', learn: S.learn, star: S.starPts, total: S.learn + S.starPts,
    bells: doneCount(), bellsTotal: MISSIONS.length, bossDone: !!S.finished,
    finished: !!S.finished, finishedAt: S.finishedAt || null, startedAt: S.startedAt, firstCorrect, questions: QUESTION_COUNT,
    eaten: S.eaten.length, tasted: S.tasted.length, foodsTotal: FOOD_IDS.length, picks, results: res };
}
const persist = (now) => { if (!S) return; store.save(S); Net.push(summary(), now === true); };
/* ================= 소리 ================= */
const Snd = (() => {
  let ctx = null, master, bgmGain, sfxGain, duck = 1, bgmOn = false, nextNote = 0, step = 0;
  const bad = {}; let lastSource = '';
  function ensure(){
    if (ctx){ if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    bgmGain = ctx.createGain(); bgmGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    apply();
  }
  function apply(){
    if (!ctx) return; const t = ctx.currentTime;
    master.gain.setTargetAtTime(prefs.mute ? 0 : 1, t, .05);
    bgmGain.gain.setTargetAtTime(prefs.bgm/100 * .2 * duck, t, .15);
    sfxGain.gain.setTargetAtTime(prefs.sfx/100 * .6, t, .05);
  }
  const setDuck = d => { duck = d; apply(); };
  function tone(f, start, dur, type='sine', vol=.3, dest=sfxGain, atk=.01){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, start);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(vol, start + atk);
    g.gain.exponentialRampToValueAtTime(.0008, start + dur);
    o.connect(g); g.connect(dest); o.start(start); o.stop(start + dur + .05); return o;
  }
  const hz = n => 440 * Math.pow(2, (n - 69)/12);
  // 배경음악: 오음계 반복 곡 (코드로 직접 생성, 저작권 문제 없음)
  const MEL = [76,79,81,79, 76,74,72,74, 76,79,84,81, 79,76,74,-1, 72,74,76,79, 81,79,76,74, 72,76,74,72, 69,72,74,-1];
  const BASS = [48,55,45,52, 48,55,43,50];
  function schedule(){
    if (!ctx || !bgmOn) return;
    const spb = 60/112/2;
    while (nextNote < ctx.currentTime + .25){
      const n = MEL[step % MEL.length];
      if (n > 0) tone(hz(n), nextNote, spb*1.6, 'triangle', .16, bgmGain, .02);
      if (step % 4 === 0) tone(hz(BASS[(step/4) % BASS.length]), nextNote, spb*3.6, 'sine', .22, bgmGain, .03);
      if (step % 2 === 1) tone(hz(96), nextNote, .05, 'square', .01, bgmGain, .002);
      nextNote += spb; step++;
    }
  }
  function startBgm(){ ensure(); if (!ctx || bgmOn) return; bgmOn = true; nextNote = ctx.currentTime + .1; setInterval(schedule, 90); }
  const fx = fn => () => { ensure(); if (ctx) fn(ctx.currentTime); };
  const sfx = {
    correct: fx(t => { [72,76,79,84].forEach((n,i) => tone(hz(n), t+i*.07, .35, 'triangle', .25)); tone(hz(96), t+.3, .5, 'sine', .12); }),
    wrong:   fx(t => { tone(hz(64), t, .18, 'sine', .18); tone(hz(60), t+.12, .25, 'sine', .15); }),
    bell:    fx(t => { [[523,.3],[1046,.14],[1568,.08],[2093,.05]].forEach(([f,v]) => tone(f, t, 2.2, 'sine', v, sfxGain, .003)); }),
    star:    fx(t => { tone(hz(88), t, .08, 'square', .045); tone(hz(93), t+.06, .14, 'square', .045); }),
    jump:    fx(t => { const o = tone(300, t, .16, 'sine', .1); o.frequency.exponentialRampToValueAtTime(620, t+.14); }),
    bump:    fx(t => { const o = tone(220, t, .25, 'triangle', .14); o.frequency.exponentialRampToValueAtTime(110, t+.22); }),
    stomp:   fx(t => { tone(hz(67), t, .1, 'square', .06); tone(hz(74), t+.08, .12, 'square', .06); }),
    place:   fx(t => { tone(hz(79), t, .12, 'triangle', .18); }),
    door:    fx(t => { tone(hz(48), t, 1.2, 'sawtooth', .05); [60,64,67,72,76].forEach((n,i) => tone(hz(n), t+.25+i*.12, .8, 'triangle', .16)); }),
    bonus:   fx(t => { [79,83,86,91,95].forEach((n,i) => tone(hz(n), t+i*.06, .3, 'sine', .18)); }),
    fanfare: fx(t => { [[72,0],[76,.15],[79,.3],[84,.45],[79,.7],[84,.85]].forEach(([n,d]) => tone(hz(n), t+d, .5, 'triangle', .22)); }),
    hop:     fx(t => { const o = tone(420, t, .12, 'sine', .09); o.frequency.exponentialRampToValueAtTime(760, t+.1); }),
    dice:    fx(t => { for (let i = 0; i < 6; i++) tone(hz(84 + (i % 3)*3), t + i*.07, .05, 'square', .03); }),
    back:    fx(t => { const o = tone(520, t, .4, 'triangle', .12); o.frequency.exponentialRampToValueAtTime(200, t+.38); }),
    party:   fx(t => { [[67,0],[67,.18],[69,.36],[67,.6],[72,.84],[71,1.08]].forEach(([n,d]) => tone(hz(n), t+d, .4, 'triangle', .2)); }),
    blip:    fx(t => tone(hz(88), t, .06, 'sine', .08)),
    munch:   fx(t => { for (let i = 0; i < 4; i++){ const o = tone(180 + (i % 2)*70, t + i*.16, .1, 'square', .05); o.frequency.exponentialRampToValueAtTime(90, t + i*.16 + .09); } }),
    burp:    fx(t => { const o = tone(150, t, .35, 'sawtooth', .07); o.frequency.exponentialRampToValueAtTime(70, t+.32); }),
    yawn:    fx(t => { const o = tone(hz(72), t, 1.1, 'sine', .12, sfxGain, .2); o.frequency.exponentialRampToValueAtTime(hz(60), t+1); }),
    pop:     fx(t => { const o = tone(600, t, .1, 'sine', .12); o.frequency.exponentialRampToValueAtTime(1200, t+.08); })
  };
  // 중국어 음성: ① 녹음 파일 → ② 온라인 음성 → ③ 기기 내장 음성
  // 휴대폰은 화면을 누르기 전에는 소리를 막아요. 첫 터치 때 재생기 하나를 '깨워 두고' 계속 다시 씁니다.
  const SILENT = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
  const voiceEl = new Audio(); voiceEl.preload = 'auto';
  try { voiceEl.preservesPitch = true; voiceEl.webkitPreservesPitch = true; } catch(e){}
  let unlocked = false;
  function unlock(){
    ensure();
    if (ctx){ try { const b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0); } catch(e){} }
    if (unlocked) return; unlocked = true;
    try {
      voiceEl.muted = true; voiceEl.src = SILENT;
      const p = voiceEl.play();
      if (p && p.then) p.then(() => { voiceEl.pause(); voiceEl.muted = false; }).catch(() => { voiceEl.muted = false; unlocked = false; });
    } catch(e){ unlocked = false; }
    try { if (window.speechSynthesis){ const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); } } catch(e){}
  }
  ['touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { capture:true, passive:true }));
  const errKind = err => !err ? 'load' : err.name === 'NotAllowedError' ? 'blocked' : err.name === 'AbortError' ? 'abort' : 'load';
  function playUrl(url, rate){
    return new Promise((res, rej) => {
      const a = voiceEl; let started = false, done = false;
      const fail = kind => { const e = new Error(kind); e.kind = kind; return e; };
      const fin = (fn, v) => { if (done) return; done = true; clearTimeout(to); a.onerror = a.onended = a.onplaying = null; fn(v); };
      const to = setTimeout(() => { if (!started){ try { a.pause(); } catch(e){} fin(rej, fail('timeout')); } }, 6000);
      try { a.pause(); } catch(e){}
      a.muted = false; a.volume = prefs.mute ? 0 : prefs.voice/100;
      a.onerror = () => fin(rej, fail('load'));
      a.onended = () => fin(res);
      a.onplaying = () => { started = true; clearTimeout(to); a.playbackRate = rate; };
      a.src = url; a.defaultPlaybackRate = rate; a.playbackRate = rate;
      const p = a.play(); if (p && p.catch) p.catch(err => fin(rej, fail(errKind(err))));
    });
  }
  function synth(text, rate){
    return new Promise((res, rej) => {
      const ss = window.speechSynthesis; if (!ss) return rej(new Error('nosynth'));
      const vs = ss.getVoices();
      const v = vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || vs.find(v => /cmn/i.test(v.lang));
      if (!v && vs.length) return rej(new Error('novoice'));
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN'; if (v) u.voice = v; u.rate = rate < 1 ? .55 : .85; u.volume = prefs.mute ? 0 : prefs.voice/100;
      u.onend = () => res(); u.onerror = e => rej(e);
      ss.cancel(); ss.speak(u); setTimeout(res, 4500);
    });
  }
  let busy = Promise.resolve();
  async function say(id, slow=false){
    const s = SOUNDS[id]; if (!s) return;
    ensure(); setDuck(.12);
    const rate = slow ? (D.audio.slowRate || .7) : 1;
    const blockedErr = () => { lastSource = 'blocked'; const e = new Error('blocked'); e.kind = 'blocked'; return e; };
    try {
      if (D.audio.useLocalFiles && !bad[id]){
        try { await playUrl(s.file, rate); lastSource = 'file'; return; }
        catch(e){ if (e.kind === 'blocked') throw blockedErr(); if (e.kind === 'load') bad[id] = true; }
      }
      if (D.audio.useOnlineVoice && D.audio.onlineVoiceUrl && !bad.online){
        try { await playUrl(D.audio.onlineVoiceUrl + encodeURIComponent(s.text), rate); lastSource = 'online'; return; }
        catch(e){ if (e.kind === 'blocked') throw blockedErr(); if (e.kind === 'load') bad.online = true; }
      }
      await synth(s.text, rate); lastSource = 'device';
    } catch(e){ if (e.kind !== 'blocked') lastSource = 'fail'; throw e; }
    finally { setTimeout(() => setDuck(1), 250); }
  }
  const sayQ = (id, slow) => (busy = busy.catch(() => {}).then(() => say(id, slow)));
  async function saySeq(ids, slow, gap=420){ for (const id of ids){ await sayQ(id, slow); await new Promise(r => setTimeout(r, gap)); } }
  const retry = () => Object.keys(bad).forEach(k => delete bad[k]);
  if (window.speechSynthesis) window.speechSynthesis.getVoices();
  return { ensure, unlock, apply, startBgm, sfx, say:sayQ, saySeq, retry, source:() => lastSource };
})();
const SOURCE_TEXT = {
  file:    ['녹음 파일로 재생 중', true],
  online:  ['임시 음성(온라인 자동 음성, 성조 검수 전)', false],
  device:  ['임시 음성(기기 내장 음성, 성조 검수 전)', false],
  blocked: ['휴대폰이 자동 재생을 막았어요. ▶ 듣기를 눌러 주세요.', false],
  fail:    ['소리를 재생하지 못했어요. 무음 모드와 음량을 확인하고 ↻ 다시를 눌러 주세요.', false]
};
function sourceBadge(){ const v = SOURCE_TEXT[Snd.source()]; if (!v) return '';
  return `<span class="badge-temp ${v[1] ? 'badge-ok' : ''}">${v[1] ? '✔' : '⚠'} ${v[0]}</span>`; }


/* ================= 작은 도구 ================= */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random()*a.length)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const foodImg = (id, cls = 'fimg') => `<img class="${cls}" src="${IMG(id)}" alt="${esc(FOODS[id] ? FOODS[id].ko : '')}" draggable="false">`;

/* 동글동글 판다. belly: 0~8 (먹을수록 배가 나와요) · mood: happy / wow / sleepy · cap: 빨간 모자 */
let pid = 0;
function pandaSVG(o = {}){
  const u = 'pd' + (++pid), k = `url(#${u}k)`, w = `url(#${u}w)`, b = clamp(o.belly || 0, 0, 9);
  const mouth = o.mood === 'wow' ? `<ellipse cx="60" cy="70.5" rx="4.2" ry="5" fill="#d9586f"/><ellipse cx="60" cy="72.5" rx="2.6" ry="2.2" fill="#ff9aa9"/>`
    : o.mood === 'eat' ? `<ellipse cx="60" cy="70" rx="6" ry="4.2" fill="#d9586f"/>`
    : `<path d="M53.5 67.5q3.2 4.2 6.5 0q3.3 4.2 6.5 0" stroke="#2a2c30" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const eye = (x, d) => o.mood === 'sleepy'
    ? `<path d="M${x - 5} ${51} q5 4 10 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    : `<circle cx="${x}" cy="51" r="6.3" fill="#141518"/><circle cx="${x + 2.2*d}" cy="48.4" r="2.6" fill="#fff"/><circle cx="${x - 1.8*d}" cy="54.2" r="1.2" fill="#fff"/>`;
  const brx = 32 + b*3.8, bry = 27.5 + b*2.1, bcy = 90 + b*.9;
  return `<svg class="panda" viewBox="-16 -18 152 146" aria-hidden="true">
    <defs>
      <radialGradient id="${u}w" cx="42%" cy="32%" r="72%"><stop offset="0" stop-color="#ffffff"/><stop offset=".72" stop-color="#f7f5f2"/><stop offset="1" stop-color="#e2ddd8"/></radialGradient>
      <radialGradient id="${u}k" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#55585e"/><stop offset="1" stop-color="#1d1f23"/></radialGradient>
      <filter id="${u}f" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="2.8"/></filter>
    </defs>
    <ellipse cx="60" cy="121" rx="${33 + b*3.6}" ry="4.5" fill="rgba(0,0,0,.22)"/>
    <g filter="url(#${u}f)">
      <ellipse cx="${41 - b*2.6}" cy="${112 + b*.3}" rx="12.5" ry="9.5" fill="${k}"/><ellipse cx="${79 + b*2.6}" cy="${112 + b*.3}" rx="12.5" ry="9.5" fill="${k}"/>
      <ellipse cx="60" cy="${bcy}" rx="${brx}" ry="${bry}" fill="${w}"/>
      <ellipse cx="${31 - b*3.4}" cy="87" rx="10.5" ry="13.5" transform="rotate(${28 + b*4} ${31 - b*3.4} 87)" fill="${k}"/><ellipse cx="${89 + b*3.4}" cy="87" rx="10.5" ry="13.5" transform="rotate(${-28 - b*4} ${89 + b*3.4} 87)" fill="${k}"/>
      <circle cx="26" cy="19" r="13.5" fill="${k}"/><circle cx="94" cy="19" r="13.5" fill="${k}"/>
      <ellipse cx="60" cy="50" rx="43" ry="37.5" fill="${w}"/>
    </g>
    <circle cx="27" cy="20.5" r="6" fill="#f2a9b8" opacity=".5"/><circle cx="93" cy="20.5" r="6" fill="#f2a9b8" opacity=".5"/>
    <ellipse cx="41" cy="52" rx="11.5" ry="14" transform="rotate(-30 41 52)" fill="#26282c"/><ellipse cx="79" cy="52" rx="11.5" ry="14" transform="rotate(30 79 52)" fill="#26282c"/>
    ${eye(42, 1)}${eye(78, 1)}
    <ellipse cx="31" cy="66" rx="7.5" ry="4.6" fill="#ff98ab" opacity="${.62 + b*.03}"/><ellipse cx="89" cy="66" rx="7.5" ry="4.6" fill="#ff98ab" opacity="${.62 + b*.03}"/>
    <ellipse cx="60" cy="61.5" rx="5" ry="3.6" fill="#26282c"/><ellipse cx="58.6" cy="60.4" rx="1.6" ry="1" fill="#8b8f96"/>
    ${mouth}
    <ellipse cx="60" cy="${bcy + 5}" rx="${18 + b*3.3}" ry="${14 + b*2.1}" fill="#fff" opacity=".8"/>
    ${b >= 3 ? `<circle cx="60" cy="${bcy + 6 + b*.4}" r="1.6" fill="#e2c9c0"/>` : ''}
    ${o.cap ? `<g transform="rotate(-10 60 8)"><path d="M34 16 Q60 -8 86 16 Z" fill="#e2483b"/><rect x="30" y="13" width="60" height="6" rx="3" fill="#b8322a"/><circle cx="60" cy="-1" r="4" fill="#ffd54f"/></g>` : ''}
  </svg>`;
}
const lanternSVG = () => `<svg class="lantern" viewBox="0 0 40 56" aria-hidden="true"><line x1="20" y1="0" x2="20" y2="7" stroke="#5b2b1a" stroke-width="2"/><rect x="13" y="6" width="14" height="4" rx="1.5" fill="#f2c14e"/><ellipse cx="20" cy="27" rx="17" ry="17" fill="#e2302b"/><path d="M8 27h24M11 18h18M11 36h18" stroke="#ff7a59" stroke-width="1.4" opacity=".7"/><ellipse cx="20" cy="27" rx="7" ry="16" fill="none" stroke="#ff8a6a" stroke-width="1.2" opacity=".8"/><rect x="13" y="43" width="14" height="4" rx="1.5" fill="#f2c14e"/><path d="M16 47v8M20 47v9M24 47v8" stroke="#f2c14e" stroke-width="1.5"/></svg>`;

/* ================= 화면 효과 ================= */
function flash(kind='win'){ const el = $('#flash'); el.className = ''; void el.offsetWidth; el.className = kind; }
let toastTimer;
function toast(txt, ms=2400){ const el = $('#toast'); el.textContent = txt; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, ms); }
function confetti(n = 40){
  const box = $('#confetti'); if (!box) return;
  for (let i = 0; i < n; i++){ const c = document.createElement('i');
    c.style.left = Math.random()*100 + '%'; c.style.background = pick(['#ff7aa5', '#ffd54f', '#e2302b', '#9ccc6e', '#ffb74d']);
    c.style.animationDelay = (Math.random()*.5) + 's'; c.style.setProperty('--r', (Math.random()*720 - 360) + 'deg'); c.style.setProperty('--x', (Math.random()*80 - 40) + 'px');
    box.appendChild(c); setTimeout(() => c.remove(), 2600); }
}
function floatAt(txt, x, y, cls = ''){
  const p = document.createElement('div'); p.className = 'floatpts ' + cls; p.textContent = txt;
  p.style.left = x + 'px'; p.style.top = y + 'px'; document.body.appendChild(p); setTimeout(() => p.remove(), 1400);
}

/* ================= 야시장 거리 ================= */
const P = { u: 0, face: 1, moving: false, target: null };
let SP = 420, PAD = 220, busy = false, loopOn = false, lastT = 0, held = { l:false, r:false };
const stopX = i => PAD + (i + 1)*SP;              // i번째 가게(마지막은 집) 앞
const uToX = u => PAD + u*SP;
const nextStop = () => STOPS.findIndex(s => !S.results[s.mission.id].done);
function layout(){
  const vw = $('#stage').clientWidth;
  SP = clamp(Math.round(vw*.62), 330, 470);
  PAD = Math.round(clamp(vw*.5, 200, 420));
}
function stallHTML(s, i){
  const done = S.results[s.mission.id].done, n = s.items.length;
  return `<div class="stall ${done ? 'done' : ''}" data-stop="${i}" style="left:${stopX(i)}px;width:${Math.round(SP*.86)}px;--sc:${s.color}">
    <div class="sline">${[0,1,2].map(() => lanternSVG()).join('')}</div>
    <div class="sign"><span class="zh">${esc(s.sign)}</span><small>${esc(s.name)}</small></div>
    <div class="awning"></div>
    <div class="booth">
      <div class="owner">${s.owner}</div>
      <div class="obubble" id="ob${i}" hidden></div>
      <div class="counter c${Math.min(n, 3)} n${n}">${s.items.map(id => `<button type="button" class="dish ${S.tasted.includes(id) ? 'tasted' : ''}" data-food="${id}">${foodImg(id)}<span class="dname"><b>${esc(FOODS[id].text)}</b><small>${esc(FOODS[id].ko.replace(/ \(.*\)/, ''))}</small></span></button>`).join('')}</div>
    </div>
    ${done ? `<div class="stamp">냠냠 ✔</div>` : ''}
  </div>`;
}
function homeHTML(i){
  return `<div class="stall home" data-stop="${i}" style="left:${stopX(i)}px;width:${Math.round(SP*.86)}px">
    <div class="nhouse"><div class="roof"></div><div class="hbody"><span class="hwin">🏮</span><span class="hdoor"></span><span class="hwin">🏮</span></div><div class="hsign">판다네 집 🐼</div></div>
    <div class="obubble" id="ob${i}" hidden></div>
    <div class="mom" id="momPanda">${pandaSVG({ mood: 'happy' })}</div>
  </div>`;
}
function buildMarket(){
  layout();
  const W = stopX(STOPS.length - 1) + PAD;
  $('#market').innerHTML = `
    <div class="nsky"><div class="skystars"></div><div class="moon"></div><div class="skyline" id="skyline"></div></div>
    <div class="world" id="world" style="width:${W}px">
      <div class="rope" style="width:${W}px">${Array.from({ length: Math.ceil(W/110) }, (_, i) => `<span style="left:${i*110 + 40}px">${lanternSVG()}</span>`).join('')}</div>
      <div class="gate" style="left:${PAD - SP*.15}px"><div class="gtop">夜市</div><small>야시장</small></div>
      ${STALLS.map(stallHTML).join('')}
      ${homeHTML(STOPS.length - 1)}
      <div class="street" style="width:${W}px"></div>
      <div class="walker" id="player"><div class="pbubble" id="pbubble" hidden></div><div class="pbody" id="pbody">${pandaSVG({ belly: belly() })}</div></div>
    </div>
    <div class="chint" id="chint"></div>
    <div class="ctrl">
      <button type="button" class="cbtn" id="goL" aria-label="왼쪽으로 걷기">◀</button>
      <button type="button" class="cbtn go" id="goR" aria-label="오른쪽으로 걷기">▶</button>
    </div>`;
  $('#world').querySelectorAll('.dish').forEach(b => b.onclick = e => { e.stopPropagation(); tasteFood(b.dataset.food, b); });
  $('#world').querySelectorAll('.stall').forEach(st => st.onclick = () => { if (!busy) walkTo(+st.dataset.stop); });
  const hold = (id, k) => { const b = $(id);
    const on = e => { e.preventDefault(); held[k] = true; P.target = null; b.classList.add('on'); Snd.ensure(); Snd.startBgm(); };
    const off = () => { held[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off); };
  hold('#goL', 'l'); hold('#goR', 'r');
  refreshPanda(); placePlayer(); updateHint();
}
function refreshPanda(mood){ const b = $('#pbody'); if (b) b.innerHTML = pandaSVG({ belly: belly(), mood }); const w = $('#player'); if (w) w.style.setProperty('--grow', 1 + belly()*.045); }
function placePlayer(){
  const pl = $('#player'), wd = $('#world'); if (!pl || !wd) return;
  const x = uToX(P.u), vw = $('#stage').clientWidth, W = wd.offsetWidth;
  const mk = $('#market'); if (mk.scrollLeft || mk.scrollTop){ mk.scrollLeft = 0; mk.scrollTop = 0; }
  pl.style.left = x + 'px';
  pl.classList.toggle('left', P.face < 0); pl.classList.toggle('walk', P.moving);
  const cam = clamp(x - vw/2, 0, Math.max(0, W - vw));
  wd.style.transform = `translateX(${-cam}px)`;
  const sk = $('#skyline'); if (sk) sk.style.backgroundPositionX = (-cam*.3) + 'px';
}
function updateHint(){
  const h = $('#chint'); if (!h || !S) return;
  const n = nextStop();
  h.innerHTML = n < 0 ? '배불러요~' : `▶ 눌러서 걷기 · 다음: <b>${esc(STOPS[n].name)}</b>`;
}
const KEYS = { ArrowLeft:'l', KeyA:'l', ArrowRight:'r', KeyD:'r' };
document.addEventListener('keydown', e => { const k = KEYS[e.code]; if (!k || $('#play').hidden || modalOpen()) return; held[k] = true; P.target = null; e.preventDefault(); Snd.ensure(); Snd.startBgm(); });
document.addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) held[k] = false; });
window.addEventListener('blur', () => { held.l = held.r = false; });
window.addEventListener('resize', () => { if (!$('#play').hidden && S && !S.finished){ buildMarket(); } });
function modalOpen(){ return quizOpen || busy || !$('#evt').hidden || !$('#soundPanel').hidden || !$('#helpPanel').hidden || !$('#rankPanel').hidden; }
function walkTo(i){
  const n = nextStop();
  const lim = n < 0 ? STOPS.length - 1 : n;
  P.target = Math.min(i, lim) + 1;
  Snd.ensure(); Snd.startBgm();
  if (i > lim) toast(`먼저 ${STOPS[lim].name}에 들러요!`);
}
function step(t){
  if ($('#play').hidden || !S || S.finished){ loopOn = false; return; }
  const dt = lastT ? Math.min(.05, (t - lastT)/1000) : 0; lastT = t;
  let dir = 0;
  if (!modalOpen()){
    if (held.r) dir = 1; else if (held.l) dir = -1;
    else if (P.target != null){ const d = P.target - P.u; if (Math.abs(d) < .02){ P.u = P.target; P.target = null; } else dir = Math.sign(d); }
  }
  P.moving = dir !== 0;
  if (dir){
    const prev = P.u, n = nextStop();
    let nu = P.u + dir*.85*dt;
    const maxU = (n < 0 ? STOPS.length : n + 1);
    if (dir > 0 && nu >= maxU){ nu = maxU; }
    nu = clamp(nu, -.15, STOPS.length);
    P.u = nu; P.face = dir;
    if (dir > 0 && n >= 0 && prev < maxU && nu >= maxU){ P.moving = false; held.r = false; P.target = null; placePlayer(); arrive(n); }
    else if (Math.floor(prev*4) !== Math.floor(nu*4)) Snd.sfx.blip();
    if (!busy && Math.round(t/1000) % 2 === 0) { S.pos = P.u; }
  }
  placePlayer();
  requestAnimationFrame(step);
}
function startLoop(){ if (!loopOn){ loopOn = true; lastT = 0; requestAnimationFrame(step); } }

/* 진열대 음식 눌러 보기: 이름 듣기 + 처음이면 별 */
function tasteFood(id, el){
  Snd.ensure();
  Snd.say(id).then(updateSrc).catch(() => {});
  const r = el.getBoundingClientRect();
  floatAt(`${FOODS[id].text} ${FOODS[id].pinyin}`, r.left + r.width/2, r.top - 4, 'name');
  if (S && !S.tasted.includes(id)){
    S.tasted.push(id); S.starPts += D.points.taste; persist();
    el.classList.add('tasted'); Snd.sfx.star();
    setTimeout(() => floatAt(`⭐ +${D.points.taste}`, r.left + r.width/2, r.top + 20), 250);
    renderHud();
  }
}

/* ================= 가게 도착 → 질문 ================= */
async function say(id){ try { await Snd.say(id); updateSrc(); } catch(e){} }
function bubble(i, html, ms){ const b = $('#ob' + i); if (!b) return; b.innerHTML = html; b.hidden = false; if (ms) setTimeout(() => { b.hidden = true; }, ms); }
function pBubble(html, ms){ const b = $('#pbubble'); if (!b) return; b.innerHTML = html; b.hidden = false; clearTimeout(pBubble.t); if (ms) pBubble.t = setTimeout(() => b.hidden = true, ms); }
async function arrive(i){
  busy = true; S.pos = P.u; persist();
  const s = STOPS[i];
  Snd.sfx.pop();
  if (s.home){ busy = false; return homeScene(i); }
  const ask = SOUNDS[s.ask];
  bubble(i, `<span class="zhl">${esc(ask.text)}</span><small>${esc(ask.pinyin)}</small><em>${s.ask === 'nixianghe' ? '뭐 마실래요?' : '뭐 먹을래요?'}</em>`);
  await say(s.ask);
  await wait(500);
  busy = false;
  openQuiz(MISSIONS[i]);
}

/* ================= 퀴즈 ================= */
let quizOpen = false, Q = null;
function openQuiz(m){
  const rec = S.results[m.id];
  Q = { m, rec, locked:false, build:[], step: 1, choice: rec.choice };
  if (m.type === 'pickWord' || m.type === 'zoomPhoto' || m.type === 'hearPhoto') Q.opts = shuffle(m.options);
  if (m.type === 'reply') Q.opts = shuffle(m.options.map((o, i) => ({ ...o, i })));
  if (m.type === 'myChoice' && Q.choice) Q.step = 2;
  quizOpen = true; renderQuiz(); $('#quiz').hidden = false;
  if (m.sound) setTimeout(() => { if (quizOpen && Q && Q.m === m) playMain(false); }, 380);
}
function playMain(slow){ return Snd.say(Q.m.sound, slow).then(updateSrc).catch(showPlayError); }
function updateSrc(){ const el = $('#srcnote'); if (el) el.innerHTML = sourceBadge(); const qp = $('#qplay'); if (qp && Snd.source() !== 'blocked') qp.classList.remove('pulse'); }
function showPlayError(){ const el = $('#srcnote'); if (el) el.innerHTML = sourceBadge(); const qp = $('#qplay'); if (qp) qp.classList.add('pulse'); }
const wordBtn = (id, extra = '') => `<div class="topt"><button class="opt" type="button" data-v="${id}" ${extra}><span class="lbl zhl">${esc(FOODS[id].text)}</span><span class="sub py">${esc(FOODS[id].pinyin)}</span></button><button class="mini-listen" type="button" data-say="${id}" aria-label="${esc(FOODS[id].text)} 듣기">▶ 듣기</button></div>`;
function renderQuiz(){
  const { m } = Q, box = $('#qbox'), s = STOPS[m.zone];
  let h = `<div class="stars" id="stars"></div>
    <div class="qhead"><span class="place">${s.owner} ${esc(m.place)}</span><span class="count">문제 ${m.zone + 1} / ${QUESTION_COUNT}</span>
    <button class="qclose" id="qclose" type="button" aria-label="닫기">✕</button></div>`;
  const listen = `<div class="listen"><button class="btn play" type="button" id="qplay">▶ 듣기</button><button class="btn" type="button" id="qslow">🐢 천천히</button><button class="btn" type="button" id="qretry">↻ 다시</button></div>`;
  const src = `<div class="srcnote" id="srcnote">${sourceBadge()}</div>`;
  if (m.type === 'myChoice' && Q.step === 1){
    h += `<div class="qtext">${esc(m.question)}</div><p class="note center">정답이 없어요! 사진을 누르면 이름을 들을 수 있어요.</p>
      <div class="menu m${m.choices.length}">${m.choices.map(id => `<button type="button" class="menuitem ${Q.choice === id ? 'sel' : ''}" data-pick="${id}">${foodImg(id)}<b class="zhl">${esc(FOODS[id].text)}</b><small>${esc(FOODS[id].pinyin)} · ${esc(FOODS[id].ko.replace(/ \(.*\)/, ''))}</small></button>`).join('')}</div>
      <div class="row center"><button class="btn primary" type="button" id="pickOk" ${Q.choice ? '' : 'disabled'}>이걸로 할래요!</button></div>` + src;
  } else if (m.type === 'myChoice'){
    const f = FOODS[Q.choice];
    h += `<div class="qtext">${esc(m.question2)}</div><div class="orderpic">${foodImg(Q.choice)}<span>${esc(f.ko.replace(/ \(.*\)/, ''))}</span></div>`;
    if (m.mode === 'order'){
      Q.tiles = ['我', '想', m.verb, f.text]; Q.answer = Q.tiles.join('|');
      if (!Q.opts) Q.opts = shuffle([...Q.tiles, ...(m.extra || [])]);
      h += `<div class="sentence" id="sentence">${Q.tiles.map((_, i) => `<span class="wslot" data-i="${i}">　</span>`).join('')}<span class="wend">。</span></div>
        <div class="tiles">${Q.opts.map((t, i) => `<button class="tile" type="button" data-tile="${esc(t)}" data-ti="${i}"><span class="zhl">${esc(t)}</span></button>`).join('')}</div>
        <div class="row center"><button class="btn ghost" type="button" id="wordClear">다시 놓기</button></div>`;
    } else {
      h += `<div class="sentence fill"><span class="zhl">我想</span><span class="wslot big" id="vslot">？</span><span class="zhl">${esc(f.text)}。</span></div>
        <div class="choices c2 verbs">${m.verbs.map(v => `<button class="opt" type="button" data-v="${v}"><span class="lbl zhl">${v}</span><span class="sub">${v === '吃' ? 'chī · 먹다' : 'hē · 마시다'}</span></button>`).join('')}</div>`;
    }
    h += src;
  } else {
    h += `<div class="qtext">${esc(m.question)}</div>`;
    switch (m.type){
      case 'pickWord':
        h += `<div class="note-card"><span class="pin">📝 주문 쪽지</span>${foodImg(m.photo)}</div>
          <p class="center say-line"><span class="zhl">我想吃</span> <span class="blank">？</span><span class="zhl">。</span></p>
          <div class="choices c3 textopts">${Q.opts.map(id => wordBtn(id)).join('')}</div>` + src; break;
      case 'hearPhoto':
        h += listen + src + `<div class="choices c3 photos">${Q.opts.map(id => `<button class="opt photo" type="button" data-v="${id}">${foodImg(id)}<span class="zhl">${esc(FOODS[id].text)}</span></button>`).join('')}</div>`; break;
      case 'zoomPhoto':
        h += `<div class="zoombox" id="zoombox"><img src="${IMG(m.photo)}" alt="가까이 본 음식 사진" draggable="false" style="transform-origin:${m.zoom.x}% ${m.zoom.y}%;transform:scale(${m.zoom.scale})"><span class="lens">🔍</span></div>
          <div class="choices c3 textopts">${Q.opts.map(id => wordBtn(id)).join('')}</div>` + src; break;
      case 'reply':
        h += listen + src + `<div class="choices c3 textopts">${Q.opts.map(o => `<div class="topt"><button class="opt" type="button" data-v="${o.i}"><span class="lbl zhl">${esc(o.text)}</span><span class="sub py">${esc(o.sub)}</span></button><button class="mini-listen" type="button" data-say="${o.sound}">▶ 듣기</button></div>`).join('')}</div>`; break;
    }
  }
  h += `<div class="feedback" id="feedback" aria-live="polite"></div><div id="hintArea"></div>`;
  box.innerHTML = h;
  $('#qclose').onclick = () => closeQuiz();
  const qp = $('#qplay');
  if (qp){ qp.onclick = () => playMain(false); $('#qslow').onclick = () => playMain(true); $('#qretry').onclick = () => { Snd.retry(); playMain(false); }; }
  box.querySelectorAll('[data-say]').forEach(b => b.onclick = () => Snd.say(b.dataset.say).then(updateSrc).catch(showPlayError));
  box.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
    Q.choice = b.dataset.pick; box.querySelectorAll('[data-pick]').forEach(x => x.classList.toggle('sel', x === b));
    $('#pickOk').disabled = false; Snd.say(Q.choice).then(updateSrc).catch(() => {});
  });
  if ($('#pickOk')) $('#pickOk').onclick = () => { Q.rec.choice = Q.choice; persist(); Q.step = 2; Snd.sfx.place(); renderQuiz(); };
  box.querySelectorAll('.opt[data-v]').forEach(b => b.onclick = () => {
    let ok, val;
    if (m.type === 'reply'){ ok = !!m.options[+b.dataset.v].correct; val = m.options[+b.dataset.v].text; }
    else if (m.type === 'myChoice'){ ok = b.dataset.v === m.verb; val = `我想${b.dataset.v}${FOODS[Q.choice].text}`; if (ok) $('#vslot').textContent = b.dataset.v; }
    else { ok = b.dataset.v === m.answer; val = FOODS[b.dataset.v].text; }
    submit(val, ok, b);
  });
  if (m.type === 'myChoice' && m.mode === 'order' && Q.step === 2){
    const paint = () => { box.querySelectorAll('.wslot').forEach((sl, i) => { sl.textContent = Q.build[i] ? Q.build[i].t : '　'; sl.classList.toggle('on', !!Q.build[i]); });
      box.querySelectorAll('.tile').forEach(b => b.disabled = Q.build.some(x => x.i === b.dataset.ti)); };
    box.querySelectorAll('.tile').forEach(b => b.onclick = () => {
      if (Q.locked || Q.build.length >= Q.tiles.length) return;
      Q.build.push({ t: b.dataset.tile, i: b.dataset.ti }); Snd.sfx.place(); paint();
      if (Q.build.length === Q.tiles.length){
        const v = Q.build.map(x => x.t).join('|'), ok = v === Q.answer;
        submit(Q.build.map(x => x.t).join(' '), ok, $('#sentence'), { keepEl: true });
        if (ok) $('#sentence').classList.add('done');
        else { $('#sentence').classList.add('shake'); setTimeout(() => { if (!Q) return; $('#sentence').classList.remove('shake'); Q.build = []; paint(); }, 800); }
      }
    });
    $('#wordClear').onclick = () => { if (!Q.locked){ Q.build = []; paint(); } };
  }
}
function submit(v, correct, el, opt = {}){
  if (!Q || Q.locked || !el) return;
  if (!opt.keepEl && el.classList.contains('wrong')) return;
  Snd.ensure();
  const { m, rec } = Q;
  if (!rec.done){
    rec.tries += 1;
    if (rec.first === null){ rec.first = String(v); rec.firstCorrect = correct; }
    if (!correct) rec.wrongs.push(String(v));
    persist();
  }
  if (correct){
    Q.locked = true; if (!opt.keepEl) el.classList.add('right');
    const pts = rec.wrongs.length === 0 ? D.points.firstTry : D.points.retry;
    if (!rec.done){ rec.points = pts; rec.done = true; rec.doneAt = Date.now(); S.learn += pts; persist(); }
    Snd.sfx.correct(); setTimeout(Snd.sfx.bell, 300);
    const fb = $('#feedback'); fb.className = 'feedback good'; fb.textContent = `정답! 학습 점수 +${pts}`;
    burst(pts);
    if (m.type === 'zoomPhoto'){ const im = $('#zoombox img'); if (im) im.style.transform = 'scale(1)'; }
    const food = m.type === 'myChoice' ? Q.choice : m.type === 'reply' ? null : m.answer;
    const sent = food ? (FOODS[food].drink ? 'he_' : 'chi_') + food : null;
    if (sent) setTimeout(() => Snd.say(sent).catch(() => {}), 350);
    setTimeout(() => {
      const r = $('#qbox').getBoundingClientRect();
      closeQuiz(true); renderHud();
      if (STOPS[m.zone].home) finale(m.zone);
      else eat(m.zone, food, { x: r.left + r.width/2, y: r.top + r.height/2 });
    }, sent ? 2100 : 1500);
  } else {
    if (!opt.keepEl) el.classList.add('wrong');
    Snd.sfx.wrong();
    const fb = $('#feedback'); fb.className = 'feedback bad'; fb.textContent = '아깝다! 힌트를 보고 다시 해 봐요.';
    $('#hintArea').innerHTML = `<div class="hint"><span>💡</span><div><b>힌트</b> ${esc(m.hint)}</div></div>`;
  }
}
function burst(pts){
  const st = $('#stars'); if (!st) return;
  for (let i = 0; i < 18; i++){ const s = document.createElement('i'), a = Math.random()*Math.PI*2, r = 90 + Math.random()*120;
    s.style.left = '50%'; s.style.top = '45%'; s.style.setProperty('--dx', Math.cos(a)*r + 'px'); s.style.setProperty('--dy', Math.sin(a)*r + 'px'); st.appendChild(s); }
  if (pts > 0){ const p = document.createElement('div'); p.className = 'plus'; p.textContent = '+' + pts; st.appendChild(p); }
}
function closeQuiz(solved){
  if (Q && !Q.rec.done && solved !== true){ toast('가게를 누르거나 ▶를 누르면 다시 주문할 수 있어요.', 2600); const i = Q.m.zone; P.target = null; setTimeout(() => { const b = $('#ob' + i); if (b) b.hidden = true; }, 100); P.u = Math.max(0, P.u - .12); }
  $('#quiz').hidden = true; quizOpen = false; Q = null;
}
$('#quiz').addEventListener('click', e => { if (e.target.id === 'quiz' && Q) closeQuiz(); });

/* ================= 냠냠! 먹기 ================= */
async function eat(i, food, from){
  busy = true;
  const b = $('#ob' + i); if (b) b.hidden = true;
  const pl = $('#pbody').getBoundingClientRect();
  const fly = document.createElement('img'); fly.className = 'flyfood'; fly.src = IMG(food);
  fly.style.left = (from.x - 70) + 'px'; fly.style.top = (from.y - 52) + 'px';
  document.body.appendChild(fly);
  await wait(30);
  fly.style.transform = `translate(${pl.left + pl.width/2 - from.x}px, ${pl.top + pl.height*.45 - from.y}px) scale(.18) rotate(20deg)`;
  fly.style.opacity = '.4';
  await wait(650); fly.remove();
  refreshPanda('eat'); Snd.sfx.munch();
  floatAt('냠냠!', pl.left + pl.width/2, pl.top - 10, 'yum');
  if (!S.eaten.includes(food)) S.eaten.push(food);
  if (!S.tasted.includes(food)) S.tasted.push(food);
  persist(true);
  await wait(700);
  refreshPanda('wow'); $('#player').classList.add('grow'); setTimeout(() => $('#player') && $('#player').classList.remove('grow'), 600);
  pBubble(`<span class="zhl">很好吃！</span><small>Hěn hǎochī! 아주 맛있어요!</small>`, 2600);
  await say('henhaochi');
  const st = $(`.stall[data-stop="${i}"]`);
  if (st && !st.querySelector('.stamp')){ st.classList.add('done'); st.insertAdjacentHTML('beforeend', '<div class="stamp">냠냠 ✔</div>'); }
  st && st.querySelectorAll(`[data-food="${food}"]`).forEach(d => d.classList.add('tasted'));
  await wait(900);
  refreshPanda();
  renderHud();
  const s = STOPS[i];
  if (s.extra) await eventCard(s.extra.img ? foodImg(s.extra.img, 'evtimg') : '🏮', s.extra.title, esc(s.extra.text));
  busy = false; updateHint();
  const n = nextStop();
  toast(n >= 0 && STOPS[n].home ? '배가 빵빵! ▶ 집으로 가요 🏠' : '▶ 다음 가게로 가요! 진열대 음식을 눌러 보면 별도 받아요.', 2800);
}
function eventCard(ico, title, html){
  return new Promise(res => {
    $('#evt').innerHTML = `<div class="card evtcard"><div class="evtico">${ico}</div><h2>${esc(title)}</h2><p>${html}</p><div class="row center"><button class="btn primary" type="button" id="evtOk">좋아!</button></div></div>`;
    $('#evt').hidden = false; Snd.sfx.bonus();
    $('#evtOk').onclick = () => { $('#evt').hidden = true; res(); };
  });
}

/* ================= 집: 好吃吗？ → 끝 ================= */
async function homeScene(i){
  busy = true;
  bubble(i, `<span class="zhl">好吃吗？</span><small>Hǎochī ma?</small><em>맛있었어?</em>`);
  await say('haochima');
  await wait(400);
  busy = false;
  openQuiz(MISSIONS[i]);
}
async function finale(i){
  busy = true; updateHint(); $('.ctrl').hidden = true;
  const b = $('#ob' + i); if (b) b.hidden = true;
  Snd.say('henhaochi').catch(() => {});
  refreshPanda('wow'); Snd.sfx.burp();
  pBubble(`<b>${esc(HOME.full)}</b>`, 0);
  confetti(30);
  await wait(2400);
  Snd.sfx.yawn(); refreshPanda('sleepy');
  pBubble(`<b>${esc(HOME.sleep)}</b><span class="zzz">Z z z</span>`, 0);
  Snd.say('wanan').catch(() => {});
  await wait(2200);
  const pl = $('#player');
  pl.classList.add('sleepwalk');
  P.face = 1; placePlayer();
  await wait(1700);
  pl.classList.add('gone');
  await wait(900);
  busy = false;
  finishGame();
}

/* ================= 점수판 ================= */
function renderHud(){
  $('#learnScore').textContent = S.learn; $('#starScore').textContent = S.starPts;
  const n = belly();
  $('#bells').innerHTML = STALLS.map((_, i) => `<i class="bw ${i < n ? 'on' : ''}">🍜</i>`).join('');
  $('#zoneName').textContent = n >= STALLS.length ? '배 빵빵!' : `배 부름 ${n}/${STALLS.length}`;
  $('#total').textContent = `${doneCount()}/${QUESTION_COUNT}`;
  $('#who').textContent = `${S.name} #${S.tag}`;
}
const NET_TEXT = { online: ['on', '선생님께 연결됨'], connecting: ['wait', '연결 중…'], offline: ['wait', '인터넷이 끊겼어요. 다시 연결되면 자동으로 보내요'], error: ['bad', '연결 오류 (결과는 이 기기에 저장돼요)'], off: ['off', '이 기기에만 저장 중'] };
Net.onStatus(st => { const el = $('#netDot'); if (!el) return; const v = NET_TEXT[st] || NET_TEXT.off; el.className = 'netdot ' + v[0]; el.title = v[1]; el.setAttribute('aria-label', v[1]); });

/* ================= 반 순위표 ================= */
const SHOW_RANK = window.SHOW_RANKING !== false;
function rankRows(list){
  if (!list) return `<p class="note center">${Net.enabled ? '순위를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.' : '선생님이 온라인 저장을 켜면 반 친구들의 순위가 보여요.'}</p>
    ${S ? `<ol class="ranklist"><li class="me"><span class="rk">-</span><span class="nm">${esc(S.name)} #${esc(S.tag)} (나)</span><span class="sc">${S.learn + S.starPts}</span></li></ol>` : ''}`;
  if (!list.length) return '<p class="note center">아직 아무도 없어요. 첫 번째 손님이 되어 보세요!</p>';
  let rank = 0, prev = null;
  const uid = Net.uid();
  return `<ol class="ranklist">${list.map((r, i) => { if (r.total !== prev){ rank = i + 1; prev = r.total; }
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    return `<li class="${r.id === uid ? 'me' : ''}"><span class="rk">${medal}</span><span class="nm">${esc(r.name || '?')} #${esc(r.tag || '')}${r.id === uid ? ' (나)' : ''}${r.finished ? ' 💤' : ''}</span><span class="pr">❓${r.bells || 0}</span><span class="sc">${r.total || 0}</span></li>`; }).join('')}</ol>`;
}
let rankUnsub = null, endRankUnsub = null;
function openRanking(){
  $('#rankPanel').hidden = false; $('#rankList').innerHTML = '<p class="note center">불러오는 중…</p>';
  if (rankUnsub) rankUnsub();
  rankUnsub = Net.watchBoard(list => { $('#rankList').innerHTML = rankRows(list); });
}
function closeRanking(){ $('#rankPanel').hidden = true; if (rankUnsub){ rankUnsub(); rankUnsub = null; } }

/* ================= 화면 흐름 ================= */
function show(id){ ['#startScreen','#storyScreen','#play','#endScreen'].forEach(s => $(s).hidden = s !== id); }
const cleanName = v => v.replace(/[<>"'&]/g, '').trim().slice(0, 12);
function fixState(s){ ALL.forEach(m => { if (!s.results[m.id]) s.results[m.id] = emptyRec(); }); s.eaten = s.eaten || []; s.tasted = s.tasted || []; s.pos = s.pos || 0; return s; }
function initStart(){
  $('#stageLabel').textContent = `중국어 탐험대 · ${D.stageLabel}`;
  $('#gameTitle').innerHTML = `${esc(D.title)}<small>${esc(D.subtitle)}</small>`;
  $('#heroArt').innerHTML = `<div class="herolanterns">${lanternSVG()}${lanternSVG()}${lanternSVG()}</div><div class="herorow">${foodImg('baozi', 'heroimg')}${pandaSVG({ mood:'wow', belly: 2 })}${foodImg('tanghulu', 'heroimg')}</div>`;
  $('#zoneList').innerHTML = [...STALLS.map(s => `${s.owner} ${s.name}`), `문제 ${QUESTION_COUNT}개 · 5~6분`].map(t => `<span>${esc(t)}</span>`).join('');
  if (!SHOW_RANK) $('#rankBtn').hidden = true;
  const saved = store.load();
  if (saved && saved.name && saved.results){
    $('#resumeBox').hidden = false; $('#newBox').hidden = true;
    $('#resumeBtn').textContent = `이어서 하기 (${saved.name} #${saved.tag})`;
  }
  $('#resumeBtn').onclick = () => { Snd.ensure(); Snd.startBgm(); S = fixState(saved);
    Net.studentStart(D.lessonId).then(() => persist(true));
    if (S.finished) finishGame(); else enterPlay(); };
  $('#newBtn').onclick = () => { $('#resumeBox').hidden = true; $('#newBox').hidden = false; $('#nameInput').focus(); };
  $('#testBtn').onclick = () => {
    Snd.ensure(); $('#testResult').textContent = '재생 중…';
    Snd.say('nixiangchi').then(() => $('#testResult').innerHTML = '들리나요? ' + sourceBadge()).catch(() => $('#testResult').innerHTML = sourceBadge());
  };
  $('#startBtn').onclick = startNew;
  $('#nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') startNew(); });
}
function startNew(){
  const name = cleanName($('#nameInput').value);
  if (!name){ $('#nameInput').focus(); $('#nameInput').placeholder = '이름을 먼저 써 주세요!'; return; }
  Snd.ensure(); Snd.startBgm();
  S = newState(name); persist();
  Net.studentStart(D.lessonId).then(() => persist(true));
  storyStep = 0; show('#storyScreen'); renderStory();
}
let storyStep = 0;
function renderStory(){
  $('#storyText').textContent = D.story[storyStep];
  $('#storyDots').innerHTML = D.story.map((_, i) => `<b class="${i === storyStep ? 'on' : ''}"></b>`).join('');
  $('#nextBtn').textContent = storyStep === D.story.length - 1 ? '야시장으로 출발!' : '다음';
  $('#storyArt').innerHTML = storyStep === 0 ? `<div class="herolanterns">${lanternSVG()}${lanternSVG()}${lanternSVG()}${lanternSVG()}</div>`
    : storyStep === 1 ? `<div class="herorow">${pandaSVG({ mood:'wow' })}${foodImg('jiaozi', 'heroimg')}${foodImg('malatang', 'heroimg')}</div>`
    : `<div class="herorow"><span class="bigowner">🐰</span><div class="bubble"><p><span class="zhl">你想吃什么？</span><br><small>Nǐ xiǎng chī shénme?</small></p></div></div>`;
  if (storyStep === 2) Snd.say('nixiangchi').catch(() => {});
}
$('#nextBtn').onclick = () => { Snd.sfx.blip(); if (storyStep < D.story.length - 1){ storyStep++; renderStory(); } else enterPlay(); };
$('#skipBtn').onclick = () => enterPlay();
function enterPlay(){
  show('#play');
  const n = nextStop();
  P.u = Math.min(S.pos || 0, n < 0 ? STOPS.length : n + .7); P.face = 1; P.target = null;
  if (n >= 0 && S.pos >= n + 1) P.u = n + .7;
  buildMarket(); renderHud(); startLoop();
  if (!doneCount()) toast('▶ 버튼(또는 → 키)을 누르고 있으면 판다가 걸어가요!', 3200);
}
function finishGame(){
  if (!S.finished){ S.finished = true; S.finishedAt = Date.now(); }
  persist(true);
  Snd.sfx.fanfare(); show('#endScreen');
  const first = MISSIONS.filter(m => S.results[m.id].firstCorrect === true).length;
  $('#endArt').innerHTML = `<div class="sleepbed">${pandaSVG({ mood: 'sleepy', belly: belly() })}<span class="zzz">Z z z</span></div>`;
  $('#endLearn').textContent = S.learn; $('#endStar').textContent = S.starPts; $('#endTotal').textContent = S.learn + S.starPts;
  $('#endName').textContent = `${S.name} #${S.tag}`;
  $('#endFirst').textContent = `처음에 맞힌 문제 ${first} / ${MISSIONS.length}`;
  $('#endZones').innerHTML = S.eaten.map(id => `<div>${foodImg(id, 'endfood')}<small>${esc(FOODS[id].text)}</small></div>`).join('') || '<div><small>-</small></div>';
  const picks = MISSIONS.filter(m => S.results[m.id].choice).map(m => FOODS[S.results[m.id].choice].text);
  $('#endBonus').textContent = `${picks.length ? `내가 고른 것: ${picks.join(', ')} · ` : ''}눌러 본 음식 ${S.tasted.length} / ${FOOD_IDS.length}`;
  renderDex();
  $('#saveStatus').innerHTML = !Net.enabled ? '💾 결과가 이 기기에 저장되었어요.' : Net.status() === 'online' ? '✅ 결과를 선생님께 보냈어요.' : '⏳ 결과를 선생님께 보내는 중이에요. 인터넷이 연결되면 자동으로 보내요.';
  Net.onStatus(s2 => { if ($('#endScreen').hidden || !Net.enabled) return; $('#saveStatus').innerHTML = s2 === 'online' ? '✅ 결과를 선생님께 보냈어요.' : '⏳ 결과를 선생님께 보내는 중이에요. 인터넷이 연결되면 자동으로 보내요.'; });
  $('#endRank').hidden = !SHOW_RANK;
  if (SHOW_RANK){ if (endRankUnsub) endRankUnsub(); setTimeout(() => { endRankUnsub = Net.watchBoard(list => {
    $('#endRankList').innerHTML = rankRows(list ? list.slice(0, 10) : list);
    const uid = Net.uid(), mine = list && list.findIndex(r => r.id === uid);
    $('#myRank').textContent = list && mine >= 0 ? `나는 ${list.length}명 중 ${list.filter(r => r.total > list[mine].total).length + 1}등!` : ''; }); }, 600); }
}
/* 끝난 뒤: 야시장 음식 도감 (눌러서 이름 듣기) */
function renderDex(){
  $('#speedBox').innerHTML = `<h3 class="center">🏮 야시장 음식 도감 <small>${S.tasted.length} / ${FOOD_IDS.length}</small></h3>
    <p class="note center">친구들을 기다리는 동안 사진을 눌러 이름을 들어 봐요.</p>
    <div class="dex">${FOOD_IDS.map(id => `<button type="button" class="dexitem ${S.tasted.includes(id) ? 'on' : ''}" data-dex="${id}">${foodImg(id)}<b class="zhl">${esc(FOODS[id].text)}</b><small>${esc(FOODS[id].pinyin)}</small></button>`).join('')}</div>`;
  $('#speedBox').querySelectorAll('[data-dex]').forEach(b => b.onclick = () => {
    const id = b.dataset.dex; Snd.say(id).catch(() => {});
    if (!S.tasted.includes(id)){ S.tasted.push(id); persist(); b.classList.add('on'); $('#speedBox h3 small').textContent = `${S.tasted.length} / ${FOOD_IDS.length}`; }
  });
}
$('#byeBtn').onclick = () => Snd.say('zaijian').catch(() => {});

/* ================= 설정·도움말 ================= */
function syncSliders(){
  ['bgm','sfx','voice'].forEach(k => { const id = 'vol' + k[0].toUpperCase() + k.slice(1); $('#' + id).value = prefs[k]; $('#' + id + 'V').textContent = prefs[k]; });
  $('#muteAll').checked = prefs.mute;
  const src = SOURCE_TEXT[Snd.source()];
  $('#voiceSourceNote').textContent = '중국어 소리: ' + (src ? src[0] : '아직 재생 전');
  $('#renameInput').value = S ? S.name : ''; $('#renameMsg').textContent = '';
}
['bgm','sfx','voice'].forEach(k => { const id = 'vol' + k[0].toUpperCase() + k.slice(1);
  $('#' + id).addEventListener('input', e => { prefs[k] = +e.target.value; $('#' + id + 'V').textContent = prefs[k]; Snd.apply(); savePrefs(); }); });
$('#muteAll').addEventListener('change', e => { prefs.mute = e.target.checked; Snd.apply(); savePrefs(); });
$('#soundBtn').onclick = () => { syncSliders(); $('#soundPanel').hidden = false; };
$('#soundClose').onclick = () => $('#soundPanel').hidden = true;
$('#renameBtn').onclick = () => { const n = cleanName($('#renameInput').value); if (!n){ $('#renameMsg').textContent = '이름을 써 주세요.'; return; } S.name = n; persist(); renderHud(); $('#renameMsg').textContent = '저장했어요.'; };
$('#helpBtn').onclick = () => { $('#helpPanel').hidden = false; };
$('#helpClose').onclick = () => $('#helpPanel').hidden = true;
$('#rankBtn').onclick = openRanking;
$('#rankClose').onclick = closeRanking;
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){ if (quizOpen && Q) closeQuiz(); $('#soundPanel').hidden = true; $('#helpPanel').hidden = true; closeRanking(); }
});

window.__PANDA = { busy: () => busy || quizOpen, state: () => S, missions: MISSIONS, stops: STOPS, player: () => ({ ...P }) };   // 테스트용 (읽기 전용)
initStart();
})();
