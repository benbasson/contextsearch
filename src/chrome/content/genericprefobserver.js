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
 * The Original Code is Generic Pref Observer.
 *
 * The Initial Developer of the Original Code is
 *   Ben Basson <ben@basson.at>
 * Portions created by the Initial Developer are Copyright (C) 2008
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

/**
 * Listens on a preferences branch for changes to one or more preferences 
 * in the specified array and runs the provided callback function when changes
 * occur. Parameters to callback are {subject,data} - pref name and pref value.
 * @param aPrefBranch initialised preferences branch
 * @param aPrefsList array of preferences to monitor
 * @param aCallbackFunction callback function to run when a preference changes
 */
function GenericPrefObserver (aPrefBranch, aPrefsList, aCallbackFunction) {
  this._prefBranch = aPrefBranch;
  this._prefsList = aPrefsList;
  this._callbackFunction = aCallbackFunction;
}

// Class body
GenericPrefObserver.prototype =
{
  /**
   * Register this observer.
   */
  register: function () {
    this._prefBranch.QueryInterface(Components.interfaces.nsIPrefBranch2).addObserver("", this, false);
  } // register
  
  /**
   * Unregister this observer.
   */
, unregister: function () {
    this._prefBranch.QueryInterface(Components.interfaces.nsIPrefBranch2).removeObserver("", this, false);
  } // unregister

  /**
   * Observe - called when pref changes happen on branch.
   */
, observe: function (aSubject, aTopic, aData) {
    
    // No change, return
    if (aTopic != "nsPref:changed") {
      return;
    }
    
    // Get value of pref
    var lValue = null;
    var type = this._prefBranch.getPrefType(aData);
    switch (type) {
      case Components.interfaces.nsIPrefBranch.PREF_STRING: {
        lValue = this._prefBranch.getCharPref(aData);
        break;
      }
      case Components.interfaces.nsIPrefBranch.PREF_INT: {
        lValue = this._prefBranch.getIntPref(aData);
        break;
      }
      case Components.interfaces.nsIPrefBranch.PREF_BOOL: {
        lValue = this._prefBranch.getBoolPref(aData);
        break;
      }
    }
    
    // Pref in monitoring list has changed, callback
    if (this._prefsList.indexOf(aData) != -1) {
      this._callbackFunction(aData, lValue);
    }
  } // observe
} // GenericPrefObserver