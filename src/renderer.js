const downloadScreen = document.getElementById('download-screen')
const chatScreen = document.getElementById('chat-screen')
const progressBar = document.getElementById('progress-bar')
const progressText = document.getElementById('progress-text')
const progressPct = document.getElementById('progress-pct')
const downloadBtn = document.getElementById('download-btn')
const downloadStatus = document.getElementById('download-status')
const messages = document.getElementById('messages')
const input = document.getElementById('input')
const sendBtn = document.getElementById('send-btn')
const dlBar = document.getElementById('dl-bar')
const dlBarFill = document.getElementById('dl-bar-fill')

let history = []
let downloading = false
let modelComplete = false

function formatBytes(b) {
  return (b / 1024 / 1024).toFixed(0) + ' MB'
}

function showChat() {
  downloadScreen.style.display = 'none'
  chatScreen.style.display = 'flex'
}

function updateProgress(data) {
  const pct = data.percent
  progressBar.style.width = pct + '%'
  progressText.textContent = formatBytes(data.downloaded) + ' / ' + formatBytes(data.total)
  progressPct.textContent = pct + '%'
  if (dlBar.style.display === 'block') {
    dlBarFill.style.width = pct + '%'
  }
}

function addMessage(role, text) {
  const div = document.createElement('div')
  div.className = 'msg ' + (role === 'user' ? 'user' : 'ai')
  const label = document.createElement('div')
  label.className = 'label'
  label.textContent = role === 'user' ? 'Sen' : 'Amonyak'
  const content = document.createElement('div')
  content.className = 'content'
  content.textContent = text
  div.appendChild(label)
  div.appendChild(content)
  messages.appendChild(div)
  messages.scrollTop = messages.scrollHeight
  return content
}

function addThinking() {
  const div = document.createElement('div')
  div.className = 'msg ai'
  const label = document.createElement('div')
  label.className = 'label'
  label.textContent = 'Amonyak'
  const content = document.createElement('div')
  content.className = 'content'
  content.innerHTML = '<span class="thinking">_</span>'
  div.appendChild(label)
  div.appendChild(content)
  messages.appendChild(div)
  messages.scrollTop = messages.scrollHeight
  return { div, content }
}

async function sendMessage() {
  const text = input.value.trim()
  if (!text || !modelComplete) return

  input.value = ''
  input.style.height = 'auto'
  sendBtn.disabled = true

  addMessage('user', text)
  history.push({ role: 'user', content: text })

  const { div, content } = addThinking()

  try {
    const reply = await window.api.chat(history)
    content.innerHTML = ''
    content.textContent = reply
    history.push({ role: 'assistant', content: reply })
  } catch {
    content.textContent = 'Hata oluştu.'
  }

  sendBtn.disabled = false
  input.focus()
}

async function init() {
  const state = await window.api.getModelState()

  if (state.complete) {
    modelComplete = true
    showChat()
    return
  }

  if (state.exists && state.downloaded > 0) {
    updateProgress({ downloaded: state.downloaded, total: state.total, percent: Math.floor(state.downloaded / state.total * 100) })
    downloadStatus.textContent = 'Kaldığı yerden devam edebilir'
    downloadBtn.textContent = 'Devam Et'
  }

  downloadBtn.addEventListener('click', () => {
    if (downloading) {
      window.api.pauseDownload()
      downloading = false
      downloadBtn.textContent = 'Devam Et'
      downloadStatus.textContent = 'Duraklatıldı'
      return
    }
    downloading = true
    downloadBtn.textContent = 'Durdur'
    downloadStatus.textContent = 'İndiriliyor...'
    window.api.startDownload()
  })

  window.api.onDownloadProgress((data) => {
    updateProgress(data)
    if (!modelComplete && chatScreen.style.display === 'flex') {
      dlBar.style.display = 'block'
      dlBarFill.style.width = data.percent + '%'
    }
  })

  window.api.onDownloadComplete(() => {
    modelComplete = true
    downloading = false
    showChat()
    dlBar.style.display = 'none'
  })
}

input.addEventListener('input', () => {
  input.style.height = 'auto'
  input.style.height = input.scrollHeight + 'px'
})

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
})

sendBtn.addEventListener('click', sendMessage)

document.getElementById('btn-close').addEventListener('click', () => window.api.close())
document.getElementById('btn-min').addEventListener('click', () => window.api.minimize())
document.getElementById('btn-max').addEventListener('click', () => window.api.maximize())

init()
