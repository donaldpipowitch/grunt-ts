/// <reference path="../../defs/tsd.d.ts"/>
/// <reference path="./interfaces.d.ts"/>

import path = require('path');
import fs = require('fs');
import _ = require('underscore');
import utils = require('./utils');
import cache = require('./cacheUtils');
import transformers = require('./transformers');

var Promise: typeof Promise = require('es6-promise').Promise;
export var grunt: IGrunt = require('grunt');

export interface ICompileResult {
    code: number;
    output: string;
    fileCount?: number;
}

///////////////////////////
// Helper
///////////////////////////
function executeNode(args: string[]): Promise<ICompileResult> {
    return new Promise((resolve, reject) => {
        grunt.util.spawn({
            cmd: 'node',
            args: args
        }, (error, result, code) => {
                var ret: ICompileResult = {
                    code: code,
                    output: String(result)
                };
                resolve(ret);
            });
    });
}

/////////////////////////////////////////////////////////////////////
// tsc handling
////////////////////////////////////////////////////////////////////

function resolveTypeScriptBinPath(): string {
    var ownRoot = path.resolve(path.dirname((module).filename), '../..');
    var userRoot = path.resolve(ownRoot, '..', '..');
    var binSub = path.join('node_modules', 'typescript', 'bin');

    if (fs.existsSync(path.join(userRoot, binSub))) {
        // Using project override
        return path.join(userRoot, binSub);
    }
    return path.join(ownRoot, binSub);
}

function getTsc(binPath: string): string {
    var pkg = JSON.parse(fs.readFileSync(path.resolve(binPath, '..', 'package.json')).toString());
    grunt.log.writeln('Using tsc v' + pkg.version);

    return path.join(binPath, 'tsc');
}

export function compileAllFiles(targetFiles: string[], target: ITargetOptions, task: ITaskOptions): Promise<ICompileResult> {

    // Make a local copy so we can modify files without having external side effects
    var files = _.map(targetFiles, (file) => file);

    var newFiles: string[] = files;
    if (task.fast) {
        if (target.out) {
            grunt.log.writeln('Fast compile will not work when --out is specified. Ignoring fast compilation'.cyan);
        }
        else {
            newFiles = getChangedFiles(files);
            if (newFiles.length !== 0) { files = newFiles; }
            else {
                grunt.log.writeln('No file changes were detected. Skipping Compile'.green);
                return new Promise((resolve) => {
                    var ret: ICompileResult = {
                        code: 0,
                        fileCount: 0,
                        output: 'No files compiled as no change detected'
                    };
                    resolve(ret);
                });
            }
        }
    }

    // Transform files as needed. Currently all of this logic in is one module
    transformers.transformFiles(newFiles, targetFiles, target, task);

    // If baseDir is specified create a temp tsc file to make sure that `--outDir` works fine
    // see https://github.com/grunt-ts/grunt-ts/issues/77
    var baseDirFile: string = 'ignoreBaseDirFile.ts';
    var baseDirFilePath: string;
    if (target.outDir && target.baseDir && files.length > 0) {
        baseDirFilePath = path.join(target.baseDir, baseDirFile);
        if (!fs.existsSync(baseDirFilePath)) {
            grunt.file.write(baseDirFilePath, '// Ignore this file. See https://github.com/grunt-ts/grunt-ts/issues/77');
        }
        files.push(baseDirFilePath);
    }
    
    // If reference and out are both specified.
    // Then only compile the updated reference file as that contains the correct order
    if (target.reference && target.out) {
        var referenceFile = path.resolve(target.reference);
        files = [referenceFile];
    }

    // Quote the files to compile. Needed for command line parsing by tsc
    files = _.map(files, (item) => '"' + path.resolve(item) + '"');

    var args: string[] = files.slice(0);

    // boolean options
    if (task.sourceMap) {
        args.push('--sourcemap');
    }
    if (task.declaration) {
        args.push('--declaration');
    }
    if (task.removeComments) {
        args.push('--removeComments');
    }
    if (task.noImplicitAny) {
        args.push('--noImplicitAny');
    }
    if (task.noResolve) {
        args.push('--noResolve');
    }

    // string options
    args.push('--target', task.target.toUpperCase());
    args.push('--module', task.module.toLowerCase());

    // Target options:
    if (target.out) {
        args.push('--out', target.out);
    }
    if (target.outDir) {
        if (target.out) {
            console.warn('WARNING: Option "out" and "outDir" should not be used together'.magenta);
        }
        args.push('--outDir', target.outDir);
    }
    if (task.sourceRoot) {
        args.push('--sourceRoot', task.sourceRoot);
    }
    if (task.mapRoot) {
        args.push('--mapRoot', task.mapRoot);
    }

    // Locate a compiler
    var tsc = getTsc(resolveTypeScriptBinPath());

    // To debug the tsc command
    if (task.verbose) {
        console.log(args.join(' ').yellow);
    }
    else {
        grunt.log.verbose.writeln(args.join(' ').yellow);
    }

    // Create a temp last command file and use that to guide tsc.
    // Reason: passing all the files on the command line causes TSC to go in an infinite loop.
    var tempfilename = utils.getTempFile('tscommand');
    if (!tempfilename) {
        throw (new Error('cannot create temp file'));
    }

    fs.writeFileSync(tempfilename, args.join(' '));

    // Execute command
    return executeNode([tsc, '@' + tempfilename]).then((result: ICompileResult) => {

        if (task.fast) {
            resetChangedFiles(newFiles);
        }

        result.fileCount = files.length;

        fs.unlinkSync(tempfilename);

        grunt.log.writeln(result.output);

        return Promise.cast(result);
    }, (err) => {
            fs.unlinkSync(tempfilename);
            throw err;
        });
}


/////////////////////////////////////////////////////////////////
// Fast Compilation 
/////////////////////////////////////////////////////////////////

function getChangedFiles(files) {

    var targetName = grunt.task.current.target;

    files = cache.getNewFilesForTarget(files, targetName);

    _.forEach(files, (file) => {
        grunt.log.writeln(('### Fast Compile >>' + file).cyan);
    });

    return files;
}

function resetChangedFiles(files) {
    var targetName = grunt.task.current.target;
    cache.compileSuccessfull(files, targetName);
}
