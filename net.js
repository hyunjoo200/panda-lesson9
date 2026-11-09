/* =====================================================================
   온라인 연결 (net.js) — 고치지 않아도 됩니다.
   Firebase(구글의 무료 저장소)에 학생 결과와 순위표를 저장합니다.
   firebase-config.js가 비어 있으면 아무것도 하지 않고, 게임은 이 기기에서만 동작합니다.
   ===================================================================== */
window.PandaNet = (() => {
  'use strict';
  const cfg = window.FIREBASE_CONFIG || {};
  const enabled = !!(cfg.apiKey && cfg.projectId);
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  let ready = null, status = enabled ? 'connecting' : 'off', listeners = [];
  const setStatus = s => { status = s; listeners.forEach(fn => { try { fn(s); } catch(e){} }); };
  function load(src){
    return new Promise((res, rej) => {
      const el = document.createElement('script'); el.src = src; el.async = false;
      el.onload = res; el.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(el);
    });
  }
  function init(){
    if (!enabled) return Promise.resolve(null);
    if (ready) return ready;
    ready = (async () => {
      if (!window.firebase || !window.firebase.firestore){
        await load(SDK + 'firebase-app-compat.js');
        await load(SDK + 'firebase-auth-compat.js');
        await load(SDK + 'firebase-firestore-compat.js');
      }
      const fb = window.firebase;
      if (!fb.apps.length) fb.initializeApp(cfg);
      return { fb, auth: fb.auth(), db: fb.firestore() };
    })();
    ready.catch(() => setStatus('error'));
    return ready;
  }
  // 한국 날짜 (YYYY-MM-DD)
  function today(){
    const d = new Date(Date.now() + 9 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const clean = s => String(s || '').replace(/[^0-9A-Za-z가-힣_-]/g, '').slice(0, 20);
  function classFromUrl(){
    try { const q = new URLSearchParams(location.search); return clean(q.get('class') || q.get('반') || ''); } catch(e){ return ''; }
  }
  function roomId(lesson, date, cls){ return `${clean(lesson)}_${date || today()}${cls ? '_' + clean(cls) : ''}`; }

  /* ---------- 학생 ---------- */
  let me = null, room = null, lastSent = '', timer = null, pending = null, beat = null;
  async function studentStart(lesson){
    if (!enabled) return null;
    try {
      const { auth, db } = await init();
      if (!auth.currentUser) await auth.signInAnonymously();
      me = auth.currentUser.uid;
      room = db.collection('rooms').doc(roomId(lesson, null, classFromUrl()));
      setStatus('online');
      clearInterval(beat);
      beat = setInterval(() => { if (room && me) room.collection('players').doc(me).set({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => setStatus('offline')); }, 45000);
      window.addEventListener('online', () => setStatus('online'));
      window.addEventListener('offline', () => setStatus('offline'));
      return me;
    } catch(e){ console.warn('온라인 연결 실패', e); setStatus('error'); return null; }
  }
  // summary: { name, tag, learn, star, total, bells, bellsTotal, bossDone, finished, firstCorrect, results }
  function push(summary, now=false){
    if (!enabled) return;
    pending = summary;
    clearTimeout(timer);
    timer = setTimeout(flush, now ? 0 : 1200);
  }
  async function flush(){
    if (!pending || !room || !me) return;
    const s = pending, key = JSON.stringify(s); if (key === lastSent) return;
    const ts = firebase.firestore.FieldValue.serverTimestamp();
    const board = { name: s.name, tag: s.tag, total: s.total | 0, learn: s.learn | 0, star: s.star | 0, bells: s.bells | 0, bellsTotal: s.bellsTotal | 0, bossDone: !!s.bossDone, finished: !!s.finished, updatedAt: ts };
    try {
      await Promise.all([
        room.collection('players').doc(me).set({ ...s, total: s.total | 0, learn: s.learn | 0, star: s.star | 0, lastSeen: ts, updatedAt: ts }, { merge: true }),
        room.collection('board').doc(me).set(board)
      ]);
      lastSent = key; setStatus('online');
    } catch(e){ console.warn('저장 실패', e); setStatus(navigator.onLine === false ? 'offline' : 'error'); setTimeout(flush, 8000); }
  }
  let boardUnsub = null;
  function watchBoard(cb){
    if (!enabled || !room){ cb(null); return () => {}; }
    if (boardUnsub) boardUnsub();
    boardUnsub = room.collection('board').orderBy('total', 'desc').limit(40).onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => { console.warn('순위표 오류', err); cb(null); });
    return () => { if (boardUnsub){ boardUnsub(); boardUnsub = null; } };
  }

  /* ---------- 선생님 ---------- */
  async function teacherLogin(email, pw){
    const { auth } = await init();
    await auth.signInWithEmailAndPassword(email, pw);
    return auth.currentUser;
  }
  async function teacherLogout(){ const { auth } = await init(); await auth.signOut(); }
  async function onAuth(cb){ if (!enabled) return cb(null); const { auth } = await init(); auth.onAuthStateChanged(cb); }
  async function watchRoom(lesson, date, cls, cb, errCb){
    const { db } = await init();
    const r = db.collection('rooms').doc(roomId(lesson, date, cls));
    return r.collection('players').onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))), errCb);
  }
  async function deleteRoom(lesson, date, cls){
    const { db } = await init();
    const r = db.collection('rooms').doc(roomId(lesson, date, cls));
    let n = 0;
    for (const sub of ['players', 'board']){
      const snap = await r.collection(sub).get();
      let batch = db.batch(), c = 0;
      for (const d of snap.docs){ batch.delete(d.ref); c++; n++; if (c === 400){ await batch.commit(); batch = db.batch(); c = 0; } }
      if (c) await batch.commit();
    }
    const left = (await r.collection('players').get()).size + (await r.collection('board').get()).size;
    return { deleted: n, left };
  }

  return { enabled, init, today, roomId, classFromUrl, studentStart, push, flush, watchBoard,
           teacherLogin, teacherLogout, onAuth, watchRoom, deleteRoom,
           status: () => status, onStatus: fn => { listeners.push(fn); fn(status); }, uid: () => me };
})();
