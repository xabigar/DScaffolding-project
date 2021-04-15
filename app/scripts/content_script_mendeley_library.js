(function(){

// ----------------AUXILIAR VARIABLES----------------------

var SYNC_MODE;
var MENDELEY_ENABLED;

/*function makeRequest (opts) {
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
}*/

  function makeRequest (opts) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({mes:"processInBackground",params:opts},function(response){
        resolve(response)
      })
    });
  }

// ----------------SCRAPING---------------------------------

var Scrap = (function (){
  var currentFolder;
  var getDocumentId = function(){
    var url = window.location.href;
    var m = url.match(/documentId=[^\0&#]+/g);
    if(m==null) return null;
    return m[0].replace("documentId=","");
  }
  var insertMindmapLink = function(map){
    this.removeMindmapLink();
    var toolbar = document.getElementById("selection-toolbar");
    var img = document.createElement("img");
    img.src = chrome.extension.getURL("images/icon128Grey.png");
    img.style.width = "16px";
    var a = document.createElement("a");
    a.id = "dscaffolding_link";
    a.appendChild(img);
    a.href="https://www.mindmeister.com/"+map.id;
    a.target="_blank";
    img.style.marginLeft = "8px";
    img.style.marginTop = "8px";
    toolbar.appendChild(a);
  }
  var removeMindmapLink = function(){
    var dsL = document.getElementById("dscaffolding_link");
    if(dsL!=null) dsL.parentNode.removeChild(dsL);
  }
  var insertLinkToMap = function(mapList){
    var that = this;
    var mindmapTitles = mapList.map(function(map){
      return map.title;
    });
    var colorTool = document.getElementById("folders");
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        var cF = document.querySelector(".folder.selected a");
        var folderName;
        if(cF != null && (folderName = cF.getAttribute("title"))!=null && folderName!=that.currentFolder){
          that.currentFolder = folderName;
          var ind;
          ind = mindmapTitles.indexOf("Explicate Problem for "+folderName);
          if(ind != -1){
            that.insertMindmapLink(mapList[ind]);
            return;
          }
          ind = mindmapTitles.indexOf(folderName);
          if(ind != -1){
            that.insertMindmapLink(mapList[ind]);
            return;
          }
          that.removeMindmapLink();
        }
      });
    });
    var config = { attributes: true, subtree: true};
    observer.observe(colorTool, config);
  }
  return {
    getDocumentId: getDocumentId,
    insertLinkToMap: insertLinkToMap,
    removeMindmapLink: removeMindmapLink,
    insertMindmapLink: insertMindmapLink
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
})();

function init(){
  var mendeleyDocumentId = Scrap.getDocumentId();
  Mindmeister.getMapList().then(function(mindmaps){
    Scrap.insertLinkToMap(mindmaps);
  })
}

function auth(){

  chrome.storage.sync.get(["MENDELEY_ENABLED","SYNC_MODE"], function(options){
    MENDELEY_ENABLED = options["MENDELEY_ENABLED"] != null ? options["MENDELEY_ENABLED"] : false;
    SYNC_MODE = options["SYNC_MODE"] != null ? options["SYNC_MODE"] : null;
    if(!MENDELEY_ENABLED) return;
    chrome.runtime.sendMessage({mes: "isAuthorizedMindmeister"});
    chrome.runtime.sendMessage({mes: "isAuthorizedMendeley"});
  })

  chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
    if(request.mesType == "accessTokenLost"){
      if(request.adapter=="mendeley"){
        MENDELEY_ENABLED = false;
        Scrap.showAccessTokenLostMessage("Mendeley");
      }
      if(request.adapter=="mindmeister"){
        showAuthorizeMessage();
        Scrap.showAccessTokenLostMessage("MindMeister");
      }
    }
    if(request.mesType == "accessToken"){
      if(request.adapter == "mindmeister"){
        Mindmeister.setAccessToken(request.accessToken);
        if(Mendeley.getAccessToken()!=null){
          init();
        }
      }
      else if(request.adapter == "mendeley"){
        Mendeley.setAccessToken(request.accessToken);
        if(Mindmeister.getAccessToken()!=null){
          init();
        }
      }
    }
    else if(request.mesType == "isAuthorized"){
      if(request.adapter == "mindmeister"){
        if(request.accessToken) chrome.runtime.sendMessage({mes: "getMindmeisterAccessToken"});
        else Scrap.showAuthorizeMessage();
      }
      else if(request.adapter == "mendeley"){
        if(request.accessToken) chrome.runtime.sendMessage({mes: "getMendeleyAccessToken"});
        else Scrap.showAuthorizeMessage();
      }
    }
  })
}

auth();

})();
