var findComment = function(comment){
	return comment.id == this;
}

document.addEventListener("DOMContentLoaded", function() {
  chrome.storage.sync.get(["UNREAD_COMMENTS"], function(options){
    var commentsAux = options["UNREAD_COMMENTS"] != null ? options["UNREAD_COMMENTS"] : [];
    /*var commentsAux = [
    	{author:"Jeremias Perez",
    	date:"04/04/2018",
    	comment:"Comment by the supervisor",
    	id:"12345678",
    	nodeText:"cons1",
    	nodeId:"1041169627",
    	mapId:"1041169040",
    	mapTitle:"Explicate Problem for <name your project>"},
    	{author:"Oscar Diaz",
    	date:"04/04/2018",
    	comment:"2nd comment",
    	id:"1234235275636",
    	nodeText:"Cause 1.1",
    	nodeId:"13345666",
    	mapId:"1234567876543",
    	mapTitle:"This is the title for the map"}
	]*/
	var template = document.getElementById("commentTemplate");
	var tempCont = template.querySelector("#templateCont");
	for(var i=0;i<commentsAux.length;i++){
		(function(c){
		  	var comment = template.content.cloneNode(true);
		  	comment.querySelector(".checkbox").value = c.id;
		  	comment.querySelector(".checkbox").addEventListener("click",function(){
		  		var a = document.querySelector(".checkbox:checked");
		  		if(a!=null) document.querySelector("#markAsRead").removeAttribute("disabled");
		  		else document.querySelector("#markAsRead").setAttribute("disabled","disabled");
		  	})
			comment.querySelector(".author").innerHTML = c.author;
			comment.querySelector(".date").innerHTML = c.date;
			comment.querySelector(".text").innerHTML = c.comment;
			comment.querySelector(".node").href = "http://www.mindmeister.com/"+c.nodeId;
			comment.querySelector(".mindmap").href = "http://www.mindmeister.com/"+c.mapId;
			comment.querySelector(".mindmap").innerHTML = c.mapTitle;
			comment.querySelector(".node").innerHTML = c.nodeText;
			comment.querySelector(".sendReplyButton").addEventListener("click",function(e){
				var button = e.target;
				var textarea = button.parentNode.querySelector("textarea");
				if(textarea.value=="") return;
				chrome.runtime.sendMessage({mes: "postComment",nodeId:c.nodeId,mapId:c.mapId,comment:textarea.value});
				chrome.storage.sync.get(["UNREAD_COMMENTS"], function(options){
					var com = options["UNREAD_COMMENTS"] != null ? options["UNREAD_COMMENTS"] : [];
					var fCom = com.findIndex(findComment,c.id);
					if(fCom!=-1) com.splice(fCom,1);
					button.parentNode.parentNode.parentNode.parentNode.parentNode.removeChild(button.parentNode.parentNode.parentNode.parentNode);
					chrome.storage.sync.set({"UNREAD_COMMENTS":com});
					chrome.runtime.sendMessage({mes: "reloadBrowserAction"});
				});
			})
			document.getElementById("commentList").appendChild(comment);
		})(commentsAux[i]);		
	}
	document.querySelector("#markAsRead").addEventListener("click",function(){
		var selectedComments = document.querySelectorAll(".checkbox:checked");
		if(selectedComments.length==0) return;
		chrome.storage.sync.get(["UNREAD_COMMENTS"], function(options){
			var com = options["UNREAD_COMMENTS"] != null ? options["UNREAD_COMMENTS"] : [];
			for(var i=0;i<selectedComments.length;i++){
				var fCom = com.findIndex(findComment,selectedComments[i].value);
				if(fCom!=-1) com.splice(fCom,1);
				selectedComments[i].parentNode.parentNode.parentNode.removeChild(selectedComments[i].parentNode.parentNode);
			}
			chrome.storage.sync.set({"UNREAD_COMMENTS":com});
			chrome.runtime.sendMessage({mes: "reloadBrowserAction"});
		});
	})
	var replyButtons = document.querySelectorAll(".replyButton");
	for(var i=0;i<replyButtons.length;i++){
		replyButtons[i].addEventListener("click",function(e){
			var button = e.target;
			if(button.className.indexOf("active")==-1){
				var textareaCont = button.parentNode.parentNode.querySelector(".replyCont");
				textareaCont.style.display = "block";
				button.className += " active";
			}
			else{
				var textareaCont = button.parentNode.parentNode.querySelector(".replyCont");
				textareaCont.style.display = "none";
				button.className = button.className.replace("active","");
			}
		})
	}	
  });
});