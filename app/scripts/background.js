const OAuth2 = require("./oauth2");
const Modes = require('./background/Modes');
const ModesManager = require("./background/ModesManager");
const Credentials = require('./Credentials')

var PAIREDCOMPARISONS_TAB_ID;
var PAIREDCOMPARISONS_REQUEST_TAB_ID;

chrome.webRequest.onHeadersReceived.addListener(function (details){
    var regExp = /set\-cookie/i;
    for(var i=details.responseHeaders.length-1;i>=0;i--){
      if(details.responseHeaders[i].name!=null&&regExp.test(details.responseHeaders[i].name)){
        details.responseHeaders.splice(i,1);
      }
    }
    return {responseHeaders: details.responseHeaders};
  },{urls: [   "https://www.mindmeister.com/services/rest/oauth2*" ] },
  ["blocking","responseHeaders"]
);

chrome.webRequest.onHeadersReceived.addListener(function (details){
    var regExp = /content\-security\-policy/i;
    for(var i=details.responseHeaders.length-1;i>=0;i--){
      if(details.responseHeaders[i].name!=null&&regExp.test(details.responseHeaders[i].name)&&details.responseHeaders[i].value.indexOf("worker-src")==-1){
        details.responseHeaders[i].value = "worker-src * blob:;" + details.responseHeaders[i].value;
      }
    }
    return {responseHeaders: details.responseHeaders};
  },{urls: [   "https://www.mindmeister.com/*" ] },
  ["blocking","responseHeaders"]
);

chrome.webRequest.onCompleted.addListener(function (details){
    var regExp = /set\-cookie/i;
    for(var i=details.responseHeaders.length-1;i>=0;i--){
      if(details.responseHeaders[i].name!=null&&regExp.test(details.responseHeaders[i].name)){
        details.responseHeaders.splice(i,1);
      }
    }
    return {responseHeaders: details.responseHeaders};
  },{urls: [   "https://docs.google.com/forms/d/e/1FAIpQLSe2xoIEDZ1R-RvA7AfCL53I9OE6d8luN7bEOHaldv7xETn8Ow/formResponse*" ] },
  ["responseHeaders"]
);

/*chrome.webRequest.onBeforeSendHeaders.addListener(function (details){
    var regExp = /^cookie$/i;
    for(var i=details.requestHeaders.length-1;i>=0;i--){
      if(details.requestHeaders[i].name!=null&&regExp.test(details.requestHeaders[i].name)){
        details.requestHeaders.splice(i,1);
      }
    }
    return {requestHeaders: details.requestHeaders};
  },{urls: [   "https://www.mindmeister.com/services/rest/oauth2*" ] },
  ["blocking","requestHeaders"]
);*/

function makeRequest (opts) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.withCredentials = false;
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
      // TO DO: REMOVE
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
    else if(opts.method == "DELETE"){
      xhr.open(opts.method, opts.url);
      if (opts.headers) {
        Object.keys(opts.headers).forEach(function (key) {
          xhr.setRequestHeader(key, opts.headers[key]);
        });
      }
      xhr.send(null);
    }
    else if(opts.method == "PATCH"){
      xhr.open(opts.method, opts.url);
      if (opts.headers) {
        Object.keys(opts.headers).forEach(function (key) {
          xhr.setRequestHeader(key, opts.headers[key]);
        });
      }
      xhr.send(params);
    }
  });
}
function getAttribute(currentValue,index,arr){
  var attribute = this;
  return currentValue[attribute];
}

function makeRequest2 (opts) {
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
    else if(opts.method == "PATCH"){
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
    else if(opts.method == "DELETE"){
      xhr.open(opts.method, opts.url);
      if (opts.headers) {
        Object.keys(opts.headers).forEach(function (key) {
          xhr.setRequestHeader(key, opts.headers[key]);
        });
      }
      xhr.send(null);
    }
  });
}

chrome.runtime.onMessage.addListener(function(message,sender,sendResponse){
  if(message.mes=="parsePdfFile"){
    let xhttp = new XMLHttpRequest()
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        let uInt8Array = new Uint8Array(this.response)
        var i = uInt8Array.length;
        var binaryString = new Array(i);
        while (i--)
        {
          binaryString[i] = String.fromCharCode(uInt8Array[i]);
        }
        var data = binaryString.join('');
        var base64 = window.btoa(data);
        let d = {
          data: base64
        }
        sendResponse(d)
      }
    };
    xhttp.open("GET","https://api.mendeley.com/files/"+message.fileId+"?access_token="+message.accessToken, true);
    xhttp.responseType = "arraybuffer"
    xhttp.send();
    return true
  }
  if(message.mes=="processInBackground"){
    makeRequest2(message.params).then(function(response){
      sendResponse({"response":response.response,"responseText":response.responseText})
    })
    return true
  }
  if(message.mes=="openTab"){
    chrome.tabs.create({ url: message.tabURL });
  }
  if(message.mes=="mendeleyImage"){
    chrome.tabs.create({ url: message.imageURL });
  }
  if(message.mes=="getVersion"){
    chrome.tabs.sendMessage(sender.tab.id,{mesType: "extensionVersion", version: chrome.app.getDetails().version});
  }
  if(message.mes=="getMindmeisterAccessToken"){
    var mindmeisterAuth = new OAuth2("mindmeister", {
      client_id: Credentials.mindmeister.client_id,
      client_secret: Credentials.mindmeister.client_secret,
      api_scope: "mindmeister"
    });
    mindmeisterAuth.authorize(function(){
      var authToken = mindmeisterAuth.getAccessToken();
      chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "mindmeister", accessToken: authToken});
    },function(){
      mindmeisterAuth.clear();
      chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessTokenLost", adapter: "mindmeister"});
    });
  }
  else if(message.mes=="getMendeleyAccessToken"){
    var mendeleyAuth = new OAuth2("mendeley", {
      client_id: Credentials.mendeley.client_id,
      client_secret: Credentials.mendeley.client_secret,
      api_scope: "all"
    });
    mendeleyAuth.authorize(function(){
      var authToken = mendeleyAuth.getAccessToken();
      chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "mendeley", accessToken: authToken});
    },function(){
      chrome.storage.sync.set({
        "MENDELEY_ENABLED":false
      },function(){
        mendeleyAuth.clear();
        chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessTokenLost", adapter: "mendeley"});
      })
    });
  }
  else if(message.mes=="getGithubAccessToken"){
    var githubAuth = new OAuth2("github", {
      client_id: Credentials.github.client_id,
      client_secret: Credentials.github.client_secret,
      api_scope: "repo"
    });
    githubAuth.authorize(function(){
      var authToken = githubAuth.getAccessToken();
      chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "github", accessToken: authToken});
    },function(){
      chrome.storage.sync.set({
        "GITHUB_ENABLED":false
      },function(){
        githubAuth.clear();
        chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessTokenLost", adapter: "github"});
      })
    });
  }
  else if(message.mes=="isAuthorizedMindmeister"){
    var mindmeisterAuth = new OAuth2("mindmeister", {
      client_id: Credentials.mindmeister.client_id,
      client_secret: Credentials.mindmeister.client_secret,
      api_scope: "mindmeister"
    });
    var accessToken = mindmeisterAuth.hasAccessToken();
    chrome.tabs.sendMessage(sender.tab.id,{mesType: "isAuthorized", adapter: "mindmeister", accessToken: accessToken});
  }
  else if(message.mes=="isAuthorizedMendeley"){
    var mendeleyAuth = new OAuth2("mendeley", {
      client_id: Credentials.mendeley.client_id,
      client_secret:  Credentials.mendeley.client_secret,
      api_scope: "all"
    });
    var accessToken = mendeleyAuth.hasAccessToken();
    if(accessToken==null||!accessToken){
      chrome.tabs.sendMessage(sender.tab.id,{mesType: "refreshAccessToken", adapter: "mendeley"});
    }
    else chrome.tabs.sendMessage(sender.tab.id,{mesType: "isAuthorized", adapter: "mendeley", accessToken: accessToken});
  }
  else if(message.mes=="isAuthorizedGithub"){
    var githubAuth = new OAuth2("github", {
      client_id: Credentials.github.client_id,
      client_secret: Credentials.github.client_secret,
      api_scope: "repo"
    });
    var accessToken = githubAuth.hasAccessToken();
    if(accessToken==null||!accessToken){
      chrome.tabs.sendMessage(sender.tab.id,{mesType: "refreshAccessToken", adapter: "github"});
    }
    else chrome.tabs.sendMessage(sender.tab.id,{mesType: "isAuthorized", adapter: "github", accessToken: accessToken});
  }
  else if(message.mes=="isAuthorizedHypothesis"){
    chrome.storage.sync.get(["HYPOTHESIS_USER","HYPOTHESIS_DEV_API_TOKEN"], function(options){
      var apiToken = options["HYPOTHESIS_DEV_API_TOKEN"];
      if(apiToken!=null) chrome.tabs.sendMessage(sender.tab.id,{mesType: "isAuthorized", adapter: "hypothesis"});
    });
  }
  else if(message.mes=="isAuthorizedGoogleForms"){
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (this.status == 200) {
        if(this.getResponseHeader('content-type').indexOf("application/json")!=-1){
          chrome.tabs.sendMessage(sender.tab.id,{mesType: "isAuthorized", adapter: "googleForms"});
        }
      }
    };
    xhr.open("GET", "https://script.google.com/macros/s/AKfycbwmaWKMBmFDG0wScOyNxNhEcB-OOL5-DPKL2JSqc_M6IvTWTAk/exec");
    xhr.send();
  }
  else if(message.mes=="authorizeGoogleForms"){
    var doStuff = function(tabId,changeInfo,updatedTab){
      if(PAIREDCOMPARISONS_TAB_ID!=tabId) return;
      chrome.tabs.get(PAIREDCOMPARISONS_TAB_ID, function(authTab){
        var appURL = authTab.url;
        var xhr = new XMLHttpRequest();
        xhr.onload = function () {
          if (this.status == 200) {
            if(this.getResponseHeader('content-type').indexOf("application/json")!=-1){
              if(PAIREDCOMPARISONS_REQUEST_TAB_ID!=null){
                chrome.tabs.sendMessage(PAIREDCOMPARISONS_REQUEST_TAB_ID,{mesType: "accessToken", adapter: "googleForms", mes: "done", interactionRequired: true});
                PAIREDCOMPARISONS_REQUEST_TAB_ID = null;
              }
              chrome.tabs.onUpdated.removeListener(doStuff);
              chrome.tabs.onRemoved.removeListener(cleanListeners);
              if(PAIREDCOMPARISONS_TAB_ID!=null){
                chrome.tabs.remove(PAIREDCOMPARISONS_TAB_ID,function(){
                  PAIREDCOMPARISONS_TAB_ID = null;
                })
              }
            }
          }
        };
        xhr.open("GET", appURL);
        xhr.send();
      })
    }
    var cleanListeners = function(tabId,removeInfo){
      if(PAIREDCOMPARISONS_TAB_ID!=tabId) return;
      PAIREDCOMPARISONS_TAB_ID = null;
      PAIREDCOMPARISONS_REQUEST_TAB_ID = null;
      chrome.tabs.onUpdated.removeListener(doStuff);
      chrome.tabs.onRemoved.removeListener(cleanListeners);
    }
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (this.status == 200) {
        if(this.getResponseHeader('content-type').indexOf("application/json")!=-1){
          chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "googleForms", mes: "done", interactionRequired: false});
          return;
        }
      }
      PAIREDCOMPARISONS_REQUEST_TAB_ID = sender.tab.id;
      chrome.tabs.create({ url: "https://script.google.com/macros/s/AKfycbwmaWKMBmFDG0wScOyNxNhEcB-OOL5-DPKL2JSqc_M6IvTWTAk/exec" }, function(tab){
        PAIREDCOMPARISONS_TAB_ID = tab.id;
        chrome.tabs.onUpdated.addListener(doStuff);
        chrome.tabs.onRemoved.addListener(cleanListeners);
      })
    };
    xhr.open("GET", "https://script.google.com/macros/s/AKfycbwmaWKMBmFDG0wScOyNxNhEcB-OOL5-DPKL2JSqc_M6IvTWTAk/exec");
    xhr.send();
  }
  else if(message.mes=="authorizeMindmeister"){
    var mindmeisterAuth = new OAuth2("mindmeister", {
      client_id: Credentials.mindmeister.client_id,
      client_secret: Credentials.mindmeister.client_secret,
      api_scope: "mindmeister"
    });
    if(mindmeisterAuth.hasAccessToken()) chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "mindmeister", mes: "done", interactionRequired: false});
    else mindmeisterAuth.authorize(function(){
      var authToken = mindmeisterAuth.getAccessToken();
      chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "mindmeister", mes: "done", interactionRequired: true});
    });
  }
  else if(message.mes=="authorizeMendeley"){
    var mendeleyAuth = new OAuth2("mendeley", {
      client_id: Credentials.mendeley.client_id,
      client_secret: Credentials.mendeley.client_secret,
      api_scope: "all"
    });
    if(mendeleyAuth.hasAccessToken()) chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "mendeley", mes: "done", interactionRequired: false});
    else mendeleyAuth.authorize(function(){
      var authToken = mendeleyAuth.getAccessToken();
      chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "mendeley", mes: "done", interactionRequired: true});
    });
  }
  else if(message.mes=="authorizeGithub"){
    var githubAuth = new OAuth2("github", {
      client_id: Credentials.github.client_id,
      client_secret: Credentials.github.client_secret,
      api_scope: "repo"
    });
    if(githubAuth.hasAccessToken()) chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "github", mes: "done", interactionRequired: false});
    else githubAuth.authorize(function(){
      var authToken = githubAuth.getAccessToken();
      chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "github", mes: "done", interactionRequired: true});
    });
  }
  else if(message.mes=="authorizeHypothesis"){
    chrome.storage.sync.get(["HYPOTHESIS_USER","HYPOTHESIS_DEV_API_TOKEN"], function(options){
      var apiToken = options["HYPOTHESIS_DEV_API_TOKEN"];
      if(apiToken!=null) chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "hypothesis", mes: "done", interactionRequired: false});
      else{
        var xhr2 = new XMLHttpRequest();
        xhr2.onload = function () {
          if (this.status == 200) {
            var aux2 = xhr2.responseText;
            var regExp2 = /https:\/\/hypothes\.is\/users\/([^"]+)"/;
            var match2 = aux2.match(regExp2);
            if(match2!=null&&match2.length>1){
              var user = match2[1];
              var xhr = new XMLHttpRequest();
              xhr.onload = function () {
                if (this.status == 200) {
                  var aux = xhr.responseText;
                  var regExp = /input id="token"[\n\s]* type="text"[\n\s]* value="([^"]*)"/;
                  var match = aux.match(regExp);
                  if(match!=null&&match.length>1){
                    var apiToken = match[1];
                    chrome.storage.sync.set({
                      "HYPOTHESIS_USER": user,
                      "HYPOTHESIS_DEV_API_TOKEN": apiToken
                    },function(){
                      chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "hypothesis", mes: "done", interactionRequired: true});
                    });
                  }
                  else{
                    var xhr3 = new XMLHttpRequest();
                    xhr3.onload = function () {
                      if (this.status == 200) {
                        var aux3 = xhr3.responseText;
                        var regExp3 = /input id="token"[\n\s]* type="text"[\n\s]* value="([^"]*)"/;
                        var match3 = aux3.match(regExp3);
                        if(match3!=null&&match3.length>1){
                          var apiToken = match3[1];
                          chrome.storage.sync.set({
                            "HYPOTHESIS_USER": user,
                            "HYPOTHESIS_DEV_API_TOKEN": apiToken
                          },function(){
                            chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "hypothesis", mes: "done", interactionRequired: true});
                          });
                        }
                      }
                    };
                    xhr3.open("POST", "https://hypothes.is/account/developer");
                    xhr3.send();
                  }
                }
                else{
                  var xhr3 = new XMLHttpRequest();
                  xhr3.onload = function () {
                    console.log(xhr3);
                    if (this.status == 200) {
                      var aux3 = xhr3.responseText;
                      var regExp3 = /input id="token"[\n\s]* type="text"[\n\s]* value="([^"]*)"/;
                      var match3 = aux3.match(regExp3);
                      if(match3!=null&&match3.length>1){
                        var apiToken = match3[1];
                      }
                      chrome.storage.sync.set({
                        "HYPOTHESIS_USER": user,
                        "HYPOTHESIS_DEV_API_TOKEN": apiToken
                      },function(){
                        chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "hypothesis", mes: "done", interactionRequired: true});
                      });
                    }
                  };
                  xhr3.open("POST", "https://hypothes.is/account/developer");
                  xhr3.send();
                }
              };
              xhr.open("GET", "https://hypothes.is/account/developer");
              xhr.send();
            }
            else{
              chrome.tabs.create({ url: "https://hypothes.is/login" }, function(newTab){
                chrome.tabs.onUpdated.addListener(function(updatedTabId,changes,updatedTab){
                  if(updatedTabId==newTab.id&&changes.url.indexOf("https://hypothes.is/users/")!=-1){
                    chrome.tabs.remove(newTab.id,function(){
                      chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "hypothesis", mes: "redo"});
                    })
                  }
                })
              });
            }
          }
          else{
            chrome.tabs.create({ url: "https://hypothes.is/login" }, function(newTab){
              chrome.tabs.onUpdated.addListener(function(updatedTabId,changes,updatedTab){
                if(updatedTabId==newTab.id&&changes.url.indexOf("https://hypothes.is/users/")!=-1){
                  chrome.tabs.remove(newTab.id,function(){
                    chrome.tabs.sendMessage(sender.tab.id,{mesType: "accessToken", adapter: "hypothesis", mes: "redo"});
                  })
                }
              })
            });
          }
        }
        xhr2.open("GET", "https://hypothes.is");
        xhr2.send();
      }
    });
  }
  else if(message.mes=="authorizePairedComparison"){
    var doStuff = function(tabId,changeInfo,updatedTab){
      if(PAIREDCOMPARISONS_TAB_ID!=tabId) return;
      chrome.tabs.get(PAIREDCOMPARISONS_TAB_ID, function(authTab){
        var appURL = authTab.url;
        var xhr = new XMLHttpRequest();
        xhr.onload = function () {
          if (this.status == 200) {
            if(this.getResponseHeader('content-type').indexOf("application/json")!=-1){
              if(PAIREDCOMPARISONS_REQUEST_TAB_ID!=null){
                chrome.tabs.sendMessage(PAIREDCOMPARISONS_REQUEST_TAB_ID,{mesType: "authorizePairedComparisonDone"});
                PAIREDCOMPARISONS_REQUEST_TAB_ID = null;
              }
              chrome.tabs.onUpdated.removeListener(doStuff);
              chrome.tabs.onRemoved.removeListener(cleanListeners);
              if(PAIREDCOMPARISONS_TAB_ID!=null){
                chrome.tabs.remove(PAIREDCOMPARISONS_TAB_ID,function(){
                  PAIREDCOMPARISONS_TAB_ID = null;
                })
              }
            }
          }
        };
        xhr.open("GET", appURL);
        xhr.send();
      })
    }
    var cleanListeners = function(tabId,removeInfo){
      if(PAIREDCOMPARISONS_TAB_ID!=tabId) return;
      PAIREDCOMPARISONS_TAB_ID = null;
      PAIREDCOMPARISONS_REQUEST_TAB_ID = null;
      chrome.tabs.onUpdated.removeListener(doStuff);
      chrome.tabs.onRemoved.removeListener(cleanListeners);
    }
    PAIREDCOMPARISONS_REQUEST_TAB_ID = sender.tab.id;
    chrome.tabs.create({ url: message.appURL }, function(tab){
      PAIREDCOMPARISONS_TAB_ID = tab.id;
      chrome.tabs.onUpdated.addListener(doStuff);
      chrome.tabs.onRemoved.addListener(cleanListeners);
    })
  }
  else if(message.mes=="reloadBrowserAction"){
    setBrowserAction();
  }
  else if(message.mes=="postComment"){
    getMindmeisterAuth().then(function(authToken){
      Mindmeister.setAccessToken(authToken);
      Mindmeister.postComment(message.mapId,message.nodeId,message.comment).then(function(){
        // DO STUFF
      })
    });
  }
  else if(message.mes=="commentNotificationManagement"){
    if(message.enable) startCommentManagement();
    else endCommentManagement();
  }
});

chrome.storage.sync.get(["COMPLETENESS_OPTIONS"], function(options){
  if(options==null||options["COMPLETENESS_OPTIONS"]==null){
    chrome.storage.sync.set({
      "COMPLETENESS_OPTIONS": {}
    });
  }
});

chrome.storage.sync.get(["SYNC_MODE"], function(options){
  if(options==null||options["SYNC_MODE"]==null){
    chrome.storage.sync.set({
      "SYNC_MODE": "folder"
    });
  }
});

var escapeHtml = function(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ----------------MINDMEISTER------------------------------
var Mindmeister = (function (){
  var accessToken;
  var setAccessToken = function(accessToken){
    this.accessToken = accessToken;
  }
  var getMapList = function(page){
    var that = this;
    return new Promise(function(resolve,reject){
      var perPage = 100;
      var items = {
        access_token: that.accessToken,
        method: "mm.maps.getList",
        per_page: perPage
      }
      if(page!=null) opts.params["page"] = page;
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        var mapList = [];
        var ret = JSON.parse(resp.responseText);
        for(var i=0;i<ret.rsp.maps.map.length;i++){
          mapList.push(ret.rsp.maps.map[i]);
        }
        if(ret.rsp.maps.total==perPage) that.getMapList(ret.rsp.maps.page+1).then(function(mL){
          resolve(mapList.concat(mL));
        });
        else resolve(mapList);
      });
    })
  }
  var getMapComments = function(mapId,afterDate){
    var that = this;
    return new Promise(function(resolve,reject){
      var items = {
        access_token: that.accessToken,
        method: "mm.maps.getMap",
        map_id: mapId
      }
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        var ret = JSON.parse(resp.responseText);
        var commentList = [];
        var hasComment = function(idea){
          if(idea==null||idea.comments==null) return false;
          else return true;
        }
        var ideasWithComments = ret.rsp.ideas.idea.filter(hasComment);
        var commentList = [];
        for(var j=0;j<ideasWithComments.length;j++){
          var commentsAux = [];
          if(!Array.isArray(ideasWithComments[j].comments.comment)) commentsAux = [ideasWithComments[j].comments.comment];
          else commentsAux = ideasWithComments[j].comments.comment;
          for(var i=0;i<commentsAux.length;i++){
            if(new Date(commentsAux[i].updatedat).getTime()>afterDate){
              commentList.push({
                comment: escapeHtml(commentsAux[i].text),
                date: commentsAux[i].updatedat,
                id: commentsAux[i].id,
                userId: commentsAux[i].userid,
                author: escapeHtml(commentsAux[i].user.name),
                nodeText: escapeHtml(ideasWithComments[j].title),
                nodeId: ideasWithComments[j].id,
                mapId: mapId,
                mapTitle: escapeHtml(ret.rsp.map.title)
              })
            }
          }
        }
        resolve(commentList);
      });
    })
  }
  var getComments = function(afterDate){
    var that = this;
    return new Promise(function(resolve,reject){
      that.getMapList().then(function(mapList){
        var promiseList = [];
        var interval = 1000;
        var m = 0;
        for(var i=0;i<mapList.length;i++){
          if(new Date(mapList[i].modified).getTime() <= afterDate) continue;
          m++;
          (function(mapId){
            var p = new Promise(function(res,rej){
              setTimeout(function(){
                that.getMapComments(mapId,afterDate).then(function(mapComments){
                  res(mapComments);
                })
              },interval*m);
            })
            promiseList.push(p);
          })(mapList[i].id);
        }
        Promise.all(promiseList).then(function(comments){
          var commentList = [];
          for(var j=0;j<comments.length;j++){
            if(comments[j]!=null) commentList = commentList.concat(comments[j]);
          }
          resolve(commentList);
        });
      })
    })
  }
  var getUserId = function(){
    var that = this;
    return new Promise(function(resolve,reject){
      var items = {
        access_token: that.accessToken,
        method: "mm.test.login"
      }
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        var ret = JSON.parse(resp.responseText);
        resolve(ret.rsp.user.id);
      });
    })
  }
  var postComment = function(mapId,nodeId,comment){
    var that = this;
    return new Promise(function (resolve, reject){
      var c = [{"idea_id":nodeId,"type":"AddComment","new_data":{"text":comment,"idea_id":nodeId}}];
      var changes = JSON.stringify(c);
      var items = {
        access_token: that.accessToken,
        method: "mm.realtime.do",
        map_id: mapId,
        client_revision: 99999, // TO CHANGE
        data: changes
      }
      var opts = {
        method: "POST",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
      makeRequest(opts).then(function (resp){
        var ret = JSON.parse(resp.responseText);
        resolve();
      });
    })
  }
  var getMapIdeas = function(mapId){
    var that = this;
    return new Promise(function(resolve,reject){
      var items = {
        access_token: that.accessToken,
        method: "mm.maps.getMap",
        map_id: mapId
      }
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        var ret = JSON.parse(resp.responseText);
        if(ret.rsp.stat!="ok") resolve([]);
        else resolve(ret.rsp.ideas.idea);
      });
    })
  }
  return {
    setAccessToken: setAccessToken,
    getComments: getComments,
    getMapList: getMapList,
    getMapComments: getMapComments,
    getUserId: getUserId,
    postComment: postComment,
    getMapIdeas: getMapIdeas
  }
})();

function getMindmeisterAuth(){
  return new Promise(function (resolve,reject){
    var mindmeisterAuth = new OAuth2("mindmeister", {
      client_id: Credentials.mindmeister.client_id,
      client_secret: Credentials.mindmeister.client_secret,
      api_scope: "mindmeister"
    });
    mindmeisterAuth.authorize(function(){
      var authToken = mindmeisterAuth.getAccessToken();
      resolve(authToken);
    },function(){
      reject();
    });
  })
}

var browserActionListener = null;

function setBrowserAction(){
  chrome.storage.sync.get(["COMMENT_NOTIFICATION_ENABLED","UNREAD_COMMENTS","HYPOTHESIS_ENABLED"], function(options){
    var comments = options["UNREAD_COMMENTS"] != null ? options["UNREAD_COMMENTS"] : [];
    var commentsEnabled = options["COMMENT_NOTIFICATION_ENABLED"] != null ? options["COMMENT_NOTIFICATION_ENABLED"] : false;
    if(commentsEnabled&&comments.length>0){
      if(browserActionListener!=null) chrome.browserAction.onClicked.removeListener(browserActionListener);
      chrome.browserAction.setIcon({path:{"19": "../images/icon19.png","38": "../images/icon38.png"}});
      chrome.browserAction.setBadgeText({text:comments.length.toString()});
      chrome.browserAction.setBadgeBackgroundColor({color:"#F00"});
      chrome.browserAction.setPopup({popup:"pages/popup.html"});
    }
    else {
      if (options != null && options["HYPOTHESIS_ENABLED"] != null && options["HYPOTHESIS_ENABLED"]) {
        initAnnotatorBrowserAction();
      }
      else{
        if(browserActionListener!=null) chrome.browserAction.onClicked.removeListener(browserActionListener);
        chrome.browserAction.setIcon({path:{"19": "../images/icon19.png","38": "../images/icon38.png"}});
        chrome.browserAction.setBadgeText({text: ""})
        chrome.browserAction.setPopup({popup: ""});
        browserActionListener = function(){
          var newURL = chrome.extension.getURL("pages/options.html");
          chrome.tabs.create({ url: newURL });
        };
        chrome.browserAction.onClicked.addListener(browserActionListener);
      }
    }
  });
}

function lookForComments(){
  getMindmeisterAuth().then(function(authToken){
    Mindmeister.setAccessToken(authToken);
    chrome.storage.sync.get(["UNREAD_COMMENTS","LAST_SEARCH_FOR_COMMENTS"], function(options){
      var comments = options["UNREAD_COMMENTS"] != null ? options["UNREAD_COMMENTS"] : [];
      var lastUpdate = options["LAST_SEARCH_FOR_COMMENTS"] != null ? options["LAST_SEARCH_FOR_COMMENTS"] : 0;
      Mindmeister.getComments(lastUpdate).then(function(commentList){
        Mindmeister.getUserId().then(function(uId){
          for(var i=0;i<commentList.length;i++){
            if(commentList[i].userId!=uId) comments.push(commentList[i]);
          }
          var d = new Date();
          var newDate = d.getTime()+(d.getTimezoneOffset()*60000)
          chrome.storage.sync.set({"UNREAD_COMMENTS":comments,"LAST_SEARCH_FOR_COMMENTS":newDate},function(){
            setBrowserAction();
          });
        })
      });
    });
  })
}

var commentTimeout;
function startCommentManagement(){
  var refreshFrequency = 3600000;
  setBrowserAction();
  lookForComments();
  commentTimeout = setTimeout(function(){
    lookForComments();
  },refreshFrequency);
}

function endCommentManagement(){
  clearTimeout(commentTimeout);
  chrome.storage.sync.get(["HYPOTHESIS_ENABLED"], function(options) {
    if (options != null && options["HYPOTHESIS_ENABLED"] != null && options["HYPOTHESIS_ENABLED"]) {
      initAnnotatorBrowserAction();
    }
    else {
      chrome.browserAction.onClicked.removeListener();
      chrome.browserAction.setIcon({path: {"19": "../images/icon19.png", "38": "../images/icon38.png"}});
      chrome.browserAction.setBadgeText({text: ""})
      chrome.browserAction.setPopup({popup: ""});
      chrome.browserAction.onClicked.addListener(function () {
        var newURL = chrome.extension.getURL("pages/options.html");
        chrome.tabs.create({url: newURL});
      })
    }
  });
}

function initAnnotatorBrowserAction(){
  if(browserActionListener!=null) chrome.browserAction.onClicked.removeListener(browserActionListener);
  chrome.browserAction.setIcon({path:"../images/icon128Grey.png"});
  chrome.browserAction.setBadgeText({text: ""})
  chrome.browserAction.setPopup({popup: ""});
  browserActionListener = function(){
    chrome.tabs.query({active: true, currentWindow: true},function(tabs){
      chrome.tabs.sendMessage(tabs[0].id,{scope:"extension",cmd:"browserActionClicked"});
      //chrome.browserAction.setIcon({path:{"19": "../images/icon19.png","38": "../images/icon38.png"},tabId:tabs[0].id});
    })
  };
  chrome.browserAction.onClicked.addListener(browserActionListener);

  chrome.runtime.onMessage.addListener(function(message,sender,sendResponse){
    if(message.scope=="dscaffolding"&&message.cmd=="annotationEnabled"){
      chrome.browserAction.setIcon({path:{"19": "../images/icon19.png","38": "../images/icon38.png"},tabId:sender.tab.id});
    }
  });
}

chrome.storage.sync.get(["COMMENT_NOTIFICATION_ENABLED","HYPOTHESIS_ENABLED"], function(options){
  if(options!=null&&options["COMMENT_NOTIFICATION_ENABLED"]!=null&&options["COMMENT_NOTIFICATION_ENABLED"]){
    startCommentManagement();
  }
  else if(options!=null&&options["HYPOTHESIS_ENABLED"]!=null&&options["HYPOTHESIS_ENABLED"]){
    initAnnotatorBrowserAction();
  }
  else{
    chrome.browserAction.setBadgeText({text: ""})
    chrome.browserAction.setPopup({popup: ""});
    chrome.browserAction.onClicked.addListener(function(){
      var newURL = chrome.extension.getURL("pages/options.html");
      chrome.tabs.create({ url: newURL });
    })
  }
});

// ------------------HYPOTHESIS-------------------------------
var Hypothesis = (function (){
  var devToken;
  var user;
  var setDevToken = function(token){
    devToken = token;
  }
  var setUser = function(username){
    user = username;
  }
  var init = function(){
    return new Promise(function(resolve,reject){
      chrome.storage.sync.get(["HYPOTHESIS_USER","HYPOTHESIS_DEV_API_TOKEN"], function(options){
        var devToken = options["HYPOTHESIS_DEV_API_TOKEN"]==null ? null : options["HYPOTHESIS_DEV_API_TOKEN"];
        var username = options["HYPOTHESIS_USER"]==null ? null : options["HYPOTHESIS_USER"];
        setDevToken(devToken);
        setUser(username);
        resolve();
      });
    })
  }
  var getGroupId = function(group){
    var that = this;
    return new Promise(function(resolve,reject){
      var opts = {
        method: "GET",
        url: "https://hypothes.is/api/profile",
        headers: {
          'Authorization': "Bearer "+devToken
        }
      }
      makeRequest(opts).then(function (response){
        var ret = JSON.parse(response.responseText);
        var groupList = ret.groups;
        var g = groupList.find(filter,{name:group});
        if(g!=null) resolve(g.id);
        else resolve(null);
      });
    })
  }
  var getUrlGroupIdAnnotations = function(groupId,url,page){
    var that = this;
    return new Promise(function (resolve, reject){
      var item = {
        user: user,
        limit: 200,
        url: url,
        group: groupId
      }
      if(page!=null){
        item["offset"] = 200*page;
      }
      var opts = {
        method: "GET",
        url: "https://hypothes.is/api/search",
        headers: {
          'Authorization': "Bearer "+devToken
        },
        params: item
      }
      makeRequest(opts).then(function (response){
        var annotationList = [];
        var ret = JSON.parse(response.responseText);
        var annotationList = annotationList.concat(ret.rows);
        if(ret.rows.length==200&&((page==null&&ret.total>200)||(ret.total>(page+1)*200))){
          var nextPage = page!=null ? page+1 : 1;
          that.getUrlGroupAnnotations(groupId,url,nextPage).then(function(annotations){
            annotationList = annotationList.concat(annotations);
            resolve(annotationList);
          })
        }
        else{
          resolve(annotationList);
        }
      });
    })
  }
  var getUrlGroupAnnotations = function(group,url){
    var that = this;
    return new Promise(function(resolve,reject){
      that.getGroupId(group).then(function(groupId){
        that.getUrlGroupIdAnnotations(groupId).then(function(annotations){
          resolve(annotations);
        })
      })
    })
  }
  var removeAnnotation = function(annotationId){
    var that = this;
    return new Promise(function(resolve,reject) {
      var opts = {
        method: "DELETE",
        url: "https://hypothes.is/api/annotations/" + annotationId,
        headers: {
          'Authorization': "Bearer " + devToken
        }
      }
      makeRequest(opts).then(function (response) {
        // MANAGE ERRORS
        resolve();
      });
    });
  }
  var createAnnotation = function(groupId,tags,text,uri){
    var that = this;
    return new Promise(function(resolve,reject){
      var item = {};
      if(groupId!=null) item["group"] = groupId;
      if(tags!=null) item["tags"] = tags;
      if(uri!=null) item["uri"] = uri;
      if(text!=null) item["text"] =  text;
      var req = new XMLHttpRequest();
      req.open("POST","https://hypothes.is/api/annotations",true);
      req.setRequestHeader("Content-Type","application/json");
      req.setRequestHeader("Authorization","Bearer "+devToken);
      req.onload = function(){
        resolve();
      }
      req.send(JSON.stringify(item));
    })
  }
  var createGroup = function(group){
    var that = this;
    return new Promise(function(resolve,reject){
      var opts = {
        method: "GET",
        url: "https://hypothes.is/groups/new",
        headers: {
          'Authorization': "Bearer "+devToken
        }
      }
      makeRequest(opts).then(function (response){
        var a = document.createElement("div");
        a.innerHTML = response.responseText;
        var aux = a.querySelector("#deformField1");
        if(aux!=null){
          var csrfToken = aux.getAttribute("value");
          var data = `-----------------------------sep
Content-Disposition: form-data; name="__formid__"

deform
-----------------------------sep
Content-Disposition: form-data; name="csrf_token"

`+csrfToken+`
-----------------------------sep
Content-Disposition: form-data; name="name"

`+group+`
-----------------------------sep
Content-Disposition: form-data; name="description"


-----------------------------sep
Content-Disposition: form-data; name="submit"

submit
-----------------------------sep--
`
          var req = new XMLHttpRequest();
          req.open("POST","https://hypothes.is/groups/new",true);
          req.setRequestHeader("Content-Type","multipart/form-data; boundary=---------------------------sep");
          req.onload = function(){
            var groupId = req.responseURL.replace("https://hypothes.is/groups/","").split("/")[0];
            resolve(groupId);
          }
          req.send(data);
        }
        else{
          // TO DO
        }
      });
    })
  }
  return{
    setDevToken: setDevToken,
    setUser: setUser,
    init: init,
    getGroupId: getGroupId,
    getUrlGroupAnnotations: getUrlGroupAnnotations,
    getUrlGroupIdAnnotations: getUrlGroupIdAnnotations,
    removeAnnotation: removeAnnotation,
    createAnnotation: createAnnotation,
    createGroup: createGroup
  }
})()


function filter(currentValue,index,arr){
  var conditions = this;
  for(var key in conditions){
    var attr = key.split(".");
    var aux = currentValue;
    for(var i=0;i<attr.length;i++){
      if(i==attr.length-1&&aux[attr[i]]==null&&conditions[key]==null){
        aux = null;
        continue;
      }
      if(aux[attr[i]]==null) return false;
      aux = aux[attr[i]];
    }
    if((aux != conditions[key])) return false;
  }
  return true;
}

// --------------PURPOSE MANAGER--------------------------
var PurposeManagerBackground = (function(){
  var possibleColors = ["dcffb0","bae2ff","d3c2ff","ffc4fb","ffb5b6","ffdeb4","dbdbdb"];
  var insertionPointLabels = ["Supporting Evidences?","Who else addresses it?","Justificatory Knowledge"];
  var purposeList = [];
  var enabledServices = [];
  var hexToRgb = function(hex){
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
  var init = function(){
    chrome.storage.sync.get(["HYPOTHESIS_ENABLED", "MENDELEY_ENABLED"],function(options){
      var hypothesisEnabled = options["HYPOTHESIS_ENABLED"] != null ? options["HYPOTHESIS_ENABLED"] : false;
      var mendeleyEnabled = options["MENDELEY_ENABLED"] != null ? options["MENDELEY_ENABLED"] : false;
      if(hypothesisEnabled) enabledServices.push(HypothesisPurposeManagerBackground);
      if(mendeleyEnabled) enabledServices.push(MendeleyPurposeManagerBackground);
      if(hypothesisEnabled) loadMapPurposes();
    })
  }
  var getNodeWithText = function(nodeList,text){
    return nodeList.find(filter,{"title":text});
  }
  var getNodesWithBackgroundColor = function(nodeList,color){
    return nodeList.filter(filter,{"extendedstyle.backgroundcolor":color});
  }
  var getRootNode = function(nodeList){
    return nodeList.find(filter,{"parent":null});
  }
  var getNodeChildWithText = function(nodeList,nodeId,text){
    return nodeList.find(filter,{"parent":nodeId,"title":text});
  }
  var followsTemplate = function(nodeList){
    var explicateProblemNodes = ["Set Problem Statement","Describe Stakeholders","Assess Problem as Difficulties","Assess Problem as Solutions"]
    var dscaffoldingNodes = ["Describe Practice","Explicate Problem","Manage DSR Risks","Formulate Design Theory","Decide Requirements and Capture Design Ideas"];

    var dscaffoldingTemplate = true;
    for(var i=0;i<dscaffoldingNodes.length;i++){
      if(getNodeWithText(nodeList,dscaffoldingNodes[i])==null){
        dscaffoldingTemplate = false;
        break;
      }
    }
    if(dscaffoldingTemplate){
      return true;
    }
    var explicateProblemTemplate = true;
    for(var i=0;i<explicateProblemNodes.length;i++){
      if(getNodeWithText(nodeList,explicateProblemNodes[i])==null){
        explicateProblemTemplate = false;
        break;
      }
    }
    if(getRootNode(nodeList).title.indexOf("Explicate Problem for")==-1) return false;
    if(explicateProblemTemplate){
      return true;
    }
    return false;
  }
  var cleanMapTitle = function(mapTitle){
    return mapTitle.replace(/\n/g," ");
  }
  var loadMapPurposes = function(){
    getMindmeisterAuth().then(function(authToken) {
      Mindmeister.setAccessToken(authToken);
      Mindmeister.getMapList().then(function(mapListAux){
        var mapList = mapListAux.map(getAttribute,"id");
        var promiseList = [];
        for(var i=0;i<mapList.length;i++){
          var p = new Promise(function(resolve,reject){
            (function(map,index){
              setTimeout(function(){
                Mindmeister.getMapIdeas(map).then(function(ideas){
                  if(!followsTemplate(ideas)){
                    resolve({});
                    return;
                  }
                  var mapPurposes = [];
                  var mapInfo = {};
                  var rootNode = getRootNode(ideas);
                  mapInfo["mapId"] = rootNode.id;
                  mapInfo["mapTitle"] = cleanMapTitle(rootNode.title);
                  for(var j=0;j<possibleColors.length;j++){
                    var colorsNode = getNodesWithBackgroundColor(ideas,possibleColors[j]);
                    var purpose = null;
                    for(var k=0;k<colorsNode.length;k++){
                      for(var l=0;l<insertionPointLabels.length;l++){
                        if(getNodeChildWithText(ideas,colorsNode[k].id,insertionPointLabels[l])!=null){
                          purpose = colorsNode[k];
                          mapPurposes.push({nodeId:colorsNode[k],label:colorsNode[k].title,color:possibleColors[j]});
                          break;
                        }
                      }
                      if(purpose!=null) break;
                    }
                    if(purpose==null){
                      var regExp = /\.\.\.$/g;
                      for(var k=0;k<colorsNode.length;k++){
                        if(regExp.test(colorsNode[k].title)){
                          mapPurposes.push({nodeId:colorsNode[k],label:colorsNode[k].title,color:possibleColors[j]});
                        }
                      }
                    }
                  }
                  mapInfo["purposes"] = mapPurposes;
                  resolve(mapInfo);
                })
              },500*index);
            })(mapList[i],i);
          })
          promiseList.push(p);
        }
        Promise.all(promiseList).then(function(mapInfo){
          for(var i=0;i<enabledServices.length;i++){
            enabledServices[i].onMapPurposesLoaded(mapInfo);
          }
        })
      })
    });
  }
  var getPossibleColors = function(){
    return possibleColors;
  }
  return{
    init: init,
    loadMapPurposes: loadMapPurposes,
    getPossibleColors: getPossibleColors
  }
})()

// ----------------HYPOTHESIS PURPOSE MANAGER---------------
var HypothesisPurposeManagerBackground = (function(){
  var readingPurposePrefix = "Purpose:";
  var colorPrefix = "color: ";
  var purposeUri = "https://*/*";
  var purposeOpacity = "0.9";
  var hexToRGB = function(hex){
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if(result==null) return null;
    var r = parseInt(result[1], 16);
    var g = parseInt(result[2], 16);
    var b = parseInt(result[3], 16);
    return "rgba("+r+","+g+","+b+","+purposeOpacity+")"
  }
  var mapNameToGroup = function(mapName){
    return mapName.replace("Explicate Problem for","").trim();
  }
  var onMapPurposesLoaded = function(purposeList){
    var that = this;
    Hypothesis.init().then(function(){
      for(var i=0;i<purposeList.length;i++){
        if(purposeList[i].mapTitle==null) continue;
        if(mapNameToGroup(purposeList[i].mapTitle).length>25) continue;
        if(mapNameToGroup(purposeList[i].mapTitle).length<4) continue;
        (function(mapInfo,index){
          setTimeout(function(){
            var managePurposes = function(groupId){
              Hypothesis.getUrlGroupIdAnnotations(groupId,purposeUri).then(function(annotations){
                var possibleColors = PurposeManagerBackground.getPossibleColors();
                for(var j=0;j<possibleColors.length;j++){
                  var colorPurpose = mapInfo.purposes.find(filter,{color:possibleColors[j]});
                  if(colorPurpose==null){
                    var colorAnnotations = annotations.filter(filter,{"text":colorPrefix+hexToRGB(possibleColors[j])});
                    for(var k=0;k<colorAnnotations.length;k++){
                      Hypothesis.removeAnnotation(colorAnnotations[k].id);
                    }
                  }
                  else{
                    var colorAnnotations = annotations.filter(filter,{"text":colorPrefix+hexToRGB(possibleColors[j])});
                    if(colorAnnotations.length==0){
                      Hypothesis.createAnnotation(groupId,[readingPurposePrefix+colorPurpose.label],colorPrefix+that.hexToRGB(colorPurpose.color),purposeUri);
                      continue;
                    }
                    var found = false;
                    for(var k=0;k<colorAnnotations.length;k++){
                      if(found||colorAnnotations[k].tags.indexOf(readingPurposePrefix+colorPurpose.label)==-1){
                        Hypothesis.removeAnnotation(colorAnnotations[k].id);
                      }
                      else{
                        found = true;
                      }
                    }
                    if(!found){
                      Hypothesis.createAnnotation(groupId,[readingPurposePrefix+colorPurpose.label],colorPrefix+that.hexToRGB(colorPurpose.color),purposeUri);
                    }
                  }
                }
              })
            }
            Hypothesis.getGroupId(mapNameToGroup(mapInfo.mapTitle)).then(function(gId){
              if(gId==null){
                Hypothesis.createGroup(mapNameToGroup(mapInfo.mapTitle)).then(function(grId){
                  managePurposes(grId);
                })
              }
              else managePurposes(gId);
            })
          },1000*index);
        })(purposeList[i],i);
      }
    });
  }
  return{
    mapNameToGroup: mapNameToGroup,
    onMapPurposesLoaded: onMapPurposesLoaded,
    hexToRGB: hexToRGB
  }
})()
// ----------------MENDELEY PURPOSE MANAGER-----------------
var MendeleyPurposeManagerBackground = (function(){
  var onMapPurposesLoaded = function(purposeList){
    return;
  }
  return{
    onMapPurposesLoaded: onMapPurposesLoaded
  }
})()

PurposeManagerBackground.init();

// Manage URL changes in MENDELEY
chrome.webNavigation.onHistoryStateUpdated.addListener((o) => {
  chrome.tabs.sendMessage(o.tabId, {scope: 'mendeleyURLChange', newURL: o.url})
}, {url: [{hostSuffix: 'mendeley.com'}]})

