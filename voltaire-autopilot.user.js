// ==UserScript==
// @name         Projet Voltaire Bot
// @namespace    pv-bot-local
// @version      3.2.0
// @description  Analyse les exercices et auto-clique SUIVANT/CONTINUER
// @match        https://apprentissage.appli3.projet-voltaire.fr/*
// @match        http://apprentissage.appli3.projet-voltaire.fr/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    API_URL: 'http://localhost:11434/api/chat',
    MODEL_NAME: 'gemma4:31b-cloud',
    DELAY: 1500,
  };

  // ── LLM ────────────────────────────────────────────────────────────────────
  function callLLM(prompt) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: CONFIG.API_URL,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          model: CONFIG.MODEL_NAME,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
        }),
        onload(res) {
          try {
            const data = JSON.parse(res.responseText);
            resolve(data.message?.content?.trim() || null);
          } catch (e) {
            resolve(null);
          }
        },
        onerror() { resolve(null); },
      });
    });
  }

  // ── Analyse orthographe ─────────────────────────────────────────────────────
  async function analyzeOrthographe(sentence) {
    const prompt = [
      'RÈGLE ABSOLUE : réponds avec UN SEUL MOT, rien d\'autre. Pas de phrase, pas d\'explication.',
      'Le mot doit être copié EXACTEMENT depuis la phrase (copier-coller).',
      'Si pas de faute : NULL',
      '',
      '═══ RÈGLES DE FRANÇAIS ═══',
      '',
      '── NIVEAU 1 : ORTHOGRAPHE DE BASE ──',
      '- Accents obligatoires : é/è/ê/ë, à/â, ù/û, î/ï, ô, ç',
      '  Pièges fréquents : événement, extrêmement, voilà, déjà',
      '- Mots invariables souvent mal écrits :',
      '  → auparavant (pas "auparavent")',
      '  → malgré (pas "malgrés")',
      '  → davantage (pas "d\'avantage" sauf avec article)',
      '  → parce que, quant à, vis-à-vis, peut-être',
      '  → biensûr = FAUX → bien sûr (deux mots)',
      '  → perpendiculaire, exceptionnel, professionnel',
      '',
      '── NIVEAU 2 : ACCORDS SIMPLES ──',
      '- Accord adjectif avec le nom (genre et nombre)',
      '  → "une décision importante" (féminin), "des résultats importants" (pluriel)',
      '- Tout/tous/toute/toutes : accord avec le nom qui suit',
      '  → tout le monde, tous les enfants, toute la classe, toutes les filles',
      '- Même : accord si adjectif (mêmes résultats), invariable si adverbe (même là)',
      '- Tel/telle/tels/telles : accord avec le nom qui suit',
      '',
      '── NIVEAU 3 : ACCORD SUJET-VERBE ──',
      '- Accord avec le sujet réel (pas le mot le plus proche)',
      '  → "la plupart des gens ONT dit" (pluriel)',
      '  → "beaucoup de travail EST nécessaire" (singulier)',
      '  → "l\'un ou l\'autre EST possible" (singulier)',
      '  → "ni l\'un ni l\'autre N\'EST venu" (singulier)',
      '- Sujet collectif : "une foule de gens EST/SONT" (les deux acceptés)',
      '- Sujet inversé : "Où SONT les clés ?" (accord avec clés)',
      '',
      '── NIVEAU 4 : HOMOPHONES ──',
      '- a (verbe avoir) / à (préposition) : remplacer par "avait" → si ça marche = "a"',
      '- ou (choix) / où (lieu/temps) : remplacer par "ou bien" → si ça marche = "ou"',
      '- ce (démonstratif) / se (pronom réfléchi)',
      '- son (possessif) / sont (verbe être)',
      '- on (pronom) / ont (verbe avoir)',
      '- leur (possessif invariable) / leurs (pluriel)',
      '- ces (démonstratif pluriel) / ses (possessif pluriel) / c\'est / s\'est',
      '- si (condition) / s\'y (pronom+y) / sci (outil)',
      '- quand (temps) / quant (à quant à) / qu\'en (que+en)',
      '- sans (préposition) / s\'en (pronom) / sang (liquide)',
      '- près (proximité) / prêt (ready) / par (préposition)',
      '- quelque(s) / quel(s) que / quelle(s) que',
      '',
      '── NIVEAU 5 : INFINITIF vs PARTICIPE PASSÉ ──',
      '- Test : remplacer le verbe par "vendre" ou "répondre"',
      '  → si on dit "vendr-e" = infinitif (-er)',
      '  → si on dit "vendu" = participe passé (-é)',
      '- "nous sommes allER" → FAUX (aller)',
      '- "il a mangER une pomme" → FAUX (mangé)',
      '- "il faut travaillER" → correct (infinitif)',
      '',
      '── NIVEAU 6 : ACCORD DU PARTICIPE PASSÉ ──',
      '- Avec ÊTRE : accord avec le sujet',
      '  → "elle est arrivÉE", "ils sont partIS"',
      '- Avec AVOIR : pas d\'accord sauf COD placé AVANT',
      '  → "il a mangé" (pas d\'accord), "la pomme qu\'il a mangÉE" (COD avant)',
      '- Verbes pronominaux : accord si le pronom est COD',
      '  → "elle s\'est blessÉE" (se=COD), "elle s\'est permIS de" (se=COI, pas d\'accord)',
      '- Participe passé suivi d\'infinitif : accord si sujet fait l\'action',
      '  → "la chanteuse que j\'ai entenduE chanter" (elle chante = accord)',
      '  → "la chanteuse que j\'ai entendu applaudir" (on l\'applaudit = pas d\'accord)',
      '',
      '── NIVEAU 7 : SUBJONCTIF ──',
      '- Subjonctif OBLIGATOIRE après :',
      '  bien que, quoique, pour que, afin que, à moins que, avant que,',
      '  il faut que, il est possible que, à condition que, pourvu que,',
      '  sans que, de peur que, de crainte que, jusqu\'à ce que',
      '- "bien que + subjonctif" : bien qu\'il SOIT (pas "est"), bien qu\'il AIT (pas "a")',
      '- "pour que + subjonctif" : pour qu\'il VIENNE (pas "vient")',
      '- Indicatif après : parce que, puisque, comme, après que (indicatif)',
      '',
      '── NIVEAU 8 : CAS COMPLEXES ──',
      '- "Si j\'aurais su" → FAUX → "Si j\'avais su" (pas de conditionnel après si)',
      '- "dont il en parle" → FAUX → "dont il parle" (dont remplace déjà de+COI)',
      '- "pallier à" → FAUX → "pallier" (verbe direct, pas de préposition)',
      '- "anticiper sur" → FAUX → "anticiper" (verbe direct)',
      '- "au jour d\'aujourd\'hui" → pléonasme mais acceptable selon contexte',
      '- Ponctuation : virgule avant "mais", "car", "or", "ni", "donc"',
      '',
      'EXEMPLES :',
      '"Les enfants joue." → joue',
      '"Tout les gens." → Tout',
      '"Bien qu\'il est là." → est',
      '"Nous sommes aller." → aller',
      '"Malgrés les bouchons." → Malgrés',
      '"Auparavent, nous partons." → Auparavent',
      '"Il a manger une pomme." → manger',
      '"Elle a était malade." → était',
      '"La plupart des gens a dit." → a',
      '"Il faut que tu sois là." → NULL',
      '"Elle chante très bien." → NULL',
      '"Il est parti hier soir." → NULL',
      '"Bien sûr, il viendra." → NULL',
      '"Si j\'aurais su, je serais venu." → aurais',
      '',
      ...(customRules ? [
        '',
        '══ RÈGLES SPÉCIFIQUES DU MODULE EN COURS (PRIORITÉ MAXIMALE) ══',
        customRules,
        '══════════════════════════════════════════════════════════════',
      ] : []),
      '',
      `"${sentence}" →`,
    ].join('\n');

    const answer = await callLLM(prompt);
    if (!answer) { return null; }

    const firstWord = answer.trim()
      .replace(/^[«»"'→\-.:]+/, '')
      .split(/[\s\n,.;:!?]/)[0]
      .replace(/[«»"'→\-.:]+$/, '')
      .trim();

    console.log(`🤖 LLM brut: "${answer.slice(0, 50)}" → extrait: "${firstWord}"`);
    return (!firstWord || firstWord.toUpperCase() === 'NULL') ? null : firstWord;
  }

  // ── Analyse synonyme ────────────────────────────────────────────────────────
  async function analyzeSynonym(word, options) {
    if (!word || !options || options.length < 2) { return null; }
    const optionsList = options.slice(0, 4).map((o, i) => `${i + 1}. ${o}`).join('\n');
    const prompt = [
      'Synonyme exact. Réponds avec une option UNIQUEMENT, sans ponctuation.',
      '',
      'Mot: "rapide" Options: 1. lent 2. vif 3. lourd 4. terne',
      'Réponse: vif',
      'Mot: "fatigué" Options: 1. reposé 2. alerte 3. épuisé 4. joyeux',
      'Réponse: épuisé',
      '',
      `Mot: "${word}" Options:\n${optionsList}`,
      'Réponse:',
    ].join('\n');

    const answer = await callLLM(prompt);
    if (!answer) { return null; }
    const clean = answer.replace(/^[0-9]+[.)]\s*/, '').replace(/^-\s*/, '').trim().split('\n')[0].trim();
    const match = options.find((o) => {
      const ol = o.toLowerCase().trim();
      const al = clean.toLowerCase().trim();
      return ol === al || ol.includes(al) || (al.includes(ol) && ol.length >= 3);
    });
    return match || clean;
  }

  // ── Extraction phrase orthographe ───────────────────────────────────────────
  const EXCLUDED = ['si vous voyez une faute', 'cliquez sur le bouton', "il n'y a pas de faute", 'cliquez dessus', "n'affecte pas", 'utiliser un indice', 'progression'];

  function extractSentence() {
    const wordDivs = Array.from(document.querySelectorAll('div[class*="r-1loqt21"]'))
      .filter((el) => {
        if (!el.offsetParent) { return false; }
        const t = el.textContent.trim();
        const tl = t.toLowerCase();
        return t.length > 0 && t.length < 30 &&
               !EXCLUDED.some((p) => tl.includes(p)) &&
               !['CONTINUER', 'SUIVANT', 'COMMENCER', 'IL N\'Y A PAS DE FAUTE'].includes(t.toUpperCase());
      });

    if (wordDivs.length >= 3) {
      const seen = new Set();
      const words = [];
      for (const div of wordDivs) {
        const t = div.textContent.trim();
        if (!seen.has(t)) { seen.add(t); words.push(t); }
      }
      const assembled = words.join(' ').replace(/\s([.,;:!?])/g, '$1');
      if (assembled.split(/\s+/).length >= 4) { return assembled; }
    }

    for (const id of ['html', 'body', 'i']) {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el || !el.offsetParent) { continue; }
      const t = el.textContent.trim();
      const tl = t.toLowerCase();
      if (t.length > 5 && t.length < 300 && !EXCLUDED.some((p) => tl.includes(p))) { return t; }
    }

    const candidates = Array.from(document.querySelectorAll('p, div'))
      .filter((el) => {
        if (!el.offsetParent || ['BUTTON', 'NAV', 'HEADER'].includes(el.tagName)) { return false; }
        const t = el.textContent.trim();
        const tl = t.toLowerCase();
        if (!t || EXCLUDED.some((p) => tl.includes(p))) { return false; }
        const words = t.split(/\s+/).length;
        return words >= 5 && words <= 25;
      })
      .sort((a, b) => a.children.length - b.children.length);
    return candidates[0]?.textContent.trim() || null;
  }

  // ── Extraction vocabulaire ──────────────────────────────────────────────────
  function extractVocabulaire() {
    let word = null;
    let optionElements = [];

    const spans = Array.from(document.querySelectorAll('[data-testid="b"]')).filter((el) => el.offsetParent);
    if (spans.length > 0) {
      const assembled = spans.map((el) => el.textContent.trim()).filter(Boolean).join('');
      if (assembled && assembled.length < 60) { word = assembled; }
    }

    if (!word) {
      const bold = Array.from(document.querySelectorAll('div, span, strong'))
        .find((el) => {
          if (!el.offsetParent) { return false; }
          const t = el.textContent.trim();
          const s = window.getComputedStyle(el);
          return t.length > 1 && t.length < 40 &&
                 t.split(/\s+/).length <= 3 &&
                 (parseInt(s.fontWeight) >= 700 || s.fontWeight === 'bold') &&
                 parseInt(s.fontSize) >= 18 &&
                 !t.toUpperCase().includes('VOCABULAIRE') &&
                 !t.includes('Cliquer') && !t.includes('professionnel');
        });
      if (bold) { word = bold.textContent.trim(); }
    }

    if (!word) { return null; }

    const seen = new Set();
    const options = [];

    Array.from(document.querySelectorAll('div, button'))
      .filter((el) => {
        if (!el.offsetParent) { return false; }
        const rect = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        const t = el.textContent.trim();
        const u = t.toUpperCase();
        return rect.width > 100 && rect.height > 30 && rect.height < 300 &&
               (s.cursor === 'pointer' || el.tagName === 'BUTTON') &&
               t.length >= 3 && t.length <= 120 &&
               u !== 'CONTINUER' && u !== 'SUIVANT' && u !== 'COMMENCER' &&
               !u.includes('JE NE PEUX PAS') && !u.includes('ACTIVER') &&
               !t.includes('Vocabulaire') && !t.includes('Cliquer') && t !== word;
      })
      .sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return (rb.width * rb.height) - (ra.width * ra.height);
      })
      .forEach((el) => {
        const t = el.textContent.trim();
        if (!seen.has(t.toUpperCase()) && options.length < 4) {
          seen.add(t.toUpperCase());
          options.push(t);
          optionElements.push(el);
        }
      });

    return options.length >= 2 ? { word, options, optionElements } : null;
  }

  // ── Détection type ──────────────────────────────────────────────────────────
  function detectType() {
    const noFault = Array.from(document.querySelectorAll('[data-testid="button"]'))
      .find((el) => el.offsetParent && el.textContent.trim().toUpperCase().includes('PAS DE FAUTE'));
    if (noFault) { return 'orthographe'; }
    if (document.querySelectorAll('[data-testid="b"]').length > 0) { return 'vocabulaire'; }
    const body = document.body?.textContent || '';
    if (body.includes("n'y a pas de faute") || body.includes('voyez une faute')) { return 'orthographe'; }
    if (body.includes('synonyme') || body.includes('sens est le plus proche') ||
        body.includes('contexte professionnel')) { return 'vocabulaire'; }
    return 'inconnu';
  }

  // ── Auto-clic boutons nav + audio ──────────────────────────────────────────
  function findBtn(text) {
    return Array.from(document.querySelectorAll('[data-testid="button"]'))
      .find((el) => el.offsetParent && el.textContent.trim().toUpperCase() === text);
  }

  let lastAutoClickTime = 0;
  let lastAutoClickBtn = null;

  function autoClickNavButtons() {
    const now = Date.now();
    if (now - lastAutoClickTime < 2000) { return; }
    if (window.location.href.includes('selection')) { return; }

    // 1. Fermer modale "Fonctionnalités sonores" → DÉSACTIVER (priorité absolue, ignore analyzing)
    const desactiverBtn = Array.from(document.querySelectorAll('button[data-testid="button"]'))
      .find((el) => {
        if (!el.offsetParent) { return false; }
        const t = el.textContent.trim().toUpperCase();
        return t === 'DÉSACTIVER' || t === 'DESACTIVER';
      });
    if (desactiverBtn) {
      console.log('🔇 Modale audio → DÉSACTIVER');
      lastAutoClickBtn = desactiverBtn;
      lastAutoClickTime = now;
      lastAnalyzedContent = '';
      analyzing = false;
      setTimeout(() => { desactiverBtn.click(); lastAutoClickBtn = null; }, 300);
      return;
    }

    // 2. Cliquer "JE NE PEUX PAS ÉCOUTER" (priorité absolue, ignore analyzing)
    const audioSkipBtn = Array.from(document.querySelectorAll('button[data-testid="button"]'))
      .find((el) => {
        if (!el.offsetParent) { return false; }
        const t = el.textContent.trim().toUpperCase();
        return t.includes('NE PEUX PAS') || t.includes('ÉCOUTER') || t.includes('ECOUTER');
      });
    if (audioSkipBtn) {
      console.log('🔇 Audio → skip');
      lastAutoClickBtn = audioSkipBtn;
      lastAutoClickTime = now;
      lastAnalyzedContent = '';
      analyzing = false;
      setTimeout(() => { audioSkipBtn.click(); lastAutoClickBtn = null; }, 300);
      return;
    }

    // Les actions suivantes attendent la fin de l'analyse
    if (analyzing) { return; }

    // 3. SUIVANT / CONTINUER — seulement si une réponse a été donnée
    const btn = findBtn('SUIVANT') || findBtn('CONTINUER');
    if (btn && btn !== lastAutoClickBtn) {
      // Ne cliquer CONTINUER que si on a déjà analysé au moins une fois
      const hasResult = resultEl && !resultEl.textContent.includes("En attente") &&
                        !resultEl.textContent.includes('Analyse') &&
                        !resultEl.textContent.includes('Synonyme') &&
                        !resultEl.textContent.includes('Nouvelle page');
      if (!hasResult && btn.textContent.trim().toUpperCase() === 'CONTINUER') { return; }
      console.log(`🤖 Auto-clic: ${btn.textContent.trim()}`);
      lastAutoClickBtn = btn;
      lastAutoClickTime = now;
      setTimeout(() => { btn.click(); lastAutoClickBtn = null; }, 300 + Math.random() * 400);
    }
  }

  // ── Panneau UI ──────────────────────────────────────────────────────────────
  let panelEl, resultEl, statusEl, wordEl;
  let analyzing = false;
  let lastAnalyzedContent = '';
  let customRules = GM_getValue('customRules', '');

  function createPanel() {
    const style = document.createElement('style');
    style.textContent = `
      #pv-panel{position:fixed;bottom:20px;right:20px;z-index:999999;background:#1e1e2e;color:#cdd6f4;border-radius:12px;padding:14px;font-family:sans-serif;font-size:13px;box-shadow:0 4px 24px rgba(0,0,0,.6);min-width:240px;max-width:320px;border:1px solid #45475a}
      #pv-header{font-weight:bold;font-size:15px;text-align:center;color:#cba6f7;margin-bottom:10px}
      #pv-status{text-align:center;font-size:11px;color:#a6adc8;margin-bottom:8px;min-height:14px}
      #pv-result{background:#313244;border-radius:8px;padding:10px;margin-bottom:10px;min-height:40px;text-align:center;font-size:14px;line-height:1.5}
      #pv-word{font-size:18px;font-weight:bold;color:#f38ba8;margin-top:4px}
      #pv-rules-label{font-size:11px;color:#a6adc8;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center}
      #pv-rules-label span{font-size:10px;color:#6c7086;cursor:pointer;}
      #pv-rules-label span:hover{color:#cba6f7}
      #pv-rules{width:100%;height:60px;background:#313244;border:1px solid #45475a;border-radius:6px;color:#cdd6f4;font-size:11px;padding:5px;resize:vertical;box-sizing:border-box;font-family:sans-serif;margin-bottom:8px}
      #pv-rules:focus{outline:none;border-color:#cba6f7}
      #pv-rules.active{border-color:#a6e3a1}
      #pv-toggle{width:100%;padding:7px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;background:#a6e3a1;color:#1e1e2e}
      #pv-toggle.on{background:#f38ba8}
    `;
    document.head.appendChild(style);

    panelEl = document.createElement('div');
    panelEl.id = 'pv-panel';
    panelEl.innerHTML = `
      <div id="pv-header">🤖 PV Bot</div>
      <div id="pv-status">Démarré</div>
      <div id="pv-result">
        <div>En attente d'un exercice...</div>
        <div id="pv-word"></div>
      </div>
      <div id="pv-rules-label">
        <span>📋 Règles du module (optionnel)</span>
        <span id="pv-rules-clear">✕ vider</span>
      </div>
      <textarea id="pv-rules" placeholder="Colle ici les règles du module en cours..."></textarea>
      <button id="pv-toggle">⏹ Arrêter</button>
    `;
    document.body.appendChild(panelEl);

    statusEl = document.getElementById('pv-status');
    resultEl = document.getElementById('pv-result').firstElementChild;
    wordEl = document.getElementById('pv-word');

    const rulesTextarea = document.getElementById('pv-rules');
    rulesTextarea.value = customRules;
    if (customRules) { rulesTextarea.classList.add('active'); }

    rulesTextarea.addEventListener('input', () => {
      customRules = rulesTextarea.value.trim();
      GM_setValue('customRules', customRules);
      rulesTextarea.classList.toggle('active', customRules.length > 0);
      // Forcer une nouvelle analyse avec les nouvelles règles
      lastAnalyzedContent = '';
    });

    document.getElementById('pv-rules-clear').addEventListener('click', () => {
      rulesTextarea.value = '';
      customRules = '';
      GM_setValue('customRules', '');
      rulesTextarea.classList.remove('active');
      lastAnalyzedContent = '';
    });

    document.getElementById('pv-toggle').addEventListener('click', () => {
      running = !running;
      const btn = document.getElementById('pv-toggle');
      if (running) {
        btn.textContent = '⏹ Arrêter';
        btn.classList.remove('on');
        setStatus('Repris');
      } else {
        btn.textContent = '▶ Démarrer';
        btn.classList.add('on');
        setStatus('En pause');
        setResult('En pause', '');
      }
    });
  }

  function setStatus(msg) {
    if (statusEl) { statusEl.textContent = msg; }
  }

  function setResult(main, word, color) {
    if (resultEl) { resultEl.textContent = main; }
    if (wordEl) {
      wordEl.textContent = word || '';
      wordEl.style.color = color || '#f38ba8';
    }
  }

  async function autoClickWord(word) {
    const target = word.toLowerCase().trim().replace(/[.,;:!?«»"']/g, '');
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const allDivs = Array.from(document.querySelectorAll('div[class*="r-1loqt21"]'))
      .filter((el) => {
        if (!el.offsetParent) { return false; }
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 &&
               r.left >= 0 && r.top >= 0 &&
               r.right <= vw && r.bottom <= vh;
      });

    const el = allDivs.find((d) => {
      return d.textContent.trim().toLowerCase().replace(/[.,;:!?«»"']/g, '') === target;
    }) || allDivs.find((d) => {
      const t = d.textContent.trim().toLowerCase().replace(/[.,;:!?«»"']/g, '');
      return t.includes(target) || (target.includes(t) && t.length >= 3);
    });

    if (!el) {
      console.log(`⚠️ Mot "${word}" introuvable dans le viewport`);
      return false;
    }

    const rect = el.getBoundingClientRect();
    console.log(`🖱️ Auto-clic sur "${el.textContent.trim()}" à (${Math.round(rect.left + rect.width/2)},${Math.round(rect.top + rect.height/2)})`);
    el.click();
    return true;
  }

  // ── Boucle principale ───────────────────────────────────────────────────────
  let running = true;
  let lastUrl = window.location.href;

  async function loop() {
    while (true) {
      await new Promise((r) => setTimeout(r, 800));
      if (!running) { continue; }

      autoClickNavButtons();

      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        lastAnalyzedContent = '';
        analyzing = false;
        setResult('Nouvelle page...', '');
        continue;
      }

      if (analyzing) { continue; }

      const type = detectType();

      if (type === 'orthographe') {
        const sentence = extractSentence();
        if (!sentence || sentence === lastAnalyzedContent) { continue; }

        await new Promise((r) => setTimeout(r, 2500));
        const sentence2 = extractSentence();
        if (!sentence2 || sentence2 !== sentence) { continue; }

        lastAnalyzedContent = sentence;
        analyzing = true;
        setStatus('Analyse en cours...');
        setResult('🔍 Analyse...', '');

        const fault = await analyzeOrthographe(sentence);

        if (fault === null) {
          setResult('✅ Pas de faute', '');
          setStatus('Clic dans 0.8s...');
          await new Promise((r) => setTimeout(r, 800));
          const noFaultBtn = Array.from(document.querySelectorAll('[data-testid="button"]'))
            .find((el) => el.offsetParent && el.textContent.trim().toUpperCase().includes('PAS DE FAUTE'));
          if (noFaultBtn) { noFaultBtn.click(); setStatus('✅ Cliqué !'); }
          else { setStatus('⚠️ Cliquer manuellement'); }
        } else {
          setResult('⚠️ Faute détectée :', fault, '#f38ba8');
          setStatus('Clic dans 0.8s...');
          await new Promise((r) => setTimeout(r, 800));
          const clicked = await autoClickWord(fault);
          setStatus(clicked ? '✅ Cliqué !' : '⚠️ Clic échoué — cliquer manuellement');
        }
        analyzing = false;

      } else if (type === 'vocabulaire') {
        const data = extractVocabulaire();
        if (!data || data.word === lastAnalyzedContent) { continue; }

        await new Promise((r) => setTimeout(r, 2500));
        const data2 = extractVocabulaire();
        if (!data2 || data2.word !== data.word) { continue; }

        lastAnalyzedContent = data.word;
        analyzing = true;
        setStatus('Analyse en cours...');
        setResult('🔍 Synonyme...', '');

        const synonym = await analyzeSynonym(data.word, data.options);

        if (synonym) {
          setResult(`Synonyme de "${data.word}" :`, synonym, '#a6e3a1');
          setStatus('Clic dans 0.8s...');
          await new Promise((r) => setTimeout(r, 800));

          const freshEl = Array.from(document.querySelectorAll('div, button'))
            .filter((el) => {
              if (!el.offsetParent) { return false; }
              const rect = el.getBoundingClientRect();
              const s = window.getComputedStyle(el);
              return rect.width > 100 && rect.height > 30 && s.cursor === 'pointer';
            })
            .find((el) => {
              const t = el.textContent.trim().toLowerCase();
              return t.includes(synonym.toLowerCase()) ||
                     (synonym.toLowerCase().includes(t) && t.length > 5);
            });

          if (freshEl) {
            freshEl.scrollIntoView({ block: 'center', behavior: 'instant' });
            await new Promise((r) => setTimeout(r, 150));
            freshEl.click();
            console.log(`✅ Clic carte "${freshEl.textContent.trim().slice(0,30)}"`);
            setStatus('✅ Cliqué !');
          } else {
            setStatus('⚠️ Cliquer manuellement');
          }
        } else {
          setResult('❓ Synonyme introuvable', '');
          setStatus('Choisir manuellement');
        }
        analyzing = false;

      } else {
        if (lastAnalyzedContent !== 'inconnu') {
          setResult("En attente d'un exercice...", '');
          setStatus('');
          lastAnalyzedContent = 'inconnu';
        }
      }
    }
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  console.log('%c🤖 PV Bot v3.1 chargé', 'color:#cba6f7;font-weight:bold;font-size:14px');

  function init() {
    if (document.getElementById('pv-panel')) { return; }
    createPanel();
    // Vérifier la connexion Ollama avant de démarrer
    setStatus('Vérification Ollama...');
    setResult('🔌 Connexion en cours...', '');
    GM_xmlhttpRequest({
      method: 'POST',
      url: CONFIG.API_URL,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        model: CONFIG.MODEL_NAME,
        messages: [{ role: 'user', content: 'ok' }],
        stream: false,
      }),
      onload() {
        console.log('✅ Ollama connecté');
        setStatus('✅ Ollama connecté');
        setResult(`Modèle : ${CONFIG.MODEL_NAME}`, '');
        setTimeout(() => {
          setResult("En attente d'un exercice...", '');
          setStatus('');
          loop();
        }, 2000);
      },
      onerror() {
        console.error('❌ Ollama injoignable');
        setStatus('❌ Ollama hors ligne');
        setResult('Lance Ollama avec :', 'OLLAMA_ORIGINS="*"', '#f38ba8');
        // Réessayer toutes les 5s
        setTimeout(() => init(), 5000);
      },
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    const wait = setInterval(() => {
      if (document.body && document.body.children.length > 0) {
        clearInterval(wait);
        init();
      }
    }, 300);
    setTimeout(() => { clearInterval(wait); init(); }, 5000);
  }

})();
