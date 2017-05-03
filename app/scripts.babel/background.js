'use strict';
// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var statusAttachedTabs = {};
var tabsContent = {};
var version = '1.0';

chrome.debugger.onEvent.addListener(onEvent);
chrome.debugger.onDetach.addListener(onDetach);

chrome.browserAction.onClicked.addListener(function(tab) {
  var tabId = tab.id;
  var debuggeeId = {tabId:tabId};

  switch (statusAttachedTabs[tabId]) {
    case 'checking_contentscript':
    case 'stoping':
    case 'generating_project':
    case 'enabling_debugger':
      return;
  }

  tabsContent[tabId] = {};

  if (!statusAttachedTabs[tabId]) {
    initializeDebugger(tabId);
  } else if (statusAttachedTabs[tabId]) {
    statusAttachedTabs[tabId] = 'stoping';
    chrome.debugger.sendCommand(debuggeeId, 'Profiler.stop', function (profile) {
      tabsContent[tabId].profile = profile;
      chrome.debugger.detach(debuggeeId, onDetach.bind(null, debuggeeId));
    });
  }
});

chrome.runtime.onMessage.addListener(function(request, sender) {
  var tabId = sender.tab.id;

  switch (request.type) {
    case 'tab_content':
      statusAttachedTabs[tabId] = 'generating_project';
      tabsContent[tabId].tabContent = request.tabContent;
      var projectStructure = getProjectStructure(request.tabContent);
      angularEsprimaFun.createSemanticsFromSrc({
        pathAndSrcFiles: projectStructure.srcContent
      }, function (projectSemantics) {
        tabsContent[tabId].projectSemantics = projectSemantics;
        console.log(tabsContent[tabId]);
        debugger;
        //TODO: merge generated debugger data with project semantics
        resetToStartState(tabId);
      });
      break;

    case 'ack':
      statusAttachedTabs[tabId] = 'enabling_debugger';
      var debuggeeId = {tabId:tabId};
      chrome.debugger.attach(debuggeeId, version, onAttach.bind(null, debuggeeId));
      break;
  }
});

function initializeDebugger(tabId){
  statusAttachedTabs[tabId] = 'checking_contentscript';
  chrome.tabs.sendMessage(tabId, {action: 'ack'});
  var oneSecond = 1000;
  setTimeout(function(){
    if (statusAttachedTabs[tabId] === 'checking_contentscript') {
      confirmRestartTab(tabId);
    }
  }, oneSecond)
}

function confirmRestartTab(tabId){
  var problemMessage = 'There was a problem to get scripts content, please refresh the tab and click in "Record" button again. Do you want to refresh the tab?';
  if (confirm(problemMessage)) {
    var code = 'window.location.reload();';
    chrome.tabs.executeScript(tabId, {code: code});
  }
  resetToStartState(tabId);
}

function resetToStartState(tabId){
  chrome.browserAction.setIcon({tabId:tabId, path:'images/record-ng.png'});
  chrome.browserAction.setTitle({tabId:tabId, title:'Record AngularJs project'});
  delete tabsContent[tabId];
  delete statusAttachedTabs[tabId];
}

function getProjectStructure(tabContent) {
  var scriptsContent = tabContent.scriptsContent;
  var contentOnlyJs = _.filter(scriptsContent, (content) => {
    return content.path.includes('.js');
  });
  var contentGroupedByLevel = _.groupBy(contentOnlyJs, (content) => {
    return content.path.split('/').length;
  });

  var shortestLevel = 0;
  var largestLevel = 0;
  _.forIn(contentGroupedByLevel, function(value, key) {
    var level = parseInt(key);
    if (shortestLevel) {
      if (level < shortestLevel) {
        shortestLevel = level;
      }
    } else {
      shortestLevel = level;
    }

    if (level > largestLevel) {
      largestLevel = level;
    }
  });

  var angularContentWithShortestPath = null;
  for (var index = shortestLevel; index <= largestLevel; index++) {
    var scriptsContentByLevel = contentGroupedByLevel[index];
    var fileWithAngular = _.find(scriptsContentByLevel, (content) => {
      var isAngularFile = content.content.includes('angular.module');
      var isGoogleProperty = content.content.includes('(c) 2010-2015 Google, Inc.');
      return isAngularFile && !isGoogleProperty
    });
    if (fileWithAngular) {
      angularContentWithShortestPath = fileWithAngular;
      break;
    }
  }

  if (!angularContentWithShortestPath) {
    throw new Error('There\'s no Angular path!');
  }

  //TODO: we could ask if this is the project path

  var pathArrayProjectFile = angularContentWithShortestPath.path.split('/');
  var srcFolder = pathArrayProjectFile[0];
  if (_.isEmpty(srcFolder)) {
    srcFolder = pathArrayProjectFile[1];
  }
  var srcContent = [];
  var thirdPartyContent = [];
  scriptsContent.forEach(content => {
    if (content.path.includes(srcFolder)) {
      srcContent.push(content);
    } else {
      thirdPartyContent.push(content);
    }
  });

  return { srcContent, thirdPartyContent };
}

function onAttach(debuggeeId) {
  if (chrome.runtime.lastError) {
    alert(chrome.runtime.lastError.message);
    return;
  }

  var tabId = debuggeeId.tabId;
  chrome.browserAction.setIcon({tabId: tabId, path:'images/stop.png'});
  chrome.browserAction.setTitle({tabId: tabId, title:'Recording AngularJs project'});
  statusAttachedTabs[tabId] = 'recording';
  chrome.debugger.sendCommand(debuggeeId, 'Profiler.enable', {}, onDebuggerEnabled.bind(null, debuggeeId));
}

function onDebuggerEnabled(debuggeeId) {
  chrome.debugger.sendCommand(debuggeeId, 'Profiler.setSamplingInterval', { interval: 100 });
  chrome.debugger.sendCommand(debuggeeId, 'Profiler.start');
}

function onEvent(debuggeeId, method) {
  var tabId = debuggeeId.tabId;
  if (method == 'Debugger.paused') {
    statusAttachedTabs[tabId] = 'paused';
    chrome.browserAction.setIcon({tabId:tabId, path:'images/debuggerContinue.png'});
    chrome.browserAction.setTitle({tabId:tabId, title:'Resume JavaScript'});
  }
}

function onDetach(debuggeeId) {
  var tabId = debuggeeId.tabId;
  chrome.browserAction.setIcon({tabId:tabId, path:'images/stoping.png'});
  chrome.browserAction.setTitle({tabId:tabId, title:'Generating project structure'});
  chrome.tabs.sendMessage(tabId, {action: 'get_tab_content'});

  var tenSeconds = 10 * 1000;
  setTimeout(function(){
    if (statusAttachedTabs[tabId] === 'stoping') {
      confirmRestartTab(tabId);
    }
  }, tenSeconds)
}