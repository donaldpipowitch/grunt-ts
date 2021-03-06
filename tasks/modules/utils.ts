/// <reference path="../../defs/tsd.d.ts"/>

import path = require('path');
import fs = require('fs');
import util = require('util');

export var grunt: IGrunt = require('grunt');

// Converts "C:\boo" , "C:\boo\foo.ts" => "./foo.ts"; Works on unix as well.
export function makeRelativePath(folderpath: string, filename: string) {
    return path.relative(folderpath, filename).split('\\').join('/');
}

/**
 * Returns the result of an array inserted into another, starting at the given index.
 */
export function insertArrayAt<T>(array: T[], index: number, arrayToInsert: T[]): T[] {
    var updated = array.slice(0);
    var spliceAt: any[] = [index, 0];
    Array.prototype.splice.apply(updated, spliceAt.concat(arrayToInsert));
    return updated;
}

/**
 * Compares the end of the string with the given suffix for literal equality.
 *
 * @returns {boolean} whether the string ends with the suffix literally.
 */
export function endsWith(str: string, suffix: string): boolean {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

/** function for formatting strings 
 * ('{0} says {1}','la','ba' ) => 'la says ba'
 */
export function format(str: string, ...args: any[]) {
    return str.replace(/{(\d+)}/g, function (m, i?) {
        return args[i] !== undefined ? args[i] : m;
    });
}

/**
 * Get a random hex value
 *
 * @returns {string} hex string
 */
export function getRandomHex(length: number = 16): string {
    var name: string = '';
    do {
        name += Math.round(Math.random() * Math.pow(16, 8)).toString(16);
    }
    while (name.length < length);

    return name.substr(0, length);
}

/**
 * Get a unique temp file
 *
 * @returns {string} unique-ish path to file in given directory.
 * @throws when it cannot create a temp file in the specified directory
 */
export function getTempFile(prefix?: string, dir: string = '', extension = '.tmp.txt'): string {
    prefix = (prefix ? prefix + '-' : '');
    var attempts = 100;
    do {
        var name: string = prefix + getRandomHex(8) + extension;
        var dest: string = path.join(dir, name);

        if (!fs.existsSync(dest)) {
            return dest;
        }
        attempts--;
    }
    while (attempts > 0);

    throw 'Cannot create temp file in ' + dir;
}

/////////////////////////////////////////////////////////////////////////
// From https://github.com/centi/node-dirutils/blob/master/index.js
// Slightly modified. See BAS
////////////////////////////////////////////////////////////////////////

/**
 * Get all files from a directory and all its subdirectories.
 * @param {String} dirPath A path to a directory
 * @param {RegExp|Function} exclude Defines which files should be excluded.
     Can be a RegExp (whole filepath is tested) or a Function which will get the filepath 
     as an argument and should return true (exclude file) or false (do not exclude).
 * @returns {Array} An array of files
 */
export function getFiles(dirPath, exclude?: (filename: string) => boolean): string[] {
    return _getAll(dirPath, exclude, true);
};

/**
 * Get all directories from a directory and all its subdirectories.
 * @param {String} dirPath A path to a directory
 * @param {RegExp|Function} exclude Defines which directories should be excluded. 
    Can be a RegExp (whole dirpath is tested) or a Function which will get the dirpath 
    as an argument and should return true (exclude dir) or false (do not exclude).
 * @returns {Array} An array of directories
 */
export function getDirs(dirPath, exclude?: (filename: string) => boolean): string[] {
    return _getAll(dirPath, exclude, false);
};

/**
 * Get all files or directories from a directory and all its subdirectories.
 * @param {String} dirPath A path to a directory
 * @param {RegExp|Function} exclude Defines which files or directories should be excluded. 
    Can be a RegExp (whole path is tested) or a Function which will get the path 
    as an argument and should return true (exclude) or false (do not exclude).
 * @param {Boolean} getFiles Whether to get files (true) or directories (false).
 * @returns {Array} An array of files or directories
 */
function _getAll(dirPath, exclude, getFiles) {
    var _checkDirResult = _checkDirPathArgument(dirPath);
    var _checkExcludeResult;
    var items = [];

    if (util.isError(_checkDirResult)) {
        return _checkDirResult;
    }
    if (exclude) {
        _checkExcludeResult = _checkExcludeArgument(exclude);
        if (util.isError(_checkExcludeResult)) {
            return _checkExcludeResult;
        }
    }

    fs.readdirSync(dirPath).forEach(function (_item) {
        var _itempath = path.normalize(dirPath + '/' + _item);

        if (exclude) {
            if (util.isRegExp(exclude)) {
                if (exclude.test(_itempath)) {
                    return;
                }
            }
            else {
                if (exclude(_itempath)) { // BAS, match full item path
                    return;
                }
            }
        }

        if (fs.statSync(_itempath).isDirectory()) {
            if (!getFiles) {
                items.push(_itempath);
            }
            items = items.concat(_getAll(_itempath, exclude, getFiles));
        }
        else {
            if (getFiles === true) {
                items.push(_itempath);
            }
        }
    });

    return items;
}

/**
 * Check if the dirPath is provided and if it does exist on the filesystem.
 * @param {String} dirPath A path to the directory
 * @returns {String|Error} Returns the dirPath if everything is allright or an Error otherwise.
 */
function _checkDirPathArgument(dirPath) {
    if (!dirPath || dirPath === '') {
        return new Error('Dir path is missing!');
    }
    if (!fs.existsSync(dirPath)) {
        return new Error('Dir path does not exist: ' + dirPath);
    }

    return dirPath;
}

/**
 * Check if the exclude argument is a RegExp or a Function.
 * @param {RegExp|Function} exclude A RegExp or a Function which returns true/false.
 * @returns {String|Error} Returns the exclude argument if everything is allright or an Error otherwise.
 */
function _checkExcludeArgument(exclude) {
    if (!util.isRegExp(exclude) && typeof (exclude) !== 'function') {
        return new Error('Argument exclude should be a RegExp or a Function');
    }

    return exclude;
}
