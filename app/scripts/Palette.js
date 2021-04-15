var mendeleyColors = [/*"fff5ad",*/"dcffb0","bae2ff","d3c2ff","ffc4fb","ffb5b6","ffdeb4","dbdbdb"];

var template = document.querySelector("#colorButtonTemplate");
var insertionPoint = document.querySelector("#mendeleycolors #mendeleyColorSelector");


var MENDELEY_ICON_BLUE = "data:image/png;base64,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";
var MENDELEY_ICON_WHITE = "data:image/png;base64,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";

var selectedColorsTemplate = document.querySelector("#selectedColorTemplate");
var selectedColorsTemplateTE = document.querySelector("#selectedColorTemplateTE");
var selectedInsertionPoint = document.querySelector("#selectedMendeleyColorList");
var selectedTEInsertionPoint = document.querySelector("#selectedMendeleyColorListTE");
var sClone = document.importNode(selectedColorsTemplate.content.querySelector("li"),true);
var sCloneTE = document.importNode(selectedColorsTemplateTE.content.querySelector("li"),true);


for(var i=0;i<mendeleyColors.length;i++){
  var clone = document.importNode(template.content.querySelector("li"),true);
  var a = clone.querySelector("a");
  a.setAttribute("color",mendeleyColors[i]);
  a.style.backgroundColor = "#"+mendeleyColors[i];
  a.onclick = function(){
    var selectedColor = document.getElementById("mendeleycolors").getElementsByClassName("selected");
    if(selectedColor.length>0) selectedColor[0].className = "";
    this.parentNode.className = "selected";
  }
  insertionPoint.appendChild(clone);

  var a = sClone.cloneNode(true);
  a.style.backgroundColor = "#"+mendeleyColors[i];
  a.setAttribute("color",mendeleyColors[i]);
  selectedInsertionPoint.appendChild(a);
  var clearDiv = document.createElement("div");
  clearDiv.style.clear = "both";
  selectedInsertionPoint.appendChild(clearDiv);
}


for(var i=0;i<mendeleyColors.length;i++){
  var a = sCloneTE.cloneNode(true);
  a.style.backgroundColor = "#"+mendeleyColors[i];
  a.setAttribute("color",mendeleyColors[i]);
  selectedTEInsertionPoint.appendChild(a);
}

var design = document.getElementById("design");
var insertionPoint = document.getElementById("btn_colors").parentNode;
var a = document.createElement("a");
a.id = "btn_mendeleycolors";
a.className = "widget-button tooltip";
a.href = "#";
a["kr"] = "";
a.onclick = function(){
  var elemContainer = document.getElementById("btn_colors").parentNode;
  var sel = elemContainer.getElementsByClassName("selected")[0];
  sel.className = sel.className.replace("selected","");
  var mendeleyElem = document.getElementById("btn_mendeleycolors");
  mendeleyElem.className = "widget-button tooltip selected";
  var img = document.getElementById("mendeleyColorId");
  img.src = MENDELEY_ICON_BLUE;

  var design = document.getElementById("design");
  var tabContentList = design.getElementsByClassName("mh-20");
  for(var i=0;i<tabContentList.length;i++){
    if((tabContentList[i].style.display == null)||(tabContentList[i].style.display != "none")){
      tabContentList[i].style.display = "none";
      break;
    }
  }
  var a = document.getElementById("mendeleycolors");
  a.style.display = "block";
}

var div = document.createElement("div");
div.className = "svg-icon ta-center h-overflow w-16 h-16 h-cp";
var img = document.createElement("img");
img.width = "16";
img.height = "16";
img.id = "mendeleyColorId";
img.src = MENDELEY_ICON_WHITE;
div.appendChild(img);
a.appendChild(div);
insertionPoint.appendChild(a);

var liElems = insertionPoint.getElementsByTagName("a");
for(var i=0;i<liElems.length;i++){
  if(liElems[i].id != "btn_mendeleycolors"){
    liElems[i].onclick = function(){
      var ul = document.getElementById("btn_colors").parentNode;
      var sel = ul.getElementsByClassName("selected")[0];
      var mc = document.getElementById("btn_mendeleycolors");
      if(mc.className.indexOf("selected")!=-1){
        mc.className = mc.className.replace("selected","");
        var img = document.getElementById("mendeleyColorId");
        img.src = MENDELEY_ICON_WHITE;
      }
      sel.className = sel.className.replace("selected","");
      this.className += " selected";
      var mcD = document.getElementById("mendeleycolors");
      mcD.style.display = "none";
      var selectedColor = mcD.getElementsByClassName("selected");
      if(selectedColor.length>0) selectedColor[0].className = "";

      if(this.id == "btn_colors") document.getElementById("colors").style.display = "block";
      if(this.id == "btn_styles") document.getElementById("styles").style.display = "block";
      if(this.id == "btn_boundaries") document.getElementById("boundaries").style.display = "block";
    }
  }
}

/*var hideSidebarButton = document.getElementById("btn-hide-sidebar");
hideSidebarButton.addEventListener("click",function(){
  setTimeout(function(){
    //var mendeleyColorsButton = document.getElementById("btn_mendeleycolors");
    //mendeleyColorsButton.className = "widget-button tooltip";
    //var img = document.getElementById("mendeleyColorId");
    //img.src = MENDELEY_ICON_WHITE;
    //var mendeleyColorsContent = document.getElementById("mendeleycolors");
    //mendeleyColorsContent.style.display = "none";
  },500);
})*/