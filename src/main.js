import './style.css'

document.addEventListener('DOMContentLoaded', () => {
  const statusEl      = document.querySelector('#status')
  const chatWindow    = document.querySelector('#chatWindow')
  const chatForm      = document.querySelector('#chatForm')
  const promptInput   = document.querySelector('#promptInput')
  const heroCard      = document.querySelector('#heroCard')
  const plusButton    = document.querySelector('#plusButton')
  const loadingIndicator = document.querySelector('#loadingIndicator')

  let browserSession = null
  let hasMessages    = false
  let isBusy         = false

  // ── Download progress bar elements (injected into hero) ──
  const dlWrap = document.createElement('div')
  dlWrap.className = 'dl-wrap hidden'
  dlWrap.innerHTML = `
    <p class="dl-label" id="dlLabel">Downloading model…</p>
    <div class="dl-track"><div class="dl-fill" id="dlFill"></div></div>
  `
  heroCard.appendChild(dlWrap)
  const dlLabel = document.querySelector('#dlLabel')
  const dlFill  = document.querySelector('#dlFill')

  // ── Auto-resize textarea ──
  promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto'
    promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px'
  })

  // ── Enter to send, Shift+Enter for newline ──
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      chatForm.dispatchEvent(new Event('submit'))
    }
  })

  plusButton.addEventListener('click', () => promptInput.focus())

  // ── Status pill ──
  function setStatus(msg, busy = false) {
    if (!statusEl) return
    statusEl.textContent = msg
    statusEl.classList.toggle('status-busy', busy)
  }

  // ── Download progress bar ──
  function setDownload(pct) {
    // pct = null hides the bar, 0–100 shows it
    if (pct === null) {
      dlWrap.classList.add('hidden')
    } else {
      dlWrap.classList.remove('hidden')
      dlLabel.textContent = `Downloading model… ${pct.toFixed(1)}%`
      dlFill.style.width  = `${pct}%`
    }
  }

  function setLoading(visible) {
    loadingIndicator?.classList.toggle('hidden', !visible)
  }

  // ── Hero hide on first message ──
  function hideHero() {
    if (!hasMessages && heroCard) {
      heroCard.style.display = 'none'
      hasMessages = true
    }
  }

  // ── Scroll — page-level, not inner element ──
  function scrollBottom() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  // ── Icon builder — references <symbol> elements defined in index.html ──
  function makeIcon(id) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '16')
    svg.setAttribute('height', '16')
    svg.setAttribute('aria-hidden', 'true')
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${id}`)
    svg.appendChild(use)
    return svg
  }

  // ── Action buttons (copy + regenerate) ──
  function createActionRow(getBubbleText) {
    const row = document.createElement('div')
    row.className = 'message-actions'

    const actions = [
      { label: 'Copy',       iconId: 'icon-copy'       },
      { label: 'Regenerate', iconId: 'icon-regenerate'  }
    ]

    actions.forEach(({ label, iconId }) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'action-button'
      btn.appendChild(makeIcon(iconId))
      btn.setAttribute('aria-label', label)
      btn.title = label

      if (label === 'Copy') {
        btn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(getBubbleText())
            btn.style.opacity = '0.4'
            setTimeout(() => (btn.style.opacity = ''), 900)
          } catch (e) { console.error('copy failed', e) }
        })
      }

      if (label === 'Regenerate') {
        btn.addEventListener('click', () => {
          const msgEl = btn.closest('.message')
          const prev  = msgEl?.previousElementSibling
          if (prev?.classList.contains('user')) {
            const text = prev.querySelector('.bubble-text')?.textContent || prev.querySelector('.bubble')?.textContent || ''
            if (text) {
              promptInput.value = text
              chatForm.dispatchEvent(new Event('submit'))
            }
          }
        })
      }

      row.appendChild(btn)
    })
    return row
  }

  // ── Timestamp HH:MM:SS ──
  function getTimestamp() {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }

  // ── Append a message bubble ──
  function appendMessage(role, text) {
    hideHero()
    const msg    = document.createElement('div')
    msg.className = `message ${role}`

    const bubble = document.createElement('div')
    bubble.className = 'bubble'

    const textNode = document.createElement('div')
    textNode.className = 'bubble-text'
    textNode.textContent = text
    bubble.appendChild(textNode)

    const ts = document.createElement('span')
    ts.className = 'msg-time'
    ts.textContent = getTimestamp()
    bubble.appendChild(ts)

    msg.appendChild(bubble)

    chatWindow.appendChild(msg)
    scrollBottom()
    return { msg, bubble, textNode }
  }

  // ── Destroy session cleanly on tab close / refresh ──
  window.addEventListener('beforeunload', () => {
    try { browserSession?.destroy?.() } catch (_) {}
  })

  // ── Init: mirrors the working snippet exactly ──
  async function initModel(retryCount = 0) {
    if (!window.LanguageModel) {
      setStatus('LanguageModel API not found')
      appendMessage('bot',
        'Your browser does not support the built-in LanguageModel API.\n\n' +
        'Use Chrome Canary and enable:\nchrome://flags/#prompt-api-for-gemini-nano')
      return
    }

    // Destroy any existing session before creating a new one
    try { browserSession?.destroy?.() } catch (_) {}
    browserSession = null

    try {
      setStatus('Checking availability…', true)
      const availability = await LanguageModel.availability()
      console.log('availability =', availability)

      setStatus('Loading model…', true)

      browserSession = await LanguageModel.create({
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            if (e.total) {
              const pct = (e.loaded / e.total) * 100
              setDownload(pct)
              setStatus(`Downloading model… ${pct.toFixed(1)}%`, true)
              console.log(`Downloading: ${pct.toFixed(1)}%`)
            }
          })
        }
      })

      window.browserSession = browserSession
      setDownload(null)
      setStatus('Model ready ✓', false)
      console.log('session created')

    } catch (e) {
      console.error('Init error:', e)
      setDownload(null)

      const msg = e?.message || String(e)

      // "crashed too many times" → wait and auto-retry up to 3 times
      if (msg.includes('crashed') && retryCount < 3) {
        const wait = (retryCount + 1) * 4000
        setStatus(`Model crashed — retrying in ${wait / 1000}s…`, true)
        console.warn(`Retrying initModel in ${wait}ms (attempt ${retryCount + 1})`)
        setTimeout(() => initModel(retryCount + 1), wait)
        return
      }

      setStatus('Initialization failed')
      appendMessage('bot',
        `Initialization error: ${msg}\n\n` +
        `Try these steps:\n` +
        `1. Close ALL other Chrome tabs using the LanguageModel API\n` +
        `2. Go to chrome://settings/system and toggle "Use hardware acceleration"\n` +
        `3. Restart Chrome completely (not just refresh)\n` +
        `4. If still failing, go to chrome://components → find "Optimization Guide" → Update`
      )
    }
  }


  // ── Typewriter effect ──
  // Reveals text char-by-char. Speeds up for longer responses so it
  // never feels sluggish: ~18ms/char for short, ~6ms/char for long.
  function typewriterEffect(element, text) {
    return new Promise((resolve) => {
      const baseDelay = text.length > 400 ? 6 : text.length > 150 ? 10 : 18
      let i = 0
      function tick() {
        if (i >= text.length) { resolve(); return }
        // Write in small chunks so the loop stays smooth
        const chunkSize = baseDelay <= 6 ? 3 : 1
        element.textContent = text.slice(0, i + chunkSize)
        i += chunkSize
        scrollBottom()
        setTimeout(tick, baseDelay)
      }
      tick()
    })
  }

  // ── Submit ──
  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const prompt = promptInput.value.trim()
    if (!prompt || isBusy) return

    appendMessage('user', prompt)
    promptInput.value = ''
    promptInput.style.height = 'auto'
    promptInput.focus()

    if (!browserSession) {
      appendMessage('bot', 'Model is not ready yet. Please wait for initialization to finish.')
      return
    }

    isBusy = true
    setStatus('Generating…', true)
    setLoading(true)
    promptInput.disabled = true

    try {
      // Show typing dots while model is thinking
      const { msg: thinkingMsg, bubble: thinkingBubble } = appendMessage('bot', '')
      thinkingBubble.querySelector('.bubble-text').innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>'
      scrollBottom()

      // Fetch full response first (streaming API is unreliable across Chrome versions)
      const result = await browserSession.prompt(prompt)
      const fullText = typeof result === 'string' ? result : result?.output ?? JSON.stringify(result)

      // Typewriter effect — reveal characters progressively
      const thinkingText = thinkingBubble.querySelector('.bubble-text')
      thinkingText.textContent = ''
      await typewriterEffect(thinkingText, fullText)

      // Update timestamp to when response finished
      const tsEl = thinkingMsg.querySelector('.msg-time')
      if (tsEl) tsEl.textContent = getTimestamp()

      thinkingMsg.appendChild(createActionRow(() => thinkingText.textContent))
      scrollBottom()

      setStatus('Model ready ✓', false)

    } catch (e) {
      console.error('Prompt error:', e)
      appendMessage('bot', `Error: ${e?.message || e}`)
      setStatus('Error occurred', false)
    } finally {
      setLoading(false)
      promptInput.disabled = false
      isBusy = false
    }
  })

  initModel()
})
