
var $=function(i){return document.getElementById(i)},D=null;
var DB_NAME='story_engine_db',DB_VER=1;
function getSettings(){try{return JSON.parse(localStorage.getItem('se_settings')||'{}')}catch(e){return {}}}
function saveSettings(){var s={openaiKey:$('setOpenAIKey').value.trim(),openaiModel:$('setOpenAIModel').value.trim()||'gpt-4o-mini'};localStorage.setItem('se_settings',JSON.stringify(s));$('setMsg').textContent='Settings tersimpan di browser lokal.'}
function clearOpenAIKey(){$('setOpenAIKey').value='';var s=getSettings();s.openaiKey='';localStorage.setItem('se_settings',JSON.stringify(s));$('setMsg').textContent='API key dihapus.'}
function loadSettings(){var s=getSettings();if($('setOpenAIKey'))$('setOpenAIKey').value=s.openaiKey||'';if($('setOpenAIModel'))$('setOpenAIModel').value=s.openaiModel||'gpt-4o-mini'}
function showPage(p){window.location.href=p==='dashboard'?'dashboard.html':p==='settings'?'settings.html':p==='motion'?'motion-graphic.html':'explainer.html'}
function openDB(){return new Promise(function(res,rej){var r=indexedDB.open(DB_NAME,DB_VER);r.onupgradeneeded=function(){var db=r.result;if(!db.objectStoreNames.contains('videos')){var st=db.createObjectStore('videos',{keyPath:'id'});st.createIndex('createdAt','createdAt')}};r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}})}
function saveVideoRecord(rec){return openDB().then(function(db){return new Promise(function(res,rej){var tx=db.transaction('videos','readwrite');tx.objectStore('videos').put(rec);tx.oncomplete=function(){res()};tx.onerror=function(){rej(tx.error)}})})}
function getVideos(){return openDB().then(function(db){return new Promise(function(res,rej){var tx=db.transaction('videos','readonly'),st=tx.objectStore('videos'),a=[];st.openCursor(null,'prev').onsuccess=function(e){var cur=e.target.result;if(cur){a.push(cur.value);cur.continue()}else res(a)};tx.onerror=function(){rej(tx.error)}})})}
function deleteVideo(id){return openDB().then(function(db){return new Promise(function(res,rej){var tx=db.transaction('videos','readwrite');tx.objectStore('videos').delete(id);tx.oncomplete=res;tx.onerror=function(){rej(tx.error)}})})}
function clearVideoLibrary(){if(!confirm('Hapus semua video yang tersimpan di Dashboard?'))return;openDB().then(function(db){var tx=db.transaction('videos','readwrite');tx.objectStore('videos').clear();tx.oncomplete=renderDashboard})}
function renderDashboard(){var box=$('dashList');if(!box)return;box.innerHTML='<div class="empty">Memuat library...</div>';getVideos().then(function(L){$('dashCount').textContent=L.length+' video';if(!L.length){box.innerHTML='<div class="empty">Belum ada video tersimpan. Generate video dari salah satu menu untuk masuk ke sini.</div>';return}box.innerHTML=L.map(function(v){return '<article class="video-card"><video controls playsinline src="'+URL.createObjectURL(v.blob)+'"></video><div class="video-meta"><div><div class="video-title">'+esc(v.title)+'</div><div class="video-sub">'+esc(v.modeLabel)+' • '+esc(v.formatLabel)+' • '+new Date(v.createdAt).toLocaleString('id-ID')+'</div></div><span class="badge">'+v.scenes+' scene</span></div><div class="video-copy"><label class="f">Caption<textarea readonly id="dc'+v.id+'">'+esc(v.caption)+'</textarea></label><button class="g" onclick="copyTextValue(\'dc'+v.id+'\')">Copy caption</button><label class="f" style="margin-top:8px">Hashtag<textarea readonly id="dh'+v.id+'" style="min-height:55px">'+esc(v.hashtags)+'</textarea></label><button class="g" onclick="copyTextValue(\'dh'+v.id+'\')">Copy hashtag</button></div><div class="row" style="margin-top:8px"><button class="g" onclick="downloadStored(\''+v.id+'\')">Download</button><button class="g" onclick="removeStored(\''+v.id+'\')">Hapus</button></div></article>'}).join('')}).catch(function(e){box.innerHTML='<div class="empty">Dashboard gagal dibuka: '+esc(e.message)+'</div>'})}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]})}
function copyTextValue(id){var t=$(id);if(!t)return;navigator.clipboard.writeText(t.value).catch(function(){t.select();document.execCommand('copy')})}
function downloadStored(id){getVideos().then(function(L){var v=L.find(function(x){return x.id===id});if(!v)return;var a=document.createElement('a');a.href=URL.createObjectURL(v.blob);a.download='story-'+id+'.webm';a.click()})}
function removeStored(id){deleteVideo(id).then(renderDashboard)}
function slugWords(txt){return String(txt||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(function(w){return w.length>=4&&['yang','dengan','untuk','dari','dalam','atau','adalah','ternyata','ketika','karena','sebuah','this','that','with','from','into','about','what','when','your','have','will'].indexOf(w)<0})}
function buildSocial(){if(!D||!D.scenes||!D.scenes.length)return null;var hook=String(D.scenes[0].narration||'').trim(),title=String($('title').value||D.title||'').trim(),mode=$('mode').value;var lead=hook||title;var c=lead+'\n\n'+(title&&hook.toLowerCase()!==title.toLowerCase()?title+' — simak ceritanya sampai akhir.':'Simak ceritanya sampai akhir.')+'\n\nFollow untuk cerita dan konten berikutnya.';var base={explainer:['#FAMSALExplains','#Explainer','#FaktaMenarik'],news:['#FAMSALNow','#News','#BeritaTerkini'],drama:['#FAMSALStories','#DramaAI','#Cerita'],horror:['#FAMSALDark','#HorrorAI','#CeritaHorror'],psychology:['#FAMSALMind','#Psychology','#Psikologi'],history:['#FAMSALOrigin','#History','#Sejarah']};var tags=base[mode]||base.explainer;slugWords(title+' '+hook).slice(0,5).forEach(function(w){var h='#'+w.charAt(0).toUpperCase()+w.slice(1);if(tags.indexOf(h)<0)tags.push(h)});return {hook:hook,caption:c,hashtags:tags.join(' ')}}
function updateSocial(){var x=buildSocial();if(!x)return;$('socialCaption').value=x.caption;$('socialHashtags').value=x.hashtags;$('socialSection').style.display='block'}
function sv(){try{localStorage.setItem('se',JSON.stringify({t:$('title').value,j:$('js').value}))}catch(e){}}
function cp(id){var t=$(id);t.select();try{navigator.clipboard.writeText(t.value)}catch(e){document.execCommand('copy')}}
function mk1(){
var t=$('title').value.trim();if(!t)return;sv();
var en=$('lang').value==='en',th=THM[$('theme').selectedIndex]||THM[0],n=$('n').value,st=$('style').value;
var profile=CONTENT[$('mode').value]||CONTENT.explainer;
var extra=profile.prompt;
if($('mode').value==='news'){
  extra += '\n\nNEWS SOURCE / RAW CONTEXT:\n'+($('newsSource').value.trim()||'[No source text supplied. Use only information explicitly provided in the topic and clearly label uncertain details.]');
}
var common=en
?'Write a short '+profile.kind+' titled "'+t+'" in English, divided into '+n+' scenes.'
:'Buat konten '+profile.kind+' berjudul "'+t+'" dalam Bahasa Indonesia, dibagi menjadi '+n+' adegan.';
var tone=en?'Tone: '+th[4]+'.':'Nada cerita: '+th[4]+'.';
var visual='Visual style: '+(st||profile.visual)+'.';
var json=en
?'Reply ONLY with valid JSON (no other text, no markdown) in this format:\n{"title":"","style":"","characters":[{"name":"","look":"consistent physical description and clothing, in English"}],"scenes":[{"no":1,"narration":"voice-over text in English (2-3 sentences)","visual":"image description in English: location, action, expression, camera angle","characters":["names of characters in this scene"],"mood":""}]}'
:'Balas HANYA dengan JSON valid (tanpa teks lain, tanpa markdown) dengan format:\n{"title":"","style":"","characters":[{"name":"","look":"deskripsi fisik & pakaian yang konsisten, dalam bahasa Inggris"}],"scenes":[{"no":1,"narration":"teks narasi voice over dalam Bahasa Indonesia (2-3 kalimat)","visual":"deskripsi gambar adegan dalam bahasa Inggris: lokasi, aksi, ekspresi, sudut kamera","characters":["nama karakter di adegan ini"],"mood":""}]}';
var ending=en
?'Make the opening immediately engaging, maintain continuity across scenes, and end with a memorable payoff.':'Buat opening yang langsung menarik, jaga konsistensi antaradegan, dan akhiri dengan payoff yang kuat.';
$('p1').value=common+'\n'+tone+'\n'+visual+'\n\nCONTENT DNA:\n'+extra+'\n\n'+json+'\n'+ending;
$('p1').style.display=$('c1').style.display='block';
}

function gen(){$('er').textContent='';sv();var d;try{d=JSON.parse($('js').value.replace(/^```json|```$/g,'').trim())}catch(e){$('er').textContent='JSON tidak valid: '+e.message;return}
if(!d.scenes||!d.scenes.length){$('er').textContent='Tidak ada "scenes".';return}D=d;SA=[];SD=[];SCU=[];IB=[];
var ch={};(d.characters||[]).forEach(function(c){ch[c.name]=c.look});var h='';
d.scenes.forEach(function(s,i){var who=(s.characters||[]).map(function(n){return n+' ('+(ch[n]||'')+')'}).join('; ');
var p='File name: gambar'+(s.no||i+1)+'. '+($('style').value||d.style)+'. '+s.visual+(who?' Characters: '+who+'.':'')+(s.mood?' Mood: '+s.mood+'.':'')+' '+AR()+', no text, no watermark.';
h+='<div class="sc"><b>Adegan '+(s.no||i+1)+'</b><textarea id="f'+i+'" readonly style="min-height:80px;margin-top:6px">'+p.replace(/</g,'&lt;')+'</textarea><div class="row" style="margin-top:6px"><button class="g" onclick="cp(\'f'+i+'\')">Copy prompt</button><input type="file" accept="image/*" onchange="im(this,'+i+')"></div><div class="s" style="margin:10px 0 4px"><b>Narasi:</b> '+String(s.narration).replace(/</g,'&lt;')+'</div><div class="row"><button class="g" onclick="cn('+i+')">Copy narasi</button><input type="file" accept="audio/*" onchange="sa(this.files[0],'+i+')"></div><small id="as'+i+'" style="color:var(--mu)"></small><img id="i'+i+'" style="display:none"></div>'});
$('scenes').innerHTML=h;$('all').value=d.scenes.map(function(s,i){return '[gambar'+(s.no||i+1)+']\n'+$('f'+i).value}).join('\n\n');$('s3').style.display=$('s4').style.display='block';
$('nar').value=d.scenes.map(function(s){return s.narration}).join('\n\n');updateSocial();srt()}
var dz=$('dz');dz.ondragover=function(e){e.preventDefault()};dz.ondrop=function(e){e.preventDefault();fl(e.dataTransfer.files)};
function put(i,x){var m=$('i'+i);m.src=URL.createObjectURL(x.b);m.style.display='block';IB[i]=x;if(!$('n'+i))m.insertAdjacentHTML('afterend','<div class="s" id="n'+i+'"></div>');$('n'+i).textContent=x.n;wpv()}
function fl(fs){var zm=$('zm');if(!D||typeof JSZip==='undefined'){zm.textContent=!D?'Generate dulu (langkah 2).':'JSZip gagal dimuat, coba refresh.';return}
var jobs=[];Array.from(fs).forEach(function(f){if(/\.zip$/i.test(f.name)){jobs.push(JSZip.loadAsync(f).then(function(z){var ps=[];z.forEach(function(p,e){if(!e.dir&&/\.(png|jpe?g|webp)$/i.test(p)&&p.indexOf('__MACOSX')<0)ps.push(e.async('blob').then(function(b){return{n:p.split('/').pop(),b:b}}))});return Promise.all(ps)}))}else if(/^image\//.test(f.type))jobs.push([{n:f.name,b:f}])});
Promise.all(jobs).then(function(r){var L=[].concat.apply([],r);if(!L.length){zm.textContent='Tidak ada gambar ditemukan.';return}
L.sort(function(a,b){return a.n.localeCompare(b.n,undefined,{numeric:true})});
var nums=L.map(function(x){var m=x.n.replace(/\.\w+$/,'').match(/(\d+)(?!.*\d)/);return m?+m[1]:null});
var idx=nums.map(function(n){return D.scenes.findIndex(function(s,i){return n!==null&&(s.no||i+1)==n})});
var by=$('zmode').value==='num'&&idx.every(function(i){return i>=0})&&new Set(idx).size===L.length;
if(by)L.forEach(function(x,k){put(idx[k],x)});else L.forEach(function(x,k){if(k<D.scenes.length)put(k,x)});
zm.textContent=L.length+' gambar masuk ('+(by?'dicocokkan dari nomor di nama file':'diurutkan berdasarkan nama file')+')'+(L.length!==D.scenes.length?' — jumlahnya beda dengan '+D.scenes.length+' adegan, cek lagi.':'.')}).catch(function(e){zm.textContent='Gagal baca file: '+e.message})}

var CONTENT={
explainer:{
 title:'Explainer',chip:'EXPLAINER',desc:'Jelaskan sesuatu dengan visual AI yang mudah dipahami.',kind:'explainer / educational visual story',
 visual:'cinematic educational visualization, semi-realistic 3D illustration, clean composition, dramatic but informative lighting',
 prompt:`Explain one interesting concept in a simple and visually understandable way.
STRUCTURE: hook -> mystery/problem -> mechanism -> relatable example -> surprising conclusion -> takeaway.
STYLE RULE: every scene must visually represent what the narration explains.
Avoid random stock-like shots, unrelated characters, and generic cinematic filler.
Use analogies when useful. Keep the explanation factual and accessible.`,
 theme:'Dokumenter / kisah nyata'
},
news:{
 title:'News',chip:'NEWS',desc:'Berita aktual yang divisualisasikan dengan AI, bukan diposisikan sebagai rekaman asli.',kind:'news report / visual reconstruction',
 visual:'cinematic documentary news visualization, realistic environment, natural light, professional editorial composition, subtle camera movement',
 prompt:`Create a factual news-style narrative from the supplied topic and source context.
STRUCTURE: factual hook -> what happened -> who/what is involved -> timeline -> why it matters -> implications -> concise closing.
FACT RULE: separate confirmed facts from uncertainty. Do not invent quotes, people, statistics, locations, dates, or events. If the supplied source is insufficient, say what is unknown instead of fabricating it.
VISUAL RULE: AI visuals are illustrative reconstructions, never presented as authentic footage. Use documentary-style visualizations that clearly support the narration.`,
 theme:'Dokumenter / kisah nyata'
},
drama:{
 title:'Drama AI',chip:'DRAMA AI',desc:'Drama sinematik dengan karakter dan dunia yang konsisten.',kind:'cinematic AI drama',
 visual:'cinematic live-action drama, photorealistic film still, shallow depth of field, emotional lighting, 35mm film look',
 prompt:`Build a cinematic emotional drama with a strong character-driven conflict.
STRUCTURE: immediate emotional hook -> protagonist -> relationship/conflict -> escalation -> hidden information -> emotional climax -> twist or payoff.
CHARACTER BIBLE: recurring characters must keep the same face, age, hairstyle, body proportions, clothing logic, personality, and identity in every scene.
CAMERA LANGUAGE: close-ups, medium shots, over-the-shoulder shots, establishing shots, controlled cinematic movement.
Do not randomly change character appearance, location, era, or visual language.`,
 theme:'Sinematik / film'
},
horror:{
 title:'Horror AI',chip:'HORROR AI',desc:'Horor sinematik yang membangun rasa takut lewat atmosfer dan misteri.',kind:'psychological cinematic horror story',
 visual:'dark cinematic psychological horror, realistic environment, low-key lighting, deep shadows, fog, muted tones, eerie film still',
 prompt:`Create psychological horror that builds tension instead of relying on constant jump scares.
STRUCTURE: normal situation -> strange detail -> suspicion -> unexplained event -> escalation -> disturbing reveal -> lingering ending.
HORROR LANGUAGE: silence, anticipation, isolation, environmental details, subtle movement, unreliable perception.
CAMERA: slow controlled movement, static frames, POV shots, close-ups, claustrophobic compositions.
Keep recurring characters and locations visually consistent. Avoid random monsters or unrelated horror imagery.`,
 theme:'Horor / creepy'
},
psychology:{
 title:'Psychology',chip:'PSYCHOLOGY',desc:'Menjelaskan perilaku dan pikiran manusia dengan action/motion visual.',kind:'psychology visualization',
 visual:'minimal cinematic motion design, anonymous human silhouettes, symbolic objects, smooth movement, clean dark neutral background, soft cinematic lighting',
 prompt:`Explain one psychological concept through visual metaphors and controlled motion.
STRUCTURE: relatable situation -> psychological mechanism -> example -> why it happens -> practical takeaway.
VISUAL LANGUAGE: anonymous human figures, silhouettes, symbolic objects, simple environments, visual metaphors for memory, attention, fear, attachment, social pressure, decision-making, and emotion.
MOTION RULE: every visual movement must represent an idea from the narration. Avoid literal stock footage and random cinematic shots.
Keep the visual system minimal, consistent, and recognizable from scene to scene.`,
 theme:'Whiteboard / doodle'
},
history:{
 title:'History Stickman',chip:'HISTORY STICKMAN',desc:'Sejarah dengan dunia 2D stickman yang konsisten dan mudah diikuti.',kind:'stickman historical storytelling',
 visual:'stylized 2D stickman historical animation, clean hand-drawn lines, minimal environments, clear historical symbols, flat illustrative composition',
 prompt:`Explain a historical event as a fast, clear stickman story.
STRUCTURE: hook -> historical context -> trigger event -> major developments -> turning point -> outcome -> historical significance.
CHARACTER RULE: every human is a simple stickman. Recurring figures keep the same clothing symbols, accessories, proportions, and visual identity.
WORLD RULE: use maps, flags, buildings, vehicles, documents, weapons, and symbolic objects to communicate history.
TONE: educational, energetic, lightly humorous when appropriate, but respectful.
Do not introduce photorealistic people or switch to another art style.`,
 theme:'Sejarah klasik'
}
};
var MODE_KEY='explainer';
function setMode(k){
  MODE_KEY=k; $('mode').value=k;
  var p=CONTENT[k]||CONTENT.explainer;
  document.querySelectorAll('.nav button').forEach(function(b){b.classList.toggle('active',b.dataset.mode===k)});
  $('modeTitle').textContent=p.title;
  $('modeChip').textContent=p.chip;
  $('modeDesc').textContent=p.desc;
  $('newsContext').style.display=k==='news'?'block':'none';
  var ti=Array.prototype.findIndex.call($('theme').options,function(o){return o.textContent===p.theme});
  if(ti>=0){$('theme').selectedIndex=ti;tm()}
  try{localStorage.setItem('se_mode',k)}catch(e){}
  if($('p1').style.display==='block')mk1();
}
var THM=[
['cin','Sinematik drama','Film realistis, cahaya hangat, emosional','cinematic realistic film still, warm golden lighting, shallow depth of field, 35mm look','emotional heartfelt drama with a strong twist'],
['hor','Horor / creepy','Gelap, mencekam, penuh misteri','dark horror atmosphere, desaturated cold tones, fog, deep shadows, eerie cinematic','suspenseful and chilling, slow-building dread, shocking ending'],
['mot','Motivasi / inspiratif','Perjuangan hidup, penuh harapan','inspirational cinematic photography, golden hour light, hopeful mood, wide shots','uplifting and inspiring, struggle to success arc'],
['ani','Anime','Ilustrasi gaya animasi Jepang','anime style illustration, vibrant colors, clean line art, expressive faces, soft cel shading','dramatic and emotional'],
['3d','Animasi 3D (ala Pixar)','Karakter 3D lucu dan cerah','3D animated movie style, soft lighting, expressive rounded characters, vibrant colors','heartwarming and fun'],
['com','Komik / webtoon','Garis tegas, warna datar pekat','comic book webtoon illustration, bold ink outlines, flat vivid colors, halftone shading','punchy with dramatic reveals'],
['sto','Dongeng / storybook','Cat air lembut ala buku anak','soft watercolor storybook illustration for kids, pastel palette, gentle textures','gentle fairy tale with a moral lesson'],
['fan','Fantasi epik','Dunia magis, petualangan besar','epic fantasy concept art, dramatic lighting, rich detail, painterly','epic adventure with high stakes'],
['cyb','Cyberpunk / futuristik','Neon, kota masa depan','cyberpunk neon city, futuristic sci-fi, glowing lights, rainy streets, cinematic','tense and high-stakes'],
['doo','Whiteboard / doodle','Coretan spidol sederhana','hand-drawn whiteboard doodle illustration, simple black marker lines on white background, minimal color','clear, simple and easy to follow'],
['ret','Retro / vintage','Foto jadul, penuh nostalgia','vintage retro film photograph, grainy texture, faded colors, 1980s nostalgia','nostalgic and warm'],
['doc','Dokumenter / kisah nyata','Realistis ala berita, natural','realistic documentary photography, natural light, candid handheld look','factual and grounded, true-story feel'],
['his','Sejarah klasik','Lukisan minyak, adegan zaman dulu','classical oil painting style, historical scene, dramatic chiaroscuro lighting','dramatic historical storytelling'],
['custom','Tulis sendiri','Isi gaya visual sesuai keinginan lu','','engaging and emotional']];
var FM={tt:{n:'TikTok',w:1080,h:1920,ar:'vertical 9:16',sb:440,d:'Vertikal 9:16, 1080x1920. Subtitle dinaikkan dari area tombol TikTok.'},
ig:{n:'Instagram Reels',w:1080,h:1920,ar:'vertical 9:16',sb:400,d:'Vertikal 9:16, 1080x1920. Subtitle dinaikkan dari area caption.'},
fb:{n:'Facebook Reels',w:1080,h:1920,ar:'vertical 9:16',sb:360,d:'Vertikal 9:16, 1080x1920. Subtitle dinaikkan dari area tombol.'},
yt:{n:'YouTube Shorts',w:1080,h:1920,ar:'vertical 9:16',sb:380,d:'Vertikal 9:16, 1080x1920. Subtitle dinaikkan dari area judul.'},
yl:{n:'YouTube landscape',w:1920,h:1080,ar:'horizontal 16:9',sb:90,d:'Horizontal 16:9, 1920x1080, untuk video YouTube biasa.'},
sq:{n:'Persegi 1:1',w:1080,h:1080,ar:'square 1:1',sb:100,d:'Persegi 1:1, 1080x1080, untuk feed.'}};
function AR(){return FM[$('fmt').value].ar+' aspect ratio'}
function tm(){var t=THM[$('theme').selectedIndex]||THM[0];$('thd').textContent=t[2];var c=t[0]==='custom';$('style').style.display=c?'block':'none';if(!c)$('style').value=t[3]}
function up(){if(!D)return;D.scenes.forEach(function(s,i){var t=$('f'+i);if(t)t.value=t.value.replace(/ (vertical 9:16|horizontal 16:9|square 1:1) aspect ratio, no text/,' '+AR()+', no text')});$('all').value=D.scenes.map(function(s,i){return '[gambar'+(s.no||i+1)+']\n'+$('f'+i).value}).join('\n\n')}
function fm(){var f=FM[$('fmt').value];$('fmd').textContent=f.d;$('vf').textContent=f.n+' ('+f.w+'x'+f.h+')';up();wpv()}
function rf(){tm();$('ev').value=$('lang').value==='en'?'en-US-GuyNeural':'id-ID-ArdiNeural';if($('p1').style.display==='block')mk1()}
$('theme').innerHTML=THM.map(function(t){return '<option>'+t[1]+'</option>'}).join('');tm();fm();
var WI=null,IB=[];
var WPN={tl:'Kiri atas',tc:'Tengah atas',tr:'Kanan atas',ml:'Kiri tengah',mc:'Tengah',mr:'Kanan tengah',bl:'Kiri bawah',bc:'Tengah bawah',br:'Kanan bawah'};
function wgb(){var h='';Object.keys(WPN).forEach(function(k){h+='<button class="wb'+($('wp').value===k?' on':'')+'" title="'+WPN[k]+'" aria-label="'+WPN[k]+'" onclick="wsp(\''+k+'\')">&#9679;</button>'});$('wg').innerHTML=h}
function wsp(k){$('wp').value=k;wgb();wpv()}
function wl(f){if(!f){WI=null;wpv();return}var i=new Image();i.onload=function(){WI=i;wpv()};i.src=URL.createObjectURL(f)}
function drawWM(c,W,H){var t=$('wt').value.trim();if(!t&&!WI)return;var pos=$('wp').value,ax=pos[1]==='l'?0:pos[1]==='c'?0.5:1,ay=pos[0]==='t'?0:pos[0]==='m'?0.5:1,m=Math.min(W,H),fs=$('ws').value/100*m,pad=m*0.04,ih=fs*1.4,iw=WI?WI.naturalWidth/WI.naturalHeight*ih:0;c.save();c.globalAlpha=$('wo').value/100;c.font='700 '+fs+'px "Plus Jakarta Sans",system-ui,sans-serif';var tw=t?c.measureText(t).width:0,gp=(WI&&t)?fs*0.4:0,bw=iw+gp+tw,bh=Math.max(WI?ih:0,t?fs:0),x0=pad+ax*(W-2*pad-bw),y0=pad+ay*(H-2*pad-bh);if(WI)c.drawImage(WI,x0,y0+(bh-ih)/2,iw,ih);if(t){c.textAlign='left';c.textBaseline='middle';c.lineJoin='round';c.lineWidth=fs*0.14;c.strokeStyle='rgba(0,0,0,0.6)';c.fillStyle='#fff';c.strokeText(t,x0+iw+gp,y0+bh/2);c.fillText(t,x0+iw+gp,y0+bh/2)}c.restore()}
function wpv(){var cv=$('wpvc');if(!cv)return;var F=FM[$('fmt').value],k=420/Math.max(F.w,F.h),W=Math.round(F.w*k),H=Math.round(F.h*k),c=cv.getContext('2d');cv.width=W;cv.height=H;c.fillStyle='#2b2f38';c.fillRect(0,0,W,H);var m=D?$('i0'):null;if(m&&m.style.display!=='none'&&m.naturalWidth){var s=Math.max(W/m.naturalWidth,H/m.naturalHeight),w=m.naturalWidth*s,h=m.naturalHeight*s;c.drawImage(m,(W-w)/2,(H-h)/2,w,h)}var fs=Math.round(Math.min(W,H)*0.06);c.font='800 '+fs+'px "Plus Jakarta Sans",system-ui,sans-serif';c.textAlign='center';c.textBaseline='bottom';c.lineWidth=fs*0.2;c.lineJoin='round';c.strokeStyle='#000';c.fillStyle='#fff';var y=H-F.sb*k;c.strokeText('Contoh subtitle',W/2,y);c.fillText('Contoh subtitle',W/2,y);drawWM(c,W,H)}
async function dl(b,n,m){var d=null;try{d=window.claude?await claude.use('downloads'):null}catch(e){}if(!d){var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;document.body.appendChild(a);a.click();a.remove();return}try{await d.save({filename:n,data:b})}catch(e){if(e.code!=='declined')m.textContent='Gagal simpan: '+(e.message||e.code)}}
function ez(){var m=$('zm'),z=new JSZip(),n=0;IB.forEach(function(x,i){if(!x)return;var e=(x.n.match(/\.(png|jpe?g|webp)$/i)||['.png'])[0].toLowerCase();z.file('gambar'+(i+1)+e,x.b);n++});if(!n){m.textContent='Belum ada gambar.';return}z.generateAsync({type:'blob'}).then(function(b){dl(b,'gambar-bernomor.zip',m)})}
function jmd(){$('jauto').style.display=$('jm').value==='auto'?'block':'none'}
var MG={scenes:[],blob:null};
function mgDims(){
  var v=$('mgFmt').value;
  if(v==='yl')return{w:1920,h:1080};
  if(v==='sq')return{w:1080,h:1080};
  return{w:1080,h:1920};
}
function mgScenes(){
  var raw=$('mgScript').value.split(/\\n+/).map(function(x){return x.trim()}).filter(Boolean);
  var d=Math.max(1,Math.min(30,parseFloat($('mgDur').value)||4));
  return raw.map(function(t,i){return{no:i+1,text:t,d:d}});
}
function mgPreview(){
  MG.scenes=mgScenes();
  if(!MG.scenes.length){$('mgStatus').textContent='Isi script minimal 1 scene.';return}
  $('mgPreviewSection').style.display='block';
  $('mgTimeline').innerHTML=MG.scenes.map(function(s){return '<div style="padding:8px 10px;border:1px solid var(--bd);border-radius:10px;margin-bottom:6px"><b>Scene '+s.no+'</b> <span class="badge">'+s.d+'s</span><div style="margin-top:3px">'+esc(s.text)+'</div></div>'}).join('');
  var F=mgDims(),k=420/Math.max(F.w,F.h),cv=$('mgCanvas');cv.width=Math.round(F.w*k);cv.height=Math.round(F.h*k);
  MG.draw=mgDraw;mgDraw(0);
  $('mgStatus').textContent=MG.scenes.length+' scene • total '+(MG.scenes.length*MG.scenes[0].d).toFixed(1)+' detik.';
}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function mgWrap(ctx,t,max){
  var words=t.split(/\\s+/),lines=[],line='';
  words.forEach(function(w){var n=line?line+' '+w:w;if(ctx.measureText(n).width>max&&line){lines.push(line);line=w}else line=n});
  if(line)lines.push(line);return lines;
}
function mgDraw(time){
  if(!MG.scenes.length)return;
  var cv=$('mgCanvas'),c=cv.getContext('2d'),F=mgDims(),total=MG.scenes.length*MG.scenes[0].d;
  var tt=((time%total)+total)%total,idx=Math.min(MG.scenes.length-1,Math.floor(tt/MG.scenes[0].d)),p=(tt-idx*MG.scenes[0].d)/MG.scenes[0].d;
  c.fillStyle=$('mgBg').value;c.fillRect(0,0,cv.width,cv.height);
  var accent=$('mgAccent').value;
  c.globalAlpha=.12;c.fillStyle=accent;for(var i=0;i<12;i++){var r=30+i*8,x=(cv.width*.15+i*73+(tt*30))%cv.width,y=(cv.height*.12+i*97)%cv.height;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill()}c.globalAlpha=1;
  var fs=Math.max(28,Math.round(Math.min(cv.width,cv.height)*.075)),lines=mgWrap(c,MG.scenes[idx].text,cv.width*.78),lh=fs*1.18,block=lines.length*lh;
  var anim=$('mgAnim').value,off=0,alpha=1,scale=1;
  if(anim==='rise')off=(1-p)*cv.height*.12;
  if(anim==='slide')off=(1-p)*cv.width*.18;
  if(anim==='fade')alpha=Math.min(1,p*2);
  if(anim==='pop')scale=.85+.15*Math.min(1,p*2);
  c.save();c.translate(cv.width/2+off,cv.height/2);c.scale(scale,scale);c.globalAlpha=alpha;c.textAlign='center';c.textBaseline='middle';c.font='800 '+fs+'px "Plus Jakarta Sans",system-ui,sans-serif';c.fillStyle='#fff';c.strokeStyle='rgba(0,0,0,.55)';c.lineWidth=fs*.12;
  lines.forEach(function(line,j){var y=-block/2+j*lh+lh/2;if(anim==='type'){var chars=Math.max(0,Math.floor(line.length*Math.min(1,p*2)));line=line.slice(0,chars)}c.strokeText(line,0,y);c.fillText(line,0,y)});c.restore();
  c.fillStyle=accent;c.fillRect(0,cv.height-8,cv.width*p,8);
}
function mgRender(){
  if(!MG.scenes.length){mgPreview();if(!MG.scenes.length)return}
  var F=mgDims(),cv=document.createElement('canvas');cv.width=F.w;cv.height=F.h;var c=cv.getContext('2d'),stream=cv.captureStream(30),mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].filter(function(x){return window.MediaRecorder&&MediaRecorder.isTypeSupported(x)})[0];
  if(!mime){$('mgStatus').textContent='Browser tidak mendukung WebM MediaRecorder.';return}
  var rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000}),parts=[],total=MG.scenes.length*MG.scenes[0].d,start=performance.now();
  rec.ondataavailable=function(e){if(e.data.size)parts.push(e.data)};
  rec.onstop=function(){MG.blob=new Blob(parts,{type:'video/webm'});$('mgDownload').style.display='inline-block';$('mgStatus').textContent='Render selesai • '+total.toFixed(1)+' detik.'};
  rec.start(250);
  function tick(){var t=(performance.now()-start)/1000;if(t>=total){mgDraw(total-.001);rec.stop();return}mgDraw(t);$('mgStatus').textContent='Merender Motion Graphic... '+Math.round(t/total*100)+'%';requestAnimationFrame(tick)}tick();
}
function mgDownloadVideo(){if(!MG.blob)return;var a=document.createElement('a');a.href=URL.createObjectURL(MG.blob);a.download='motion-graphic.webm';document.body.appendChild(a);a.click();a.remove()}

function initStoryEngine(){try{setMode(document.body.dataset.mode||'explainer')}catch(e){setMode('explainer')}}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initStoryEngine)}else{initStoryEngine()}
var SA=[],SD=[],SCU=[];
function ps(){return !!D&&D.scenes.every(function(s,i){return SA[i]})}
function psTL(mx){var sc=[],ch=[],t=0,N=D.scenes.length;D.scenes.forEach(function(s,i){var w=String(s.narration).split(/\s+/).filter(Boolean),d=SD[i]+(i==N-1?0.6:0.35);sc.push({s:t,e:t+d});var cs=SCU[i]?rc(SCU[i],mx):[];if(!cs.length){for(var a=0;a<w.length;a+=mx){var c=w.slice(a,a+mx);cs.push({s:SD[i]*a/w.length,e:SD[i]*(a+c.length)/w.length,t:c.join(' ')})}}cs.forEach(function(x){ch.push({s:t+x.s,e:t+x.e,t:x.t})});t+=d});return{sc:sc,ch:ch,T:t}}
function setSA(i,f,name){return new Promise(function(res){var a=new Audio();a.preload='metadata';a.src=URL.createObjectURL(f);a.onloadedmetadata=function(){SA[i]=f;SD[i]=a.duration;SCU[i]=null;var e=$('as'+i);if(e)e.textContent='Audio: '+name+' ('+a.duration.toFixed(1)+' detik)';res()};a.onerror=function(){var e=$('as'+i);if(e)e.textContent='Audio tidak bisa dibaca: '+name;res()}})}
function sa(f,i){if(!f)return;setSA(i,f,f.name).then(sm)}
function sm(){if(!D)return;var n=0,t=0;D.scenes.forEach(function(s,i){if(SA[i]){n++;t+=SD[i]}});$('sbm').textContent=' '+n+'/'+D.scenes.length+' adegan punya audio'+(n?' ('+t.toFixed(1)+' detik)':'')+(n===D.scenes.length?'. Video akan pas per adegan.':'');srt()}
function sx(){SA=[];SD=[];SCU=[];if(D)D.scenes.forEach(function(s,i){var e=$('as'+i);if(e)e.textContent=''});sm()}
function sb(fs){if(!D){$('sbm').textContent=' Generate dulu (langkah 2).';return}var jobs=[];Array.from(fs).forEach(function(f){if(/\.zip$/i.test(f.name)){jobs.push(JSZip.loadAsync(f).then(function(z){var ps=[];z.forEach(function(p,e){if(!e.dir&&/\.(mp3|wav|m4a|ogg|aac|webm)$/i.test(p)&&p.indexOf('__MACOSX')<0)ps.push(e.async('blob').then(function(b){return{n:p.split('/').pop(),b:b}}))});return Promise.all(ps)}))}else jobs.push([{n:f.name,b:f}])});Promise.all(jobs).then(function(r){var L=[].concat.apply([],r);L.sort(function(a,b){return a.n.localeCompare(b.n,undefined,{numeric:true})});return Promise.all(L.slice(0,D.scenes.length).map(function(x,k){return setSA(k,x.b,x.n)})).then(function(){sm();if(L.length!==D.scenes.length)$('sbm').textContent+=' (jumlah file '+L.length+' beda dengan '+D.scenes.length+' adegan, cek lagi)'})}).catch(function(e){$('sbm').textContent=' Gagal baca file: '+e.message})}
function cn(i){var t=document.createElement('textarea');t.value=D.scenes[i].narration;document.body.appendChild(t);t.select();try{navigator.clipboard.writeText(t.value)}catch(e){document.execCommand('copy')}t.remove()}
function ep(){if(!D){$('epy').value='Generate dulu (langkah 2).';return}$('epy').value='import asyncio, edge_tts\n\nS = '+JSON.stringify(D.scenes.map(function(s){return String(s.narration)}))+'\nVOICE = "'+$('ev').value+'"\nRATE = "'+$('er2').value+'"\n\nasync def main():\n    for i, t in enumerate(S, 1):\n        await edge_tts.Communicate(t, VOICE, rate=RATE).save(f"adegan{i}.mp3")\n        print("selesai adegan", i)\n\nasyncio.run(main())\n'}
function pc(tx){var o=[];tx.replace(/\r/g,'').split(/\n\n+/).forEach(function(b){var L=b.split('\n'),i=L.findIndex(function(l){return l.indexOf('-->')>=0});if(i<0)return;var p=L[i].split('-->');o.push({s:tp(p[0]),e:tp(p[1].trim().split(' ')[0]),t:L.slice(i+1).join(' ').replace(/<[^>]+>/g,'').trim()})});return o.filter(function(c){return c.t&&!isNaN(c.s)&&!isNaN(c.e)})}
var CU=null;
function rc(cs,mx){var o=[];cs.forEach(function(c){var w=c.t.split(/\s+/).filter(Boolean),d=c.e-c.s;for(var a=0;a<w.length;a+=mx){var p=w.slice(a,a+mx);o.push({s:c.s+d*a/w.length,e:c.s+d*(a+p.length)/w.length,t:p.join(' ')})}});return o}
function oa(){var m=$('oam'),t=$('title').value.trim();if(!t){m.textContent='Isi judul di langkah 1 dulu.';return}mk1();var s=getSettings(),key=s.openaiKey||'';m.textContent=key?'Meminta cerita ke OpenAI...':'API key belum diisi di Settings...';fetch('/openai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:key,model:s.openaiModel||'gpt-4o-mini',prompt:$('p1').value})}).then(function(r){return r.json()}).then(function(j){if(j.error)throw new Error(j.error);$('js').value=j.text;gen();m.textContent=$('er').textContent?'':'Selesai, prompt Flow sudah dibuat di langkah 3.'}).catch(function(e){m.textContent='Gagal: '+e.message})}
function et(){var m=$('em');if(!D){m.textContent='Generate dulu (langkah 2).';return}m.textContent='Membuat suara...';fetch('/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:$('nar').value,voice:$('ev').value,rate:$('er2').value})}).then(function(r){return r.json()}).then(function(j){if(j.error)throw new Error(j.error);var b=atob(j.audio),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);SA=[];SD=[];SCU=[];al(new File([u],'voiceover.mp3',{type:'audio/mpeg'}));sl(new File([j.srt],'voiceover.srt'));m.textContent='Selesai, suara & subtitle sudah dimuat.'}).catch(function(e){m.textContent='Gagal: '+e.message+' (cek server lokal masih jalan)'})}
function et2(){var m=$('em');if(!D){m.textContent='Generate dulu (langkah 2).';return}var i=0,N=D.scenes.length;function nx(){if(i>=N){m.textContent='Selesai, suara '+N+' adegan sudah dimuat.';sm();return}m.textContent='Membuat suara adegan '+(i+1)+' dari '+N+'...';var idx=i;fetch('/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:String(D.scenes[idx].narration),voice:$('ev').value,rate:$('er2').value})}).then(function(r){return r.json()}).then(function(j){if(j.error)throw new Error(j.error);var b=atob(j.audio),u=new Uint8Array(b.length);for(var k=0;k<b.length;k++)u[k]=b.charCodeAt(k);return setSA(idx,new File([u],'adegan'+(idx+1)+'.mp3',{type:'audio/mpeg'}),'adegan'+(idx+1)+'.mp3').then(function(){SCU[idx]=pc(j.srt);i++;nx()})}).catch(function(e){m.textContent='Gagal: '+e.message+' (cek server lokal masih jalan)'})}nx()}
function ec(){$('ecmd').value='edge-tts --voice '+$('ev').value+' --rate='+$('er2').value+' --file naskah.txt --write-media voiceover.mp3 --write-subtitles voiceover.srt'}
function tp(x){var m=x.trim().replace(',','.').split(':').map(parseFloat);return m.length==3?m[0]*3600+m[1]*60+m[2]:m[0]*60+m[1]}
function sl(f){if(!f)return;f.text().then(function(tx){var o=[];tx.replace(/\r/g,'').split(/\n\n+/).forEach(function(b){var L=b.split('\n'),i=L.findIndex(function(l){return l.indexOf('-->')>=0});if(i<0)return;var p=L[i].split('-->');o.push({s:tp(p[0]),e:tp(p[1].trim().split(' ')[0]),t:L.slice(i+1).join(' ').replace(/<[^>]+>/g,'').trim()})});o=o.filter(function(c){return c.t&&!isNaN(c.s)&&!isNaN(c.e)});CU=o.length?o:null;$('sm').textContent=o.length?' '+o.length+' baris subtitle dimuat.':' Format tidak dikenali.';srt()})}
var AU=null,AD=0,VB=null;
function al(f){if(!f)return;var a=new Audio();a.preload='metadata';a.src=URL.createObjectURL(f);a.onloadedmetadata=function(){AU=f;AD=a.duration;var n=D?D.scenes.reduce(function(s,x){return s+String(x.narration).split(/\s+/).filter(Boolean).length},0):0;if(n)$('wps').value=(n/AD).toFixed(3);$('am').textContent=' '+f.name+' ('+AD.toFixed(1)+' detik)'+(n?' - subtitle disesuaikan ke durasi audio (SRT diperbarui otomatis).':'');srt()};a.onerror=function(){$('am').textContent=' Audio tidak bisa dibaca.'}}
function wrap(c,t,w){var ws=t.split(' '),l='',o=[];ws.forEach(function(x){var n=l?l+' '+x:x;if(c.measureText(n).width>w&&l){o.push(l);l=x}else l=n});if(l)o.push(l);return o}
function mkv(){var vm=$('vm');if(!D){vm.textContent='Generate dulu (langkah 2).';return}
var N=D.scenes.length,imgs=[];for(var i=0;i<N;i++){var m=$('i'+i);if(!m||m.style.display==='none'){vm.textContent='Adegan '+(i+1)+' belum ada gambar.';return}imgs.push(m)}
var mx=parseInt($('mw').value)||8,words=D.scenes.map(function(s){return String(s.narration).split(/\s+/).filter(Boolean)});
var tw=words.reduce(function(a,w){return a+w.length},0)||1,T=AU?AD:tw/(parseFloat($('wps').value)||2.5),sc=[],ch=[],t=0;
words.forEach(function(w,i){var d=w.length/tw*T;sc.push({s:t,e:t+d});var q=t;for(var a=0;a<w.length;a+=mx){var c=w.slice(a,a+mx),cd=c.length/w.length*d;ch.push({s:q,e:q+cd,t:c.join(' ')});q+=cd}t+=d});
if(CU){ch=rc(CU,mx);var cw=CU.map(function(c){return c.t.split(/\s+/).length}),ct=cw.reduce(function(a,b){return a+b},0),cum=0,j=0,pv=0,aw=0;if(!AU)T=CU[CU.length-1].e;sc=[];words.forEach(function(w,i){aw+=w.length;var tg=aw/tw*ct;while(j<CU.length&&cum<tg-0.01){cum+=cw[j];j++}var e=i==N-1?T:Math.min(T,CU[Math.max(j-1,0)].e);sc.push({s:pv,e:e});pv=e})}
var PS=ps();if(PS){var R=psTL(mx);sc=R.sc;ch=R.ch;T=R.T}
var cv=document.createElement('canvas');var F=FM[$('fmt').value],q=parseFloat($('vq').value)||1,W=Math.round(F.w*q),H=Math.round(F.h*q);cv.width=W;cv.height=H;var c=cv.getContext('2d'),st=cv.captureStream(30),au=null,ac=null,clock0=0,fin=false;
if(AU&&!PS){au=new Audio(URL.createObjectURL(AU));ac=new (window.AudioContext||window.webkitAudioContext)();var src=ac.createMediaElementSource(au),dst=ac.createMediaStreamDestination();src.connect(dst);dst.stream.getAudioTracks().forEach(function(k){st.addTrack(k)})}
var dst2=null;if(PS){ac=new (window.AudioContext||window.webkitAudioContext)();dst2=ac.createMediaStreamDestination();dst2.stream.getAudioTracks().forEach(function(k){st.addTrack(k)})}
var mt=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].filter(function(x){return window.MediaRecorder&&MediaRecorder.isTypeSupported(x)})[0];
if(!mt){vm.textContent='Browser ini tidak mendukung perekaman video.';return}
var rec=new MediaRecorder(st,{mimeType:mt,videoBitsPerSecond:q>=1?8000000:5000000}),parts=[];
rec.ondataavailable=function(e){if(e.data.size)parts.push(e.data)};
rec.onstop=function(){VB=new Blob(parts,{type:'video/webm'});var v=$('vv');v.src=URL.createObjectURL(VB);v.style.display='block';$('vd').style.display='inline-block';$('vb').disabled=false;var sx=buildSocial()||{caption:'',hashtags:''};var id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);saveVideoRecord({id:id,blob:VB,title:$('title').value.trim()||D.title||'Untitled',mode:$('mode').value,modeLabel:CONTENT[$('mode').value].chip,formatLabel:FM[$('fmt').value].n||$('fmt').value,scenes:N,createdAt:new Date().toISOString(),caption:sx.caption,hashtags:sx.hashtags}).then(function(){vm.textContent='Selesai ('+T.toFixed(1)+' detik). Video tersimpan di Dashboard.'}).catch(function(e){vm.textContent='Selesai ('+T.toFixed(1)+' detik), tetapi gagal menyimpan ke Dashboard: '+e.message})};
function draw(){var now=au?au.currentTime:(performance.now()-clock0)/1000;
if(now>=T||(au&&au.ended)){if(!fin){fin=true;setTimeout(function(){rec.stop();if(ac)ac.close()},300)}return}
var k=0;while(k<N-1&&now>=sc[k].e)k++;
var im=imgs[k],p=Math.min(1,Math.max(0,(now-sc[k].s)/((sc[k].e-sc[k].s)||1))),z=1+0.08*(k%2?1-p:p),iw=im.naturalWidth,ih=im.naturalHeight,s=Math.max(W/iw,H/ih)*z,w=iw*s,h=ih*s;
c.fillStyle='#000';c.fillRect(0,0,W,H);c.drawImage(im,(W-w)/2,(H-h)/2,w,h);drawWM(c,W,H);
var cc=ch.find(function(x){return now>=x.s&&now<x.e});
if(cc){var fs=Math.round(Math.min(W,H)*0.06);c.font='800 '+fs+'px "Plus Jakarta Sans",system-ui,sans-serif';c.textAlign='center';c.textBaseline='bottom';c.lineWidth=fs*0.2;c.lineJoin='round';var ls=wrap(c,cc.t,W*0.86);ls.forEach(function(l,j){var y=H-F.sb*q-(ls.length-1-j)*fs*1.25;c.strokeStyle='#000';c.strokeText(l,W/2,y);c.fillStyle='#fff';c.fillText(l,W/2,y)})}
vm.textContent='Merender... '+Math.round(now/T*100)+'%';requestAnimationFrame(draw)}
$('vb').disabled=true;$('vv').style.display='none';$('vd').style.display='none';rec.start(1000);
if(PS){vm.textContent='Menyiapkan audio...';Promise.all(D.scenes.map(function(s,i){return SA[i].arrayBuffer().then(function(b){return ac.decodeAudioData(b)})})).then(function(bf){ac.resume();var t0=ac.currentTime+0.2;bf.forEach(function(b,i){var so=ac.createBufferSource();so.buffer=b;so.connect(dst2);so.start(t0+sc[i].s)});clock0=performance.now()+200;draw()}).catch(function(e){vm.textContent='Audio gagal dibaca: '+e.message;rec.stop()})}else if(au){ac.resume();au.play().then(draw).catch(function(e){vm.textContent='Audio gagal diputar: '+e.message;rec.stop()})}else{clock0=performance.now();draw()}}
async function vdl(){if(!VB)return;var d=null;try{d=window.claude?await claude.use('downloads'):null}catch(e){}
if(!d){var a=document.createElement('a');a.href=URL.createObjectURL(VB);a.download='video-'+$('fmt').value+'.webm';document.body.appendChild(a);a.click();a.remove();return}
try{await d.save({filename:'video-'+$('fmt').value+'.webm',data:VB})}catch(e){if(e.code!=='declined')$('vm').textContent='Gagal simpan: '+(e.message||e.code)}}
function im(el,i){var f=el.files[0];if(!f)return;var m=$('i'+i);m.src=URL.createObjectURL(f);m.style.display='block';IB[i]={n:f.name,b:f};wpv()}
function ts(t){var h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=Math.floor(t%60),ms=Math.round((t%1)*1000),z=function(n,l){return String(n).padStart(l||2,'0')};return z(h)+':'+z(m)+':'+z(s)+','+z(ms,3)}
function srt(){if(ps()){$('sr').value=psTL(parseInt($('mw').value)||8).ch.map(function(c,i){return (i+1)+'\n'+ts(c.s)+' --> '+ts(c.e)+'\n'+c.t+'\n'}).join('\n');return}if(CU){$('sr').value=rc(CU,parseInt($('mw').value)||8).map(function(c,i){return (i+1)+'\n'+ts(c.s)+' --> '+ts(c.e)+'\n'+c.t+'\n'}).join('\n');return}if(!D)return;var w=parseFloat($('wps').value)||2.5,mx=parseInt($('mw').value)||8,t=0,k=1,out='';
D.scenes.forEach(function(s){var ws=String(s.narration).split(/\s+/).filter(Boolean);for(var a=0;a<ws.length;a+=mx){var c=ws.slice(a,a+mx),d=c.length/w;out+=k++ +'\n'+ts(t)+' --> '+ts(t+d)+'\n'+c.join(' ')+'\n\n';t+=d}});$('sr').value=out}
