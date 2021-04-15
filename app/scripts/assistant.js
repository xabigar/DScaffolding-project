var accumulatedOffsetX = 0;
var accumulatedOffsetY = 0;

function cleanScripts(){
  var scripts = document.querySelectorAll(".dscaffoldingScript");
  for(var i=scripts.length-1;i>=0;i--){
    scripts[i].parentNode.removeChild(scripts[i]);
  }
}

function unHighlightNodes(){
  var sc = document.createElement("script");
  sc.className = "dscaffoldingScript";
  sc.innerText = "function unhighlightChildren(n){for(var i=0;i<n.children.length;i++){n.children[i].highlight();unhighlightChildren(n.children[i]);}}unhighlightChildren(mapView.root);";
  document.body.appendChild(sc);
}


function manageMapHighlight(){
  var highlightColor = "#97d88c";
  var selectedNode = document.querySelector(".assistantBodyCont.selected");

  var scrollToShowNode = function(nodeText){
    var sc = document.createElement("script");
    sc.className = "dscaffoldingScript";
    sc.innerText = 'function dsScrollToNode(node){var pos = node.getTextPosition();var zoom = App.ui.Zoom.getZoomFactor();var containerWidth = parseInt(mapView.container.style.width.replace("px",""));var containerHeight = parseInt(mapView.container.style.height.replace("px",""));var totalX = (containerWidth/zoom)/1.0192;var totalY = (containerHeight/zoom)/1.1059;var finalX = pos[0]-(totalX*0.8);var finalY = pos[1]-(totalY*0.45)-(52);mapView.scrollTo([finalX,finalY],true);}function findNodeInChildren(node,text){if(node.node.title==text){dsScrollToNode(node);}else{for(var i=0;i<node.children.length;i++){findNodeInChildren(node.children[i],text);}}}';
    sc.innerText += "findNodeInChildren(mapView.root,'"+nodeText+"');";
    document.body.appendChild(sc);
  }

  var setScroll = function(x,y){
    var sc = document.createElement("script");
    sc.className = "dscaffoldingScript";
    var totalX = x-accumulatedOffsetX;
    var totalY = y-accumulatedOffsetY;
    sc.innerText = "mapView.scrollTo([mapView.getScrollLeft()+"+totalX+",mapView.getScrollTop()+"+totalY+"],true);";
    document.body.appendChild(sc);
    accumulatedOffsetY = y;
    accumulatedOffsetX = x;
  }
  var setHighlightedNodes = function(nodeText,descendants){
    var sc = document.createElement("script");
    sc.className = "dscaffoldingScript";
    sc.innerText = 'var nodeText = ["'+nodeText.join('","')+'"];';
    sc.innerText += "var descendants = '"+descendants+"';";
    sc.innerText += "var highlightColor = '"+highlightColor+"';";
    sc.innerText += "function highlightChildren(n){for(var i=0;i<n.children.length;i++){n.children[i].highlight(highlightColor,true);highlightChildren(n.children[i]);}}var nodes = mapView.root.children;for(var i=0;i<nodes.length;i++){if(nodeText.indexOf(nodes[i].node.title)!=-1){nodes[i].highlight(highlightColor,true);if(descendants){highlightChildren(nodes[i]);}}}"
    document.body.appendChild(sc);
  }

  // TO DO: ADAPT POSITIONS
  if(selectedNode.id=="assistantBodyDefinition"){
    scrollToShowNode("Set Problem Statement");
    //setScroll(-110,-150);
    unHighlightNodes();
    setHighlightedNodes(["Set Problem Statement"],false);
  }
  else if(selectedNode.id=="assistantBodyPosition"){
    scrollToShowNode("Describe Environment");
    //setScroll(-1050,0);
    unHighlightNodes();    
    setHighlightedNodes(["Describe Environment","Analyse Stakeholders"],true);
  }
  else if(selectedNode.id=="assistantBodyRCA"){
    scrollToShowNode("Assess Problem as Difficulties");
    //setScroll(-110,-70);
    unHighlightNodes();
    setHighlightedNodes(["Assess Problem as Difficulties","Assess Problem as Solutions"],true);
  }
}

var links = document.querySelectorAll(".assistantIndexElement");
for(var i=0;i<links.length;i++){
  (function(indexElem){
    indexElem.addEventListener("click",function(e){
      var d = document.querySelector(".assistantIndexElement.selected");
      d.className = d.className.replace("selected","");
      e.target.className += " selected";

      var a = document.querySelectorAll(".assistantIndexElement");
      for(var j=0;j<a.length;j++){
        if(a[j].id==e.target.id){
          var c = document.querySelector(".assistantBodyCont.selected");
          c.className = c.className.replace("selected","");
          var b = document.querySelectorAll(".assistantBodyCont")[j];
          b.className += " selected";
          if(j==0){
            document.querySelector("#assistantNextButton").style.display = "block";
            document.querySelector("#assistantPreviousButton").style.display = "none";
          }
          else if(j==a.length-1){
            document.querySelector("#assistantPreviousButton").style.display = "block";
            document.querySelector("#assistantNextButton").style.display = "none";
          }
          else{
            document.querySelector("#assistantNextButton").style.display = "block";
            document.querySelector("#assistantPreviousButton").style.display = "block";
          }
          manageMapHighlight();
          break;
        }
      }
    })
  })(links[i]);
}

document.getElementById("assistantOverlay").addEventListener("click",function(){
  var e = document.getElementById("dscaffoldingAssistant");
  e.parentNode.removeChild(e);
  var e2 = document.getElementById("dscaffoldingAssistantScript");
  e2.parentNode.removeChild(e2);
  unHighlightNodes();
  cleanScripts();
})

document.getElementById("assistantNextButton").addEventListener("click",function(){
  var e = document.querySelectorAll(".assistantIndexElement");
  for(var i=0;i<e.length;i++){
    if(e[i].className.indexOf("selected")!=-1){
      e[i].className = e[i].className.replace("selected","");
      var newSelected = document.querySelectorAll(".assistantIndexElement")[i+1];
      newSelected.className += " selected";
      var c = document.querySelector(".assistantBodyCont.selected");
      c.className = c.className.replace("selected","");
      var b = document.querySelectorAll(".assistantBodyCont")[i+1];
      b.className += " selected";
      if((i+1)==e.length-1){
        document.querySelector("#assistantPreviousButton").style.display = "block";
        document.querySelector("#assistantNextButton").style.display = "none";
      }
      else{
        document.querySelector("#assistantNextButton").style.display = "block";
        document.querySelector("#assistantPreviousButton").style.display = "block";
      }
      manageMapHighlight();
      break;
    }
  }
})

document.getElementById("assistantPreviousButton").addEventListener("click",function(){
  var e = document.querySelectorAll(".assistantIndexElement");
  for(var i=0;i<e.length;i++){
    if(e[i].className.indexOf("selected")!=-1){
      e[i].className = e[i].className.replace("selected","");
      var newSelected = document.querySelectorAll(".assistantIndexElement")[i-1];
      newSelected.className += " selected";
      var c = document.querySelector(".assistantBodyCont.selected");
      c.className = c.className.replace("selected","");
      var b = document.querySelectorAll(".assistantBodyCont")[i-1];
      b.className += " selected";
      if(i==1){
        document.querySelector("#assistantNextButton").style.display = "block";
        document.querySelector("#assistantPreviousButton").style.display = "none";
      }
      else{
        document.querySelector("#assistantNextButton").style.display = "block";
        document.querySelector("#assistantPreviousButton").style.display = "block";
      }
      manageMapHighlight();
      break;
    }
  }
})

document.getElementById("assistantCloseButton").addEventListener("click",function(){
  var e = document.getElementById("dscaffoldingAssistant");
  e.parentNode.removeChild(e);
  var e2 = document.getElementById("dscaffoldingAssistantScript");
  e2.parentNode.removeChild(e2);
  unHighlightNodes();
  cleanScripts();
})

