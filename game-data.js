/* =====================================================================
   중국어 탐험대 · 9차시 「판다의 야시장 먹방」 — 설정 파일 (game-data.js)
   ---------------------------------------------------------------------
   선생님이 고쳐도 되는 곳은 이 파일뿐입니다. (온라인 연결은 firebase-config.js)
   - 따옴표(' ') 안의 글자와 숫자만 바꾸고, 쉼표(,)와 괄호는 지우지 마세요.
   - 음식 사진은 img 폴더에 있어요. (9차시 PPT 사진)
   ===================================================================== */

window.GAME_DATA = {

  lessonId: 'lesson9',                // 선생님 화면 '차시' 칸에 이 글자를 써요
  saveKey: 'panda-lesson9',
  stageLabel: '9차시 복습',
  title: '판다의 야시장 먹방',
  subtitle: '你想吃什么？',
  story: [
    '해가 지고, 중국의 야시장에 빨간 등불이 하나둘 켜졌어요.',
    '배고픈 판다가 맛있는 냄새를 따라 시장 길로 들어가요. 가게마다 파는 음식이 다 달라요!',
    '가게에 가면 점원이 물어요. "你想吃什么？ 뭐 먹고 싶어요?" 대답하고 하나씩 먹어 봐요!'
  ],

  /* 점수 · taste: 가게 진열대의 음식 사진을 처음 눌러 볼 때 받는 별 */
  points: { firstTry: 100, retry: 60, taste: 5 },

  /* ---------- 음식 (사진: img/아이디.jpg) ---------- */
  foods: {
    jiaozi:        { text: '饺子',     pinyin: 'jiǎozi',         ko: '교자' },
    mantou:        { text: '馒头',     pinyin: 'mántou',         ko: '만터우 (속 없는 찐빵)' },
    baozi:         { text: '包子',     pinyin: 'bāozi',          ko: '바오쯔 (속 있는 찐빵)' },
    guotie:        { text: '锅贴',     pinyin: 'guōtiē',         ko: '군만두' },
    miantiao:      { text: '面条',     pinyin: 'miàntiáo',       ko: '국수' },
    zhajiangmian:  { text: '炸酱面',   pinyin: 'zhájiàngmiàn',   ko: '짜장면' },
    lahaixianmian: { text: '辣海鲜面', pinyin: 'là hǎixiān miàn', ko: '짬뽕' },
    mifan:         { text: '米饭',     pinyin: 'mǐfàn',          ko: '흰밥' },
    chaofan:       { text: '炒饭',     pinyin: 'chǎofàn',        ko: '볶음밥' },
    huoguo:        { text: '火锅',     pinyin: 'huǒguō',         ko: '훠궈' },
    malatang:      { text: '麻辣烫',   pinyin: 'málàtàng',       ko: '마라탕' },
    kaoya:         { text: '北京烤鸭', pinyin: 'Běijīng kǎoyā',  ko: '베이징 오리구이' },
    tangcurou:     { text: '糖醋肉',   pinyin: 'tángcùròu',      ko: '탕수육' },
    tanghulu:      { text: '糖葫芦',   pinyin: 'tánghúlu',       ko: '탕후루' },
    shui:          { text: '水',       pinyin: 'shuǐ',           ko: '물', drink: true },
    kele:          { text: '可乐',     pinyin: 'kělè',           ko: '콜라', drink: true },
    guozhi:        { text: '果汁',     pinyin: 'guǒzhī',         ko: '주스', drink: true },
    cha:           { text: '茶',       pinyin: 'chá',            ko: '차', drink: true },
    naicha:        { text: '奶茶',     pinyin: 'nǎichá',         ko: '밀크티', drink: true },
    zhenzhunaicha: { text: '珍珠奶茶', pinyin: 'zhēnzhū nǎichá', ko: '버블 밀크티', drink: true }
  },

  /* ---------- 문장 소리 ---------- */
  audio: {
    useLocalFiles: true,
    useOnlineVoice: true,
    onlineVoiceUrl: 'https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q=',
    slowRate: 0.7,
    sounds: {
      nixiangchi: { text: '你想吃什么？', pinyin: 'Nǐ xiǎng chī shénme?' },
      nixianghe:  { text: '你想喝什么？', pinyin: 'Nǐ xiǎng hē shénme?' },
      haochima:   { text: '好吃吗？',     pinyin: 'Hǎochī ma?' },
      henhaochi:  { text: '很好吃！',     pinyin: 'Hěn hǎochī!' },
      haochi:     { text: '好吃',         pinyin: 'hǎochī' },
      xiexie:     { text: '谢谢',         pinyin: 'xièxie' },
      bukeqi:     { text: '不客气',       pinyin: 'bú kèqi' },
      meiguanxi:  { text: '没关系',       pinyin: 'méi guānxi' },
      wanan:      { text: '晚安',         pinyin: 'wǎn’ān' },
      zaijian:    { text: '再见',         pinyin: 'zàijiàn' },
      order_zhajiangmian: { text: '我想吃炸酱面。', pinyin: 'Wǒ xiǎng chī zhájiàngmiàn.' },
      order_kaoya:        { text: '我想吃北京烤鸭。', pinyin: 'Wǒ xiǎng chī Běijīng kǎoyā.' }
      // 음식 이름 소리(jiaozi 등)와 "我想吃○○。" "我想喝○○。" 문장은 위 foods에서 자동으로 만들어요.
    }
  },

  /* ---------- 야시장 가게 (길 순서대로) ----------
     owner: 점원 그림 · sign: 간판 · color: 가게 색 · items: 진열대 음식
     ask: 점원 질문 (nixiangchi 먹을 것 / nixianghe 마실 것)
     문제 종류
       pickWord  : 주문 쪽지 사진을 보고 알맞은 말 고르기
       hearPhoto : 주문을 듣고 사진 고르기
       myChoice  : 먹고 싶은 것을 마음대로 고른 뒤, 문장 만들기 (verb 고르기 또는 순서 맞추기)
       zoomPhoto : 아주 가까이 찍은 사진을 보고 무슨 음식인지 맞히기
       reply     : 질문에 알맞은 대답 고르기                                            */
  stalls: [
    { id: 'dumpling', name: '만두 가게', sign: '饺子馆', owner: '🐰', color: '#e2483b', items: ['jiaozi', 'mantou', 'baozi', 'guotie'], ask: 'nixiangchi',
      mission: { id: 'q1', type: 'pickWord', place: '만두 가게', photo: 'baozi',
        question: '친구가 주문 쪽지를 줬어요. 이 음식을 주문해요!',
        options: ['jiaozi', 'mantou', 'baozi'], answer: 'baozi',
        hint: '안에 고기 속이 들어 있는 찐빵은 包子 bāozi, 속이 없는 찐빵은 馒头 mántou예요.' } },
    { id: 'noodle', name: '국수 가게', sign: '面馆', owner: '🐱', color: '#f08c2b', items: ['miantiao', 'zhajiangmian', 'lahaixianmian'], ask: 'nixiangchi',
      extra: { title: '짜장면도 모습이 달라요', text: '중국의 炸酱面은 진한 된장 소스에 오이·채소를 올려 비벼 먹어요. 한국 짜장면보다 소스가 적고 짭짤해요.', img: 'zhajiangmian_cn' },
      mission: { id: 'q2', type: 'hearPhoto', place: '국수 가게', sound: 'order_zhajiangmian',
        question: '옆 친구가 주문해요. 친구는 무엇을 먹고 싶을까요?',
        options: ['miantiao', 'zhajiangmian', 'lahaixianmian'], answer: 'zhajiangmian',
        hint: '我想吃 다음을 잘 들어 보세요. 炸酱面 zhájiàngmiàn은 짜장면이에요.' } },
    { id: 'rice', name: '밥집', sign: '米饭', owner: '🐻', color: '#d4a12a', items: ['mifan', 'chaofan'], ask: 'nixiangchi',
      mission: { id: 'q3', type: 'myChoice', mode: 'order', place: '밥집', choices: ['mifan', 'chaofan'], verb: '吃',
        question: '흰밥? 볶음밥? 먹고 싶은 것을 마음대로 골라요!',
        question2: '이제 점원에게 말해요. 조각을 순서대로 눌러 문장을 만들어요.',
        extra: ['喝'],
        hint: '나(我) → 하고 싶다(想) → 먹다(吃) → 음식 순서예요. 喝는 "마시다"라서 밥에는 안 어울려요.' } },
    { id: 'hotpot', name: '훠궈·마라탕', sign: '火锅', owner: '🐯', color: '#c2185b', items: ['huoguo', 'malatang'], ask: 'nixiangchi',
      extra: { title: '지역마다 다른 맛', text: '쓰촨·후난 지방은 얼얼하고 매운맛(麻辣)을 좋아하고, 광둥 지방은 재료 본래의 맛을 살린 요리를 좋아해요.' },
      mission: { id: 'q4', type: 'zoomPhoto', place: '훠궈·마라탕', photo: 'malatang', zoom: { x: 55, y: 55, scale: 3 },
        question: '점원이 그릇을 아주 가까이 보여 줘요. 무슨 음식일까요?',
        options: ['huoguo', 'malatang', 'miantiao'], answer: 'malatang',
        hint: '그릇 하나에 빨간 국물과 여러 재료가 담겨 있어요. 냄비에 끓여 먹는 건 火锅예요.' } },
    { id: 'duck', name: '오리구이 가게', sign: '烤鸭店', owner: '🦊', color: '#8e3fbf', items: ['kaoya', 'tangcurou'], ask: 'nixiangchi',
      mission: { id: 'q5', type: 'hearPhoto', place: '오리구이 가게', sound: 'order_kaoya',
        question: '점원이 오늘의 추천 음식을 말해요. 어떤 음식일까요?',
        options: ['kaoya', 'tangcurou', 'chaofan'], answer: 'kaoya',
        hint: '北京 Běijīng은 베이징, 烤鸭 kǎoyā는 오리구이예요.' } },
    { id: 'snack', name: '간식 가게', sign: '糖葫芦', owner: '🐹', color: '#e5397f', items: ['tanghulu'], ask: 'nixiangchi',
      mission: { id: 'q6', type: 'zoomPhoto', place: '간식 가게', photo: 'tanghulu', zoom: { x: 42, y: 40, scale: 2.6 },
        question: '반짝반짝 빨간 간식! 가까이 보면 무엇일까요?',
        options: ['tanghulu', 'jiaozi', 'naicha'], answer: 'tanghulu',
        hint: '과일에 설탕 시럽을 입혀 꼬치에 꽂은 간식이에요.' } },
    { id: 'drink', name: '음료 가게', sign: '奶茶店', owner: '🐶', color: '#2a9d8f', items: ['shui', 'kele', 'guozhi', 'cha', 'naicha', 'zhenzhunaicha'], ask: 'nixianghe',
      mission: { id: 'q7', type: 'myChoice', mode: 'verb', place: '음료 가게', choices: ['shui', 'kele', 'guozhi', 'cha', 'naicha', 'zhenzhunaicha'],
        question: '목이 말라요! 마시고 싶은 음료를 마음대로 골라요.',
        question2: '점원에게 말해요. 빈칸에 알맞은 말은?',
        verbs: ['吃', '喝'], verb: '喝',
        hint: '마실 것은 喝 hē(마시다), 먹을 것은 吃 chī(먹다)예요. 점원도 你想喝什么？라고 물었어요.' } }
  ],

  /* ---------- 마지막: 집에 돌아와서 ---------- */
  home: {
    name: '판다네 집', owner: '🐼',
    mission: { id: 'q8', type: 'reply', place: '판다네 집', sound: 'haochima',
      question: '엄마 판다가 물어요. "好吃吗？ 맛있었어?" 뭐라고 대답할까요?',
      options: [ { text: '很好吃！', sub: 'Hěn hǎochī!', sound: 'henhaochi', correct: true },
                 { text: '没关系', sub: 'méi guānxi', sound: 'meiguanxi' },
                 { text: '不客气', sub: 'bú kèqi', sound: 'bukeqi' } ],
      hint: '好吃는 "맛있다". 很好吃！는 "아주 맛있어요!"예요.' },
    full: '다 먹었어요~ 배불러요! 🐼💤',
    sleep: '이제 자러 갈게요. 晚安! 잘 자요~'
  }
};

/* (고치지 마세요) 선생님 화면이 문제 목록을 읽는 부분 */
window.GAME_DATA.zones = window.GAME_DATA.stalls.concat([window.GAME_DATA.home])
  .map(s => ({ id: s.id || 'home', name: s.name, missions: [s.mission] }));
