(function(){

  const axios = require('axios')
  const $ = require('jquery')

  const html2canvas = require("html2canvas");
  const PDFJS = require("pdfjs-dist");
  PDFJS.GlobalWorkerOptions.workerSrc = chrome.extension.getURL("libs/pdf.worker.js");

  var FileSaver = require('file-saver');
  const JSZip = require('jszip');
  const JSZipUtils = require('jszip-utils');

  const {Project,ResourceAuthor,EvidenciableElement,Author,Glossary,Term,Extract,Problem,Cause,CauseMitigation,Consequence,ConsequenceAlleviation,Stakeholder,StakeholderGoal,Measurement,Practice,Activity,Tool,Property,DescribableElement,Artefact,Component,DesignDecision,KernelTheory,Requirement,FunctionalRequirement,NonFunctionalRequirement,Justification,Goal,Opportunity,RelatedWork,Evidence,Resource,AcademicResource,WebResource,Limitation} = require('./model.js');
  const TransformationRules = require('./transformationRules.js');

  const bitap = require('bitap')

  const octokit = require('@octokit/rest')()

  const Utils = require('./utils/Utils')

// ----------------AUXILIAR VARIABLES----------------------

var DSCAFFOLDING_TEMPLATE_VERSIONING;
var LAST_UPDATE_DATE = "lastUpdateDate";
var LAST_UPDATE_DATE_HYPOTHESIS = "lastUpdateDateHypothesis";
var PALETTE_WIDGET = "paletteWidget";
var SYNCING_DESIGN_THEORY = false;
var NODE_POLL_MAPPING;
var GOOGLE_FORMS_ENABLED;

// ----------------AUXILIAR FUNCTIONS----------------------
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
  var that = this;
  var mapID;
  var userName;
  var userDeleted = false;
  var lastActions = [];
  var brainstormingMode = false;
  var revisionMode = false;

  var enableUserDeleted = function(duration){
    this.userDeleted = true;
    setTimeout(function(){
      this.userDeleted = false;
    },duration)
  }
  var getUserDeleted = function(){
    return this.userDeleted;
  }
  var manageUserDeleted = function(){
    document.addEventListener("keydown",function(e){
      if(e.keyCode==8||e.keyCode==46){ // backspace
        Scrap.enableUserDeleted(1000);
      }
    });
    var aux = document.getElementById("btn_remove");
    if(aux!=null) aux.addEventListener("click",function(e){
      Scrap.enableUserDeleted(1500);
    })
    document.addEventListener("click",function(e){
      if(e.target!=null&&e.target.id!=null&&e.target.id=="btn_menu_delete"){
        Scrap.enableUserDeleted(1000);
      }
    })
  }
  manageUserDeleted();

  var existsLastAction = function(lastAction){
    for(var i=0;i<lastActions.length;i++){
      if(JSON.stringify(lastAction)==JSON.stringify(lastActions[i])){
        return true;
      }
    }
    return false;
  }
  var insertLastAction = function(lastAction){
    lastActions.push(lastAction);
    setTimeout(function(){
      for(var i=0;i<lastActions.length;i++){
        if(JSON.stringify(lastAction)==JSON.stringify(lastActions[i])){
          lastActions.splice(i,1);
          break;
        }
      }
    },1000);
  }

  var setBrainstormingMode = function(b){
    brainstormingMode = b;
  }
  var getBrainstormingMode = function(){
    return brainstormingMode;
  }
  var manageBrainstormingMode = function(){
    var f = function(){
      var collaborators = $("#collaborators-list .i-avatar");
      for(var i=0;i<collaborators.length;i++){
        if(!collaborators[i].className.includes("o-40")){
          Scrap.setBrainstormingMode(true);
          return;
        }
      }
      Scrap.setBrainstormingMode(false);
      return;
    }
    var observer = new MutationObserver(function( mutations ) {
      mutations.forEach(f);
    });
    var config = {
      childList: true,
      attributes: true,
      subtree: true
    };
    var targetNode = $("#collaborators-list")[0];
    observer.observe(targetNode, config);
    f();
  }

  var setRevisionMode = function(r){
    revisionMode = r;
  }
  var getRevisionMode = function(){
    return revisionMode;
  }
  var manageRevisionMode = function(){
    var that = this;
    var historyButton = document.getElementById("btn_togglehistory");
    if(historyButton==null){
      setTimeout(function(){

      },500);
    }
    else{
      var observer = new MutationObserver(function(mutations){
        var history = document.getElementById("btn_togglehistory");
        if(history!=null) that.setRevisionMode(history.className.indexOf("active")!=-1);
      });
      var config = {
        attributes: true
      };
      observer.observe(historyButton,config);
    }
  }

  var Node = (function(element){
    var isOpen = function(){
      var closeButton = document.querySelector("#tk_container_"+id+" > .tk_open_container > .tk_open.open");
      if(closeButton==null) return false;
      return true;
    }
    var close = function(){
      var closeButton = $("#tk_container_"+id+" > .tk_open_container > .tk_open.open");
      if(closeButton!=null&&closeButton.length>0) {
        closeButton[0].click();
      }
    }
    var isDescendant = function(parent){
      var parentNode = $("#tk_children_"+parent.id);
      return parentNode.has(element).length > 0;
    }
    var isChild = function(parent){
      var childParent = this.getParentNode(child);
      return parent.id == childParent.id;
    }
    var getParentNode = function(){
      if(element==null||element.id==null) return null;
      if(element.className.indexOf("root_child")!=-1) return Scrap.getRootNode();
      if(element.className.indexOf("root")!=-1) return null;
      if(element.parentNode==null||element.parentNode.parentNode==null||element.parentNode.parentNode.parentNode==null) return null;
      var parentId = element.parentNode.parentNode.parentNode.id.replace("tk_children_","");
      if(parentId==null||parentId==""||parseInt(parentId)==NaN) return null;
      var aux = document.getElementById(parentId);
      return new Node(aux);
    }
    var getParentNodeId = function(){
      if(element.parentNode==null||element.parentNode.parentNode==null||element.parentNode.parentNode.parentNode==null) return null;
      if(element.parentNode.id=="auxiliarNode"||element.parentNode.parentNode.id=="auxiliarNode"||element.parentNode.parentNode.parentNode.id=="auxiliarNode") return null;
      var parentId = element.parentNode.parentNode.parentNode.id.replace("tk_children_","");
      return parentId;
    }
    var getIcons = function(){
      var iconCont = element.querySelectorAll(".tk_icon_container");
      if(iconCont==null) return [];
      var icons = [];
      for(var i=0;i<iconCont.length;i++){
        var icon = iconCont[i].getAttribute("icon-id");
        if(icon!=null) icons.push(icon);
      }
      return icons;
    }
    var getChildrenWithText = function(text){
      return Scrap.getNodesWithText(text,element);
    }
    var getChildrenWithSubText = function(text){
      return Scrap.getNodesWithSubText(text,element);
    }
    var getChildren = function(){
      if(element.className.indexOf("root_child")==-1&&element.className.indexOf("root")!=-1){
        var children = document.querySelectorAll(".root_child");
        var childList = [];
        for(var i=0;i<children.length;i++){
          var child = new Node(children[i]);
          childList.push(child);
        }
        return childList;
      }
      var selector = "div#tk_children_"+element.id+" > div.tk_container > div.tk_open_container > div.node";
      var children = document.querySelectorAll(selector);
      var childList = [];
      if(children != null && children.length > 0){
        for(var i=0;i<children.length;i++){
          var child = new Node(children[i]);
          childList.push(child);
        }
      }
      return childList;
    }
    var getDescendants = function(){
      var selector = "div#tk_children_"+element.id+" div.node";
      var children = document.querySelectorAll(selector);
      var childList = [];
      if(children != null && children.length > 0){
        for(var i=0;i<children.length;i++){
          var child = new Node(children[i]);
          childList.push(child);
        }
      }
      return childList;
    }
    var getSubtree = function(){
      var children = getChildren();
      if(children.length==0) return [];
      else{
        var subtree = [];
        for(var i=0;i<children.length;i++){
          /*if(children[i].text == "Supporting Evidences?") continue;
          if(children[i].text == "Who else addresses it?") continue;
          if(children[i].text == "Click icon to address it") continue;*/
          children[i]["subtree"] = children[i].getSubtree();
          subtree.push(children[i]);
        }
        return subtree;
      }
    }
    var onFinishEditing = function(){
      return new Promise(function(resolve, reject){
        if(element==null){
          resolve();
        }
        else if(element!=null&&(!$(element).hasClass("editing"))&&element.id!=null&&element.id>0){
          resolve();
        }
        else{
          var observer = new MutationObserver(function( mutations ) {
            if(element!=null&&(!$(element).hasClass("editing"))&&element.id!=null&&element.id>0){
              resolve();
            }
          });
          var config = {
            attributes: true,
            characterData: true
          };
          observer.observe(element,config);
        }
      })
    }
    var onChildrenAdded = function(callback,subtree){
      Scrap.onChildrenAdded(element,callback,subtree);
    }
    var onIconEdited = function(callback,self){
      self = self != null ? self : false;
      var observer = new MutationObserver(function( mutations ) {
        if(Scrap.getRevisionMode()) return;
        mutations.forEach(function(mutation) {
          if(mutation.type=="childList"&&mutation.addedNodes.length>0&&getParentNode(mutation.target)!=null){
            for(var i=0;i<mutation.addedNodes.length;i++){
              var addedNode = mutation.addedNodes[i];
              if(addedNode==null || addedNode.nodeType == 3) continue;
              var icon = addedNode.getAttribute("icon-id");
              if(icon!=null){
                var a = new Node(mutation.target);
                if(a.isLastModifiedByUser()&&!Scrap.existsLastAction({action:"iconEdit",nodeId:a.id,scope:element.id})){
                  Scrap.insertLastAction({action:"iconEdit",nodeId:a.id,scope:element.id});
                  callback.call(this,a,icon);
                  break;
                }
                //else delete a;
              }
            }
          }
        });
      });
      var config = {
        childList: true,
        subtree: true
      };
      if(self) var targetNode = $("#"+element.id)[0];
      else var targetNode = $("#tk_children_"+element.id)[0];
      observer.observe(targetNode, config);
    }
    var onEdited = function(callback,subtree){
      Scrap.onNodeEdited(element,callback,subtree);
    }
    var onChildEdited = function(callback){
      var observer = new MutationObserver(function( mutations ) {
        if(Scrap.getRevisionMode()) return;
        mutations.forEach(function(mutation) {
          if(mutation.type == "characterData"){
            var mapNode = $(mutation.target.parentNode).closest(".node, .root_child, .root").get(0);
            if(mapNode == null||mapNode.id == null) return;
            var editing = mapNode.getAttribute("ds_editing");
            if(editing==null){
              mapNode.setAttribute("ds_editing",true);
              var aux = new Node(mapNode);
              aux.onFinishEditing().then(function(){
                mapNode.removeAttribute("ds_editing");
                if(mutation.oldValue!=null&&mutation.oldValue.trim()!=""&&!Scrap.existsLastAction({action:"childEdit",nodeId:aux.id,scope:element.id})){
                  Scrap.insertLastAction({action:"childEdit",nodeId:aux.id,scope:element.id});
                  callback.call(this,aux,mutation.oldValue);
                }
              })
            }
          }
        });
      });
      var config = {
        subtree: true,
        characterData: true,
        characterDataOldValue: true
      };
      var targetNode = $("#tk_children_"+element.id)[0];
      observer.observe(targetNode, config);
    }
    var onMoved = function(callback){
      Scrap.onNodeMoved(element,callback);
    }
    var onRemoved = function(callback,includeMoved,allowedContainerNodeIdList){
      Scrap.onNodeRemoved(element,callback,includeMoved,allowedContainerNodeIdList);
    }
    var onDrag = function(callbackStart,callbackEnd,subtree){
      var observer = new MutationObserver(function( mutations ) {
        if(Scrap.getRevisionMode()) return;
        mutations.forEach(function(mutation) {
          if(mutation.type=="childList"&&mutation.addedNodes!=null&&mutation.addedNodes.length>0){
            for(var i=0;i<mutation.addedNodes.length;i++) {
              if (mutation.addedNodes[i] == null || !isElement(mutation.addedNodes[i])) continue;
              var aux = document.querySelector(".dragging");
              if (aux!=null) {
                if (subtree != null && !subtree && aux.id != element.id) return;
                var a = $("#"+aux.id+":not(.dragging)");
                var mirrorElem = a != null && a.length > 0 ? a[0] : null;
                if(mirrorElem==null||(mirrorElem.getAttribute("ds_dragging")!=null&&mirrorElem.getAttribute("ds_dragging"))) return;
                mirrorElem.setAttribute("ds_dragging",true);
                var nod = new Scrap.Node(document.getElementById(aux.id));
                callbackStart.call(this, nod);
                var obs = new MutationObserver(function(mut){
                  var fired = false;
                  mut.forEach(function(m) {
                    if(!fired && m.removedNodes != null && m.removedNodes.length > 0){
                      if(mutation.target.querySelector(".dragging")==null){
                        fired = true;
                        obs.disconnect();
                        mirrorElem.removeAttribute("ds_dragging");
                        callbackEnd.call(this);
                      }
                    }
                  });
                })
                var cfg = {
                  childList:true,
                  subtree:true
                }
                var tgt = $("#tk_container_"+mutation.addedNodes[i].id).parent().closest(".tk_container")[0];
                obs.observe(tgt,cfg);
              }
            }
          }
        });
      });
      var config = {
        childList: true,
      };
      if(subtree) config["subtree"] = true;
      var targetNode = $("#tk_container_"+element.id)[0];
      observer.observe(targetNode, config);
    }
    var getAncestors = function(){
      if(this.id==null) return [];
      var parent = getParentNode();
      if(parent==null||parent.id==null) return [];
      else return [parent].concat(parent.getAncestors());
    }
    var hasAncestor = function(text){
      var ancestors = this.getAncestors();
      for(var i=0;i<ancestors.length;i++){
        if(ancestors[i].getContent()==text) return true;
      }
      return false;
    }
    /*var getNodeAncestorsContent = function(node){
      if(node.id==null) return [];
      var parent = DScaffolding.getParentNode(node);
      if(parent==null||parent.id==null) return [];
      else return [Scrap.selectContent(parent)].concat(DScaffolding.getNodeAncestorsContent(parent));
    }*/
    var addContextMenuEntry = function(menuEntry,callback,includeSelf,excludeText,excludeDescendantsOf){
      var that = this;
      includeSelf = typeof includeSelf !== 'undefined' ? includeSelf : false;
      excludeText = typeof excludeText !== 'undefined' ? excludeText : [];
      excludeDescendantsOf = typeof excludeDescendantsOf !== 'undefined' ? excludeDescendantsOf : [];
      //var notAllowedText = ["...follows from...","...leads to...","Why?","What follows from ...?"];
      var observer = new MutationObserver(function( mutations ) {
        mutations.forEach(function(mutation) {
          var contextMenu = document.getElementById("popover_nodemenu");
          var displayed = contextMenu.style.display != null && contextMenu.style.display == "none" ? false : true;
          if(displayed){
            //var currentNodeId = Scrap.selectCurrentNode().id;
            var currentNode = getCurrentNode();
            var currentNodeText = currentNode.getContent();

            var getNContent = function(n){
              return n.getContent();
            }
            var ancestorsText = currentNode.getAncestors().map(getNContent);
            var ancestorEnabled = true;
            for(var i=0;i<excludeDescendantsOf.length;i++){
              if(ancestorsText.indexOf(excludeDescendantsOf[i])!=-1){
                ancestorEnabled = false;
                break;
              }
            }

            if(((includeSelf&&currentNode.id==element.id)||currentNode.isDescendant(that))&&(excludeText.indexOf(currentNodeText)==-1&&ancestorEnabled)){
            //if(currentNodeId==node.id){
              var aux = $("#popover_nodemenu a:contains('"+menuEntry+"')");
              if(aux==null || aux.length == 0){
                var contextMenuList = $("#popover_nodemenu > div > ul");
                if(contextMenuList!=null&&contextMenuList.length>0){
                  var li = document.createElement("li");
                  var a = document.createElement("a");
                  a.href = "#";
                  a.addEventListener("click",function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    callback.call(this,currentNode.id);
                    var contextMenu = document.getElementById("popover_nodemenu");
                    contextMenu.style.display = "none";
                  },true);
                  a.innerText = menuEntry;
                  li.appendChild(a);
                  contextMenuList[0].appendChild(li);
                }
              }
            }
          }
        });
      });
      var config = {
        attributes: true
      };
      var targetNode = $("#popover_nodemenu")[0];
      observer.observe(targetNode, config);
    }
    var getContent = function(){
      return getNodeContent(element);
    }
    var getLastModifier = function(){
      return getNodeLastModifier(element);
    }
    var isLastModifiedByUser = function(){
      var modifiedMessage = getLastModifier();
      return modifiedMessage.includes(Scrap.userName);
    }
    var id = element.id;
    var reloadId = function(){
      id = element.id;
    }
    /*var content = that.getContent(element);
    var icons = getIcons(element);
    var htmlElem = element;*/
    var getHTMLElement = function(){
      var e = document.getElementById(element.id);
      return e;
    }
    var getChildrenWithIcon = function(i){
      var c = [];
      var children = this.getChildren();
      for(var j=0;j<children.length;j++){
        if(children[j].getIcons().indexOf(i)!=-1){
          c.push(children[j]);
        }
      }
      return c;
    }
    var hasLink = function(){
      var a = document.getElementById(element.id+"_link");
      if(a!=null) return true;
      return false;
    }
    var getLink = function(){
      var a = document.getElementById(element.id+"_link");
      if(a!=null) return a["href"];
      return null;
    }
    var setNodeContent = function(content){
      var e = document.getElementById(element.id);
      if(e==null) return;
      var t = e.querySelector(".tk_title");
      if(t==null) return;
      t.innerText = content;
    }
    return {
      isOpen: isOpen,
      close: close,
      id: id,
      getHTMLElement: getHTMLElement,
      getContent: getContent,
      getIcons: getIcons,
      isDescendant: isDescendant,
      isChild: isChild,
      getParentNode: getParentNode,
      getParentNodeId: getParentNodeId,
      getChildrenWithText: getChildrenWithText,
      getChildrenWithSubText: getChildrenWithSubText,
      getChildren: getChildren,
      getSubtree: getSubtree,
      onChildrenAdded: onChildrenAdded,
      onIconEdited: onIconEdited,
      onEdited: onEdited,
      onChildEdited: onChildEdited,
      onMoved: onMoved,
      onRemoved: onRemoved,
      onFinishEditing: onFinishEditing,
      getAncestors: getAncestors,
      reloadId: reloadId,
      addContextMenuEntry: addContextMenuEntry,
      hasAncestor: hasAncestor,
      getChildrenWithIcon: getChildrenWithIcon,
      getDescendants: getDescendants,
      hasLink: hasLink,
      getLink: getLink,
      getLastModifier: getLastModifier,
      isLastModifiedByUser: isLastModifiedByUser,
      onDrag: onDrag,
      setNodeContent: setNodeContent
    }
  });

  var getNodeContent = function(elem){
    var contentContainer = $(elem).find(".tk_title")[0];
    if(contentContainer==null) return null;
    return contentContainer.innerHTML.replace(/<br[^>]*>/gi," ").replace("&nbsp;"," ").replace("&amp;","&");
  }
  var getNodeLastModifier = function(elem){
    var contentContainer = $(elem).find(".tk_title")[0];
    if(contentContainer==null||contentContainer.getAttribute("title")==null) return null;
    return contentContainer.getAttribute("title")/*.replace(/Modified by /i,"").replace(/ on \d\d\/\d\d\/\d\d\d\d/i,"")*/;
  }
  var executeXPath = function(xpath,node){
    var contextNode = node != null ? node : document;
    var xpathResult = document.evaluate( xpath, contextNode, null, XPathResult.ANY_TYPE, null );
    if(xpathResult.resultType == XPathResult.UNORDERED_NODE_ITERATOR_TYPE){
      var thisNode = xpathResult.iterateNext();
      return thisNode;
    }
    else{
      return xpathResult.stringValue;
    }
  }
  /*cambiar*/var getEditingNode = function(){
    var xpath = "//div[contains(@class, 'editing')]";
    var b = executeXPath(xpath);
    if(b!=null) return new Node(b);
    return null;
  }
  /*cambiar*/var getCurrentNode = function(){
    var xpath = "//div[contains(@class, 'current')]";
    var b = executeXPath(xpath);
    if(b!=null) return new Node(b);
    return null;
  }
  /*cambiar*/var getRootNode = function(){
    var xpath = "//div[@id='tk_rootcontainer']/div[contains(@class, 'root')]";
    var a = executeXPath(xpath);
    if(a!=null&&a!="") return new Node(a);
    var xpath2 = "//div[@id='canvas']/div[contains(@class, 'root')]";
    var b = executeXPath(xpath2);
    if(b!=null) return new Node(b);
    return null;
  }
  var getMapId = function(){
    var xpath = "string(//div[@id='tk_rootcontainer']/div[contains(@class, 'root')]/@id)";
    var a = executeXPath(xpath);
    if(a!=null&&a!="") return a;
    var xpath2 = "string(//div[@id='canvas']/div[contains(@class, 'root')]/@id)";
    var b = executeXPath(xpath2);
    if(b!=null) return b;
    return null;
  }
  var getIsShared = function(){
    var colaboratorListDiv = document.querySelector("#collaborators-list");
    if(colaboratorListDiv==null) return false;
    else if(colaboratorListDiv.children.length==0) return false;
    return true;
    //return (document.querySelector("#current_users div") != null);
  }
  /*var selectExistsNode = function(nodeID){
    return (document.getElementById(nodeID) != null);
  }*/
  var getNodesByBackgroundColor = function(color){
    var node = $('.root, .root_child, .node').filter(function() {
      var match = 'rgb('+color.red+', '+color.green+', '+color.blue+')';
      return ( $(this).css('background-color') == match );
    })
    if(node==null||node.length==0) return null;
    var nodeList = [];
    for(var i=0;i<node.length;i++){
      nodeList.push(new Node(node[i]));
    }
    return nodeList;
  }
  var getNodesWithText = function(text,node){
    node = typeof node !== 'undefined' ? node : null;
    if(text==null||text=="") return [];
    var childContainer = node==null ? document : document.getElementById("tk_children_"+node.id);
    if(childContainer==null) return [];
    var childNodes = childContainer.querySelectorAll(".node,.root_child,.root");
    var childList = [];
    for(var i=0;i<childNodes.length;i++){
      if(getNodeContent(childNodes[i])==text) {
        childList.push(new Node(childNodes[i]));
      }
    }
    return childList;
  }
  var getNodesWithSubText = function(text,node){
    node = typeof node !== 'undefined' ? node : null;
    if(text==null||text=="") return [];
    var childContainer = node==null ? document : document.getElementById("tk_children_"+node.id);
    if(childContainer==null) return [];
    var childNodes = childContainer.querySelectorAll(".node,.root_child,.root");
    var childList = [];
    for(var i=0;i<childNodes.length;i++){
      if(getNodeContent(childNodes[i])!=null&&getNodeContent(childNodes[i]).indexOf(text)!=-1) {
        childList.push(new Node(childNodes[i]));
      }
    }
    return childList;
  }
  var getNodeById = function(nodeId){
    var elem = document.getElementById(nodeId);
    if(elem==null) return null;
    var node = new Node(elem);
    return node;
  }
  var isElement = function(o){
    return (
      typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
      o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName==="string"
    );
  }
  var onChildrenAdded = function(node,callback,subtree){
    subtree = typeof subtree !== 'undefined' ? subtree : false;
    var allMap = node==null ? true : false;
    var observer = new MutationObserver(function( mutations ) {
      if(Scrap.getRevisionMode()) return;
      mutations.forEach(function(mutation) {
        if(mutation.type=="childList"&&mutation.addedNodes!=null&&mutation.addedNodes.length>0){
          var aux = [];
          for(var i=0;i<mutation.addedNodes.length;i++){
            if(mutation.addedNodes[i]==null||!isElement(mutation.addedNodes[i])) continue;
            var newNodes = mutation.addedNodes[i].querySelectorAll("div.node, div.root_child, div.root");
            if(newNodes.length>0){
              for(var j=0;j</*newNodes.length*/1;j++){
                if(newNodes[j].id==null) continue;
                var nod = new Scrap.Node(newNodes[j]);
                (function(n,auxNode){
                  n.onFinishEditing().then(function(){
                    var nodeId = n.getHTMLElement().id;
                    var newNode = new Scrap.getNodeById(nodeId);
                    //delete n;
                    var auxScope = auxNode != null ? auxNode.id : "map";
                    if(newNode.isLastModifiedByUser()&&!Scrap.existsLastAction({action:"insert",nodeId:nodeId,scope:auxScope})){
                      Scrap.insertLastAction({action:"insert",nodeId:nodeId,scope:auxScope});
                      callback.call(this,[newNode]);
                    }
                  }).catch(function(){
                    // TODO
                  });
                })(nod,node);
              }
            }
          }
          //callback.call(this,mutation.addedNodes);
        }
      });
    });
    var config = {
      childList: true
    };
    if(subtree) config["subtree"] = true;
    if($("#tk_map")!=null&&$("#tk_map").length>0) var targetNode = allMap ? $("#tk_map")[0] : $("#tk_children_"+node.id)[0];
    else var targetNode = allMap ? $("#canvas")[0] : $("#tk_children_"+node.id)[0];
    //var targetNode = $("#tk_children_"+node.id)[0];
    observer.observe(targetNode, config);
  }
  var onNodeEdited = function(node,callback,subtree){
    var observer = new MutationObserver(function( mutations ) {
      if(Scrap.getRevisionMode()) return;
      mutations.forEach(function(mutation) {
        if(mutation.type == "characterData"|| (mutation.type == "childList"&&mutation.addedNodes.length==0&&mutation.removedNodes.length==1&&mutation.target!=null&&mutation.target.className!=null&&typeof(mutation.target.className)==="string"&&mutation.target.className.indexOf("tk_title")!=-1&&mutation.removedNodes[0].nodeType==3)){
          var mapNode = $(mutation.target.parentNode).closest(".node, .root, .root_child").get(0);
          if(mapNode == null||mapNode.id == null) return;
          var editing = mapNode.getAttribute("ds_editingE");
          var editingScope = mapNode.getAttribute("ds_editingScope");
          var currentScope = node==null ? null : node.id;
          if(editing==null||editingScope==null||editingScope.indexOf(currentScope)==-1){
            if(editing==null) mapNode.setAttribute("ds_editingE",true);
            if(editingScope==null) mapNode.setAttribute("ds_editingScope",currentScope);
            else if(editingScope.indexOf(currentScope)==-1) mapNode.setAttribute("ds_editingScope",mapNode.getAttribute("ds_editingScope")+" "+currentScope);
            var aux = new Node(mapNode);
            aux.onFinishEditing().then(function(){
              var oldValue;
              if(mutation.type=="characterData") oldValue = mutation.oldValue;
              else if(mutation.type=="childList") oldValue = mutation.removedNodes[0].textContent;
              mapNode.removeAttribute("ds_editingE");
              if(mapNode.getAttribute("ds_editingScope")==currentScope) mapNode.removeAttribute("ds_editingScope");
              else mapNode.setAttribute("ds_editingScope",mapNode.getAttribute("ds_editingScope").replace(currentScope,"").trim());
              if(oldValue!=null&&oldValue.trim()!=""){
                var auxScope = node != null ? node.id : "map";
                if(aux.isLastModifiedByUser()&&!Scrap.existsLastAction({action:"edit",nodeId:aux.id,content:aux.getContent(),scope:auxScope})){
                  Scrap.insertLastAction({action:"edit",nodeId:aux.id,content:aux.getContent(),scope:auxScope});
                  callback.call(this,aux,oldValue);
                }
              }
            })
          }
        }
      });
    });
    var config = {
      childList: true,
      characterData: true,
      characterDataOldValue: true,
      subtree: true
    };
    var targetNode;
    if(node==null){
      if($("#tk_map")!=null&&$("#tk_map").length>0) targetNode = $("#tk_map")[0];
      else targetNode = $("#canvas")[0];
      //targetNode = $("#tk_map")[0];
    }
    else if(subtree) targetNode = $("#tk_container_"+node.id)[0];
    else targetNode = $("#"+node.id)[0];
    observer.observe(targetNode, config);
  }
  var onNodeMoved = function(node,callback){
    if($("#tk_map")!=null&&$("#tk_map").length>0) var targetNode = node==null ? $("#tk_map")[0] : $("#tk_children_"+node.id)[0];
    else var targetNode = node==null ? $("#canvas")[0] : $("#tk_children_"+node.id)[0];

    //var targetNode = allMap ? $("#tk_map")[0] : $("#tk_children_"+node.id)[0];
    var observer = new MutationObserver(function( mutations ) {
      if(Scrap.getRevisionMode()) return;
      mutations.forEach(function(mutation) {
        //var map = document.getElementById("tk_map");
        if(mutation.type == "childList"){
          if(mutation.removedNodes != null && mutation.removedNodes.length > 0){
            var parentNode = document.getElementById(mutation.target.id.replace("tk_children_",""));
            if(parentNode!=null){
              var movedNodes = [];
              for(var i=0;i<mutation.removedNodes.length;i++){
                var lag = document.createElement("div");
                lag.innerHTML = mutation.removedNodes[i].innerHTML;
                var nodeList = lag.querySelectorAll(".node");
                for(var j=0;j<nodeList.length;j++){
                  var nodeId = nodeList[j].id;
                  var newNode = document.getElementById(nodeId);
                  if(newNode!=null&&lag.querySelector("#tk_container_"+nodeId)==null){
                    var a = new Node(nodeList[j]);
                    var auxScope = node != null ? node.id : "map";
                    if(a.isLastModifiedByUser()&&!Scrap.existsLastAction({action:"move",nodeId:a.id,scope:auxScope})){
                      Scrap.insertLastAction({action:"move",nodeId:a.id,scope:auxScope});
                      movedNodes.push({node: a/*Node(nodeList[j].id*/, newParentId: new Scrap.Node(newNode).getParentNode().id});
                    }
                    //else delete a;
                  }
                }
              }
              callback.call(this,movedNodes,new Node(parentNode));
            }
          }
        }
      });
    });
    var config = {
      subtree: true,
      childList: true
    };
    //var targetNode = $("#tk_children_"+node.id)[0];
    observer.observe(targetNode, config);
  }
  var onNodeRemoved = function(node,callback,includeMoved,allowedContainerNodeIdList){
    //var targetNode = allMap ? $("#tk_map")[0] : $("#tk_children_"+node.id)[0];
    if($("#tk_map")!=null&&$("#tk_map").length>0) var targetNode = node==null ? $("#tk_map")[0] : $("#tk_children_"+node.id)[0];
    else var targetNode = node==null ? $("#canvas")[0] : $("#tk_children_"+node.id)[0];

    includeMoved = typeof includeMoved !== 'undefined' ? includeMoved : true;
    var observer = new MutationObserver(function( mutations ) {
      if(Scrap.getRevisionMode()) return;
      mutations.forEach(function(mutation) {
        if(mutation.type == "childList"){
          if(mutation.removedNodes != null && mutation.removedNodes.length > 0 && Scrap.getUserDeleted()){
            var parentNode = document.getElementById(mutation.target.id.replace("tk_children_",""));
            if(parentNode==null) return;
            var aux = new Node(parentNode);
            var removedNodes = [];
            for(var i=0;i<mutation.removedNodes.length;i++){
              var lag = document.createElement("div");
              lag.innerHTML = mutation.removedNodes[i].innerHTML;
              var nodeList = lag.querySelectorAll(".node,.root_child");
              for(var j=0;j<nodeList.length;j++){
                var nodeId = nodeList[j].id;
                if(allowedContainerNodeIdList!=null){
                  if(Array.isArray(allowedContainerNodeIdList)){
                    var newNode = null;
                    for(var w=0;w<allowedContainerNodeIdList.length;w++){
                      if($("#tk_children_"+allowedContainerNodeIdList[w]+" #"+nodeId).length>0){
                        var newNode = $("#tk_children_"+allowedContainerNodeIdList[w]+" #"+nodeId);
                        break;
                      }
                    }
                  }
                  else{
                    var newNode = $("#tk_children_"+allowedContainerNodeIdList+" #"+nodeId);
                  }
                }
                else var newNode = null;
                if(includeMoved||newNode==null||newNode.length==0){
                  var auxScope = node != null ? node.id : "map";
                  if(!Scrap.existsLastAction({action:"remove",nodeId:nodeId,scope:auxScope})){
                    Scrap.insertLastAction({action:"remove",nodeId:nodeId,scope:auxScope});
                    var nodeContent = nodeList[j].innerText;
                    removedNodes.push(nodeContent);
                  }
                }
              }
            }
            if(removedNodes.length>0){
              callback.call(this,removedNodes,aux);
            }
          }
        }
      });
    });
    var config = {
      subtree: true,
      childList: true
    };
    observer.observe(targetNode, config);
  }
  var focusNode = function(nodeId){
    if(nodeId==null) return;
    var node = $("#"+nodeId);
    if(node!=null){
      node.trigger("click");
      nodeId = null;
    }
    else{
      setTimeout(function(){
        Scrap.focusNode(nodeId)
      },500);
    }
  }
  var reloadCanvas = function(hide,changes,revision,focusNodeId,aux){
    hide = typeof hide !== 'undefined' ? hide : true;
    aux = typeof aux !== 'undefined' ? aux : true;
    if(changes.length > 0){
      var max_stack = 20; // TO MANAGE
      for(var i=0;i<changes.length;i++){
        if(changes[i]["new_data"]!=null&&changes[i]["new_data"]["style"]!=null&&changes[i]["new_data"]["style"]["fonts"]==null){
          changes[i]["new_data"]["style"]["fonts"] = [];
        }
      }
      var script = document.createElement('script');
      script.className = "dscaffoldingScript";
      var codeText = "";
      codeText += 'App.tree.revision='+revision+';';
      codeText += 'ChangeList.executeServerChanges('+JSON.stringify(changes)+');';
      var code = document.createTextNode(codeText);
      script.appendChild(code);
      document.body.appendChild(script);
      if(aux&&SYNCING_DESIGN_THEORY) SYNCING_DESIGN_THEORY = false;
      setTimeout(function(){
        var dsScripts = document.body.getElementsByClassName("dscaffoldingScript");
        for(var j=0;j<dsScripts.length;j++){
          dsScripts[j].parentNode.removeChild(dsScripts[j]);
        }
      },5000);
    }
    if(focusNodeId!=null) focusNode(focusNodeId);
    if(hide){
      hideWorkingMessage();
    }
  }
  var showWorkingMessage = function(message){
    var l = document.getElementById("DScaffoldingWorking");
    if(l!=null) return;
    var div = document.createElement("div");
    div.id = "DScaffoldingWorking";
    //div.setAttribute("remaining",1);
    var messageCont = document.createElement("div");
    messageCont.style.marginTop = "10px";
    messageCont.style.marginLeft = "10px";
    messageCont.style.marginRight = "20px";
    var part1 = document.createTextNode("Working... Please don't edit the map");
    messageCont.appendChild(part1);
    div.appendChild(messageCont);
    div.style.color = "#ffffff";
    div.style.fontWeight = "bold";
    div.style.padding = "5px";
    //div.style.width = "300px";
    div.style.height = "40px";
    div.style.position = "fixed";
    div.style.zIndex = "1000";
    div.style.backgroundColor = "#3e30ba";
    div.style.borderRadius = "10px 10px 10px 10px";
    div.style.border = "solid 1px #606060";
    div.style.bottom = "50px";
    div.style.left = "50px";
    document.body.appendChild(div);
  }
  var hideWorkingMessage = function(){
    var mes = document.getElementById("DScaffoldingWorking");
    if(mes!=null) mes.parentNode.removeChild(mes);
  }
  var showMessage = function(message,includeCloseButton,messageId){
    var div = document.createElement("div");
    div.className = "DScaffoldingNotification";
    if(messageId!=null) div.id = messageId;
    var messageCont = document.createElement("div");
    messageCont.style.marginTop = "10px";
    messageCont.style.marginLeft = "10px";
    messageCont.style.marginRight = "20px";
    /*var part1 = document.createTextNode("There are no more colors available.");
    var part1 = document.createTextNode("To use DScaffolding you must first authorize the application. Please, open the ");
    var optionsPageLink = document.createElement("a");
    optionsPageLink.href = chrome.extension.getURL("Options/options.html");
    optionsPageLink.target = "_blank";
    optionsPageLink.appendChild(document.createTextNode("options page"));
    var part2 = document.createTextNode(" to do it");
    messageCont.appendChild(optionsPageLink);
    messageCont.appendChild(part2);
    */
    var part1 = document.createTextNode(message);
    messageCont.appendChild(part1);
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
    var aux = includeCloseButton != null ? includeCloseButton : true;
    if(aux){
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
        //var not = document.getElementById("DScaffoldingNotification");
        //not.parentNode.removeChild(not);
        div.parentNode.removeChild(div);
      })
      div.appendChild(removeButton);
    }
    document.body.appendChild(div);
  }
  var removeMessage = function(messageId){
    var a = document.getElementById(messageId);
    if(a==null) return;
    a.parentNode.removeChild(a);
  }
  var showConfirmationMessage = function(message,onAccept,onCancel,acceptText,cancelText){
    acceptText = acceptText != null ? acceptText : "Accept";
    cancelText = cancelText != null ? cancelText : "Cancel";
    var div = document.createElement("div");
    div.id = "DScaffoldingNotification";
    var messageCont = document.createElement("div");
    messageCont.style.marginTop = "10px";
    messageCont.style.marginLeft = "10px";
    messageCont.style.marginRight = "20px";
    var part1 = document.createTextNode(message);
    messageCont.appendChild(part1);
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
    var buttonContainer = document.createElement("div");
    buttonContainer.style.marginLeft = "10px";
    buttonContainer.style.marginTop = "10px";
    var acceptButton = document.createElement("div");
    acceptButton.style.backgroundColor = "rgb(255, 246, 204)";
    acceptButton.style.borderRadius = "6px";
    acceptButton.style.display = "inline-block";
    acceptButton.style.cursor = "pointer";
    acceptButton.style.color = "#333333";
    acceptButton.style.fontWeight = "bold";
    acceptButton.style.padding = "6px 24px";
    acceptButton.style.fontSize = "12px";
    acceptButton.style.marginRight = "10px";
    acceptButton.addEventListener("mouseout",function(){
      acceptButton.style.backgroundColor = "rgb(255, 246, 204)";
    })
    acceptButton.addEventListener("mouseover",function(){
      acceptButton.style.backgroundColor = "#ffff00";
    })
    acceptButton.addEventListener("click",function(){
      onAccept.call();
      var not = document.getElementById("DScaffoldingNotification");
      not.parentNode.removeChild(not);
    });

    var acceptButtonText = document.createTextNode(acceptText);
    acceptButton.appendChild(acceptButtonText);
    var cancelButton = document.createElement("div");
    cancelButton.style.backgroundColor = "rgb(255, 246, 204)";
    cancelButton.style.borderRadius = "6px";
    cancelButton.style.display = "inline-block";
    cancelButton.style.cursor = "pointer";
    cancelButton.style.color = "#333333";
    cancelButton.style.fontWeight = "bold";
    cancelButton.style.padding = "6px 24px";
    cancelButton.style.fontSize = "12px";
    cancelButton.style.marginRight = "20px";
    cancelButton.addEventListener("mouseout",function(){
      cancelButton.style.backgroundColor = "rgb(255, 246, 204)";
    })
    cancelButton.addEventListener("mouseover",function(){
      cancelButton.style.backgroundColor = "#ffff00";
    })
    cancelButton.addEventListener("click",function(){
      onCancel.call();
      var not = document.getElementById("DScaffoldingNotification");
      not.parentNode.removeChild(not);
    });

    var cancelButtonText = document.createTextNode(cancelText);
    cancelButton.appendChild(cancelButtonText);
    buttonContainer.appendChild(acceptButton);
    buttonContainer.appendChild(cancelButton);
    div.appendChild(buttonContainer);
    document.body.appendChild(div);
  }
  var getExistsNode = function(nodeId){
    var a = getNodeById(nodeId);
    if(a==null) return false;
    return true;
  }
  var onMapLoad = function(){
    return new Promise(function(resolve,reject){
      var aux = getMapId();
      if(aux==null||aux==""||parseInt(aux)==NaN){
        var c = function(){
          Scrap.onMapLoad().then(function(){
            resolve();
          })
        }
        setTimeout(c,500);
      }
      else{
        Scrap.mapID = aux;
        Scrap.manageBrainstormingMode();
        Scrap.manageRevisionMode();
        resolve();
      }
    });
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
  var showRefreshAccessTokenMessage = function(adapter){
    var div = document.createElement("div");
    div.id = "DScaffoldingNotification";
    var messageCont = document.createElement("div");
    messageCont.style.marginTop = "10px";
    messageCont.style.marginLeft = "10px";
    messageCont.style.marginRight = "20px";
    var part1 = document.createTextNode("Due to a change in "+adapter+"'s Terms and Conditions, you must re-authorize the application. Please, open the ");
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
  var setUserName = function(userName){
    this.userName = userName;
  }
  var getUserName = function(){
    return userName;
  }
  //var mapID = getMapId();

  return {
    mapID: mapID,
    getEditingNode: getEditingNode,
    getCurrentNode: getCurrentNode,
    getRootNode: getRootNode,
    getIsShared: getIsShared,
    getExistsNode: getExistsNode,
    getNodesWithText: getNodesWithText,
    getNodesWithSubText: getNodesWithSubText,
    getNodesByBackgroundColor: getNodesByBackgroundColor,
    getNodeById: getNodeById,
    onChildrenAdded: onChildrenAdded,
    onNodeEdited: onNodeEdited,
    onNodeMoved: onNodeMoved,
    onNodeRemoved: onNodeRemoved,
    reloadCanvas: reloadCanvas,
    showMessage: showMessage,
    hideWorkingMessage: hideWorkingMessage,
    showWorkingMessage: showWorkingMessage,
    onMapLoad: onMapLoad,
    Node: Node,
    focusNode: focusNode,
    showConfirmationMessage: showConfirmationMessage,
    showAuthorizeMessage: showAuthorizeMessage,
    showAccessTokenLostMessage: showAccessTokenLostMessage,
    setUserName: setUserName,
    getUserName: getUserName,
    getUserDeleted: getUserDeleted,
    enableUserDeleted: enableUserDeleted,
    insertLastAction: insertLastAction,
    existsLastAction: existsLastAction,
    setBrainstormingMode: setBrainstormingMode,
    getBrainstormingMode: getBrainstormingMode,
    manageBrainstormingMode: manageBrainstormingMode,
    removeMessage: removeMessage,
    showRefreshAccessTokenMessage: showRefreshAccessTokenMessage,
    setRevisionMode: setRevisionMode,
    getRevisionMode: getRevisionMode,
    manageRevisionMode: manageRevisionMode
  }
})();

// ----------------PALETTE----------------------------------
  var Palette = (function (){
    var loadPurposes = function(purposeList){
      if(document.getElementById("mendeleycolors")==null){
        setTimeout(function(){
          Palette.loadPurposes(purposeList);
        },500);
        return;
      }
      for(var i=0;i<purposeList.length;i++){
        var colorLabelElem = document.querySelector('.selectedColor[color="'+purposeList[i].color+'"]');
        var colorLabelElem2 = document.querySelector('.selectedColorTE[color="'+purposeList[i].color+'"]');
        if(colorLabelElem!=null){
          var colorLabel = colorLabelElem.querySelector(".colorLabel");
          colorLabel.innerHTML = purposeList[i].label;
          colorLabelElem.style.display = "block";
          var colorLabel2 = colorLabelElem2.querySelector(".colorLabel");
          colorLabel2.innerHTML = purposeList[i].label;
          colorLabelElem2.style.display = "block";
          var colorButton = document.querySelector('.mendeleyColorButton[color="'+purposeList[i].color+'"]');
          colorButton.parentNode.style.display = "none";
        }
      }
    }
    var insertPurpose = function(purpose) {
      var colorLabelElem = document.querySelector('.selectedColor[color="' + purpose.color + '"]');
      colorLabelElem.querySelector(".colorLabel").innerHTML = purpose.label;
      colorLabelElem.style.display = "block";
      var colorButton = document.querySelector('.mendeleyColorButton[color="' + purpose.color + '"]');
      colorButton.parentNode.style.display = "none";
    }
    var updatePurpose = function(purpose){
      var colorLabelElem = document.querySelector('.selectedColor[color="'+purpose.color+'"]');
      colorLabelElem.querySelector(".colorLabel").innerHTML = purpose.label;
      colorLabelElem.style.display = "block";
      var colorButton = document.querySelector('.mendeleyColorButton[color="'+purpose.color+'"]');
      colorButton.parentNode.style.display = "none";
    }
    var removePurpose = function(purpose){
      var colorLabelElem = document.querySelector('.selectedColor[color="'+purpose.color+'"]');
      colorLabelElem.querySelector(".colorLabel").innerHTML = "";
      colorLabelElem.style.display = "none";
      var colorButton = document.querySelector('.mendeleyColorButton[color="'+purpose.color+'"]');
      colorButton.parentNode.style.display = "inline-block";
    }
    return {
      loadPurposes: loadPurposes,
      insertPurpose: insertPurpose,
      updatePurpose: updatePurpose,
      removePurpose: removePurpose
    }
  })();

// ----------------MENDELEY---------------------------------

var Mendeley = (function (){
  let _accessToken = null
  let _enabled = false
  let _syncMode = "folder"
  let _folderManagementEnabled = false
  let isFolderManagementEnabled = function(){
    return this._folderManagementEnabled
  }
  let setFolderManagementEnabled = function(enabled){
    this._folderManagementEnabled = enabled
  }
  let getSyncMode = function(){
    return this._syncMode
  }
  let setSyncMode = function(mode){
    this._syncMode = mode
  }
  let setAccessToken = function(token){
    this._accessToken = token
  }
  let getAccessToken = function(){
    return this._accessToken
  }
  let setEnabled = function(enabled){
    this._enabled = enabled
  }
  let isEnabled = function(){
    return this._enabled
  }
  var selectLastUpdateDate = function(mapId){
    var mapInfo = localStorage[mapId] != null ? JSON.parse(localStorage[mapId]) : {};
    var lastUpdateDate;
    if(mapInfo[LAST_UPDATE_DATE] == null){
      var d = new Date();
      //d.setTime(0); // The first time the map is opened no annotation is imported
      lastUpdateDate = d.toISOString();
    }
    else{
      lastUpdateDate = mapInfo[LAST_UPDATE_DATE];
    }
    return lastUpdateDate;
  }
  var updateLastUpdateDate = function(lastUpdateDate,mapId){
    var mapInfo = localStorage[mapId] != null ? JSON.parse(localStorage[mapId]) : {};
    mapInfo[LAST_UPDATE_DATE] = lastUpdateDate;
    localStorage[mapId] = JSON.stringify(mapInfo);
  }
  var getGroupFolders = function(groupId,marker){
    var that = this;
    return new Promise(function (resolve, reject){
      var limit = 500;
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/folders/",
        headers: {
          'Authorization': "Bearer "+that._accessToken
        },
        params: {
          limit: limit,
          group_id: groupId
        }
      }
      if(marker!=null) opts.params["marker"] = marker;
      makeRequest(opts).then(function (response){
        var rsp = JSON.parse(response.responseText);
        if(rsp.length==limit) return rsp.concat(that.getGroupFolders(groupId,rsp[limit-1].id));
        else resolve(rsp);
      });
    })
  }
  var getUserGroups = function(marker){
    let that = this
    return new Promise(function(resolve,reject){
      var limit = 500;
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/groups/v2",
        headers: {
          'Authorization': "Bearer "+that._accessToken
        },
        params: {
          limit: limit
        }
      }
      if(marker!=null) opts.params["marker"] = marker;
      makeRequest(opts).then(function (response){
        var rsp = JSON.parse(response.responseText);
        if(rsp.length==limit) return rsp.concat(that.getUserGroups(rsp[limit-1].id));
        else resolve(rsp);
      });
    })
  }
  var searchFolderInGroups = function(folderName){
    let that = this
    return new Promise(function(resolve,reject){
      that.getUserGroups().then(function(groups){
        let pL = []
        for(let i=0;i<groups.length;i++){
          pL.push(that.getGroupFolders(groups[i].id))
        }
        Promise.all(pL).then(function(folders){
          for(let j=0;j<folders.length;j++){
            let foundFolder = folders[j].find((el) => {return el.name == folderName})
            if(foundFolder != null) {
              resolve({groupId:groups[j].id,folderId:foundFolder.id})
              return
            }
          }
          resolve(null)
        })
      })
    })
  }
  var selectFolder = function(folderName,marker){
    var that = this;
    return new Promise(function (resolve, reject){
      var limit = 500;
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/folders/",
        headers: {
          'Authorization': "Bearer "+that._accessToken
        },
        params: {
          limit: limit
        }
      }
      if(marker!=null) opts.params["marker"] = marker;
      makeRequest(opts).then(function (response){
        var rsp = JSON.parse(response.responseText);
        var foundFolder = rsp.find((el) => {return el.name==folderName});
        if(foundFolder!=null) resolve(foundFolder.id);
        else if(rsp.length==limit) return that.selectFolder(folderName,rsp[limit-1].id);
        else resolve(null);
      });
    })
  }
  var selectFolderDocuments = function(groupId,folderId,marker){
    var that = this;
    return new Promise(function (resolve, reject){
      var limit = 500;
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/folders/"+folderId+"/documents",
        headers: {
          'Authorization': "Bearer "+that._accessToken
        },
        params: {
          limit: limit
        }
      }
      if(marker!=null) opts.params["marker"] = marker;
      if(groupId!=null) opts.params["group_id"] = groupId;
      makeRequest(opts).then(function (response){
        var documentList = JSON.parse(response.responseText).map((el) => {return el.id});
        if(documentList.length==limit){
          that.selectFolderDocuments(groupId,folderId,documentList[limit-1]).then(function (ret){
            resolve(documentList.concat(ret));
          });
        }
        else resolve(documentList);
      });
    })
  }
  /*var selectGroupFolderDocuments = function(groupId,folderId,marker){
    var that = this;
    return new Promise(function (resolve, reject){
      var limit = 500;
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/documents",
        headers: {
          'Authorization': "Bearer "+that._accessToken
        },
        params: {
          limit: limit,
          folder_id: folderId,
          group_id: groupId
        }
      }
      if(marker!=null) opts.params["marker"] = marker;
      makeRequest(opts).then(function (response){
        var documentList = JSON.parse(response.responseText).map((el) => {return el.id});
        if(documentList.length==limit){
          that.selectGroupFolderDocuments(folderId,documentList[limit-1]).then(function (ret){
            resolve(documentList.concat(ret));
          });
        }
        else resolve(documentList);
      });
    })
  }*/
  var selectTagDocuments = function(tag){
    let that = this
    return new Promise(function (resolve, reject){
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/search/documents",
        headers: {
          'Authorization': "Bearer "+that._accessToken
        },
        params: {
          tag: tag
        }
      }
      makeRequest(opts).then(function (response){
        var documentList = JSON.parse(response.responseText).map((el) => {return el.id});
        resolve(documentList);
      });
    })
  }
  let parsePdfFile = function (fileId,annotations){
    var that = this;
    return new Promise(function (resolve, reject) {
      if (annotations.length == 0) {
        resolve([])
        return
      }
      if(annotations.length>0){
        chrome.runtime.sendMessage({mes:"parsePdfFile",fileId:fileId,accessToken:that.getAccessToken()},(response) => {
          let pdfData = atob(response.data)
          //PDFJS.getDocument({url: "https://api.mendeley.com/files/" + fileId + "?access_token=" + that.getAccessToken()}).then(function (pdf) {
          PDFJS.getDocument({data:pdfData}).then(function (pdf) {
            let annotationsCopy = JSON.parse(JSON.stringify(annotations))
            let annotationFragments = [].concat.apply([], annotationsCopy.map((el) => {return el.positions}))

            var groupBy = function (xs, key) {
              return xs.reduce(function (rv, x) {
                (rv[x[key]] = rv[x[key]] || []).push(x);
                return rv;
              }, {});
            }

            let annotationFragmentsByPage = groupBy(annotationFragments, "page")

            let pL = []
            for (let key in annotationFragmentsByPage) {
              pL.push(that.getPageAnnotationFragments(pdf, key, annotationFragmentsByPage[key]))
            }

            Promise.all(pL).then(function (extractedFragments) {
              let fragments = [].concat.apply([], extractedFragments)
              let annotationList = []
              for (let i = 0; i < annotationsCopy.length; i++) {
                let color = annotationsCopy[i].color == null ? Utils.rgbToHex(255, 245, 173) : Utils.rgbToHex(annotationsCopy[i].color.r, annotationsCopy[i].color.g, annotationsCopy[i].color.b)
                let annotationObj = {
                  color: color,
                  fileId: fileId,
                  document_id: annotationsCopy[i].document_id,
                  text: '',
                  id: annotationsCopy[i].id,
                  documentId: annotationsCopy[i].document_id,
                  page: annotationsCopy[i].positions[0].page,
                  positions: annotationsCopy[i].positions
                }
                for (let j = 0; j < annotationsCopy[i].positions.length; j++) {
                  if (annotationsCopy[i].positions.findIndex((el) => {return JSON.stringify(el) == JSON.stringify(annotationsCopy[i].positions[j])}) != j) continue
                  let fragment = fragments.find((el) => {
                    return el.page == annotationsCopy[i].positions[j].page && el["top_left"].x == annotationsCopy[i].positions[j]["top_left"].x && el["top_left"].y == annotationsCopy[i].positions[j]["top_left"].y && el["bottom_right"].x == annotationsCopy[i].positions[j]["bottom_right"].x && el["bottom_right"].y == annotationsCopy[i].positions[j]["bottom_right"].y
                  })
                  if (fragment != null && fragment["extractedText"] != null && fragment["extractedText"] != '') {
                    //if (annotationObj.text != '') annotationObj.text += ' '
                    if (annotationObj.text != '') annotationObj.text += '\n'
                    annotationObj.text += fragment["extractedText"]
                  }
                }
                if (annotationsCopy[i].text != null && annotationsCopy[i].text != '') annotationObj["note"] = annotationsCopy[i].text
                annotationList.push(annotationObj)
              }
              pdf.destroy()
              resolve(annotationList)
            })
          })
        })
      }
    })
  }
  let getOCRText = function(page,position){
    let that = this
    const scale = 8;
    return new Promise(function(resolve,reject){
      var viewport = page.getViewport(1);
      var canvas = document.createElement('canvas');
      var context = canvas.getContext('2d');

      var marginX = viewport.viewBox[0];
      var marginY = viewport.viewBox[1];
      let brx = position.bottom_right.x
      let bry = position.bottom_right.y
      let tly = position.top_left.y
      let tlx = position.top_left.x
      bry -= marginY;
      brx -= marginX;
      tly -= marginY;
      tlx -= marginX;

      canvas.height = scale*((bry - tly)+4);
      canvas.width = scale*((brx - tlx)+4);
      var transformX = scale*(-tlx + 2);
      var transformY = scale*(-1*(viewport.height - bry) + 2);
      var renderContext = {
        canvasContext: context,
        viewport: viewport,
        transform: [scale,0,0,scale,transformX,transformY]
      };
      page.render(renderContext).then(function(r) {
        var annotationText = OCRAD(canvas);
        resolve(annotationText)
      })
    })
  }
  let filterOverlappingChunks = function(pageTextChunks,position){
    let isInside = function(point,topLeft,bottomRight){
      if(point.x<topLeft.x) return false
      if(point.x>bottomRight.x) return false
      if(point.y>topLeft.y) return false
      if(point.y<bottomRight.y) return false
      return true
    }
    let bottomRightY = position["top_left"].y - (position["bottom_right"].y - position["top_left"].y)
    return pageTextChunks.items.filter((el) => {
      let elBottomRightY = el.transform[5]-el.transform[0]
      if(isInside({x:position["top_left"].x,y:position["top_left"].y},{x:el.transform[4],y:el.transform[5]},{x:el.transform[4]+el.width,y:elBottomRightY/*position["bottom_right"].y*/})) return true
      if(isInside({x:position["top_left"].x,y:bottomRightY},{x:el.transform[4],y:el.transform[5]},{x:el.transform[4]+el.width,y:elBottomRightY/*position["bottom_right"].y*/})) return true
      if(isInside({x:position["bottom_right"].x,y:position["top_left"].y},{x:el.transform[4],y:el.transform[5]},{x:el.transform[4]+el.width,y:elBottomRightY/*position["bottom_right"].y*/})) return true
      if(isInside({x:position["bottom_right"].x,y:bottomRightY},{x:el.transform[4],y:el.transform[5]},{x:el.transform[4]+el.width,y:elBottomRightY/*position["bottom_right"].y*/})) return true

      if(isInside({x:el.transform[4],y:el.transform[5]},{x:position["top_left"].x,y:position["top_left"].y},{x:position["bottom_right"].x,y:bottomRightY})) return true
      if(isInside({x:el.transform[4]+el.width,y:el.transform[5]},{x:position["top_left"].x,y:position["top_left"].y},{x:position["bottom_right"].x,y:bottomRightY})) return true
      if(isInside({x:el.transform[4],y:elBottomRightY},{x:position["top_left"].x,y:position["top_left"].y},{x:position["bottom_right"].x,y:bottomRightY})) return true
      if(isInside({x:el.transform[4]+el.width,y:elBottomRightY},{x:position["top_left"].x,y:position["top_left"].y},{x:position["bottom_right"].x,y:bottomRightY})) return true

      return false // todo fix
    })
    //return pageTextChunks.items.filter((el) => {
    //  if(isInside({x:el.transform[4],y:el.transform[5]},{x:position["top_left"].x,y:position["top_left"].y},{x:position["bottom_right"].x,y:bottomRightY/*position["bottom_right"].y*/})) return true
    //  if(isInside({x:el.transform[4]+el.width,y:el.transform[5]},{x:position["top_left"].x,y:position["top_left"].y},{x:position["bottom_right"].x,y:bottomRightY/*position["bottom_right"].y*/})) return true
    //  if(isInside({x:el.transform[4],y:el.transform[5]+/*el.height*/el.transform[0]},{x:position["top_left"].x,y:position["top_left"].y},{x:position["bottom_right"].x,y:bottomRightY/*position["bottom_right"].y*/})) return true
    //  if(isInside({x:el.transform[4]+el.width,y:el.transform[5]+/*el.height*/el.transform[0]},{x:position["top_left"].x,y:position["top_left"].y},{x:position["bottom_right"].x,y:bottomRightY/*position["bottom_right"].y*/})) return true
    //  return false
    //})
  }
  let mergeSubsequentChunks = function(chunks){
    const xMargin = 4
    const yMargin = 1
    let merged = []
    let textChunks = JSON.parse(JSON.stringify(chunks))
    for(let i=0;i<textChunks.length;i++){
      let t = merged.find((el) => {
        let xDiff = el.transform[4] - (textChunks[i].transform[4]+textChunks[i].width)
        let yDiff = el.transform[5] - textChunks[i].transform[5]
        if(xDiff>=-1*xMargin&&xDiff<=xMargin&&yDiff<=yMargin&&yDiff>=-1*yMargin) return true
        return false
      })
      if (t!=null){
        t.width = t.transform[4]+t.width - textChunks[i].transform[4]
        t.transform[4] = textChunks[i].transform[4]
        t.transform[5] = Math.min(t.transform[5],textChunks[i].transform[5])
        t.height = Math.max(t.height,textChunks[i].height)
        t.str = textChunks[i].str + ' ' + t.str
        continue
      }
      let t2 = merged.find((el) => {
        let xDiff = textChunks[i].transform[4] - (el.transform[4]+el.width)
        let yDiff = textChunks[i].transform[5] - el.transform[5]
        if(xDiff>=-1*xMargin&&xDiff<=xMargin&&yDiff<=yMargin&&yDiff>=-1*yMargin) return true
        return false
      })
      if (t2!=null){
        t2.width = textChunks[i].transform[4]+textChunks[i].width - t2.transform[4]
        t2.transform[5] = Math.min(t2.transform[5],textChunks[i].transform[5])
        t2.height = Math.max(t2.height,textChunks[i].height)
        t2.str = t2.str + ' ' + textChunks[i].str
        continue
      }
      merged.push(textChunks[i])
    }
    return merged
  }
  let getRowChunk = function(pageTextChunks,position){
    let overlappingChunks = this.filterOverlappingChunks(pageTextChunks,position)
    let mergedChunks = this.mergeSubsequentChunks(overlappingChunks)
    let maxChunk = null
    let maxOverlap = 0
    let overlap

    // todo take x axis overlap into consideration
    for(let i=0;i<mergedChunks.length;i++) {
      //if(mergedChunks[i].transform[4]<=position["top_left"].x&&mergedChunks[i].transform[5]<=position["top_left"].y){
      //  overlap = mergedChunks[i].transfor
      //}
      overlap = Math.min(mergedChunks[i].transform[5],position["top_left"].y) - Math.max(mergedChunks[i].transform[5]-mergedChunks[i].transform[0],position["top_left"].y-(position["bottom_right"].y-position["top_left"].y))
      if(overlap>maxOverlap){
        maxOverlap = overlap
        maxChunk = mergedChunks[i]
      }
    }
    return maxChunk
  }
  let getRowText = function(pageTextChunks,position){
    let rowChunk = this.getRowChunk(pageTextChunks,position)
    if(rowChunk==null||rowChunk.str==null) return null
    return rowChunk.str
  }
  let getEstimateText = function(pageTextChunks,position){
    let rowChunk = this.getRowChunk(pageTextChunks,position)
    if(rowChunk==null||rowChunk.str==null) return null
    let startP = (position["top_left"].x - rowChunk.transform[4]) / rowChunk.width
    let endP = (position["bottom_right"].x - rowChunk.transform[4]) / rowChunk.width
    let startX = startP < 0 ? 0 : Math.floor(rowChunk.str.length * startP)
    let endX = endP > 1 ? rowChunk.str.length : Math.ceil(rowChunk.str.length * endP)
    return rowChunk.str.substring(startX,endX)
    // todo
  }
  let getBestApproximateMatch = function(referenceText,approximateText){
    let bestMatch = ''
    let bestSimilarity = 0
    if(referenceText==null||referenceText=='') return approximateText
    for(let i=0;i<referenceText.length;i++){
      for(let j=i+1;j<=referenceText.length;j++){
        let sim = Utils.similarity(referenceText.substring(i,j),approximateText)
        if(sim>bestSimilarity){
          bestSimilarity = sim
          bestMatch = referenceText.substring(i,j)
        }
      }
    }
    return bestMatch
  }
  let cleanTextWordsWithReference = function(textToClean,referenceText){
    let that = this
    let splitText = textToClean.split(" ")
    let cleanText = splitText.map((el) => {return that.getBestApproximateMatch(referenceText,el)})
    return cleanText.join(' ')
  }
  let cleanOCRText = function(text){
    let t = text
    if(t.indexOf('\n')!=-1){
      let lines = t.split('\n')
      let bestPct = 1
      let lowestLine = ''
      let pct
      for(let i=0;i<lines.length;i++){
        if(lines[i]==''||lines[i]==' ') continue
        //let nonWordCharsCount = lines[i].replace(/[\w\s]+/g,"").length
        let nonWordCharsCount = lines[i].replace(/[a-zA-Z0-9\s]+/g,"").length
        if(nonWordCharsCount==0) return lines[i]
        pct = nonWordCharsCount / lines[i].length
        if(pct<bestPct){
          bestPct = pct
          lowestLine = lines[i]
        }
      }
      return lowestLine
    }
    return t
  }
  let getFragmentText = function(page,pageTextChunks,position){
    const similarityThreshold = 0.7
    const blankRatioThreshold = 0.1 // average word length => 4.5 letters / 1 space each 6 characters
    const nonWordCharPctThreshold = 0.1
    let that = this
    return new Promise(function(resolve,reject){
      let positionCopy = JSON.parse(JSON.stringify(position))
      let extractedText = ''
      let estimatedText = that.getEstimateText(pageTextChunks,position)
      let rowText = that.getRowText(pageTextChunks,position)
      that.getOCRText(page,position).then(function(dirtyOcrText){
        let ocrText = that.cleanOCRText(dirtyOcrText)
        let ocrWithoutBlanks = ocrText.replace(/\s/g,"")
        if((estimatedText==null||estimatedText=='')&&(ocrText!=null&&ocrText!='')){
          extractedText = ocrText
        }
        else if((ocrText==null||ocrText=='')&&(estimatedText!=null&&estimatedText!='')){
          extractedText = estimatedText
        }
        else if((ocrText==null||ocrText==''||ocrWithoutBlanks=='')&&(estimatedText==null||estimatedText=='')){
          extractedText = ''
        }
        else{
          let strSim = Utils.similarity(estimatedText,ocrWithoutBlanks)
          if(strSim==1){
            // TEXT GIVEN BY PDFJS SOMETIMES HAS NO BLANKS
            extractedText = ocrText
          }
          else if(strSim>similarityThreshold){
            let blankCount = estimatedText.split('').filter((el) => {return el == ' '}).length
            let blankCountOcr = ocrText.split('').filter((el) => {return el == ' '}).length
            if(blankCount/estimatedText.length<blankRatioThreshold&&blankCountOcr>blankCount){
              extractedText = that.cleanTextWordsWithReference(ocrText,rowText)
            }
            else{
              extractedText = that.getBestApproximateMatch(estimatedText,ocrText)
            }
          }
          else{
            //let ocrNonWordCharsCount = ocrText.replace(/[\w\s]+/g,"").length
            let ocrNonWordCharsCount = ocrText.replace(/[a-zA-Z0-9\s]+/g,"").length
            if(ocrNonWordCharsCount == 0 || ocrNonWordCharsCount/ocrText.length<nonWordCharPctThreshold){
              extractedText = ocrText
            }
            else extractedText = estimatedText
          }
        }
        positionCopy["extractedText"] = extractedText.replace(/\s+/g," ")
        resolve(positionCopy)
      })
    })
  }
  let getPageAnnotationFragments = function(pdf,pageNum,annotationFragments){
    let that = this
    return new Promise(function(resolve,reject){
      pdf.getPage(parseInt(pageNum)).then(function(page){
        page.getTextContent().then(function(pageTextChunks){
          let pL = []
          for(let j=0;j<annotationFragments.length;j++){
            pL.push(that.getFragmentText(page,pageTextChunks,annotationFragments[j]))
          }
          Promise.all(pL).then(function(extractedPageFragments){
            resolve(extractedPageFragments)
            // TODO
          })
        })
      })
    })
  }
  var extractAnnotations = function(groupId,documentId,annotations){
    var that = this;
    return new Promise(function (resolve, reject){
      that.getFile(documentId).then(function (rsp){
        if(JSON.parse(rsp.responseText)==null||JSON.parse(rsp.responseText).length==0) resolve([]);
        else{
          var fileId = JSON.parse(rsp.responseText)[0].id;
          /*that.getFileAndParse(fileId,annotations).then(function (annotationList){*/
          that.parsePdfFile(fileId,annotations).then(function (annotationList){
            resolve(annotationList);
          });
        }
      })
    });
  }
  var getFileAndParseBis = function (fileId,annotations){
    var that = this;
    return new Promise(function (resolve,reject){
      that.getFileURL(fileId).then(function (response){
        var fileURL = response.responseURL;
        if(fileURL==null) resolve([]);
        else{
          that.parseAnnotationsBis(fileURL,annotations).then(function (annotationList){
            resolve(annotationList);
          });
        }
      })
    })
  }
  var parseAnnotationsBis = function (pdfURL,annotations){
    return new Promise(function (resolve, reject){
      var annotationList = [];
      var scale = 8;
      if(annotations.length>0){
        PDFJS.getDocument(pdfURL).then(function(pdf){
          for(var i=0;i<annotations.length;i++){
            (function(n){
              var annotation = annotations[n];
              var annotationComp;
              if(annotation.color != null) annotationComp = {color: Utils.rgbToHex(annotation.color.r,annotation.color.g,annotation.color.b), text: [], id: annotation.id, document_id: annotation.document_id};
              else annotationComp = {color: Utils.rgbToHex(255,245,173), text: [], annotationId: annotation.id}; // default color -> yellow
              for(var j=0;j<annotation.positions.length;j++){
                (function(h,annotationObj,length){
                  var pageNum = annotation.positions[h].page;
                  pdf.getPage(annotation.positions[h].page).then(function(page){
                    var viewport = page.getViewport(1);
                    var canvas = document.createElement('canvas');
                    var context = canvas.getContext('2d');

                    var marginX = viewport.viewBox[0];
                    var marginY = viewport.viewBox[1];

                    annotation.positions[h].bottom_right.y -= marginY;
                    annotation.positions[h].bottom_right.x -= marginX;
                    annotation.positions[h].top_left.y -= marginY;
                    annotation.positions[h].top_left.x -= marginX;

                    canvas.height = scale*((annotation.positions[h].bottom_right.y - annotation.positions[h].top_left.y)+4);
                    canvas.width = scale*((annotation.positions[h].bottom_right.x - annotation.positions[h].top_left.x)+4);
                    var transformX = scale*(-annotation.positions[h].top_left.x + 2);
                    var transformY = scale*(-1*(viewport.height - annotation.positions[h].bottom_right.y) + 2);
                    var renderContext = {
                      canvasContext: context,
                      viewport: viewport,
                      transform: [scale,0,0,scale,transformX,transformY]
                    };
                    page.render(renderContext).then(function(r){
                      /*var img = new Image();
                      img.src = canvas.toDataURL();*/
                      /*img.style.zIndex = 200;
                      document.getElementById("mendeleycolors").appendChild(img);*/
                      //var annotationText = OCRAD(img);

                      //var annotationText = "To do";
                      var annotationText = OCRAD(canvas);

                      page.getTextContent().then(function(t){
                        var bestMatch = annotationText;
                        var bestIndex = 0.7;
                        if(t.items!=null&&t.items.length>0){
                          var lag = t.items.filter(function(elem){
                            var margin = 6;
                            if(elem.transform[5]>annotation.positions[h].top_left.y-margin&&elem.transform[5]<annotation.positions[h].top_left.y+10) return true;
                            return false;
                          })
                          var lengthMargin = 10;
                          for(var l=0;l<lag.length;l++){
                            for(var m=0;m<lag[l].str.length;m++){
                              var o = annotationText.length-lengthMargin < 1 ? 1 : annotationText.length-lengthMargin;
                              for(var n=m+o;n<=lag[l].str.length&&n-m<=annotationText.length+lengthMargin;n++){
                                var substr = lag[l].str.substring(m,n);
                                var ind = Utils.similarity(annotationText,substr);
                                if(ind>bestIndex){
                                  bestMatch = substr+"\n";
                                  bestIndex = ind;
                                }
                              }
                            }
                          }
                        }
                        annotationObj.text[h] = bestMatch;

                        canvas.remove();
                        //img.remove();
                        if(annotationObj.text.filter((el) => {return el!=null}).length==length){
                          annotationObj.text = annotationObj.text.join(""/*" "*/)/*.replace(/\n/g,"")*/;
                          annotationObj["page"] = pageNum;
                          annotationList.push(annotationObj);
                          if(annotationList.length == annotations.length){
                            pdf.destroy();
                            resolve(annotationList);
                          }
                        }
                      });
                    }).catch(function(error){
                      console.log(error,"error1");
                      if(pdf!=null) pdf.destroy();
                      if(canvas!=null) canvas.remove();
                      resolve([]);
                    });
                  }).catch(function(error){
                    console.log(error,"error2")
                    if(pdf!=null) pdf.destroy();
                    resolve([]);
                  })
                })(j,annotationComp,annotation.positions.length);
              }
            })(i);
          }
        }).catch(function(error){
          console.log(error);
          resolve([]);
        });
      }
      else resolve([]);
    })
  }
  var getFileAndParse = function (fileId,annotations){
    let that = this
    return new Promise(function (resolve, reject){
      var annotationList = [];
      var scale = 8;
      if(annotations.length>0){
        PDFJS.getDocument({url:"https://api.mendeley.com/files/"+fileId+"?access_token="+that._accessToken}).then(function(pdf){
          for(var i=0;i<annotations.length;i++){
            (function(n){
              var annotation = annotations[n];
              var annotationComp;
              if(annotation.color != null) annotationComp = {color: Utils.rgbToHex(annotation.color.r,annotation.color.g,annotation.color.b), text: [], id: annotation.id, document_id: annotation.document_id};
              else annotationComp = {color: Utils.rgbToHex(255,245,173), text: [], annotationId: annotation.id}; // default color -> yellow
              for(var j=0;j<annotation.positions.length;j++){
                (function(h,annotationObj,length){
                  var pageNum = annotation.positions[h].page;
                  pdf.getPage(annotation.positions[h].page).then(function(page){
                    var viewport = page.getViewport(1);
                    var canvas = document.createElement('canvas');
                    var context = canvas.getContext('2d');

                    var marginX = viewport.viewBox[0];
                    var marginY = viewport.viewBox[1];

                    annotation.positions[h].bottom_right.y -= marginY;
                    annotation.positions[h].bottom_right.x -= marginX;
                    annotation.positions[h].top_left.y -= marginY;
                    annotation.positions[h].top_left.x -= marginX;

                    canvas.height = scale*((annotation.positions[h].bottom_right.y - annotation.positions[h].top_left.y)+4);
                    canvas.width = scale*((annotation.positions[h].bottom_right.x - annotation.positions[h].top_left.x)+4);
                    var transformX = scale*(-annotation.positions[h].top_left.x + 2);
                    var transformY = scale*(-1*(viewport.height - annotation.positions[h].bottom_right.y) + 2);
                    var renderContext = {
                      canvasContext: context,
                      viewport: viewport,
                      transform: [scale,0,0,scale,transformX,transformY]
                    };
                    page.render(renderContext).then(function(r){
                      /*var img = new Image();
                      img.src = canvas.toDataURL();*/
                      /*img.style.zIndex = 200;
                      document.getElementById("mendeleycolors").appendChild(img);*/
                      //var annotationText = OCRAD(img);

                      //var annotationText = "To do";
                      var annotationText = OCRAD(canvas);

                      page.getTextContent().then(function(t){
                        var bestMatch = annotationText;
                        var bestIndex = 0.7;
                        if(t.items!=null&&t.items.length>0){
                          var lag = t.items.filter(function(elem){
                            var margin = 6;
                            if(elem.transform[5]>annotation.positions[h].top_left.y-margin&&elem.transform[5]<annotation.positions[h].top_left.y+10) return true;
                            return false;
                          })
                          var lengthMargin = 10;
                          for(var l=0;l<lag.length;l++){
                            for(var m=0;m<lag[l].str.length;m++){
                              var o = annotationText.length-lengthMargin < 1 ? 1 : annotationText.length-lengthMargin;
                              for(var n=m+o;n<=lag[l].str.length&&n-m<=annotationText.length+lengthMargin;n++){
                                var substr = lag[l].str.substring(m,n);
                                var ind = Utils.similarity(annotationText,substr);
                                if(ind>bestIndex){
                                  bestMatch = substr+"\n";
                                  bestIndex = ind;
                                }
                              }
                            }
                          }
                        }
                        annotationObj.text[h] = bestMatch;

                        canvas.remove();
                        //img.remove();
                        if(annotationObj.text.filter((el) => {return el!=null}).length==length){
                          annotationObj.text = annotationObj.text.join(""/*" "*/)/*.replace(/\n/g,"")*/;
                          annotationObj["page"] = pageNum;
                          annotationObj["fileId"] = fileId;
                          annotationObj["documentId"] = annotation.document_id;
                          annotationList.push(annotationObj);
                          if(annotationList.length == annotations.length){
                            pdf.destroy();
                            resolve(annotationList);
                          }
                        }
                      });
                    }).catch(function(error){
                      console.log(error,"error1");
                      if(pdf!=null) pdf.destroy();
                      if(canvas!=null) canvas.remove();
                      resolve([]);
                    });
                  }).catch(function(error){
                    console.log(error,"error2")
                    if(pdf!=null) pdf.destroy();
                    resolve([]);
                  })
                })(j,annotationComp,annotation.positions.length);
              }
            })(i);
          }
        }).catch(function(error){
          console.log(error);
          resolve([]);
        });
      }
      else resolve([]);
    })
  }
  var selectAnnotationList = function(groupId,lastUpdateDate,documentIdList,marker){
    var that = this;
    return new Promise(function (resolve, reject){
      var limit = 200;
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/annotations",
        headers: {
          'Authorization': "Bearer "+that._accessToken
        },
        params: {
          'modified_since': lastUpdateDate,
          limit: limit
        }
      }
      if(marker!=null) opts.params["marker"] = marker;
      if(groupId!=null) opts.params["group_id"] = groupId;
      makeRequest(opts).then(function (resp){
        var annotations = JSON.parse(resp.responseText);
        var annotationsFiltered = [];
        for(var i=0;i<annotations.length;i++){
          if (annotations[i].positions == null || annotations[i].positions.length == 0) continue;
          if(documentIdList.indexOf(annotations[i].document_id)!=-1&&(annotations[i].type=="highlight"||annotations[i].text==null||annotations[i].text=="")){
            if(annotations[i]["last_modified"]!=null&&new Date(lastUpdateDate)<new Date(annotations[i]["last_modified"])) annotationsFiltered.push(annotations[i]);
          }
        }
        annotationsFiltered.forEach((ann) => {
          // todo manage better
          // change blue collor from (54, 121, 224) to (186, 226, 255)
          if (ann.color != null && ann.color.r === 54 && ann.color.g === 121 && ann.color.b === 224){
            ann.color.r = 186
            ann.color.g = 226
            ann.color.b = 255
          }
          // Mendeley's new web interface changes the value of y axis.
          // Top-left's y is bigger than bottom-right's y, while the contrary happens in the desktop version
          ann.positions.forEach((pos) => {
            if (pos['top_left'].y > pos['bottom_right'].y) {
              let tlY = pos['top_left'].y
              pos['top_left'].y = pos['bottom_right'].y
              pos['bottom_right'].y = tlY
            }
          })
        })

        if(annotations.length==limit){
          var newMarker = annotations[limit-1].id;
          that.selectAnnotationList(groupId,lastUpdateDate,documentIdList,newMarker).then(function (nextPageAnnotations){
            var annotationList = annotationsFiltered.concat(nextPageAnnotations);
            resolve(annotationList);
          })
        }
        else{
          resolve(annotationsFiltered);
        }
      });
    })
  }
  var selectAnnotations = function(groupId,documentIdList,mapId){
    var that = this;
    return new Promise(function (resolve, reject){
      var lastUpdateDate = that.selectLastUpdateDate(mapId);
      that.selectAnnotationList(groupId,lastUpdateDate,documentIdList).then(function (annotations){
        var documentList = {};
        for(var i=0;i<annotations.length;i++){
          if(documentList[annotations[i].document_id]==null){
            documentList[annotations[i].document_id] = [annotations[i]];
          }
          else{
            documentList[annotations[i].document_id].push(annotations[i]);
          }
        }
        var promiseList = [];
        for(var key in documentList){
          promiseList.push(that.extractAnnotations(groupId,key,documentList[key]));
        }
        Promise.all(promiseList).then(function(annotationList){
          var lag = [];
          for(var j=0;j<annotationList.length;j++){
            lag = lag.concat(annotationList[j]);
          }
          resolve(lag);
        })
      });
    })
  }
  /*var selectGroupAnnotations = function(groupId,documentIdList,mapId){
    var that = this;
    return new Promise(function (resolve, reject){
      var lastUpdateDate = that.selectLastUpdateDate(mapId);
      that.selectAnnotationList(lastUpdateDate,documentIdList).then(function (annotations){
        var documentList = {};
        for(var i=0;i<annotations.length;i++){
          if(documentList[annotations[i].document_id]==null){
            documentList[annotations[i].document_id] = [annotations[i]];
          }
          else{
            documentList[annotations[i].document_id].push(annotations[i]);
          }
        }
        var promiseList = [];
        for(var key in documentList){
          promiseList.push(that.extractAnnotations(key,documentList[key]));
        }
        Promise.all(promiseList).then(function(annotationList){
          var lag = [];
          for(var j=0;j<annotationList.length;j++){
            lag = lag.concat(annotationList[j]);
          }
          resolve(lag);
        })
      });
    })
  }*/
  var getFile = function(documentId){
    let that = this
    var opts = {
      method: "GET",
      url: "https://api.mendeley.com/files",
      headers: {
        'Authorization': "Bearer "+that._accessToken
      },
      params: {
        document_id: documentId
      }
    }
    return makeRequest(opts);
  }
  var selectDocumentById = function(documentId){
    var that = this;
    return new Promise(function (resolve, reject){
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/documents/"+documentId,
        params: {
          view: "all"
        },
        headers: {
          'Authorization': "Bearer "+that._accessToken
        }
      }
      makeRequest(opts).then(function (response){
        var article = JSON.parse(response.responseText);
        resolve(article);
        /*that.getFile(documentId).then(function (rsp){
          var a = JSON.parse(rsp.responseText);
          article["file_id"] = a[0].id;
          resolve(article);
        })*/
      });
    })
  }
  var selectFolderAnnotations = function(folderName,mapId){
    var that = this;
    return new Promise(function (resolve, reject){
      that.selectFolder(folderName).then(function (folderId){
        if(folderId==null){
          that.searchFolderInGroups(folderName).then(function(found){
            if(found==null) resolve([]);
            else that.selectFolderDocuments(found.groupId,found.folderId).then(function (documentList){
              if(documentList==null||documentList.length==0) resolve([]);
              else{
                that.selectAnnotations(found.groupId,documentList,mapId).then(function (annotations){
                  resolve(annotations);
                });
              }
            });
          })
        }
        else{
          that.selectFolderDocuments(null,folderId).then(function (documentList){
            if(documentList==null||documentList.length==0) resolve([]);
            else{
              that.selectAnnotations(null,documentList,mapId).then(function (annotations){
                resolve(annotations);
              });
            }
          });
        }
      })
    });
  }
  var selectTagAnnotations = function(tag,mapId){
    var that = this;
    return new Promise(function (resolve, reject){
      that.selectTagDocuments(tag).then(function (documentList){
        if(documentList==null||documentList.length==0) resolve([]);
        else{
          that.selectAnnotations(null,documentList,mapId).then(function (annotations){
            resolve(annotations);
          });
        }
      });
    });
  }
  var getFileURL = function (fileId){
    let that = this
    var opts = {
      method: "GET",
      url: "https://api.mendeley.com/files/"+fileId,
      headers: {
        'Authorization': "Bearer "+that._accessToken
      }
    }
    return makeRequest(opts);
  }
  var insertDocument = function(fileURL,title){
    let that = this
    return new Promise(function (resolve,reject){
      PDFJS.getDocument(fileURL).then(function(pdf){
        pdf.getData().then(function(data){
          var req = new XMLHttpRequest();
          req.open("POST","https://api.mendeley.com/documents",true);
          req.setRequestHeader("Authorization","Bearer "+that._accessToken);
          req.setRequestHeader("Content-Type","application/pdf");
          req.setRequestHeader("Content-Disposition",'attachment; filename="'+title+'.pdf"');
          req.onload = function(){
            resolve(req.responseText);
          }
          req.send(data);
        })
      });
    });
  }
  var addDocumentToFolder = function(documentID,folderID){
    // TODO TEST
    let that = this
    return new Promise(function (resolve,reject){
      var data = {"id":documentID};
      var req = new XMLHttpRequest();
      req.open("POST","https://api.mendeley.com/folders/"+folderID+"/documents",true);
      req.setRequestHeader("Authorization","Bearer "+that._accessToken);
      req.setRequestHeader("Content-Type","application/vnd.mendeley-document.1+json");
      //req.setRequestHeader("Content-Disposition",'attachment; filename="'+title+'.pdf"');
      req.onload = function(){
        resolve(req.responseText);
      }
      req.send(JSON.stringify(data));
    });
  }
  var selectArticleData = function(title){
    let that = this
    return new Promise(function (resolve, reject){
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/search/catalog?title="+title,
        headers: {
          'Authorization': "Bearer "+that._accessToken
        }
      }
      makeRequest(opts).then(function (response){
        var articleList = JSON.parse(response.responseText);
        var similarityThreshold = 0.95;
        for(var i=0;i<articleList.length;i++){
          if(Utils.similarity(articleList[i].title,title)>similarityThreshold){
            resolve(articleList[i]);
            break;
          }
        }
        resolve(null);
      });
    })
  }
  var updateDocument = function(documentID,article){
    // TODO test
    let that = this
    return new Promise(function (resolve,reject){
      //var data = {};
      //if(article.abstract != null) data["abstract"] = article.abstract;
      var req = new XMLHttpRequest();
      req.open("PATCH","https://api.mendeley.com/documents/"+documentID,true);
      req.setRequestHeader("Authorization","Bearer "+that._accessToken);
      req.setRequestHeader("Content-Type","application/vnd.mendeley-document.1+json");
      //req.setRequestHeader("Content-Disposition",'attachment; filename="'+title+'.pdf"');
      req.onload = function(){
        resolve(req.responseText);
      }
      req.send(JSON.stringify(article));
    });
  }
  var insertDocumentIntoFolder = function(fileURL,article,folderName){
    // TOTEST
    var that = this;
    return new Promise(function (resolve,reject){
      that.insertDocument(fileURL,article.title).then(function(documentID){
        that.selectArticleData(article.title).then(function(articleData){
          var articleInfo = articleData != null ? articleData : article;
          //that.updateDocument(documentID,articleInfo).then(function(){
            if(folderName!=null) that.addDocumentToFolder(documentID,folderName).then(function(){
              resolve();
            })
            else resolve();
          //})
        })
      })
    })
  }
  var getFolderList = function(marker){
    var that = this;
    return new Promise(function (resolve, reject){
      var limit = 500;
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/folders/",
        headers: {
          'Authorization': "Bearer "+that._accessToken
        },
        params: {
          limit: limit
        }
      }
      if(marker!=null) opts.params["marker"] = marker;
      makeRequest(opts).then(function (response){
        var rsp = JSON.parse(response.responseText);
        //var foundFolder = rsp.find(filter,{name:folderName});
        //if(foundFolder!=null) resolve(foundFolder.id);
        if(rsp.length==limit) that.getFolderList(rsp[limit-1].id).then(function(folderList){
          resolve(rsp.concat(folderList));
        });
        else resolve(rsp);
      });
    })
  }
  var createFolder = function(folderName){
    let that = this
    return new Promise(function(resolve,reject){
      var data = {"name":folderName};
      var req = new XMLHttpRequest();
      req.open("POST","https://api.mendeley.com/folders/",true);
      req.setRequestHeader("Authorization","Bearer "+that._accessToken);
      req.setRequestHeader("Content-Type","application/vnd.mendeley-folder.1+json");
      //req.setRequestHeader("Content-Disposition",'attachment; filename="'+title+'.pdf"');
      req.onload = function(){
        var ret = JSON.parse(req.responseText);
        if(ret==null) reject();
        else resolve(ret.id);
      }
      req.send(JSON.stringify(data));
    })
  }
  var updateFolderParent = function(folderId,parentId){
    let that = this
    return new Promise(function(resolve,reject){
      var data = {"parent_id":parentId};
      var req = new XMLHttpRequest();
      req.open("PATCH","https://api.mendeley.com/folders/"+folderId,true);
      req.setRequestHeader("Authorization","Bearer "+that._accessToken);
      req.setRequestHeader("Content-Type","application/vnd.mendeley-folder.1+json");
      req.onload = function(){
        if(req.status!=204&&req.status!=200) reject();
        else resolve(true);
      }
      req.send(JSON.stringify(data));
    })
  }
  var createSubfolder = function(parentFolderName,folderName){
    var that = this;
    return new Promise(function(resolve,reject){
      that.getFolderList().then(function(folderList){
        var parentFolder = folderList.find((el) => {return el.name == parentFolderName});
        if(parentFolder==null){
          resolve();
          return;
        }
        var parentFolderId = parentFolder.id;
        var subfolder = folderList.find((el) => {return el.name==folderName&&el.parent_id==parentFolderId});
        if(subfolder!=null){
          resolve(subfolder.id);
          return;
        }
        that.createFolder(folderName).then(function(folderId){
          if(folderId!=null){
            that.updateFolderParent(folderId,parentFolderId).then(function(){
              resolve(folderId);
            })
          }
        })
      })
    })
  }
  var getDocuments = function(marker){
    var that = this;
    return new Promise(function (resolve, reject){
      var limit = 500;
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/documents",
        headers: {
          'Authorization': "Bearer "+that._accessToken
        },
        params: {
          limit: limit,
          view: "bib"
        }
      }
      if(marker!=null) opts.params["marker"] = marker;
      makeRequest(opts).then(function (response){
        var documentList = JSON.parse(response.responseText);
        if(documentList.length==limit){
          that.getDocuments(documentList[limit-1]).then(function (ret){
            resolve(documentList.concat(ret));
          });
        }
        else resolve(documentList);
      });
    })
  }
  var getCatalogDocuments = function(query){
    var that = this;
    return new Promise(function (resolve, reject){
      let params = {};
      for(let key in query){
        params[key] = query[key];
      }
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/catalog",
        params: params,
        headers: {
          'Authorization': "Bearer "+that._accessToken
        }
      }
      makeRequest(opts).then(function (response){
        var documents = JSON.parse(response.responseText);
        resolve(documents);
      });
    })
  }
  var searchCatalogDocuments = function(query){
    var that = this;
    return new Promise(function (resolve, reject){
      let params = {};
      for(let key in query){
        params[key] = query[key];
      }
      var opts = {
        method: "GET",
        url: "https://api.mendeley.com/search/catalog",
        params: params,
        headers: {
          'Authorization': "Bearer "+that._accessToken
        }
      }
      makeRequest(opts).then(function (response){
        var documents = JSON.parse(response.responseText);
        resolve(documents);
      });
    })
  }
  var getCatalogDocumentsByTitle = function(title){
    return this.searchCatalogDocuments({title:title,view:"bib"});
  }
  var getCatalogDocumentsByIdentifier = function(identifier){
    let key = Object.keys(identifier)[0];
    return this.getCatalogDocuments({key:identifier[key],view:"bib"});
  }
  var getDocumentInfo = function(documentId){
    const articleTitleSimilarityThreshold = 0.9;
    let that = this
    return new Promise(function(resolve,reject){
      that.selectDocumentById(documentId).then(function (article){
        /*let catalogSearchByTitle = function(){
          that.getCatalogDocumentsByTitle(article.title).then(function(documents){
            let bestMatchSimilarity = articleTitleSimilarityThreshold;
            let bestMatch;
            for(let i=0;i<documents.length;i++){
              if(Utils.similarity(documents[i].title.toLowerCase(),article.title.toLowerCase())>bestMatchSimilarity){
                bestMatch = documents[i];
                bestMatchSimilarity = Utils.similarity(documents[i].title.toLowerCase(),article.title.toLowerCase());
              }
            }
            if(bestMatch!=null){
              if(article.starred!=null&&article.starred==true) bestMatch["starred"] = true;
              resolve(bestMatch);
            }
            else{
              resolve(article);
            }
          })
        }
        if(article.identifiers!=null&&article.identifiers.length>0){
          that.getCatalogDocumentsByIdentifier(article.identifiers[0]).then(function(documents){
            let bestMatchSimilarity = articleTitleSimilarityThreshold;
            let bestMatch;
            for(let i=0;i<documents.length;i++){
              if(Utils.similarity(documents[i].title.toLowerCase(),article.title.toLowerCase())>bestMatchSimilarity){
                bestMatch = documents[i];
                bestMatchSimilarity = Utils.similarity(documents[i].title.toLowerCase(),article.title.toLowerCase());
              }
            }
            if(bestMatch!=null){
              if(article.starred!=null&&article.starred==true) bestMach["starred"] = true;
              resolve(bestMatch);
            }
            else catalogSearchByTitle();
          })
        }
        else{
          catalogSearchByTitle();
        }*/
        resolve(article)
      })
    })
  }
  return {
    selectTagDocuments: selectTagDocuments,
    selectTagAnnotations: selectTagAnnotations,
    selectFolderAnnotations: selectFolderAnnotations,
    selectFolder: selectFolder,
    /*selectDocumentAnnotations: selectDocumentAnnotations,*/
    selectFolderDocuments: selectFolderDocuments,
    getFile: getFile,
    extractAnnotations: extractAnnotations,
    getFileAndParse: getFileAndParse,
    /*parseAnnotations: parseAnnotations,*/
    selectLastUpdateDate: selectLastUpdateDate,
    updateLastUpdateDate: updateLastUpdateDate,
    getFileURL: getFileURL,
    selectDocumentById: selectDocumentById,
    insertDocument: insertDocument,
    addDocumentToFolder: addDocumentToFolder,
    selectArticleData: selectArticleData,
    updateDocument: updateDocument,
    insertDocumentIntoFolder: insertDocumentIntoFolder,
    selectAnnotationList: selectAnnotationList,
    selectAnnotations: selectAnnotations,
    createSubfolder: createSubfolder,
    getFolderList: getFolderList,
    createFolder: createFolder,
    updateFolderParent: updateFolderParent,
    getDocuments: getDocuments,
    searchCatalogDocuments: searchCatalogDocuments,
    getCatalogDocuments: getCatalogDocuments,
    getCatalogDocuments: getCatalogDocuments,
    getCatalogDocumentsByTitle: getCatalogDocumentsByTitle,
    getCatalogDocumentsByIdentifier: getCatalogDocumentsByIdentifier,
    setAccessToken: setAccessToken,
    getAccessToken: getAccessToken,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    getSyncMode: getSyncMode,
    setSyncMode: setSyncMode,
    isFolderManagementEnabled: isFolderManagementEnabled,
    setFolderManagementEnabled: setFolderManagementEnabled,
    getDocumentInfo: getDocumentInfo,
    getGroupFolders: getGroupFolders,
    getUserGroups: getUserGroups,
    searchFolderInGroups: searchFolderInGroups,
    parsePdfFile: parsePdfFile,
    getOCRText: getOCRText,
    filterOverlappingChunks: filterOverlappingChunks,
    mergeSubsequentChunks: mergeSubsequentChunks,
    getRowChunk: getRowChunk,
    getRowText: getRowText,
    getEstimateText: getEstimateText,
    getBestApproximateMatch: getBestApproximateMatch,
    cleanTextWordsWithReference: cleanTextWordsWithReference,
    cleanOCRText: cleanOCRText,
    getFragmentText: getFragmentText,
    getPageAnnotationFragments: getPageAnnotationFragments
  }
})();

// ----------------MINDMEISTER------------------------------

var Mindmeister = (function (){
  let _accessToken = null
  let setAccessToken = function(token){
    this._accessToken = token
  }
  let getAccessToken = function(){
    return this._accessToken
  }
  var ChangeList = (function(){
    var changes = [];
    var nodeChangeMapping = [];
    var nodeIdLag = -1000;
    var changeIdLag = 100;
    var insertChange = function(c){
      changes.push(c);
    }
    var getChanges = function(){
      return changes;
    }
    var emptyChanges = function(){
      changes = [];
    }
    var replaceNodeIds = function(){
      for(var i=0;i<nodeChangeMapping.length;i++){
        var fakeNodeId = nodeChangeMapping[i].fakeNodeId;
        if(fakeNodeId==null) continue;
        for(var j=0;j<changes.length;j++){
          var change = changes[j];
          if(change["idea_id"]==fakeNodeId) changes[j]["idea_id"] = nodeChangeMapping[i].realNodeId;
          if(change["new_data"]["parent"]==fakeNodeId){
            changes[j]["new_data"]["parent"] = nodeChangeMapping[i].realNodeId;
            //if(NODES_TO_CLOSE.indexOf(nodesToChange[i].id)==-1) NODES_TO_CLOSE.push(nodesToChange[i].id);
          }
          if(change["new_data"]["id"]==fakeNodeId) changes[j]["new_data"]["id"] = nodeChangeMapping[i].realNodeId;
        }
        for(var j=0;j<linkingList.length;j++){
          var linking = linkingList[j];
          if(linking["nodeId"]==fakeNodeId) linkingList[j]["nodeId"] = nodeChangeMapping[i].realNodeId;
          if(linking["linkNodeId"]==fakeNodeId) linkingList[j]["linkNodeId"] = nodeChangeMapping[i].realNodeId;
        }
        if(focusNodeId!=null&&focusNodeId==nodeChangeMapping[i].fakeNodeId) focusNodeId = nodeChangeMapping[i].realNodeId;
      }
    }
    var insertNodeChangeMapping = function(){
      nodeChangeMapping.push({
        fakeNodeId: nodeIdLag,
        changeId: changeIdLag
      });
      nodeIdLag--;
      changeIdLag++;
    }
    var insertRealNodeId = function(changeId,nodeId){
      var n = nodeChangeMapping.find((el) => {return el.changeId==changeId});
      n["realNodeId"] = nodeId;
    }
    var emptyNodeChangeMapping = function(){
      nodeChangeMapping = [];
      nodeIdLag = -1000;
      changeIdLag = 100;
    }
    var getFakeNodeId = function(){
      return nodeIdLag;
    }
    var getChangeId = function(){
      return changeIdLag;
    }
    var focusNodeId;
    var setFocusNodeId = function(nodeId){
      focusNodeId = nodeId;
    }
    var getFocusNodeId = function(){
      return focusNodeId;
    }
    return {
      insertChange: insertChange,
      getChanges: getChanges,
      emptyChanges: emptyChanges,
      getFakeNodeId: getFakeNodeId,
      getChangeId: getChangeId,
      emptyNodeChangeMapping: emptyNodeChangeMapping,
      insertRealNodeId: insertRealNodeId,
      insertNodeChangeMapping: insertNodeChangeMapping,
      replaceNodeIds: replaceNodeIds,
      setFocusNodeId: setFocusNodeId,
      getFocusNodeId: getFocusNodeId
    }
  })
  var linkingList = [];
  var generalChangeList = new ChangeList();
  var updateNodeLinkings = function(mapId){
    var that = this;
    return new Promise(function(resolve,reject){
      var cL = new ChangeList();
      for(var i=linkingList.length-1;i>=0;i--){
        if(linkingList[i]["nodeId"]!=null&&parseInt(linkingList[i]["nodeId"])>0&&linkingList[i]["linkNodeId"]!=null&&parseInt(linkingList[i]["linkNodeId"])>0){
          that.modifyIdea(mapId,linkingList[i]["nodeId"],{link:"topic:"+linkingList[i]["linkNodeId"]},cL);
          linkingList.splice(i,1);
        }
      }
      if(cL.getChanges().length>0){
        that.doChanges(mapId,cL).then(function(ch){
          resolve(ch);
        });
      }
      else{
        resolve([]);
      }
    })
  }
  var setIdeaStyle = function (mapId,nodeId,styleParams,changeList){
    if(nodeId==null||parseInt(nodeId)<0) return null;
    if(mapId==null||nodeId==null||styleParams==null) return null;
    if(changeList==null) changeList = generalChangeList;
    if(styleParams["fonts"]==null)styleParams["fonts"] = [];
    var c = {"type":"TextStyle","idea_id":nodeId,"new_data":{"id":nodeId,"style":styleParams}};
    changeList.insertChange(c);
    return this;
  }
  var decolorIdea = function (mapId,nodeId,changeList){
    if(nodeId==null||parseInt(nodeId)<0) return null;
    if(mapId==null||nodeId==null) return null;
    if(changeList==null) changeList = generalChangeList;
    var c = {"type":"TextStyle","idea_id":nodeId,"new_data":{"style":null}};
    changeList.insertChange(c);
    return this;
  }
  var modifyIdea = function (mapId,ideaId,ideaParams,changeList){
    if(ideaId==null||parseInt(ideaId)<0) return null;
    if(mapId==null||ideaId==null||ideaParams==null) return null;
    if(changeList==null) changeList = generalChangeList;
    if(ideaParams.link!=null){
      if(ideaParams["link"].indexOf("topic:")==-1||parseInt(ideaParams["link"].replace("topic:",""))>0){
        var changeElem = {"type":"Link","idea_id":ideaId,"new_data":{}};
        changeElem["new_data"]["link"] = ideaParams.link;
        changeList.insertChange(changeElem);
      }
      else linkingList.push({nodeId: ideaId, linkNodeId: parseInt(ideaParams["link"].replace("topic:",""))});
    }
    if(ideaParams.icon!=null){
      var changeElem = {"type":"Icon","idea_id":ideaId,"new_data":{}};
      changeElem["new_data"]["icon"] = ideaParams.icon;
      changeList.insertChange(changeElem);
    }
    if(ideaParams.title!=null){
      var changeElem = {"type":"Title","idea_id":ideaId,"new_data":{}};
      changeElem["new_data"]["title"] = ideaParams.title;
      changeList.insertChange(changeElem);
    }
    if(ideaParams.note!=null){
      var changeElem = {"type":"Note","idea_id":ideaId,"new_data":{}};
      changeElem["new_data"]["note"] = ideaParams.note;
      changeList.insertChange(changeElem);
    }
    if(ideaParams.style!=null){
      var changeElem = {"type":"TextStyle","idea_id":ideaId,"new_data":{}};
      changeElem["new_data"]["style"] = ideaParams.style;
      if(ideaParams["style"]["fonts"]==null)changeElem["new_data"]["style"]["fonts"] = [];
      changeList.insertChange(changeElem);
    }
    if(ideaParams.position!=null){
      var changeElem = {"type":"Reposition","idea_id":ideaId,"new_data":{}};
      changeElem["new_data"]["pos"] = ideaParams.position;
      changeList.insertChange(changeElem);
    }
    return this;
  }
  var insertIdea = function (mapId,parentIdeaId,ideaParams,changeList,focusAtFinish){
    if(parentIdeaId==null/*||parseInt(parentIdeaId)<0*/) return null;
    if(mapId==null||parentIdeaId==null||ideaParams==null) return null;
    if(changeList==null) changeList = generalChangeList;
    var fakeNodeId = changeList.getFakeNodeId();
    var changeElem = {"type":"Insert","idea_id":changeList.getFakeNodeId(),"new_data":{"parent":parentIdeaId,"id":changeList.getFakeNodeId(),"closed":false},"id":changeList.getChangeId()};
    for(var key in ideaParams){
      if(key!="link") changeElem["new_data"][key] = ideaParams[key];
      else if(ideaParams["link"].indexOf("topic:")==-1) changeElem["new_data"][key] = ideaParams[key];
      else if(parseInt(ideaParams["link"].replace("topic:",""))>0) changeElem["new_data"][key] = ideaParams[key];
      else linkingList.push({nodeId: fakeNodeId, linkNodeId: parseInt(ideaParams["link"].replace("topic:",""))});
    }
    if(focusAtFinish!=null&&focusAtFinish==true) changeList.setFocusNodeId(fakeNodeId);
    changeList.insertChange(changeElem);
    changeList.insertNodeChangeMapping();
    return fakeNodeId;
  }
  var removeIdea = function (mapId,ideaId,changeList){
    if(ideaId==null||parseInt(ideaId)<0) return null;
    if(mapId==null||ideaId==null) return null;
    if(changeList==null) changeList = generalChangeList;
    var changeElem = {"type":"Delete","idea_id":ideaId,"new_data":{}};
    changeList.insertChange(changeElem);
    return this;
  }
  var insertSubtree = function(node,changeList){
    if(node==null) return null;
    if(changeList==null) changeList = generalChangeList;
    var closed = node.closed != null ? node.closed : true;

    var nodeId = changeList.getFakeNodeId();
    var changeElem = {"type":"Insert","idea_id":changeList.getFakeNodeId(),"new_data":{"parent":node.parentNodeId,"id":changeList.getFakeNodeId(),"title":node.title,"closed":closed},"id":changeList.getChangeId()};
    if(node.style!=null) changeElem["new_data"]["style"] = node.style;
    if(node.style!=null&&changeElem["new_data"]["style"]["fonts"]==null) changeElem["new_data"]["style"]["fonts"] = [];
    if(node.link!=null){
      if(node["link"].indexOf("topic:")==-1) changeElem["new_data"]["link"] = node["link"];
      else if(parseInt(node["link"].replace("topic:",""))>0) changeElem["new_data"]["link"] = node["link"];
      else linkingList.push({nodeId: changeList.getFakeNodeId(), linkNodeId: parseInt(node["link"].replace("topic:",""))});
    }

    if(node.icon!=null) changeElem["new_data"]["icon"] = node.icon;
    if(node.note!=null) changeElem["new_data"]["note"] = node.note;

    // TO DO - TEST
    if(node.pos!=null) changeElem["new_data"]["pos"] = node.pos;

    if(node.focus!=null&&node.focus==true) changeList.setFocusNodeId(changeList.getFakeNodeId());
    changeList.insertNodeChangeMapping();
    changeList.insertChange(changeElem);
    if(node.children!=null){
      for(var i=0;i<node.children.length;i++){
        var child = JSON.parse(JSON.stringify(node.children[i]));
        child["parentNodeId"] = nodeId;
        insertSubtree(child,changeList);
      }
    }
  }
  var moveNode = function(mapId,nodeId,newParentNodeId,changeList){
    if(nodeId==null||parseInt(nodeId)<0) return null;
    if(newParentNodeId==null/*||parseInt(newParentNodeId)<0*/) return null;
    if(mapId==null||newParentNodeId==null||nodeId==null) return null;
    if(changeList==null) changeList = generalChangeList;
    var changeElem = {"idea_id":nodeId,"type":"Move","new_data":{"parent":newParentNodeId,"rank":0}};
    changeList.insertChange(changeElem);
    return this;
  }
  var moveNodeToRoot = function(mapId,nodeId,newParentNodeId,position,changeList){
    if(nodeId==null||parseInt(nodeId)<0) return null;
    if(newParentNodeId==null/*||parseInt(newParentNodeId)<0*/) return null;
    if(position==null/*||parseInt(newParentNodeId)<0*/) return null;
    if(mapId==null||newParentNodeId==null||nodeId==null) return null;
    if(changeList==null) changeList = generalChangeList;
    var changeElem = {"idea_id":nodeId,"type":"Move","new_data":{"parent":newParentNodeId,"rank":0,"pos":position}};
    changeList.insertChange(changeElem);
    return this;
  }
  var doChanges = function(mapID,changeList){
    var that = this;
    return new Promise(function (resolve, reject){
      if(changeList==null) changeList = generalChangeList;
      if(changeList.getChanges().length==0){
        resolve([]);
        return;
      }
      var changes = JSON.stringify(changeList.getChanges());
      var items = {
        access_token: that._accessToken,
        method: "mm.realtime.do",
        map_id: mapID,
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
      var f = function(){
        makeRequest(opts).then(function (resp){
          var ret = JSON.parse(resp.responseText);
          var nodesToChange = ret.responses;
          var revision = ret.revision != null ? ret.revision : null;
          if(nodesToChange!=null){
            for(var i=0;i<nodesToChange.length;i++){
              if(nodesToChange[i]["client_id"]!=null) changeList.insertRealNodeId(nodesToChange[i]["client_id"],nodesToChange[i]["id"]);
            }
            changeList.replaceNodeIds();
          }
          that.updateNodeLinkings(mapID).then(function(ch){
            resolve({changeList:changeList.getChanges().concat(ch),focusNodeId:changeList.getFocusNodeId(),revision:revision});
            changeList.emptyChanges();
            changeList.emptyNodeChangeMapping();
          })
        });
      }
      if(Scrap.getBrainstormingMode()) setTimeout(f,100);
      else f();
    })
  }
  var setMindmapTags = function(mapId,tags){
    let that = this
    return new Promise(function (resolve,reject){
      var items = {
        access_token: that._accessToken,
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
    let that = this
    return new Promise(function (resolve,reject){
      if(nodeId==null||parseInt(nodeId)<0) resolve();
      if(mapId==null||nodeId==null) resolve();
      var items = {
        access_token: that._accessToken,
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
        //var changeElem = {"type":"Property","idea_id":nodeId,"new_data":{"id":nodeId,"closed":true}};
        //MAP_CHANGE_LIST.push(changeElem);
        resolve();
      })
    })
  }
  var getIdeaLink = function(mapId,nodeId){
    let that = this
    return new Promise(function(resolve,reject){
      var items = {
        access_token: that._accessToken,
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
        var i = ret.rsp.ideas.idea.find((el) => {return el.id==nodeId});
        if(i==null||i.link==null)resolve(null);
        else resolve(i.link);
      });
    })
  }
  var getMapIdeas = function(mapId){
    let that = this
    return new Promise(function(resolve,reject){
      var items = {
        access_token: that._accessToken,
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
  var existsMap = function(mapId){
    let that = this
    return new Promise(function(resolve,reject){
      var items = {
        access_token: that._accessToken,
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
        if(ret.rsp.stat=="ok")resolve(true);
        else resolve(false);
      });
    })
  }
  var getExplicateProblemMap = function(mapId){
    let that = this
    return new Promise(function(resolve,reject){
      var items = {
        access_token: that._accessToken,
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
        if(ret.rsp.stat!="ok"){
          resolve(null);
          return;
        }
        var getNodeByText = function(text){
          var aux = ret.rsp.ideas.idea.find((el) => {return el.title!=null && el.title.trim().replace(/\n/gi," ") == text});
          return aux;
        }
        var getNodeById = function(id){
          var aux = ret.rsp.ideas.idea.find((el) => {return el.id == id});
          return aux;
        }
        var getNodeChildren = function(nodeId){
          var aux = ret.rsp.ideas.idea.filter((el) => {return el.parent==nodeId});
          return aux;
        }
        var getReversedNode = function(nodeId){
          var aux = ret.rsp.ideas.idea.find((el) => {return el.link=="topic:"+nodeId});
          return aux;
        }

        var problemStatementNode = getNodeByText("Set Problem Statement");
        var problemStatement = [];
        if(problemStatementNode!=null){
          var problemStatementChildren = getNodeChildren(problemStatementNode.id);
          for(var i=0;i<problemStatementChildren.length;i++){
            problemStatement.push({title:problemStatementChildren[i].title,id:problemStatementChildren[i].id})
          }
        }

        var analyseStakeholdersNode = getNodeByText("Analyse Stakeholders");
        var stakeholders = [];
        if(analyseStakeholdersNode!=null){
          var analyseStakeholdersChildren = getNodeChildren(analyseStakeholdersNode.id);
          for(var i=0;i<analyseStakeholdersChildren.length;i++){
            if(analyseStakeholdersChildren[i].title.trim().replace(/\n/gi," ") != "Identify Stakeholders") stakeholders.push({title:analyseStakeholdersChildren[i].title,id:analyseStakeholdersChildren[i].id});
          }
        }

        var causesNode = getNodeByText("Ascertain Causes");
        var consNode = getNodeByText("Ascertain Consequences");

        var subcauseLabel = "...leads to...";
        var subcauseStopLabel = "Why?";
        var subconsLabel = "...follows from...";
        var subconsStopLabel = "What follows from ...?";
        var stopLabels = ["Supporting Evidences?","Who else addresses it?"];
        var parseBranch = function(nodeId,separator,stopLabels){
          var aux = getNodeById(nodeId);
          var node = {title: aux.title,
                      id: nodeId}
          var nodeChildren = getNodeChildren(nodeId);

          var mirrorNode = getReversedNode(nodeId);
          if(mirrorNode!=null){
            var mirror = {
              title : mirrorNode.title,
              id: mirrorNode.id
            }
            if(mirrorNode.icon!=null&&(mirrorNode.icon=="status_ok"||mirrorNode.icon.indexOf("status_ok")!=-1)) node["active"] = true;
            node["mirror"] = mirror;
          }
          // get mirror
          var children = [];
          for(var i=0;i<nodeChildren.length;i++){
            if(stopLabels.indexOf(nodeChildren[i].title.trim().replace(/\n/gi," "))!=-1) continue;
            if(nodeChildren[i].title.trim().replace(/\n/gi," ")==separator){
              var separatorChildren = getNodeChildren(nodeChildren[i].id);
              for(var j=0;j<separatorChildren.length;j++){
                children.push(parseBranch(separatorChildren[j].id,separator,stopLabels));
              }
            }
          }
          node["children"] = children;
          return node;
        }
        var causesChildren = getNodeChildren(causesNode.id);
        var causes = [];
        for(var i=0;i<causesChildren.length;i++){
          causes.push(parseBranch(causesChildren[i].id,subcauseLabel,stopLabels.concat([subcauseStopLabel])));
        }
        var consChildren = getNodeChildren(consNode.id);
        var cons = [];
        for(var i=0;i<consChildren.length;i++){
          cons.push(parseBranch(consChildren[i].id,subconsLabel,stopLabels.concat([subconsStopLabel])));
        }

        var activeCauses = [];
        var activeCons = [];

        var findActive = function(node){
          var active = [];
          if(node.children.length==0&&node.active&&node.mirror!=null)active.push(node.mirror);
          else if(node.children.length>0){
            for(var i=0;i<node.children.length;i++){
              active = active.concat(findActive(node.children[i]));
            }
          }
          return active;
        }
        for(var i=0;i<causes.length;i++){
          activeCauses = activeCauses.concat(findActive(causes[i]))
        }
        for(var i=0;i<cons.length;i++){
          activeCons = activeCons.concat(findActive(cons[i]))
        }


        var problem = {
          problemStatement: problemStatement,
          stakeholders: stakeholders,
          causes: causes,
          consequences: cons,
          activeCauses: activeCauses,
          activeConsequences: activeCons
        }
        resolve(problem);
      });
    })
  }
  var getMapByName = function(mapName,page){
    let that = this
    return new Promise(function(resolve,reject){
      var perPage = 100;
      var items = {
        access_token: that._accessToken,
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
    let that = this
    return new Promise(function(resolve,reject){
      var perPage = 100;
      var items = {
        access_token: that._accessToken,
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
  var getUserName = function(){
    let that = this
    return new Promise(function(resolve,reject){
      var items = {
        access_token: that._accessToken,
        method: "mm.test.login"
      }
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        var ret = JSON.parse(resp.responseText);
        resolve(ret.rsp.user.fullname);
      });
    })
  }
  var undoLastChange = function(mapId){
    let that = this
    return new Promise(function(resolve,reject){
      var items = {
        access_token: that._accessToken,
        method: "mm.maps.undo",
        map_id: mapId
      }
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        resolve();
      });
    })
  }
  var getMapRevision = function(mapId){
    let that = this
    return new Promise(function(resolve,reject){
      var items = {
        access_token: that._accessToken,
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
        resolve(ret.rsp.revision);
      });
    })
  }
  var getRevisionChanges = function(mapId,revision){
    let that = this
    return new Promise(function(resolve,reject){
      var items = {
        access_token: that._accessToken,
        method: "mm.realtime.poll",
        map_id: mapId,
        client_revision: revision
      }
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        var ret = JSON.parse(resp.responseText);
        resolve(ret.changes);
      });
    })
  }
  var getParticipantData = function(userId){
    let that = this
    return new Promise(function (resolve,reject){
      if(userId==null) resolve();
      var items = {
        access_token: that._accessToken,
        method: "mm.people.getInfo",
        user_id: userId,
      }
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        var ret = JSON.parse(resp.responseText);
        var user = {
          firstName: ret.rsp.user.firstname,
          lastName: ret.rsp.user.lastname,
          email: ret.rsp.user.email
        }
        resolve(user);
      })
    })
  }
  var getMapData = function (mapId){
    let that = this
    return new Promise(function (resolve,reject){
      if(mapId==null) resolve();
      var items = {
        access_token: that._accessToken,
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
        var ideas = ret.rsp.ideas.idea;
        var participants = [ret.rsp.map.owner];
        if(ret.rsp.map.sharedwith!="") participants.concat(ret.rsp.map.sharedwith)
        var pl = [];
        for(var i=0;i<participants.length;i++){
          pl.push(getParticipantData(participants[i]));
        }
        Promise.all(pl).then(function(users){
          resolve({users:users,ideas:ideas});
        })
      })
    })
  }
  var getMapInfo = function(mapId,revision){
    let that = this
    return new Promise(function (resolve,reject){
      var items = {
        access_token: that._accessToken,
        method: "mm.maps.getMap",
        map_id: mapId,
      }
      if(revision!=null) items["revision"] = revision;
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        var ret = JSON.parse(resp.responseText);
        resolve(ret.rsp);
      })
    })
  }
  var getMapHistory = function(mapId){
    let that = this
    return new Promise(function (resolve,reject){
      var items = {
        access_token: that._accessToken,
        method: "mm.maps.history",
        map_id: mapId,
      }
      var opts = {
        method: "GET",
        url: "https://www.mindmeister.com/services/rest/oauth2",
        params: items
      }
      makeRequest(opts).then(function (resp){
        var ret = JSON.parse(resp.responseText);
        resolve(ret.rsp);
      })
    })
  }
  return {
    setAccessToken: setAccessToken,
    getAccessToken: getAccessToken,
    ChangeList: ChangeList,
    insertIdea: insertIdea,
    setIdeaStyle: setIdeaStyle,
    modifyIdea: modifyIdea,
    removeIdea: removeIdea,
    insertSubtree: insertSubtree,
    doChanges: doChanges,
    closeNode: closeNode,
    decolorIdea: decolorIdea,
    moveNode: moveNode,
    getIdeaLink: getIdeaLink,
    existsMap: existsMap,
    getMapIdeas: getMapIdeas,
    updateNodeLinkings: updateNodeLinkings,
    getExplicateProblemMap: getExplicateProblemMap,
    getMapByName: getMapByName,
    getMapByNameRegExp: getMapByNameRegExp,
    getUserName: getUserName,
    undoLastChange: undoLastChange,
    getMapRevision: getMapRevision,
    getRevisionChanges: getRevisionChanges,
    getMapData: getMapData,
    getParticipantData: getParticipantData,
    getMapInfo: getMapInfo,
    setMindmapTags: setMindmapTags,
    getMapHistory: getMapHistory,
    moveNodeToRoot: moveNodeToRoot
  }
})();

// ----------------ANTONYMS - BIG HUGE THESAURUS------------

var Antonyms = (function (){
  var BIG_HUGE_THESAURUS_API = "3da6751db423d4acbd3ea27817e590d7";
  var selectAntonyms = function(word){
    return new Promise(function (resolve, reject){
      var opts = {
        method: "GET",
        url: "https://words.bighugelabs.com/api/2/"+BIG_HUGE_THESAURUS_API+"/"+word+"/json",
      }
      makeRequest(opts).then(function (resp){
        var ret = JSON.parse(resp.responseText);
        if(ret==null) resolve([]);
        var isVerb = false;
        var antonyms = [];
        for(var key in ret){
          if(key == "verb") isVerb = true;
          if(ret[key].ant != null){
            for(var i=0;i<ret[key].ant.length;i++){
              if(antonyms.indexOf(ret[key].ant[i])==-1) antonyms.push(ret[key].ant[i]);
            }
          }
        }
        if(antonyms.length == 0 && isVerb) antonyms.push("not"+word.substr(0,1).toUpperCase()+word.substring(1).toLowerCase());
        resolve(antonyms);
      }).catch(function (error){
        if(error.status == 404) resolve([]);
        reject(error);
      });
    })
  }
  return{
    selectAntonyms: selectAntonyms
  }
})();

// ----------------DSCAFFOLDING------------------------------

var DScaffolding = (function (){
  var templateName;
  var NODE_STYLES = {
    prompt_completed: {
      bold: 0,
      italic: 0,
      color: "666352",
      fontSize: 120,
      boxStyle: 1,
      backgroundColor: "fff6cc",
      fonts: []
    },
    prompt: {
      bold: 1,
      italic: 0,
      color: "ffffff",
      fontSize: 120,
      boxStyle: 1,
      backgroundColor: "4769d1",// (71, 105, 209) "e67c73"
      fonts: []
    },
    template: {
      bold: 0,
      italic: 0,
      color: "666352",
      fontSize: 120,
      boxStyle: 1,
      backgroundColor: "fff6cc",
      fonts: []
    }
  }
  var Icons = {
    enabled : "status_ok",
    disabled : "status_error",
    reload_wheel : "arrows_counterclockwise"
  }
  var TASKS_ENABLED = false;
  var parent = this;
  var Nodes = (function(){
    var templateNodesDef = {
      START_HERE : "Start Here!",
      DESCRIBE_PRACTICE : "Describe Practice",
      DESCRIBE_ENVIRONMENT : "Describe Environment",
      DESCRIBE_ACTIVITIES : "Describe Activities",
      DESCRIBE_TOOLING : "Describe Tooling",
      EXPLICATE_PROBLEM: "Explicate Problem",
      SET_PROBLEM_STATEMENT : "Set Problem Statement",
      ANALYSE_STAKEHOLDERS : "Analyse Stakeholders",
      IDENTIFY_STAKEHOLDERS : {
        node: "Identify Stakeholders",
        children: {
          ADD_CLIENTS: "Add Client(s)",
          ADD_DECISION_MAKERS: "Add Decision Maker(s)",
          ADD_PROFESSIONALS: "Add Professional(s)",
          ADD_WITNESSES: "Add Witness(es)"
        }
      },
      ASCERTAIN_CONSEQUENCES : "Ascertain Consequences",
      ASCERTAIN_CAUSES : "Ascertain Causes",
      ALLEVIATE_CONSEQUENCES : "Alleviate Consequences",
      PROBLEM_AS_SOLUTIONS : "Assess Problem as Solutions",
      PROBLEM_AS_DIFFICULTIES : "Assess Problem as Difficulties",
      LESSEN_CAUSES : "Lessen Causes",
      DECIDE_REQUIREMENTS_CAPTURE_IDEAS: {
        node: "Decide Requirements and Capture Design Ideas",
        children: {
          FUNCTIONAL_REQUIREMENTS: {
            node: "Functional Requirements",
            children: {
              REQ_PURPOSE_BENEFITS: "Requirements for Achieving purpose and benefits",
              REQ_REDUCE_CAUSES: "Requirements for Reducing causes of the problem"
            }
          },
          NON_FUNCTIONAL_REQUIREMENTS: "Non-functional Requirements",
        }
      },
      DEFINE_REQUIREMENTS : "Define Requirements",
      ELICIT_REQUIREMENTS : "Elicit Requirements",
      DRAG_DROP_ROOT_CAUSES : "Drag&Drop root-causes into the categories below",
      IDENTIFY_RISKS : "Identify Risks",
      ANALYSE_RISKS : "Analyse Risks",
      PRIORITISE_RISKS : {
        node: "Prioritise Risks",
        children: {
          ANALYSED_RISK_LIST_HIGH: "High",
          ANALYSED_RISK_LIST_MEDIUM: "Medium",
          ANALYSED_RISK_LIST_LOW: "Low"
        }
      },
      DETERMINE_RISK_TREATMENTS : "Determine Risk Treatments",
      ENACT_RISK_TREATMENTS : "Enact Risk Treatments",
      FORMULATE_DESIGN_THEORY : "Formulate Design Theory",
      EVALUATE_PURPOSEFUL_ARTEFACT : {
        node: "Evaluate Purposeful Artefact (and its Design Theory)",
        children: {
          HYPOTHESIS : "Hypothesis"
        }
      },
      ENUMERATE_TOP_LEVEL_COMPONENTS : "Enumerate top level components",
      DETERMINE_CHARACTERISE_COMPONENTS: "Determine and characterise the artefact(s) to be evaluated",
      CHARACTERISE_CONTEXT: {
        node: "Characterise DSR Project Context",
        children: {
          WHAT_ARE_TIME_CONSTRAINTS: {
            node: "What are the time constraints?",
            children: {
              TIME_CONSTRAINTS_ENOUGH: "Is that enough?"
            }
          },
          FUNDING_CONSTRAINTS: {
            node: "What are the funding constraints?",
            children: {
              FUNDING_CONSTRAINTS_ENOUGH: "Is that enough?"
            }
          },
          NEEDED_SOFTWARE_HARDWARE: {
            node: "Do you have access to needed hardware and/or software?",
            children: {
              SOFTWARE_HARDWARE_ACCESS: "Do you have access?"
            }
          },
          ORGANISATION_ACCESS: {
            node: "Do you need and can you get access to organisations for evaluation?",
            children: {
              DO_YOU_NEED_ACCESS_ORGANISATION: "Do you need access to one or more organisations for problem analysis and/or evaluation?"
            }
          },
          NEEDED_SKILLS: {
            node: "Do you have the skills needed to conduct the research?",
            children: {
              DO_YOU_HAVE_SUFFICIENT_SKILLS: "For each needed skill, do you have sufficient skills?",
              CAN_YOU_OBTAIN_SKILLS: "For each insufficient skill, can you learn and obtain sufficient skills?"
            }
          },
          IDENTIFY_FEASIBILITY_UNCERTAINTIES: {
            node: "Identify development and feasibility uncertainties",
            children: {
              IDENTIFY_TECHNICAL_FEASIBILITY_UNCERTAINTIES: "Technical feasibility",
              IDENTIFY_HUMAN_UNCERTAINTIES: "Human usability",
              IDENTIFY_ORGANISATIONAL_UNCERTAINTIES: "Organisational feasibility"
            }
          },
          IDENTIFY_ETHICAL_CONSTRAINTS: {
            node: "Are there any ethical constraints that limit what you can or should do on your research?",
            children: {
              ANIMAL_RESEARCH_CONSTRAINTS: "Animal research constraints? (List them)",
              PRIVACY_RESEARCH_CONSTRAINTS: "Privacy constraints? (List them)",
              HUMAN_RESEARCH_CONSTRAINTS: "Human research subject constraints? (List them)",
              ORGANISATIONAL_RESEARCH_CONSTRAINTS: "Organisational risk constraints? (List them)",
              SOCIETAL_RESEARCH_CONSTRAINTS: "Societal risk constraints? (List them)"
            }
          }
        }
      },
    }
    var templateNodes = {};
    var templateNodesText = {};
    var nodeTextList = {};
    var init = function(){
      var getChildsWithText = function(node,text){
        var childContainer = document.getElementById("tk_children_"+node.id);
        if(childContainer==null) return null;
        var childNodes = childContainer.querySelectorAll(".node");
        var childList = [];
        for(var i=0;i<childNodes.length;i++){
          if(Scrap.selectContent(childNodes[i])==text) {
            childList.push(childNodes[i]);
          }
        }
        return childList;
      }
      var insertNode = function(key,elem,parent){
        if(elem==null) return;
        if(typeof elem == "string"){
          nodeTextList[key] = elem;
          if(parent == null){
            var aux = Scrap.getNodesWithText(elem);
            templateNodes[key] = (aux!=null&&aux.length>0) ? aux[0] : null;
            templateNodesText[key] = elem;
          }
          else {
            var children = parent.getChildrenWithText(elem);
            templateNodes[key] = (children!=null&&children.length>0) ? children[0] : null;
            templateNodesText[key] = elem;
          }
        }
        else if(typeof elem == "object"){
          var aux = Scrap.getNodesWithText(elem.node);
          templateNodes[key] = (aux!=null&&aux.length>0) ? aux[0] : null;
          templateNodesText[key] = elem.node;
          nodeTextList[key] = elem.node;
          for(var childKey in elem.children){
            insertNode(childKey, elem.children[childKey], aux[0]);
          }
        }
      }
      for(var key in templateNodesDef){
        insertNode(key, templateNodesDef[key]);
      }
    }
    var getTemplateNodeKey = function(nodeText){
      for(key in nodeTextList){
        if(nodeTextList[key] == nodeText) return key;
      }
      return null;
    }
    return {
      templateNodes: templateNodes,
      templateNodesText: templateNodesText,
      templateNodesPre: templateNodesDef,
      getTemplateNodeKey: getTemplateNodeKey,
      init: init
    }
  })()
  var Prompter = (function(){
    var Nodes = {
      WHAT_FOLLOWS_FROM_EP : {
        text: "What follows from it?",
        completed: "...leads to..."
      },
      WHY_EP : {
        text: "Why?",
        completed: "...follows from..."
      },
      WHAT_FOLLOWS_FROM : {
        text: "What follows from ...?",
        completed: "...follows from..."
      },
      WHY : {
        text: "Why?",
        completed: "...leads to..."
      },
      HOW : {
        text: "How?",
        completed: "How?"
      },
      HOW_ARE_YOU_GOING_TO_ADDRESS_IT : {
        text: "How are you going to address it?",
        completed: "How are you going to address it?"
      },
      JUSTIFICATORY_KNOWLEDGE:{
        text: "Justificatory Knowledge",
        complete: "Justificatory Knowledge"
      },
      SUPPORTING_EVIDENCES : {
        text: "Supporting Evidences?",
        note: "What proof do I have that this cause exists? (Is it concrete? Is it measurable?) What proof do I have that this cause could lead to the stated effect?\n(Am I merely asserting causation?) What proof do I have that this cause actually contributed to the problem I'm looking at? (Even given that it exists and could lead to this problem, how do I know it wasn't actually something else?)\nIs anything else needed, along with this cause, for the stated effect to occur? (Is it self-sufficient? Is something needed to help it along?)Can anything else, besides this cause, lead to the stated effect? (Are there alternative explanations that fit better? What other risks are there?)"
      },
      WHO_ELSE_ADDRESSES_IT : {
        text: "Who else addresses it?",
        note: "What proof do I have that this cause exists? (Is it concrete? Is it measurable?) What proof do I have that this cause could lead to the stated effect?\n(Am I merely asserting causation?) What proof do I have that this cause actually contributed to the problem I'm looking at? (Even given that it exists and could lead to this problem, how do I know it wasn't actually something else?)\nIs anything else needed, along with this cause, for the stated effect to occur? (Is it self-sufficient? Is something needed to help it along?)Can anything else, besides this cause, lead to the stated effect? (Are there alternative explanations that fit better? What other risks are there?)"
      },
      CLICK_ICON_TO_ADDRESS : {
        text: "Click icon to address it",
        note: ""
      },
      DESIGN_THEORY_CONS_SEPARATOR: {
        text: "It is hypothesized that this problem leads to"
      },
      DESIGN_THEORY_CAUSE_SEPARATOR: {
        text: "It is hypothesized that this problem causes"
      },
      WHICH_HOW_DOES_IT_ADDRESS: {
        text: 'Which "How" does it address?'
      },
      REPHRASE_RISK: {
        text: "Rephrase risk for your organization/domain/artefact"
      },
      DETERMINE_RISK_SIGNIFICANCE: {
        text: "Determine Significance/Cost",
        options: ["Ignorable","Unimportant","Less important","Important","Very important","Catastrofic"]
      },
      DETERMINE_RISK_LIKELIHOOD: {
        text: "Determine Likelihood",
        options: ["Highly unlikely","Very unlikely","Unlikely","Likely","Very likely","Highly likely"]
      },
      APPROPRIATE_RISK_TREATMENT_STRATEGY: {
        text: "Appropriate risk treatment strategy"
      },
      SUGGESTED_RISK_TREATMENTS: {
        text: "Suggested treatments"
      },
      WHAT_ARE_ITS_LIMITATIONS: {"text": "What are its limitations?"}
    }
    var Styles = {
      prompt_completed: {
        bold: 0,
        italic: 0,
        color: "666352",
        fontSize: 120,
        boxStyle: 1,
        backgroundColor: "fff6cc",
        fonts: []
      },
      prompt: {
        bold: 1,
        italic: 0,
        color: "ffffff",
        fontSize: 120,
        boxStyle: 1,
        backgroundColor: "4769d1",// (71, 105, 209) "e67c73"
        fonts: []
      },
    }
    var promptNodesText = {
      SUPPORTING_EVIDENCES : "Supporting Evidences?",
      HOW : "How?",
      THAT_LEADS_TO : "...that leads to...",
      WHY : "Why?",
      CLICK_ICON_TO_ADDRESS : "Click icon to address it"
    }
    var STYLE_RED = {
      bold: 1,
      italic: 0,
      color: "ffffff",
      fontSize: 120,
      boxStyle: 1,
      backgroundColor: "e67c73"
    }
    var STYLE_YELLOW = {
      bold: 1,
      italic: 0,
      color: "ffffff",
      fontSize: 120,
      boxStyle: 1,
      backgroundColor: "fff6cc"
    }
    return {
      Nodes: Nodes,
      Styles: Styles,
      nodesText : promptNodesText
    }
  })()
  var Completeness = (function(){
    var MAX_COMPLETENESS = 1.0;
    var REALIZATION_GRADIENT_COLOR = {
      min: {
        r: 255,
        g: 250,
        b: 230
      },
      max: {
        r: 255,
        g: 204,
        b: 0
      }
    }
    var onChildlistModified = function(node,callback,subtree){
      subtree = typeof subtree !== 'undefined' ? subtree : false;
      var observer = new MutationObserver(function( mutations ) {
        mutations.forEach(function(mutation) {
          if(mutation.type=="childList"){
            callback.call(this,mutation.addedNodes);
          }
        });
      });
      var config = {
        childList: true
      };
      if(subtree) config["subtree"] = true;
      var targetNode = $("#tk_children_"+node.id)[0];
      observer.observe(targetNode, config);
    }
    var calculateCompletenessGrade = function(completeness,options){
      var refGrade = completeness.references >= options.references ? 1.0 : completeness.references / options.references;
      var childGrade = completeness.children >= options.children ? 1.0 : completeness.children / options.children;
      var descGrade = completeness.descendants >= options.descendants ? 1.0 : completeness.descendants / options.descendants;
      var sum = refGrade + childGrade + descGrade;
      return sum / 3.0;
    }
    var getSubtreeReferences = function(node){
      var childs =  document.querySelectorAll("#tk_children_"+node.id+" > .tk_container > .tk_open_container > .node");
      var references = 0;
      if(new Scrap.Node(node).getContent()==Prompter.Nodes.SUPPORTING_EVIDENCES.text){
        references += childs.length;
      }
      else{
        for(var i=0;i<childs.length;i++){
          references += getSubtreeReferences(childs[i]);
        }
      }
      return references;
    }
    var getCompletenessColor = function(realization){
      var r = parseInt(REALIZATION_GRADIENT_COLOR.min.r-realization/MAX_COMPLETENESS*(REALIZATION_GRADIENT_COLOR.min.r-REALIZATION_GRADIENT_COLOR.max.r));
      var g = parseInt(REALIZATION_GRADIENT_COLOR.min.g-realization/MAX_COMPLETENESS*(REALIZATION_GRADIENT_COLOR.min.g-REALIZATION_GRADIENT_COLOR.max.g));
      var b = parseInt(REALIZATION_GRADIENT_COLOR.min.b-realization/MAX_COMPLETENESS*(REALIZATION_GRADIENT_COLOR.min.b-REALIZATION_GRADIENT_COLOR.max.b));
      return {r: r, g: g, b: b};
    }
    var getCompleteness = function(node,options){
      var childs =  document.querySelectorAll("#tk_children_"+node.id+" > .tk_container > .tk_open_container > .node");
      var numDescendants = $("#tk_children_"+node.id).find(".node").length;
      var numChilds = childs.length;
      var refNum = getSubtreeReferences(node);
      var completeness = {
        references : refNum,
        descendants : numDescendants,
        children : numChilds
      }
      var grade = calculateCompletenessGrade(completeness,options);
      var lastCompleteness = $("#"+node.id).attr("lastCompleteness");
      if(lastCompleteness==null) $("#"+node.id).attr("lastCompleteness",grade);
      else if(lastCompleteness != grade){
        // update color
        var newColor = getCompletenessColor(grade);
        var cl = new Mindmeister.ChangeList();
        var style = JSON.parse(JSON.stringify(NODE_STYLES.template));
        style["backgroundColor"] = Utils.rgbToHex(newColor.r,newColor.g,newColor.b);
        Mindmeister.modifyIdea(Scrap.mapID,node.id,{style:style},cl);
        $("#"+node.id).attr("lastCompleteness",grade);
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          document.getElementById(node.id).style.backgroundColor = "#"+Utils.rgbToHex(newColor.r,newColor.g,newColor.b);
        })
      }
    }
    var observeCompleteness = function(node,options){
      getCompleteness(node,options);
      onChildlistModified(node,function(){
        getCompleteness(node,options)
      },true);
    }
    var init = function(){
      chrome.storage.sync.get(["COMPLETENESS_OPTIONS"], function(options){
        var completenessOptions = options["COMPLETENESS_OPTIONS"];
        var completenessPracticeNode = completenessOptions["describePractice"] != null ? completenessOptions["describePractice"] : {references: 1, children: 1, descendants: 1};
        if(Nodes.templateNodes.DESCRIBE_PRACTICE!=null) observeCompleteness(Nodes.templateNodes.DESCRIBE_PRACTICE,completenessPracticeNode);

        var completenessAscertainConsequencesNode = completenessOptions["ascertainConsequences"] != null ? completenessOptions["ascertainConsequences"] : {references: 1, children: 1, descendants: 1};
        if(Nodes.templateNodes.ASCERTAIN_CONSEQUENCES!=null) observeCompleteness(Nodes.templateNodes.ASCERTAIN_CONSEQUENCES,completenessAscertainConsequencesNode);

        var completenessAscertainCausesNode = completenessOptions["ascertainCauses"] != null ? completenessOptions["ascertainCauses"] : {references: 1, children: 1, descendants: 1};
        if(Nodes.templateNodes.ASCERTAIN_CAUSES!=null) observeCompleteness(Nodes.templateNodes.ASCERTAIN_CAUSES,completenessAscertainCausesNode);

        /*var completenessSupportingEvidencesConsequences = completenessOptions["supportingEvidencesConsequences"] != null ? completenessOptions["supportingEvidencesConsequences"] : {references: 1, children: 1, descendants: 1};
        var ascertainConsequencesSupportingEvidences = getChildsWithText(Nodes.templateNodes.ASCERTAIN_CONSEQUENCES,"Supporting Evidences?");
        for(var i=0;i<ascertainConsequencesSupportingEvidences.length;i++){
          observeCompleteness(ascertainConsequencesSupportingEvidences[i],completenessSupportingEvidencesConsequences);
        }

        DScaffolding.onChildsAdded(Nodes.templateNodes.ASCERTAIN_CONSEQUENCES,function(addedNodes){
          if(addedNodes==null||addedNodes.length==0) return;
          var newNodes = addedNodes[0].querySelectorAll("div.node");
          var addedNode = $(addedNodes[0]).find(".node")[0];
          var addedNodeContent = Scrap.selectContent(addedNode);
          var completenessSupportingEvidencesConsequences = completenessOptions["supportingEvidencesConsequences"] != null ? completenessOptions["supportingEvidencesConsequences"] : {references: 1, children: 1, descendants: 1};
          if(addedNodeContent=="Supporting Evidences?") observeCompleteness(addedNode,completenessSupportingEvidencesConsequences);
        },true);

        var completenessSupportingEvidencesCauses = completenessOptions["supportingEvidencesCauses"] != null ? completenessOptions["supportingEvidencesCauses"] : {references: 1, children: 1, descendants: 1};
        var ascertainCausesSupportingEvidences = getChildsWithText(Nodes.templateNodes.ASCERTAIN_CAUSES,"Supporting Evidences?");
        for(var i=0;i<ascertainCausesSupportingEvidences.length;i++){
          observeCompleteness(ascertainCausesSupportingEvidences[i],completenessSupportingEvidencesCauses);
        }

        DScaffolding.onChildsAdded(Nodes.templateNodes.ASCERTAIN_CAUSES,function(addedNodes){
          if(addedNodes==null||addedNodes.length==0) return;
          var newNodes = addedNodes[0].querySelectorAll("div.node");
          var addedNode = $(addedNodes[0]).find(".node")[0];
          var addedNodeContent = Scrap.selectContent(addedNode);
          var completenessSupportingEvidencesCauses = completenessOptions["supportingEvidencesCauses"] != null ? completenessOptions["supportingEvidencesCauses"] : {references: 1, children: 1, descendants: 1};
          if(addedNodeContent=="Supporting Evidences?") observeCompleteness(addedNode,completenessSupportingEvidencesCauses);
        },true); */

      });
    }
    return {
      init: init
    }
  })()

  var NodesNew = (function(){
    var templateNodesDef = {
      DESCRIBE_PROBLEMATIC_PHENOMENA: {
        node: "Describe Problematic Phenomena",
        children: {
          DESCRIPTIVE_QUESTIONS: "Descriptive Questions",
          OCCURRENCE_QUESTIONS: "Occurrence Questions"
        }
      },
      DESCRIBE_PRACTICE: "Describe Practice",
      DESCRIBE_STAKEHOLDERS : {
        node: "Describe Stakeholders",
        children: {
          ADD_CLIENTS: "Add Client(s)",
          ADD_DECISION_MAKERS: "Add Decision Maker(s)",
          ADD_PROFESSIONALS: "Add Professional(s)",
          ADD_WITNESSES: "Add Witness(es)"
        }
      },
      TYPE_OF_CONTRIBUTION: {
        node: "Type of Contribution",
        children: {
          NEW_SOLUTION_NEW_PROBLEM: "A new solution for a new problem",
          KNOWN_SOLUTION_NEW_PROBLEM: "A known solution for a new problem",
          NEW_SOLUTION_KNOWN_PROBLEM: "A new solution for a known problem",
          KNOWN_SOLUTION_KNOWN_PROBLEM: "A known solution for a known problem"
        }
      },
      DESCRIBE_TERMINOLOGY : "Describe Terminology",
      SET_PROBLEM_STATEMENT : "Set Problem Statement",
      PROBLEM_AS_DIFFICULTIES : {
        node: "Assess Problem as Difficulties",
        children: {
          ASCERTAIN_CONSEQUENCES : "Ascertain Consequences",
          ASCERTAIN_CAUSES : "Ascertain Causes"
        }
      },
      PROBLEM_AS_SOLUTIONS : {
        node: "Assess Problem as Solutions",
        children: {
          ALLEVIATE_CONSEQUENCES : "Alleviate Consequences",
          LESSEN_CAUSES : "Lessen Causes"
        }
      },
      REQUIREMENTS: {
        node: "Requirements",
        children: {
          FUNCTIONAL_REQUIREMENTS: "Functional Requirements",
          NON_FUNCTIONAL_REQUIREMENTS: "Non-functional Requirements"
        }
      },
      DESIGN_PROBLEM_TEMPLATE: {
        node: "Design Problem Template",
        children: {
          DESIGN_PROBLEM_TEMPLATE_IMPROVE: "Improve",
          DESIGN_PROBLEM_TEMPLATE_BY: "By",
          DESIGN_PROBLEM_TEMPLATE_THAT_SATISFIES: "That satisfies",
          DESIGN_PROBLEM_TEMPLATE_IN_ORDER_TO: "In order to help",
        }
      }
    }
    var templateNodes = {};
    var templateNodesText = {};
    var nodeTextList = {};
    var init = function(){
      var getChildsWithText = function(node,text){
        var childContainer = document.getElementById("tk_children_"+node.id);
        if(childContainer==null) return null;
        var childNodes = childContainer.querySelectorAll(".node");
        var childList = [];
        for(var i=0;i<childNodes.length;i++){
          if(Scrap.selectContent(childNodes[i])==text) {
            childList.push(childNodes[i]);
          }
        }
        return childList;
      }
      var insertNode = function(key,elem,parent){
        if(elem==null) return;
        if(typeof elem == "string"){
          nodeTextList[key] = elem;
          if(parent == null){
            var aux = Scrap.getNodesWithText(elem);
            templateNodes[key] = (aux!=null&&aux.length>0) ? aux[0] : null;
            templateNodesText[key] = elem;
          }
          else {
            var children = parent.getChildrenWithText(elem);
            templateNodes[key] = (children!=null&&children.length>0) ? children[0] : null;
            templateNodesText[key] = elem;
          }
        }
        else if(typeof elem == "object"){
          var aux = Scrap.getNodesWithText(elem.node);
          templateNodes[key] = (aux!=null&&aux.length>0) ? aux[0] : null;
          templateNodesText[key] = elem.node;
          nodeTextList[key] = elem.node;
          for(var childKey in elem.children){
            insertNode(childKey, elem.children[childKey], aux[0]);
          }
        }
      }
      for(var key in templateNodesDef){
        insertNode(key, templateNodesDef[key]);
      }
    }
    var getTemplateNodeKey = function(nodeText){
      for(key in nodeTextList){
        if(nodeTextList[key] == nodeText) return key;
      }
      return null;
    }
    return {
      templateNodes: templateNodes,
      templateNodesText: templateNodesText,
      templateNodesPre: templateNodesDef,
      getTemplateNodeKey: getTemplateNodeKey,
      init: init
    }
  })()
  var PrompterNew = (function(){
    var Nodes = {
      WHAT_FOLLOWS_FROM : {
        text: "What follows from it?",
        completed: "...leads to..."
      },
      WHY : {
        text: "Why?",
        completed: "...follows from..."
      },
      HOW : {
        text: "How?",
        completed: "How?"
      },
      HOW_ARE_YOU_GOING_TO_ADDRESS_IT : {
        text: "How are you going to address it?",
        completed: "How are you going to address it?"
      },
      JUSTIFICATORY_KNOWLEDGE:{
        text: "Justificatory Knowledge",
        complete: "Justificatory Knowledge"
      },
      SUPPORTING_EVIDENCES : {
        text: "Supporting Evidences?",
        note: "What proof do I have that this cause exists? (Is it concrete? Is it measurable?) What proof do I have that this cause could lead to the stated effect?\n(Am I merely asserting causation?) What proof do I have that this cause actually contributed to the problem I'm looking at? (Even given that it exists and could lead to this problem, how do I know it wasn't actually something else?)\nIs anything else needed, along with this cause, for the stated effect to occur? (Is it self-sufficient? Is something needed to help it along?)Can anything else, besides this cause, lead to the stated effect? (Are there alternative explanations that fit better? What other risks are there?)"
      },
      WHO_ELSE_ADDRESSES_IT : {
        text: "Who else addresses it?",
        note: "What proof do I have that this cause exists? (Is it concrete? Is it measurable?) What proof do I have that this cause could lead to the stated effect?\n(Am I merely asserting causation?) What proof do I have that this cause actually contributed to the problem I'm looking at? (Even given that it exists and could lead to this problem, how do I know it wasn't actually something else?)\nIs anything else needed, along with this cause, for the stated effect to occur? (Is it self-sufficient? Is something needed to help it along?)Can anything else, besides this cause, lead to the stated effect? (Are there alternative explanations that fit better? What other risks are there?)"
      },
      CLICK_ICON_TO_ADDRESS : {
        text: "Click icon to address it",
        note: ""
      },
      WHAT_ARE_THEIR_GOALS: {
        "text": "What are their goals?",
        "completed": "What are their goals?"
      },
      HOW_TO_MEASURE_IT: {
        "text": "How to measure it?",
        "completed": "How to measure it?"
      },
      WHY_IS_IT_IMPORTANT: {
        "text": "Why is it important?",
        "completed": "Why is it important?"
      },
      WHAT_ARE_ITS_LIMITATIONS: {"text": "What are its limitations?"},
      PROPERTIES: {"text": "properties"},
      ACTIVITIES: {"text": "activities"},
      PRACTICE_GENERALIZATION: {"text":"...is a generalization of..."},
      SUBACTIVITIES: {"text": "subactivities"},
      TOOLING: {"text": "tooling"},
      TOOLING_EXAMPLES: {"text": "examples"},
      GOAL_REFINEMENT: {"text": "How shall you attain it?"},
      KERNEL_THEORY: {"text": "Kernel Theory"},
      REQUIREMENT_REALIZATION: {"text": "How are you going to realize it?"},
      COMPONENT_DESCRIPTION: {"text": "Description"},
      COMPONENT_REQUIREMENTS: {"text": "Requirements"}
    }
    var Styles = {
      prompt_completed: {
        bold: 0,
        italic: 0,
        color: "666352",
        fontSize: 120,
        boxStyle: 1,
        backgroundColor: "fff6cc",
        fonts: []
      },
      prompt: {
        bold: 1,
        italic: 0,
        color: "ffffff",
        fontSize: 120,
        boxStyle: 1,
        backgroundColor: "4769d1",// (71, 105, 209) "e67c73"
        fonts: []
      },
    }
    return {
      Nodes: Nodes,
      Styles: Styles
    }
  })()

  var getDocumentMetadata = function(doc){
    let note = '<div class="academicResource"><div class="line title"><b>'+doc.title+'</b></div><br/>';
    if(doc.authors!=null&&doc.authors.length>0){
      note += '<div class="authors line" style="color: rgb(128,77,102)">';
      for(let i=0;i<doc.authors.length;i++){
        note += '<span class="author">';
        if(doc.authors[i].first_name!=null) note += '<span class="firstName">'+doc.authors[i].first_name+'</span>';
        if(doc.authors[i].first_name!=null&&doc.authors[i].last_name!=null) note += ' ';
        if(doc.authors[i].last_name!=null) note += '<span class="lastName">'+doc.authors[i].last_name+'</span>';
        if(i<doc.authors.length-1) note += ', ';
        note += '</span>';
      }
      note += '</div><br/>';
    }
    if(doc.source!=null||doc.year!=null){
      note += '<div class="line" style="color: rgb(128,77,109)">';
      if(doc.source!=null) note += '<span class="source">'+doc.source+'</span>';
      if(doc.source!=null&&doc.year!=null) note += ', ';
      if(doc.year!=null) note += '<span class="year">'+doc.year+'</span>';
      note += '</div><br/>';
    }
    if(doc.abstract != null){
      note += '<div class="line abstract">'+doc.abstract+'</div>';
    }
    note += '<div style="display:none">';
    if(doc.month!=null) note += '<div class="month">'+doc.month+'</div>';
    if(doc.revision!=null) note += '<div class="revision">'+doc.revision+'</div>';
    if(doc.pages!=null) note += '<div class="pages">'+doc.pages+'</div>';
    if(doc.volume!=null) note += '<div class="volume">'+doc.volume+'</div>';
    if(doc.issue!=null) note += '<div class="issue">'+doc.issue+'</div>';
    if(doc.publisher!=null) note += '<div class="publisher">'+doc.publisher+'</div>';
    if(doc.city!=null) note += '<div class="city">'+doc.city+'</div>';
    if(doc.edition!=null) note += '<div class="edition">'+doc.edition+'</div>';
    if(doc.institution!=null) note += '<div class="institution">'+doc.institution+'</div>';
    if(doc.series!=null) note += '<div class="series">'+doc.series+'</div>';
    if(doc.chapter!=null) note += '<div class="chapter">'+doc.chapter+'</div>';
    if(doc.citation_key!=null) note += '<div class="citationKey">'+doc.citation_key+'</div>';
    if(doc.language!=null) note += '<div class="language">'+doc.language+'</div>';
    if(doc.country!=null) note += '<div class="country">'+doc.country+'</div>';
    if(doc.type!=null) note += '<div class="type">'+doc.type+'</div>';
    if(doc.editors!=null){
      note += '<div class="editors">';
      for(let i=0;i<doc.editors.length;i++){
        note += '<div class="editor">';
        if(doc.editors[i].first_name!=null) note += '<div class="firstName">'+doc.editors[i].first_name+'</div>';
        if(doc.editors[i].last_name!=null) note += '<div class="lastName">'+doc.editors[i].last_name+'</div>';
        note += '</div>';
      }
      note += '</div>';
    }
    if(doc.keywords!=null){
      note += '<div class="keywords">';
      for(let i=0;i<doc.keywords.length;i++){
        note += '<div class="keyword">'+doc.keywords[i]+'</div>';
      }
      note += '</div>';
    }
    if(doc.websites!=null){
      note += '<div class="websites">';
      for(let i=0;i<doc.websites.length;i++){
        note += '<div class="website">'+doc.websites[i]+'</div>';
      }
      note += '</div>';
    }
    if(doc.identifiers!=null){
      note += '<div class="identifiers">';
      for(let i in doc.identifiers){
        note += '<div class="'+i+'">'+doc.identifiers[i]+'</div>';
      }
      note += '</div>';
    }
    note += '</div>';
    note += '</div>';
    return note;
  }

  var generateArticleMetadata = function(article){
    var note = "<div class=\"line title\"><b>"+article.title+"</b></div>";
    var link;
    var authors = null;
    if(article.authors!=null){
      var authors = "";
      for(var i=0;i<article.authors.length;i++){
        if(authors != "") authors += ", ";
        authors += article.authors[i].first_name + " " + article.authors[i].last_name;
      }
      article["authors"] = authors;
    }
    if(authors != null) note += "<div class=\"line authors\"><br></div><div class=\"line\"><span style=\"color: rgb(128, 77, 102);\">"+authors+"</span></div>";
    if((article.source != null)&&(article.year != null)) note += "<div class=\"line year\"><br></div><div class=\"line\"><span style=\"color: rgb(128, 77, 102);\">";
    if(article.source != null) note += article.source
    if(article.year != null){
      if(article.source != null) note += ", ";
      note += article.year;
    }
    if((article.source != null)&&(article.year != null)) note += "</span></div>";
    //if(article.abstract != null) note += "<div class=\"line abstract\"><br></div><div class=\"line\">"+article.abstract+"</div>";
    if((article.id != null)&&(article.file_id != null)) link = "https://www.mendeley.com/reference-manager/reader/"+article.id+"/"+article.file_id;
    return {note: note, link: link};
  }
  // POLES
  var invertPoles = function(text){
    if(text==null||text=="") return null;
    var newText = text;
    var poles = text.match(/[^\s]*[^\.\s]\s?\.\.\.\s?[^\s,]+/g);
    if(poles!=null && poles.length > 0){
      var poleWords = poles[0].split("...");
      if(poleWords[0].charAt(0)==" ") var newText = text.replace(poles[0],poleWords[1].substring(1));
      else var newText = text.replace(poles[0],poleWords[1]);
      return newText;
    }
    else return "No longer "+text;
  }
  var unInvertPoles = function(text){
    if(text==null||text=="") return null;
    if(text.indexOf("No longer")==0){
      var newText = text.replace("No longer ","");
    }
    else{
      var newText = text;
      var poles = text.match(/[^\s]*[^\.\s]\s?\.\.\.\s?[^\s,]+/g);
      if(poles!=null && poles.length > 0){
        var poleWords = poles[0].split("...");
        if(poleWords[0].charAt(0)==" ") var newText = text.replace(poles[0],poleWords[0].substring(1));
        else var newText = text.replace(poles[0],poleWords[0]);
      }
    }
    return newText;
  }
  var getNegativePole = function(text){
    if(text==null||text=="") return null;
    if(text.indexOf("No longer")==0){
      var newText = text.replace("No longer ","");
    }
    else{
      var newText = text;
      var poles = text.match(/[^\s]*[^\.\s]\s?\.\.\.\s?[^\s,]+/g);
      if(poles!=null && poles.length > 0){
        var poleWords = poles[0].split("...");
        if(poleWords[0].charAt(0)==" ") var newText = text.replace(poles[0],poleWords[0].substring(1));
        else var newText = text.replace(poles[0],poleWords[0]);
      }
    }
    return newText;
  }
  // TASKS
  var insertTaskNode = function(nodeText,originNodeId,changeList){
    if(!TASKS_ENABLED) return;
    var mapID = Scrap.selectMapId();
    var startNode = Scrap.selectNodeWithText("Start Here!");
    return Mindmeister.insertIdea(mapID,startNode.id,{title:nodeText,link:"topic:"+originNodeId,style:TEMPLATE_BASE_STYLE},changeList);
  }
  var removeTaskNode = function(nodeText,changeList){
    if(!TASKS_ENABLED) return;
    var startNode = Scrap.selectNodeWithText("Start Here!");
    var taskNode = startNode.getChildrenWithText(nodeText);
    if(taskNode!=null&&taskNode.length>0){
      for(var i=0;i<taskNode.length;i++){
        Mindmeister.removeIdea(Scrap.mapID,taskNode[i].id,changeList);
      }
    }
  }
  var modifyTaskNode = function(nodeText,newNodeText,changeList){
    if(!TASKS_ENABLED) return;
    var startNode = Scrap.selectNodeWithText("Start Here!");
    var taskNode = startNode.getChildrenWithText(nodeText);
    if(taskNode!=null&&taskNode.length>0){
      for(var i=0;i<taskNode.length;i++){
        Mindmeister.modifyIdea(Scrap.mapID,taskNode[i].id,{title:newNodeText},changeList);
      }
    }
  }
  // CLONE NODES - REMOVE ONE
  var cloneNodeBis = function(nodeToClone,parentNodeId,changeList,reverse,isCause,isEvaluate,onlyNegative){
    reverse = typeof reverse !== 'undefined' ? reverse : false;
    isCause = typeof isCause !== 'undefined' ? isCause : false;
    isEvaluate = typeof isEvaluate !== 'undefined' ? isEvaluate : false;
    var nodeContent = nodeToClone.getContent();
    var nodeText = reverse ? DScaffolding.invertPoles(nodeContent) : nodeContent;
    if(isEvaluate) nodeText += "???";
    var ideaParams = {
      title: nodeText,
      link: "topic:"+nodeToClone.id,
      style: NODE_STYLES.prompt_completed
    }
    if(isCause) ideaParams["icon"] = "status_ok";
    var nodeId = Mindmeister.insertIdea(Scrap.mapID,parentNodeId,ideaParams,changeList);
    return nodeId;
  }
  var syncNodes = function(mirrorNodes,changes,changeList){
    if(changes.icon!=null){
      var status;
      if(changes.icon == Icons.enabled) status = true;
      else if(changes.icon == Icons.disabled) status = false;
      for(var i=0;i<mirrorNodes.length;i++){
        if(mirrorNodes[i].getIcons().indexOf(changes.icon)!=-1) continue;
        if(mirrorNodes[i].getSubtree().length>2||(mirrorNodes[i].getSubtree().length==1&&mirrorNodes[i].getSubtree()[0].getContent()!="How?")){
          var modifyParams = status ? {icon: Icons.enabled} : {icon: Icons.disabled}
          Mindmeister.modifyIdea(Scrap.mapID,mirrorNodes[i].id,modifyParams,changeList);
        }
        else{
          if(status) Mindmeister.modifyIdea(Scrap.mapID,mirrorNodes[i].id,{icon: Icons.enabled},changeList);
          else Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[i].id,changeList);
        }
      }
    }
    if(changes.title!=null){
      for(var i=0;i<mirrorNodes.length;i++){
        Mindmeister.modifyIdea(Scrap.mapID,mirrorNodes[i].id,{title:changes.title},changeList);
      }
    }
  }
  var causeIsDeveloped = function(node){
    var targetNode = $("#tk_children_"+node.id)[0];
    var childNodes = targetNode.querySelectorAll(".node");
    if(childNodes==null||childNodes.length==0) return false;
    if(childNodes.length==1&&Scrap.selectContent(childNodes[0])=="How?") return false;
    return true;
  }
  var causeIsSync = function(node,status){
    var icon = node.querySelector(".tk_icon_container");
    if(icon==null) return false;
    var iconStatus = icon.getAttribute("icon-id");
    if(iconStatus=="status_ok"&&status)return true;
    else if(iconStatus=="status_error"&&!status) return true;
    return false;
  }
  var filterNodesTemplate = function(nodeContentList){
    var templateNodesContent = ["...that leads to...","Why?","Supporting Evidences?","How?","...this results in..."];
    var list = [];
    for(var i=0;i<nodeContentList.length;i++){
      if(templateNodesContent.indexOf(nodeContentList[i])==-1)list.push(nodeContentList[i]);
    }
    return list;
  }
  var getSubtreeLeaves = function(node){
    if(node.subtree.length==0) return [node];
    else{
      var leaves = [];
      for(var i=0;i<node.subtree.length;i++){
        var l = DScaffolding.getSubtreeLeaves(node.subtree[i]);
        leaves = leaves.concat(l);
      }
      return leaves;
    }
  }
  var getHowProjection = function(subtree){
    var leaves = [];
    for(var i=0;i<subtree.length;i++){
      leaves = leaves.concat(DScaffolding.getSubtreeLeaves(subtree[i]));
    }
    var howProjection = {};
    for(var i=0;i<leaves.length;i++){
      var mirrorNodes = Nodes.templateNodes.DECIDE_REQUIREMENTS_CAPTURE_IDEAS.getChildrenWithText(DScaffolding.invertPoles(leaves[i].getContent()));
      if(mirrorNodes!=null&&mirrorNodes.length>0){
        var howNode = mirrorNodes[0].getChildrenWithText("How?");
        if(howNode!=null&&howNode.length>0){
          var howSubtree = howNode[0].getSubtree();
          howProjection[leaves[i].getContent()] = howSubtree;
        }
      }
    }
    return howProjection;
  }
  var isActivated = function(node,isMirror,mirrorNode){
    var skip = false;
    var skipNodes = [Prompter.Nodes.SUPPORTING_EVIDENCES.text,Prompter.Nodes.WHO_ELSE_ADDRESSES_IT.text,Prompter.Nodes.WHAT_FOLLOWS_FROM.text,Prompter.Nodes.WHAT_FOLLOWS_FROM.completed,Prompter.Nodes.WHY.text,Prompter.Nodes.WHY.completed];
    var n = node;
    if(skipNodes.indexOf(node.getContent())!=-1) skip = true;
    else if(isMirror){
      var aux = mirrorNode.getChildrenWithText(DScaffolding.invertPoles(node.getContent()));
      if(aux==null||aux.length==0) skip = true;
      else n = aux[0];
    }
    //if(n==null||n.length==0) return false;
    if(!skip&&(n.getIcons()!=null&&n.getIcons().indexOf(Icons.enabled)!=-1)){
      return true;
    }
    else if(!skip&&(n.getIcons()!=null&&n.getIcons().indexOf(Icons.disabled)!=-1)) return false;
    else if(node.subtree.length>0){
      var isActivated = false;
      for(var i=0;i<node.subtree.length;i++){
        if(DScaffolding.isActivated(node.subtree[i],isMirror,mirrorNode)){
          isActivated = true;
          break;
        }
      }
      return isActivated;
    }
    return false;
  }
  var filterSubtree = function(subtree,isMirror,mirrorNode){
    var cutNodes = [Prompter.Nodes.SUPPORTING_EVIDENCES.text,Prompter.Nodes.WHO_ELSE_ADDRESSES_IT.text];
    var newSubtree = [];
    //var newSubtree = JSON.parse(JSON.stringify(subtree));
    for(var i=0;i<subtree.length;i++){
      if(cutNodes.indexOf(subtree[i].getContent())!=-1) continue;
      if(isActivated(subtree[i],isMirror,mirrorNode)){
        //var newNode = JSON.parse(JSON.stringify(subtree[i]));
        subtree[i]["subtree"] = filterSubtree(subtree[i].subtree,isMirror,mirrorNode);
        newSubtree.push(subtree[i]);
      }
    }
    return newSubtree;
  }
  var filterSubtreeBis = function(subtree){
    var cutNodes = [Prompter.Nodes.SUPPORTING_EVIDENCES.text,Prompter.Nodes.WHO_ELSE_ADDRESSES_IT.text];
    var newSubtree = [];
    //var newSubtree = JSON.parse(JSON.stringify(subtree));
    for(var i=0;i<subtree.length;i++){
      if(cutNodes.indexOf(subtree[i].getContent())!=-1) continue;
      //var newNode = JSON.parse(JSON.stringify(subtree[i]));
      subtree[i]["subtree"] = filterSubtreeBis(subtree[i].subtree);
      newSubtree.push(subtree[i]);
    }
    return newSubtree;
  }
  var replicateSubtreeCauses = function(nodeId,subtree,howSubtree,changeList){
    for(var i=0;i<subtree.length;i++){
      (function(subtreeElem){
        var node = Scrap.getNodeById(nodeId);
        var contentToFind = subtreeElem.getContent()==Prompter.Nodes.WHY.completed ? "This in turn leads to" : DScaffolding.unInvertPoles(subtreeElem.getContent());
        var mirror = (node==null) ? null : node.getChildrenWithText(contentToFind);
        if(mirror==null||mirror.length==0){
          if(subtreeElem.getContent()==Prompter.Nodes.WHY.completed){ //if(subtreeElem.text=="This in turn leads to"){
            var newNodeId = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:"This in turn leads to",style:NODE_STYLES.template},changeList);
            if(subtreeElem.subtree.length==0){
              if(howSubtree[subtreeElem.getContent()]!=null&&howSubtree[subtreeElem.getContent()].length>0){
                var nId = Mindmeister.insertIdea(Scrap.mapID,newNodeId,{title:"This is tested out through the artefact's next features",style:NODE_STYLES.template},changeList);
                DScaffolding.replicateSubtree(nId,howSubtree[subtreeElem.getContent()],changeList);
              }
            }
            else{
              DScaffolding.replicateSubtreeCauses(newNodeId,subtreeElem.subtree,howSubtree,changeList);
            }
          }
          else{
            var oldNode = Scrap.getNodeById(subtreeElem.id);

            var newNodeId = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:DScaffolding.unInvertPoles(oldNode.getContent()),link:"topic:"+oldNode.id,style:NODE_STYLES.template},changeList);
            if(subtreeElem.subtree.length==0){
              if(howSubtree[subtreeElem.getContent()]!=null&&howSubtree[subtreeElem.getContent()].length>0){
                var nId = Mindmeister.insertIdea(Scrap.mapID,newNodeId,{title:"This is tested out through the artefact's next features",style:NODE_STYLES.template},changeList);
                DScaffolding.replicateSubtree(nId,howSubtree[subtreeElem.getContent()],changeList);
              }
            }
            else{
              //var newNode = document.getElementById(newNodeId);
              DScaffolding.replicateSubtreeCauses(newNodeId,subtreeElem.subtree,howSubtree,changeList);
            }
          }
        }
        else{
          if(subtreeElem.subtree.length>0){
            DScaffolding.replicateSubtreeCauses(mirror[0].id,subtreeElem.subtree,howSubtree,changeList);
          }
          else if(subtreeElem.subtree.length==0&&howSubtree!=null&&howSubtree[subtreeElem.getContent()]!=null&&howSubtree[subtreeElem.getContent()].length>0){
            var insPoint = mirror[0].getChildrenWithText("This is tested out through the artefact's next features");
            if(insPoint!=null&&insPoint.length>0) DScaffolding.replicateSubtree(insPoint[0].id,howSubtree[subtreeElem.getContent()],changeList);
            else{
              var nId = Mindmeister.insertIdea(Scrap.mapID,mirror[0].id,{title:"This is tested out through the artefact's next features",style:NODE_STYLES.template},changeList);
              DScaffolding.replicateSubtree(nId,howSubtree[subtreeElem.getContent()],changeList);
            }
          }
        }
      })(subtree[i]);
    }
  }
  var replicateSubtreeCons = function(nodeId,subtree,howSubtree,changeList){
    for(var i=0;i<subtree.length;i++){
      (function(subtreeElem){
        var node = Scrap.getNodeById(nodeId);
        var contentToFind = subtreeElem.getContent() == Prompter.Nodes.WHAT_FOLLOWS_FROM.completed ? "This in turn may result in" : DScaffolding.unInvertPoles(subtreeElem.getContent());
        var mirror = (node==null) ? null : node.getChildrenWithText(contentToFind);
        if(mirror==null||mirror.length==0){
          if(subtreeElem.getContent()==Prompter.Nodes.WHAT_FOLLOWS_FROM.completed){ //if(subtreeElem.text=="This in turn leads to"){
            var newNodeId = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:"This in turn may result in",style:NODE_STYLES.template},changeList);
            if(subtreeElem.subtree.length==0){
              if(howSubtree[subtreeElem.getContent()]!=null&&howSubtree[subtreeElem.getContent()].length>0){
                var nId = Mindmeister.insertIdea(Scrap.mapID,newNodeId,{title:"This is tested out through the artefact's next features",style:NODE_STYLES.template},changeList);
                DScaffolding.replicateSubtree(nId,howSubtree[subtreeElem.getContent()],changeList);
              }
            }
            else{
              DScaffolding.replicateSubtreeCons(newNodeId,subtreeElem.subtree,howSubtree,changeList);
            }
          }
          else{
            var oldNode = Scrap.getNodeById(subtreeElem.id);

            var newNodeId = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:DScaffolding.unInvertPoles(oldNode.getContent()),link:"topic:"+oldNode.id,style:NODE_STYLES.template},changeList);
            if(subtreeElem.subtree.length==0){
              if(howSubtree[subtreeElem.getContent()]!=null&&howSubtree[subtreeElem.getContent()].length>0){
                var nId = Mindmeister.insertIdea(Scrap.mapID,newNodeId,{title:"This is tested out through the artefact's next features",style:NODE_STYLES.template},changeList);
                DScaffolding.replicateSubtree(nId,howSubtree[subtreeElem.getContent()],changeList);
              }
            }
            else{
              //var newNode = document.getElementById(newNodeId);
              DScaffolding.replicateSubtreeCons(newNodeId,subtreeElem.subtree,howSubtree,changeList);
            }
          }
        }
        else{
          if(subtreeElem.subtree.length>0){
            DScaffolding.replicateSubtreeCons(mirror[0].id,subtreeElem.subtree,howSubtree,changeList);
          }
          else if(subtreeElem.subtree.length==0&&howSubtree!=null&&howSubtree[subtreeElem.getContent()]!=null&&howSubtree[subtreeElem.getContent()].length>0){
            var insPoint = mirror[0].getChildrenWithText("This is tested out through the artefact's next features");
            if(insPoint!=null&&insPoint.length>0) DScaffolding.replicateSubtree(insPoint[0].id,howSubtree[subtreeElem.getContent()],changeList);
            else{
              var nId = Mindmeister.insertIdea(Scrap.mapID,mirror[0].id,{title:"This is tested out through the artefact's next features",style:NODE_STYLES.template},changeList);
              DScaffolding.replicateSubtree(nId,howSubtree[subtreeElem.getContent()],changeList);
            }
          }
        }
      })(subtree[i]);
    }
  }
  var replicateSubtree = function(nodeId,subtree,changeList){
    if(subtree.length!=1||subtree[0].text!="How?"){
      for(var i=0;i<subtree.length;i++){
        (function(subtreeElem){
          var node = Scrap.getNodeById(nodeId);
          var mirror = node==null ? null : node.getChildrenWithText(subtreeElem.getContent());
          if(mirror==null||mirror.length==0){
            var oldNode = Scrap.getNodeById(subtreeElem.id);
            var newNodeId = DScaffolding.cloneNodeBis(oldNode,nodeId,changeList);
            if(subtreeElem.subtree.length!=0){
              replicateSubtree(newNodeId,subtreeElem.subtree,changeList);
            }
          }
          else{
            if(subtreeElem.subtree.length>0){
              replicateSubtree(mirror[0].id,subtreeElem.subtree,changeList);
            }
          }
        })(subtree[i]);
      }
    }
  }
  var transformSubtree = function(subtree){
    var newSubtree = [];
    for(var i=0;i<subtree.length;i++){
      var newNode = JSON.parse(JSON.stringify(subtree[i]));
      newNode["subtree"] = transformSubtree(newNode.subtree);
      if(subtree[i].text=="...that leads to..."){
        newNode["text"] = "This in turn leads to";
      }
      else if(subtree[i].text==Prompter.Nodes.WHY.text){
        newNode["text"] = "This in turn may result in";
      }
      newSubtree.push(newNode);
    }
    return newSubtree;
  }
  var syncDesignTheory = function(changeList){
      if(SYNCING_DESIGN_THEORY){
        return;
      }
      SYNCING_DESIGN_THEORY = true;

      var explicateProblemChildren = Nodes.templateNodes.EXPLICATE_PROBLEM.getChildren();
      if(explicateProblemChildren==null||explicateProblemChildren.length==0){
        SYNCING_DESIGN_THEORY = false;
        return;
      }
      else{
        // tolook
        var causesSubtree = Nodes.templateNodes.ASCERTAIN_CAUSES.getSubtree();//true,lessenCausesNode); // <----
        var consSubtree = Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.getSubtree();//true,alleviateConsequencesNode); // <-----
        //

        var newCausesSubtree = DScaffolding.filterSubtree(causesSubtree,true,Nodes.templateNodes.LESSEN_CAUSES);
        var causesHowSubtree = DScaffolding.getHowProjection(newCausesSubtree);
        var newConsSubtree = DScaffolding.filterSubtree(consSubtree,true,Nodes.templateNodes.ALLEVIATE_CONSEQUENCES);
        var consHowSubtree = DScaffolding.getHowProjection(newConsSubtree);

        var newSubtree = newCausesSubtree.concat(newConsSubtree);

        var problemStatementSubtree = Nodes.templateNodes.SET_PROBLEM_STATEMENT.getChildren();
        for(var i=0;i<problemStatementSubtree.length;i++){
          var mirror = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(problemStatementSubtree[i].getContent());
          if(mirror==null||mirror.length==0){
            var nodeId = DScaffolding.cloneNodeBis(problemStatementSubtree[i],Nodes.templateNodes.FORMULATE_DESIGN_THEORY.id,changeList);
            var nId = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:Prompter.Nodes.DESIGN_THEORY_CONS_SEPARATOR.text,style:NODE_STYLES.prompt_completed},changeList,false);

              // >>>>>
            DScaffolding.replicateSubtreeCons(nId,newConsSubtree,consHowSubtree,changeList);

            var nId2 = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:Prompter.Nodes.DESIGN_THEORY_CAUSE_SEPARATOR.text,style:NODE_STYLES.prompt_completed},changeList,false);

              // <<<<<
            DScaffolding.replicateSubtreeCauses(nId2,newCausesSubtree,causesHowSubtree,changeList);
          }
          else{
            var consLabel = mirror[0].getChildrenWithText(Prompter.Nodes.DESIGN_THEORY_CONS_SEPARATOR.text);
            if(consLabel==null||consLabel.length==0){
              var nId = Mindmeister.insertIdea(Scrap.mapID,mirror[0].id,{title:Prompter.Nodes.DESIGN_THEORY_CONS_SEPARATOR.text,style:NODE_STYLES.prompt_completed},changeList,false);

              // <<<<<
              DScaffolding.replicateSubtreeCons(nId,newConsSubtree,consHowSubtree,changeList);
            }
            else{
              // <<<<<
              DScaffolding.replicateSubtreeCons(consLabel[0].id,newConsSubtree,consHowSubtree,changeList);
            }
            var causesLabel = mirror[0].getChildrenWithText(Prompter.Nodes.DESIGN_THEORY_CAUSE_SEPARATOR.text);
            if(causesLabel==null||causesLabel.length==0){
              var nId2 = Mindmeister.insertIdea(Scrap.mapID,mirror[0].id,{title:Prompter.Nodes.DESIGN_THEORY_CAUSE_SEPARATOR.text,style:NODE_STYLES.prompt_completed},changeList,false);

              // <<<<<
              DScaffolding.replicateSubtreeCauses(nId2,newCausesSubtree,causesHowSubtree,changeList)
            }
            else{
              // <<<<<
              DScaffolding.replicateSubtreeCauses(causesLabel[0].id,newCausesSubtree,causesHowSubtree,changeList);
            }
          }
        }
        //SYNCING_DESIGN_THEORY = false;
      }
  }
  var reloadDesignTheory = function(){
    Scrap.showWorkingMessage();
    var cL = new Mindmeister.ChangeList();

    var formulateDesignTheoryNode = Nodes.templateNodes.FORMULATE_DESIGN_THEORY;
    var children = formulateDesignTheoryNode.getChildren();
    if(children==null||children.length==0){
      SYNCING_DESIGN_THEORY = false;
      DScaffolding.syncDesignTheory(cL);
      Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes3){
        if(changes3!=null&&changes3.changeList!=null&&changes3.changeList.length>0)Scrap.reloadCanvas(true,changes3.changeList,changes3.revision,changes3.focusNodeId);
        else Scrap.hideWorkingMessage();
      });
    }
    else{
      for(var i=0;i<children.length;i++){
        Mindmeister.removeIdea(Scrap.mapID,children[i].id,cL);
      }
      Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes3){
        if(changes3!=null&&changes3.changeList!=null&&changes3.changeList.length>0)Scrap.reloadCanvas(true,changes3.changeList,changes3.revision,changes3.focusNodeId,false);
        setTimeout(function(){
          SYNCING_DESIGN_THEORY = false;
          var cL2 = new Mindmeister.ChangeList();
          DScaffolding.syncDesignTheory(cL2);
          Mindmeister.doChanges(Scrap.mapID,cL2).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes3.revision,changes.focusNodeId);
            else Scrap.hideWorkingMessage();
          });
        },1000);
      });
    }
  }
  var getActiveDescendants = function(nodeID){
    /*var selector = "div#tk_container_"+nodeID+" div.node";
    var childs = document.querySelectorAll(selector);
    var active = [];
    if(childs != null && childs.length > 0){
      for(var i=0;i<childs.length;i++){
        var iconCont = childs[i].querySelector(".tk_icon_container");
        if(iconCont != null && iconCont.getAttribute("icon-id") == "status_ok") active.push(Scrap.selectContent(childs[i]));
      }
    }
    return active;*/
    var descendants = Scrap.getNodeById(nodeID).getDescendants();
    var active = [];
    for(var i=0;i<descendants.length;i++){
      if(descendants[i].getIcons().indexOf(Icons.enabled)!=-1) active.push(descendants[i].getContent());
    }
    return active;
  }
  var deactivateOldActiveChildren = function(node,newActive,changeList){
    var activeChildren = node.getChildrenWithIcon(Icons.enabled);
    var ret = true;
    for(var i=0;i<activeChildren.length;i++){
      if(activeChildren[i].getContent()!=newActive){
        ret = false;
        Mindmeister.modifyIdea(Scrap.mapID,activeChildren[i].id,{icon:Icons.disabled},changeList);
      }
    }
    return ret;
  }
  var getTreatment = function(node){
    var treatmentCont = DScaffolding.getChildsWithText(node,"Appropriate risk treatment strategy")[0];
    var selector = "div#tk_children_"+treatmentCont.id+" > div.tk_container > div.tk_open_container > div.node";
    var childs = document.querySelectorAll(selector);
    return childs;
  }
  var getPointToRemove = function(node){
    var parentNode = node.getParentNode();
    if(node.getContent()=="It is hypothesized that this problem causes"||node.getContent()=="It is hypothesized that this problem leads to"){
      return node;
    }
    var children = parentNode.getChildren();
    if(children.length<2){
      return DScaffolding.getPointToRemove(parentNode);
    }
    else{
      return node;
    }
  }
  var checkHumanRisk = function(changeList){
    var iconCont = Nodes.templateNodes.IDENTIFY_HUMAN_UNCERTAINTIES.getIcons();
    if(iconCont!=null&&iconCont.length>0&&iconCont.indexOf(Icons.enabled)!=-1){
      return;
    }
    else{
      var iconCont2 = Nodes.templateNodes.IDENTIFY_ORGANISATIONAL_UNCERTAINTIES.getIcons();
      if(iconCont2!=null&&iconCont2.length>0&&iconCont2.indexOf(Icons.enabled)!=-1){
        return;
      }
      else{
        var pointToSearch = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
        for(var i=0;i<pointToSearch.length;i++){
          var disable = false;
          var effNode = pointToSearch[i].getChildrenWithText("Develop rigorous evidence of the effectiveness of my artefact for achieving its purposes(s)");
          if(effNode==null||effNode.length==0) disable = true;
          else{
            var essentialNode = effNode[0].getChildrenWithText("Essential");
            if(essentialNode==null||essentialNode.length==0) disable = true;
            else{
              var iconCont3 = essentialNode[0].getIcons();
              if(iconCont3==null||iconCont3.length==0||iconCont3.indexOf(Icons.enabled)==-1) disable = true;
            }
          }
          if(disable){
            var evaluationRoot = pointToSearch[i].getParentNode().getParentNode();
            var nodeToDisable = evaluationRoot.getChildrenWithText("Human Risk and Effectiveness Strategy");
            Mindmeister.modifyIdea(Scrap.mapID,nodeToDisable[0].id,{icon:Icons.disabled},changeList);
          }
        }
      }
    }
  }
  var checkTechnicalRisk = function(changeList){
    var iconCont = Nodes.templateNodes.IDENTIFY_TECHNICAL_FEASIBILITY_UNCERTAINTIES.getIcons();
    if(iconCont!=null&&iconCont.length>0&&iconCont.indexOf(Icons.enabled)!=-1){
      return;
    }
    else{
      var pointToSearch = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
      for(var i=0;i<pointToSearch.length;i++){
        var disable = false;
        var effNode = pointToSearch[i].getChildrenWithText("Develop rigorous evidence of the efficacy of my artefact for achieving its purpose(s)");
        if(effNode==null||effNode.length==0) disable = true;
        else{
          var essentialNode = effNode[0].getChildrenWithText("Essential");
          if(essentialNode==null||essentialNode.length==0) disable = true;
          else{
            var iconCont2 = essentialNode[0].getIcons();
            if(iconCont2==null||iconCont2.length==0||iconCont2.indexOf(Icons.enabled)==-1) disable = true;
          }
        }
        if(disable){
          var evaluationRoot = pointToSearch[i].getParentNode().getParentNode();
          var nodeToDisable = evaluationRoot.getChildrenWithText("Technological Risk and Efficacy Strategy");
          Mindmeister.modifyIdea(Scrap.mapID,nodeToDisable[0].id,{icon:Icons.disabled},changeList);
        }
      }
    }
  }
  var switchCausesIntoConsequencesNode = function(nodeId,changeList){
    var node = Scrap.getNodeById(nodeId);
    var nodeContent = node.getContent();
    if(nodeContent==Prompter.Nodes.WHY.text){
      Mindmeister.modifyIdea(Scrap.mapID,nodeId,{title: Prompter.Nodes.WHAT_FOLLOWS_FROM.text},changeList);
      var parentNodeContent = node.getParentNode().getContent();
      DScaffolding.modifyTaskNode("Why does '"+parentNodeContent+"' happen?","What follows from '"+parentNodeContent+"'?",changeList);
    }
    else if(nodeContent==Prompter.Nodes.WHY.completed){
      Mindmeister.modifyIdea(Scrap.mapID,nodeId,{title: Prompter.Nodes.WHAT_FOLLOWS_FROM.completed},changeList);
    }
    if(nodeContent!="Supporting Evidences?"&&nodeContent!="Who else addresses it?"){
      var children = node.getChildren();
      if(children!=null&&children.length!=0){
        for(var i=0;i<children.length;i++){
          DScaffolding.switchCausesIntoConsequencesNode(children[i].id,changeList);
        }
      }
    }
  }
  var switchConsequencesIntoCausesNode = function(nodeId,changeList){
    var node = Scrap.getNodeById(nodeId);
    var nodeContent = node.getContent();
    if(nodeContent==Prompter.Nodes.WHAT_FOLLOWS_FROM.text){
      Mindmeister.modifyIdea(Scrap.mapID,nodeId,{title: Prompter.Nodes.WHY.text},changeList);
      var parentNodeContent = node.getParentNode().getContent();
      DScaffolding.modifyTaskNode("What follows from '"+parentNodeContent+"'?","Why does '"+parentNodeContent+"' happen?",changeList);
    }
    else if(nodeContent==Prompter.Nodes.WHAT_FOLLOWS_FROM.completed){
      Mindmeister.modifyIdea(Scrap.mapID,nodeId,{title: Prompter.Nodes.WHY.completed},changeList);
    }
    if(nodeContent!="Supporting Evidences?"&&nodeContent!="Who else addresses it?"){
      var children = node.getChildren();
      if(children!=null&&children.length!=0){
        for(var i=0;i<children.length;i++){
          DScaffolding.switchConsequencesIntoCausesNode(children[i].id,changeList);
        }
      }
    }
  }
  var switchCausesIntoConsequences = function(nodeId,nodeIdSolutions,changeList){
    DScaffolding.switchCausesIntoConsequencesNode(nodeId,changeList);
    DScaffolding.switchCausesIntoConsequencesNode(nodeIdSolutions,changeList);
  }
  var switchConsequencesIntoCauses = function(nodeId,nodeIdSolutions,changeList){
    DScaffolding.switchConsequencesIntoCausesNode(nodeId,changeList);
    DScaffolding.switchConsequencesIntoCausesNode(nodeIdSolutions,changeList);
  }
  var updateTemplate = function(){
    var that = this;
    return new Promise(function (resolve,reject){
      var templateVersion = 0;
      var mapIDList = DSCAFFOLDING_TEMPLATE_VERSIONING.map((el) => {return el.mapId});
      var listIndex = mapIDList.indexOf(Scrap.mapID);

      var template = that.templateName;//getWhichTemplate();
      if (listIndex != -1) {
        var aux = DSCAFFOLDING_TEMPLATE_VERSIONING[listIndex].templateVersion.split(".");
        var v = aux[0] + ".";
        aux.splice(0, 1);
        v += aux.join("");
        templateVersion = parseFloat(v);
      }
      if(template=="Explicate Problem New"&&templateVersion<0.76){
        Scrap.showWorkingMessage("Updating mind map to the last version of the template. Please wait.");
        var cL = new Mindmeister.ChangeList();
        var rootNode = Scrap.getRootNode();

        // practice
        var contextNode = rootNode.getChildren().find((el) => {return el.getContent()==="Describe Context"});
        if(contextNode!=null) {
          var practiceNode = contextNode.getChildren().find((el) => {return el.getContent() === "Describe Practice"});
          var activitiesNode = contextNode.getChildren().find((el) => {return el.getContent() === "Describe Activities"});
          var toolingNode = contextNode.getChildren().find((el) => {return el.getContent() === "Describe Tooling"});
          var oldContextChildren = ["Describe Practice","Describe Activities","Describe Tooling"];
          var contextCh = contextNode.getChildren().filter((el) => {return oldContextChildren.indexOf(el.getContent())==-1});
          var removeContext = true;
          if(contextCh.length>0) removeContext = false;
          if (practiceNode != null) {
            var practices = practiceNode.getChildren();
            if(practices.length==1){
              Mindmeister.insertIdea(Scrap.mapID,practices[0].id,{title:"properties",style:NODE_STYLES.prompt},cL);
              Mindmeister.insertIdea(Scrap.mapID,practices[0].id,{title:"...is a generalization of...",style:NODE_STYLES.prompt},cL);
              if(activitiesNode!=null){
                var activities = activitiesNode.getChildren();
                var actPrompt;
                if(activities.length==0) actPrompt = Mindmeister.insertIdea(Scrap.mapID,practices[0].id,{title:"activities",style:NODE_STYLES.prompt},cL);
                else actPrompt = Mindmeister.insertIdea(Scrap.mapID,practices[0].id,{title:"activities",style:NODE_STYLES.prompt_completed},cL);
                for(var i=0;i<activities.length;i++){
                  Mindmeister.moveNode(Scrap.mapID,activities[i].id,actPrompt,cL);
                  Mindmeister.insertIdea(Scrap.mapID,activities[i].id,{title:"subactivities",style:NODE_STYLES.prompt},cL);
                  Mindmeister.insertIdea(Scrap.mapID,activities[i].id,{title:"properties",style:NODE_STYLES.prompt},cL);
                  Mindmeister.insertIdea(Scrap.mapID,activities[i].id,{title:"tooling",style:NODE_STYLES.prompt},cL);
                }
                Mindmeister.removeIdea(Scrap.mapID,activitiesNode.id,cL);
              }
            }
            else{
              for(var i=0;i<practices.length;i++){
                Mindmeister.insertIdea(Scrap.mapID,practices[i].id,{title:"properties",style:NODE_STYLES.prompt},cL);
                Mindmeister.insertIdea(Scrap.mapID,practices[i].id,{title:"activities",style:NODE_STYLES.prompt},cL);
                Mindmeister.insertIdea(Scrap.mapID,practices[i].id,{title:"...is a generalization of...",style:NODE_STYLES.prompt},cL);
              }
              if(activitiesNode!=null&&activitiesNode.getChildren().length==0){
                Mindmeister.removeIdea(Scrap.mapID,activitiesNode.id,cL);
              }
              else if(activitiesNode!=null&&activitiesNode.getChildren().length>0){
                Mindmeister.moveNodeToRoot(Scrap.mapID,activitiesNode.id,rootNode.id,[-200,-100],cL);
                Mindmeister.modifyIdea(Scrap.mapID,activitiesNode.id,{icon:"emoji/symbols-heavy_exclamation_mark"},cL);
              }
            }
            Mindmeister.moveNodeToRoot(Scrap.mapID,practiceNode.id,rootNode.id,[-200,-100],cL);
            if(toolingNode!=null&&toolingNode.getChildren().length==0){
              Mindmeister.removeIdea(Scrap.mapID,toolingNode.id,cL);
            }
            else if(toolingNode!=null&&toolingNode.getChildren().length>0){
              Mindmeister.moveNodeToRoot(Scrap.mapID,toolingNode.id,rootNode.id,[-200,-100],cL);
              Mindmeister.modifyIdea(Scrap.mapID,toolingNode.id,{icon:"emoji/symbols-heavy_exclamation_mark"},cL);
            }
            if(removeContext) Mindmeister.removeIdea(Scrap.mapID,contextNode.id,cL);
            else Mindmeister.modifyIdea(Scrap.mapID,contextNode.id,{icon:"emoji/symbols-heavy_exclamation_mark"},cL);
          }
        }

        // type of contribution
        var contributionTypeNode = rootNode.getChildren().find((el) => {return el.getContent()==="Type of contribution"});
        if(contributionTypeNode==null){
          var subtree = {
            title: "Type of Contribution",
            note: "Gregor and Hevner proposed a framework for classifying DSR contributions according to two dimensions: the Solution Maturity and the Application Domain Maturity. The former refers to the maturity of artefacts that can be potential starting points for the solution, while the latter refers to the maturity of the practice. \nFor more information, refer to Gregor, S. and Hevner, A.:\nPositioning and Presenting Design Science Research for Maximum Impact. MIS Quarterly (2013)",
            pos: [-200, 100],
            parentNodeId: rootNode.id,
            closed: true,
            children: [
              { title: "A new solution for a new problem",
                note: "Invention:\n\nThis kind of contribution is a radical innovation that addresses an unexplored problem context and offers a novel and unexpected solution. Such a contribution can enable new practices and create the basis for new research fields. Some examples of inventions are the first X-ray machine, the first car, and the first data mining system. Inventions are rare and typically require broad knowledge and hard work as well as ingenuity and a bit of luck in order to occur.\n\nExtracted from: Johannesson, J. and Perjons, E.: An Introduction to Design Science (2014)",
                icon: Icons.disabled,
                style: NODE_STYLES.template
              },
              { title: "A known solution for a new problem",
                note: "Exaptation:\n\nThis kind of contribution adapts an existing solution to a problem for which it was not originally intended. In other words, an existing artefact is repurposed, or exapted, to a new problem context. For example, the anticoagulant chemical warfarin was introduced as a rat poison but later repurposed as a blood-thinning medicine. Gunpowder started out as a medical elixir in China centuries before it was repurposed for powering fireworks and firearms. Exaptations occur frequently in design science research.\n\nExtracted from: Johannesson, J. and Perjons, E.: An Introduction to Design Science (2014)",
                icon: Icons.disabled,
                style: NODE_STYLES.template
              },
              { title: "A new solution for a known problem",
                note: "Improvement:\n\nThis kind of contribution addresses a known problem and offers a new solution or a substantial enhancement to an existing one. Improvements may concern efficiency, usability, safety, main- tainability, or other qualities; see Sect. 6.5. Some examples of improvements are the first sport bike, an X-ray machine with substantially reduced radiation, and a data mining system able to handle very large data sets. Improvements are probably the most common kind of design science contribution, and they can be challenging because a researcher needs to show that a proposed solution actually improves on the state of the art.\n\nExtracted from: Johannesson, J. and Perjons, E.: An Introduction to Design Science (2014)",
                icon: Icons.disabled,
                style: NODE_STYLES.template
              },
              { title: "A known solution for a known problem",
                note: "Routine Design:\n\nThis kind of contribution is an incremental innovation that addresses a well-known problem by making minor modifications to an existing solution. Much of practical professional design would fit into this category, e.g. the design of a new smartphone with slightly better specifications than its predecessor. Routine designs typically do not count as design science contributions because they do not produce new knowledge of general interest, but they can still be valuable design contributions.\n\nExtracted from: Johannesson, J. and Perjons, E.: An Introduction to Design Science (2014)",
                icon: Icons.disabled,
                style: NODE_STYLES.template
              }
            ],
            style: NODE_STYLES.template
          };
          Mindmeister.insertSubtree(subtree,cL);
        }

        // asess problems as solutions
        var assessProblemAsSolutions = rootNode.getChildren().find((el) => {return el.getContent()==="Assess Problem as Solutions"});

        // design problem template
        var designProblemTemplate = rootNode.getChildren().find((el) => {return el.getContent()==="Design Problem Template"});
        var suchThat;
        if(designProblemTemplate!=null){
          suchThat = designProblemTemplate.getChildren().find((el) => {return el.getContent()==="Such that"});
          if(suchThat!=null){
            Mindmeister.modifyIdea(Scrap.mapID,suchThat.id,{title:"That satisfies"},cL);
          }
          var inOrderTo = designProblemTemplate.getChildren().find((el) => {return el.getContent()==="In order to"});
          if(inOrderTo!=null){
            Mindmeister.modifyIdea(Scrap.mapID,inOrderTo.id,{title:"In order to help"},cL);
            var ch = inOrderTo.getChildren();
            for(var i=0;i<ch.length;i++){
              Mindmeister.modifyIdea(Scrap.mapID,ch[i].id,{title:ch[i].getContent().replace("achieve(s)","achieve")},cL);
            }
          }
          var by = designProblemTemplate.getChildren().find((el) => {return el.getContent()==="By"});
          if(by!=null&&assessProblemAsSolutions!=null){
            var ch = by.getChildren();
            for(var i=0;i<ch.length;i++){
              if(ch[i].getChildren().length>0) continue;
              var mirror = assessProblemAsSolutions.getDescendants().find((el) => {return el.getContent()===ch[i].getContent()});
              if(mirror!=null&&mirror.getParentNode().getContent()==="How are you going to address it?") Mindmeister.removeIdea(Scrap.mapID,ch[i].id,cL);
            }
          }
        }

        // requirements
        var requirementsNode = rootNode.getChildren().find((el) => {return el.getContent()==="Requirements"});
        var nfr = [];
        if(requirementsNode!=null){
          var funcReqsNode = requirementsNode.getChildren().find((el) => {return el.getContent()==="Functional Requirements"});
          if(funcReqsNode!=null){
            var funcReqs = funcReqsNode.getChildren();
            for(var i=0;i<funcReqs.length;i++){
              Mindmeister.insertIdea(Scrap.mapID,funcReqs[i].id,{title:"How shall you attain it?",style:NODE_STYLES.prompt},cL);
              if(suchThat!=null){
                var mirror = suchThat.getChildren().find((el) => {return el.getContent() === funcReqs[i].getContent()});
                if(mirror!=null&&mirror.getChildren().length==0){
                  Mindmeister.removeIdea(Scrap.mapID,mirror.id,cL);
                }
              }
            }
          }
          var nfrNode = requirementsNode.getChildren().find((el) => {return el.getContent()==="Non-functional Requirements"});
          if(nfrNode!=null){
            nfr = nfrNode.getDescendants().filter((el) => {return el.getIcons().indexOf(Icons.enabled)!=-1});
          }
        }

        // design purposeful artefact
        var artefactNode = rootNode.getChildren().find((el) => {return el.getContent().indexOf("Design Purposeful Artefact")!=-1});
        if(artefactNode==null){
          var reqSubtree = [];
          for(var i=0;i<nfr.length;i++){
            reqSubtree.push({
              title: nfr[i].getContent(),
              link: "topic:"+nfr[i].id,
              style: NODE_STYLES.template
            })
          }
          var subtree = {
            title: "Design Purposeful Artefact <name your artefact>",
            note: "The Design and Develop Artifact activity creates an artifact that addresses the explicated problem and fulfills the defined requirements. Designing an artifact includes determining its functionality as well as its structure.",
            pos: [100, 500],
            parentNodeId: rootNode.id,
            closed: true,
            children: [
              { title: "Description",
                style: NODE_STYLES.template
              },
              { title: "Technological Platforms",
                style: NODE_STYLES.template
              },
              { title: "Requirements",
                icon: "emoji/symbols-arrows_counterclockwise",
                children: reqSubtree,
                style: NODE_STYLES.template
              },
              { title: "Components",
                style: NODE_STYLES.template
              }
            ],
            style: NODE_STYLES.template
          };
          Mindmeister.insertSubtree(subtree,cL);
        }

        // relocate nodes
        if(designProblemTemplate!=null){
          Mindmeister.modifyIdea(Scrap.mapID,designProblemTemplate.id,{position:[100,700]},cL);
        }
        var phenomena = rootNode.getChildren().find((el) => {return el.getContent()==="Describe Problematic Phenomena"});
        if(phenomena!=null){
          Mindmeister.modifyIdea(Scrap.mapID,phenomena.id,{position:[-800,-900]},cL);
        }

        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
          var mapIDList = DSCAFFOLDING_TEMPLATE_VERSIONING.map((el) => {return el.mapId});
          var listIndex = mapIDList.indexOf(Scrap.mapID);
          if (listIndex != -1) DSCAFFOLDING_TEMPLATE_VERSIONING[listIndex].templateVersion = "0.7.6";
          else DSCAFFOLDING_TEMPLATE_VERSIONING.push({mapId: Scrap.mapID, templateVersion: "0.7.6"});
          chrome.storage.sync.set({
            "DSCAFFOLDING_TEMPLATE_VERSIONING": DSCAFFOLDING_TEMPLATE_VERSIONING
          }, function () {
            DScaffolding.updateTemplate().then(function () {
              resolve();
            })
          });
        })
      }
      if(template=="Explicate Problem New"&&templateVersion<0.77){
        Scrap.showWorkingMessage("Updating mind map to the last version of the template. Please wait.");
        var cL = new Mindmeister.ChangeList();
        var rootNode = Scrap.getRootNode();
        var artefactNode = rootNode.getChildren().find((el) => {return el.getContent().indexOf("Design Purposeful Artefact")!=-1});
        if(artefactNode==null&&artefactNode.getContent()==="Design Purposeful Artefact"){
          Mindmeister.modifyIdea(Scrap.mapID,artefactNode.id,{title:"Design Purposeful Artefact <name your artefact>"},cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
          var mapIDList = DSCAFFOLDING_TEMPLATE_VERSIONING.map((el) => {return el.mapId});
          var listIndex = mapIDList.indexOf(Scrap.mapID);
          if (listIndex != -1) DSCAFFOLDING_TEMPLATE_VERSIONING[listIndex].templateVersion = "0.7.7";
          else DSCAFFOLDING_TEMPLATE_VERSIONING.push({mapId: Scrap.mapID, templateVersion: "0.7.7"});
          chrome.storage.sync.set({
            "DSCAFFOLDING_TEMPLATE_VERSIONING": DSCAFFOLDING_TEMPLATE_VERSIONING
          }, function () {
            DScaffolding.updateTemplate().then(function () {
              resolve();
            })
          });
        })
      }
      else resolve();
      // VERSION CHANGES
      /*if (templateVersion < 0.4634) {
        showWorkingMessage();
        // TRANSFORM RED NODES INTO BLUE
        var redNodes = Scrap.selectNodesByBackgroundColor({red: 230, green: 124, blue: 115});
        var promiseList = [];
        if (redNodes != null && redNodes.length != null) {
          for (var i = 0; i < redNodes.length; i++) {
            promiseList.push(Mindmeister.updateNodeBackgroundColor(Scrap.mapID, redNodes[i].id, "4769d1"));
          }
        }
        // FIX SUMMATIVE NATURALISTIC BUG
        var summativeNaturalisticEpisode1 = Scrap.selectNodeWithText("Summative Naturalistic Evaluation Episode 1");
        if (summativeNaturalisticEpisode1 != null) {
          var propertyList = DScaffolding.getChildsWithText(summativeNaturalisticEpisode1, "Property(ies) to be evaluated in this episode");
          if (propertyList != null && propertyList.length > 0) {
            var propertyListChildren = DScaffolding.getNodeChildren(propertyList[0].id);
            if (propertyListChildren.length == 0) {
              promiseList.push(Mindmeister.modifyIdea(Scrap.mapID, propertyList[0].id, {title: "Paste property(ies) to be evaluated in this episode here"}));
            }
          }
        }
        Promise.all(promiseList).then(function () {
          reloadCanvas();
          var mapIDList = DSCAFFOLDING_TEMPLATE_VERSIONING.map(getAttribute, "mapId");
          var listIndex = mapIDList.indexOf(Scrap.mapID);
          if (listIndex != -1) DSCAFFOLDING_TEMPLATE_VERSIONING[listIndex].templateVersion = "0.4.6.34";
          else DSCAFFOLDING_TEMPLATE_VERSIONING.push({mapId: Scrap.mapID, templateVersion: "0.4.6.34"});
          chrome.storage.sync.set({
            "DSCAFFOLDING_TEMPLATE_VERSIONING": DSCAFFOLDING_TEMPLATE_VERSIONING
          }, function () {
            DScaffolding.updateTemplate().then(function () {
              resolve();
            })
          });
        });
      }
      if (templateVersion < 0.4636) {
        showWorkingMessage();
        // TRANSFORM RED NODES INTO BLUE
        var promiseList = [];

        var problemAsDifficulties = Scrap.selectNodeWithText("Problem as Difficulties");
        if (problemAsDifficulties != null) promiseList.push(Mindmeister.modifyIdea(Scrap.mapID, problemAsDifficulties.id, {title: "Assess Problem as Difficulties"}));
        var problemAsSolutions = Scrap.selectNodeWithText("Problem as Solutions");
        if (problemAsSolutions != null) promiseList.push(Mindmeister.modifyIdea(Scrap.mapID, problemAsSolutions.id, {title: "Assess Problem as Solutions"}));
        Promise.all(promiseList).then(function () {
          reloadCanvas();
          var mapIDList = DSCAFFOLDING_TEMPLATE_VERSIONING.map(getAttribute, "mapId");
          var listIndex = mapIDList.indexOf(Scrap.mapID);
          if (listIndex != -1) DSCAFFOLDING_TEMPLATE_VERSIONING[listIndex].templateVersion = "0.4.6.36";
          else DSCAFFOLDING_TEMPLATE_VERSIONING.push({mapId: Scrap.mapID, templateVersion: "0.4.6.36"});
          chrome.storage.sync.set({
            "DSCAFFOLDING_TEMPLATE_VERSIONING": DSCAFFOLDING_TEMPLATE_VERSIONING
          }, function () {
            DScaffolding.updateTemplate().then(function () {
              resolve();
            })
          });
        });
      }
      if (templateVersion < 0.4645) {
        showWorkingMessage();
        var supportingEvidencesNodes = DScaffolding.getChildsWithText(null, "Supporting Evidences?", true);
        var promiseList = [];
        for (var i = 0; i < supportingEvidencesNodes.length; i++) {
          promiseList.push(Mindmeister.modifyIdea(Scrap.mapID, supportingEvidencesNodes[i].id, {note: "What proof do I have that this cause exists? (Is it concrete? Is it measurable?)\n\nWhat proof do I have that this cause could lead to the stated effect? (Am I merely asserting causation?)\n\nWhat proof do I have that this cause actually contributed to the problem I'm looking at? (Even given that it exists and could lead to this problem, how do I know it wasn't actually something else?)\n\nIs anything else needed, along with this cause, for the stated effect to occur? (Is it self-sufficient? Is something needed to help it along?)\n\nCan anything else, besides this cause, lead to the stated effect? (Are there alternative explanations that fit better? What other risks are there?)"}));
        }
        Promise.all(promiseList).then(function () {
          reloadCanvas();
          var mapIDList = DSCAFFOLDING_TEMPLATE_VERSIONING.map(getAttribute, "mapId");
          var listIndex = mapIDList.indexOf(Scrap.mapID);
          if (listIndex != -1) DSCAFFOLDING_TEMPLATE_VERSIONING[listIndex].templateVersion = "0.4.6.45";
          else DSCAFFOLDING_TEMPLATE_VERSIONING.push({mapId: Scrap.mapID, templateVersion: "0.4.6.45"});
          chrome.storage.sync.set({
            "DSCAFFOLDING_TEMPLATE_VERSIONING": DSCAFFOLDING_TEMPLATE_VERSIONING
          }, function () {
            DScaffolding.updateTemplate().then(function () {
              resolve();
            })
          });
        });
      }*/
      /*if (templateVersion < 0.53 && template == "Explicate Problem"){
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        var setProblemStatement = Scrap.getNodesWithText(Nodes.templateNodesPre.SET_PROBLEM_STATEMENT);
        if(setProblemStatement!=null&&setProblemStatement.length>0&&document.querySelector("#tk_rootchildren_left #tk_container_"+setProblemStatement[0].id)!=null){
          Mindmeister.modifyIdea(Scrap.mapID,setProblemStatement[0].id,{position:[100,0]},cL);
        }
        var problemAsDifficulties = Scrap.getNodesWithText(Nodes.templateNodesPre.PROBLEM_AS_DIFFICULTIES);
        if(problemAsDifficulties!=null&&problemAsDifficulties.length>0&&document.querySelector("#tk_rootchildren_left #tk_container_"+problemAsDifficulties[0].id)!=null){
          Mindmeister.modifyIdea(Scrap.mapID,problemAsDifficulties[0].id,{position:[100,50]},cL);
        }
        var problemAsSolutions = Scrap.getNodesWithText(Nodes.templateNodesPre.PROBLEM_AS_SOLUTIONS);
        if(problemAsSolutions!=null&&problemAsSolutions.length>0&&document.querySelector("#tk_rootchildren_left #tk_container_"+problemAsSolutions[0].id)!=null){
          Mindmeister.modifyIdea(Scrap.mapID,problemAsSolutions[0].id,{position:[100,100]},cL);
        }
        var describeEnvironment = Scrap.getNodesWithText(Nodes.templateNodesPre.DESCRIBE_ENVIRONMENT);
        var environmentNodeId;
        if(describeEnvironment!=null&&describeEnvironment.length==0){
          var environmentNodeId = Mindmeister.insertIdea(Scrap.mapID,Scrap.mapID,{title:Nodes.templateNodesPre.DESCRIBE_ENVIRONMENT,style:NODE_STYLES.template,pos:[-100,0]},cL,false);
        }
        else environmentNodeId = describeEnvironment[0].id;
        var describePractice = Scrap.getNodesWithText(Nodes.templateNodesPre.DESCRIBE_PRACTICE);
        if(describePractice!=null&&describePractice.length==0){
          Mindmeister.insertIdea(Scrap.mapID,environmentNodeId,{title:Nodes.templateNodesPre.DESCRIBE_PRACTICE,style:NODE_STYLES.template,pos:[-100,-30]},cL,false);
        }
        else if(describePractice[0].getParentNode()!=null&&describePractice[0].getParentNode().getContent()!=null&&describePractice[0].getParentNode().getContent()!=Nodes.templateNodesPre.DESCRIBE_ENVIRONMENT){
          Mindmeister.moveNode(Scrap.mapID,describePractice[0].id,environmentNodeId,cL);
        }
        var describeActivities = Scrap.getNodesWithText(Nodes.templateNodesPre.DESCRIBE_ACTIVITIES);
        if(describeActivities!=null&&describeActivities.length==0){
          Mindmeister.insertIdea(Scrap.mapID,environmentNodeId,{title:Nodes.templateNodesPre.DESCRIBE_ACTIVITIES,style:NODE_STYLES.template,pos:[-100,0]},cL,false);
        }
        var describeTooling = Scrap.getNodesWithText(Nodes.templateNodesPre.DESCRIBE_TOOLING);
        if(describeTooling!=null&&describeTooling.length==0){
          Mindmeister.insertIdea(Scrap.mapID,environmentNodeId,{title:Nodes.templateNodesPre.DESCRIBE_TOOLING,style:NODE_STYLES.template,pos:[-100,30]},cL,false);
        }
        var analyseStakeholders = Scrap.getNodesWithText(Nodes.templateNodesPre.ANALYSE_STAKEHOLDERS);
        if(analyseStakeholders!=null&&analyseStakeholders.length>0&&document.querySelector("#tk_rootchildren_right #tk_container_"+analyseStakeholders[0].id)!=null){
          Mindmeister.modifyIdea(Scrap.mapID,analyseStakeholders[0].id,{position:[-100,100]},cL);
        }
        var replaceNodeText = function(nodeList,oldText,newText){
          for(var i=0;i<nodeList.length;i++){
            var nodeContent = nodeList[i].getContent();
            if(nodeContent==oldText) Mindmeister.modifyIdea(Scrap.mapID,nodeList[i].id,{title:newText},cL);
          }
        }
        var ascertainConsequences = Scrap.getNodesWithText(Nodes.templateNodesPre.ASCERTAIN_CONSEQUENCES);
        if(ascertainConsequences!=null&&ascertainConsequences.length>0){
          var ascertainConsequencesDescendants = ascertainConsequences[0].getDescendants();
          replaceNodeText(ascertainConsequencesDescendants,Prompter.Nodes.WHAT_FOLLOWS_FROM.text,Prompter.Nodes.WHAT_FOLLOWS_FROM_EP.text,cL);
          replaceNodeText(ascertainConsequencesDescendants,Prompter.Nodes.WHAT_FOLLOWS_FROM.completed,Prompter.Nodes.WHAT_FOLLOWS_FROM_EP.completed,cL);
        }
        var alleviateConsequences = Scrap.getNodesWithText(Nodes.templateNodesPre.ALLEVIATE_CONSEQUENCES);
        if(alleviateConsequences!=null&&alleviateConsequences.length>0){
          var alleviateConsequencesDescendants = alleviateConsequences[0].getDescendants();
          replaceNodeText(alleviateConsequencesDescendants,Prompter.Nodes.WHAT_FOLLOWS_FROM.completed,Prompter.Nodes.WHAT_FOLLOWS_FROM_EP.completed,cL);
        }
        var ascertainCauses = Scrap.getNodesWithText(Nodes.templateNodesPre.ASCERTAIN_CAUSES);
        if(ascertainCauses!=null&&ascertainCauses.length>0){
          var ascertainCausesDescendants = ascertainCauses[0].getDescendants();
          //replaceNodeText(ascertainCausesDescendants,Prompter.Nodes.WHY.text,Prompter.Nodes.WHY_EP.text,cL);
          replaceNodeText(ascertainCausesDescendants,Prompter.Nodes.WHY.completed,Prompter.Nodes.WHY_EP.completed,cL);
        }
        var lessenCauses = Scrap.getNodesWithText(Nodes.templateNodesPre.LESSEN_CAUSES);
        if(lessenCauses!=null&&lessenCauses.length>0){
          var lessenCausesDescendants = lessenCauses[0].getDescendants();
          replaceNodeText(lessenCausesDescendants,Prompter.Nodes.WHY.completed,Prompter.Nodes.WHY_EP.completed,cL);
        }
        var technicalRQ = Scrap.getNodesWithText("Technical Research Question/Goal");
        if(technicalRQ!=null&&technicalRQ.length>0){
          var desc = technicalRQ[0].getDescendants();
          if(desc!=null&&desc.length==4){
            Mindmeister.removeIdea(Scrap.mapID,technicalRQ[0].id,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
          var mapIDList = DSCAFFOLDING_TEMPLATE_VERSIONING.map(getAttribute, "mapId");
          var listIndex = mapIDList.indexOf(Scrap.mapID);
          if (listIndex != -1) DSCAFFOLDING_TEMPLATE_VERSIONING[listIndex].templateVersion = "0.5.3";
          else DSCAFFOLDING_TEMPLATE_VERSIONING.push({mapId: Scrap.mapID, templateVersion: "0.5.3"});
          chrome.storage.sync.set({
            "DSCAFFOLDING_TEMPLATE_VERSIONING": DSCAFFOLDING_TEMPLATE_VERSIONING
          }, function () {
            DScaffolding.updateTemplate().then(function () {
              resolve();
            })
          });
        })
      }
      else if (templateVersion < 0.58 && template == "Explicate Problem"){
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        var problemAsSolutions = Scrap.getNodesWithText(Nodes.templateNodesPre.PROBLEM_AS_SOLUTIONS);
        if(problemAsSolutions!=null&&problemAsSolutions.length>0){
          var descendants = problemAsSolutions[0].getDescendants();
          for(var i=0;i<descendants.length;i++){
            if(descendants[i].getContent()==Prompter.Nodes.HOW.text) Mindmeister.modifyIdea(Scrap.mapID,descendants[i].id,{title:Prompter.Nodes.HOW_ARE_YOU_GOING_TO_ADDRESS_IT.text},cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
          var mapIDList = DSCAFFOLDING_TEMPLATE_VERSIONING.map(getAttribute, "mapId");
          var listIndex = mapIDList.indexOf(Scrap.mapID);
          if (listIndex != -1) DSCAFFOLDING_TEMPLATE_VERSIONING[listIndex].templateVersion = "0.5.8";
          else DSCAFFOLDING_TEMPLATE_VERSIONING.push({mapId: Scrap.mapID, templateVersion: "0.5.8"});
          chrome.storage.sync.set({
            "DSCAFFOLDING_TEMPLATE_VERSIONING": DSCAFFOLDING_TEMPLATE_VERSIONING
          }, function () {
            DScaffolding.updateTemplate().then(function () {
              resolve();
            })
          });
        })
      }
      else if (templateVersion < 0.61 && template == "Explicate Problem"){
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        // DESCRIBE PROBLEMATIC PHENOMENA
        var rootNode = Scrap.getRootNode();
        var subtree = {
          title: "Describe Problematic Phenomena",
          note: "In the early stages of a research program, we usually need to ask exploratory questions, as we attempt to understand the phenomena, and identify useful distinctions that clarify our understanding. These Knowledge Questions are adapted from Easterbrook (2008) which are in turn adapted from those in Meltzoff (1998)",
          children: [],
          style: NODE_STYLES.template,
          pos: [-200,-200],
          parentNodeId: rootNode.id,
          closed: true
        }
        var setProblemStatement = Scrap.getNodesWithText("Set Problem Statement");
        var pAux;
        if(setProblemStatement!=null&&setProblemStatement.length>0){
          var problemStatement = setProblemStatement[0].getChildren();
          if(problemStatement!=null&&problemStatement.length>0){
            var p = problemStatement[0].getContent();
            pAux = problemStatement[0];
            subtree.children.push({
              title: "Descriptive Questions",
              children: [
                {title: 'What is "'+p+'" like?', style: NODE_STYLES.template},
                {title: 'What are its properties?', style: NODE_STYLES.template},
                {title: 'How can it be categorized?', style: NODE_STYLES.template},
                {title: 'How can we measure it?', style: NODE_STYLES.template},
                {title: 'What is its purpose?', style: NODE_STYLES.template},
                {title: 'What are its components?', style: NODE_STYLES.template},
                {title: 'How do the components relate to one another?', style: NODE_STYLES.template},
                {title: 'What are all the types of "'+p+'"?', style: NODE_STYLES.template},
                {title: 'How does "'+p+'" differ from similar problems?', style: NODE_STYLES.template}
              ],
              style: NODE_STYLES.template
            })
            subtree.children.push({
              title: "Occurrence Questions",
              children: [
                {title: 'How often does "'+p+'" occur?', style: NODE_STYLES.template},
                {title: 'What is an average amount of "'+p+'"?', style: NODE_STYLES.template},
                {title: 'How does "'+p+'" normally work?', style: NODE_STYLES.template},
                {title: 'What is the process by which "'+p+'" happens?', style: NODE_STYLES.template},
                {title: 'In what sequence do the events of "'+p+'" occur?', style: NODE_STYLES.template},
                {title: 'What are the steps "'+p+'" goes through as it evolves?', style: NODE_STYLES.template}
              ],
              style: NODE_STYLES.template
            })
          }
        }
        if(subtree.children.length==0){
          subtree.children.push({
            title: "Descriptive Questions",
            style: NODE_STYLES.template
          });
          subtree.children.push({
            title: "Occurrence Questions",
            style: NODE_STYLES.template
          })
        }
        Mindmeister.insertSubtree(subtree,cL);

        // DESCRIBE ENVIRONMENT -> CONTEXT
        var describeEnvironment = Scrap.getNodesWithText(Nodes.templateNodesPre.DESCRIBE_ENVIRONMENT);
        if(describeEnvironment!=null){
          for(var i=0;i<describeEnvironment.length;i++){
            Mindmeister.modifyIdea(Scrap.mapID,describeEnvironment[i].id,{title:"Describe Context"},cL);
          }
        }
        // STAKEHOLDERS -> WHAT ARE THEIR GOALS
        var stakeholderInsertionPointLabels = ["Add Client(s)","Add Decision Maker(s)","Add Professional(s)","Add Witness(es)"];
        for(var i=0;i<stakeholderInsertionPointLabels.length;i++){
          var aux = Scrap.getNodesWithText(stakeholderInsertionPointLabels[i]);
          if(aux==null) continue;
          var st = aux[0].getChildren();
          for(var j=0;j<st.length;j++){
            Mindmeister.insertIdea(Scrap.mapID,st[j].id,{title:"What are their goals?",style:NODE_STYLES.prompt},cL);
          }
        }

        // DESCRIBE TERMINOLOGY
        Mindmeister.insertIdea(Scrap.mapID,rootNode.id,{title:"Describe Terminology",note:"A good theory precisely defines the theoretical terms, so that a community of scientists can observe and measure them.",style:NODE_STYLES.template,pos:[-100,400]},cL);

        // REQUIREMENTS
        var reqSubtree = {
          title: "Requirements",
          note: "What artefact can be a solution for the explicated problem and which requirements\n on this artefact are important for the stakeholders?  A requirement is a property of an artefact that is deemed as desirable by stakeholders in a practice and that is to be used for guiding the design and development of the artefact.  For each requirement, explain why it is needed and\n relate it to the problem.",
          pos: [100, 400],
          parentNodeId: rootNode.id,
          children: [],
          style: NODE_STYLES.template
        };
        var n = {
          title: "Functional Requirements",
          note: 'Functional requirements are what the system should do. They include the ways to reduce or alleviate the consequences and causes of the problem.',
          children: [],
          style: NODE_STYLES.template
        }
        var problemAsSolutions = Scrap.getNodesWithText("Assess Problem as Solutions");
        var funcRequirements = [];
        if(problemAsSolutions!=null&&problemAsSolutions.length>0){
          var desc = problemAsSolutions[0].getDescendants();
          for(var i=0;i<desc.length;i++){
            if(desc[i].getIcons().indexOf(Icons.enabled)!=-1){
              funcRequirements.push({title:desc[i].getContent(),id:desc[i].id});
            }
          }
          for(var i=0;i<funcRequirements.length;i++){
            n.children.push({
              title: funcRequirements[i].title,
              style:  NODE_STYLES.template,
              link: "topic:"+funcRequirements[i].id
            });
          }
        }
        reqSubtree.children.push(n);
        reqSubtree.children.push({
          title: "Non-functional Requirements",
          note: "Non-functional requirements are not what the purposeful artefact should do, but instead are desirable characteristics that the purposeful artefact should have. These are then additional design goals. A checklist of possible non-functional requirements is provided to the right, grouped into categories.",
          style: NODE_STYLES.template,
          children: [
            {
              title: "Structural",
              style: NODE_STYLES.template,
              children: [
                {
                  title: "Coherence",
                  note: "the degree to which the parts of an artefact are logically, orderly, and consistently related; coherence is low if an artefact includes parts that, in some sense, do not fit in with the rest of the artefact.",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Consistency",
                  note: "the degree to which a model is free from conflict.",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Modularity",
                  note: "the degree to which an artefact is divided into components that may be separated and recombined; common requirements related to modularity are low coupling, i.e. modules are not overly related with each other; high cohesion, i.e. modules are highly related internally; and high composability, i.e. modules can be easily replaced and recombined.",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Conciseness",
                  note: "the absence of redundant components in an artefact, i.e. components the functions of which can be derived from other components.",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                }
              ]
            },
            {
              title: "Usage",
              style: NODE_STYLES.template,
              children: [
                {
                  title: "Usability",
                  note: "the ease with which a user can use an artefact to achieve a particular goal",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Comprehensibility",
                    note: "the ease with which an artefact can be understood or comprehended by a user (also called understandability)",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Learnability",
                    note: "the ease with which a user can learn to use an artefact",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Customisability",
                    note: "the degree to which an artefact can be adapted to the specific needs of a local practice or user",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Suitability",
                    note: "the degree to which an artefact is tailored to a specific practice, focusing only on its essential aspects (also called inherence or precision)",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Accessibility",
                    note: "the degree to which an artefact is accessible by as many users as possible",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Elegance",
                    note: "the degree to which an artefact is pleasing and graceful in appearance or style (also called aesthetics)",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Fun",
                    note: "the degree to which an artefact is attractive and fun to use",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Traceability",
                    note: "the ability to verify the history of using a method by means of documentation",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                }
              ]
            },
            {
              title: "Management",
              style: NODE_STYLES.template,
              children: [
                {
                  title: "Maintainability",
                  note: "the ease with which an artefact can be maintained in order to correct defects, meet new requirements, make future maintenance easier, or cope with a changed environment.",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Flexibility",
                  note: "the ease with which an artefact can be adapted when external changes occur (similar to maintainability; related notions are configurability, evolvability, and extensibility).",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Accountability",
                  note: "the ease with which an actor can be made accountable for the workings of an artefact (a similar notion is auditability).",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                }
              ]
            },
            {
              title: "Environmental",
              style: NODE_STYLES.template,
              children: [
                {
                  title: "Expresiveness",
                  note: "the degree to which a set of constructs or a model is capable of representing the entities of interest in a domain",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Correctness",
                  note: "the degree to which a model corresponds to the domain it represents (also called accurateness)",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Generality",
                  note: "the degree to which an artefact is relevant not only for a local but also for a global practice",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Interoperability",
                  note: "the ability of an artefact to work together with other artefacts, in particular, to exchange data (related notions are openness, compatibility, and compliance with standards)",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Autonomy",
                  note: "the capacity of an artefact to function without the involvement of another system",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Proximity",
                  note: "the degree to which independent aspects of a domain are captured by different constructs, and related aspects are represented by related constructs",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Completeness",
                  note: "the degree to which an artefact includes all components required for addressing the problem for which it has been created",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Effectiveness",
                  note: "the degree to which an artefact is able to achieve its goals",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Efficiency",
                  note: "the degree to which an artefact is effective without wasting time, effort, or expense",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Robustness",
                  note: "the ability of an artefact to withstand environmental change without adapting its construction",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                },
                {
                  title: "Resilience",
                  note: "the ability of an artefact to adapt itself when faced with major environmental change (related notions are degradability, survivability, and safety)",
                  icon: Icons.disabled,
                  style: NODE_STYLES.template
                }
              ]
            },
          ]
        })
        Mindmeister.insertSubtree(reqSubtree,cL);

        // DESIGN PROBLEM TEMPLATE
        var dpt = {
          title: "Design Problem Template",
          pos: [100, 600],
          parentNodeId: rootNode.id,
          children: [],
          style: NODE_STYLES.template
        }
        var dptImprove = {
          title: "Improve",
          children: [],
          style: NODE_STYLES.template
        }
        if(pAux!=null){
          dptImprove.children.push({
            title: pAux.getContent(),
            style: NODE_STYLES.template,
            link: "topic:"+pAux.id
          })
        }
        dpt.children.push(dptImprove);
        var dptBy = {
          title: "By",
          children: [],
          style: NODE_STYLES.template
        }
        var howAddress = Scrap.getNodesWithText("How are you going to address it?");
        if(howAddress!=null&&howAddress.length>0){
          var art = howAddress[0].getChildren();
          if(art!=null&&art.length>0){
            dptBy.children.push({
              title: art[0].getContent(),
              style: NODE_STYLES.template,
              link: "topic:"+art[0].id
            })
          }
        }
        dpt.children.push(dptBy);
        var dptSuchThat = {
          title: "Such that",
          children: [],
          style: NODE_STYLES.template
        }
        for(var i=0;i<funcRequirements.length;i++){
          dptSuchThat.children.push({
            title: funcRequirements[i].title,
            style: NODE_STYLES.template
          })
        }
        dpt.children.push(dptSuchThat);
        dpt.children.push({
          title: "In order to",
          style: NODE_STYLES.template
        });
        Mindmeister.insertSubtree(dpt,cL);

        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
          var mapIDList = DSCAFFOLDING_TEMPLATE_VERSIONING.map(getAttribute, "mapId");
          var listIndex = mapIDList.indexOf(Scrap.mapID);
          if (listIndex != -1) DSCAFFOLDING_TEMPLATE_VERSIONING[listIndex].templateVersion = "0.6.1";
          else DSCAFFOLDING_TEMPLATE_VERSIONING.push({mapId: Scrap.mapID, templateVersion: "0.6.1"});
          chrome.storage.sync.set({
            "DSCAFFOLDING_TEMPLATE_VERSIONING": DSCAFFOLDING_TEMPLATE_VERSIONING
          }, function () {
            Mindmeister.setMindmapTags(Scrap.mapID,["DScaffolding","ExplicateProblemNew","v0.6.1"]).then(function(){
              DScaffolding.templateName = "Explicate Problem New";
              DScaffolding.updateTemplate().then(function () {
                resolve();
              })
            })
          });
        })
      }
      else {
        resolve();
      }
      */
      /*if(template=="Explicate Problem New"){
        if(templateVersion < 0.76){
          Scrap.showWorkingMessage();
          var cL = new Mindmeister.ChangeList();
          var setProblemStatement = Scrap.getNodesWithText(Nodes.templateNodesPre.SET_PROBLEM_STATEMENT);
          if(setProblemStatement!=null&&setProblemStatement.length>0&&document.querySelector("#tk_rootchildren_left #tk_container_"+setProblemStatement[0].id)!=null){
            Mindmeister.modifyIdea(Scrap.mapID,setProblemStatement[0].id,{position:[100,0]},cL);
          }
          var problemAsDifficulties = Scrap.getNodesWithText(Nodes.templateNodesPre.PROBLEM_AS_DIFFICULTIES);
          if(problemAsDifficulties!=null&&problemAsDifficulties.length>0&&document.querySelector("#tk_rootchildren_left #tk_container_"+problemAsDifficulties[0].id)!=null){
            Mindmeister.modifyIdea(Scrap.mapID,problemAsDifficulties[0].id,{position:[100,50]},cL);
          }
          var problemAsSolutions = Scrap.getNodesWithText(Nodes.templateNodesPre.PROBLEM_AS_SOLUTIONS);
          if(problemAsSolutions!=null&&problemAsSolutions.length>0&&document.querySelector("#tk_rootchildren_left #tk_container_"+problemAsSolutions[0].id)!=null){
            Mindmeister.modifyIdea(Scrap.mapID,problemAsSolutions[0].id,{position:[100,100]},cL);
          }
          var describeEnvironment = Scrap.getNodesWithText(Nodes.templateNodesPre.DESCRIBE_ENVIRONMENT);
          var environmentNodeId;
          if(describeEnvironment!=null&&describeEnvironment.length==0){
            var environmentNodeId = Mindmeister.insertIdea(Scrap.mapID,Scrap.mapID,{title:Nodes.templateNodesPre.DESCRIBE_ENVIRONMENT,style:NODE_STYLES.template,pos:[-100,0]},cL,false);
          }
          else environmentNodeId = describeEnvironment[0].id;
          var describePractice = Scrap.getNodesWithText(Nodes.templateNodesPre.DESCRIBE_PRACTICE);
          if(describePractice!=null&&describePractice.length==0){
            Mindmeister.insertIdea(Scrap.mapID,environmentNodeId,{title:Nodes.templateNodesPre.DESCRIBE_PRACTICE,style:NODE_STYLES.template,pos:[-100,-30]},cL,false);
          }
          else if(describePractice[0].getParentNode()!=null&&describePractice[0].getParentNode().getContent()!=null&&describePractice[0].getParentNode().getContent()!=Nodes.templateNodesPre.DESCRIBE_ENVIRONMENT){
            Mindmeister.moveNode(Scrap.mapID,describePractice[0].id,environmentNodeId,cL);
          }
          var describeActivities = Scrap.getNodesWithText(Nodes.templateNodesPre.DESCRIBE_ACTIVITIES);
          if(describeActivities!=null&&describeActivities.length==0){
            Mindmeister.insertIdea(Scrap.mapID,environmentNodeId,{title:Nodes.templateNodesPre.DESCRIBE_ACTIVITIES,style:NODE_STYLES.template,pos:[-100,0]},cL,false);
          }
          var describeTooling = Scrap.getNodesWithText(Nodes.templateNodesPre.DESCRIBE_TOOLING);
          if(describeTooling!=null&&describeTooling.length==0){
            Mindmeister.insertIdea(Scrap.mapID,environmentNodeId,{title:Nodes.templateNodesPre.DESCRIBE_TOOLING,style:NODE_STYLES.template,pos:[-100,30]},cL,false);
          }
          var analyseStakeholders = Scrap.getNodesWithText(Nodes.templateNodesPre.ANALYSE_STAKEHOLDERS);
          if(analyseStakeholders!=null&&analyseStakeholders.length>0&&document.querySelector("#tk_rootchildren_right #tk_container_"+analyseStakeholders[0].id)!=null){
            Mindmeister.modifyIdea(Scrap.mapID,analyseStakeholders[0].id,{position:[-100,100]},cL);
          }
          var replaceNodeText = function(nodeList,oldText,newText){
            for(var i=0;i<nodeList.length;i++){
              var nodeContent = nodeList[i].getContent();
              if(nodeContent==oldText) Mindmeister.modifyIdea(Scrap.mapID,nodeList[i].id,{title:newText},cL);
            }
          }
          var ascertainConsequences = Scrap.getNodesWithText(Nodes.templateNodesPre.ASCERTAIN_CONSEQUENCES);
          if(ascertainConsequences!=null&&ascertainConsequences.length>0){
            var ascertainConsequencesDescendants = ascertainConsequences[0].getDescendants();
            replaceNodeText(ascertainConsequencesDescendants,Prompter.Nodes.WHAT_FOLLOWS_FROM.text,Prompter.Nodes.WHAT_FOLLOWS_FROM_EP.text,cL);
            replaceNodeText(ascertainConsequencesDescendants,Prompter.Nodes.WHAT_FOLLOWS_FROM.completed,Prompter.Nodes.WHAT_FOLLOWS_FROM_EP.completed,cL);
          }
          var alleviateConsequences = Scrap.getNodesWithText(Nodes.templateNodesPre.ALLEVIATE_CONSEQUENCES);
          if(alleviateConsequences!=null&&alleviateConsequences.length>0){
            var alleviateConsequencesDescendants = alleviateConsequences[0].getDescendants();
            replaceNodeText(alleviateConsequencesDescendants,Prompter.Nodes.WHAT_FOLLOWS_FROM.completed,Prompter.Nodes.WHAT_FOLLOWS_FROM_EP.completed,cL);
          }
          var ascertainCauses = Scrap.getNodesWithText(Nodes.templateNodesPre.ASCERTAIN_CAUSES);
          if(ascertainCauses!=null&&ascertainCauses.length>0){
            var ascertainCausesDescendants = ascertainCauses[0].getDescendants();
            //replaceNodeText(ascertainCausesDescendants,Prompter.Nodes.WHY.text,Prompter.Nodes.WHY_EP.text,cL);
            replaceNodeText(ascertainCausesDescendants,Prompter.Nodes.WHY.completed,Prompter.Nodes.WHY_EP.completed,cL);
          }
          var lessenCauses = Scrap.getNodesWithText(Nodes.templateNodesPre.LESSEN_CAUSES);
          if(lessenCauses!=null&&lessenCauses.length>0){
            var lessenCausesDescendants = lessenCauses[0].getDescendants();
            replaceNodeText(lessenCausesDescendants,Prompter.Nodes.WHY.completed,Prompter.Nodes.WHY_EP.completed,cL);
          }
          var technicalRQ = Scrap.getNodesWithText("Technical Research Question/Goal");
          if(technicalRQ!=null&&technicalRQ.length>0){
            var desc = technicalRQ[0].getDescendants();
            if(desc!=null&&desc.length==4){
              Mindmeister.removeIdea(Scrap.mapID,technicalRQ[0].id,cL);
            }
          }
          Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
            else Scrap.hideWorkingMessage();
            var mapIDList = DSCAFFOLDING_TEMPLATE_VERSIONING.map(getAttribute, "mapId");
            var listIndex = mapIDList.indexOf(Scrap.mapID);
            if (listIndex != -1) DSCAFFOLDING_TEMPLATE_VERSIONING[listIndex].templateVersion = "0.5.3";
            else DSCAFFOLDING_TEMPLATE_VERSIONING.push({mapId: Scrap.mapID, templateVersion: "0.5.3"});
            chrome.storage.sync.set({
              "DSCAFFOLDING_TEMPLATE_VERSIONING": DSCAFFOLDING_TEMPLATE_VERSIONING
            }, function () {
              DScaffolding.updateTemplate().then(function () {
                resolve();
              })
            });
          })
        }
      }*/
    })
  }
  var createPairedComparisonPoll = function(nodeId){
    var pairedComparisonPollAppURL = "https://script.google.com/macros/s/AKfycbwmaWKMBmFDG0wScOyNxNhEcB-OOL5-DPKL2JSqc_M6IvTWTAk/exec";
    var subtree = Scrap.getNodeById(nodeId).getSubtree();
    subtree = filterSubtreeBis(subtree);

    var subtreeLeafs = [];
    for(var i=0;i<subtree.length;i++){
      subtreeLeafs = subtreeLeafs.concat(DScaffolding.getSubtreeLeaves(subtree[i]));
    }
    var valuesToCompare = [];

    for(var i=0;i<subtreeLeafs.length;i++){
      if(subtreeLeafs[i].getContent()!=Prompter.Nodes.WHAT_FOLLOWS_FROM.text&&subtreeLeafs[i].getContent()!=Prompter.Nodes.WHY.text&&subtreeLeafs[i].getContent()!=Prompter.Nodes.WHY.completed&&subtreeLeafs[i].getContent()!=Prompter.Nodes.WHAT_FOLLOWS_FROM.completed&&subtreeLeafs[i].getContent()!="Ascertain Consequences"&&subtreeLeafs[i].getContent()!="Ascertain Causes"){
        valuesToCompare.push(subtreeLeafs[i].getContent());
      }
    }
    if(valuesToCompare.length>0){
      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList();
      var mapTitle = Scrap.getRootNode().getContent();
      var nodeContent = Scrap.getNodeById(nodeId).getContent();
      var formTitle;
      if(nodeContent=="Assess Problem as Difficulties") formTitle = "the causes and consequences of "+mapTitle;
      else if(nodeContent=="Ascertain Consequences") formTitle = "the consequences of "+mapTitle;
      else if(nodeContent=="Ascertain Causes") formTitle = "the causes of "+mapTitle;
      else{
        var n = Scrap.getNodeById(nodeId);
        if(n.isDescendant(Nodes.templateNodes.ASCERTAIN_CONSEQUENCES)) formTitle = "the subconsequences of "+nodeContent+" - "+mapTitle;
        else if(n.isDescendant(Nodes.templateNodes.ASCERTAIN_CAUSES)) formTitle = "the subcauses of "+nodeContent+" - "+mapTitle;
        else formTitle = mapTitle+"."+nodeContent;
      }
      $.post( pairedComparisonPollAppURL, { projectName: formTitle, valuesToCompare: valuesToCompare }, function(data,status,request) {
        if(request.getResponseHeader('content-type').indexOf("application/json")==-1){
          chrome.runtime.sendMessage({mes: "authorizePairedComparison", appURL: pairedComparisonPollAppURL});
        }
        else{
          if(data.created){
            var pollURL = data.editorURL;
            var answersURL = data.editorURL+"#responses";
            var mapID = Scrap.mapID;
            var aux = NODE_POLL_MAPPING.find((el) => {return el.mapId==mapID && el.nodeId==nodeId});
            if(aux!=null){
              aux.pollURL = pollURL;
              aux.answersURL = answersURL;
            }
            else{
              NODE_POLL_MAPPING.push({
                mapId: mapID,
                nodeId: nodeId,
                pollURL: pollURL,
                answersURL: answersURL
              });
            }
            chrome.storage.sync.set({"NODE_POLL_MAPPING":NODE_POLL_MAPPING}, function(options){
              Mindmeister.modifyIdea(Scrap.mapID,nodeId,{icon:"emoji/objects-bar_chart,emoji/objects-pencil"},cL);
              Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
                if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
                else Scrap.hideWorkingMessage();
              })
            })
          }
        }
      });
    }
  }
  // SET AS PROBLEM STATEMENT - todo (pass nodes, not ids)
  var setAsProblemStatementDrag = function(node,oldParentNode){
    Scrap.showWorkingMessage();
    var cL = new Mindmeister.ChangeList();

    var newProblemStatementNode = node;
    var nodeId = node.id;
    var newProblemStatement = newProblemStatementNode.getContent();

    var aux = Nodes.templateNodes.SET_PROBLEM_STATEMENT.getChildren();
    // TODO
    var oldProblemStatement = "Old problem statement";
    if(aux!=null&&aux.length>0){
      if(aux[0].getContent() == newProblemStatement && aux.length > 1) oldProblemStatement = aux[1].getContent();
      //else oldProblemStatement = aux[0].getContent(); // ONLY THE FIRST CHILD BY THE MOMENT
      for(var i=0;i<aux.length;i++){
        if(aux[i].getContent() != newProblemStatement){
          oldProblemStatement = aux[i].getContent();
          Mindmeister.removeIdea(Scrap.mapID,aux[i].id,cL);
        }
      }
    }

    var parentNode = oldParentNode;
    var oldParentNodeId = oldParentNode.id;
    var siblings = parentNode.getChildren();
    for(var i=0;i<siblings.length;i++){
      //if(siblings[i].id!=nodeId){
        Mindmeister.removeIdea(Scrap.mapID,siblings[i].id,cL);
      //}
    }

    var operation;
    var ancestors = [parentNode].concat(parentNode.getAncestors());
    var ancestorsToMove = [];
    var ancestorsToRemove = [];

    var mirrorAncestorsToMove = [];
    var mirrorAncestorsToRemove = [];

    if(parentNode.isDescendant(Nodes.templateNodes.ASCERTAIN_CONSEQUENCES)||Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.id==oldParentNodeId){
      operation = "zoomOut";
      for(var i=0;i<ancestors.length;i++){
        var ancestorContent = ancestors[i].getContent();
        if(ancestorContent==Nodes.templateNodesText.ASCERTAIN_CONSEQUENCES) break;
        if(ancestorContent!=Prompter.Nodes.WHAT_FOLLOWS_FROM.completed){
          ancestorsToMove.push(ancestors[i]);
          var parentChildren = ancestors[i].getParentNode().getChildren();
          for(var j=0;j<parentChildren.length;j++){
            if(parentChildren[j].id!=ancestors[i].id) Mindmeister.removeIdea(Scrap.mapID,parentChildren[j].id,cL);
          }
        }
        else{
          ancestorsToRemove.push(ancestors[i]);
        }
      }
      var mirrorNode = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(DScaffolding.invertPoles(newProblemStatement));
      if(mirrorNode!=null&&mirrorNode.length>0){
        var mirrorNodeAncestors = mirrorNode[0].getAncestors();
        for(var j=0;j<mirrorNodeAncestors.length;j++){
          var mirrorAncestorContent = mirrorNodeAncestors[j].getContent();
          if(mirrorAncestorContent==Nodes.templateNodesText.ALLEVIATE_CONSEQUENCES) break;
          if(mirrorAncestorContent!=Prompter.Nodes.WHAT_FOLLOWS_FROM.completed){
            mirrorAncestorsToMove.push(mirrorNodeAncestors[j]);
            var parentChildren = mirrorNodeAncestors[j].getParentNode().getChildren();
            for(var k=0;k<parentChildren.length;k++){
              if(parentChildren[k].id!=mirrorNodeAncestors[j].id) Mindmeister.removeIdea(Scrap.mapID,parentChildren[k].id,cL);
            }
          }
          else{
            mirrorAncestorsToRemove.push(mirrorNodeAncestors[j]);
          }
        }
      }
    }
    else if(parentNode.isDescendant(Nodes.templateNodes.ASCERTAIN_CAUSES)||Nodes.templateNodes.ASCERTAIN_CAUSES.id==oldParentNodeId){
      operation = "zoomIn";
      for(var i=0;i<ancestors.length;i++){
        var ancestorContent = ancestors[i].getContent();
        if(ancestorContent==Nodes.templateNodesText.ASCERTAIN_CAUSES) break;
        if(ancestorContent!=Prompter.Nodes.WHY.completed){
          ancestorsToMove.push(ancestors[i]);
          var parentChildren = ancestors[i].getParentNode().getChildren();
          for(var j=0;j<parentChildren.length;j++){
            if(parentChildren[j].id!=ancestors[i].id) Mindmeister.removeIdea(Scrap.mapID,parentChildren[j].id,cL);
          }
        }
        else{
          ancestorsToRemove.push(ancestors[i]);
        }
      }
      var mirrorNode = Nodes.templateNodes.LESSEN_CAUSES.getChildrenWithText(DScaffolding.invertPoles(newProblemStatement));
      if(mirrorNode!=null&&mirrorNode.length>0){
        var mirrorNodeAncestors = mirrorNode[0].getAncestors();
        for(var j=0;j<mirrorNodeAncestors.length;j++){
          var mirrorAncestorContent = mirrorNodeAncestors[j].getContent();
          if(mirrorAncestorContent==Nodes.templateNodesText.LESSEN_CAUSES) break;
          if(mirrorAncestorContent!=Prompter.Nodes.WHY.completed){
            mirrorAncestorsToMove.push(mirrorNodeAncestors[j]);
            var parentChildren = mirrorNodeAncestors[j].getParentNode().getChildren();
            for(var k=0;k<parentChildren.length;k++){
              if(parentChildren[k].id!=mirrorNodeAncestors[j].id) Mindmeister.removeIdea(Scrap.mapID,parentChildren[k].id,cL);
            }
          }
          else{
            mirrorAncestorsToRemove.push(mirrorNodeAncestors[j]);
          }
        }
      }
    }
    var descendants = node.getChildren();
    var descendantsToMove = [];
    for(var i=0;i<descendants.length;i++){
      if((operation=="zoomOut"&&descendants[i].getContent()==Prompter.Nodes.WHAT_FOLLOWS_FROM.completed)||(operation=="zoomIn"&&descendants[i].getContent()==Prompter.Nodes.WHY.completed)){
        descendantsToMove = descendants[i].getChildren();
        break;
      }
    }

    var destinationNodeId;
    if(operation=="zoomOut") destinationNodeId = Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.id;
    else if(operation=="zoomIn") destinationNodeId = Nodes.templateNodes.ASCERTAIN_CAUSES.id;
    for(var i=0;i<descendantsToMove.length;i++){
      Mindmeister.moveNode(Scrap.mapID,descendantsToMove[i].id,destinationNodeId,cL);
    }

    //promiseList.push(Mindmeister.removeIdea(mapID,nodeId));

    var mirrorNode = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(newProblemStatement));
    if(mirrorNode!=null&&mirrorNode.length>0){
      var mirrorDescendants = mirrorNode[0].getChildren();
      var mirrorDescendantsToMove = [];
      for(var i=0;i<mirrorDescendants.length;i++){
        if((operation=="zoomOut"&&mirrorDescendants[i].getContent()==Prompter.Nodes.WHAT_FOLLOWS_FROM.completed)||(operation=="zoomIn"&&mirrorDescendants[i].getContent()==Prompter.Nodes.WHY.completed)){
          mirrorDescendantsToMove = mirrorDescendants[i].getChildren();
          break;
        }
      }

      var mirrorDestinationNodeId;
      if(operation=="zoomOut") mirrorDestinationNodeId = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.id;
      else if(operation=="zoomIn") mirrorDestinationNodeId = Nodes.templateNodes.LESSEN_CAUSES.id;
      for(var i=0;i<mirrorDescendantsToMove.length;i++){
        Mindmeister.moveNode(Scrap.mapID,mirrorDescendantsToMove[i].id,mirrorDestinationNodeId,cL);
      }
      Mindmeister.removeIdea(Scrap.mapID,mirrorNode[0].id,cL);
    }
    //

    var ancestorInsertionPoint;
    var lagInsertionPoint;
    var auxTitle;

    var mirrorAncestorInsertionPoint;
    var lagMirrorAncestorInsertionPoint;
    var oldProblemStatementNodeId;

    if(operation=="zoomIn"){
      ancestorInsertionPoint = Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.id;
      lagInsertionPoint = Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.id;
      auxTitle = Prompter.Nodes.WHAT_FOLLOWS_FROM.completed;
      mirrorAncestorInsertionPoint = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.id;
      lagMirrorAncestorInsertionPoint = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.id;
    }
    else if(operation=="zoomOut"){
      ancestorInsertionPoint = Nodes.templateNodes.ASCERTAIN_CAUSES.id;
      lagInsertionPoint = Nodes.templateNodes.ASCERTAIN_CAUSES.id;
      auxTitle = Prompter.Nodes.WHY.completed;
      mirrorAncestorInsertionPoint = Nodes.templateNodes.LESSEN_CAUSES.id;
      lagMirrorAncestorInsertionPoint = Nodes.templateNodes.LESSEN_CAUSES.id;
    }

    for(var i=0;i<ancestorsToMove.length;i++){
      Mindmeister.moveNode(Scrap.mapID,ancestorsToMove[i].id,ancestorInsertionPoint,cL);
      ancestorInsertionPoint = Mindmeister.insertIdea(Scrap.mapID,ancestorsToMove[i].id,{title:auxTitle,style:NODE_STYLES.template},cL);
      /*var changeElem = {"idea_id":ancestorsToMove[i].id,"type":"Move","new_data":{"parent":ancestorInsertionPoint,"rank":0}};
      AUX_CHANGELIST.push(changeElem);
      MAP_CHANGE_LIST.push(changeElem);*/
      /*var changeElemTask = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":ancestorsToMove[i].id,"id":NODE_ID_LAG,"title":auxTitle,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
      CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
      AUX_CHANGELIST.push(changeElemTask);
      MAP_CHANGE_LIST.push(changeElemTask);
      ancestorInsertionPoint = NODE_ID_LAG;
      NODE_ID_LAG--;
      CHANGE_ID++;*/
    }
    oldProblemStatementNodeId = Mindmeister.insertIdea(Scrap.mapID,ancestorInsertionPoint,{title:oldProblemStatement},cL);
    /*var changeElem = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":ancestorInsertionPoint,"id":NODE_ID_LAG,"title":oldProblemStatement},"id":CHANGE_ID};
    CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
    AUX_CHANGELIST.push(changeElem);
    MAP_CHANGE_LIST.push(changeElem);
    oldProblemStatementNodeId = NODE_ID_LAG;
    NODE_ID_LAG--;
    CHANGE_ID++;*/

    var auxText;
    if(operation=="zoomIn"){
      auxText = Prompter.Nodes.WHAT_FOLLOWS_FROM.completed;
    }
    else if(operation=="zoomOut"){
      auxText = Prompter.Nodes.WHY.completed;
    }
    var lagId = Mindmeister.insertIdea(Scrap.mapID,oldProblemStatementNodeId,{title:auxText,style:NODE_STYLES.template},cL);
    /*var changeElem = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":NODE_ID_LAG+1,"id":NODE_ID_LAG,"title":auxText,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
    CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
    AUX_CHANGELIST.push(changeElem);
    MAP_CHANGE_LIST.push(changeElem);*/

    var firstLevelChilds = Scrap.getNodeById(lagInsertionPoint).getChildren();
    for(var i=0;i<firstLevelChilds.length;i++){
      Mindmeister.moveNode(Scrap.mapID,firstLevelChilds[i].id,lagId,cL);
      /*
      var changeElem = {"idea_id":firstLevelChilds[i].id,"type":"Move","new_data":{"parent":NODE_ID_LAG,"rank":0}};
      AUX_CHANGELIST.push(changeElem);
      MAP_CHANGE_LIST.push(changeElem);
      */
    }

    /*
    NODE_ID_LAG--;
    CHANGE_ID++;
    */
    //
    for(var i=0;i<mirrorAncestorsToMove.length;i++){
      Mindmeister.moveNode(Scrap.mapID,mirrorAncestorsToMove[i].id,mirrorAncestorInsertionPoint,cL);
      /*var changeElem = {"idea_id":mirrorAncestorsToMove[i].id,"type":"Move","new_data":{"parent":mirrorAncestorInsertionPoint,"rank":0}};
      AUX_CHANGELIST.push(changeElem);
      MAP_CHANGE_LIST.push(changeElem);*/
      mirrorAncestorInsertionPoint = Mindmeister.insertIdea(Scrap.mapID,mirrorAncestorsToMove[i].id,{title:auxTitle,style:NODE_STYLES.template},cL);
      /*var changeElemTask = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":mirrorAncestorsToMove[i].id,"id":NODE_ID_LAG,"title":auxTitle,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
      CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
      AUX_CHANGELIST.push(changeElemTask);
      MAP_CHANGE_LIST.push(changeElemTask);
      mirrorAncestorInsertionPoint = NODE_ID_LAG;
      NODE_ID_LAG--;
      CHANGE_ID++;*/
    }
    var oldProblemStatementReversed = DScaffolding.invertPoles(oldProblemStatement);
    var lagId = Mindmeister.insertIdea(Scrap.mapID,mirrorAncestorInsertionPoint,{title:oldProblemStatementReversed,style:NODE_STYLES.template/*,link:"topic:"+oldProblemStatementNodeId*/},cL);
    /*var changeElem = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":mirrorAncestorInsertionPoint,"id":NODE_ID_LAG,"title":oldProblemStatementReversed,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
    CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
    AUX_CHANGELIST.push(changeElem);
    MAP_CHANGE_LIST.push(changeElem);
    LINKING_LIST.push({"idea_id":NODE_ID_LAG,"link":oldProblemStatementNodeId});
    NODE_ID_LAG--;
    CHANGE_ID++;*/

    var auxText;
    if(operation=="zoomIn"){
      auxText = Prompter.Nodes.WHAT_FOLLOWS_FROM.completed;
    }
    else if(operation=="zoomOut"){
      auxText = Prompter.Nodes.WHY.completed;
    }
    lagId = Mindmeister.insertIdea(Scrap.mapID,lagId,{title:auxText,style:NODE_STYLES.template},cL);
    /*var changeElem = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":NODE_ID_LAG+1,"id":NODE_ID_LAG,"title":auxText,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
    CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
    AUX_CHANGELIST.push(changeElem);
    MAP_CHANGE_LIST.push(changeElem);*/

    var firstLevelChilds = Scrap.getNodeById(lagMirrorAncestorInsertionPoint).getChildren();
    for(var i=0;i<firstLevelChilds.length;i++){
      Mindmeister.moveNode(Scrap.mapID,firstLevelChilds[i].id,lagId,cL);
      /*var changeElem = {"idea_id":firstLevelChilds[i].id,"type":"Move","new_data":{"parent":NODE_ID_LAG,"rank":0}};
      AUX_CHANGELIST.push(changeElem);
      MAP_CHANGE_LIST.push(changeElem);*/
    }
    //

    /*var p2 = new Promise(function (resolve,reject){
      Mindmeister.doChanges(AUX_CHANGELIST).then(function(ret){
        var nodesToChange = ret.responses;
        replaceNodeIdsBis(nodesToChange);
        updateLinkings().then(function(){
          resolve();
        })
      })
    })
    promiseList.push(p2);*/

    // TO TEST - HERE?
    var designTheoryNodeChildren = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildren();
    for(var i=0;i<designTheoryNodeChildren.length;i++){
      Mindmeister.removeIdea(Scrap.mapID,designTheoryNodeChildren[i].id,cL);
    }



    for(var i=0;i<ancestorsToRemove.length;i++){
      Mindmeister.removeIdea(Scrap.mapID,ancestorsToRemove[i].id,cL);
    }
    for(var i=0;i<mirrorAncestorsToRemove.length;i++){
      Mindmeister.removeIdea(Scrap.mapID,mirrorAncestorsToRemove[i].id,cL);
    }

    var nodeChildren = node.getChildren();
    for(var i=0;i<nodeChildren.length;i++){
      if(nodeChildren[i].getContent()==Prompter.Nodes.WHAT_FOLLOWS_FROM.completed||nodeChildren[i].getContent()==Prompter.Nodes.WHAT_FOLLOWS_FROM.text) Mindmeister.removeIdea(Scrap.mapID,nodeChildren[i].id,cL);
      if(nodeChildren[i].getContent()==Prompter.Nodes.WHY.completed||nodeChildren[i].getContent()==Prompter.Nodes.WHY.text) Mindmeister.removeIdea(Scrap.mapID,nodeChildren[i].id,cL);
    }


    Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
      SYNCING_DESIGN_THEORY = true;

      if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId,false);
      else Scrap.hideWorkingMessage();

      setTimeout(function(){
        DScaffolding.reloadDesignTheory();
      },3000);
    })
  }
  var setAsProblemStatementDragExplicateProblemNew = function(node,oldParentNode){
    Scrap.showWorkingMessage();
    var cL = new Mindmeister.ChangeList();

    var newProblemStatementNode = node;
    var nodeId = node.id;
    var newProblemStatement = newProblemStatementNode.getContent();

    var aux = NodesNew.templateNodes.SET_PROBLEM_STATEMENT.getChildren();
    // TODO
    var oldProblemStatement = "Old problem statement";
    if(aux!=null&&aux.length>0){
      if(aux[0].getContent() == newProblemStatement && aux.length > 1) oldProblemStatement = aux[1].getContent();
      //else if(aux.length>1) oldProblemStatement = aux[0].getContent(); // ONLY THE FIRST CHILD BY THE MOMENT
      for(var i=0;i<aux.length;i++){
        if(aux[i].getContent() != newProblemStatement){
          oldProblemStatement = aux[i].getContent();
          Mindmeister.removeIdea(Scrap.mapID,aux[i].id,cL);
        }
      }
    }

    var parentNode = oldParentNode;
    var oldParentNodeId = oldParentNode.id;
    var siblings = parentNode.getChildren();
    for(var i=0;i<siblings.length;i++){
      //if(siblings[i].id!=nodeId){
      Mindmeister.removeIdea(Scrap.mapID,siblings[i].id,cL);
      //}
    }

    var operation;
    var ancestors = [parentNode].concat(parentNode.getAncestors());
    var ancestorsToMove = [];
    var ancestorsToRemove = [];

    var mirrorAncestorsToMove = [];
    var mirrorAncestorsToRemove = [];

    if(parentNode.isDescendant(NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES)||NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES.id==oldParentNodeId){
      operation = "zoomOut";
      for(var i=0;i<ancestors.length;i++){
        var ancestorContent = ancestors[i].getContent();
        if(ancestorContent==NodesNew.templateNodesText.ASCERTAIN_CONSEQUENCES) break;
        if(ancestorContent!=PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed){
          ancestorsToMove.push(ancestors[i]);
          var parentChildren = ancestors[i].getParentNode().getChildren();
          for(var j=0;j<parentChildren.length;j++){
            if(parentChildren[j].id!=ancestors[i].id) Mindmeister.removeIdea(Scrap.mapID,parentChildren[j].id,cL);
          }
        }
        else{
          ancestorsToRemove.push(ancestors[i]);
        }
      }
      var mirrorNode = NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(DScaffolding.invertPoles(newProblemStatement));
      if(mirrorNode!=null&&mirrorNode.length>0){
        var mirrorNodeAncestors = mirrorNode[0].getAncestors();
        for(var j=0;j<mirrorNodeAncestors.length;j++){
          var mirrorAncestorContent = mirrorNodeAncestors[j].getContent();
          if(mirrorAncestorContent==NodesNew.templateNodesText.ALLEVIATE_CONSEQUENCES) break;
          if(mirrorAncestorContent!=PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed){
            mirrorAncestorsToMove.push(mirrorNodeAncestors[j]);
            var parentChildren = mirrorNodeAncestors[j].getParentNode().getChildren();
            for(var k=0;k<parentChildren.length;k++){
              if(parentChildren[k].id!=mirrorNodeAncestors[j].id) Mindmeister.removeIdea(Scrap.mapID,parentChildren[k].id,cL);
            }
          }
          else{
            mirrorAncestorsToRemove.push(mirrorNodeAncestors[j]);
          }
        }
      }
    }
    else if(parentNode.isDescendant(NodesNew.templateNodes.ASCERTAIN_CAUSES)||NodesNew.templateNodes.ASCERTAIN_CAUSES.id==oldParentNodeId){
      operation = "zoomIn";
      for(var i=0;i<ancestors.length;i++){
        var ancestorContent = ancestors[i].getContent();
        if(ancestorContent==NodesNew.templateNodesText.ASCERTAIN_CAUSES) break;
        if(ancestorContent!=PrompterNew.Nodes.WHY.completed){
          ancestorsToMove.push(ancestors[i]);
          var parentChildren = ancestors[i].getParentNode().getChildren();
          for(var j=0;j<parentChildren.length;j++){
            if(parentChildren[j].id!=ancestors[i].id) Mindmeister.removeIdea(Scrap.mapID,parentChildren[j].id,cL);
          }
        }
        else{
          ancestorsToRemove.push(ancestors[i]);
        }
      }
      var mirrorNode = NodesNew.templateNodes.LESSEN_CAUSES.getChildrenWithText(DScaffolding.invertPoles(newProblemStatement));
      if(mirrorNode!=null&&mirrorNode.length>0){
        var mirrorNodeAncestors = mirrorNode[0].getAncestors();
        for(var j=0;j<mirrorNodeAncestors.length;j++){
          var mirrorAncestorContent = mirrorNodeAncestors[j].getContent();
          if(mirrorAncestorContent==NodesNew.templateNodesText.LESSEN_CAUSES) break;
          if(mirrorAncestorContent!=PrompterNew.Nodes.WHY.completed){
            mirrorAncestorsToMove.push(mirrorNodeAncestors[j]);
            var parentChildren = mirrorNodeAncestors[j].getParentNode().getChildren();
            for(var k=0;k<parentChildren.length;k++){
              if(parentChildren[k].id!=mirrorNodeAncestors[j].id) Mindmeister.removeIdea(Scrap.mapID,parentChildren[k].id,cL);
            }
          }
          else{
            mirrorAncestorsToRemove.push(mirrorNodeAncestors[j]);
          }
        }
      }
    }
    var descendants = node.getChildren();
    var descendantsToMove = [];
    for(var i=0;i<descendants.length;i++){
      if((operation=="zoomOut"&&descendants[i].getContent()==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed)||(operation=="zoomIn"&&descendants[i].getContent()==PrompterNew.Nodes.WHY.completed)){
        descendantsToMove = descendants[i].getChildren();
        break;
      }
    }

    var destinationNodeId;
    if(operation=="zoomOut") destinationNodeId = NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES.id;
    else if(operation=="zoomIn") destinationNodeId = NodesNew.templateNodes.ASCERTAIN_CAUSES.id;
    for(var i=0;i<descendantsToMove.length;i++){
      Mindmeister.moveNode(Scrap.mapID,descendantsToMove[i].id,destinationNodeId,cL);
    }

    //promiseList.push(Mindmeister.removeIdea(mapID,nodeId));

    var mirrorNode = NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(newProblemStatement));
    if(mirrorNode!=null&&mirrorNode.length>0){
      var mirrorDescendants = mirrorNode[0].getChildren();
      var mirrorDescendantsToMove = [];
      for(var i=0;i<mirrorDescendants.length;i++){
        if((operation=="zoomOut"&&mirrorDescendants[i].getContent()==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed)||(operation=="zoomIn"&&mirrorDescendants[i].getContent()==PrompterNew.Nodes.WHY.completed)){
          mirrorDescendantsToMove = mirrorDescendants[i].getChildren();
          break;
        }
      }

      var mirrorDestinationNodeId;
      if(operation=="zoomOut") mirrorDestinationNodeId = NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.id;
      else if(operation=="zoomIn") mirrorDestinationNodeId = NodesNew.templateNodes.LESSEN_CAUSES.id;
      for(var i=0;i<mirrorDescendantsToMove.length;i++){
        Mindmeister.moveNode(Scrap.mapID,mirrorDescendantsToMove[i].id,mirrorDestinationNodeId,cL);
      }
      Mindmeister.removeIdea(Scrap.mapID,mirrorNode[0].id,cL);
    }
    //

    var ancestorInsertionPoint;
    var lagInsertionPoint;
    var auxTitle;

    var mirrorAncestorInsertionPoint;
    var lagMirrorAncestorInsertionPoint;
    var oldProblemStatementNodeId;

    if(operation=="zoomIn"){
      ancestorInsertionPoint = NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES.id;
      lagInsertionPoint = NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES.id;
      auxTitle = PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed;
      mirrorAncestorInsertionPoint = NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.id;
      lagMirrorAncestorInsertionPoint = NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.id;
    }
    else if(operation=="zoomOut"){
      ancestorInsertionPoint = NodesNew.templateNodes.ASCERTAIN_CAUSES.id;
      lagInsertionPoint = NodesNew.templateNodes.ASCERTAIN_CAUSES.id;
      auxTitle = PrompterNew.Nodes.WHY.completed;
      mirrorAncestorInsertionPoint = NodesNew.templateNodes.LESSEN_CAUSES.id;
      lagMirrorAncestorInsertionPoint = NodesNew.templateNodes.LESSEN_CAUSES.id;
    }

    for(var i=0;i<ancestorsToMove.length;i++){
      Mindmeister.moveNode(Scrap.mapID,ancestorsToMove[i].id,ancestorInsertionPoint,cL);
      ancestorInsertionPoint = Mindmeister.insertIdea(Scrap.mapID,ancestorsToMove[i].id,{title:auxTitle,style:NODE_STYLES.template},cL);
      /*var changeElem = {"idea_id":ancestorsToMove[i].id,"type":"Move","new_data":{"parent":ancestorInsertionPoint,"rank":0}};
      AUX_CHANGELIST.push(changeElem);
      MAP_CHANGE_LIST.push(changeElem);*/
      /*var changeElemTask = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":ancestorsToMove[i].id,"id":NODE_ID_LAG,"title":auxTitle,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
      CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
      AUX_CHANGELIST.push(changeElemTask);
      MAP_CHANGE_LIST.push(changeElemTask);
      ancestorInsertionPoint = NODE_ID_LAG;
      NODE_ID_LAG--;
      CHANGE_ID++;*/
    }
    oldProblemStatementNodeId = Mindmeister.insertIdea(Scrap.mapID,ancestorInsertionPoint,{title:oldProblemStatement},cL);
    /*var changeElem = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":ancestorInsertionPoint,"id":NODE_ID_LAG,"title":oldProblemStatement},"id":CHANGE_ID};
    CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
    AUX_CHANGELIST.push(changeElem);
    MAP_CHANGE_LIST.push(changeElem);
    oldProblemStatementNodeId = NODE_ID_LAG;
    NODE_ID_LAG--;
    CHANGE_ID++;*/

    var auxText;
    if(operation=="zoomIn"){
      auxText = PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed;
    }
    else if(operation=="zoomOut"){
      auxText = PrompterNew.Nodes.WHY.completed;
    }
    var lagId0 = Mindmeister.insertIdea(Scrap.mapID,oldProblemStatementNodeId,{title:auxText,style:NODE_STYLES.template},cL);
    /*var changeElem = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":NODE_ID_LAG+1,"id":NODE_ID_LAG,"title":auxText,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
    CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
    AUX_CHANGELIST.push(changeElem);
    MAP_CHANGE_LIST.push(changeElem);*/

    var firstLevelChilds = Scrap.getNodeById(lagInsertionPoint).getChildren();
    for(var i=0;i<firstLevelChilds.length;i++){
      Mindmeister.moveNode(Scrap.mapID,firstLevelChilds[i].id,lagId0,cL);
      /*
      var changeElem = {"idea_id":firstLevelChilds[i].id,"type":"Move","new_data":{"parent":NODE_ID_LAG,"rank":0}};
      AUX_CHANGELIST.push(changeElem);
      MAP_CHANGE_LIST.push(changeElem);
      */
    }
    /*
    NODE_ID_LAG--;
    CHANGE_ID++;
    */
    //
    for(var i=0;i<mirrorAncestorsToMove.length;i++){
      Mindmeister.moveNode(Scrap.mapID,mirrorAncestorsToMove[i].id,mirrorAncestorInsertionPoint,cL);
      /*var changeElem = {"idea_id":mirrorAncestorsToMove[i].id,"type":"Move","new_data":{"parent":mirrorAncestorInsertionPoint,"rank":0}};
      AUX_CHANGELIST.push(changeElem);
      MAP_CHANGE_LIST.push(changeElem);*/
      mirrorAncestorInsertionPoint = Mindmeister.insertIdea(Scrap.mapID,mirrorAncestorsToMove[i].id,{title:auxTitle,style:NODE_STYLES.template},cL);
      /*var changeElemTask = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":mirrorAncestorsToMove[i].id,"id":NODE_ID_LAG,"title":auxTitle,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
      CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
      AUX_CHANGELIST.push(changeElemTask);
      MAP_CHANGE_LIST.push(changeElemTask);
      mirrorAncestorInsertionPoint = NODE_ID_LAG;
      NODE_ID_LAG--;
      CHANGE_ID++;*/
    }
    var oldProblemStatementReversed = DScaffolding.invertPoles(oldProblemStatement);
    var lagId1 = Mindmeister.insertIdea(Scrap.mapID,mirrorAncestorInsertionPoint,{title:oldProblemStatementReversed,style:NODE_STYLES.template/*,link:"topic:"+oldProblemStatementNodeId*/},cL);
    /*var changeElem = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":mirrorAncestorInsertionPoint,"id":NODE_ID_LAG,"title":oldProblemStatementReversed,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
    CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
    AUX_CHANGELIST.push(changeElem);
    MAP_CHANGE_LIST.push(changeElem);
    LINKING_LIST.push({"idea_id":NODE_ID_LAG,"link":oldProblemStatementNodeId});
    NODE_ID_LAG--;
    CHANGE_ID++;*/

    var auxText;
    if(operation=="zoomIn"){
      auxText = PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed;
    }
    else if(operation=="zoomOut"){
      auxText = PrompterNew.Nodes.WHY.completed;
    }
    var lagId = Mindmeister.insertIdea(Scrap.mapID,lagId1,{title:auxText,style:NODE_STYLES.template},cL);
    /*var changeElem = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":NODE_ID_LAG+1,"id":NODE_ID_LAG,"title":auxText,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
    CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
    AUX_CHANGELIST.push(changeElem);
    MAP_CHANGE_LIST.push(changeElem);*/

    var firstLevelChilds = Scrap.getNodeById(lagMirrorAncestorInsertionPoint).getChildren();
    for(var i=0;i<firstLevelChilds.length;i++){
      Mindmeister.moveNode(Scrap.mapID,firstLevelChilds[i].id,lagId,cL);
      /*var changeElem = {"idea_id":firstLevelChilds[i].id,"type":"Move","new_data":{"parent":NODE_ID_LAG,"rank":0}};
      AUX_CHANGELIST.push(changeElem);
      MAP_CHANGE_LIST.push(changeElem);*/
    }
    //

    /*var p2 = new Promise(function (resolve,reject){
      Mindmeister.doChanges(AUX_CHANGELIST).then(function(ret){
        var nodesToChange = ret.responses;
        replaceNodeIdsBis(nodesToChange);
        updateLinkings().then(function(){
          resolve();
        })
      })
    })
    promiseList.push(p2);*/

    // TO TEST - HERE?

    for(var i=0;i<ancestorsToRemove.length;i++){
      Mindmeister.removeIdea(Scrap.mapID,ancestorsToRemove[i].id,cL);
    }
    for(var i=0;i<mirrorAncestorsToRemove.length;i++){
      Mindmeister.removeIdea(Scrap.mapID,mirrorAncestorsToRemove[i].id,cL);
    }

    var nodeChildren = node.getChildren();
    for(var i=0;i<nodeChildren.length;i++){
      if(nodeChildren[i].getContent()==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed||nodeChildren[i].getContent()==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text) Mindmeister.removeIdea(Scrap.mapID,nodeChildren[i].id,cL);
      if(nodeChildren[i].getContent()==PrompterNew.Nodes.WHY.completed||nodeChildren[i].getContent()==PrompterNew.Nodes.WHY.text) Mindmeister.removeIdea(Scrap.mapID,nodeChildren[i].id,cL);
    }


    Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
      if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
      else Scrap.hideWorkingMessage();
    })
  }
  var setAsProblemStatementDragExplicateProblem = function(node,oldParentNode){
    Scrap.showWorkingMessage();
    var cL = new Mindmeister.ChangeList();

    var newProblemStatementNode = node;
    var nodeId = node.id;
    var newProblemStatement = newProblemStatementNode.getContent();

    var aux = Nodes.templateNodes.SET_PROBLEM_STATEMENT.getChildren();
    // TODO
    var oldProblemStatement = "Old problem statement";
    if(aux!=null&&aux.length>0){
      if(aux[0].getContent() == newProblemStatement && aux.length > 1) oldProblemStatement = aux[1].getContent();
      //else if(aux.length>1) oldProblemStatement = aux[0].getContent(); // ONLY THE FIRST CHILD BY THE MOMENT
      for(var i=0;i<aux.length;i++){
        if(aux[i].getContent() != newProblemStatement){
          oldProblemStatement = aux[i].getContent();
          Mindmeister.removeIdea(Scrap.mapID,aux[i].id,cL);
        }
      }
    }

    var parentNode = oldParentNode;
    var oldParentNodeId = oldParentNode.id;
    var siblings = parentNode.getChildren();
    for(var i=0;i<siblings.length;i++){
      //if(siblings[i].id!=nodeId){
        Mindmeister.removeIdea(Scrap.mapID,siblings[i].id,cL);
      //}
    }

    var operation;
    var ancestors = [parentNode].concat(parentNode.getAncestors());
    var ancestorsToMove = [];
    var ancestorsToRemove = [];

    var mirrorAncestorsToMove = [];
    var mirrorAncestorsToRemove = [];

    if(parentNode.isDescendant(Nodes.templateNodes.ASCERTAIN_CONSEQUENCES)||Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.id==oldParentNodeId){
      operation = "zoomOut";
      for(var i=0;i<ancestors.length;i++){
        var ancestorContent = ancestors[i].getContent();
        if(ancestorContent==Nodes.templateNodesText.ASCERTAIN_CONSEQUENCES) break;
        if(ancestorContent!=Prompter.Nodes.WHAT_FOLLOWS_FROM.completed){
          ancestorsToMove.push(ancestors[i]);
          var parentChildren = ancestors[i].getParentNode().getChildren();
          for(var j=0;j<parentChildren.length;j++){
            if(parentChildren[j].id!=ancestors[i].id) Mindmeister.removeIdea(Scrap.mapID,parentChildren[j].id,cL);
          }
        }
        else{
          ancestorsToRemove.push(ancestors[i]);
        }
      }
      var mirrorNode = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(DScaffolding.invertPoles(newProblemStatement));
      if(mirrorNode!=null&&mirrorNode.length>0){
        var mirrorNodeAncestors = mirrorNode[0].getAncestors();
        for(var j=0;j<mirrorNodeAncestors.length;j++){
          var mirrorAncestorContent = mirrorNodeAncestors[j].getContent();
          if(mirrorAncestorContent==Nodes.templateNodesText.ALLEVIATE_CONSEQUENCES) break;
          if(mirrorAncestorContent!=Prompter.Nodes.WHAT_FOLLOWS_FROM.completed){
            mirrorAncestorsToMove.push(mirrorNodeAncestors[j]);
            var parentChildren = mirrorNodeAncestors[j].getParentNode().getChildren();
            for(var k=0;k<parentChildren.length;k++){
              if(parentChildren[k].id!=mirrorNodeAncestors[j].id) Mindmeister.removeIdea(Scrap.mapID,parentChildren[k].id,cL);
            }
          }
          else{
            mirrorAncestorsToRemove.push(mirrorNodeAncestors[j]);
          }
        }
      }
    }
    else if(parentNode.isDescendant(Nodes.templateNodes.ASCERTAIN_CAUSES)||Nodes.templateNodes.ASCERTAIN_CAUSES.id==oldParentNodeId){
      operation = "zoomIn";
      for(var i=0;i<ancestors.length;i++){
        var ancestorContent = ancestors[i].getContent();
        if(ancestorContent==Nodes.templateNodesText.ASCERTAIN_CAUSES) break;
        if(ancestorContent!=Prompter.Nodes.WHY.completed){
          ancestorsToMove.push(ancestors[i]);
          var parentChildren = ancestors[i].getParentNode().getChildren();
          for(var j=0;j<parentChildren.length;j++){
            if(parentChildren[j].id!=ancestors[i].id) Mindmeister.removeIdea(Scrap.mapID,parentChildren[j].id,cL);
          }
        }
        else{
          ancestorsToRemove.push(ancestors[i]);
        }
      }
      var mirrorNode = Nodes.templateNodes.LESSEN_CAUSES.getChildrenWithText(DScaffolding.invertPoles(newProblemStatement));
      if(mirrorNode!=null&&mirrorNode.length>0){
        var mirrorNodeAncestors = mirrorNode[0].getAncestors();
        for(var j=0;j<mirrorNodeAncestors.length;j++){
          var mirrorAncestorContent = mirrorNodeAncestors[j].getContent();
          if(mirrorAncestorContent==Nodes.templateNodesText.LESSEN_CAUSES) break;
          if(mirrorAncestorContent!=Prompter.Nodes.WHY.completed){
            mirrorAncestorsToMove.push(mirrorNodeAncestors[j]);
            var parentChildren = mirrorNodeAncestors[j].getParentNode().getChildren();
            for(var k=0;k<parentChildren.length;k++){
              if(parentChildren[k].id!=mirrorNodeAncestors[j].id) Mindmeister.removeIdea(Scrap.mapID,parentChildren[k].id,cL);
            }
          }
          else{
            mirrorAncestorsToRemove.push(mirrorNodeAncestors[j]);
          }
        }
      }
    }
    var descendants = node.getChildren();
    var descendantsToMove = [];
    for(var i=0;i<descendants.length;i++){
      if((operation=="zoomOut"&&descendants[i].getContent()==Prompter.Nodes.WHAT_FOLLOWS_FROM.completed)||(operation=="zoomIn"&&descendants[i].getContent()==Prompter.Nodes.WHY.completed)){
        descendantsToMove = descendants[i].getChildren();
        break;
      }
    }

    var destinationNodeId;
    if(operation=="zoomOut") destinationNodeId = Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.id;
    else if(operation=="zoomIn") destinationNodeId = Nodes.templateNodes.ASCERTAIN_CAUSES.id;
    for(var i=0;i<descendantsToMove.length;i++){
      Mindmeister.moveNode(Scrap.mapID,descendantsToMove[i].id,destinationNodeId,cL);
    }

    //promiseList.push(Mindmeister.removeIdea(mapID,nodeId));

    var mirrorNode = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(newProblemStatement));
    if(mirrorNode!=null&&mirrorNode.length>0){
      var mirrorDescendants = mirrorNode[0].getChildren();
      var mirrorDescendantsToMove = [];
      for(var i=0;i<mirrorDescendants.length;i++){
        if((operation=="zoomOut"&&mirrorDescendants[i].getContent()==Prompter.Nodes.WHAT_FOLLOWS_FROM.completed)||(operation=="zoomIn"&&mirrorDescendants[i].getContent()==Prompter.Nodes.WHY.completed)){
          mirrorDescendantsToMove = mirrorDescendants[i].getChildren();
          break;
        }
      }

      var mirrorDestinationNodeId;
      if(operation=="zoomOut") mirrorDestinationNodeId = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.id;
      else if(operation=="zoomIn") mirrorDestinationNodeId = Nodes.templateNodes.LESSEN_CAUSES.id;
      for(var i=0;i<mirrorDescendantsToMove.length;i++){
        Mindmeister.moveNode(Scrap.mapID,mirrorDescendantsToMove[i].id,mirrorDestinationNodeId,cL);
      }
      Mindmeister.removeIdea(Scrap.mapID,mirrorNode[0].id,cL);
    }
    //

    var ancestorInsertionPoint;
    var lagInsertionPoint;
    var auxTitle;

    var mirrorAncestorInsertionPoint;
    var lagMirrorAncestorInsertionPoint;
    var oldProblemStatementNodeId;

    if(operation=="zoomIn"){
      ancestorInsertionPoint = Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.id;
      lagInsertionPoint = Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.id;
      auxTitle = Prompter.Nodes.WHAT_FOLLOWS_FROM.completed;
      mirrorAncestorInsertionPoint = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.id;
      lagMirrorAncestorInsertionPoint = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.id;
    }
    else if(operation=="zoomOut"){
      ancestorInsertionPoint = Nodes.templateNodes.ASCERTAIN_CAUSES.id;
      lagInsertionPoint = Nodes.templateNodes.ASCERTAIN_CAUSES.id;
      auxTitle = Prompter.Nodes.WHY.completed;
      mirrorAncestorInsertionPoint = Nodes.templateNodes.LESSEN_CAUSES.id;
      lagMirrorAncestorInsertionPoint = Nodes.templateNodes.LESSEN_CAUSES.id;
    }

    for(var i=0;i<ancestorsToMove.length;i++){
      Mindmeister.moveNode(Scrap.mapID,ancestorsToMove[i].id,ancestorInsertionPoint,cL);
      ancestorInsertionPoint = Mindmeister.insertIdea(Scrap.mapID,ancestorsToMove[i].id,{title:auxTitle,style:NODE_STYLES.template},cL);
      /*var changeElem = {"idea_id":ancestorsToMove[i].id,"type":"Move","new_data":{"parent":ancestorInsertionPoint,"rank":0}};
      AUX_CHANGELIST.push(changeElem);
      MAP_CHANGE_LIST.push(changeElem);*/
      /*var changeElemTask = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":ancestorsToMove[i].id,"id":NODE_ID_LAG,"title":auxTitle,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
      CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
      AUX_CHANGELIST.push(changeElemTask);
      MAP_CHANGE_LIST.push(changeElemTask);
      ancestorInsertionPoint = NODE_ID_LAG;
      NODE_ID_LAG--;
      CHANGE_ID++;*/
    }
    oldProblemStatementNodeId = Mindmeister.insertIdea(Scrap.mapID,ancestorInsertionPoint,{title:oldProblemStatement},cL);
    /*var changeElem = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":ancestorInsertionPoint,"id":NODE_ID_LAG,"title":oldProblemStatement},"id":CHANGE_ID};
    CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
    AUX_CHANGELIST.push(changeElem);
    MAP_CHANGE_LIST.push(changeElem);
    oldProblemStatementNodeId = NODE_ID_LAG;
    NODE_ID_LAG--;
    CHANGE_ID++;*/

    var auxText;
    if(operation=="zoomIn"){
      auxText = Prompter.Nodes.WHAT_FOLLOWS_FROM.completed;
    }
    else if(operation=="zoomOut"){
      auxText = Prompter.Nodes.WHY.completed;
    }
    var lagId0 = Mindmeister.insertIdea(Scrap.mapID,oldProblemStatementNodeId,{title:auxText,style:NODE_STYLES.template},cL);
    /*var changeElem = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":NODE_ID_LAG+1,"id":NODE_ID_LAG,"title":auxText,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
    CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
    AUX_CHANGELIST.push(changeElem);
    MAP_CHANGE_LIST.push(changeElem);*/

    var firstLevelChilds = Scrap.getNodeById(lagInsertionPoint).getChildren();
    for(var i=0;i<firstLevelChilds.length;i++){
      Mindmeister.moveNode(Scrap.mapID,firstLevelChilds[i].id,lagId0,cL);
      /*
      var changeElem = {"idea_id":firstLevelChilds[i].id,"type":"Move","new_data":{"parent":NODE_ID_LAG,"rank":0}};
      AUX_CHANGELIST.push(changeElem);
      MAP_CHANGE_LIST.push(changeElem);
      */
    }
    /*
    NODE_ID_LAG--;
    CHANGE_ID++;
    */
    //
    for(var i=0;i<mirrorAncestorsToMove.length;i++){
      Mindmeister.moveNode(Scrap.mapID,mirrorAncestorsToMove[i].id,mirrorAncestorInsertionPoint,cL);
      /*var changeElem = {"idea_id":mirrorAncestorsToMove[i].id,"type":"Move","new_data":{"parent":mirrorAncestorInsertionPoint,"rank":0}};
      AUX_CHANGELIST.push(changeElem);
      MAP_CHANGE_LIST.push(changeElem);*/
      mirrorAncestorInsertionPoint = Mindmeister.insertIdea(Scrap.mapID,mirrorAncestorsToMove[i].id,{title:auxTitle,style:NODE_STYLES.template},cL);
      /*var changeElemTask = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":mirrorAncestorsToMove[i].id,"id":NODE_ID_LAG,"title":auxTitle,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
      CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
      AUX_CHANGELIST.push(changeElemTask);
      MAP_CHANGE_LIST.push(changeElemTask);
      mirrorAncestorInsertionPoint = NODE_ID_LAG;
      NODE_ID_LAG--;
      CHANGE_ID++;*/
    }
    var oldProblemStatementReversed = DScaffolding.invertPoles(oldProblemStatement);
    var lagId1 = Mindmeister.insertIdea(Scrap.mapID,mirrorAncestorInsertionPoint,{title:oldProblemStatementReversed,style:NODE_STYLES.template/*,link:"topic:"+oldProblemStatementNodeId*/},cL);
    /*var changeElem = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":mirrorAncestorInsertionPoint,"id":NODE_ID_LAG,"title":oldProblemStatementReversed,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
    CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
    AUX_CHANGELIST.push(changeElem);
    MAP_CHANGE_LIST.push(changeElem);
    LINKING_LIST.push({"idea_id":NODE_ID_LAG,"link":oldProblemStatementNodeId});
    NODE_ID_LAG--;
    CHANGE_ID++;*/

    var auxText;
    if(operation=="zoomIn"){
      auxText = Prompter.Nodes.WHAT_FOLLOWS_FROM.completed;
    }
    else if(operation=="zoomOut"){
      auxText = Prompter.Nodes.WHY.completed;
    }
    var lagId = Mindmeister.insertIdea(Scrap.mapID,lagId1,{title:auxText,style:NODE_STYLES.template},cL);
    /*var changeElem = {"type":"Insert","idea_id":NODE_ID_LAG,"new_data":{"parent":NODE_ID_LAG+1,"id":NODE_ID_LAG,"title":auxText,"style":TEMPLATE_BASE_STYLE},"id":CHANGE_ID};
    CHANGE_ID_MAPPING[CHANGE_ID]=NODE_ID_LAG;
    AUX_CHANGELIST.push(changeElem);
    MAP_CHANGE_LIST.push(changeElem);*/

    var firstLevelChilds = Scrap.getNodeById(lagMirrorAncestorInsertionPoint).getChildren();
    for(var i=0;i<firstLevelChilds.length;i++){
      Mindmeister.moveNode(Scrap.mapID,firstLevelChilds[i].id,lagId,cL);
      /*var changeElem = {"idea_id":firstLevelChilds[i].id,"type":"Move","new_data":{"parent":NODE_ID_LAG,"rank":0}};
      AUX_CHANGELIST.push(changeElem);
      MAP_CHANGE_LIST.push(changeElem);*/
    }
    //

    /*var p2 = new Promise(function (resolve,reject){
      Mindmeister.doChanges(AUX_CHANGELIST).then(function(ret){
        var nodesToChange = ret.responses;
        replaceNodeIdsBis(nodesToChange);
        updateLinkings().then(function(){
          resolve();
        })
      })
    })
    promiseList.push(p2);*/

    // TO TEST - HERE?

    for(var i=0;i<ancestorsToRemove.length;i++){
      Mindmeister.removeIdea(Scrap.mapID,ancestorsToRemove[i].id,cL);
    }
    for(var i=0;i<mirrorAncestorsToRemove.length;i++){
      Mindmeister.removeIdea(Scrap.mapID,mirrorAncestorsToRemove[i].id,cL);
    }

    var nodeChildren = node.getChildren();
    for(var i=0;i<nodeChildren.length;i++){
      if(nodeChildren[i].getContent()==Prompter.Nodes.WHAT_FOLLOWS_FROM.completed||nodeChildren[i].getContent()==Prompter.Nodes.WHAT_FOLLOWS_FROM.text) Mindmeister.removeIdea(Scrap.mapID,nodeChildren[i].id,cL);
      if(nodeChildren[i].getContent()==Prompter.Nodes.WHY.completed||nodeChildren[i].getContent()==Prompter.Nodes.WHY.text) Mindmeister.removeIdea(Scrap.mapID,nodeChildren[i].id,cL);
    }


    Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
      if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
      else Scrap.hideWorkingMessage();
    })
  }
  var setAsProblemStatementNew = function(nodeId){
    var node = Scrap.getNodeById(nodeId);
    Scrap.showWorkingMessage();
    var cL = new Mindmeister.ChangeList();
    Mindmeister.moveNode(Scrap.mapID,node.id,NodesNew.templateNodes.SET_PROBLEM_STATEMENT.id,cL);
    Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
      if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
      else Scrap.hideWorkingMessage();
    })
  }
  var setAsProblemStatement = function(nodeId){
    var node = Scrap.getNodeById(nodeId);
    Scrap.showWorkingMessage();
    var cL = new Mindmeister.ChangeList();
    Mindmeister.moveNode(Scrap.mapID,node.id,Nodes.templateNodes.SET_PROBLEM_STATEMENT.id,cL);
    Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
      if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
      else Scrap.hideWorkingMessage();
    })
  }
  var getAnnotations = function(){
    /*var supportingEvidencesNodes = Scrap.getNodesWithText("Supporting Evidences?");
    if(supportingEvidencesNodes!=null){
      for(var i=0;i<supportingEvidencesNodes.length;i++){
        var children = supportingEvidencesNodes[i].getChildren();
        if(children!=null&&children.length>0) annotations = annotations.concat(children);
      }
    }
    var whoElseAddressesNodes = Scrap.getNodesWithText("Who else addresses it?");
    if(whoElseAddressesNodes!=null){
      for(var i=0;i<whoElseAddressesNodes.length;i++){
        var children = whoElseAddressesNodes[i].getChildren();
        if(children!=null&&children.length>0) annotations = annotations.concat(children);
      }
    }*/
    // white nodes
    let wN = Scrap.getNodesByBackgroundColor({red: 255, blue: 255, green: 255}) || []
    // grey nodes
    let gN = Scrap.getNodesByBackgroundColor({red: 204, blue: 204, green: 204}) || []
    let annotations = wN.concat(gN)
    return annotations;
  }
  var existsSimilarAnnotation = function(annotationText){
    var annotations = DScaffolding.getAnnotations();
    var similarityThreshold = 0.8;
    for(var i=0;i<annotations.length;i++){
      if(Utils.similarity(annotationText,annotations[i].getContent()) > similarityThreshold){
        return true;
      }
    }
    return false;
  }
  var importProblemMap = function(problemMap,mapIdeas,changeList){
    var promiseList = [];
    var requirementsAchievingPurposeNode = Nodes.templateNodes.REQ_PURPOSE_BENEFITS;
    var requirementsReducingCauseNode = Nodes.templateNodes.REQ_REDUCE_CAUSES;
    var causeReloadNode = Scrap.getNodesWithSubText("Copy&Paste the causes to be alleviated onto the how nodes")[0];
    var nonFunctionalRequirementsNode = Nodes.templateNodes.NON_FUNCTIONAL_REQUIREMENTS;
    var designArtefactNodes = Scrap.getNodesWithSubText("Design Purposeful Artefact");

    var findMirrorNodes = function(nodeId,descendantOf){
      var mirror = [];

      var getNodeById = function(nodeId){
        return mapIdeas.find((el) => {return el.id==nodeId});
      }
      var isDescendantOf = function(nodeId,ancestorNodeId){
        var node = getNodeById(nodeId);
        if(node.parent==null) return false;
        else if(node.parent==ancestorNodeId) return true;
        else return isDescendantOf(node.parent,ancestorNodeId);
      }

      var aux = mapIdeas.filter((el) => {return el.link=="topic:"+nodeId});
      for(var i=0;i<aux.length;i++){
        if(isDescendantOf(aux[i].id,descendantOf)) mirror.push(aux[i]);
      }
      return mirror;
    }

    var syncProblemNode = function(node,ancestorNodeId,insert){
      var mirror = findMirrorNodes(node.id,ancestorNodeId);
      if(insert&&(mirror==null||mirror.length==0)){
        Mindmeister.insertIdea(Scrap.mapID,ancestorNodeId,{title:node.title,link:"topic:"+node.id,style:NODE_STYLES.template},changeList);
      }
      else if(mirror!=null&&mirror.length>0){
        for(var j=0;j<mirror.length;j++){
          if(mirror[j].title!=node.title){
            Mindmeister.modifyIdea(Scrap.mapID,mirror[j].id,{title:node.title},changeList);
          }
        }
      }
    }

    for(var i=0;i<problemMap.activeCauses.length;i++){
      syncProblemNode(problemMap.activeCauses[i],requirementsReducingCauseNode.id,true);
      syncProblemNode(problemMap.activeCauses[i],causeReloadNode.id,true);
      syncProblemNode(problemMap.activeCauses[i],nonFunctionalRequirementsNode.id,false);
    }
    for(var i=0;i<problemMap.activeConsequences.length;i++){
      syncProblemNode(problemMap.activeConsequences[i],requirementsAchievingPurposeNode.id,true);
    }
    for(var i=0;i<designArtefactNodes.length;i++){
      var intendedUsers = designArtefactNodes[i].getChildrenWithText("Intended user(s)");
      if(intendedUsers!=null&&intendedUsers.length>0){
        // only the first, for the moment
        for(var j=0;j<problemMap.stakeholders.length;j++){
          syncProblemNode(problemMap.stakeholders[j],intendedUsers[0].id,true);
        }
      }
    }

    var designTheoryNode = Nodes.templateNodes.FORMULATE_DESIGN_THEORY;
    var designTheoryChildren = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildren();
    for(var i=0;i<designTheoryChildren.length;i++){
      Mindmeister.removeIdea(Scrap.mapID,designTheoryChildren[i].id,changeList);
    }

    var isActive = function(node){
      if(node.active) return true;
      else if(node.children!=null&&node.children.length>0){
        for(var i=0;i<node.children.length;i++){
          if(isActive(node.children[i])) return true;
        }
      }
      return false;
    }

    var getActiveBranches = function(node,separator){
      if(!isActive(node)) return null;
      var n = {
        title: node.title,
        link: "topic:"+node.id,
        children: [],
        closed: false,
        style: NODE_STYLES.template
      }
      if(node.children==null||node.children.length==0){
        var functionalRequirementsNode = Nodes.templateNodes.FUNCTIONAL_REQUIREMENTS;
        var mirror = Nodes.templateNodes.FUNCTIONAL_REQUIREMENTS.getChildrenWithText(node.mirror.title);
        if(mirror==null||mirror.length==0) return n;
        for(var i=0;i<mirror.length;i++){
          var mirrorChildren = mirror[i].getChildren();
          for(var j=0;j<mirrorChildren.length;j++){
            if(mirrorChildren[j].getContent()=="How?"){
              var hows = mirrorChildren[j].getChildren();
              if(hows!=null&&hows.length>0){
                var aux = {
                  title: "This is tested out through the artefact's next features",
                  children: [],
                  style: NODE_STYLES.template
                }
                for(var k=0;k<hows.length;k++){
                  aux.children.push({
                    title: hows[k].getContent(),
                    link: "topic:"+hows[k].id,
                    style: NODE_STYLES.template
                  })
                }
                n.children.push(aux);
                break;
              }
            }
          }
        }
        return n;
      }
      else{
        var sep = {
          title: separator,
          children: [],
          closed: false,
          style: NODE_STYLES.template
        }
        for(var i=0;i<node.children.length;i++){
          var aux = getActiveBranches(node.children[i],separator);
          if(aux!=null)sep.children.push(aux);
        }
        n.children.push(sep);
        return n;
      }
    }

    var causeBranchParent = {
      title: "It is hypothesized that this problem leads to",
      children: [],
      closed: false,
      style: NODE_STYLES.template
    }
    var consBranchParent = {
      title: "It is hypothesized that this problem causes",
      children: [],
      closed: false,
      style: NODE_STYLES.template
    }
    for(var j=0;j<problemMap.causes.length;j++){
      var aux = getActiveBranches(problemMap.causes[j],Prompter.Nodes.WHY.completed);
      if(aux!=null)causeBranchParent.children.push(aux);
    }
    for(var j=0;j<problemMap.consequences.length;j++){
      var aux = getActiveBranches(problemMap.consequences[j],Prompter.Nodes.WHAT_FOLLOWS_FROM.completed)
      if(aux!=null)consBranchParent.children.push(aux);
    }

    for(var i=0;i<problemMap.problemStatement.length;i++){
      var node = {
        title:problemMap.problemStatement[i].title,
        link: "topic:"+problemMap.problemStatement[i].id,
        children: [causeBranchParent,consBranchParent],
        parentNodeId: designTheoryNode.id,
        closed:false,
        style: NODE_STYLES.template
      }
      Mindmeister.insertSubtree(node,changeList);
    }
  }
  var addImportProblemListener = function(){
    $("#"+Nodes.templateNodes.EXPLICATE_PROBLEM.id+" .tk_icon_container[icon-id='arrows_counterclockwise']").on("click",function(e){
      Scrap.showConfirmationMessage("This will overwrite your current problem analysis. Do you want to proceed?",function(){
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();

        var loadMapLink = function(ideaLink){
          if(ideaLink==null)return;
          var explicateProblemMapId;
          if(ideaLink.indexOf("topic:")!=-1) explicateProblemMapId = ideaLink.replace("topic:","");
          else if(ideaLink.indexOf("mindmeister.com/")){
            var aux = ideaLink.match(/.*\/(\d+)(?!\d)/);
            if(aux.length==2) explicateProblemMapId = aux[1];
          }
          var promiseList = [];
          promiseList.push(Mindmeister.getExplicateProblemMap(explicateProblemMapId));
          promiseList.push(Mindmeister.getMapIdeas(Scrap.mapID));
          Promise.all(promiseList).then(function(values){
            var problemMap = values[0];
            var mapIdeas = values[1];
            importProblemMap(problemMap,mapIdeas,cL);
            var cL2 = new Mindmeister.ChangeList();
            Mindmeister.modifyIdea(explicateProblemMapId,explicateProblemMapId,{link:"https://www.mindmeister.com/"+Scrap.mapID},cL2);
            Mindmeister.doChanges(explicateProblemMapId,cL2);
            Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
              if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
              else Scrap.hideWorkingMessage();
            })
          });
        }
        if(Nodes.templateNodes.EXPLICATE_PROBLEM.getLink()!="#") loadMapLink(Nodes.templateNodes.EXPLICATE_PROBLEM.getLink());
        else Mindmeister.getIdeaLink(Scrap.mapID,Nodes.templateNodes.EXPLICATE_PROBLEM.id).then(loadMapLink);
      },function(){
      });
    });
  }
  var initLinkings = function(){
    Scrap.showWorkingMessage();
    var cL = new Mindmeister.ChangeList();
    var alleviateConsequencesNode = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES;
    if(alleviateConsequencesNode!=null&&document.getElementById(alleviateConsequencesNode.id+"_link")==null){
      Mindmeister.modifyIdea(Scrap.mapID,alleviateConsequencesNode.id,{link:"topic:"+Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.id},cL)
    }
    var lessenCausesNode = Nodes.templateNodes.LESSEN_CAUSES
    if(lessenCausesNode!=null&&document.getElementById(lessenCausesNode.id+"_link")==null){
      Mindmeister.modifyIdea(Scrap.mapID,lessenCausesNode.id,{link:"topic:"+Nodes.templateNodes.ASCERTAIN_CAUSES.id},cL);
    }
    Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
      if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
      else Scrap.hideWorkingMessage();
    })
  }
  var onTemplateNodeRemoved = function(node,callback,allMap){
    var observer = new MutationObserver(function( mutations ) {
      mutations.forEach(function(mutation) {
        if(mutation.type == "childList"){
          if(mutation.removedNodes != null && mutation.removedNodes.length > 0){
            if(mutation.target==null||mutation.target.id==null||document.getElementById(mutation.target.id.replace("tk_children_",""))==null) return;
            var parentNode = new Scrap.Node(document.getElementById(mutation.target.id.replace("tk_children_","")));
            var taskNodesToRemove = [];
            var nodesToDecolor = [];
            for(var i=0;i<mutation.removedNodes.length;i++){
              var lag = document.createElement("div");
              lag.innerHTML = mutation.removedNodes[i].innerHTML;
              lag.style.display = "none";
              lag.id = "auxiliarNode";
              document.body.appendChild(lag);
              var nodeList = lag.querySelectorAll(".node");
              for(var j=0;j<nodeList.length;j++){
                if($("#canvas "+"#"+nodeList[j].id)!=null && $("#canvas "+"#"+nodeList[j].id).length>0){
                  continue;
                }
                var nodeContent = nodeList[j].innerText;
                if(/*TEMPLATE_NODES.indexOf(nodeContent)!=-1&&*/nodeList[j].style.backgroundColor=="rgb(71, 105, 209)"/*"rgb(230, 124, 115)"*/){
                  var aux = new Scrap.Node(nodeList[j]);
                  var parentNodeId = aux.getParentNode() != null ? aux.getParentNode().id : parentNode.id;
                  var templateParentNode = Scrap.getNodeById(parentNodeId);
                  //var templateParentNode = document.getElementById(parentNodeId)!=null ? document.getElementById(parentNodeId) : lag.getElementById(parentNodeId);
                  var templateParentNodeContent = templateParentNode.getContent();
                  if(nodeContent==Prompter.Nodes.WHY.text){
                    var taskText = "Why does '"+templateParentNodeContent+"' happen?";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent=="...that leads to..."){
                    var taskText = "What does '"+templateParentNodeContent+"' lead to?";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent==Prompter.Nodes.WHAT_FOLLOWS_FROM.text){
                    var taskText = "What follows from '"+templateParentNodeContent+"'?";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent=="How?"){
                    var taskText = "How does '"+templateParentNodeContent+"' happen?";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent=="Click icon to address it"){
                    var taskText = "Click icon to address '"+templateParentNodeContent+"'";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent=="Supporting Evidences?"){
                    var taskText = "Supporting Evidences for '"+templateParentNodeContent+"'";
                    var mapID = Scrap.mapID;
                    nodesToDecolor.push(Palette.selectLabelNodeId(mapID,nodeList[j].id));
                    Palette.deleteColorMapping(mapID,nodeList[j].id);
                    // TO IMPROVE LABEL MANAGEMENT
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent=="Who else addresses it?"){
                    var taskText = "Who else addresses '"+templateParentNodeContent+"'?";
                    var mapID = Scrap.mapID;
                    nodesToDecolor.push(Palette.selectLabelNodeId(mapID,nodeList[j].id));
                    Palette.deleteColorMapping(mapID,nodeList[j].id);
                    // TO IMPROVE LABEL MANAGEMENT
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent=='Which "How" does it address?'){
                    var taskText = 'Which "How" does \''+templateParentNodeContent+"' address?";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(new RegExp("Characterize [^']+'s nature","gi").test(nodeContent)){
                    taskNodesToRemove.push(nodeContent);
                  }
                  else if(nodeContent=="Determine Likelihood"||nodeContent=="Determine Significance/Cost"){
                    var taskText = nodeContent+" for '"+templateParentNodeContent+"'";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent=="Rephrase risk for your organization/domain/artefact"){
                    var riskId = templateParentNodeContent.split(".")[0];
                    var taskText = "Rephrase '"+riskId+"' risk for your organization/domain/artefact";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent=="What theoretical construct represents this?"){
                    var taskText = "What theoretical construct represents '"+templateParentNodeContent+"'?";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent=="Write a clear definition of this construct"){
                    var taskText = "Write a clear definition of '"+templateParentNodeContent+"'";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent=="How measure this construct?"){
                    var taskText = "How measure '"+templateParentNodeContent+"'?";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent=="Of what and in what way?"){
                    var taskText = "'"+templateParentNodeContent+"' of what and in what way?";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent.indexOf("Rate this")!=-1&&nodeContent.indexOf("'s priority")!=-1){
                    var taskText = "Rate the priority for '"+templateParentNodeContent+"'";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent=="In comparison to what other purposeful artefact(s)?"){
                    taskNodesToRemove.push("In comparison to what other purposeful artefact(s) mine has better utility for its purpose?");
                  }
                  else if(nodeContent=="Assess Level of Coercive Power"||nodeContent=="Assess Level of Utilitarian Power"||nodeContent=="Assess Level of Normative Power"||nodeContent=="Assess Level of Customary Legitimacy"||nodeContent=="Assess Level of Moral Legitimacy"||nodeContent=="Assess the Time Sensitivity"||nodeContent=="Assess the Criticality"){
                    var stakeholderNodeId = templateParentNode.getParentNode() != null ? templateParentNode.getParentNode().id : parentNode.id;
                    var stakeholderNode = Scrap.getNodeById(stakeholderNodeId);
                    var stakeholder = stakeholderNode.getContent();
                    var taskText = nodeContent+" for '"+stakeholder+"'";
                    taskNodesToRemove.push(taskText);
                  }
                  else if(nodeContent=="Identify the property or right"){
                    var legitimacy;
                    if(templateParentNodeContent == "Assess Level of Legal Legitimacy") legitimacy = "legal";
                    else if(templateParentNodeContent == "Assess Level of Contractual Legitimacy") legitimacy = "contractual";
                    if(legitimacy!=null){
                      var legitimacyTypeNodeId = templateParentNode.getParentNode() != null ? templateParentNode.getParentNode().id : parentNode.id;
                      var legitimacyTypeNode = Scrap.getNodeById(legitimacyTypeNodeId);
                      var legitimacyType = legitimacyTypeNode.getContent();
                      var stakeholderNodeId = legitimacyTypeNode.getParentNode() != null ? legitimacyTypeNode.getParentNode().id : parentNode.id;
                      var stakeholderNode = stakeholderNodeId.getNodeById();
                      var stakeholder = stakeholderNode.getContent();
                      var taskText = "Identify the property or right of the level of "+legitimacy+" legitimacy for '"+stakeholder+"'";
                      taskNodesToRemove.push(taskText);
                    }
                  }
                }
              }
              document.body.removeChild(lag);
            }
            callback.call(this,taskNodesToRemove,nodesToDecolor);
          }
        }
      });
    });
    var config = {
      subtree: true,
      childList: true
    };

    if($("#tk_map")!=null&&$("#tk_map").length>0) var targetNode = allMap ? $("#tk_map")[0] : $("#tk_children_"+node.id)[0];
    else var targetNode = allMap ? $("#canvas")[0] : $("#tk_children_"+node.id)[0];
    //var targetNode = allMap ? $("#tk_map")[0] : $("#tk_children_"+node.id)[0];
    observer.observe(targetNode, config);
  }
  var insertAnnotation = function (annotation,parentNodeId,mapId,changeList){
    if(parentNodeId==null||parseInt(parentNodeId)<0) return;

    /*if(this.templateName == 'Explicate Problem'){
      var parentNode = Scrap.getNodeById(parentNodeId);
    }*/
    var newIdea = {title: annotation.text, note: annotation.note, link: annotation.link};
    if(annotation.starred!=null&&annotation.starred==true) newIdea["icon"] = "star";
    var styleParams = JSON.parse(JSON.stringify(NODE_STYLES.template));
    if(annotation.color != null) styleParams["backgroundColor"] = annotation.color;
    newIdea["style"] = styleParams;
    Mindmeister.insertIdea(mapId,parentNodeId,newIdea,changeList);
  }
  var initTemplateDesignScience = function(){
    Nodes.init();

    //initLinkings();

    Completeness.init();

    // LOOK IF SEGMENTATED, IF SO, ADD WHEEL ICON AND LISTENER
    if(Nodes.templateNodes.EXPLICATE_PROBLEM!=null){
      var getMirrorMap = function(){
        var rootNode = Scrap.getRootNode();
        var rootNodeContent = rootNode.getContent().trim();
        var mapName = new RegExp("Explicate Problem for "+"\\s*"+rootNodeContent,"gi");
        Mindmeister.getMapByNameRegExp(mapName).then(function(explicateProblemMapId){
          if(explicateProblemMapId==null) return;
          Scrap.showWorkingMessage();
          var cl = new Mindmeister.ChangeList();
          Mindmeister.modifyIdea(Scrap.mapID,Nodes.templateNodes.EXPLICATE_PROBLEM.id,{icon:"emoji/symbols-arrows_counterclockwise",link:"https://www.mindmeister.com/"+explicateProblemMapId},cl);
          Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
            else Scrap.hideWorkingMessage();
          });
        })
      }

      var loadLinkMap = function(ideaLink){
        if(ideaLink==null) return;
        var explicateProblemMapId;
        if(ideaLink.indexOf("topic:")!=-1) explicateProblemMapId = ideaLink.replace("topic:","");
        else if(ideaLink.indexOf("mindmeister.com/")){
          var aux = ideaLink.match(/.*\/(\d+)(?!\d)/);
          if(aux.length==2) explicateProblemMapId = aux[1];
        }
        if(explicateProblemMapId!=null){
          Mindmeister.existsMap(explicateProblemMapId).then(function(exists){
            if(!exists)return;
            var problemChildren = Nodes.templateNodes.EXPLICATE_PROBLEM.getChildren();
            //if(problemChildren.length==0){
              if(Nodes.templateNodes.EXPLICATE_PROBLEM.getIcons().indexOf(Icons.reload_wheel)==-1){
                Scrap.showWorkingMessage();
                var cl = new Mindmeister.ChangeList();
                Mindmeister.modifyIdea(Scrap.mapID,Nodes.templateNodes.EXPLICATE_PROBLEM.id,{icon:"emoji/symbols-arrows_counterclockwise",link:"https://www.mindmeister.com/"+explicateProblemMapId},cl);
                Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
                  if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
                  else Scrap.hideWorkingMessage();
                });
              }
              else{
                addImportProblemListener(); // TO CHANGE
              }
            //}
          })
        }
      }
      if(!Nodes.templateNodes.EXPLICATE_PROBLEM.hasLink()) getMirrorMap();
      else if(Nodes.templateNodes.EXPLICATE_PROBLEM.getLink()!="#") loadLinkMap(Nodes.templateNodes.EXPLICATE_PROBLEM.getLink());
      else Mindmeister.getIdeaLink(Scrap.mapID,Nodes.templateNodes.EXPLICATE_PROBLEM.id).then(loadLinkMap);
    }

    // ASCERTAIN CONSEQUENCES
    if(Nodes.templateNodes.ASCERTAIN_CONSEQUENCES!=null){
      Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.onChildrenAdded(function(addedNodes){
        if(addedNodes==null||addedNodes.length==0) return;
        var newNodes = addedNodes; //var newNodes = addedNodes[0].querySelectorAll("div.node");

        // GESTION RAMAS
        //if(newNodes.length>1){
          /*var aux = $(addedNodes[0].getHTMLElement()).find(".node")[0];
          if(aux==null) return;
          var fatherNode = new Scrap.Node(aux);
          var fatherNodeContent = fatherNode.getContent();
          if(fatherNodeContent==null||fatherNodeContent=="") return;
          var mirrorNode = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(fatherNodeContent));
          if(mirrorNode==null||mirrorNode.length==0){
            // no existe -> insertar toda la estructura
          }
          else{
            return;
          }*/
          // mirar si existe reverse
          // si existe, quiere decir que se ha movido
          // si no existe, es nueva -> crear
        //}


        //var aux = $(addedNodes[0]).find(".node")[0];
        //if(aux==null) return;
        //var addedNode = new Scrap.Node(aux);
        var addedNode = addedNodes[0];

        if(addedNode==null||addedNode.getContent()=="") return;

        var mirrorNode = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(addedNode.getContent()));
        if(mirrorNode==null||mirrorNode.length==0){
          // no existe -> insertar toda la estructura
        }
        else{
          return;
        }

        if(addedNode.getContent()==Prompter.Nodes.WHAT_FOLLOWS_FROM.text||addedNode.getContent()==Prompter.Nodes.WHAT_FOLLOWS_FROM.completed) return;
        if(!addedNode.isDescendant(Nodes.templateNodes.ASCERTAIN_CONSEQUENCES)) return;

        var nodeAncestors = addedNode.getAncestors();
        for(var i=0;i<nodeAncestors.length;i++){
          if(nodeAncestors[i].getContent()==Prompter.Nodes.SUPPORTING_EVIDENCES.text) return;
        }

        // CHILD OF SUPPORTING EVIDENCES
        var parentNode = addedNode.getParentNode();
        if(parentNode!=null) var parentNodeContent = parentNode.getContent();
        if(parentNodeContent == Prompter.Nodes.SUPPORTING_EVIDENCES.text) return;

        var cL = addedNode.getChildrenWithText(Prompter.Nodes.WHAT_FOLLOWS_FROM.text);
        if(cL!=null&&cL.length>0) return;
        var cL2 = addedNode.getChildrenWithText(Prompter.Nodes.WHAT_FOLLOWS_FROM.completed);
        if(cL2!=null&&cL2.length>0) return;

        var addedNodeContent = addedNode.getContent();
        if(addedNodeContent!=null&&addedNodeContent!=Prompter.Nodes.WHAT_FOLLOWS_FROM.text&&addedNodeContent!=Prompter.Nodes.SUPPORTING_EVIDENCES.text){
          Scrap.showWorkingMessage();
          var cl = new Mindmeister.ChangeList();
          var nodeId = Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{"title":Prompter.Nodes.WHAT_FOLLOWS_FROM.text,"style":Prompter.Styles.prompt},cl,true);
          DScaffolding.insertTaskNode("What follows from '"+addedNodeContent+"'?",nodeId,cl);
          if(parentNodeContent!=null&&parentNodeContent==Prompter.Nodes.WHAT_FOLLOWS_FROM.text){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:Prompter.Nodes.WHAT_FOLLOWS_FROM.completed,style:Prompter.Styles.prompt_completed},cl);
            var grandParentNode = parentNode.getParentNode();
            var grandParentNodeContent = grandParentNode.getContent();
            DScaffolding.removeTaskNode("What follows from '"+grandParentNodeContent+"'?",cl);
          }
          if(parentNode.id==Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.id) DScaffolding.cloneNodeBis(addedNode,DScaffolding.Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.id,cl,true);
          else{
            var grandParentNodeContent = parentNode.getParentNode().getContent();
            var mirrorNodes = DScaffolding.Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(DScaffolding.invertPoles(grandParentNodeContent));
            if(mirrorNodes!=null&&mirrorNodes.length>0){
              var thatLeadsToNode = mirrorNodes[0].getChildrenWithText(mirrorNodes[0],Prompter.Nodes.WHAT_FOLLOWS_FROM.completed);
              if(thatLeadsToNode==null||thatLeadsToNode.length==0){
                var aux = Mindmeister.insertIdea(Scrap.mapID,mirrorNodes[0].id,{"title":Prompter.Nodes.WHAT_FOLLOWS_FROM.completed,"style":Prompter.Styles.prompt_completed},cl);
                DScaffolding.cloneNodeBis(addedNode,aux,cl,true);
              }
              else{
                DScaffolding.cloneNodeBis(addedNode,thatLeadsToNode[0].id,cl,true);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
        })
      },true);
      Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.onEdited(function(node,oldValue){
        if(oldValue==Prompter.Nodes.WHAT_FOLLOWS_FROM.text)return;
        var mirrorNodes = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(DScaffolding.invertPoles(oldValue));
        var mirrorNodesDesignTheory = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(DScaffolding.unInvertPoles(oldValue));
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        if(mirrorNodes!=null&&mirrorNodes.length>0){
          var contentReverse = DScaffolding.invertPoles(nodeContent);
          DScaffolding.syncNodes(mirrorNodes,{title:contentReverse},cl);
        }
        if(mirrorNodesDesignTheory!=null&&mirrorNodesDesignTheory.length>0){
          var contentNegative = DScaffolding.unInvertPoles(nodeContent);
          DScaffolding.syncNodes(mirrorNodesDesignTheory,{title:contentNegative},cl);
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },true)
      Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.onRemoved(function(removedNodes,parentNode){
        Scrap.showWorkingMessage();
        var chL = new Mindmeister.ChangeList();
        if(removedNodes.length==1&&removedNodes[0]==Prompter.Nodes.WHAT_FOLLOWS_FROM.text){
          var parentNodeContent = parentNode.getContent();
          DScaffolding.removeTaskNode("What follows from '"+parentNodeContent+"'?",chL);
          var cL = parentNode.getChildrenWithText(Prompter.Nodes.SUPPORTING_EVIDENCES.text);
          if(cL==null||cL.length==0){
            var supportingNodeId = Mindmeister.insertIdea(Scrap.mapID,parentNode.id,{"title":Prompter.Nodes.SUPPORTING_EVIDENCES.text,"style":Prompter.Styles.prompt,"note":Prompter.Nodes.SUPPORTING_EVIDENCES.note},chL,true);
            var parentNodeContent = parentNode.getContent();
            DScaffolding.insertTaskNode("Supporting Evidences for '"+parentNodeContent+"'",supportingNodeId,chL);
            var mirrorNodes = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(DScaffolding.invertPoles(parentNodeContent));
            if(mirrorNodes!=null&&mirrorNodes.length>0){
              Mindmeister.modifyIdea(Scrap.mapID,mirrorNodes[0].id,{icon:Icons.disabled},chL);
              var nodeId = Mindmeister.insertIdea(Scrap.mapID,mirrorNodes[0].id,{"title":Prompter.Nodes.CLICK_ICON_TO_ADDRESS.text,"style":Prompter.Styles.prompt},chL);
              DScaffolding.insertTaskNode("Click icon to address '"+DScaffolding.invertPoles(parentNodeContent)+"'",nodeId,chL);
            }
          }
        }
        else{
          var removedNodesA = DScaffolding.filterNodesTemplate(removedNodes); // TO DO
          for(var i=0;i<removedNodesA.length;i++){
            var mirrorNodesAlleviate = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(DScaffolding.invertPoles(removedNodes[i]));
            var mirrorNodesDesignTheory = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(DScaffolding.unInvertPoles(removedNodes[i]));
            var mirrorNodes = mirrorNodesAlleviate.concat(mirrorNodesDesignTheory);
            if(mirrorNodes!=null&&mirrorNodes.length>0){
              for(var j=0;j<mirrorNodes.length;j++){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[j].id,chL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,chL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
        })
      },false,[Nodes.templateNodes.PROBLEM_AS_DIFFICULTIES.id,Nodes.templateNodes.SET_PROBLEM_STATEMENT.id]);
    }

    // ASCERTAIN CAUSES
    if(Nodes.templateNodes.ASCERTAIN_CAUSES!=null){
      Nodes.templateNodes.ASCERTAIN_CAUSES.onChildrenAdded(function(addedNodes){
        if(addedNodes==null||addedNodes.length==0) return;
        var newNodes = addedNodes; //var newNodes = addedNodes[0].querySelectorAll("div.node");

        /*
        // GESTION RAMAS
        //if(newNodes.length>1){
          var fatherNode = $(addedNodes[0]).find(".node")[0];
          if(fatherNode==null)return;
          var fatherNodeContent = Scrap.selectContent(fatherNode);
          if(fatherNodeContent==null||fatherNodeContent=="") return;
          var mirrorNode = DScaffolding.getChildsWithText(Nodes.templateNodes.PROBLEM_AS_SOLUTIONS,DScaffolding.reversePoles(fatherNodeContent));
          if(mirrorNode==null||mirrorNode.length==0){
            // no existe -> insertar toooooda la estructura
          }
          else{
            return;
          }
          // mirar si existe reverse
          // si existe, quiere decir que se ha movido
          // si no existe, es nueva -> crear
        //}
        */
        var addedNode = addedNodes[0];//$(addedNodes[0]).find(".node")[0];

        if(addedNode==null||addedNode.getContent()=="") return;
        var mirrorNode = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(addedNode.getContent()));
        if(mirrorNode==null||mirrorNode.length==0){
          // no existe -> insertar toda la estructura
        }
        else{
          return;
        }

        if(addedNode.getContent()==Prompter.Nodes.WHY.text||addedNode.getContent()==Prompter.Nodes.WHY.completed) return;
        if(!addedNode.isDescendant(Nodes.templateNodes.ASCERTAIN_CAUSES)) return;

        var nodeAncestors = addedNode.getAncestors();
        for(var i=0;i<nodeAncestors.length;i++){
          if(nodeAncestors[i].getContent()==Prompter.Nodes.SUPPORTING_EVIDENCES.text) return;
        }

        // CHILD OF SUPPORTING EVIDENCES
        var parentNode = addedNode.getParentNode();
        if(parentNode!=null) var parentNodeContent = parentNode.getContent();
        if(parentNodeContent == Prompter.Nodes.SUPPORTING_EVIDENCES.text) return;

        var cL = addedNode.getChildrenWithText(Prompter.Nodes.WHY.text);
        if(cL!=null&&cL.length>0) return;
        var cL2 = addedNode.getChildrenWithText(Prompter.Nodes.WHY.completed);
        if(cL2!=null&&cL2.length>0) return;

        var addedNodeContent = addedNode.getContent();
        var promiseList = [];
        if(addedNodeContent!=null&&addedNodeContent!=Prompter.Nodes.WHY.text&&addedNodeContent!=Prompter.Nodes.SUPPORTING_EVIDENCES.text){
          Scrap.showWorkingMessage();
          var cl = new Mindmeister.ChangeList();
          var whyNodeId = Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{"title":Prompter.Nodes.WHY.text,"style":Prompter.Styles.prompt},cl,true);
          DScaffolding.insertTaskNode("Why does '"+addedNodeContent+"' happen?",whyNodeId,cl);
          var parentNode = addedNode.getParentNode();
          if(parentNode!=null) var parentNodeContent = parentNode.getContent();
          if(parentNodeContent!=null&&parentNodeContent==Prompter.Nodes.WHY.text){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:Prompter.Nodes.WHY.completed,style:Prompter.Styles.prompt_completed},cl);
            var grandParentNode = parentNode.getParentNode();
            var grandParentNodeContent = grandParentNode.getContent();
            DScaffolding.removeTaskNode("Why does '"+grandParentNodeContent+"' happen?",cl);
          }
          if(parentNodeContent==Nodes.templateNodesText.ASCERTAIN_CAUSES) DScaffolding.cloneNodeBis(addedNode,Nodes.templateNodes.LESSEN_CAUSES.id,cl,true);
          else{
            var grandParentNodeContent = parentNode.getParentNode().getContent();
            var mirrorNodes = Nodes.templateNodes.LESSEN_CAUSES.getChildrenWithText(DScaffolding.invertPoles(grandParentNodeContent));
            if(mirrorNodes!=null&&mirrorNodes.length>0){
              var whyNode = mirrorNodes[0].getChildrenWithText(Prompter.Nodes.WHY.completed);
              if(whyNode==null||whyNode.length==0){
                var aux = Mindmeister.insertIdea(Scrap.mapID,mirrorNodes[0].id,{title:Prompter.Nodes.WHY.text,style:Prompter.Styles.prompt_completed},cl)
                DScaffolding.cloneNodeBis(addedNode,aux,cl,true);
              }
              else{
                DScaffolding.cloneNodeBis(addedNode,whyNode[0].id,cl,true);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      Nodes.templateNodes.ASCERTAIN_CAUSES.onEdited(function(node,oldValue){
        if(oldValue==Prompter.Nodes.WHY.text) return;
        var mirrorNodes = Nodes.templateNodes.LESSEN_CAUSES.getChildrenWithText(DScaffolding.invertPoles(oldValue));
        var mirrorNodesDesignTheory = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(DScaffolding.unInvertPoles(oldValue));
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        if(mirrorNodes!=null&&mirrorNodes.length>0){
          var contentReverse = DScaffolding.invertPoles(nodeContent);
          DScaffolding.syncNodes(mirrorNodes,{title:contentReverse},cl);
        }
        if(mirrorNodesDesignTheory!=null&&mirrorNodesDesignTheory.length>0){
          var contentNegative = DScaffolding.unInvertPoles(nodeContent);
          DScaffolding.syncNodes(mirrorNodesDesignTheory,{title:contentNegative},cl);
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },true)
      Nodes.templateNodes.ASCERTAIN_CAUSES.onRemoved(function(removedNodes,parentNode){
        Scrap.showWorkingMessage();
        var chL = new Mindmeister.ChangeList();
        if(removedNodes.length==1&&removedNodes[0]==Prompter.Nodes.WHY.text){
          var parentNodeContent = parentNode.getContent();
          DScaffolding.removeTaskNode("Why does '"+parentNodeContent+"' happen?",chL);
          var cL = parentNode.getChildrenWithText(Prompter.Nodes.SUPPORTING_EVIDENCES.text);
          if(cL==null||cL.length==0){
            var supportingNodeId = Mindmeister.insertIdea(Scrap.mapID,parentNode.id,{title:Prompter.Nodes.SUPPORTING_EVIDENCES.text,"style":Prompter.Styles.prompt,"note":Prompter.Nodes.SUPPORTING_EVIDENCES.note},chL,true);
            var parentNodeContent = parentNode.getContent();
            DScaffolding.insertTaskNode("Supporting Evidences for '"+parentNodeContent+"'",supportingNodeId,chL);
            var mirrorNodes = Nodes.templateNodes.LESSEN_CAUSES.getChildrenWithText(DScaffolding.invertPoles(parentNodeContent));
            if(mirrorNodes!=null&&mirrorNodes.length>0){
              Mindmeister.modifyIdea(Scrap.mapID,mirrorNodes[0].id,{icon:Icons.disabled},chL);
              var nodeId = Mindmeister.insertIdea(Scrap.mapID,mirrorNodes[0].id,{title:Prompter.Nodes.CLICK_ICON_TO_ADDRESS.text,style:Prompter.Styles.prompt},chL);
              DScaffolding.insertTaskNode("Click icon to address '"+DScaffolding.invertPoles(parentNodeContent)+"'",nodeId,chL);
            }
          }
        }
        else{
          var removedNodes = DScaffolding.filterNodesTemplate(removedNodes); // TO DO
          for(var i=0;i<removedNodes.length;i++){
            var mirrorNodesAlleviate = Nodes.templateNodes.LESSEN_CAUSES.getChildrenWithText(DScaffolding.invertPoles(removedNodes[i]));
            var mirrorNodesDesignTheory = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(DScaffolding.unInvertPoles(removedNodes[i]));
            var mirrorNodes = mirrorNodesAlleviate.concat(mirrorNodesDesignTheory);
            if(mirrorNodes!=null&&mirrorNodes.length>0){
              for(var j=0;j<mirrorNodes.length;j++){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[j].id,chL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,chL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },false,[Nodes.templateNodes.PROBLEM_AS_DIFFICULTIES.id,Nodes.templateNodes.SET_PROBLEM_STATEMENT.id]);
    }

    // PROBLEM AS DIFFICULTIES
    if(Nodes.templateNodes.PROBLEM_AS_DIFFICULTIES!=null){
      Nodes.templateNodes.PROBLEM_AS_DIFFICULTIES.onMoved(function(movedNodes,parentNode){
        if(movedNodes.length==1&&!Scrap.getNodeById(movedNodes[0].newParentId).isDescendant(Nodes.templateNodes.PROBLEM_AS_DIFFICULTIES)) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        for(var i=0;i<movedNodes.length;i++){
          var movedNode = movedNodes[i].node;//Scrap.getNodeById(movedNodes[i].nodeId);
          var movedNodeContent = movedNode.getContent();
          var nodeToMove = null;
          var insertDone = false;

          var oldParentNodeContent = parentNode.getContent();
          if(oldParentNodeContent==Prompter.Nodes.WHAT_FOLLOWS_FROM.completed){
            var children = parentNode.getChildren();
            if(children==null||children.length==0){
              var gp = parentNode.getParentNode();
              var gpContent = gp.getContent();
              Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:Prompter.Nodes.WHAT_FOLLOWS_FROM.text,style:Prompter.Styles.prompt},cL);
              DScaffolding.insertTaskNode("What follows from '"+gpContent+"'?",parentNode.id,cL);
            }
          }
          else if(oldParentNodeContent==Prompter.Nodes.WHY.completed){
            var children = parentNode.getChildren();
            if(children==null||children.length==0){
              var gp = parentNode.getParentNode();
              var gpContent = gp.getContent();
              Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:Prompter.Nodes.WHY.text,style:Prompter.Styles.prompt},cL);
              DScaffolding.insertTaskNode("Why does '"+gpContent+"' happen?",parentNode.id,cL)
            }
          }

          if(movedNodeContent=="...follows form..."||movedNodeContent==Prompter.Nodes.WHY.completed){
            var movedNodeFirstChildren = new Scrap.Node($(movedNode.getHTMLElement()).find("#tk_children_"+movedNode.id+" .node")[0]);
            var movedNodeFirstChildrenMirror = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(movedNodeFirstChildren.getContent()));
            if(movedNodeFirstChildrenMirror!=null&&movedNodeFirstChildrenMirror.length>0) nodeToMove = movedNodeFirstChildrenMirror[0].getParentNode();
          }
          else nodeToMove = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(movedNodeContent))[0];

          // gestion design theory
          if(nodeToMove==null) continue;
          var movedNodeActiveDesc = DScaffolding.getActiveDescendants(nodeToMove.id);
          if(movedNodeActiveDesc!=null&&movedNodeActiveDesc.length>0){
            var designTheoryNodeToCut = nodeToMove;
            var stop = false;
            while(!stop){
              var lagParent = designTheoryNodeToCut.getParentNode();
              var lagParentContent = lagParent.getContent();
              var lagParentActiveDescendants = DScaffolding.getActiveDescendants(lagParent.id);
              if(lagParentActiveDescendants==null||lagParentActiveDescendants.length==0) break;
              if(lagParentContent=="Alleviate Consequences"||lagParentContent=="Lessen Causes"||lagParentActiveDescendants.length>movedNodeActiveDesc.length){
                stop = true;
              }
              else{
                designTheoryNodeToCut = lagParent;
              }
            }
            if(stop){
              var designTheoryNode = Nodes.templateNodes.FORMULATE_DESIGN_THEORY;
              var mirrorDesignTheory = designTheoryNode.getChildrenWithSubText(DScaffolding.unInvertPoles(designTheoryNodeToCut.getContent()));
              if(mirrorDesignTheory!=null&&mirrorDesignTheory.length>0){
                for(var j=0;j<mirrorDesignTheory.length;j++){
                  Mindmeister.removeIdea(Scrap.mapID,mirrorDesignTheory[j].id,cL);
                }
              }
            }
          }

          var newParentNode = new Scrap.Node(document.getElementById(movedNodes[i].newParentId));
          var newParentNodeContent = newParentNode.getContent();

          var insertionPoint = null;
          //var movedNodeMirror =
          if(newParentNodeContent=="Ascertain Consequences"){
            insertionPoint = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES;
          }
          else if(newParentNodeContent=="Ascertain Causes"){
            insertionPoint = Nodes.templateNodes.LESSEN_CAUSES;
          }
          else if(newParentNodeContent==Prompter.Nodes.WHAT_FOLLOWS_FROM.completed){
            var aux = newParentNode.getParentNode();
            var auxContent = aux.getContent();
            var auxMirror = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(auxContent));
            if(auxMirror==null||auxMirror.length==0) continue;
            var auxChildren = auxMirror[0].getChildren();
            if(auxChildren.length==0) continue;
            for(var j=0;j<auxChildren.length;j++){
              if(auxChildren[j].getContent() == Prompter.Nodes.WHAT_FOLLOWS_FROM.completed){
                insertionPoint = auxChildren[j];
                break;
              }
            }
          }
          else if(newParentNodeContent==Prompter.Nodes.WHAT_FOLLOWS_FROM.text){
            var aux = newParentNode.getParentNode();
            var auxContent = aux.getContent();

            Mindmeister.modifyIdea(Scrap.mapID,newParentNode.id,{title:Prompter.Nodes.WHAT_FOLLOWS_FROM.completed,style:Prompter.Styles.prompt_completed},cL);
            DScaffolding.removeTaskNode("What follows from '"+auxContent+"'?",cL);

            var auxMirror = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(auxContent));
            if(auxMirror==null||auxMirror.length==0) continue;
            var auxChildren = auxMirror[0].getChildren();
            if(auxChildren!=null&&auxChildren.length!=0){
              for(var j=0;j<auxChildren.length;j++){
                if(auxChildren[j].getContent() == Prompter.Nodes.WHAT_FOLLOWS_FROM.completed){
                  insertionPoint = auxChildren[j];
                  break;
                }
              }
            }
            else{
              var nId = Mindmeister.insertIdea(Scrap.mapID,auxMirror[0].id,{title: Prompter.Nodes.WHAT_FOLLOWS_FROM.completed,style:Prompter.Styles.prompt_completed},cL);
              Mindmeister.moveNode(Scrap.mapID,nodeToMove.id,nId,cL);
              insertDone = true;
              //continue;
            }
          }
          else if(newParentNodeContent==Prompter.Nodes.WHY.completed){
            var aux = newParentNode.getParentNode();
            var auxContent = aux.getContent();
            var auxMirror = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(auxContent));
            if(auxMirror==null||auxMirror.length==0) continue;
            var auxChildren = auxMirror[0].getChildren();
            if(auxChildren.length==0) continue;
            for(var j=0;j<auxChildren.length;j++){
              if(auxChildren[j].getContent() == Prompter.Nodes.WHY.completed){
                insertionPoint = auxChildren[j];
                break;
              }
            }
          }
          else if(newParentNodeContent==Prompter.Nodes.WHY.text){
            var aux = newParentNode.getParentNode();
            var auxContent = aux.getContent();
            Mindmeister.modifyIdea(Scrap.mapID,newParentNode.id,{title:Prompter.Nodes.WHY.completed,style:Prompter.Styles.prompt_completed},cL);
            DScaffolding.removeTaskNode("Why does '"+auxContent+"' happen?",cL);

            var auxMirror = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(auxContent));
            if(auxMirror==null||auxMirror.length==0) continue;
            var auxChildren = auxMirror[0].getChildren();
            if(auxChildren.length!=0){
              for(var j=0;j<auxChildren.length;j++){
                if(auxChildren[j].getContent() == Prompter.Nodes.WHY.completed){
                  insertionPoint = auxChildren[j];
                  break;
                }
              }
            }
            else{
              var nId = Mindmeister.insertIdea(Scrap.mapID,auxMirror[0].id,{title: Prompter.Nodes.WHY.completed,style:Prompter.Styles.prompt_completed},cL);
              Mindmeister.moveNode(Scrap.mapID,nodeToMove.id,nId,cL);
              insertDone = true;
              //continue;
            }
          }
          else{
            var mirror = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(newParentNodeContent));
            if(mirror!=null&&mirror.length>0){
              insertionPoint = mirror[0];
            }
          }

          if((parentNode.isDescendant(Nodes.templateNodes.ASCERTAIN_CONSEQUENCES)||oldParentNodeContent=="Ascertain Consequences")&&(newParentNode.isDescendant(Nodes.templateNodes.ASCERTAIN_CAUSES)||newParentNodeContent=="Ascertain Causes")){
            var lag = DScaffolding.getActiveDescendants(nodeToMove.id);
            if(lag!=null&&lag.length>0){
              var nodeToLook = Nodes.templateNodes.REQ_PURPOSE_BENEFITS;
              var nntmIns = Nodes.templateNodes.REQ_REDUCE_CAUSES;
              var nonFunctionalRequirementsNode = Nodes.templateNodes.NON_FUNCTIONAL_REQUIREMENTS;
              var nntmClone = nonFunctionalRequirementsNode.getChildsWithSubText("In the checklists below, tick any non-functional requirements");
              if(nodeToLook!=null){
                for(var j=0;j<lag.length;j++){
                  var ntm = nodeToLook.getChildrenWithText(lag[j]);
                  if(ntm!=null&&ntm.length>0) Mindmeister.moveNode(Scrap.mapID,ntm[0].id,nntmIns.id,cL);
                  var nodeToClone = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(lag[j]);
                  if(nodeToClone!=null&&nodeToClone.length>0&&nntmClone!=null&&nntmClone.length>0) DScaffolding.cloneNodeBis(nodeToClone[0],nntmClone[0].id,cL);
                }
              }
            }
            DScaffolding.switchConsequencesIntoCauses(movedNode.id,nodeToMove.id,cL);
          }
          else if((parentNode.isDescendant(Nodes.templateNodes.ASCERTAIN_CAUSES)||oldParentNodeContent=="Ascertain Causes")&&(newParentNode.isDescendant(Nodes.templateNodes.ASCERTAIN_CONSEQUENCES)||newParentNodeContent=="Ascertain Consequences")){
            var lag = DScaffolding.getActiveDescendants(nodeToMove.id);
            if(lag!=null&&lag.length>0){
              var nntmIns = Nodes.templateNodes.REQ_PURPOSE_BENEFITS;
              var nodeToLook = Nodes.templateNodes.REQ_REDUCE_CAUSES;
              var nonFunctionalRequirementsNode = Nodes.templateNodes.NON_FUNCTIONAL_REQUIREMENTS;
              var nntmRemove = nonFunctionalRequirementsNode.getChildsWithSubText("In the checklists below, tick any non-functional requirements");
              if(nodeToLook!=null){
                for(var j=0;j<lag.length;j++){
                  var ntm = nodeToLook.getChildrenWithText(lag[j]);
                  if(ntm!=null&&ntm.length>0) Mindmeister.moveNode(Scrap.mapID,ntm[0].id,nntmIns.id,cL);
                  if(nntmRemove!=null&&nntmRemove.length>0){
                    var nodeToRemove = nntmRemove[0].getChildrenWithText(lag[j]);
                    if(nodeToRemove!=null&&nodeToRemove.length>0) Mindmeister.removeIdea(Scrap.mapID,nodeToRemove[0].id,cL);
                  }
                }
              }
            }
            DScaffolding.switchCausesIntoConsequences(movedNode.id,nodeToMove.id,cL);
          }

          if(!insertDone&&nodeToMove!=null&&insertionPoint!=null){
            Mindmeister.moveNode(Scrap.mapID,nodeToMove.id,insertionPoint.id,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    // ALLEVIATE CONSEQUENCES
    if(Nodes.templateNodes.ALLEVIATE_CONSEQUENCES!=null){
      Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];//var addedNode = $(addedNodes[0]).find(".node")[0];
        if(addedNode==null)return;
        var addedNodeContent = addedNode.getContent();
        if(addedNodeContent==Prompter.Nodes.CLICK_ICON_TO_ADDRESS.text) return;
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();

        // CHILD OF SUPPORTING EVIDENCES
        if(parentNodeContent == Prompter.Nodes.SUPPORTING_EVIDENCES.text) return;
      },true);
      Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.onIconEdited(function(node,icon){
        var cl = new Mindmeister.ChangeList();
        Scrap.showWorkingMessage();
        var nodeContent = node.getContent();
        if(icon==Icons.enabled){
          DScaffolding.syncDesignTheory(cl);
          if(Nodes.templateNodes.REQ_PURPOSE_BENEFITS!=null){
            DScaffolding.cloneNodeBis(node,Nodes.templateNodes.REQ_PURPOSE_BENEFITS.id,cl);
            var clickToAddressNode = node.getChildrenWithText("Click icon to address it");
            if(clickToAddressNode!=null&&clickToAddressNode.length==1){
              Mindmeister.removeIdea(Scrap.mapID,clickToAddressNode[0].id,cl);
              DScaffolding.removeTaskNode("Click icon to address '"+nodeContent+"'",cl);
              var nId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:"Who else addresses it?",style:Prompter.Styles.prompt},cl,true);
              DScaffolding.insertTaskNode("Who else addresses '"+nodeContent+"'?",nId,cl);
            }
            else{
              var nId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:"Who else addresses it?",style:Prompter.Styles.prompt},cl,true);
              DScaffolding.insertTaskNode("Who else addresses '"+nodeContent+"'?",nId,cl);
            }
          }
        }
        else if(icon==Icons.disabled){
          var mirrorNodesAlleviate = Nodes.templateNodes.FUNCTIONAL_REQUIREMENTS.getChildrenWithText(nodeContent);
          var mirrorNodes = mirrorNodesAlleviate;

          var mirrorNodesAscertainCons = Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.getChildrenWithSubText(DScaffolding.unInvertPoles(nodeContent));
          var mirrorNodesDesignTheory = [];
          if(mirrorNodesAscertainCons!=null&&mirrorNodesAscertainCons.length>0){
            var originalContent = mirrorNodesAscertainCons[0].getContent();
            var mirrorNodesDesignTheory = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(DScaffolding.unInvertPoles(originalContent));
          }
          for(var j=0;j<mirrorNodesDesignTheory.length;j++){
            mirrorNodes.push(DScaffolding.getPointToRemove(mirrorNodesDesignTheory[j]));
          }


          if(mirrorNodes!=null&&mirrorNodes.length>0){
            for(var i=0;i<mirrorNodes.length;i++){
              Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[i].id,cl);
            }
          }

          var whoElseAddressesNode = node.getChildrenWithText("Who else addresses it?");
          if(whoElseAddressesNode!=null&&whoElseAddressesNode.length>0){
            Mindmeister.removeIdea(Scrap.mapID,whoElseAddressesNode[0].id,cl);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.onChildEdited(function(node,oldValue){
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        DScaffolding.syncDesignTheory(cl);
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent=="Alleviate Consequences"){
          var mirrorNodes = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(oldValue);
          if(mirrorNodes!=null&&mirrorNodes.length>0){
            var nodeContent = node.getContent();
            // AQUI
            DScaffolding.syncNodes(mirrorNodes,{title:nodeContent},changeList);
          }
        }
        var mirrorNodes = Nodes.templateNodes.DECIDE_REQUIREMENTS_CAPTURE_IDEAS.getChildrenWithText(oldValue);
        if(mirrorNodes!=null&&mirrorNodes.length>0){
          var nodeContent = node.getContent();
          DScaffolding.syncNodes(mirrorNodes,{title:nodeContent},changeList);
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.onRemoved(function(removedNodesBis,parentNode){
        var removedNodes = DScaffolding.filterNodesTemplate(removedNodesBis);
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        for(var i=0;i<removedNodes.length;i++){
          var mirrorNodesDes = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(removedNodes[i]);
          var mirrorNodesReq = Nodes.templateNodes.DECIDE_REQUIREMENTS_CAPTURE_IDEAS.getChildrenWithText(removedNodes[i]);
          var mirrorNodes = mirrorNodesDes.concat(mirrorNodesReq);
          if(mirrorNodes!=null&&mirrorNodes.length>0){
            for(var j=0;j<mirrorNodes.length;j++){
              Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[j].id,cl);
            }
          }
          // TO IMPROVE
          /*var evaluationInsertionPoint = Scrap.selectNodeWithText("Determine the purpose(s) of your evaluation(s)");
          if(evaluationInsertionPoint!=null){
            var hypothesisToRemove = DScaffolding.getChildsWithSubtext(evaluationInsertionPoint,"'"+removedNodes[i]+"' is hypothesized to be a consequence of ");
            for(var k=0;k<hypothesisToRemove.length;k++){
              promiseList.push(Mindmeister.removeIdea(mapID,hypothesisToRemove[k].id));
            }
          }*/
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },false,[Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.id]);
      Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.onRemoved(function(removedNodesBis,parentNode){
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        DScaffolding.syncDesignTheory(cl);
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },false);
    }

    //LESSEN CAUSES
    if(Nodes.templateNodes.LESSEN_CAUSES!=null){
      Nodes.templateNodes.LESSEN_CAUSES.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null)return;
        var addedNodeContent = addedNode.getContent();
        if(addedNodeContent=="Click icon to address it") return;
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();

        // CHILD OF SUPPORTING EVIDENCES
        if(parentNodeContent == "Supporting Evidences?") return;
      },true);
      Nodes.templateNodes.LESSEN_CAUSES.onIconEdited(function(node,icon){
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        var promiseList = [];
        var nodeContent = node.getContent();
        if(icon==Icons.enabled){
          DScaffolding.syncDesignTheory(cl);
          var insertionPoint = Nodes.templateNodes.REQ_REDUCE_CAUSES;
          if(insertionPoint!=null){
            DScaffolding.cloneNodeBis(node,insertionPoint.id,cl);
            var clickToAddressNode = node.getChildrenWithText("Click icon to address it");
            if(clickToAddressNode!=null&&clickToAddressNode.length==1){
              Mindmeister.removeIdea(Scrap.mapID,clickToAddressNode[0].id,cl)
              DScaffolding.removeTaskNode("Click icon to address '"+nodeContent+"'",cl);
              var nId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:"Who else addresses it?",style:Prompter.Styles.prompt},cl,true);
              DScaffolding.insertTaskNode("Who else addresses '"+nodeContent+"'?",nId,cl);
            }
            else{
              var nId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:"Who else addresses it?",style:Prompter.Styles.prompt},cl,true);
              DScaffolding.insertTaskNode("Who else addresses '"+nodeContent+"'?",nId,cl);
            }
          }

          var insertionPoint = Nodes.templateNodes.NON_FUNCTIONAL_REQUIREMENTS.getChildrenWithSubText("In the checklists below, tick any non-functional requirements");
          if(insertionPoint!=null&&insertionPoint.length>0){
            DScaffolding.cloneNodeBis(node,insertionPoint[0].id,cl);
          }
        }
        else if(icon==Icons.disabled){
          var mirrorNodesAlleviate = Nodes.templateNodes.DECIDE_REQUIREMENTS_CAPTURE_IDEAS.getChildrenWithText(nodeContent);
          var mirrorNodes = mirrorNodesAlleviate;

          var mirrorNodesAscertainCauses = Nodes.templateNodes.ASCERTAIN_CAUSES.getChildrenWithSubText(DScaffolding.unInvertPoles(nodeContent));
          var mirrorNodesDesignTheory = [];
          if(mirrorNodesAscertainCauses!=null&&mirrorNodesAscertainCauses.length>0){
            var originalContent = mirrorNodesAscertainCauses[0].getContent();
            var mirrorNodesDesignTheory = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(DScaffolding.unInvertPoles(originalContent));
          }

          for(var j=0;j<mirrorNodesDesignTheory.length;j++){
            mirrorNodes.push(DScaffolding.getPointToRemove(mirrorNodesDesignTheory[j]));
          }
          // BORRAR DESDE RAIZ EN DESIGN THEORY
          //var mirrorNodes = mirrorNodesAlleviate.concat(mirrorNodesDesignTheory);
          if(mirrorNodes!=null&&mirrorNodes.length>0){
            for(var i=0;i<mirrorNodes.length;i++){
              Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[i].id,cl);
            }
          }

          var whoElseAddressesNode = node.getChildrenWithText("Who else addresses it?");
          if(whoElseAddressesNode!=null&&whoElseAddressesNode.length>0){
            Mindmeister.removeIdea(Scrap.mapID,whoElseAddressesNode[0].id,cl);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.LESSEN_CAUSES.onChildEdited(function(node,oldValue){
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        DScaffolding.syncDesignTheory(cl);
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent=="Lessen Causes"){
          var mirrorNodes = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(oldValue);
          if(mirrorNodes!=null&&mirrorNodes.length>0){
            var nodeContent = node.getContent();
            DScaffolding.syncNodes(mirrorNodes,{title:nodeContent},cl);
          }
        }
        var mirrorNodes = Nodes.templateNodes.DECIDE_REQUIREMENTS_CAPTURE_IDEAS.getChildrenWithText(oldValue);
        if(mirrorNodes!=null&&mirrorNodes.length>0){
          var nodeContent = node.getContent();
          DScaffolding.syncNodes(mirrorNodes,{title:nodeContent},cl);
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.LESSEN_CAUSES.onRemoved(function(removedNodesBis,parentNode){
        var removedNodes = DScaffolding.filterNodesTemplate(removedNodesBis);
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        for(var i=0;i<removedNodes.length;i++){
          var mirrorNodesDes = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(removedNodes[i]);
          var mirrorNodesReq = Nodes.templateNodes.DECIDE_REQUIREMENTS_CAPTURE_IDEAS.getChildrenWithText(removedNodes[i]);
          var mirrorNodes = mirrorNodesDes.concat(mirrorNodesReq);
          if(mirrorNodes!=null&&mirrorNodes.length>0){
            for(var j=0;j<mirrorNodes.length;j++){
              Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[j].id,cl);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },false,[Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.id]);
      Nodes.templateNodes.LESSEN_CAUSES.onRemoved(function(removedNodesBis,parentNode){
        Scrap.showWorkingMessage();
        var cl = Mindmeister.ChangeList();
        DScaffolding.syncDesignTheory(cl);
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },false);
    }

    // PROBLEM AS SOLUTIONS
    if(Nodes.templateNodes.PROBLEM_AS_SOLUTIONS!=null){
      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList();
      var whoElseAddressesNodes = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(Prompter.Nodes.WHO_ELSE_ADDRESSES_IT.text);
      for(var i=0;i<whoElseAddressesNodes.length;i++){
        var relatedWorkNodes = whoElseAddressesNodes[i].getChildren();
        for(var j=0;j<relatedWorkNodes.length;j++){
          if(relatedWorkNodes[j].getChildrenWithText(Prompter.Nodes.WHAT_ARE_ITS_LIMITATIONS.text).length==0){
            Mindmeister.insertIdea(Scrap.mapID,relatedWorkNodes[j].id,{title:Prompter.Nodes.WHAT_ARE_ITS_LIMITATIONS.text,style:Prompter.Styles.prompt},cL);
          }
        }
      }
      Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
        if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
        else Scrap.hideWorkingMessage();
      })
      Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.onChildrenAdded(function(addedNodes){
        if(addedNodes==null||addedNodes.length==0) return;
        var addedNode = addedNodes[0];
        if(addedNode==null||addedNode.getContent()=="") return;
        var parentNode = addedNode.getParentNode();
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        if(parentNode.getContent()==Prompter.Nodes.WHAT_ARE_ITS_LIMITATIONS.text){
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
        }
        else if(parentNode.getContent()==Prompter.Nodes.WHO_ELSE_ADDRESSES_IT.text){
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:Prompter.Nodes.WHAT_ARE_ITS_LIMITATIONS.text,style:Prompter.Styles.prompt},cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },true);
      Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        if(removedNodes.length==0) return;
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent==Prompter.Nodes.WHAT_ARE_ITS_LIMITATIONS.text){
          if(parentNode.getChildren().length==0){
            Scrap.showWorkingMessage();
            var cL = new Mindmeister.ChangeList();
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt},cL);
            Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
              if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
              else Scrap.hideWorkingMessage();
            })
          }
        }
      });
    }

    // TOP LEVEL COMPONENTS
    // TO MODIFY - mas de una instancia en el mapa
    if(Nodes.templateNodes.ENUMERATE_TOP_LEVEL_COMPONENTS!=null){
      Nodes.templateNodes.ENUMERATE_TOP_LEVEL_COMPONENTS.onChildrenAdded(function(addedNodes){
        if(addedNodes==null||addedNodes.length==0) return;
        var addedNode = addedNodes[0];
        var addedNodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();

        // CHILD OF SUPPORTING EVIDENCES
        if(parentNodeContent == Prompter.Nodes.SUPPORTING_EVIDENCES.text) return;
        if(!addedNode.hasAncestor(Nodes.templateNodesText.ENUMERATE_TOP_LEVEL_COMPONENTS)) return;
        if(addedNodeContent==Prompter.Nodes.WHICH_HOW_DOES_IT_ADDRESS.text) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();

        if(parentNodeContent==Nodes.templateNodesText.ENUMERATE_TOP_LEVEL_COMPONENTS){
          if(Utils.backgroundColorToHex(parentNode.getHTMLElement().style.backgroundColor)==Prompter.Styles.prompt.backgroundColor){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
          }
          var templateNodeId = Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:Prompter.Nodes.WHICH_HOW_DOES_IT_ADDRESS.text,style:Prompter.Styles.prompt},cL,true);
          DScaffolding.insertTaskNode('Which "How" does \''+addedNodeContent+"' address?",templateNodeId,cL);

          // PROPAGAR A EVALUACION
          DScaffolding.cloneNodeBis(addedNode,Nodes.templateNodes.DETERMINE_CHARACTERISE_COMPONENTS.id,cL);
        }
        if(parentNodeContent!=null&&parentNodeContent==Prompter.Nodes.WHICH_HOW_DOES_IT_ADDRESS.text){
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
          var grandParentNode = parentNode.getParentNode();
          var grandParentNodeContent = grandParentNode.getContent();
          DScaffolding.removeTaskNode('Which "How" does \''+grandParentNodeContent+"' address?",cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0) Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      // TO MODIFY mas de una instancia en el mapa
      Nodes.templateNodes.ENUMERATE_TOP_LEVEL_COMPONENTS.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent!=Nodes.templateNodesText.ENUMERATE_TOP_LEVEL_COMPONENTS&&!parentNode.hasAncestor(Nodes.templateNodesText.ENUMERATE_TOP_LEVEL_COMPONENTS)) return;
        var cL = new Mindmeister.ChangeList();
        Scrap.showWorkingMessage();
        if(parentNodeContent==Nodes.templateNodesText.ENUMERATE_TOP_LEVEL_COMPONENTS){
          var children = parentNode.getChildren();
          if(children==null||children.length==0){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt},cL);
          }
          for(var i=0;i<removedNodes.length;i++){
            var mirrorNodes = Nodes.templateNodes.DETERMINE_CHARACTERISE_COMPONENTS.getChildrenWithText(removedNodes[i]);
            if(mirrorNodes!=null&&mirrorNodes.length>0){
              for(var j=0;j<mirrorNodes.length;j++){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[j].id,cL);
              }
            }
          }
        }
        else if(parentNodeContent==Prompter.Nodes.WHICH_HOW_DOES_IT_ADDRESS.text){
          var children = parentNode.getChildren();
          if(children==null||children.length==0){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt},cL);
            var compNode = parentNode.getParentNode();
            var compNodeContent = compNode.getContent();
            DScaffolding.insertTaskNode('Which "How" does \''+compNodeContent+"' address?",parentNode.id,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    // SET PROBLEM STATEMENT
    if(Nodes.templateNodes.SET_PROBLEM_STATEMENT!=null){
      Nodes.templateNodes.SET_PROBLEM_STATEMENT.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];

        // CHILD OF SUPPORTING EVIDENCES
        var parentNode = addedNode.getParentNode();
        if(parentNode!=null) var parentNodeContent = parentNode.getContent();
        if(parentNodeContent == "Supporting Evidences?") return;
        var aa = addedNode.getContent();
        var mirror = DScaffolding.Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(aa));
        var mov = DScaffolding.Nodes.templateNodes.PROBLEM_AS_DIFFICULTIES.getChildrenWithText(aa);
        if((mov==null||mov.length==0)&&(mirror!=null&&mirror.length>0)) return;

        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        DScaffolding.syncDesignTheory(cL);

        if(parentNodeContent == "Set Problem Statement"){
          var addedNodeContent = addedNode.getContent();
          var evaluationInsertionPoint = Scrap.getNodesWithText("Determine the purpose(s) of your evaluation(s)");
          if(evaluationInsertionPoint!=null&&evaluationInsertionPoint.length>0){
            var alleviateConsequencesNode = Scrap.selectNodeWithText("Alleviate Consequences");
            var lessenCausesNode = Scrap.selectNodeWithText("Lessen Causes");
            var causesSubtree = DScaffolding.filterSubtree(Nodes.templateNodes.LESSEN_CAUSES.getSubtree(false,null));
            var consSubtree = DScaffolding.filterSubtree(Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.getSubtree(false,null));
            var causes = [];
            var consequences = [];
            for(var i=0;i<causesSubtree.length;i++){
              causes = causes.concat(DScaffolding.getSubtreeLeaves(causesSubtree[i]));
            }
            for(var i=0;i<consSubtree.length;i++){
              consequences = consequences.concat(DScaffolding.getSubtreeLeaves(consSubtree[i]));
            }
            for(var i=0;i<causes.length;i++){
              var ideaParams = {
                title: "'"+causes[i].text+"' is hypothesized to be a cause of '"+addedNodeContent+"'. Test this out.",
                style: NODE_STYLES.template
              }
              Mindmeister.insertIdea(Scrap.mapID,evaluationInsertionPoint.id,ideaParams,cL);
            }
            for(var i=0;i<consequences.length;i++){
              var ideaParams = {
                title: "'"+consequences[i].text+"' is hypothesized to be a consequence of '"+addedNodeContent+"'. Test this out.",
                style: NODE_STYLES.template
              }
              Mindmeister.insertIdea(Scrap.mapID,evaluationInsertionPoint.id,ideaParams,cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },false);
      Nodes.templateNodes.SET_PROBLEM_STATEMENT.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        for(var i=0;i<removedNodes.length;i++){
          var mirrorNodes = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(removedNodes[i]);
          if(mirrorNodes!=null&&mirrorNodes.length>0){
            for(var j=0;j<mirrorNodes.length;j++){
              Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[j].id,cL);
            }
          }
          // TO IMPROVE
          var evaluationInsertionPoint = Scrap.getNodesWithText("Determine the purpose(s) of your evaluation(s)");
          if(evaluationInsertionPoint!=null&&evaluationInsertionPoint.length>0){
            var hypothesisToRemove1 = evaluationInsertionPoint[0].getChildrenWithSubText(" is hypothesized to be a cause of '"+removedNodes[i]+"'. Test this out.");
            var hypothesisToRemove2 = evaluationInsertionPoint[0].getChildsWithSubText(" is hypothesized to be a consequence of '"+removedNodes[i]+"'. Test this out.");
            var hypothesisToRemove = hypothesisToRemove1.concat(hypothesisToRemove2);
            for(var k=0;k<hypothesisToRemove.length;k++){
              Mindmeister.removeIdea(Scrap.mapID,hypothesisToRemove[k].id,cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
      Nodes.templateNodes.SET_PROBLEM_STATEMENT.onChildEdited(function(node,oldValue){
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        var nodeContent = node.getContent();
        var mirrorNodes = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(oldValue);
        if(mirrorNodes!=null&&mirrorNodes.length>0){
          DScaffolding.syncNodes(mirrorNodes,{title:nodeContent},cL);
        }
        var evaluationPurposesNode = Scrap.getNodesWithText("Determine the purpose(s) of your evaluation(s)");
        if(evaluationPurposesNode.length>0){
          var nodesToReplace = evaluationPurposesNode[0].getChildrenWithSubText("of '"+oldValue+"'. Test this out.");
          for(var i=0;i<nodesToReplace.length;i++){
            var newContent = nodesToReplace[i].getContent().replace(oldValue,nodeContent);
            DScaffolding.syncNodes([nodesToReplace[i]],{title:newContent},cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    if(Nodes.templateNodes.IDENTIFY_RISKS!=null){
      Nodes.templateNodes.IDENTIFY_RISKS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          var rephraseRisk = node.getChildrenWithText(Prompter.Nodes.REPHRASE_RISK.text);
          if(rephraseRisk==null||rephraseRisk.length==0){
            var rephraseNodeId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:Prompter.Nodes.REPHRASE_RISK.text,style:Prompter.Styles.prompt},cL,true);
            var riskName = nodeContent.split(".")[0];
            DScaffolding.insertTaskNode("Rephrase '"+riskName+"' risk for your organization/domain/artefact",rephraseNodeId,cL);
          }
        }
        else if(icon==Icons.disabled){
          var rephraseRisk = node.getChildrenWithText(Prompter.Nodes.REPHRASE_RISK.text);
          if(rephraseRisk!=null&&rephraseRisk.length>0){
            var rephrasedNode = rephraseRisk[0].getChildren();
            if(rephrasedNode!=null&&rephrasedNode.length>0){
              var mirrorNodes1 = Nodes.templateNodes.ANALYSE_RISKS.getChildrenWithText(rephrasedNode[0].getContent());
              var mirrorNodes2 = Nodes.templateNodes.DETERMINE_RISK_TREATMENTS.getChildrenWithText(rephrasedNode[0].getContent());
              var mirrorNodes = [];
              if(mirrorNodes1==null) mirrorNodes = mirrorNodes2;
              else if(mirrorNodes2==null) mirrorNodes = mirrorNodes1;
              else mirrorNodes = mirrorNodes1.concat(mirrorNodes2);
              for(var i=0;i<mirrorNodes.length;i++){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[i].id,cL);
              }
            }
            Mindmeister.removeIdea(Scrap.mapID,rephraseRisk[0].id,cL);
            var riskName = nodeContent.split(".")[0];
            DScaffolding.removeTaskNode("Rephrase '"+riskName+"' risk for your organization/domain/artefact",cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.IDENTIFY_RISKS.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null) return;
        var nodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent!=Prompter.Nodes.REPHRASE_RISK.text) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        var nodeId = DScaffolding.cloneNodeBis(addedNode,Nodes.templateNodes.ANALYSE_RISKS.id,cL);
        var significanceNodeId = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.text,style:Prompter.Styles.prompt},cL);
        DScaffolding.insertTaskNode("Determine Significance/Cost for '"+nodeContent+"'",significanceNodeId,cL);
        for(var i=0;i<Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.length;i++){
          Mindmeister.insertIdea(Scrap.mapID,significanceNodeId,{title:Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options[i],style:Prompter.Styles.prompt_completed,icon:Icons.disabled},cL);
        }
        var probNodeId = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.text,style:Prompter.Styles.prompt},cL);
        DScaffolding.insertTaskNode("Determine Likelihood for '"+nodeContent+"'",probNodeId,cL);
        for(var i=0;i<Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.length;i++){
          Mindmeister.insertIdea(Scrap.mapID,probNodeId,{title:Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options[i],style:Prompter.Styles.prompt_completed,icon:Icons.disabled},cL);
        }

        var nodeId2 = DScaffolding.cloneNodeBis(addedNode,Nodes.templateNodes.DETERMINE_RISK_TREATMENTS.id,cL);
        Mindmeister.insertIdea(Scrap.mapID,nodeId2,{title:Prompter.Nodes.APPROPRIATE_RISK_TREATMENT_STRATEGY.text,style:Prompter.Styles.prompt},cL)
        Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed});

        var grandParentNode = parentNode.getParentNode();
        var grandParentNodeContent = grandParentNode.getContent();
        var riskName = grandParentNodeContent.split(".")[0];
        DScaffolding.removeTaskNode("Rephrase '"+riskName+"' risk for your organization/domain/artefact",cL);

        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
    }
    // TODO -> REMOVE

    if(Nodes.templateNodes.ANALYSE_RISKS!=null){
      Nodes.templateNodes.ANALYSE_RISKS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.disabled){
          var risk = node.getParentNode().getParentNode();
          var probCont = risk.getChildrenWithText(Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.text)[0];
          // TO TREAT ERROR
          var prob = probCont.getChildrenWithIcon(Icons.enabled);
          var signCont = risk.getChildrenWithText(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.text)[0];
          // TO TREAT ERROR
          var sign = signCont.getChildrenWithIcon(Icons.enabled);
          if((Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1&&sign.length<=0)||(Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent)!=-1&&prob.length<=0)){
            var parentNode = node.getParentNode();
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt},cL);
            var grandParentNode = parentNode.getParentNode();
            var grandParentNodeContent = grandParentNode.getContent();
            var taskNodeText = Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1 ? "Determine Significance/Cost for " : "Determine Likelihood for ";
            taskNodeText += "'"+grandParentNodeContent+"'";
            DScaffolding.insertTaskNode(taskNodeText,parentNode.id,cL);
            var riskMirror = Nodes.templateNodes.DETERMINE_RISK_TREATMENTS.getChildrenWithText(grandParentNodeContent);
            if(riskMirror!=null&&riskMirror.length>0){
              var treatmentStrategyNode = riskMirror[0].getChildrenWithText(Prompter.Nodes.APPROPRIATE_RISK_TREATMENT_STRATEGY.text);
              if(treatmentStrategyNode!=null&&treatmentStrategyNode.length>0){
                Mindmeister.modifyIdea(Scrap.mapID,treatmentStrategyNode[0].id,{style:Prompter.Styles.prompt},cL);
                var treatmentNodes = treatmentStrategyNode[0].getChildren();
                if(treatmentNodes!=null&&treatmentNodes.length>0){
                  Mindmeister.removeIdea(Scrap.mapID,treatmentNodes[0].id,cL);
                }
              }
            }
          }
          var mirrorNodes = Nodes.templateNodes.PRIORITISE_RISKS.getChildrenWithText(risk.getContent());
          if(mirrorNodes!=null&&mirrorNodes.length>0){
            if(prob==null||sign==null||prob.length==0||sign.length==0){
              for(var i=0;i<mirrorNodes.length;i++){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[i].id,cL);
              }
            }
          }
        }
        else if(icon==Icons.enabled){
          if(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1||Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent)!=-1){
            var parentNode = node.getParentNode();
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
            var grandParentNode = parentNode.getParentNode();
            var grandParentNodeContent = grandParentNode.getContent();
            var taskNodeText = Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1 ? "Determine Significance/Cost for " : "Determine Likelihood for ";
            taskNodeText += "'"+grandParentNodeContent+"'";
            DScaffolding.removeTaskNode(taskNodeText,cL);
          }
          if(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1||Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent)!=-1){
            var risk = node.getParentNode().getParentNode();
            var probCont = risk.getChildrenWithText(Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.text)[0];
            // TO TREAT ERROR
            var prob = probCont.getChildrenWithIcon(Icons.enabled);
            var signCont = risk.getChildrenWithText(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.text)[0];
            // TO TREAT ERROR
            var sign = signCont.getChildrenWithIcon(Icons.enabled);

            //var probGrade = Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(prob[0].getContent());
            //var signGrade = Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(sign[0].getContent());
            var probGrade = prob!=null&&prob.length>0 ? Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(prob[0].getContent()) : -1;
            var signGrade = sign!=null&&sign.length>0 ? Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(sign[0].getContent()) : -1;

            if(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1) signGrade = Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent);
            if(Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent)!=-1) probGrade = Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent);

            if(probGrade>-1&&signGrade>-1){
              var riskTreatment;
              if(probGrade<=2&&signGrade<=2){
                riskTreatment = "Self-Insurance";
              }
              else if(probGrade<=2&&signGrade>2){
                riskTreatment = "Transfer";
              }
              else if(probGrade>2&&signGrade<=2){
                riskTreatment = "Self-Protect";
              }
              else if(probGrade>2&&signGrade>2){
                riskTreatment = "Avoidance";
              }
              var riskT = Nodes.templateNodes.DETERMINE_RISK_TREATMENTS.getChildrenWithText(risk.getContent())[0];
              var riskTCont = riskT.getChildrenWithText(Prompter.Nodes.APPROPRIATE_RISK_TREATMENT_STRATEGY.text);
              if(riskTCont!=null&&riskTCont.length>0) var riskTreatmentList = riskTCont[0].getChildren();
              if(riskTreatmentList!=null&&riskTreatmentList.length>0){
                //var promiseList = [];
                var found = false;
                for(var i=0;i<riskTreatmentList.length;i++){
                  if(riskTreatmentList[i].getContent()!=riskTreatment){
                    Mindmeister.removeIdea(Scrap.mapID,riskTreatmentList[i].id,cL);
                  }
                  else found = true;
                }
                if(!found){
                  Mindmeister.insertIdea(Scrap.mapID,riskTCont[0].id,{title:riskTreatment,style:NODE_STYLES.template},cL);
                  Mindmeister.modifyIdea(Scrap.mapID,riskTCont[0].id,{style:Prompter.Styles.prompt_completed},cL);
                }
              }
              else{
                Mindmeister.insertIdea(Scrap.mapID,riskTCont[0].id,{title:riskTreatment,style:NODE_STYLES.template},cL);
                Mindmeister.modifyIdea(Scrap.mapID,riskTCont[0].id,{style:Prompter.Styles.prompt_completed},cL);
              }
            }
          }
          if(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1){
            var risk = node.getParentNode().getParentNode();
            var probCont = risk.getChildrenWithText(Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.text)[0];
            // TO TREAT ERROR
            var prob = probCont.getChildrenWithIcon(Icons.enabled);
            if(prob!=null&&prob.length>0){
              var sign = node.getParentNode().getChildrenWithIcon(Icons.enabled);
              if(sign.length>1){
                //var pL = [];
                for(var i=0;i<sign.length;i++){
                  if(sign[i].getContent()!=nodeContent){
                    var nodeToChange = node.getParentNode().getChildrenWithText(sign[i].getContent())[0];
                    Mindmeister.modifyIdea(Scrap.mapID,nodeToChange.id,{icon:Icons.disabled},cL);
                  }
                }
              }
              var probGrade = Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(prob[0].getContent());
              var signGrade = Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent);
              var totalGrade = probGrade*signGrade;
              var destinationNode;
              if(totalGrade>=0&&totalGrade<4) destinationNode = Nodes.templateNodes.ANALYSED_RISK_LIST_LOW;
              else if(totalGrade>=4&&totalGrade<=12) destinationNode = Nodes.templateNodes.ANALYSED_RISK_LIST_MEDIUM;
              else if(totalGrade>12) destinationNode = Nodes.templateNodes.ANALYSED_RISK_LIST_HIGH;
              if(destinationNode!=null){
                var mirrorNodes = Nodes.templateNodes.PRIORITISE_RISKS.getChildrenWithText(risk.getContent());
                if(mirrorNodes!=null&&mirrorNodes.length>0){
                  for(var i=0;i<mirrorNodes.length;i++){
                    Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[i].id,cL);
                  }
                }
                DScaffolding.cloneNodeBis(risk,destinationNode.id,cL);
              }
            }
          }
          else if(Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent)!=-1){
            var risk = node.getParentNode().getParentNode();
            var signCont = risk.getChildrenWithText(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.text)[0];
            // TO TREAT ERROR
            var sign = signCont.getChildrenWithIcon(Icons.enabled);
            if(sign!=null&&sign.length>0){
              var prob = node.getParentNode().getChildrenWithIcon(Icons.enabled);
              if(prob.length>1){
                for(var i=0;i<prob.length;i++){
                  if(prob[i].getContent()!=nodeContent){
                    var nodeToChange = node.getParentNode().getChildrenWithText(prob[i].getContent())[0];
                    Mindmeister.modifyIdea(Scrap.mapID,nodeToChange.id,{icon:Icons.disabled},cL);
                  }
                }
              }
              var signGrade = Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(sign[0].getContent());
              var probGrade = Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent);
              var totalGrade = probGrade*signGrade;
              var destinationNode;
              if(totalGrade>=0&&totalGrade<4) destinationNode = Nodes.templateNodes.ANALYSED_RISK_LIST_LOW;
              else if(totalGrade>=4&&totalGrade<=12) destinationNode = Nodes.templateNodes.ANALYSED_RISK_LIST_MEDIUM;
              else if(totalGrade>12) destinationNode = Nodes.templateNodes.ANALYSED_RISK_LIST_HIGH;
              if(destinationNode!=null){
                var mirrorNodes = Nodes.templateNodes.PRIORITISE_RISKS.getChildrenWithText(risk.getContent());
                if(mirrorNodes!=null&&mirrorNodes.length>0){
                  for(var i=0;i<mirrorNodes.length;i++){
                    Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[i].id,cL);
                  }
                }
                DScaffolding.cloneNodeBis(risk,destinationNode.id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.ANALYSE_RISKS.onRemoved(function(removedNodes){
        var cL = new Mindmeister.ChangeList();
        Scrap.showWorkingMessage();
        for(var i=0;i<removedNodes.length;i++){
          var mirrorNodes1 = Nodes.templateNodes.PRIORITISE_RISKS.getChildrenWithText(removedNodes[i]);
          var mirrorNodes2 = Nodes.templateNodes.DETERMINE_RISK_TREATMENTS.getChildrenWithText(removedNodes[i]);
          var mirrorNodes = mirrorNodes1.concat(mirrorNodes2);
          if(mirrorNodes!=null&&mirrorNodes.length>0){
            for(var j=0;j<mirrorNodes.length;j++){
              Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[j].id,cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    if(Nodes.templateNodes.IDENTIFY_STAKEHOLDERS!=null){
      Nodes.templateNodes.IDENTIFY_STAKEHOLDERS.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];

        // CHILD OF SUPPORTING EVIDENCES
        var parentNode = addedNode.getParentNode();
        if(parentNode!=null) var parentNodeContent = parentNode.getContent();
        if(parentNodeContent==Prompter.Nodes.SUPPORTING_EVIDENCES.text) return;

        var parentList = ["Add Client(s)","Add Decision Maker(s)","Add Professional(s)","Add Witness(es)"];
        if(parentList.indexOf(parentNodeContent)==-1) return;

        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        var addedNodeContent = addedNode.getContent();

        var options = [
          {
            title: "Absolute",
            icon: "status_error",
            style: NODE_STYLES.template
          },
          {
            title: "High",
            icon: "status_error",
            style: NODE_STYLES.template
          },
          {
            title: "Medium",
            icon: "status_error",
            style: NODE_STYLES.template
          },
          {
            title: "Low",
            icon: "status_error",
            style: NODE_STYLES.template
          },
          {
            title: "None",
            icon: "status_error",
            style: NODE_STYLES.template
          }
        ]
        var options2 = [
          {
            title: "Strong",
            icon: "status_error",
            style: NODE_STYLES.template
          },
          {
            title: "Medium",
            icon: "status_error",
            style: NODE_STYLES.template
          },
          {
            title: "Weak",
            icon: "status_error",
            style: NODE_STYLES.template
          },
          {
            title: "None",
            icon: "status_error",
            style: NODE_STYLES.template
          }
        ]
        var options3 = [
          {
            title: "High",
            icon: "status_error",
            style: NODE_STYLES.template
          },
          {
            title: "Medium",
            icon: "status_error",
            style: NODE_STYLES.template
          },
          {
            title: "Low",
            icon: "status_error",
            style: NODE_STYLES.template
          },
          {
            title: "None",
            icon: "status_error",
            style: NODE_STYLES.template
          }
        ]
        var nodeToInsert = {
          title: addedNodeContent,
          parentNodeId: Nodes.templateNodes.ANALYSE_STAKEHOLDERS.id,
          link: "topic:"+addedNode.id,
          style: NODE_STYLES.template,
          closed: true,
          children: [
            {
              title: "Assess Stakeholder Power",
              style: NODE_STYLES.template,
              children: [
                {
                  title: "Assess Level of Coercive Power",
                  style: Prompter.Styles.prompt,
                  children: options,
                  task: "Assess Level of Coercive Power for '"+addedNodeContent+"'"
                },
                {
                  title: "Assess Level of Normative Power",
                  style: Prompter.Styles.prompt,
                  children: options,
                  task: "Assess Level of Normative Power for '"+addedNodeContent+"'"
                },
                {
                  title: "Assess Level of Utilitarian Power",
                  style: Prompter.Styles.prompt,
                  children: options,
                  task: "Assess Level of Utilitarian Power for '"+addedNodeContent+"'"
                }
              ]
            },
            {
              title: "Assess Stakeholder Legitimacy",
              style: NODE_STYLES.template,
              children: [
                {
                  title: "Assess Level of Legal Legitimacy",
                  style: NODE_STYLES.template,
                  children: [
                    {
                      title: "Identify the property or right",
                      style: Prompter.Styles.prompt,
                      task: "Identify the property or right of the level of legal legitimacy for '"+addedNodeContent+"'"
                    }
                  ]
                },
                {
                  title: "Assess Level of Contractual Legitimacy",
                  style: NODE_STYLES.template,
                  children: [
                    {
                      title: "Identify the property or right",
                      style: Prompter.Styles.prompt,
                      task: "Identify the property or right of the level of contractual legitimacy for '"+addedNodeContent+"'"
                    }
                  ]
                },
                {
                  title: "Assess Level of Customary Legitimacy",
                  style: Prompter.Styles.prompt,
                  children: options2,
                  task: "Assess Level of Customary Legitimacy for '"+addedNodeContent+"'"
                },
                {
                  title: "Assess Level of Moral Legitimacy",
                  style: Prompter.Styles.prompt,
                  children: options,
                  task: "Assess Level of Moral Legitimacy for '"+addedNodeContent+"'"
                }
              ]
            },
            {
              title: "Assess Stakeholder Urgency",
              style: NODE_STYLES.template,
              children: [
                {
                  title: "Assess the Time Sensitivity",
                  style: Prompter.Styles.prompt,
                  children: options3,
                  task: "Assess the Time Sensitivity for '"+addedNodeContent+"'"
                },
                {
                  title: "Assess the Criticality",
                  style: Prompter.Styles.prompt,
                  children: options3,
                  task: "Assess the Criticality for '"+addedNodeContent+"'"
                }
              ]
            }
          ]
        };
        Mindmeister.insertSubtree(nodeToInsert,cL);
        var intendedUsers = Scrap.selectNodeWithSubtext("Intended user(s)");
        for(var i=0;i<intendedUsers.length;i++){
          Mindmeister.cloneNodeBis(addedNode,intendedUsers[i].id,cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })


        /*Mindmeister.doChanges(MAP_CHANGES.concat(START_HERE_CHANGELIST)).then(function(ret){
          var nodesToChange = ret.responses;
          replaceNodeIdsBis(nodesToChange);
          updateLinkings().then(function(){
            ANALYSE_STAKEHOLDERS_CHANGELIST = ANALYSE_STAKEHOLDERS_CHANGELIST.concat(MAP_CHANGES);
            MAP_CHANGES = [];
            var mapID = Scrap.selectMapId();
            var startHereNode = Scrap.selectNodeWithText("Start Here!")
            Mindmeister.modifyIdea(mapID,analyseStakeholdersNode.id,{icon:"emoji/symbols-arrows_counterclockwise"}).then(function(){
              Mindmeister.modifyIdea(mapID,startHereNode.id,{icon:"emoji/symbols-arrows_counterclockwise"}).then(function(){
                Promise.all(pLL).then(function(){
                  reloadCanvas();
                  addReloadListener();
                  addReloadListenerStartHere();
                  closeNodesInApi();
                })
              })
            })
          })
        });*/
      },true);
      Nodes.templateNodes.IDENTIFY_STAKEHOLDERS.onRemoved(function(removedNodesBis,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        var parentList = ["Add Client(s)","Add Decision Maker(s)","Add Professional(s)","Add Witness(es)"];
        if(parentList.indexOf(parentNodeContent)==-1) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        for(var i=0;i<removedNodesBis.length;i++){
          var analysedStakeholders = Nodes.templateNodes.ANALYSE_STAKEHOLDERS.getChildren();
          for(var j=0;j<analysedStakeholders.length;j++){
            if(analysedStakeholders[j].getContent() == removedNodesBis[i]){
              Mindmeister.removeIdea(Scrap.mapID,analysedStakeholders[j].id,cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    if(Nodes.templateNodes.ANALYSE_STAKEHOLDERS!=null){
      Nodes.templateNodes.ANALYSE_STAKEHOLDERS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        var parentList = ["Assess Level of Coercive Power","Assess Level of Utilitarian Power","Assess Level of Normative Power","Assess Level of Customary Legitimacy","Assess Level of Moral Legitimacy","Assess the Time Sensitivity","Assess the Criticality"];
        if(parentList.indexOf(parentNodeContent)==-1) return;
        var stakeholderNode = parentNode.getParentNode().getParentNode();
        var stakeholder = stakeholderNode.getContent();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          Scrap.showWorkingMessage();
          var first = DScaffolding.deactivateOldActiveChildren(parentNode,nodeContent,cL);
          if(first){
            var taskText = parentNodeContent+" for '"+stakeholder+"'";
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
            DScaffolding.removeTaskNode(taskText,cL);
          }
        }
        else if(icon==Icons.disabled){
          var activeChildren = parentNode.getChildrenWithIcon(Icons.enabled);
          if(activeChildren.length>0) return;
          Scrap.showWorkingMessage();
          if(Utils.backgroundColorToHex(parentNode.getHTMLElement().style.backgroundColor)!=Prompter.Styles.prompt/*"rgb(230, 124, 115)"*/){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt},cL);
            var taskText = parentNodeContent+" for '"+stakeholder+"'";
            DScaffolding.insertTaskNode(taskText,parentNode.id,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })

      Nodes.templateNodes.ANALYSE_STAKEHOLDERS.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null) return;
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent != "Identify the property or right") return;
        if(Utils.backgroundColorToHex(parentNode.getHTMLElement().style.backgroundColor) != Prompter.Styles.prompt.backgroundColor) return;
        var grandParentNode = parentNode.getParentNode();
        var grandParentNodeContent = grandParentNode.getContent();
        var stakeholderNode = grandParentNode.getParentNode().getParentNode();
        var stakeholder = stakeholderNode.getContent();
        var taskText = "Identify the property or right of the level of ";
        if(grandParentNodeContent=="Assess Level of Contractual Legitimacy") taskText += "contractual";
        else if(grandParentNodeContent=="Assess Level of Legal Legitimacy") taskText += "legal";
        else return;
        taskText += " legitimacy for '"+stakeholder+"'";
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList()
        DScaffolding.removeTaskNode(taskText,cL);
        Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      Nodes.templateNodes.ANALYSE_STAKEHOLDERS.onRemoved(function(removedNodesBis,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent!="Identify the property or right") return;
        if(Utils.backgroundColorToHex(parentNode.getHTMLElement().style.backgroundColor)==Prompter.Styles.prompt.backgroundColor) return;
        var numChildren = parentNode.getChildren();
        if(numChildren!=null&&numChildren.length>0) return;
        var grandParentNode = parentNode.getParentNode();
        var grandParentNodeContent = grandParentNode.getContent();
        var stakeholderNode = grandParentNode.getParentNode().getParentNode();
        var stakeholder = stakeholderNode.getContent();
        var taskText = "Identify the property or right of the level of ";
        if(grandParentNodeContent=="Assess Level of Contractual Legitimacy") taskText += "contractual";
        else if(grandParentNodeContent=="Assess Level of Legal Legitimacy") taskText += "legal";
        else return;
        taskText += " legitimacy for '"+stakeholder+"'";
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        DScaffolding.insertTaskNode(taskText,parentNode.id,cL);
        Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt},cL);
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    if(Nodes.templateNodes.TIME_CONSTRAINTS_ENOUGH!=null){
      Nodes.templateNodes.TIME_CONSTRAINTS_ENOUGH.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          var a = ["Severely limited time"];
          if(a.indexOf(nodeContent)!=-1){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var insertionPoint = lag[i].getChildrenWithText("Research Constraints");
              if(insertionPoint!=null&&insertionPoint.length>0){
                Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Overcome '"+nodeContent+"'",link:"topic:"+node.id,style:NODE_STYLES.template},cL);
              }
            }
          }
          if(nodeContent=="Severely limited time"){
            var aux = Scrap.getNodesWithText("Quick and Simple Strategy");
            for(var i=0;i<aux.length;i++){
              Mindmeister.modifyIdea(Scrap.mapID,aux[i].id,{icon:Icons.enabled},cL);
            }
          }
          DScaffolding.deactivateOldActiveChildren(Nodes.templateNodes.TIME_CONSTRAINTS_ENOUGH,nodeContent,cL);
        }
        else if(icon==Icons.disabled){
          var a = ["Severely limited time"];
          if(a.indexOf(nodeContent)!=-1){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var mirrorNodes = lag[i].getChildrenWithText("Overcome '"+nodeContent+"'");
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[0].id,cL);
              }
            }
          }
          if(nodeContent=="Severely limited time"){
            var aux = Scrap.getNodesWithText("Quick and Simple Strategy");
            for(var i=0;i<aux.length;i++){
              Mindmeister.modifyIdea(Scrap.mapID,aux[i].id,{icon:Icons.disabled},cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    if(Nodes.templateNodes.FUNDING_CONSTRAINTS_ENOUGH!=null){
      Nodes.templateNodes.FUNDING_CONSTRAINTS_ENOUGH.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          var a = ["Severely limited funding"];
          if(a.indexOf(nodeContent)!=-1){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var insertionPoint = lag[i].getChildrenWithText("Research Constraints");
              if(insertionPoint!=null&&insertionPoint.length>0){
                Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Overcome '"+nodeContent+"'",link:"topic:"+node.id,style:NODE_STYLES.template},cL);
              }
            }

          }
          DScaffolding.deactivateOldActiveChildren(Nodes.templateNodes.FUNDING_CONSTRAINTS_ENOUGH,nodeContent,cL)
        }
        else if(icon==Icons.disabled){
          var a = ["Severely limited funding"];
          if(a.indexOf(nodeContent)!=-1){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var mirrorNodes = lag[i].getChildrenWithText("Overcome '"+nodeContent+"'");
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[0].id,cL)
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    if(Nodes.templateNodes.SOFTWARE_HARDWARE_ACCESS!=null){
      Nodes.templateNodes.SOFTWARE_HARDWARE_ACCESS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          if(nodeContent=="Maybe can get access"){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var insertionPoint = lag[i].getChildrenWithText("Research Constraints");
              if(insertionPoint!=null&&insertionPoint.length>0){
                Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Overcome 'maybe can get access to needed hardware and/or software'",link:"topic:"+node.id,style:NODE_STYLES.template},cL);
              }
            }
          }
          DScaffolding.deactivateOldActiveChildren(Nodes.templateNodes.SOFTWARE_HARDWARE_ACCESS,nodeContent,cL);
        }
        else if(icon==Icons.disabled){
          if(nodeContent=="Maybe can get access"){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var mirrorNodes = lag[i].getChildrenWithText("Overcome 'maybe can get access to needed hardware and/or software'");
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[0].id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    if(Nodes.templateNodes.DO_YOU_NEED_ACCESS_ORGANISATION!=null&&Nodes.templateNodes.ORGANISATION_ACCESS!=null){
      Nodes.templateNodes.DO_YOU_NEED_ACCESS_ORGANISATION.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          if(nodeContent=="Definitely"||nodeContent=="Maybe"){
            var lag = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("What or how many organisations would you need to have access to?");
            if(lag==null||lag.length==0){
              Mindmeister.insertIdea(Scrap.mapID,Nodes.templateNodes.ORGANISATION_ACCESS.id,{title:"What or how many organisations would you need to have access to?",style:NODE_STYLES.template},cL);
              var nId = Mindmeister.insertIdea(Scrap.mapID,Nodes.templateNodes.ORGANISATION_ACCESS.id,{title:"Do you already have access?",style:NODE_STYLES.template},cL);
              Mindmeister.insertIdea(Scrap.mapID,nId,{title:"Definitely",style:NODE_STYLES.template,icon:Icons.disabled},cL);
              Mindmeister.insertIdea(Scrap.mapID,nId,{title:"Maybe",style:NODE_STYLES.template,icon:Icons.disabled},cL);
              Mindmeister.insertIdea(Scrap.mapID,nId,{title:"No",style:NODE_STYLES.template,icon:Icons.disabled},cL);
            }
          }
          else if(nodeContent=="No"){
            var orgNumber = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("What or how many organisations would you need to have access to?");
            if(orgNumber!=null&&orgNumber.length>0) Mindmeister.removeIdea(Scrap.mapID,orgNumber[0].id,cL);
            var alreadyAccess = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Do you already have access?");
            if(alreadyAccess!=null&&alreadyAccess.length>0) Mindmeister.removeIdea(Scrap.mapID,alreadyAccess[0].id,cL);
            var canGetAccess = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Can you get access?");
            if(canGetAccess!=null&&canGetAccess.length>0) Mindmeister.removeIdea(Scrap.mapID,canGetAccess[0].id,cL);
          }
          DScaffolding.deactivateOldActiveChildren(Nodes.templateNodes.DO_YOU_NEED_ACCESS_ORGANISATION,nodeContent,cL);
        }
        else if(icon==Icons.disabled){
          var activeChildren = Nodes.templateNodes.DO_YOU_NEED_ACCESS_ORGANISATION.getChildrenWithIcon(Icons.enabled);
          var getActiveChildrenContent = function(c){
            return c.getContent();
          }
          if(activeChildren.length==0||(activeChildren.length==1&&activeChildren.map(getActiveChildrenContent).indexOf("No")!=-1)){
            var orgNumber = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("What or how many organisations would you need to have access to?");
            if(orgNumber!=null&&orgNumber.length>0) Mindmeister.removeIdea(Scrap.mapID,orgNumber[0].id,cL);
            var alreadyAccess = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Do you already have access?");
            if(alreadyAccess!=null&&alreadyAccess.length>0) Mindmeister.removeIdea(Scrap.mapID,alreadyAccess[0].id,cL);
            var canGetAccess = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Can you get access?");
            if(canGetAccess!=null&&canGetAccess.length>0) Mindmeister.removeIdea(Scrap.mapID,canGetAccess[0].id,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.ORGANISATION_ACCESS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent!="Do you already have access?") return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          if(nodeContent=="No"||nodeContent=="Maybe"){
            var lag = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Can you get access?");
            if(lag==null||lag.length==0){
              var nId = Mindmeister.insertIdea(Scrap.mapID,Nodes.templateNodes.ORGANISATION_ACCESS.id,{title:"Can you get access?",style:NODE_STYLES.template},cL);
              Mindmeister.insertIdea(Scrap.mapID,nId,{title:"Definitely",style:NODE_STYLES.template,icon:Icons.disabled},cL);
              Mindmeister.insertIdea(Scrap.mapID,nId,{title:"Maybe can get access",style:NODE_STYLES.template,icon:Icons.disabled},cL);
              Mindmeister.insertIdea(Scrap.mapID,nId,{title:"Unlikely (change scope!)",style:NODE_STYLES.template,icon:Icons.disabled},cL);
            }
          }
          else if(nodeContent=="Definitely"){
            var canGetAccess = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Can you get access?");
            if(canGetAccess!=null&&canGetAccess.length>0) Mindmeister.removeIdea(Scrap.mapID,canGetAccess[0].id,cL);
          }
          DScaffolding.deactivateOldActiveChildren(parentNode,nodeContent,cL);
        }
        else if(icon==Icons.disabled){
          var activeChildren = parentNode.getChildrenWithIcon(Icons.enabled);
          var getActiveChildrenContent = function(c){
            return c.getContent();
          }
          if(activeChildren.length==0||(activeChildren.length==1&&activeChildren.map(getActiveChildrenContent).indexOf("Definitely")!=-1)){
            var canGetAccess = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Can you get access?");
            if(canGetAccess!=null&&canGetAccess.length>0) Mindmeister.removeIdea(Scrap.mapID,canGetAccess[0].id,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.ORGANISATION_ACCESS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(parentNodeContent!="Can you get access?") return;
        if(icon==Icons.enabled){
          DScaffolding.deactivateOldActiveChildren(parentNode,nodeContent,cL);
          if(nodeContent=="Maybe can get access"){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var insertionPoint = lag[i].getChildrenWithText("Research Constraints");
              if(insertionPoint!=null&&insertionPoint.length>0){
                Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Overcome 'maybe can get access to organisation for evaluation'",link:node.id,style:NODE_STYLES.template},cL);
              }
            }
          }
        }
        else if(icon==Icons.disabled){
          if(nodeContent=="Maybe can get access"){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var mirrorNodes = lag[i].getChildrenWithText("Overcome 'maybe can get access to organisation for evaluation'");
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[0].id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.ORGANISATION_ACCESS.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        var parentNodeContent = parentNode.getContent();
        for(var i=0;i<removedNodes.length;i++){
          if(removedNodes[i]=="Maybe can get access"){
            var pointToSearch = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var j=0;j<pointToSearch.length;j++){
              var nodeToRemove = pointToSearch[j].getChildrenWithText("Overcome 'maybe can get access to organisation for evaluation'");
              if(nodeToRemove!=null&&nodeToRemove.length>0){
                Mindmeister.removeIdea(Scrap.mapID,nodeToRemove[0].id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    if(Nodes.templateNodes.DO_YOU_HAVE_SUFFICIENT_SKILLS!=null){
      Nodes.templateNodes.DO_YOU_HAVE_SUFFICIENT_SKILLS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          DScaffolding.deactivateOldActiveChildren(Nodes.templateNodes.DO_YOU_HAVE_SUFFICIENT_SKILLS,nodeContent,cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    if(Nodes.templateNodes.CAN_YOU_OBTAIN_SKILLS!=null){
      Nodes.templateNodes.CAN_YOU_OBTAIN_SKILLS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          DScaffolding.deactivateOldActiveChildren(parentNode,nodeContent,cL);
          if(nodeContent=="Maybe"){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var insertionPoint = lag[i].getChildrenWithText("Research Constraints");
              if(insertionPoint!=null&&insertionPoint.length>0){
                Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Overcome 'maybe can learn and obtain sufficient skills to conduct the research'",link:"topic:"+node.id,style:NODE_STYLES.template},cL);
              }
            }
          }
        }
        else if(icon==Icons.disabled){
          if(nodeContent=="Maybe"){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var mirrorNodes = lag[i].getChildrenWithText("Overcome 'maybe can learn and obtain sufficient skills to conduct the research'");
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[0].id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    if(Nodes.templateNodes.IDENTIFY_FEASIBILITY_UNCERTAINTIES!=null){
      Nodes.templateNodes.IDENTIFY_FEASIBILITY_UNCERTAINTIES.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent!=Nodes.templateNodesText.IDENTIFY_FEASIBILITY_UNCERTAINTIES) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          var searchInNode = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
          for(var i=0;i<searchInNode.length;i++){
            var evaluationMirror = searchInNode[i].getChildrenWithSubText("'"+nodeContent+"'");
            if(evaluationMirror==null||evaluationMirror.length==0){
              var insertionPoint = searchInNode[i].getChildrenWithText("Feasibility Uncertainties");
              if(insertionPoint!=null&&insertionPoint.length>0){
                Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Ensure '"+nodeContent+"'",link:"topic:"+node.id,style:NODE_STYLES.template},cL);
              }
            }
          }
          var ofWhat = node.getChildrenWithText("Of what and in what way?");
          if(ofWhat==null||ofWhat.length==0){
            var nId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:"Of what and in what way?",style:Prompter.Styles.prompt},cL,true);
            DScaffolding.insertTaskNode("'"+nodeContent+"' of what and in what way?",nId,cL);
          }
          if(nodeContent=="Human usability"||nodeContent=="Organisational feasibility"){
            var nodeToEnable = Scrap.getNodesWithText("Human Risk and Effectiveness Strategy");
            for(var j=0;j<nodeToEnable.length;j++){
              Mindmeister.modifyIdea(Scrap.mapID,nodeToEnable[j].id,{icon:"status_ok"},cL);
            }
          }
          if(nodeContent=="Technical feasibility"){
            var nodeToEnable = Scrap.getNodesWithText("Technological Risk and Efficacy Strategy");
            for(var j=0;j<nodeToEnable.length;j++){
              Mindmeister.modifyIdea(Scrap.mapID,nodeToEnable[j].id,{icon:"status_ok"},cL);
            }
          }
        }
        else if(icon==Icons.disabled){
          var searchInNode = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
          for(var i=0;i<searchInNode.length;i++){
            var evaluationMirror = searchInNode[i].getChildrenWithSubText("'"+nodeContent+"'");
            if(evaluationMirror!=null&&evaluationMirror.length>0){
              for(var i=0;i<evaluationMirror.length;i++){
                Mindmeister.removeIdea(Scrap.mapID,evaluationMirror[i].id,cL);
              }
            }
          }
          var ofWhat = node.getChildrenWithText("Of what and in what way?");
          if(ofWhat!=null||ofWhat.length>0){
            Mindmeister.removeIdea(Scrap.mapID,ofWhat[0].id,cL);
          }
          if(nodeContent=="Human usability"||nodeContent=="Organisational feasibility"){
            DScaffolding.checkHumanRisk(cL);
          }
          if(nodeContent=="Technical feasibility"){
            DScaffolding.checkTechnicalRisk(cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.IDENTIFY_FEASIBILITY_UNCERTAINTIES.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null) return;
        var addedNodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();

        if(parentNodeContent != "Of what and in what way?") return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();

        var grandParentNode = parentNode.getParentNode();
        var grandParentNodeContent = grandParentNode.getContent();

        if(Utils.backgroundColorToHex(parentNode.getHTMLElement().style.backgroundColor)==Prompter.Styles.prompt.backgroundColor){
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
          DScaffolding.removeTaskNode("'"+grandParentNodeContent+"' of what and in what way?",cL);
        }

        var pointToSearch = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
        for(var i=0;i<pointToSearch.length;i++){
          var nodeToRemove = pointToSearch[i].getChildrenWithText("Ensure '"+grandParentNodeContent+"'");
          if(nodeToRemove!=null&&nodeToRemove.length>0) Mindmeister.removeIdea(Scrap.mapID,nodeToRemove[0].id,cL);
          var insertionPoint = pointToSearch[i].getChildrenWithText("Feasibility Uncertainties");
          if(insertionPoint!=null&&insertionPoint.length>0) Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Ensure '"+addedNodeContent+"' '"+grandParentNodeContent+"'",link:"topic:"+addedNode.id,style:NODE_STYLES.template},cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      Nodes.templateNodes.IDENTIFY_FEASIBILITY_UNCERTAINTIES.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent != "Of what and in what way?") return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();

        var pointToSearch = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
        for(var l=0;l<pointToSearch.length;l++){
          var insertionPoint = pointToSearch[l].getChildrenWithText("Feasibility Uncertainties");
          if(insertionPoint!=null&&insertionPoint.length>0){
            for(var i=0;i<removedNodes.length;i++){
              var searchRes = insertionPoint[0].getChildrenWithSubText("'"+removedNodes[i]+"'");
              if(searchRes!=null&&searchRes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,searchRes[0].id,cL);
              }
            }
          }
          var siblings = parentNode.getChildren();
          if(siblings==null||siblings.length==0){
            var grandParentNode = parentNode.getParentNode();
            var grandParentNodeContent = grandParentNode.getContent();
            if(insertionPoint!=null&&insertionPoint.length>0) Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Ensure '"+grandParentNodeContent+"'",link:"topic:"+grandParentNode.id,style:NODE_STYLES.template},cL);
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt},cL);
            // create task
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    if(Nodes.templateNodes.IDENTIFY_ETHICAL_CONSTRAINTS!=null){
      Nodes.templateNodes.IDENTIFY_ETHICAL_CONSTRAINTS.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null) return;
        var addedNodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();

        var possibleParentList = ["Animal research constraints? (List them)","Privacy constraints? (List them)","Human research subject constraints? (List them)","Organisational risk constraints? (List them)","Societal risk constraints? (List them)"];

        if(possibleParentList.indexOf(parentNodeContent)==-1) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();

        var pointToSearch = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");

        for(var i=0;i<pointToSearch.length;i++){
          var insertionPoint = pointToSearch[i].getChildrenWithText("Research Constraints");
          if(insertionPoint!=null&&insertionPoint.length>0) Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Overcome '"+addedNodeContent+"'",link:"topic:"+addedNode.id,style:NODE_STYLES.template},cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      Nodes.templateNodes.IDENTIFY_ETHICAL_CONSTRAINTS.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        var possibleParentList = ["Animal research constraints? (List them)","Privacy constraints? (List them)","Human research subject constraints? (List them)","Organisational risk constraints? (List them)","Societal risk constraints? (List them)"];
        if(possibleParentList.indexOf(parentNodeContent)==-1) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();

        var pointToSearch = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
        for(var l=0;l<pointToSearch.length;l++){
          var insertionPoint = pointToSearch[l].getChildrenWithText("Research Constraints");
          if(insertionPoint!=null&&insertionPoint.length>0){
            for(var i=0;i<removedNodes.length;i++){
              var searchRes = insertionPoint[0].getChildrenWithSubText("Overcome '"+removedNodes[i]+"'");
              if(searchRes!=null&&searchRes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,searchRes[0].id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    // DEFINE REQUIREMENTS AQUI
    if(Nodes.templateNodes.DECIDE_REQUIREMENTS_CAPTURE_IDEAS!=null){
      Nodes.templateNodes.DECIDE_REQUIREMENTS_CAPTURE_IDEAS.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null) return;
        var addedNodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();

        if(addedNodeContent==Prompter.Nodes.HOW.text) return;
        // CHILD OF SUPPORTING EVIDENCES
        if(parentNodeContent == Prompter.Nodes.SUPPORTING_EVIDENCES.text) return;

        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(parentNodeContent=="provide a name"||parentNodeContent=="provide a description"){
          var grandParentNode = parentNode.getParentNode();
          var nameLabel = grandParentNode.getChildrenWithText("provide a name");
          var descLabel = grandParentNode.getChildrenWithText("provide a description");
          var reqName, reqDesc, reqNameId, reqDescId;
          if(nameLabel!=null&&nameLabel.length>0){
            var nameLabelChildren = nameLabel[0].getChildren();
            if(nameLabelChildren!=null&&nameLabelChildren.length>0){
              reqName = nameLabelChildren[0].getContent();
              reqNameId = nameLabelChildren[0].id;
            }
          }
          if(descLabel!=null&&descLabel.length>0){
            var descLabelChildren = descLabel[0].getChildren();
            if(descLabelChildren!=null&&descLabelChildren.length>0){
              reqDesc = descLabelChildren[0].getContent();
              reqDescId = descLabelChildren[0].id;
            }
          }
          if(reqName!=null&&reqDesc!=null&&reqNameId!=null&&reqDescId!=null){
            var insertionPoint = grandParentNode.getParentNode();
            var nodeId = Mindmeister.insertIdea(Scrap.mapID,insertionPoint.id,{title:reqName,icon:Icons.disabled,style:NODE_STYLES.template},cL);
            Mindmeister.modifyIdea(Scrap.mapID,nodeId,{note:reqDesc},cL);
            Mindmeister.removeIdea(Scrap.mapID,reqNameId,cL);
            Mindmeister.removeIdea(Scrap.mapID,reqDescId,cL);
          }
        }
        else if(parentNodeContent!=null&&(parentNodeContent=="Requirements for Achieving purpose and benefits"||parentNodeContent=="Requirements for Reducing causes of the problem"||parentNodeContent=="In the checklists below, tick any non-functional requirements that are relevant to your artefact. Where alleviating causes from your problem as opportunities above can help, Copy&Paste the causes to be alleviated onto the how nodes for the relevant non-functional requirement below.")){
          var howNode = addedNode.getChildrenWithText(Prompter.Nodes.HOW.text);
          if(howNode==null||howNode.length==0){
            //promiseList.push(DScaffolding.syncDesignTheory());
            var howNodeId = Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:Prompter.Nodes.HOW.text,style:Prompter.Styles.prompt},cL,true);
            DScaffolding.insertTaskNode("How does '"+addedNodeContent+"' happen?",howNodeId,cL);
          }
        }
        else if(parentNodeContent!=null&&parentNodeContent==Prompter.Nodes.HOW.text){
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
          var grandParentNode = parentNode.getParentNode();
          var grandParentNodeContent = grandParentNode.getContent();
          DScaffolding.removeTaskNode("How does '"+grandParentNodeContent+"' happen?",cL);
          var howNode = addedNode.getChildrenWithText(Prompter.Nodes.HOW.text);
          if(howNode==null||howNode.length==0){
            var howNodeId = Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:Prompter.Nodes.HOW.text,style:Prompter.Styles.prompt},cL,true);
            DScaffolding.insertTaskNode("How does '"+addedNodeContent+"' happen?",howNodeId,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      Nodes.templateNodes.DECIDE_REQUIREMENTS_CAPTURE_IDEAS.onRemoved(function(removedNodesBis,parentNode){
        if(parentNode==null)return;
        // propagar borrado
        var grandParentNode = parentNode.getParentNode();
        var grandParentNodeContent = grandParentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(removedNodesBis.length==1&&removedNodesBis[0]==Prompter.Nodes.HOW.text&&grandParentNodeContent==Prompter.Nodes.HOW.text){
          var parentNodeContent = parentNode.getContent();
          DScaffolding.removeTaskNode("How does '"+parentNodeContent+"' happen?",cL);
          var insertionPoint = Scrap.getNodesWithSubText('Drag&Drop the "hows" from the requirements');
          if(insertionPoint!=null&&insertionPoint.length>0){
            for(var i=0;i<insertionPoint.length;i++){
              DScaffolding.cloneNodeBis(parentNode,insertionPoint[i].id,cL);
            }
          }
        }
        else{
          var nodesToRemove = [];
          for(var j=0;j<removedNodesBis.length;j++){
            if(removedNodesBis[j]==Prompter.Nodes.HOW.text) continue;

            var designArtefactNodes = Scrap.getNodesWithSubText('Design Purposeful Artefact');
            for(var i=0;i<designArtefactNodes.length;i++){
              var mirrorNodes = designArtefactNodes[i].getChildrenWithText(removedNodesBis[j]);
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                for(var k=0;k<mirrorNodes.length;k++) nodesToRemove.push(mirrorNodes[k].id);
              }
            }

            var mirrorNode = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(removedNodesBis[j]);
            if(mirrorNode==null) continue
            for(var k=0;k<mirrorNode.length;k++) nodesToRemove.push(mirrorNode[k].id);
          }
          for(var j=0;j<nodesToRemove.length;j++){
            Mindmeister.removeIdea(Scrap.mapID,nodesToRemove[j],cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.DECIDE_REQUIREMENTS_CAPTURE_IDEAS.onChildEdited(function(node,oldValue){
        /*showWorkingMessage();
        var nodeContent = Scrap.selectContent(node);
        var nodeAncestors = DScaffolding.getNodeAncestorsContent(node);
        var promiseList = [];
        var purposeListNode = Scrap.selectNodeWithText("Determine the purpose(s) of your evaluation(s)");
        if(purposeListNode==null) return;

        var textToFind = ["'"+oldValue+"' is hypothesized to be a consequence of","'"+oldValue+"' is hypothesized to be a cause of","issue being addressed through '"+oldValue+"'. Test this out."];
        if(nodeAncestors.indexOf("Non-functional")>-1){
          var reqType = nodeAncestors[nodeAncestors.indexOf("Non-functional")-2];
          textToFind.push("'"+oldValue+"' is a "+reqType+" issue being addressed through ");
        }
        else if(nodeAncestors.indexOf("Functional")>-1){
          textToFind.push("'"+oldValue+"' is a Functional issue being addressed through ");
        }
        for(var i=0;i<textToFind.length;i++){
          var mirrorNodes = DScaffolding.getChildsWithSubtext(purposeListNode,textToFind[i]);
          if(mirrorNodes!=null&&mirrorNodes.length>0){
            for(var j=0;j<mirrorNodes.length;j++){
              var newContent = Scrap.selectContent(mirrorNodes[j]).replace(oldValue,nodeContent);
              promiseList.push(DScaffolding.syncNodes([mirrorNodes[j]],{title:newContent}));
            }
          }
        }
        if(oldValue!="How?"){
          var nodeSubtree = DScaffolding.getNodeChildren(node.id);
          if(nodeSubtree==null||nodeSubtree.length==0){
            var purposefulArtefacts = Scrap.selectNodeWithSubtext("Design Purposeful Artefact");
            for(var i=0;i<purposefulArtefacts.length;i++){
              var mirrorNodes = DScaffolding.getChildsWithText(purposefulArtefacts[i],oldValue);
              if(mirrorNodes!=null&&mirrorNodes.length>0) promiseList.push(DScaffolding.syncNodes(mirrorNodes,{title:nodeContent}));
            }
          }
        }
        Promise.all(promiseList).then(function(){
          reloadCanvas();
        })*/
      })
      Nodes.templateNodes.DECIDE_REQUIREMENTS_CAPTURE_IDEAS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        var nonFunctionalReqList = ["Structural","Usage","Management","Environmental"];
        if(nonFunctionalReqList.indexOf(parentNodeContent)==-1) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          var insertionPoint = Scrap.getNodesWithText("Define theoretical constructs and measures of requirements to be evaluated");
          if(insertionPoint!=null){
            for(var i=0;i<insertionPoint.length;i++){
              DScaffolding.cloneNodeBis(node,insertionPoint[i].id,cL);
            }
          }

          var howNode = node.getChildrenWithText(Prompter.Nodes.HOW.text);
          if(howNode==null||howNode.length==0){
            var nId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:Prompter.Nodes.HOW.text,style:Prompter.Styles.prompt},cL,true);
            DScaffolding.insertTaskNode("How does '"+nodeContent+"' happen?",nId,cL)
          }
        }
        else if(icon==Icons.disabled){
          var insertionPoint = Scrap.getNodesWithText("Define theoretical constructs and measures of requirements to be evaluated");
          if(insertionPoint!=null){
            for(var i=0;i<insertionPoint.length;i++){
              var mirrorNodes = insertionPoint[i].getChildrenWithText(nodeContent);
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[0].id,cL);
              }
            }
          }
          var howNode = node.getChildrenWithText(Prompter.Nodes.HOW.text);
          if(howNode!=null&&howNode.length>0){
            Mindmeister.removeIdea(Scrap.mapID,howNode[0].id,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    var artefactsToEvaluate = Scrap.getNodesWithText("Determine and characterise the artefact(s) to be evaluated");
    for(var i=0;i<artefactsToEvaluate.length;i++){
      artefactsToEvaluate[i].onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null) return;
        var addedNodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();

        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();

        // CHILD OF SUPPORTING EVIDENCES
        if(parentNodeContent=="Determine and characterise the artefact(s) to be evaluated"){
          var nodeId = Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:"Characterize "+addedNodeContent+"'s nature",style:Prompter.Styles.prompt},cL);
          DScaffolding.insertTaskNode("Characterize "+addedNodeContent+"'s nature",nodeId,cL);
          var nId = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:"Product vs process",style:NODE_STYLES.template},cL);
          Mindmeister.insertIdea(Scrap.mapID,nId,{title:"Product",icon:Icons.disabled,style:NODE_STYLES.template},cL);
          Mindmeister.insertIdea(Scrap.mapID,nId,{title:"Process",icon:Icons.disabled,style:NODE_STYLES.template},cL);
          Mindmeister.insertIdea(Scrap.mapID,nId,{title:"Both",icon:Icons.disabled,style:NODE_STYLES.template},cL);
          var nId2 = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:'"Purely" technical or socio-technical',style:NODE_STYLES.template},cL);
          Mindmeister.insertIdea(Scrap.mapID,nId2,{title:"Purely technical",icon:Icons.disabled,style:NODE_STYLES.template},cL);
          Mindmeister.insertIdea(Scrap.mapID,nId2,{title:"Socio-technical",icon:Icons.disabled,style:NODE_STYLES.template},cL);
          var nId3 = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:"Safety-critical or not",style:NODE_STYLES.template},cL);
          Mindmeister.insertIdea(Scrap.mapID,nId3,{title:"Safety-critical",icon:Icons.disabled,style:NODE_STYLES.template},cL);
          Mindmeister.insertIdea(Scrap.mapID,nId3,{title:"Not safety-critical",icon:Icons.disabled,style:NODE_STYLES.template},cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      artefactsToEvaluate[i].onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        var chooseLabelList = ["Product vs process",'"Purely" technical or socio-technical',"Safety-critical or not"];
        if(chooseLabelList.indexOf(parentNodeContent)==-1) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          if(nodeContent == "Purely technical"){
            var aux = Scrap.getNodesWithText("Purely Technical Strategy");
            if(aux!=null&&aux.length>0){
              // TO MODIFY
              Mindmeister.modifyIdea(Scrap.mapID,aux[0].id,{icon:Icons.enabled},cL);
            }
          }
          DScaffolding.deactivateOldActiveChildren(parentNode,nodeContent,cL);

          var grandParentNode = parentNode.getParentNode();
          if(Utils.backgroundColorToHex(grandParentNode.getHTMLElement().style.backgroundColor)==Prompter.Styles.prompt.backgroundColor){
            var complete = true;
            var chooseNodes = ['"Purely" technical or socio-technical',"Product vs process","Safety-critical or not"];
            for(var i=0;i<chooseNodes.length;i++){
              var choose = grandParentNode.getChildrenWithText(chooseNodes[i]);
              if(choose==null||choose.length==0){
                complete=false;
                break;
              }
              var chooseActive = choose[0].getChildrenWithIcon(Icons.enabled);
              if(chooseActive==null||chooseActive.length==0){
                complete=false;
                break;
              }
            }
            if(complete){
              var grandParentNodeContent = grandParentNode.getContent();
              DScaffolding.removeTaskNode(grandParentNodeContent,cL);
              Mindmeister.modifyIdea(Scrap.mapID,grandParentNode.id,{style:Prompter.Styles.prompt_completed},cL);
            }
          }
        }
        else if(icon==Icons.disabled){
          if(nodeContent == "Purely technical"){
            var aux = Scrap.getNodesWithText("Purely technical");
            if(aux!=null&&aux.length>0){
              var bool = true;
              for(var i=0;i<aux.length;i++){
                var iconCont = aux[i].getIcons();
                if(iconCont==null||iconCont.length==0) continue;
                if(iconCont.indexOf(Icons.enabled)!=-1){
                  bool = false;
                  break;
                }
              }
              if(bool){
                var pt = Scrap.getNodesWithText("Purely Technical Strategy");
                if(pt!=null){
                  // TO MODIFY
                  Mindmeister.modifyIdea(Scrap.mapID,pt[0].id,{icon:Icons.disabled},cL);
                }
              }
            }
          }
          var grandParentNode = parentNode.getParentNode();
          if(Utils.backgroundColorToHex(grandParentNode.getHTMLElement().style.backgroundColor)!=Prompter.Styles.prompt.backgroundColor){
            var complete = true;
            var chooseNodes = ['"Purely" technical or socio-technical',"Product vs process","Safety-critical or not"];
            for(var i=0;i<chooseNodes.length;i++){
              var choose = grandParentNode.getChildrenWithText(chooseNodes[i]);
              if(choose==null||choose.length==0){
                complete=false;
                break;
              }
              var chooseActive = choose[0].getChildrenWithIcon(Icons.enabled);
              if(chooseActive==null||chooseActive.length==0){
                complete=false;
                break;
              }
            }
            if(!complete){
              var grandParentNodeContent = grandParentNode.getContent();
              DScaffolding.insertTaskNode(grandParentNodeContent,grandParentNode.id,cL);
              Mindmeister.modifyIdea(Scrap.mapID,grandParentNode.id,{style:Prompter.Styles.prompt},cL)
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    var evaluationPurposesNode = Scrap.getNodesWithText("Determine evaluation purpose(s)");
    for(var i=0;i<evaluationPurposesNode.length;i++){
      evaluationPurposesNode[i].onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
          // TO MODIFY
          var insertionPoint = lag[0].getChildrenWithText("Evaluation Purposes");
          if(insertionPoint!=null&&insertionPoint.length>0){
            DScaffolding.cloneNodeBis(node,insertionPoint[0].id,cL);
          }
          if(nodeContent == "Develop evidence my artefact has better utility for its purpose than other artefacts do"){
            var lag = node.getChildrenWithText("In comparison to what other purposeful artefact(s)?");
            if(lag==null||lag.length==0){
              var taskNodeId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:"In comparison to what other purposeful artefact(s)?",style:Prompter.Styles.prompt},cL);
              DScaffolding.insertTaskNode("In comparison to what other purposeful artefact(s) mine has better utility for its purpose?",taskNodeId,cL);
            }
          }
        }
        else if(icon==Icons.disabled){
          var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
          // TO MODIFY
          var mirrorNode = lag[0].getChildrenWithText(nodeContent);
          if(mirrorNode!=null&&mirrorNode.length>0){
            Mindmeister.removeIdea(Scrap.mapID,mirrorNode[0].id,cL);
          }
          if(nodeContent == "Develop evidence my artefact has better utility for its purpose than other artefacts do"){
            var lag = node.getChildrenWithText("In comparison to what other purposeful artefact(s)?");
            if(lag!=null&&lag.length>0){
              Mindmeister.removeIdea(Scrap.mapID,lag[0].id,cL);
            }
            DScaffolding.removeTaskNode("In comparison to what other purposeful artefact(s) mine has better utility for its purpose?",cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      evaluationPurposesNode[i].onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null) return;
        var addedNodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();

        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        // CHILD OF SUPPORTING EVIDENCES
        if(parentNodeContent=="In comparison to what other purposeful artefact(s)?"&&Utils.backgroundColorToHex(parentNode.getHTMLElement().style.backgroundColor)==Prompter.Styles.prompt.backgroundColor){
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
          DScaffolding.removeTaskNode("In comparison to what other purposeful artefact(s) mine has better utility for its purpose?",cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      evaluationPurposesNode[i].onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent!="In comparison to what other purposeful artefact(s)?") return;
        var siblings = parentNode.getChildren();
        if(siblings!=null&&siblings.length>0) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt},cL);
        DScaffolding.insertTaskNode("In comparison to what other purposeful artefact(s) mine has better utility for its purpose?",parentNode.id,cL);
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    var evaluationGoalsNode = Scrap.getNodesWithText("Determine evaluation goal(s)");
    for(var i=0;i<evaluationGoalsNode.length;i++){
      evaluationGoalsNode[i].onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
          // TO MODIFY
          var insertionPoint = lag[0].getChildrenWithText("Evaluation Goals");
          if(insertionPoint!=null&&insertionPoint.length>0){
            DScaffolding.cloneNodeBis(node,insertionPoint[0].id,cL);
          }
        }
        else if(icon==Icons.disabled){
          var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
          // TO MODIFY
          var mirrorNode = lag[0].getChildrenWithText(nodeContent);
          if(mirrorNode!=null&&mirrorNode.length>0){
            Mindmeister.removeIdea(Scrap.mapID,mirrorNode[0].id,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    var functionalRequirementsNode = Scrap.getNodesWithText("Functional Requirements");
    for(var i=0;i<functionalRequirementsNode.length;i++){
      functionalRequirementsNode[i].onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null) return;
        var addedNodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(parentNodeContent=="Requirements for Achieving purpose and benefits"||parentNodeContent=="Requirements for Reducing causes of the problem"){
          var insertionPoint = Scrap.getNodesWithText("Define theoretical constructs and measures of requirements to be evaluated");
          if(insertionPoint!=null){
            for(var j=0;j<insertionPoint.length;j++){
              DScaffolding.cloneNodeBis(addedNode,insertionPoint[j].id,cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      functionalRequirementsNode[i].onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent!="Requirements for Reducing causes of the problem"&&parentNodeContent!="Requirements for Achieving purpose and benefits") return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        var insertionPoint = Scrap.getNodesWithText("Define theoretical constructs and measures of requirements to be evaluated");
        for(var k=0;k<removedNodes.length;k++){
          for(var j=0;j<insertionPoint.length;j++){
            var mirrorNodes = insertionPoint[j].getChildrenWithText(removedNodes[k]);
            if(mirrorNodes!=null&&mirrorNodes.length>0){
              Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[0].id,cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    // testear desde aqui
    var prioritiseEvaluation = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
    for(var i=0;i<prioritiseEvaluation.length;i++){
      prioritiseEvaluation[i].onChildrenAdded(function(addedNodes){
        var addedNode =addedNodes[0];
        if(addedNode==null) return;
        var addedNodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();

        var lag = ["Evaluation Goals","Evaluation Purposes","Research Constraints","Feasibility Uncertainties"];
        // CHILD OF SUPPORTING EVIDENCES
        if(lag.indexOf(parentNodeContent)==-1) return;
        var type = "";
        if(parentNodeContent=="Evaluation Goals") type = "evaluation goal";
        else if(parentNodeContent=="Evaluation Purposes") type = "evaluation purpose";
        else if(parentNodeContent=="Research Constraints") type = "research constraint";
        else if(parentNodeContent=="Feasibility Uncertainties") type = "uncertainty";
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        var nodeId = Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:"Rate this "+type+"'s priority",style:Prompter.Styles.prompt},cL);
        DScaffolding.insertTaskNode("Rate the priority for '"+addedNodeContent+"'",nodeId,cL);
        var options = ["Essential","More important","Less important","Nice to have","Irrelevant"];
        for(var j=0;j<options.length;j++){
          Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:options[j],style:Prompter.Styles.prompt_completed,icon:Icons.disabled},cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      prioritiseEvaluation[i].onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        var grandParentNode = parentNode.getParentNode();
        var grandParentNodeContent = grandParentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if((parentNodeContent.indexOf("Rate this")!=-1&&parentNodeContent.indexOf("priority")!=-1)||parentNodeContent=="Priority rating"){
          if(icon==Icons.enabled){
            if(nodeContent=="Essential"&&grandParentNodeContent=="Develop rigorous evidence of the effectiveness of my artefact for achieving its purposes(s)"){
              var nodeToEnable = Scrap.getNodesWithText("Human Risk and Effectiveness Strategy");
              if(nodeToEnable!=null){
                for(var j=0;j<nodeToEnable.length;j++){
                  Mindmeister.modifyIdea(Scrap.mapID,nodeToEnable[j].id,{icon:Icons.enabled},cL)
                }
              }
            }
            else if(nodeContent=="Essential"&&grandParentNodeContent=="Develop rigorous evidence of the efficacy of my artefact for achieving its purpose(s)"){
              var nodeToEnable = Scrap.getNodesWithText("Technological Risk and Efficacy Strategy");
              if(nodeToEnable!=null){
                for(var j=0;j<nodeToEnable.length;j++){
                  Mindmeister.modifyIdea(Scrap.mapID,nodeToEnable[j].id,{icon:Icons.enabled},cL)
                }
              }
            }
            DScaffolding.deactivateOldActiveChildren(parentNode,nodeContent,cL);
            if(Utils.backgroundColorToHex(parentNode.getHTMLElement().style.backgroundColor)==Prompter.Styles.prompt.backgroundColor){
              DScaffolding.removeTaskNode("Rate the priority for '"+grandParentNodeContent+"'",cL);
              Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:"Priority rating",style:NODE_STYLES.template},cL);
            }
          }
          else if(icon==Icons.disabled){
            if(nodeContent=="Essential"&&grandParentNodeContent=="Develop rigorous evidence of the effectiveness of my artefact for achieving its purposes(s)"){
              DScaffolding.checkHumanRisk(cL);
            }
            if(nodeContent=="Essential"&&grandParentNodeContent=="Develop rigorous evidence of the efficacy of my artefact for achieving its purpose(s)"){
              DScaffolding.checkTechnicalRisk(cL);
            }
            if(Utils.backgroundColorToHex(parentNode.getHTMLElement().style.backgroundColor)!=Prompter.Styles.prompt.backgroundColor){
              var childs = parentNode.getChildrenWithIcon(Icons.enabled);
              if(childs==null||childs.length==0){
                DScaffolding.insertTaskNode("Rate the priority for '"+grandParentNodeContent+"'",parentNode.id,cL);
                var type = grandParentNode.getParentNode();
                var typeContent = type.getContent();
                var typeText = "";
                if(typeContent=="Evaluation Goals") typeText = "evaluation goal";
                else if(typeContent=="Evaluation Purposes") typeText = "evaluation purpose";
                else if(typeContent=="Research Constraints") typeText = "research constraint";
                else if(typeContent=="Feasibility Uncertainties") typeText = "uncertainty";
                Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:"Rate this "+typeText+"'s priority",style:Prompter.Styles.prompt},cL)
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      prioritiseEvaluation[i].onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent!="Evaluation Goals") return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        DScaffolding.checkHumanRisk(cL);
        DScaffolding.checkTechnicalRisk(cL);
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    var constructsAndMeasures = Scrap.getNodesWithText("Define theoretical constructs and measures of requirements to be evaluated");
    for(var l=0;l<constructsAndMeasures.length;l++){
      constructsAndMeasures[l].onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null) return;
        var addedNodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(parentNodeContent=="Define theoretical constructs and measures of requirements to be evaluated"){
          var nodeId = Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:"What theoretical construct represents this?",style:Prompter.Styles.prompt},cL);
          DScaffolding.insertTaskNode("What theoretical construct represents '"+addedNodeContent+"'?",nodeId,cL);
          var insertionPoint = Scrap.getNodesWithText("Copy&Paste the requirements to be evaluated above into an evaluation episode in one of the four quadrants");
          if(insertionPoint!=null){
            for(var i=0;i<insertionPoint.length;i++){
              DScaffolding.cloneNodeBis(addedNode,insertionPoint.id,cL);
            }
          }
        }
        else if(parentNodeContent=="What theoretical construct represents this?"){
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:"... is represented by theoretical construct ...",style:Prompter.Styles.prompt_completed},cL);
          var nId = Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:"Write a clear definition of this construct",style:Prompter.Styles.prompt},cL,true);
          DScaffolding.insertTaskNode("Write a clear definition of '"+addedNodeContent+"'",nId,cL);
          var nId2 = Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:"How measure this construct?",style:Prompter.Styles.prompt},cL,true);
          DScaffolding.insertTaskNode("How measure '"+addedNodeContent+"'?",nId2,cL);
          var grandParentNode = parentNode.getParentNode();
          var grandParentNodeContent = grandParentNode.getContent();
          DScaffolding.removeTaskNode("What theoretical construct represents '"+grandParentNodeContent+"'?",cL);
        }
        else if(parentNodeContent=="Write a clear definition of this construct"){
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:"Construct definition",style:Prompter.Styles.prompt_completed},cL);
          var grandParentNode = parentNode.getParentNode();
          var grandParentNodeContent = grandParentNode.getContent();
          DScaffolding.removeTaskNode("Write a clear definition of '"+grandParentNodeContent+"'",cL);
        }
        else if(parentNodeContent=="How measure this construct?"){
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:"... is measured by ...",style:Prompter.Styles.prompt_completed},cL);
          var grandParentNode = parentNode.getParentNode();
          var grandParentNodeContent = grandParentNode.getContent();
          DScaffolding.removeTaskNode("How measure '"+grandParentNodeContent+"'?",cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      constructsAndMeasures[l].onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(parentNodeContent=="... is represented by theoretical construct ..."){
          var siblings = parentNode.getChildren();
          if(siblings==null||siblings.length==0){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:"What theoretical construct represents this?",style:Prompter.Styles.prompt},cL);
            var grandParentNode = parentNode.getParentNode();
            var grandParentNodeContent = grandParentNode.getContent();
            DScaffolding.insertTaskNode("What theoretical construct represents '"+grandParentNodeContent+"'?",cL);
          }
        }
        else if(parentNodeContent=="Construct definition"){
          var siblings = parentNode.getChildren();
          if(siblings==null||siblings.length==0){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:"Write a clear definition of this construct",style:Prompter.Styles.prompt},cL);
            var grandParentNode = parentNode.getParentNode();
            var grandParentNodeContent = grandParentNode.getContent();
            DScaffolding.insertTaskNode("Write a clear definition of '"+grandParentNodeContent+"'",cL);
          }
        }
        else if(parentNodeContent=="... is measured by ..."){
          var siblings = parentNode.getChildren();
          if(siblings==null||siblings.length==0){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:"How measure this construct?",style:Prompter.Styles.prompt},cL);
            var grandParentNode = parentNode.getParentNode();
            var grandParentNodeContent = grandParentNode.getContent();
            DScaffolding.insertTaskNode("How measure '"+grandParentNodeContent+"'?",cL);
          }
        }
        else if(parentNodeContent=="Define theoretical constructs and measures of requirements to be evaluated"){
          var insertionPoint = Scrap.getNodesWithText("Copy&Paste the requirements to be evaluated above into an evaluation episode in one of the four quadrants");
          for(var i=0;i<removedNodes.length;i++){
            for(var j=0;j<insertionPoint.length;j++){
              var mirrorNodes = insertionPoint[j].getChildrenWithText(removedNodes[i]);
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[0].id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    var evaluationEpisodes = Scrap.getNodesWithText("Choose and Design Evaluation Episodes");
    for(var l=0;l<evaluationEpisodes.length;l++){
      evaluationEpisodes[l].onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null) return;
        var addedNodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(parentNodeContent=="Paste property(ies) to be evaluated in this episode here"){
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:"Property(ies) to be evaluated in this episode",style:Prompter.Styles.prompt_completed},cL);
          var grandParentNode = parentNode.getParentNode();
          var grandParentNodeContent = grandParentNode.getContent();
          var episodeName;
          var evaluationMethods;
          var quadrant = grandParentNode.getParentNode();
          var siblings = quadrant.getChildren();
          var numEpisode = siblings!=null ? siblings.length+1 : 1;
          if(grandParentNodeContent.indexOf("Formative Artificial Evaluation Episode")!=-1){
            episodeName = "Formative Artificial Evaluation Episode "+numEpisode;
            evaluationMethods = ["Criteria-based Evaluation","Scenarios"];
          }
          else if(grandParentNodeContent.indexOf("Formative Naturalistic Evaluation Episode")!=-1){
            episodeName = "Formative Naturalistic Evaluation Episode "+numEpisode;
            evaluationMethods = ["Action Research","Focus Group","Field Experiment","Collect Client Feedback"];
          }
          else if(grandParentNodeContent.indexOf("Summative Artificial Evaluation Episode")!=-1){
            episodeName = "Summative Artificial Evaluation Episode "+numEpisode;
            evaluationMethods = ["Mathematical or Logical Proof","Lab Experiment","Simulation","Testing"];
          }
          else if(grandParentNodeContent.indexOf("Summative Naturalistic Evaluation Episode")!=-1){
            episodeName = "Summative Naturalistic Evaluation Episode "+numEpisode;
            evaluationMethods = ["Case Study","Participant Observation","Ethnography","Phenomenology","Quantitative Survey","Collect Performance Measures"];
          }
          var insertionPoint = grandParentNode.getParentNode();
          if(episodeName!=null&&evaluationMethods!=null){
            var nodeId = Mindmeister.insertIdea(Scrap.mapID,insertionPoint.id,{title:episodeName,style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:"Paste property(ies) to be evaluated in this episode here",style:Prompter.Styles.prompt},cL);
            var nId = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:"Choose evaluation method",style:Prompter.Styles.prompt},cL);
            for(var i=0;i<evaluationMethods.length;i++){
              Mindmeister.insertIdea(Scrap.mapID,nId,{title:evaluationMethods[i],style:Prompter.Styles.prompt_completed,icon:Icons.disabled},cL);
            }
            Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:"Research Method Literature for Chosen Evaluation Method(s)",style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:"What do you want to learn from the evaluation?",style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:"Record details of evaluation design here (add nodes or include a link to a file)",style:NODE_STYLES.template},cL);

            var nId2 = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:"Enact this Evaluation Episode",style:NODE_STYLES.template},cL);
            var nnId = Mindmeister.insertIdea(Scrap.mapID,nId2,{title:"Record how the evaluation was done here",style:NODE_STYLES.template},cL);
            var aux = ["How long?","When?","Where?","Participants?","Link to a file?"];
            for(var i=0;i<aux.length;i++){
              Mindmeister.insertIdea(Scrap.mapID,nnId,{title:aux[i],style:Prompter.NODE_STYLES.template},cL);
            }
            Mindmeister.insertIdea(Scrap.mapID,nId2,{title:"Record data collected from the evaluation here (e.g. link to data files)",style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,nId2,{title:"Record results of the data analysis here (e.g. link to files)",style:NODE_STYLES.template},cL);

            Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:"Record Learning from the Evaluation here (e.g. link to files)",style:NODE_STYLES.template},cL);
            var nId3 = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:"Reconsider and Revise Evaluation Plan as DSR Progresses",style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,nId3,{title:"Summarise changes to the evaluation plan",style:NODE_STYLES.template},cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      evaluationEpisodes[l].onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        var grandParentNode = parentNode.getParentNode();
        var grandParentNodeContent = grandParentNode.getContent();
        if(parentNodeContent!="Choose evaluation method") return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          if(Utils.backgroundColorToHex(parentNode.getHTMLElement().style.backgroundColor)==Prompter.Styles.prompt.backgroundColor){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
          }
          DScaffolding.deactivateOldActiveChildren(parentNode,nodeContent,cL);
        }
        else if(icon==Icons.disabled){
          if(Utils.backgroundColorToHex(parentNode.getHTMLElement().style.backgroundColor)!=Prompter.Styles.prompt.backgroundColor){
            var activeSiblings = parentNode.getChildrenWithIcon(Icons.enabled);
            if(activeSiblings==null||activeSiblings.length==0){
              Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt},cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      evaluationEpisodes[l].onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(parentNodeContent=="Property(ies) to be evaluated in this episode"){
          var siblings = parentNode.getChildrenWithIcon(Icons.enabled);
          if(siblings==null||siblings.length==0){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:"Paste property(ies) to be evaluated in this episode here",style:Prompter.Styles.prompt},cL);
            var grandParentNode = parentNode.getParentNode();
            var quadrantNode = grandParentNode.getParentNode();
            var episodes = grandParentNode.getChildren();
            if(episodes.length>1) Mindmeister.removeIdea(Scrap.mapID,episodes[episodes.length-1].id,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    // // ALL MAP
    // provisional
    var rootChild = document.querySelectorAll(".root_child");
    for(var i=0;i<rootChild.length;i++){
      var n = new Scrap.Node(rootChild[i]);
      n.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode == null || addedNode.id == null) return;
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();
        var addedNodeContent = addedNode.getContent();
        if(addedNodeContent==null)return;
        if(addedNodeContent=="Supporting Evidences?"||addedNodeContent=="Who else addresses it?"||addedNodeContent=="Justificatory Knowledge"){
          //Mindmeister.modifyIdea(Scrap.mapID,addedNode.id,{note:"What proof do I have that this cause exists? (Is it concrete? Is it measurable?)\n\nWhat proof do I have that this cause could lead to the stated effect? (Am I merely asserting causation?)\n\nWhat proof do I have that this cause actually contributed to the problem I'm looking at? (Even given that it exists and could lead to this problem, how do I know it wasn't actually something else?)\n\nIs anything else needed, along with this cause, for the stated effect to occur? (Is it self-sufficient? Is something needed to help it along?)\n\nCan anything else, besides this cause, lead to the stated effect? (Are there alternative explanations that fit better? What other risks are there?)"},cL);
          var rootNode = Scrap.getRootNode();
          var rootNodeContent = rootNode.getContent().trim();
          var freeColor = PurposeManager.getAvailableColor();
          if(freeColor!=null){
            Scrap.showWorkingMessage();
            var cL = new Mindmeister.ChangeList();
            Mindmeister.modifyIdea(Scrap.mapID,addedNode.id,{style:Prompter.Styles.prompt},cL);
            PurposeManager.insertPurpose(parentNode.id,freeColor,parentNodeContent,addedNode.id);
            var templateStyle = JSON.parse(JSON.stringify(NODE_STYLES.template));
            templateStyle.backgroundColor = freeColor;
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:templateStyle},cL);
            Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
              if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
              else Scrap.hideWorkingMessage();
            })
          }
          else{
            Scrap.showMessage("There are no more colors available.");
          }
          //})
        }
        /*
        if(!MENDELEY_ENABLED) return;
        var addedNode = addedNodes[0];
        if(addedNode == null || addedNode.id == null) return;
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();
        var addedNodeContent = addedNode.getContent();
        if(addedNodeContent==null)return;
        if(addedNodeContent=="Supporting Evidences?"||addedNodeContent=="Who else addresses it?"||addedNodeContent=="Justificatory Knowledge"){
          //Mindmeister.modifyIdea(Scrap.mapID,addedNode.id,{note:"What proof do I have that this cause exists? (Is it concrete? Is it measurable?)\n\nWhat proof do I have that this cause could lead to the stated effect? (Am I merely asserting causation?)\n\nWhat proof do I have that this cause actually contributed to the problem I'm looking at? (Even given that it exists and could lead to this problem, how do I know it wasn't actually something else?)\n\nIs anything else needed, along with this cause, for the stated effect to occur? (Is it self-sufficient? Is something needed to help it along?)\n\nCan anything else, besides this cause, lead to the stated effect? (Are there alternative explanations that fit better? What other risks are there?)"},cL);
          var rootNode = Scrap.getRootNode();
          var rootNodeContent = rootNode.getContent().trim();
          var freeColor = Palette.getFreeColor(Scrap.mapID);
          if(freeColor!=null){
            Scrap.showWorkingMessage();
            var cL = new Mindmeister.ChangeList();
            Mindmeister.modifyIdea(Scrap.mapID,addedNode.id,{style:Prompter.Styles.prompt},cL);
            PurposeManager.insertPurpose(parentNode.id,freeColor,parentNodeContent,addedNode.id);
            var templateStyle = JSON.parse(JSON.stringify(NODE_STYLES.template));
            templateStyle.backgroundColor = freeColor;
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:templateStyle},cL);
            Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
              if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
              else Scrap.hideWorkingMessage();
            })
          }
          else{
            Scrap.showMessage("There are no more colors available.");
          }
        }*/
      },true,true);
      // solucion temporal
      n.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        if(removedNodes.length==0) return;
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(/*removedNodes.length==1&&*/(removedNodes[0]=="Supporting Evidences?"||removedNodes[0]=="Who else addresses it?"||removedNodes[0]=="Justificatory Knowledge")){
          Mindmeister.decolorIdea(Scrap.mapID,parentNode.id,cL);
          PurposeManager.removePurpose(parentNode.id);
        }
        else if(removedNodes.indexOf("Supporting Evidences?")!=-1||removedNodes.indexOf("Who else addresses it?")!=-1||removedNodes.indexOf("Justificatory Knowledge")!=-1){
          for(var j=0;j<removedNodes.length;j++){
            var purpose = PurposeManager.getPurpose(null,null,removedNodes[j]);
            if(purpose!=null) PurposeManager.removePurpose(purpose.nodeId,purpose.color);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
        /*if(parentNode==null)return;
        if(removedNodes.length==0) return;
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if((removedNodes[0]=="Supporting Evidences?"||removedNodes[0]=="Who else addresses it?"||removedNodes[0]=="Justificatory Knowledge")){
          Mindmeister.decolorIdea(Scrap.mapID,parentNode.id,cL);
          PurposeManager.removePurpose(parentNode.id);
        }
        else if(removedNodes.indexOf("Supporting Evidences?")!=-1||removedNodes.indexOf("Who else addresses it?")!=-1||removedNodes.indexOf("Justificatory Knowledge")!=-1){
          for(var j=0;j<removedNodes.length;j++){
            var purpose = PurposeManager.getPurpose(null,null,removedNodes[j]);
            if(purpose!=null) PurposeManager.removePurpose(purpose.nodeId,purpose.color);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })*/
      });
    }

    /*this.onTemplateNodeRemoved(null,function(tasksToRemove,nodesToDecolor){
      if(tasksToRemove!=null&&tasksToRemove.length>0){
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        for(var i=0;i<tasksToRemove.length;i++){
          DScaffolding.removeTaskNode(tasksToRemove[i],cL);
        }
        var style = null;
        for(var i=0;i<nodesToDecolor.length;i++){
          if(document.getElementById(nodesToDecolor[i])!=null) Mindmeister.decolorIdea(Scrap.mapID,nodesToDecolor[i],cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      }
    },true)*/

    var rootNode = Scrap.getRootNode();
    rootNode.onEdited(function(node,oldValue){
      var newTitle = node.getContent().trim();
      if(newTitle==Utils.escapeHtml("Explicate Problem for <name your project>")||newTitle==Utils.escapeHtml("<name your project>")) return;
      if(oldValue==null) return;
      if(newTitle==oldValue) return;
      if(newTitle.trim().length>25||newTitle.trim().length<4) {
        Scrap.showConfirmationMessage("The project name must have between 4 and 25 characters",function(){
          return;
        },function(){
          var cL = new Mindmeister.ChangeList();
          Mindmeister.modifyIdea(Scrap.mapID,Scrap.getRootNode().id,{title:oldValue},cL);
          Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
            return;
          })
        },"Proceed anyway","Undo");
      }
      else Hypothesis.getGroupId(oldValue.trim()).then(function(groupId){
          if(groupId==null){
            Hypothesis.createGroup(newTitle.trim()).then(function(newGroupId){
              // TO DO - INSERT CURRENT PURPOSES IN HYPOTHESIS
            })
          }
          else{
            Hypothesis.updateGroupIdName(groupId,newTitle.trim());
          }
        })
      /*var newTitle = node.getContent();
      var labelMap = DSCAFFOLDING_LABELS.map(getAttribute,"mapId");
      var lag = labelMap.indexOf(Scrap.mapID);
      if(lag!=-1){
        DSCAFFOLDING_LABELS[lag]["mapName"] = newTitle;
        chrome.storage.sync.set({
          "DSCAFFOLDING_LABELS": DSCAFFOLDING_LABELS
        }, function(){
          chrome.runtime.sendMessage({mes: "reloadDScaffoldingLabels"});
        })
      }*/
    },false);
    Scrap.onNodeEdited(null,function(node,oldValue){
      var newContent = node.getContent();
      var purpose = PurposeManager.getPurpose(null,node.id);
      if(purpose!=null){
        PurposeManager.updatePurpose(node.id,newContent);
      }
    },true);

    // EXPLICATE PROBLEM
    Nodes.templateNodes.EXPLICATE_PROBLEM.onMoved(function(movedNodes,parentNode){
      if(!parentNode.isDescendant(DScaffolding.Nodes.templateNodes.ASCERTAIN_CONSEQUENCES)&&!parentNode.isDescendant(DScaffolding.Nodes.templateNodes.ASCERTAIN_CAUSES)&&parentNode.id!=DScaffolding.Nodes.templateNodes.ASCERTAIN_CAUSES.id&&parentNode.id!=DScaffolding.Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.id) return;
      for(var i=0;i<movedNodes.length;i++){
        if(movedNodes[i].newParentId == DScaffolding.Nodes.templateNodes.SET_PROBLEM_STATEMENT.id){
          var deniedNodeContentList = [Prompter.Nodes.WHAT_FOLLOWS_FROM.completed,Prompter.Nodes.WHAT_FOLLOWS_FROM.text,Prompter.Nodes.WHY.completed,Prompter.Nodes.WHY.text,Prompter.Nodes.SUPPORTING_EVIDENCES.text];
          if(deniedNodeContentList.indexOf(movedNodes[i].node.getContent())==-1){
            DScaffolding.setAsProblemStatementDrag(movedNodes[i].node,parentNode);
            break;
          }
        }
      }
    })
    Nodes.templateNodes.EXPLICATE_PROBLEM.onIconEdited(function(node,icon){
      if(node.id!=Nodes.templateNodes.EXPLICATE_PROBLEM.id) return;
      if(icon==Icons.reload_wheel){
        addImportProblemListener();
      }
    },true);

    if(Nodes.templateNodes.ASCERTAIN_CAUSES!=null){
      Nodes.templateNodes.ASCERTAIN_CAUSES.addContextMenuEntry("Set as problem statement",DScaffolding.setAsProblemStatement,false,[Prompter.Nodes.WHY.text,Prompter.Nodes.WHAT_FOLLOWS_FROM.text,Prompter.Nodes.WHY.completed,Prompter.Nodes.WHAT_FOLLOWS_FROM.completed],["Supporting Evidences?","Who else addresses it?"]);
    }
    if(Nodes.templateNodes.ASCERTAIN_CONSEQUENCES!=null){
      Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.addContextMenuEntry("Set as problem statement",DScaffolding.setAsProblemStatement,false,[Prompter.Nodes.WHY.text,Prompter.Nodes.WHAT_FOLLOWS_FROM.text,Prompter.Nodes.WHY.completed,Prompter.Nodes.WHAT_FOLLOWS_FROM.completed],["Supporting Evidences?","Who else addresses it?"]);
    }

    // NEW ENTRIES IN THE CONTEXT MENU
    if(GOOGLE_FORMS_ENABLED) Nodes.templateNodes.PROBLEM_AS_DIFFICULTIES.addContextMenuEntry("Create Poll for Paired Comparison",DScaffolding.createPairedComparisonPoll,true,[Prompter.Nodes.WHY.text,Prompter.Nodes.WHAT_FOLLOWS_FROM.text,Prompter.Nodes.WHY.completed,Prompter.Nodes.WHAT_FOLLOWS_FROM.completed],["Supporting Evidences?","Who else addresses it?"]);
  }
  var initTemplateExplicateProblemNew = function(){
    NodesNew.init();

    Completeness.init();

    // DESCRIBE PRACTICE
    if(NodesNew.templateNodes.DESCRIBE_PRACTICE!=null){
      NodesNew.templateNodes.DESCRIBE_PRACTICE.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        // CHILD OF SUPPORTING EVIDENCES
        var parentNode = addedNode.getParentNode();
        if(parentNode!=null) var parentNodeContent = parentNode.getContent();
        if(parentNodeContent==PrompterNew.Nodes.SUPPORTING_EVIDENCES.text) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(parentNodeContent==NodesNew.templateNodesText.DESCRIBE_PRACTICE){
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.PRACTICE_GENERALIZATION.text,style:PrompterNew.Styles.prompt},cL);
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.PROPERTIES.text,style:PrompterNew.Styles.prompt},cL);
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.ACTIVITIES.text,style:PrompterNew.Styles.prompt},cL);
        }
        else if(parentNodeContent==PrompterNew.Nodes.PROPERTIES.text){
          let ch = parentNode.getChildren();
          if(ch.length==1){ // TODO replace with the node's background color
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
          }
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.PROPERTIES.text,style:PrompterNew.Styles.prompt},cL,true);
        }
        else if(parentNodeContent==PrompterNew.Nodes.PRACTICE_GENERALIZATION.text){
          let ch = parentNode.getChildren();
          if(ch.length==1){ // TODO replace with the node's background color
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:PrompterNew.Nodes.PRACTICE_GENERALIZATION.completed,style:PrompterNew.Styles.prompt_completed},cL);
          }
        }
        else if(parentNodeContent==PrompterNew.Nodes.ACTIVITIES.text){
          let ch = parentNode.getChildren();
          if(ch.length==1){ // TODO replace with the node's background color
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
          }
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.PROPERTIES.text,style:PrompterNew.Styles.prompt},cL);
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.SUBACTIVITIES.text,style:PrompterNew.Styles.prompt},cL);
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.TOOLING.text,style:PrompterNew.Styles.prompt},cL);
        }
        else if(parentNodeContent==PrompterNew.Nodes.SUBACTIVITIES.text){
          let ch = parentNode.getChildren();
          if(ch.length==1){ // TODO replace with the node's background color
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
          }
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.PROPERTIES.text,style:PrompterNew.Styles.prompt},cL);
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.SUBACTIVITIES.text,style:PrompterNew.Styles.prompt},cL);
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.TOOLING.text,style:PrompterNew.Styles.prompt},cL);
        }
        else if(parentNodeContent==PrompterNew.Nodes.TOOLING.text){
          let ch = parentNode.getChildren();
          if(ch.length==1){ // TODO replace with the node's background color
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
          }
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.TOOLING_EXAMPLES.text,style:PrompterNew.Styles.prompt},cL,true);
        }
        else if(parentNodeContent==PrompterNew.Nodes.TOOLING_EXAMPLES.text){
          let ch = parentNode.getChildren();
          if(ch.length==1){ // TODO replace with the node's background color
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      NodesNew.templateNodes.DESCRIBE_PRACTICE.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        let practicePromptTexts = [PrompterNew.Nodes.PROPERTIES.text,PrompterNew.Nodes.PRACTICE_GENERALIZATION.text,PrompterNew.Nodes.ACTIVITIES.text,PrompterNew.Nodes.SUBACTIVITIES.text,PrompterNew.Nodes.TOOLING.text,PrompterNew.Nodes.TOOLING_EXAMPLES.text];
        if(practicePromptTexts.indexOf(parentNodeContent)!=-1){
          var parentNodeChildren = parentNode.getChildren();
          if(parentNodeChildren.length==0){
            Scrap.showWorkingMessage();
            var cL = new Mindmeister.ChangeList();
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt},cL);
            Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
              if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
              else Scrap.hideWorkingMessage();
            })
          }

        }
      },false,[NodesNew.templateNodes.DESCRIBE_PRACTICE.id]);
    }

    // DESCRIBE STAKEHOLDERS
    if(NodesNew.templateNodes.DESCRIBE_STAKEHOLDERS!=null){
      NodesNew.templateNodes.DESCRIBE_STAKEHOLDERS.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        // CHILD OF SUPPORTING EVIDENCES
        var parentNode = addedNode.getParentNode();
        if(parentNode!=null) var parentNodeContent = parentNode.getContent();
        if(parentNodeContent==PrompterNew.Nodes.SUPPORTING_EVIDENCES.text) return;

        var parentList = ["Add Client(s)","Add Decision Maker(s)","Add Professional(s)","Add Witness(es)"];
        if(parentList.indexOf(parentNodeContent)!=-1){
          Scrap.showWorkingMessage();
          var cL = new Mindmeister.ChangeList();
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.WHAT_ARE_THEIR_GOALS.text,style:PrompterNew.Styles.prompt},cL,true);
        }
        else if(parentNodeContent==PrompterNew.Nodes.WHAT_ARE_THEIR_GOALS.text){
          Scrap.showWorkingMessage();
          var cL = new Mindmeister.ChangeList();
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
          var ch = addedNode.getChildrenWithText(PrompterNew.Nodes.HOW_TO_MEASURE_IT.text);
          if(ch.length==0) Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.HOW_TO_MEASURE_IT.text,style:PrompterNew.Styles.prompt},cL,true);
          if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IN_ORDER_TO!=null){
            var grandParent = parentNode.getParentNode();
            var grandParentContent = grandParent.getContent();
            var ch = NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IN_ORDER_TO.getChildrenWithText(grandParentContent+" achieve "+addedNode.getContent());
            if(ch.length==0) Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IN_ORDER_TO.id,{title:grandParentContent+" achieve(s) "+addedNode.getContent(),style:NODE_STYLES.template,link:"topic:"+addedNode.id},cL);
          }
        }
        else if(parentNodeContent==PrompterNew.Nodes.HOW_TO_MEASURE_IT.text){
          Scrap.showWorkingMessage();
          var cL = new Mindmeister.ChangeList();
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
        /*Mindmeister.doChanges(MAP_CHANGES.concat(START_HERE_CHANGELIST)).then(function(ret){
          var nodesToChange = ret.responses;
          replaceNodeIdsBis(nodesToChange);
          updateLinkings().then(function(){
            ANALYSE_STAKEHOLDERS_CHANGELIST = ANALYSE_STAKEHOLDERS_CHANGELIST.concat(MAP_CHANGES);
            MAP_CHANGES = [];
            var mapID = Scrap.selectMapId();
            var startHereNode = Scrap.selectNodeWithText("Start Here!")
            Mindmeister.modifyIdea(mapID,analyseStakeholdersNode.id,{icon:"emoji/symbols-arrows_counterclockwise"}).then(function(){
              Mindmeister.modifyIdea(mapID,startHereNode.id,{icon:"emoji/symbols-arrows_counterclockwise"}).then(function(){
                Promise.all(pLL).then(function(){
                  reloadCanvas();
                  addReloadListener();
                  addReloadListenerStartHere();
                  closeNodesInApi();
                })
              })
            })
          })
        });*/
      },true);
      NodesNew.templateNodes.DESCRIBE_STAKEHOLDERS.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        var parentList = ["Add Client(s)","Add Decision Maker(s)","Add Professional(s)","Add Witness(es)"];

        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(parentNodeContent==PrompterNew.Nodes.WHAT_ARE_THEIR_GOALS.text){
          var parentNodeChildren = parentNode.getChildren();
          if(parentNodeChildren.length==0){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt},cL);
          }
        }
        if(parentNodeContent==PrompterNew.Nodes.HOW_TO_MEASURE_IT.text){
          var parentNodeChildren = parentNode.getChildren();
          if(parentNodeChildren.length==0){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt},cL);
          }
        }
        if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IN_ORDER_TO!=null) {
          for (var i = 0; i < removedNodes.length; i++) {
            var mirror = NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IN_ORDER_TO.getChildrenWithSubText(removedNodes[i]);
            if(mirror!=null){
              for(var j=0;j<mirror.length;j++){
                Mindmeister.removeIdea(Scrap.mapID,mirror[j].id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },false,[NodesNew.templateNodes.DESCRIBE_STAKEHOLDERS.id]);
      NodesNew.templateNodes.DESCRIBE_STAKEHOLDERS.onEdited(function(node,oldValue){
        var parent = node.getParentNode();
        var parentContent = parent.getContent();
        //if(parentContent!=PrompterNew.Nodes.WHAT_ARE_THEIR_GOALS.text) return;
        var nodeContent = node.getContent();
        if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IN_ORDER_TO==null) return;
        var parentList = ["Add Client(s)","Add Decision Maker(s)","Add Professional(s)","Add Witness(es)"];
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        if(parentContent==PrompterNew.Nodes.WHAT_ARE_THEIR_GOALS.text){
          var mirrorNodes = NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IN_ORDER_TO.getChildrenWithSubText("achieve "+oldValue);
          if(mirrorNodes!=null){
            for(var i=0;i<mirrorNodes.length;i++){
              Mindmeister.modifyIdea(Scrap.mapID,mirrorNodes[i].id,{title:mirrorNodes[i].getContent().replace("achieve "+oldValue,"achieve "+nodeContent)},cl);
            }
          }
        }
        else if(parentList.indexOf(parentContent)!=-1){
          var mirrorNodes = NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IN_ORDER_TO.getChildrenWithSubText(oldValue+" achieve");
          if(mirrorNodes!=null){
            for(var i=0;i<mirrorNodes.length;i++){
              Mindmeister.modifyIdea(Scrap.mapID,mirrorNodes[i].id,{title:mirrorNodes[i].getContent().replace(oldValue+" achieve",nodeContent+" achieve")},cl);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },true)
    }

    // TYPE OF CONTRIBUTION
    if(NodesNew.templateNodes.TYPE_OF_CONTRIBUTION!=null){
      NodesNew.templateNodes.TYPE_OF_CONTRIBUTION.onIconEdited(function(node,icon){
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        var promiseList = [];
        var parentNode = node.getParentNode();
        if(parentNode==null) return;
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent!=NodesNew.templateNodesText.TYPE_OF_CONTRIBUTION) return;
        var nodeContent = node.getContent();
        if(icon==Icons.enabled){
          let ch = parentNode.getChildren();
          for(let i=0;i<ch.length;i++){
            if(ch[i].getContent()!=nodeContent&&ch[i].getIcons().indexOf(Icons.enabled)!=-1){
              Mindmeister.modifyIdea(Scrap.mapID,ch[i].id,{icon:Icons.disabled},cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    // SET PROBLEM STATEMENT
    if(NodesNew.templateNodes.SET_PROBLEM_STATEMENT!=null){
      NodesNew.templateNodes.SET_PROBLEM_STATEMENT.onChildrenAdded(function(addedNodes){
        if(addedNodes==null||addedNodes.length==0) return;
        var newNodes = addedNodes;
        var addedNode = addedNodes[0];
        var parentNode = addedNode.getParentNode();
        var children = parentNode.getChildren();
        if(children.length==1){
          Scrap.showWorkingMessage();
          var cL = new Mindmeister.ChangeList();
          if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IMPROVE!=null){
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IMPROVE.id,{title:addedNode.getContent(),style:NODE_STYLES.template,link:"topic:"+addedNode.id},cL);
          }
          if(NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS!=null){
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS.id,{title:'What is "'+addedNode.getContent()+'" like?',style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS.id,{title:'What are its properties?',style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS.id,{title:'How can it be categorized?',style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS.id,{title:'How can we measure it?',style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS.id,{title:'What is its purpose?',style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS.id,{title:'What are its components?',style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS.id,{title:'How do the components relate to one another?',style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS.id,{title:'What are all the types of "'+addedNode.getContent()+'"?',style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS.id,{title:'How does "'+addedNode.getContent()+'" differ from similar problems?',style:NODE_STYLES.template},cL);
          }
          if(NodesNew.templateNodes.OCCURRENCE_QUESTIONS!=null){
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.OCCURRENCE_QUESTIONS.id,{title:'How often does "'+addedNode.getContent()+'" occur?',style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.OCCURRENCE_QUESTIONS.id,{title:'What is an average amount of "'+addedNode.getContent()+'"?',style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.OCCURRENCE_QUESTIONS.id,{title:'How does "'+addedNode.getContent()+'" normally work?',style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.OCCURRENCE_QUESTIONS.id,{title:'What is the process by which "'+addedNode.getContent()+'" happens?',style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.OCCURRENCE_QUESTIONS.id,{title:'In what sequence do the events of "'+addedNode.getContent()+'" occur?',style:NODE_STYLES.template},cL);
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.OCCURRENCE_QUESTIONS.id,{title:'What are the steps "'+addedNode.getContent()+'" goes through as it evolves?',style:NODE_STYLES.template},cL);
          }
          Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          })
        }
      },false);
      NodesNew.templateNodes.SET_PROBLEM_STATEMENT.onEdited(function(node,oldValue){
        if(node==null) return;
        var nodeContent = node.getContent();
        var parent = node.getParentNode();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(NodesNew.templateNodes.SET_PROBLEM_STATEMENT.id == parent.id){
          if(NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS!=null){
            var mirror = NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS.getChildrenWithSubText('"'+oldValue+'"');
            for(var i=0;i<mirror.length;i++){
              Mindmeister.modifyIdea(Scrap.mapID,mirror[i].id,{title:mirror[i].getContent().replace('"'+oldValue+'"','"'+nodeContent+'"')},cL);
            }
          }
          if(NodesNew.templateNodes.OCCURRENCE_QUESTIONS!=null) {
            var mirror = NodesNew.templateNodes.OCCURRENCE_QUESTIONS.getChildrenWithSubText('"'+oldValue+'"');
            for(var i=0;i<mirror.length;i++){
              Mindmeister.modifyIdea(Scrap.mapID,mirror[i].id,{title:mirror[i].getContent().replace('"'+oldValue+'"','"'+nodeContent+'"')},cL);
            }
          }
          if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IMPROVE!=null) {
            var mirror = NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IMPROVE.getChildrenWithText(oldValue);
            for(var i=0;i<mirror.length;i++){
              Mindmeister.modifyIdea(Scrap.mapID,mirror[i].id,{title:mirror[i].getContent().replace(oldValue,nodeContent)},cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },true);
      NodesNew.templateNodes.SET_PROBLEM_STATEMENT.onRemoved(function(removedNodes,parentNode){
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        // TO DO: MANAGE BETTER
        if(NodesNew.templateNodes.SET_PROBLEM_STATEMENT.getChildren().length>0) return;
        if(NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS!=null) {
          var ch = NodesNew.templateNodes.DESCRIPTIVE_QUESTIONS.getChildren();
          for(var i=0;i<ch.length;i++){
            Mindmeister.removeIdea(Scrap.mapID,ch[i].id,cL);
          }
        }
        if(NodesNew.templateNodes.OCCURRENCE_QUESTIONS!=null) {
          var ch = NodesNew.templateNodes.OCCURRENCE_QUESTIONS.getChildren();
          for(var i=0;i<ch.length;i++){
            Mindmeister.removeIdea(Scrap.mapID,ch[i].id,cL);
          }
        }
        if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IMPROVE!=null) {
          var ch = NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_IMPROVE.getChildren();
          for(var i=0;i<ch.length;i++){
            Mindmeister.removeIdea(Scrap.mapID,ch[i].id,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
        })
      });
    }

    // ASCERTAIN CONSEQUENCES
    if(NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES!=null){
      NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES.onChildrenAdded(function(addedNodes){
        if(addedNodes==null||addedNodes.length==0) return;
        var newNodes = addedNodes; //var newNodes = addedNodes[0].querySelectorAll("div.node");

        // GESTION RAMAS
        //if(newNodes.length>1){
        /*var aux = $(addedNodes[0].getHTMLElement()).find(".node")[0];
        if(aux==null) return;
        var fatherNode = new Scrap.Node(aux);
        var fatherNodeContent = fatherNode.getContent();
        if(fatherNodeContent==null||fatherNodeContent=="") return;
        var mirrorNode = Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(fatherNodeContent));
        if(mirrorNode==null||mirrorNode.length==0){
          // no existe -> insertar toda la estructura
        }
        else{
          return;
        }*/
        // mirar si existe reverse
        // si existe, quiere decir que se ha movido
        // si no existe, es nueva -> crear
        //}


        //var aux = $(addedNodes[0]).find(".node")[0];
        //if(aux==null) return;
        //var addedNode = new Scrap.Node(aux);
        var addedNode = addedNodes[0];

        if(addedNode==null||addedNode.getContent()=="") return;
        var mirrorNode = NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(addedNode.getContent()));
        if(mirrorNode==null||mirrorNode.length==0){
          // no existe -> insertar toda la estructura
        }
        else{
          return;
        }

        if(addedNode.getContent()==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text||addedNode.getContent()==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed) return;
        if(!addedNode.isDescendant(NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES)) return;

        var nodeAncestors = addedNode.getAncestors();
        for(var i=0;i<nodeAncestors.length;i++){
          if(nodeAncestors[i].getContent()==PrompterNew.Nodes.SUPPORTING_EVIDENCES.text) return;
        }

        // CHILD OF SUPPORTING EVIDENCES
        var parentNode = addedNode.getParentNode();
        if(parentNode!=null) var parentNodeContent = parentNode.getContent();
        if(parentNodeContent == PrompterNew.Nodes.SUPPORTING_EVIDENCES.text) return;

        var cL = addedNode.getChildrenWithText(PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text);
        if(cL!=null&&cL.length>0) return;
        var cL2 = addedNode.getChildrenWithText(PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed);
        if(cL2!=null&&cL2.length>0) return;

        if(parentNodeContent!=PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text&&parentNodeContent!=PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed&&parentNodeContent!=NodesNew.templateNodesText.ASCERTAIN_CONSEQUENCES) return;

        var addedNodeContent = addedNode.getContent();
        if(addedNodeContent!=null&&addedNodeContent!=PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text&&addedNodeContent!=PrompterNew.Nodes.SUPPORTING_EVIDENCES.text){
          Scrap.showWorkingMessage();
          var cl = new Mindmeister.ChangeList();
          var nodeId = Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{"title":PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text,"style":PrompterNew.Styles.prompt},cl,true);
          DScaffolding.insertTaskNode("What follows from '"+addedNodeContent+"'?",nodeId,cl);
          if(parentNodeContent!=null&&parentNodeContent==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed,style:PrompterNew.Styles.prompt_completed},cl);
            var grandParentNode = parentNode.getParentNode();
            var grandParentNodeContent = grandParentNode.getContent();
            DScaffolding.removeTaskNode("What follows from '"+grandParentNodeContent+"'?",cl);
          }
          if(parentNode.id==NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES.id) DScaffolding.cloneNodeBis(addedNode,DScaffolding.NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.id,cl,true);
          else{
            var grandParentNodeContent = parentNode.getParentNode().getContent();
            var mirrorNodes = DScaffolding.NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(DScaffolding.invertPoles(grandParentNodeContent));
            if(mirrorNodes!=null&&mirrorNodes.length>0){
              var thatLeadsToNode = mirrorNodes[0].getChildrenWithText(PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed);
              if(thatLeadsToNode==null||thatLeadsToNode.length==0){
                var aux = Mindmeister.insertIdea(Scrap.mapID,mirrorNodes[0].id,{"title":PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed,"style":PrompterNew.Styles.prompt_completed},cl);
                DScaffolding.cloneNodeBis(addedNode,aux,cl,true);
              }
              else{
                DScaffolding.cloneNodeBis(addedNode,thatLeadsToNode[0].id,cl,true);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
        })
      },true);
      NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES.onEdited(function(node,oldValue){
        if(oldValue==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text)return;
        var mirrorNodes = NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(DScaffolding.invertPoles(oldValue));
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        if(mirrorNodes!=null&&mirrorNodes.length>0){
          var contentReverse = DScaffolding.invertPoles(nodeContent);
          DScaffolding.syncNodes(mirrorNodes,{title:contentReverse},cl);
          // TO DO: IMPROVE
          for(var i=0;i<mirrorNodes.length;i++){
            mirrorNodes[i].setNodeContent(contentReverse);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },true);
      NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES.onRemoved(function(removedNodes,parentNode){
        var action = function(){
          Scrap.showWorkingMessage();
          var chL = new Mindmeister.ChangeList();
          if(removedNodes.length==1&&removedNodes[0]==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text){
            var parentNodeContent = parentNode.getContent();
            DScaffolding.removeTaskNode("What follows from '"+parentNodeContent+"'?",chL);
            var cL = parentNode.getChildrenWithText(PrompterNew.Nodes.SUPPORTING_EVIDENCES.text);
            if(cL==null||cL.length==0){
              var supportingNodeId = Mindmeister.insertIdea(Scrap.mapID,parentNode.id,{"title":PrompterNew.Nodes.SUPPORTING_EVIDENCES.text,"style":PrompterNew.Styles.prompt,"note":PrompterNew.Nodes.SUPPORTING_EVIDENCES.note},chL,true);
              var parentNodeContent = parentNode.getContent();
              DScaffolding.insertTaskNode("Supporting Evidences for '"+parentNodeContent+"'",supportingNodeId,chL);
              var mirrorNodes = NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(DScaffolding.invertPoles(parentNodeContent));
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.modifyIdea(Scrap.mapID,mirrorNodes[0].id,{icon:Icons.disabled},chL);
                var nodeId = Mindmeister.insertIdea(Scrap.mapID,mirrorNodes[0].id,{"title":PrompterNew.Nodes.CLICK_ICON_TO_ADDRESS.text,"style":PrompterNew.Styles.prompt},chL);
                DScaffolding.insertTaskNode("Click icon to address '"+DScaffolding.invertPoles(parentNodeContent)+"'",nodeId,chL);
              }
            }
          }
          else{
            var removedNodesA = DScaffolding.filterNodesTemplate(removedNodes); // TO DO
            for(var i=0;i<removedNodesA.length;i++){
              var mirrorNodesAlleviate = NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(DScaffolding.invertPoles(removedNodes[i]));
              var mirrorNodes = mirrorNodesAlleviate;
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                for(var j=0;j<mirrorNodes.length;j++){
                  Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[j].id,chL);
                }
              }
            }
          }
          Mindmeister.doChanges(Scrap.mapID,chL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          })
        }
        var removingRefs = false;
        for(var i=0;i<removedNodes.length;i++){
          if(removedNodes[i]==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text||removedNodes[i]==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed||removedNodes[i]==PrompterNew.Nodes.SUPPORTING_EVIDENCES.text) continue;
          var mirrorNodesAlleviate = NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(DScaffolding.invertPoles(removedNodes[i]));
          if(mirrorNodesAlleviate!=null){
            for(var j=0;j<mirrorNodesAlleviate.length;j++){
              var desc = mirrorNodesAlleviate[j].getDescendants();
              for(var k=0;k<desc.length;k++){
                var cont = desc[k].getContent();
                if(cont==PrompterNew.Nodes.SUPPORTING_EVIDENCES.text||cont==PrompterNew.Nodes.WHO_ELSE_ADDRESSES_IT.text||cont==PrompterNew.Nodes.JUSTIFICATORY_KNOWLEDGE.text){
                  if(desc[k].getDescendants().length>0){
                    removingRefs = true;
                  }
                }
              }
            }
          }
        }
        if(removingRefs){
          // TO DO - HIGHLIGHT REFERENCES
          Scrap.showConfirmationMessage("Propagating these changes to the solution space will remove some pieces of literature",function(){
            // TO DO - UNHIGHLIGHT REFS
            action();
          },function(){
            // TO DO - UNHIGHLIGHT REFS
            Scrap.showWorkingMessage();
            Mindmeister.getMapRevision(Scrap.mapID).then(function(revisionId){
              Mindmeister.getRevisionChanges(Scrap.mapID,parseInt(revisionId)-1).then(function(changes){
                var undoChanges = [];
                var removeChanges = changes.filter((el) => {return el.type == "Remove"});
                for(var j=0;j<removeChanges.length;j++){
                  undoChanges = undoChanges.concat(removeChanges[j].old_data);
                }
                Mindmeister.undoLastChange(Scrap.mapID);
                Scrap.reloadCanvas(true,undoChanges,parseInt(revisionId)-1,null);
              })
            })
          },"Proceed anyway","Undo");
        }
        else{
          action();
        }
      },false,[NodesNew.templateNodes.PROBLEM_AS_DIFFICULTIES.id,NodesNew.templateNodes.SET_PROBLEM_STATEMENT.id]);
    }

    // ASCERTAIN CAUSES
    if(NodesNew.templateNodes.ASCERTAIN_CAUSES!=null){
      NodesNew.templateNodes.ASCERTAIN_CAUSES.onChildrenAdded(function(addedNodes){
        if(addedNodes==null||addedNodes.length==0) return;
        var newNodes = addedNodes; //var newNodes = addedNodes[0].querySelectorAll("div.node");

        /*
        // GESTION RAMAS
        //if(newNodes.length>1){
          var fatherNode = $(addedNodes[0]).find(".node")[0];
          if(fatherNode==null)return;
          var fatherNodeContent = Scrap.selectContent(fatherNode);
          if(fatherNodeContent==null||fatherNodeContent=="") return;
          var mirrorNode = DScaffolding.getChildsWithText(Nodes.templateNodes.PROBLEM_AS_SOLUTIONS,DScaffolding.reversePoles(fatherNodeContent));
          if(mirrorNode==null||mirrorNode.length==0){
            // no existe -> insertar toooooda la estructura
          }
          else{
            return;
          }
          // mirar si existe reverse
          // si existe, quiere decir que se ha movido
          // si no existe, es nueva -> crear
        //}
        */
        var addedNode = addedNodes[0];//$(addedNodes[0]).find(".node")[0];

        if(addedNode==null||addedNode.getContent()=="") return;
        var mirrorNode = NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(addedNode.getContent()));
        if(mirrorNode==null||mirrorNode.length==0){
          // no existe -> insertar toda la estructura
        }
        else{
          return;
        }

        if(addedNode.getContent()==PrompterNew.Nodes.WHY.text||addedNode.getContent()==PrompterNew.Nodes.WHY.completed) return;
        if(!addedNode.isDescendant(NodesNew.templateNodes.ASCERTAIN_CAUSES)) return;

        var nodeAncestors = addedNode.getAncestors();
        for(var i=0;i<nodeAncestors.length;i++){
          if(nodeAncestors[i].getContent()==PrompterNew.Nodes.SUPPORTING_EVIDENCES.text) return;
        }

        // CHILD OF SUPPORTING EVIDENCES
        var parentNode = addedNode.getParentNode();
        if(parentNode!=null) var parentNodeContent = parentNode.getContent();
        if(parentNodeContent == PrompterNew.Nodes.SUPPORTING_EVIDENCES.text) return;

        var cL = addedNode.getChildrenWithText(PrompterNew.Nodes.WHY.text);
        if(cL!=null&&cL.length>0) return;
        var cL2 = addedNode.getChildrenWithText(PrompterNew.Nodes.WHY.completed);
        if(cL2!=null&&cL2.length>0) return;

        if(parentNodeContent!=PrompterNew.Nodes.WHY.text&&parentNodeContent!=PrompterNew.Nodes.WHY.completed&&parentNodeContent!=NodesNew.templateNodesText.ASCERTAIN_CAUSES) return;

        var addedNodeContent = addedNode.getContent();
        var promiseList = [];
        if(addedNodeContent!=null&&addedNodeContent!=PrompterNew.Nodes.WHY.text&&addedNodeContent!=PrompterNew.Nodes.SUPPORTING_EVIDENCES.text){
          Scrap.showWorkingMessage();
          var cl = new Mindmeister.ChangeList();
          var whyNodeId = Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{"title":PrompterNew.Nodes.WHY.text,"style":PrompterNew.Styles.prompt},cl,true);
          DScaffolding.insertTaskNode("Why does '"+addedNodeContent+"' happen?",whyNodeId,cl);
          var parentNode = addedNode.getParentNode();
          if(parentNode!=null) var parentNodeContent = parentNode.getContent();
          if(parentNodeContent!=null&&parentNodeContent==PrompterNew.Nodes.WHY.text){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:PrompterNew.Nodes.WHY.completed,style:PrompterNew.Styles.prompt_completed},cl);
            var grandParentNode = parentNode.getParentNode();
            var grandParentNodeContent = grandParentNode.getContent();
            DScaffolding.removeTaskNode("Why does '"+grandParentNodeContent+"' happen?",cl);
          }
          if(parentNodeContent==NodesNew.templateNodesText.ASCERTAIN_CAUSES) DScaffolding.cloneNodeBis(addedNode,NodesNew.templateNodes.LESSEN_CAUSES.id,cl,true);
          else{
            var grandParentNodeContent = parentNode.getParentNode().getContent();
            var mirrorNodes = NodesNew.templateNodes.LESSEN_CAUSES.getChildrenWithText(DScaffolding.invertPoles(grandParentNodeContent));
            if(mirrorNodes!=null&&mirrorNodes.length>0){
              var whyNode = mirrorNodes[0].getChildrenWithText(PrompterNew.Nodes.WHY.completed);
              if(whyNode==null||whyNode.length==0){
                var aux = Mindmeister.insertIdea(Scrap.mapID,mirrorNodes[0].id,{title:PrompterNew.Nodes.WHY.completed,style:PrompterNew.Styles.prompt_completed},cl)
                DScaffolding.cloneNodeBis(addedNode,aux,cl,true);
              }
              else{
                DScaffolding.cloneNodeBis(addedNode,whyNode[0].id,cl,true);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      NodesNew.templateNodes.ASCERTAIN_CAUSES.onEdited(function(node,oldValue){
        if(oldValue==PrompterNew.Nodes.WHY.text) return;
        var mirrorNodes = NodesNew.templateNodes.LESSEN_CAUSES.getChildrenWithText(DScaffolding.invertPoles(oldValue));
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        if(mirrorNodes!=null&&mirrorNodes.length>0){
          var contentReverse = DScaffolding.invertPoles(nodeContent);
          for(var i=0;i<mirrorNodes.length;i++){
            mirrorNodes[i].setNodeContent(contentReverse);
          }
          DScaffolding.syncNodes(mirrorNodes,{title:contentReverse},cl);
          // TO DO: IMPROVE
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },true)
      NodesNew.templateNodes.ASCERTAIN_CAUSES.onRemoved(function(removedNodes,parentNode){
        var action = function(){
          Scrap.showWorkingMessage();
          var chL = new Mindmeister.ChangeList();
          if(removedNodes.length==1&&removedNodes[0]==PrompterNew.Nodes.WHY.text){
            var parentNodeContent = parentNode.getContent();
            DScaffolding.removeTaskNode("Why does '"+parentNodeContent+"' happen?",chL);
            var cL = parentNode.getChildrenWithText(PrompterNew.Nodes.SUPPORTING_EVIDENCES.text);
            if(cL==null||cL.length==0){
              var supportingNodeId = Mindmeister.insertIdea(Scrap.mapID,parentNode.id,{title:PrompterNew.Nodes.SUPPORTING_EVIDENCES.text,"style":PrompterNew.Styles.prompt,"note":PrompterNew.Nodes.SUPPORTING_EVIDENCES.note},chL,true);
              var parentNodeContent = parentNode.getContent();
              DScaffolding.insertTaskNode("Supporting Evidences for '"+parentNodeContent+"'",supportingNodeId,chL);
              var mirrorNodes = NodesNew.templateNodes.LESSEN_CAUSES.getChildrenWithText(DScaffolding.invertPoles(parentNodeContent));
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.modifyIdea(Scrap.mapID,mirrorNodes[0].id,{icon:Icons.disabled},chL);
                var nodeId = Mindmeister.insertIdea(Scrap.mapID,mirrorNodes[0].id,{title:PrompterNew.Nodes.CLICK_ICON_TO_ADDRESS.text,style:PrompterNew.Styles.prompt},chL);
                DScaffolding.insertTaskNode("Click icon to address '"+DScaffolding.invertPoles(parentNodeContent)+"'",nodeId,chL);
              }
            }
          }
          else{
            var rN = DScaffolding.filterNodesTemplate(removedNodes); // TO DO
            for(var i=0;i<rN.length;i++){
              var mirrorNodesAlleviate = NodesNew.templateNodes.LESSEN_CAUSES.getChildrenWithText(DScaffolding.invertPoles(rN[i]));
              var mirrorNodes = mirrorNodesAlleviate;
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                for(var j=0;j<mirrorNodes.length;j++){
                  Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[j].id,chL);
                }
              }
            }
          }
          Mindmeister.doChanges(Scrap.mapID,chL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
            else Scrap.hideWorkingMessage();
          })
        }
        var removingRefs = false;
        for(var i=0;i<removedNodes.length;i++){
          if(removedNodes[i]==PrompterNew.Nodes.WHY.text||removedNodes[i]==PrompterNew.Nodes.WHY.completed||removedNodes[i]==PrompterNew.Nodes.SUPPORTING_EVIDENCES.text) continue;
          var mirrorNodesAlleviate = NodesNew.templateNodes.LESSEN_CAUSES.getChildrenWithText(DScaffolding.invertPoles(removedNodes[i]));
          if(mirrorNodesAlleviate!=null){
            for(var j=0;j<mirrorNodesAlleviate.length;j++){
              var desc = mirrorNodesAlleviate[j].getDescendants();
              for(var k=0;k<desc.length;k++){
                var cont = desc[k].getContent();
                if(cont==PrompterNew.Nodes.SUPPORTING_EVIDENCES.text||cont==PrompterNew.Nodes.WHO_ELSE_ADDRESSES_IT.text||cont==PrompterNew.Nodes.JUSTIFICATORY_KNOWLEDGE.text){
                  if(desc[k].getDescendants().length>0) removingRefs = true;
                }
              }
            }
          }
        }
        if(removingRefs){
          // TO DO - HIGHLIGHT REFERENCES
          Scrap.showConfirmationMessage("Propagating this change to the solution space will remove some pieces of literature",function(){
            // TO DO - UNHIGHLIGHT REFS
            action();
          },function(){
            // TO DO - UNHIGHLIGHT REFS
            Scrap.showWorkingMessage();
            Mindmeister.getMapRevision(Scrap.mapID).then(function(revisionId){
              Mindmeister.getRevisionChanges(Scrap.mapID,parseInt(revisionId)-1).then(function(changes){
                var undoChanges = [];
                var removeChanges = changes.filter((el) => {return el.type=="Remove"});
                for(var j=0;j<removeChanges.length;j++){
                  undoChanges = undoChanges.concat(removeChanges[j].old_data);
                }
                Mindmeister.undoLastChange(Scrap.mapID);
                Scrap.reloadCanvas(true,undoChanges,parseInt(revisionId)-1,null);
              })
            })
          },"Proceed anyway","Undo");
        }
        else{
          action();
        }
      },false,[NodesNew.templateNodes.PROBLEM_AS_DIFFICULTIES.id,NodesNew.templateNodes.SET_PROBLEM_STATEMENT.id]);
    }

    // PROBLEM AS DIFFICULTIES
    if(NodesNew.templateNodes.PROBLEM_AS_DIFFICULTIES!=null){
      NodesNew.templateNodes.PROBLEM_AS_DIFFICULTIES.onMoved(function(movedNodes,parentNode){
        if(movedNodes.length==1&&!Scrap.getNodeById(movedNodes[0].newParentId).isDescendant(NodesNew.templateNodes.PROBLEM_AS_DIFFICULTIES)) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        for(var i=0;i<movedNodes.length;i++){
          var movedNode = movedNodes[i].node;//Scrap.getNodeById(movedNodes[i].nodeId);
          var movedNodeContent = movedNode.getContent();
          var nodeToMove = null;
          var insertDone = false;

          var oldParentNodeContent = parentNode.getContent();
          if(oldParentNodeContent==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed){
            var children = parentNode.getChildren();
            if(children==null||children.length==0){
              var gp = parentNode.getParentNode();
              var gpContent = gp.getContent();
              Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text,style:PrompterNew.Styles.prompt},cL);
              DScaffolding.insertTaskNode("What follows from '"+gpContent+"'?",parentNode.id,cL);
            }
          }
          else if(oldParentNodeContent==PrompterNew.Nodes.WHY.completed){
            var children = parentNode.getChildren();
            if(children==null||children.length==0){
              var gp = parentNode.getParentNode();
              var gpContent = gp.getContent();
              Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:PrompterNew.Nodes.WHY.text,style:PrompterNew.Styles.prompt},cL);
              DScaffolding.insertTaskNode("Why does '"+gpContent+"' happen?",parentNode.id,cL)
            }
          }

          if(movedNodeContent==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed||movedNodeContent==PrompterNew.Nodes.WHY.completed){
            var movedNodeFirstChildren = new Scrap.Node($(movedNode.getHTMLElement()).find("#tk_children_"+movedNode.id+" .node")[0]);
            var movedNodeFirstChildrenMirror = NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(movedNodeFirstChildren.getContent()));
            if(movedNodeFirstChildrenMirror!=null&&movedNodeFirstChildrenMirror.length>0) nodeToMove = movedNodeFirstChildrenMirror[0].getParentNode();
          }
          else nodeToMove = NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(movedNodeContent))[0];

          // gestion design theory
          if(nodeToMove==null) continue;
          var movedNodeActiveDesc = DScaffolding.getActiveDescendants(nodeToMove.id);
          if(movedNodeActiveDesc!=null&&movedNodeActiveDesc.length>0){
            /*var designTheoryNodeToCut = nodeToMove;
            var stop = false;
            while(!stop){
              var lagParent = designTheoryNodeToCut.getParentNode();
              var lagParentContent = lagParent.getContent();
              var lagParentActiveDescendants = DScaffolding.getActiveDescendants(lagParent.id);
              if(lagParentActiveDescendants==null||lagParentActiveDescendants.length==0) break;
              if(lagParentContent=="Alleviate Consequences"||lagParentContent=="Lessen Causes"||lagParentActiveDescendants.length>movedNodeActiveDesc.length){
                stop = true;
              }
              else{
                designTheoryNodeToCut = lagParent;
              }
            }
            if(stop){
            }*/
          }

          var newParentNode = new Scrap.Node(document.getElementById(movedNodes[i].newParentId));
          var newParentNodeContent = newParentNode.getContent();

          var insertionPoint = null;
          //var movedNodeMirror =
          if(newParentNodeContent=="Ascertain Consequences"){
            insertionPoint = NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES;
          }
          else if(newParentNodeContent=="Ascertain Causes"){
            insertionPoint = NodesNew.templateNodes.LESSEN_CAUSES;
          }
          else if(newParentNodeContent==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed){
            var aux = newParentNode.getParentNode();
            var auxContent = aux.getContent();
            var auxMirror = NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(auxContent));
            if(auxMirror==null||auxMirror.length==0) continue;
            var auxChildren = auxMirror[0].getChildren();
            if(auxChildren.length==0) continue;
            for(var j=0;j<auxChildren.length;j++){
              if(auxChildren[j].getContent() == PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed){
                insertionPoint = auxChildren[j];
                break;
              }
            }
          }
          else if(newParentNodeContent==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text){
            var aux = newParentNode.getParentNode();
            var auxContent = aux.getContent();

            Mindmeister.modifyIdea(Scrap.mapID,newParentNode.id,{title:PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed,style:PrompterNew.Styles.prompt_completed},cL);
            DScaffolding.removeTaskNode("What follows from '"+auxContent+"'?",cL);

            var auxMirror = NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(auxContent));
            if(auxMirror==null||auxMirror.length==0) continue;
            var auxChildren = auxMirror[0].getChildren();
            if(auxChildren!=null&&auxChildren.length!=0){
              for(var j=0;j<auxChildren.length;j++){
                if(auxChildren[j].getContent() == PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed){
                  insertionPoint = auxChildren[j];
                  break;
                }
              }
            }
            else{
              var nId = Mindmeister.insertIdea(Scrap.mapID,auxMirror[0].id,{title: PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed,style:PrompterNew.Styles.prompt_completed},cL);
              Mindmeister.moveNode(Scrap.mapID,nodeToMove.id,nId,cL);
              insertDone = true;
              //continue;
            }
          }
          else if(newParentNodeContent==PrompterNew.Nodes.WHY.completed){
            var aux = newParentNode.getParentNode();
            var auxContent = aux.getContent();
            var auxMirror = NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(auxContent));
            if(auxMirror==null||auxMirror.length==0) continue;
            var auxChildren = auxMirror[0].getChildren();
            if(auxChildren.length==0) continue;
            for(var j=0;j<auxChildren.length;j++){
              if(auxChildren[j].getContent() == PrompterNew.Nodes.WHY.completed){
                insertionPoint = auxChildren[j];
                break;
              }
            }
          }
          else if(newParentNodeContent==PrompterNew.Nodes.WHY.text){
            var aux = newParentNode.getParentNode();
            var auxContent = aux.getContent();
            Mindmeister.modifyIdea(Scrap.mapID,newParentNode.id,{title:PrompterNew.Nodes.WHY.completed,style:PrompterNew.Styles.prompt_completed},cL);
            DScaffolding.removeTaskNode("Why does '"+auxContent+"' happen?",cL);

            var auxMirror = NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(auxContent));
            if(auxMirror==null||auxMirror.length==0) continue;
            var auxChildren = auxMirror[0].getChildren();
            if(auxChildren.length!=0){
              for(var j=0;j<auxChildren.length;j++){
                if(auxChildren[j].getContent() == PrompterNew.Nodes.WHY.completed){
                  insertionPoint = auxChildren[j];
                  break;
                }
              }
            }
            else{
              var nId = Mindmeister.insertIdea(Scrap.mapID,auxMirror[0].id,{title: PrompterNew.Nodes.WHY.completed,style:PrompterNew.Styles.prompt_completed},cL);
              Mindmeister.moveNode(Scrap.mapID,nodeToMove.id,nId,cL);
              insertDone = true;
              //continue;
            }
          }
          else{
            var mirror = NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(DScaffolding.invertPoles(newParentNodeContent));
            if(mirror!=null&&mirror.length>0){
              insertionPoint = mirror[0];
            }
          }

          if((parentNode.isDescendant(NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES)||oldParentNodeContent=="Ascertain Consequences")&&(newParentNode.isDescendant(NodesNew.templateNodes.ASCERTAIN_CAUSES)||newParentNodeContent=="Ascertain Causes")){
            var lag = DScaffolding.getActiveDescendants(nodeToMove.id);
            /*if(lag!=null&&lag.length>0){
              var nodeToLook = Nodes.templateNodes.REQ_PURPOSE_BENEFITS;
              var nntmIns = Nodes.templateNodes.REQ_REDUCE_CAUSES;
              var nonFunctionalRequirementsNode = Nodes.templateNodes.NON_FUNCTIONAL_REQUIREMENTS;
              var nntmClone = nonFunctionalRequirementsNode.getChildsWithSubText("In the checklists below, tick any non-functional requirements");
              if(nodeToLook!=null){
                for(var j=0;j<lag.length;j++){
                  var ntm = nodeToLook.getChildrenWithText(lag[j]);
                  if(ntm!=null&&ntm.length>0) Mindmeister.moveNode(Scrap.mapID,ntm[0].id,nntmIns.id,cL);
                  var nodeToClone = Nodes.templateNodes.ALLEVIATE_CONSEQUENCES.getChildrenWithText(lag[j]);
                  if(nodeToClone!=null&&nodeToClone.length>0&&nntmClone!=null&&nntmClone.length>0) DScaffolding.cloneNodeBis(nodeToClone[0],nntmClone[0].id,cL);
                }
              }
            }*/
            DScaffolding.switchConsequencesIntoCauses(movedNode.id,nodeToMove.id,cL);
          }
          else if((parentNode.isDescendant(NodesNew.templateNodes.ASCERTAIN_CAUSES)||oldParentNodeContent=="Ascertain Causes")&&(newParentNode.isDescendant(NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES)||newParentNodeContent=="Ascertain Consequences")){
            var lag = DScaffolding.getActiveDescendants(nodeToMove.id);
            /*if(lag!=null&&lag.length>0){
              var nntmIns = Nodes.templateNodes.REQ_PURPOSE_BENEFITS;
              var nodeToLook = Nodes.templateNodes.REQ_REDUCE_CAUSES;
              var nonFunctionalRequirementsNode = Nodes.templateNodes.NON_FUNCTIONAL_REQUIREMENTS;
              var nntmRemove = nonFunctionalRequirementsNode.getChildsWithSubText("In the checklists below, tick any non-functional requirements");
              if(nodeToLook!=null){
                for(var j=0;j<lag.length;j++){
                  var ntm = nodeToLook.getChildrenWithText(lag[j]);
                  if(ntm!=null&&ntm.length>0) Mindmeister.moveNode(Scrap.mapID,ntm[0].id,nntmIns.id,cL);
                  if(nntmRemove!=null&&nntmRemove.length>0){
                    var nodeToRemove = nntmRemove[0].getChildrenWithText(lag[j]);
                    if(nodeToRemove!=null&&nodeToRemove.length>0) Mindmeister.removeIdea(Scrap.mapID,nodeToRemove[0].id,cL);
                  }
                }
              }
            }*/
            DScaffolding.switchCausesIntoConsequences(movedNode.id,nodeToMove.id,cL);
          }

          if(!insertDone&&nodeToMove!=null&&insertionPoint!=null){
            Mindmeister.moveNode(Scrap.mapID,nodeToMove.id,insertionPoint.id,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
      NodesNew.templateNodes.PROBLEM_AS_DIFFICULTIES.onDrag(function(draggedNode){
        var draggedNodeContent = draggedNode.getContent();
        if(draggedNodeContent==null) return;
        if(draggedNodeContent == NodesNew.templateNodesText.PROBLEM_AS_DIFFICULTIES || draggedNodeContent == NodesNew.templateNodesText.ASCERTAIN_CONSEQUENCES || draggedNodeContent == NodesNew.templateNodesText.ASCERTAIN_CAUSES) return;
        if (draggedNodeContent == PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text || draggedNodeContent == PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed || draggedNodeContent == PrompterNew.Nodes.WHY.text || draggedNodeContent == PrompterNew.Nodes.WHY.completed){
          Scrap.showMessage("Moving prompt nodes is discouraged",false,"ds_dragging_message");
          var mapNodes = document.querySelectorAll(".node:not(.dragging), .root:not(.dragging) ,.root_child:not(.dragging)");
          for(var i=0;i<mapNodes.length;i++) {
            mapNodes[i].style.opacity = 0.2;
            if(mapNodes[i].style.backgroundColor!=null) mapNodes[i].setAttribute("ds_backgroundColor",mapNodes[i].style.backgroundColor);
            mapNodes[i].style.backgroundColor = "#e8a7a7";
          }
        }
        else{
          var parentNode = draggedNode.getParentNode();
          if(parentNode==null) return;
          var parentNodeContent = parentNode.getContent();
          if(parentNodeContent==null) return;
          if(parentNodeContent==NodesNew.templateNodesText.ASCERTAIN_CONSEQUENCES || parentNodeContent==NodesNew.templateNodesText.ASCERTAIN_CAUSES || parentNodeContent==PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed || parentNodeContent==PrompterNew.Nodes.WHY.completed){
            var mapNodes = document.querySelectorAll(".node:not(.dragging), .root:not(.dragging) ,.root_child:not(.dragging)");
            for(var i=0;i<mapNodes.length;i++){
              var n = new Scrap.Node(mapNodes[i]);
              if(n==null) continue;
              if(!n.isDescendant(NodesNew.templateNodes["PROBLEM_AS_DIFFICULTIES"]) || n.id == draggedNode.id || n.isDescendant(draggedNode)){
                mapNodes[i].style.opacity = 0.2;
                continue;
              }
              var nC = n.getContent();
              if(nC==null) continue;
              if(nC == Nodes.templateNodesText.ASCERTAIN_CONSEQUENCES || nC == NodesNew.templateNodesText.ASCERTAIN_CAUSES || nC == PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text || nC == PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed || nC == PrompterNew.Nodes.WHY.text || nC == PrompterNew.Nodes.WHY.completed){
                //if(mapNodes[i].style.backgroundColor!=null) mapNodes[i].setAttribute("ds_backgroundColor",mapNodes[i].style.backgroundColor);
                //mapNodes[i].style.backgroundColor = "#d2ffaa";
              }
              else{
                mapNodes[i].style.opacity = 0.2;
              }
            }
          }
          Scrap.showMessage("Recommended destinations are highlighted",false,"ds_dragging_message");
        }
      },function(){
        var mapNodes = document.querySelectorAll(".node, .root, .root_child");
        for(var i=0;i<mapNodes.length;i++){
          var n = new Scrap.Node(mapNodes[i]);
          if(n==null) continue;
          if(mapNodes[i].style.opacity==0.2) mapNodes[i].style.opacity = 1;
          if(mapNodes[i].getAttribute("ds_backgroundColor")!=null){
            mapNodes[i].style.backgroundColor = mapNodes[i].getAttribute("ds_backgroundColor");
            mapNodes[i].removeAttribute("ds_backgroundColor");
          }
        }
        Scrap.removeMessage("ds_dragging_message");
      },true);
    }

    // ALLEVIATE CONSEQUENCES
    if(NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES!=null){
      NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.onIconEdited(function(node,icon){
        var cl = new Mindmeister.ChangeList();
        Scrap.showWorkingMessage();
        var nodeContent = node.getContent();
        if(icon==Icons.enabled){
          //DScaffolding.syncDesignTheory(cl);
          //if(Nodes.templateNodes.REQ_PURPOSE_BENEFITS!=null){
          //  DScaffolding.cloneNodeBis(node,Nodes.templateNodes.REQ_PURPOSE_BENEFITS.id,cl);
          var clickToAddressNode = node.getChildrenWithText("Click icon to address it");
          if(clickToAddressNode!=null&&clickToAddressNode.length==1){
            Mindmeister.removeIdea(Scrap.mapID,clickToAddressNode[0].id,cl);
            DScaffolding.removeTaskNode("Click icon to address '"+nodeContent+"'",cl);
            var nId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:"Who else addresses it?",style:PrompterNew.Styles.prompt},cl,true);
            DScaffolding.insertTaskNode("Who else addresses '"+nodeContent+"'?",nId,cl);
          }
          else{
            var nId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:"Who else addresses it?",style:PrompterNew.Styles.prompt},cl,true);
            DScaffolding.insertTaskNode("Who else addresses '"+nodeContent+"'?",nId,cl);
          }
          if(NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS!=null){
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS.id,{title:nodeContent,style:NODE_STYLES.template,link:"topic:"+node.id},cl);
          }
          //}
        }
        else if(icon==Icons.disabled){
          //var mirrorNodesAlleviate = Nodes.templateNodes.FUNCTIONAL_REQUIREMENTS.getChildrenWithText(nodeContent);
          //var mirrorNodes = mirrorNodesAlleviate;

          /*var mirrorNodesAscertainCons = Nodes.templateNodes.ASCERTAIN_CONSEQUENCES.getChildrenWithSubText(DScaffolding.unInvertPoles(nodeContent));
          var mirrorNodesDesignTheory = [];
          if(mirrorNodesAscertainCons!=null&&mirrorNodesAscertainCons.length>0){
            var originalContent = mirrorNodesAscertainCons[0].getContent();
            var mirrorNodesDesignTheory = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(DScaffolding.unInvertPoles(originalContent));
          }
          for(var j=0;j<mirrorNodesDesignTheory.length;j++){
            mirrorNodes.push(DScaffolding.getPointToRemove(mirrorNodesDesignTheory[j]));
          }


          if(mirrorNodes!=null&&mirrorNodes.length>0){
            for(var i=0;i<mirrorNodes.length;i++){
              Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[i].id,cl);
            }
          }*/

          var whoElseAddressesNode = node.getChildrenWithText("Who else addresses it?");
          if(whoElseAddressesNode!=null&&whoElseAddressesNode.length>0){

            Mindmeister.removeIdea(Scrap.mapID,whoElseAddressesNode[0].id,cl);
          }
          if(NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS!=null){
            var ch = NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS.getChildrenWithSubText(nodeContent);
            for(var i=0;i<ch.length;i++){
              Mindmeister.removeIdea(Scrap.mapID,ch[i].id,cl);
            }
          }
          Scrap.enableUserDeleted(2000);
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      })
      /*NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.onChildrenAdded(function(addedNodes){
        if(addedNodes==null||addedNodes.length==0) return;
        var newNodes = addedNodes; //var newNodes = addedNodes[0].querySelectorAll("div.node");

        var addedNode = addedNodes[0];//$(addedNodes[0]).find(".node")[0];
        if(addedNode==null||addedNode.getContent()=="") return;

        var parentNode = addedNode.getParentNode();
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);*/
      NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        if(removedNodes.length==0) return;
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS!=null){
          for(var i=0;i<removedNodes.length;i++){
            if(removedNodes[i]==Prompter.Nodes.SUPPORTING_EVIDENCES.text||removedNodes[i]==Prompter.Nodes.WHO_ELSE_ADDRESSES_IT.text) continue;
            var ch = NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS.getChildren().filter((el) => {return el.getContent()==removedNodes[i]});
            for(var j=0;j<ch.length;j++){
              Mindmeister.removeIdea(Scrap.mapID,ch[j].id,cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },false,[NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.id]);
      NodesNew.templateNodes.ALLEVIATE_CONSEQUENCES.onEdited(function(node,oldValue){
        if(node==null||node.getContent()==oldValue) return;
        var icons = node.getIcons();
        if(icons==null||icons.indexOf(Icons.enabled)==-1) return;
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        if(NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS!=null){
          var mirrorNodes = NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS.getChildrenWithText(oldValue);
          for(var i=0;i<mirrorNodes.length;i++){
            mirrorNodes[i].setNodeContent(node.getContent());
            Mindmeister.modifyIdea(Scrap.mapID,mirrorNodes[i].id,{title:node.getContent()},cl);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },true)
    }

    //LESSEN CAUSES
    if(NodesNew.templateNodes.LESSEN_CAUSES!=null){
      NodesNew.templateNodes.LESSEN_CAUSES.onIconEdited(function(node,icon){
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        var promiseList = [];
        var nodeContent = node.getContent();
        if(icon==Icons.enabled){
          //DScaffolding.syncDesignTheory(cl);
          //var insertionPoint = Nodes.templateNodes.REQ_REDUCE_CAUSES;
          //if(insertionPoint!=null){
          // DScaffolding.cloneNodeBis(node,insertionPoint.id,cl);
          var clickToAddressNode = node.getChildrenWithText("Click icon to address it");
          if(clickToAddressNode!=null&&clickToAddressNode.length==1){
            Mindmeister.removeIdea(Scrap.mapID,clickToAddressNode[0].id,cl)
            DScaffolding.removeTaskNode("Click icon to address '"+nodeContent+"'",cl);
            var nId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:"Who else addresses it?",style:Prompter.Styles.prompt},cl,true);
            DScaffolding.insertTaskNode("Who else addresses '"+nodeContent+"'?",nId,cl);
          }
          else{
            var nId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:"Who else addresses it?",style:Prompter.Styles.prompt},cl,true);
            DScaffolding.insertTaskNode("Who else addresses '"+nodeContent+"'?",nId,cl);
          }
          //}
          if(NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS!=null){
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS.id,{title:nodeContent,style:NODE_STYLES.template,link:"topic:"+node.id},cl);
          }
          /*var insertionPoint = Nodes.templateNodes.NON_FUNCTIONAL_REQUIREMENTS.getChildrenWithSubText("In the checklists below, tick any non-functional requirements");
          if(insertionPoint!=null&&insertionPoint.length>0){
            DScaffolding.cloneNodeBis(node,insertionPoint[0].id,cl);
          }*/
        }
        else if(icon==Icons.disabled){
          /*var mirrorNodesAlleviate = Nodes.templateNodes.DECIDE_REQUIREMENTS_CAPTURE_IDEAS.getChildrenWithText(nodeContent);
          var mirrorNodes = mirrorNodesAlleviate;

          var mirrorNodesAscertainCauses = Nodes.templateNodes.ASCERTAIN_CAUSES.getChildrenWithSubText(DScaffolding.unInvertPoles(nodeContent));
          var mirrorNodesDesignTheory = [];
          if(mirrorNodesAscertainCauses!=null&&mirrorNodesAscertainCauses.length>0){
            var originalContent = mirrorNodesAscertainCauses[0].getContent();
            var mirrorNodesDesignTheory = Nodes.templateNodes.FORMULATE_DESIGN_THEORY.getChildrenWithText(DScaffolding.unInvertPoles(originalContent));
          }

          for(var j=0;j<mirrorNodesDesignTheory.length;j++){
            mirrorNodes.push(DScaffolding.getPointToRemove(mirrorNodesDesignTheory[j]));
          }
          // BORRAR DESDE RAIZ EN DESIGN THEORY
          //var mirrorNodes = mirrorNodesAlleviate.concat(mirrorNodesDesignTheory);
          if(mirrorNodes!=null&&mirrorNodes.length>0){
            for(var i=0;i<mirrorNodes.length;i++){
              Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[i].id,cl);
            }
          }*/

          var whoElseAddressesNode = node.getChildrenWithText("Who else addresses it?");
          if(whoElseAddressesNode!=null&&whoElseAddressesNode.length>0){
            Mindmeister.removeIdea(Scrap.mapID,whoElseAddressesNode[0].id,cl);
          }
          if(NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS!=null){
            var ch = NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS.getChildrenWithSubText(nodeContent);
            for(var i=0;i<ch.length;i++){
              Mindmeister.removeIdea(Scrap.mapID,ch[i].id,cl);
            }
          }
          Scrap.enableUserDeleted(2000);
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      })
      /*NodesNew.templateNodes.LESSEN_CAUSES.onChildrenAdded(function(addedNodes){
        if(addedNodes==null||addedNodes.length==0) return;
        var newNodes = addedNodes; //var newNodes = addedNodes[0].querySelectorAll("div.node");

        var addedNode = addedNodes[0];//$(addedNodes[0]).find(".node")[0];
        if(addedNode==null||addedNode.getContent()=="") return;

        var parentNode = addedNode.getParentNode();
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        if(parentNode.getContent()==PrompterNew.Nodes.HOW_ARE_YOU_GOING_TO_ADDRESS_IT.text){
          if(parentNode.getChildren().length<2){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:PrompterNew.Nodes.HOW_ARE_YOU_GOING_TO_ADDRESS_IT.completed,style:PrompterNew.Styles.prompt_completed},cl);
            var grandParentNodeContent = parentNode.getParentNode().getContent();
            DScaffolding.removeTaskNode("How are you going to address '"+grandParentNodeContent+"'?",cl);
          }
          var justificatoryKnowledgeNode = Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{"title":PrompterNew.Nodes.JUSTIFICATORY_KNOWLEDGE.text,"style":PrompterNew.Styles.prompt},cl,true);
          DScaffolding.insertTaskNode("What is the justificatory knowledge for '"+addedNode.getContent()+"'?",justificatoryKnowledgeNode,cl);
          if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_BY!=null){
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_BY.id,{title:addedNode.getContent(),style:NODE_STYLES.template,link:"topic:"+addedNode.id},cl);
          }
        }
        else if(parentNode.getContent()==PrompterNew.Nodes.JUSTIFICATORY_KNOWLEDGE.text){
          if(parentNode.getChildren().length<2){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{title:PrompterNew.Nodes.JUSTIFICATORY_KNOWLEDGE.completed,style:PrompterNew.Styles.prompt_completed},cl);
            var grandParentNodeContent = parentNode.getParentNode().getContent();
            DScaffolding.removeTaskNode("What is the justificatory knowledge for '"+grandParentNodeContent+"'?",cl);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);*/
      NodesNew.templateNodes.LESSEN_CAUSES.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        if(removedNodes.length==0) return;
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS!=null){
          for(var i=0;i<removedNodes.length;i++){
            if(removedNodes[i]==Prompter.Nodes.SUPPORTING_EVIDENCES.text||removedNodes[i]==Prompter.Nodes.WHO_ELSE_ADDRESSES_IT.text) continue;
            var ch = NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS.getChildren().filter((el) => {return el.getContent()==removedNodes[i]});
            for(var j=0;j<ch.length;j++){
              Mindmeister.removeIdea(Scrap.mapID,ch[j].id,cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },false,[NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.id]);
      NodesNew.templateNodes.LESSEN_CAUSES.onEdited(function(node,oldValue){
        if(node==null||node.getContent()==oldValue) return;
        var icons = node.getIcons();
        if(icons==null||icons.indexOf(Icons.enabled)==-1) return;
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        if(NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS!=null) {
          var mirrorNodes = NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS.getChildrenWithText(oldValue);
          for (var i = 0; i < mirrorNodes.length; i++) {
            mirrorNodes[i].setNodeContent(node.getContent());
            Mindmeister.modifyIdea(Scrap.mapID, mirrorNodes[i].id, {title: node.getContent()}, cl);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },true)
    }

    // PROBLEM AS SOLUTIONS
    if(NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS!=null){
      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList();
      var whoElseAddressesNodes = NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.getChildrenWithText(PrompterNew.Nodes.WHO_ELSE_ADDRESSES_IT.text);
      for(var i=0;i<whoElseAddressesNodes.length;i++){
        var relatedWorkNodes = whoElseAddressesNodes[i].getChildren();
        for(var j=0;j<relatedWorkNodes.length;j++){
          if(relatedWorkNodes[j].getChildrenWithText(PrompterNew.Nodes.WHAT_ARE_ITS_LIMITATIONS.text).length==0){
            Mindmeister.insertIdea(Scrap.mapID,relatedWorkNodes[j].id,{title:PrompterNew.Nodes.WHAT_ARE_ITS_LIMITATIONS.text,style:PrompterNew.Styles.prompt},cL);
          }
        }
      }
      Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
        if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
        else Scrap.hideWorkingMessage();
      })
      NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.onChildrenAdded(function(addedNodes){
        if(addedNodes==null||addedNodes.length==0) return;
        var addedNode = addedNodes[0];
        if(addedNode==null||addedNode.getContent()=="") return;
        var parentNode = addedNode.getParentNode();
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        if(parentNode.getContent()==PrompterNew.Nodes.WHAT_ARE_ITS_LIMITATIONS.text){
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
        }
        else if(parentNode.getContent()==PrompterNew.Nodes.WHO_ELSE_ADDRESSES_IT.text){
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.WHAT_ARE_ITS_LIMITATIONS.text,style:PrompterNew.Styles.prompt},cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },true);
      NodesNew.templateNodes.PROBLEM_AS_SOLUTIONS.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        if(removedNodes.length==0) return;
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent==PrompterNew.Nodes.WHAT_ARE_ITS_LIMITATIONS.text){
          if(parentNode.getChildren().length==0){
            Scrap.showWorkingMessage();
            var cL = new Mindmeister.ChangeList();
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt},cL);
            Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
              if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
              else Scrap.hideWorkingMessage();
            })
          }
        }
      });
    }

    /*this.onTemplateNodeRemoved(null,function(tasksToRemove,nodesToDecolor){
      if(tasksToRemove!=null&&tasksToRemove.length>0){
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        for(var i=0;i<tasksToRemove.length;i++){
          DScaffolding.removeTaskNode(tasksToRemove[i],cL);
        }
        var style = null;
        for(var i=0;i<nodesToDecolor.length;i++){
          if(document.getElementById(nodesToDecolor[i])!=null) Mindmeister.decolorIdea(Scrap.mapID,nodesToDecolor[i],cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      }
    },true)*/

    var rootNode = Scrap.getRootNode();
    rootNode.onEdited(function(node,oldValue){
      var newTitle = node.getContent().trim();
      if(newTitle==Utils.escapeHtml("Explicate Problem for <Mendeley folder name>")||newTitle==Utils.escapeHtml("<Mendeley folder name>")) return;
      if(oldValue==null) return;
      if(newTitle==oldValue) return;

      if(newTitle.indexOf("Explicate Problem for ")==-1){
        Scrap.showConfirmationMessage("The root node must follow the pattern 'Explicate Problem for PROJECT_NAME' in order for DScaffolding to work",function(){
          return;
        },function(){
          var cL = new Mindmeister.ChangeList();
          Mindmeister.modifyIdea(Scrap.mapID,Scrap.getRootNode().id,{title:oldValue},cL);
          Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
            return;
          })
        },"Proceed anyway","Undo");
      }
      else if(newTitle.replace("Explicate Problem for","").trim().length>25||newTitle.replace("Explicate Problem for","").trim().length<4) {
        Scrap.showConfirmationMessage("The project name must have between 4 and 25 characters",function(){
          return;
        },function(){
          var cL = new Mindmeister.ChangeList();
          Mindmeister.modifyIdea(Scrap.mapID,Scrap.getRootNode().id,{title:oldValue},cL);
          Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
            return;
          })
        },"Proceed anyway","Undo");
      }
      else Hypothesis.getGroupId(oldValue.replace("Explicate Problem for","").trim()).then(function(groupId){
          if(groupId==null){
            Hypothesis.createGroup(newTitle.replace("Explicate Problem for","").trim()).then(function(newGroupId){
              // TO DO - INSERT CURRENT PURPOSES IN HYPOTHESIS
              var purposeList = PurposeManager.getPurposes();
              for(var j=0;j<purposeList.length;j++){
                Hypothesis.insertAnnotationGroupTagColor(newTitle.replace("Explicate Problem for",""),"Purpose:"+purposeList[j].label.trim(),Utils.hexToCssRgba(purposeList[j].color,0.9));
              }
            })
          }
          else{
            Hypothesis.updateGroupIdName(groupId,newTitle.replace("Explicate Problem for","").trim());
          }
        })
      /*var labelMap = DSCAFFOLDING_LABELS.map(getAttribute,"mapId");
      var lag = labelMap.indexOf(Scrap.mapID);
      if(lag!=-1){
        DSCAFFOLDING_LABELS[lag]["mapName"] = newTitle;
        chrome.storage.sync.set({
          "DSCAFFOLDING_LABELS": DSCAFFOLDING_LABELS
        }, function(){
          chrome.runtime.sendMessage({mes: "reloadDScaffoldingLabels"});
        })
      }*/
    },false);
    Scrap.onNodeEdited(null,function(node,oldValue){
      var newContent = node.getContent();

      var regExp = /\.\.\.$/g;
      for(var key in PrompterNew.Nodes){
        if(PrompterNew.Nodes[key].text!=null&&regExp.test(PrompterNew.Nodes[key].text)&&PrompterNew.Nodes[key].text==newContent) return;
        if(PrompterNew.Nodes[key].completed!=null&&regExp.test(PrompterNew.Nodes[key].completed)&&PrompterNew.Nodes[key].completed==newContent) return;
      }

      var purpose = PurposeManager.getPurpose(null,node.id);

      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList();

      var purposeInsertionPointLabels = [PrompterNew.Nodes.SUPPORTING_EVIDENCES.text,PrompterNew.Nodes.WHO_ELSE_ADDRESSES_IT.text,PrompterNew.Nodes.JUSTIFICATORY_KNOWLEDGE.text];
      var regExp = /\.\.\.$/;

      if(purpose!=null){
        if(purpose.insertionPoint == node.id){
          if(regExp.test(oldValue)&&regExp.test(newContent)){
            PurposeManager.updatePurpose(node.id,newContent.replace(regExp,"").trim());
          }
          else{
            Mindmeister.decolorIdea(Scrap.mapID, node.id, cL);
            PurposeManager.removePurpose(node.id,purpose.color);
          }
        }
        else {
          PurposeManager.updatePurpose(node.id,newContent);
        }
      }
      else if(purposeInsertionPointLabels.indexOf(oldValue)!=-1&&purposeInsertionPointLabels.indexOf(newContent)==-1){
        Mindmeister.decolorIdea(Scrap.mapID, node.getParentNode().id, cL);
        PurposeManager.removePurpose(node.getParentNode().id);
      }
      else if(purposeInsertionPointLabels.indexOf(oldValue)==-1&&purposeInsertionPointLabels.indexOf(newContent)!=-1&&PurposeManager.getPurpose(null,node.getParentNode().id,null)==null){
        var freeColor = PurposeManager.getAvailableColor();
        if(freeColor!=null){
          Mindmeister.modifyIdea(Scrap.mapID,node.id,{style:PrompterNew.Styles.prompt},cL);
          var templateStyle = JSON.parse(JSON.stringify(NODE_STYLES.template));
          templateStyle.backgroundColor = freeColor;
          PurposeManager.insertPurpose(node.getParentNode().id,freeColor,node.getParentNode().getContent(),node.id);
          Mindmeister.modifyIdea(Scrap.mapID,node.getParentNode().id,{style:templateStyle},cL);
        }
        else{
          Scrap.hideWorkingMessage();
          Scrap.showMessage("There are no more colors available.");
        }
      }
      else if(!regExp.test(oldValue)&&regExp.test(newContent)&&PurposeManager.getPurpose(null,node.id,null)==null){
        var freeColor = PurposeManager.getAvailableColor();
        if(freeColor!=null){
          var templateStyle = JSON.parse(JSON.stringify(NODE_STYLES.template));
          templateStyle.backgroundColor = freeColor;
          PurposeManager.insertPurpose(node.id,freeColor,newContent.replace(regExp,"").trim(),node.id);
          Mindmeister.modifyIdea(Scrap.mapID,node.id,{style:templateStyle},cL);
        }
        else{
          Scrap.hideWorkingMessage();
          Scrap.showMessage("There are no more colors available.");
        }
      }
      Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
        if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
        else Scrap.hideWorkingMessage();
      })
    },true);

    // EXPLICATE PROBLEM ROOT
    Scrap.onNodeMoved(null,function(movedNodes,parentNode){
      if(!parentNode.isDescendant(DScaffolding.NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES)&&!parentNode.isDescendant(DScaffolding.NodesNew.templateNodes.ASCERTAIN_CAUSES)&&parentNode.id!=DScaffolding.NodesNew.templateNodes.ASCERTAIN_CAUSES.id&&parentNode.id!=DScaffolding.NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES.id) return;
      for(var i=0;i<movedNodes.length;i++){
        if(movedNodes[i].newParentId == DScaffolding.NodesNew.templateNodes.SET_PROBLEM_STATEMENT.id){
          var deniedNodeContentList = [PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed,PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text,PrompterNew.Nodes.WHY.completed,PrompterNew.Nodes.WHY.text,PrompterNew.Nodes.SUPPORTING_EVIDENCES.text];
          if(deniedNodeContentList.indexOf(movedNodes[i].node.getContent())==-1){
            DScaffolding.setAsProblemStatementDragExplicateProblemNew(movedNodes[i].node,parentNode);
            break;
          }
        }
      }
    })

    if(NodesNew.templateNodes.ASCERTAIN_CAUSES!=null){
      NodesNew.templateNodes.ASCERTAIN_CAUSES.addContextMenuEntry("Set as problem statement",DScaffolding.setAsProblemStatementNew,false,[PrompterNew.Nodes.WHY.text,PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text,PrompterNew.Nodes.WHY.completed,PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed],["Supporting Evidences?","Who else addresses it?"]);
    }
    if(NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES!=null){
      NodesNew.templateNodes.ASCERTAIN_CONSEQUENCES.addContextMenuEntry("Set as problem statement",DScaffolding.setAsProblemStatementNew,false,[PrompterNew.Nodes.WHY.text,PrompterNew.Nodes.WHAT_FOLLOWS_FROM.text,PrompterNew.Nodes.WHY.completed,PrompterNew.Nodes.WHAT_FOLLOWS_FROM.completed],["Supporting Evidences?","Who else addresses it?"]);
    }

    // FUNCTIONAL REQUIREMENTS
    if(NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS!=null){
      NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS.onChildrenAdded(function(addedNodes){
        if(addedNodes==null||addedNodes.length==0) return;
        var newNodes = addedNodes;
        var addedNode = addedNodes[0];
        if(addedNode==null||addedNode.getContent()=="") return;
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(parentNodeContent==NodesNew.templateNodesText.FUNCTIONAL_REQUIREMENTS){
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.GOAL_REFINEMENT.text,style:PrompterNew.Styles.prompt},cL,true);
        }
        else if(parentNodeContent==PrompterNew.Nodes.GOAL_REFINEMENT.text){
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.KERNEL_THEORY.text,style:PrompterNew.Styles.prompt},cL);
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.GOAL_REFINEMENT.text,style:PrompterNew.Styles.prompt},cL,true);
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
        }
        else if(parentNodeContent==PrompterNew.Nodes.KERNEL_THEORY.text){
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
        }
        Mindmeister.doChanges(Scrap.mapID, cL).then(function (changes) {
          if (changes != null && changes.changeList != null && changes.changeList.length > 0) Scrap.reloadCanvas(true, changes.changeList, changes.revision, changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS.onEdited(function(node,oldValue){
        if(node==null||node.getContent()==oldValue) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        var mirrorNodes = NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_THAT_SATISFIES.getChildrenWithText(oldValue);
        for(var i=0;i<mirrorNodes.length;i++){
          Mindmeister.modifyIdea(Scrap.mapID,mirrorNodes[i].id,{title:node.getContent()},cL);
        }
        let aux = Scrap.getNodesWithSubText("Design Purposeful Artefact");
        if(aux.length>0){
          let artReqs = aux[0].getDescendants().filter((el) => {return el.getContent()=="Requirements"});
          for(let i=0;i<artReqs.length;i++){
            let f = artReqs[i].getChildren().find((el) => {return el.getContent() == oldValue});
            if(f!=null) Mindmeister.modifyIdea(Scrap.mapID,f.id,{title: node.getContent()},cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },true)
      NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        if(removedNodes.length==0) return;
        var parentNodeContent = parentNode.getContent();

        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();

        if(parentNodeContent===PrompterNew.Nodes.KERNEL_THEORY.text){
          var ch = parentNode.getChildren();
          if(ch.length==0){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt},cL);
          }
        }
        else if(parentNodeContent===PrompterNew.Nodes.GOAL_REFINEMENT.text){
          var ch = parentNode.getChildren();
          if(ch.length==0){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt},cL);
          }
        }
        else if(removedNodes.length>0&&removedNodes[0]==PrompterNew.Nodes.GOAL_REFINEMENT.text){
          let aux = Scrap.getNodesWithSubText("Design Purposeful Artefact");
          if(aux.length>0){
            let requirementsNode = aux[0].getChildren().find((el) => {return el.getContent() == "Requirements"});
            if(requirementsNode!=null){
              Mindmeister.insertIdea(Scrap.mapID,requirementsNode.id,{title:parentNodeContent,style:NODE_STYLES.template,link:"topic:"+parentNode.id},cL);
            }
          }
          if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_THAT_SATISFIES!=null){
            var funcAux = NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_THAT_SATISFIES.getChildrenWithText(parentNodeContent);
            if (funcAux.length == 0) Mindmeister.insertIdea(Scrap.mapID, NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_THAT_SATISFIES.id,{title:parentNodeContent,style:NODE_STYLES.template,link:"topic:"+parentNode.id},cL);
          }
        }
        if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_THAT_SATISFIES!=null) {
          for(var i=0;i<removedNodes.length;i++){
            var ch = NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_THAT_SATISFIES.getChildrenWithText(removedNodes[i]);
            for(var j=0;j<ch.length;j++){
              Mindmeister.removeIdea(Scrap.mapID,ch[j].id,cL);
            }
          }
        }
        let aux = Scrap.getNodesWithSubText("Design Purposeful Artefact");
        if(aux.length>0){
          let artReqs = aux[0].getDescendants().filter((el) => {return el.getContent()=="Requirements"});
          for(let i=0;i<artReqs.length;i++){
            for(let j=0;j<removedNodes.length;j++){
              let f = artReqs[i].getChildren().find((el) => {return el.getContent() == removedNodes[j]});
              if(f!=null) Mindmeister.removeIdea(Scrap.mapID,f.id,cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
            else Scrap.hideWorkingMessage();
          })
      },false,[NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS.id]);
    }

    // NON-FUNCTIONAL REQUIREMENTS
    if(NodesNew.templateNodes.NON_FUNCTIONAL_REQUIREMENTS!=null){
      NodesNew.templateNodes.NON_FUNCTIONAL_REQUIREMENTS.onIconEdited(function(node,icon){
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        var promiseList = [];
        var nodeContent = node.getContent();
        if(icon==Icons.enabled){
          var whyPrompt = node.getChildrenWithText(PrompterNew.Nodes.WHY_IS_IT_IMPORTANT.text);
          if(whyPrompt==null||whyPrompt.length==0) Mindmeister.insertIdea(Scrap.mapID,node.id,{title:PrompterNew.Nodes.WHY_IS_IT_IMPORTANT.text,style:NODE_STYLES.prompt},cl,true);
          if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_THAT_SATISFIES!=null){
            Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_THAT_SATISFIES.id,{title:nodeContent,style:NODE_STYLES.template,link:"topic:"+node.id},cl);
          }
          let aux = Scrap.getNodesWithSubText("Design Purposeful Artefact");
          if(aux!=null&&aux.length>0){
            let artefactRequirements = aux[0].getChildren().find((el) => {return el.getContent()=="Requirements"});
            if(artefactRequirements!=null){
              Mindmeister.insertIdea(Scrap.mapID,artefactRequirements.id,{title:nodeContent,style:NODE_STYLES.template,link:"topic:"+node.id},cl);
            }
          }
        }
        else if(icon==Icons.disabled){
          var whyPrompt = node.getChildrenWithText(PrompterNew.Nodes.WHY_IS_IT_IMPORTANT.text);
          if(whyPrompt!=null&&whyPrompt.length>0){
            var wpch = whyPrompt[0].getChildren();
            if(wpch==null||wpch.length==0) Mindmeister.removeIdea(Scrap.mapID,whyPrompt[0].id,cl);
          }
          if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_THAT_SATISFIES!=null){
            var ch = NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_THAT_SATISFIES.getChildrenWithText(nodeContent);
            for(var i=0;i<ch.length;i++){
              Mindmeister.removeIdea(Scrap.mapID,ch[i].id,cl);
            }
          }
          let aux = Scrap.getNodesWithSubText("Design Purposeful Artefact");
          if(aux!=null&&aux.length>0){
            let artefactRequirements = aux[0].getChildren().find((el) => {return el.getContent()=="Requirements"});
            if(artefactRequirements!=null){
              var ch = artefactRequirements.getChildrenWithText(nodeContent);
              for(var i=0;i<ch.length;i++){
                Mindmeister.removeIdea(Scrap.mapID,ch[i].id,cl);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      })
      NodesNew.templateNodes.NON_FUNCTIONAL_REQUIREMENTS.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        if(removedNodes.length==0) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(parentNode.getContent()==PrompterNew.Nodes.WHY_IS_IT_IMPORTANT.text){
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:NODE_STYLES.prompt},cL);
        }
        if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_THAT_SATISFIES!=null){
          for(var i=0;i<removedNodes.length;i++){
            var ch = NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_THAT_SATISFIES.getChildrenWithText(removedNodes[i]);
            for(var j=0;j<ch.length;j++){
              Mindmeister.removeIdea(Scrap.mapID,ch[j].id,cL);
            }
          }
        }
        let aux = Scrap.getNodesWithSubText("Design Purposeful Artefact");
        if(aux!=null&&aux.length>0){
          let artefactRequirements = aux[0].getChildren().find((el) => {return el.getContent()=="Requirements"});
          if(artefactRequirements!=null){
            for(var i=0;i<removedNodes.length;i++){
              var ch = artefactRequirements.getChildrenWithText(removedNodes[i]);
              for(var j=0;j<ch.length;j++){
                Mindmeister.removeIdea(Scrap.mapID,ch[j].id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },false,[NodesNew.templateNodes.NON_FUNCTIONAL_REQUIREMENTS.id]);
      NodesNew.templateNodes.NON_FUNCTIONAL_REQUIREMENTS.onChildrenAdded(function(addedNodes){
        if(addedNodes==null||addedNodes.length==0) return;
        var newNodes = addedNodes;

        var addedNode = addedNodes[0];//$(addedNodes[0]).find(".node")[0];
        if(addedNode==null||addedNode.getContent()=="") return;
        var parentNode = addedNode.getParentNode();
        if(parentNode==null) return;
        if(parentNode.getContent()==PrompterNew.Nodes.WHY_IS_IT_IMPORTANT.text){
          var cL = new Mindmeister.ChangeList();
          Scrap.showWorkingMessage();
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:NODE_STYLES.prompt_completed},cL);
          Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
            else Scrap.hideWorkingMessage();
          })
        }
      },true);
      // TODO - propagate repharsing of non functional requirements
    }

    let artefactNode = Scrap.getNodesWithSubText("Design Purposeful Artefact");
    if(artefactNode!=null&&artefactNode.length>0){
      artefactNode[0].onChildrenAdded(function(addedNodes){
        if(addedNodes==null||addedNodes.length==0) return;
        var newNodes = addedNodes;

        var addedNode = addedNodes[0];//$(addedNodes[0]).find(".node")[0];
        if(addedNode==null||addedNode.getContent()=="") return;
        var parentNode = addedNode.getParentNode();
        if(parentNode==null) return;
        var grandParentNode = parentNode.getParentNode();
        var grandParentNodeContent = grandParentNode.getContent();
        var cL = new Mindmeister.ChangeList();
        Scrap.showWorkingMessage();
        if(parentNode.getContent()=="Description") {
          let grandParentNode = parentNode.getParentNode();
          if(grandParentNode.getContent().indexOf("Design Purposeful Artefact")!=-1){
            if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_BY!=null){
              Mindmeister.insertIdea(Scrap.mapID,NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_BY.id,{title:"designing a "+addedNode.getContent(),style:NODE_STYLES.template},cL);
            }
          }
          else{
            let ggP = grandParentNode.getParentNode();
            if(ggP.getContent()=="Components"){
              let ch = parentNode.getChildren();
              if(ch.length==1){
                Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
              }
            }
          }
        }
        else if(parentNode.getContent()=="Components"){
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.COMPONENT_DESCRIPTION.text,style:PrompterNew.Styles.prompt},cL);
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.COMPONENT_REQUIREMENTS.text,style:PrompterNew.Styles.prompt},cL);
        }
        else if(parentNode.getContent()==PrompterNew.Nodes.COMPONENT_REQUIREMENTS.text&&grandParentNodeContent.indexOf("Design Purposeful Artefact")==-1){
          let ch = parentNode.getChildren();
          if(ch.length==1){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
          }
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.REQUIREMENT_REALIZATION.text,style:PrompterNew.Styles.prompt},cL,true);
        }
        else if(parentNode.getContent()==PrompterNew.Nodes.REQUIREMENT_REALIZATION.text) {
          let ch = parentNode.getChildren();
          if(ch.length==1){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
          }
          Mindmeister.insertIdea(Scrap.mapID,addedNode.id,{title:PrompterNew.Nodes.KERNEL_THEORY.text,style:PrompterNew.Styles.prompt},cL,true);
        }
        else if(parentNode.getContent()==PrompterNew.Nodes.KERNEL_THEORY.text) {
          let ch = parentNode.getChildren();
          if(ch.length==1){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt_completed},cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
        if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
        else Scrap.hideWorkingMessage();
      })
    },true);
      artefactNode[0].onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        if(removedNodes.length==0) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();

        let parentNodeContent = parentNode.getContent();
        let grandParent = parentNode.getParentNode();
        let grandParentContent = grandParent.getContent();
        if(parentNodeContent=="Description"){
          if(grandParentContent.indexOf("Design Purposeful Artefact")!=-1){
            if(Nodes.templateNodes.DESIGN_PROBLEM_TEMPLATE_BY!=null){
              let ch = Nodes.templateNodes.DESIGN_PROBLEM_TEMPLATE_BY.getChildren().find((el) => {return el.getContent().indexOf(removedNodes[0])!=-1});
              if(ch!=null) Mindmeister.removeIdea(Scrap.mapID,ch.id,cL);
            }
          }
          else{
            let ch = parentNode.getChildren();
            if(ch.length==0){
              Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt},cL);
            }
          }
        }
        else if(parentNodeContent==PrompterNew.Nodes.COMPONENT_REQUIREMENTS.text&&grandParentContent.indexOf("Design Purposeful Artefact")==-1){
          let ch = parentNode.getChildren();
          if(ch.length==0){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt},cL);
          }
        }
        else if(parentNodeContent==PrompterNew.Nodes.REQUIREMENT_REALIZATION.text){
          let ch = parentNode.getChildren();
          if(ch.length==0){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt},cL);
          }
        }
        else if(parentNodeContent==PrompterNew.Nodes.KERNEL_THEORY.text){
          let ch = parentNode.getChildren();
          if(ch.length==0){
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:PrompterNew.Styles.prompt},cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },false,[artefactNode[0].id]);
      artefactNode[0].onEdited(function(node,oldValue){
        if(node==null||node.getContent()==oldValue) return;
        var icons = node.getIcons();
        let parentNode = node.getParentNode();
        let parentNodeContent = parentNode.getContent();
        if(parentNodeContent!="Description") return;
        let grandParent = parentNode.getParentNode();
        let grandParentContent = grandParent.getContent();
        if(grandParentContent.indexOf("Design Purposeful Artefact")==-1) return;
        Scrap.showWorkingMessage();
        var cl = new Mindmeister.ChangeList();
        if(NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_BY!=null) {
          var mirrorNodes = NodesNew.templateNodes.DESIGN_PROBLEM_TEMPLATE_BY.getChildrenWithSubText(oldValue);
          for (var i = 0; i < mirrorNodes.length; i++) {
            Mindmeister.modifyIdea(Scrap.mapID, mirrorNodes[i].id, {title: mirrorNodes[i].replace(oldValue,node.getContent())}, cl);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cl).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
          else Scrap.hideWorkingMessage();
        })
      },true)
    }

    $(".tk_icon_container[icon-id='"+Icons.reload_wheel+"']").on("click",function(e){
      e.preventDefault();
      e.stopPropagation();
      var node, oldIcon;
      if(e.target.tagName == "IMG"){
        node = e.target.parentNode.parentNode;
        oldIcon = e.target.parentNode.getAttribute("icon-id");
      }
      else if(e.target.tagName == "DIV"){
        node = e.target.parentNode;
        oldIcon = e.target.getAttribute("icon-id");
      }
      if(node==null) return;
      var n = new Scrap.Node(node);
      var nodeContent = n.getContent();
      if(nodeContent=='Requirements'){
        let reqs = [];
        var attainmentPrompts = NodesNew.templateNodes.FUNCTIONAL_REQUIREMENTS.getDescendants().filter((el) => {return el.getContent() == PrompterNew.Nodes.GOAL_REFINEMENT.text});
        for(let i=0;i<attainmentPrompts.length;i++){
          let ch = attainmentPrompts[i].getChildren();
          for(let j=0;j<ch.length;j++){
            if(ch[j].getChildren().find((el) => {return el.getContent()== PrompterNew.Nodes.GOAL_REFINEMENT.text})==null&&n.getChildren().find((el) => {return el.getContent()==ch[j].getContent()})==null){
              reqs.push(ch[j]);
            }
          }
        }
        var enabledNFR = NodesNew.templateNodes.NON_FUNCTIONAL_REQUIREMENTS.getDescendants().filter((el) => {return el.getIcons().indexOf(Icons.enabled)!=-1&&n.getChildren().find((elem) => {return elem.getContent()==el.getContent()})==null});
        for(let j=0;j<enabledNFR.length;j++){
          reqs.push(enabledNFR[j]);
        }
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        for(let i=0;i<reqs.length;i++){
          Mindmeister.insertIdea(Scrap.mapID,n.id,{title:reqs[i].getContent(),style:NODE_STYLES.template,link:"topic:"+reqs[i].id},cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      }
    });

    // NEW ENTRIES IN THE CONTEXT MENU
    //if(GOOGLE_FORMS_ENABLED) Nodes.templateNodes.PROBLEM_AS_DIFFICULTIES.addContextMenuEntry("Create Poll for Paired Comparison",DScaffolding.createPairedComparisonPoll,true,[Prompter.Nodes.WHY.text,Prompter.Nodes.WHAT_FOLLOWS_FROM.text,Prompter.Nodes.WHY.completed,Prompter.Nodes.WHAT_FOLLOWS_FROM.completed],["Supporting Evidences?","Who else addresses it?"]);

    // ALL MAP
    Scrap.onChildrenAdded(null,function(addedNodes){
      var addedNode = addedNodes[0];
      if(addedNode == null || addedNode.id == null) return;
      var parentNode = addedNode.getParentNode();
      var parentNodeContent = parentNode.getContent();
      var addedNodeContent = addedNode.getContent();
      var regExp = /\.\.\.$/g;
      for(var key in PrompterNew.Nodes){
        if(PrompterNew.Nodes[key].text!=null&&regExp.test(PrompterNew.Nodes[key].text)&&PrompterNew.Nodes[key].text==addedNodeContent) return;
        if(PrompterNew.Nodes[key].completed!=null&&regExp.test(PrompterNew.Nodes[key].completed)&&PrompterNew.Nodes[key].completed==addedNodeContent) return;
      }

      var refPromptNodes = [PrompterNew.Nodes.JUSTIFICATORY_KNOWLEDGE.text,PrompterNew.Nodes.SUPPORTING_EVIDENCES.text,PrompterNew.Nodes.WHO_ELSE_ADDRESSES_IT.text];
      if(addedNodeContent==null)return;
      if(addedNodeContent=="Supporting Evidences?"||addedNodeContent=="Who else addresses it?"||addedNodeContent=="Justificatory Knowledge"||new RegExp(/\.\.\.$/g).test(addedNodeContent)){
        //Mindmeister.modifyIdea(Scrap.mapID,addedNode.id,{note:"What proof do I have that this cause exists? (Is it concrete? Is it measurable?)\n\nWhat proof do I have that this cause could lead to the stated effect? (Am I merely asserting causation?)\n\nWhat proof do I have that this cause actually contributed to the problem I'm looking at? (Even given that it exists and could lead to this problem, how do I know it wasn't actually something else?)\n\nIs anything else needed, along with this cause, for the stated effect to occur? (Is it self-sufficient? Is something needed to help it along?)\n\nCan anything else, besides this cause, lead to the stated effect? (Are there alternative explanations that fit better? What other risks are there?)"},cL);
        var rootNode = Scrap.getRootNode();
        var rootNodeContent = rootNode.getContent().replace("Explicate Problem for","").trim();
        var freeColor = PurposeManager.getAvailableColor();
        if(freeColor!=null){
          Scrap.showWorkingMessage();
          var cL = new Mindmeister.ChangeList();
          var templateStyle = JSON.parse(JSON.stringify(NODE_STYLES.template));
          templateStyle.backgroundColor = freeColor;
          if((addedNodeContent=="Supporting Evidences?"||addedNodeContent=="Who else addresses it?"||addedNodeContent=="Justificatory Knowledge")){
            if (PurposeManager.getPurpose(null,parentNode.id,null)==null){
              Mindmeister.modifyIdea(Scrap.mapID,addedNode.id,{style:PrompterNew.Styles.prompt},cL);
              PurposeManager.insertPurpose(parentNode.id,freeColor,parentNodeContent,addedNode.id);
              Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:templateStyle},cL);
            }
          }
          else {
            if (PurposeManager.getPurpose(null,addedNode.id,null)==null){
              PurposeManager.insertPurpose(addedNode.id,freeColor,addedNodeContent.replace(/\.\.\.$/g,""),addedNode.id);
              Mindmeister.modifyIdea(Scrap.mapID,addedNode.id,{style:templateStyle},cL);
            }
          }
          if (cL.getChanges().length > 0) {
            Mindmeister.doChanges(Scrap.mapID, cL).then(function (changes) {
              if (changes != null && changes.changeList != null && changes.changeList.length > 0) Scrap.reloadCanvas(true, changes.changeList, changes.revision, changes.focusNodeId);
              else Scrap.hideWorkingMessage();
            })
          }
          else Scrap.hideWorkingMessage();
        }
        else{
          Scrap.showMessage("There are no more colors available.");
        }
        //})
      }
      if(refPromptNodes.indexOf(parentNodeContent)!=-1){
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      }
    },true);
    Scrap.onNodeRemoved(null, function(removedNodes,parentNode){
      if (parentNode == null) return;
      if (removedNodes.length == 0) return;


      var refPromptNodes = [PrompterNew.Nodes.JUSTIFICATORY_KNOWLEDGE.text, PrompterNew.Nodes.SUPPORTING_EVIDENCES.text, PrompterNew.Nodes.WHO_ELSE_ADDRESSES_IT.text];

      var parentNodeContent = parentNode.getContent();
      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList();
      if (/*removedNodes.length==1&&*/(removedNodes[0] == "Supporting Evidences?" || removedNodes[0] == "Who else addresses it?" || removedNodes[0] == "Justificatory Knowledge")) {
        Mindmeister.decolorIdea(Scrap.mapID, parentNode.id, cL);
        PurposeManager.removePurpose(parentNode.id);
      }
      else if (removedNodes.indexOf("Supporting Evidences?") != -1 || removedNodes.indexOf("Who else addresses it?") != -1 || removedNodes.indexOf("Justificatory Knowledge") != -1) {
        if (removedNodes.indexOf("Justificatory Knowledge") != -1) {
        }
        else {
          var h = removedNodes.indexOf("Supporting Evidences?") != -1 ? removedNodes.indexOf("Supporting Evidences?") : removedNodes.indexOf("Who else addresses it?");
        }
        for (var j = 0; j < removedNodes.length; j++) {
          var purpose = PurposeManager.getPurpose(null, null, removedNodes[j]);
          if (purpose != null) PurposeManager.removePurpose(purpose.nodeId, purpose.color);
        }
      }
      else if (refPromptNodes.indexOf(parentNodeContent) != -1) {
      }
      else if(new RegExp(/\.\.\.$/g).test(parentNodeContent)){
        var purpose = PurposeManager.getPurpose(null,null,parentNodeContent.replace(/\.\.\.$/g,""));
        if(purpose!=null){
        }
      }
      else{
        var regExp = new RegExp(/\.\.\.$/g);
        for(var j=0;j<removedNodes.length;j++){
          if(regExp.test(removedNodes[j])){
            var purpose = PurposeManager.getPurpose(null, null, removedNodes[j].replace(/\.\.\.$/g,""));
            if(purpose!=null){
              PurposeManager.removePurpose(purpose.nodeId,purpose.color);
            }
          }
        }
      }

      if(refPromptNodes.indexOf(parentNodeContent)!=-1&&parentNode.getChildren().length==0){
        Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt},cL);
      }
      Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
        if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
        else Scrap.hideWorkingMessage();
      })
    })

    Scrap.getRootNode().addContextMenuEntry("Export as latex",LatexGenerator.generateLatex,true);
    Scrap.getRootNode().addContextMenuEntry("Get todos from latex",LatexGenerator.backwardsTransformation,true);
  }
  var initTemplateRiskManagement = function(){
    Nodes.init();

    var riskTreatmentMapping = {
      "A-1" : [0,1,2],
      "A-2" : [0,1,2],
      "A-3" : [0,1,2,3,4],
      "A-4" : [0,1,2,3,4],
      "A-5" : [0,1,2,3,4],
      "A-6" : [0,1,2,3,5],
      "A-7" : [0,1,2,3,5],
      "A-8" : [0,1,2,3,5],
      "A-9" : [0,1,2,4,5,6,7],
      "B-1" : [0,2,8],
      "B-2" : [0,2,8,9,10],
      "B-3" : [0,2,8,11],
      "C-1" : [10,12,13,14],
      "C-2" : [13,14,15],
      "C-3" : [10,13,14,15],
      "C-4" : [9,13,14,15],
      "C-5" : [2,9,13,14,16],
      "C-6" : [2,9,13,14,15,17],
      "C-7" : [2,9,13,14,15,17,18,19],
      "D-1a" : [2,13,15,16],
      "D-1b" : [1,13,15,16],
      "D-2" : [20,21],
      "D-3" : [21,22],
      "D-4" : [21,22],
      "D-5" : [21,23],
      "D-6" : [24,25],
      "D-7" : [26,27,28],
      "D-8" : [29,30],
      "D-9" : [28,30,31],
      "D-10" : [28,30,31],
      "D-11" : [28,30,31],
      "D-12" : [26,27,30,31],
      "D-13" : [19,28],
      "D-14" : [19,28],
      "E-1" : [13,19,28,32,33],
      "E-2" : [32],
      "E-3" : [32],
      "E-4" : [32,34],
      "E-5" : [19,28,33],
      "F-1" : [19,28,33,35,36,37,38,39,40,41,42],
      "F-2" : [35,39,40,41],
      "F-3" : [19,33,37,43],
      "F-4" : [44,45],
      "F-5" : [19,28,33]
    }
    var riskTreatments = [
      {text: "Literature review about the problem, existing solutions, and technological capabilities that could be used for solution"},
      {text: "Empirical investigation of the problem (e.g. using survey, case study), cf. Pries-Heje et al. (2014), p. 15"},
      {text: "Seek co-authors or clients with expertise in and understanding of the problem area and its significance"},
      {text: "Stakeholder analysis"},
      {text: "Causal analysis (a.k.a. root cause analysis)"},
      {text: "CATWOE/Root definition"},
      {text: "Requirements choice review"},
      {text: "Link requirements to desired outcomes (causal analysis)"},
      {text: "Update literature review, open automatic query"},
      {text: "Seek co-authors or clients with expertise in extant purposeful artefact solutions to the problem"},
      {text: "Seek co-authors or clients with expertise in technologies to be applied in new purposeful artefact"},
      {text: "Seek co-authors with expertise in behavioural theory or other areas of potential kernel theory"},
      {text: "Review solution idea and design with technical experts"},
      {text: "Generate multiple candidate designs and contingency plans, cf. Pries-Heje et al. (2014), p. 14"},
      {text: "Evaluate early and formatively (Pries- Heje et al. 2014, p. 14)"},
      {text: "Review solution idea and design with potential users, cf. Pries-Heje et al. (2014), p. 15"},
      {text: "Review partial prototypes as early as possible with users, cf. Pries-Heje et al. (2014), p. 15"},
      {text: "Review solution idea and design with non-user stakeholders, especially with power and different interests"},
      {text: "Ask “Devil’s Advocate” question: “How and why could use of the artefact make a situation worse rather than better?”"},
      {text: "Triangulate evaluations using different forms, cf. Pries-Heje et al. (2014), p. 14"},
      {text: "Ask “Devil’s Advocate” question: “How and why might the artefact fail to match the requirements?”"},
      {text: "Design and document the design carefully using template/meta-design- driven design & documentation, cf. Pries-Heje et al. (2014), p. 15"},
      {text: "Design review"},
      {text: "Instantiation review"},
      {text: "Early (partial) prototype review"},
      {text: "Post-implementation review"},
      {text: "Ask naturalistic evaluation stakeholders about potential and forecast changes (when investigating the problem for naturalistic evaluation)"},
      {text: "Develop and deliver the working purposeful artefact for naturalistic evaluation quickly"},
      {text: "Seek co-authors with expertise in evaluation methods"},
      {text: "Plan a good change management practice for naturalistic evaluation"},
      {text: "Involve users early and often (a.k.a. user and stakeholder participation) for naturalistic evaluation, cf. Pries-Heje et al. (2014), p. 15"},
      {text: "Identify and resolve disagreements among stakeholders (during problem formulation and/or change management)"},
      {text: "Support and guide implementers (post research) to implement the purposeful artefact properly"},
      {text: "Rigorously evaluate for (unsafe) side effects, cf. Pries-Heje et al. (2014), p. 15"},
      {text: "Help implementers to conduct proper change management"},
      {text: "Throughout the DSR project, actively clarify and manage (plan, review/ monitor, and replan) the significance of the problem"},
      {text: "Throughout the DSR project, actively clarify and manage (plan, review/ monitor, and replan) the newness/ novelty of the artefact"},
      {text: "Throughout the DSR project, actively clarify and manage (plan, review/ monitor, and replan) the rigour of the evaluation"},
      {text: "Throughout the DSR project, actively clarify and manage (plan, review/ monitor, and replan) the relationship of the problem and the extant artefact to extant theory and the literature"},
      {text: "Seek co-authors to distribute the workload and the risk, cf. Pries-Heje et al. (2014), p. 15"},
      {text: "Change the scope of the research to something less risky, cf. Pries-Heje et al. (2014), p. 15"},
      {text: "Abandon the research if too risky, cf. Pries-Heje et al. (2014), p. 14"},
      {text: "Enter into contract/agreement clarifying IP rights and right to publish, cf. Pries-Heje et al. (2014), p. 18"},
      {text: "Ask “Devil’s Advocate” question: “How and why might this research produce incorrect results?”"},
      {text: "Ask “Devil’s Advocate” question (during design and design review): “How and why could the artefact be (or become) too unique to disseminate?”"},
      {text: "Ask experts whether the design is too unique to be used in other contexts (during design review)"}
    ]

    if(Nodes.templateNodes.IDENTIFY_RISKS!=null){
      Nodes.templateNodes.IDENTIFY_RISKS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          var rephraseRisk = node.getChildrenWithText(Prompter.Nodes.REPHRASE_RISK.text);
          if(rephraseRisk==null||rephraseRisk.length==0){
            var rephraseNodeId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:Prompter.Nodes.REPHRASE_RISK.text,style:Prompter.Styles.prompt},cL,true);
            var riskName = nodeContent.split(".")[0];
            DScaffolding.insertTaskNode("Rephrase '"+riskName+"' risk for your organization/domain/artefact",rephraseNodeId,cL);
          }
        }
        else if(icon==Icons.disabled){
          var rephraseRisk = node.getChildrenWithText(Prompter.Nodes.REPHRASE_RISK.text);
          if(rephraseRisk!=null&&rephraseRisk.length>0){
            var rephrasedNode = rephraseRisk[0].getChildren();
            if(rephrasedNode!=null&&rephrasedNode.length>0){
              var mirrorNodes1 = Nodes.templateNodes.ANALYSE_RISKS.getChildrenWithText(rephrasedNode[0].getContent());
              var mirrorNodes2 = Nodes.templateNodes.DETERMINE_RISK_TREATMENTS.getChildrenWithText(rephrasedNode[0].getContent());
              var mirrorNodes = [];
              if(mirrorNodes1==null) mirrorNodes = mirrorNodes2;
              else if(mirrorNodes2==null) mirrorNodes = mirrorNodes1;
              else mirrorNodes = mirrorNodes1.concat(mirrorNodes2);
              for(var i=0;i<mirrorNodes.length;i++){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[i].id,cL);
              }
            }
            Mindmeister.removeIdea(Scrap.mapID,rephraseRisk[0].id,cL);
            var riskName = nodeContent.split(".")[0];
            DScaffolding.removeTaskNode("Rephrase '"+riskName+"' risk for your organization/domain/artefact",cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.IDENTIFY_RISKS.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null) return;
        var nodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent!=Prompter.Nodes.REPHRASE_RISK.text) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
        var nodeId = DScaffolding.cloneNodeBis(addedNode,Nodes.templateNodes.ANALYSE_RISKS.id,cL);
        var significanceNodeId = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.text,style:Prompter.Styles.prompt},cL);
        DScaffolding.insertTaskNode("Determine Significance/Cost for '"+nodeContent+"'",significanceNodeId,cL);
        for(var i=0;i<Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.length;i++){
          Mindmeister.insertIdea(Scrap.mapID,significanceNodeId,{title:Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options[i],style:Prompter.Styles.prompt_completed,icon:Icons.disabled},cL);
        }
        var probNodeId = Mindmeister.insertIdea(Scrap.mapID,nodeId,{title:Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.text,style:Prompter.Styles.prompt},cL);
        DScaffolding.insertTaskNode("Determine Likelihood for '"+nodeContent+"'",probNodeId,cL);
        for(var i=0;i<Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.length;i++){
          Mindmeister.insertIdea(Scrap.mapID,probNodeId,{title:Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options[i],style:Prompter.Styles.prompt_completed,icon:Icons.disabled},cL);
        }

        var nodeId2 = DScaffolding.cloneNodeBis(addedNode,Nodes.templateNodes.DETERMINE_RISK_TREATMENTS.id,cL);
        Mindmeister.insertIdea(Scrap.mapID,nodeId2,{title:Prompter.Nodes.APPROPRIATE_RISK_TREATMENT_STRATEGY.text,style:Prompter.Styles.prompt},cL)
        Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed});

        var riskNode = parentNode.getParentNode();
        var riskText = riskNode.getContent();
        var riskIdentifier = riskText.match(/^[ABCDEF]\-\d+[ab]?(?=\.)/i);
        if(riskIdentifier!=null&&riskIdentifier.length>0){
          var treatments = riskTreatmentMapping[riskIdentifier[0]];
          if(treatments!=null){
            var suggestedTreatment = Mindmeister.insertIdea(Scrap.mapID,nodeId2,{title:Prompter.Nodes.SUGGESTED_RISK_TREATMENTS.text,style:Prompter.Styles.prompt_completed},cL);
            for(var j=0;j<treatments.length;j++){
              Mindmeister.insertIdea(Scrap.mapID,suggestedTreatment,{title:riskTreatments[treatments[j]].text,style:Prompter.Styles.prompt_completed},cL);
            }
          }
        }

        var grandParentNode = parentNode.getParentNode();
        var grandParentNodeContent = grandParentNode.getContent();
        var riskName = grandParentNodeContent.split(".")[0];
        DScaffolding.removeTaskNode("Rephrase '"+riskName+"' risk for your organization/domain/artefact",cL);

        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
    }
    // TODO -> REMOVE

    if(Nodes.templateNodes.ANALYSE_RISKS!=null){
      Nodes.templateNodes.ANALYSE_RISKS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.disabled){
          var risk = node.getParentNode().getParentNode();
          var probCont = risk.getChildrenWithText(Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.text)[0];
          // TO TREAT ERROR
          var prob = probCont.getChildrenWithIcon(Icons.enabled);
          var signCont = risk.getChildrenWithText(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.text)[0];
          // TO TREAT ERROR
          var sign = signCont.getChildrenWithIcon(Icons.enabled);
          if((Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1&&sign.length<=0)||(Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent)!=-1&&prob.length<=0)){
            var parentNode = node.getParentNode();
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt},cL);
            var grandParentNode = parentNode.getParentNode();
            var grandParentNodeContent = grandParentNode.getContent();
            var taskNodeText = Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1 ? "Determine Significance/Cost for " : "Determine Likelihood for ";
            taskNodeText += "'"+grandParentNodeContent+"'";
            DScaffolding.insertTaskNode(taskNodeText,parentNode.id,cL);
            var riskMirror = Nodes.templateNodes.DETERMINE_RISK_TREATMENTS.getChildrenWithText(grandParentNodeContent);
            if(riskMirror!=null&&riskMirror.length>0){
              var treatmentStrategyNode = riskMirror[0].getChildrenWithText(Prompter.Nodes.APPROPRIATE_RISK_TREATMENT_STRATEGY.text);
              if(treatmentStrategyNode!=null&&treatmentStrategyNode.length>0){
                Mindmeister.modifyIdea(Scrap.mapID,treatmentStrategyNode[0].id,{style:Prompter.Styles.prompt},cL);
                var treatmentNodes = treatmentStrategyNode[0].getChildren();
                if(treatmentNodes!=null&&treatmentNodes.length>0){
                  Mindmeister.removeIdea(Scrap.mapID,treatmentNodes[0].id,cL);
                }
              }
            }
          }
          var mirrorNodes = Nodes.templateNodes.PRIORITISE_RISKS.getChildrenWithText(risk.getContent());
          if(mirrorNodes!=null&&mirrorNodes.length>0){
            if(prob==null||sign==null||prob.length==0||sign.length==0){
              for(var i=0;i<mirrorNodes.length;i++){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[i].id,cL);
              }
            }
          }
        }
        else if(icon==Icons.enabled){
          if(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1||Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent)!=-1){
            var parentNode = node.getParentNode();
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
            var grandParentNode = parentNode.getParentNode();
            var grandParentNodeContent = grandParentNode.getContent();
            var taskNodeText = Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1 ? "Determine Significance/Cost for " : "Determine Likelihood for ";
            taskNodeText += "'"+grandParentNodeContent+"'";
            DScaffolding.removeTaskNode(taskNodeText,cL);
          }
          if(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1||Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent)!=-1){
            var risk = node.getParentNode().getParentNode();
            var probCont = risk.getChildrenWithText(Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.text)[0];
            // TO TREAT ERROR
            var prob = probCont.getChildrenWithIcon(Icons.enabled);
            var signCont = risk.getChildrenWithText(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.text)[0];
            // TO TREAT ERROR
            var sign = signCont.getChildrenWithIcon(Icons.enabled);

            //var probGrade = Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(prob[0].getContent());
            //var signGrade = Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(sign[0].getContent());
            var probGrade = prob!=null&&prob.length>0 ? Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(prob[0].getContent()) : -1;
            var signGrade = sign!=null&&sign.length>0 ? Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(sign[0].getContent()) : -1;

            if(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1) signGrade = Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent);
            if(Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent)!=-1) probGrade = Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent);

            if(probGrade>-1&&signGrade>-1){
              var riskTreatment;
              if(probGrade<=2&&signGrade<=2){
                riskTreatment = "Self-Insurance";
              }
              else if(probGrade<=2&&signGrade>2){
                riskTreatment = "Transfer";
              }
              else if(probGrade>2&&signGrade<=2){
                riskTreatment = "Self-Protect";
              }
              else if(probGrade>2&&signGrade>2){
                riskTreatment = "Avoidance";
              }
              var riskT = Nodes.templateNodes.DETERMINE_RISK_TREATMENTS.getChildrenWithText(risk.getContent())[0];
              var riskTCont = riskT.getChildrenWithText(Prompter.Nodes.APPROPRIATE_RISK_TREATMENT_STRATEGY.text);
              if(riskTCont!=null&&riskTCont.length>0) var riskTreatmentList = riskTCont[0].getChildren();
              if(riskTreatmentList!=null&&riskTreatmentList.length>0){
                //var promiseList = [];
                var found = false;
                for(var i=0;i<riskTreatmentList.length;i++){
                  if(riskTreatmentList[i].getContent()!=riskTreatment){
                    Mindmeister.removeIdea(Scrap.mapID,riskTreatmentList[i].id,cL);
                  }
                  else found = true;
                }
                if(!found){
                  Mindmeister.insertIdea(Scrap.mapID,riskTCont[0].id,{title:riskTreatment,style:NODE_STYLES.template},cL);
                  Mindmeister.modifyIdea(Scrap.mapID,riskTCont[0].id,{style:Prompter.Styles.prompt_completed},cL);
                }
              }
              else{
                Mindmeister.insertIdea(Scrap.mapID,riskTCont[0].id,{title:riskTreatment,style:NODE_STYLES.template},cL);
                Mindmeister.modifyIdea(Scrap.mapID,riskTCont[0].id,{style:Prompter.Styles.prompt_completed},cL);
              }
            }
          }
          if(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent)!=-1){
            var risk = node.getParentNode().getParentNode();
            var probCont = risk.getChildrenWithText(Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.text)[0];
            // TO TREAT ERROR
            var prob = probCont.getChildrenWithIcon(Icons.enabled);
            if(prob!=null&&prob.length>0){
              var sign = node.getParentNode().getChildrenWithIcon(Icons.enabled);
              if(sign.length>1){
                //var pL = [];
                for(var i=0;i<sign.length;i++){
                  if(sign[i].getContent()!=nodeContent){
                    var nodeToChange = node.getParentNode().getChildrenWithText(sign[i].getContent())[0];
                    Mindmeister.modifyIdea(Scrap.mapID,nodeToChange.id,{icon:Icons.disabled},cL);
                  }
                }
              }
              var probGrade = Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(prob[0].getContent());
              var signGrade = Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(nodeContent);
              var totalGrade = probGrade*signGrade;
              var destinationNode;
              if(totalGrade>=0&&totalGrade<4) destinationNode = Nodes.templateNodes.ANALYSED_RISK_LIST_LOW;
              else if(totalGrade>=4&&totalGrade<=12) destinationNode = Nodes.templateNodes.ANALYSED_RISK_LIST_MEDIUM;
              else if(totalGrade>12) destinationNode = Nodes.templateNodes.ANALYSED_RISK_LIST_HIGH;
              if(destinationNode!=null){
                var mirrorNodes = Nodes.templateNodes.PRIORITISE_RISKS.getChildrenWithText(risk.getContent());
                if(mirrorNodes!=null&&mirrorNodes.length>0){
                  for(var i=0;i<mirrorNodes.length;i++){
                    Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[i].id,cL);
                  }
                }
                DScaffolding.cloneNodeBis(risk,destinationNode.id,cL);
              }
            }
          }
          else if(Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent)!=-1){
            var risk = node.getParentNode().getParentNode();
            var signCont = risk.getChildrenWithText(Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.text)[0];
            // TO TREAT ERROR
            var sign = signCont.getChildrenWithIcon(Icons.enabled);
            if(sign!=null&&sign.length>0){
              var prob = node.getParentNode().getChildrenWithIcon(Icons.enabled);
              if(prob.length>1){
                for(var i=0;i<prob.length;i++){
                  if(prob[i].getContent()!=nodeContent){
                    var nodeToChange = node.getParentNode().getChildrenWithText(prob[i].getContent())[0];
                    Mindmeister.modifyIdea(Scrap.mapID,nodeToChange.id,{icon:Icons.disabled},cL);
                  }
                }
              }
              var signGrade = Prompter.Nodes.DETERMINE_RISK_SIGNIFICANCE.options.indexOf(sign[0].getContent());
              var probGrade = Prompter.Nodes.DETERMINE_RISK_LIKELIHOOD.options.indexOf(nodeContent);
              var totalGrade = probGrade*signGrade;
              var destinationNode;
              if(totalGrade>=0&&totalGrade<4) destinationNode = Nodes.templateNodes.ANALYSED_RISK_LIST_LOW;
              else if(totalGrade>=4&&totalGrade<=12) destinationNode = Nodes.templateNodes.ANALYSED_RISK_LIST_MEDIUM;
              else if(totalGrade>12) destinationNode = Nodes.templateNodes.ANALYSED_RISK_LIST_HIGH;
              if(destinationNode!=null){
                var mirrorNodes = Nodes.templateNodes.PRIORITISE_RISKS.getChildrenWithText(risk.getContent());
                if(mirrorNodes!=null&&mirrorNodes.length>0){
                  for(var i=0;i<mirrorNodes.length;i++){
                    Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[i].id,cL);
                  }
                }
                DScaffolding.cloneNodeBis(risk,destinationNode.id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.ANALYSE_RISKS.onRemoved(function(removedNodes){
        var cL = new Mindmeister.ChangeList();
        Scrap.showWorkingMessage();
        for(var i=0;i<removedNodes.length;i++){
          var mirrorNodes1 = Nodes.templateNodes.PRIORITISE_RISKS.getChildrenWithText(removedNodes[i]);
          var mirrorNodes2 = Nodes.templateNodes.DETERMINE_RISK_TREATMENTS.getChildrenWithText(removedNodes[i]);
          var mirrorNodes = mirrorNodes1.concat(mirrorNodes2);
          if(mirrorNodes!=null&&mirrorNodes.length>0){
            for(var j=0;j<mirrorNodes.length;j++){
              Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[j].id,cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    if(Nodes.templateNodes.TIME_CONSTRAINTS_ENOUGH!=null){
      Nodes.templateNodes.TIME_CONSTRAINTS_ENOUGH.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          var a = ["Severely limited time"];
          if(a.indexOf(nodeContent)!=-1){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var insertionPoint = lag[i].getChildrenWithText("Research Constraints");
              if(insertionPoint!=null&&insertionPoint.length>0){
                Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Overcome '"+nodeContent+"'",link:"topic:"+node.id,style:NODE_STYLES.template},cL);
              }
            }
          }
          if(nodeContent=="Severely limited time"){
            var aux = Scrap.getNodesWithText("Quick and Simple Strategy");
            for(var i=0;i<aux.length;i++){
              Mindmeister.modifyIdea(Scrap.mapID,aux[i].id,{icon:Icons.enabled},cL);
            }
          }
          DScaffolding.deactivateOldActiveChildren(Nodes.templateNodes.TIME_CONSTRAINTS_ENOUGH,nodeContent,cL);
        }
        else if(icon==Icons.disabled){
          var a = ["Severely limited time"];
          if(a.indexOf(nodeContent)!=-1){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var mirrorNodes = lag[i].getChildrenWithText("Overcome '"+nodeContent+"'");
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[0].id,cL);
              }
            }
          }
          if(nodeContent=="Severely limited time"){
            var aux = Scrap.getNodesWithText("Quick and Simple Strategy");
            for(var i=0;i<aux.length;i++){
              Mindmeister.modifyIdea(Scrap.mapID,aux[i].id,{icon:Icons.disabled},cL);
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    if(Nodes.templateNodes.FUNDING_CONSTRAINTS_ENOUGH!=null){
      Nodes.templateNodes.FUNDING_CONSTRAINTS_ENOUGH.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          var a = ["Severely limited funding"];
          if(a.indexOf(nodeContent)!=-1){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var insertionPoint = lag[i].getChildrenWithText("Research Constraints");
              if(insertionPoint!=null&&insertionPoint.length>0){
                Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Overcome '"+nodeContent+"'",link:"topic:"+node.id,style:NODE_STYLES.template},cL);
              }
            }

          }
          DScaffolding.deactivateOldActiveChildren(Nodes.templateNodes.FUNDING_CONSTRAINTS_ENOUGH,nodeContent,cL)
        }
        else if(icon==Icons.disabled){
          var a = ["Severely limited funding"];
          if(a.indexOf(nodeContent)!=-1){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var mirrorNodes = lag[i].getChildrenWithText("Overcome '"+nodeContent+"'");
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[0].id,cL)
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    if(Nodes.templateNodes.SOFTWARE_HARDWARE_ACCESS!=null){
      Nodes.templateNodes.SOFTWARE_HARDWARE_ACCESS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          if(nodeContent=="Maybe can get access"){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var insertionPoint = lag[i].getChildrenWithText("Research Constraints");
              if(insertionPoint!=null&&insertionPoint.length>0){
                Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Overcome 'maybe can get access to needed hardware and/or software'",link:"topic:"+node.id,style:NODE_STYLES.template},cL);
              }
            }
          }
          DScaffolding.deactivateOldActiveChildren(Nodes.templateNodes.SOFTWARE_HARDWARE_ACCESS,nodeContent,cL);
        }
        else if(icon==Icons.disabled){
          if(nodeContent=="Maybe can get access"){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var mirrorNodes = lag[i].getChildrenWithText("Overcome 'maybe can get access to needed hardware and/or software'");
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[0].id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    if(Nodes.templateNodes.DO_YOU_NEED_ACCESS_ORGANISATION!=null&&Nodes.templateNodes.ORGANISATION_ACCESS!=null){
      Nodes.templateNodes.DO_YOU_NEED_ACCESS_ORGANISATION.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          if(nodeContent=="Definitely"||nodeContent=="Maybe"){
            var lag = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("What or how many organisations would you need to have access to?");
            if(lag==null||lag.length==0){
              Mindmeister.insertIdea(Scrap.mapID,Nodes.templateNodes.ORGANISATION_ACCESS.id,{title:"What or how many organisations would you need to have access to?",style:NODE_STYLES.template},cL);
              var nId = Mindmeister.insertIdea(Scrap.mapID,Nodes.templateNodes.ORGANISATION_ACCESS.id,{title:"Do you already have access?",style:NODE_STYLES.template},cL);
              Mindmeister.insertIdea(Scrap.mapID,nId,{title:"Definitely",style:NODE_STYLES.template,icon:Icons.disabled},cL);
              Mindmeister.insertIdea(Scrap.mapID,nId,{title:"Maybe",style:NODE_STYLES.template,icon:Icons.disabled},cL);
              Mindmeister.insertIdea(Scrap.mapID,nId,{title:"No",style:NODE_STYLES.template,icon:Icons.disabled},cL);
            }
          }
          else if(nodeContent=="No"){
            var orgNumber = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("What or how many organisations would you need to have access to?");
            if(orgNumber!=null&&orgNumber.length>0) Mindmeister.removeIdea(Scrap.mapID,orgNumber[0].id,cL);
            var alreadyAccess = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Do you already have access?");
            if(alreadyAccess!=null&&alreadyAccess.length>0) Mindmeister.removeIdea(Scrap.mapID,alreadyAccess[0].id,cL);
            var canGetAccess = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Can you get access?");
            if(canGetAccess!=null&&canGetAccess.length>0) Mindmeister.removeIdea(Scrap.mapID,canGetAccess[0].id,cL);
          }
          DScaffolding.deactivateOldActiveChildren(Nodes.templateNodes.DO_YOU_NEED_ACCESS_ORGANISATION,nodeContent,cL);
        }
        else if(icon==Icons.disabled){
          var activeChildren = Nodes.templateNodes.DO_YOU_NEED_ACCESS_ORGANISATION.getChildrenWithIcon(Icons.enabled);
          var getActiveChildrenContent = function(c){
            return c.getContent();
          }
          if(activeChildren.length==0||(activeChildren.length==1&&activeChildren.map(getActiveChildrenContent).indexOf("No")!=-1)){
            var orgNumber = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("What or how many organisations would you need to have access to?");
            if(orgNumber!=null&&orgNumber.length>0) Mindmeister.removeIdea(Scrap.mapID,orgNumber[0].id,cL);
            var alreadyAccess = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Do you already have access?");
            if(alreadyAccess!=null&&alreadyAccess.length>0) Mindmeister.removeIdea(Scrap.mapID,alreadyAccess[0].id,cL);
            var canGetAccess = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Can you get access?");
            if(canGetAccess!=null&&canGetAccess.length>0) Mindmeister.removeIdea(Scrap.mapID,canGetAccess[0].id,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.ORGANISATION_ACCESS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent!="Do you already have access?") return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          if(nodeContent=="No"||nodeContent=="Maybe"){
            var lag = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Can you get access?");
            if(lag==null||lag.length==0){
              var nId = Mindmeister.insertIdea(Scrap.mapID,Nodes.templateNodes.ORGANISATION_ACCESS.id,{title:"Can you get access?",style:NODE_STYLES.template},cL);
              Mindmeister.insertIdea(Scrap.mapID,nId,{title:"Definitely",style:NODE_STYLES.template,icon:Icons.disabled},cL);
              Mindmeister.insertIdea(Scrap.mapID,nId,{title:"Maybe can get access",style:NODE_STYLES.template,icon:Icons.disabled},cL);
              Mindmeister.insertIdea(Scrap.mapID,nId,{title:"Unlikely (change scope!)",style:NODE_STYLES.template,icon:Icons.disabled},cL);
            }
          }
          else if(nodeContent=="Definitely"){
            var canGetAccess = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Can you get access?");
            if(canGetAccess!=null&&canGetAccess.length>0) Mindmeister.removeIdea(Scrap.mapID,canGetAccess[0].id,cL);
          }
          DScaffolding.deactivateOldActiveChildren(parentNode,nodeContent,cL);
        }
        else if(icon==Icons.disabled){
          var activeChildren = parentNode.getChildrenWithIcon(Icons.enabled);
          var getActiveChildrenContent = function(c){
            return c.getContent();
          }
          if(activeChildren.length==0||(activeChildren.length==1&&activeChildren.map(getActiveChildrenContent).indexOf("Definitely")!=-1)){
            var canGetAccess = Nodes.templateNodes.ORGANISATION_ACCESS.getChildrenWithText("Can you get access?");
            if(canGetAccess!=null&&canGetAccess.length>0) Mindmeister.removeIdea(Scrap.mapID,canGetAccess[0].id,cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.ORGANISATION_ACCESS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(parentNodeContent!="Can you get access?") return;
        if(icon==Icons.enabled){
          DScaffolding.deactivateOldActiveChildren(parentNode,nodeContent,cL);
          if(nodeContent=="Maybe can get access"){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var insertionPoint = lag[i].getChildrenWithText("Research Constraints");
              if(insertionPoint!=null&&insertionPoint.length>0){
                Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Overcome 'maybe can get access to organisation for evaluation'",link:node.id,style:NODE_STYLES.template},cL);
              }
            }
          }
        }
        else if(icon==Icons.disabled){
          if(nodeContent=="Maybe can get access"){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var mirrorNodes = lag[i].getChildrenWithText("Overcome 'maybe can get access to organisation for evaluation'");
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[0].id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.ORGANISATION_ACCESS.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        var parentNodeContent = parentNode.getContent();
        for(var i=0;i<removedNodes.length;i++){
          if(removedNodes[i]=="Maybe can get access"){
            var pointToSearch = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var j=0;j<pointToSearch.length;j++){
              var nodeToRemove = pointToSearch[j].getChildrenWithText("Overcome 'maybe can get access to organisation for evaluation'");
              if(nodeToRemove!=null&&nodeToRemove.length>0){
                Mindmeister.removeIdea(Scrap.mapID,nodeToRemove[0].id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    if(Nodes.templateNodes.DO_YOU_HAVE_SUFFICIENT_SKILLS!=null){
      Nodes.templateNodes.DO_YOU_HAVE_SUFFICIENT_SKILLS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          DScaffolding.deactivateOldActiveChildren(Nodes.templateNodes.DO_YOU_HAVE_SUFFICIENT_SKILLS,nodeContent,cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    if(Nodes.templateNodes.CAN_YOU_OBTAIN_SKILLS!=null){
      Nodes.templateNodes.CAN_YOU_OBTAIN_SKILLS.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          DScaffolding.deactivateOldActiveChildren(parentNode,nodeContent,cL);
          if(nodeContent=="Maybe"){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var insertionPoint = lag[i].getChildrenWithText("Research Constraints");
              if(insertionPoint!=null&&insertionPoint.length>0){
                Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Overcome 'maybe can learn and obtain sufficient skills to conduct the research'",link:"topic:"+node.id,style:NODE_STYLES.template},cL);
              }
            }
          }
        }
        else if(icon==Icons.disabled){
          if(nodeContent=="Maybe"){
            var lag = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
            for(var i=0;i<lag.length;i++){
              var mirrorNodes = lag[i].getChildrenWithText("Overcome 'maybe can learn and obtain sufficient skills to conduct the research'");
              if(mirrorNodes!=null&&mirrorNodes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,mirrorNodes[0].id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
    }

    if(Nodes.templateNodes.IDENTIFY_FEASIBILITY_UNCERTAINTIES!=null){
      Nodes.templateNodes.IDENTIFY_FEASIBILITY_UNCERTAINTIES.onIconEdited(function(node,icon){
        var nodeContent = node.getContent();
        var parentNode = node.getParentNode();
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent!=Nodes.templateNodesText.IDENTIFY_FEASIBILITY_UNCERTAINTIES) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(icon==Icons.enabled){
          var searchInNode = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
          for(var i=0;i<searchInNode.length;i++){
            var evaluationMirror = searchInNode[i].getChildrenWithSubText("'"+nodeContent+"'");
            if(evaluationMirror==null||evaluationMirror.length==0){
              var insertionPoint = searchInNode[i].getChildrenWithText("Feasibility Uncertainties");
              if(insertionPoint!=null&&insertionPoint.length>0){
                Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Ensure '"+nodeContent+"'",link:"topic:"+node.id,style:NODE_STYLES.template},cL);
              }
            }
          }
          var ofWhat = node.getChildrenWithText("Of what and in what way?");
          if(ofWhat==null||ofWhat.length==0){
            var nId = Mindmeister.insertIdea(Scrap.mapID,node.id,{title:"Of what and in what way?",style:Prompter.Styles.prompt},cL,true);
            DScaffolding.insertTaskNode("'"+nodeContent+"' of what and in what way?",nId,cL);
          }
          if(nodeContent=="Human usability"||nodeContent=="Organisational feasibility"){
            var nodeToEnable = Scrap.getNodesWithText("Human Risk and Effectiveness Strategy");
            for(var j=0;j<nodeToEnable.length;j++){
              Mindmeister.modifyIdea(Scrap.mapID,nodeToEnable[j].id,{icon:"status_ok"},cL);
            }
          }
          if(nodeContent=="Technical feasibility"){
            var nodeToEnable = Scrap.getNodesWithText("Technological Risk and Efficacy Strategy");
            for(var j=0;j<nodeToEnable.length;j++){
              Mindmeister.modifyIdea(Scrap.mapID,nodeToEnable[j].id,{icon:"status_ok"},cL);
            }
          }
        }
        else if(icon==Icons.disabled){
          var searchInNode = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
          for(var i=0;i<searchInNode.length;i++){
            var evaluationMirror = searchInNode[i].getChildrenWithSubText("'"+nodeContent+"'");
            if(evaluationMirror!=null&&evaluationMirror.length>0){
              for(var i=0;i<evaluationMirror.length;i++){
                Mindmeister.removeIdea(Scrap.mapID,evaluationMirror[i].id,cL);
              }
            }
          }
          var ofWhat = node.getChildrenWithText("Of what and in what way?");
          if(ofWhat!=null||ofWhat.length>0){
            Mindmeister.removeIdea(Scrap.mapID,ofWhat[0].id,cL);
          }
          if(nodeContent=="Human usability"||nodeContent=="Organisational feasibility"){
            DScaffolding.checkHumanRisk(cL);
          }
          if(nodeContent=="Technical feasibility"){
            DScaffolding.checkTechnicalRisk(cL);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      })
      Nodes.templateNodes.IDENTIFY_FEASIBILITY_UNCERTAINTIES.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null) return;
        var addedNodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();

        if(parentNodeContent != "Of what and in what way?") return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();

        var grandParentNode = parentNode.getParentNode();
        var grandParentNodeContent = grandParentNode.getContent();

        if(Utils.backgroundColorToHex(parentNode.getHTMLElement().style.backgroundColor)==Prompter.Styles.prompt.backgroundColor){
          Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt_completed},cL);
          DScaffolding.removeTaskNode("'"+grandParentNodeContent+"' of what and in what way?",cL);
        }

        var pointToSearch = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
        for(var i=0;i<pointToSearch.length;i++){
          var nodeToRemove = pointToSearch[i].getChildrenWithText("Ensure '"+grandParentNodeContent+"'");
          if(nodeToRemove!=null&&nodeToRemove.length>0) Mindmeister.removeIdea(Scrap.mapID,nodeToRemove[0].id,cL);
          var insertionPoint = pointToSearch[i].getChildrenWithText("Feasibility Uncertainties");
          if(insertionPoint!=null&&insertionPoint.length>0) Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Ensure '"+addedNodeContent+"' '"+grandParentNodeContent+"'",link:"topic:"+addedNode.id,style:NODE_STYLES.template},cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      Nodes.templateNodes.IDENTIFY_FEASIBILITY_UNCERTAINTIES.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        if(parentNodeContent != "Of what and in what way?") return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();

        var pointToSearch = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
        for(var l=0;l<pointToSearch.length;l++){
          var insertionPoint = pointToSearch[l].getChildrenWithText("Feasibility Uncertainties");
          if(insertionPoint!=null&&insertionPoint.length>0){
            for(var i=0;i<removedNodes.length;i++){
              var searchRes = insertionPoint[0].getChildrenWithSubText("'"+removedNodes[i]+"'");
              if(searchRes!=null&&searchRes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,searchRes[0].id,cL);
              }
            }
          }
          var siblings = parentNode.getChildren();
          if(siblings==null||siblings.length==0){
            var grandParentNode = parentNode.getParentNode();
            var grandParentNodeContent = grandParentNode.getContent();
            if(insertionPoint!=null&&insertionPoint.length>0) Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Ensure '"+grandParentNodeContent+"'",link:"topic:"+grandParentNode.id,style:NODE_STYLES.template},cL);
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:Prompter.Styles.prompt},cL);
            // create task
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    if(Nodes.templateNodes.IDENTIFY_ETHICAL_CONSTRAINTS!=null){
      Nodes.templateNodes.IDENTIFY_ETHICAL_CONSTRAINTS.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode==null) return;
        var addedNodeContent = addedNode.getContent();
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();

        var possibleParentList = ["Animal research constraints? (List them)","Privacy constraints? (List them)","Human research subject constraints? (List them)","Organisational risk constraints? (List them)","Societal risk constraints? (List them)"];

        if(possibleParentList.indexOf(parentNodeContent)==-1) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();

        var pointToSearch = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");

        for(var i=0;i<pointToSearch.length;i++){
          var insertionPoint = pointToSearch[i].getChildrenWithText("Research Constraints");
          if(insertionPoint!=null&&insertionPoint.length>0) Mindmeister.insertIdea(Scrap.mapID,insertionPoint[0].id,{title:"Overcome '"+addedNodeContent+"'",link:"topic:"+addedNode.id,style:NODE_STYLES.template},cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      },true);
      Nodes.templateNodes.IDENTIFY_ETHICAL_CONSTRAINTS.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        var parentNodeContent = parentNode.getContent();
        var possibleParentList = ["Animal research constraints? (List them)","Privacy constraints? (List them)","Human research subject constraints? (List them)","Organisational risk constraints? (List them)","Societal risk constraints? (List them)"];
        if(possibleParentList.indexOf(parentNodeContent)==-1) return;
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();

        var pointToSearch = Scrap.getNodesWithText("Prioritise evaluation purposes, goals, constraints, and uncertainties, so you can address higher priorities as early as possible");
        for(var l=0;l<pointToSearch.length;l++){
          var insertionPoint = pointToSearch[l].getChildrenWithText("Research Constraints");
          if(insertionPoint!=null&&insertionPoint.length>0){
            for(var i=0;i<removedNodes.length;i++){
              var searchRes = insertionPoint[0].getChildrenWithSubText("Overcome '"+removedNodes[i]+"'");
              if(searchRes!=null&&searchRes.length>0){
                Mindmeister.removeIdea(Scrap.mapID,searchRes[0].id,cL);
              }
            }
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      });
    }

    // // ALL MAP
    // provisional
    var rootChild = document.querySelectorAll(".root_child");
    for(var i=0;i<rootChild.length;i++){
      var n = new Scrap.Node(rootChild[i]);
      n.onChildrenAdded(function(addedNodes){
        var addedNode = addedNodes[0];
        if(addedNode == null || addedNode.id == null) return;
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();
        var addedNodeContent = addedNode.getContent();
        if(addedNodeContent==null)return;
        if(addedNodeContent=="Supporting Evidences?"||addedNodeContent=="Who else addresses it?"||addedNodeContent=="Justificatory Knowledge"){
          //Mindmeister.modifyIdea(Scrap.mapID,addedNode.id,{note:"What proof do I have that this cause exists? (Is it concrete? Is it measurable?)\n\nWhat proof do I have that this cause could lead to the stated effect? (Am I merely asserting causation?)\n\nWhat proof do I have that this cause actually contributed to the problem I'm looking at? (Even given that it exists and could lead to this problem, how do I know it wasn't actually something else?)\n\nIs anything else needed, along with this cause, for the stated effect to occur? (Is it self-sufficient? Is something needed to help it along?)\n\nCan anything else, besides this cause, lead to the stated effect? (Are there alternative explanations that fit better? What other risks are there?)"},cL);
          var rootNode = Scrap.getRootNode();
          var rootNodeContent = rootNode.getContent().trim();
          var freeColor = PurposeManager.getAvailableColor();
          if(freeColor!=null){
            Scrap.showWorkingMessage();
            var cL = new Mindmeister.ChangeList();
            Mindmeister.modifyIdea(Scrap.mapID,addedNode.id,{style:Prompter.Styles.prompt},cL);
            PurposeManager.insertPurpose(parentNode.id,freeColor,parentNodeContent,addedNode.id);
            var templateStyle = JSON.parse(JSON.stringify(NODE_STYLES.template));
            templateStyle.backgroundColor = freeColor;
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:templateStyle},cL);
            Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
              if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
              else Scrap.hideWorkingMessage();
            })
          }
          else{
            Scrap.showMessage("There are no more colors available.");
          }
          //})
        }
        /*
        if(!MENDELEY_ENABLED) return;
        var addedNode = addedNodes[0];
        if(addedNode == null || addedNode.id == null) return;
        var parentNode = addedNode.getParentNode();
        var parentNodeContent = parentNode.getContent();
        var addedNodeContent = addedNode.getContent();
        if(addedNodeContent==null)return;
        if(addedNodeContent=="Supporting Evidences?"||addedNodeContent=="Who else addresses it?"||addedNodeContent=="Justificatory Knowledge"){
          //Mindmeister.modifyIdea(Scrap.mapID,addedNode.id,{note:"What proof do I have that this cause exists? (Is it concrete? Is it measurable?)\n\nWhat proof do I have that this cause could lead to the stated effect? (Am I merely asserting causation?)\n\nWhat proof do I have that this cause actually contributed to the problem I'm looking at? (Even given that it exists and could lead to this problem, how do I know it wasn't actually something else?)\n\nIs anything else needed, along with this cause, for the stated effect to occur? (Is it self-sufficient? Is something needed to help it along?)\n\nCan anything else, besides this cause, lead to the stated effect? (Are there alternative explanations that fit better? What other risks are there?)"},cL);
          var rootNode = Scrap.getRootNode();
          var rootNodeContent = rootNode.getContent().trim();
          var freeColor = Palette.getFreeColor(Scrap.mapID);
          if(freeColor!=null){
            Scrap.showWorkingMessage();
            var cL = new Mindmeister.ChangeList();
            Mindmeister.modifyIdea(Scrap.mapID,addedNode.id,{style:Prompter.Styles.prompt},cL);
            PurposeManager.insertPurpose(parentNode.id,freeColor,parentNodeContent,addedNode.id);
            var templateStyle = JSON.parse(JSON.stringify(NODE_STYLES.template));
            templateStyle.backgroundColor = freeColor;
            Mindmeister.modifyIdea(Scrap.mapID,parentNode.id,{style:templateStyle},cL);
            Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
              if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
              else Scrap.hideWorkingMessage();
            })
          }
          else{
            Scrap.showMessage("There are no more colors available.");
          }
        }*/
      },true,true);
      // solucion temporal
      n.onRemoved(function(removedNodes,parentNode){
        if(parentNode==null)return;
        if(removedNodes.length==0) return;
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if(/*removedNodes.length==1&&*/(removedNodes[0]=="Supporting Evidences?"||removedNodes[0]=="Who else addresses it?"||removedNodes[0]=="Justificatory Knowledge")){
          Mindmeister.decolorIdea(Scrap.mapID,parentNode.id,cL);
          PurposeManager.removePurpose(parentNode.id);
        }
        else if(removedNodes.indexOf("Supporting Evidences?")!=-1||removedNodes.indexOf("Who else addresses it?")!=-1||removedNodes.indexOf("Justificatory Knowledge")!=-1){
          for(var j=0;j<removedNodes.length;j++){
            var purpose = PurposeManager.getPurpose(null,null,removedNodes[j]);
            if(purpose!=null) PurposeManager.removePurpose(purpose.nodeId,purpose.color);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
        /*if(parentNode==null)return;
        if(removedNodes.length==0) return;
        var parentNodeContent = parentNode.getContent();
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        if((removedNodes[0]=="Supporting Evidences?"||removedNodes[0]=="Who else addresses it?"||removedNodes[0]=="Justificatory Knowledge")){
          Mindmeister.decolorIdea(Scrap.mapID,parentNode.id,cL);
          PurposeManager.removePurpose(parentNode.id);
        }
        else if(removedNodes.indexOf("Supporting Evidences?")!=-1||removedNodes.indexOf("Who else addresses it?")!=-1||removedNodes.indexOf("Justificatory Knowledge")!=-1){
          for(var j=0;j<removedNodes.length;j++){
            var purpose = PurposeManager.getPurpose(null,null,removedNodes[j]);
            if(purpose!=null) PurposeManager.removePurpose(purpose.nodeId,purpose.color);
          }
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })*/
      });
    }

    /*this.onTemplateNodeRemoved(null,function(tasksToRemove,nodesToDecolor){
      if(tasksToRemove!=null&&tasksToRemove.length>0){
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        for(var i=0;i<tasksToRemove.length;i++){
          DScaffolding.removeTaskNode(tasksToRemove[i],cL);
        }
        var style = null;
        for(var i=0;i<nodesToDecolor.length;i++){
          if(document.getElementById(nodesToDecolor[i])!=null) Mindmeister.decolorIdea(Scrap.mapID,nodesToDecolor[i],cL);
        }
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      }
    },true)*/

    var rootNode = Scrap.getRootNode();
    rootNode.onEdited(function(node,oldValue){
      var newTitle = node.getContent().trim();
      if(newTitle==Utils.escapeHtml("Risk Management for <project name>")||newTitle==Utils.escapeHtml("<project name>")) return;
      if(oldValue==null) return;
      if(newTitle==oldValue) return;
      if(newTitle.indexOf("Risk Management for ")==-1){
        Scrap.showConfirmationMessage("The root node must follow the pattern 'Risk Management for PROJECT_NAME' in order for DScaffolding to work",function(){
          return;
        },function(){
          var cL = new Mindmeister.ChangeList();
          Mindmeister.modifyIdea(Scrap.mapID,Scrap.getRootNode().id,{title:oldValue},cL);
          Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
            return;
          })
        },"Proceed anyway","Undo");
      }
      else if(newTitle.replace("Risk Management for","").trim().length>25||newTitle.replace("Risk Management for","").trim().length<4) {
        Scrap.showConfirmationMessage("The project name must have between 4 and 25 characters",function(){
          return;
        },function(){
          var cL = new Mindmeister.ChangeList();
          Mindmeister.modifyIdea(Scrap.mapID,Scrap.getRootNode().id,{title:oldValue},cL);
          Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
            return;
          })
        },"Proceed anyway","Undo");
      }
      else Hypothesis.getGroupId(oldValue.replace("Risk Management for","").trim()).then(function(groupId){
        if(groupId==null){
          Hypothesis.createGroup(newTitle.replace("Risk Management for","").trim()).then(function(newGroupId){
            // TO DO - INSERT CURRENT PURPOSES IN HYPOTHESIS
          })
        }
        else{
          Hypothesis.updateGroupIdName(groupId,newTitle.replace("Risk Management for","").trim());
        }
      })
      /*var newTitle = node.getContent();
      var labelMap = DSCAFFOLDING_LABELS.map(getAttribute,"mapId");
      var lag = labelMap.indexOf(Scrap.mapID);
      if(lag!=-1){
        DSCAFFOLDING_LABELS[lag]["mapName"] = newTitle;
        chrome.storage.sync.set({
          "DSCAFFOLDING_LABELS": DSCAFFOLDING_LABELS
        }, function(){
          chrome.runtime.sendMessage({mes: "reloadDScaffoldingLabels"});
        })
      }*/
    },false);
    Scrap.onNodeEdited(null,function(node,oldValue){
      var newContent = node.getContent();
      var purpose = PurposeManager.getPurpose(null,node.id);
      if(purpose!=null){
        PurposeManager.updatePurpose(node.id,newContent);
      }
    },true);

  }
  var initNoTemplate = function(){
    var rootNode = Scrap.getRootNode();
    rootNode.onEdited(function(node,oldValue){
      var newTitle = node.getContent().trim();
      if(oldValue==null) return;
      if(newTitle==oldValue) return;
      if(newTitle=="My New Mind Map") return;
      if(newTitle.length>25){
        newTitle = newTitle.substring(0,24);
      }
      if(newTitle.trim().length<4) {
        for(var i=newTitle.trim().length;i<4;i++) newTitle += "_";
      }
      var oldV = oldValue;
      if(oldV.length>25){
        oldV = oldV.substring(0,24);
      }
      if(oldV.trim().length<4) {
        for(var i=oldV.trim().length;i<4;i++) oldV += "_";
      }
      Hypothesis.getGroupId(oldV).then(function(groupId){
        if(groupId==null){
          Hypothesis.createGroup(newTitle).then(function(newGroupId){
            // TO DO - INSERT CURRENT PURPOSES IN HYPOTHESIS
            var purposeList = PurposeManager.getPurposes();
            for(var j=0;j<purposeList.length;j++){
              Hypothesis.insertAnnotationGroupTagColor(newTitle,"Purpose:"+purposeList[j].label.trim(),Utils.hexToCssRgba(purposeList[j].color,0.9));
            }
          })
        }
        else{
          Hypothesis.updateGroupIdName(groupId,newTitle);
        }
      })
    },false);
    Scrap.onNodeEdited(null,function(node,oldValue){
      var newContent = node.getContent();
      var purpose = PurposeManager.getPurpose(null,node.id);
      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList();
      var regExp = /\.\.\.$/;

      if(purpose!=null){
        if(purpose.insertionPoint == node.id){
          if(regExp.test(oldValue)&&regExp.test(newContent)){
            PurposeManager.updatePurpose(node.id,newContent.replace(regExp,"").trim());
          }
          else{
            Mindmeister.decolorIdea(Scrap.mapID, node.id, cL);
            PurposeManager.removePurpose(node.id,purpose.color);
          }
        }
      }
      else if(!regExp.test(oldValue)&&regExp.test(newContent)&&PurposeManager.getPurpose(null,node.id,null)==null){
        var freeColor = PurposeManager.getAvailableColor();
        if(freeColor!=null){
          var templateStyle = JSON.parse(JSON.stringify(NODE_STYLES.template));
          templateStyle.backgroundColor = freeColor;
          PurposeManager.insertPurpose(node.id,freeColor,newContent.replace(regExp,"").trim(),node.id);
          Mindmeister.modifyIdea(Scrap.mapID,node.id,{style:templateStyle},cL);
        }
        else{
          Scrap.hideWorkingMessage();
          Scrap.showMessage("There are no more colors available.");
        }
      }
      Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
        if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
        else Scrap.hideWorkingMessage();
      })
    },true);

    Scrap.onChildrenAdded(null,function(addedNodes){
      var addedNode = addedNodes[0];
      if(addedNode == null || addedNode.id == null) return;
      var addedNodeContent = addedNode.getContent();
      var regExp = /\.\.\.$/g;
      if(addedNodeContent==null)return;
      if(regExp.test(addedNodeContent)&&PurposeManager.getPurpose(null,addedNode.id,null)==null){
        var freeColor = PurposeManager.getAvailableColor();
        if(freeColor!=null){
          Scrap.showWorkingMessage();
          var cL = new Mindmeister.ChangeList();
          var templateStyle = JSON.parse(JSON.stringify(NODE_STYLES.template));
          templateStyle.backgroundColor = freeColor;
          PurposeManager.insertPurpose(addedNode.id,freeColor,addedNodeContent.replace(/\.\.\.$/g,""),addedNode.id);
          Mindmeister.modifyIdea(Scrap.mapID,addedNode.id,{style:templateStyle},cL);
          Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
            else Scrap.hideWorkingMessage();
          })
        }
        else{
          Scrap.showMessage("There are no more colors available.");
        }
      }
    },true);
    Scrap.onNodeRemoved(null,function(removedNodes,parentNode) {
      if (removedNodes.length == 0) return;
      var regExp = new RegExp(/\.\.\.$/g);
      for(var j=0;j<removedNodes.length;j++){
        if(regExp.test(removedNodes[j])){
          var purpose = PurposeManager.getPurpose(null, null, removedNodes[j].replace(/\.\.\.$/g,""));
          if(purpose!=null){
            PurposeManager.removePurpose(purpose.nodeId,purpose.color);
          }
        }
      }
    });
  }
  var getWhichTemplate = function(){
    var explicateProblemNodes = ["Set Problem Statement","Describe Stakeholders","Assess Problem as Difficulties","Assess Problem as Solutions","Describe Problematic Phenomena","Describe Practice","Describe Terminology"]
    var explicateProblemNodesSubtext = ["Explicate Problem for"];
    var designScienceNodes = ["Describe Practice","Explicate Problem","Manage DSR Risks","Formulate Design Theory","Decide Requirements and Capture Design Ideas"];
    var riskManagementNodes = ["Characterise DSR Project Context","Identify Risks","Analyse Risks","Prioritise Risks","Determine Risk Treatments","Enact Risk Treatments"];

    var designScienceTemplate = true;
    for(var i=0;i<designScienceNodes.length;i++){
      if(Scrap.getNodesWithText(designScienceNodes[i])==null||Scrap.getNodesWithText(designScienceNodes[i]).length==0){
        designScienceTemplate = false;
        break;
      }
    }
    if(designScienceTemplate){
      return "Desing Science";
    }

    var explicateProblemTemplate = true;
    for(var i=0;i<explicateProblemNodes.length;i++){
      if(Scrap.getNodesWithText(explicateProblemNodes[i])==null||Scrap.getNodesWithText(explicateProblemNodes[i]).length==0){
        explicateProblemTemplate = false;
        break;
      }
    }
    for(var i=0;i<explicateProblemNodesSubtext.length;i++){
      if(Scrap.getNodesWithSubText(explicateProblemNodesSubtext[i])==null||Scrap.getNodesWithSubText(explicateProblemNodesSubtext[i]).length==0){
        explicateProblemTemplate = false;
        break;
      }
    }
    if(explicateProblemTemplate){
      return "Explicate Problem New";
    }

    var riskManagementTemplate = true;
    for(var i=0;i<riskManagementNodes.length;i++){
      if(Scrap.getNodesWithText(riskManagementNodes[i])==null||Scrap.getNodesWithText(riskManagementNodes[i]).length==0){
        riskManagementTemplate = false;
        break;
      }
    }
    if(riskManagementTemplate){
      return "Risk Management";
    }
    return null;
  }
  var initTemplate = function(){
    var that = this;
    return new Promise(function(resolve,reject){
      Mindmeister.getUserName().then(function(userName){
        Scrap.setUserName(userName);
        var template = that.templateName;//getWhichTemplate();
        if(template=="Desing Science"){
          initTemplateDesignScience();
          resolve();
        }
        else if(template=="Explicate Problem New"){
          initTemplateExplicateProblemNew();
          resolve();
        }
        else if(template=="Risk Management"){
          initTemplateRiskManagement();
          resolve();
        }
        else{
          initNoTemplate();
          resolve();
        }
      })
    })
  }
  var extractArticlesFromMap = function(){
    return new Promise(function(resolve,reject){
      Mindmeister.getMapIdeas(Scrap.mapID).then(function(ideas){
        var getIdeaNote = function(ideaID){
          var idea = ideas.find((el) => {return el.id==ideaID});
          if(idea==null||idea.note==null) return null;
          return idea.note;
        }
        var sup = Scrap.getNodesWithText("Supporting Evidences?").concat(Scrap.getNodesWithText("Who else addresses it?"));
        var articles = [];
        for(var i=0;i<sup.length;i++){
          var aux = sup[i].getChildren();
          for(var j=0;j<aux.length;j++){
            var note = getIdeaNote(aux[j].id);
            if(note!=null){
              var el = document.createElement("div");
              el.innerHTML = note;
              var artTitle = el.querySelector(".title");
              if(artTitle!=null) articles.push(artTitle.textContent);
              else{
                var artTitleBis = el.querySelector(".line b");
                if(artTitleBis!=null) articles.push(artTitleBis.textContent);
              }
            }
          }
        }
        resolve(articles);
      })
    })
  }
  var extractTermsFromMap = function(){
    var termList = [];
    var aux = Scrap.getNodesWithText("Supporting Evidences?").concat(Scrap.getNodesWithText("Who else addresses it?"));
    for(var i=0;i<aux.length;i++){
      var parent = aux[i].getParentNode();
      if(parent.isDescendant(Nodes.templateNodes.ASCERTAIN_CAUSES)||parent.isDescendant(Nodes.templateNodes.ASCERTAIN_CONSEQUENCES)){
        termList.push(parent.getContent());
      }
    }
    return termList;
  }
  var getProblemStatement = function(){
    var p = Nodes.templateNodes.SET_PROBLEM_STATEMENT.getChildren();
    if(p.length>0) return p[0].getContent();
    return null;
  }
  var insertDocumentIntoMendeleyLibrary = function(documentData){
    return new Promise(function(resolve,reject){
      var url = documentData.pdfurl.indexOf("https")==-1 ? documentData.pdfurl.replace("http","https") : documentData.pdfurl;
      Mendeley.insertDocumentIntoFolder(url,{title:documentData.title},null).then(function(){
        resolve();
      })
    })
  }
  var insertDocumentIntoFolder = function(documentId,parentNodeId){
    var that = this;
    return new Promise(function(resolve,reject){
      var rootNode = Scrap.getRootNode();
      var rootNodeContent = rootNode.getContent().trim().replace("Explicate Problem for ","").trim();
      var parentNode = Scrap.getNodeById(parentNodeId);
      var auxList = [{"nodeText":"Set Problem Statement","folderName":rootNodeContent+".problem statement"},
      {"nodeText":"Ascertain Consequences","folderName":rootNodeContent+".consequences"},
      {"nodeText":"Ascertain Causes","folderName":rootNodeContent+".causes"},
      {"nodeText":"Justificatory Knowledge","folderName":rootNodeContent+".kernel theories"},
      {"nodeText":"Assess Problem as Solutions","folderName":rootNodeContent+".related work"}];
      if(DScaffolding.templateName == "Design Science"){
        auxList.push({"nodeText":"Describe Practice","folderName":rootNodeContent+".practice"})
      }
      else if(DScaffolding.templateName == "Explicate Problem"){
        auxList.push({"nodeText":"Describe Environment","folderName":rootNodeContent+".environment"})
      }
      else if(DScaffolding.templateName == "Explicate Problem New"){
        auxList.push({"nodeText":"Describe Context","folderName":rootNodeContent+".context"})
      }
      var foundCont;
      for(var i=0;i<auxList.length;i++){
        var cont = Scrap.getNodesWithText(auxList[i].nodeText);
        if(cont==null||cont.length==0) continue;
        for(var j=0;j<cont.length;j++){
          if(cont[j].id==parentNode.id||parentNode.isDescendant(cont[j])){
            foundCont = auxList[i];
            break;
          }
        }
        if(foundCont!=null) break;
      }
      if(foundCont!=null){
        Mendeley.createSubfolder(rootNodeContent,foundCont.folderName).then(function(folderId){
          if(folderId!=null){
            Mendeley.addDocumentToFolder(documentId,folderId).then(function(){
              resolve();
            });
          }
        })
      }
      else resolve() //reject();
    })
  }
  var getMapTemplate = function(){
    let that = this;
    return new Promise(function(resolve,reject){
      let template = that.getWhichTemplate();
      if(template!=null) that.templateName = template;
      resolve();
    /*Mindmeister.getMapInfo(Scrap.mapID).then(function(mapInfo){
      let tags = mapInfo.map.tags != null ? mapInfo.map.tags.split(" ") : [];
      if(tags.indexOf("DScaffolding")!=-1&&tags.indexOf("ExplicateProblemNew")!=-1){
        that.templateName = "Explicate Problem New";
      }
      else if(tags.indexOf("DScaffolding")!=-1&&tags.indexOf("RiskManagement")!=-1){
        that.templateName = "Risk Management";
      }
      else if(tags.indexOf("DScaffolding")!=-1&&tags.indexOf("DesignScience")!=-1){
        that.templateName = "Design Science";
      }
      else{
        let template = that.getWhichTemplate();
        if(template!=null) that.templateName = template;
      }
      resolve();
    })*/
    })
  }
  return {
    templateName: templateName,
    getWhichTemplate: getWhichTemplate,
    cloneNodeBis: cloneNodeBis,
    modifyTaskNode: modifyTaskNode,
    invertPoles: invertPoles,
    initTemplate: initTemplate,
    initLinkings: initLinkings,
    causeIsSync: causeIsSync,
    causeIsDeveloped: causeIsDeveloped,
    syncNodes: syncNodes,
    filterNodesTemplate: filterNodesTemplate,
    filterSubtree: filterSubtree,
    isActivated: isActivated,
    syncDesignTheory: syncDesignTheory,
    replicateSubtree: replicateSubtree,
    getSubtreeLeaves: getSubtreeLeaves,
    getTreatment: getTreatment,
    deactivateOldActiveChildren: deactivateOldActiveChildren,
    Nodes: Nodes,
    NodesNew: NodesNew,
    getHowProjection: getHowProjection,
    replicateSubtreeCons: replicateSubtreeCons,
    replicateSubtreeCauses: replicateSubtreeCauses,
    replicateSubtree: replicateSubtree,
    unInvertPoles: unInvertPoles,
    getPointToRemove: getPointToRemove,
    transformSubtree: transformSubtree,
    checkHumanRisk: checkHumanRisk,
    checkTechnicalRisk: checkTechnicalRisk,
    reloadDesignTheory: reloadDesignTheory,
    getActiveDescendants: getActiveDescendants,
    switchConsequencesIntoCausesNode: switchConsequencesIntoCausesNode,
    switchCausesIntoConsequencesNode: switchCausesIntoConsequencesNode,
    switchConsequencesIntoCauses: switchConsequencesIntoCauses,
    switchCausesIntoConsequences: switchCausesIntoConsequences,
    updateTemplate: updateTemplate,
    createPairedComparisonPoll: createPairedComparisonPoll,
    setAsProblemStatement: setAsProblemStatement,
    setAsProblemStatementNew: setAsProblemStatementNew,
    existsSimilarAnnotation: existsSimilarAnnotation,
    getAnnotations: getAnnotations,
    setAsProblemStatementDrag: setAsProblemStatementDrag,
    addImportProblemListener: addImportProblemListener,
    importProblemMap: importProblemMap,
    insertTaskNode: insertTaskNode,
    modifyTaskNode: modifyTaskNode,
    removeTaskNode: removeTaskNode,
    generateArticleMetadata: generateArticleMetadata,
    onTemplateNodeRemoved: onTemplateNodeRemoved,
    insertAnnotation: insertAnnotation,
    initTemplateDesignScience: initTemplateDesignScience,
    initTemplateExplicateProblemNew: initTemplateExplicateProblemNew,
    setAsProblemStatementDragExplicateProblem: setAsProblemStatementDragExplicateProblem,
    setAsProblemStatementDragExplicateProblemNew: setAsProblemStatementDragExplicateProblemNew,
    extractArticlesFromMap: extractArticlesFromMap,
    extractTermsFromMap: extractTermsFromMap,
    getProblemStatement: getProblemStatement,
    insertDocumentIntoMendeleyLibrary: insertDocumentIntoMendeleyLibrary,
    insertDocumentIntoFolder: insertDocumentIntoFolder,
    getMapTemplate: getMapTemplate,
    initNoTemplate: initNoTemplate,
    initTemplateRiskManagement: initTemplateRiskManagement,
    getDocumentMetadata: getDocumentMetadata
  }
})()

// ----------------HYPOTHESIS-------------------------------

var Hypothesis = (function(){
  let _enabled = false
  let setEnabled = function(enabled){
    this._enabled = enabled
  }
  let isEnabeld = function(){
    return this._enabled
  }
  let _hypothesisUser = null;
  let _devToken = null;
  var selectLastUpdateDate = function(mapId){
    var mapInfo = localStorage[mapId] != null ? JSON.parse(localStorage[mapId]) : {};
    var lastUpdateDate;
    if(mapInfo[LAST_UPDATE_DATE_HYPOTHESIS] == null){
      var d = new Date();
      d.setTime(0);
      lastUpdateDate = d.toISOString();
    }
    else{
      lastUpdateDate = mapInfo[LAST_UPDATE_DATE_HYPOTHESIS];
    }
    return lastUpdateDate;
  }
  var updateLastUpdateDate = function(lastUpdateDate,mapId){
    var mapInfo = localStorage[mapId] != null ? JSON.parse(localStorage[mapId]) : {};
    mapInfo[LAST_UPDATE_DATE_HYPOTHESIS] = lastUpdateDate;
    localStorage[mapId] = JSON.stringify(mapInfo);
  }
  var setUser = function(user){
    this._hypothesisUser = user;
  }
  var setDevAPIToken = function(token){
    this._devToken = token;
  }
  var updateAnnotation = function(annotationId,annotationParams){
    let that = this
    return new Promise(function (resolve,reject){
      var req = new XMLHttpRequest();
      req.open("PUT","https://hypothes.is/api/annotations/"+annotationId,true);
      req.setRequestHeader("Authorization","Bearer "+that._devToken);
      req.setRequestHeader("Content-Type","application/json");
      var data = {};
      if(annotationParams.tag!=null){
        data["tags"] = [annotationParams.tag];
      }
      req.onload = function(){
        resolve();
      }
      req.send(JSON.stringify(data));
    })
  }
  var createGroup = function(group){
    let that = this
    return new Promise(function(resolve,reject){
      var opts = {
        method: "GET",
        url: "https://hypothes.is/groups/new",
        headers: {
          'Authorization': "Bearer "+that._devToken
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
  var updateGroupIdName = function(groupId,newGroup){
    let that = this
    return new Promise(function(resolve,reject){
      var opts = {
        method: "GET",
        url: "https://hypothes.is/groups/"+groupId+"/edit",
        headers: {
          'Authorization': "Bearer "+that._devToken
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

`+newGroup+`
-----------------------------sep
Content-Disposition: form-data; name="description"


-----------------------------sep
Content-Disposition: form-data; name="submit"

submit
-----------------------------sep--
`
          var req = new XMLHttpRequest();
          req.open("POST","https://hypothes.is/groups/"+groupId+"/edit",true);
          req.setRequestHeader("Content-Type","multipart/form-data; boundary=---------------------------sep");
          req.onload = function(){
            resolve();
          }
          req.send(data);
        }
        else{
          // TO DO
        }
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
          'Authorization': "Bearer "+that._devToken
        }
      }
      makeRequest(opts).then(function (response){
        var ret = JSON.parse(response.responseText);
        var groupList = ret.groups;
        var g = groupList.find((el) => {return el.name == group});
        if(g!=null) resolve(g.id);
        /*else that.createGroup(group).then(function(groupId){
          resolve(groupId)
        });*/
        else resolve(null);
      });
    })
  }
  var updateGroupName = function(oldGroup,newGroup){
    var that = this;
    return new Promise(function(resolve,reject){
      that.getGroupId(oldGroup).then(function(groupId){
        if(groupId==null) resolve();
        else that.updateGroupIdName(groupId,newGroup).then(function(){
          resolve();
        })
      })
    })
  }
  var getAnnotationsByGroup2 = function(group,page){
    var that = this;
    var lastUpdateDate = that.selectLastUpdateDate(Scrap.mapID)!=null ? new Date(that.selectLastUpdateDate(Scrap.mapID)) : new Date(0);
    return new Promise(function (resolve, reject){
      var item = {
        user: that._hypothesisUser,
        limit: 200,
        group: group
      }
      if(page!=null){
        item["offset"] = 200*page;
      }
      var opts = {
        method: "GET",
        url: "https://hypothes.is/api/search",
        headers: {
          'Authorization': "Bearer "+that._devToken
        },
        params: item
      }
      makeRequest(opts).then(function (response){
        var annotationList = [];
        var ret = JSON.parse(response.responseText);
        var list = ret.rows;
        var next = true;
        for(var i=0;i<list.length;i++){
          var date = new Date(list[i].updated);
          if(date>lastUpdateDate){
            var tagFound = false;
            var insertionPoint;
            for(var j=0;j<list[i].tags.length;j++){
              var purpose = PurposeManager.getPurpose(null,null,list[i].tags[j].replace("Purpose:","").trim());
              if(purpose!=null){
                tagFound = true;
                insertionPoint = purpose.insertionPoint;
                break;
              }
            }
            if(tagFound&&insertionPoint!=null){
              var annotation = {
                id: list[i].id,
                link : list[i].uri,
                insertionPoint: insertionPoint
              }
              if(list[i].text!=null) annotation.note = list[i].text;
              if(list[i].target!=null&&list[i].target[0].selector!=null){
                for(var j=0;j<list[i].target[0].selector.length;j++){
                  if(list[i].target[0].selector[j].type == "TextQuoteSelector" && list[i].target[0].selector[j].exact != null){
                    var lineLength = 30;
                    var lagText = "";
                    var finish = false;
                    var auxText = list[i].target[0].selector[j].exact;
                    while(!finish){
                      if(lagText!="") lagText += "\n";
                      if(auxText.length<=lineLength){
                        lagText += auxText;
                        finish = true;
                      }
                      else{
                        var line = auxText.substring(0,lineLength);
                        var auxText2 = auxText.substring(lineLength);
                        for(var k=0;k<auxText2.length;k++){
                          var separators = [".",",",";",":","?","!"];
                          if(k==auxText2.length-1){
                            finish = true;
                          }
                          if(auxText2.charAt(k)==" "){
                            break;
                          }
                          line += auxText2.charAt(k);
                          if(separators.indexOf(auxText2.charAt(k))!=-1){
                            break;
                          }
                        }
                        lagText += line;
                        auxText = auxText.substring(line.length);
                      }
                    }
                    annotation.text = lagText;
                  }
                }
                if(annotation.text!=null) annotationList.push(annotation);
              }
            }
            else {
              //console.log("tag not found for annotation -> ",list[i]);
            }
          }
          else{
            //console.log("annotation made after the last update -> ",list[i],lastUpdateDate.toString());
            next = false;
            break;
          }
        }
        if(list.length==200&&((page==null&&ret.total>200)||(ret.total>(page+1)*200))&&next){
          var nextPage = page!=null ? page+1 : 1;
          that.getAnnotationsByGroup2(group,nextPage).then(function(annotations){
            annotationList = annotationList.concat(annotations);
            resolve(annotationList);
          })
        }
        else{
          resolve(annotationList);
        }
      });
    });
  }
  var getAnnotationsByGroup = function(group){
    var that = this;
    return new Promise(function (resolve, reject){
      that.getGroupId(group).then(function(groupId){
        if(groupId!=null){
          that.getAnnotationsByGroup2(groupId).then(function(annotationList){
            resolve(annotationList);
          })
        }
        else{
          resolve([]);
        }
      })
    });
  }
  var removeAnnotationTag = function(group,tag){
    var that = this;
    return new Promise(function(resolve,reject){
      that.getGroupId(group).then(function(groupId){
        that.getAnnotationsByGroupTag(groupId,tag).then(function(annotationList){
          var annotation = annotationList.find((el) => {return el.uri == "https://*/*"});
          if(annotation!=null){
            var opts = {
              method: "DELETE",
              url: "https://hypothes.is/api/annotations/"+annotation.id,
              headers: {
                'Authorization': "Bearer "+that._devToken
              }
            }
            makeRequest(opts).then(function (response){
              // MANAGE ERRORS
              resolve();
            });
          }
          else resolve();
        })
      })
    })
  }
  var getAnnotationsByGroupTag = function(group,tag,page){
    var that = this;
    return new Promise(function (resolve, reject){
      var item = {
        user: that._hypothesisUser,
        limit: 200,
        tag: tag,
        group: group
      }
      if(page!=null){
        item["offset"] = 200*page;
      }
      var opts = {
        method: "GET",
        url: "https://hypothes.is/api/search",
        headers: {
          'Authorization': "Bearer "+that._devToken
        },
        params: item
      }
      makeRequest(opts).then(function (response){
        var annotationList = [];
        var ret = JSON.parse(response.responseText);
        var annotationList = annotationList.concat(ret.rows);
        if(ret.rows.length==200&&((page==null&&ret.total>200)||(ret.total>(page+1)*200))){
          var nextPage = page!=null ? page+1 : 1;
          that.getAnnotationsByGroupTag(group,tag,nextPage).then(function(annotations){
            annotationList = annotationList.concat(annotations);
            resolve(annotationList);
          })
        }
        else{
          resolve(annotationList);
        }
      });
    });
  }
  var insertAnnotationGroupIdTagColor = function(groupId,tag,color){
    let that = this
    return new Promise(function(resolve,reject){
      var item = {
        group: groupId,
        tags: [tag],
        uri: "https://*/*",
        permissions: {
          read: ['group:'+groupId]
        }
      }
      if(color!=null) item["text"] =  "color: "+color;
      /*var opts = {
        method: "POST",
        url: "https://hypothes.is/api/annotations",
        headers: {
          'Authorization': "Bearer "+that._devToken,
          'Content-Type': "application/json"
        },
        params: item
      }*/
      var req = new XMLHttpRequest();
      req.open("POST","https://hypothes.is/api/annotations",true);
      req.setRequestHeader("Content-Type","application/json");
      req.setRequestHeader("Authorization","Bearer "+that._devToken);
      req.onload = function(){
        resolve();
      }
      req.send(JSON.stringify(item));
    })
  }
  var insertAnnotationGroupTagColor = function(group,tag,color){
    var that = this;
    return new Promise(function(resolve,reject){
      that.getGroupId(group).then(function(groupId){
        that.insertAnnotationGroupIdTagColor(groupId,tag,color).then(function(){
          resolve();
        });
        /*console.log(groupId);
        if(groupId==null){
          console.log("create group");
          that.createGroup(group).then(function(gId){
            console.log(gId);
            return that.insertAnnotationGroupIdTag(gId,tag);
          })
        }
        else{
          return that.insertAnnotationGroupIdTag(groupId,tag);
        }*/
      })
    })
  }
  var updateAnnotationsGroupTag = function(group,oldTag,newTag){
    var that = this;
    return new Promise(function(resolve,reject){
      that.getGroupId(group).then(function(groupId){
        that.getAnnotationsByGroupTag(groupId,oldTag).then(function(annotationList){
          var pL = [];
          for(var i=0;i<annotationList.length;i++){
            var p = new Promise(function(res,rej){
              var newTags = JSON.parse(JSON.stringify(annotationList[i].tags));
              newTags[newTags.indexOf(oldTag)] = newTag;
              var item = {
                "group": annotationList[i].group,
                "permissions": annotationList[i].permissions,
                "references": annotationList[i].references,
                "target": annotationList[i].target,
                "text": annotationList[i].text,
                "tags": newTags,
                "uri": annotationList[i].uri
              }
              var req = new XMLHttpRequest();
              req.open("PATCH","https://hypothes.is/api/annotations/"+annotationList[i].id,true);
              req.setRequestHeader("Content-Type","application/json");
              req.setRequestHeader("Authorization","Bearer "+that._devToken);
              req.onload = function(){
                res();
              }
              req.send(JSON.stringify(item));
            })
            pL.push(p);
          }
          Promise.all(pL).then(function(){
            resolve();
          })
        })
      })
    })
  }
  return {
    isEnabled: isEnabeld,
    setEnabled: setEnabled,
    setUser : setUser,
    setDevAPIToken : setDevAPIToken,
    updateLastUpdateDate: updateLastUpdateDate,
    selectLastUpdateDate: selectLastUpdateDate,
    updateAnnotation: updateAnnotation,
    createGroup: createGroup,
    updateGroupIdName: updateGroupIdName,
    getGroupId: getGroupId,
    updateGroupName: updateGroupName,
    getAnnotationsByGroup: getAnnotationsByGroup,
    getAnnotationsByGroup2: getAnnotationsByGroup2,
    removeAnnotationTag: removeAnnotationTag,
    getAnnotationsByGroupTag: getAnnotationsByGroupTag,
    insertAnnotationGroupIdTagColor: insertAnnotationGroupIdTagColor,
    insertAnnotationGroupTagColor: insertAnnotationGroupTagColor,
    updateAnnotationsGroupTag: updateAnnotationsGroupTag
  }
})()

// ----------------ARTICLE SUGGESTION-----------------------

var ArticleSuggestion = (function(){
  let _enabled = false
  let setEnabled = function(enabled){
    this._enabled = enabled
  }
  let isEnabeld = function(){
    return this._enabled
  }
  var suggestedArticles = [];
  var articlesToSuggest = [];
  var nextQueries = [];
  var finishedQueries = [];
  var mapArticles = [];
  var mapTerms = [];
  var citeSuggestionsEnabled;
  var relatedSuggestionsEnabled;
  var termSuggestionsEnabled;
  var suggestionFrequency;
  var suggestionCount;
  var problemStatement;
  var lastSuggestion;
  var mapID;
  var mendeleyEnabled;
  var queryGoogleScholar = function(url){
    return new Promise(function (resolve, reject){
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function(){
        if(xhr.readyState == XMLHttpRequest.DONE){
          if(xhr.status==200){
            var auxDiv = document.createElement("div");
            auxDiv.innerHTML = xhr.responseText;
            var articleList = [];
            var iterator = document.evaluate("//div[@id='gs_ccl']//div[@class='gs_r']",auxDiv,null,XPathResult.UNORDERED_NODE_ITERATOR_TYPE,null);
            try{
              var thisNode = iterator.iterateNext();
              while(thisNode){
                var article = {};
                if(thisNode.getElementsByClassName("gs_a").length == 0){
                  thisNode = iterator.iterateNext();
                  continue;
                }
                // scraping
                article["link"] = thisNode.getElementsByClassName("gs_rt")[0].getElementsByTagName("a").length > 0 ? thisNode.getElementsByClassName("gs_rt")[0].getElementsByTagName("a")[0].href : null;
                article["title"] = thisNode.getElementsByClassName("gs_rt")[0].textContent.replace(/\[[A-Z]+\]\s?/g,"");
                var authorsYear = thisNode.getElementsByClassName("gs_a").length > 0 ? thisNode.getElementsByClassName("gs_a")[0].textContent : "";
                article["authors"] = authorsYear.split("-")[0].trim();
                article["publisher"] = authorsYear.split("-").length > 2 ? authorsYear.split("-")[2].trim() : null;
                var sourceYear = authorsYear.split("-")[1].trim();
                article["source"] = sourceYear.split(",").length == 2 ? sourceYear.split(",")[0].trim() : null;
                article["year"] = sourceYear.split(",").length == 2 ? sourceYear.split(",")[1].trim() : null;
                article["abstract"] = thisNode.getElementsByClassName("gs_rs").length > 0 ? thisNode.getElementsByClassName("gs_rs")[0].textContent : "";
                var citeCont = 0, citeContNode;
                if((thisNode.getElementsByClassName("gs_ri")[0].getElementsByClassName("gs_fl").length > 0)&&(thisNode.getElementsByClassName("gs_ri")[0].getElementsByClassName("gs_fl")[0].getElementsByTagName("a")[0].href.indexOf("/scholar?cites=")!=-1)){
                  citeContNode = thisNode.getElementsByClassName("gs_ri")[0].getElementsByClassName("gs_fl")[0].getElementsByTagName("a")[0];
                  citeCont = citeContNode.textContent.match(/\d+/)[0];
                }
                article["citesCount"] = citeCont;
                if(parseInt(citeCont) > 0){
                  article["getCitesLink"] = "https://scholar.google.com/"+citeContNode.href.replace("https://www.mindmeister.com/","");
                  article["getRelatedArticlesLink"] = "https://scholar.google.com/"+thisNode.getElementsByClassName("gs_ri")[0].getElementsByClassName("gs_fl")[0].getElementsByTagName("a")[1].href.replace("https://www.mindmeister.com/","");
                }
                else{
                  article["getRelatedArticlesLink"] = "https://scholar.google.com/"+thisNode.getElementsByClassName("gs_ri")[0].getElementsByClassName("gs_fl")[0].getElementsByTagName("a")[0].href.replace("https://www.mindmeister.com/","");
                }
                if(thisNode.getElementsByClassName("gs_ggs").length > 0){
                  if((thisNode.getElementsByClassName("gs_ctg2").length > 0)&&(thisNode.getElementsByClassName("gs_ctg2")[0].textContent == "[PDF]")){
                    if((thisNode.getElementsByClassName("gs_ggsd").length > 0)&&(thisNode.getElementsByClassName("gs_ggsd")[0].getElementsByTagName("a").length>0)){
                      article["pdfurl"] = thisNode.getElementsByClassName("gs_ggsd")[0].getElementsByTagName("a")[0].href.replace("https://www.mindmeister.com/","");
                    }
                  }
                }
                articleList.push(article);
                thisNode = iterator.iterateNext();
              }
              var nextPageURL = null;
              var lag = auxDiv.getElementsByClassName("gs_ico_nav_next");
              if(lag!=null&&lag.length>0){
                if(lag[0].parentNode.tagName=="A"&&lag[0].parentNode.getAttribute("href")!=null){
                  nextPageURL = lag[0].parentNode.getAttribute("href");
                }
              }
              resolve({articles:articleList,nextPage:nextPageURL});
            }
            catch(e){
              console.log("error");
            }
          }
          else{
            console.log(xhr.status+" error code returned");
            return null;
          }
        }
      }
      xhr.open("GET", url, true);
      xhr.send();
    })
  }
  var queryScopus = function(title){
    // http://api.elsevier.com/content/search/scopus?apiKey=043d0e2a1369d258b9b2c8a885322a52&view=COMPLETE&query=title("Applying design science research for enterprise architecture business value assessments")
  }
  var getGoogleScholarQueryURL = function(reason,key,page){
    return new Promise(function(resolve,reject){
      if(reason=="TERM_SEARCH"){
        var url = "https://scholar.google.com/scholar?btnG=&as_sdt=1,5&as_vis=1&q=" + problemStatement + " " + key;
        resolve(url);
      }
      else if(reason=="CITATION"||reason=="RELATED"){
        var url = "https://scholar.google.com/scholar?btnG=&as_sdt=1,5&as_vis=1&q=" + key;
        queryGoogleScholar(url).then(function(res){
          if(res.articles.length==1){
            if(reason=="RELATED"){
              if(res.articles[0].getCitesLink!=null) nextQueries.push({url:res.articles[0].getCitesLink,why:{reason:"CITATION",key:key}});
              else finishedQueries.push({reason:"CITATION",key:key});
              if(res.articles[0].getRelatedArticlesLink!=null){
                resolve(res.articles[0].getRelatedArticlesLink);
                return;
              }
              else finishedQueries.push({reason:"RELATED",key:key});
            }
            else if(reason=="CITATION"&&res.articles[0].getCitesLink!=null){
              if(res.articles[0].getRelatedArticlesLink!=null) nextQueries.push({url:res.articles[0].getRelatedArticlesLink,why:{reason:"RELATED",key:key}});
              else finishedQueries.push({reason:"RELATED",key:key});
              if(res.articles[0].getCitesLink!=null){
                resolve(res.articles[0].getCitesLink);
                return;
              }
              else finishedQueries.push({reason:"CITATION",key:key});
            }
          }
          resolve(null);
        })
      }
    })
  }
  var manageQuery = function(reason,key){
    return new Promise(function(resolve,reject){
      for(var i=0;i<articlesToSuggest.length;i++){
        if(articlesToSuggest[i].why.reason==reason&&articlesToSuggest[i].why.key==key){
          var art = JSON.parse(JSON.stringify(articlesToSuggest[i]));
          articlesToSuggest.splice(i,1);
          suggestedArticles.push({
            title: art.title,
            why: art.why
          })
          resolve(art);
          return;
        }
      }
      var manageResults = function(result){
        var articles = result.articles;
        if(result.nextPage!=null){
          nextQueries.push({url:result.nextPage,why:{reason:reason,key:key}});
        }
        else{
          finishedQueries.push({reason:reason,key:key});
        }
        var a = null;
        for(var j=0;j<articles.length;j++){
          if(a==null){
            if(articlesToSuggest.find((el) => {return el.title==articles[j].title})==null&&Utils.similarity(articles[j].title.trim(),key.trim())<0.95){
              var aux = JSON.parse(JSON.stringify(articles[j]));
              aux["why"] = {reason:reason,key:key};
              a = aux;
              suggestedArticles.push({title:articles[j].title,why:{reason:reason,key:key}});
            }
          }
          else{
            if(articlesToSuggest.find((el) => {return el.title==articles[j].title})==null&&Utils.similarity(articles[j].title.trim(),key.trim())<0.95){
              var aux = JSON.parse(JSON.stringify(articles[j]));
              aux["why"] = {reason:reason,key:key};
              articlesToSuggest.push(aux);
            }
          }
        }
        resolve(a);
      }

      var f = false;
      for(var i=0;i<nextQueries.length;i++){
        if(nextQueries[i].why.reason==reason&&nextQueries[i].why.key==key){
          queryGoogleScholar(nextQueries[i].url).then(manageResults);
          f = true;
          //return; // ?
        }
      }
      if(!f) getGoogleScholarQueryURL(reason,key).then(function(url){
        if(url==null){
          resolve(null);
        }
        else{
          queryGoogleScholar(url).then(manageResults);
        }
      });
    })
  }
  var getSuggestions = function(cont){
    return new Promise(function(resolve,reject){
      /*var articleList = [
        {title:"Cosmochemistry of the rare earth elements: meteorite studies.",
        authors:"WV Boynton",
        source:"Rare earth element geochemistry",
        year:"1983",
        publisher:"arizona.pure.elsevier.com",
        link:"https://arizona.pure.elsevier.com/en/publications/cosmochemistry-of-the-rare-earth-elements-meteorite-studies",
        abstract: "Abstract After a discussion on the condensation of elements from the solar nebula, the REE abundances in Ca, Al-rich inclusions in carbonaceous chondrites are described and  interpreted. The normalization values for REE in chondrites are examined at some length",
        why:{
          reason: "CITATION",
          key: "Engaged problem formulation in IS research"
        }
        },
        {title:"Cosmochemistry of the rare earth elements: meteorite studies.",
        authors:"WV Boynton",
        source:"Rare earth element geochemistry",
        year:"1983",
        publisher:"arizona.pure.elsevier.com",
        pdfurl:"http://www.sciencedirect.com/science/article/pii/0009254194001404",
        link:"https://arizona.pure.elsevier.com/en/publications/cosmochemistry-of-the-rare-earth-elements-meteorite-studies",
        abstract: "Abstract After a discussion on the condensation of elements from the solar nebula, the REE abundances in Ca, Al-rich inclusions in carbonaceous chondrites are described and  interpreted. The normalization values for REE in chondrites are examined at some length",
        why:{
          reason: "RELATED",
          key: "Engaged problem formulation in IS research"
        }
        },
        {title:"MEGA2: molecular evolutionary genetics analysis software",
        authors:"WV Boynton",
        source:"Rare earth element geochemistry",
        year:"1983",
        publisher:"arizona.pure.elsevier.com",
        pdfurl:"https://academic.oup.com/bioinformatics/article-pdf/17/12/1244/606679/171244.pdf",
        link:"https://academic.oup.com/bioinformatics/article-pdf/17/12/1244/606679/171244.pdf",
        abstract: "Abstract After a discussion on the condensation of elements from the solar nebula, the REE abundances in Ca, Al-rich inclusions in carbonaceous chondrites are described and  interpreted. The normalization values for REE in chondrites are examined at some length",
        why:{
          reason: "TERM_SEARCH",
          key: "Engaged problem formulation in IS research"
        }
        }
      ]
      resolve(articleList);*/
      var countReasonAppearances = function(currentValue){
        var n=0;
        for(var i=0;i<suggestedArticles.length;i++){
          if(suggestedArticles[i].why.reason==currentValue) n++;
        }
        return n;
      }
      var countAppearances = function(currentValue){
        var n=0;
        var reason = this !== undefined ? this : null;
        for(var i=0;i<suggestedArticles.length;i++){
          if(reason!=null&&suggestedArticles[i].why.reason==reason&&suggestedArticles[i].why.key==currentValue) n++;
          else if(reason==null&&suggestedArticles[i].why.key==currentValue) n++;
        }
        return n;
      }
      var existsToSuggest = function(reason,key){
        for(var i=0;i<articlesToSuggest.length;i++){
          if(articlesToSuggest[i].why.reason==reason&&articlesToSuggest[i].why.key==key) return true;
        }
        return false;
      }
      var getNextElement = function(excludeReasons){
        var aux = [];
        var er = excludeReasons != null ? excludeReasons : [];
        if(termSuggestionsEnabled&&!er.includes("TERM_SEARCH")) aux.push("TERM_SEARCH");
        if(citeSuggestionsEnabled&&!er.includes("CITATION")) aux.push("CITATION");
        if(relatedSuggestionsEnabled&&!er.includes("RELATED")) aux.push("RELATED");
        if(aux.length==0) return null;
        var reasonCount = aux.map(countReasonAppearances);
        var min = Math.min.apply(null,reasonCount);
        var minReason = aux[reasonCount.indexOf(min)];
        if(minReason=="TERM_SEARCH"){
          var mapTermsAux = JSON.parse(JSON.stringify(mapTerms));
          while(mapTermsAux.length>0){
            var mapTermsCount = mapTermsAux.map(countAppearances,"TERM_SEARCH");
            var mt = Math.min.apply(null,mapTermsCount);
            if(mt!=null){
              var key = mapTermsAux[mapTermsCount.indexOf(mt)];
              if(finishedQueries.find((el) => {return el.reason == "TERM_SEARCH" && el.key==key})!=null&&!existsToSuggest(minReason,key)){
                mapTermsAux.splice(mapTermsCount.indexOf(mt),1);
              }
              else{
                return {
                  reason: "TERM_SEARCH",
                  key: mapTermsAux[mapTermsCount.indexOf(mt)]
                }
              }
            }
            else{
              return getNextElement(er.concat(["TERM_SEARCH"]));
            }
          }
          return getNextElement(er.concat(["TERM_SEARCH"]));
        }
        else if(minReason=="CITATION"||minReason=="RELATED"){
          var mapArticlesAux = JSON.parse(JSON.stringify(mapArticles));
          while(mapArticlesAux.length>0){
            var mapArticlesCount = mapArticlesAux.map(countAppearances,minReason);
            var mapArticlesCountBis = mapArticlesAux.map(countAppearances);
            var minArticle = Math.min.apply(null,mapArticlesCount);
            if(minArticle!=null){
              var minArticlePos = mapArticlesCount.indexOf(minArticle);
              var minArticleTotal = mapArticlesCountBis[minArticlePos];
              for(var j=minArticlePos+1;j<mapArticlesCount.length;j++){
                if(mapArticlesCount[j]==minArticle&&mapArticlesCountBis[j]<minArticleTotal){
                  minArticleTotal = mapArticlesCountBis[j];
                  minArticlePos = j;
                }
              }
              var key = mapArticlesAux[minArticlePos];
              if(finishedQueries.find((el) => {return el.reason == minReason && el.key==key})!=null&&!existsToSuggest(minReason,key)){
                mapArticlesAux.splice(minArticlePos,1);
              }
              else{
                return {
                  reason: minReason,
                  key: mapArticlesAux[minArticlePos]
                }
              }
            }
            else {
              return getNextElement(er.concat([minReason]));
            }
          }
          return getNextElement(er.concat([minReason]));
        }
        return null;
      }

      var auxArray = [];
      var getResult = function(n,arr){
        return new Promise(function(resolve,reject){
          var elem = getNextElement();
          if(elem!=null) manageQuery(elem.reason,elem.key).then(function(article){
            if(article==null){
              finishedQueries.push({reason:elem.reason,key:elem.key});
              getResult(n,arr).then(function(art){
                resolve(art);
              });
            }
            else{
              var newArticles = arr.concat([article]);
              if(n>=cont-1){
                resolve(newArticles);
              }
              else{
                getResult(n+1,newArticles).then(function(art){
                  resolve(art);
                });
              }
            }
          })
          else{
            resolve(arr);
          }
        })
      }
      getResult(0,auxArray).then(function(articles){
        // var articleSuggestionData = localStorage["ARTICLE_SUGGESTION_DATA"] != null ? JSON.parse(localStorage["ARTICLE_SUGGESTION_DATA"]) : {};
        // if(articleSuggestionData[mapID]==null) articleSuggestionData[mapID] = {};
        // articleSuggestionData[mapID]["suggestedArticles"] = suggestedArticles;
        // articleSuggestionData[mapID]["articlesToSuggest"] = articlesToSuggest;
        // articleSuggestionData[mapID]["nextQueries"] = nextQueries;
        // articleSuggestionData[mapID]["finishedQueries"] = finishedQueries;
        // localStorage["ARTICLE_SUGGESTION_DATA"] = JSON.stringify(articleSuggestionData);
        // console.log("update done");
        resolve(articles);
        /*chrome.storage.sync.get(["ARTICLE_SUGGESTION_DATA"], function(options){
          var articleSuggestionData = options["ARTICLE_SUGGESTION_DATA"] != null ? options["ARTICLE_SUGGESTION_DATA"] : {};
          articleSuggestionData[mapID] = {
            "suggestedArticles": suggestedArticles,
            "articlesToSuggest": articlesToSuggest,
            "nextQueries": nextQueries
          }
          chrome.storage.sync.set({"ARTICLE_SUGGESTION_DATA": articleSuggestionData},function(){
            console.log("update done");
          })
        });*/

      });
    })
  }
  var init = function(initData){
    mapID = initData.mapID;
    mendeleyEnabled = initData.mendeleyEnabled;
    problemStatement = initData.problemStatement;
    mapTerms = initData.mapTerms;
    mapArticles = initData.mapArticles;
    var articleSuggestionData = localStorage["ARTICLE_SUGGESTION_DATA"] != null ? JSON.parse(localStorage["ARTICLE_SUGGESTION_DATA"]) : null;
    if(articleSuggestionData!=null&&articleSuggestionData[mapID]!=null){
      suggestedArticles = articleSuggestionData[mapID]["suggestedArticles"] != null ? articleSuggestionData[mapID]["suggestedArticles"] : [];
      articlesToSuggest = articleSuggestionData[mapID]["articlesToSuggest"] != null ? articleSuggestionData[mapID]["articlesToSuggest"] : [];
      nextQueries = articleSuggestionData[mapID]["nextQueries"] != null ? articleSuggestionData[mapID]["nextQueries"] : [];
      finishedQueries = articleSuggestionData[mapID]["finishedQueries"] != null ? articleSuggestionData[mapID]["finishedQueries"] : [];
      lastSuggestion = articleSuggestionData[mapID]["lastSuggestion"] != null ? new Date(articleSuggestionData[mapID]["lastSuggestion"]) : new Date(0);
    }
    else{
      suggestedArticles = [];
      articlesToSuggest = [];
      nextQueries = [];
      finishedQueries = [];
      lastSuggestion = new Date(0);
    }
    chrome.storage.sync.get(["ARTICLE_SUGGESTION_CONF"], function(options){
      var aux = options["ARTICLE_SUGGESTION_CONF"];
      citeSuggestionsEnabled = aux["citeSuggestionsEnabled"] != null ? aux["citeSuggestionsEnabled"] : true;
      relatedSuggestionsEnabled = aux["relatedSuggestionsEnabled"] != null ? aux["relatedSuggestionsEnabled"] : true;
      termSuggestionsEnabled = aux["termSuggestionsEnabled"] != null ? aux["termSuggestionsEnabled"] : true;
      suggestionFrequency = aux["suggestionFrequency"] != null ? aux["suggestionFrequency"] : 7;
      suggestionCount = aux["suggestionCount"] != null ? aux["suggestionCount"] : 3;
      if(Date.now()-lastSuggestion.getTime()>suggestionFrequency*24*3600*1000){
        ArticleSuggestion.getSuggestions(suggestionCount).then(function(articleSuggestions){
          ArticleSuggestion.showArticles(articleSuggestions);
          var articleSuggestionData = localStorage["ARTICLE_SUGGESTION_DATA"] != null ? JSON.parse(localStorage["ARTICLE_SUGGESTION_DATA"]) : {};
          if(articleSuggestionData[mapID]==null) articleSuggestionData[mapID] = {};
          articleSuggestionData[mapID]["suggestedArticles"] = suggestedArticles;
          articleSuggestionData[mapID]["articlesToSuggest"] = articlesToSuggest;
          articleSuggestionData[mapID]["nextQueries"] = nextQueries;
          articleSuggestionData[mapID]["finishedQueries"] = finishedQueries;
          articleSuggestionData[mapID]["lastSuggestion"] = Date.now();
          localStorage["ARTICLE_SUGGESTION_DATA"] = JSON.stringify(articleSuggestionData);
        })
      }
    });
  }
  var showArticles = function(articleList){
    var link = document.createElement('link');
    link.rel = 'import';
    link.href = chrome.extension.getURL("pages/articleSuggestion.html");
    link.onload = function(e) {
      var template = this.import.querySelector("#recommendArticlesTemplate");
      var widgetClone = document.importNode(template.content,true);
      document.body.appendChild(widgetClone);

      var recommendedArticleTemplate = document.querySelector("#recommendedArticleTemlate");
      var aClone = document.importNode(recommendedArticleTemplate.content.querySelector(".recommendedArticle"),true);
      var recommendedArticleList = document.querySelector("#reccommendedArticlesList");
      for(var i=0;i<articleList.length;i++){
        var a = aClone.cloneNode(true);
        var reason = a.querySelector(".why .reason");
        if(articleList[i].why.reason=="CITATION") reason.appendChild(document.createTextNode("citing"));
        else if(articleList[i].why.reason=="RELATED") reason.appendChild(document.createTextNode("related to"));
        else if(articleList[i].why.reason=="TERM_SEARCH") reason.appendChild(document.createTextNode("related to"));
        a.querySelector(".why .key").appendChild(document.createTextNode(articleList[i].why.key));
        if(articleList[i].title!=null) a.querySelector(".title").appendChild(document.createTextNode(articleList[i].title));
        if(articleList[i].link!=null) a.querySelector(".title").setAttribute("href",articleList[i].link);
        if(articleList[i].authors!=null) a.querySelector(".articleInfo .authors").appendChild(document.createTextNode(articleList[i].authors));
        if(articleList[i].source!=null) a.querySelector(".articleInfo .source").appendChild(document.createTextNode(" - "+articleList[i].source));
        if(articleList[i].year!=null) a.querySelector(".articleInfo .year").appendChild(document.createTextNode("("+articleList[i].year+")"));
        if(articleList[i].abstract!=null) a.querySelector(".articleInfo .abstract").appendChild(document.createTextNode(articleList[i].abstract));
        if(mendeleyEnabled&&articleList[i].pdfurl!=null&&articleList[i].pdfurl.indexOf("http")!=-1){
          var addToMendeleyLibrary = a.querySelector(".addToMendeleyLibrary")
          addToMendeleyLibrary.style.display = "block";
          (function(article,elem){
            elem.addEventListener("click",function(e){
              DScaffolding.insertDocumentIntoMendeleyLibrary(article).then(function(){
                elem.className = elem.className.replace("addToMendeleyLibrary","addToMendeleyLibraryDone");
                var aux = elem.querySelector(".addToMendeleyImage");
                if(aux!=null){
                  aux.src = chrome.extension.getURL("images/tick.png");
                  aux.parentNode.style.border = "solid 1px #30b746";
                  aux.className = aux.className.replace("addToMendeleyImage","");
                }
                var aux = elem.querySelector(".addToMendeleySpan");
                if(aux!=null){
                  aux.innerHTML = "Added to library";
                  aux.style.color = "#30b746";
                }
              })
            });
          })(articleList[i],addToMendeleyLibrary);
        }
        recommendedArticleList.appendChild(a);
      }
    };
    document.head.appendChild(link);
  }
  return {
    queryGoogleScholar: queryGoogleScholar,
    getSuggestions: getSuggestions,
    showArticles: showArticles,
    init: init,
    setEnabled: setEnabled,
    isEnabeld: isEnabeld
  }
})()

// ----------------ASSISTANT--------------------------------

var Assistant = (function(){
  let _enabled = false
  let isEnabled = function(){
    return this._enabled
  }
  let setEnabled = function(enabled){
    this._enabled = enabled
  }
  var init = function(){
    var opts = {
      method: "GET",
      url: chrome.extension.getURL("pages/assistant.html")
    }
    makeRequest(opts).then(function(ret){
      var div = document.createElement("div");
      div.id = "dscaffoldingAssistant";
      div.innerHTML = ret.responseText;
      div.querySelector("#assistantBodyDSR img").src = chrome.extension.getURL("images/DSR.png");
      div.querySelector("#assistantCloseButton img").src = chrome.extension.getURL("images/closeIcon.png");
      div.querySelector("#assistantNextButton img").src = chrome.extension.getURL("images/nextButton.png");
      div.querySelector("#assistantPreviousButton img").src = chrome.extension.getURL("images/nextButton.png");
      div.querySelector("#assistantBodyProblemAnalysis img").src = chrome.extension.getURL("images/problemAnalysis.png");
      document.body.appendChild(div);
      var opts2 = {
        method: "GET",
        url: chrome.extension.getURL("scripts/assistant.js")
      }
      makeRequest(opts2).then(function(ret2){
        var s = document.createElement("script");
        s.innerHTML = "sideBar.hide(); "+ret2.responseText;
        s.id = "dscaffoldingAssistantScript";
        document.body.appendChild(s);
      })
    })
  }
  return {
    init: init,
    isEnabled: isEnabled,
    setEnabled: setEnabled
  }
})()

// ----------------FEEDBACK---------------------------------

var FeedbackManager = (function(){
  var spotlight = function(){
    var removeOverlay = function(e){
      e.preventDefault();
      e.stopPropagation();
      var el = document.getElementsByClassName("feedbackButtonSpotlight");
      for(var i=el.length-1;i>=0;i--){
        el[i].parentNode.removeChild(el[i]);
      }
    }

    var feedbackButton = document.getElementById("btn_feedbackDS");
    var pos = feedbackButton.getBoundingClientRect();
    var auxDiv = document.createElement("div");
    auxDiv.className = "feedbackButtonSpotlight";
    auxDiv.style.position = "fixed";
    auxDiv.style.zIndex = "1000";
    auxDiv.style.backgroundColor = "#99ccff";
    auxDiv.style.opacity = "0.6";
    auxDiv.style.top = "0px";
    auxDiv.style.left = "0px";
    auxDiv.style.width = "100%";
    auxDiv.style.height = pos.y-15+"px";
    auxDiv.addEventListener("click",removeOverlay,false);
    document.body.appendChild(auxDiv);
    var auxDiv2 = document.createElement("div");
    auxDiv2.className = "feedbackButtonSpotlight";
    auxDiv2.style.position = "fixed";
    auxDiv2.style.zIndex = "1000";
    auxDiv2.style.backgroundColor = "#99ccff";
    auxDiv2.style.opacity = "0.6";
    auxDiv2.style.top = pos.y-15+"px";
    auxDiv2.style.left = "0px";
    auxDiv2.style.width = pos.x-20+"px";
    auxDiv2.style.height = "500px";
    auxDiv2.addEventListener("click",removeOverlay,false);
    document.body.appendChild(auxDiv2);
    /*var img = document.createElement("img");
    img.src = chrome.extension.getURL("images/arrow.png");
    img.style.zIndex = "1002";
    img.style.position = "fixed";
    img.style.width = "200px";
    img.style.top = pos.y-100+"px";
    img.style.left = pos.x-100+"px";
    document.body.appendChild(img);*/
    /*var messageCont = document.createElement("div");
    messageCont.style.width = "300px";
    messageCont.style.height = "100px";
    messageCont.style.border = "2px solid #99ccff";
    messageCont.style.zIndex = "1001";
    messageCont.style.borderRadius = "10px 10px 10px 10px";
    messageCont.style.backgroundColor = "#fff";
    messageCont.style.padding = "10px";
    messageCont.style.color = "#003380";
    messageCont.style.position = "fixed";
    messageCont.style.top = pos.y-100+"px";
    messageCont.style.left = pos.x-280+"px";
    var message = document.createTextNode("We would appreciate your feedback");
    messageCont.appendChild(message);
    document.body.appendChild(messageCont);*/
    var message = document.createElement("img");
    message.className = "feedbackButtonSpotlight";
    message.src = chrome.extension.getURL("images/feedbackDialog.png");
    message.style.zIndex = "1001";
    message.style.position = "fixed";
    message.style.top = pos.y-150+"px";
    message.style.left = pos.x-320+"px";
    message.style.width = "300px";
    document.body.appendChild(message);
    var closeButton = document.createElement("img");
    closeButton.className = "feedbackButtonSpotlight";
    closeButton.id = "feedbackMessageCloseButton";
    closeButton.src = chrome.extension.getURL("images/closeIcon.png");
    closeButton.style.position = "fixed";
    closeButton.style.top = pos.y-142+"px";
    closeButton.style.left = pos.x-53+"px";
    closeButton.style.zIndex = "1002";
    closeButton.style.width = "16px";
    closeButton.style.opacity = "0.4";
    closeButton.addEventListener("click",removeOverlay,false);
    closeButton.addEventListener("mouseover",function(){
      var a = document.getElementById("feedbackMessageCloseButton");
      if(a==null) return;
      a.style.opacity = "1";
    },false);
    closeButton.addEventListener("mouseout",function(){
      var a = document.getElementById("feedbackMessageCloseButton");
      if(a==null) return;
      a.style.opacity = "0.4";
    },false);
    document.body.appendChild(closeButton);
  }
  var showFeedbackDialog = function(answerSubmitted){
    var url = answerSubmitted==true ? chrome.extension.getURL("pages/feedbackDialogPost.html") : chrome.extension.getURL("pages/feedbackDialog.html")
    var opts = {
      method: "GET",
      url: url
    }
    makeRequest(opts).then(function(ret){
      var div = document.createElement("div");
      div.id = "dscaffoldingFeedback";
      div.innerHTML = ret.responseText;
      div.querySelector("#feedbackCloseButton img").src = chrome.extension.getURL("images/closeIcon.png");
      document.body.appendChild(div);
      var opts2 = {
        method: "GET",
        url: chrome.extension.getURL("scripts/feedbackDialog.js")
      }
      makeRequest(opts2).then(function(ret2){
        var s = document.createElement("script");
        s.innerHTML = "sideBar.hide(); "+ret2.responseText;
        s.id = "dscaffoldingFeedbackScript";
        document.body.appendChild(s);
      })
    })
  }
  var init = function(){
    chrome.storage.sync.get(["FEEDBACK_MANAGER"],function(options){
      var feedbackManagerOptions = options["FEEDBACK_MANAGER"] != null ? options["FEEDBACK_MANAGER"] : {};
      var answerSubmitted = feedbackManagerOptions["answerSubmitted"] != null ? feedbackManagerOptions["answerSubmitted"] : false;
      insertFeedbackButton(answerSubmitted);
      if(feedbackManagerOptions["spotlightDone"]==null){
        spotlight();
        feedbackManagerOptions["spotlightDone"] = true;
        chrome.storage.sync.set({"FEEDBACK_MANAGER":feedbackManagerOptions});
      }
    })
  }
  var insertFeedbackButton = function(answerSubmitted){
    var auxElem = document.createElement("a");
    auxElem.id = "btn_feedbackDS";
    //auxElem.href = "mailto:oscar.diaz@ehu.eus,jeremias.perez@ehu.eus?subject=DScaffolding%20feedback";
    auxElem.href = "#";
    auxElem.className = "tooltip icon-png mr-25px rad-100%";
    auxElem.setAttribute("data-size","24");
    auxElem.addEventListener("click",function(){
      showFeedbackDialog(answerSubmitted);
    },false);
    var auxElem2 = document.createElement("div");
    auxElem2.className = "png-icon h-overflow w-32 h-32 h-cp";
    var img = document.createElement("img");
    img.src = chrome.extension.getURL("images/feedback.png");
    img.style.width = "32px";
    auxElem2.appendChild(img);
    auxElem.appendChild(auxElem2);
    document.getElementById("btn_toggleprint").parentNode.appendChild(auxElem);
  }
  return {
    init: init
  }
})()

  // --------------PURPOSE MANAGER--------------------------
  var PurposeManager = (function(){
    var possibleColors = ["dcffb0","bae2ff","d3c2ff","ffc4fb","ffb5b6","ffdeb4","dbdbdb"];
    var availableColors = ["dcffb0","bae2ff","d3c2ff","ffc4fb","ffb5b6","ffdeb4","dbdbdb"];
    var insertionPointLabels = ["Supporting Evidences?","Who else addresses it?","Justificatory Knowledge"];
    var purposeList = [];
    var enabledServices = [];
    var init = function(){
      chrome.storage.sync.get(["HYPOTHESIS_ENABLED", "MENDELEY_ENABLED"],function(options){
        var hypothesisEnabled = options["HYPOTHESIS_ENABLED"] != null ? options["HYPOTHESIS_ENABLED"] : false;
        var mendeleyEnabled = options["MENDELEY_ENABLED"] != null ? options["MENDELEY_ENABLED"] : false;
        if(hypothesisEnabled) enabledServices.push(HypothesisPurposeManager);
        if(mendeleyEnabled) enabledServices.push(MendeleyPurposeManager);
        loadMapPurposes();
      })
    }
    var loadMapPurposes = function(){
      for(var i=0;i<possibleColors.length;i++){
        var rgb = Utils.hexToRgb(possibleColors[i]);
        var nodes = Scrap.getNodesByBackgroundColor({red: rgb.r, green: rgb.g, blue: rgb.b});
        if(nodes==null)continue;
        for(var j=0;j<nodes.length;j++){
          var insertionPoint = [];
          for(var k=0;k<insertionPointLabels.length;k++){
            var nodeChild = nodes[j].getChildrenWithText(insertionPointLabels[k]);
            insertionPoint = insertionPoint.concat(nodeChild);
          }
          var isPurpose = insertionPoint.length > 0;
          if(isPurpose){
            loadPurpose(nodes[j].id,possibleColors[i],nodes[j].getContent(),insertionPoint[0].id);
            break;
          }
          else if(j==nodes.length-1){
            var purposeContent = nodes[j].getContent().replace(/\.\.\.$/g,"").trim();
            loadPurpose(nodes[j].id,possibleColors[i],purposeContent,nodes[j].id);
          }
        }
      }
      for(var i=0;i<enabledServices.length;i++){
        enabledServices[i].onMapPurposesLoaded(purposeList);
      }
    }
    var loadPurpose = function(nodeId,color,label,insertionPoint){
      availableColors.splice(availableColors.indexOf(color),1);
      purposeList.push({nodeId:nodeId,color:color,label:label,insertionPoint:insertionPoint});
    }
    var insertPurpose = function(nodeId,color,label,insertionPoint){
      availableColors.splice(availableColors.indexOf(color),1);
      purposeList.push({nodeId:nodeId,color:color,label:label,insertionPoint:insertionPoint});
      for(var i=0;i<enabledServices.length;i++){
        enabledServices[i].onPurposeInserted({mapName:Scrap.getRootNode().getContent(),nodeId:nodeId,color:color,label:label,insertionPoint:insertionPoint});
      }
    }
    var updatePurpose = function(nodeId,label){
      var p = purposeList.find((el) => {return el.nodeId==nodeId});
      if(p==null) return;
      var oldLabel = p["label"];
      p["label"] = label;
      for(var i=0;i<enabledServices.length;i++){
        enabledServices[i].onPurposeUpdated({mapId:Scrap.mapID,nodeId:nodeId,label:label,color:p.color,oldLabel:oldLabel,mapName:Scrap.getRootNode().getContent()});
      }
    }
    var removePurpose = function(nodeId,color){
      var p;
      if(nodeId!=null) p=purposeList.findIndex((el) => {return el.nodeId==nodeId});
      else if(color!=null) p=purposeList.findIndex((el) => {return el.color==color});
      if(p==null&&p==-1) return;
      availableColors.push(purposeList[p].color);
      var color = purposeList[p].color;
      var label = purposeList[p].label;
      purposeList.splice(p,1);
      for(var i=0;i<enabledServices.length;i++){
        enabledServices[i].onPurposeRemoved({mapId:Scrap.mapID,nodeId:nodeId,label:label,color:color,mapName:Scrap.getRootNode().getContent()});
      }
    }
    var getAvailableColor = function(){
      if(availableColors.length==0) return null;
      else return availableColors[0];
    }
    var getPurposes = function(){
      return purposeList;
    }
    var getPurpose = function(color,nodeId,label){
      var a;
      if(color!=null) a=purposeList.find((el) => {return el.color==color});
      else if(nodeId!=null) a=purposeList.find((el) => {return el.nodeId==nodeId});
      else if(label!=null) a=purposeList.find((el) => {return el.label==label});
      return a;
    }
    return{
      init: init,
      loadMapPurposes: loadMapPurposes,
      loadPurpose: loadPurpose,
      insertPurpose: insertPurpose,
      updatePurpose: updatePurpose,
      removePurpose: removePurpose,
      getAvailableColor: getAvailableColor,
      getPurposes: getPurposes,
      getPurpose: getPurpose
    }
  })()

// ----------------HYPOTHESIS PURPOSE MANAGER---------------
  var HypothesisPurposeManager = (function(){
    var readingPurposePrefix = "Purpose:";
    var colorPrefix = "color:";
    var purposeOpacity = "0.9";
    var mapNameToGroup = function(mapName){
      return mapName.replace("Explicate Problem for","").trim();
    }
    var onMapPurposesLoaded = function(purposeList){
      return;
    }
    var onPurposeInserted = function(purpose){
      let that = this
      Hypothesis.insertAnnotationGroupTagColor(mapNameToGroup(purpose.mapName),readingPurposePrefix+purpose.label.trim(),Utils.hexToCssRgba(purpose.color,that.purposeOpacity));
    }
    var onPurposeUpdated = function(purpose){
      Hypothesis.updateAnnotationsGroupTag(mapNameToGroup(purpose.mapName),readingPurposePrefix+purpose.oldLabel.trim(),readingPurposePrefix+purpose.label.trim());
    }
    var onPurposeRemoved = function(purpose){
      Hypothesis.removeAnnotationTag(mapNameToGroup(purpose.mapName),readingPurposePrefix+purpose.label.trim());
    }
    return{
      mapNameToGroup: mapNameToGroup,
      onMapPurposesLoaded: onMapPurposesLoaded,
      onPurposeInserted: onPurposeInserted,
      onPurposeUpdated: onPurposeUpdated,
      onPurposeRemoved: onPurposeRemoved
    }
  })()
// ----------------MENDELEY PURPOSE MANAGER-----------------
  var MendeleyPurposeManager = (function(){
    var onMapPurposesLoaded = function(purposeList){
      Palette.loadPurposes(purposeList);
    }
    var onPurposeInserted = function(purpose){
      Palette.insertPurpose(purpose);
    }
    var onPurposeUpdated = function(purpose){
      Palette.updatePurpose(purpose);
    }
    var onPurposeRemoved = function(purpose){
      Palette.removePurpose(purpose);
    }
    return{
      onMapPurposesLoaded: onMapPurposesLoaded,
      onPurposeInserted: onPurposeInserted,
      onPurposeUpdated: onPurposeUpdated,
      onPurposeRemoved: onPurposeRemoved
    }
  })()

//-----------------GITHUB-----------------------------------
  var Github = (function(){
    let _accessToken = null
    let _enabled = false
    let setAccessToken = function(token){
      this._accessToken = token
    }
    let getAccessToken = function(){
      return this._accessToken
    }
    let setEnabled = function(enabled){
      this._enabled = enabled
    }
    let isEnabled = function(){
      return this._enabled
    }
    var init = function(){
      let that = this
      // Compare: https://developer.github.com/v3/repos/#list-organization-repositories
      /*octokit.repos.getForOrg({
        org: 'octokit',
        type: 'public'
      }).then(({ data, headers, status }) => {
        // handle data
      })*/

      octokit.authenticate({
        type: 'oauth',
        token: that._accessToken
      });
    }
    var getRepositoryCommits = function(){

    }
    return {
      init: init,
      getRepositoryCommits: getRepositoryCommits,
      setAccessToken: setAccessToken,
      getAccessToken: getAccessToken,
      isEnabled: isEnabled,
      setEnabled: setEnabled
    }
  })()

// ----------------LATEX GENERATION-------------------------
  var LatexGenerator = (function(){
    let githubRepository;
    let githubUser;
    const articlePath = "./article.tex";
    const bibtexPath = "./references.bib";
    const todosInsertionPointText = "To dos";

    const Parser = {
      parse (){
        return new Promise(function(resolve,reject){

          /*let project = new Project("StrategicWriting","https://www.mindmeister.com/1161961764?t=G9gS0kY72c");
          let practice = new Practice("Scientific Writing in DSR");
          let p1 = new Property("Different with respect to ordinary writing");
          let p11 = new Property("Requires rigour");
          let p12 = new Property("Articles follow specific structures");
          let p13 = new Property("Space limitations");
          p1.insertSubproperty(p11);
          p1.insertSubproperty(p12);
          p1.insertSubproperty(p13);
          let p2 = new Property("Pressure to publish");
          practice.insertProperty(p1);
          practice.insertProperty(p2);
          let a1 = new Activity("Writing the introduction");
          let a1p1 = new Property("Difficult");
          let a1p2 = new Property("Important");
          a1.insertProperty(a1p1);
          a1.insertProperty(a1p2);
          let t11 = new Tool("Word processors");
          let t111 = new Tool("LaTeX");
          let t112 = new Tool("Microsoft Word");
          let t113 = new Tool("Overleaf");
          t11.insertSubtool(t111);
          t11.insertSubtool(t112);
          t11.insertSubtool(t113);
          let t12 = new Tool("Graphic editors");
          a1.insertTool(t11);
          a1.insertTool(t12);
          let a2 = new Activity("Receiving feedback");
          let a3 = new Activity("Collecting evidences");
          let a3t1 = new Tool("Reference managers");
          let a3t11 = new Tool("Zotero");
          let a3t12 = new Tool("Mendeley");
          a3t1.insertSubtool(a3t11);
          a3t1.insertSubtool(a3t12);
          a3.insertTool(a3t1);
          practice.insertActivity(a1);
          practice.insertActivity(a2);
          practice.insertActivity(a3)
          project.practice = practice;*/

          // project name
          let rootNodeContent = Scrap.getRootNode().getContent().replace("Explicate Problem for",'').trim()
          let mapId = Scrap.mapID;
          if(rootNodeContent==null) resolve();
          let project = new Project(rootNodeContent,"https://www.mindmeister.com/"+mapId);
          // contribution type
          let contributionTypeNode = Scrap.getNodesWithText("Type of Contribution");
          if(contributionTypeNode!=null&&contributionTypeNode.length>0){
            let contributionTypes = [{nodeText:"A new solution for a new problem",type:"invention"},{nodeText:"A known solution for a new problem",type:"exaptation"},{nodeText:"A new solution for a known problem",type:"improvement"},{nodeText:"A known solution for a known problem",type:"routineDesign"}];
            for(let i=0;i<contributionTypes.length;i++){
              let c = contributionTypeNode[0].getChildrenWithText(contributionTypes[i].nodeText);
              if(c!=null&&c.length>0&&c[0].getIcons().indexOf("status_ok")!=-1){
                project.contributionType = contributionTypes[i].type;
                break;
              }
            }
          }

          // evidences
          let getExtract = (node) => {

          }

          let getNodeEvidences = (node) => {
            let evidences = [];
            let nodeChildren = node.getChildren();
            let lookIn = nodeChildren;
            let supportingEvidences = nodeChildren.find((el) => {return el.getContent()==="Supporting Evidences?"});
            if(supportingEvidences!=null) {
              lookIn = supportingEvidences.getChildren();
            }
            for(let i=0;i<lookIn.length;i++){
              let ev = getExtract(lookIn[i]);
            }
          }

          // practice
          let describePractice = Scrap.getNodesWithText("Describe Practice");
          if(describePractice!=null&&describePractice.length>0&&describePractice[0].getChildren().length>0){
            let practice = describePractice[0].getChildren()[0];
            let p = new Practice(practice.getContent());
            let practiceProperties = practice.getChildrenWithText("properties");
            let getProperties = (node) => {
              let propertyList = [];
              let prop = node.getChildren();
              for(let i=0;i<prop.length;i++){
                let p = new Property(prop[i].getContent());
                if(prop[i].getChildrenWithText("properties").length>0){
                  let subproperties = getProperties(prop[i].getChildrenWithText("properties")[0]);
                  for(let j=0;j<subproperties.length;j++){
                    p.insertSubproperty(subproperties[j]);
                  }
                }
                propertyList.push(p);
              }
              return propertyList;
            }
            if(practiceProperties.length>0){
              let properties = getProperties(practiceProperties[0]);
              for(let i=0;i<properties.length;i++){
                p.insertProperty(properties[i]);
              }
            }
            let practiceActivities = practice.getChildrenWithText("activities");
            let getActivities = (node) => {
              let activityList = [];
              let act = node.getChildren();
              for(let i=0;i<act.length;i++){
                let a = new Activity(act[i].getContent());
                if(act[i].getChildrenWithText("subactivities").length>0){
                  let subactivities = getActivities(act[i].getChildrenWithText("subactivities")[0]);
                  for(let j=0;j<subactivities.length;j++){
                    a.insertSubactivity(subactivities[j]);
                  }
                }
                if(act[i].getChildrenWithText("properties").length>0){
                  let activityProperties = getProperties(act[i].getChildrenWithText("properties")[0]);
                  for(let j=0;j<activityProperties.length;j++){
                    a.insertProperty(activityProperties[j]);
                  }
                }
                if(act[i].getChildrenWithText("tooling").length>0){
                  let tooling = act[i].getChildrenWithText("tooling")[0].getChildren();
                  for(let j=0;j<tooling.length;j++){
                    let t = new Tool(tooling[j].getContent());
                    if(tooling[j].getChildrenWithText("examples").length>0){
                      for(let k=0;k<tooling[j].getChildrenWithText("examples")[0].getChildren().length;k++){
                        let st = new Tool(tooling[j].getChildrenWithText("examples")[0].getChildren()[k].getContent());
                        t.insertSubtool(st);
                      }
                    }
                    a.insertTool(t);
                  }
                }
                activityList.push(a);
              }
              return activityList;
            }
            if(practiceActivities.length>0){
              let activities = getActivities(practiceActivities[0]);
              for(let i=0;i<activities.length;i++){
                p.insertActivity(activities[i]);
              }
            }
            project.practice = p;
          }

          // stakeholders
          let describeStakeholders = Scrap.getNodesWithText("Describe Stakeholders");
          if(describeStakeholders!=null&&describeStakeholders.length>0){
            let stakeholderTypes = [{nodeText:"Add Client(s)",type:"client"},{nodeText:"Add Decision Maker(s)",type:"decisionMaker"},{nodeText:"Add Professional(s)",type:"professional"},{nodeText:"Add Witness(es)",type:"witness"}];
            for(let i=0;i<stakeholderTypes.length;i++){
              let insertionNode = Scrap.getNodesWithText(stakeholderTypes[i].nodeText);
              if(insertionNode.length==0) continue;
              let stakeholders = insertionNode[0].getChildren();
              for(let j=0;j<stakeholders.length;j++){
                let st = new Stakeholder(stakeholders[j].getContent(),stakeholderTypes[i].type);
                let goalsInsertionPoint = stakeholders[j].getChildrenWithText("What are their goals?");
                if(goalsInsertionPoint.length>0){
                  let goals = goalsInsertionPoint[0].getChildren();
                  for(let k=0;k<goals.length;k++){
                    let g = new StakeholderGoal(goals[k].getContent());
                    let measurementInsertionPoint = goals[k].getChildrenWithText("How to measure it?");
                    if(measurementInsertionPoint.length>0){
                      let measurements = measurementInsertionPoint[0].getChildren();
                      for(let l=0;l<measurements.length;l++){
                        let m = new Measurement(measurements[l].getContent());
                        g.insertMeasurement(m);
                      }
                    }
                    st.insertGoal(g);
                  }
                }
                project.insertStakeholder(st);
              }
            }
          }

          // glossary
          let glossary = Scrap.getNodesWithText("Describe Terminology");
          if(glossary!=null&&glossary.length>0){
            let g = new Glossary();
            let glossaryTerms = glossary[0].getChildren();
            for(let i=0;i<glossaryTerms.length;i++){
              let term = new Term(glossaryTerms[i].getContent());
              g.insertTerm(term);
            }
          }

          // problem
          let problemNode = Scrap.getNodesWithText("Set Problem Statement");
          let problem;
          if(problemNode!=null&&problemNode.length>0){
            let statement = problemNode[0].getChildren();
            if(statement.length>0){
              problem = new Problem(statement[0].getContent());
            }
          }
          else{
            problem = new Problem();
          }

          let requirementList = [];

          // goals and functional requirements
          let functionalRequirementsNode = Scrap.getNodesWithText("Functional Requirements");
          let getGoal = (node) => {
            let g = new Goal(node.getContent());
            let kernelTheoryNode = node.getChildren().find((el) => {return el.getContent() === "Kernel Theory"});
            if(kernelTheoryNode!=null){
              let kt = kernelTheoryNode.getChildren();
              for(let i=0;i<kt.length;i++){
                let ktAux = new KernelTheory(kt[i].getContent());
                g.insertKernelTheory(ktAux);
              }
            }
            let subgoalNode = node.getChildren().find((el) => {return el.getContent() === "How shall you attain it?"});
            if(subgoalNode!=null){
              let subgoals = subgoalNode.getChildren();
              for(let i=0;i<subgoals.length;i++){
                g.insertSubgoal(getGoal(subgoals[i]));
              }
            }
            else{
              let r = new FunctionalRequirement(node.getContent());
              r.goal = g;
              requirementList.push(r);
            }
            return g;
          }

          // non functional requirements
          let nonFunctionalRequirementsNode = Scrap.getNodesWithText("Non-functional Requirements");
          if(nonFunctionalRequirementsNode.length>0){
            let reqCategory = nonFunctionalRequirementsNode[0].getChildren();
            for(let i=0;i<reqCategory.length;i++){
              let catReqs = reqCategory[i].getChildren();
              let chosenReqs = catReqs.filter((r) => {return r.getIcons().indexOf("status_ok")!=-1});
              for(let j=0;j<chosenReqs.length;j++){
                let nfr = new NonFunctionalRequirement(chosenReqs[j].getContent(),reqCategory[i].getContent());
                let reqJustificationNode = chosenReqs[j].getChildren().find((el) => {return el.getContent() === "Why is it important?"});
                if(reqJustificationNode!=null){
                  let just = reqJustificationNode.getChildren();
                  for(let k=0;k<just.length;k++){
                    let justification = new Justification(just[k].getContent());
                    nfr.insertJustification(justification);
                  }
                }
                requirementList.push(nfr);
              }
            }
          }

          // consequences
          let consequencesNode = Scrap.getNodesWithText("Ascertain Consequences");
          if(consequencesNode!=null&&consequencesNode.length>0){
            let alleviateConsequencesNode = Scrap.getNodesWithText("Alleviate Consequences");
            let alleviateConsequencesDescendants;
            if(alleviateConsequencesNode.length>0){
              let alleviateConsequences = alleviateConsequencesNode[0];
              alleviateConsequencesDescendants = alleviateConsequences.getDescendants();
            }
            let getConsequences = (node) => {
              let consequences = [];
              let nodeChildren = node.getChildren();
              for(let i=0;i<nodeChildren.length;i++){
                let c = new Consequence(nodeChildren[i].getContent());
                if(alleviateConsequencesDescendants!=null){
                  let consAlleviation = alleviateConsequencesDescendants.find((n) => {return n.getContent()=='No longer '+nodeChildren[i].getContent()});
                  if(consAlleviation!=null){
                    let ca = new ConsequenceAlleviation(consAlleviation.getContent());
                    if(consAlleviation.getIcons().indexOf("status_ok")!=-1&&functionalRequirementsNode.length>0){
                      let gAux = functionalRequirementsNode[0].getChildrenWithText(consAlleviation.getContent());
                      if(gAux.length>0){
                        let g = getGoal(gAux[0]);
                        ca.goal = g;
                      }
                    }
                    c.alleviation = ca;
                  }
                }

                if(nodeChildren[i].getChildrenWithText("...leads to...").length>0){
                  let subcons = getConsequences(nodeChildren[i].getChildrenWithText("...leads to...")[0]);
                  for(let j=0;j<subcons.length;j++){
                    c.insertSubconsequence(subcons[j]);
                  }
                }
                consequences.push(c);
              }
              return consequences;
            }
            let cons = getConsequences(consequencesNode[0]);
            for(let i=0;i<cons.length;i++){
              problem.insertConsequence(cons[i]);
            }
          }

          // causes
          let causesNode = Scrap.getNodesWithText("Ascertain Causes");
          if(causesNode!=null&&causesNode.length>0){
            let lessenCausesNode = Scrap.getNodesWithText("Lessen Causes");
            let lessenCausesDescendants;
            if(lessenCausesNode.length>0){
              let lessenCauses = lessenCausesNode[0];
              lessenCausesDescendants = lessenCauses.getDescendants();
            }
            let getCauses = (node) => {
              let causes = [];
              let nodeChildren = node.getChildren();
              for(let i=0;i<nodeChildren.length;i++){
                let c = new Cause(nodeChildren[i].getContent());
                if(lessenCausesDescendants!=null){
                  let causeMitigation = lessenCausesDescendants.find((n) => {return n.getContent()=='No longer '+nodeChildren[i].getContent()});
                  if(causeMitigation!=null){
                    let ca = new CauseMitigation(causeMitigation.getContent());
                    if(causeMitigation.getIcons().indexOf("status_ok")!=-1&&functionalRequirementsNode.length>0){
                      let gAux = functionalRequirementsNode[0].getChildrenWithText(causeMitigation.getContent());
                      if(gAux.length>0){
                        let g = getGoal(gAux[0]);
                        ca.goal = g;
                      }
                    }
                    c.mitigation = ca;
                  }
                }

                if(nodeChildren[i].getChildrenWithText("...follows from...").length>0){
                  let subcauses = getCauses(nodeChildren[i].getChildrenWithText("...follows from...")[0]);
                  for(let j=0;j<subcauses.length;j++){
                    c.insertSubcause(subcauses[j]);
                  }
                }
                causes.push(c);
              }
              return causes;
            }
            let causesList = getCauses(causesNode[0]);
            for(let i=0;i<causesList.length;i++){
              problem.insertCause(causesList[i]);
            }
          }

          project.problem = problem;

          // artefact
          let designArtefactNode = Scrap.getNodesWithSubText("Design Purposeful Artefact");
          let artefact;
          if(designArtefactNode.length>0){
            let artefactName = designArtefactNode[0].getContent().replace("Design Purposeful Artefact","").trim() === "<name your artefact>" ? null : designArtefactNode[0].getContent().replace("Design Purposeful Artefact","").trim();
            let descriptionNode = designArtefactNode[0].getChildrenWithText("Description");
            let description;
            if(descriptionNode.length>0){
              let descChildren = descriptionNode[0].getChildren();
              if(descChildren.length>0){
                description = descChildren[0].getContent();
              }
            }
            artefact = new Artefact(artefactName,description);
            for(let i=0;i<requirementList.length;i++){
              artefact.insertRequirement(requirementList[i]);
            }
            let componentsNode = designArtefactNode[0].getChildren().find((el) => {return el.getContent()==="Components"});
            if(componentsNode!=null){
              let components = componentsNode.getChildren();
              for(let i=0;i<components.length;i++){
                let desc = components[i].getChildren().find((el) => {return el.getContent()==="Description"});
                let description;
                if(desc!=null&&desc.getChildren().length>0){
                  description = desc.getChildren()[0].getContent();
                }
                let c = new Component(components[i].getContent(),description);
                let compReqsNode = components[i].getChildren().find((el) => {return el.getContent()==="Requirements"});
                if(compReqsNode!=null){
                  let compReqs = compReqsNode.getChildren();
                  for(let k=0;k<compReqs.length;k++){
                    let req = requirementList.find((r) => {r.text===compReqs[k].getContent()});
                    if(req!=null){
                      c.insertRequirement(req);
                      let realizationNode = compReqs[k].getChildren().find((el) => {return el.getContent()==="How are you going to realize it?"});
                      if(realizationNode!=null){
                        let designDecisions = realizationNode.getChildren();
                        for(let l=0;l<designDecisions.length;l++){
                          let dd = new DesignDecision(designDecisions[l].getContent(),req);
                          let kernelTheoryNode = designDecisions[l].getChildren().find((el) => {return el.getContent()==="Kernel Theory"});
                          if(kernelTheoryNode!=null){
                            let kts = kernelTheoryNode.getChildren();
                            for(let j=0;j<kts.length;j++){
                              let kT = new KernelTheory(kts[j].getContent());
                              dd.insertKernelTheory(kT);
                            }
                          }
                          c.insertDesignDecision(dd);
                        }
                      }
                    }
                  }
                }
                artefact.insertComponent(c);
              }
            }
            project.artefact = artefact;
          }
          else{
            artefact = new Artefact();
          }

          resolve(project);
        })
      },
      parseMap (mapInfo){

        class MapParseNode {
          constructor(element){
            this._content = element.title.replace(/\n/g," ");
            this._id = element.id;
            this._style = element.style;
            this._note = element.note;
            this._link = element.link;
            this._modifiedDate = element.modifiedat;
            if(element.icon!=null) this._icon = element.icon.split(",");
            else this._icon = [];
          }
          getContent(){
            return this._content;
          }
          getChildrenWithText(text){
            return mapInfo.ideas.idea.filter((el) => {return el.title.replace(/\n/g," ")===text&&el.parent==this._id}).map((el) => {return new MapParseNode(el)});
          }
          getChildrenWithSubText(text){
            return mapInfo.ideas.idea.filter((el) => {return el.title.replace(/\n/g," ").indexOf(text)!=-1&&el.parent==this._id}).map((el) => {return new MapParseNode(el)});
          }
          getChildren(){
            return mapInfo.ideas.idea.filter((el) => {return el.parent==this._id}).map((el) => {return new MapParseNode(el)});
          }
          getIcons(){
            return this._icon;
          }
          getNote(){
            return this._note;
          }
          getDescendants(){
            let d = this.getChildren();
            let c = this.getChildren();
            for(let i=0;i<c.length;i++){
              d = d.concat(c[i].getDescendants());
            }
            return d;
          }
          getLink(){
            return this._link;
          }
          getBackgroundColor(){
            if(this._style==null) return null;
            let pars = this._style.split(",");
            if(pars.length<5) return null;
            return pars[4];
          }
          getModifyDate(){
            return new Date(this._modifiedDate);
          }
        }

        const MapParse = {
          getRootNode () {
            let r = mapInfo.ideas.idea.find((el) => {return el.parent == null});
            return new MapParseNode(r);
          },
          mapID: mapInfo.map.id,
          getNodesWithText (text) {
            return mapInfo.ideas.idea.filter((el) => {return el.title.replace(/\n/g," ") === text}).map((el) => {return new MapParseNode(el)});
          },
          getNodesWithSubText (text) {
            return mapInfo.ideas.idea.filter((el) => {return el.title.replace(/\n/g," ").indexOf(text) != -1}).map((el) => {return new MapParseNode(el)});
          }
        }

        // project name
        let rootNodeContent = MapParse.getRootNode().getContent().replace("Explicate Problem for",'').trim()
        let mapId = Scrap.mapID;
        if(rootNodeContent==null) resolve();
        let project = new Project(rootNodeContent,"https://www.mindmeister.com/"+mapId);
        // contribution type
        let contributionTypeNode = MapParse.getNodesWithText("Type of Contribution");
        if(contributionTypeNode!=null&&contributionTypeNode.length>0){
          let contributionTypes = [{nodeText:"A new solution for a new problem",type:"invention"},{nodeText:"A known solution for a new problem",type:"exaptation"},{nodeText:"A new solution for a known problem",type:"improvement"},{nodeText:"A known solution for a known problem",type:"routineDesign"}];
          for(let i=0;i<contributionTypes.length;i++){
            let c = contributionTypeNode[0].getChildrenWithText(contributionTypes[i].nodeText);
            if(c!=null&&c.length>0&&c[0].getIcons().indexOf("status_ok")!=-1){
              project.contributionType = contributionTypes[i].type;
              break;
            }
          }
        }

        // evidences
        let getExtract = (node,isEvidence) => {
          isEvidence = isEvidence !== null ? isEvidence : true;
          if(node.getBackgroundColor()=='ffffff'&&node.getNote()!=null){
            let note = node.getNote();
            let auxN = document.createElement("div");
            auxN.innerHTML = note;
            if(auxN.querySelector(".academicResource")!=null){
              let title, type;
              let a = auxN.querySelector(".title");
              if(a==null) return null;
              title = a.textContent;
              let b = auxN.querySelector(".type");
              if(b==null) return null;
              type = b.textContent;
              let resource = new AcademicResource(title,type);

              let params = ["year","source","abstract","source","month","revision","pages","volume","issue","publisher","city","edition","institution","series","chapter","citationKey","language","country","arxiv","doi","isbn","issn","pmid","scopus","ssrn"];
              for(let j=0;j<params.length;j++){
                let c = auxN.querySelector("."+params[j]);
                if(c!=null&&c.textContent!=null&&c.textContent!="") resource[params[j]] = c.textContent;
              }
              let d = auxN.querySelectorAll(".authors .author");
              for(let i=0;i<d.length;i++){
                let firstName = d[i].querySelector(".firstName")==null ? null : d[i].querySelector(".firstName").textContent;
                let lastName = d[i].querySelector(".lastName")==null ? null : d[i].querySelector(".lastName").textContent;
                resource.insertAuthor(new ResourceAuthor(firstName,lastName));
              }
              d = auxN.querySelectorAll(".editors .editor");
              for(let i=0;i<d.length;i++){
                let firstName = d[i].querySelector(".firstName")==null ? null : d[i].querySelector(".firstName").textContent;
                let lastName = d[i].querySelector(".lastName")==null ? null : d[i].querySelector(".lastName").textContent;
                resource.insertEditor(new ResourceAuthor(firstName,lastName));
              }
              d = auxN.querySelectorAll(".keywords .keyword");
              for(let i=0;i<d.length;i++){
                resource.insertKeyword(d[i].textContent);
              }
              d = auxN.querySelectorAll(".websites .website");
              for(let i=0;i<d.length;i++){
                resource.insertWebsite(d[i].textContent);
              }
              resource.url = node.getLink();
              let ex = isEvidence===true ? new Evidence(node.getContent()) : new Extract(node.getContent());
              ex.resource = resource;
              return ex;
            }
            else{
              let a = auxN.querySelector("div.title");
              if(a==null) return null;
              let ar = new AcademicResource(a.textContent,null);
              let b = auxN.querySelector("div.authors + div.line");
              if(b!=null){
                let authorsStr = b.textContent;
                let aut = authorsStr.split(",");
                for(let i=0;i<aut.length;i++){
                  let namesSplit = aut[i].trim().split(" ");
                  if(namesSplit.length==0) continue;
                  else if(namesSplit.length==1) ar.insertAuthor(new ResourceAuthor(null,namesSplit[0]));
                  else{
                    let lastName = namesSplit[namesSplit.length-1];
                    let firstName = namesSplit.slice(0,namesSplit.length-1).join(" ");
                    ar.insertAuthor(new ResourceAuthor(firstName,lastName));
                  }
                }
              }
              let c = auxN.querySelector("div.year + div.line");
              if(c!=null){
                let yAux = c.textContent;
                let sp = yAux.split(",");
                if(sp.length==1){
                  if(isNaN(sp[0].trim())) ar.source = sp[0].trim();
                  else ar.year = parseInt(sp[0].trim());
                }
                else if(sp.length>1){
                  if(!isNaN(sp[sp.length-1].trim())){
                    ar.year = parseInt(sp[sp.length-1]);
                    ar.source = sp.slice(0,sp.length-1).join(",");
                  }
                  else{
                    ar.source = sp.join(",");
                  }
                }
              }
              let d = auxN.querySelector("div.abstract + div.line");
              if(d!=null) ar.abstract = d.textContent;
              ar.url = node.getLink();
              let ex = isEvidence===true ? new Evidence(node.getContent()) : new Extract(node.getContent());
              ex.resource = ar;
              return ex;
            }
          }
          else if(node.getBackgroundColor()=='cccccc'){
            let wr = new WebResource(node.getLink(),node.getModifyDate());
            let ex = isEvidence===true ? new Evidence(node.getContent()) : new Extract(node.getContent());
            ex.resource = wr;
            return ex;
          }
          return null;
        }

        let isAnExtract = (node) => {
          if(node.getBackgroundColor()!="ffffff"&&node.getBackgroundColor()!="cccccc") return false;
          if(node.getLink()==null&&node.getNote()==null) return false;
          if(node.getContent().charAt(0)!='"') return false;
          return true;
        }

        let getNodeEvidences = (node,isEvidence) => {
          let evidences = [];
          let nodeChildren = node.getChildren();
          let lookIn = nodeChildren;
          let supportingEvidences = nodeChildren.find((el) => {return el.getContent()==="Supporting Evidences?"});
          if(supportingEvidences!=null) {
            lookIn = supportingEvidences.getChildren();
          }
          for(let i=0;i<lookIn.length;i++){
            if(isAnExtract(lookIn[i])){
              let ev = getExtract(lookIn[i],isEvidence);
              if(ev!=null) evidences.push(ev);
            }
          }
          return evidences;
        }

        let getNodeRelatedWorkExtracts = (node) => {
          let relatedWork = [];
          let nodeChildren = node.getChildren();
          let whoElse = nodeChildren.find((el) => {return el.getContent()==="Who else addresses it?"});
          if(whoElse==null) return [];
          let lookIn = whoElse.getChildren();
          for(let i=0;i<lookIn.length;i++){
            if(isAnExtract(lookIn[i])){
              let ev = getExtract(lookIn[i]);
              if(ev!=null){
                let limitationsNode = lookIn[i].getChildrenWithText("What are its limitations?");
                let limitationList = [];
                if(limitationsNode.length>0){
                  let limitations = limitationsNode[0].getChildren();
                  for(let v=0;v<limitations.length;v++){
                    let lim = new Limitation(limitations[v].getContent());
                    let limEv = getNodeEvidences(limitations[v]);
                    for(let w=0;w<limEv.length;w++){
                      lim.insertEvidence(limEv[w]);
                    }
                    limitationList.push(lim);
                  }
                }
                let rw = new RelatedWork(ev.resource,ev,limitationList);
                relatedWork.push(rw);
              }
            }
          }
          return relatedWork;
        }

        // practice
        let describePractice = MapParse.getNodesWithText("Describe Practice");
        if(describePractice!=null&&describePractice.length>0&&describePractice[0].getChildren().length>0){
          let practice = describePractice[0].getChildren()[0];
          let p = new Practice(practice.getContent());
          let practiceProperties = practice.getChildrenWithText("properties");
          let getProperties = (node) => {
            let propertyList = [];
            let prop = node.getChildren();
            for(let i=0;i<prop.length;i++){
              let p = new Property(prop[i].getContent());
              let ev = getNodeEvidences(prop[i]);
              for(let j=0;j<ev.length;j++){
                p.insertEvidence(ev[j]);
              }
              if(prop[i].getChildrenWithText("properties").length>0){
                let subproperties = getProperties(prop[i].getChildrenWithText("properties")[0]);
                for(let j=0;j<subproperties.length;j++){
                  p.insertSubproperty(subproperties[j]);
                }
              }
              propertyList.push(p);
            }
            return propertyList;
          }
          if(practiceProperties.length>0){
            let properties = getProperties(practiceProperties[0]);
            for(let i=0;i<properties.length;i++){
              p.insertProperty(properties[i]);
            }
          }
          let practiceActivities = practice.getChildrenWithText("activities");
          let getActivities = (node) => {
            let activityList = [];
            let act = node.getChildren();
            for(let i=0;i<act.length;i++){
              let a = new Activity(act[i].getContent());
              if(act[i].getChildrenWithText("subactivities").length>0){
                let subactivities = getActivities(act[i].getChildrenWithText("subactivities")[0]);
                for(let j=0;j<subactivities.length;j++){
                  a.insertSubactivity(subactivities[j]);
                }
              }
              if(act[i].getChildrenWithText("properties").length>0){
                let activityProperties = getProperties(act[i].getChildrenWithText("properties")[0]);
                for(let j=0;j<activityProperties.length;j++){
                  a.insertProperty(activityProperties[j]);
                }
              }
              if(act[i].getChildrenWithText("tooling").length>0){
                let tooling = act[i].getChildrenWithText("tooling")[0].getChildren();
                for(let j=0;j<tooling.length;j++){
                  let t = new Tool(tooling[j].getContent());
                  if(tooling[j].getChildrenWithText("examples").length>0){
                    for(let k=0;k<tooling[j].getChildrenWithText("examples")[0].getChildren().length;k++){
                      let st = new Tool(tooling[j].getChildrenWithText("examples")[0].getChildren()[k].getContent());
                      t.insertSubtool(st);
                    }
                  }
                  a.insertTool(t);
                }
              }
              activityList.push(a);
            }
            return activityList;
          }
          if(practiceActivities.length>0){
            let activities = getActivities(practiceActivities[0]);
            for(let i=0;i<activities.length;i++){
              p.insertActivity(activities[i]);
            }
          }
          project.practice = p;
        }

        // stakeholders
        let describeStakeholders = MapParse.getNodesWithText("Describe Stakeholders");
        if(describeStakeholders!=null&&describeStakeholders.length>0){
          let stakeholderTypes = [{nodeText:"Add Client(s)",type:"client"},{nodeText:"Add Decision Maker(s)",type:"decisionMaker"},{nodeText:"Add Professional(s)",type:"professional"},{nodeText:"Add Witness(es)",type:"witness"}];
          for(let i=0;i<stakeholderTypes.length;i++){
            let insertionNode = MapParse.getNodesWithText(stakeholderTypes[i].nodeText);
            if(insertionNode.length==0) continue;
            let stakeholders = insertionNode[0].getChildren();
            for(let j=0;j<stakeholders.length;j++){
              let st = new Stakeholder(stakeholders[j].getContent(),stakeholderTypes[i].type);
              let ev = getNodeEvidences(stakeholders[j]);
              for(let h=0;h<ev.length;h++){
                st.insertEvidence(ev[h]);
              }
              let goalsInsertionPoint = stakeholders[j].getChildrenWithText("What are their goals?");
              if(goalsInsertionPoint.length>0){
                let goals = goalsInsertionPoint[0].getChildren();
                for(let k=0;k<goals.length;k++){
                  let g = new StakeholderGoal(goals[k].getContent());
                  let ev = getNodeEvidences(goals[k]);
                  for(let h=0;h<ev.length;h++){
                    g.insertEvidence(ev[h]);
                  }
                  let measurementInsertionPoint = goals[k].getChildrenWithText("How to measure it?");
                  if(measurementInsertionPoint.length>0){
                    let measurements = measurementInsertionPoint[0].getChildren();
                    for(let l=0;l<measurements.length;l++){
                      let m = new Measurement(measurements[l].getContent());
                      let ev = getNodeEvidences(measurements[l]);
                      for(let h=0;h<ev.length;h++){
                        m.insertEvidence(ev[h]);
                      }
                      g.insertMeasurement(m);
                    }
                  }
                  st.insertGoal(g);
                }
              }
              project.insertStakeholder(st);
            }
          }
        }

        // glossary
        let glossary = MapParse.getNodesWithText("Describe Terminology");
        if(glossary!=null&&glossary.length>0){
          let g = new Glossary();
          let glossaryTerms = glossary[0].getChildren();
          for(let i=0;i<glossaryTerms.length;i++){
            let term = new Term(glossaryTerms[i].getContent());
            let ev = getNodeEvidences(glossaryTerms[i],false);
            for(let h=0;h<ev.length;h++){
              term.insertDefinition(ev[h]);
            }
            g.insertTerm(term);
          }
          project.glossary = g;
        }

        // problem
        let problemNode = MapParse.getNodesWithText("Set Problem Statement");
        let problem;
        if(problemNode!=null&&problemNode.length>0){
          let statement = problemNode[0].getChildren();
          if(statement.length>0){
            problem = new Problem(statement[0].getContent());
            let ev = getNodeEvidences(statement[0]);
            for(let i=0;i<ev.length;i++){
              problem.insertEvidence(ev[i]);
            }
          }
        }
        else{
          problem = new Problem();
        }

        let requirementList = [];

        // goals and functional requirements
        let functionalRequirementsNode = MapParse.getNodesWithText("Functional Requirements");
        let getGoal = (node) => {
          let g = new Goal(node.getContent());
          let kernelTheoryNode = node.getChildren().find((el) => {return el.getContent() === "Kernel Theory"});
          if(kernelTheoryNode!=null){
            let kt = kernelTheoryNode.getChildren();
            for(let i=0;i<kt.length;i++){
              let ktAux = new KernelTheory(kt[i].getContent());
              let ev = getNodeEvidences(kt[i]);
              for(let h=0;h<ev.length;h++){
                ktAux.insertExtract(ev[h]);
              }
              g.insertKernelTheory(ktAux);
            }
          }
          let subgoalNode = node.getChildren().find((el) => {return el.getContent() === "How shall you attain it?"});
          if(subgoalNode!=null){
            let subgoals = subgoalNode.getChildren();
            for(let i=0;i<subgoals.length;i++){
              g.insertSubgoal(getGoal(subgoals[i]));
            }
          }
          else{
            let r = new FunctionalRequirement(node.getContent());
            r.goal = g;
            requirementList.push(r);
          }
          return g;
        }

        // non functional requirements
        let nonFunctionalRequirementsNode = MapParse.getNodesWithText("Non-functional Requirements");
        if(nonFunctionalRequirementsNode.length>0){
          let reqCategory = nonFunctionalRequirementsNode[0].getChildren();
          for(let i=0;i<reqCategory.length;i++){
            let catReqs = reqCategory[i].getChildren();
            let chosenReqs = catReqs.filter((r) => {return r.getIcons().indexOf("status_ok")!=-1});
            for(let j=0;j<chosenReqs.length;j++){
              let nfr = new NonFunctionalRequirement(chosenReqs[j].getContent(),reqCategory[i].getContent());
              let reqJustificationNode = chosenReqs[j].getChildren().find((el) => {return el.getContent() === "Why is it important?"});
              if(reqJustificationNode!=null){
                let just = reqJustificationNode.getChildren();
                for(let k=0;k<just.length;k++){
                  let justification = new Justification(just[k].getContent());
                  let ev = getNodeEvidences(just[k]);
                  for(let h=0;h<ev.length;h++){
                    justification.insertEvidence(ev[h]);
                  }
                  nfr.insertJustification(justification);
                }
              }
              requirementList.push(nfr);
            }
          }
        }

        // consequences
        let consequencesNode = MapParse.getNodesWithText("Ascertain Consequences");
        if(consequencesNode!=null&&consequencesNode.length>0){
          let alleviateConsequencesNode = MapParse.getNodesWithText("Alleviate Consequences");
          let alleviateConsequencesDescendants;
          if(alleviateConsequencesNode.length>0){
            let alleviateConsequences = alleviateConsequencesNode[0];
            alleviateConsequencesDescendants = alleviateConsequences.getDescendants();
          }
          let getConsequences = (node) => {
            let consequences = [];
            let nodeChildren = node.getChildren();
            for(let i=0;i<nodeChildren.length;i++){
              let c = new Consequence(nodeChildren[i].getContent());
              let ev = getNodeEvidences(nodeChildren[i]);
              for(let h=0;h<ev.length;h++){
                c.insertEvidence(ev[h]);
              }
              if(alleviateConsequencesDescendants!=null){
                let consAlleviation = alleviateConsequencesDescendants.find((n) => {return n.getContent()=='No longer '+nodeChildren[i].getContent()});
                if(consAlleviation!=null){
                  let ca = new ConsequenceAlleviation(consAlleviation.getContent());
                  let rw = getNodeRelatedWorkExtracts(consAlleviation);
                  for(let h=0;h<rw.length;h++){
                    ca.insertRelatedWork(rw[h]);
                  }
                  if(consAlleviation.getIcons().indexOf("status_ok")!=-1&&functionalRequirementsNode.length>0){
                    let gAux = functionalRequirementsNode[0].getChildrenWithText(consAlleviation.getContent());
                    if(gAux.length>0){
                      let g = getGoal(gAux[0]);
                      ca.goal = g;
                    }
                  }
                  c.alleviation = ca;
                }
              }

              if(nodeChildren[i].getChildrenWithText("...leads to...").length>0){
                let subcons = getConsequences(nodeChildren[i].getChildrenWithText("...leads to...")[0]);
                for(let j=0;j<subcons.length;j++){
                  c.insertSubconsequence(subcons[j]);
                }
              }
              consequences.push(c);
            }
            return consequences;
          }
          let cons = getConsequences(consequencesNode[0]);
          for(let i=0;i<cons.length;i++){
            problem.insertConsequence(cons[i]);
          }
        }

        // causes
        let causesNode = MapParse.getNodesWithText("Ascertain Causes");
        if(causesNode!=null&&causesNode.length>0){
          let lessenCausesNode = MapParse.getNodesWithText("Lessen Causes");
          let lessenCausesDescendants;
          if(lessenCausesNode.length>0){
            let lessenCauses = lessenCausesNode[0];
            lessenCausesDescendants = lessenCauses.getDescendants();
          }
          let getCauses = (node) => {
            let causes = [];
            let nodeChildren = node.getChildren();
            for(let i=0;i<nodeChildren.length;i++){
              let c = new Cause(nodeChildren[i].getContent());
              let ev = getNodeEvidences(nodeChildren[i]);
              for(let h=0;h<ev.length;h++){
                c.insertEvidence(ev[h]);
              }
              if(lessenCausesDescendants!=null){
                let causeMitigation = lessenCausesDescendants.find((n) => {return n.getContent()=='No longer '+nodeChildren[i].getContent()});
                if(causeMitigation!=null){
                  let ca = new CauseMitigation(causeMitigation.getContent());
                  let rw = getNodeRelatedWorkExtracts(causeMitigation);
                  for(let h=0;h<rw.length;h++){
                    ca.insertRelatedWork(rw[h]);
                  }
                  if(causeMitigation.getIcons().indexOf("status_ok")!=-1&&functionalRequirementsNode.length>0){
                    let gAux = functionalRequirementsNode[0].getChildrenWithText(causeMitigation.getContent());
                    if(gAux.length>0){
                      let g = getGoal(gAux[0]);
                      ca.goal = g;
                    }
                  }
                  c.mitigation = ca;
                }
              }

              if(nodeChildren[i].getChildrenWithText("...follows from...").length>0){
                let subcauses = getCauses(nodeChildren[i].getChildrenWithText("...follows from...")[0]);
                for(let j=0;j<subcauses.length;j++){
                  c.insertSubcause(subcauses[j]);
                }
              }
              causes.push(c);
            }
            return causes;
          }
          let causesList = getCauses(causesNode[0]);
          for(let i=0;i<causesList.length;i++){
            problem.insertCause(causesList[i]);
          }
        }

        project.problem = problem;

        // artefact
        let designArtefactNode = MapParse.getNodesWithSubText("Design Purposeful Artefact");
        let artefact;
        if(designArtefactNode.length>0){
          let artefactName = designArtefactNode[0].getContent().replace("Design Purposeful Artefact","").trim() === "<name your artefact>" ? null : designArtefactNode[0].getContent().replace("Design Purposeful Artefact","").trim();
          let descriptionNode = designArtefactNode[0].getChildrenWithText("Description");
          let description;
          if(descriptionNode.length>0){
            let descChildren = descriptionNode[0].getChildren();
            if(descChildren.length>0){
              description = descChildren[0].getContent();
            }
          }
          artefact = new Artefact(artefactName,description);
          for(let i=0;i<requirementList.length;i++){
            artefact.insertRequirement(requirementList[i]);
          }
          let componentsNode = designArtefactNode[0].getChildren().find((el) => {return el.getContent()==="Components"});
          if(componentsNode!=null){
            let components = componentsNode.getChildren();
            for(let i=0;i<components.length;i++){
              let desc = components[i].getChildren().find((el) => {return el.getContent()==="Description"});
              let description;
              if(desc!=null&&desc.getChildren().length>0){
                description = desc.getChildren()[0].getContent();
              }
              let c = new Component(components[i].getContent(),description);
              let compReqsNode = components[i].getChildren().find((el) => {return el.getContent()==="Requirements"});
              if(compReqsNode!=null){
                let compReqs = compReqsNode.getChildren();
                for(let k=0;k<compReqs.length;k++){
                  let req = requirementList.find((r) => {return r.text===compReqs[k].getContent()});
                  if(req!=null){
                    c.insertRequirement(req);
                    let realizationNode = compReqs[k].getChildren().find((el) => {return el.getContent()==="How are you going to realize it?"});
                    if(realizationNode!=null){
                      let designDecisions = realizationNode.getChildren();
                      for(let l=0;l<designDecisions.length;l++){
                        let dd = new DesignDecision(designDecisions[l].getContent(),req);
                        let kernelTheoryNode = designDecisions[l].getChildren().find((el) => {return el.getContent()==="Kernel Theory"});
                        if(kernelTheoryNode!=null){
                          let kts = kernelTheoryNode.getChildren();
                          for(let j=0;j<kts.length;j++){
                            let kT = new KernelTheory(kts[j].getContent());
                            let ktEv = getNodeEvidences(kts[j],false);
                            for(let v=0;v<ktEv.length;v++){
                              kT.insertExtract(ktEv[v]);
                            }
                            dd.insertKernelTheory(kT);
                          }
                        }
                        c.insertDesignDecision(dd);
                      }
                    }
                  }
                }
              }
              artefact.insertComponent(c);
            }
          }
          project.artefact = artefact;
        }
        else{
          artefact = new Artefact();
          project.artefact = artefact;
        }

        return project;
      },
    }

    let modelDiff = (oldProject, newProject) => {
      let newElements = [];
      let removedElements = [];
      let projectNameModified = false;

      if(oldProject.name !== newProject.name) projectNameModified = true;

      // contribution type
      if(oldProject.contributionType==null&&newProject.contributionType!=null){
        newElements.push({type:"contributionType",element:newProject})
      }
      else if(oldProject.contributionType!=null&&newProject.contributionType==null){
        removedElements.push({type:"contributionType",element:newProject})
      }
      else if(oldProject.contributionType!=null&&newProject.contributionType!=null&&oldProject.contributionType!==newProject.contributionType){
        removedElements.push({type:"contributionType",element:newProject})
        newElements.push({type:"contributionType",element:newProject})
      }

      let compareElements = (oldElement,newElement,propertyToLoop,propertiesToCompare,insertionType,ifFound) => {
        for(let i=0;i<newElement[propertyToLoop].length;i++){
          let e = oldElement[propertyToLoop].find((ev) => {
            for(let prop in propertiesToCompare){
              if(newElement[propertyToLoop][i][propertiesToCompare[prop]]!==null&&ev[propertiesToCompare[prop]]!==newElement[propertyToLoop][i][propertiesToCompare[prop]]) return false;
            }
            return true;
          });
          if(e==null){
            newElements.push({type:insertionType,element:newElement[propertyToLoop][i],newParent:newElement,oldParent:oldElement});
          }
          else if(ifFound!=null){
            for(let j=0;j<ifFound.length;j++){
              ifFound[j].call(null,e,newElement[propertyToLoop][i]);
            }
          }
        }
      }

      // evidences
      let compareEvidences = (oldElement,newElement) => {
        compareElements(oldElement,newElement,"evidences",["text"],"evidence",null);
      }

      // practice
      let compareSubproperties = (oldProperty,newProperty) => {
        compareElements(oldProperty,newProperty,"subproperties",["statement"],"subproperty",[compareSubproperties,compareEvidences]);
      }
      let compareActivityProperties = (oldActivity,newActivity) => {
        compareElements(oldActivity,newActivity,"properties",["statement"],"activityProperty",[compareSubproperties,compareEvidences]);
      }
      let compareToolProperties = (oldTool,newTool) => {
        compareElements(oldTool,newTool,"properties",["statement"],"toolProperty",[compareSubproperties,compareEvidences]);
      }
      let compareSubtooling = (oldTool,newTool) => {
        compareElements(oldTool,newTool,"subtools",["text"],"subtool",[compareToolProperties]);
      }
      let compareTooling = (oldActivity,newActivity) => {
        compareElements(oldActivity,newActivity,"tools",["text"],"tool",[compareToolProperties,compareSubtooling]);
      }
      let compareSubactivities = (oldActivity,newActivity) => {
        compareElements(oldActivity,newActivity,"subactivities",["text"],"practiceSubactivity",[compareActivityProperties,compareSubactivities,compareTooling]);
      }
      let compareActivities = (oldPractice,newPractice) => {
        compareElements(oldPractice,newPractice,"activities",["text"],"practiceActivity",[compareActivityProperties,compareSubactivities,compareTooling]);
      }
      let compareProperties = (oldPractice,newPractice) => {
        compareElements(oldPractice,newPractice,"properties",["statement"],"practiceProperty",[compareSubproperties,compareEvidences]);
      }

      let oldPractice = oldProject.practice;
      let newPractice = newProject.practice;
      if(oldPractice===null&&newPractice!==null&&newPractice.text!==null){
        newElements.push({type:"practice",element:newPractice,newParent:newProject,oldParent:oldProject});
      }
      else if(oldPractice!==null&&newPractice!==null&&oldPractice.text!==newPractice.text){
        newElements.push({type:"practice",element:newPractice,newParent:newProject,oldParent:oldProject});
      }
      else if(oldPractice!==null&&newPractice!==null&&oldPractice.text===newPractice.text){
        compareProperties(oldPractice,newPractice);
        compareActivities(oldPractice,newPractice);
      }

      //problem
      let compareKernelTheoryExtract = (oldKernel,newKernel) => {
        compareElements(oldKernel,newKernel,"extracts",["text"],"kernelTheoryExtract",null);
      }
      let compareKernelTheories = (oldGoal,newGoal) => {
        compareElements(oldGoal,newGoal,"kernelTheories",["text"],"kernelTheory",[compareKernelTheoryExtract]);
      }
      let compareSubgoals = (oldGoal,newGoal) => {
        compareElements(oldGoal,newGoal,"subgoals",["statement"],"subgoal",[compareKernelTheories]);
      }
      let compareGoal = (oldOpportunity,newOpportunity) => {
        if(oldOpportunity.goal===null&&newOpportunity.goal!==null){
          newElements.push({type:"goal",element:newOpportunity.goal,newParent:newOpportunity,oldParent:oldOpportunity});
        }
        else if(oldOpportunity.goal!==null&&newOpportunity.goal!==null&&oldOpportunity.goal.statement!==newOpportunity.goal.statement){
          newElements.push({type:"consequenceAlleviation",element:newOpportunity.goal,newParent:newOpportunity,oldParent:oldOpportunity});
        }
        else if(oldOpportunity.goal!==null&&newOpportunity.goal!==null&&oldOpportunity.goal.statement===newOpportunity.goal.statement) {
          compareSubgoals(oldOpportunity.goal,newOpportunity.goal);
          compareKernelTheories(oldOpportunity.goal,newOpportunity.goal);
        }
      }

      let compareLimitations = (oldRelatedWork,newRelatedWork) => {
        compareElements(oldRelatedWork,newRelatedWork,"limitations",["statement"],"limitation",[compareEvidences]);
      }
      let compareRelatedWork = (oldOpportunity,newOpportunity) => {
        for(let i=0;i<newOpportunity.relatedWork.length;i++){
          let e = oldOpportunity.relatedWork.find((ev) => {
            if(ev.evidence!==null&&newOpportunity.relatedWork[i].evidence!==null&&ev.evidence.text===newOpportunity.relatedWork[i].evidence.text) return true;
            else return false;
          });
          if(e==null){
            newElements.push({type:"relatedWork",element:newOpportunity.relatedWork[i],newParent:newOpportunity,oldParent:oldOpportunity});
          }
          else{
            compareLimitations(e,newOpportunity.relatedWork[i]);
          }
        }
      }
      let compareAlleviation = (oldConsequence,newConsequence) => {
        if(oldConsequence.alleviation===null&&newConsequence.alleviation!==null){
          newElements.push({type:"consequenceAlleviation",element:newConsequence.alleviation,newParent:newConsequence,oldParent:oldConsequence});
        }
        else if(oldConsequence.alleviation!==null&&newConsequence.alleviation!==null&&oldConsequence.alleviation.statement!==newConsequence.alleviation.statement){
          newElements.push({type:"consequenceAlleviation",element:newConsequence.alleviation,newParent:newConsequence,oldParent:oldConsequence});
        }
        else if(oldConsequence.alleviation!==null&&newConsequence.alleviation!==null&&oldConsequence.alleviation.statement===newConsequence.alleviation.statement) {
          compareRelatedWork(oldConsequence.alleviation,newConsequence.alleviation);
          compareGoal(oldConsequence.alleviation,newConsequence.alleviation);
        }
      }
      let compareSubconsequences = (oldConsequence,newConsequence) => {
        compareElements(oldConsequence,newConsequence,"subconsequences",["statement"],"subconsequence",[compareEvidences,compareSubconsequences,compareAlleviation]);
      }
      let compareConsequences = (oldProblem,newProblem) => {
        compareElements(oldProblem,newProblem,"consequences",["statement"],"consequence",[compareEvidences,compareSubconsequences,compareAlleviation]);
      }

      let compareMitigation = (oldCause,newCause) => {
        if(oldCause.mitigation===null&&newCause.mitigation!==null){
          newElements.push({type:"causeMitigation",element:newCause.mitigation,newParent:newCause,oldParent:oldCause});
        }
        else if(oldCause.mitigation!==null&&newCause.mitigation!==null&&oldCause.mitigation.statement!==newCause.mitigation.statement){
          newElements.push({type:"causeMitigation",element:newCause.mitigation,newParent:newCause,oldParent:oldCause});
        }
        else if(oldCause.mitigation!==null&&newCause.mitigation!==null&&oldCause.mitigation.statement===newCause.mitigation.statement) {
          compareRelatedWork(oldCause.mitigation,newCause.mitigation);
          compareGoal(oldCause.mitigation,newCause.mitigation);
        }
      }
      let compareSubcauses = (oldCause,newCause) => {
        compareElements(oldCause,newCause,"subcauses",["statement"],"subcause",[compareEvidences,compareSubcauses,compareMitigation]);
      }
      let compareCauses = (oldProblem,newProblem) => {
        compareElements(oldProblem,newProblem,"causes",["statement"],"cause",[compareEvidences,compareSubcauses,compareMitigation]);
      }

      let oldProblem = oldProject.problem;
      let newProblem = newProject.problem;
      if(oldProblem===null&&newProblem!==null&&newProblem.statement!==null){
        newElements.push({type:"problem",element:newProblem,newParent:newProject,oldParent:oldProject});
      }
      else if(oldProblem!==null&&newProblem!==null&&oldProblem.statement!==newProblem.statement){
        newElements.push({type:"problem",element:newProblem,newParent:newProject,oldParent:oldProject});
      }
      else if(oldProblem!==null&&newProblem!==null&&oldProblem.statement===newProblem.statement){
        compareEvidences(oldProblem,newProblem);
        compareConsequences(oldProblem,newProblem);
        compareCauses(oldProblem,newProblem);
      }

      //stakeholders
      let compareMeasurements = (oldGoal,newGoal) => {
        compareElements(oldGoal,newGoal,"measurements",["statement"],"measurement",[compareEvidences]);
      }
      let compareStakeholderGoals = (oldStakeholder,newStakeholder) => {
        compareElements(oldStakeholder,newStakeholder,"goals",["statement"],"stakeholderGoal",[compareMeasurements]);
      }
      let compareStakeholders = (oldProject,newProject) => {
        compareElements(oldProject,newProject,"stakeholders",["name","type"],"stakeholder",[compareStakeholderGoals]);
      }
      compareStakeholders(oldProject,newProject);

      // glossary
      let compareTermDefinitions = (oldTerm,newTerm) => {
        compareElements(oldTerm,newTerm,"definitions",["text"],"termDefinition",null);
      }
      let compareTerms = (oldGlossary,newGlossary) => {
        compareElements(oldGlossary,newGlossary,"terms",["key"],"term",[compareTermDefinitions]);
      }
      compareTerms(oldProject.glossary,newProject.glossary);

      //artefact
      let compareArtefactRequirements = (oldArtefact,newArtefact) => {
        compareElements(oldArtefact,newArtefact,"requirements",["text","category"],"requirement",null);
      }
      let compareDesignDecisionRequirement = (oldDesignDecision,newDesignDecision) => {
        if(newDesignDecision.requirement===null) return;
        if(oldDesignDecision.requirement===null&&newDesignDecision.requirement!==null){
          newElements.push({type:"designDecisionRequirement",element:newDesignDecision.requirement,newParent:newDesignDecision,oldParent:oldDesignDecision});
        }
        else if(oldDesignDecision.requirement.name!==newDesignDecision.requirement.name){
          newElements.push({type:"designDecisionRequirement",element:newDesignDecision.requirement,newParent:newDesignDecision,oldParent:oldDesignDecision});
        }
        else if(newDesignDecision.requirement.category!==null&&newDesignDecision.requirement.name!==oldDesignDecision.requirement.name){
          newElements.push({type:"designDecisionRequirement",element:newDesignDecision.requirement,newParent:newDesignDecision,oldParent:oldDesignDecision});
        }
      }
      let compareComponentDesignDecisions = (oldComponent,newComponent) => {
        compareElements(oldComponent,newComponent,"designDecisions",["text"],"designDecision",[compareDesignDecisionRequirement,compareKernelTheories]);
      }
      let compareComponentRequirements = (oldComponent,newComponent) => {
        compareElements(oldComponent,newComponent,"requirements",["name","type"],"componentRequirement",null);
      }
      let compareComponentDescription = (oldComponent,newComponent) => {
        if(oldComponent.description!==newComponent.description&&newComponent.description!==null){
          newElements.push({type:"componentDescription",element:newComponent,newParent:newProject,oldParent:oldProject});
        }
      }
      let compareComponents = (oldArtefact,newArtefact) => {
        compareElements(oldArtefact,newArtefact,"components",["name"],"component",[compareComponentDescription,compareComponentRequirements,compareComponentDesignDecisions]);
      }
      let compareArtefactDescription = (oldArtefact,newArtefact) => {
        if(oldArtefact.description!==newArtefact.description&&newArtefact.description!==null){
          newElements.push({type:"artefactDescription",element:newArtefact,newParent:newProject,oldParent:oldProject});
        }
      }
      let oldArtefact = oldProject.artefact;
      let newArtefact = newProject.artefact;
      if(oldArtefact===null&&newArtefact!==null&&newArtefact.name!==null){
        newElements.push({type:"artefact",element:newArtefact,newParent:newProject,oldParent:oldProject});
      }
      else if(oldArtefact!==null&&newArtefact!==null&&newArtefact.name!==oldArtefact.name){
        newElements.push({type:"artefact",element:newArtefact,newParent:newProject,oldParent:oldProject});
      }
      else if(oldArtefact!==null&&newArtefact!==null&&newArtefact.name===oldArtefact.name){
        compareArtefactDescription(oldArtefact,newArtefact);
        compareComponents(oldArtefact,newArtefact);
        compareArtefactRequirements(oldArtefact,newArtefact);
      }

      return newElements;
    }

    let calculateInsertionPoint = (oldTarget,type,newParent,oldParent,newProject,oldProject) => {
      let findSimilarPos = (textToFind) => {
        const lengthVariation = 0.1;
        const similarityThreshold = 0.8;
        let minLength = textToFind.length - Math.ceil(textToFind.length*lengthVariation);
        let maxLength = textToFind.length + Math.ceil(textToFind.length*lengthVariation);
        let text = oldTarget;
        let introPos = text.indexOf("\\section{Introduction}");
        let endPos;
        let intro = text.substring(introPos);
        let p = intro.indexOf("\\section{");
        if(p!=-1) endPos = introPos+p;
        else{
          p = intro.indexOf("\\bibliography");
          if(p!=-1) endPos = introPos+p;
          else {
            p = intro.indexOf("\\end{document}");
            if (p != -1) endPos = introPos + p;
            else endPos = oldTarget.length - 1;
          }
        }
        let i = introPos;
        while(i<endPos){
          for(let j=minLength;j<maxLength;j++){
            let s = oldTarget.substr(i,j);
            if(Utils.similarity(s.toLowerCase(),textToFind.toLowerCase())>similarityThreshold) return i;
          }
          i++;
        }
        return null;
      }
      let findParagraphBeggining = (number) => {
        let text = oldTarget;
        let introPos = text.indexOf("\\section{Introduction}");
        let endPos;
        let intro = text.substring(introPos);
        let p = intro.indexOf("\\section{");
        if(p!=-1) endPos = introPos+p;
        else{
          p = intro.indexOf("\\bibliography");
          if(p!=-1) endPos = introPos+p;
          else {
            p = intro.indexOf("\\end{document}");
            if (p != -1) endPos = introPos + p;
            else endPos = oldTarget.length - 1;
          }
        }
        let i = introPos;
        let paragraphNumber = 0;
        let commentLine = false;
        let paragraphSpace = true;
        let word = /\w/;
        while(i<endPos){
          if(commentLine){
            if(oldTarget.charAt(i)=="\n") commentLine = false;
          }
          else if(paragraphSpace){
            if(oldTarget.charAt(i)=="%") commentLine = true;
            else if(word.test(oldTarget.charAt(i))){
              paragraphNumber++;
              if(paragraphNumber==number) return i;
              paragraphSpace=false;
            }
          }
          else if(!paragraphSpace){
            if(oldTarget.charAt(i)=="\n"){
              paragraphSpace=true;
            }
          }
          i++;
        }
        return i;
      }
      let findParagraphEnd = (number) => {
        let text = oldTarget;
        let introPos = text.indexOf("\\section{Introduction}");
        let endPos;
        let intro = text.substring(introPos);
        let p = intro.indexOf("\\section{");
        if(p!=-1) endPos = introPos+p;
        else{
          p = intro.indexOf("\\bibliography");
          if(p!=-1) endPos = introPos+p;
          else {
            p = intro.indexOf("\\end{document}");
            if (p != -1) endPos = introPos + p;
            else endPos = oldTarget.length - 1;
          }
        }
        let i = introPos;
        let paragraphNumber = 0;
        let commentLine = false;
        let paragraphSpace = true;
        let word = /\w/;
        while(i<endPos){
          if(commentLine){
            if(oldTarget.charAt(i)=="\n") commentLine = false;
          }
          else if(paragraphSpace){
            if(oldTarget.charAt(i)=="%") commentLine = true;
            else if(word.test(oldTarget.charAt(i))){
              paragraphNumber++;
              paragraphSpace=false;
            }
          }
          else if(!paragraphSpace){
            if(oldTarget.charAt(i)=="\n"){
              if(paragraphNumber==number) return i;
              paragraphSpace=true;
            }
          }
          i++;
        }
        return i;
      }
      let findSentenceBeggining = (pos) => { // return the beggining of the sentence pos belongs to
        let p = pos;
        while(p>0){
          if(oldTarget.charAt(p)=="."||oldTarget.charAt(p)=="\n") return p+1;
          p--;
        }
        return 0;
      }
      let findSentenceEnd = (pos) => {
        let p = pos;
        while(p<oldTarget.length){
          if(oldTarget.charAt(p)=="."||oldTarget.charAt(p)=="\n") return p+1;
          p++;
        }
        return 0;
      }

      switch (type) {
        case 'practice':
          var i = oldTarget.indexOf("%Describe the practice in which the problem addressed appears");
          if (i != -1) {
            return {pos:i + 61,type:"afterPracticeHeader"}; // after practice header
          }
          return {pos:findParagraphBeggining(1),type:"beggining1stParagraph"}; // beggining of 1st paragraph
        case 'practiceProperty':
          var act = oldParent.activities;
          if(act!=null&&act.length>0&&act[0].text!=null){
            var pos = oldTarget.indexOf(act[0].text); // todo - use similarity location
            if(pos!=-1) return {pos:findSentenceBeggining(pos),type:"before1stActivity"}; // before first activity
          }
          var i = oldTarget.indexOf("%Describe the practical problem addressed and its significance");
          if (i != -1) {
            return {pos:i,type:"beforeProblemHeader"}; // before problem header
          }
          return {pos:findParagraphEnd(1),type:"end1stParagraph"}; // end of 1st paragraph
        case 'practiceSubproperty':
          if (oldParent.subproperties.length > 0) {
            var pos = oldTarget.indexOf(oldParent.subproperties[oldParent.subproperties.length - 1].statement); // todo - use similarity location
            if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterLastSubproperty"}; // after last subproperty
          }
          var pos = oldTarget.indexOf(oldParent.statement); // todo - use similarity location
          if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterProperty"}; // after property
          var i = oldTarget.indexOf("%Describe the practical problem addressed and its significance");
          if (i != -1) {
            return {pos:i,type:"beforeProblemHeader"}; // before problem header
          }
          return {pos:findParagraphEnd(1),type:"end1stParagraph"}; // end of 1st paragraph
        case 'practiceActivity':
          if (oldParent.activities.length > 0) {
            var pos = oldTarget.indexOf(oldParent.activities[oldParent.activities.length - 1].text); // todo - use similarity location
            if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterLastActivity"}; // after last activity
          }
          var i = oldTarget.indexOf("%Describe the practical problem addressed and its significance");
          if (i != -1) {
            return {pos:i,type:"beforeProblemHeader"}; // before problem header
          }
          return {pos:findParagraphEnd(1),type:"end1stParagraph"}; // end of 1st paragraph
        case 'activityProperty':
          if (oldParent.properties.length>0){
            var pos = oldTarget.indexOf(oldParent.properties[oldParent.properties.length - 1].statement); // todo - use similarity location
            if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterLastProperty"}; // after last property
          }
          var pos = oldTarget.indexOf(oldParent.text); // todo - use similarity location
          if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterActivity"}; // after activity
          var i = oldTarget.indexOf("%Describe the practical problem addressed and its significance");
          if (i != -1) {
            return {pos:i,type:"beforeProblemHeader"}; // before problem header
          }
          return {pos:findParagraphEnd(1),type:"end1stParagraph"}; // end of 1st paragraph
        case 'tool':
          if (oldParent.tools.length>0){
            var pos = oldTarget.indexOf(oldParent.tools[oldParent.properties.length - 1].text); // todo - use similarity location
            if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterLastTool"}; // after last property
          }
          var pos = oldTarget.indexOf(oldParent.text); // todo - use similarity location
          if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterActivity"}; // after activity
          var i = oldTarget.indexOf("%Describe the practical problem addressed and its significance");
          if (i != -1) {
            return {pos:i,type:"beforeProblemHeader"}; // before problem header
          }
          return {pos:findParagraphEnd(1),type:"end1stParagraph"}; // end of 1st paragraph
        case 'subtool':
          if (oldParent.subtools.length>0){
            var pos = oldTarget.indexOf(oldParent.subtools[oldParent.properties.length - 1].text); // todo - use similarity location
            if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterLastSubtool"}; // after last subtool
          }
          var pos = oldTarget.indexOf(oldParent.text); // todo - use similarity location
          if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterTool"}; // after tool
          var i = oldTarget.indexOf("%Describe the practical problem addressed and its significance");
          if (i != -1) {
            return {pos:i,type:"beforeProblemHeader"}; // before problem header
          }
          return {pos:findParagraphEnd(1),type:"end1stParagraph"}; // end of 1st paragraph
        case 'termDefinition':
          if(oldParent.definitions.length>0){
            var pos = oldTarget.indexOf(oldParent.definitinos[oldParent.definitions.length - 1].text); // todo - use similarity location
            if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterLastDefinition"}; // after last definition
          }
          var pos = oldTarget.indexOf(oldParent.key); // todo - use similarity location
          if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterTerm"}; // after term
          return null;
        case 'problem':
          var i = oldTarget.indexOf("%Describe the practical problem addressed and its significance");
          if (i != -1) {
            return {pos:i + 62,type:"afterProblemHeader"}; // after problem header
          }
          return {pos:findParagraphBeggining(2),type:"beggining2ndParagraph"}; // beggining of 2nd paragraph
        case 'leafConsequence':
          if (oldProject.problem!=null){
            var leafCons = oldProject.problem.getLeafConsequences();
            if(leafCons.length>0){
              var pos = oldTarget.indexOf(leafCons[leafCons.length - 1].statement); // todo - use similarity location
              if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterLastLeafConsequence"}; // after last leaf consequence
            }
            else{
              var pos = oldTarget.indexOf(oldProject.problem.statement); // todo - use similarity location
              if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterProblemStatement"}; // after problem statement
            }
          }
          var i = oldTarget.indexOf("%Summarise existing research including knowledge gaps and give an account for similar and/or alternative solutions to the problem");
          if (i != -1) {
            return {pos:i,type:"beforeProblemHeader"}; // before related work header
          }
          return {pos:findParagraphEnd(2),type:"end2ndParagraph"}; // end of 2nd paragraph
        case 'leafCause':
          if (oldProject.problem!=null){
            var leafCauses = oldProject.problem.getLeafCauses();
            if(leafCauses.length>0){
              var pos = oldTarget.indexOf(leafCauses[leafCauses.length - 1].statement); // todo - use similarity location
              if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterLastLeafCause"}; // after last leaf cause
            }
          }
          var i = oldTarget.indexOf("%Summarise existing research including knowledge gaps and give an account for similar and/or alternative solutions to the problem");
          if (i != -1) {
            return {pos:i,type:"beforeProblemHeader"}; // before related work header
          }
          return {pos:findParagraphEnd(2),type:"end2ndParagraph"}; // end of 2nd paragraph
        case 'contributionType':
          var i = oldTarget.indexOf("%Summarize the contributions and their significance");
          if (i != -1) {
            return {pos:i + 52,type:"afterContributionHeader"}; // after contribution header
          }
          return {pos:findParagraphBeggining(7),type:"beggining7thParagraph"}; // beggining of 1st paragraph
        case 'limitation':
          if (oldParent.limitations.length > 0) {
            var pos = oldTarget.indexOf(oldParent.limitations[oldParent.limitations.length - 1].statement); // todo - use similarity location
            if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterLastLimitation"}; // after last limitation
          }
          var i = oldTarget.indexOf("%Formulate goals and present Kernel theories used as a basis for the artefact design");
          if (i != -1) {
            return {pos:i,type:"beforeGoalsHeader"}; // before goals header
          }
          return {pos:findParagraphEnd(3),type:"end3rdParagraph"}; // end of 3rd paragraph
        case 'artefact':
          var i = oldTarget.indexOf("%Describe the kind of artefact that is developed or evaluated");
          if (i != -1) {
            return {pos:i + 61,type:"afterArtefactHeader"}; // after artefact header
          }
          return {pos:findParagraphBeggining(5),type:"beggining5thParagraph"}; // beggining of 5th paragraph
        case 'artefactDescription':
          var pos = oldTarget.indexOf(oldParent.artefact.name); // todo - use similarity location
          if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterArtefact"}; // after artefact
          var i = oldTarget.indexOf("%Formulate research question");
          if (i != -1) {
            return {pos:i,type:"beforeResearchQuestionHeader"}; // before research question header
          }
          return {pos:findParagraphEnd(5),type:"end5thParagraph"}; // end of 5th paragraph
        case 'goal':
          var kt = oldProject.getCauseKernelTheories();
          if(kt!=null&&kt.length>0){
            var pos = oldTarget.indexOf(kt[0].text); // todo - use similarity location
            if (pos != -1) return {pos:findSentenceBeggining(pos),type:"beforeKernelTheories"}; // before kernel theories
          }
          var i = oldTarget.indexOf("%Describe the kind of artefact that is developed or evaluated");
          if (i != -1) {
            return {pos:i,type:"beforeArtefactHeader"}; // before artefact header
          }
          return {pos:findParagraphEnd(4),type:"end4thParagraph"}; // end of 4th paragraph
        case 'kernelTheory':
          var kt = oldProject.getCauseKernelTheories();
          if(kt!=null&&kt.length>0){
            var pos = oldTarget.indexOf(kt[kt.length-1].text); // todo - use similarity location
            if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterLastyKernelTheory"}; // after last kernel theories
          }
          var i = oldTarget.indexOf("%Describe the kind of artefact that is developed or evaluated");
          if (i != -1) {
            return {pos:i,type:"beforeArtefactHeader"}; // before artefact header
          }
          return {pos:findParagraphEnd(4),type:"end4thParagraph"}; // end of 4th paragraph
        case 'researchQuestion':
          var i = oldTarget.indexOf("%Formulate research questions");
          if (i != -1) {
            return {pos:i + 29,type:"afterResearchQuestionHeader"}; // after research question header
          }
          return {pos:findParagraphBeggining(6),type:"beggining6thParagraph"}; // beggining of 6th paragraph
        case 'evidence':
          var pos = oldTarget.indexOf(newParent.statement); // todo - use similarity location
          if (pos != -1) return {pos:findSentenceEnd(pos),type:"afterElement"}; // after element
          return null;
        default:
          return null;
      }
    }

    let injectText = (text,position,textToInject) => {
      let part1 = text.substring(0,position);
      let part2 = text.substring(position);
      return part1+"\\textbf{"+textToInject+"}"+part2;
    }

    let incrementalTransformation = (oldTarget,newElements,newProject,oldProject) => {
      let newTarget = oldTarget;

      let newElementsByType = (t) => {
        return newElements.filter((el) => {return el.type===t});
      }

      // practice
      let e;
      e = newElementsByType("practice");
      if(e!=null&&e.length>0){
        for(let i=0;i<e.length;i++){
          let ip = calculateInsertionPoint(newTarget,'practice',e[i].newParent,e[i].oldParent,newProject,oldProject);
          if(ip!=null){
            let textToInject = '\n'+TransformationRules.practice(e[i].element,e[i].newParent)+'\n';
            newTarget = injectText(newTarget,ip.pos,textToInject);
          }
        }
      }

      // practice property
      e = newElementsByType("practiceProperty");
      if(e!=null&&e.length>0){
        for(let i=0;i<e.length;i++){
          let ip = calculateInsertionPoint(newTarget,'practiceProperty',e[i].newParent,e[i].oldParent,newProject,oldProject);
          if(ip!=null){
            let textToInject = ' '+TransformationRules.practiceProperty(e[i].element,e[i].newParent,e[i].oldParent,oldProject.practice.properties.length-1);
            newTarget = injectText(newTarget,ip.pos,textToInject);
          }
        }
      }

      // practice subproperty
      e = newElementsByType("subproperty");
      if(e!=null&&e.length>0){
        let doneProperties = [];
        for(let i=0;i<e.length;i++){
          if(doneProperties.indexOf(e[i].newParent.statement)!=-1) continue;
          let subproperties = e.filter((el) => {return el.newParent.statement === e[i].newParent.statement});
          doneProperties.push(e[i].newParent.statement);
          let ip = calculateInsertionPoint(newTarget,'practiceSubproperty',e[i].newParent,e[i].oldParent,newProject,oldProject);
          if(ip!=null){
            let textToInject;
            if(e[i].oldParent.subproperties.length==0){
              textToInject = ' '+TransformationRules.practiceSubproperties(subproperties.map((el) => {return el.element}));
            }
            else{
              textToInject = ' '+TransformationRules.practiceSubpropertiesInjection(subproperties.map((el) => {return el.element}));
            }
            newTarget = injectText(newTarget,ip.pos,textToInject);
          }
        }
      }

      // practice activity
      e = newElementsByType("practiceActivity");
      if(e!=null&&e.length>0){
        let ip = calculateInsertionPoint(newTarget,'practiceActivity',e[0].newParent,e[0].oldParent,newProject,oldProject);
        let activities = e.map((el) => {return el.element});
        if(ip!=null){
          let textToInject;
          if(e[0].oldParent.activities.length==0){
            textToInject = ' '+TransformationRules.practiceActivities(activities,e[0].newParent);
          }
          else{
            textToInject = ' '+TransformationRules.practiceActivitiesInjection(activities,e[0].newParent);
          }
          newTarget = injectText(newTarget,ip.pos,textToInject);
        }
      }

      // activity property
      e = newElementsByType("activityProperty");
      if(e!=null&&e.length>0){
        let doneActivities = [];
        for(let i=0;i<e.length;i++){
          if(doneActivities.indexOf(e[i].newParent.text)!=-1) continue;
          let properties = e.filter((el) => {return el.newParent.text === e[i].newParent.text}).map((ele) => {return ele.element});
          doneActivities.push(e[i].newParent.text);
          let ip = calculateInsertionPoint(newTarget,'activityProperty',e[i].newParent,e[i].oldParent,newProject,oldProject);
          if(ip!=null){
            let textToInject;
            if(ip.type==="afterLastProperty"||ip.type==="afterActivity"){
              if(e[i].oldParent.properties.length==0){
                textToInject = ' It has been described as '+TransformationRules.activityProperties(properties)+'.';
              }
              else{
                textToInject = ' Moreover, it has been described as '+TransformationRules.activityProperties(properties)+'.';
              }
            }
            else{
              textToInject = ' '+e[i].oldParent.text+' has been described as '+TransformationRules.activityProperties(properties)+'.';
            }
            newTarget = injectText(newTarget,ip.pos,textToInject);
          }
        }
      }

      // tool
      e = newElementsByType("tool");
      if(e!=null&&e.length>0){
        let doneActivities = [];
        for(let i=0;i<e.length;i++){
          if(doneActivities.indexOf(e[i].newParent.text)!=-1) continue;
          let tools = e.filter((el) => {return el.newParent.text === e[i].newParent.text});
          doneActivities.push(e[i].newParent.text);
          let ip = calculateInsertionPoint(newTarget,'tool',e[i].newParent,e[i].oldParent,newProject,oldProject);
          if(ip!=null){
            let textToInject;
            if(ip.type==="afterLastTool"||ip.type==="afterActivity"){
              if(e[i].oldParent.tools.length==0){
                textToInject = ' It is conducted using '+TransformationRules.activityTooling(tools.map((el) => {return el.element}))+'.';
              }
              else{
                textToInject = ' Moreover, it is conducted using '+TransformationRules.activityTooling(tools.map((el) => {return el.element}))+'.';
              }
            }
            else{
              textToInject = ' '+oldParent.text+' is conducted using '+TransformationRules.activityTooling(tools.map((el) => {return el.element}))+'.';
            }
            newTarget = injectText(newTarget,ip.pos,textToInject);
          }
        }
      }

      // subtool
      e = newElementsByType("subtool");
      if(e!=null&&e.length>0){
        let doneTools = [];
        for(let i=0;i<e.length;i++){
          if(doneTools.indexOf(e[i].newParent.text)!=-1) continue;
          let subtools = e.filter((el) => {return el.newParent.text === e[i].newParent.text});
          doneTools.push(e[i].newParent.text);
          let ip = calculateInsertionPoint(newTarget,'subtool',e[i].newParent,e[i].oldParent,newProject,oldProject);
          if(ip!=null){
            let textToInject;
            textToInject = ' '+TransformationRules.subtools(subtools.map((el) => {return el.element}));
            if(subtools.length==1) textToInject += ' is ';
            else textToInject += ' are ';
            if(e[i].oldParent.subtools.length>0) textToInject += 'further ';
            textToInject += 'examples of '+oldParent.text;
            newTarget = injectText(newTarget,ip.pos,textToInject);
          }
        }
      }

      // term
      let insertTermDefinitions = (definitions,term) => {
        let textToInject = '';
        let ip = calculateInsertionPoint(newTarget,'termDefinition',term,null,newProject,oldProject);
        if(ip==null) return;
        if(oldProject.glossary.hasTermWithDefinitinos(term.key)&&ip.type=="afterLastDefinition"){
          for(let def in definitions){
            if(definitions[def].resource.author!=null){
              textToInject += ' A further definition of '+term.key+' is given by '+TransformationRules.resourceAuthor(definitions[def].resource)+' who describes it as "'+definitions[def].text+'" '+TransformationRules.citation(definitions[def].resource)+'.';
            }
            else{
              textToInject += ' Alternatively, '+term.key+' can be defined as "'+definitions[def].text+'" '+TransformationRules.citation(definitions[def].resource)+'.';
            }
          }
        }
        else{
          textToInject += ' It is necessary here to clarify exactly what is meant by '+term.key+'.';
          textToInject += TransformationRules.definition(newProject.glossary,term.key);
        }
        newTarget = injectText(newTarget,ip.pos,textToInject);
      }

      e = newElementsByType("term");
      if(e!=null&&e.length>0){
        for(let i=0;i<e.length;i++){
          if(e[i].element.definitions.length>0){
            insertTermDefinitions(e[i].element.definitions,e[i]);
          }
        }
      }

      // term definition
      e = newElementsByType("termDefinition");
      if(e!=null&&e.length>0){
        let doneTerms = [];
        for(let i=0;i<e.length;i++){
          if(doneTerms.indexOf(e[i].newParent.key)!=-1) continue;
          let newDefs = e.filter((el) => {return el.newParent.key === e[i].newParent.key});
          doneTerms.push(e[i].newParent.key);
          insertTermDefinitions(newDefs.map((el) => {return el.element}),e[i].newParent);
        }
      }

      // problem
      e = newElementsByType("problem");
      if(e!=null&&e.length>0){
        for(let i=0;i<e.length;i++){
          let ip = calculateInsertionPoint(newTarget,'problem',e[i].newParent,e[i].oldParent,newProject,oldProject);
          if(ip!=null){
            let textToInject = '\n'+TransformationRules.problem(e[i].element,e[i].newParent.practice)+'\n';
            newTarget = injectText(newTarget,ip.pos,textToInject);
          }
        }
      }

      // consequence
      e = newElementsByType("consequence").concat(newElementsByType("subconsequence"));
      if(e!=null&&e.length>0){
        let consequencesToInsert = [];
        let newProjectLeafConsequences = newProject.problem.getLeafConsequences();
        let oldProjectLeafConsequences = oldProject.problem.getLeafConsequences();
        for(let i=0;i<newProjectLeafConsequences.length;i++){
          let o = oldProjectLeafConsequences.find((c) => {return c.statement === newProjectLeafConsequences[i].statement});
          if(o==null) consequencesToInsert.push(newProjectLeafConsequences[i]);
        }
        if(consequencesToInsert.length>0){
          let ip = calculateInsertionPoint(newTarget,'leafConsequence',null,null,newProject,oldProject);
          if(ip!=null){
            let textToInject;
            if(oldProject.problem!=null&&oldProject.problem.getLeafConsequences().length>0){
              let aux = TransformationRules.problemConsequences(consequencesToInsert);
              textToInject = " Moreover, "+aux.charAt(0).toLowerCase()+aux.substring(1);
            }
            else{
              textToInject = ' '+TransformationRules.problemConsequences(consequencesToInsert);
            }
            newTarget = injectText(newTarget,ip.pos,textToInject);
          }
        }
      }

      // cause
      e = newElementsByType("cause").concat(newElementsByType("subcause"));
      if(e!=null&&e.length>0){
        let causesToInsert = [];
        let newProjectLeafCauses = newProject.problem.getLeafCauses();
        let oldProjectLeafCauses = oldProject.problem.getLeafCauses();
        for(let i=0;i<newProjectLeafCauses.length;i++){
          let o = oldProjectLeafCauses.find((c) => {return c.statement === newProjectLeafCauses[i].statement});
          if(o==null) causesToInsert.push(newProjectLeafCauses[i]);
        }
        if(causesToInsert.length>0){
          let ip = calculateInsertionPoint(newTarget,'leafCause',null,null,newProject,oldProject);
          if(ip!=null){
            let textToInject;
            if(oldProject.problem!=null&&oldProject.problem.getLeafCauses().length>0){
              textToInject = " Moreover, ";
              for(let j=0;j<causesToInsert.length;j++){
                if(j>0&&j<causesToInsert.length-1) textToInject += ', ';
                else if(j>0&&j==causesToInsert.length-1) textToInject += ' and ';
                textToInject += causesToInsert[j].statement;
                for(let k=0;k<causesToInsert[j].evidences.length;k++){
                  textToInject += ' '+TransformationRules.citation(causesToInsert[j].evidences[k].resource);
                }
              }
              if(causesToInsert.length==1) textToInject += " has ";
              else textToInject += " have ";
              textToInject += "been shown to be related to this problem. ";
            }
            else{
              textToInject = ' '+TransformationRules.problemCauses(causesToInsert);
            }
            newTarget = injectText(newTarget,ip.pos,textToInject);
          }
        }
      }

      // related work
      let getNewCausesRelatedWork = () => {
        let nrw = [];
        let oldRelatedWork = oldProject.getCausesRelatedWork();
        let newRelatedWork = newProject.getCausesRelatedWork();
        for(let i=0;i<newRelatedWork.length;i++){
          let rw = oldRelatedWork.find((e) => {return e.evidence.text == newRelatedWork[i].evidence.text});
          if(rw==null) nrw.push(newRelatedWork[i]);
        }
        return nrw;
      }
      let insertNewRelatedWork = (newRelatedWork) => {
        let ip = calculateInsertionPoint(newTarget,'relatedWork',null,null,newProject,oldProject);
        if(ip!=null){
          let textToInject;
          if(oldProject.getCausesRelatedWork().length==0){
            textToInject = ' '+TransformationRules.relatedWorkGeneral(newRelatedWork);
          }
          else{
            textToInject = " Moreover, ";
            for(let i=0;i<newRelatedWork.length;i++){
              textToInject += TransformationRules.relatedWork(newRelatedWork[i]);
            }
          }
          newTarget = injectText(newTarget,ip.pos,textToInject);
        }
      }
      e = newElementsByType("relatedWork").concat(newElementsByType("cause")).concat(newElementsByType("subcause")).concat(newElementsByType("problem"));
      if(e!=null&&e.length>0){
        let aux = getNewCausesRelatedWork();
        if(aux.length>0){
          insertNewRelatedWork(aux);
        }
      }

      // related work limitations
      e = newElementsByType("limitation");
      if(e!=null&&e.length>0){
        let doneRelatedWork = [];
        for(let i=0;i<e.length;i++){
          if(doneRelatedWork.indexOf(e[i].newParent.evidence.text)!=-1) continue;
          let limitations = e.filter((el) => {return el.newParent.evidence.text === e[i].newParent.evidence.text});
          doneRelatedWork.push(e[i].newParent.evidence.text);
          let ip = calculateInsertionPoint(newTarget,'limitation',e[i].newParent,e[i].oldParent,newProject,oldProject);
          if(ip!=null){
            let textToInject;
            if(oldProject.getCausesRelatedWork().length==0){
              textToInject = ' '+TransformationRules.relatedWorkLimitations(limitations.map((el) => {return el.element}));
            }
            else{
              let a = TransformationRules.relatedWorkLimitations(limitations.map((el) => {return el.element}));
              textToInject = ' Moreover, '+a.charAt(0).toLowerCase()+a.substring(1);
            }
            newTarget = injectText(newTarget,ip.pos,textToInject);
          }
        }
      }

      // goals
      let getNewCausesGoals = () => {
        let ncg = [];
        let oldGoals = oldProject.getCauseGoals();
        let newGoals = newProject.getCauseGoals();
        for(let i=0;i<newGoals.length;i++){
          let rw = oldGoals.find((e) => {return e.statement == newGoals[i].statement});
          if(rw==null) ncg.push(newGoals[i]);
        }
        return ncg;
      }
      let insertNewGoals = (newGoals) => {
        let ip = calculateInsertionPoint(newTarget, 'goal', null, null, newProject, oldProject);
        if (ip != null) {
          let textToInject;
          if (oldProject.getCauseGoals().length == 0) {
            textToInject = ' '+TransformationRules.goals(newGoals,[]);
          }
          else {
            textToInject = " Moreover, we have addressed ";
            for (let i = 0; i < newGoals.length; i++) {
              if(i>0&&i<newGoals.length-1) textToInject += ', ';
              if(i>0&&i==newGoals.length-1) textToInject += ' and ';
              textToInject += newGoals[i].statement;
            }
          }
          newTarget = injectText(newTarget, ip.pos, textToInject);
        }
      }
      e = newElementsByType("goal").concat(newElementsByType("cause")).concat(newElementsByType("subcause")).concat(newElementsByType("problem"));
      if(e!=null&&e.length>0){
        let aux = getNewCausesGoals();
        if(aux.length>0){
          insertNewGoals(aux);
        }
      }

      // kernelTheories
      let getNewCausesKernelTheories = () => {
        let nkt = [];
        let oldKt = oldProject.getCauseKernelTheories();
        let newKt = newProject.getCauseKernelTheories();
        for(let i=0;i<newKt.length;i++){
          let rw = oldKt.find((e) => {return e.text == newKt[i].text});
          if(rw==null) nkt.push(newKt[i]);
        }
        return nkt;
      }
      let insertNewKernelTheories = (newKernelTheories) => {
        let ip = calculateInsertionPoint(newTarget, 'kernelTheory', null, null, newProject, oldProject);
        if (ip != null) {
          let textToInject;
          if (oldProject.getCauseKernelTheories().length == 0) {
            textToInject = ' '+TransformationRules.kernelTheories(newKernelTheories,newProject.getCauseGoals().length);
          }
          else {
            textToInject = " Moreover, we have resorted to ";
            for (let i = 0; i < newKernelTheories.length; i++) {
              if(i>0&&i<newKernelTheories.length-1) textToInject += ', ';
              if(i>0&&i==newKernelTheories.length-1) textToInject += ' and ';
              textToInject += newKernelTheories[i].text;
            }
          }
          newTarget = injectText(newTarget, ip.pos, textToInject);
        }
      }
      e = newElementsByType("kernelTheory").concat(newElementsByType('artefact')).concat(newElementsByType('requirement')).concat(newElementsByType('designDecision')).concat(newElementsByType("component")).concat(newElementsByType("subgoal")).concat(newElementsByType("goal")).concat(newElementsByType("cause")).concat(newElementsByType("subcause")).concat(newElementsByType("problem"));
      if(e!=null&&e.length>0){
        let aux = getNewCausesKernelTheories();
        if(aux.length>0){
          insertNewKernelTheories(aux);
        }
      }

      // artefact
      e = newElementsByType("artefact");
      if(e!=null&&e.length>0){
        for(let i=0;i<e.length;i++){
          let ip = calculateInsertionPoint(newTarget,'artefact',e[i].newParent,e[i].oldParent,newProject,oldProject);
          if(ip!=null){
            let textToInject = '\n'+TransformationRules.artefact(e[i].element)+'\n';
            newTarget = injectText(newTarget,ip.pos,textToInject);
          }
        }
      }

      // artefactDescription
      e = newElementsByType("artefactDescription");
      if(e!=null&&e.length>0){
        for(let i=0;i<e.length;i++){
          let ip = calculateInsertionPoint(newTarget,'artefactDescription',e[i].newParent,e[i].oldParent,newProject,oldProject);
          if(ip!=null){
            let textToInject = '\nThis artefact is a '+e[i].element.description+'\n';
            newTarget = injectText(newTarget,ip.pos,textToInject);
          }
        }
      }

      // researchQuestion
      let newResearchQuestion = () => {
        if(!newProject.hasCompleteDesignProblem()) return false;
        if(oldProject.problem===null||newProject.problem.statement!==oldProject.problem.statement) return true;
        if(oldProject.artefact===null||newProject.artefact.description!==oldProject.artefact.description) return true;
        let oldReq = oldProject.artefact.requirements;
        let newReq = newProject.artefact.requirements;
        if(oldReq.length!==newReq.length) return true;
        for(let i=0;i<newReq.length;i++){
          let rw = oldReq.find((e) => {return e.text == newReq[i].text});
          if(rw==null) return true;
        }
        let getStakeholderGoals = (stakeholders) => {
          let gL = [];
          for(let j=0;j<stakeholders.length;j++){
            for(let k=0;k<stakeholders[j].length;k++){
              gL.push({name:stakeholders[j].name,goal:stakeholders[j].goals[k].statement});
            }
          }
          return gL;
        }
        let oldStG = getStakeholderGoals(oldProject.stakeholders);
        let newStG = getStakeholderGoals(newProject.stakeholders);
        if(oldStG.length!==newStG) return true;
        for(let i=0;i<newStG.length;i++){
          let e = oldStG.find((el) => {return el.name===newStG[i].name&&el.goal===newStG[i].goal});
          if(e==null) return true;
        }

        return false;
      }
      let insertNewResearchQuestion = () => {
        let ip = calculateInsertionPoint(newTarget, 'researchQuestion', null, null, newProject, oldProject);
        if (ip != null) {
          let textToInject = '\n'+TransformationRules.designProblem(newProject)+'\n';
          newTarget = injectText(newTarget, ip.pos, textToInject);
        }
      }
      e = newElementsByType("artefact").concat(newElementsByType('artefactDescription')).concat(newElementsByType('stakeholder')).concat(newElementsByType('stakeholderGoal')).concat(newElementsByType('requirement')).concat(newElementsByType("subgoal")).concat(newElementsByType("goal")).concat(newElementsByType("cause")).concat(newElementsByType("subcause")).concat(newElementsByType("problem"));
      if(e!=null&&e.length>0){
        if(newResearchQuestion()){
          insertNewResearchQuestion();
        }
      }

      // contribution
      e = newElementsByType("contributionType");
      if(e!=null&&e.length>0){
        let ip = calculateInsertionPoint(newTarget,'contributionType',e[0].newParent,e[0].oldParent,newProject,oldProject);
        if(ip!=null){
          let textToInject;
          textToInject = '\n'+TransformationRules.contribution(newProject.contributionType,newProject)+'\n';
          newTarget = injectText(newTarget,ip.pos,textToInject);
        }
      }

      // evidence
      let insertEvidences = (evidences,element) => {
        let ip = calculateInsertionPoint(newTarget,'evidence',element,null,newProject,oldProject);
        if(ip==null) return;
        let textToInject = '';
        for(let ev in evidences){
          textToInject += ' '+TransformationRules.citation(evidences[ev].resource);
        }
        newTarget = injectText(newTarget,ip.pos,textToInject);
      }
      e = newElementsByType("evidence");
      if(e!=null&&e.length>0){
        let doneElements = [];
        for(let i=0;i<e.length;i++){
          // property problem cause consequence limitation
          //let allowedTypes = ["Problem","Cause","Consequence","Property","Limitation"];
          //if(allowedTypes.indexOf(typeof e[i].newParent)==-1) continue;
          if(!(e[i].newParent instanceof Problem)&&!(e[i].newParent instanceof Cause)&&!(e[i].newParent instanceof Consequence)&&!(e[i].newParent instanceof Property)&&!(e[i].newParent instanceof Limitation)) continue;
          if(doneElements.indexOf(e[i].newParent.statement)!=-1) continue;
          let newEvidences = e.filter((el) => {return el.newParent.statement === e[i].newParent.statement});
          doneElements.push(e[i].newParent.statement);
          insertEvidences(newEvidences.map((el) => {return el.element}),e[i].newParent);
        }
      }
      return newTarget;
    }

    let incrementalTransformationBibliography = (oldTarget,newElements,newProject,oldProject) => {
      let newTarget = oldTarget;
      let oldBiblio = oldProject.getBibliography().map((el) => {return TransformationRules.resourceIdentifier(el)});
      let newBiblio = newProject.getBibliography();
      for(let i=0;i<newBiblio.length;i++){
        if(oldBiblio.indexOf(TransformationRules.resourceIdentifier(newBiblio[i]))==-1&&oldTarget.indexOf(TransformationRules.resourceIdentifier(newBiblio[i]))==-1){
          newTarget += "\n"+TransformationRules.resource(newBiblio[i]);
        }
      }
      return newTarget;
    }

    var generateLatex = function(){
      Scrap.showWorkingMessage("Generating LaTeX from the mind map. Please wait.");
      if(githubRepository!=null){
        const commitMessage = "Incremental LaTeX generation by DScaffolding";
        octokit.repos.getCommits({owner: githubUser, repo: githubRepository, path: articlePath, per_page: 100}).then(result => {
          let lastDScaffoldingCommitDate = new Date(0);
          for(let i=0;i<result.data.length;i++){
            if((result.data[i].commit.message=="Initial generation of the article"||result.data[i].commit.message==commitMessage)&&new Date(result.data[i].commit.author.date)>lastDScaffoldingCommitDate){
              lastDScaffoldingCommitDate = new Date(result.data[i].commit.author.date);
            }
          }
          if(result.data.length>0){
            Mindmeister.getMapHistory(Scrap.mapID).then(function(resp){
              let revisionNumber = 1;
              for(let j=1;j<resp.history.revision.length;j++){
                if(new Date(resp.history.revision[j].created+"Z")>lastDScaffoldingCommitDate){
                  revisionNumber = resp.history.revision[j-1].revision;
                  break;
                }
              }
              Mindmeister.getMapInfo(Scrap.mapID,revisionNumber).then(function(mapInfo){
                let oldProject = Parser.parseMap(mapInfo);
                Mindmeister.getMapInfo(Scrap.mapID).then(function(mapInfo2){
                  let newProject = Parser.parseMap(mapInfo2);
                  let newElements = modelDiff(oldProject,newProject);

                  octokit.repos.getContent({owner: githubUser, repo: githubRepository, path: articlePath}).then(result => {
                    let article = decodeURIComponent(escape(atob(result.data.content)));
                    octokit.repos.getContent({owner: githubUser, repo: githubRepository, path: bibtexPath}).then(result2 => {
                      let bibliography = decodeURIComponent(escape(atob(result2.data.content)));

                      if(newElements!=null&&newElements.length>0){
                        let newArticle = incrementalTransformation(article,newElements,newProject,oldProject);
                        let newBibliography = incrementalTransformationBibliography(bibliography,newElements,newProject,oldProject);
                        octokit.repos.updateFile({owner:githubUser,repo:githubRepository,path:articlePath,message:commitMessage,content:btoa(unescape(encodeURIComponent(newArticle))),sha:result.data.sha}).then(function() {
                          if(newBibliography!=bibliography){
                            octokit.repos.updateFile({owner:githubUser,repo:githubRepository,path:bibtexPath,message:commitMessage,content:btoa(unescape(encodeURIComponent(newBibliography))),sha:result2.data.sha}).then(function() {
                              Scrap.hideWorkingMessage();
                            });
                          }
                          else Scrap.hideWorkingMessage();
                        });
                      }
                      else Scrap.hideWorkingMessage();
                    })
                  })
                })
              });
            })
          }
        })
      }
      else {
        Mindmeister.getMapInfo(Scrap.mapID).then(function(mapInfo){
          let project = Parser.parseMap(mapInfo);
          octokit.repos.create({
            name:project.name+"Article",
            description:"Article for the "+project.name+" project",
            private: false
          }).then(function(result){
            if(result.data.owner.login==null||result.data.name==null) return;
            githubUser = result.data.owner.login;
            githubRepository = result.data.name;
            let article = TransformationRules.article(project);
            let bibliography = TransformationRules.bibliography(project);
            octokit.repos.createFile({owner:githubUser,repo:githubRepository,path:articlePath,message:"Initial generation of the article",content:btoa(unescape(encodeURIComponent(article)))}).then(function(){
              octokit.repos.createFile({owner:githubUser,repo:githubRepository,path:bibtexPath,message:"Initial generation of the bibliography",content:btoa(unescape(encodeURIComponent(bibliography)))}).then(function(){
                let rootNode = Scrap.getRootNode();
                let cL =  new Mindmeister.ChangeList();
                Mindmeister.modifyIdea(Scrap.mapID,rootNode.id,{link:"https://github.com/"+githubUser+"/"+githubRepository},cL);
                Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
                  if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
                  else Scrap.hideWorkingMessage();
                })
              })
            })
          })
        });
      }
    }

    var backwardsTransformation = function(){
      if(githubRepository!=null&&githubUser!=null){
        octokit.repos.getContent({owner: githubUser, repo: githubRepository, path: articlePath}).then(result => {
          let article = decodeURIComponent(escape(atob(result.data.content)));
          let todosRegexp = /\\todo\{[^\}]+\}/gi;
          let todos = article.match(todosRegexp);
          if(todos!=null){
            let cL =  new Mindmeister.ChangeList();
            let rootNode = Scrap.getRootNode();
            let ch = rootNode.getChildren();
            let aux = ch.find((el) => {return el.getContent() == todosInsertionPointText});
            let insertionPointId = aux != null ? aux.id : Mindmeister.insertIdea(Scrap.mapID, rootNode.id,{title:todosInsertionPointText}, cL);
            for(let i=0;i<todos.length;i++){
              Mindmeister.insertIdea(Scrap.mapID, insertionPointId,{title:todos[i].substring(6,todos[i].length-1)}, cL);
            }
            Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
              if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision);
              else Scrap.hideWorkingMessage();
            })
          }
        })
      }
    }

    var init = function(){
      var rootNode = Scrap.getRootNode();
      if(rootNode.hasLink()){
        let repositoryUrl = rootNode.getLink().trim();
        let regexp = /https?\:\/\/github.com\/[^\/]+\/[^\/]+/;
        if(regexp.test(repositoryUrl)){
          let s = repositoryUrl.replace(/https?\:\/\/github.com\//,"").split("/");
          githubUser = s[0];
          githubRepository = s[1];
        }
      }
    }
    return {
      generateLatex: generateLatex,
      backwardsTransformation: backwardsTransformation,
      init: init
    }
  })()

// ----------------NAVEGABILITY-----------------------------
var NavegabilityManager = (function(){
  var nodeCloseKey1Pushed = false;
  var nodeCloseKey1 = 17; // Control key
  var nodeCloseKey2 = 84; // t key
  var getNodesToClose = function(node){
    var rootNode = Scrap.getRootNode();
    if(rootNode.id==node.id) return;
    var children = rootNode.getChildren();
    var getNodesToCloseRecursive = function(nodeList){
      var nodesToClose = [];
      for(var i=0;i<nodeList.length;i++){
        if(node.id==nodeList[i].id) continue;
        if(!node.isDescendant(nodeList[i])) nodesToClose.push(nodeList[i]);
        else{
          var ch = nodeList[i].getChildren();
          nodesToClose = nodesToClose.concat(getNodesToCloseRecursive(ch));
        }
      }
      return nodesToClose;
    }
    return getNodesToCloseRecursive(children);
  }
  var init = function(){
    var that = this;
    document.addEventListener("keydown",function(e){
      if(e.keyCode==nodeCloseKey1){
        nodeCloseKey1Pushed = true;
      }
      if(e.keyCode==nodeCloseKey2&&nodeCloseKey1Pushed){
        var currentNode = Scrap.getCurrentNode();
        var nodesToClose = getNodesToClose(currentNode);
        for(var i=0;i<nodesToClose.length;i++) nodesToClose[i].close();
      }
    })
    document.addEventListener("keyup",function(e){
      if(e.keyCode==nodeCloseKey1){
        nodeCloseKey1Pushed = false;
      }
    })
  }
  return {
    init : init
  }
})()

  // ----------------COMMENT NOTIFICATION-------------------------
  var CommentNotification = (function(){
    let _enabled = false
    let isEnabled = function(){
      return this._enabled
    }
    let setEnabled = function(enabled){
      this._enabled = enabled
    }
    let monitorCommentShow = function(){
      var observer = new MutationObserver(function(mutations){
        mutations.forEach(function(mutation){
          if(mutation.addedNodes==null||mutation.addedNodes.length==0) return;
          for(var i=0;i<mutation.addedNodes.length;i++){
            if(mutation.addedNodes[i].classList != null && mutation.addedNodes[i].classList.contains('popover')&&mutation.addedNodes[i].classList.contains('comments')){
              var action = function(){
                var mapId = Scrap.mapID;
                var aux2 = document.querySelectorAll(".popover.comments .comment");
                var comment = [];
                if(aux2!=null){
                  for(var k=0;k<aux2.length;k++){
                    comment.push(aux2[k].innerText);
                  }
                }
                if(mapId!=null&&comment.length>0){
                  for(var j=0;j<comment.length;j++){
                    (function(c){
                      chrome.storage.sync.get(["UNREAD_COMMENTS"], function(options){
                        var comments = options["UNREAD_COMMENTS"] != null ? options["UNREAD_COMMENTS"] : [];
                        var fInd = comments.findIndex((el) => {return el.mapId==mapId && el.comment==Utils.escapeHtml(c)});
                        if(fInd!=-1){
                          comments.splice(fInd,1);
                          chrome.storage.sync.set({"UNREAD_COMMENTS":comments},function(){
                            chrome.runtime.sendMessage({mes: "reloadBrowserAction"});
                          });
                        }
                      });
                    })(comment[j]);
                  }
                }
              }
              action();
              var obs = new MutationObserver(function(mutations){
                action();
              })
              var cfg = {characterData:true,childList:true,subtree:true};
              obs.observe(document.getElementById("popover_extras"),cfg);
              observer.disconnect();
            }
          }
        })
      })
      var config = {childList:true};
      observer.observe(document.body,config);

      var observer2 = new MutationObserver(function(mutations){
        mutations.forEach(function(mutation){
          if(mutation.addedNodes==null||mutation.addedNodes.length==0) return;
          for(var i=0;i<mutation.addedNodes.length;i++){
            if(mutation.addedNodes[i].className.indexOf("comment_line")!=-1){
              var com = document.querySelectorAll("#all_comments .comment_line");
              for(var j=0;j<com.length;j++){
                (function(c){
                  if(c.id==null) return;
                  var cId = c.id.replace("comment_","");
                  chrome.storage.sync.get(["UNREAD_COMMENTS"], function(options){
                    var comments = options["UNREAD_COMMENTS"] != null ? options["UNREAD_COMMENTS"] : [];
                    var fInd = comments.findIndex((el) => {return el.id==cId});
                    if(fInd!=-1){
                      comments.splice(fInd,1);
                      chrome.storage.sync.set({"UNREAD_COMMENTS":comments},function(){
                        chrome.runtime.sendMessage({mes: "reloadBrowserAction"});
                      });
                    }
                  });
                })(com[j]);
              }
              break;
            }
          }
        })
      })
      var cfg = {childList:true};
      observer2.observe(document.getElementById("all_comments"),cfg);
    }
    return {
      isEnabled: isEnabled,
      setEnabled: setEnabled,
      monitorCommentShow: monitorCommentShow
    }
  })()

  // ----------------ANNOTATION MANAGER---------------------------
  var AnnotationManager = (function(){
    var importAnnotationsMendeley = function(){
      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList();

      var rootNode = Scrap.getRootNode();
      var rootNodeContent = rootNode.getContent().trim().replace("Explicate Problem for ","").trim();
      var callback = function(annotationList){
        var promiseList = [];
        for(var i=0;i<annotationList.length;i++){
          (function (annotation){
            if (annotation.text == null || annotation.text == '' || annotation.text == ' ') return
            if(!DScaffolding.existsSimilarAnnotation(annotation.text)){
              var parentNodeId = PurposeManager.getPurpose(annotation.color) == null ? null : PurposeManager.getPurpose(annotation.color).insertionPoint;
              if(parentNodeId != null){
                var a = new Promise(function (resolve, reject){
                  Mendeley.getDocumentInfo(annotation["document_id"]).then(function (article){
                    var metadata = DScaffolding.getDocumentMetadata(article);
                    var aT = annotation.text.charAt(annotation.text.length-1) == "\n" ? '"'+annotation.text.substr(0,annotation.text.length-1)+'"' : '"'+annotation.text+'"';
                    var a = {
                      text: aT,
                      color: "ffffff",
                      note: metadata,
                      link: "https://www.mendeley.com/reference-manager/reader/"+annotation.documentId+"/"+annotation.fileId+"#"+annotation.page
                    }
                    if(article.starred!=null&&article.starred==true){
                      a["starred"] = true;
                    }
                    DScaffolding.insertAnnotation(a,parentNodeId,Scrap.mapID,cL);
                    if(Mendeley.isFolderManagementEnabled()) DScaffolding.insertDocumentIntoFolder(annotation["document_id"],parentNodeId);
                    resolve(parentNodeId);
                  })
                  /*Mendeley.selectDocumentById(annotation["document_id"]).then(function (article){
                    var metadata = DScaffolding.generateArticleMetadata(article);
                    var aT = annotation.text.charAt(annotation.text.length-1) == "\n" ? '"'+annotation.text.substr(0,annotation.text.length-1)+'"' : '"'+annotation.text+'"';
                    var a = {
                      text: aT,
                      color: "ffffff",
                      note: metadata.note,
                      link: metadata.link+"#"+annotation.page
                    }
                    if(article.starred!=null&&article.starred==true){
                      a["starred"] = true;
                    }
                    DScaffolding.insertAnnotation(a,parentNodeId,Scrap.mapID,cL);
                    if(Mendeley.isFolderManagementEnabled()) DScaffolding.insertDocumentIntoFolder(annotation["document_id"],parentNodeId);
                    resolve(parentNodeId);
                  })*/
                })
                promiseList.push(a);
              }
            }
          })(annotationList[i]);
        }
        Promise.all(promiseList).then(function (parentNodeIdList){
          for(var i=0;i<parentNodeIdList.length;i++){
            if(parentNodeIdList.indexOf(parentNodeIdList[i])==i){
              var supportingEvidencesNode = Scrap.getNodeById(parentNodeIdList[i]);
              if(supportingEvidencesNode!=null&&supportingEvidencesNode.getHTMLElement().style.backgroundColor == "rgb(71, 105, 209)"/*"rgb(230, 124, 115)"*/){
                var nodeContent = supportingEvidencesNode.getContent();
                var style = {
                  bold: 0,
                  italic: 0,
                  color: "666352",
                  fontSize: 120,
                  boxStyle: 1,
                  backgroundColor: "fff6cc"
                }
                Mindmeister.modifyIdea(Scrap.mapID,supportingEvidencesNode.id,{style:style},cL);
                var parentNode = supportingEvidencesNode.getParentNode();
                if(parentNode!=null){
                  var parentNodeContent = parentNode.getContent();
                  if(nodeContent == "Supporting Evidences?"){
                    DScaffolding.removeTaskNode("Supporting Evidences for '"+parentNodeContent+"'",cL);
                  }
                  else if(nodeContent == "Who else addresses it?"){
                    DScaffolding.removeTaskNode("Who else addresses '"+parentNodeContent+"'?",cL);
                  }
                  else if(nodeContent == "Justificatory Knowledge"){
                    DScaffolding.removeTaskNode("What is the justificatory knowledge for '"+parentNodeContent+"'?",cL);
                  }
                }
              }
            }
          }
          Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.focusNodeId);
            else Scrap.hideWorkingMessage();
            Mendeley.updateLastUpdateDate(new Date().toISOString(),Scrap.mapID);
          })
        })
      }
      /*
      chrome.storage.sync.get("syncMode", function(syncMode){
        var mode = syncMode["syncMode"];
        if(mode == null || mode == "folder") Mendeley.selectFolderAnnotations(rootNodeContent,mapId).then(callback);
        else if(mode == "tag") Mendeley.selectTagAnnotations(rootNodeContent,mapId).then(callback);
      })*/
      if(Mendeley.getSyncMode() == null || Mendeley.getSyncMode() == "folder"){
        Mendeley.selectFolderAnnotations(rootNodeContent,Scrap.mapID).then(callback);
      }
      else if(Mendeley.getSyncMode() == "tag"){
        Mendeley.selectTagAnnotations(rootNodeContent,Scrap.mapID).then(callback);
      }
    }
    var importAnnotationsHypothesis = function(){
      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList();
      var mapName = Scrap.getRootNode().getContent().trim();
      if(mapName==Utils.escapeHtml("Explicate Problem for <name your project>")||mapName==Utils.escapeHtml("<name your project>")) return;
      Hypothesis.getAnnotationsByGroup(mapName.replace("Explicate Problem for","").trim()).then(function(annotationList){
        var promiseList = [];
        for(var i=0;i<annotationList.length;i++){
          (function (annotation){
            if(!DScaffolding.existsSimilarAnnotation(annotation.text)){
              var p = new Promise(function (resolve,reject){
                var a = {
                  text: '"'+annotation.text+'"',
                  color: "cccccc",//"fff6cc",
                  link: annotation.link
                }
                if(annotation.note!=null) a["note"] = annotation.note;
                DScaffolding.insertAnnotation(a,annotation.insertionPoint,Scrap.mapID,cL);
                resolve(annotation.insertionPoint);
              })
              promiseList.push(p);
            }
            else{
              //console.log("already exists similar annotation",annotation);
            }
          })(annotationList[i]);
        }
        Promise.all(promiseList).then(function (parentNodeIdList){
          for(var i=0;i<parentNodeIdList.length;i++){
            if(parentNodeIdList.indexOf(parentNodeIdList[i])==i){
              var supportingEvidencesNode = Scrap.getNodeById(parentNodeIdList[i]);
              if(supportingEvidencesNode!=null&&supportingEvidencesNode.getHTMLElement().style.backgroundColor == "rgb(71, 105, 209)"/*"rgb(230, 124, 115)"*/){
                var nodeContent = supportingEvidencesNode.getContent();
                var style = {
                  bold: 0,
                  italic: 0,
                  color: "666352",
                  fontSize: 120,
                  boxStyle: 1,
                  backgroundColor: "fff6cc"
                }
                Mindmeister.modifyIdea(Scrap.mapID,supportingEvidencesNode.id,{style:style},cL);
                var parentNode = supportingEvidencesNode.getParentNode();
                if(parentNode!=null){
                  var parentNodeContent = parentNode.getContent();
                  if(nodeContent == "Supporting Evidences?"){
                    DScaffolding.removeTaskNode("Supporting Evidences for '"+parentNodeContent+"'",cL);
                  }
                  else if(nodeContent == "Who else addresses it?"){
                    DScaffolding.removeTaskNode("Who else addresses '"+parentNodeContent+"'?",cL)
                  }
                  else if(nodeContent == "Justificatory Knowledge"){
                    DScaffolding.removeTaskNode("What is the justificatory knowledge for '"+parentNodeContent+"'?",cL)
                  }
                }
              }
            }
          }
          Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
            if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
            else Scrap.hideWorkingMessage();
          })
          Hypothesis.updateLastUpdateDate(new Date().toISOString(),Scrap.mapID);
        })
      })
    }
    return {
      importAnnotationsMendeley: importAnnotationsMendeley,
      importAnnotationsHypothesis: importAnnotationsHypothesis
    }
  })()

function injectWidget(xpath,html,js){
  var xpathResult = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null );
  var parentNode = xpathResult.singleNodeValue;
  axios.get(html).then((response) => {
    let div = document.createElement("div")
    div.innerHTML = response.data
    let template = div.querySelector("template")
    let widgetClone = template.content.cloneNode(true)
    parentNode.appendChild(widgetClone)
    var s = document.createElement("script");
    s.src = js;
    document.body.appendChild(s);
    s.addEventListener("load",function(){
      registerEventListeners();
    })
  })
}

function removePoleTooltip(){
  var tooltip = document.getElementById("poleAntonymTooltip");
  if(tooltip != null) tooltip.parentNode.removeChild(tooltip);
}

function openPollURL(e){
  e.preventDefault();
  e.stopPropagation();
  var node, oldIcon;
  if(e.target.tagName == "IMG"){
    node = e.target.parentNode.parentNode;
    oldIcon = e.target.parentNode.getAttribute("icon-id");
  }
  else if(e.target.tagName == "DIV"){
    node = e.target.parentNode;
    oldIcon = e.target.getAttribute("icon-id");
  }
  if(node==null) return;
  var mapID = Scrap.mapID;
  var aux = NODE_POLL_MAPPING.find((el) => {return el.mapId==mapID && el.nodeId==node.id});
  if(aux!=null) chrome.runtime.sendMessage({mes: "openTab",tabURL: aux.pollURL});
}

function openPollAnswersURL(e){
  e.preventDefault();
  e.stopPropagation();
  var node, oldIcon;
  if(e.target.tagName == "IMG"){
    node = e.target.parentNode.parentNode;
    oldIcon = e.target.parentNode.getAttribute("icon-id");
  }
  else if(e.target.tagName == "DIV"){
    node = e.target.parentNode;
    oldIcon = e.target.getAttribute("icon-id");
  }
  if(node==null) return;
  var mapID = Scrap.mapID;
  var aux = NODE_POLL_MAPPING.find((el) => {return el.mapId==mapID && el.nodeId==node.id});
  if(aux!=null) chrome.runtime.sendMessage({mes: "openTab",tabURL: aux.answersURL});
}

function registerEventListeners(){
  var colorButtons = document.getElementsByClassName("mendeleyColorButton");
  for(var i=0;i<colorButtons.length;i++){
    colorButtons[i].addEventListener("click", function(){
      //updateColor();
    },false);
  }

  // color label remove buttons
  var removeColorLabel = document.getElementsByClassName("removeButton");
  for(var i=0;i<removeColorLabel.length;i++){
    removeColorLabel[i].addEventListener("click", function(){
      var color = this.parentNode.getAttribute("color");
      var purpose = PurposeManager.getPurpose(color);
      var purposeNodeId = purpose.nodeId;
      PurposeManager.removePurpose(purposeNodeId);
      if(purposeNodeId!=null){
        Scrap.showWorkingMessage();
        var cL = new Mindmeister.ChangeList();
        Mindmeister.decolorIdea(Scrap.mapID,purposeNodeId,cL)
        Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
          if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
          else Scrap.hideWorkingMessage();
        })
      }
    },false);
  }

  var div = document.getElementById("paste_ghost");
  div.addEventListener("keydown",function(e){
    if(e.keyCode == 9){ // tab key
    }
  })
  document.addEventListener("keydown",function(e){
    if(e.keyCode == 190){ // . key
      setTimeout(function(){
        var editingNode = e.target;
        if(editingNode==null) return;
        var n = new Scrap.Node(editingNode);
        if(!n.isDescendant(DScaffolding.NodesNew.templateNodes.PROBLEM_AS_DIFFICULTIES)) return;
        var editingNodeContent = editingNode.textContent;
        var poles = editingNodeContent.match(/\w+\s?\.\.\.\s?$/);
        if(poles != null){
          var pole = poles[0].substring(0,poles[0].indexOf("..."));
          var space = false;
          if(pole.charAt(pole.length-1)==" "){
            pole = pole.substring(0,pole.length-1);
            space = true;
          }
          Antonyms.selectAntonyms(pole).then(function(antonyms){
            var tooltip = document.createElement("div");
            tooltip.id = "poleAntonymTooltip";
            tooltip.className = "arrow_box";
            tooltip.style.border = "1px solid #00aaff";
            tooltip.style.padding = "20px";
            tooltip.style.backgroundColor = "#fff";
            tooltip.style.borderRadius = "10px 10px 10px 10px";
            tooltip.style.zIndex = 300;

            $('<style>.arrow_box {position: relative;background: #ffffff;border: 1px solid #00aaff;}.arrow_box:after, .arrow_box:before {top: 100%;left: 20%;border: solid transparent;content: " ";height: 0;width: 0;position: absolute;pointer-events: none;}.arrow_box:after {border-color: rgba(255, 255, 255, 0);border-top-color: #ffffff;border-width: 10px;margin-left: -10px;}.arrow_box:before {border-color: rgba(0, 0, 0, 0);border-top-color: #00aaff;border-width: 11px;margin-left: -11px;}</style>').appendTo('head');

            if(antonyms.length==0){
              var span = document.createElement("span");
              span.style.color = "#000";
              span.appendChild(document.createTextNode("No antonyms found"));
              tooltip.appendChild(span);
            }
            else{
              var span = document.createElement("span");
              span.style.color = "#000";
              span.appendChild(document.createTextNode("Antonyms: "));
              span.style.marginRight = "10px";
              tooltip.appendChild(span);
              var antList = document.createElement("ul");
              antList.style.marginTop = "5px";
              antList.style.listStyle = "none";
              for(var i=0;i<antonyms.length;i++){
                (function(antonym){
                  var antElem = document.createElement("li");
                  var ant = document.createElement("a");
                  ant.style.color = "#00aaff";
                  ant.style.cursor = "pointer";
                  if(i>0) ant.style.marginLeft = "10px";
                  ant.appendChild(document.createTextNode(antonym));
                  ant.addEventListener("click",function(e){
                    e.stopPropagation();
                    e.preventDefault();
                    removePoleTooltip();
                    var contentNode = $(editingNode);
                    var t = space ? contentNode.text() + " " + antonym : contentNode.text() + antonym;
                    contentNode.text(t);
                    $(contentNode).trigger("click");
                    $(contentNode).trigger("click");
                    var parentNode = Scrap.getCurrentNode().getParentNode();
                    $(parentNode).trigger("click");
                    $(contentNode).trigger("click");
                    $(contentNode).trigger("click");

                    setTimeout(function(){
                      var range = document.createRange();
                      range.selectNodeContents($(contentNode).get(0));
                      range.collapse(false);
                      var sel = window.getSelection();
                      sel.removeAllRanges();
                      sel.addRange(range);
                    },300);
                  },false);
                  antElem.appendChild(ant);
                  antList.appendChild(ant);
                })(antonyms[i]);
              }
              tooltip.appendChild(antList);
            }
            var tooltipPositionY = $(editingNode).offset().top;
            var tooltipPositoinX = $(editingNode).offset().left;
            tooltip.style.position = "fixed";
            tooltip.style.top = parseInt(tooltipPositionY-100)+"px";
            tooltip.style.left = parseInt(tooltipPositoinX-10)+"px";
            document.body.appendChild(tooltip);

            var removeTooltipKeydown = function(event){
              removePoleTooltip();
              document.removeEventListener("keydown",removeTooltipKeydown);
            }
            var removeTooltipClick = function(event){
              removePoleTooltip();
              document.removeEventListener("click",removeTooltipClick);
            }
            document.addEventListener("keydown",removeTooltipKeydown);
            document.addEventListener("click",removeTooltipClick);
          })
        }
      },300);
    }
  },true);
  $(".tk_icon_container[icon-id='pencil']").on("click",openPollURL);
  $(".tk_icon_container[icon-id='bar_chart']").on("click",openPollAnswersURL);

  var observer = new MutationObserver(function( mutations ) {
    mutations.forEach(function(mutation) {
      if(mutation.type=="childList"&&mutation.addedNodes!=null&&mutation.addedNodes.length>0){
        for(var i=0;i<mutation.addedNodes.length;i++){
          if(mutation.addedNodes[i].className==null||mutation.addedNodes[i].className==""||typeof mutation.addedNodes[i].className != "string") continue;
          if(mutation.addedNodes[i].className!=null&&mutation.addedNodes[i].className.indexOf("tk_icon_container")!=-1&&mutation.addedNodes[i].getAttribute("icon-id")!=null){
            if (mutation.addedNodes[i].getAttribute("icon-id")=="pencil") $(mutation.addedNodes[i]).on("click",openPollURL);
            else if(mutation.addedNodes[i].getAttribute("icon-id")=="bar_chart") $(mutation.addedNodes[i]).on("click",openPollAnswersURL);
          }
        }
      }
    });
  });
  var config = {
    childList: true,
    subtree: true
  };
  //var targetNode = $("#tk_map")[0];
  if($("#tk_map")!=null&&$("#tk_map").length>0) var targetNode = $("#tk_map")[0];
  else var targetNode = $("#canvas")[0];
  observer.observe(targetNode, config);

  $(".tk_icon_container[icon-id='arrows_counterclockwise']").on("click",function(e){
    e.preventDefault();
    e.stopPropagation();
    var node, oldIcon;
    if(e.target.tagName == "IMG"){
      node = e.target.parentNode.parentNode;
      oldIcon = e.target.parentNode.getAttribute("icon-id");
    }
    else if(e.target.tagName == "DIV"){
      node = e.target.parentNode;
      oldIcon = e.target.getAttribute("icon-id");
    }
    if(node==null) return;
    var n = new Scrap.Node(node);
    var nodeContent = n.getContent();
    /*if(nodeContent=="Drag&Drop root-causes into the categories below"){
      // TODO
      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList();
      var problemAsSolutionsSubtree = DScaffolding.Nodes.templateNodes.PROBLEM_AS_SOLUTIONS.getSubtree();
      var leaveList = [];
      for(var i=0;i<problemAsSolutionsSubtree.length;i++){
        var leaves = DScaffolding.getSubtreeLeaves(problemAsSolutionsSubtree[i]);
        for(var j=0;j<leaves.length;j++){
          if(leaves[j].getIcons().indexOf(DScaffolding.Icons.enabled)!=-1) leaveList.push(leaves[j]);
        }
      }
      var elicitRequirementsNode = Scrap.selectNodeWithText("Elicit Requirements");
      for(var i=0;i<leaveList.length;i++){
        var mirror = DScaffolding.getChildsWithText(elicitRequirementsNode,leaveList[i].text);
        if(mirror==null||mirror.length==0) promiseList.push(DScaffolding.cloneNode(document.getElementById(leaveList[i].id),node.id,false,true));
      }
      Promise.all(promiseList).then(function(){
        reloadCanvas();
      })
    }*/
    /*else if(nodeContent=='Drag&Drop these "hows" into the components below'){
      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList();

      var elicitRequirementsSubtree = DScaffolding.getNodeSubtree(DScaffolding.Nodes.templateNodes.ELICIT_REQUIREMENTS.id);
      var leaveList = [];
      for(var i=0;i<elicitRequirementsSubtree.length;i++){
        var leaves = DScaffolding.getSubtreeLeaves(elicitRequirementsSubtree[i]);
        for(var j=0;j<leaves.length;j++){
          var leafNode = document.getElementById(leaves[j].id)
          if(Scrap.selectContent(DScaffolding.getParentNode(leafNode))=="How?") leaveList.push(leaves[j]);
        }
      }
      var promiseList = [];
      for(var i=0;i<leaveList.length;i++){
        var whereToFind = DScaffolding.getParentNode(node);
        var mirror = DScaffolding.getChildsWithText(whereToFind,leaveList[i].text);
        if(mirror==null||mirror.length==0) promiseList.push(DScaffolding.cloneNode(document.getElementById(leaveList[i].id),node.id));
      }
      Promise.all(promiseList).then(function(){
        reloadCanvas();
      })
    }*/
    /*if(nodeContent=='Drag&Drop each property/hypothesis into one of the quadrants below'){
      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList()
      var purposeListNode = Scrap.selectNodeWithText("Determine the purpose(s) of your evaluation(s)");
      if(purposeListNode!=null){
        var chooseEvaluationMethod = Scrap.selectNodeWithText("Choose Evaluation Method");
        var purposes = DScaffolding.getChildsWithSubtext(purposeListNode,"Test this out.");
        var promiseList = [];
        for(var i=0;i<purposes.length;i++){
          var mirrors = DScaffolding.getChildsWithText(chooseEvaluationMethod,Scrap.selectContent(purposes[i]));
          if(mirrors==null||mirrors.length==0){
            promiseList.push(DScaffolding.cloneNode(document.getElementById(purposes[i].id),node.id));
          }
        }
        Promise.all(promiseList).then(function(){
          reloadCanvas();
        })
      }
    }*/
    if(nodeContent=='In the checklists below, tick any non-functional requirements that are relevant to your artefact. Where alleviating causes from your problem as opportunities above can help, Copy&Paste the causes to be alleviated onto the how nodes for the relevant non-functional requirement below.'){

      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList();

      var reqCausesNodeChildren = Nodes.templateNodes.REQ_REDUCE_CAUSES.getChildren(reqCausesNode);
      for(var i=0;i<reqCausesNodeChildren.length;i++){
        var reqExists = node.getChildrenWithText(reqCausesNodeChildren[i].getContent());
        if(reqExists==null||reqExists.length==0){
          var nodeToClone = document.getElementById(reqCausesNodeChildren[i].id);
          DScaffolding.cloneNodeBis(nodeToClone,node.id,cL);
        }
      }
      Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
        if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
        else Scrap.hideWorkingMessage();
      })
      /*var lessenCausesNode = Scrap.selectNodeWithText("Lessen Causes");
      var causesSubtree = DScaffolding.getNodeSubtree(lessenCausesNode.id);
      var leaves = [];
      var promiseList = [];
      showWorkingMessage();
      for(var i=0;i<causesSubtree.length;i++){
        var sL = DScaffolding.getSubtreeLeaves(causesSubtree[i]);
        leaves = leaves.concat(sL);
      }
      for(var i=0;i<leaves.length;i++){
        if(DScaffolding.isActivated(leaves[i])){
          var reqExists = DScaffolding.getChildsWithText(node,leaves[i].text);
          if(reqExists==null||reqExists.length==0){
            var nodeToClone = document.getElementById(leaves[i].id);
            promiseList.push(DScaffolding.cloneNode(nodeToClone,node.id));
          }
        }
      }
      Promise.all(promiseList).then(function(){
        reloadCanvas();
      })*/
    }
    else if(nodeContent=='Drag&Drop the "hows" from the requirements and design ideas above to the components you add below that will have responsibility or carry out that "how".'){
      var hows = Nodes.templateNodes.DECIDE_REQUIREMENTS_CAPTURE_IDEAS.getChildrenWithText("How?");
      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList();
      for(var i=0;i<hows.length;i++){
        var howChilds = hows[i].getChildren();
        for(var j=0;j<howChilds.length;j++){
          var isLeaf = howChilds[j].getChildren();
          if(isLeaf==null||isLeaf.length==0){
            var reqExists = node.getChildrenWithText(howChilds[j].getContent());
            if(reqExists==null||reqExists.length==0){
              var nodeToClone = document.getElementById(howChilds[j].id);
              DScaffolding.cloneNodeBis(nodeToClone,node.id,cL);
            }
          }
        }
      }
      Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
        if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
        else Scrap.hideWorkingMessage();
      })
    }
    else if(nodeContent=='Copy&Paste the requirements to be evaluated above into an evaluation episode in one of the four quadrants'){
      var pointToSearch = n.getParentNode().getParentNode().getNodesWithText("Define theoretical constructs and measures of requirements to be evaluated");

      Scrap.showWorkingMessage();
      var cL = new Mindmeister.ChangeList();

      for(var j=0;j<pointToSearch.length;j++){
        var requirementsToEvaluate = pointToSearch[j].getChildren();
        var promiseList = [];
        for(var i=0;i<requirementsToEvaluate.length;i++){
          var reqExists = n.getChildsWithText(requirementsToEvaluate[i].getContent());
          if(reqExists==null||reqExists.length==0){
            var nodeToClone = document.getElementById(requirementsToEvaluate[i].id);
            DScaffolding.cloneNodeBis(nodeToClone,node.id,cL);
          }
        }
      }
      Mindmeister.doChanges(Scrap.mapID,cL).then(function(changes){
        if(changes!=null&&changes.changeList!=null&&changes.changeList.length>0)Scrap.reloadCanvas(true,changes.changeList,changes.revision,changes.focusNodeId);
        else Scrap.hideWorkingMessage();
      })
    }
    /*else if(nodeContent=='Analyse Stakeholders'){
      showWorkingMessage();
      var mapID = Scrap.selectMapId();
      var analyseStakeholdersNode = Scrap.selectNodeWithText("Analyse Stakeholders");
      Mindmeister.modifyIdea(mapID,analyseStakeholdersNode.id,{icon:""}).then(function(){
        reloadCanvas();
      })
      reloadAnalysedStakeholders();
    }*/
  });
  $("<style>").prop("type", "text/css").html(".tk_icon_container[icon-id='status_ok'],.tk_icon_container[icon-id='status_error'],.tk_icon_container[icon-id='arrows_counterclockwise'] { cursor: pointer;}").appendTo("head");
  var exportMendeleyColorsButton = document.getElementById("exportMendeleyColors");
  if(exportMendeleyColorsButton){
    exportMendeleyColorsButton.addEventListener("click",function(e){
      var elemToExport = document.getElementById("selectedMendeleyColors");
      var removeButtons = elemToExport.getElementsByClassName("removeButton");
      for(var i=0;i<removeButtons.length;i++){
        removeButtons[i].style.visibility = "hidden";
      }
      /*html2canvas(elemToExport, {
        onrendered: function(canvas) {
          var ctx = canvas.getContext("2d");
          ctx.scale(2,2);
          canvas.style.display = "none";
          document.body.appendChild(canvas);
          var img = canvas.toDataURL("image/png");
          var a = document.createElement("a");
          a.download = "Cheat Sheet for Mendeley.png";
          a.href = img;
          a.target = "_blank";
          var clicEvent = new MouseEvent('click', {
                'view': window,
                'bubbles': true,
                'cancelable': true
          });
          a.dispatchEvent(clicEvent);
          for(var i=0;i<removeButtons.length;i++){
            removeButtons[i].style.visibility = "visible";
          }
        },
        height:$(elemToExport).height(),
        width:$(elemToExport).width()
      });
    })*/
    html2canvas(elemToExport, {
      height:$(elemToExport).height(),
      width:$(elemToExport).width()
    }).then(function(canvas){
        var ctx = canvas.getContext("2d");
        ctx.scale(2,2);
        canvas.style.display = "none";
        document.body.appendChild(canvas);
        var img = canvas.toDataURL("image/png");
        var a = document.createElement("a");
        a.download = "Cheat Sheet for Mendeley.png";
        a.href = img;
        a.target = "_blank";
        var clicEvent = new MouseEvent('click', {
          'view': window,
          'bubbles': true,
          'cancelable': true
        });
        a.dispatchEvent(clicEvent);
        for(var i=0;i<removeButtons.length;i++){
        removeButtons[i].style.visibility = "visible";
      }
    });
  })
  }
}

var widgets = [{"xpath": "//*[@id='design']", "html":chrome.extension.getURL("pages/Palette.html"), "js":chrome.extension.getURL("scripts/Palette.js")}];

function init(){
  Scrap.onMapLoad().then(function(){
    NavegabilityManager.init();
    PurposeManager.init();
    FeedbackManager.init();
    LatexGenerator.init();
    DScaffolding.getMapTemplate().then(function(){
      DScaffolding.updateTemplate().then(function(){
        DScaffolding.initTemplate().then(function(){
          registerEventListeners();
          if(Mendeley.isEnabled()){
            for(var i=0;i<widgets.length;i++){
              injectWidget(widgets[i].xpath,widgets[i].html,widgets[i].js);
            }
            AnnotationManager.importAnnotationsMendeley();
          }
          /*else{
            registerEventListeners();
          }*/
          if(Hypothesis.isEnabled()){
            AnnotationManager.importAnnotationsHypothesis();
          }
          /* TODO if comment notification enabled*/
          if(CommentNotification.isEnabled()) CommentNotification.monitorCommentShow();
          if(Assistant.isEnabled()&&DScaffolding.templateName=="Explicate Problem") Assistant.init();
          /*if(ArticleSuggestion.isEnabled()){
            DScaffolding.extractArticlesFromMap().then(function(articles){
              var initData = {
                mapID:Scrap.mapID,
                problemStatement:DScaffolding.getProblemStatement(),
                mapTerms:DScaffolding.extractTermsFromMap(),
                mapArticles:articles,
                mendeleyEnabled:MENDELEY_ENABLED
              };
              ArticleSuggestion.init(initData);
            });
            // TODO
          }*/
        })
      })
    })
  })
}

function auth(){
  let url = window.location.href;
  let regExp = /https:\/\/www\.mindmeister\.com\/\d+/i
  if(!regExp.test(url)) return

  chrome.storage.sync.get(["SYNC_MODE", "GITHUB_ENABLED", "MENDELEY_ENABLED", "HYPOTHESIS_ENABLED", "HYPOTHESIS_USER", "HYPOTHESIS_DEV_API_TOKEN", "DSCAFFOLDING_TEMPLATE_VERSIONING", "NODE_POLL_MAPPING","GOOGLE_FORMS_ENABLED","ARTICLE_SUGGESTION_ENABLED","MENDELEY_FOLDER_MANAGEMENT_ENABLED","COMMENT_NOTIFICATION_ENABLED","ASSISTANT_ENABLED"], function(options){
    DSCAFFOLDING_TEMPLATE_VERSIONING = options["DSCAFFOLDING_TEMPLATE_VERSIONING"] != null ? options["DSCAFFOLDING_TEMPLATE_VERSIONING"] : [];
    NODE_POLL_MAPPING = options["NODE_POLL_MAPPING"] != null ? options["NODE_POLL_MAPPING"] : [];
    GOOGLE_FORMS_ENABLED = options["GOOGLE_FORMS_ENABLED"] != null ? options["GOOGLE_FORMS_ENABLED"] : false;

    let githubEnabled = options["GITHUB_ENABLED"] != null ? options["GITHUB_ENABLED"] : false;
    Github.setEnabled(githubEnabled)

    let mendeleyEnabled = options["MENDELEY_ENABLED"] != null ? options["MENDELEY_ENABLED"] : false;
    Mendeley.setEnabled(mendeleyEnabled)
    let syncMode = options["SYNC_MODE"] != null ? options["SYNC_MODE"] : null;
    Mendeley.setSyncMode(syncMode)
    let folderManagementEnabled = options["MENDELEY_FOLDER_MANAGEMENT_ENABLED"] != null ? options["MENDELEY_FOLDER_MANAGEMENT_ENABLED"] : false;
    Mendeley.setFolderManagementEnabled(folderManagementEnabled)

    let hypothesisEnabled = options["HYPOTHESIS_ENABLED"] != null ? options["HYPOTHESIS_ENABLED"] : false;
    Hypothesis.setEnabled(hypothesisEnabled)
    let hypothesisDevToken = options["HYPOTHESIS_DEV_API_TOKEN"] != null ? options["HYPOTHESIS_DEV_API_TOKEN"] : null;
    let hypothesisUser = options["HYPOTHESIS_USER"] != null ? options["HYPOTHESIS_USER"] : null;

    let assistantEnabled = options["ASSISTANT_ENABLED"] != null ? options["ASSISTANT_ENABLED"] : false;
    Assistant.setEnabled(assistantEnabled)

    let articleSuggestionEnabled = options["ARTICLE_SUGGESTION_ENABLED"] != null ? options["ARTICLE_SUGGESTION_ENABLED"] : false;
    ArticleSuggestion.setEnabled(articleSuggestionEnabled)

    let commentNotificationEnabled = options["COMMENT_NOTIFICATION_ENABLED"] != null ? options["COMMENT_NOTIFICATION_ENABLED"] : false;
    CommentNotification.setEnabled(commentNotificationEnabled)

    chrome.runtime.sendMessage({mes: "isAuthorizedMindmeister"});
    if(Mendeley.isEnabled())chrome.runtime.sendMessage({mes: "isAuthorizedMendeley"});
    if(Github.isEnabled())chrome.runtime.sendMessage({mes: "isAuthorizedGithub"});
    if(Hypothesis.isEnabled()){
      if(hypothesisUser==null||hypothesisDevToken==null) showAuthorizeMessage();
      else{
        Hypothesis.setUser(hypothesisUser);
        Hypothesis.setDevAPIToken(hypothesisDevToken);
      }
    }
  })

  chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
    if(request.mesType == "accessTokenLost"){
      if(request.adapter=="mendeley"){
        Mendeley.setEnabled(false)
        Scrap.showAccessTokenLostMessage("Mendeley");
      }
      if(request.adapter=="mindmeister"){
        showAuthorizeMessage();
        Scrap.showAccessTokenLostMessage("MindMeister");
      }
      if(request.adapter=="github"){
        showAuthorizeMessage();
        Scrap.showAccessTokenLostMessage("Github");
      }
    }
    if(request.mesType == "refreshAccessToken"&&request.adapter=="mendeley"){
      Mendeley.setEnabled(false)
      Scrap.showRefreshAccessTokenMessage("mendeley");
      chrome.storage.sync.set({"MENDELEY_ENABLED":false});
    }
    if(request.mesType == "refreshAccessToken"&&request.adapter=="github"){
      Github.setEnabled(false)
      Scrap.showRefreshAccessTokenMessage("github");
      chrome.storage.sync.set({"GITHUB_ENABLED":false});
    }
    if(request.mesType == "accessToken"){
      if(request.adapter == "mindmeister"){
        Mindmeister.setAccessToken(request.accessToken);
        if((!Mendeley.isEnabled() || Mendeley.getAccessToken()!=null)&&(!Github.isEnabled() || Github.getAccessToken()!=null)){
          init();
        }
      }
      else if(request.adapter == "mendeley"){
        Mendeley.setAccessToken(request.accessToken);
        if((Mindmeister.getAccessToken()!=null)&&(!Github.isEnabled() || Github.getAccessToken()!=null)){
          init();
        }
      }
      else if(request.adapter == "github"){
        Github.setAccessToken(request.accessToken);
        Github.init();
        if((!Mendeley.isEnabled() || Mendeley.getAccessToken()!=null)&&(Mindmeister.getAccessToken()!=null)){
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
      else if(request.adapter == "github"){
        if(request.accessToken) chrome.runtime.sendMessage({mes: "getGithubAccessToken"});
        else Scrap.showAuthorizeMessage();
      }
    }
    else if(request.mesType == "authorizePairedComparisonDone"){
      DScaffolding.createPairedComparisonPoll();
    }
  })

}

auth();

})();
