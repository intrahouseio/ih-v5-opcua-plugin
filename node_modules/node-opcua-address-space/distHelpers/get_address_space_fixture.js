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
exports.getAddressSpaceFixture = void 0;
/**
 * @module node-opcua-address-space
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function getAddressSpaceFixture(pathname) {
    // find in nodesets folder in the first place
    const folder1 = path.join(__dirname, "../nodesets");
    if (fs.existsSync(folder1)) {
        const filename = path.join(folder1, pathname);
        if (fs.existsSync(filename)) {
            return filename;
        }
    }
    // find in  test_fixtures seconds
    let folder = path.join(__dirname, "./test_fixtures");
    if (!fs.existsSync(folder)) {
        folder = path.join(__dirname, "../test_helpers/test_fixtures");
        if (!fs.existsSync(folder)) {
            folder = path.join(__dirname, "../../test_helpers/test_fixtures");
            // istanbul ignore next
            if (!fs.existsSync(folder)) {
                // tslint:disable:no-console
                console.log(" cannot find test_fixtures folder ");
            }
        }
    }
    const filename = path.join(folder, pathname);
    // istanbul ignore next
    if (!fs.existsSync(filename)) {
        throw new Error(" cannot find fixture with name " + pathname);
    }
    return filename;
}
exports.getAddressSpaceFixture = getAddressSpaceFixture;
//# sourceMappingURL=get_address_space_fixture.js.map