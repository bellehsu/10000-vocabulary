'use strict';

let wordListState={page:Number(store.get('wordListPage',1))||1,letter:store.get('wordLetter','')||''};
const WORDS_PER_PAGE=10;
const WORD_LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function wordLetterBar(selected=''){
  return `<div class="letter-bar" aria-label="依英文字母篩選"><button class="letter-btn ${selected===''?'active':''}" data-letter="">全部</button>${WORD_LETTERS.map(letter=>`<button class="letter-btn ${selected===letter?'active':''}" data-letter="${letter}">${letter}</button>`).join('')}</div>`;
}

function wordPagination(current,total){
  if(total<=1)return '';
  const pages=[];
  const start=Math.max(1,current-2),end=Math.min(total,current+2);
  if(start>1)pages.push(`<button class="page-btn" data-page="1">1</button>${start>2?'<span class="page-ellipsis">…</span>':''}`);
  for(let p=start;p<=end;p++)pages.push(`<button class="page-btn ${p===current?'active':''}" data-page="${p}" ${p===current?'aria-current="page"':''}>${p}</button>`);
  if(end<total)pages.push(`${end<total-1?'<span class="page-ellipsis">…</span>':''}<button class="page-btn" data-page="${total}">${total}</button>`);
  return `<nav class="word-pagination" aria-label="單字換頁"><button class="page-btn nav-btn" data-page="${current-1}" ${current===1?'disabled':''}>‹ 上一頁</button><div class="page-numbers">${pages.join('')}</div><button class="page-btn nav-btn" data-page="${current+1}" ${current===total?'disabled':''}>下一頁 ›</button></nav>`;
}

wordsPage=function(){
  nav('words');
  const mode=store.get('wordMode','both');
  wordListState.letter=store.get('wordLetter','')||'';
  wordListState.page=Number(store.get('wordListPage',1))||1;
  app.innerHTML=`<div class="route-title"><h2>全部單字</h2><span class="muted">A–Z 字母排序，每頁 10 個單字</span></div>
  <section class="panel word-toolbar">
    <input id="q" placeholder="搜尋英文或中文" autocomplete="off">
    <select id="pos"><option value="">全部詞性</option>${[...new Set(searchIndex.map(w=>w.part_of_speech))].sort().map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select>
    <select id="mode"><option value="both">中英並列</option><option value="en">只看英文</option><option value="zh">只看中文</option></select>
  </section>
  <section class="panel alphabet-panel"><div class="alphabet-title"><b>字母排序</b><span id="wordCount" class="muted"></span></div>${wordLetterBar(wordListState.letter)}</section>
  <div id="wordList" class="word-list"></div><div id="wordPager"></div>`;
  $('#mode').value=mode;
  $('#q').oninput=()=>renderWords(true);
  $('#pos').onchange=()=>renderWords(true);
  $('#mode').onchange=()=>{store.set('wordMode',$('#mode').value);renderWords(false)};
  $$('.letter-btn').forEach(b=>b.onclick=()=>{wordListState.letter=b.dataset.letter;wordListState.page=1;store.set('wordLetter',wordListState.letter);store.set('wordListPage',1);$$('.letter-btn').forEach(x=>x.classList.toggle('active',x===b));renderWords(false)});
  renderWords(false);
};

renderWords=function(resetPage=false){
  const q=$('#q').value.trim().toLowerCase(),pos=$('#pos').value,m=$('#mode').value,s=hardSet();
  if(resetPage)wordListState.page=1;
  const sorted=[...searchIndex].sort((a,b)=>String(a.word||'').localeCompare(String(b.word||''),'en',{sensitivity:'base'}));
  const filtered=sorted.filter(w=>{
    const first=(String(w.word||'').trim()[0]||'').toUpperCase();
    return (!q||[w.word,w.chinese].join(' ').toLowerCase().includes(q))&&(!wordListState.letter||first===wordListState.letter)&&(!pos||w.part_of_speech===pos);
  });
  const totalPages=Math.max(1,Math.ceil(filtered.length/WORDS_PER_PAGE));
  wordListState.page=Math.min(Math.max(1,wordListState.page),totalPages);
  store.set('wordListPage',wordListState.page);
  const start=(wordListState.page-1)*WORDS_PER_PAGE;
  const list=filtered.slice(start,start+WORDS_PER_PAGE);
  $('#wordCount').textContent=`${filtered.length} 個單字${filtered.length?`・第 ${wordListState.page}/${totalPages} 頁`:''}`;
  $('#wordList').innerHTML=list.map((w,i)=>`<article class="word-item"><div class="word-main"><div class="word-rank">${start+i+1}</div><div class="word-en ${m==='zh'?'hidden':''}">${esc(w.word)}</div><div class="pos">${esc(w.part_of_speech)}</div><div class="word-zh ${m==='en'?'hidden':''}">${esc(w.chinese||'—')}</div><div class="meta">書本頁碼 ${w.page_end?`${w.page}–${w.page_end}`:w.page}｜難度 ${w.difficulty??'—'}/5</div><div id="detail-${i}" class="meta"></div>${m!=='both'?`<button class="icon-btn reveal" data-word="${esc(w.word)}" data-page="${w.page}">顯示${m==='en'?'中文':'英文'}</button>`:''}</div><div class="word-actions"><button class="icon-btn say" data-word="${esc(w.word)}" aria-label="播放 ${esc(w.word)} 發音">🔊</button><button class="icon-btn detail" data-i="${i}" data-word="${esc(w.word)}" data-page="${w.page}">詳細</button><button class="icon-btn hard ${s.has(w.word)?'review-on':''}" data-word="${esc(w.word)}">${s.has(w.word)?'✓ 已標記不熟':'＋ 標記不熟'}</button></div></article>`).join('')||'<section class="panel">沒有符合條件的單字。</section>';
  $('#wordPager').innerHTML=filtered.length?wordPagination(wordListState.page,totalPages):'';
  $$('.page-btn[data-page]').forEach(b=>b.onclick=()=>{if(b.disabled)return;wordListState.page=Number(b.dataset.page);store.set('wordListPage',wordListState.page);renderWords(false);window.scrollTo({top:0,behavior:'smooth'})});
  $$('.say').forEach(b=>b.onclick=()=>speak(b.dataset.word));
  $$('.hard').forEach(b=>b.onclick=()=>{const set=hardSet();set.has(b.dataset.word)?set.delete(b.dataset.word):set.add(b.dataset.word);saveHard(set);renderWords(false)});
  $$('.reveal').forEach(b=>b.onclick=()=>{const w=searchIndex.find(x=>x.word===b.dataset.word&&String(x.page)===b.dataset.page);b.textContent=m==='en'?(w?.chinese||'—'):(w?.word||'—')});
  $$('.detail').forEach(b=>b.onclick=async()=>{const target=$(`#detail-${b.dataset.i}`);target.textContent='載入中…';try{const rows=await loadBucketForPage(b.dataset.page);const w=rows.find(x=>x.word===b.dataset.word&&x.page===b.dataset.page);target.innerHTML=w?`<div><b>例句：</b>${esc(w.example||'—')}</div><div>${esc(w.example_zh||'')}</div><div><b>同義：</b>${esc(w.synonyms||'—')}　<b>反義：</b>${esc(w.antonyms||'—')}</div><div><b>提示：</b>${esc(w.memory_hint||'—')}</div>`:'找不到詳細資料';b.disabled=true}catch(e){target.textContent=`載入失敗：${e.message}`}});
};

const alphaStyle=document.createElement('style');
alphaStyle.textContent=`
.word-toolbar{display:grid;grid-template-columns:minmax(0,2fr) 1fr 1fr;gap:8px}.word-toolbar input,.word-toolbar select{width:100%;padding:11px;border:1px solid #ccd7d4;border-radius:10px;background:#fff}.alphabet-panel{padding:12px 14px}.alphabet-title{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:9px}.letter-bar{display:flex;gap:6px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:thin;-webkit-overflow-scrolling:touch}.letter-btn,.page-btn{border:1px solid #b9cbc6;background:#fff;color:#244b45;border-radius:10px;font-weight:750}.letter-btn{flex:0 0 auto;min-width:40px;height:40px;padding:0 10px}.letter-btn.active,.page-btn.active{background:var(--p);border-color:var(--p);color:#fff}.word-rank{font-size:11px;color:#8a9793;margin-bottom:2px}.word-pagination{display:flex;justify-content:center;align-items:center;gap:10px;margin:18px 0 8px}.page-numbers{display:flex;align-items:center;justify-content:center;gap:5px}.page-btn{min-width:38px;min-height:40px;padding:8px 10px}.page-btn:disabled{opacity:.4;cursor:default}.page-ellipsis{color:#77847f;padding:0 2px}
@media(max-width:560px){.word-toolbar{grid-template-columns:1fr 1fr}.word-toolbar input{grid-column:1/-1}.alphabet-panel{margin-left:-12px;margin-right:-12px;border-radius:0;padding-left:12px;padding-right:12px}.letter-bar{margin-right:-12px;padding-right:12px}.letter-btn{min-width:42px;height:42px}.word-pagination{display:grid;grid-template-columns:1fr 1fr;gap:8px}.page-numbers{grid-column:1/-1;grid-row:1;overflow-x:auto;justify-content:flex-start;padding:2px 0}.word-pagination>.nav-btn{grid-row:2;width:100%;min-height:44px}.word-item{padding:13px}.word-actions .icon-btn{min-height:42px}.word-actions .hard{flex:1 1 auto}.route-title .muted{font-size:13px}}
`;
document.head.appendChild(alphaStyle);
