'use strict';

function reviewWordKey(word){return String(word||'').trim().toLocaleLowerCase('en-US')}
function dedupeReviewEntries(entries){const seen=new Set();return entries.filter(entry=>{const key=reviewWordKey(entry.word);if(!key||seen.has(key))return false;seen.add(key);return true})}

const startPracticeBase=startPractice;
startPractice=async function(mode='page',page='',count='all'){
  if(mode==='page')return startPracticeBase(mode,page,count);
  let entries;
  if(mode==='history'){
    const hard=hardSet();
    entries=searchIndex.filter(x=>hard.has(x.word));
  }else{
    entries=[...searchIndex];
  }
  entries=shuffle(dedupeReviewEntries(entries));
  if(count!=='all')entries=entries.slice(0,Number(count)||entries.length);
  const pool=await loadEntriesDetails(entries);
  if(!pool.length){app.innerHTML='<section class="panel"><h2>目前沒有可練習的單字</h2></section>';return}
  session={mode,page:String(page||''),qs:makeQuestions(pool,pool.length),i:0,right:0,wrong:[],answered:false};
  renderQuestion();
};
