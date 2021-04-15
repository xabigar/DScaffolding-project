
document.getElementById("feedbackOverlay").addEventListener("click",function(){
  var e = document.getElementById("dscaffoldingFeedback");
  e.parentNode.removeChild(e);
  var e2 = document.getElementById("dscaffoldingFeedbackScript");
  e2.parentNode.removeChild(e2);
})

document.getElementById("feedbackCloseButton").addEventListener("click",function(){
  var e = document.getElementById("dscaffoldingFeedback");
  e.parentNode.removeChild(e);
  var e2 = document.getElementById("dscaffoldingFeedbackScript");
  e2.parentNode.removeChild(e2);
})

var a = document.getElementById("feedbackQuestionnaireLink");
if(a!=null){
  a.addEventListener("click",function(){
    var b = document.getElementById("feedbackContainer");
    b.style.width = "700px";
    b.style.height = "600px";
    b.style.marginLeft = "-350px";
    b.style.marginTop = "-300px";
    var c = document.getElementById("feedbackBody");
    c.parentNode.removeChild(c);
    var d = document.createElement("iframe");
    d.src = "https://docs.google.com/forms/d/e/1FAIpQLSe2xoIEDZ1R-RvA7AfCL53I9OE6d8luN7bEOHaldv7xETn8Ow/viewform?embedded=true";
    d.width = "700";
    d.height = "600";
    d.frameBorder = "0";
    d.marginHeight = "0";
    d.marginWidth = "0";
    b.appendChild(d);
  },false);
}
