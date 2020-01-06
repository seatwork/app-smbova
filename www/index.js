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

const SERVER_KEY = 'SERVER_KEY'

const FILE_ICONS = {
  text:  ['ass', 'log', 'md', 'rss', 'srt', 'ssa', 'txt'],
  code:  ['as', 'asp', 'bat', 'c', 'cs', 'css', 'h', 'htm', 'html', 'ini', 'java', 'js', 'json', 'php', 'prop', 'py', 'reg', 'sh', 'sql', 'wxml', 'wxss', 'xhtml', 'xml'],
  image: ['bmp', 'cur', 'eps', 'gif', 'ico', 'jpe', 'jpg', 'jpeg', 'jpz', 'png', 'svg', 'tif', 'tiff'],
  audio: ['aac', 'aiff', 'ape', 'caf', 'flac', 'm3u', 'm4a', 'mp3', 'ogg', 'wav', 'wma'],
  video: ['3gp', 'asf', 'avi', 'flv', 'm3u8', 'm4u', 'm4v', 'mkv', 'mov', 'mp4', 'mpa', 'mpe', 'mpeg', 'mpg', 'ogm', 'rm', 'rmvb', 'vob', 'webm', 'wmv'],
  font:  ['eot', 'otf', 'ttf', 'woff', 'woff2'],
  zip:   ['7z', 'gz', 'gzip', 'jar', 'rar', 'tar', 'z', 'zip'],
  '':    ['ai', 'apk', 'doc', 'exe', 'pdf', 'ppt', 'psd', 'swf', 'torrent', 'vsd', 'xls']
}

const SORT_ASCEND = {
  name: false,
  size: false,
  lastModified: false
}

///////////////////////////////////////////////////////////
// Que Framework
///////////////////////////////////////////////////////////

new Que({
  data: {
    filelist: [],
    currentPath: '',
  },

  onDeviceReady() {
    samba.auth('xehu', 'linsang')
    this.root = 'smb://10.0.0.2/'
    this._openDirectory(this.root)

    document.addEventListener('backbutton', () => this.onBack())
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
    if (window._openedPage) {
      window._openedPage.hide()
      window._openedPage = null
    } else
    if (this.currentPath != this.root) {
      const parentPath = this.currentPath.replace(/^(smb:\/\/.+\/)[^\/]+\/?$/, '$1')
      this._openDirectory(parentPath)
    } else {
      navigator.app.exitApp()
    }
  },

  onStatusTop() {
    const main = document.querySelector('main')
    main.scrollTop = 0
  },

  /////////////////////////////////////////////////////////
  // Create entry actions
  /////////////////////////////////////////////////////////

  onAdd() {
    Toast.actionSheet([{
      label: '上传图片',
      onClick: () => {
        navigator.camera.getPicture(uri => this._upload(uri), null, {
          quality: 100,
          mediaType: Camera.MediaType.ALLMEDIA,
          sourceType: Camera.PictureSourceType.PHOTOLIBRARY,
          destinationType: Camera.DestinationType.FILE_URI
        })
      }
    }, {
      label: '新建文本文件',
      onClick: () => {
        samba.mkfile(this.currentPath + '新建文本文件.txt', entry => {
          this.filelist.push(entry)
          Toast.success('新建成功')
        }, err => {
          Toast.error(err)
        })
      }
    }, {
      label: '新建文件夹',
      onClick: () => {
        samba.mkdir(this.currentPath + '新建文件夹/', entry => {
          this.filelist.push(entry)
          Toast.success('新建成功')
        }, err => {
          Toast.error(err)
        })
      }
    }, {
      label: '添加服务器',
      onClick: null
    }])
  },

  _upload(uri) {
    Toast.progress.start()
      samba.upload(uri, this.currentPath, entry => {
        this.filelist.push(entry)
        Toast.success('上传成功')
        Toast.progress.done()
      }, err => {
        Toast.error(err)
        Toast.progress.done()
      });
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
    SORT_ASCEND[key] = !SORT_ASCEND[key]
    Toast.info(SORT_ASCEND[key] ? '正序排列' : '倒序排列')

    this.filelist.sort(function(a, b) {
      if (SORT_ASCEND[key]) {
        return a[key] > b[key] ? 1 : -1
      } else {
        return a[key] < b[key] ? 1 : -1
      }
    })
  },

  /////////////////////////////////////////////////////////
  // Single entry actions
  /////////////////////////////////////////////////////////

  onAction(e) {
    const index = e.currentTarget.dataset.index
    const file = this.filelist[index]
    navigator.vibrate(50)

    Toast.actionSheet([{
      label: '删除',
      onClick: () => {
        Toast.confirm('删除操作不可恢复，确定继续吗？', () => {
            samba.delete(file.path, () => {
              this.filelist.splice(index, 1)
              Toast.success('删除成功')
            }, err => {
              Toast.error(err)
            })
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
    if (type == 'text' || type == 'code') {
      this._openText(file, el)
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
            <pre contenteditable="true">${content}</pre>
          </main>
        </div>
      `))
      viewer.querySelector('.backBtn').on('click', e => {
        e.stopPropagation()
        this.onBack()
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
      image.onload = function() {
        Toast.loading.done()
        viewer.appendChild(image)
        viewer.loaded = true
        URL.revokeObjectURL(url)
      }
    })
  },

  _openVideo(file, el) {
    const viewer = this._buildViewer(el, 'image-page')
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

      const mime = this.getFileIcon(file.name) + '/' + this._getExtName(file.name)
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

///////////////////////////////////////////////////////////
// Directive Registration
///////////////////////////////////////////////////////////

Que.directive('hammer.press', (element, callback) => {
  const hammer = new Hammer(element)
  hammer.get("press").set({ time: 500 })
  hammer.on('press', callback)
})
