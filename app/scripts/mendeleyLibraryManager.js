
function makeRequest (opts) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({mes:"processInBackground",params:opts},function(response){
        resolve(response)
      })
    });
  }

var Scrap = (function (){
  var insertMindmapLink = function(map){
    this.removeMindmapLink();
    var toolbar = document.querySelector('div[class^=BreadcrumbContainer] nav[class^=Breadcrumb]');
    if (toolbar == null) return
    var img = document.createElement("img");
    img.src = chrome.extension.getURL("images/icon128Grey.png");
    img.style.width = "32px";
    var a = document.createElement("a");
    a.id = "dscaffolding_link";
    a.appendChild(img);
    a.href="https://www.mindmeister.com/"+map.id;
    a.target="_blank";
    img.style.marginLeft = "8px";
    img.style.marginTop = "8px";
    toolbar.after(a);
  }
  var removeMindmapLink = function(){
    var dsL = document.getElementById("dscaffolding_link");
    if(dsL!=null) dsL.parentNode.removeChild(dsL);
  }
  var getCurrentFolder = function(){
    let breadcrumb = document.querySelector('div[class^=BreadcrumbContainer] > nav > span[class^=Breadcrumb]:last-of-type')
    if (breadcrumb == null) return null
    return breadcrumb.textContent
  }
  var showAuthorizeMessage = function(){
    var div = document.createElement("div");
    div.id = "DScaffoldingNotification";
    var messageCont = document.createElement("div");
    messageCont.style.marginTop = "10px";
    messageCont.style.marginLeft = "10px";
    messageCont.style.marginRight = "20px";
    var part1 = document.createTextNode("To use DScaffolding you must first authorize the application. Please, open the ");
    var optionsPageLink = document.createElement("a");
    optionsPageLink.href = chrome.extension.getURL("pages/options.html");
    optionsPageLink.target = "_blank";
    optionsPageLink.appendChild(document.createTextNode("options page"));
    var part2 = document.createTextNode(" to do it");
    messageCont.appendChild(part1);
    messageCont.appendChild(optionsPageLink);
    messageCont.appendChild(part2);
    div.appendChild(messageCont);
    div.style.padding = "10px";
    div.style.maxWidth = "300px";
    //div.style.height = "70px";
    div.style.position = "fixed";
    div.style.zIndex = "1000";
    div.style.backgroundColor = "#3e30ba";
    div.style.borderRadius = "10px 10px 10px 10px";
    div.style.border = "solid 1px #606060";
    div.style.top = "100px";
    div.style.left = "50px";
    div.style.color = "#ffffff";
    div.style.fontWeight = "bold";
    var removeButton = document.createElement("div");
    removeButton.style.opacity = 0.5;
    removeButton.style.marginLeft = "5px";
    removeButton.style.top = "5px";
    removeButton.style.right = "5px";
    removeButton.style.position = "absolute";
    removeButton.style.width = "15px";
    removeButton.style.height = "15px";
    removeButton.style.border = "1px solid #000";
    removeButton.style.borderRadius = "50%";
    removeButton.style.backgroundColor = "#e6e6e6";
    removeButton.style.backgroundPosition = "center center";
    removeButton.style.backgroundImage = "url('"+chrome.extension.getURL("images/closeIcon.png")+"')";
    removeButton.style.backgroundSize = "5px 5px";
    removeButton.style.backgroundRepeat = "no-repeat";
    removeButton.addEventListener("mouseover",function(){
      removeButton.style.opacity = "1";
      removeButton.style.cursor = "pointer";
    })
    removeButton.addEventListener("mouseout",function(){
      removeButton.style.opacity = "0.5";
      removeButton.style.cursor = "default";
    })
    removeButton.addEventListener("click",function(){
      var not = document.getElementById("DScaffoldingNotification");
      not.parentNode.removeChild(not);
    })
    div.appendChild(removeButton);
    document.body.appendChild(div);
  }
  var showAccessTokenLostMessage = function(adapter){
    var div = document.createElement("div");
    div.id = "DScaffoldingNotification";
    var messageCont = document.createElement("div");
    messageCont.style.marginTop = "10px";
    messageCont.style.marginLeft = "10px";
    messageCont.style.marginRight = "20px";
    var part1 = document.createTextNode("Unable to connect to "+adapter+". You must re-authorize the application. Please, open the ");
    var optionsPageLink = document.createElement("a");
    optionsPageLink.href = chrome.extension.getURL("pages/options.html");
    optionsPageLink.target = "_blank";
    optionsPageLink.appendChild(document.createTextNode("options page"));
    var part2 = document.createTextNode(" to do it");
    messageCont.appendChild(part1);
    messageCont.appendChild(optionsPageLink);
    messageCont.appendChild(part2);
    div.appendChild(messageCont);
    div.style.padding = "10px";
    div.style.maxWidth = "300px";
    //div.style.height = "70px";
    div.style.position = "fixed";
    div.style.zIndex = "1000";
    div.style.backgroundColor = "#3e30ba";
    div.style.borderRadius = "10px 10px 10px 10px";
    div.style.border = "solid 1px #606060";
    div.style.top = "100px";
    div.style.left = "50px";
    div.style.color = "#ffffff";
    div.style.fontWeight = "bold";
    var removeButton = document.createElement("div");
    removeButton.style.opacity = 0.5;
    removeButton.style.marginLeft = "5px";
    removeButton.style.top = "5px";
    removeButton.style.right = "5px";
    removeButton.style.position = "absolute";
    removeButton.style.width = "15px";
    removeButton.style.height = "15px";
    removeButton.style.border = "1px solid #000";
    removeButton.style.borderRadius = "50%";
    removeButton.style.backgroundColor = "#e6e6e6";
    removeButton.style.backgroundPosition = "center center";
    removeButton.style.backgroundImage = "url('"+chrome.extension.getURL("images/closeIcon.png")+"')";
    removeButton.style.backgroundSize = "5px 5px";
    removeButton.style.backgroundRepeat = "no-repeat";
    removeButton.addEventListener("mouseover",function(){
      removeButton.style.opacity = "1";
      removeButton.style.cursor = "pointer";
    })
    removeButton.addEventListener("mouseout",function(){
      removeButton.style.opacity = "0.5";
      removeButton.style.cursor = "default";
    })
    removeButton.addEventListener("click",function(){
      var not = document.getElementById("DScaffoldingNotification");
      not.parentNode.removeChild(not);
    })
    div.appendChild(removeButton);
    document.body.appendChild(div);
  }
  return {
    removeMindmapLink: removeMindmapLink,
    insertMindmapLink: insertMindmapLink,
    getCurrentFolder: getCurrentFolder,
    showAuthorizeMessage: showAuthorizeMessage,
    showAccessTokenLostMessage: showAccessTokenLostMessage
  }
})();

// ----------------MINDMEISTER------------------------------

var Mindmeister = (function (){
  var accessToken = null;
  var setAccessToken = function(token){
    this.accessToken = token;
  }
  var getAccessToken = function(){
    return this.accessToken;
  }
  var getMapList = function(){
    var that = this;
    return new Promise(function(resolve,reject){
      var items = {
        access_token: that.getAccessToken(),
        method: "mm.maps.getList"
      }
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        var ret = JSON.parse(resp.responseText);
        if(ret.rsp.stat=="ok") resolve(ret.rsp.maps.map);
        else resolve([]);
      });
    })
  }
  return {
    setAccessToken: setAccessToken,
    getAccessToken: getAccessToken,
    getMapList: getMapList
  }
})()

var Mendeley = (function (){
  var accessToken = null;
  var setAccessToken = function(token){
    this.accessToken = token;
  }
  var getAccessToken = function(){
    return this.accessToken;
  }
  return {
    setAccessToken: setAccessToken,
    getAccessToken: getAccessToken,
  }
})();

class MendeleyLibraryManager {
  constructor (mindmapList) {
    this._mendeleyEnabled = false
    this._mindmeister = Mindmeister
    this._mendeley = Mendeley
    this._scrap = Scrap
    this._onLoadBarObserver = null
    this._mindmapList = mindmapList
  }
  destroy () {
    this._scrap.removeMindmapLink()
    if (this._onLoadBarObserver != null) this._onLoadBarObserver.disconnect()
  }
  onLoad () {
    let that = this
    return new Promise((resolve, reject) => {
      if(document.querySelector('div[class^=BreadcrumbContainer] nav[class^=Breadcrumb]') != null){
        resolve()
        return
      }
      let obs = new MutationObserver((mutations) => {
        let insertionPoint = document.querySelector('div[class^=BreadcrumbContainer] nav[class^=Breadcrumb]')
        if (insertionPoint != null) {
          obs.disconnect()
          resolve()
        }
      })
      let cfg = {childList: true, subtree: true}
      obs.observe(document.body, cfg)
      that._onLoadBarObserver = obs
    })
  }
  init () {
    let that = this
    this.onLoad().then(() => {
      this.auth().then(() => {
        //that._mindmeister.getMapList().then(function(mindmaps){
          let currentFolder = that._scrap.getCurrentFolder()
          let map = that._mindmapList.find((m) => { return m.title === currentFolder || m.title === 'Explicate Problem for ' + currentFolder })
          if (map == null) return
          that._scrap.insertMindmapLink(map)
        //})
      })
    })
  }
  auth () {
    let that = this
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(["MENDELEY_ENABLED"], function(options){
        that._mendeleyEnabled = options["MENDELEY_ENABLED"] != null ? options["MENDELEY_ENABLED"] : false;
        if(!that._mendeleyEnabled){
          reject()
          return
        }
        chrome.runtime.sendMessage({mes: "isAuthorizedMindmeister"});
        chrome.runtime.sendMessage({mes: "isAuthorizedMendeley"});
      })

      chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
        if(request.mesType == "accessTokenLost"){
          if(request.adapter=="mendeley"){
            that._mendeleyEnabled = false;
            that._scrap.showAccessTokenLostMessage("Mendeley");
          }
          if(request.adapter=="mindmeister"){
            showAuthorizeMessage();
            that._scrap.showAccessTokenLostMessage("MindMeister");
          }
        }
        if(request.mesType == "accessToken"){
          if(request.adapter == "mindmeister"){
            that._mindmeister.setAccessToken(request.accessToken);
            if(that._mendeley.getAccessToken()!=null){
              resolve();
            }
          }
          else if(request.adapter == "mendeley"){
            that._mendeley.setAccessToken(request.accessToken);
            if(that._mindmeister.getAccessToken()!=null){
              resolve();
            }
          }
        }
        else if(request.mesType == "isAuthorized"){
          if(request.adapter == "mindmeister"){
            if(request.accessToken) chrome.runtime.sendMessage({mes: "getMindmeisterAccessToken"});
            else that._scrap.showAuthorizeMessage();
          }
          else if(request.adapter == "mendeley"){
            if(request.accessToken) chrome.runtime.sendMessage({mes: "getMendeleyAccessToken"});
            else that._scrap.showAuthorizeMessage();
          }
        }
      })
    })
  }
}
module.exports = MendeleyLibraryManager
