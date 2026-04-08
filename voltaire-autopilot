// ==UserScript==
// @name         Projet Voltaire Bot
// @namespace    pv-bot-local
// @version      3.0.0
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
    MODEL_NAME: 'gpt-oss:120b-cloud',
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
      '"Les enfants joue." → joue',
      '"Tout les gens." → Tout',
      '"Bien qu\'il est là." → est',
      '"Nous sommes aller." → aller',
      '"Malgrés les bouchons." → Malgrés',
      '"Il faut que tu sois là." → NULL',
      '"Elle chante bien." → NULL',
      '"La plupart des gens a dit." → a',
      '"Auparavent, nous..." → Auparavent',
      '',
      `"${sentence}" →`,
    ].join('\n');

    const answer = await callLLM(prompt);
    if (!answer) { return null; }

    // Prendre UNIQUEMENT le premier mot, ignorer tout le reste
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
    // Méthode 1 : assembler les mots cliquables (divs r-1loqt21) dans l'ordre DOM
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
      // Dédoublonner (chaque mot apparaît 4x) en prenant le premier de chaque groupe
      const seen = new Set();
      const words = [];
      for (const div of wordDivs) {
        const t = div.textContent.trim();
        if (!seen.has(t)) { seen.add(t); words.push(t); }
      }
      const assembled = words.join(' ').replace(/\s([.,;:!?])/g, '$1');
      if (assembled.split(/\s+/).length >= 4) {
        return assembled;
      }
    }

    // Méthode 2 : data-testid html/body/i
    for (const id of ['html', 'body', 'i']) {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el || !el.offsetParent) { continue; }
      const t = el.textContent.trim();
      const tl = t.toLowerCase();
      if (t.length > 5 && t.length < 300 && !EXCLUDED.some((p) => tl.includes(p))) { return t; }
    }

    // Méthode 3 : chercher un div avec 5-25 mots
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

    // Méthode 1 : mot via data-testid="b"
    const spans = Array.from(document.querySelectorAll('[data-testid="b"]')).filter((el) => el.offsetParent);
    if (spans.length > 0) {
      const assembled = spans.map((el) => el.textContent.trim()).filter(Boolean).join('');
      if (assembled && assembled.length < 60) { word = assembled; }
    }

    // Méthode 2 : mot en gras (nouveau format cartes)
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
    // Détecter le nouveau format vocabulaire (cartes de définitions)
    if (body.includes('synonyme') || body.includes('sens est le plus proche') ||
        body.includes('contexte professionnel')) { return 'vocabulaire'; }
    return 'inconnu';
  }

  // ── Auto-clic boutons CONTINUER/SUIVANT ────────────────────────────────────
  function findBtn(text) {
    return Array.from(document.querySelectorAll('[data-testid="button"]'))
      .find((el) => el.offsetParent && el.textContent.trim().toUpperCase() === text);
  }

  let lastAutoClickTime = 0;
  let lastAutoClickBtn = null;

  function autoClickNavButtons() {
    const now = Date.now();
    if (now - lastAutoClickTime < 2000) { return; }

    // Ne pas auto-cliquer sur la page de sélection de module
    if (window.location.href.includes('selection-module') ||
        window.location.href.includes('selection')) { return; }

    // Détecter "Je ne peux pas écouter" — skipper seulement si pas d'options visibles
    const hasOptions = Array.from(document.querySelectorAll('div, button'))
      .some((el) => {
        if (!el.offsetParent) { return false; }
        const rect = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        const t = el.textContent.trim();
        const u = t.toUpperCase();
        return rect.width > 100 && rect.height > 30 && s.cursor === 'pointer' &&
               t.length > 5 && t.length < 120 &&
               !u.includes('ÉCOUTER') && !u.includes('ECOUTER') &&
               !u.includes('NE PEUX PAS') && !u.includes('CONTINUER') &&
               !u.includes('COMMENCER') && !u.includes('SUIVANT') &&
               !u.includes('ARRÊTER') && !u.includes('DÉMARRER');
      });

    const audioSkipBtn = Array.from(document.querySelectorAll('[data-testid="button"], button, div'))
      .find((el) => {
        if (!el.offsetParent) { return false; }
        const t = el.textContent.trim().toUpperCase();
        return t.includes('NE PEUX PAS') || t.includes('ÉCOUTER') || t.includes('ECOUTER');
      });

    if (audioSkipBtn && !hasOptions) {
      console.log('🔇 Bouton audio détecté → skip');
      lastAutoClickBtn = audioSkipBtn;
      lastAutoClickTime = now;
      setTimeout(() => { audioSkipBtn.click(); lastAutoClickBtn = null; }, 300);
      return;
    }

    const suivant = findBtn('SUIVANT');
    const continuer = findBtn('CONTINUER');
    const btn = suivant || continuer;

    if (btn && btn !== lastAutoClickBtn) {
      console.log(`🤖 Auto-clic: ${btn.textContent.trim()}`);
      lastAutoClickBtn = btn;
      lastAutoClickTime = now;
      setTimeout(() => {
        btn.click();
        lastAutoClickBtn = null;
      }, 300 + Math.random() * 400);
    }
  }

  // ── Panneau UI ──────────────────────────────────────────────────────────────
  let panelEl, resultEl, statusEl, wordEl;
  let analyzing = false;
  let lastAnalyzedContent = '';

  function createPanel() {
    const style = document.createElement('style');
    style.textContent = `
      #pv-panel{position:fixed;bottom:20px;right:20px;z-index:999999;background:#1e1e2e;color:#cdd6f4;border-radius:12px;padding:14px;font-family:sans-serif;font-size:13px;box-shadow:0 4px 24px rgba(0,0,0,.6);min-width:220px;max-width:300px;border:1px solid #45475a}
      #pv-header{font-weight:bold;font-size:15px;text-align:center;color:#cba6f7;margin-bottom:10px}
      #pv-status{text-align:center;font-size:11px;color:#a6adc8;margin-bottom:8px;min-height:14px}
      #pv-result{background:#313244;border-radius:8px;padding:10px;margin-bottom:10px;min-height:40px;text-align:center;font-size:14px;line-height:1.5}
      #pv-word{font-size:18px;font-weight:bold;color:#f38ba8;margin-top:4px}
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
      <button id="pv-toggle">⏹ Arrêter</button>
    `;
    document.body.appendChild(panelEl);

    statusEl = document.getElementById('pv-status');
    resultEl = document.getElementById('pv-result').firstElementChild;
    wordEl = document.getElementById('pv-word');

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

    // Chercher uniquement les éléments dans le viewport visible
    const allDivs = Array.from(document.querySelectorAll('div[class*="r-1loqt21"]'))
      .filter((el) => {
        if (!el.offsetParent) { return false; }
        const r = el.getBoundingClientRect();
        // Doit être dans le viewport
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
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    console.log(`🖱️ Auto-clic sur "${el.textContent.trim()}" à (${x},${y})`);

    // .click() direct — le plus fiable pour les éléments dans le viewport
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

      // Auto-clic SUIVANT/CONTINUER
      autoClickNavButtons();

      // Changement de page
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

        // Attendre que la phrase soit stable (2 lectures identiques à 800ms d'intervalle)
        await new Promise((r) => setTimeout(r, 800));
        const sentence2 = extractSentence();
        if (!sentence2 || sentence2 !== sentence) { continue; }

        lastAnalyzedContent = sentence;
        analyzing = true;
        setStatus('Analyse en cours...');
        setResult('🔍 Analyse...', '');

        const fault = await analyzeOrthographe(sentence);

        if (fault === null) {
          setResult('✅ Pas de faute', '');
          setStatus('Clic dans 5s...');
          await new Promise((r) => setTimeout(r, 5000));
          // Auto-clic "Il n'y a pas de faute"
          const noFaultBtn = Array.from(document.querySelectorAll('[data-testid="button"]'))
            .find((el) => el.offsetParent && el.textContent.trim().toUpperCase().includes('PAS DE FAUTE'));
          if (noFaultBtn) {
            noFaultBtn.click();
            setStatus('✅ Cliqué !');
          } else {
            setStatus('⚠️ Cliquer manuellement');
          }
        } else {
          setResult('⚠️ Faute détectée :', fault, '#f38ba8');
          setStatus('Clic dans 5s...');
          await new Promise((r) => setTimeout(r, 5000));
          const clicked = await autoClickWord(fault);
          if (clicked) {
            setStatus('✅ Cliqué !');
          } else {
            setStatus('⚠️ Clic échoué — cliquer manuellement');
          }
        }
        analyzing = false;

      } else if (type === 'vocabulaire') {
        const data = extractVocabulaire();
        if (!data || data.word === lastAnalyzedContent) { continue; }

        // Attendre stabilisation
        await new Promise((r) => setTimeout(r, 800));
        const data2 = extractVocabulaire();
        if (!data2 || data2.word !== data.word) { continue; }

        lastAnalyzedContent = data.word;
        analyzing = true;
        setStatus('Analyse en cours...');
        setResult('🔍 Synonyme...', '');

        const synonym = await analyzeSynonym(data.word, data.options);

        if (synonym) {
          setResult(`Synonyme de "${data.word}" :`, synonym, '#a6e3a1');
          setStatus('Clic dans 5s...');
          await new Promise((r) => setTimeout(r, 5000));
          // Auto-clic sur l'option correspondante
          const optionEl = data.optionElements?.find((el) => {
            return el.textContent.trim().toLowerCase().includes(synonym.toLowerCase()) ||
                   synonym.toLowerCase().includes(el.textContent.trim().toLowerCase());
          });
          setStatus('Clic dans 5s...');
          await new Promise((r) => setTimeout(r, 5000));

          // Re-chercher l'élément APRÈS le délai (le DOM React peut avoir été recréé)
          const freshOptions = Array.from(document.querySelectorAll('div, button'))
            .filter((el) => {
              if (!el.offsetParent) { return false; }
              const rect = el.getBoundingClientRect();
              const s = window.getComputedStyle(el);
              return rect.width > 100 && rect.height > 30 && s.cursor === 'pointer';
            });

          const freshEl = freshOptions.find((el) => {
            const t = el.textContent.trim().toLowerCase();
            return t.includes(synonym.toLowerCase()) ||
                   synonym.toLowerCase().includes(t) && t.length > 5;
          });

          if (freshEl) {
            const rect = freshEl.getBoundingClientRect();
            const x = Math.round(rect.left + rect.width / 2);
            const y = Math.round(rect.top + rect.height / 2);
            console.log(`🖱️ Clic carte "${freshEl.textContent.trim().slice(0,30)}" à (${x},${y})`);

            // Clic réel sur l'élément (React 19 nécessite un vrai événement DOM)
            freshEl.scrollIntoView({ block: 'center', behavior: 'instant' });
            await new Promise((r) => setTimeout(r, 150));
            let clicked = false;

            // Essai 1 : .click() natif
            try { freshEl.click(); clicked = true; console.log('✅ via .click()'); } catch (e) { /* ignore */ }

            // Essai 2 : MouseEvents sur l'élément directement
            if (!clicked) {
              const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y };
              freshEl.dispatchEvent(new MouseEvent('mousedown', opts));
              await new Promise((r) => setTimeout(r, 50));
              freshEl.dispatchEvent(new MouseEvent('mouseup', opts));
              freshEl.dispatchEvent(new MouseEvent('click', opts));
              clicked = true;
              console.log('✅ via MouseEvent sur élément');
            }

            // Essai 2 : MouseEvent sur document avec coords
            if (!clicked) {
              const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y };
              document.dispatchEvent(new MouseEvent('mousedown', opts));
              await new Promise((r) => setTimeout(r, 80));
              document.dispatchEvent(new MouseEvent('mouseup', opts));
              document.dispatchEvent(new MouseEvent('click', opts));
              console.log('✅ via MouseEvent document');
            }

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
          setResult('En attente d\'un exercice...', '');
          setStatus('');
          lastAnalyzedContent = 'inconnu';
        }
      }
    }
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  console.log('%c🤖 PV Bot v3.0 chargé', 'color:#cba6f7;font-weight:bold;font-size:14px');

  function init() {
    if (document.getElementById('pv-panel')) { return; }
    createPanel();
    loop();
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
