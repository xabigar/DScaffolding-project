
const mendeleyColorMapR = {
  'dcffb0': 'green',
  'bae2ff': 'blue',
  'd3c2ff': 'purple',
  'ffc4fb': 'pink',
  'ffb5b6': 'red',
  'dbdbdb': 'grey',
  'ffdeb4': 'orange',
  'fff5ad': 'yellow'
}

const mendeleyColorMap = {
  green: 'dcffb0',
  blue: 'bae2ff',
  purple: 'd3c2ff',
  pink: 'ffc4fb',
  red: 'ffb5b6',
  grey: 'dbdbdb',
  orange: 'ffdeb4',
  yellow: 'fff5ad'
}

  /* function makeRequest (opts) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.onload = function () {
        if ((this.status >= 200 && this.status < 300)||(this.status == 400)) {
          resolve(xhr);
        } else {
          reject({
            status: this.status,
            statusText: xhr.statusText
          });
        }
      };
      xhr.onerror = function () {
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      };
      var params = opts.params;
      // We'll need to stringify if we've been given an object
      // If we have a string, this is skipped.
      if (params && typeof params === 'object') {
        params = Object.keys(params).map(function (key) {
          return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        }).join('&');
      }

      if(opts.method == "POST"){
        xhr.open(opts.method, opts.url);
        if (opts.headers) {
          Object.keys(opts.headers).forEach(function (key) {
            xhr.setRequestHeader(key, opts.headers[key]);
          });
        }
        xhr.send(params);
      }
      else if(opts.method == "GET"){
        if(params!=null&&params.length>0) xhr.open(opts.method, opts.url+"?"+params);
        else xhr.open(opts.method, opts.url);
        if (opts.headers) {
          Object.keys(opts.headers).forEach(function (key) {
            xhr.setRequestHeader(key, opts.headers[key]);
          });
        }
        xhr.send();
      }
      else if(opts.method == "PUT"){
        xhr.open(opts.method, opts.url);
        if (opts.headers) {
          Object.keys(opts.headers).forEach(function (key) {
            xhr.setRequestHeader(key, opts.headers[key]);
          });
        }
        xhr.send(params);
      }
    });
  } */
function makeRequest (opts) {
  return new Promise(function (resolve, reject) {
    chrome.runtime.sendMessage({mes: 'processInBackground', params: opts}, function (response) {
      resolve(response)
    })
  })
}

// ----------------SCRAPING---------------------------------

var Scrap = (function () {
  var insertMindmeisterLink = function (mindmap) {
    var zoomInButton = document.querySelector('div[class^=AnnotationColourPicker]')
    if (zoomInButton == null) return
    var img = document.createElement('img')
    img.src = chrome.extension.getURL('images/icon128Grey.png')
    img.style.marginTop = '4px'
    img.style.height = '40px'
    var a = document.createElement('a')
    a.id = 'DScaffoldingLink'
    a.appendChild(img)
    a.href = 'https://www.mindmeister.com/' + mindmap.id
    a.target = '_blank'
    zoomInButton.after(a)
  }
  var insertReadingPurposes = function (readingPurposesByMap) {
    var colorTool = document.getElementById('colorTool')
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        var cT = document.getElementById('colorTool')
        if (cT.className.indexOf('open') != -1) {
          setTimeout(function () {
            var colorPickerElem = cT.querySelectorAll('.color-picker-option')
            for (var i = 0; i < colorPickerElem.length; i++) {
              colorPickerElem[i].style.overflow = 'visible'
              colorPickerElem[i].style.float = 'none'
              colorPickerElem[i].querySelector('span').style.verticalAlign = 'middle'
              var c = colorPickerElem[i].getAttribute('data-color')
              if (c != null && readingPurposesByMap[0].readingPurposes[c.replace('#', '')] != null) {
                var span = document.createElement('span')
                span.style.marginLeft = '5px'
                var rP = document.createTextNode(readingPurposesByMap[0].readingPurposes[c.replace('#', '')])
                span.appendChild(rP)
                colorPickerElem[i].appendChild(span)
              }
            }
            var cont = cT.querySelector('.color-picker-dropdown')
              // cont.style.width = "auto";
            cont.style.width = '250px'
              // cont.style.overflowY = "visible";
            cont.style.overflowX = 'scroll'
            cont.style.marginTop = '-10px'
            cont.style.paddingBottom = '10px'
          }, 10)
        }
      })
    })
    var config = { attributes: true}
    observer.observe(colorTool, config)

    var colorTool = document.getElementById('viewerContainer')
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        var target = mutation.target
        if (target.className.indexOf('dropdown') != -1 && target.className.indexOf('color-picker') != -1) {
          if (target.className.indexOf('open') != -1) {
            setTimeout(function () {
              var colorPickerElem = target.querySelectorAll('.color-picker-option')
              for (var i = 0; i < colorPickerElem.length; i++) {
                colorPickerElem[i].style.overflow = 'visible'
                colorPickerElem[i].style.float = 'none'
                colorPickerElem[i].querySelector('span').style.verticalAlign = 'middle'
                var c = colorPickerElem[i].getAttribute('data-color')
                if (c != null && readingPurposesByMap[0].readingPurposes[c.replace('#', '')] != null) {
                  var span = document.createElement('span')
                  span.style.marginLeft = '5px'
                  span.style.color = '#2d2d2d'
                  var rP = document.createTextNode(readingPurposesByMap[0].readingPurposes[c.replace('#', '')])
                  span.appendChild(rP)
                  colorPickerElem[i].appendChild(span)
                }
              }
              var cont = target.querySelector('.color-picker-dropdown')
                // cont.style.width = "auto";
              cont.style.width = '250px'
                // cont.style.overflowY = "visible";
              cont.style.overflowX = 'scroll'
              cont.style.marginTop = '-10px'
              cont.style.paddingBottom = '10px'
            }, 10)
          }
        }
      })
    })
    var config = { attributes: true, subtree: true}
    observer.observe(colorTool, config)
  }
  var showAuthorizeMessage = function () {
    var div = document.createElement('div')
    div.id = 'DScaffoldingNotification'
    var messageCont = document.createElement('div')
    messageCont.style.marginTop = '10px'
    messageCont.style.marginLeft = '10px'
    messageCont.style.marginRight = '20px'
    var part1 = document.createTextNode('To use DScaffolding you must first authorize the application. Please, open the ')
    var optionsPageLink = document.createElement('a')
    optionsPageLink.href = chrome.extension.getURL('pages/options.html')
    optionsPageLink.target = '_blank'
    optionsPageLink.appendChild(document.createTextNode('options page'))
    var part2 = document.createTextNode(' to do it')
    messageCont.appendChild(part1)
    messageCont.appendChild(optionsPageLink)
    messageCont.appendChild(part2)
    div.appendChild(messageCont)
    div.style.padding = '10px'
    div.style.maxWidth = '300px'
      // div.style.height = "70px";
    div.style.position = 'fixed'
    div.style.zIndex = '1000'
    div.style.backgroundColor = '#3e30ba'
    div.style.borderRadius = '10px 10px 10px 10px'
    div.style.border = 'solid 1px #606060'
    div.style.top = '100px'
    div.style.left = '50px'
    div.style.color = '#ffffff'
    div.style.fontWeight = 'bold'
    var removeButton = document.createElement('div')
    removeButton.style.opacity = 0.5
    removeButton.style.marginLeft = '5px'
    removeButton.style.top = '5px'
    removeButton.style.right = '5px'
    removeButton.style.position = 'absolute'
    removeButton.style.width = '15px'
    removeButton.style.height = '15px'
    removeButton.style.border = '1px solid #000'
    removeButton.style.borderRadius = '50%'
    removeButton.style.backgroundColor = '#e6e6e6'
    removeButton.style.backgroundPosition = 'center center'
    removeButton.style.backgroundImage = "url('" + chrome.extension.getURL('images/closeIcon.png') + "')"
    removeButton.style.backgroundSize = '5px 5px'
    removeButton.style.backgroundRepeat = 'no-repeat'
    removeButton.addEventListener('mouseover', function () {
      removeButton.style.opacity = '1'
      removeButton.style.cursor = 'pointer'
    })
    removeButton.addEventListener('mouseout', function () {
      removeButton.style.opacity = '0.5'
      removeButton.style.cursor = 'default'
    })
    removeButton.addEventListener('click', function () {
      var not = document.getElementById('DScaffoldingNotification')
      not.parentNode.removeChild(not)
    })
    div.appendChild(removeButton)
    document.body.appendChild(div)
  }
  var showAccessTokenLostMessage = function (adapter) {
    var div = document.createElement('div')
    div.id = 'DScaffoldingNotification'
    var messageCont = document.createElement('div')
    messageCont.style.marginTop = '10px'
    messageCont.style.marginLeft = '10px'
    messageCont.style.marginRight = '20px'
    var part1 = document.createTextNode('Unable to connect to ' + adapter + '. You must re-authorize the application. Please, open the ')
    var optionsPageLink = document.createElement('a')
    optionsPageLink.href = chrome.extension.getURL('pages/options.html')
    optionsPageLink.target = '_blank'
    optionsPageLink.appendChild(document.createTextNode('options page'))
    var part2 = document.createTextNode(' to do it')
    messageCont.appendChild(part1)
    messageCont.appendChild(optionsPageLink)
    messageCont.appendChild(part2)
    div.appendChild(messageCont)
    div.style.padding = '10px'
    div.style.maxWidth = '300px'
      // div.style.height = "70px";
    div.style.position = 'fixed'
    div.style.zIndex = '1000'
    div.style.backgroundColor = '#3e30ba'
    div.style.borderRadius = '10px 10px 10px 10px'
    div.style.border = 'solid 1px #606060'
    div.style.top = '100px'
    div.style.left = '50px'
    div.style.color = '#ffffff'
    div.style.fontWeight = 'bold'
    var removeButton = document.createElement('div')
    removeButton.style.opacity = 0.5
    removeButton.style.marginLeft = '5px'
    removeButton.style.top = '5px'
    removeButton.style.right = '5px'
    removeButton.style.position = 'absolute'
    removeButton.style.width = '15px'
    removeButton.style.height = '15px'
    removeButton.style.border = '1px solid #000'
    removeButton.style.borderRadius = '50%'
    removeButton.style.backgroundColor = '#e6e6e6'
    removeButton.style.backgroundPosition = 'center center'
    removeButton.style.backgroundImage = "url('" + chrome.extension.getURL('images/closeIcon.png') + "')"
    removeButton.style.backgroundSize = '5px 5px'
    removeButton.style.backgroundRepeat = 'no-repeat'
    removeButton.addEventListener('mouseover', function () {
      removeButton.style.opacity = '1'
      removeButton.style.cursor = 'pointer'
    })
    removeButton.addEventListener('mouseout', function () {
      removeButton.style.opacity = '0.5'
      removeButton.style.cursor = 'default'
    })
    removeButton.addEventListener('click', function () {
      var not = document.getElementById('DScaffoldingNotification')
      not.parentNode.removeChild(not)
    })
    div.appendChild(removeButton)
    document.body.appendChild(div)
  }
  return {
    insertMindmeisterLink: insertMindmeisterLink,
    insertReadingPurposes: insertReadingPurposes,
    showAuthorizeMessage: showAuthorizeMessage,
    showAccessTokenLostMessage: showAccessTokenLostMessage
  }
})()

// ----------------MENDELEY---------------------------------

var Mendeley = (function () {
  var accessToken = null
  var setAccessToken = function (token) {
    this.accessToken = token
  }
  var getAccessToken = function () {
    return this.accessToken
  }
  var getFolderName = function (folderId) {
    var that = this
    return new Promise(function (resolve, reject) {
      var opts = {
        method: 'GET',
        url: 'https://api.mendeley.com/folders/' + folderId,
        headers: {
          'Authorization': 'Bearer ' + that.getAccessToken()
        }
      }
      makeRequest(opts).then(function (response) {
        var rsp = JSON.parse(response.responseText)
        if (rsp.name != null) resolve(rsp.name)
        else resolve(null)
      })
    })
  }
  var getDocumentFolders = function (documentId) {
    var that = this
    return new Promise(function (resolve, reject) {
      var opts = {
        method: 'GET',
        url: 'https://api.mendeley.com/documents/' + documentId,
        headers: {
          'Authorization': 'Bearer ' + that.getAccessToken()
        },
        params: {
          view: 'all'
        }
      }
      makeRequest(opts).then(function (response) {
        var doc = JSON.parse(response.responseText)
        var folderList = doc.folder_uuids != null ? doc.folder_uuids : []
        var responseList = []
        for (var i = 0; i < folderList.length; i++) {
          responseList.push(that.getFolderName(folderList[i]))
        }
        if (responseList.length == 0) resolve([])
        else {
          Promise.all(responseList).then(function (folderNameList) {
            resolve(folderNameList)
          })
        }
      })
    })
  }
  return {
    setAccessToken: setAccessToken,
    getAccessToken: getAccessToken,
    getFolderName: getFolderName,
    getDocumentFolders: getDocumentFolders
  }
})()

// ----------------MINDMEISTER------------------------------

var Mindmeister = (function () {
  var accessToken = null
  var setAccessToken = function (token) {
    this.accessToken = token
  }
  var getAccessToken = function () {
    return this.accessToken
  }
  var getMapIdeas = function (mapId) {
    var that = this
    return new Promise(function (resolve, reject) {
      var items = {
        access_token: that.getAccessToken(),
        method: 'mm.maps.getMap',
        map_id: mapId
      }
      var opts = {
        method: 'GET',
        url: 'https://www.mindmeister.com/services/rest/oauth2',
        params: items
      }
      makeRequest(opts).then(function (resp) {
        var ret = JSON.parse(resp.responseText)
        if (ret.rsp.stat != 'ok') resolve([])
        else resolve(ret.rsp.ideas.idea)
      })
    })
  }
  var getReadingPurposesBis = function (map) {
    var that = this
    return new Promise(function (resolve, reject) {
      that.getMapIdeas(map.id).then(function (ideas) {
        var readingPurposeColor = ['dcffb0', 'bae2ff', 'd3c2ff', 'ffc4fb', 'ffb5b6', 'ffdeb4', 'dbdbdb']
        var readingPurposes = []
        for (var i = 0; i < readingPurposeColor.length; i++) {
          var colorIdeas = ideas.filter(function (ideaF) {
            if (ideaF.extendedstyle == null) return null
            return ideaF.extendedstyle.backgroundcolor == this
          }, readingPurposeColor[i])
          for (var j = 0; j < colorIdeas.length; j++) {
            var supportingEvidencesNode = ideas.filter(function (ideaF) {
              if (ideaF.title == 'Supporting Evidences?' && ideaF.parent == this.id) return true
              if (ideaF.title == 'Who else addresses it?' && ideaF.parent == this.id) return true
              if (ideaF.title == 'Justificatory Knowledge?' && ideaF.parent == this.id) return true
              if (/\.\.\.$/.test(ideaF.title)) return true
              return false
            }, colorIdeas[j])
            if (supportingEvidencesNode.length > 0) {
              readingPurposes[readingPurposeColor[i]] = colorIdeas[j].title
              break
            }
          }
        }
        resolve({'mapTitle': map.title, 'readingPurposes': readingPurposes})
      })
    })
  }
  var getReadingPurposes = function (mapId) {
    var that = this
    return new Promise(function (resolve, reject) {
      that.getMapIdeas(mapId).then(function (ideas) {
        var readingPurposeColor = ['dcffb0', 'bae2ff', 'd3c2ff', 'ffc4fb', 'ffb5b6', 'ffdeb4', 'dbdbdb']
        var readingPurposes = []
        for (var i = 0; i < readingPurposeColor.length; i++) {
          var colorIdeas = ideas.filter(function (ideaF) {
            if (ideaF.extendedstyle == null) return null
            return ideaF.extendedstyle.backgroundcolor == this
          }, readingPurposeColor[i])
          for (var j = 0; j < colorIdeas.length; j++) {
            var supportingEvidencesNode = ideas.filter(function (ideaF) {
              if (ideaF.title == 'Supporting Evidences?' && ideaF.parent == this.id) return true
              if (ideaF.title == 'Who else addresses it?' && ideaF.parent == this.id) return true
              if (ideaF.title == 'Justificatory Knowledge?' && ideaF.parent == this.id) return true
              if (/\.\.\.$/.test(ideaF.title)) return true
              return false
            }, colorIdeas[j])
            if (supportingEvidencesNode.length > 0) {
              let colorName = mendeleyColorMapR[readingPurposeColor[i]]
              readingPurposes[colorName] = colorIdeas[j].title
              break
            }
          }
        }
        resolve(readingPurposes)
      })
    })
  }
  var getMapByName = function (mapName, page) {
    return new Promise(function (resolve, reject) {
      var perPage = 100
      var items = {
        access_token: that.getAccessToken(),
        method: 'mm.maps.getList',
        per_page: perPage
      }
      if (page != null) opts.params['page'] = page
      var opts = {
        method: 'GET',
        url: 'https://www.mindmeister.com/services/rest/oauth2',
        params: items
      }
      makeRequest(opts).then(function (resp) {
        var ret = JSON.parse(resp.responseText)
        for (var i = 0; i < ret.rsp.maps.map.length; i++) {
          if (ret.rsp.maps.map[i].title == mapName) {
            resolve(ret.rsp.maps.map[i].id)
            return
          }
        }
        if (ret.rsp.maps.total == perPage) return getMapByName(mapName, ret.rsp.maps.page + 1)
        else resolve(null)
      })
    })
  }
  var getMapByNameRegExp = function (mapName, page) {
    return new Promise(function (resolve, reject) {
      var perPage = 100
      var items = {
        access_token: that.getAccessToken(),
        method: 'mm.maps.getList',
        per_page: perPage
      }
      if (page != null) opts.params['page'] = page
      var opts = {
        method: 'GET',
        url: 'https://www.mindmeister.com/services/rest/oauth2',
        params: items
      }
      makeRequest(opts).then(function (resp) {
        var ret = JSON.parse(resp.responseText)
        for (var i = 0; i < ret.rsp.maps.map.length; i++) {
          if (mapName.test(ret.rsp.maps.map[i].title)) {
            resolve(ret.rsp.maps.map[i].id)
            return
          }
        }
        if (ret.rsp.maps.total == perPage) return getMapByNameRegExp(mapName, ret.rsp.maps.page + 1)
        else resolve(null)
      })
    })
  }
  var getMapList = function () {
    var that = this
    return new Promise(function (resolve, reject) {
      var items = {
        access_token: that.getAccessToken(),
        method: 'mm.maps.getList'
      }
      var opts = {
        method: 'GET',
        url: 'https://www.mindmeister.com/services/rest/oauth2',
        params: items
      }
      makeRequest(opts).then(function (resp) {
        var ret = JSON.parse(resp.responseText)
        if (ret.rsp.stat == 'ok') resolve(ret.rsp.maps.map)
        else resolve([])
      })
    })
  }
  return {
    setAccessToken: setAccessToken,
    getAccessToken: getAccessToken,
    getMapIdeas: getMapIdeas,
    getMapByName: getMapByName,
    getMapByNameRegExp: getMapByNameRegExp,
    getMapList: getMapList,
    getReadingPurposes: getReadingPurposes
  }
})()

class MendeleyReaderManager {
  constructor (documentId, fileId, mindmapList) {
    this._mendeleyEnabled = false
    this._scrap = Scrap
    this._mendeley = Mendeley
    this._mindmeister = Mindmeister
    this._onLoadObserver = null
    this._documentId = documentId
    this._fileId = fileId
    this._currentMapId = null
    this._currentReadingPurposes = null
    this._readingPurposeObserver3 = null
    this._readingPurposeObserver2 = null
    this._readingPurposeObserver = null
    this._mindmapList = mindmapList
  }
  destroy () {
    if (this._onLoadObserver != null) this._onLoadObserver.disconnect()
    if (this._readingPurposeObserver3 != null) this._readingPurposeObserver3.disconnect()
    if (this._readingPurposeObserver2 != null) this._readingPurposeObserver2.disconnect()
    if (this._readingPurposeObserver != null) this._readingPurposeObserver.disconnect()
  }
  insertReadingPurposesBis (mapList) {
    let that = this
    var promiseList = []
    for (var i = 0; i < mapList.length; i++) {
      promiseList.push(that._mindmeister.getReadingPurposes(mapList[i]))
    }
    Promise.all(promiseList).then(function (readingPurposesByMap) {
      that._scrap.insertReadingPurposes(readingPurposesByMap)
    })
  }
  selectReadingPurposes (mapId) {
    let that = this
    that._mindmeister.getReadingPurposes(mapId).then((purposes) => {
      that._currentReadingPurposes = purposes

      let colorPicker = document.querySelector('button[class*=AnnotationColourPickerButton]')
      let color = colorPicker.getAttribute('data-reader-active-colour')
      let cpText = Array.from(colorPicker.childNodes).find((n) => { return n.nodeType === 3 })
      if (cpText == null) return
      if (color == null) cpText.parentNode.replaceChild(document.createTextNode(color), cpText)
      if (this._currentReadingPurposes[color] != null) {
        cpText.parentNode.replaceChild(document.createTextNode(this._currentReadingPurposes[color]), cpText)
      } else cpText.parentNode.replaceChild(document.createTextNode(''), cpText)
    })
  }
  insertReadingPurposes () {
    let that = this

    let obs1 = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        let cpButton = document.querySelector('button[class*=AnnotationColourPickerButton]')
        if (cpButton == null) return
        if (mutation.attributeName === 'aria-pressed' && mutation.oldValue === 'false' && cpButton.getAttribute('aria-pressed') === 'true') {
          let colorPickerElem = document.querySelectorAll('div[class^=AnnotationColourPicker] button[class^=AnnotationColourPickerItem]')
          colorPickerElem.forEach((cp) => {
            let span = cp.querySelector('span[class^=AnnotationColourPickerItem]')
            if (span == null) return
            let color = cp.getAttribute('aria-label')
            if (color == null) return
            if (that._currentReadingPurposes == null || that._currentReadingPurposes == []) span.textContent = ''
            else if (color != null && that._currentReadingPurposes[color] != null) {
              span.textContent = that._currentReadingPurposes[color]
            } else {
              span.textContent = ''
            }
          })
        }
      })
    })
    let cfg1 = {attributes: true, attributeOldValue: true}
    let colorPickerButton = document.querySelector('button[class*=AnnotationColourPickerButton]')
    if (colorPickerButton != null) {
      obs1.observe(colorPickerButton, cfg1)
      that._readingPurposeObserver2 = obs1
    }

    let obs2 = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName !== 'aria-selected') return
        let selectedItem = document.querySelector('div[class*=DropdownElements] button[class*=AnnotationColourPickerItem][aria-selected=true] span[class*=AnnotationColourPickerItem]')
        if (selectedItem == null) return
        let colorPickerButton = document.querySelector('button[class*=AnnotationColourPickerButton]')
        if (colorPickerButton == null) return
        let cpText = Array.from(colorPickerButton.childNodes).find((n) => { return n.nodeType === 3 })
        if (cpText == null) return
        if (selectedItem.textContent !== colorPickerButton.textContent) {
          cpText.parentNode.replaceChild(document.createTextNode(selectedItem.textContent), cpText)
          // colorPickerButton.textContent = selectedItem.textContent
        }
      })
    })
    let cfg2 = {attributes: true, subtree: true}
    let targetEl = document.querySelector('div[class*=AnnotationColourPicker] div[role=menu]')
    if (targetEl != null) {
      obs2.observe(targetEl, cfg2)
      that._readingPurposeObserver3 = obs2
    }

    let obs = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        let colorPicker = document.querySelector('div[class*=ListAnnotationColours]')
        if (colorPicker != null) {
          if (colorPicker.classList.contains('initializedFramendeleyColorCoding')) return
          colorPicker.classList.add('initializedFramendeleyColorCoding')

          let colorPickerElem = document.querySelectorAll('div[class*=ListItem]')
          colorPickerElem.forEach((cp) => {
            let span = document.createElement('span')
            let color = cp.title
            if (color == null) return
            if (color != null && that._currentReadingPurposes[color] != null) {
              span.textContent = that._currentReadingPurposes[color]
            } else {
              span.textContent = ''
            }
            cp.appendChild(span)
          })
        }
      })
    })
    let cfg = {childList: true, subtree: true}
    obs.observe(document.body, cfg)
    that._readingPurposeObserver = obs
  }
  insertMapSelector (mindmaps) {
    let that = this
    // let folders = that.getFolderList()
    // if (folders.length < 2) return
    if (mindmaps == null || mindmaps.length < 2) return
    var canvasButton = document.getElementById('DScaffoldingLink')
    let select = document.createElement('select')
    select.id = 'DScaffoldingFolderSelection'
    mindmaps.forEach((map) => {
      let option = document.createElement('option')
      option.innerText = map.title
      option.value = map.id
      select.appendChild(option)
    })
    select.addEventListener('change', (e) => {
      let selected = e.target.value
      if (selected != that._currentMapId) {
        that._currentMapId = selected
        that._currentReadingPurposes = null
        that.selectReadingPurposes(selected)
        let dscaffoldingLink = document.querySelector('#DScaffoldingLink')
        if(dscaffoldingLink != null) dscaffoldingLink.href = 'https://www.mindmeister.com/'+selected
        // that._mindmeister.getReadingPurposes(selected).then((readingPurposes) => {
        //  console.log("done")
        //  that._currentReadingPurposes = readingPurposes
        // })
      }
    })
    canvasButton.after(select)
  }
  onLoad () {
    let that = this
    return new Promise((resolve, reject) => {
      if (document.querySelector('div[class^=AnnotationColourPicker]') != null) {
        resolve()
        return
      }
      let obs = new MutationObserver((mutations) => {
        let colorPicker = document.querySelector('div[class^=AnnotationColourPicker]')
        if (colorPicker != null) {
          obs.disconnect()
          resolve()
        }
      })
      let cfg = {childList: true, subtree: true}
      obs.observe(document.body, cfg)
      that._onLoadObserver = obs
    })
  }
  init () {
    let that = this
    this.onLoad().then(() => {
      this.auth().then(() => {
        var mendeleyDocumentId = that._documentId
        that._mendeley.getDocumentFolders(mendeleyDocumentId).then(function (folders) {
          // that._mindmeister.getMapList().then(function(mindmaps){
          var mindmapTitles = that._mindmapList.map(function (map) {
            return map.title
          })
          var mapList = []
          for (var i = 0; i < folders.length; i++) {
            var ind
            ind = mindmapTitles.indexOf('Explicate Problem for ' + folders[i])
            if (ind != -1) {
              mapList.push(that._mindmapList[ind])
            }
            ind = mindmapTitles.indexOf(folders[i])
            if (ind != -1) {
              mapList.push(that._mindmapList[ind])
            }
          }
          if (mapList.length > 0) {
            that._scrap.insertMindmeisterLink(mapList[0])
            if (mapList.length > 1) {
              that.insertMapSelector(mapList)
            }
            that.selectReadingPurposes(mapList[0].id)
            that.insertReadingPurposes()
            that._currentMapId = mapList[0].id
              // that._scrap.insertMindmeisterLink(mapList);
              // that.insertReadingPurposes(mapList);
          }
          // })
        })
      })
    })
  }
  auth () {
    let that = this
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(['MENDELEY_ENABLED'], function (options) {
        that._mendeleyEnabled = options['MENDELEY_ENABLED'] != null ? options['MENDELEY_ENABLED'] : false
        if (!that._mendeleyEnabled) {
          reject()
          return
        }
        chrome.runtime.sendMessage({mes: 'isAuthorizedMindmeister'})
        chrome.runtime.sendMessage({mes: 'isAuthorizedMendeley'})
      })

      chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.mesType == 'accessTokenLost') {
          if (request.adapter == 'mendeley') {
            that._mendeleyEnabled = false
            that._scrap.showAccessTokenLostMessage('Mendeley')
          }
          if (request.adapter == 'mindmeister') {
            showAuthorizeMessage()
            that._scrap.showAccessTokenLostMessage('MindMeister')
          }
        }
        if (request.mesType == 'accessToken') {
          if (request.adapter == 'mindmeister') {
            that._mindmeister.setAccessToken(request.accessToken)
            if (that._mendeley.getAccessToken() != null) {
              resolve()
            }
          } else if (request.adapter == 'mendeley') {
            that._mendeley.setAccessToken(request.accessToken)
            if (that._mindmeister.getAccessToken() != null) {
              resolve()
            }
          }
        } else if (request.mesType == 'isAuthorized') {
          if (request.adapter == 'mindmeister') {
            if (request.accessToken) chrome.runtime.sendMessage({mes: 'getMindmeisterAccessToken'})
            else that._scrap.showAuthorizeMessage()
          } else if (request.adapter == 'mendeley') {
            if (request.accessToken) chrome.runtime.sendMessage({mes: 'getMendeleyAccessToken'})
            else that._scrap.showAuthorizeMessage()
          }
        }
      })
    })
  }
}

module.exports = MendeleyReaderManager
