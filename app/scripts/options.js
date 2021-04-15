
  const $ = require('jquery')
  window.$ = $
  require('bootstrap')

  const BootstrapSlider = require('bootstrap-slider')

  var SYNC_MODE;
  var MENDELEY_ENABLED;

  chrome.storage.sync.get(["MENDELEY_ENABLED", "GITHUB_ENABLED", "HYPOTHESIS_ENABLED", "GOOGLE_FORMS_ENABLED", "SYNC_MODE", "COMPLETENESS_OPTIONS", "MENDELEY_FOLDER_MANAGEMENT_ENABLED", "ARTICLE_SUGGESTION_ENABLED", "ARTICLE_SUGGESTION_CONF", "COMMENT_NOTIFICATION_ENABLED", "ASSISTANT_ENABLED"], function (options) {
    var mendeleyEnabled = options["MENDELEY_ENABLED"];
    var githubEnabled = options["GITHUB_ENABLED"];
    var hypothesisEnabled = options["HYPOTHESIS_ENABLED"];
    var syncMode = options["SYNC_MODE"];
    var googleFormsEnabled = options["GOOGLE_FORMS_ENABLED"];
    var completenessOptions = options["COMPLETENESS_OPTIONS"];
    var mendeleyFolderManagement = options["MENDELEY_FOLDER_MANAGEMENT_ENABLED"];
    var commentNotificationManagement = options["COMMENT_NOTIFICATION_ENABLED"];
    var assistant = options["ASSISTANT_ENABLED"];
    var articleSuggestion = options["ARTICLE_SUGGESTION_ENABLED"];
    var articleSuggestionConf = options["ARTICLE_SUGGESTION_CONF"];

    if (mendeleyEnabled != null) {
      if (!mendeleyEnabled) {
        //mendeleyContainerBody.className = "disabled";
      }
      else {
        var mendeleyEnable = document.getElementById("mendeleyEnable");
        mendeleyEnable.className = mendeleyEnable.className.replace("disabled", "enabled");
        var mendeleyEnableCheckbox = document.getElementById("mendeleyEnableCheckbox");
        mendeleyEnableCheckbox.checked = true;
        var projectMatching = document.getElementById("mendeleyProjectMatching");
        projectMatching.style.display = "block";
      }
    }
    if (hypothesisEnabled != null) {
      if (!hypothesisEnabled) {
        //hypothesisContainerBody.className = "disabled";
      }
      else {
        var hypothesisEnable = document.getElementById("hypothesisEnable");
        hypothesisEnable.className = hypothesisEnable.className.replace("disabled", "enabled");
        var hypothesisEnableCheckbox = document.getElementById("hypothesisEnableCheckbox");
        hypothesisEnableCheckbox.checked = true;
      }
    }
    if (githubEnabled != null) {
      if (!githubEnabled) {
        //hypothesisContainerBody.className = "disabled";
      }
      else {
        var githubEnable = document.getElementById("githubEnable");
        githubEnable.className = githubEnable.className.replace("disabled", "enabled");
        var githubEnableCheckbox = document.getElementById("githubEnableCheckbox");
        githubEnableCheckbox.checked = true;
      }
    }
    if (googleFormsEnabled != null) {
      if (!googleFormsEnabled) {
        //hypothesisContainerBody.className = "disabled";
      }
      else {
        var googleFormsEnable = document.getElementById("googleFormsEnable");
        googleFormsEnable.className = googleFormsEnable.className.replace("disabled", "enabled");
        var googleFormsEnableCheckbox = document.getElementById("googleFormsEnableCheckbox");
        googleFormsEnableCheckbox.checked = true;
      }
    }
    if (syncMode != null) {
      var selected = document.querySelector("#rootNode option[value='" + syncMode + "'");
      if (selected != null) selected.setAttribute("selected", "selected");
    }

    var completenessNodes = ["describePractice", "ascertainCauses", "ascertainConsequences"/*,"supportingEvidencesCauses","supportingEvidencesConsequences"*/];
    for (var i = 0; i < completenessNodes.length; i++) {
      var r = $('#' + completenessNodes[i] + " .references").slider({
        formatter: function (value) {
          return value;
        }
      })
      if (completenessOptions != null && completenessOptions[completenessNodes[i]] != null && completenessOptions[completenessNodes[i]].references != null) r.slider("setValue", completenessOptions[completenessNodes[i]].references);
      var d = $('#' + completenessNodes[i] + " .descendants").slider({
        formatter: function (value) {
          return value;
        }
      });
      if (completenessOptions != null && completenessOptions[completenessNodes[i]] != null && completenessOptions[completenessNodes[i]].descendants != null) d.slider("setValue", completenessOptions[completenessNodes[i]].descendants);
      var c = $('#' + completenessNodes[i] + " .children").slider({
        formatter: function (value) {
          return value;
        }
      });
      if (completenessOptions != null && completenessOptions[completenessNodes[i]] != null && completenessOptions[completenessNodes[i]].references != null) c.slider("setValue", completenessOptions[completenessNodes[i]].children);
    }

    var config = {attributes: true};
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.attributeName == "value") {
          var target = mutation.target;
          var completenessOption = target.className;
          var node = target.parentNode.parentNode.id;
          if (completenessNodes.indexOf(node) != -1) {
            var changedValue = target.getAttribute("value");
            setTimeout(function (oldValue, mapNode, option) {
              var newValue = document.querySelector("#" + mapNode + " ." + option).getAttribute("value");
              if (newValue == oldValue) {
                chrome.storage.sync.get(["COMPLETENESS_OPTIONS"], function (options) {
                  var comp = options["COMPLETENESS_OPTIONS"] != null ? options["COMPLETENESS_OPTIONS"] : {};
                  var update = false;
                  if (comp[node] == null) {
                    comp[node] = {};
                    comp[node][completenessOption] = parseInt(newValue);
                    update = true;
                  }
                  else if (comp[node][completenessOption] == null || comp[node][completenessOption] != parseInt(newValue)) {
                    comp[node][completenessOption] = parseInt(newValue);
                    update = true;
                  }
                  if (update) {
                    chrome.storage.sync.set({
                      "COMPLETENESS_OPTIONS": comp
                    });
                  }
                });
              }
            }, 2000, changedValue, node, completenessOption);
          }
        }
      });
    });

    var accordionInputs = document.getElementById("accordion").querySelectorAll("input");
    for (var i = 0; i < accordionInputs.length; i++) {
      if (accordionInputs[i].className == null || accordionInputs[i].className == "") continue;
      if (accordionInputs[i].className.indexOf("references") != -1 || accordionInputs[i].className.indexOf("descendants") != -1 || accordionInputs[i].className.indexOf("children") != -1) {
        observer.observe(accordionInputs[i], config);
      }
    }
    if (mendeleyFolderManagement != null && mendeleyFolderManagement) {
      var checkbox = document.getElementById("mendeley-folder-management-checker");
      checkbox.checked = true;
    }
    if (commentNotificationManagement != null && commentNotificationManagement) {
      var checkbox = document.getElementById("comment-notification-checker");
      checkbox.checked = true;
    }
    if (assistant != null && assistant) {
      var checkbox = document.getElementById("assistant-checker");
      checkbox.checked = true;
    }
    /*if (articleSuggestion != null && articleSuggestion) {
      var checkbox = document.getElementById("article-suggestion-checker");
      checkbox.checked = true;
    }*/
    // ARTICLE SUGGESTON CONF
    /*if (articleSuggestionConf["citeSuggestionsEnabled"] != null) {
      var checkbox = document.getElementById("cite-suggestions-checker");
      checkbox.checked = articleSuggestionConf["citeSuggestionsEnabled"];
    }
    if (articleSuggestionConf["relatedSuggestionsEnabled"] != null) {
      var checkbox = document.getElementById("related-suggestions-checker");
      checkbox.checked = articleSuggestionConf["relatedSuggestionsEnabled"];
    }
    if (articleSuggestionConf["termSuggestionsEnabled"] != null) {
      var checkbox = document.getElementById("term-suggestions-checker");
      checkbox.checked = articleSuggestionConf["termSuggestionsEnabled"];
    }
    if (articleSuggestionConf != null && articleSuggestionConf["suggestionFrequency"] != null) {
      var oldSelected = document.querySelector("#suggestionFrequency option[selected='selected'");
      if (oldSelected != null) oldSelected.removeAttribute("selected");
      var selected = document.querySelector("#suggestionFrequency option[value='" + articleSuggestionConf["suggestionFrequency"] + "'");
      if (selected != null) selected.setAttribute("selected", "selected");
    }
    if (articleSuggestionConf != null && articleSuggestionConf["suggestionCount"] != null) {
      var oldSelected = document.querySelector("#suggestionCount option[selected='selected'");
      if (oldSelected != null) oldSelected.removeAttribute("selected");
      var selected = document.querySelector("#suggestionCount option[value='" + articleSuggestionConf["suggestionCount"] + "'");
      if (selected != null) selected.setAttribute("selected", "selected");
    }*/
  })

  document.getElementById('mendeleyEnableCheckbox').addEventListener('change', function () {
    var enabled = document.getElementById("mendeleyEnableCheckbox").checked;
    if (enabled) chrome.runtime.sendMessage({mes: "authorizeMendeley"});
    else {
      chrome.storage.sync.set({
        "MENDELEY_ENABLED": false
      }, function () {
        var div = document.getElementById("mendeleyEnable");
        div.className = div.className.replace("enabled", "disabled");
        var projectMatching = document.getElementById("mendeleyProjectMatching");
        projectMatching.style.display = "none";
        // SHOW MESSAGE
      });
    }
  });

  document.getElementById('githubEnableCheckbox').addEventListener('change', function () {
    var enabled = document.getElementById("githubEnableCheckbox").checked;
    if (enabled) chrome.runtime.sendMessage({mes: "authorizeGithub"});
    else {
      chrome.storage.sync.set({
        "GITHUB_ENABLED": false
      }, function () {
        var div = document.getElementById("githubEnable");
        div.className = div.className.replace("enabled", "disabled");
        // SHOW MESSAGE
      });
    }
  });

  document.getElementById('hypothesisEnableCheckbox').addEventListener('change', function () {
    var enabled = document.getElementById("hypothesisEnableCheckbox").checked;
    if (enabled) chrome.runtime.sendMessage({mes: "authorizeHypothesis"});
    else {
      chrome.storage.sync.set({
        "HYPOTHESIS_ENABLED": false
      }, function () {
        chrome.runtime.sendMessage({mes: "reloadBrowserAction"})
        var div = document.getElementById("hypothesisEnable");
        div.className = div.className.replace("enabled", "disabled");
        // SHOW MESSAGE
      });
    }
  });

  document.getElementById('googleFormsEnableCheckbox').addEventListener('change', function () {
    var enabled = document.getElementById("googleFormsEnableCheckbox").checked;
    if (enabled) chrome.runtime.sendMessage({mes: "authorizeGoogleForms"});
    else {
      chrome.storage.sync.set({
        "GOOGLE_FORMS_ENABLED": false
      }, function () {
        var div = document.getElementById("googleFormsEnable");
        div.className = div.className.replace("enabled", "disabled");
        // SHOW MESSAGE
      });
    }
  });

  document.getElementById('mindmeisterEnableCheckbox').addEventListener('change', function () {
    var enabled = document.getElementById("mindmeisterEnableCheckbox").checked;
    if (enabled) chrome.runtime.sendMessage({mes: "authorizeMindmeister"});
    else {
      // TO DO - WHAT?
    }
  });

  var completenessInputs = document.querySelectorAll(".completeness input");
  for (var i = 0; i < completenessInputs.length; i++) {
    completenessInputs[i].addEventListener("change", function (e) {
      var node = e.target.parentNode.id;
      var c = e.target.className;
      chrome.storage.sync.get(["COMPLETENESS_OPTIONS"], function (options) {
        var comp = options["COMPLETENESS_OPTIONS"] != null ? options["COMPLETENESS_OPTIONS"] : {};
        if (comp[node] == null) {
          comp[node] = {};
          comp[node][c] = e.target.value;
        }
        else comp[node][c] = e.target.value;
        chrome.storage.sync.set({
          "COMPLETENESS_OPTIONS": comp
        });
      });
    })
  }

  document.getElementById('rootNode').addEventListener('change', function () {
    var mode = document.getElementById("rootNode").value;
    chrome.storage.sync.set({
      "SYNC_MODE": mode
    }, function () {
      var status = document.getElementById('status');
      status.textContent = 'Options saved.';
      setTimeout(function () {
        status.textContent = '';
      }, 1000);
    });
  });

  function showAuthorizationSuccessMessage (message, success) {
    var div = document.getElementById("authorizationSuccess");
    div.innerHTML = message;
    div.style.display = "block";
    setTimeout(function () {
      var div = document.getElementById("authorizationSuccess");
      div.style.display = "none";
    }, 5000);
  }

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.mesType == "isAuthorized") {
      if (request.adapter == "mindmeister" && request.accessToken) {
        var div = document.getElementById("mindmeisterEnable");
        div.className = div.className.replace("disabled", "enabled");
        var aux = document.getElementById("mindmeisterEnableCheckbox");
        aux.checked = true;
        aux.disabled = true;
      }
      /*else if(request.adapter == "mendeley" && request.accessToken){
        var div = document.getElementById("mendeleyEnable");
        div.className = div.className.replace("disabled","enabled");
        var aux = document.getElementById("mendeleyEnableCheckbox");
        aux.checked = true;
        var lag = document.getElementById("mendeleyProjectMatching");
        lag.style.display = "block";
      }
      else if(request.adapter == "hypothesis"){
        var div = document.getElementById("hypothesisEnable");
        div.className = div.className.replace("disabled","enabled");
        var aux = document.getElementById("hypothesisEnableCheckbox");
        aux.checked = true;
      }*/
    }
    else if (request.mesType == "accessToken" && request.mes == "done") {
      if (request.adapter == "mindmeister") {
        var div = document.getElementById("mindmeisterEnable");
        div.className = div.className.replace("disabled", "enabled");
        var aux = document.getElementById("mindmeisterEnableCheckbox");
        aux.checked = true;
        aux.disabled = true;
        if (request.interactionRequired != null && request.interactionRequired == true) showAuthorizationSuccessMessage("Authorization with Mindmeister done successfully");
      }
      else if (request.adapter == "mendeley") {
        var div = document.getElementById("mendeleyEnable");
        div.className = div.className.replace("disabled", "enabled");
        var aux = document.getElementById("mendeleyEnableCheckbox");
        aux.checked = true;
        var projectMatching = document.getElementById("mendeleyProjectMatching");
        projectMatching.style.display = "block";
        if (request.interactionRequired != null && request.interactionRequired == true) showAuthorizationSuccessMessage("Authorization with Mendeley done successfully");
        chrome.storage.sync.set({
          "MENDELEY_ENABLED": true
        });
      }
      else if (request.adapter == "github") {
        var div = document.getElementById("githubEnable");
        div.className = div.className.replace("disabled", "enabled");
        var aux = document.getElementById("githubEnableCheckbox");
        aux.checked = true;
        if (request.interactionRequired != null && request.interactionRequired == true) showAuthorizationSuccessMessage("Authorization with Github done successfully");
        chrome.storage.sync.set({
          "GITHUB_ENABLED": true
        });
      }
      else if (request.adapter == "hypothesis") {
        var div = document.getElementById("hypothesisEnable");
        div.className = div.className.replace("disabled", "enabled");
        var aux = document.getElementById("hypothesisEnableCheckbox");
        aux.checked = true;
        if (request.interactionRequired != null && request.interactionRequired == true) showAuthorizationSuccessMessage("Authorization with Hypothes.is done successfully");
        chrome.storage.sync.set({
          "HYPOTHESIS_ENABLED": true
        },function(){
          chrome.runtime.sendMessage({mes: "reloadBrowserAction"})
        });
      }
      else if (request.adapter == "googleForms") {
        var div = document.getElementById("googleFormsEnable");
        div.className = div.className.replace("disabled", "enabled");
        var aux = document.getElementById("googleFormsEnableCheckbox");
        aux.checked = true;
        if (request.interactionRequired != null && request.interactionRequired == true) showAuthorizationSuccessMessage("Authorization with Google Forms done successfully");
        chrome.storage.sync.set({
          "GOOGLE_FORMS_ENABLED": true
        });
      }
    }
    else if (request.mesType == "accessToken" && request.adapter == "hypothesis" && request.mes == "redo") {
      chrome.runtime.sendMessage({mes: "authorizeHypothesis"});
    }
  })

  chrome.runtime.sendMessage({mes: "isAuthorizedMindmeister"});

  document.getElementById('mendeley-folder-management-checker').addEventListener('change', function () {
    var enabled = document.getElementById("mendeley-folder-management-checker").checked;
    chrome.storage.sync.set({"MENDELEY_FOLDER_MANAGEMENT_ENABLED": enabled});
  });

  document.getElementById('comment-notification-checker').addEventListener('change', function () {
    var enabled = document.getElementById("comment-notification-checker").checked;
    chrome.storage.sync.set({"COMMENT_NOTIFICATION_ENABLED": enabled});
    chrome.runtime.sendMessage({mes: "commentNotificationManagement", enable: enabled});
  });

  document.getElementById('assistant-checker').addEventListener('change', function () {
    var enabled = document.getElementById("assistant-checker").checked;
    chrome.storage.sync.set({"ASSISTANT_ENABLED": enabled});
  });

  /*document.getElementById('article-suggestion-checker').addEventListener('change', function(){
    var enabled = document.getElementById("article-suggestion-checker").checked;
    chrome.storage.sync.set({"ARTICLE_SUGGESTION_ENABLED":enabled});
  });*/

  /*document.getElementById('cite-suggestions-checker').addEventListener('change', function(){
    chrome.storage.sync.get(["ARTICLE_SUGGESTION_CONF"], function(options){
      var conf = options["ARTICLE_SUGGESTION_CONF"] != null ? options["ARTICLE_SUGGESTION_CONF"] : {};
      var enabled = document.getElementById("cite-suggestions-checker").checked;
      conf["citeSuggestionsEnabled"] = enabled;
      chrome.storage.sync.set({"ARTICLE_SUGGESTION_CONF":conf});
    });
  });

  document.getElementById('related-suggestions-checker').addEventListener('change', function(){
    chrome.storage.sync.get(["ARTICLE_SUGGESTION_CONF"], function(options){
      var conf = options["ARTICLE_SUGGESTION_CONF"] != null ? options["ARTICLE_SUGGESTION_CONF"] : {};
      var enabled = document.getElementById("related-suggestions-checker").checked;
      conf["relatedSuggestionsEnabled"] = enabled;
      chrome.storage.sync.set({"ARTICLE_SUGGESTION_CONF":conf});
    });
  });

  document.getElementById('term-suggestions-checker').addEventListener('change', function(){
    chrome.storage.sync.get(["ARTICLE_SUGGESTION_CONF"], function(options){
      var conf = options["ARTICLE_SUGGESTION_CONF"] != null ? options["ARTICLE_SUGGESTION_CONF"] : {};
      var enabled = document.getElementById("term-suggestions-checker").checked;
      conf["termSuggestionsEnabled"] = enabled;
      chrome.storage.sync.set({"ARTICLE_SUGGESTION_CONF":conf});
    });
  });

  document.getElementById('suggestionFrequency').addEventListener('change', function(){
    chrome.storage.sync.get(["ARTICLE_SUGGESTION_CONF"], function(options){
      var conf = options["ARTICLE_SUGGESTION_CONF"] != null ? options["ARTICLE_SUGGESTION_CONF"] : {};
      var val = document.getElementById("suggestionFrequency").value;
      conf["suggestionFrequency"] = val;
      chrome.storage.sync.set({"ARTICLE_SUGGESTION_CONF":conf});
    });
  });

  document.getElementById('suggestionCount').addEventListener('change', function(){
    chrome.storage.sync.get(["ARTICLE_SUGGESTION_CONF"], function(options){
      var conf = options["ARTICLE_SUGGESTION_CONF"] != null ? options["ARTICLE_SUGGESTION_CONF"] : {};
      var val = document.getElementById("suggestionCount").value;
      conf["suggestionCount"] = val;
      chrome.storage.sync.set({"ARTICLE_SUGGESTION_CONF":conf});
    });
  });

  $('#article-suggestion-checker').on('click', function(e){
    e.stopPropagation();
    $(this).parent().trigger('click');   // <---  HERE
  })
  $('#article-suggestion-options').on('show.bs.collapse', function(e){
    if( ! $('#article-suggestion-checker').is(':checked') )
    {
      return false;
    }
  });
  */
