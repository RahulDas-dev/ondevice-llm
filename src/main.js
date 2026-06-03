import './style.css'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="chat-app">
    <section class="hero-card" id="heroCard">
      <span class="hero-icon">✶</span>
      <p class="eyebrow">Evening, Rahul</p>
      <h1>How can I help you today?</h1>
      <div class="status-row">
        <span id="status" class="status">Initializing…</span>
      </div>
    </section>

    <section id="chatWindow" class="chat-window" aria-live="polite"></section>

    <div id="loadingIndicator" class="loading-indicator hidden" aria-hidden="true">
      <span class="loader"></span>
      <span>Thinking…</span>
    </div>

    <section class="input-card">
      <form id="chatForm" class="input-row">
        <textarea id="promptInput" class="prompt-input" rows="1" placeholder="Write a message…" required></textarea>
        <div class="input-actions">
          <button type="button" class="plus-button" id="plusButton" aria-label="Add attachment">+</button>
          <span class="model-badge">Sonnet 4.6  Low</span>
          <button type="button" class="icon-button" aria-label="Voice input">🎤</button>
          <button type="button" class="icon-button" aria-label="Signal">📶</button>
        </div>
      </form>
      <div class="chips">
        <button type="button" class="chip">Code</button>
        <button type="button" class="chip">Write</button>
        <button type="button" class="chip">Learn</button>
        <button type="button" class="chip">Life stuff</button>
        <button type="button" class="chip">From Drive</button>
      </div>
      <p class="disclaimer">Claude is AI and can make mistakes. Please double-check responses.</p>
    </section>
  </main>
`

const statusEl = document.querySelector('#status')
const chatWindow = document.querySelector('#chatWindow')
const chatForm = document.querySelector('#chatForm')
const promptInput = document.querySelector('#promptInput')
const heroCard = document.querySelector('#heroCard')
const chips = document.querySelectorAll('.chip')
const plusButton = document.querySelector('#plusButton')
const loadingIndicator = document.querySelector('#loadingIndicator')
let browserSession = null
let hasMessages = false

// Auto-resize textarea
promptInput.addEventListener('input', () => {
  promptInput.style.height = 'auto'
  promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px'
})

// Submit on Enter (Shift+Enter = newline)
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    chatForm.dispatchEvent(new Event('submit'))
  }
})

chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    promptInput.value = chip.textContent.replace(/^[^\w\s]+\s*/, '').trim()
    promptInput.focus()
  })
})

plusButton.addEventListener('click', () => promptInput.focus())

function setStatus(message, busy = false) {
  statusEl.textContent = message
  statusEl.classList.toggle('status-busy', busy)
}

function setLoading(visible) {
  loadingIndicator.classList.toggle('hidden', !visible)
}

function createActionRow() {
  const row = document.createElement('div')
  row.className = 'message-actions'
  const icons = [
    { icon: '⎕', label: 'Copy' },
    { icon: '▷', label: 'Play' },
    { icon: '↑', label: 'Thumbs up' },
    { icon: '↓', label: 'Thumbs down' },
    { icon: '↻', label: 'Regenerate' },
  ]
  icons.forEach(({ icon, label }) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'action-button'
    button.textContent = icon
    button.setAttribute('aria-label', label)
    row.appendChild(button)
  })
  return row
}

function hideHero() {
  if (!hasMessages) {
    heroCard.style.display = 'none'
    hasMessages = true
  }
}

function appendMessage(role, text) {
  hideHero()

  const message = document.createElement('div')
  message.className = `message ${role}`

  if (role === 'bot') {
    const star = document.createElement('span')
    star.className = 'bot-icon'
    star.textContent = '✶'
    message.appendChild(star)
  }

  const bubble = document.createElement('div')
  bubble.className = 'bubble'
  bubble.textContent = text
  message.appendChild(bubble)

  if (role === 'bot') {
    message.appendChild(createActionRow())
  }

  chatWindow.appendChild(message)
  chatWindow.scrollTop = chatWindow.scrollHeight
}

async function initModel() {
  if (!window.LanguageModel || typeof window.LanguageModel.availability !== 'function') {
    setStatus('LanguageModel API unavailable in this browser.')
    appendMessage('bot', 'The browser does not expose the built-in LanguageModel API. Use a supported browser or runtime to access the local model.')
    return
  }

  try {
    setStatus('Checking model availability…', true)
    const availability = await LanguageModel.availability()
    console.log('availability =', availability)

    setStatus('Loading local model…', true)
    browserSession = await LanguageModel.create({
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          if (!event.total) return
          const pct = ((event.loaded / event.total) * 100).toFixed(1)
          setStatus(`Downloading model: ${pct}%`, true)
        })
      }
    })

    window.browserSession = browserSession
    setStatus('Model ready', false)
  } catch (error) {
    console.error('Error initializing LanguageModel:', error)
    setStatus('Failed to initialize the model.')
    appendMessage('bot', `Initialization error: ${error?.message || error}`)
  }
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const prompt = promptInput.value.trim()
  if (!prompt) return

  appendMessage('user', prompt)
  promptInput.value = ''
  promptInput.style.height = 'auto'
  promptInput.focus()

  if (!browserSession) {
    appendMessage('bot', 'Chat is not available because the local model session is not ready.')
    return
  }

  setStatus('Generating…', true)
  setLoading(true)
  promptInput.disabled = true

  try {
    const result = await browserSession.prompt(prompt)
    const output = typeof result === 'string' ? result : result?.output || JSON.stringify(result)
    appendMessage('bot', output)
    setStatus('Model ready', false)
  } catch (error) {
    console.error('Prompt error:', error)
    appendMessage('bot', `Error: ${error?.message || error}`)
    setStatus('Error generating response.', false)
  } finally {
    setLoading(false)
    promptInput.disabled = false
  }
})

initModel()
