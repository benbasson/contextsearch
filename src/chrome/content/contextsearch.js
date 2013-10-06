/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Context Search.
 *
 * The Initial Developer of the Original Code is
 *   Ben Basson <ben@basson.at>
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Basson <ben@basson.at>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var contextsearch =
{
  /**
   * Text node type list - for checking node types where
   * the menu should be displayed.
   */
  _textNodeTypes: {
    "text": true
  , "search": true
  , "url": true
  , "email": true
  , "tel": true
  , "date": true
  }

  /**
   * Array of preferences to observe for changes.
   */
, _prefsToObserve: [
    "extensions.contextsearch.hideStandardContextItem"
  , "extensions.contextsearch.quoteStringsWithSpaces"
  , "extensions.contextsearch.separatorItems"
  , "browser.tabs.loadInBackground"
  ]

  /**
   * Initialising function.
   */
, load: function () {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                  .getService(Components.interfaces.nsIPrefService);
    
    // Observe pref changes and store result rather than fetching each time
    var prefsObserver = new GenericPrefObserver(
      prefs
    , contextsearch._prefsToObserve
    , function (aName, aValue) {
        contextsearch.prefsMap[aName] = aValue;
      }
    );
    
    // Register the observer and set it up to deregister on unload
    prefsObserver.register();
    window.addEventListener("unload", function () {
      prefsObserver.unregister();
    }, false);
    
    // Init array and trigger pref fetch callback for each pref we want to observe
    contextsearch.prefsMap = new Array();
    for (var n in contextsearch._prefsToObserve) {
      prefsObserver.observe(null, "nsPref:changed", contextsearch._prefsToObserve[n]);
    }
             
    // Grab references to the context menu items and stringbundle for use later on
    contextsearch.contextitem = document.getElementById("context-searchmenu");
    contextsearch.popup = document.getElementById("context-searchpopup");
    contextsearch.stringBundle = document.getElementById("contextSearchStrings");
    
    document.getElementById("contentAreaContextMenu").addEventListener("popupshowing",contextsearch.popuphandler,false);
    window.removeEventListener("load", contextsearch.load, false);
  }
  
  /**
   * Handler for when the context menu is displayed.
   */ 
, popuphandler: function() {
    var selectedText = contextsearch.getBrowserSelection(16);
    
    // truncate text for label and set up menu items as appropriate
    if (selectedText != null && selectedText.length > 0) {
      if (selectedText.length > 15) {
        selectedText = selectedText.substr(0,15) + "...";
      }
      
      var menuLabel = contextsearch.getMenuItemLabel(selectedText, false);
                                                           
      contextsearch.rebuildmenu();
      contextsearch.setupDefaultMenuItem(selectedText);
      contextsearch.contextitem.setAttribute("label", menuLabel);
      contextsearch.contextitem.setAttribute("hidden", "false");
    }
    
    else {
      contextsearch.contextitem.setAttribute("hidden", "true");
    }
  }
  
  /**
   * Simply returns the text that the user has selected.
   */
, getBrowserSelection: function (aChars, aEvent) {
    var focusedElement = document.commandDispatcher.focusedElement;
    var selectedText = null;

    // get text selection from input node
    if (contextsearch.isTextInputNode(focusedElement) && contextsearch.textSelectedInNode(focusedElement)) {
      var startPos = focusedElement.selectionStart;
      var endPos = focusedElement.selectionEnd;
      
      if (aChars && aChars < endPos - startPos) {
        endPos = startPos + (aChars <= 150 ? aChars : 150);
      }
      
      selectedText = focusedElement.value.substring(startPos, endPos);
    }
    
    // if an event is passed from the menu, we can assume there's a selection
    // otherwise check text is selected
    else if (aEvent || (gContextMenu && gContextMenu.isTextSelected)) {
      selectedText = getBrowserSelection(aChars);
    }

    return selectedText;
  }
  
  /**
   * Tests if the current node is an input textbox of some kind.
   * @param aNode the node to test
   * @return true if node is an input textbox, otherwise false
   */
, isTextInputNode: function (aNode) {
    try {
      return ((aNode instanceof HTMLInputElement && aNode.type in contextsearch._textNodeTypes)
        || aNode instanceof HTMLTextAreaElement);
    } 
    catch (e) {
      return false;
    }
  }
  
  /**
   * Checks that the node has a text selection.
   * @param aNode the node to test
   * @return true if text is selected, otherwise false
   */
, textSelectedInNode: function (aNode) {
    try {
      return (aNode.selectionStart < aNode.selectionEnd)
    } 
    catch (e) {
      return false;
    }
  }
  
  /**
   * Returns the menu item label to use, based on the text selection
   * and (if required) the default engine that should be used for the
   * in-built menu item.
   * Note: shamelessly ripped from browser.js  
   * @param aString the search string to use, i.e. substring of browser selected text
   * @param aUseEngineName whether the search engine name should be used in the label
   * @return menu item label as a string
   */ 
, getMenuItemLabel: function (aString, aUseEngineName) {
    var engineName = "";
    
    if (aUseEngineName) {
      var ss = Components.classes["@mozilla.org/browser/search-service;1"]
                .getService(Components.interfaces.nsIBrowserSearchService)
      
      // Firefox 3.0
      if (window.isElementVisible && isElementVisible(BrowserSearch.searchBar)) {
        engineName =  ss.currentEngine.name; 
      }
      
      // Firefox 2.0
      else if (BrowserSearch.getSearchBar && BrowserSearch.getSearchBar()) {
        engineName =  ss.currentEngine.name;
      }
      
      // Fallback in any other case, or if functions yield false/null
      else {
        engineName = ss.defaultEngine.name;
      }
    }
    
    // format "Search <engine> for <selection>" string to show in menu
    var menuLabel = "";
    if (aUseEngineName) {
      menuLabel = gNavigatorBundle.getFormattedString("contextMenuSearchText", [engineName, aString]);
    }
    else {
      menuLabel = contextsearch.stringBundle.getFormattedString("contextSearchMenuItemText", [aString]);
    }
    return aUseEngineName ? menuLabel : menuLabel.replace(/\s\s/," ");
  }

  /**
   * Builds up the default menu item if the contextsearch preference is flipped
   * such that the default menu item is not hidden, otherwise does nothing aside
   * from ensuring that the menu item is hidden.
   * @param aSelectedText the text selection to pass through to label creation
   */
, setupDefaultMenuItem: function (aSelectedText) {
    var menuItem = document.getElementById("context-searchselect");

    // only go to this effort if pref is flipped
    if (contextsearch.prefsMap["extensions.contextsearch.hideStandardContextItem"] == false) {
      var menuLabel = contextsearch.getMenuItemLabel(aSelectedText, true);
      
      // set label, show item and return
      menuItem.setAttribute("label", menuLabel);
      menuItem.setAttribute("hidden","false");
    }
    
    else {
      menuItem.setAttribute("hidden","true");    
    }
    
    return true;
  }
  
  /** 
   * Rebuilds the context search menu list.
   */
, rebuildmenu: function ()
  {                  
    var sepItemsPrefValue = contextsearch.prefsMap["extensions.contextsearch.separatorItems"];
    var sepItems = sepItemsPrefValue.split(',');

    const kXULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    
    var searchService = Components.classes["@mozilla.org/browser/search-service;1"]
                          .getService(Components.interfaces.nsIBrowserSearchService);
                      
    var popup = contextsearch.popup;
    var engines = searchService.getVisibleEngines({ });
        
    // clear menu
    while (popup.firstChild) {
      popup.removeChild(popup.firstChild);
    }
  
    for (var i = engines.length - 1; i >= 0; --i) {
      var menuitem = document.createElementNS(kXULNS, "menuitem");
      menuitem.setAttribute("label", engines[i].name);
      menuitem.setAttribute("id", engines[i].name);
      menuitem.setAttribute("class", "menuitem-iconic contextsearch-menuitem");
      
      if (engines[i].iconURI) {
        menuitem.setAttribute("src", engines[i].iconURI.spec);
      }
      
      popup.insertBefore(menuitem, popup.firstChild);
      menuitem.engine = engines[i];
      menuitem.setAttribute("onclick", "return contextsearch.menuitemclick(event);");

      // add separator
      for (var j = 0; j < sepItems.length; j++) {
        if (sepItems[j] == engines[i].name) {
          var separator = document.createElementNS(kXULNS, "menuseparator");
          popup.insertBefore(separator, popup.firstChild);
          break;
        }
      }
    }
  }
  
  /**
   * Handler for click events on the menu items. Bails out if activated
   * for anything other than a middle click, as this should be handled
   * using the oncommand handler anyway.
   * @param aEvent the event to process
   */
, menuitemclick: function (aEvent) {
    // only process middle clicks
    if (aEvent.button != 1) {
      return false;
    }
  
    // hide context menu
    var node = aEvent.target.parentNode;
    while (node.parentNode) {
      if (node.hidePopup) {
        node.hidePopup();
      }
      node = node.parentNode;
    }
    
    // continue with search
    contextsearch.search(aEvent);
    return true;
  }
  
  /**
   * Main search handling function. When provided with an event, will
   * interpret the event and take the necessary action - i.e. search in
   * background or foreground tab or window depending on click action
   * taken and user preferences.
   * @param aEvent the event to action
   */
, search: function (aEvent) 
  {
    if (!aEvent.target.id) {
      return;
    }
      
    var searchValue = contextsearch.getBrowserSelection(null, aEvent);

    if (contextsearch.prefsMap["extensions.contextsearch.quoteStringsWithSpaces"] && searchValue.indexOf(' ') >= 0 ) {
      searchValue = '"' + searchValue + '"';
    }
    var params = contextsearch.getSearchParams(aEvent.target.engine, searchValue);     
    var loadInBackgroundPref = contextsearch.prefsMap["browser.tabs.loadInBackground"];
    var loadInForeground = false;
   
    if (aEvent.button == undefined) {
      loadInForeground = loadInBackgroundPref ? aEvent.ctrlKey || aEvent.metaKey : !aEvent.ctrlKey && !aEvent.metaKey;
    }
    else {
      loadInForeground = loadInBackgroundPref ? true : false;
    }
    
    if (aEvent.shiftKey) {
      openNewWindowWith(params.searchUrl, null, params.postData, false);
    }
        
    else {
      var browser = window.getBrowser();
      var currentTab = browser.selectedTab;
      var newTab = browser.addTab(
        params.searchUrl
      , {
          postData: params.postData
        , owner: currentTab
        , ownerTab: currentTab
        , allowThirdPartyFixup: false
        , relatedToCurrent: true
        , fromExternal: false
        }        
      );

      if (loadInForeground && newTab != null) {
        browser.selectedTab = newTab;
      }
    }
  }
  
  /**
   * Constructs a tuple of searchUrl and postData based on a
   * provided search engine and search value. This is essentially
   * building the URL and request data to perform the search with
   * the chosen engine.
   * @param aSearchEngine the search engine to use
   * @param aSearchValue the value to search for
   * @param tuple object: {searchUrl, postData}
   */
, getSearchParams: function (aSearchEngine, aSearchValue)
  {
  	var searchSubmission = aSearchEngine.getSubmission(aSearchValue, null);
	  var postData = searchSubmission.postData ? searchSubmission.postData : null;
  	var searchUrl = searchSubmission.uri.spec;
  	var finalUrl = new String();

  	if (!aSearchValue) {
  		var uri = Components.classes['@mozilla.org/network/standard-url;1']
  		            .createInstance(Components.interfaces.nsIURI);
  		uri.spec = searchUrl;
  		searchUrl = uri.host;
    }
    
    // recommendation by Mat on AMO
    for (var i = 0; i < searchUrl.length; i++) {
      finalUrl += (searchUrl[i] == "+") ? "%20" : searchUrl[i];
    }

    return {searchUrl: finalUrl, postData: postData};
	}
}

window.addEventListener("load", contextsearch.load, true);
