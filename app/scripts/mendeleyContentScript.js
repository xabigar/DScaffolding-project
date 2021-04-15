
const MendeleyLibraryManager = require('./mendeleyLibraryManager.js')
const MendeleyReaderManager = require('./mendeleyReaderManager.js')

function makeRequest (opts) {
  return new Promise(function (resolve, reject) {
    chrome.runtime.sendMessage({mes: 'processInBackground', params: opts}, function (response) {
      resolve(response)
    })
  })
}

var Mendeley = (function () {
  var accessToken = null
  var setAccessToken = function (token) {
    this.accessToken = token
  }
  var getAccessToken = function () {
    return this.accessToken
  }
  return {
    setAccessToken: setAccessToken,
    getAccessToken: getAccessToken
  }
})()
var Mindmeister = (function () {
  var accessToken = null
  var setAccessToken = function (token) {
    this.accessToken = token
  }
  var getAccessToken = function () {
    return this.accessToken
  }
  var getMapList = function (page, perPage) {
    var that = this
    return new Promise(function (resolve, reject) {
      var items = {
        access_token: that.getAccessToken(),
        method: 'mm.maps.getList'
      }
      if (page != null) items['page'] = page
      if (perPage != null) items['per_page'] = perPage
      var opts = {
        method: 'GET',
        url: 'https://www.mindmeister.com/services/rest/oauth2',
        params: items
      }
      makeRequest(opts).then(function (resp) {
        var ret = JSON.parse(resp.responseText)
        if (ret.rsp.stat == 'ok') {
          if (ret.rsp.maps.page != null && ret.rsp.maps.pages != null) {
            let currentPage = parseInt(ret.rsp.maps.page)
            let pages = parseInt(ret.rsp.maps.pages)
            let perPageRet = parseInt(ret.rsp.maps.perpage)
            if (!isNaN(currentPage) && !isNaN(pages) && !isNaN(perPageRet) && currentPage < pages) {
              let maps = ret.rsp.maps.map
              that.getMapList(currentPage + 1, perPageRet).then((nextPageMaps) => {
                resolve(maps.concat(nextPageMaps))
              })
            }
            else resolve (ret.rsp.maps.map)
          } else resolve(ret.rsp.maps.map)
        } else resolve([])
      })
    })
  }
  return {
    setAccessToken: setAccessToken,
    getAccessToken: getAccessToken,
    getMapList: getMapList
  }
})()
var Scrap = (function () {
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
    showAuthorizeMessage: showAuthorizeMessage,
    showAccessTokenLostMessage: showAccessTokenLostMessage
  }
})()

class MendeleyContentScript {
  constructor () {
    this._mendeleyLibraryManager = null
    this._mendeleyReaderManager = null
    this._currentURL = null
    this._mendeley = Mendeley
    this._mindmeister = Mindmeister
    this._mindmapList = null
    this._scrap = Scrap
  }
  destroyCurrentModeManager () {
    if (this._mendeleyLibraryManager != null) {
      this._mendeleyLibraryManager.destroy()
      this._mendeleyLibraryManager = null
    }
    if (this._mendeleyReaderManager != null) {
      this._mendeleyReaderManager.destroy()
      this._mendeleyReaderManager = null
    }
  }
  modeManager (newUrl) {
    let oldURL = this._currentURL
    let newUrl2 = newUrl.split('#')[0]
    if (newUrl2.charAt(newUrl2.length - 1) == '/') newUrl2 = newUrl2.substring(0, newUrl2.length - 1)
    if (oldURL == newUrl2) return

    this.destroyCurrentModeManager()

    let libraryFolderRegexp = /https?:\/\/(www\.)?mendeley\.com\/reference-manager\/library\/collections\/(.+)\/all-references\/?/
    let documentReaderRegexp = /https?:\/\/(www\.)?mendeley\.com\/reference-manager\/reader\/(.+)\/(.+)\/?/
    if (libraryFolderRegexp.test(newUrl)) {
      let m = newUrl.match(libraryFolderRegexp)
      if (m.length < 3) return
      let folderId = m[2]
      this._mendeleyLibraryManager = new MendeleyLibraryManager(this._mindmapList)
      this._mendeleyLibraryManager.init()
    } else if (documentReaderRegexp.test(newUrl)) {
      let m = newUrl.match(documentReaderRegexp)
      if (m.length < 4) return
      let documentId = m[2]
      let fileId = m[3]
      this._mendeleyReaderManager = new MendeleyReaderManager(documentId, fileId, this._mindmapList)
      this._mendeleyReaderManager.init()
      // this._libraryManager = new LibraryModelManager(null,folderId)
    }
    this._currentURL = newUrl
  }
  manageUrlChange () {
    let that = this
    let initialUrl = document.location.href.split('#')[0]
    if (initialUrl.charAt(initialUrl.length - 1) == '/') initialUrl = initialUrl.substring(0, initialUrl.length - 1)
    that.modeManager(initialUrl)
    chrome.runtime.onMessage.addListener((message) => {
      if (message == null) return
      if (message.scope !== 'mendeleyURLChange') return
      that.modeManager(message.newURL)
    })
  }
  init () {
    let that = this
    this.auth().then(() => {
      that._mindmeister.getMapList().then((mindmaps) => {
        that._mindmapList = mindmaps
        that.manageUrlChange()
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

let mendeleyContentScript = new MendeleyContentScript()
mendeleyContentScript.init()
