const now = require("performance-now")
const GraphemeSplitter = require('grapheme-splitter')
const splitter = new GraphemeSplitter()

// credit: yishn @ github
exports.noop = () => {}
exports.equals = function(a, b) {
    if (a === b) return true
    if (a == null || b == null) return a == b

    let t = Object.prototype.toString.call(a)
    if (t !== Object.prototype.toString.call(b)) return false

    let aa = t === '[object Array]'
    let ao = t === '[object Object]'

    if (aa) {
        if (a.length !== b.length) return false
        for (let i = 0; i < a.length; i++)
            if (!exports.equals(a[i], b[i])) return false
        return true
    } else if (ao) {
        let kk = Object.keys(a)
        if (kk.length !== Object.keys(b).length) return false
        for (let i = 0; i < kk.length; i++) {
            let k = kk[i]
            if (!(k in b)) return false
            if (!exports.equals(a[k], b[k])) return false
        }
        return true
    }

    return false
}
exports.shallowEquals = function(a, b) {
    return a == null || b == null ? a === b : a === b || a.length === b.length && a.every((x, i) => x == b[i])
}

// time functions
exports.timeToMilliCeil = function (time) {
    return Math.ceil(time * 1e3)
}

exports.secToMilli = function (time) {
    return time * 1e3
}

// returns float seconds
exports.timeNow = function () {
    return now() / 1e3
}

// polyfills for str
if (!String.prototype.repeat) {
  String.prototype.repeat = function(count) {
    'use strict';
    if (this == null) {
      throw new TypeError('can\'t convert ' + this + ' to object');
    }
    var str = '' + this;
    // To convert string to integer.
    count = +count;
    if (count != count) {
      count = 0;
    }
    if (count < 0) {
      throw new RangeError('repeat count must be non-negative');
    }
    if (count == Infinity) {
      throw new RangeError('repeat count must be less than infinity');
    }
    count = Math.floor(count);
    if (str.length == 0 || count == 0) {
      return '';
    }
    // Ensuring count is a 31-bit integer allows us to heavily optimize the
    // main part. But anyway, most current (August 2014) browsers can't handle
    // strings 1 << 28 chars or longer, so:
    if (str.length * count >= 1 << 28) {
      throw new RangeError('repeat count must not overflow maximum string size');
    }
    var maxCount = str.length * count;
    count = Math.floor(Math.log(count) / Math.log(2));
    while (count) {
       str += str;
       count--;
    }
    str += str.substring(0, maxCount - str.length);
    return str;
  }
}

// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
if (!String.prototype.padStart) {
    String.prototype.padStart = function padStart(targetLength, padString) {
        targetLength = targetLength >> 0; //truncate if number, or convert non-number to 0;
        padString = String(typeof padString !== 'undefined' ? padString : ' ');
        if (this.length >= targetLength) {
            return String(this);
        } else {
            targetLength = targetLength - this.length;
            if (targetLength > padString.length) {
                padString += padString.repeat(targetLength / padString.length); //append to original to ensure we are longer than needed
            }
            return padString.slice(0, targetLength) + String(this);
        }
    };
}

// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padEnd
if (!String.prototype.padEnd) {
    String.prototype.padEnd = function padEnd(targetLength,padString) {
        targetLength = targetLength>>0; //floor if number or convert non-number to 0;
        padString = String((typeof padString !== 'undefined' ? padString : ' '));
        if (this.length > targetLength) {
            return String(this);
        }
        else {
            targetLength = targetLength-this.length;
            if (targetLength > padString.length) {
                padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
            }
            return String(this) + padString.slice(0,targetLength);
        }
    };
}

exports.timeToString = function(time = 0, width = null, numFSDigits = 0, lastNumSecs = false) {
    let str = ''
    if (time == Infinity || time == 'Infinity') {
        return '\u221E'
    }
    let timeIntSec = Math.floor(time)
    let hours = Math.floor(timeIntSec / 3600)
    let mins = Math.floor((timeIntSec - (hours * 3600)) / 60)
    let secs = Math.floor(timeIntSec - (hours * 3600) - (mins * 60))
    let havehours = (hours > 0)
    let havemins = (mins > 0)
    if (havehours) {
        str += String(hours) + ":"
    }
    if (havemins || havehours) {
        if (havehours) {
            str += String(mins).padStart(2, '0') + ":"
        } else {
            str += String(mins) + ":"
        }
        str += String(secs).padStart(2, '0')
    } else {
        str += String(secs)
    }
    if (numFSDigits > 0) {
        if (lastNumSecs) {
            str += '.' +
                String((time - timeIntSec)).
                    slice(2).
                    slice(0, numFSDigits).
                    padEnd(numFSDigits, '0')
        } else {
            str += ' '.repeat(1 + numFSDigits)
        }
    } else {
        str += ' '.repeat(1 + numFSDigits)
    }
    if (str != null && str.length < width) {
        str = str.padStart(width, ' ')
    }
    return str
}

exports.padStart = function(str, width = 0, pad = ' ') {
    return str.padStart(width, pad)
}

// count character lengths to calculate the clock size, text spacing
// some language strings' graphemes can be displayed as a different lengths
// so needs a matching unicode font for that language (change that in css)
// https://github.com/orling/grapheme-splitter/issues/25#issuecomment-447834282
exports.strlen = function(str) {
    return splitter.countGraphemes(str)
}
