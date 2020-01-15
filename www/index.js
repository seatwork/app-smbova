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
// Constants
///////////////////////////////////////////////////////////

const FILE_ICONS = {
  text:  ['ass', 'log', 'md', 'rss', 'srt', 'ssa', 'txt'],
  code:  ['as', 'asp', 'bat', 'c', 'cs', 'css', 'h', 'htm', 'html', 'ini', 'java', 'js', 'json', 'php', 'prop', 'py', 'reg', 'sh', 'sql', 'wxml', 'wxss', 'xhtml', 'xml'],
  image: ['bmp', 'cur', 'eps', 'gif', 'ico', 'jpe', 'jpg', 'jpeg', 'jpz', 'png', 'svg', 'tif', 'tiff'],
  audio: ['aac', 'aiff', 'ape', 'caf', 'flac', 'm3u', 'm4a', 'mp3', 'ogg', 'wav', 'wma'],
  video: ['3gp', 'asf', 'avi', 'flv', 'm3u8', 'm4u', 'm4v', 'mkv', 'mov', 'mp4', 'mpa', 'mpe', 'mpeg', 'mpg', 'ogm', 'rm', 'rmvb', 'vob', 'webm', 'wmv'],
  font:  ['eot', 'otf', 'ttf', 'woff', 'woff2'],
  zip:   ['7z', 'gz', 'gzip', 'jar', 'rar', 'tar', 'z', 'zip'],
  '':    ['ai', 'apk', 'doc', 'exe', 'pdf', 'ppt', 'psd', 'swf', 'torrent', 'xls']
}

const SmbType = {
  FILE: 0,
  DIRECTORY: 1,
  SERVER: 4,
  SHARE: 8
}

const AscendSort = {
  name: false,
  size: false,
  lastModified: false
}

const extname = function(name) {
  const index = name.lastIndexOf('.')
  return index > -1 ? name.substring(index + 1).toLowerCase() : ''
}

const Storage = {
  key: 'SAMBA_SERVER_STORAGE_KEY',

  save(obj) {
    localStorage.setItem(this.key, JSON.stringify(obj))
  },
  get() {
    return JSON.parse(localStorage.getItem(this.key)) || []
  },
  remove(index) {
    const servers = this.get()
    servers.splice(index, 1)
    this.save(servers)
  }
}

let entryStack = []
let currentPage = null

///////////////////////////////////////////////////////////
// Que Framework
///////////////////////////////////////////////////////////

new Que({
  data: {
    filelist: [],
    server: {},
  },

  ready() {
    window.pullRefresh = new PullRefresh()
    window.textPage = Toast.page(document.querySelector('.text-page'))
    window.imagePage = Toast.page(document.querySelector('.image-page'))
    window.serverPage = Toast.page(document.querySelector('.server-page'))
    window.needFingerprint = document.querySelector('#needFingerprint')
    this._listServers()
  },

  onDeviceReady() {
    document.addEventListener('backbutton', () => this.onBack())
    pullRefresh.bind(document.querySelector('main'), () => {
      const currentEntry = entryStack[entryStack.length-1]
      if (currentEntry) {
        this._openDirectory(currentEntry)
      } else {
        this._listServers()
        pullRefresh.done()
      }
    })
  },

  onOpen(e) {
    const index = e.currentTarget.dataset.index
    const entry = this.filelist[index]

    if (entry.type == SmbType.SERVER) {
      samba.auth(entry.username, entry.password)

      if (entry.needFingerprint) {
        this._fingerprintAuth(() => this._openDirectory(entry, 1))
        return
      }
    }

    if (entry.type > 0) {
      this._openDirectory(entry, 1)
    } else {
      this._openFile(entry, e.currentTarget)
    }
  },

  _openDirectory(entry, direction = 0) {
    Toast.progress.start()
    samba.listFiles(entry.path, res => {
      this.filelist = res
      pullRefresh.done()
      Toast.progress.done()

      if (direction == 1) {
        entryStack.push(entry)
      } else
      if (direction == -1) {
        entryStack.pop()
      }
    }, err => {
      Toast.error(err)
      pullRefresh.done()
      Toast.progress.done()
    })
  },

  onBack() {
    if (Toast.current) {
      Toast.current.hide()
      return
    }
    if (currentPage) {
      currentPage.hide()
      currentPage = null
      return
    }
    if (entryStack.length == 1) {
      entryStack.pop()
      this._listServers()
      return
    }
    if (entryStack.length > 1) {
      const parentEntry = entryStack[entryStack.length-2]
      this._openDirectory(parentEntry, -1)
      return
    }
    navigator.app.exitApp()
  },

  onStatusTop() {
    const main = document.querySelector('main')
    main.scrollTop = 0
  },

  onSaveServer() {
    if (!this.server.name) {
      return Toast.error('别名不能为空')
    }
    if (!this.server.host) {
      return Toast.error('主机名/IP不能为空')
    }

    this.server.needFingerprint = needFingerprint.checked
    this.server.path = `smb://${this.server.host}`
    if (!this.server.host.endsWith('/')) {
      this.server.path += '/'
    }

    const servers = Storage.get()
    const index = this.server.index
    this.server.type = SmbType.SERVER

    if (index) {
      delete this.server.index
      servers.splice(index, 1, this.server)
      this.filelist.splice(index, 1, Object.assign({}, this.server))
    } else {
      servers.push(this.server)
      this.filelist.push(this.server)
    }

    Storage.save(servers)
    this.onBack()
    Toast.success('保存成功')
  },

  _listServers() {
    this.filelist = Storage.get()
    if (this.filelist.length == 0) {
      Toast.info("尚未添加服务器")
    }
  },

  _fingerprintAuth(callback) {
    FingerprintAuth.encrypt({
        clientId: Storage.key,
        maxAttempts: 5,
        disableBackup: true,
        userAuthRequired: false,
        encryptNoAuth: false,
        locale: "zh_CN",
        dialogTitle: '指纹登录',
    }, res => {
      if (res && res.token) callback()
    })
  },

  /////////////////////////////////////////////////////////
  // Create entry actions
  /////////////////////////////////////////////////////////

  onAdd() {
    const menus = [{
      label: '添加服务器',
      onClick: () => {
        this.server = {}
        needFingerprint.checked = false
        currentPage = serverPage.show()
      }
    }]

    const currentEntry = entryStack[entryStack.length-1]
    if (currentEntry && currentEntry.type != SmbType.SERVER) {
      menus.unshift({
        label: '上传图片',
        onClick: () => {
          navigator.camera.getPicture(uri => this._upload(uri, currentEntry.path), null, {
            quality: 100,
            mediaType: Camera.MediaType.ALLMEDIA,
            sourceType: Camera.PictureSourceType.PHOTOLIBRARY,
            destinationType: Camera.DestinationType.FILE_URI
          })
        }
      }, {
        label: '新建文本文件',
        onClick: () => {
          samba.mkfile(currentEntry.path + '新建文本文件.txt', entry => {
            this.filelist.push(entry)
            Toast.success('新建成功')
          }, err => {
            Toast.error(err)
          })
        }
      }, {
        label: '新建文件夹',
        onClick: () => {
          samba.mkdir(currentEntry.path + '新建文件夹/', entry => {
            this.filelist.push(entry)
            Toast.success('新建成功')
          }, err => {
            Toast.error(err)
          })
        }
      })
    }

    Toast.actionSheet(menus)
  },

  _upload(uri, path) {
    Toast.progress.start(false)
    samba.upload(uri, path, entry => {
      this.filelist.push(entry)
      Toast.success('上传成功')
      Toast.progress.done()
    }, err => {
      Toast.error(err)
      Toast.progress.done()
    })

    samba.onUpload = progress => {
      Toast.progress.tick(progress * 100)
    }
  },

  /////////////////////////////////////////////////////////
  // Single entry actions
  /////////////////////////////////////////////////////////

  onAction(e) {
    navigator.vibrate(50)
    const index = e.currentTarget.dataset.index
    const entry = this.filelist[index]
    if (entry.type == SmbType.SHARE) {
      return
    }

    const menus = [{
      label: '删除',
      onClick: () => {
        Toast.confirm('删除操作不可恢复，确定继续吗？', () => {
          if (entry.type == SmbType.SERVER) {
            Storage.remove(index)
            this.filelist.splice(index, 1)
            Toast.success('删除成功')
          } else {
            samba.delete(entry.path, () => {
              this.filelist.splice(index, 1)
              Toast.success('删除成功')
            }, err => {
              Toast.error(err)
            })
          }
        })
      }
    }]

    if (entryStack.length == 0) {
      menus.unshift({
        label: '网络唤醒',
        onClick: () => {
          samba.wakeOnLan(entry.mac, (res) => {
            Toast.success('广播成功')
          }, err => {
            Toast.error(err)
          })
        }
      }, {
        label: '编辑',
        onClick: () => {
          if (entry.needFingerprint) {
            this._fingerprintAuth(() => this._editServer(entry, index))
          } else {
            this._editServer(entry, index)
          }
        }
      })
    }
    Toast.actionSheet(menus)
  },

  _editServer(entry, index) {
    this.server = Object.assign({ index }, entry)
    needFingerprint.checked = entry.needFingerprint
    currentPage = serverPage.show()
  },

  _openFile(file, el) {
    file.icon = this.getFileIcon(file.name)
    if (file.icon == 'text' || file.icon == 'code') {
      this._openText(file)
    } else
    if (file.icon == 'image') {
      this._openImage(file)
    } else
    if (file.icon == 'video' || file.icon == 'audio') {
      samba.openMedia(file.path)
    } else {
      samba.openFile(file.path)
    }
  },

  /////////////////////////////////////////////////////////
  // Filelist sort actions
  /////////////////////////////////////////////////////////

  onSort() {
    Toast.actionSheet([{
      label: '按文件名排序',
      onClick: () => this._sortList('name')
    }, {
      label: '按时间排序',
      onClick: () => this._sortList('lastModified')
    }, {
      label: '按大小排序',
      onClick: () => this._sortList('size')
    }])
  },

  _sortList(key) {
    AscendSort[key] = !AscendSort[key]
    Toast.info(AscendSort[key] ? '正序排列' : '倒序排列')

    this.filelist.sort(function(a, b) {
      if (AscendSort[key]) {
        return a[key] > b[key] ? 1 : -1
      } else {
        return a[key] < b[key] ? 1 : -1
      }
    })
  },

  /////////////////////////////////////////////////////////
  // File viewer
  /////////////////////////////////////////////////////////

  _openText(file) {
    const title = textPage.querySelector('.appname')
    const content = textPage.querySelector('.content')
    title.textContent = file.name
    content.textContent = ''
    currentPage = textPage.show()

    if (file.icon == 'text') {
      content.addClass('break-word')
    } else {
      content.removeClass('break-word')
    }

    Toast.progress.start()
    samba.readAsText(file.path, text => {
      content.textContent = text
      Toast.progress.done()
    })
  },

  _openImage(file) {
    const image = imagePage.querySelector('img')
    image.removeAttribute('src')
    pinchZoom(image)
    currentPage = imagePage.show()

    Toast.loading.start()
    samba.readAsByteArray(file.path, bytes => {
      const blob = new Blob([bytes], { type: 'image/' + extname(file.name) })
      const url = URL.createObjectURL(blob)

      image.src = url
      image.onload = function() {
        Toast.loading.done()
        URL.revokeObjectURL(url)
      }
    })
  },

  /////////////////////////////////////////////////////////
  // Utils
  /////////////////////////////////////////////////////////

  getFileIcon(name) {
    const ext = extname(name)
    let fileIcon = 'unknown'

    for (let key in FILE_ICONS) {
      if (FILE_ICONS[key].includes(ext)) {
        fileIcon = key
        break
      }
    }
    return fileIcon || ext
  },

  formatTime(time) {
    if (!time) return
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

///////////////////////////////////////////////////////////
// Directive Registration
///////////////////////////////////////////////////////////

Que.directive('hammer.press', (element, callback) => {
  const hammer = new Hammer(element)
  hammer.get("press").set({ time: 500 })
  hammer.on('press', callback)
})
