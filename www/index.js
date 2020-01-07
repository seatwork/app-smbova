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
    window.textPage = Toast.page(document.querySelector('.text-page'))
    window.serverPage = Toast.page(document.querySelector('.server-page'))
    this._listServers()
  },

  onDeviceReady() {
    document.addEventListener('backbutton', () => this.onBack())
  },

  onOpen(e) {
    const index = e.currentTarget.dataset.index
    const entry = this.filelist[index]

    if (entry.type == SmbType.SERVER && entry.username && entry.password) {
      samba.auth(entry.username, entry.password)
    }
    if (entry.type > 0) {
      this._openDirectory(entry)
    } else {
      this._openFile(entry, e.currentTarget)
    }
  },

  _openDirectory(entry) {
    let path
    if (entry) {
      path = entry.path
    } else {
      const parentEntry = entryStack[entryStack.length-2]
      path = parentEntry.path
    }

    Toast.progress.start()
    samba.list(path, res => {
      this.filelist = res
      Toast.progress.done()

      if (entry) {
        entryStack.push(entry)
      } else {
        entryStack.pop()
      }
    }, err => {
      Toast.error(err)
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
      this._openDirectory()
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
  },

  /////////////////////////////////////////////////////////
  // Create entry actions
  /////////////////////////////////////////////////////////

  onAdd() {
    const menus = [{
      label: '添加服务器',
      onClick: () => {
        this.server = {}
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
    Toast.progress.start()
      samba.upload(uri, path, entry => {
        this.filelist.push(entry)
        Toast.success('上传成功')
        Toast.progress.done()
      }, err => {
        Toast.error(err)
        Toast.progress.done()
      });
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
        label: '编辑',
        onClick: () => {
          this.server = Object.assign({ index }, entry)
          currentPage = serverPage.show()
        }
      })
    }
    Toast.actionSheet(menus)
  },

  _openFile(file, el) {
    const type = this.getFileIcon(file.name)
    if (type == 'text' || type == 'code') {
      this._openText(file)
    } else
    if (type == 'image') {
      this._openImage(file, el)
    } else
    if (type == 'video' || type == 'audio') {
      this._openVideo(file, el)
    } else {
      Toast.info('该文件无法直接打开');
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

  _buildViewer(el) {
    const viewer = Toast.page(el.querySelector('.image-page'))
    viewer.show()
    currentPage = viewer
    return viewer
  },

  _openText(file) {
    textPage.show()
    textPage.querySelector('.appname').innerHTML = file.name
    currentPage = textPage

    Toast.progress.start()
    samba.read(file.path, bytes => {
      const content = new TextDecoder("utf-8").decode(new Uint8Array(bytes))
      textPage.querySelector('pre').innerHTML = content
      Toast.progress.done()
    })
  },

  _openImage(file, el) {
    const viewer = this._buildViewer(el)
    if (viewer.loaded) return

    Toast.loading.start()
    samba.read(file.path, bytes => {
      const blob = new Blob([bytes], { type: 'image/' + extname(file.name) })
      const url = URL.createObjectURL(blob)

      const image = new Image()
      image.src = url
      image.onload = function() {
        Toast.loading.done()
        viewer.appendChild(image)
        viewer.loaded = true
        URL.revokeObjectURL(url)
      }
    })
  },

  _openVideo(file, el) {
    const viewer = this._buildViewer(el)
    if (viewer.loaded) return

    // const mimeCodec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
    // const mediaSource = new MediaSource()
    // const url = URL.createObjectURL(mediaSource)

    // const video = $(`<video src="${url}" controls></video>`)
    // viewer.appendChild(video)
    // viewer.loaded = true
    // video.onloadedmetadata = function(){
    //   alert(123)
    // }
    // video.onerror = function(err, a){
    //   Toast.error('err')
    // }

    // mediaSource.addEventListener('sourceopen', () => {
    //   const sourceBuffer = mediaSource.addSourceBuffer(mimeCodec)
    //   // sourceBuffer.addEventListener("updateend", () => {
    //   //   video.play()
    //   //   mediaSource.endOfStream()
    //   //   // URL.revokeObjectURL(video.src)
    //   // })
    //   Toast.success(123)

    //   samba.read(file.path, bytes => {
    //     Toast.success(bytes)
    //     var arrayBuffer = new ArrayBuffer(bytes.length);
    //     var bufferView = new Uint8Array(arrayBuffer);
    //     for (i = 0; i < bytes.length; i++) {
    //       bufferView[i] = bytes[i];
    //     }

    //     sourceBuffer.appendBuffer((bufferView))
    //   })
    // })

    samba.read(file.path, bytes => {

        var arrayBuffer = new ArrayBuffer(bytes.byteLength);
        var bufferView = new Uint8Array(arrayBuffer);
        for (i = 0; i < bytes.byteLength; i++) {
          bufferView[i] = bytes[i];
        }

      const mime = this.getFileIcon(file.name) + '/' + extname(file.name)
      const blob = new Blob([new Uint8Array(bytes)], { type: mime })
      let url = URL.createObjectURL(blob)
      url = url.replace(/%3A/g, ':');
      Toast.success(url)
      const video = $(`<audio src="${url}" controls></audio>`)
      viewer.appendChild(video)
      viewer.loaded = true

      // video.onloadedmetadata = function(){
      //   Toast.success(123)
      // }
      // video.onerror = function(err, a){
      //   Toast.error('video err')
      // }
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
        break;
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
