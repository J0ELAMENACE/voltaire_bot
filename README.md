# Projet Voltaire Bot

Bot semi-automatique pour les exercices d'orthographe et de vocabulaire sur [Projet Voltaire](https://www.projet-voltaire.fr), utilisant un LLM local via Ollama.

## Fonctionnement

Le bot analyse chaque exercice et affiche sa réponse dans un panneau flottant. Il clique automatiquement sur la bonne réponse après 5 secondes, te laissant le temps de vérifier.

```
Exercice détecté → Analyse LLM → Panneau (5s) → Auto-clic → SUIVANT auto
```

### Exercices supportés

| Type | Comportement |
|------|-------------|
| Orthographe | Détecte le mot fautif et clique dessus, ou clique "Il n'y a pas de faute" |
| Vocabulaire (cartes) | Trouve le synonyme et clique sur la bonne carte |
| Audio | Skip automatiquement si pas d'options visibles |

## Prérequis

- [Tampermonkey](https://www.tampermonkey.net/) (extension Chrome/Brave)
- [Ollama](https://ollama.com/) installé et lancé en local
- Un modèle LLM compatible Ollama

## Installation

### 1. Ollama

```powershell
# Lancer avec les origines autorisées (obligatoire)
$env:OLLAMA_ORIGINS="*"; ollama serve

# Pour rendre permanent (une seule fois)
[System.Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "*", "User")
# Puis redémarrer Ollama depuis le systray
```

### 2. Modèle LLM

Le script utilise `gpt-oss:120b-cloud` par défaut. Tu peux utiliser n'importe quel modèle Ollama :

```bash
ollama pull mistral:7b        # léger, bon français
ollama pull mistral-nemo:12b  # meilleur, nécessite ~9GB VRAM
```

Changer le modèle : modifier `MODEL_NAME` dans le bloc `CONFIG` du script.

### 3. Tampermonkey

1. Installe [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. Tableau de bord → **+** → colle le contenu de `projet-voltaire-bot.user.js`
3. **Ctrl+S** pour sauvegarder

> **Brave uniquement** : `brave://extensions/` → Tampermonkey → Détails → activer "Autoriser sur tous les sites" + mode sécurité "Détendu"

## Configuration

```javascript
const CONFIG = {
  API_URL: 'http://localhost:11434/api/chat',  // URL Ollama
  MODEL_NAME: 'gpt-oss:120b-cloud',            // Modèle LLM
  DELAY: 1500,                                  // Délai entre actions (ms)
};
```

## Utilisation

1. Lance Ollama avec `OLLAMA_ORIGINS="*"`
2. Va sur Projet Voltaire et ouvre un exercice
3. Le panneau **PV Bot** apparaît en bas à droite
4. Le bot tourne automatiquement

### Panneau de contrôle

| Statut | Signification |
|--------|--------------|
| 🔍 Analyse... | LLM en cours |
| ⚠️ Faute détectée : [mot] | Faute trouvée, auto-clic dans 5s |
| ✅ Pas de faute | Aucune faute, clic bouton dans 5s |
| Synonyme de "X" : [réponse] | Synonyme trouvé, auto-clic dans 5s |
| ✅ Cliqué ! | Action effectuée |
| ⚠️ Cliquer manuellement | Auto-clic échoué, cliquer soi-même |

## Stack technique

- **Userscript** — Tampermonkey (Chrome, Brave, Edge)
- **LLM** — Ollama local via `/api/chat`
- **Site cible** — React 19 + React Native for Web
- **CORS bypass** — `GM_xmlhttpRequest`

## Licence

MIT
