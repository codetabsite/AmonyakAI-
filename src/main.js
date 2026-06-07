const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const http = require('http')
const { execFile, spawn } = require('child_process')

const MODEL_URL = 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf'
const CHUNK_SIZE = 1024 * 1024 * 50
const MODEL_TOTAL_SIZE = 4661000000

let mainWindow
let ollamaProcess
let downloadAborted = false

function getDataDir() {
  return path.join(app.getPath('userData'), 'model')
}

function getModelPath() {
  return path.join(getDataDir(), 'llama3.1-8b.gguf')
}

function getProgressPath() {
  return path.join(getDataDir(), 'progress.json')
}

function getOllamaPath() {
  const binDir = path.join(process.resourcesPath, 'bin')
  return process.platform === 'win32'
    ? path.join(binDir, 'ollama.exe')
    : path.join(binDir, 'ollama')
}

function loadProgress() {
  try {
    const data = fs.readFileSync(getProgressPath(), 'utf8')
    return JSON.parse(data)
  } catch {
    return { downloaded: 0 }
  }
}

function saveProgress(downloaded) {
  fs.writeFileSync(getProgressPath(), JSON.stringify({ downloaded }))
}

function getModelState() {
  const modelPath = getModelPath()
  if (!fs.existsSync(modelPath)) return { exists: false, downloaded: 0, total: MODEL_TOTAL_SIZE }
  const stat = fs.statSync(modelPath)
  const progress = loadProgress()
  const complete = stat.size >= MODEL_TOTAL_SIZE
  return { exists: true, downloaded: progress.downloaded || stat.size, total: MODEL_TOTAL_SIZE, complete }
}

function downloadChunk(start, end) {
  return new Promise((resolve, reject) => {
    const url = new URL(MODEL_URL)
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      headers: { Range: `bytes=${start}-${end}` },
      timeout: 30000
    }
    https.get(options, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        const redirectUrl = new URL(res.headers.location)
        const redirOptions = {
          hostname: redirectUrl.hostname,
          path: redirectUrl.pathname + redirectUrl.search,
          headers: { Range: `bytes=${start}-${end}` },
          timeout: 30000
        }
        https.get(redirOptions, (res2) => {
          const chunks = []
          res2.on('data', d => chunks.push(d))
          res2.on('end', () => resolve(Buffer.concat(chunks)))
          res2.on('error', reject)
        }).on('error', reject)
        return
      }
      const chunks = []
      res.on('data', d => chunks.push(d))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function downloadModel(win) {
  const dataDir = getDataDir()
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  const modelPath = getModelPath()
  const state = getModelState()
  let downloaded = state.downloaded || 0

  if (state.complete) {
    win.webContents.send('download-complete')
    return
  }

  downloadAborted = false
  const fd = fs.openSync(modelPath, 'a')

  while (downloaded < MODEL_TOTAL_SIZE && !downloadAborted) {
    const end = Math.min(downloaded + CHUNK_SIZE - 1, MODEL_TOTAL_SIZE - 1)
    try {
      const chunk = await downloadChunk(downloaded, end)
      fs.writeSync(fd, chunk, 0, chunk.length, downloaded)
      downloaded += chunk.length
      saveProgress(downloaded)
      const percent = Math.floor((downloaded / MODEL_TOTAL_SIZE) * 100)
      win.webContents.send('download-progress', { downloaded, total: MODEL_TOTAL_SIZE, percent })
    } catch (err) {
      await new Promise(r => setTimeout(r, 3000))
    }
  }

  fs.closeSync(fd)

  if (!downloadAborted && downloaded >= MODEL_TOTAL_SIZE) {
    await createOllamaModel()
    win.webContents.send('download-complete')
  }
}

function createOllamaModel() {
  return new Promise((resolve, reject) => {
    const ollamaPath = getOllamaPath()
    const modelfile = `FROM ${getModelPath()}\n\nSYSTEM """\nSen yardımcı, zeki ve samimi bir asistansın. Kullanıcının diline göre cevap ver.\n"""\n\nPARAMETER temperature 0.7\nPARAMETER num_ctx 4096\nPARAMETER top_p 0.9\n`
    const modelfilePath = path.join(getDataDir(), 'Modelfile')
    fs.writeFileSync(modelfilePath, modelfile)
    execFile(ollamaPath, ['create', 'amonyak', '-f', modelfilePath], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function startOllama() {
  const ollamaPath = getOllamaPath()
  ollamaProcess = spawn(ollamaPath, ['serve'], { detached: false })
}

async function chat(messages) {
  const body = JSON.stringify({
    model: 'amonyak',
    messages,
    stream: false
  })

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve(parsed.message?.content || '')
        } catch {
          reject(new Error('Parse error'))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'index.html'))
}

app.whenReady().then(() => {
  startOllama()
  createWindow()
})

app.on('window-all-closed', () => {
  downloadAborted = true
  if (ollamaProcess) ollamaProcess.kill()
  app.quit()
})

ipcMain.handle('get-model-state', () => getModelState())

ipcMain.on('start-download', () => {
  downloadModel(mainWindow)
})

ipcMain.on('pause-download', () => {
  downloadAborted = true
})

ipcMain.handle('chat', async (_, messages) => {
  return await chat(messages)
})

ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
})
ipcMain.on('window-close', () => mainWindow.close())
