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
          <button type="button" class="icon-button" aria-label="Voice input" title="Voice input">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1a3 3 0 0 0-3 3v12a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          <button type="button" class="icon-button" aria-label="Signal" title="Network">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 20h20M4 20V8a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v12M9 12h6M9 16h6"/>
            </svg>
          </button>
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
let messageCounter = 0

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
    { label: 'Copy', icon: '📋' },
    { label: 'Regenerate', icon: '🔄' },
  ]
  actions.forEach(({ icon, label }) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'action-button'
    button.textContent = icon
    button.setAttribute('aria-label', label)
    button.setAttribute('title', label)
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
  messageCounter++
  message.setAttribute('data-message-id', messageCounter)

  if (role === 'bot') {
    const star = document.createElement('span')
    star.className = 'bot-icon'
    star.textContent = '*'
    message.appendChild(star)
  }

  const bubble = document.createElement('div')
  bubble.className = 'bubble'
  bubble.textContent = text
  message.appendChild(bubble)

  if (role === 'bot' && !isStreaming) {
    message.appendChild(createActionRow())
  }

  chatWindow.appendChild(message)
  scrollToBottom()
  
  return message
}

function updateMessage(messageElement, text) {
  const bubble = messageElement.querySelector('.bubble')
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

function addActionsToMessage(messageElement) {
  if (messageElement && !messageElement.querySelector('.message-actions')) {
    messageElement.appendChild(createActionRow())
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
    let fullResponse = ''

    // Check if streaming is supported
    if (browserSession.promptStreaming) {
      // Use streaming API
      const stream = await browserSession.promptStreaming(prompt)
      
      for await (const chunk of stream) {
        fullResponse += chunk
        updateMessage(botMessage, fullResponse)
      }
    } else {
      // Fallback to regular prompt
      const result = await browserSession.prompt(prompt)
      fullResponse = typeof result === 'string' ? result : result?.output || JSON.stringify(result)
      updateMessage(botMessage, fullResponse)
    }

    // Add action buttons after streaming is complete
    addActionsToMessage(botMessage)
    
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
