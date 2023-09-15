"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalize_require_file = void 0;
const path = __importStar(require("path"));
// ---------------------------------------------------------------------------------------------------------------------
/**
 * @method normalize_require_file
 * @param baseFolder
 * @param fullPathToFile
 *
 *
 * @example:
 *    normalize_require_file("/home/bob/folder1/","/home/bob/folder1/folder2/toto.js").should.eql("./folder2/toto");
 */
function normalize_require_file(baseFolder, fullPathToFile) {
    let localFile = path.relative(baseFolder, fullPathToFile).replace(/\\/g, "/");
    // append ./ if necessary
    if (localFile.substring(0, 1) !== ".") {
        localFile = "./" + localFile;
    }
    // remove extension
    localFile = localFile.substring(0, localFile.length - path.extname(localFile).length);
    return localFile;
}
exports.normalize_require_file = normalize_require_file;
//# sourceMappingURL=normalize_require_file.js.map