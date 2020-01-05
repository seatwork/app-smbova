window.onerror = function(msg, url, line) {
  const idx = url.lastIndexOf('/')
  if (idx > -1) url = url.substring(idx + 1)

  const message = 'ERROR in ' + url + ' (LINE #' + line + '): ' + msg
  if (window.Toast) {
    Toast.error(message)
  } else {
    alert(message)
  }
}

///////////////////////////////////////////////////////////
// Que Framework
///////////////////////////////////////////////////////////

const SERVER_KEY = 'SERVER_KEY'
const FILE_ICONS = {
  audio: ['mp3', 'flac', 'ape'],
  code: ['js', 'java', 'php'],
  font: ['ttf', 'otf'],
  image: ['png', 'jpg', 'jpeg'],
  video: ['mp4'],
  zip: ['zip','rar'],
  '': ['ai', 'apk', 'doc', 'exe', 'pdf', 'ppt', 'psd', 'swf', 'torrent', 'txt', 'vsd', 'xls']
}

new Que({
  data: {
    filelist: [
    {name:'a.txt'},
    {name:'a.jpg'}
    ],
    currentPath: '',
    page: {
      fileName: '',
      filePath: '',
      content: ''
    },
  },

  onDeviceReady() {
    samba.auth('xehu', 'linsang')
    this.root = 'smb://10.0.0.2/'
    this._openDirectory(this.root)
    this._addBackListener()
  },

  onOpen(e) {
    const index = e.currentTarget.dataset.index
    const entry = this.filelist[index]
    if (entry.isDirectory) {
      this._openDirectory(entry.path)
    } else {
      this._openFile(entry, e.currentTarget)
    }
  },

  onBack() {
    if (this.currentPath == this.root) {
      navigator.app.exitApp()
    } else {
      let parentPath = this.currentPath.replace(/^(smb:\/\/.+\/)[^\/]+\/?$/, '$1')
      this._openDirectory(parentPath)
    }
  },

  onStatusTop() {
    const main = document.querySelectorAll('main')
    main.scrollTop = 0
  },

  onAdd() {
    Toast.actionSheet([{
      label: '上传文件',
      onClick: null
    }, {
      label: '新建文件夹',
      onClick: null
    }, {
      label: '新建空文件',
      onClick: null
    }, {
      label: '添加服务器',
      onClick: null
    }])
  },

  onSort() {
    Toast.actionSheet([{
      label: '按文件名排序',
      onClick: null
    }, {
      label: '按时间排序',
      onClick: null
    }, {
      label: '按大小排序',
      onClick: null
    }])
  },

  onAction(e) {
    const index = e.currentTarget.dataset.index
    const file = this.filelist[index]
    navigator.vibrate(50)

    Toast.actionSheet([{
      label: '下载到',
      onClick: null
    }, {
      label: '复制到',
      onClick: null
    }, {
      label: '移动到',
      onClick: null
    }, {
      label: '重命名',
      onClick: null
    }, {
      label: '删除',
      onClick: () => {
        samba.delete(file.path, () => {
          Toast.success('删除成功')
          this.filelist.splice(index, 1)
        }, err => {
          Toast.error(err)
        })
      }
    }])
  },

  _openDirectory(path) {
    Toast.progress.start()
    samba.list(path, res => {
      this.filelist = res
      this.currentPath = path
      Toast.progress.done()
    }, err => {
      Toast.error(err)
      Toast.progress.done()
    })
  },

  _openFile(file, el) {
    const type = this.getFileIcon(file.name)
    if (type == 'txt' || type == 'code') {
      this._openText(file, el)
    } else
    if (type == 'image') {
      this._openImage(file, el)
    } else {
      Toast.info('该文件无法直接打开');
    }
  },

  /////////////////////////////////////////////////////////
  // File viewer
  /////////////////////////////////////////////////////////

  _buildViewer(el, className) {
    const viewer = Toast.page(el.querySelector('.viewer'))
    viewer.addClass(className)
    viewer.show()
    window._openedPage = viewer
    return viewer
  },

  _openText(file, el) {
    const viewer = this._buildViewer(el, 'text-page')
    if (viewer.loaded) return

    samba.read(file.path, bytes => {
      const content = new TextDecoder("utf-8").decode(new Uint8Array(bytes))
      viewer.loaded = true
      viewer.appendChild($(`
        <div>
          <header>
            <div class="backBtn"><i class="back"></i></div>
            <div class="appname">${file.name}</div>
          </header>
          <main>
            <pre>${content}</pre>
          </main>
        </div>
      `))
      viewer.querySelector('.backBtn').on('click', e => {
        e.stopPropagation()
        this._pressBack()
      })
    })
  },

  _openImage(file, el) {
    const viewer = this._buildViewer(el, 'image-page')
    if (viewer.loaded) return

    Toast.loading.start()
    samba.read(file.path, bytes => {
      const blob = new Blob([bytes], { type: 'image/' + this._getExtName(file.name) })
      const url = URL.createObjectURL(blob)

      const image = new Image()
      image.src = url
      viewer.appendChild(image)
      image.onload = function() {
        Toast.loading.done()
        viewer.loaded = true
        URL.revokeObjectURL(url)
      }
    })
  },

  /////////////////////////////////////////////////////////
  // Document events
  /////////////////////////////////////////////////////////

  _pressBack() {
    if (window._openedPage) {
      window._openedPage.hide()
      window._openedPage = null
    } else {
      this.onBack()
    }
  },

  _addBackListener() {
    document.addEventListener('backbutton', () => this._pressBack())
  },

  /////////////////////////////////////////////////////////
  // Utils
  /////////////////////////////////////////////////////////

  _getExtName(name) {
    const index = name.lastIndexOf('.')
    return index > -1 ? name.substring(index + 1).toLowerCase() : ''
  },

  getFileIcon(name) {
    const ext = this._getExtName(name)
    let fileIcon = 'unknown'

    for (let key in FILE_ICONS) {
      if (FILE_ICONS[key].includes(ext)) {
        fileIcon = key
        break;
      }
    }
    return fileIcon || ext
  },

  formatTime(time = +new Date()) {
    const date = new Date(time + 8 * 3600 * 1000) // 格林威治时间增加8小时
    return date.toJSON().substr(0, 16).replace('T', ' ')
  },

  formatSize(size) {
    if (size > 1024*1024*1024) return (size / 1024 / 1024 / 1024).toFixed(2) + 'G'
    if (size > 1024*1024) return (size / 1024 / 1024).toFixed(2) + 'M'
    if (size > 1024) return (size / 1024).toFixed(1) + 'K'
    return size ? size + 'B' : ''
  }

})

Que.directive('hammer.press', (element, callback) => {
  const hammer = new Hammer(element)
  hammer.get("press").set({ time: 500 })
  hammer.on('press', callback)
})
