import './style.css'


document.addEventListener('DOMContentLoaded', () => {
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
      {
        label: 'Copy',
        icon: `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        `
      },
      {
        label: 'Regenerate',
        icon: `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M3 2v6h6"></path>
            <path d="M21 12A9 9 0 0 0 6 5.3L3 8"></path>
            <path d="M21 22v-6h-6"></path>
            <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"></path>
          </svg>
        `
      }
    ]
    actions.forEach(({ icon, label }) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'action-button'
      button.innerHTML = icon
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
})