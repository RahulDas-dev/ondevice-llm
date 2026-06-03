import './style.css'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="chat-app">
    <section class="hero-card" id="heroCard">
      <span class="hero-icon">*</span>
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
          <button type="button" class="icon-button" aria-label="Voice input">MIC</button>
          <button type="button" class="icon-button" aria-label="Signal">NET</button>
          <button type="submit" class="send-button" aria-label="Send message">Send</button>
        </div>
      </form>
      <p class="disclaimer">Claude is AI and can make mistakes. Please double-check responses.</p>
    </section>
  </main>
`

const statusEl = document.querySelector('#status')
const chatWindow = document.querySelector('#chatWindow')
const chatForm = document.querySelector('#chatForm')
const promptInput = document.querySelector('#promptInput')
const heroCard = document.querySelector('#heroCard')
const plusButton = document.querySelector('#plusButton')
const loadingIndicator = document.querySelector('#loadingIndicator')
let browserSession = null
let hasMessages = false
let isStreaming = false

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
  const actions = [
    { label: 'Copy', text: 'COPY' },
    { label: 'Regenerate', text: 'REGEN' },
  ]
  actions.forEach(({ text, label }) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'action-button'
    button.textContent = text
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

function appendMessage(role, text, isStreaming = false) {
  hideHero()

  const message = document.createElement('div')
  message.className = `message ${role}`
  message.id = `message-${Date.now()}-${Math.random()}`

  if (role === 'bot') {
    const star = document.createElement('span')
    star.className = 'bot-icon'
    star.textContent = '*'
    message.appendChild(star)
  }

  const bubble = document.createElement('div')
  bubble.className = 'bubble'
  bubble.textContent = text
  bubble.id = `bubble-${message.id}`
  message.appendChild(bubble)

  if (role === 'bot' && !isStreaming) {
    message.appendChild(createActionRow())
  }

  chatWindow.appendChild(message)
  scrollToBottom()
  
  return message
}

function updateMessage(messageId, text) {
  const bubble = document.querySelector(`#bubble-${messageId}`)
  if (bubble) {
    bubble.textContent = text
    scrollToBottom()
  }
}

function scrollToBottom() {
  setTimeout(() => {
    chatWindow.scrollTop = chatWindow.scrollHeight
  }, 0)
}

function addActionsToMessage(messageId) {
  const message = document.querySelector(`#${messageId}`)
  if (message && !message.querySelector('.message-actions')) {
    message.appendChild(createActionRow())
  }
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
  if (!prompt || isStreaming) return

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
  isStreaming = true

  try {
    // Create bot message container
    const botMessage = appendMessage('bot', '', true)
    const messageId = botMessage.id
    let fullResponse = ''

    // Check if streaming is supported
    if (browserSession.promptStreaming) {
      // Use streaming API
      const stream = await browserSession.promptStreaming(prompt)
      
      for await (const chunk of stream) {
        fullResponse += chunk
        updateMessage(messageId, fullResponse)
      }
    } else {
      // Fallback to regular prompt
      const result = await browserSession.prompt(prompt)
      fullResponse = typeof result === 'string' ? result : result?.output || JSON.stringify(result)
      updateMessage(messageId, fullResponse)
    }

    // Add action buttons after streaming is complete
    addActionsToMessage(messageId)
    
    setStatus('Model ready', false)
  } catch (error) {
    console.error('Prompt error:', error)
    appendMessage('bot', `Error: ${error?.message || error}`)
    setStatus('Error generating response.', false)
  } finally {
    setLoading(false)
    promptInput.disabled = false
    isStreaming = false
  }
})

initModel()
