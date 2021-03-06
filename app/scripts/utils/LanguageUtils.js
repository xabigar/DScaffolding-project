/**
 * General utils
 * @author Haritz Medina <me@haritzmedina.com>
 */
'use strict'

const jQuery = require('jquery')

class LanguageUtils {
  /**
   * Check if a given object is a function
   * @param func An object
   * @returns {*|boolean}
   */
  static isFunction (func) {
    return func && typeof func === 'function'
  }

  /**
   * Returns true if the object is empty, null, etc.
   * @param obj
   * @returns {*|boolean}
   */
  static isEmptyObject (obj) {
    return jQuery.isEmptyObject(obj)
  }

  /**
   * Returns true if the object is instance of a Class
   * @param obj
   * @param classReference
   * @returns {boolean}
   */
  static isInstanceOf (obj, classReference) {
    return obj instanceof classReference
  }

  /**
   * Fill the object with the properties
   * @param object
   * @param properties
   * @returns {*}
   */
  static fillObject (object, properties) {
    return Object.assign(object, properties)
  }

  /**
   * Create a custom event with the corresponding name, message and metadata
   * @param name
   * @param message
   * @param data
   * @returns {CustomEvent}
   */
  static createCustomEvent (name, message, data) {
    return (new CustomEvent(name, {
      detail: {
        message: message,
        data: data,
        time: new Date()
      },
      bubbles: true,
      cancelable: true
    }))
  }

  /**
   * Renames an object's key
   * @param o
   * @param oldKey
   * @param newKey
   */
  static renameObjectKey (o, oldKey, newKey) {
    if (oldKey !== newKey) {
      Object.defineProperty(o, newKey,
        Object.getOwnPropertyDescriptor(o, oldKey))
      delete o[oldKey]
    }
  }
}

module.exports = LanguageUtils
