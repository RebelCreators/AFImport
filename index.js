const fs = require("fs");
const path = require("path");
const glob = require("glob");

/**
 * Class importing layer
 * @module afimport
 */

/**
 *
 * @private
 * @type {{string : {className: string, clazz: Function, namespace: string, options: Object}}}
 */
var includes = {};
/**
 * @private
 * @type {Array.<{nameSpacedClassName:string, classPath: string, options: Object}>}
 */
var includeQueue = [];

/**
 * @private
 * @param {Array.<string>} classPaths
 * @param {?{namespace: ?string, override: ?boolean}} options
 */
function addToIncludedQueue(classPaths, options) {
    for (var i = 0; i < classPaths.length; i++) {
        var className = classPaths[i];
        if (path.extname(className) != ".js" || className.startsWith(".")) {
            continue;
        }
        var basePath = path.dirname(className);
        if (!basePath) {
            continue;
        }
        className = path.basename(className, '.js');
        var nameSpacedClassName = getOption("namespace", options) + "." + className;
        includeQueue.push({nameSpacedClassName: nameSpacedClassName, classPath: classPaths[i], options: options});
    }
}

/**
 * @private
 * @param {string} className
 * @param {?{namespace: ?string, override: ?boolean}} options
 * @returns {?string}
 */
function includeClass(className, options) {
    if (path.extname(className) != ".js") {
        return null;
    }
    const basePath = path.dirname(className);
    if (!basePath) {
        throw new Error("AFImport: Could not resolve base path.");
    }

    className = path.basename(className, '.js');
    if (className.startsWith(".")) {
        //ignore hidden files
        return null;
    }
    const namespace = getOption("namespace", options);
    const nameSpacedClassName = namespace + "." + className;
    includeQueue = includeQueue.filter(function (includedClass) {
        return includedClass.nameSpacedClassName != nameSpacedClassName;
    });

    if (getOption("override", options) == false) {
        if (includes[nameSpacedClassName] && getOption("override", includes[nameSpacedClassName].options) == true) {
            return className;
        } else if (includes[nameSpacedClassName]) {
            throw new Error("AFImport: Class already included.");
        }
    }
    const clazz = require(path.resolve(basePath) + path.sep + className + ".js");
    if (!clazz) {
        throw new Error("AFImport: Class " + className + " Not found");
    }
    includes[nameSpacedClassName] = {clazz: clazz, className: className, namespace: namespace, options: options};

    return className;
}

/**
 *
 * @type {{namespace: string, override: boolean}}
 */
const optionsDefaults = {
    namespace: "com.afimport.default",
    override: false
};

/**
 * @private
 *
 * @param {string} key
 * @param {?{namespace: ?string, override: ?boolean}} option
 * @returns {*}
 */
function getOption(key, option) {
    if (!option) {
        return optionsDefaults[key];
    }
    return option[key] || optionsDefaults[key];
}

/**
 *
 * @param {string} filePattern
 * @param {?{namespace: ?string, override: ?boolean}} options
 * @returns {?Array.<string>}
 */
module.exports.include = function (filePattern, options) {
    if (Array.isArray(filePattern)) {
        var included = [];
        for (var i = 0; i < filePattern.length; i++) {
            included.concat(module.exports.include(filePattern[i], options) || []);
        }
        return included;
    }

    function includeFiles(files) {
        addToIncludedQueue(files, options);
        var included = [];
        while (includeQueue.length > 0) {
            var queued = includeQueue[0];
            var className = includeClass(queued.classPath, options);
            if (className) {
                included.push(className);
            }
        }

        return included;
    }

    try {
        var files = glob.sync(filePattern, null);
        return includeFiles(files);
    } catch (err) {
        throw err;
        return null;
    }
};

/**
 *
 * @param {Function} class
 * @param {string} className
 * @param {?{namespace: ?string, override: ?boolean}} options
 */
module.exports.provide = function (clazz, className, options) {
    className = path.basename(className, '.js');
    var namespace = getOption("namespace", options);
    var nameSpacedClassName = namespace + "." + className;
    if (includes[nameSpacedClassName]) {
        throw new Error("AFImport: Class " + className + " already provided.");
        return;
    }
    includes[nameSpacedClassName] = {clazz: clazz, className: className, namespace: namespace, options: options};
};

/**
 *
 * @param {string} className
 * @param {?{namespace: ?string, override: ?boolean}} options
 * @returns {Function}
 */
module.exports.require = function (className, options) {
    className = path.basename(className, '.js');
    const nameSpacedClassName = getOption("namespace", options) + "." + className;
    var clazz = (includes[nameSpacedClassName] || {})["clazz"];
    if (!clazz) {
        for (var i = 0; i < includeQueue.length; i++) {
            if (includeQueue[i].nameSpacedClassName == nameSpacedClassName) {
                includeClass(includeQueue[i].classPath, includeQueue[i].options);
                return module.exports.require(className, options);
            }
        }
        throw new Error("AFImport: Class " + className + " Not inlcuded.");
    }
    return clazz;
};

/**
 *
 * @constructor AFImortModule
 */
function AFImortModule() {
}

AFImortModule.prototype.property;
AFImortModule.prototype.previous;

/**
 *
 * Exports an AFImortModule
 *
 * @returns {?AFImortModule}
 */
module.exports.exportModule = function () {
    var exports = new AFImortModule();
    for (var key in includes) {
        exports.property = includes[key];
        var newExports = new AFImortModule();
        newExports.previous = exports;
        exports = newExports;
    }
    exports = exports.previous;

    if (!exports || !exports.property) {
        return null;
    }
    return exports;
};

/**
 *
 * Imports an AFImortModule
 *
 * @param {?AFImortModule} afModule
 */
module.exports.importModule = function (afModule) {
    if (!afModule) {
        return;
    }
    if (!(afModule.constructor.name == "AFImortModule")) {
        throw new Error("incorrect type in module");
    }
    var exports = afModule;
    while (exports) {
        if (!(afModule.constructor.name == "AFImortModule")) {
            throw new Error("incorrect type in module");
        }
        includes[exports.property.namespace + "." + exports.property.className] = exports.property;
        exports = exports.previous;
    }
};
