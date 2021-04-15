(function(){

var access_token_mindmeister;
var EXTENSION_VERSION;

/*
function makeRequest (opts) {
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
  });
}
*/

  function makeRequest (opts) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({mes:"processInBackground",params:opts},function(response){
        resolve(response)
      })
    });
  }

// ----------------MINDMEISTER------------------------------

var Mindmeister = (function (){
  var selectTemplateFile = function(template){
    return new Promise(function (resolve,reject){
      var t;
      if(template=="ExplicateProblem") t = "resources/mindmapTemplates/explicateProblemTemplate.mind";
      else if(template=="DesignScience") t = "resources/mindmapTemplates/DesignScienceTemplate.mind"
      else if(template=="ExplicateProblemNew") t = "resources/mindmapTemplates/explicateProblemTemplateNew.mind"
      else if(template=="RiskManagement") t = "resources/mindmapTemplates/riskManagementTemplate.mind"
      var xhr = new XMLHttpRequest();
      xhr.open('GET', chrome.extension.getURL(t), true);
      xhr.responseType = "arraybuffer";
      xhr.onreadystatechange = function(){
          if(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200){
            resolve(xhr.response);
          }
      };
      xhr.send();
    });
  }
  var importDesignScienceTemplate = function (file){
    return new Promise(function (resolve, reject){
      var blob = new File([file],"Template.mind");
      var data = new FormData();
      data.append("access_token",access_token_mindmeister);
      data.append("method","mm.maps.import");
      data.append("file",blob);
      var xhr = new XMLHttpRequest();

      xhr.addEventListener("readystatechange", function () {
        if (this.readyState === 4) {
          var response = JSON.parse(this.responseText);
          resolve(response.rsp.map.id);
        }
      });

      xhr.open("POST", "https://www.mindmeister.com/services/rest/oauth2");
      xhr.send(data);
    })
  }
  var setMindmapTags = function(mapId,tags){
    return new Promise(function (resolve,reject){
      var items = {
        access_token: access_token_mindmeister,
        method: "mm.maps.setMetaData",
        map_id: mapId,
        tags: tags.join(" "),
      }
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        resolve();
      })
    })
  }
  var closeNode = function(mapId,nodeId){
    return new Promise(function (resolve,reject){
      var items = {
        access_token: access_token_mindmeister,
        method: "mm.ideas.toggleClosed",
        map_id: mapId,
        idea_id: nodeId,
        closed: true
      }
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        resolve();
      })
    })
  }
  var getRootChildren = function(mapId){
    return new Promise(function (resolve,reject){
      var items = {
        access_token: access_token_mindmeister,
        method: "mm.maps.getMap",
        map_id: mapId,
      }
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        var ret = JSON.parse(resp.responseText);
        var rootChildrenIds = [];
        for(var i=0;i<ret.rsp.ideas.idea.length;i++){
          if(ret.rsp.ideas.idea[i].parent!=null&&ret.rsp.ideas.idea[i].parent==mapId) rootChildrenIds.push(ret.rsp.ideas.idea[i].id);
        }
        resolve(rootChildrenIds);
      })
    })
  }
  var getComplexChildren = function(mapId){
    return new Promise(function (resolve,reject){
      var items = {
        access_token: access_token_mindmeister,
        method: "mm.maps.getMap",
        map_id: mapId,
      }
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        var ret = JSON.parse(resp.responseText);
        var complexChildrenIds = [];
        for(var i=0;i<ret.rsp.ideas.idea.length;i++){
          if(ret.rsp.ideas.idea[i].parent!=null&&ret.rsp.ideas.idea[i].parent!=mapId&&complexChildrenIds.indexOf(ret.rsp.ideas.idea[i].parent)==-1){
            complexChildrenIds.push(ret.rsp.ideas.idea[i].parent);
          }
        }
        resolve(complexChildrenIds);
      })
    })
  }
  return {
    importDesignScienceTemplate: importDesignScienceTemplate,
    selectTemplateFile: selectTemplateFile,
    closeNode: closeNode,
    getRootChildren: getRootChildren,
    getComplexChildren: getComplexChildren,
    setMindmapTags: setMindmapTags
  }
})();

// ---------------------------------------------------------

function setLoadingMessage(message){
  var overlayDiv = document.createElement("div");
  overlayDiv.style.opacity = "0.8";
  overlayDiv.style.backgroundColor = "#ebf0f2";
  overlayDiv.style.zIndex = "999 !important";
  overlayDiv.style.position ="fixed";
  overlayDiv.style.width = "100%";
  overlayDiv.style.height = "100%";
  overlayDiv.style.top = "0";
  overlayDiv.style.left = "0";

  var activityDiv = document.createElement("div");
  activityDiv.style.zIndex = 1100;
  activityDiv.style.paddingTop = "20%";
  activityDiv.style.position = "fixed";
  activityDiv.style.width = "100%";
  activityDiv.style.height = "100%";
  activityDiv.style.top = 0;
  activityDiv.style.left = 0;

  var dialogWrapper = document.createElement("div");
  dialogWrapper.style.maxWidth = "340px";
  dialogWrapper.style.textAlign = "center";
  dialogWrapper.style.borderRadius = "20px 20px 20px 20px";
  dialogWrapper.style.position = "absolute";
  dialogWrapper.style.left = "50%";
  dialogWrapper.style.boxShadow = "0 1px 2px 0 rgba(0,0,0,0.2)";
  dialogWrapper.style.transform = "translateX(-50%)";
  dialogWrapper.style.height = "auto";
  dialogWrapper.style.zIndex = 1000;
  dialogWrapper.style.backgroundColor = "white";

  var dialogInner = document.createElement("div");
  dialogInner.style.maxWidth = "340px";
  dialogInner.style.padding = "60px 30px 60px 30px";
  dialogInner.style.display = "inline-block";

  var activityContent = document.createElement("div");
  activityContent.style.height = "auto";

  var div = document.createElement("div");

  var msg = document.createElement("div");
  msg.style.fontSize = "18px";
  msg.style.lineHeight = "140%";
  msg.appendChild(document.createTextNode("Creating map from template..."));

  var progress = document.createElement("div");
  progress.style.borderRadius = "7px 7px 7px 7px";
  progress.style.padding = "1px 1px 1px 1px";
  progress.style.border = "1px solid #00aaff";
  progress.style.marginTop = "30px";

  var span = document.createElement("span");
  span.id = "DSTemplateProgress";
  span.style.width = "0%";
  span.style.backgroundColor = "#00aaff";
  span.style.display = "block";
  span.style.height = "8px";
  span.style.transition = "width 1s ease-in";

  progress.appendChild(span);
  div.appendChild(msg);
  div.appendChild(progress);
  activityContent.appendChild(div);
  dialogInner.appendChild(activityContent);
  dialogWrapper.appendChild(dialogInner);
  activityDiv.appendChild(dialogWrapper);
  document.body.appendChild(overlayDiv);
  document.body.appendChild(activityDiv);
}

function importTemplate(template){
  /*var popoverTemplates = document.getElementById("popover_templates");
  popoverTemplates.style.display = "none";*/
  setLoadingMessage();
  var progressBar = document.getElementById("DSTemplateProgress");
  Mindmeister.selectTemplateFile(template).then(function(file){
    progressBar.style.width = "33%";
    Mindmeister.importDesignScienceTemplate(file).then(function(mapId){
      progressBar.style.width = "66%";
      if(template=="DesignScience"){
        Mindmeister.getComplexChildren(mapId).then(function(childrenIds){
          var promiseList = [];
          for(var i=0;i<childrenIds.length;i++){
            promiseList.push(Mindmeister.closeNode(mapId,childrenIds[i]));
          }
          progressBar.style.width = "100%";
          progressBar.style.borderRadius = "4px 4px 4px 4px";
          Promise.all(promiseList).then(function(){
            chrome.storage.sync.get(["DSCAFFOLDING_TEMPLATE_VERSIONING"], function(options){
              var versioningList = (options==null||options["DSCAFFOLDING_TEMPLATE_VERSIONING"]==null) ? [] : options["DSCAFFOLDING_TEMPLATE_VERSIONING"];
              var templateVersioning = {mapId: mapId, templateVersion: EXTENSION_VERSION};
              versioningList.push(templateVersioning);
              chrome.storage.sync.set({
                "DSCAFFOLDING_TEMPLATE_VERSIONING": versioningList
              },function(){
                location.href = "https://www.mindmeister.com/"+mapId;
              });
            });
          })
        })
      }
      else if(template=="ExplicateProblem"){
        progressBar.style.width = "100%";
        progressBar.style.borderRadius = "4px 4px 4px 4px";
        chrome.storage.sync.get(["DSCAFFOLDING_TEMPLATE_VERSIONING"], function(options){
          var versioningList = (options==null||options["DSCAFFOLDING_TEMPLATE_VERSIONING"]==null) ? [] : options["DSCAFFOLDING_TEMPLATE_VERSIONING"];
          var templateVersioning = {mapId: mapId, templateVersion: EXTENSION_VERSION};
          versioningList.push(templateVersioning);
          chrome.storage.sync.set({
            "DSCAFFOLDING_TEMPLATE_VERSIONING": versioningList
          },function(){
            location.href = "https://www.mindmeister.com/"+mapId;
          });
        });
      }
      else if(template=="ExplicateProblemNew"){
        Mindmeister.getComplexChildren(mapId).then(function(childrenIds){
          var promiseList = [];
          for(var i=0;i<childrenIds.length;i++){
            promiseList.push(Mindmeister.closeNode(mapId,childrenIds[i]));
          }
          promiseList.push(Mindmeister.setMindmapTags(mapId,["DScaffolding","ExplicateProblemNew","v0.6.3"]));
          progressBar.style.width = "100%";
          progressBar.style.borderRadius = "4px 4px 4px 4px";
          Promise.all(promiseList).then(function() {
            chrome.storage.sync.get(["DSCAFFOLDING_TEMPLATE_VERSIONING"], function(options){
              var versioningList = (options==null||options["DSCAFFOLDING_TEMPLATE_VERSIONING"]==null) ? [] : options["DSCAFFOLDING_TEMPLATE_VERSIONING"];
              var templateVersioning = {mapId: mapId, templateVersion: EXTENSION_VERSION};
              versioningList.push(templateVersioning);
              chrome.storage.sync.set({
                "DSCAFFOLDING_TEMPLATE_VERSIONING": versioningList
              },function(){
                location.href = "https://www.mindmeister.com/"+mapId;
              });
            });
          });
        })
      }
      else if(template=="RiskManagement"){
        Mindmeister.getComplexChildren(mapId).then(function(childrenIds){
          var promiseList = [];
          for(var i=0;i<childrenIds.length;i++){
            promiseList.push(Mindmeister.closeNode(mapId,childrenIds[i]));
          }
          promiseList.push(Mindmeister.setMindmapTags(mapId,["DScaffolding","RiskManagement","v0.6.3"]));
          progressBar.style.width = "100%";
          progressBar.style.borderRadius = "4px 4px 4px 4px";
          Promise.all(promiseList).then(function() {
            chrome.storage.sync.get(["DSCAFFOLDING_TEMPLATE_VERSIONING"], function(options){
              var versioningList = (options==null||options["DSCAFFOLDING_TEMPLATE_VERSIONING"]==null) ? [] : options["DSCAFFOLDING_TEMPLATE_VERSIONING"];
              var templateVersioning = {mapId: mapId, templateVersion: EXTENSION_VERSION};
              versioningList.push(templateVersioning);
              chrome.storage.sync.set({
                "DSCAFFOLDING_TEMPLATE_VERSIONING": versioningList
              },function(){
                location.href = "https://www.mindmeister.com/"+mapId;
              });
            });
          });
        })
      }
    });
  });
}

function init(){
  let target = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)")
  let templateCont = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement")
  if(target==null||templateCont==null){
    window.setTimeout(function(){
      init()
    },500)
    return
  }

  let observerFunc = () => {
    let templateContainer = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement")
    let templateContainerEnabledFlexDirection = "column"
    let templateContainerDisabledFlexDirection = "row"
    let dscaffoldingTemplate = document.querySelector("#dscaffoldingTemplate")
    if(templateContainer.style.flexDirection==templateContainerEnabledFlexDirection&&dscaffoldingTemplate!=null){
      dscaffoldingTemplate.parentNode.removeChild(dscaffoldingTemplate)
    }
    else if(templateContainer.style.flexDirection==templateContainerDisabledFlexDirection&&dscaffoldingTemplate==null){
      let dscaffoldingTemplateInsertionPoint = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement > div > div > div > div:nth-child(1)")
      if(dscaffoldingTemplateInsertionPoint==null) return
      let templateElementToClone = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement > div > div > div > div:nth-child(1) > div:nth-child(2)")
      let dscaffoldingTemplate = templateElementToClone.cloneNode(true)
      dscaffoldingTemplate.id = "dscaffoldingTemplate"
      dscaffoldingTemplate.className += " dscaffoldingTemplate"
      dscaffoldingTemplate.querySelector(".kr-text").innerText = "DScaffolding"
      let templateImage = dscaffoldingTemplate.querySelector("svg")
      let templateImageContainer = templateImage.parentNode
      templateImageContainer.removeChild(templateImage)
      let dscaffoldingTemplateImage = document.createElement("img")
      dscaffoldingTemplateImage.style.height = "44px";
      dscaffoldingTemplateImage.src = chrome.extension.getURL("images/ExplicateProblem.png")
      templateImageContainer.style.height = ""
      templateImageContainer.style.width = ""
      templateImageContainer.appendChild(dscaffoldingTemplateImage)
      dscaffoldingTemplate.addEventListener("click",function(e){
        e.preventDefault();
        e.stopPropagation();
        importTemplate("ExplicateProblemNew");
      },false);
      dscaffoldingTemplateInsertionPoint.insertBefore(dscaffoldingTemplate,dscaffoldingTemplateInsertionPoint.children[1])
    }
  }
  let obs = new MutationObserver(function(mutations){
    observerFunc()
  })
  if(templateCont!=null){
    obs.observe(templateCont.parentNode.parentNode,{
      attributes: true
    })
  }
  observerFunc()

  /*
  let observerFunc = () => {
    let newMindmapButton = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)")
    //let enabledBackgroundColor = "rgb(138, 148, 153)"
    let enabledBackgroundColor = "rgba(0, 0, 0, 0.1)"
    console.log(window.getComputedStyle(newMindmapButton))
    console.log(window.getComputedStyle(newMindmapButton).getPropertyValue('background-color'))
    let templateContainer = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement")
    let templateContainerEnabledFlexDirection = "column"
    let dscaffoldingTemplate = document.querySelector("#dscaffoldingTemplate")
    if(window.getComputedStyle(newMindmapButton).getPropertyValue('background-color')==enabledBackgroundColor&&dscaffoldingTemplate==null&&(templateContainer==null||templateContainer.style.flexDirection!=templateContainerEnabledFlexDirection)){
      let dscaffoldingTemplateInsertionPoint = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement > div > div > div > div:nth-child(1)")
      if(dscaffoldingTemplateInsertionPoint==null) return
      let templateElementToClone = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement > div > div > div > div:nth-child(1) > div:nth-child(2)")
      let dscaffoldingTemplate = templateElementToClone.cloneNode(true)
      dscaffoldingTemplate.id = "dscaffoldingTemplate"
      dscaffoldingTemplate.className += " dscaffoldingTemplate"
      dscaffoldingTemplate.querySelector(".kr-text").innerText = "DScaffolding"
      let templateImage = dscaffoldingTemplate.querySelector("svg")
      let templateImageContainer = templateImage.parentNode
      templateImageContainer.removeChild(templateImage)
      let dscaffoldingTemplateImage = document.createElement("img")
      dscaffoldingTemplateImage.style.height = "44px";
      dscaffoldingTemplateImage.src = chrome.extension.getURL("images/ExplicateProblem.png")
      templateImageContainer.style.height = ""
      templateImageContainer.style.width = ""
      templateImageContainer.appendChild(dscaffoldingTemplateImage)
      dscaffoldingTemplate.addEventListener("click",function(e){
        e.preventDefault();
        e.stopPropagation();
        importTemplate("ExplicateProblemNew");
      },false);
      dscaffoldingTemplateInsertionPoint.insertBefore(dscaffoldingTemplate,dscaffoldingTemplateInsertionPoint.children[1])
    }
    else if(newMindmapButton.style.backgroundColor!=enabledBackgroundColor&&dscaffoldingTemplate!=null){
      let dscaffoldingTemplate = document.querySelector("#dscaffoldingTemplate")
      if(dscaffoldingTemplate!=null){
        dscaffoldingTemplate.parentNode.removeChild(dscaffoldingTemplate)
      }
    }
  }
  let obs = new MutationObserver(function(mutations){
    observerFunc()
  })
  if(target!=null){
    obs.observe(target,{
      attributes: true
    })
  }
  observerFunc()
  */

  let observer = new MutationObserver(function(mutations){
    let templateCont = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement")
    let templateContainerEnabledFlexDirection = "column"
    let templateContainerDisabledFlexDirection = "row"
    let dscaffoldingTemplateContainer = document.querySelector("#dscaffoldingTemplateContainer")
    let dscaffoldingTemplate = document.querySelector("#dscaffoldingTemplate")
    if(templateCont!=null&&templateCont.style.flexDirection==templateContainerEnabledFlexDirection&&dscaffoldingTemplateContainer==null){
      let insertionPoint = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement > div > div > div:nth-child(2)")
      let nodeToClone = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement > div > div > div:nth-child(2) > div:nth-child(1)")
      let dscaffoldingTemplates = nodeToClone.cloneNode(true)
      dscaffoldingTemplates.id = "dscaffoldingTemplateContainer"
      let groupLabel = dscaffoldingTemplates.querySelector("div.kr-text")
      groupLabel.innerText = "DScaffolding"

      let innerCont = dscaffoldingTemplates.querySelector("div.kr-view")
      for(let i=innerCont.children.length-1;i>=0;i--){
        innerCont.removeChild(innerCont.children[i])
      }
      let newDiv = document.createElement("div")
      newDiv.className = "kr-view"
      newDiv.style.width = "100%"

      let templateNodeToClone = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement > div > div > div:nth-child(1) > div > div:nth-child(1) > div:nth-child(2)")

      let templatesToInsert = [{
        name: "DScaffolding",
        template: "ExplicateProblemNew",
        image: chrome.extension.getURL("images/ExplicateProblem.png")
      },
        {
          name: "Design Science",
          template: "DesignScience",
          image: chrome.extension.getURL("images/DesignScience.png")
        },
        {
          name: "Risk Management",
          template: "RiskManagement",
          image: chrome.extension.getURL("images/RiskManagement.png")
        }]

      for(let i=0;i<templatesToInsert.length;i++){
        let dscaffoldingTemplate = templateNodeToClone.cloneNode(true)
        dscaffoldingTemplate.className += " dscaffoldingTemplate"
        dscaffoldingTemplate.querySelector(".kr-text").innerText = templatesToInsert[i].name
        let templateImage = dscaffoldingTemplate.querySelector("svg")
        let templateImageContainer = templateImage.parentNode
        templateImageContainer.removeChild(templateImage)
        let dscaffoldingTemplateImage = document.createElement("img")
        dscaffoldingTemplateImage.style.height = "44px";
        dscaffoldingTemplateImage.src = templatesToInsert[i].image
        templateImageContainer.style.height = ""
        templateImageContainer.style.width = ""
        templateImageContainer.appendChild(dscaffoldingTemplateImage)
        dscaffoldingTemplate.addEventListener("click",function(e){
          e.preventDefault();
          e.stopPropagation();
          importTemplate(templatesToInsert[i].template);
        },false);
        newDiv.appendChild(dscaffoldingTemplate)
      }
      innerCont.appendChild(newDiv)

      insertionPoint.insertBefore(dscaffoldingTemplates,insertionPoint.children[0])
    }
    else if(templateCont!=null&&templateCont.style.flexDirection==templateContainerDisabledFlexDirection&&dscaffoldingTemplate==null){
      if(dscaffoldingTemplateContainer!=null) dscaffoldingTemplateContainer.parentNode.removeChild(dscaffoldingTemplateContainer)
      observerFunc()
    }
  })
  if(templateCont!=null){
    observer.observe(templateCont,{
      attributes: true
    })
  }

  let sizeCheck = () => {
    let referenceTemplateSelector = document.querySelector("#dscaffoldingTemplateContainer") == null ? "#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement > div > div > div > div:nth-child(1) > div:nth-child(1)" : "#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement > div > div > div:nth-child(1) > div > div:nth-child(1) > div:nth-child(1)"
    let referenceTemplate = document.querySelector(referenceTemplateSelector)
    if(referenceTemplate==null) return
    let dsTemplates = document.querySelectorAll(".dscaffoldingTemplate")
    for(let i=0;i<dsTemplates.length;i++){
      dsTemplates[i].style.width = referenceTemplate.style.width
    }
    if(document.querySelector("#dscaffoldingTemplateContainer") != null){
      let parent = document.querySelector("#dscaffoldingTemplateContainer > div.kr-view > div")
      parent.style.width = document.querySelector("#DOM_CONTAINER > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div > div > div.knightrider-scrollview-root > div.knightrider-scrollview-scrollelement > div > div > div:nth-child(1) > div > div").style.width
    }
  }
  window.setInterval(sizeCheck,100)
}

function showAuthorizeMessage(){
  var div = document.createElement("div");
  div.id = "DScaffoldingAuthorization";

  var part1 = document.createTextNode("To use DScaffolding you must first authorize the application. Please, open the ");
  var optionsPageLink = document.createElement("a");
  optionsPageLink.href = chrome.extension.getURL("pages/options.html");
  optionsPageLink.target = "_blank";
  optionsPageLink.appendChild(document.createTextNode("options page"));
  var part2 = document.createTextNode(" to do it");
  div.appendChild(part1);
  div.appendChild(optionsPageLink);
  div.appendChild(part2);
  div.style.padding = "15px";
  div.style.maxWidth = "300px";
  //div.style.height = "70px";
  div.style.position = "fixed";
  div.style.zIndex = "1000";
  div.style.backgroundColor = "#fff5ad";
  div.style.borderRadius = "10px 10px 10px 10px";
  div.style.border = "solid 1px #00aaff";
  div.style.top = "100px";
  div.style.left = "50px";

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
    var not = document.getElementById("DScaffoldingAuthorization");
    not.parentNode.removeChild(not);
  })
  div.appendChild(removeButton);
  document.body.appendChild(div);
}

function auth(){
  var url = window.location.href;
  if(url.startsWith("https://www.mindmeister.com/oauth2")) return;
  //if(!url.startsWith("https://www.mindmeister.com/#all")&&!url.startsWith("https://www.mindmeister.com/?filter=all#all")) return;
  var mapRegExp = /https:\/\/www\.mindmeister\.com\/\d/;
  if(mapRegExp.test(url)) return;

  chrome.runtime.sendMessage({mes: "isAuthorizedMindmeister"});
  chrome.runtime.sendMessage({mes: "getVersion"});

  chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
    if(request.mesType == "accessToken"){
      if(request.adapter == "mindmeister"){
        access_token_mindmeister = request.accessToken;
        init()
        /*setTimeout(function(){
          init();
        },2000);*/
      }
    }
    else if(request.mesType == "isAuthorized"){
      if(request.adapter == "mindmeister"){
        if(request.accessToken) chrome.runtime.sendMessage({mes: "getMindmeisterAccessToken"});
        else showAuthorizeMessage();
      }
    }
    else if(request.mesType == "extensionVersion"){
      EXTENSION_VERSION = request.version;
    }
  })
}
auth();

})();
