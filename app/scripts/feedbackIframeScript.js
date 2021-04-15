

if(location.href.indexOf("https://docs.google.com/forms/d/e/1FAIpQLSe2xoIEDZ1R-RvA7AfCL53I9OE6d8luN7bEOHaldv7xETn8Ow/formResponse?embedded=true")!=-1){

  var a = document.getElementsByClassName("freebirdFormviewerViewNavigationSubmitButton");
  for(var i=0;i<a.length;i++){
    a[i].addEventListener("click",function(){
      chrome.sync.get(["FEEDBACK_MANAGER"],function(options){
        var opt = options["FEEDBACK_MANAGER"] != null ? options["FEEDBACK_MANAGER"] : {};
        opt["answerSubmitted"] = true;
        chrome.sync.set({"FEEDBACK_MANAGER":opt});
      })
    },false);
  }

  /*var b = document.getElementsByClassName("freebirdFormviewerViewFormBanner");
  for(var j=0;j<b.length;j++){
    b[j].style.height = "150px";
  }*/

}
//if(a != null)
