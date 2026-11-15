/* Story Engine - definisi menu (mode), tema visual, aturan fakta, dan pembuat prompt.
   Dimuat SEBELUM story-engine.js. */

var FACT_RULES = [
  'FACTUAL INTEGRITY (mandatory, overrides creativity):',
  '- Use only real, verifiable facts. NEVER invent people, quotes, dialogue, dates, numbers, places, studies, or events.',
  '- If a detail is uncertain, leave it out or say plainly that it is uncertain. Never fill gaps with guesses.',
  '- A historical topic must be a real, documented event. Do not dramatize beyond what is documented.',
  '- If SOURCE MATERIAL is supplied, rely only on it plus universally established facts. Add nothing it does not support.',
  '- "sources": list only real, checkable sources (institution/author/publication + year) you are confident exist. If you cannot name one, return an empty list and explain in "notes". Never fabricate a source.',
  '- Every scene needs "fact_basis": the real fact or source that supports its narration.',
  '- If the topic is not a real documented fact/event, or you cannot write it without inventing details, reply ONLY with {"error":"short reason"}.'
].join('\n');

var CONTENT = {
  manual: {
    title: 'Manual Footage', chip: 'MANUAL FOOTAGE',
    desc: 'Naskah faktual (sejarah / kisah nyata). Gambar dan suara diunggah manual.',
    kind: 'factual documentary video', fact: true, source: true, auto: false,
    visual: 'realistic documentary footage style, natural light, candid composition, historically plausible details',
    theme: 'Dokumenter / kisah nyata',
    prompt: 'Tell a real story or real historical event as a clear documentary narrative.\n' +
      'STRUCTURE: hook -> context -> what happened (in order) -> turning point -> outcome -> why it matters.\n' +
      'TONE: accurate, grounded, respectful. No invented drama, no invented dialogue.\n' +
      'Visuals are reconstructions/illustrations of documented facts, not fake evidence.'
  },
  explainer: {
    title: 'Explainer', chip: 'EXPLAINER',
    desc: 'Satu kalimat topik jadi video penjelasan otomatis (naskah, gambar via Flow, suara, subtitle).',
    kind: 'explainer video', fact: true, source: true, auto: true,
    visual: 'clean educational illustration, every scene visually shows what the narration explains',
    theme: 'Flat Vector',
    prompt: 'Explain one topic simply and accurately.\n' +
      'STRUCTURE: hook question -> why it matters -> how it works step by step -> relatable example -> surprising fact -> takeaway.\n' +
      'RULE: each scene must visually show exactly what its narration explains. Keep one consistent visual system across scenes.'
  },
  drama: {
    title: 'Drama AI', chip: 'DRAMA AI',
    desc: 'Drama fiksi dengan karakter AI konsisten. Hasil: video drama + suara + subtitle.',
    kind: 'fictional AI drama', fact: false, source: false, auto: true, characters: true,
    visual: 'cinematic realistic film still of AI-generated human characters, natural skin texture, emotional lighting, shallow depth of field',
    theme: 'Drama sinematik',
    prompt: 'Write a FICTIONAL short drama (invented story and characters are fine and expected).\n' +
      'STRUCTURE: emotional hook -> protagonists -> relationship/conflict -> escalation -> turning point -> emotional resolution.\n' +
      'CHARACTER RULE: keep a small cast (2-3). Give each character a fixed, detailed look (face, hair, age, clothing) and repeat it exactly in every scene they appear in.\n' +
      'Dialogue may be written inside the narration. Keep scenes short, visual, and emotionally clear.'
  },
  stickman: {
    title: 'Stickman', chip: 'STICKMAN',
    desc: 'Video stickman cepat, lucu, penuh reaksi. Hook kuat di awal supaya penonton nonton sampai habis.',
    kind: 'fast comedic stickman video', fact: true, source: true, auto: true, stick: true,
    visual: 'simple stickman cartoon, thick black outlines, round head with big expressive face, flat bright background, meme-style reaction pose',
    theme: 'Stickman',
    prompt: 'Explain the topic as a fast, funny stickman video that makes viewers curious until the very end.\n' +
      'MUST INCLUDE: (1) simple stickman characters, (2) expressive faces, (3) dynamic movement, (4) meme-style reactions, (5) fast camera movement, (6) bold short subtitles, (7) comedic timing.\n' +
      'HOOK: scene 1 must be a shocking, funny or curious hook (a question, a bold claim, or a relatable pain) that creates an open loop. Pay it off near the end.\n' +
      'PACING: very short scenes (1-2 short sentences), punchy rhythm, a joke or reaction beat every 2-3 scenes, a quick recap at the end.\n' +
      'The comedy must never distort the facts.\n' +
      'Per scene also fill: "camera" (one of zoom_in, zoom_out, shake, pan_left, pan_right, whip), "reaction" (one of shock, facepalm, laugh, think, cry, mindblown, sus, none), "sfx" (one of whoosh, pop, ding, click, riser, success, none).'
  }
};

/* [id, label, deskripsi, gaya gambar, nada, boleh teks di gambar] */
var THM = [
  ['flat', 'Flat Vector', 'Bentuk geometris, warna solid, bersih', 'flat vector illustration, clean geometric shapes, solid colors, minimal shading, modern explainer style', 'clear, friendly and easy to follow'],
  ['char', 'Character Animation', 'Karakter kartun ekspresif', '2D character animation style, expressive cartoon characters, clean outlines, bright colors, consistent character design', 'lively and character-driven'],
  ['mot', 'Motion Graphics', 'Bentuk, ikon, gradasi modern', 'motion graphics frame, bold shapes, icons, smooth gradients, clean modern layout', 'modern, crisp and energetic'],
  ['info', 'Infographic', 'Diagram, grafik, ikon', 'infographic illustration, diagram with charts and icons, clean layout, flat colors, easy to read', 'informative and structured'],
  ['wb', 'Whiteboard', 'Spidol hitam di papan putih', 'hand-drawn whiteboard illustration, black marker lines on white background, minimal color accents', 'simple, clear, step by step'],
  ['doo', 'Doodle', 'Coretan tangan yang playful', 'quirky hand-drawn doodle illustration, sketchy lines, playful colors, notebook paper feel', 'playful and light'],
  ['3dc', '3D Cartoon', 'Karakter 3D bulat dan cerah', 'stylized 3D cartoon render, soft studio lighting, rounded expressive characters, vibrant colors', 'warm and fun'],
  ['sci', 'Scientific 3D', 'Visual sains 3D, potongan penampang', 'scientific 3D visualization, cutaway cross-section, accurate educational render, clean lab lighting, labeled parts look', 'precise and educational'],
  ['iso', 'Isometric', 'Miniatur sudut isometrik', 'isometric illustration, 30-degree angle, clean vector, detailed miniature scene, pastel palette', 'tidy and explanatory'],
  ['cin', 'Cinematic', 'Seperti adegan film', 'cinematic film still, dramatic lighting, shallow depth of field, rich color grading', 'dramatic and immersive'],
  ['news', 'News Broadcast', 'Gaya siaran berita TV', 'TV news broadcast style frame, studio graphics, clean professional look, graphic panels without readable text', 'neutral, authoritative and concise'],
  ['kin', 'Kinetic Typography', 'Huruf besar jadi visual utama', 'bold kinetic typography poster, one large expressive keyword as the main visual, high contrast colors, minimal background', 'punchy and rhythmic', true],
  ['story', 'Storybook', 'Cat air lembut buku cerita', 'storybook illustration, soft watercolor textures, warm pastel palette, whimsical children-book style', 'gentle and imaginative'],
  ['paper', 'Paper Cut', 'Kertas berlapis dengan bayangan', 'layered paper cut-out art, paper craft diorama, soft depth shadows between layers, handmade texture', 'crafty and charming'],
  ['scifi', 'Futuristic / Sci-Fi', 'Neon, hologram, teknologi masa depan', 'futuristic sci-fi concept art, neon holographic interfaces, sleek technology, glowing lights, cinematic', 'sleek and futuristic'],
  ['stick', 'Stickman', 'Stickman tebal, wajah ekspresif', 'simple stickman cartoon, thick black outlines, round head with big expressive face, flat bright background colors, meme-style reaction pose, bold composition', 'fast, funny and curious'],
  ['drama', 'Drama sinematik', 'Manusia realistis, cahaya emosional', 'cinematic realistic film still of AI-generated human characters, natural skin texture, emotional warm lighting, shallow depth of field, 35mm look', 'emotional and heartfelt'],
  ['doc', 'Dokumenter / kisah nyata', 'Realistis, natural, ala dokumenter', 'realistic documentary photography, natural light, candid look', 'factual and grounded'],
  ['his', 'Sejarah klasik', 'Lukisan minyak, adegan zaman dulu', 'classical oil painting style, historical scene, dramatic chiaroscuro lighting', 'serious and respectful'],
  ['custom', 'Tulis sendiri', 'Isi gaya visual sendiri (bahasa Inggris)', '', 'engaging']
];

var MODE_KEY = 'explainer';

function themeAllowsText() {
  var t = THM[$('theme').selectedIndex] || THM[0];
  return !!t[5];
}
function NT() { return themeAllowsText() ? '' : 'no text, '; }

/* Peringatan judul: judul harus masuk akal dan spesifik. */
function titleWarning(t, mode) {
  var w = String(t || '').trim().split(/\s+/).filter(Boolean);
  if (w.length < 3) return 'Judul terlalu pendek. Tulis topik yang spesifik (minimal 3 kata).';
  var p = CONTENT[mode] || {};
  if (p.fact && /\b(rahasia gelap|konspirasi|ternyata ayah|ternyata istri|ternyata suami|kisah horor)\b/i.test(t))
    return 'Judul ini terdengar seperti cerita karangan. Menu ini hanya untuk fakta yang nyata.';
  return '';
}

function mk1() {
  var t = $('title').value.trim();
  if (!t) return;
  sv();
  var mode = $('mode').value, profile = CONTENT[mode] || CONTENT.explainer;
  var en = $('lang').value === 'en';
  var th = THM[$('theme').selectedIndex] || THM[0];
  var n = parseInt($('n').value) || 8;
  var st = $('style').value || th[3] || profile.visual;
  var dur = $('dur') ? parseFloat($('dur').value) : 0;
  var words = dur ? Math.round(dur * 150) : n * 22;
  var lang = en ? 'English' : 'Bahasa Indonesia';
  var src = $('newsSource') ? $('newsSource').value.trim() : '';

  var out = [];
  out.push('Create a ' + profile.kind + ' titled "' + t + '".');
  out.push('Language of all narration (voice-over text): ' + lang + '. Image descriptions ("visual", character "look") must be in English.');
  out.push('Exactly ' + n + ' scenes. Total narration about ' + words + ' words (about ' + Math.round(words / n) + ' words per scene).');
  out.push('Tone: ' + th[4] + '.');
  out.push('Visual style: ' + st + '.');
  out.push('');
  out.push('CONTENT DNA:\n' + profile.prompt);
  if (profile.fact) {
    out.push('');
    out.push(FACT_RULES);
    out.push('');
    out.push('SOURCE MATERIAL:\n' + (src || '[none supplied - use only well-established, verifiable facts and say so in "notes"]'));
  } else {
    out.push('');
    out.push('This is fiction: invented characters and events are allowed. Do not present the story as real news or real history.');
  }
  var sc = '"no":1,"narration":"voice-over text in ' + lang + '","visual":"image description in English: location, action, expression, camera angle","characters":["names in this scene"],"mood":""';
  if (profile.fact) sc += ',"fact_basis":""';
  if (profile.stick) sc += ',"camera":"","reaction":"","sfx":""';
  var head = '"title":"","style":"","characters":[{"name":"","look":"fixed physical description and clothing, in English"}]';
  if (profile.fact) head += ',"sources":[{"name":"","year":""}],"notes":""';
  out.push('');
  out.push('Reply ONLY with valid JSON (no markdown, no other text) in this format:\n{' + head + ',"scenes":[{' + sc + '}]}');
  out.push('Make the opening scene an immediate hook, keep continuity across scenes, and end with a memorable payoff.');
  $('p1').value = out.join('\n');
  $('p1').style.display = $('c1').style.display = 'block';
}

function setMode(k) {
  if (!CONTENT[k]) k = 'explainer';
  MODE_KEY = k; $('mode').value = k;
  var p = CONTENT[k];
  $('modeTitle').textContent = p.title;
  $('modeChip').textContent = p.chip;
  $('modeDesc').textContent = p.desc;
  var nc = $('newsContext');
  if (nc) nc.style.display = p.source ? 'block' : 'none';
  var ti = Array.prototype.findIndex.call($('theme').options, function (o) { return o.textContent === p.theme; });
  if (ti >= 0) { $('theme').selectedIndex = ti; tm(); }
  if ($('p1').style.display === 'block') mk1();
}
