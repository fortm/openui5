/*!
 * ${copyright}
 */

//Provides class sap.ui.model.odata.v4.lib._Helper
sap.ui.define([
	"jquery.sap.global"
], function (jQuery) {
	"use strict";

	var rAmpersand = /&/g,
		rEquals = /\=/g,
		rHash = /#/g,
		rPlus = /\+/g,
		rSingleQuote = /'/g,
		Helper;

	Helper = {
		/**
		 * Builds a relative path from the given arguments. Iterates over the arguments and appends
		 * them to the path if defined and non-empty. The arguments are expected to be strings or
		 * integers, but this is not checked.
		 *
		 * Examples:
		 * buildPath() --> ""
		 * buildPath("base", "relative") --> "base/relative"
		 * buildPath("base", "") --> "base"
		 * buildPath("", "relative") --> "relative"
		 * buildPath("base", undefined, "relative") --> "base/relative"
		 * buildPath("base", 42, "relative") --> "base/42/relative"
		 * buildPath("base", 0, "relative") --> "base/0/relative"
		 *
		 * @returns {string} a composite path built from all arguments
		 */
		buildPath : function () {
			var i,
				aPath = [],
				sSegment;

			for (i = 0; i < arguments.length; i++) {
				sSegment = arguments[i];
				if (sSegment || sSegment === 0) {
					aPath.push(sSegment === "/" ? "" : sSegment); //avoid duplicated '/'
				}
			}
			return aPath.join("/");
		},

		/**
		 * Builds a query string from the given parameter map. Takes care of encoding, but ensures
		 * that the characters "$", "(", ")", ";" and "=" are not encoded, so that OData queries
		 * remain readable.
		 *
		 * ';' is not encoded although RFC 1866 encourages its usage as separator between query
		 * parameters. However OData Version 4.0 Part 2 specifies that only '&' is a valid
		 * separator.
		 *
		 * @param {object} [mParameters]
		 *   A map of key-value pairs representing the query string, the value in this pair has to
		 *   be a string or an array of strings; if it is an array, the resulting query string
		 *   repeats the key for each array value
		 *   Examples:
		 *   buildQuery({foo : "bar", "bar" : "baz"}) results in the query string "?foo=bar&bar=baz"
		 *   buildQuery({foo : ["bar", "baz"]}) results in the query string "?foo=bar&foo=baz"
		 * @returns {string}
		 *   The query string; it is empty if there are no parameters; it starts with "?" otherwise
		 */
		buildQuery : function (mParameters) {
			var aKeys, aQuery;

			if (!mParameters) {
				return "";
			}

			aKeys = Object.keys(mParameters);
			if (aKeys.length === 0) {
				return "";
			}

			aQuery = [];
			aKeys.forEach(function (sKey) {
				var vValue = mParameters[sKey];

				if (Array.isArray(vValue)) {
					vValue.forEach(function (sItem) {
						aQuery.push(Helper.encodePair(sKey, sItem));
					});
				} else {
					aQuery.push(Helper.encodePair(sKey, vValue));
				}
			});

			return "?" + aQuery.join("&");
		},

		/**
		 * Returns an <code>Error</code> instance from a jQuery XHR wrapper.
		 *
		 * @param {object} jqXHR
		 *   A jQuery XHR wrapper as received by a failure handler
		 * @param {function} jqXHR.getResponseHeader
		 *   Used to access the HTTP response header "Content-Type"
		 * @param {string} jqXHR.responseText
		 *   HTTP response body, sometimes in JSON format ("Content-Type" : "application/json")
		 *   according to OData "19 Error Response" specification, sometimes plain text
		 *   ("Content-Type" : "text/plain"); other formats are ignored
		 * @param {number} jqXHR.status
		 *   HTTP status code
		 * @param {string} jqXHR.statusText
		 *   HTTP status text
		 * @returns {Error}
		 *   An <code>Error</code> instance with the following properties:
		 *   <ul>
		 *     <li><code>error</code>: The "error" value from the OData V4 error response JSON
		 *     object (if available)
		 *     <li><code>isConcurrentModification</code>: <code>true</code> In case of a
		 *     concurrent modification detected via ETags (i.e. HTTP status code 412)
		 *     <li><code>message</code>: Error message
		 *     <li><code>status</code>: HTTP status code
		 *     <li><code>statusText</code>: HTTP status text
		 *   </ul>
		 * @see <a href=
		 * "http://docs.oasis-open.org/odata/odata-json-format/v4.0/os/odata-json-format-v4.0-os.html"
		 * >"19 Error Response"</a>
		 */
		createError : function (jqXHR) {
			var sBody = jqXHR.responseText,
				sContentType = jqXHR.getResponseHeader("Content-Type"),
				oResult = new Error(jqXHR.status + " " + jqXHR.statusText);

			oResult.status = jqXHR.status;
			oResult.statusText = jqXHR.statusText;
			if (jqXHR.status === 0) {
				oResult.message = "Network error";
				return oResult;
			}
			if (sContentType) {
				sContentType = sContentType.split(";")[0];
			}
			if (jqXHR.status === 412) {
				oResult.isConcurrentModification = true;
			}
			if (sContentType === "application/json") {
				try {
					// "The error response MUST be a single JSON object. This object MUST have a
					// single name/value pair named error. The value must be a JSON object."
					oResult.error = JSON.parse(sBody).error;
					oResult.message = oResult.error.message;
				} catch (e) {
					jQuery.sap.log.warning(e.toString(), sBody,
						"sap.ui.model.odata.v4.lib._Helper");
				}
			} else if (sContentType === "text/plain") {
				oResult.message = sBody;
			}

			return oResult;
		},

		/**
		 * Encodes a query part, either a key or a value.
		 *
		 * @param {string} sPart
		 *   The query part
		 * @param {boolean} bEncodeEquals
		 *   If true, "=" is encoded, too
		 * @returns {string}
		 *   The encoded query part
		 */
		encode : function (sPart, bEncodeEquals) {
			var sEncoded = encodeURI(sPart)
					.replace(rAmpersand, "%26")
					.replace(rHash, "%23")
					.replace(rPlus, "%2B");
			if (bEncodeEquals) {
				sEncoded = sEncoded.replace(rEquals, "%3D");
			}
			return sEncoded;
		},

		/**
		 * Encodes a key-value pair.
		 *
		 * @param {string} sKey
		 *   The key
		 * @param {string} sValue
		 *   The sValue
		 * @returns {string}
		 *   The encoded key-value pair in the form "key=value"
		 */
		encodePair : function (sKey, sValue) {
			return Helper.encode(sKey, true) + "=" + Helper.encode(sValue, false);
		},

		/**
		 * Formats a given internal value into a literal suitable for usage in URLs.
		 *
		 * @param {any} vValue
		 *   The value according to "OData JSON Format Version 4.0" section "7.1 Primitive Value"
		 * @param {string} sType
		 *   The OData Edm type, e.g. "Edm.String"
		 * @returns {string}
		 *   The literal according to "OData Version 4.0 Part 2: URL Conventions" section
		 *   "5.1.1.6.1 Primitive Literals"
		 * @throws {Error}
		 *   If the value is undefined or the type is not supported
		 */
		formatLiteral : function (vValue, sType) {
			if (vValue === undefined) {
				throw new Error("Illegal value: undefined");
			}
			if (vValue === null) {
				return "null";
			}

			switch (sType) {
			case "Edm.Binary":
				return "binary'" + vValue + "'";

			case "Edm.Boolean":
			case "Edm.Byte":
			case "Edm.Double":
			case "Edm.Int16":
			case "Edm.Int32":
			case "Edm.SByte":
			case "Edm.Single":
				return String(vValue);

			case "Edm.Date":
			case "Edm.DateTimeOffset":
			case "Edm.Decimal":
			case "Edm.Guid":
			case "Edm.Int64":
			case "Edm.TimeOfDay":
				return vValue;

			case "Edm.Duration":
				return "duration'" + vValue + "'";

			case "Edm.String":
				return "'" + vValue.replace(rSingleQuote, "''") + "'";

			default:
				throw new Error("Unsupported type: " + sType);
			}
		},

		/**
		 * Checks that the value is a safe integer.
		 *
		 * @param {number} iNumber The value
		 * @returns {boolean}
		 *   True if the value is a safe integer
		 */
		isSafeInteger : function (iNumber) {
			if (typeof iNumber !== "number" || !isFinite(iNumber)) {
				return false;
			}
			iNumber = Math.abs(iNumber);
			// The safe integers consist of all integers from -(2^53 - 1) inclusive to 2^53 - 1
			// inclusive.
			// 2^53 - 1 = 9007199254740991
			return iNumber <= 9007199254740991 && Math.floor(iNumber) === iNumber;
		},

		/**
		 * Updates the cache with the object sent to the PATCH request or the object returned by the
		 * PATCH response. Fires change events for all changed properties. The function recursively
		 * handles modified, added or removed structural properties and fires change events for all
		 * modified/added/removed primitive properties therein.
		 *
		 * @param {object} mChangeListeners A map of change listeners by path.
		 * @param {string} sPath The path of the cache value in the cache
		 * @param {object} oCacheValue The object in the cache
		 * @param {object} oPatchValue The value of the patch request/response
		 */
		updateCache : function (mChangeListeners, sPath, oCacheValue, oPatchValue) {

			/*
			 * Fires a change event to all listeners for the given path in mChangeListeners.
			 * @param {string} sPropertyPath The path
			 * @param {any} vValue the value to report to the listeners
			 */
			function fireChange(sPropertyPath, vValue) {
				var aListeners = mChangeListeners[sPropertyPath],
					i;

				if (aListeners) {
					for (i = 0; i < aListeners.length; i++) {
						aListeners[i].onChange(vValue);
					}
				}
			}

			/*
			 * Iterates recursively over all properties of the given value and fires change events
			 * to all listeners.
			 * @param {string} sPath The path of the current value
			 * @param {object} oValue The value
			 * @param {boolean} bRemoved If true the value is assumed to have been removed and the
			 *   change event reports undefined as the new value
			 */
			function fireChanges(sPath, oValue, bRemoved) {
				Object.keys(oValue).forEach(function (sProperty) {
					var sPropertyPath = Helper.buildPath(sPath, sProperty),
						vValue = oValue[sProperty];

					if (vValue && typeof vValue === "object") {
						fireChanges(sPropertyPath, vValue, bRemoved);
					} else {
						fireChange(sPropertyPath, bRemoved ? undefined : vValue);
					}
				});
			}

			// iterate over all properties in the cache
			Object.keys(oCacheValue).forEach(function (sProperty) {
				var sPropertyPath = Helper.buildPath(sPath, sProperty),
					vOldValue = oCacheValue[sProperty],
					vNewValue;

				if (sProperty in oPatchValue) {
					// the property was patched
					vNewValue = oPatchValue[sProperty];
					if (vNewValue && typeof vNewValue === "object") {
						if (vOldValue) {
							// a structural property in cache and patch -> recursion
							Helper.updateCache(mChangeListeners, sPropertyPath, vOldValue,
								vNewValue);
						} else {
							// a structural property was added
							oCacheValue[sProperty] = vNewValue;
							fireChanges(sPropertyPath, vNewValue, false);
						}
					} else if (vOldValue && typeof vOldValue === "object") {
						// a structural property was removed
						fireChanges(sPropertyPath, vOldValue, true);
						oCacheValue[sProperty] = vNewValue;
					} else {
						// a primitive property
						if (vOldValue !== vNewValue) {
							fireChange(sPropertyPath, vNewValue);
						}
						oCacheValue[sProperty] = vNewValue;
					}
				}
			});
		}
	};

	return Helper;
}, /* bExport= */false);
