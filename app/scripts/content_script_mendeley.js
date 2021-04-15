(function(){

// ----------------AUXILIAR VARIABLES----------------------

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
  var getDocumentId = function(){
    var url = window.location.href;
    var m = url.match(/documentId=[^\0&#]+/g);
    if(m==null) return null;
    return m[0].replace("documentId=","");
  }
  var insertMindmeisterLink = function(mindmapList){
    var zoomInButton = document.getElementById("zoomIn");
    var img = document.createElement("img");
    img.src = chrome.extension.getURL("images/icon128Grey.png");
    img.style.marginTop = "4px";
    img.style.height = "40px";
    var a = document.createElement("a");
    a.appendChild(img);
    a.href="https://www.mindmeister.com/"+mindmapList[0].id;
    a.target="_blank";
    zoomInButton.after(a);
  }
  var insertReadingPurposes = function(readingPurposesByMap){
    var colorTool = document.getElementById("colorTool");
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        var cT = document.getElementById("colorTool");
        if(cT.className.indexOf("open")!=-1){
          setTimeout(function(){
            var colorPickerElem = cT.querySelectorAll(".color-picker-option");
            for(var i=0;i<colorPickerElem.length;i++){
              colorPickerElem[i].style.overflow = "visible";
              colorPickerElem[i].style.float = "none";
              colorPickerElem[i].querySelector("span").style.verticalAlign = "middle";
              var c = colorPickerElem[i].getAttribute("data-color");
              if(c!=null&&readingPurposesByMap[0].readingPurposes[c.replace("#","")]!=null){
                var span = document.createElement("span");
                span.style.marginLeft = "5px";
                var rP = document.createTextNode(readingPurposesByMap[0].readingPurposes[c.replace("#","")]);
                span.appendChild(rP);
                colorPickerElem[i].appendChild(span);
              }
            }
            var cont = cT.querySelector(".color-picker-dropdown");
            //cont.style.width = "auto";
            cont.style.width = "250px";
            //cont.style.overflowY = "visible";
            cont.style.overflowX = "scroll";
            cont.style.marginTop = "-10px";
            cont.style.paddingBottom = "10px";
          },10);
        }
      });
    });
    var config = { attributes: true};
    observer.observe(colorTool, config);

    var colorTool = document.getElementById("viewerContainer");
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        var target = mutation.target;
        if(target.className.indexOf("dropdown")!=-1&&target.className.indexOf("color-picker")!=-1){
          if(target.className.indexOf("open")!=-1){
            setTimeout(function(){
              var colorPickerElem = target.querySelectorAll(".color-picker-option");
              for(var i=0;i<colorPickerElem.length;i++){
                colorPickerElem[i].style.overflow = "visible";
                colorPickerElem[i].style.float = "none";
                colorPickerElem[i].querySelector("span").style.verticalAlign = "middle";
                var c = colorPickerElem[i].getAttribute("data-color");
                if(c!=null&&readingPurposesByMap[0].readingPurposes[c.replace("#","")]!=null){
                  var span = document.createElement("span");
                  span.style.marginLeft = "5px";
                  span.style.color = "#2d2d2d";
                  var rP = document.createTextNode(readingPurposesByMap[0].readingPurposes[c.replace("#","")]);
                  span.appendChild(rP);
                  colorPickerElem[i].appendChild(span);
                }
              }
              var cont = target.querySelector(".color-picker-dropdown");
              //cont.style.width = "auto";
              cont.style.width = "250px";
              //cont.style.overflowY = "visible";
              cont.style.overflowX = "scroll";
              cont.style.marginTop = "-10px";
              cont.style.paddingBottom = "10px";
            },10);
          }
        }
      });
    });
    var config = { attributes: true, subtree: true};
    observer.observe(colorTool, config);

  }
  return {
    insertMindmeisterLink: insertMindmeisterLink,
    getDocumentId: getDocumentId,
    insertReadingPurposes: insertReadingPurposes
  }
})();

// ----------------MENDELEY---------------------------------

var Mendeley = (function (){
  var accessToken = null;
  var setAccessToken = function(token){
    this.accessToken = token;
  }
  var getAccessToken = function(){
    return this.accessToken;
  }
  var getFolderName = function(folderId){
    var that = this;
    return new Promise(function (resolve, reject){
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/folders/"+folderId,
        headers: {
          'Authorization': "Bearer "+that.getAccessToken()
        }
      }
      makeRequest(opts).then(function (response){
        var rsp = JSON.parse(response.responseText);
        if(rsp.name!=null) resolve(rsp.name);
        else resolve(null);
      });
    })
  }
  var getDocumentFolders = function(documentId){
    var that = this;
    return new Promise(function (resolve, reject){
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/documents/"+documentId,
        headers: {
          'Authorization': "Bearer "+that.getAccessToken()
        },
        params: {
          view: "all"
        }
      }
      makeRequest(opts).then(function (response){
        var doc = JSON.parse(response.responseText);
        var folderList = doc.folder_uuids != null ? doc.folder_uuids : [];
        var responseList = [];
        for(var i=0;i<folderList.length;i++){
          responseList.push(that.getFolderName(folderList[i]));
        }
        if(responseList.length==0) resolve([]);
        else Promise.all(responseList).then(function(folderNameList){
          resolve(folderNameList);
        })
      });
    })
  }
  return {
    setAccessToken: setAccessToken,
    getAccessToken: getAccessToken,
    getFolderName: getFolderName,
    getDocumentFolders: getDocumentFolders
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
  var getMapIdeas = function(mapId){
    var that = this;
    return new Promise(function(resolve,reject){
      var items = {
        access_token: that.getAccessToken(),
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
  var getReadingPurposes = function(map){
    var that = this;
    return new Promise(function(resolve,reject){
      that.getMapIdeas(map.id).then(function(ideas){
        console.log(ideas);
        var readingPurposeColor = ["dcffb0","bae2ff","d3c2ff","ffc4fb","ffb5b6","ffdeb4","dbdbdb"];
        var readingPurposes = [];
        for(var i=0;i<readingPurposeColor.length;i++){
          var colorIdeas = ideas.filter(function(ideaF){
            if(ideaF.extendedstyle==null) return null;
            return ideaF.extendedstyle.backgroundcolor == this;
          },readingPurposeColor[i]);
          for(var j=0;j<colorIdeas.length;j++){
            var supportingEvidencesNode = ideas.filter(function(ideaF){
              if(ideaF.title == "Supporting Evidences?" && ideaF.parent == this.id) return true;
              if(ideaF.title == "Who else addresses it?" && ideaF.parent == this.id) return true;
              if(ideaF.title == "Justificatory Knowledge?" && ideaF.parent == this.id) return true;
              if(/\.\.\.$/.test(ideaF.title)) return true;
              return false;
            },colorIdeas[j]);
            if(supportingEvidencesNode.length>0){
              readingPurposes[readingPurposeColor[i]] = colorIdeas[j].title;
              break;
            }
          }
        }
        resolve({"mapTitle":map.title,"readingPurposes":readingPurposes});
      })
    })
  }
  var getMapByName = function(mapName,page){
    return new Promise(function(resolve,reject){
      var perPage = 100;
      var items = {
        access_token: that.getAccessToken(),
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
        var ret = JSON.parse(resp.responseText);
        for(var i=0;i<ret.rsp.maps.map.length;i++){
          if(ret.rsp.maps.map[i].title==mapName){
            resolve(ret.rsp.maps.map[i].id);
            return;
          }
        }
        if(ret.rsp.maps.total==perPage) return getMapByName(mapName,ret.rsp.maps.page+1);
        else resolve(null);
      });
    })
  }
  var getMapByNameRegExp = function(mapName,page){
    return new Promise(function(resolve,reject){
      var perPage = 100;
      var items = {
        access_token: that.getAccessToken(),
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
        var ret = JSON.parse(resp.responseText);
        for(var i=0;i<ret.rsp.maps.map.length;i++){
          if(mapName.test(ret.rsp.maps.map[i].title)){
            resolve(ret.rsp.maps.map[i].id);
            return;
          }
        }
        if(ret.rsp.maps.total==perPage) return getMapByNameRegExp(mapName,ret.rsp.maps.page+1);
        else resolve(null);
      });
    })
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
    getMapIdeas: getMapIdeas,
    getMapByName: getMapByName,
    getMapByNameRegExp: getMapByNameRegExp,
    getMapList: getMapList,
    getReadingPurposes: getReadingPurposes
  }
})();


function insertReadingPurposes(mapList){
  var promiseList = [];
  for(var i=0;i<mapList.length;i++){
    promiseList.push(Mindmeister.getReadingPurposes(mapList[i]));
  }
  Promise.all(promiseList).then(function(readingPurposesByMap){
    Scrap.insertReadingPurposes(readingPurposesByMap);
  })
}

function init(){
  var mendeleyDocumentId = Scrap.getDocumentId();
  Mendeley.getDocumentFolders(mendeleyDocumentId).then(function(folders){
    Mindmeister.getMapList().then(function(mindmaps){
      var mindmapTitles = mindmaps.map(function(map){
        return map.title;
      });
      var mapList = [];
      for(var i=0;i<folders.length;i++){
        var ind;
        ind = mindmapTitles.indexOf("Explicate Problem for "+folders[i])
        if(ind != -1){
          mapList.push(mindmaps[ind]);
        }
        ind = mindmapTitles.indexOf(folders[i]);
        if(ind != -1){
          mapList.push(mindmaps[ind]);
        }
      }
      if(mapList.length>0){
        Scrap.insertMindmeisterLink(mapList);
        insertReadingPurposes(mapList);
      }
    })
  })
}

function auth(){

  chrome.storage.sync.get(["MENDELEY_ENABLED"], function(options){
    MENDELEY_ENABLED = options["MENDELEY_ENABLED"] != null ? options["MENDELEY_ENABLED"] : false;
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
