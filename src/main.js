import './style.css'

document.addEventListener('DOMContentLoaded', () => {
  // ── Mount SVG symbols from <template> into DOM ──
  const tpl = document.getElementById('svg-icons')
  if (tpl) document.body.appendChild(tpl.content.cloneNode(true))

  const statusEl      = document.querySelector('#status')
  const chatWindow    = document.querySelector('#chatWindow')
  const chatForm      = document.querySelector('#chatForm')
  const promptInput   = document.querySelector('#promptInput')
  const heroCard      = document.querySelector('#heroCard')
  const inputCard     = document.querySelector('.input-card')
  const sendButton    = document.querySelector('#sendButton')
  const imageButton   = document.querySelector('#imageButton')
  const imageInput    = document.querySelector('#imageInput')
  const imagePreviewWrap = document.querySelector('#imagePreviewWrap')
  const imagePreview  = document.querySelector('#imagePreview')
  const removeImage   = document.querySelector('#removeImage')
  const micButton     = document.querySelector('#micButton')
  const micIcon       = document.querySelector('#micIcon')
  const recordingIndicator = document.querySelector('#recordingIndicator')
  const recTimer      = document.querySelector('#recTimer')

  let browserSession  = null
  let hasMessages     = false
  let isBusy          = false
  let pendingImageBlob = null  // raw Blob for Chrome Prompt API
  let mediaRecorder    = null  // MediaRecorder instance
  let audioChunks      = []    // recorded audio chunks
  let isRecording      = false // mic recording state
  let recTimerInterval = null  // recording timer interval
  let recSeconds       = 0     // elapsed recording seconds
  let pendingAudioBlob = null  // recorded audio blob to send

  // ── Mount download bar into hero ──
  const dlWrap = document.createElement('div')
  dlWrap.className = 'dl-wrap hidden'
  dlWrap.innerHTML = `
    <p class="dl-label" id="dlLabel">Downloading model…</p>
    <div class="dl-track"><div class="dl-fill" id="dlFill"></div></div>
  `
  heroCard.appendChild(dlWrap)
  const dlLabel = document.querySelector('#dlLabel')
  const dlFill  = document.querySelector('#dlFill')

  // ── Lock / unlock entire input area ──
  function setInputsEnabled(enabled) {
    promptInput.disabled   = !enabled
    micButton.disabled     = !enabled
    imageButton.disabled   = !enabled
    sendButton.disabled    = !enabled
    promptInput.placeholder = enabled ? 'Write a message…' : 'Waiting for model to load…'
    if (enabled) {
      inputCard.classList.remove('input-locked')
    } else {
      inputCard.classList.add('input-locked')
    }
  }

  // Lock immediately on page load
  setInputsEnabled(false)

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

  // ── Image attach ──
  imageButton.addEventListener('click', () => imageInput.click())

  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0]
    if (!file) return
    // Store raw Blob — Chrome Prompt API requires Blob, not base64
    pendingImageBlob = file
    // Preview via object URL
    imagePreview.src = URL.createObjectURL(file)
    imagePreviewWrap.classList.remove('hidden')
    imageInput.value = ''
  })

  removeImage.addEventListener('click', () => {
    pendingImageBlob = null
    if (imagePreview.src) URL.revokeObjectURL(imagePreview.src)
    imagePreview.src = ''
    imagePreviewWrap.classList.add('hidden')
  })

  // ── Microphone recording ──
  micButton.addEventListener('click', async () => {
    if (!isRecording) {
      await startRecording()
    } else {
      stopRecording()
    }
  })

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunks = []
      mediaRecorder = new MediaRecorder(stream)

      mediaRecorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) audioChunks.push(e.data)
      })

      mediaRecorder.addEventListener('stop', () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach(t => t.stop())

        pendingAudioBlob = new Blob(audioChunks, { type: 'audio/webm' })
        audioChunks = []

        // Auto-submit if we have audio
        if (pendingAudioBlob.size > 0) {
          chatForm.dispatchEvent(new Event('submit'))
        }
      })

      mediaRecorder.start()
      isRecording = true
      setMicState('recording')
      startRecTimer()

    } catch (err) {
      console.error('Mic error:', err)
      if (err.name === 'NotAllowedError') {
        appendMessage('bot', 'Microphone access denied. Please allow microphone permissions in your browser.')
      } else {
        appendMessage('bot', `Microphone error: ${err.message}`)
      }
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    isRecording = false
    setMicState('idle')
    stopRecTimer()
  }

  function setMicState(state) {
    const use = micIcon.querySelector('use')
    if (state === 'recording') {
      use.setAttribute('href', '#icon-mic-active')
      use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#icon-mic-active')
      micButton.classList.add('mic-recording')
      micButton.setAttribute('data-tooltip', 'Stop recording')
      recordingIndicator.classList.remove('hidden')
    } else {
      use.setAttribute('href', '#icon-mic')
      use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#icon-mic')
      micButton.classList.remove('mic-recording')
      micButton.setAttribute('data-tooltip', 'Hold to record')
      recordingIndicator.classList.add('hidden')
    }
  }

  function startRecTimer() {
    recSeconds = 0
    recTimer.textContent = '0:00'
    recTimerInterval = setInterval(() => {
      recSeconds++
      const m = Math.floor(recSeconds / 60)
      const s = String(recSeconds % 60).padStart(2, '0')
      recTimer.textContent = `${m}:${s}`
      // Auto-stop at 60 seconds
      if (recSeconds >= 60) stopRecording()
    }, 1000)
  }

  function stopRecTimer() {
    clearInterval(recTimerInterval)
    recTimerInterval = null
    recSeconds = 0
    recTimer.textContent = '0:00'
  }

  // ── Status pill ──
  function setStatus(msg, busy = false) {
    if (!statusEl) return
    statusEl.textContent = msg
    statusEl.classList.toggle('status-busy', busy)
  }

  // ── Download bar ──
  function setDownload(pct) {
    if (pct === null) {
      dlWrap.classList.add('hidden')
    } else {
      dlWrap.classList.remove('hidden')
      dlLabel.textContent = `Downloading model… ${pct.toFixed(1)}%`
      dlFill.style.width  = `${pct}%`
    }
  }

  // ── Send / Pause button state ──
  function setSendState(state) {
    const use = sendButton.querySelector('use')
    if (state === 'pause') {
      use.setAttribute('href', '#icon-pause')
      use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#icon-pause')
      sendButton.setAttribute('data-tooltip', 'Stop')
      sendButton.classList.add('send-pause')
    } else {
      use.setAttribute('href', '#icon-send')
      use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#icon-send')
      sendButton.setAttribute('data-tooltip', 'Send')
      sendButton.classList.remove('send-pause')
    }
  }

  // ── Hero hide on first message ──
  function hideHero() {
    if (!hasMessages && heroCard) {
      heroCard.style.display = 'none'
      hasMessages = true
    }
  }

  // ── Scroll chat window to bottom ──
  function scrollBottom() {
    chatWindow.scrollTop = chatWindow.scrollHeight
  }

  // ── Icon builder — clones from mounted symbols ──
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

  // ── Action buttons ──
  function createActionRow(getBubbleText) {
    const row = document.createElement('div')
    row.className = 'message-actions'

    const actions = [
      { label: 'Copy',       iconId: 'icon-copy',       tooltip: 'Copy'       },
      { label: 'Regenerate', iconId: 'icon-regenerate',  tooltip: 'Regenerate' }
    ]

    actions.forEach(({ label, iconId, tooltip }) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'action-button'
      btn.appendChild(makeIcon(iconId))
      btn.setAttribute('aria-label', label)
      btn.setAttribute('data-tooltip', tooltip)

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
            const text = prev.querySelector('.bubble-text')?.textContent || ''
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

  // ── Timestamp ──
  function getTimestamp() {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }

  // ── Append message ──
  function appendMessage(role, text, imgSrc = null) {
    hideHero()
    const msg = document.createElement('div')
    msg.className = `message ${role}`

    const bubble = document.createElement('div')
    bubble.className = 'bubble'

    // Attached image thumbnail (user side)
    if (imgSrc) {
      const thumb = document.createElement('img')
      thumb.src = imgSrc
      thumb.className = 'msg-image'
      thumb.alt = 'Attached image'
      bubble.appendChild(thumb)
    }

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

  // ── Typewriter effect — stops if isBusy is cleared (pause) ──
  function typewriterEffect(element, text) {
    return new Promise((resolve) => {
      const baseDelay = text.length > 400 ? 5 : text.length > 150 ? 10 : 16
      const chunkSize = baseDelay <= 5 ? 4 : 1
      let i = 0
      function tick() {
        if (!isBusy || i >= text.length) { resolve(); return }
        element.textContent = text.slice(0, i + chunkSize)
        i += chunkSize
        if (i % 30 === 0) scrollBottom()
        setTimeout(tick, baseDelay)
      }
      tick()
    })
  }

  // ── Destroy session on unload ──
  window.addEventListener('beforeunload', () => {
    try { browserSession?.destroy?.() } catch (_) {}
  })

  // ── Init model ──
  async function initModel(retryCount = 0) {
    if (!window.LanguageModel) {
      setStatus('LanguageModel API not found')
      appendMessage('bot',
        'Your browser does not support the built-in LanguageModel API.\n\n' +
        'Use Chrome Canary and enable:\nchrome://flags/#prompt-api-for-gemini-nano')
      return
    }

    try { browserSession?.destroy?.() } catch (_) {}
    browserSession = null

    try {
      setStatus('Checking availability…', true)
      const availability = await LanguageModel.availability()
      console.log('availability =', availability)
      setStatus('Loading model…', true)

      browserSession = await LanguageModel.create({
        expectedInputs: [
          { type: 'text' },
          { type: 'image' },
          { type: 'audio' },
        ],
        expectedOutputs: [{ type: 'text' }],
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            if (e.total) {
              const pct = (e.loaded / e.total) * 100
              setDownload(pct)
              setStatus(`Downloading model… ${pct.toFixed(1)}%`, true)
            }
          })
        }
      })

      window.browserSession = browserSession
      setDownload(null)
      setStatus('Model ready ✓', false)
      setInputsEnabled(true)
      console.log('session created')

    } catch (e) {
      console.error('Init error:', e)
      setDownload(null)
      const msg = e?.message || String(e)

      if (msg.includes('crashed') && retryCount < 3) {
        const wait = (retryCount + 1) * 4000
        setStatus(`Model crashed — retrying in ${wait / 1000}s…`, true)
        setTimeout(() => initModel(retryCount + 1), wait)
        return
      }

      setInputsEnabled(false)
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

  // ── Submit ──
  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    // If busy, clicking send = pause/abort (best effort)
    if (isBusy) {
      isBusy = false
      setSendState('send')
      setStatus('Model ready ✓', false)
      promptInput.disabled = false
      return
    }

    const prompt = promptInput.value.trim()
    if (!prompt && !pendingImageBlob && !pendingAudioBlob) return

    // Capture image + audio before clearing
    const imgBlob   = pendingImageBlob
    const imgSrc    = pendingImageBlob ? imagePreview.src : null
    const audioBlob = pendingAudioBlob

    // Clear attachments
    if (pendingImageBlob) {
      pendingImageBlob = null
      imagePreview.src = ''
      imagePreviewWrap.classList.add('hidden')
    }
    if (pendingAudioBlob) {
      pendingAudioBlob = null
    }

    const displayText = prompt || (audioBlob ? '🎤 Voice message' : '')
    appendMessage('user', displayText, imgSrc)
    promptInput.value = ''
    promptInput.style.height = 'auto'
    promptInput.focus()

    if (!browserSession) {
      appendMessage('bot', 'Model is not ready yet. Please wait for initialization to finish.')
      return
    }

    isBusy = true
    setSendState('pause')
    setStatus('Generating…', true)
    promptInput.disabled = true

    try {
      // Show only typing dots, no "Thinking" text
      const { msg: thinkingMsg, bubble: thinkingBubble, textNode: thinkingText } = appendMessage('bot', '')
      thinkingText.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>'
      scrollBottom()

      // Build prompt using Chrome Prompt API multimodal format
      let result
      if (imgBlob && audioBlob) {
        // Both image and audio
        try {
          result = await browserSession.prompt([{
            role: 'user',
            content: [
              { type: 'text',  value: prompt || 'Describe what you see and hear.' },
              { type: 'image', value: imgBlob },
              { type: 'audio', value: audioBlob },
            ]
          }])
        } catch {
          result = await browserSession.prompt(prompt || 'Describe what you see and hear.')
        }
      } else if (imgBlob) {
        // Image only
        try {
          result = await browserSession.prompt([{
            role: 'user',
            content: [
              { type: 'text',  value: prompt || 'Describe this image.' },
              { type: 'image', value: imgBlob },
            ]
          }])
        } catch {
          result = await browserSession.prompt(prompt || 'Describe this image.')
        }
      } else if (audioBlob) {
        // Audio only — convert AudioBuffer via Chrome Prompt API
        try {
          result = await browserSession.prompt([{
            role: 'user',
            content: [
              { type: 'text',  value: prompt || 'Transcribe or respond to this audio.' },
              { type: 'audio', value: audioBlob },
            ]
          }])
        } catch (audioErr) {
          console.warn('Audio prompt failed, falling back to text:', audioErr)
          result = await browserSession.prompt(prompt || 'I sent you an audio message but audio is not supported.')
        }
      } else {
        result = await browserSession.prompt(prompt)
      }

      const fullText = typeof result === 'string' ? result : result?.output ?? JSON.stringify(result)

      // Clear dots, typewrite response
      thinkingText.textContent = ''
      await typewriterEffect(thinkingText, fullText)

      // Update timestamp to completion time
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
      setSendState('send')
      setInputsEnabled(true)
      isBusy = false
    }
  })

  initModel()
})
