'use strict';
(() => {
  const cards = window.LAB_CARDS;
  const $ = id => document.getElementById(id);
  const storageKey = 'bloodlab-progress-v1';
  const statuses = {new:'未学习',review:'待复习',known:'已掌握'};
  let saved = {status:{},favorites:[],lastId:1};
  let storageAvailable = true;
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if(raw && typeof raw === 'object') {
      if(raw.status && typeof raw.status === 'object' && !Array.isArray(raw.status)) {
        saved.status = Object.fromEntries(Object.entries(raw.status).filter(([id,s]) => Number(id)>=1 && Number(id)<=1000 && ['review','known'].includes(s)));
      }
      if(Array.isArray(raw.favorites)) saved.favorites = [...new Set(raw.favorites.filter(id => Number.isInteger(id) && id>=1 && id<=1000))];
      if(Number.isInteger(raw.lastId) && raw.lastId>=1 && raw.lastId<=1000) saved.lastId=raw.lastId;
    }
  } catch { storageAvailable=false; }
  let category='all', mode='all', query='', deck=[], index=0, revealed=false, studied=new Set();
  let order=cards.map(c=>c.id), toastTimer, searchTimer;
  const favorites = new Set(saved.favorites);
  const byId = new Map(cards.map(c=>[c.id,c]));
  const categories = [...new Set(cards.map(c=>c.category))].map(key=>({key,label:cards.find(c=>c.category===key).categoryChinese,count:cards.filter(c=>c.category===key).length}));
  function notify(text) { $('announcement').textContent=text;$('announcement').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('announcement').classList.remove('visible'),2300); }
  function persist() {
    saved.favorites=[...favorites];
    try {localStorage.setItem(storageKey,JSON.stringify(saved));storageAvailable=true;} catch {storageAvailable=false;}
    if(!storageAvailable) $('storage-note').textContent='当前浏览器无法保存进度；本次仍可正常学习。';
  }
  function getStatus(id) { return saved.status[id] || 'new'; }
  function matches(c) {
    if(category!=='all' && c.category!==category) return false;
    if(mode==='favorite' && !favorites.has(c.id)) return false;
    if(['new','known','review'].includes(mode) && getStatus(c.id)!==mode) return false;
    return !query || [c.english,c.chinese,c.abbreviation,c.alias,c.note].join(' ').toLocaleLowerCase().includes(query);
  }
  function rebuild(keepId) {
    deck=order.map(id=>byId.get(id)).filter(matches);
    const match=deck.findIndex(c=>c.id===keepId);
    index=match>=0?match:0;
    render();
  }
  function stats() {
    const known=cards.filter(c=>getStatus(c.id)==='known').length;
    const review=cards.filter(c=>getStatus(c.id)==='review').length;
    $('known-count').textContent=known.toLocaleString();$('review-count').textContent=review.toLocaleString();$('new-count').textContent=(cards.length-known-review).toLocaleString();
    $('session-count').textContent=studied.size;$('progress').value=known;$('progress-label').textContent=known.toLocaleString()+' / 1,000';
  }
  function updateCategoryUI() {
    $('category-select').value=category;
    document.querySelectorAll('.category-button').forEach(b=>{const active=b.dataset.category===category;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});
    $('deck-name').textContent=category==='all'?'全部术语':categories.find(c=>c.key===category).label;
  }
  function render() {
    if('speechSynthesis' in window) window.speechSynthesis.cancel();
    revealed=false;stats();updateCategoryUI();
    $('study-area').hidden=deck.length===0;$('empty').hidden=deck.length!==0;
    $('position').textContent=deck.length?`${index+1} / ${deck.length.toLocaleString()}`:'0 / 0';
    if(!deck.length) {
      $('empty-title').textContent=query?'没有找到这个术语':mode==='new'?'这一组已经全部学过了':mode==='review'?'这一组暂时没有待复习卡片':mode==='favorite'?'还没有收藏这组卡片':mode==='known'?'这一组还没有已掌握卡片':'这里暂时没有卡片';
      $('empty-description').textContent=query?'试试更短的英文、中文或缩写。':mode==='favorite'?'在卡片右上角点星星，把想再看的词收藏起来。':'可以切换分类或学习状态，继续下一组。';return;
    }
    const c=deck[index];saved.lastId=c.id;persist();
    $('english').textContent=c.english;$('ipa').textContent=c.ipa;$('chinese').textContent=c.chinese;
    $('card-category').textContent=c.categoryChinese;
    $('abbreviation').hidden=!c.abbreviation;$('abbreviation').textContent=c.abbreviation?'缩写 · '+c.abbreviation:'';
    $('alias').hidden=!c.alias;$('alias').textContent=c.alias?'Also: '+c.alias:'';
    $('note').hidden=!c.note;$('note').textContent=c.note;
    $('card-id').textContent='NO. '+String(c.id).padStart(4,'0');$('card-status').textContent=statuses[getStatus(c.id)];
    const starred=favorites.has(c.id);$('favorite').textContent=starred?'★':'☆';$('favorite').setAttribute('aria-pressed',String(starred));$('favorite').setAttribute('aria-label',starred?'取消收藏当前术语':'收藏当前术语');
    $('answer').hidden=true;$('rating').hidden=true;$('reveal').hidden=false;
    $('previous').disabled=index===0;$('next').disabled=index>=deck.length-1;
    $('speak').setAttribute('aria-label','朗读 '+c.english);
  }
  function reveal() {if(!deck.length||revealed)return;revealed=true;$('answer').hidden=false;$('rating').hidden=false;$('reveal').hidden=true;notify('答案：'+deck[index].chinese);}
  function navigate(step) {if(!deck.length)return;const next=index+step;if(next<0||next>=deck.length)return;index=next;render();}
  function rate(status) {
    if(!deck.length||!revealed)return;
    const c=deck[index],oldIndex=index,nextId=deck[index+1]?.id;
    saved.status[c.id]=status;studied.add(c.id);persist();
    deck=order.map(id=>byId.get(id)).filter(matches);
    const nextIndex=deck.findIndex(c=>c.id===nextId);
    index=nextIndex>=0?nextIndex:Math.min(oldIndex,Math.max(0,deck.length-1));
    render();notify(status==='known'?'已标记掌握，继续加油！':'已放入待复习，之后再巩固。');
    if(deck.length) $('reveal').focus({preventScroll:true});
  }
  function categoryChange(key) {category=key;rebuild();}
  const allCategories=[{key:'all',label:'全部术语',count:1000},...categories];
  allCategories.forEach((c,i)=>{
    const b=document.createElement('button');b.className='category-button';b.dataset.category=c.key;
    const num=document.createElement('span');num.className='category-num';num.textContent=i===0?'▦':String(i).padStart(2,'0');
    const label=document.createElement('span');label.textContent=c.label;
    const count=document.createElement('span');count.className='count';count.textContent=c.count;
    b.append(num,label,count);b.addEventListener('click',()=>categoryChange(c.key));$('categories').append(b);
    const option=document.createElement('option');option.value=c.key;option.textContent=c.label+' · '+c.count;$('category-select').append(option);
  });
  $('category-select').addEventListener('change',e=>categoryChange(e.target.value));
  $('mode').addEventListener('change',e=>{mode=e.target.value;rebuild();});
  $('search').addEventListener('input',e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{query=e.target.value.trim().toLocaleLowerCase();rebuild();},150);});
  $('clear-filters').addEventListener('click',()=>{clearTimeout(searchTimer);query='';category='all';mode='all';$('search').value='';$('mode').value='all';rebuild();});
  $('shuffle').addEventListener('click',()=>{for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}rebuild();notify('已打乱当前卡片顺序');});
  $('reveal').addEventListener('click',reveal);$('previous').addEventListener('click',()=>navigate(-1));$('next').addEventListener('click',()=>navigate(1));
  $('again').addEventListener('click',()=>rate('review'));$('remember').addEventListener('click',()=>rate('known'));
  $('favorite').addEventListener('click',()=>{
    if(!deck.length)return;const c=deck[index],oldIndex=index;
    if(favorites.has(c.id))favorites.delete(c.id);else favorites.add(c.id);persist();
    if(mode==='favorite'&&!favorites.has(c.id)){deck=deck.filter(card=>card.id!==c.id);index=Math.min(oldIndex,Math.max(0,deck.length-1));render();}
    else{const starred=favorites.has(c.id);$('favorite').textContent=starred?'★':'☆';$('favorite').setAttribute('aria-pressed',String(starred));$('favorite').setAttribute('aria-label',starred?'取消收藏当前术语':'收藏当前术语');}
  });
  const speechSupported='speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  if(!speechSupported){$('speak').disabled=true;$('speak').title='当前浏览器不支持语音朗读，请参考音标';}
  $('speak').addEventListener('click',()=>{
    if(!speechSupported||!deck.length)return;
    window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(deck[index].english);utterance.lang='en-US';utterance.rate=.85;
    const voices=window.speechSynthesis.getVoices();utterance.voice=voices.find(v=>v.lang==='en-US')||voices.find(v=>/^en[-_]/i.test(v.lang))||null;
    utterance.onerror=e=>{if(!['interrupted','canceled'].includes(e.error))notify('暂时无法播放，请查看音标或换个浏览器。');};window.speechSynthesis.speak(utterance);
  });
  document.addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey||e.repeat||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable)return;
    if(e.key===' '){if(e.target.tagName==='BUTTON'&&e.target.id!=='reveal')return;e.preventDefault();reveal();}
    else if(e.key==='ArrowRight'){e.preventDefault();navigate(1);}else if(e.key==='ArrowLeft'){e.preventDefault();navigate(-1);}
    else if(e.key==='1')rate('review');else if(e.key==='2')rate('known');
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&speechSupported)window.speechSynthesis.cancel();});
  rebuild(saved.lastId);
})();
